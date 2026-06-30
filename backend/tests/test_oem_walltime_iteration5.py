"""
BENNOURI – iteration_5 backend tests
=====================================

Goals (per review request):

 1. With a flushed supplier_lookup_cache, GET /api/oem-stock-search?model_id=
    39023&q=Kit,chaine,distribution&split=true&vin=VR7EF9HNAKJ575626 MUST:
      • Return HTTP 200
      • Complete in under 45 s wall-time
      • Return count >= 1 (NOT zero — user-reported bug)

 2. After that call, db.supplier_lookup_cache MUST contain a row with
    source='fadpro', ref='1608745980' whose matched_variant ∈
    {'1608745980','160874'} AND items.length >= 1 — proving the FadPro
    variant fallback ran for the user's reported OEM.

 3. Cap architecture is in place in server.py:
      • `sem = asyncio.Semaphore(60)` (concurrency lifted from 25→60)
      • `LOCKED_SUPPLIER_CAP = 60` module constant inside the endpoint
      • lookup(c, idx) skips Copia/PartsPro when idx >= LOCKED_SUPPLIER_CAP
      • FadPro runs for ALL candidates unconditionally

 4. Cache distribution after the 616-candidate run:
      • fadpro_rows ≈ checked_total (≥ 500)
      • copia_rows ≤ 60
      • partspro_rows ≤ 60

 5. Regression: q='chaine,distribution' (smaller, 20 candidates) MUST still
    return count >= 1 in under 30 s (matches iteration_4 expectation).
"""
import os
import re
import sys
import time
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")

sys.path.insert(0, "/app/backend")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

ADMIN_EMAIL = "admin@bennouri.com"
ADMIN_PASS = "Admin@123"

LARGE_PARAMS = {
    "model_id": 39023,
    "q": "Kit,chaine,distribution",
    "lang_id": 6,
    "limit": 50,
    "split": "true",
    "vin": "VR7EF9HNAKJ575626",
    "vehicle_name": "CITROËN BERLINGO Box Body/MPV (K9)",
}

SMALL_PARAMS = {
    "model_id": 39023,
    "q": "chaine,distribution",
    "lang_id": 6,
    "limit": 50,
    "split": "true",
    "vin": "VR7EF9HNAKJ575626",
    "vehicle_name": "CITROËN BERLINGO Box Body/MPV (K9)",
}


# ── Shared fixtures ────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def admin_jwt():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASS},
        timeout=15,
    )
    if r.status_code != 200:
        pytest.skip(f"Could not log in admin: {r.status_code} {r.text[:200]}")
    return r.json().get("access_token") or r.json().get("token")


def _flush_cache():
    from pymongo import MongoClient
    cli = MongoClient(MONGO_URL)
    deleted = cli[DB_NAME].supplier_lookup_cache.delete_many({}).deleted_count
    cli.close()
    return deleted


# ── 1. Source-level architecture checks ────────────────────────────────────
class TestCapArchitecture:
    @classmethod
    def setup_class(cls):
        with open("/app/backend/server.py", "r", encoding="utf-8") as fh:
            cls.src = fh.read()

    def test_semaphore_is_60(self):
        # Allow whitespace variation
        assert re.search(r"sem\s*=\s*asyncio\.Semaphore\(\s*60\s*\)", self.src), (
            "asyncio.Semaphore(60) not found in server.py — semaphore must "
            "be bumped from 25 to 60 for the variant-fallback architecture"
        )

    def test_locked_supplier_cap_constant_is_60(self):
        assert re.search(r"LOCKED_SUPPLIER_CAP\s*=\s*60", self.src), (
            "LOCKED_SUPPLIER_CAP = 60 module constant not declared in server.py"
        )

    def test_lookup_skips_locked_suppliers_past_cap(self):
        # The check 'idx < LOCKED_SUPPLIER_CAP' must gate Copia/PartsPro calls
        assert "idx < LOCKED_SUPPLIER_CAP" in self.src, (
            "lookup(c, idx) does not gate Copia/PartsPro behind "
            "idx < LOCKED_SUPPLIER_CAP — locked-supplier cap not wired"
        )
        # And FadPro must be called unconditionally for every candidate
        assert "cached_supplier_search(\"fadpro\"" in self.src, (
            "FadPro call site not found in lookup() — variant-fallback runner missing"
        )

    def test_enumerate_passes_idx_to_lookup(self):
        # gather(*[lookup(c, i) for i, c in enumerate(candidates)])
        assert re.search(r"lookup\(c,\s*i\)\s+for\s+i,\s*c\s+in\s+enumerate\(candidates\)", self.src), (
            "candidates enumeration does not pass idx to lookup() — "
            "LOCKED_SUPPLIER_CAP cannot fire without an index"
        )

    def test_variant_sources_is_fadpro_only(self):
        assert 'VARIANT_SOURCES = {"fadpro"}' in self.src, (
            "VARIANT_SOURCES = {'fadpro'} constant not present in server.py"
        )


