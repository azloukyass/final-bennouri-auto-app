"""
RapidAPI · Auto Parts Catalog (TecDoc) client.
- VIN → modelId
- modelId + search-param → OEM articles
"""

import os
import logging
import httpx
from typing import Optional, List, Dict
import re
import unicodedata

logger = logging.getLogger(__name__)

API_HOST = "auto-parts-catalog.p.rapidapi.com"
API_BASE = f"https://{API_HOST}"
LANG_FR = 6  # TecDoc language id for French
TYPE_ID = 1  # passenger car


def _api_key() -> str:
    k = os.environ.get("RAPIDAPI_KEY", "")
    if not k:
        raise RuntimeError("RAPIDAPI_KEY non configurée")
    return k


def _headers() -> dict:
    return {
        "x-rapidapi-key": _api_key(),
        "x-rapidapi-host": API_HOST,
        "Content-Type": "application/json",
    }


async def vin_lookup(vin: str) -> Optional[Dict]:
    """Look up a VIN → returns {manuId, manuName, modelId, modelName} or None."""
    vin = (vin or "").strip().upper()
    if len(vin) < 11:
        return None
    url = f"{API_BASE}/vin/tecdoc-vin-check/{vin}"
    try:
        async with httpx.AsyncClient(timeout=30.0) as cl:
            r = await cl.get(url, headers=_headers())
            if r.status_code != 200:
                logger.warning(f"RapidAPI vin lookup {vin} → {r.status_code}: {r.text[:200]}")
                return None
            payload = r.json()
            data = (payload or {}).get("data") or {}
            manus = (data.get("matchingManufacturers") or {}).get("array") or []
            models = (data.get("matchingModels") or {}).get("array") or []
            if not models:
                return None
            m = models[0]
            manu = next((x for x in manus if x.get("manuId") == m.get("manuId")), {})
            return {
                "vin": vin,
                "manu_id": m.get("manuId"),
                "manu_name": manu.get("manuName") or m.get("manuName") or "",
                "model_id": m.get("modelId"),
                "model_name": m.get("modelName") or "",
            }
    except Exception as e:
        logger.warning(f"RapidAPI vin error: {e}")
        return None


async def list_vehicles_for_model(model_id: int, lang_id: int = LANG_FR,
                                   country_filter_id: int = 63) -> List[Dict]:
    """Step preceding search_oem: resolve a TecDoc modelId to its concrete
    vehicleId variants (motor / construction interval). Returns the raw
    vehicle list as a list of {vehicleId, typeEngineName, …}.
    """
    if not model_id:
        return []
    url = (
        f"{API_BASE}/types/type-id/{TYPE_ID}/list-vehicles-id/{model_id}"
        f"/lang-id/{lang_id}/country-filter-id/{country_filter_id}"
    )
    try:
        async with httpx.AsyncClient(timeout=30.0) as cl:
            r = await cl.get(url, headers=_headers())
            if r.status_code != 200:
                logger.warning(f"RapidAPI list-vehicles → {r.status_code}: {r.text[:200]}")
                return []
            data = r.json()
            if isinstance(data, dict):
                items = data.get("modelTypes") or data.get("vehicles") or []
            elif isinstance(data, list):
                items = data
            else:
                items = []
            return items if isinstance(items, list) else []
    except Exception as e:
        logger.warning(f"RapidAPI list-vehicles error: {e}")
        return []


# ──────────────────────────────────────────────────────────────────────────
# VIN → sra_commercial via vin-decoder-mega + intelligent vehicle-id picker
# ──────────────────────────────────────────────────────────────────────────
VIN_MEGA_HOST = "vin-decoder-mega.p.rapidapi.com"
import os, re


async def vin_mega_decode(vin: str) -> Optional[Dict]:
    """Resolve a VIN via vin-decoder-mega — used to obtain the
    `sra_commercial` field (e.g. "1.6 HDI 75 (MF9HW, GJ9HWC, ...)").
    """
    vin = (vin or "").strip().upper()
    if not vin or len(vin) != 17:
        return None
    headers = {
        "x-rapidapi-host": VIN_MEGA_HOST,
        "x-rapidapi-key": os.environ.get("RAPIDAPI_KEY", ""),
        "Content-Type": "application/x-www-form-urlencoded",
    }
    try:
        async with httpx.AsyncClient(timeout=20.0) as cl:
            r = await cl.post(f"https://{VIN_MEGA_HOST}/vin.php", headers=headers, data={"vin": vin})
            if r.status_code != 200:
                logger.warning(f"vin-mega → {r.status_code}: {r.text[:200]}")
                return None
            payload = r.json()
            if not isinstance(payload, dict):
                return None
            # vin-decoder-mega nests the real fields under "data"
            inner = payload.get("data")
            if isinstance(inner, dict):
                return inner
            return payload
    except Exception as e:
        logger.warning(f"vin-mega error: {e}")
        return None


def _engine_tokens(text: str) -> List[str]:
    """Tokenise an engine description. Strips parenthesised content, lower-
    cases everything, and normalises common manufacturer variants so that
    'bluehdi' == 'hdi', 'tdci' stays itself, etc."""
    if not text:
        return []
    # drop content inside parentheses
    t = re.sub(r"\([^)]*\)", "", text).lower()
    # split on whitespace
    raw = [w for w in re.split(r"[\s,]+", t) if w]
    out = []
    for w in raw:
        # normalise BlueHDi / Blue-HDi / e-HDi → hdi
        w2 = w
        w2 = re.sub(r"^(blue[-]?|e[-]?)", "", w2)
        out.append(w2)
    return out


