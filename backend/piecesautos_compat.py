"""
PiecesAutos.tn compatibility scraper.

Used to verify whether a given OEM reference is *compatible* with the
customer's vehicle when the supplier's article designation doesn't already
contain the vehicle name (e.g. "CLIO 4").

Workflow:
  1. GET /recherche/{ref} → grab the first /piece/... link.
  2. GET that piece URL → parse the "Compatible" section into a flat list
     of "MANUFACTURER MODEL" strings.
  3. Return the list. The caller checks membership against the vehicle's
     normalised model token (e.g. {"CLIO 4", "CLIO IV"}).

The site has no Cloudflare protection — plain httpx GETs are sufficient.
"""
import asyncio
import logging
import re
from typing import List, Optional, Tuple

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

BASE = "https://www.piecesautos.tn"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0 Safari/537.36",
    "Accept-Language": "fr-FR,fr;q=0.9",
    "Referer": f"{BASE}/",
}

# Match the numeric piece id at the end of /piece/<slug>-<NNN> URLs
_PIECE_ID_RE = re.compile(r"/piece/[^/]+-(\d+)$")


# ──────────────────────────────────────────────────────────────────────────
# Scraping primitives
# ──────────────────────────────────────────────────────────────────────────
async def _first_piece_id(client: httpx.AsyncClient, ref: str) -> Optional[int]:
    """Return the numeric piece id of the first /piece/... result for `ref`."""
    try:
        r = await client.get(f"{BASE}/recherche/{ref}", timeout=20.0)
        if r.status_code != 200:
            return None
        soup = BeautifulSoup(r.text, "html.parser")
        for a in soup.find_all("a", href=True):
            m = _PIECE_ID_RE.search(a["href"])
            if m:
                return int(m.group(1))
        return None
    except Exception as e:
        logger.warning(f"piecesautos search failed for {ref}: {type(e).__name__}: {e!r}")
        return None


async def _fetch_compatible_list(client: httpx.AsyncClient, piece_id: int) -> List[str]:
    """Fetch the AJAX `/fiche_produit_comp/{id}` endpoint and return the
    flattened list of compatible vehicles, e.g. ["Renault CLIO IV (BH_)", ...]"""
    try:
        r = await client.get(f"{BASE}/fiche_produit_comp/{piece_id}", timeout=20.0)
        if r.status_code != 200:
            return []
        soup = BeautifulSoup(r.text, "html.parser")
        results: List[str] = []
        for section in soup.select("div.spec__section"):
            manu_h4 = section.select_one("h4.spec__section-title")
            if not manu_h4:
                continue
            manu = manu_h4.get_text(strip=True)
            for row in section.select("div.spec__row"):
                name_el = row.select_one("div.spec__name")
                if not name_el:
                    continue
                model = name_el.get_text(" ", strip=True)
                if manu and model:
                    results.append(f"{manu} {model}")
        return results
    except Exception as e:
        logger.warning(f"piecesautos compat fetch failed for piece_id={piece_id}: {type(e).__name__}: {e!r}")
        return []


async def fetch_compatibility(ref: str) -> List[str]:
    """High-level: returns the compatibility list for a given OEM reference."""
    ref = (ref or "").strip()
    if not ref:
        return []
    async with httpx.AsyncClient(headers=HEADERS, follow_redirects=True) as client:
        piece_id = await _first_piece_id(client, ref)
        if not piece_id:
            return []
        return await _fetch_compatible_list(client, piece_id)


# ──────────────────────────────────────────────────────────────────────────
# Vehicle-name matching helpers
# ──────────────────────────────────────────────────────────────────────────
_ROMAN = {
    "I": "1", "II": "2", "III": "3", "IV": "4", "V": "5",
    "VI": "6", "VII": "7", "VIII": "8", "IX": "9", "X": "10",
}
_ROMAN_INV = {v: k for k, v in _ROMAN.items()}


def vehicle_tokens(manu: str, model: str) -> Tuple[str, List[str]]:
    """Build matching tokens for a vehicle.

    Returns (canonical_manu, [match_patterns]):
      manu="RENAULT", model="CLIO IV (BH_)"
        → ("renault", ["clio iv", "clio 4"])
      manu="RENAULT", model="MEGANE III Grandtour (KZ0/1)"
        → ("renault", ["megane iii", "megane 3"])
      manu="VW",       model="GOLF V (1K1)"
        → ("vw", ["golf v", "golf 5"])
    """
    manu = (manu or "").strip().lower()
    model = (model or "").strip()
    # Strip code-name in parentheses: "CLIO IV (BH_)" → "CLIO IV"
    model_clean = re.sub(r"\s*\([^)]*\)\s*", "", model).strip()
    parts = model_clean.split()
    if not parts:
        return manu, []
    base = parts[0]  # "CLIO"
    variant = parts[1] if len(parts) > 1 else ""
    out_set = set()
    out_set.add(model_clean.lower())
    if variant:
        out_set.add(f"{base} {variant}".lower())
        v_upper = variant.upper()
        if v_upper in _ROMAN:
            out_set.add(f"{base} {_ROMAN[v_upper]}".lower())
        elif v_upper in _ROMAN_INV:
            out_set.add(f"{base} {_ROMAN_INV[v_upper]}".lower())
    # also bare model base
    out_set.add(base.lower())
    return manu, sorted(out_set)


def title_matches_vehicle(title: str, model_tokens: List[str]) -> bool:
    """Cheap check: does the supplier's article designation already mention
    the FULL vehicle (model + variant, e.g. "CLIO 4" or "CLIO IV")? Avoids
    the piecesautos.tn round-trip for obvious cases. We require a multi-token
    phrase (space inside) — bare model bases like "clio" alone aren't strong
    enough evidence and fall through to the compatibility scrape."""
    if not title or not model_tokens:
        return False
    t = title.lower()
    for tok in model_tokens:
        # Only multi-word tokens like "clio 4", "clio iv" — never bare "clio".
        if tok and " " in tok and tok in t:
            return True
    return False


def compat_list_matches_vehicle(compat_list: List[str], manu: str, model_tokens: List[str]) -> bool:
    """Does any line from piecesautos.tn compatibility list match our vehicle?"""
    if not compat_list:
        return False
    manu = (manu or "").lower()
    for line in compat_list:
        ln = line.lower()
        # require manufacturer mention if present
        if manu and manu not in ln:
            continue
        for tok in model_tokens:
            # Require multi-word token (model + variant) — bare base like "clio"
            # alone could match unrelated generations.
            if tok and " " in tok and tok in ln:
                return True
    return False
