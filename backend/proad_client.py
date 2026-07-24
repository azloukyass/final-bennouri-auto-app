"""
proad_client.py — Client for the "ProAd" supplier (pro.ad-tunisie.com), a
Magento 2 storefront that requires a logged-in "pro" account to see prices
and stock. This mirrors the search_reference(ref) contract used by
fadpro_client / iis_supplier_client (copia, partspro) so it can be dropped
straight into the existing parallel supplier lookups in server.py.

Login flow (standard Magento 2 customer login):
  1. GET  /customer/account/login/          → scrape hidden `form_key`
  2. POST /customer/account/loginPost/      → login[username], login[password], form_key
  3. Persist cookies (PHPSESSID etc.) on the shared httpx.AsyncClient and
     reuse them for subsequent searches.

Search flow:
  GET /catalogsearch/result/?q={ref}        → parse the product-grid HTML.

IMPORTANT: the HTML selectors below follow Magento 2's default Luma theme
structure (`li.product-item`, `a.product-item-link`, `span.price`, etc).
If pro.ad-tunisie.com uses a customized theme, some of the CSS selectors in
`_parse_search_results()` may need adjusting — inspect the search-result
page in your browser (F12 → Elements) once logged in and compare against
the selectors marked "ADJUST IF NEEDED" below.
"""

import os
import re
import logging
import asyncio
from typing import List, Optional

import httpx
from bs4 import BeautifulSoup

BASE_URL = "https://pro.ad-tunisie.com"
LOGIN_PAGE_URL = f"{BASE_URL}/customer/account/login/"
LOGIN_POST_URL = f"{BASE_URL}/customer/account/loginPost/"
SEARCH_URL = f"{BASE_URL}/catalogsearch/result/"

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
}

# Credentials: prefer env vars, fall back to the values supplied by the shop
# owner. Move these to your .env as PROAD_EMAIL / PROAD_PASSWORD so they
# aren't hardcoded in source control.
PROAD_EMAIL = os.environ.get("PROAD_EMAIL", "stevertautozorraga@gmail.com")
PROAD_PASSWORD = os.environ.get("PROAD_PASSWORD", "VERTAUTO-2023")

_FORM_KEY_RE = re.compile(r'name=["\']form_key["\']\s+value=["\']([^"\']+)["\']')


class ProAdClient:
    """Maintains one authenticated session (cookies) for pro.ad-tunisie.com.

    A single asyncio.Lock serialises every call through this client — same
    pattern as Copia/PartsPro in iis_supplier_client.py — because we only
    keep ONE logged-in session and Magento sessions aren't safe to hit with
    unlimited concurrency (risk of session/cart race conditions server-side).
    """

    def __init__(self):
        self._client: Optional[httpx.AsyncClient] = None
        self._logged_in = False
        self._lock = asyncio.Lock()

    async def _ensure_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                headers=DEFAULT_HEADERS,
                timeout=15.0,
                follow_redirects=True,
            )
        return self._client

    async def _login(self) -> bool:
        """Perform the Magento login flow. Returns True on apparent success."""
        client = await self._ensure_client()
        try:
            # 1. Fetch login page to extract the CSRF form_key
            r1 = await client.get(LOGIN_PAGE_URL)
            match = _FORM_KEY_RE.search(r1.text)
            if not match:
                logging.warning("ProAd login: form_key introuvable sur la page de login")
                return False
            form_key = match.group(1)

            # 2. Submit credentials
            payload = {
                "form_key": form_key,
                "login[username]": PROAD_EMAIL,
                "login[password]": PROAD_PASSWORD,
            }
            r2 = await client.post(LOGIN_POST_URL, data=payload)

            # Magento redirects back to the account/homepage on success and
            # back to the login page (often with an error message) on
            # failure. We treat "no longer on the login page" + absence of
            # an obvious error banner as success.
            final_url = str(r2.url)
            looks_logged_in = "customer/account/login" not in final_url
            has_error_hint = "invalid" in r2.text.lower() and "password" in r2.text.lower()

            if looks_logged_in and not has_error_hint:
                self._logged_in = True
                logging.info("ProAd login OK")
                return True

            logging.warning(f"ProAd login failed (final_url={final_url})")
            return False
        except Exception as e:
            logging.warning(f"ProAd login exception: {e}")
            return False

    async def _search_html(self, ref: str) -> Optional[str]:
        client = await self._ensure_client()
        r = await client.get(SEARCH_URL, params={"q": ref})
        # If Magento bounces us to the login page, our session died —
        # signal the caller to re-login and retry once.
        if "customer/account/login" in str(r.url):
            return None
        return r.text

    async def search_reference(self, ref: str) -> List[dict]:
        """Search pro.ad-tunisie.com for `ref`, logging in first (or
        re-logging in if the session expired). Returns a list of dicts
        shaped like the other suppliers:
        {reference, designation, prix_tnd, in_stock, stock, fournisseur, source}
        """
        ref = (ref or "").strip()
        if not ref:
            return []

        async with self._lock:
            if not self._logged_in:
                ok = await self._login()
                if not ok:
                    return []

            html = await self._search_html(ref)
            if html is None:
                # Session expired mid-flight — try one re-login + retry
                self._logged_in = False
                ok = await self._login()
                if not ok:
                    return []
                html = await self._search_html(ref)
                if html is None:
                    return []

            try:
                return _parse_search_results(html, ref)
            except Exception as e:
                logging.warning(f"ProAd parse error for ref={ref}: {e}")
                return []

    async def close(self):
        if self._client is not None:
            await self._client.aclose()
            self._client = None
            self._logged_in = False


