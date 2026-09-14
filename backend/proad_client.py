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

Search flow (single reference):
  GET /catalogsearch/result/?q={ref}        → parse the product-grid HTML.

Category flow (popular-categories feature — "batterie" / "huile-moteur"):
  GET /catalog-search/batteries4365.html?product_list_limit=100&p=N
  GET /catalog-search/lubrifiants3673.html?product_list_limit=100&p=N
  → parse every <li class="item product product-item"> across all pages.

IMPORTANT: the search_reference() selectors below follow Magento 2's
default Luma theme structure. The category-listing selectors
(_parse_category_results) were verified against the actual rendered HTML
of pro.ad-tunisie.com's battery and lubrifiant category pages, so they
should be accurate as-is. If the site's theme changes, re-inspect
(F12 → Elements) and adjust the selectors marked "ADJUST IF NEEDED".
"""

import os
import re
import logging
import asyncio
from typing import List, Optional, Tuple

import httpx
from bs4 import BeautifulSoup

BASE_URL = "https://pro.ad-tunisie.com"
LOGIN_PAGE_URL = f"{BASE_URL}/customer/account/login/"
LOGIN_POST_URL = f"{BASE_URL}/customer/account/loginPost/"
SEARCH_URL = f"{BASE_URL}/catalogsearch/result/"

# Popular-category listing pages (direct catalog-search URLs, not the
# site-search box) used by the "catégories populaires" feature.
CATEGORY_URLS = {
    "batterie": f"{BASE_URL}/catalog-search/batteries4365.html",
    "huile-moteur": f"{BASE_URL}/catalog-search/lubrifiants3673.html",
}

# Unified markup formula, same across every supplier (FadPro, Copia,
# PartsPro, AD-Tunisie):
#   prix_final = prix_origine * (1 + TVA_RATE + MARGIN_RATE) = prix_origine * 1.45
# Prices shown on pro.ad-tunisie.com are HT (hors taxe, tagged "HT" next
# to the price), so TVA_RATE here also plays the role of "add 19% VAT".
TVA_RATE = 0.19
MARGIN_RATE = 0.26

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

_TOTAL_COUNT_RE = re.compile(r"sur\s+(\d+)", re.IGNORECASE)


def _extract_form_key(html: str) -> Optional[str]:
    """Find the Magento `form_key` hidden input's value, regardless of
    attribute order in the tag. A plain regex assuming `name="form_key"`
    is immediately followed by `value="..."` breaks on real Magento markup
    like `<input name="form_key" type="hidden" value="XYZ">` (type sits
    between name and value) — BeautifulSoup handles any attribute order
    and picks the right <input> even if the page has several forms (each
    with its own form_key input) by preferring one inside a <form> tag
    whose action mentions 'login'."""
    soup = BeautifulSoup(html, "html.parser")
    inputs = soup.find_all("input", attrs={"name": "form_key"})
    if not inputs:
        return None
    # Prefer the form_key that lives inside the actual login form
    for inp in inputs:
        form = inp.find_parent("form")
        if form and "login" in (form.get("action") or "").lower():
            val = inp.get("value")
            if val:
                return val
    # Fallback: first form_key input with a non-empty value
    for inp in inputs:
        val = inp.get("value")
        if val:
            return val
    return None


def _apply_markup(prix_ht: float) -> float:
    """Unified markup formula (same as fadpro_client._adjust_price and
    iis_supplier_client._adjust_price): prix_final = prix_ht * 1.45
    (19% VAT + 26% margin). Rounded to 3 decimals (millimes, as shown on
    the site)."""
    return round(prix_ht * (1 + TVA_RATE + MARGIN_RATE), 3)


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
                timeout=20.0,
                follow_redirects=True,
            )
        return self._client

    async def _login(self) -> bool:
        """Perform the Magento login flow. Returns True on apparent success."""
        client = await self._ensure_client()
        try:
            # 1. Fetch login page to extract the CSRF form_key
            r1 = await client.get(LOGIN_PAGE_URL)
            form_key = _extract_form_key(r1.text)
            if not form_key:
                logging.warning("ProAd login: form_key introuvable sur la page de login")
                return False

            # 2. Submit credentials
            payload = {
                "form_key": form_key,
                "login[username]": PROAD_EMAIL,
                "login[password]": PROAD_PASSWORD,
            }
            r2 = await client.post(LOGIN_POST_URL, data=payload)

            # Magento redirects back to the account/homepage (or the
            # referer target) on success, and back to the login page on
            # failure. Being off the login page is a necessary signal but
            # NOT sufficient on its own — and scanning the page body for
            # "invalid"+"password" substrings is unreliable (produces false
            # positives from unrelated JS/library boilerplate present on
            # every page, which silently broke this in production: the
            # category/reference search kept returning empty results even
            # though the login itself was actually succeeding).
            final_url = str(r2.url)
            if "customer/account/login" in final_url:
                logging.warning(f"ProAd login failed: still on login page (final_url={final_url})")
                return False

            # Ground-truth check: fetch the account dashboard directly.
            # Magento redirects anonymous sessions straight back to the
            # login page; a logged-in session gets the real page.
            r3 = await client.get(f"{BASE_URL}/customer/account/")
            if "customer/account/login" in str(r3.url):
                logging.warning("ProAd login failed: account page redirected back to login")
                return False

            self._logged_in = True
            logging.info("ProAd login OK")
            return True
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

    async def _get_category_html(self, url: str, params: dict) -> Optional[str]:
        client = await self._ensure_client()
        r = await client.get(url, params=params)
        if "customer/account/login" in str(r.url):
            return None
        return r.text

    async def search_category(self, category_key: str, max_pages: int = 6) -> List[dict]:
        """Fetch every product in a given AD-Tunisie popular-category
        listing page ("batterie" or "huile-moteur"), walking pagination
        (product_list_limit=100, &p=2, &p=3, ...) until every page reported
        by the site's "Produits X-Y sur Z" toolbar has been collected.
        Applies the 19% VAT markup to every price. Returns items shaped
        like search_reference()'s output, plus `categorie`, `prix_ht`,
        `image_url` and `product_url`.
        """
        url = CATEGORY_URLS.get(category_key)
        if not url:
            logging.warning(f"ProAd: unknown category_key={category_key}")
            return []

        async with self._lock:
            if not self._logged_in:
                ok = await self._login()
                if not ok:
                    return []

            all_items: List[dict] = []
            seen_refs = set()
            page = 1
            total = None

            while page <= max_pages:
                params = {"product_list_limit": 100}
                if page > 1:
                    params["p"] = page

                html = await self._get_category_html(url, params)
                if html is None:
                    # Session expired — re-login once and retry this page
                    self._logged_in = False
                    ok = await self._login()
                    if not ok:
                        break
                    html = await self._get_category_html(url, params)
                    if html is None:
                        break

                try:
                    items, page_total = _parse_category_results(html, category_key)
                except Exception as e:
                    logging.warning(f"ProAd category parse error ({category_key}, p={page}): {e}")
                    break

                if not items:
                    break

                new_count = 0
                for it in items:
                    if it["reference"] in seen_refs:
                        continue
                    seen_refs.add(it["reference"])
                    all_items.append(it)
                    new_count += 1

                if page_total is not None:
                    total = page_total

                # Stop once we've covered the reported total, or a page
                # yielded nothing new (avoids looping forever on odd markup)
                if new_count == 0:
                    break
                if total is not None and len(all_items) >= total:
                    break

                page += 1

            return all_items

    async def debug_login(self) -> dict:
        """Diagnostic: perform the login flow step by step and report
        exactly what happened at each stage (form_key found? POST status?
        still on the login page? Magento's actual error banner text?),
        without relying on the coarse True/False of `_login()`. Used by
        /api/debug/proad-login to find out WHY login fails — wrong/expired
        credentials, missing form_key, CAPTCHA, account lock, IP block,
        etc. Does not mutate `self._logged_in`."""
        client = await self._ensure_client()
        result: dict = {
            "email_used": PROAD_EMAIL,
            "email_source": "env var PROAD_EMAIL" if os.environ.get("PROAD_EMAIL") else "hardcoded fallback in proad_client.py",
            "password_source": "env var PROAD_PASSWORD" if os.environ.get("PROAD_PASSWORD") else "hardcoded fallback in proad_client.py",
        }

        r1 = await client.get(LOGIN_PAGE_URL)
        result["login_page_status"] = r1.status_code
        result["login_page_final_url"] = str(r1.url)

        soup = BeautifulSoup(r1.text, "html.parser")
        form_key_inputs = soup.find_all("input", attrs={"name": "form_key"})
        result["form_key_inputs_on_page"] = len(form_key_inputs)
        form_key = _extract_form_key(r1.text)
        result["form_key_found"] = bool(form_key)
        if not form_key:
            result["login_page_html_snippet"] = r1.text[:1500]
            return result
        result["form_key_value"] = form_key

        payload = {
            "form_key": form_key,
            "login[username]": PROAD_EMAIL,
            "login[password]": PROAD_PASSWORD,
        }
        r2 = await client.post(LOGIN_POST_URL, data=payload)
        result["post_status"] = r2.status_code
        result["post_final_url"] = str(r2.url)
        result["still_on_login_page"] = "customer/account/login" in str(r2.url)

        soup2 = BeautifulSoup(r2.text, "html.parser")
        title_el = soup2.find("title")
        result["post_page_title"] = title_el.get_text(strip=True) if title_el else None

        lower = r2.text.lower()
        result["has_invalid_password_hint"] = "invalid" in lower and "password" in lower
        result["captcha_mentioned_anywhere"] = "captcha" in lower or "recaptcha" in lower

        # Try every plausible Magento message-banner selector (French Luma
        # theme varies: div.message-error, div.messages, [data-ui-id],
        # role="alert" ...). Collect ALL matches, not just the first, and
        # also scan for known French error phrases directly in the text so
        # we're not solely dependent on guessing the right CSS class.
        banner_texts = []
        for sel in ["div.message-error", "div.messages", "[data-ui-id*=message]", "[role=alert]", ".message"]:
            for node in soup2.select(sel):
                txt = node.get_text(" ", strip=True)
                if txt and txt not in banner_texts:
                    banner_texts.append(txt)
        if banner_texts:
            result["message_banners_found"] = banner_texts[:10]

        known_error_phrases = [
            "mot de passe incorrect", "mot de passe est incorrect",
            "adresse e-mail ou mot de passe", "identifiant ou mot de passe",
            "compte n'existe pas", "n'existe pas", "verrouill",
            "trop de tentatives", "invalid login or password",
            "vous devez activer les cookies", "unusual activity",
        ]
        matched_phrases = [p for p in known_error_phrases if p in lower]
        if matched_phrases:
            result["known_error_phrases_matched"] = matched_phrases

        # Ground-truth check: are we ACTUALLY logged in? Fetch the account
        # dashboard directly — Magento redirects anonymous sessions straight
        # back to the login page, logged-in sessions get the real page.
        r3 = await client.get(f"{BASE_URL}/customer/account/")
        result["account_page_status"] = r3.status_code
        result["account_page_final_url"] = str(r3.url)
        result["account_page_redirected_to_login"] = "customer/account/login" in str(r3.url)
        soup3 = BeautifulSoup(r3.text, "html.parser")
        title3 = soup3.find("title")
        result["account_page_title"] = title3.get_text(strip=True) if title3 else None
        result["actually_logged_in"] = not result["account_page_redirected_to_login"]

        if not banner_texts and not matched_phrases:
            # Nothing matched our heuristics — include a raw snippet so it
            # can be eyeballed directly.
            result["post_response_snippet"] = r2.text[:3000]

        return result

    async def debug_category(self, category_key: str) -> dict:
        """Diagnostic helper (no cap, no pagination loop, no exception
        swallowing) — logs in if needed, fetches page 1 of `category_key`,
        and reports exactly what happened: whether login was (re)attempted
        and succeeded, the HTTP status / final URL of the category fetch,
        whether we got bounced back to the login page, how many
        'product product-item' blocks are in the raw HTML, and how many
        items the parser actually extracted. Used by the
        /api/debug/proad-category/{key} endpoint to find out WHY the
        category search returns 0 AD-Tunisie items in production without
        needing server log access."""
        url = CATEGORY_URLS.get(category_key)
        if not url:
            return {"error": f"unknown category_key={category_key}", "known_keys": list(CATEGORY_URLS)}

        async with self._lock:
            login_attempted = False
            login_ok = self._logged_in
            if not self._logged_in:
                login_attempted = True
                login_ok = await self._login()

            client = await self._ensure_client()
            r = await client.get(url, params={"product_list_limit": 100})
            redirected_to_login = "customer/account/login" in str(r.url)

            items, total = [], None
            parse_error = None
            try:
                items, total = _parse_category_results(r.text, category_key)
            except Exception as e:
                parse_error = str(e)

            return {
                "category_key": category_key,
                "url": url,
                "login_attempted": login_attempted,
                "login_ok": login_ok,
                "http_status": r.status_code,
                "final_url": str(r.url),
                "redirected_to_login": redirected_to_login,
                "html_length": len(r.text),
                "product_item_occurrences": r.text.count("product product-item"),
                "reported_total": total,
                "parsed_count": len(items),
                "parse_error": parse_error,
                "sample_items": items[:3],
            }

    async def debug_search_reference(self, ref: str) -> dict:
        """Diagnostic helper for search_reference() — mirrors debug_category
        but for the /catalogsearch/result/?q={ref} full-text search flow
        used by /api/oem-stock-search and /api/partners/reference-search.

        Reports: whether login was (re)attempted and succeeded, the HTTP
        status/final URL of the search request, whether Magento bounced us
        back to the login page, how many raw 'product-item' / 'item product
        product-item' blocks are present in the returned HTML (so we can
        tell whether the search-results markup actually matches the same
        Luma theme as the category pages, or uses a different template that
        our selectors don't cover), and exactly what the parser extracted.
        Used by /api/debug/proad-reference/{ref} to find out WHY a
        reference that works in /api/partners/reference-search sometimes
        doesn't surface via /api/oem-stock-search, without needing server
        log access."""
        ref = (ref or "").strip()
        if not ref:
            return {"error": "ref vide"}

        async with self._lock:
            login_attempted = False
            login_ok = self._logged_in
            if not self._logged_in:
                login_attempted = True
                login_ok = await self._login()

            client = await self._ensure_client()
            r = await client.get(SEARCH_URL, params={"q": ref})
            redirected_to_login = "customer/account/login" in str(r.url)

            items = []
            parse_error = None
            try:
                items = _parse_search_results(r.text, ref)
            except Exception as e:
                parse_error = str(e)

            soup = BeautifulSoup(r.text, "html.parser")
            title_el = soup.find("title")

            return {
                "ref": ref,
                "url": str(r.url),
                "login_attempted": login_attempted,
                "login_ok": login_ok,
                "http_status": r.status_code,
                "final_url": str(r.url),
                "redirected_to_login": redirected_to_login,
                "page_title": title_el.get_text(strip=True) if title_el else None,
                "html_length": len(r.text),
                # Raw occurrence counts — compare these to `parsed_count` below.
                # If the counts here are >0 but parsed_count is 0, our
                # selectors (PRODUCT_ITEM_SEL/NAME_SEL/PRICE_SEL) don't match
                # this page's actual markup. If the counts here are 0 too,
                # Magento's own site search genuinely found nothing for this
                # ref (different problem — the ref isn't indexed as searchable
                # text on pro.ad-tunisie.com, unlike the direct category
                # listing pages which bypass site search entirely).
                "raw_product_item_occurrences": r.text.count("product-item"),
                "raw_item_product_product_item_occurrences": r.text.count("item product product-item"),
                "no_results_message_present": (
                    "n'a donné aucun résultat" in r.text.lower()
                    or "no results" in r.text.lower()
                    or "aucun résultat" in r.text.lower()
                ),
                "parsed_count": len(items),
                "parse_error": parse_error,
                "parsed_items": items,
            }

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

    Uses the SAME container/selectors already verified for the category
    listing pages (`li.item.product.product-item`, `a.product-item-link`
    for the "Réf : XXXX" label, `span.product-reference-item` for the
    designation, `[data-price-amount]` for the price) as the PRIMARY
    selectors, since pro.ad-tunisie.com renders both pages with the same
    Luma theme markup. A looser fallback (`li.product-item`,
    `.product-item-link, .product-item-name a`, `.price-box .price,
    span.price`) is tried per-field when the primary selector finds
    nothing, in case the search-results template differs slightly.
    """
    soup = BeautifulSoup(html, "html.parser")

    # Primary: same structure as the verified category-listing pages.
    nodes = soup.select("li.item.product.product-item")
    if not nodes:
        # Fallback: looser container selector.
        nodes = soup.select("li.product-item, div.product-item-info")

    items = []
    seen = set()

    for node in nodes:
        link_el = node.select_one("a.product-item-link")

        # Reference / name: category pages encode it as "Réf : XXXX" on the
        # product-item-link; strip that prefix the same way
        # _parse_category_results does. If there's no "Réf :" prefix (plain
        # product name instead), just use the link text as the designation
        # and fall back to `searched_ref` for the reference field, same as
        # before.
        ref_out = searched_ref
        name = None
        if link_el:
            raw_text = link_el.get_text(strip=True)
            m = re.match(r"(?i)^r[ée]f\s*:\s*(.+)$", raw_text)
            if m:
                ref_out = m.group(1).strip() or searched_ref
            name = raw_text

        desig_el = node.select_one("span.product-reference-item")
        if desig_el:
            name = desig_el.get_text(strip=True)

        if not name:
            name_el = node.select_one(".product-item-link, .product-item-name a")
            if name_el:
                name = name_el.get_text(strip=True)

        if not name or name in seen:
            continue
        seen.add(name)

        # Price: try the verified data-price-amount attribute first.
        price = None
        price_amount_el = node.select_one("[data-price-amount]")
        if price_amount_el:
            try:
                price = float(price_amount_el.get("data-price-amount"))
            except (TypeError, ValueError):
                price = None
        if price is None:
            price_el = node.select_one(".price-box .price, span.price")
            if price_el:
                price = _parse_price(price_el.get_text(strip=True))

        stock_el = node.select_one("[class*=stock]")
        stock_text = stock_el.get_text(strip=True).lower() if stock_el else ""
        stock_classes = " ".join(stock_el.get("class", [])) if stock_el else ""
        in_stock = (
            "unavailable" not in stock_classes
            and "rupture" not in stock_text
            and "épuisé" not in stock_text
        )

        items.append({
            "reference": ref_out,
            "designation": name,
            "prix_tnd": _apply_markup(price) if price is not None else None,
            "in_stock": bool(in_stock and price),
            "stock": 10 if in_stock else 0,  # ProAd doesn't expose exact qty on the grid
            "fournisseur": "ProAd",
            "source": "proad",
        })

    return items


def _parse_category_results(html: str, category_label: str) -> Tuple[List[dict], Optional[int]]:
    """Parse a pro.ad-tunisie.com "catalog-search" category listing page
    (e.g. batteries4365.html / lubrifiants3673.html) into normalised items.

    Verified against the actual rendered markup:
        <li class="item product product-item">
          <a class="product-item-link" href="...">Réf : VART682366</a>
          <div class="stock available"><span>En stock</span></div>
          <span class="product-reference-item"> BAT.VARTA.MOTO YTX12-4 </span>
          <img class="product-image-photo" src="...">
          <span id="product-price-26407" data-price-amount="281.945" ...>
            <span class="price">281,945 dt</span>
          </span>
          <span class="price-ht">HT</span>
        </li>

    Returns (items, total_count) where total_count is parsed from the
    "Produits X-Y sur Z" toolbar text (used to know when pagination is done).
    """
    soup = BeautifulSoup(html, "html.parser")

    items = []
    for node in soup.select("li.item.product.product-item"):
        link_el = node.select_one("a.product-item-link")
        if not link_el:
            continue
        ref_text = link_el.get_text(strip=True)
        ref = re.sub(r"(?i)^r[ée]f\s*:\s*", "", ref_text).strip()
        if not ref:
            continue

        name_el = node.select_one("span.product-reference-item")
        designation = name_el.get_text(strip=True) if name_el else ref

        price_el = node.select_one("[data-price-amount]")
        if not price_el:
            continue
        try:
            prix_ht = float(price_el.get("data-price-amount"))
        except (TypeError, ValueError):
            continue
        if prix_ht <= 1:
            # Sentinel/junk prices seen on the site (e.g. accessories
            # listed at "1" with no real price) — skip these.
            continue

        stock_el = node.select_one("[class*=stock]")
        stock_classes = " ".join(stock_el.get("class", [])) if stock_el else ""
        in_stock = "unavailable" not in stock_classes

        img_el = node.select_one("img.product-image-photo")
        image_url = img_el.get("src") if img_el else None

        items.append({
            "reference": ref,
            "designation": designation,
            "prix_tnd": _apply_markup(prix_ht),
            "prix_ht": prix_ht,
            "in_stock": in_stock,
            "stock": 10 if in_stock else 0,
            "fournisseur": "AD-Tunisie",
            "source": "proad",
            "categorie": category_label,
            "image_url": image_url,
            "product_url": link_el.get("href"),
        })

    total = None
    amount_el = soup.select_one(".toolbar-amount")
    if amount_el:
        m = _TOTAL_COUNT_RE.search(amount_el.get_text())
        if m:
            total = int(m.group(1))

    return items, total


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


async def search_category(category_key: str) -> List[dict]:
    """Convenience free function for server.py's popular-categories feature.
    `category_key` is one of CATEGORY_URLS ("batterie", "huile-moteur")."""
    return await get_proad().search_category(category_key)


async def debug_category(category_key: str) -> dict:
    """Convenience free function for the /api/debug/proad-category/{key}
    troubleshooting endpoint."""
    return await get_proad().debug_category(category_key)


async def debug_login() -> dict:
    """Convenience free function for the /api/debug/proad-login
    troubleshooting endpoint."""
    return await get_proad().debug_login()


async def debug_search_reference(ref: str) -> dict:
    """Convenience free function for the /api/debug/proad-reference/{ref}
    troubleshooting endpoint."""
    return await get_proad().debug_search_reference(ref)
