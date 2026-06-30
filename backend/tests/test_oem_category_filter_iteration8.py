"""Iteration 8 — category-path filter for OEM stock search.

Replaces the iter_7 designation-based filter with a CATEGORY-PATH filter that
checks the item's `categorie` field (the unabbreviated supplier hierarchy
"niv1 / niv2 / niv3 / niv4") against required tokens defined in
`SUBCATEGORY_CATEGORY_FILTERS` at the top of /app/backend/server.py.
"""
import os
import sys
import unicodedata
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
# Fall back to frontend .env when the env var is not set in the testing shell.
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

# Import the backend helpers directly to unit-test the filter map.
sys.path.insert(0, "/app/backend")
import server  # noqa: E402


def _strip(s: str) -> str:
    n = unicodedata.normalize("NFKD", s or "")
    return "".join(c for c in n if not unicodedata.combining(c)).lower()


# ─── Module-level helper tests ──────────────────────────────────────────────
class TestCategoryFilterHelpers:
    def test_filter_map_has_required_entries(self):
        m = server.SUBCATEGORY_CATEGORY_FILTERS
        assert isinstance(m, list) and len(m) >= 3
        triples = [(tuple(sorted(e["query_tokens"])),
                    tuple(sorted(e["required_category_tokens"])))
                   for e in m]
        assert (("chaine", "distribution", "kit"),
                ("composants", "distribution", "moteur")) in triples
        assert (("chaine", "kit"),
                ("composants", "distribution", "moteur")) in triples
        assert (("chaine", "distribution"),
                ("composants", "distribution", "moteur")) in triples

    def test_resolver_superset_match(self):
        for q in ("Kit,chaine,distribution", "kit chaine", "chaine,distribution",
                  "kit chaine distribution"):
            got = server._category_filter_for_query(q)
            assert got == ["moteur", "distribution", "composants"], q

    def test_resolver_no_filter_for_unregistered(self):
        assert server._category_filter_for_query("filtre,huile") is None
        assert server._category_filter_for_query("") is None
        assert server._category_filter_for_query(None) is None


# ─── HTTP integration tests against live backend ────────────────────────────
@pytest.fixture(scope="module")
def auth_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "admin@bennouri.com", "password": "Admin@123"},
        timeout=30,
    )
    if r.status_code != 200:
        pytest.skip(f"login failed: {r.status_code} {r.text[:200]}")
    return r.json().get("token") or r.json().get("access_token")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"} if auth_token else {}


@pytest.fixture(scope="module")
def kit_chaine_response(auth_headers):
    params = {
        "model_id": 39023,
        "q": "Kit,chaine,distribution",
        "lang_id": 6,
        "limit": 50,
        "split": "true",
        "vin": "VR7EF9HNAKJ575626",
        "vehicle_name": "CITROËN BERLINGO Box Body/MPV (K9)",
    }
    r = requests.get(
        f"{BASE_URL}/api/oem-stock-search",
        params=params, headers=auth_headers, timeout=120,
    )
    assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
    return r.json()


class TestKitChaineFilter:
    def test_count_at_least_one(self, kit_chaine_response):
        data = kit_chaine_response
        assert data["count"] >= 1, f"expected ≥1 item; got {data['count']}"
        assert len(data["items"]) >= 1

    def test_every_item_categorie_contains_required_tokens(self, kit_chaine_response):
        required = ["moteur", "distribution", "composants"]
        items = kit_chaine_response["items"]
        bad = []
        for it in items:
            cat = it.get("categorie") or ""
            norm = _strip(cat)
            if not all(t in norm for t in required):
                bad.append({
                    "ref": it.get("ref"),
                    "designation": it.get("designation"),
                    "categorie": cat,
                })
        assert not bad, (
            f"{len(bad)} item(s) failed the category-path filter — first 3: "
            f"{bad[:3]}"
        )

    def test_sample_categories_logged(self, kit_chaine_response):
        items = kit_chaine_response["items"]
        sample = [
            {"categorie": it.get("categorie"),
             "designation": it.get("designation")}
            for it in items[:5]
        ]
        print(
            f"\n[iteration_8] Filter accepted {kit_chaine_response['count']} "
            f"item(s). Sample (categorie, designation) pairs:"
        )
        for s in sample:
            print(f"  - {s['categorie']!r}  |  {s['designation']!r}")
        # always passes — informational
        assert sample


class TestFiltreHuileNoFilter:
    """q='filtre,huile' is not registered → filter bypassed (None)."""
    def test_unregistered_query_returns_items_unfiltered(self, auth_headers):
        params = {
            "model_id": 39023,
            "q": "filtre,huile",
            "lang_id": 6,
            "limit": 50,
            "split": "true",
            "vin": "VR7EF9HNAKJ575626",
            "vehicle_name": "CITROËN BERLINGO Box Body/MPV (K9)",
        }
        r = requests.get(
            f"{BASE_URL}/api/oem-stock-search",
            params=params, headers=auth_headers, timeout=120,
        )
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        data = r.json()
        # No assertion on items[].categorie because resolver returned None.
        assert "count" in data and "items" in data
        print(f"\n[iteration_8] filtre,huile (no-filter) count={data['count']}")


# ─── Regression: iter_6 architectural caps still present ────────────────────
class TestIter6Regression:
    def test_constants_intact(self):
        src = open("/app/backend/server.py").read()
        assert "PA_COMPAT_CAP = 50" in src
        assert "LOCKED_SUPPLIER_CAP = 60" in src
        assert "asyncio.wait_for(pa_fetch(ref), timeout=2.0)" in src
        assert "deadline = 40.0" in src
        assert "asyncio.as_completed(pending_tasks, timeout=deadline)" in src
        assert "Semaphore(60)" in src or "Semaphore( 60)" in src

    def test_fadpro_variant_fallback_intact(self):
        src = open("/app/backend/server.py").read()
        # iter_6 added oem_search_variants() and uses it in the FadPro path
        assert "def oem_search_variants" in src
        assert "oem_search_variants(" in src