def pick_best_vehicle_id(vehicles: List[Dict], sra_commercial: str) -> Optional[int]:
    """Pick the TecDoc vehicleId whose `typeEngineName` matches the
    sra_commercial token-by-token. Returns None if no acceptable match is
    found (caller should fall back to the first vehicle)."""
    if not vehicles or not sra_commercial:
        return None
    sra_toks = _engine_tokens(sra_commercial)
    if not sra_toks:
        return None
    best = None
    best_score = 0
    for v in vehicles:
        eng = (v.get("typeEngineName") or "")
        eng_toks = set(_engine_tokens(eng))
        if not eng_toks:
            continue
        # Score = number of sra tokens that appear in the engine tokens
        score = sum(1 for t in sra_toks if t in eng_toks)
        # Strong match: every sra token is present
        if score == len(sra_toks) and score > best_score:
            best_score = score
            best = v.get("vehicleId")
    return best

def _norm(s: str) -> str:
    """Lowercase, strip accents, collapse whitespace — for exact comparisons."""
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"\s+", " ", s.strip().lower())
    return s


async def search_oem(vehicle_id: int, search_param: str, lang_id: int = LANG_FR) -> List[Dict]:
    """Search OEM parts for a *vehicleId* by free-text search-param.
    Returns the raw list of {ref, name} items as TecDoc provides them.
    Server-side relevance filtering (strict 1:1 in phrase mode, contains in
    split mode) is handled in `/api/oem-stock-search`.
    """
    sp = (search_param or "").strip()
    if not sp or not vehicle_id:
        return []
    import urllib.parse
    sp_enc = urllib.parse.quote(sp, safe="")
    url = (
        f"{API_BASE}/articles-oem/selecting-oem-parts-vehicle-modification-description-product-group"
        f"/type-id/{TYPE_ID}/vehicle-id/{vehicle_id}/lang-id/{lang_id}/search-param/{sp_enc}"
    )
    try:
        async with httpx.AsyncClient(timeout=30.0) as cl:
            r = await cl.get(url, headers=_headers())
            if r.status_code != 200:
                logger.warning(f"RapidAPI search-oem → {r.status_code}: {r.text[:200]}")
                return []
            data = r.json()
            if not isinstance(data, list):
                return []
            out = []
            seen = set()
            for item in data:
                oem = (item.get("articleOemNo") or "").strip()
                name = (item.get("articleProductName") or "").strip()
                if not oem or oem in seen:
                    continue
                seen.add(oem)
                out.append({"ref": oem, "name": name})
            return out
    except Exception as e:
        logger.warning(f"RapidAPI search-oem error: {e}")
        return []


async def find_article_by_oem(article_oem_no: str, lang_id: int = LANG_FR) -> Optional[Dict]:
    """Step 1: POST /articles-oem/article-oem-search-no with the OEM reference.
    Returns the FIRST matching article (with articleId) or None.
    """
    ref = (article_oem_no or "").strip()
    if not ref:
        return None
    url = f"{API_BASE}/articles-oem/article-oem-search-no"
    headers = {
        "x-rapidapi-key": _api_key(),
        "x-rapidapi-host": API_HOST,
        "Content-Type": "application/x-www-form-urlencoded",
    }
    try:
        async with httpx.AsyncClient(timeout=30.0) as cl:
            r = await cl.post(url, headers=headers, data={"langId": lang_id, "articleOemNo": ref})
            if r.status_code != 200:
                logger.warning(f"RapidAPI article-oem-search → {r.status_code}: {r.text[:200]}")
                return None
            data = r.json()
            if not isinstance(data, list) or not data:
                return None
            return data[0]
    except Exception as e:
        logger.warning(f"RapidAPI article-oem-search error: {e}")
        return None


async def article_complete_details(article_id: int, type_id: int = 1, lang_id: int = LANG_FR,
                                    country_filter_id: int = 63) -> Optional[Dict]:
    """Step 2: POST /articles/article-id-complete-details. Returns the full
    article dict {articleId, articleNo, articleProductName, supplierName,
    s3image, allSpecifications, oemNo, compatibleCars, …} or None."""
    if not article_id:
        return None
    url = f"{API_BASE}/articles/article-id-complete-details"
    headers = {
        "x-rapidapi-key": _api_key(),
        "x-rapidapi-host": API_HOST,
        "Content-Type": "application/x-www-form-urlencoded",
    }
    try:
        async with httpx.AsyncClient(timeout=30.0) as cl:
            r = await cl.post(url, headers=headers, data={
                "typeId": type_id,
                "langId": lang_id,
                "countryFilterId": country_filter_id,
                "articleId": article_id,
            })
            if r.status_code != 200:
                logger.warning(f"RapidAPI article-details → {r.status_code}: {r.text[:200]}")
                return None
            payload = r.json() or {}
            return payload.get("article") or None
    except Exception as e:
        logger.warning(f"RapidAPI article-details error: {e}")
        return None