def _parse_price(text: str) -> Optional[float]:
    """Extract a float price from strings like '123,450 DT', '45.500 TND',
    '1 234,000 DT'. Handles both comma and dot decimal separators and
    thousands separators (space or comma-as-thousands is ambiguous in
    Tunisia, so we only strip spaces, then normalise the LAST separator
    found as the decimal point)."""
    if not text:
        return None
    cleaned = re.sub(r"[^\d,\.]", "", text).strip()
    if not cleaned:
        return None
    # Normalise: keep only the last , or . as decimal separator
    last_comma = cleaned.rfind(",")
    last_dot = cleaned.rfind(".")
    decimal_pos = max(last_comma, last_dot)
    if decimal_pos == -1:
        try:
            return float(cleaned)
        except ValueError:
            return None
    integer_part = re.sub(r"[,\.]", "", cleaned[:decimal_pos])
    decimal_part = cleaned[decimal_pos + 1:]
    try:
        return float(f"{integer_part}.{decimal_part}")
    except ValueError:
        return None


def _parse_search_results(html: str, searched_ref: str) -> List[dict]:
    """Parse a Magento 2 catalogsearch result page into normalised items.

    ADJUST IF NEEDED: the selectors below assume the default Luma theme
    product-grid markup:
        <li class="item product product-item">
          <a class="product-item-link">NAME</a>
          <span class="price">123,450 DT</span>
          <div class="stock available|unavailable">En stock|Rupture de stock</div>
        </li>
    If pro.ad-tunisie.com uses a custom theme, open the search results page
    in your browser, right-click a product card → Inspect, and update the
    CSS selectors (`PRODUCT_ITEM_SEL`, `NAME_SEL`, `PRICE_SEL`, `STOCK_SEL`)
    to match what you actually see.
    """
    soup = BeautifulSoup(html, "html.parser")

    PRODUCT_ITEM_SEL = "li.product-item, div.product-item-info"
    NAME_SEL = ".product-item-link, .product-item-name a"
    PRICE_SEL = ".price-box .price, span.price"
    STOCK_SEL = ".stock, [class*=stock]"

    items = []
    seen = set()

    for node in soup.select(PRODUCT_ITEM_SEL):
        name_el = node.select_one(NAME_SEL)
        if not name_el:
            continue
        name = name_el.get_text(strip=True)
        if not name or name in seen:
            continue
        seen.add(name)

        price_el = node.select_one(PRICE_SEL)
        price = _parse_price(price_el.get_text(strip=True)) if price_el else None

        stock_el = node.select_one(STOCK_SEL)
        stock_text = stock_el.get_text(strip=True).lower() if stock_el else ""
        # Magento default classes: "stock available" vs "stock unavailable"
        stock_classes = " ".join(stock_el.get("class", [])) if stock_el else ""
        in_stock = (
            "unavailable" not in stock_classes
            and "rupture" not in stock_text
            and "épuisé" not in stock_text
        )

        items.append({
            "reference": searched_ref,
            "designation": name,
            "prix_tnd": price,
            "in_stock": bool(in_stock and price),
            "stock": 10 if in_stock else 0,  # ProAd doesn't expose exact qty on the grid
            "fournisseur": "ProAd",
            "source": "proad",
        })

    return items


# ── Module-level singleton (same pattern as get_copia()/get_partspro()) ──
_proad_instance: Optional[ProAdClient] = None


def get_proad() -> ProAdClient:
    global _proad_instance
    if _proad_instance is None:
        _proad_instance = ProAdClient()
    return _proad_instance


async def search_reference(ref: str) -> List[dict]:
    """Convenience free function mirroring fadpro_client.search_reference,
    so it can be imported the same way in server.py."""
    return await get_proad().search_reference(ref)