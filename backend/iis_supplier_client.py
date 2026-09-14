"""
Generic IIS-MVC supplier client.

Both Copia (port 8091) and PartsPro (port 8090) expose the same ASP.NET MVC
backend with the following pattern:

  1. GET  /Home/Login                            → returns HTML containing
                                                    __RequestVerificationToken
                                                    and sets initial cookies
  2. POST /Home/Login (form-urlencoded)           → authenticates
                                                    (`username`, `pwd`,
                                                    `__RequestVerificationToken`)
  3. POST /Recherche/SaveMot (JSON)              → stores the search term
                                                    in the server-side session
                                                    {"mot": "REF"}
  4. POST /Recherche/FindItembyOrigine (JSON)     → returns items matched by
                                                    OEM / manufacturer
                                                    reference ("référence
                                                    origine") against the
                                                    saved search term.
                                                    NOTE: the sibling
                                                    endpoint /Recherche/
                                                    FindItembyCodeArticle
                                                    searches by Copia's OWN
                                                    internal article code
                                                    instead — using it here
                                                    was the actual root
                                                    cause of many "article
                                                    not found" reports,
                                                    confirmed by watching
                                                    the Network tab on
                                                    Copia's own site while
                                                    searching "Référence
                                                    origine".

This client maintains an aiohttp session per supplier instance and lazily
re-authenticates when the session expires.

Price logic — unified markup formula, same across every supplier (FadPro,
Copia, PartsPro, AD-Tunisie):
    final_tnd = prix_origine * (1 + PRICE_MARKUP_VAT + PRICE_MARGIN)
              = prix_origine * 1.45   (19% VAT + 26% margin)
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
from typing import Any, Dict, List, Optional

import httpx
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("iis_supplier")

_TOKEN_RE = re.compile(
    r'name="__RequestVerificationToken"[^>]*value="([^"]+)"', re.IGNORECASE
)

PRICE_MARKUP_VAT = 0.19       # +19% VAT
PRICE_MARGIN = 0.26            # +26% margin


def _adjust_price(unit_ht: float) -> float:
    """Apply the unified markup used across every supplier:
    final = prix_origine * (1 + PRICE_MARKUP_VAT + PRICE_MARGIN)
          = prix_origine * 1.45   (19% VAT + 26% margin)
    Returns rounded to 3 decimals (TND)."""
    return round(unit_ht * (1 + PRICE_MARKUP_VAT + PRICE_MARGIN), 3)


def _to_float_eu(value: Any) -> float:
    """Parse a European-style number with a comma decimal separator."""
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    s = str(value).strip().replace(" ", "")
    if not s:
        return 0.0
    # Replace comma with dot as decimal separator
    if "," in s and "." in s:
        # 1.234,56 → 1234.56 (assume comma is decimal, dot is thousands)
        s = s.replace(".", "").replace(",", ".")
    else:
        s = s.replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return 0.0


# HTTP statuses that mean "your session isn't valid" — used to detect a
# dead/expired IIS session on EITHER of the two calls in search_reference()
# (previously only SaveMot's response was checked; FindItembyOrigine's
# status was never inspected for auth failure, so a session that expired
# between the two calls silently produced an empty item list with nothing
# logged, indistinguishable from "genuinely no results").
_AUTH_FAILURE_CODES = (302, 401, 403)


class IISSupplierClient:
    """One client instance per supplier (Copia / PartsPro)."""

    def __init__(self, name: str, base_url: str, username: str, password: str):
        self.name = name
        self.base_url = base_url.rstrip("/")
        self.username = username
        self.password = password
        self._client: Optional[httpx.AsyncClient] = None
        self._lock = asyncio.Lock()
        self._authenticated = False

    def _new_client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=self.base_url,
            timeout=httpx.Timeout(20.0),
            follow_redirects=False,
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; BennouriBot/1.0)",
                "Accept": "*/*",
            },
        )

    async def _ensure_auth(self) -> None:
        """Login once, reuse session cookies for subsequent requests."""
        if self._client is None:
            self._client = self._new_client()
        if self._authenticated:
            return

        # 1. Fetch the login page to grab the antiforgery token + initial cookie
        r = await self._client.get("/Home/Login")
        html = r.text or ""
        m = _TOKEN_RE.search(html)
        if not m:
            raise RuntimeError(f"{self.name}: token __RequestVerificationToken introuvable")
        token = m.group(1)

        # 2. POST credentials
        r = await self._client.post(
            "/Home/Login",
            data={
                "__RequestVerificationToken": token,
                "username": self.username,
                "pwd": self.password,
                "rememberme": "false",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        # A successful login redirects (302) to "/" — anything else means failure.
        if r.status_code not in (302, 200):
            raise RuntimeError(f"{self.name}: échec d'authentification (HTTP {r.status_code})")

        # Ground-truth checks — the OLD code treated ANY 302 (or any 200
        # that merely contained the word "Recherche") as a successful
        # login and unconditionally set self._authenticated = True. That's
        # the same class of bug already found & fixed for AD-Tunisie
        # (proad_client.py): a 302 with WRONG credentials still gets
        # returned by some ASP.NET MVC error-handling paths — it just
        # redirects back to the SAME login page instead of "/". Silently
        # accepting that means every subsequent search_reference() call
        # goes out with an unauthenticated session, gets an empty/anonymous
        # response body, and returns [] with nothing that looks like an
        # error — which is exactly the "still doesn't fetch anything"
        # symptom being reported.
        location = r.headers.get("location") or r.headers.get("Location") or ""
        if r.status_code == 302 and "login" in location.lower():
            raise RuntimeError(
                f"{self.name}: login redirigé vers la page de login (Location={location!r}) "
                f"— identifiants probablement invalides ou expirés"
            )
        body_lower = (r.text or "").lower()
        if r.status_code == 200 and (
            'type="password"' in body_lower or "__requestverificationtoken" in body_lower
        ):
            # The login FORM itself got re-rendered (password field / a
            # fresh antiforgery token present) — this is the login page
            # again, not the post-login app. A plain "Recherche" substring
            # check (the old logic) is too weak: that word can appear in
            # nav-menu markup even while still on the login page.
            raise RuntimeError(
                f"{self.name}: la page de login a été re-rendue (HTTP 200) — "
                f"identifiants probablement invalides"
            )
        self._authenticated = True

    async def _post_json(
        self, path: str, payload: Optional[Dict] = None, params: Optional[Dict] = None,
    ) -> httpx.Response:
        assert self._client is not None
        return await self._client.post(
            path,
            json=payload if payload is not None else {},
            params=params,
            headers={"Content-Type": "application/json"},
        )

    async def _save_mot(self, ref: str) -> httpx.Response:
        """POST /Recherche/SaveMot with `mot` sent BOTH as a query-string
        parameter AND as the JSON body.

        Reported live: searching the exact same ASP.NET MVC endpoint
        directly with `mot` as a query param (SaveMot?mot=...) returns a
        real match, while our JSON-only body (previous code) sometimes came
        back with an empty "no match" placeholder for the SAME reference.
        Classic ASP.NET MVC trap: a controller action binds simple POST
        parameters from the query string / form by default, and only reads
        the raw request body when the parameter is explicitly [FromBody] —
        so a JSON-only POST can silently fail to bind `mot` server-side
        while still returning HTTP 200 (the endpoint always echoes back the
        literal string "true", which does NOT confirm the value was
        actually saved). Sending it in both places works no matter which
        binding source the action actually uses."""
        return await self._post_json(
            "/Recherche/SaveMot", {"mot": ref}, params={"mot": ref},
        )

    async def search_reference(self, ref: str) -> List[Dict[str, Any]]:
        """Search the supplier for a part reference.

        Returns a normalised list of items shaped to match FadPro:
            {
              "reference":      str (ItemNo),
              "designation":    str,
              "fournisseur":    str (supplier name, e.g. "COPIA"),
              "stock":          int,
              "in_stock":       bool,
              "prix_origine":   float (UnitPrice, raw),
              "prix_tnd":       float (with margin + VAT),
              "marque":         str (best-effort, derived from ItemNo prefix),
              "modele":         str,
              "categorie":      str,
              "source":         self.name,
            }
        """
        ref = (ref or "").strip()
        if len(ref) < 2:
            return []

        async with self._lock:
            await self._ensure_auth()
            try:
                # Step A: save the search term in session
                r1 = await self._post_json("/Recherche/SaveMot", {"mot": ref})
                if r1.status_code in _AUTH_FAILURE_CODES:
                    # Session expired — re-auth and retry once
                    self._authenticated = False
                    await self._ensure_auth()
                    r1 = await self._post_json("/Recherche/SaveMot", {"mot": ref})
                if r1.status_code != 200:
                    logger.warning(f"{self.name}: SaveMot HTTP {r1.status_code} for ref={ref}")
                    return []

                # Step B: fetch items based on session
                r2 = await self._post_json("/Recherche/FindItembyOrigine", {})
                if r2.status_code in _AUTH_FAILURE_CODES:
                    # NEW: the session could just as easily have died BETWEEN
                    # SaveMot and FindItem (or SaveMot itself can return 200
                    # even against a dead/anonymous session on some IIS
                    # configs) — previously this status was never checked
                    # here, so an expired session silently produced an
                    # empty item list indistinguishable from "no matches".
                    # Re-auth, replay BOTH calls once.
                    logger.warning(
                        f"{self.name}: FindItem HTTP {r2.status_code} for ref={ref} "
                        f"— session appears dead, re-authenticating"
                    )
                    self._authenticated = False
                    await self._ensure_auth()
                    r1 = await self._post_json("/Recherche/SaveMot", {"mot": ref})
                    if r1.status_code != 200:
                        logger.warning(f"{self.name}: SaveMot retry HTTP {r1.status_code} for ref={ref}")
                        return []
                    r2 = await self._post_json("/Recherche/FindItembyOrigine", {})
                if r2.status_code != 200:
                    logger.warning(f"{self.name}: FindItem HTTP {r2.status_code} for ref={ref}")
                    return []
                raw = r2.json()
            except (httpx.HTTPError, ValueError) as e:
                logger.warning(f"{self.name}: erreur réseau pour ref={ref}: {e}")
                return []

        if not isinstance(raw, list):
            logger.warning(
                f"{self.name}: FindItem returned non-list payload for ref={ref} "
                f"(type={type(raw).__name__}) — treating as 0 results"
            )
            return []

        return self._parse_items(raw)

    def _parse_items(self, raw: List[dict]) -> List[Dict[str, Any]]:
        """Parse the raw FindItembyOrigine JSON array into our
        normalised item shape. Factored out of search_reference() so the
        debug endpoint can run the EXACT same parsing logic against a raw
        payload and show what comes out — otherwise the debug endpoint only
        ever shows the raw unparsed API response, which looks identical
        whether the parser is dropping items correctly or by mistake."""
        results: List[Dict[str, Any]] = []
        for it in raw:
            try:
                unit_ht = _to_float_eu(it.get("UnitPrice"))

                # BUG FOUND VIA /api/debug/copia-reference/{ref}: many real,
                # in-catalog items come back with UnitPrice="0,000" even
                # though a genuine sell price DOES exist in PrixTVA (price
                # incl. VAT — the number actually shown on the supplier's
                # own portal), e.g.:
                #   {"UnitPrice": "0,000", "TVA": "19,000", "PrixTVA": "282,554", ...}
                # The old code treated UnitPrice<=0 as "no real item" and
                # dropped it — which silently hid genuinely available
                # articles everywhere (PartnersSearchModal AND
                # oem-stock-search), even though the supplier clearly has
                # them. Reverse PrixTVA back to an HT-equivalent using the
                # item's own TVA percentage (falls back to our standard
                # 19% if TVA is missing/zero) so the SAME markup formula
                # still applies consistently instead of losing the item.
                if unit_ht <= 0:
                    prix_tva_raw = _to_float_eu(it.get("PrixTVA"))
                    if prix_tva_raw > 0:
                        tva_pct = _to_float_eu(it.get("TVA"))
                        divisor = 1 + (tva_pct / 100.0 if tva_pct > 0 else PRICE_MARKUP_VAT)
                        unit_ht = prix_tva_raw / divisor

                if unit_ht <= 0:
                    continue

                item_no = (it.get("ItemNo") or "").strip()
                description = (it.get("Description") or "").strip()
                # Copia/PartsPro signal "no match for this search term" by
                # returning a list with ONE object where every field is an
                # empty string (rather than an empty array) — seen live via
                # /api/debug/copia-reference/{ref} for a ref that genuinely
                # isn't in their catalog. UnitPrice/PrixTVA being empty
                # already yields unit_ht<=0 above in that exact case, but
                # guard on a blank ItemNo too so a reference-less "ghost"
                # item can never slip through under any field combination.
                if not item_no:
                    continue

                stock_main = int(_to_float_eu(it.get("StockMagasin")))
                stock_other = int(_to_float_eu(it.get("StockAutresMagasin")))
                stock_total = stock_main + stock_other
                # Unified pricing: prix_origine * 1.45 (same across all suppliers)
                prix_tnd = _adjust_price(unit_ht)

                results.append({
                    "reference": item_no,
                    "designation": description,
                    "fournisseur": self.name.upper(),
                    "marque": "",
                    "modele": "",
                    "categorie": "",
                    "stock": stock_total,
                    "in_stock": stock_total > 0,
                    "prix_origine": unit_ht,
                    "prix_tnd": prix_tnd,
                    "source": self.name,
                })
            except Exception as e:
                logger.debug(f"{self.name}: parse error: {e}")
                continue

        return results

    async def debug_search_reference(self, ref: str) -> dict:
        """Diagnostic helper (same style as proad_client's debug_search_
        reference/debug_login) — walks the login + SaveMot + FindItem flow
        step by step OUTSIDE the normal retry logic and reports exactly
        what happened at each stage: whether we had to (re)login, the HTTP
        status of each call, the raw response body/JSON, and how many
        items were parsed. Used by /api/debug/{copia,partspro}-reference/
        {ref} to find out WHY a reference search comes back empty without
        needing server log access. Does NOT mutate self._authenticated in
        a way that would break subsequent normal calls beyond what a
        normal login would already do."""
        ref = (ref or "").strip()
        if len(ref) < 2:
            return {"error": "ref trop courte (min. 2 caractères)"}

        result: dict = {"ref": ref, "supplier": self.name}

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
                r1 = await self._post_json("/Recherche/SaveMot", {"mot": ref})
                result["savemot_status"] = r1.status_code
                result["savemot_body_snippet"] = (r1.text or "")[:500]
                result["savemot_auth_failure_code"] = r1.status_code in _AUTH_FAILURE_CODES

                r2 = await self._post_json("/Recherche/FindItembyOrigine", {})
                result["finditem_status"] = r2.status_code
                result["finditem_auth_failure_code"] = r2.status_code in _AUTH_FAILURE_CODES
                result["finditem_body_snippet"] = (r2.text or "")[:1000]

                try:
                    raw = r2.json()
                    result["finditem_json_type"] = type(raw).__name__
                    result["finditem_raw_count"] = len(raw) if isinstance(raw, list) else None
                    if isinstance(raw, list):
                        result["finditem_sample_raw_items"] = raw[:3]
                        # Run the SAME parsing logic search_reference() uses,
                        # so this debug endpoint actually proves whether the
                        # parser (price/stock handling) keeps or drops each
                        # item — showing only the raw payload here was
                        # useless for confirming parser fixes, since the raw
                        # JSON looks identical whether the parser is working
                        # correctly or not.
                        parsed = self._parse_items(raw)
                        result["parsed_count"] = len(parsed)
                        result["parsed_items"] = parsed
                        result["dropped_count"] = len(raw) - len(parsed)
                except Exception as e:
                    result["finditem_json_parse_error"] = str(e)
            except Exception as e:
                result["request_exception"] = str(e)

        return result

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None
            self._authenticated = False


# Module-level singletons (one per supplier)
_copia_client: Optional[IISSupplierClient] = None
_partspro_client: Optional[IISSupplierClient] = None


def get_copia() -> IISSupplierClient:
    global _copia_client
    if _copia_client is None:
        _copia_client = IISSupplierClient(
            name="copia",
            base_url=os.environ["COPIA_BASE_URL"],
            username=os.environ["COPIA_USER"],
            password=os.environ["COPIA_PASSWORD"],
        )
    return _copia_client


def get_partspro() -> IISSupplierClient:
    global _partspro_client
    if _partspro_client is None:
        _partspro_client = IISSupplierClient(
            name="partspro",
            base_url=os.environ["PARTSPRO_BASE_URL"],
            username=os.environ["PARTSPRO_USER"],
            password=os.environ["PARTSPRO_PASSWORD"],
        )
    return _partspro_client


async def search_all_suppliers(ref: str) -> List[Dict[str, Any]]:
    """Run Copia + PartsPro in parallel and return a deduped combined list."""
    copia = get_copia()
    pp = get_partspro()
    copia_results, pp_results = await asyncio.gather(
        copia.search_reference(ref),
        pp.search_reference(ref),
        return_exceptions=True,
    )
    out: List[Dict[str, Any]] = []
    seen = set()
    for batch in (copia_results, pp_results):
        if isinstance(batch, Exception):
            logger.warning(f"supplier batch error: {batch}")
            continue
        for item in batch:
            key = (item["source"], item["reference"])
            if key in seen:
                continue
            seen.add(key)
            out.append(item)
    return out
