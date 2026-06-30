"""
BENNOURI – iteration_6 backend tests
=====================================

Validates the three architectural fixes for the user-reported bug
(q='Kit,chaine,distribution' → count=0). The bug root-cause from
iteration_5 was that piecesautos.tn vehicle-compat scraping
(get_compat_list) exhausted the 45 s global budget, so the gather()
got cancelled and returned an empty list.

The diff added on top of iteration_5:
  (1) PA_COMPAT_CAP = 50 module constant near pa_sem.
  (2) get_compat_list(ref, allow_fetch=True) wraps pa_fetch in
      asyncio.wait_for(..., timeout=2.0); on TimeoutError returns None
      so the caller keeps the picked items rather than dropping them.
  (3) The asyncio.gather + asyncio.wait_for(45) wrapper was replaced
      with `asyncio.as_completed(pending_tasks, timeout=40.0)` that
      surfaces partial results when the deadline fires, logging
      "oem-stock-search partial timeout for q=... X/Y candidates
      finished".

Acceptance:
  • Warm-cache path (supplier_lookup_cache flushed but
    piecesautos_compat_cache kept warm): count >= 1 in < 45 s.
  • Cold-cache path (both caches flushed): count >= 1 in < 45 s.
  • OEM 1608745980 still produces a FadPro row with items >= 1.
  • Small regression query (q='chaine,distribution') < 15 s with
    count >= 1.
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
    body = r.json()
    return body.get("access_token") or body.get("token")


def _mongo():
    from pymongo import MongoClient
    return MongoClient(MONGO_URL)


def _flush_supplier_cache():
    cli = _mongo()
    n = cli[DB_NAME].supplier_lookup_cache.delete_many({}).deleted_count
    cli.close()
    return n


def _flush_both_caches():
    cli = _mongo()
    a = cli[DB_NAME].supplier_lookup_cache.delete_many({}).deleted_count
    b = cli[DB_NAME].piecesautos_compat_cache.delete_many({}).deleted_count
    cli.close()
    return a, b


# ── 1. Source-level architectural checks ──────────────────────────────────
class TestArchitecturalFixes:
    """Validate the three concrete diffs added in iteration_6."""

    @classmethod
    def setup_class(cls):
        with open("/app/backend/server.py", "r", encoding="utf-8") as fh:
            cls.src = fh.read()

    def test_pa_compat_cap_constant_is_50(self):
        assert re.search(r"PA_COMPAT_CAP\s*=\s*50", self.src), (
            "PA_COMPAT_CAP = 50 module constant not declared in server.py"
        )

    def test_get_compat_list_accepts_allow_fetch(self):
        assert re.search(
            r"async\s+def\s+get_compat_list\([^)]*allow_fetch[^)]*\)", self.src
        ), "get_compat_list signature must accept allow_fetch parameter"

    def test_pa_fetch_wrapped_in_wait_for_2s(self):
        # asyncio.wait_for(pa_fetch(...), timeout=2.0) — allow whitespace
        # & varying arg name (ref / c / etc.)
        assert re.search(
            r"asyncio\.wait_for\(\s*pa_fetch\([^)]*\)\s*,\s*timeout\s*=\s*2(\.0)?\s*\)",
            self.src,
        ), "pa_fetch must be wrapped in asyncio.wait_for(..., timeout=2.0)"

    def test_lookup_passes_allow_fetch_with_pa_compat_cap(self):
        # get_compat_list(c["ref"], allow_fetch=idx < PA_COMPAT_CAP)
        assert re.search(
            r"get_compat_list\([^)]*allow_fetch\s*=\s*idx\s*<\s*PA_COMPAT_CAP",
            self.src,
        ), "lookup() must call get_compat_list(..., allow_fetch=idx < PA_COMPAT_CAP)"

    def test_as_completed_with_40s_timeout(self):
        assert re.search(
            r"asyncio\.as_completed\(\s*\w+\s*,\s*timeout\s*=\s*(deadline|40(\.0)?)\s*\)",
            self.src,
        ), (
            "asyncio.as_completed(pending_tasks, timeout=40.0) loop missing — "
            "partial-results pattern not implemented"
        )

    def test_partial_timeout_log_message(self):
        assert "oem-stock-search partial timeout" in self.src, (
            "Expected log message 'oem-stock-search partial timeout' "
            "for partial-results surfacing"
        )


# ── 2. End-to-end LARGE query — warm piecesautos_compat_cache ─────────────
class TestLargeQueryWarmCompatCache:
    """
    supplier_lookup_cache FLUSHED, piecesautos_compat_cache KEPT WARM.
    Must return HTTP 200 in < 45 s with count >= 1.
    """
    _http_status = None
    _elapsed = None
    _body = None
    _flushed = None

    def test_warm_compat_returns_200_under_45s_with_results(self, admin_jwt):
        TestLargeQueryWarmCompatCache._flushed = _flush_supplier_cache()
        headers = {"Authorization": f"Bearer {admin_jwt}"}
        t0 = time.monotonic()
        r = requests.get(
            f"{BASE_URL}/api/oem-stock-search",
            params=LARGE_PARAMS,
            headers=headers,
            timeout=80,
        )
        elapsed = time.monotonic() - t0
        TestLargeQueryWarmCompatCache._http_status = r.status_code
        TestLargeQueryWarmCompatCache._elapsed = elapsed
        try:
            TestLargeQueryWarmCompatCache._body = r.json()
        except Exception:
            TestLargeQueryWarmCompatCache._body = {}

        body = TestLargeQueryWarmCompatCache._body
        print(
            f"\n[LARGE-WARM] elapsed={elapsed:.2f}s status={r.status_code} "
            f"checked={body.get('checked')} count={body.get('count')} "
            f"flushed_supplier_rows={TestLargeQueryWarmCompatCache._flushed}"
        )

        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:300]}"
        assert elapsed < 45.0, (
            f"LARGE warm-compat wall-time {elapsed:.2f}s >= 45 s"
        )
        count = body.get("count", 0)
        items = body.get("items") or []
        assert count >= 1, (
            f"USER-REPORTED BUG: warm-compat count={count}, "
            f"items={len(items)}, checked={body.get('checked')}. "
            f"Expected count >= 1."
        )


# ── 3. End-to-end LARGE query — COLD both caches ──────────────────────────
class TestLargeQueryColdBothCaches:
    """
    Both supplier_lookup_cache AND piecesautos_compat_cache FLUSHED.
    Strongest acceptance test: thanks to PA_COMPAT_CAP=50 + 2 s
    per-call timeout + as_completed(40s) partial-results loop, the
    response must still contain count >= 1.
    """
    _http_status = None
    _elapsed = None
    _body = None
    _flushed_supplier = None
    _flushed_compat = None

    def test_cold_both_caches_returns_results_within_deadline(self, admin_jwt):
        sup, compat = _flush_both_caches()
        TestLargeQueryColdBothCaches._flushed_supplier = sup
        TestLargeQueryColdBothCaches._flushed_compat = compat
        headers = {"Authorization": f"Bearer {admin_jwt}"}
        t0 = time.monotonic()
        r = requests.get(
            f"{BASE_URL}/api/oem-stock-search",
            params=LARGE_PARAMS,
            headers=headers,
            timeout=80,
        )
        elapsed = time.monotonic() - t0
        TestLargeQueryColdBothCaches._http_status = r.status_code
        TestLargeQueryColdBothCaches._elapsed = elapsed
        try:
            TestLargeQueryColdBothCaches._body = r.json()
        except Exception:
            TestLargeQueryColdBothCaches._body = {}

        body = TestLargeQueryColdBothCaches._body
        print(
            f"\n[LARGE-COLD] elapsed={elapsed:.2f}s status={r.status_code} "
            f"checked={body.get('checked')} count={body.get('count')} "
            f"flushed_supplier={sup} flushed_compat={compat}"
        )

        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:300]}"
        # The endpoint internally uses a 40 s deadline + ~5 s safety margin
        # for setup/teardown. Accept up to 45 s.
        assert elapsed < 45.0, (
            f"LARGE cold wall-time {elapsed:.2f}s >= 45 s — "
            f"endpoint is still over budget on cold caches"
        )
        count = body.get("count", 0)
        items = body.get("items") or []
        assert count >= 1, (
            f"COLD-cache user-reported bug: count={count}, "
            f"items={len(items)}, checked={body.get('checked')}. "
            f"Expected count >= 1 via partial-results loop."
        )


# ── 4. FadPro variant fallback for OEM 1608745980 ─────────────────────────
class TestUserReportedOemCacheRow:
    """After the cold run, OEM 1608745980 must produce a FadPro cache
    row with items.length >= 1 (proves variant-fallback still works)."""

    def test_supplier_cache_row_for_1608745980(self):
        cli = _mongo()
        row = cli[DB_NAME].supplier_lookup_cache.find_one(
            {"source": "fadpro", "ref": "1608745980"},
            {"_id": 0, "matched_variant": 1, "items": 1},
        )
        cli.close()
        assert row is not None, (
            "No supplier_lookup_cache row for source='fadpro' "
            "ref='1608745980' after cold run — FadPro never ran for "
            "the user's reported OEM."
        )
        items = row.get("items") or []
        assert len(items) >= 1, (
            f"FadPro returned 0 items for OEM 1608745980 — "
            f"variant fallback regressed (matched_variant="
            f"{row.get('matched_variant')!r})"
        )


# ── 5. Regression: SMALL query (q='chaine,distribution') ──────────────────
class TestSmallQueryRegression:
    """Small queries (~20 candidates) must still complete in < 15 s
    with count >= 1 even after the cold-cache run above warmed things."""

    def test_small_query_returns_under_15s(self, admin_jwt):
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
        print(
            f"\n[SMALL] elapsed={elapsed:.2f}s status={r.status_code} "
            f"checked={body.get('checked')} count={body.get('count')}"
        )

        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:300]}"
        assert elapsed < 15.0, (
            f"SMALL query wall-time {elapsed:.2f}s >= 15 s — regression"
        )
        assert body.get("count", 0) >= 1, (
            f"SMALL query regression: count={body.get('count')}, "
            f"items={len(body.get('items') or [])}"
        )


# ── 6. Cache statistics for the test report ───────────────────────────────
class TestCacheStatsReport:
    """Non-blocking — just emits a summary line picked up by stdout."""

    def test_emit_cache_distribution(self):
        cli = _mongo()
        coll = cli[DB_NAME].supplier_lookup_cache
        fadpro = coll.count_documents({"source": "fadpro"})
        copia = coll.count_documents({"source": "copia"})
        partspro = coll.count_documents({"source": "partspro"})
        fadpro_nonempty = coll.count_documents(
            {"source": "fadpro", "items.0": {"$exists": True}}
        )
        compat = cli[DB_NAME].piecesautos_compat_cache.count_documents({})
        cli.close()
        print(
            f"\n[CACHE-STATS] fadpro_rows={fadpro} copia_rows={copia} "
            f"partspro_rows={partspro} fadpro_nonempty_hits={fadpro_nonempty} "
            f"piecesautos_compat_rows={compat}"
        )
        # FadPro must have run for a meaningful share of candidates
        assert fadpro >= 100, (
            f"FadPro only produced {fadpro} cache rows — variant runner "
            f"likely starved by timeout"
        )
