"""Iteration 7 — STRICT designation filter on /api/oem-stock-search.

For q="Kit,chaine,distribution", every returned item's `designation` must
contain "kit" AND "chaine" AND "distribution" (case-insensitive,
accent-insensitive). Items with abbreviations like "DIST" must be dropped.

Also unit-tests the two pure helpers `_designation_query_tokens` and
`_designation_has_all_tokens` directly from server.py.
"""
import os
import sys
import time
import unicodedata
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")

ADMIN_EMAIL = "admin@bennouri.com"
ADMIN_PASSWORD = "Admin@123"

# Allow importing server helpers for direct unit tests
sys.path.insert(0, "/app/backend")


def _strip_accents_local(s: str) -> str:
    if not s:
        return ""
    n = unicodedata.normalize("NFKD", s)
    return "".join(c for c in n if not unicodedata.combining(c)).lower()


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    token = r.json().get("access_token") or r.json().get("token")
    assert token, f"no token in login response: {r.json()}"
    return token


@pytest.fixture(scope="session")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------- unit tests on the two pure helpers ----------
class TestDesignationHelpers:
    """Pure-function tests against /app/backend/server.py helpers."""

    def test_tokens_comma_separated(self):
        from server import _designation_query_tokens
        assert _designation_query_tokens("Kit,chaine,distribution") == [
            "kit", "chaine", "distribution"
        ]

    def test_tokens_space_separated(self):
        from server import _designation_query_tokens
        assert _designation_query_tokens("kit chaine") == ["kit", "chaine"]

    def test_tokens_dash_separated(self):
        from server import _designation_query_tokens
        assert _designation_query_tokens("kit-chaine") == ["kit", "chaine"]

    def test_tokens_accent_insensitive(self):
        from server import _designation_query_tokens
        # 'élément' -> 'element'
        toks = _designation_query_tokens("élément,filtre")
        assert "element" in toks and "filtre" in toks

    def test_tokens_drops_short_words(self):
        from server import _designation_query_tokens
        # tokens <3 chars filtered out
        toks = _designation_query_tokens("de la kit")
        assert toks == ["kit"]

    def test_has_all_tokens_negative_kit_dist(self):
        from server import _designation_has_all_tokens
        # KIT DIST 141DTS contains 'kit' but NOT 'chaine' nor 'distribution'
        assert _designation_has_all_tokens(
            "KIT DIST 141DTS -1608747480- BANDO",
            ["kit", "chaine", "distribution"]
        ) is False

    def test_has_all_tokens_positive(self):
        from server import _designation_has_all_tokens
        assert _designation_has_all_tokens(
            "KIT CHAINE DISTRIBUTION 1.6HDI",
            ["kit", "chaine", "distribution"]
        ) is True

    def test_has_all_tokens_accent_in_designation(self):
        from server import _designation_has_all_tokens
        # accent in designation must still match accent-stripped token
        assert _designation_has_all_tokens(
            "FILTRE À HUILE BOSCH",
            ["filtre", "huile"]
        ) is True

    def test_has_all_tokens_empty_query(self):
        from server import _designation_has_all_tokens
        # no tokens → no filter, returns True
        assert _designation_has_all_tokens("anything", []) is True


