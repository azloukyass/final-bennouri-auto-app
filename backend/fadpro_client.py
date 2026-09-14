"""
FadPro.tn B2B partner integration.
- Login once per session, cache JWT in-memory (token expires ~12h)
- Search by reference origin: GET /fad/api/b2b/search?refFour=...
- Apply unified price markup (same formula across all suppliers —
  FadPro, Copia, PartsPro, AD-Tunisie):
      prix_final = prix_origine * (1 + PRICE_MARKUP_VAT + PRICE_MARGIN)
                  = prix_origine * 1.45   (19% VAT + 26% margin)
"""

import os
import time
import logging
from typing import Optional, List, Dict

import httpx

logger = logging.getLogger(__name__)

FADPRO_BASE = os.environ.get("FADPRO_BASE_URL", "https://fadpro.tn:8095")
FADPRO_USER = os.environ.get("FADPRO_USER", "5428")
FADPRO_PASS = os.environ.get("FADPRO_PASSWORD", "wk5428fad*/*")
PRICE_MARKUP_VAT = 0.19       # +19% VAT
PRICE_MARGIN = 0.26            # +26% margin

# In-memory cache for token (single FastAPI worker)
_token_cache = {"token": None, "expires_at": 0}


async def _get_token(force: bool = False) -> Optional[str]:
    """Get FadPro auth token, refresh if expired (or forced)."""
    now = time.time()
    if not force and _token_cache["token"] and _token_cache["expires_at"] > now + 60:
        return _token_cache["token"]

    url = f"{FADPRO_BASE}/fad/auth/login"
    params = {"custNo": FADPRO_USER, "password": FADPRO_PASS}
    try:
        async with httpx.AsyncClient(verify=False, timeout=30.0) as cl:
            r = await cl.post(url, params=params)
            if r.status_code != 200:
                logger.warning(f"FadPro login failed: {r.status_code} {r.text[:200]}")
                return None
            data = r.json()
            token = data.get("token")
            if not token:
                return None
            # JWT lifetime ~12h based on iat/exp from response; cache for 11h to be safe
            _token_cache["token"] = token
            _token_cache["expires_at"] = now + 11 * 3600
            return token
    except Exception as e:
        logger.warning(f"FadPro login error: {e}")
        return None


def _adjust_price(prix) -> Optional[float]:
    """Apply the unified markup used across every supplier:
    final = prix_origine * (1 + PRICE_MARKUP_VAT + PRICE_MARGIN)
          = prix_origine * 1.45   (19% VAT + 26% margin)
    Returns rounded to 3 decimals (TND)."""
    if prix is None:
        return None
    try:
        p = float(prix)
    except (TypeError, ValueError):
        return None
    if p <= 0:
        return None
    return round(p * (1 + PRICE_MARKUP_VAT + PRICE_MARGIN), 3)


def _normalize_item(raw: Dict) -> Dict:
    """Map raw FadPro item to our public response shape."""
    raw_prix = raw.get("prix")
    stock_qty = raw.get("stock") or 0
    dispo = (raw.get("dispo") or "").upper()
    in_stock = dispo == "S" and stock_qty > 0

    return {
        "reference": raw.get("refFour") or "",
        "fournisseur": raw.get("itemNomFpur") or raw.get("four") or "",
        "designation": raw.get("designation") or "",
        "modele": raw.get("marque") or "",
        "in_stock": in_stock,
        "stock": stock_qty,
        "prix_origine_tnd": float(raw_prix) if isinstance(raw_prix, (int, float)) else None,
        "prix_tnd": _adjust_price(raw_prix),
        "image": raw.get("imageTecdoc") or (raw.get("images") if isinstance(raw.get("images"), str) else ""),
        "categorie": " / ".join([x for x in [raw.get("niv1"), raw.get("niv2"), raw.get("niv3"), raw.get("niv4")] if x]),
    }


async def search_by_niv_levels(niv1: str, niv2: Optional[str] = None,
                                niv3: Optional[str] = None, niv4: Optional[str] = None) -> List[Dict]:
    """Browse FadPro catalog by hierarchical niv1/niv2/niv3/niv4 levels."""
    token = await _get_token()
    if not token:
        raise RuntimeError("Authentification FadPro impossible")
    params = {"niv1": niv1}
    if niv2: params["niv2"] = niv2
    if niv3: params["niv3"] = niv3
    if niv4: params["niv4"] = niv4
    url = f"{FADPRO_BASE}/fad/api/level/searchByNivLevels"
    return await _fadpro_get_json(url, params, token)


async def search_by_designation(designation: str) -> List[Dict]:
    """Browse FadPro catalog by free-text designation
    (`/fad/api/b2b/search?designation=...`)."""
    token = await _get_token()
    if not token:
        raise RuntimeError("Authentification FadPro impossible")
    url = f"{FADPRO_BASE}/fad/api/b2b/search"
    return await _fadpro_get_json(url, {"designation": designation}, token)


async def _fadpro_get_json(url: str, params: Dict, token: str) -> List[Dict]:
    """Shared GET helper with auto re-auth and normalisation."""
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    try:
        async with httpx.AsyncClient(verify=False, timeout=30.0) as cl:
            r = await cl.get(url, params=params, headers=headers)
            if r.status_code == 401:
                new_token = await _get_token(force=True)
                headers["Authorization"] = f"Bearer {new_token}"
                r = await cl.get(url, params=params, headers=headers)
            if r.status_code != 200:
                logger.warning(f"FadPro GET {url} → {r.status_code} {r.text[:200]}")
                return []
            data = r.json()
            if not isinstance(data, list):
                return []
            return [_normalize_item(it) for it in data]
    except (httpx.RequestError, ValueError) as e:
        logger.warning(f"FadPro GET error: {e}")
        return []


async def search_reference(reference: str) -> List[Dict]:
    """Search FadPro for parts matching a reference. Returns list of normalized dicts."""
    ref = (reference or "").strip()
    if not ref:
        return []

    token = await _get_token()
    if not token:
        raise RuntimeError("Authentification FadPro impossible")

    url = f"{FADPRO_BASE}/fad/api/b2b/search"
    headers = {"Authorization": f"Bearer {token}"}
    try:
        async with httpx.AsyncClient(verify=False, timeout=30.0) as cl:
            r = await cl.get(url, params={"refFour": ref}, headers=headers)
            if r.status_code == 401:
                # Token expired? Try once more
                token = await _get_token(force=True)
                if not token:
                    raise RuntimeError("Authentification FadPro impossible (refresh)")
                headers["Authorization"] = f"Bearer {token}"
                r = await cl.get(url, params={"refFour": ref}, headers=headers)
            if r.status_code != 200:
                logger.warning(f"FadPro search failed: {r.status_code} {r.text[:200]}")
                raise RuntimeError(f"Malheureusement, nous n'avons pas cet article en stock. Veuillez nous contacter par courriel ou par téléphone et nous trouverons une solution.")
            data = r.json()
            if not isinstance(data, list):
                return []
            items = [_normalize_item(it) for it in data]
            # Filter: only items with a usable adjusted price OR with valid stock info
            # (Keep all so user sees out-of-stock options too — frontend handles display)
            return items
    except httpx.RequestError as e:
        logger.warning(f"FadPro request error: {e}")
        raise RuntimeError("Réseau FadPro indisponible")