# ── 2. End-to-end LARGE query (616 candidates) ────────────────────────────
class TestLargeQueryWalltime:
    """Module-scoped state holder for cascaded assertions."""
    _http_status = None
    _elapsed = None
    _body = None
    _flushed = None

    def test_flush_and_call_returns_200_under_45s(self, admin_jwt):
        TestLargeQueryWalltime._flushed = _flush_cache()
        headers = {"Authorization": f"Bearer {admin_jwt}"}
        t0 = time.monotonic()
        r = requests.get(
            f"{BASE_URL}/api/oem-stock-search",
            params=LARGE_PARAMS,
            headers=headers,
            timeout=80,  # measure overrun, don't kill it
        )
        elapsed = time.monotonic() - t0
        TestLargeQueryWalltime._http_status = r.status_code
        TestLargeQueryWalltime._elapsed = elapsed
        try:
            TestLargeQueryWalltime._body = r.json()
        except Exception:
            TestLargeQueryWalltime._body = {}
        print(f"\n[LARGE] elapsed={elapsed:.2f}s status={r.status_code} "
              f"checked={TestLargeQueryWalltime._body.get('checked')} "
              f"count={TestLargeQueryWalltime._body.get('count')} "
              f"flushed={TestLargeQueryWalltime._flushed}")

        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:300]}"
        assert elapsed < 45.0, (
            f"LARGE query wall-time {elapsed:.2f}s >= 45 s — "
            f"global timeout would trip"
        )

    def test_count_is_at_least_one(self):
        body = TestLargeQueryWalltime._body or {}
        count = body.get("count", 0)
        items = body.get("items") or []
        assert count >= 1, (
            f"User-reported bug NOT fixed: count={count}, items={len(items)}, "
            f"checked={body.get('checked')}. Expected count >= 1."
        )
        assert len(items) >= 1


# ── 3. FadPro variant fallback for OEM 1608745980 ─────────────────────────
class TestUserReportedOemFallback:
    def test_supplier_cache_row_for_1608745980(self):
        from pymongo import MongoClient
        cli = MongoClient(MONGO_URL)
        coll = cli[DB_NAME].supplier_lookup_cache
        row = coll.find_one(
            {"source": "fadpro", "ref": "1608745980"},
            {"_id": 0, "matched_variant": 1, "items": 1},
        )
        cli.close()
        assert row is not None, (
            "No supplier_lookup_cache row for source='fadpro' "
            "ref='1608745980' — FadPro never ran for the user's reported OEM. "
            "Either the candidate didn't appear in TecDoc's 616-result set, "
            "or FadPro was capped out."
        )
        matched = row.get("matched_variant")
        assert matched in ("1608745980", "160874"), (
            f"matched_variant={matched!r}; expected '1608745980' or '160874'"
        )
        items = row.get("items") or []
        assert len(items) >= 1, (
            f"FadPro returned 0 items for both variants of 1608745980 — "
            f"variant fallback proved ineffective for this OEM"
        )


# ── 4. Cache distribution proves the cap architecture fired ───────────────
class TestCacheDistribution:
    def test_fadpro_runs_for_all_candidates_and_locked_capped(self):
        from pymongo import MongoClient
        cli = MongoClient(MONGO_URL)
        coll = cli[DB_NAME].supplier_lookup_cache
        fadpro = coll.count_documents({"source": "fadpro"})
        copia = coll.count_documents({"source": "copia"})
        partspro = coll.count_documents({"source": "partspro"})
        cli.close()
        body = TestLargeQueryWalltime._body or {}
        checked = body.get("checked", 0)
        print(f"\n[CACHE] checked={checked} fadpro={fadpro} "
              f"copia={copia} partspro={partspro}")

        # FadPro must have run for (approximately) every candidate
        # Tolerate a small margin in case a few network timeouts skipped the
        # write — but the gap must be tiny.
        assert fadpro >= max(500, int(checked * 0.9)), (
            f"FadPro only ran for {fadpro} candidates "
            f"(checked={checked}); expected ≈ all candidates"
        )
        # Copia / PartsPro must be capped at 60
        assert copia <= 60, f"Copia ran {copia} times — should be <=60 (cap)"
        assert partspro <= 60, f"PartsPro ran {partspro} times — should be <=60 (cap)"


# ── 5. Regression: SMALL query (20 candidates) ─────────────────────────────
class TestSmallQueryRegression:
    def test_small_query_still_returns_results(self, admin_jwt):
        # Use existing cache from large query — small query refs are a strict
        # subset of large query refs, so this should be a fast warm hit.
        headers = {"Authorization": f"Bearer {admin_jwt}"}
        t0 = time.monotonic()
        r = requests.get(
            f"{BASE_URL}/api/oem-stock-search",
            params=SMALL_PARAMS,
            headers=headers,
            timeout=45,
        )
        elapsed = time.monotonic() - t0
        body = {}
        try:
            body = r.json()
        except Exception:
            pass
        print(f"\n[SMALL] elapsed={elapsed:.2f}s status={r.status_code} "
              f"checked={body.get('checked')} count={body.get('count')}")
        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:300]}"
        assert elapsed < 30.0, (
            f"SMALL query wall-time {elapsed:.2f}s >= 30 s — regression"
        )
        assert body.get("count", 0) >= 1, (
            f"SMALL query regression: count={body.get('count')}, "
            f"items={len(body.get('items') or [])}"
        )
