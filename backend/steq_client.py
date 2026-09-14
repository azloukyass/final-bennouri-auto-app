"""
STEQ B2B supplier client (b2bsteq.com).

Flow (reverse-engineered from the live site — no public API docs):

  1. GET  /                              → login page (sets session cookie)
  2. POST <login form action> (form-url) → login (UserCode, UserPassword,
                                            UserSubmit, + any hidden field
                                            already present in the login
                                            form, e.g. a CSRF token — we
                                            forward whatever the form ships
                                            with rather than hardcoding a
                                            field name we haven't actually
                                            seen). Success → redirects
                                            (301/302/303) to /acceuil.html.
  3. POST /form-recherche.html           → submit a reference search
                                            (MySearchType=1 = "PAR
                                            RÉFÉRENCE", MySearchKey=<ref>).
                                            Success → redirects to
                                            /recherche-reference/<token>
                                            (a fresh, search-specific,
                                            opaque token per query).
  4. GET  /recherche-reference/<token>   → results page. It EMBEDS the raw
                                            match list directly in an
                                            inline <script> as a JS array:
                                                var ApiJsonItemAll = [...]
                                            This already carries the
                                            structured fields we actually
                                            need for pricing/stock (ItemNo,
                                            Available, UnitPrice, VAT,
                                            ItemId, ...) — no HTML scraping
                                            needed for those.
  5. POST /fetch-article-pagination.html → the site's own JS immediately
                                            re-posts that exact same JSON
                                            array back to this endpoint
                                            (as `paginatedData`) purely to
                                            render the rich HTML card for
                                            each item — brand, désignation,
                                            image, OE cross-reference
                                            numbers are ONLY available this
                                            way, not in the step-4 JSON.

We replay steps 3-5 exactly as the site's own front-end does, then merge
the structured JSON (step 4) with the rendered HTML (step 5) by ItemId to
build one normalised item per article.

Price logic — same unified markup as every other supplier (FadPro, Copia,
PartsPro, AD-Tunisie):
    final_tnd = prix_origine * (1 + PRICE_MARKUP_VAT + PRICE_MARGIN)
              = prix_origine * 1.45   (19% VAT + 26% margin)
`UnitPrice` from STEQ's own JSON is treated as the HT (pre-VAT) base price,
consistent with how every other supplier's raw price is interpreted here.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin

import certifi
import httpx
from bs4 import BeautifulSoup
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("steq_client")

BASE_URL = "https://b2bsteq.com"

PRICE_MARKUP_VAT = 0.19       # +19% VAT
PRICE_MARGIN = 0.26            # +26% margin


def _adjust_price(unit_ht: float) -> float:
    """Same unified markup formula used by every supplier — see module
    docstring. Returns rounded to 3 decimals (TND)."""
    return round(unit_ht * (1 + PRICE_MARKUP_VAT + PRICE_MARGIN), 3)


def _to_float(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    s = str(value).strip().replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return 0.0


# `var ApiJsonItemAll = [ ... ];` — the raw match list embedded in the
# /recherche-reference/<token> page's inline <script>.
_API_JSON_RE = re.compile(r"var\s+ApiJsonItemAll\s*=\s*(\[.*?\])\s*;", re.DOTALL)

# HTTP statuses that mean "your session isn't valid anymore" on any call.
_AUTH_FAILURE_CODES = (401, 403)

# `[SSL: CERTIFICATE_VERIFY_FAILED] unable to get local issuer certificate`
# is almost always caused by the HOST's CA trust store being outdated or
# incomplete (very common on minimal server/container images) — httpx uses
# its own bundle rather than the OS one. `certifi` ships a fresh, actively
# maintained bundle, which resolves the vast majority of these errors even
# though the exact same URL opens fine in a browser (browsers do "AIA
# chasing" to fetch missing intermediate certificates on the fly; Python's
# ssl module does not).
#
# STEQ_SSL_VERIFY=false is an escape hatch for the rarer case where the
# certifi bundle STILL doesn't fix it — meaning b2bsteq.com's own server is
# misconfigured and isn't sending its full certificate chain (missing
# intermediate CA). Disabling verification removes MITM protection for
# every request to this supplier, so only set this if the certifi bundle
# was confirmed insufficient (see debug_search_reference's login_error).
_SSL_VERIFY = os.environ.get("STEQ_SSL_VERIFY", "true").strip().lower() not in ("false", "0", "no")
_SSL_CONTEXT: Any = certifi.where() if _SSL_VERIFY else False


class SteqClient:
    """Single session-based client for STEQ (b2bsteq.com). One shared
    instance (see get_steq()) — search_reference() serialises every call
    behind self._lock, same protection Copia/PartsPro/AD-Tunisie already
    have for their own shared login sessions."""

    def __init__(self, username: str, password: str):
        self.username = username
        self.password = password
        self._client: Optional[httpx.AsyncClient] = None
        self._lock = asyncio.Lock()
        self._authenticated = False

    def _new_client(self) -> httpx.AsyncClient:
        # IMPORTANT: the User-Agent used to literally be
        # "Mozilla/5.0 (compatible; BennouriBot/1.0)" — self-identifying as
        # a bot. That is almost certainly why the login POST kept coming
        # back HTTP 200 with the login page re-rendered even with 100%
        # correct credentials and all form fields matching a real browser's
        # payload byte-for-byte: many servers (or a WAF in front of them)
        # detect a non-browser UA and silently no-op the request instead of
        # returning an explicit block, precisely to avoid tipping off
        # scrapers. Every header below is copied verbatim from a real
        # Chrome 151/Windows request the user captured via DevTools "Copy
        # as cURL" for a successful login, to make our traffic
        # indistinguishable from that browser.
        return httpx.AsyncClient(
            base_url=BASE_URL,
            timeout=httpx.Timeout(25.0),
            follow_redirects=False,
            verify=_SSL_CONTEXT,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36"
                ),
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
                "sec-ch-ua": '"Not=A?Brand";v="99", "Google Chrome";v="151", "Chromium";v="151"',
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": '"Windows"',
                "Upgrade-Insecure-Requests": "1",
            },
        )

    async def _ensure_auth(self) -> None:
        if self._client is None:
            self._client = self._new_client()
        if self._authenticated:
            return

        # 1. Fetch the login page and locate the form that actually holds
        # the UserCode field (rather than assuming action="/" or a fixed
        # set of fields) — forwards EVERY input the form ships with
        # (including any hidden CSRF token we haven't explicitly seen),
        # then overrides only the credential fields.
        r = await self._client.get("/")
        html = r.text or ""
        soup = BeautifulSoup(html, "html.parser")
        user_input = soup.find("input", id="UserCode")
        if not user_input:
            raise RuntimeError("steq: champ UserCode introuvable sur la page de login (/)")
        form = user_input.find_parent("form")

        payload: Dict[str, str] = {}
        action = "/"
        if form:
            action = form.get("action") or "/"
            for inp in form.find_all("input"):
                name = inp.get("name")
                if not name:
                    continue
                if (inp.get("type") or "").lower() == "checkbox":
                    # A checkbox with no explicit `value=` attribute
                    # implicitly submits "on" when checked — that's a
                    # browser-side default, NOT something reflected in the
                    # raw HTML, so a plain `.get("value", "")` would send
                    # an empty string instead. STEQ's login form has a
                    # "rester connecté" checkbox (`UserRemember`) that a
                    # real browser always submits as "on"; without this,
                    # the login POST comes back HTTP 200 re-rendering the
                    # login form ("identifiants probablement invalides")
                    # even with correct credentials.
                    payload[name] = inp.get("value") or "on"
                else:
                    payload[name] = inp.get("value", "")
        payload["UserCode"] = self.username
        payload["UserPassword"] = self.password
        payload.setdefault("UserSubmit", "")
        payload.setdefault("UserRemember", "on")

        # 2. POST credentials — Origin/Referer/Sec-Fetch-* added to match a
        # real same-origin form submission (see _new_client() docstring
        # note on why the UA/header fingerprint matters here).
        r = await self._client.post(
            action,
            data=payload,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Origin": BASE_URL,
                "Referer": f"{BASE_URL}/",
                "Cache-Control": "max-age=0",
                "sec-fetch-dest": "document",
                "sec-fetch-mode": "navigate",
                "sec-fetch-site": "same-origin",
                "sec-fetch-user": "?1",
            },
        )
        location = r.headers.get("location") or r.headers.get("Location") or ""

        if r.status_code in (301, 302, 303) and "acceuil" in location.lower():
            self._authenticated = True
            return

        # Any other outcome means the credentials were rejected — mirror
        # the ground-truth checks already used for AD-Tunisie/Copia/
        # PartsPro rather than trusting a bare 200/302 as "success".
        if r.status_code in (301, 302, 303):
            raise RuntimeError(
                f"steq: login redirigé vers {location!r} au lieu de /acceuil.html "
                f"— identifiants probablement invalides ou expirés"
            )
        body_lower = (r.text or "").lower()
        # STEQ allows only ONE active session per account at a time. When
        # another session (a previous test attempt that never called
        # /deconnecter.html, or a real concurrent user) still holds the
        # slot, the login form is silently re-rendered with this exact
        # warning instead of any HTTP-level error — completely
        # indistinguishable from "wrong credentials" unless we check the
        # body text for it. The authenticated /acceuil.html page shows a
        # 15-minute countdown, so the stuck session should release itself
        # on its own — just wait and retry rather than changing credentials
        # or request headers.
        if r.status_code == 200 and "déjà connecté" in (r.text or "").lower():
            raise RuntimeError(
                "steq: compte déjà connecté ailleurs (STEQ n'autorise qu'une "
                "seule session active à la fois) — attendez que la session "
                "précédente expire (~15 min) puis réessayez"
            )
        if r.status_code == 200 and 'id="usercode"' in body_lower:
            raise RuntimeError(
                "steq: la page de login a été re-rendue (HTTP 200) — "
                "identifiants probablement invalides"
            )
        raise RuntimeError(f"steq: échec d'authentification (HTTP {r.status_code})")

    async def debug_login(self) -> dict:
        """Diagnostic helper (same style as proad_client.debug_login) —
        walks the login flow step by step OUTSIDE the normal retry logic
        and reports exactly what happened: every field found in the login
        form (name -> value, values truncated for secrets), the resolved
        form action, the HTTP status/Location of the POST, and a body
        snippet — so a "identifiants probablement invalides" report can be
        diagnosed without server log access, even when the credentials are
        actually correct but some other required field/header is missing.
        Does NOT mutate self._authenticated."""
        result: dict = {"supplier": "steq"}
        if self._client is None:
            self._client = self._new_client()

        try:
            r = await self._client.get("/")
            result["get_login_status"] = r.status_code
            html = r.text or ""
            soup = BeautifulSoup(html, "html.parser")
            user_input = soup.find("input", id="UserCode")
            result["usercode_field_found"] = bool(user_input)
            if not user_input:
                result["login_page_snippet"] = html[:1500]
                return result

            form = user_input.find_parent("form")
            result["form_found"] = bool(form)
            payload: Dict[str, str] = {}
            action = "/"
            method = "POST"
            if form:
                action = form.get("action") or "/"
                method = (form.get("method") or "POST").upper()
                for inp in form.find_all("input"):
                    name = inp.get("name")
                    if not name:
                        continue
                    if (inp.get("type") or "").lower() == "checkbox":
                        payload[name] = inp.get("value") or "on"
                    else:
                        payload[name] = inp.get("value", "")
            result["form_action"] = action
            result["form_method"] = method
            # Mask secrets in the report but show every OTHER field name
            # and value so a missing hidden CSRF token is obvious.
            result["form_fields_before_override"] = {
                k: (v if k not in ("UserPassword",) else "***") for k, v in payload.items()
            }

            payload["UserCode"] = self.username
            payload["UserPassword"] = self.password
            payload.setdefault("UserSubmit", "")
            payload.setdefault("UserRemember", "on")
            result["form_fields_sent"] = {
                k: (v if k not in ("UserPassword",) else "***") for k, v in payload.items()
            }

            r2 = await self._client.post(
                action,
                data=payload,
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Origin": BASE_URL,
                    "Referer": f"{BASE_URL}/",
                    "Cache-Control": "max-age=0",
                    "sec-fetch-dest": "document",
                    "sec-fetch-mode": "navigate",
                    "sec-fetch-site": "same-origin",
                    "sec-fetch-user": "?1",
                },
            )
            result["post_login_status"] = r2.status_code
            location = r2.headers.get("location") or r2.headers.get("Location") or ""
            result["post_login_location"] = location
            result["post_login_set_cookie"] = r2.headers.get("set-cookie", "")
            post_body = r2.text or ""
            # "déjà connecté" (already connected elsewhere) is STEQ's
            # single-session-per-account guard — it renders further down
            # the page than a short snippet would show, so surface it as
            # its own flag instead of relying on the truncated snippet.
            result["already_connected_elsewhere"] = "déjà connecté" in post_body.lower()
            result["post_login_body_snippet"] = post_body[:3000]

            # IMPORTANT: mark the shared client as authenticated on success,
            # same as _ensure_auth() does. Without this, debug_login()
            # would create a real, valid session on STEQ's side but never
            # remember it — so the very next call (e.g. debug_search_
            # reference, or a real search) would call _ensure_auth() again,
            # attempt ANOTHER fresh login using the SAME client/cookies,
            # and immediately collide with the session THIS call just
            # created (STEQ only allows one active session per account),
            # failing with "identifiants probablement invalides" even
            # though the credentials are perfectly correct. This exact
            # self-collision is what happened when debug_login() succeeded
            # (302 → /acceuil.html) but the following debug_search_
            # reference() call still failed.
            if r2.status_code in (301, 302, 303) and "acceuil" in location.lower():
                self._authenticated = True
                result["marked_authenticated"] = True
        except Exception as e:
            result["exception"] = str(e)
        return result

    async def search_reference(self, ref: str) -> List[Dict[str, Any]]:
        """Search STEQ for a part reference. Returns a normalised list of
        items shaped to match FadPro/Copia/PartsPro/AD-Tunisie:
            {
              "reference":      str (STEQ's own ItemNo, e.g. "NES89053"),
              "designation":    str,
              "fournisseur":    str (real manufacturer brand, e.g. "NISSENS"),
              "stock":          int,
              "in_stock":       bool,
              "prix_origine":   float (UnitPrice, raw HT),
              "prix_tnd":       float (with margin + VAT),
              "marque":         str,
              "modele":         str,
              "categorie":      str,
              "source":         "steq",
              "image":          str (absolute URL),
              "oe_refs":        list[{"marque": str, "ref": str}],
            }
        """
        ref = (ref or "").strip()
        if len(ref) < 2:
            return []

        async with self._lock:
            await self._ensure_auth()
            try:
                return await self._do_search(ref)
            except Exception as e:
                logger.warning(f"steq: search failed for ref={ref}, retrying after re-auth: {e}")
                # Explicitly release the old session BEFORE attempting a
                # fresh login. The failure above was a request-level error
                # (timeout, network blip, ...) — the old session may well
                # still be alive server-side. Just flipping
                # `_authenticated = False` and re-logging in without first
                # logging out would leave that still-active old session
                # dangling and collide with the new login attempt (STEQ
                # allows only one session per account at a time), turning a
                # transient hiccup into a full "déjà connecté ailleurs"
                # lockout — exactly what happened repeatedly during manual
                # testing before this fix.
                try:
                    await self.logout()
                except Exception:
                    pass
                self._authenticated = False
                try:
                    await self._ensure_auth()
                    return await self._do_search(ref)
                except Exception as e2:
                    logger.warning(f"steq: retry failed for ref={ref}: {e2}")
                    return []

    async def _do_search(self, ref: str) -> List[Dict[str, Any]]:
        assert self._client is not None

        # Step A: submit the reference search form.
        r1 = await self._client.post(
            "/form-recherche.html",
            data={"MySearchType": "1", "MySearchKey": ref, "MySearchSubmit": ""},
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Origin": BASE_URL,
                "Referer": f"{BASE_URL}/acceuil.html",
            },
        )
        if r1.status_code in _AUTH_FAILURE_CODES:
            raise RuntimeError(f"steq: form-recherche HTTP {r1.status_code} (session morte?) for ref={ref}")

        results_page_url = f"{BASE_URL}/form-recherche.html"
        if r1.status_code in (301, 302, 303):
            location = r1.headers.get("location") or r1.headers.get("Location") or ""
            if not location:
                logger.warning(f"steq: form-recherche sans Location header pour ref={ref}")
                return []
            results_page_url = urljoin(BASE_URL, location)
            r2 = await self._client.get(location)
            if r2.status_code in _AUTH_FAILURE_CODES:
                raise RuntimeError(f"steq: GET {location} HTTP {r2.status_code} (session morte?)")
            if r2.status_code != 200:
                logger.warning(f"steq: GET {location} HTTP {r2.status_code} pour ref={ref}")
                return []
            results_html = r2.text or ""
        else:
            # Some deployments might render results directly (HTTP 200)
            # instead of redirecting — handle that too.
            results_html = r1.text or ""

        m = _API_JSON_RE.search(results_html)
        if not m:
            # No `ApiJsonItemAll` script block — 0 results for this ref.
            return []
        try:
            raw_items = json.loads(m.group(1))
        except json.JSONDecodeError as e:
            logger.warning(f"steq: échec parsing ApiJsonItemAll pour ref={ref}: {e}")
            return []
        if not isinstance(raw_items, list) or not raw_items:
            return []

        # Step B: render the rich HTML card for every item found. We send
        # ALL items in one shot (page=1, total_pages=1) regardless of how
        # many there are — the endpoint just renders whatever
        # `paginatedData` it's given, no server-side re-slicing is needed
        # since we already have the full match list from step A.
        r3 = await self._client.post(
            "/fetch-article-pagination.html",
            data={
                "typepage": "finder",
                "page": "1",
                "total_pages": "1",
                "paginatedData": json.dumps(raw_items),
            },
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Origin": BASE_URL,
                "Referer": results_page_url,
                "X-Requested-With": "XMLHttpRequest",
            },
        )
        if r3.status_code in _AUTH_FAILURE_CODES:
            raise RuntimeError(f"steq: fetch-article-pagination HTTP {r3.status_code} (session morte?)")
        if r3.status_code != 200:
            logger.warning(f"steq: fetch-article-pagination HTTP {r3.status_code} pour ref={ref}")
            return []

        return self._parse_items(r3.text or "", raw_items)

    def _parse_items(self, html: str, raw_items: List[dict]) -> List[Dict[str, Any]]:
        """Combine the raw JSON (price/stock/VAT — reliable, structured)
        with the rendered HTML (brand, désignation, image, OE cross-refs —
        only available as HTML) by matching on ItemId, which appears in
        the HTML as the numeric suffix of the hidden
        `ProductRequestId{id}` (out-of-stock devis form) or `ProductId{id}`
        (in-stock add-to-cart form) input."""
        raw_by_id: Dict[str, dict] = {}
        for it in raw_items:
            item_id = it.get("ItemId")
            if item_id is not None:
                raw_by_id[str(item_id)] = it

        soup = BeautifulSoup(html, "html.parser")
        results: List[Dict[str, Any]] = []

        for card in soup.find_all("div", class_="row"):
            classes = set(card.get("class") or [])
            # Only the per-article card has exactly this class combo — the
            # table header row (`row px-0 d-none d-lg-flex mb-2`) doesn't
            # carry px-4/py-1, so it's excluded automatically.
            if not {"px-4", "px-lg-0", "py-1"}.issubset(classes):
                continue

            try:
                hidden = card.find("input", id=re.compile(r"^(ProductRequestId|ProductId)\d+$"))
                if not hidden:
                    continue
                item_id = re.sub(r"^(ProductRequestId|ProductId)", "", hidden.get("id", ""))
                raw = raw_by_id.get(item_id)
                if not raw:
                    continue

                unit_ht = _to_float(raw.get("UnitPrice"))
                if unit_ht <= 0:
                    continue

                item_no = (raw.get("ItemNo") or "").strip()
                if not item_no:
                    continue

                # Real manufacturer brand (e.g. "NISSENS") — shown as an
                # <h1> in the reference block.
                brand_el = card.find("h1", class_="text-primary")
                brand = brand_el.get_text(strip=True) if brand_el else ""

                # Désignation — prefer the detailed "Désignation Technique"
                # value span, fall back to the generic <h2> title.
                # NOTE: `class_=lambda c: ...` would NOT work here — when a
                # callable is passed as `class_`, BeautifulSoup calls it
                # once per individual class token (since `class` is a
                # multi-valued attribute), not once with the full class
                # list. A tag-level filter is required to check the whole
                # class SET at once.
                designation = ""
                tech_span = card.find(
                    lambda tag: tag.name == "span"
                    and {"fs-10", "fw-bolder", "text-primary"}.issubset(set(tag.get("class") or [])),
                )
                if tech_span:
                    designation = tech_span.get_text(strip=True)
                if not designation:
                    h2 = card.find("h2", class_="text-primary")
                    designation = h2.get_text(strip=True) if h2 else ""

                # Product image — exactly class="img-fluid rounded-0" (the
                # supplier-badge and constructeur-logo images nearby also
                # combine img-fluid with OTHER classes, so an exact-set
                # match is needed to avoid picking the wrong <img>).
                image_url = ""
                for img in card.find_all("img"):
                    if set(img.get("class") or []) == {"img-fluid", "rounded-0"}:
                        src = img.get("src") or ""
                        if src:
                            image_url = urljoin(BASE_URL, src)
                        break

                # OE / cross-reference numbers ("Origine" column) — each is
                # a <div> whose only two children are a bold label span
                # and a right-aligned value span.
                oe_refs = []
                for row in card.find_all("div"):
                    spans = row.find_all("span", recursive=False)
                    if len(spans) == 2 and "float-end" in (spans[1].get("class") or []):
                        oe_refs.append({
                            "marque": spans[0].get_text(strip=True),
                            "ref": spans[1].get_text(strip=True),
                        })

                available = bool(raw.get("Available"))
                prix_tnd = _adjust_price(unit_ht)

                results.append({
                    "reference": item_no,
                    "designation": designation,
                    "fournisseur": (brand or "STEQ").upper(),
                    "marque": "",
                    "modele": "",
                    "categorie": "",
                    "stock": 1 if available else 0,
                    "in_stock": available,
                    "prix_origine": unit_ht,
                    "prix_tnd": prix_tnd,
                    "source": "steq",
                    "image": image_url,
                    "oe_refs": oe_refs,
                })
            except Exception as e:
                logger.debug(f"steq: parse error: {e}")
                continue

        return results

    async def debug_search_reference(self, ref: str) -> dict:
        """Diagnostic helper (same style as proad_client/iis_supplier_client's
        debug_search_reference) — walks login + form-recherche + recherche-
        reference + fetch-article-pagination step by step and reports what
        happened at each stage, so a 0-results report can be diagnosed
        without server log access."""
        ref = (ref or "").strip()
        if len(ref) < 2:
            return {"error": "ref trop courte (min. 2 caractères)"}

        result: dict = {"ref": ref, "supplier": "steq"}
        async with self._lock:
            was_authenticated = self._authenticated
            result["was_already_authenticated"] = was_authenticated
            login_error = None
            if not self._authenticated:
                try:
                    await self._ensure_auth()
                except Exception as e:
                    login_error = str(e)
            result["login_attempted"] = not was_authenticated
            result["login_ok"] = self._authenticated
            result["login_error"] = login_error
            if not self._authenticated:
                return result

            try:
                r1 = await self._client.post(
                    "/form-recherche.html",
                    data={"MySearchType": "1", "MySearchKey": ref, "MySearchSubmit": ""},
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )
                result["form_recherche_status"] = r1.status_code
                location = r1.headers.get("location") or r1.headers.get("Location") or ""
                result["form_recherche_location"] = location

                if r1.status_code in (301, 302, 303) and location:
                    r2 = await self._client.get(location)
                    result["results_page_status"] = r2.status_code
                    results_html = r2.text or ""
                else:
                    results_html = r1.text or ""

                m = _API_JSON_RE.search(results_html)
                result["api_json_found"] = bool(m)
                if not m:
                    result["results_html_snippet"] = results_html[:800]
                    return result

                raw_items = json.loads(m.group(1))
                result["raw_count"] = len(raw_items)
                result["raw_items"] = raw_items[:5]

                if not raw_items:
                    return result

                r3 = await self._client.post(
                    "/fetch-article-pagination.html",
                    data={
                        "typepage": "finder",
                        "page": "1",
                        "total_pages": "1",
                        "paginatedData": json.dumps(raw_items),
                    },
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )
                result["pagination_status"] = r3.status_code
                result["pagination_body_snippet"] = (r3.text or "")[:1000]

                parsed = self._parse_items(r3.text or "", raw_items)
                result["parsed_count"] = len(parsed)
                result["parsed_items"] = parsed
                result["dropped_count"] = len(raw_items) - len(parsed)
            except Exception as e:
                result["request_exception"] = str(e)

        return result

    async def logout(self) -> dict:
        """Explicitly release STEQ's single-session-per-account lock by
        calling /deconnecter.html with whatever cookies self._client
        currently holds. STEQ allows only ONE active session per account
        platform-wide — every failed/aborted login attempt we've made
        (debug endpoints, retries, ...) that DID succeed server-side but
        was never explicitly logged out leaves that session dangling until
        its ~15-minute timer expires, during which EVERY other login
        attempt (ours or the real user logging in directly on
        b2bsteq.com) gets rejected with "déjà connecté ailleurs". If our
        own process is currently holding the active session (i.e. we're
        already authenticated), this releases it immediately instead of
        waiting on the timer. If we're NOT currently authenticated in this
        process (e.g. a different worker process holds the real session,
        or the server restarted since the last successful login), this
        can't help — the stuck session belongs to a client we have no
        cookies for, and only the ~15 min timeout (or logging in from
        that other session/device and clicking "Déconnecter" there) will
        free it."""
        if self._client is None:
            return {
                "ok": False,
                "reason": (
                    "no client in this process — we never made a single request "
                    "here (fresh process, e.g. right after a restart). Nothing "
                    "to log out of."
                ),
            }
        # IMPORTANT: don't gate this on `self._authenticated`. That flag only
        # reflects whether OUR code currently believes a login succeeded —
        # but if a later attempt in this same process FAILED (e.g. hit
        # "déjà connecté" from a login we ourselves created earlier before
        # this flag-tracking fix existed), `_authenticated` would already be
        # back to False even though `self._client` may still be carrying
        # perfectly valid session cookies from that earlier successful
        # login. Attempting /deconnecter.html is harmless either way — if
        # the cookies are stale/invalid it just no-ops, but if they're
        # still the live session, this is the ONLY way to release it
        # without waiting out an unknown timeout.
        try:
            r = await self._client.get(
                "/deconnecter.html",
                headers={"Referer": f"{BASE_URL}/acceuil.html"},
            )
            self._authenticated = False
            return {
                "ok": True,
                "status": r.status_code,
                "body_snippet": (r.text or "")[:500],
            }
        except Exception as e:
            return {"ok": False, "reason": str(e)}

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None
            self._authenticated = False


_steq_client: Optional[SteqClient] = None


def get_steq() -> SteqClient:
    global _steq_client
    if _steq_client is None:
        _steq_client = SteqClient(
            username=os.environ["STEQ_USER"],
            password=os.environ["STEQ_PASSWORD"],
        )
    return _steq_client


async def search_reference(ref: str) -> List[Dict[str, Any]]:
    return await get_steq().search_reference(ref)