# ---------- live endpoint acceptance tests ----------
class TestOemStockSearchStrictFilter:
    """Live /api/oem-stock-search with STRICT designation filter."""

    LARGE_PARAMS = {
        "model_id": 39023,
        "q": "Kit,chaine,distribution",
        "lang_id": 6,
        "limit": 50,
        "split": "true",
        "vin": "VR7EF9HNAKJ575626",
        "vehicle_name": "CITROËN BERLINGO Box Body/MPV (K9)",
    }

    def _assert_strict_filter(self, items, required_tokens):
        """Hard assertion: EVERY item must contain ALL tokens."""
        violations = []
        for it in items:
            d = it.get("designation") or ""
            norm = _strip_accents_local(d)
            missing = [t for t in required_tokens if t not in norm]
            if missing:
                violations.append({
                    "designation": d,
                    "missing_tokens": missing,
                    "source": it.get("source"),
                    "reference": it.get("reference"),
                })
        if violations:
            pytest.fail(
                f"{len(violations)} item(s) violated the designation filter "
                f"(required tokens={required_tokens}). First 5 violations: "
                f"{violations[:5]}"
            )

    def test_kit_chaine_distribution_strict(self, auth_headers):
        """CRITICAL acceptance test from review request."""
        t0 = time.time()
        r = requests.get(
            f"{BASE_URL}/api/oem-stock-search",
            params=self.LARGE_PARAMS,
            headers=auth_headers,
            timeout=60,
        )
        elapsed = time.time() - t0
        assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:300]}"
        assert elapsed < 45, f"endpoint took {elapsed:.2f}s, > 45s budget"

        payload = r.json()
        items = payload.get("items", [])
        count = payload.get("count", 0)

        # Sample first 5 designations into the test log for evidence
        print(f"\n[evidence] elapsed={elapsed:.2f}s  count={count}  items={len(items)}")
        print(f"[evidence] checked={payload.get('checked')}")
        for i, it in enumerate(items[:5]):
            print(f"[evidence] designation[{i}] = {it.get('designation')!r}  "
                  f"src={it.get('source')}  ref={it.get('reference')}")

        # The filter must NOT nuke everything
        assert count >= 1, "count < 1 — filter nuked all results"
        # And every single item must satisfy the strict filter
        self._assert_strict_filter(
            items, ["kit", "chaine", "distribution"]
        )

    def test_chaine_distribution_two_tokens(self, auth_headers):
        params = dict(self.LARGE_PARAMS, q="chaine,distribution")
        r = requests.get(
            f"{BASE_URL}/api/oem-stock-search",
            params=params,
            headers=auth_headers,
            timeout=60,
        )
        assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:300]}"
        items = r.json().get("items", [])
        print(f"\n[evidence] chaine,distribution count={len(items)}")
        for i, it in enumerate(items[:5]):
            print(f"[evidence] designation[{i}] = {it.get('designation')!r}")
        self._assert_strict_filter(items, ["chaine", "distribution"])

    def test_filtre_huile_sanity(self, auth_headers):
        params = dict(self.LARGE_PARAMS, q="filtre,huile")
        r = requests.get(
            f"{BASE_URL}/api/oem-stock-search",
            params=params,
            headers=auth_headers,
            timeout=60,
        )
        assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:300]}"
        items = r.json().get("items", [])
        print(f"\n[evidence] filtre,huile count={len(items)}")
        for i, it in enumerate(items[:5]):
            print(f"[evidence] designation[{i}] = {it.get('designation')!r}")
        # Sanity: every item must contain 'filtre' and 'huile' (if any items)
        self._assert_strict_filter(items, ["filtre", "huile"])


# ---------- regression checks (read-only source inspection) ----------
class TestRegressionIter6FixesIntact:
    """The iter_6 architectural fixes must still be present."""

    def test_pa_compat_cap_50(self):
        src = open("/app/backend/server.py", "r").read()
        assert "PA_COMPAT_CAP = 50" in src, "PA_COMPAT_CAP=50 missing"

    def test_pa_fetch_wait_for_2s(self):
        src = open("/app/backend/server.py", "r").read()
        assert "asyncio.wait_for(pa_fetch" in src and "timeout=2.0" in src, (
            "asyncio.wait_for(pa_fetch, timeout=2.0) missing"
        )

    def test_as_completed_partial_loop(self):
        src = open("/app/backend/server.py", "r").read()
        assert "asyncio.as_completed(" in src, "as_completed partial-results loop missing"

    def test_locked_supplier_cap_60(self):
        src = open("/app/backend/server.py", "r").read()
        assert "LOCKED_SUPPLIER_CAP = 60" in src, "LOCKED_SUPPLIER_CAP=60 missing"

    def test_filter_wired_in_response_builder(self):
        src = open("/app/backend/server.py", "r").read()
        assert "_designation_query_tokens(query)" in src
        assert "_designation_has_all_tokens(" in src
