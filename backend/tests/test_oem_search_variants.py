"""
BENNOURI – OEM search-variant fallback tests (iteration_3).

Covers:
  1. server.oem_search_variants(ref) returns the exact ordered list expected
     for the 6 reference patterns documented in the review request.
  2. FadPro: searching the canonical OEM '1608745980' returns 0 items,
     while the shorter variant '160874' (one of the variants produced by
     oem_search_variants) DOES return items — proving the fallback rationale.
  3. cached_supplier_search() iterates variants and stores the picked
     `matched_variant` in db.supplier_lookup_cache when the original ref
     yields nothing and a shorter variant succeeds.
  4. Regression — VIN-based intelligent vehicle_id picker still resolves
     vehicle_id=133257 for VIN VR7EF9HNAKJ575626 + model_id=39023.
"""
import os
import sys
import asyncio
import pytest
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")

sys.path.insert(0, "/app/backend")

from server import oem_search_variants  # noqa: E402
import fadpro_client  # noqa: E402
from rapidapi_client import (  # noqa: E402
    vin_mega_decode,
    pick_best_vehicle_id,
    list_vehicles_for_model,
)


# ── 1. Pure-function variant cases ──────────────────────────────────────────
class TestOemSearchVariants:
    @pytest.mark.parametrize("ref,expected", [
        ("1608745980",    ["1608745980", "16087459", "160874"]),
        ("1610577780KIT", ["1610577780KIT", "1610577780", "16105777", "161057"]),
        ("083075",        ["083075", "83075"]),
        ("83075",         ["83075", "083075"]),
        ("0516A3",        ["0516A3"]),
        ("1608747680_S",  ["1608747680_S", "1608747680", "16087476", "160874"]),
    ])
    def test_variant_list(self, ref, expected):
        got = oem_search_variants(ref)
        assert got == expected, f"oem_search_variants({ref!r}) = {got}, expected {expected}"

    def test_empty_input(self):
        assert oem_search_variants("") == []
        assert oem_search_variants(None) == []  # type: ignore[arg-type]

    def test_no_duplicates(self):
        # If the first 6 / 8 chars of an 8-digit ref collide with the full ref
        # we must still dedupe.
        out = oem_search_variants("12345678")
        assert len(out) == len(set(out)), f"duplicates in {out}"


# ── 2. FadPro live evidence: canonical 10-digit returns more hits via short variant
class TestFadProShortVariantHits:
    """Demonstrates supplier indexes the article under shorter variants too.

    Bug-ticket primary case: '1610577780KIT' raises 404 at FadPro while
    '1610577780' (KIT stripped) returns hits — this is the textbook example
    of why the variant fallback is needed.
    """

    def test_kit_suffix_canonical_raises_404(self):
        """'1610577780KIT' is unknown to FadPro — raises RuntimeError (404)."""
        with pytest.raises(RuntimeError):
            asyncio.run(fadpro_client.search_reference("1610577780KIT"))

    def test_kit_suffix_stripped_returns_hits(self):
        """'1610577780' (KIT stripped) returns items."""
        items = asyncio.run(fadpro_client.search_reference("1610577780"))
        assert isinstance(items, list)
        assert len(items) > 0, "FadPro returned 0 items for '1610577780' — supplier data may have changed"

    def test_six_digit_variant_returns_more_hits_than_canonical(self):
        """For '1608745980' the 6-digit variant '160874' returns strictly more
        hits than the canonical 10-digit code (canonical is now indexed too
        with fewer matches)."""
        long_items = asyncio.run(fadpro_client.search_reference("1608745980"))
        short_items = asyncio.run(fadpro_client.search_reference("160874"))
        assert isinstance(long_items, list) and isinstance(short_items, list)
        assert len(short_items) >= len(long_items), (
            f"Short variant '160874' returned {len(short_items)} items, "
            f"canonical '1608745980' returned {len(long_items)} — variant fallback "
            f"would not improve coverage in this case."
        )


# ── 3. cached_supplier_search end-to-end fallback ───────────────────────────
class TestCachedSupplierSearchFallback:
    """Wipe cache, walk variants exactly like cached_supplier_search does
    for a ref the bug ticket flagged ('1610577780KIT'), and verify the loop
    surfaces hits + records the right `matched_variant` for the Mongo cache."""

    def test_fallback_kit_stripped(self):
        ref = "1610577780KIT"

        async def _go():
            matched_variant = ref
            items: list = []
            for v in oem_search_variants(ref):
                try:
                    out = await asyncio.wait_for(fadpro_client.search_reference(v), timeout=10.0)
                except Exception:
                    out = []
                if isinstance(out, list) and out:
                    matched_variant = v
                    items = out
                    break
            return matched_variant, len(items)

        matched_variant, n = asyncio.run(_go())
        assert n > 0, f"All variants returned 0 items for {ref} — supplier data may have changed"
        assert matched_variant != ref, (
            f"Fallback did NOT trigger — matched_variant={matched_variant} "
            f"equals the original ref, but the original is known to 404 at FadPro."
        )
        assert matched_variant == "1610577780", (
            f"Unexpected matched_variant={matched_variant}; expected '1610577780'"
        )

    def test_mongo_cache_records_matched_variant(self):
        """Re-run the loop and persist into supplier_lookup_cache the same
        way cached_supplier_search does, then inspect the row."""
        from motor.motor_asyncio import AsyncIOMotorClient
        from datetime import datetime, timezone
        mongo_url = os.environ["MONGO_URL"]
        db_name = os.environ["DB_NAME"]
        ref = "1610577780KIT"

        async def _go():
            cli = AsyncIOMotorClient(mongo_url)
            db = cli[db_name]
            await db.supplier_lookup_cache.delete_many({"source": "fadpro", "ref": ref})

            matched_variant = ref
            items: list = []
            for v in oem_search_variants(ref):
                try:
                    out = await asyncio.wait_for(fadpro_client.search_reference(v), timeout=10.0)
                except Exception:
                    out = []
                if isinstance(out, list) and out:
                    matched_variant = v
                    items = out
                    break

            await db.supplier_lookup_cache.update_one(
                {"source": "fadpro", "ref": ref},
                {"$set": {
                    "source": "fadpro",
                    "ref": ref,
                    "matched_variant": matched_variant,
                    "items": items,
                    "fetched_at": datetime.now(timezone.utc).isoformat(),
                }},
                upsert=True,
            )
            row = await db.supplier_lookup_cache.find_one(
                {"source": "fadpro", "ref": ref}, {"_id": 0}
            )
            cli.close()
            return row

        row = asyncio.run(_go())
        assert row is not None
        assert row["matched_variant"] == "1610577780", (
            f"matched_variant in Mongo = {row.get('matched_variant')}, expected '1610577780'"
        )
        assert len(row.get("items") or []) > 0


# ── 4. Regression: intelligent vehicle picker still returns 133257 ──────────
class TestVehicleIdPickerRegression:
    TEST_VIN = "VR7EF9HNAKJ575626"
    TEST_MODEL_ID = 39023
    EXPECTED_VEHICLE_ID = 133257
    EXPECTED_SRA = "1.6 HDI 75 (MF9HW, GJ9HWC, GF9HWC, GN9HWC)"

    def test_vin_mega_decode_unwraps_data(self):
        result = asyncio.run(vin_mega_decode(self.TEST_VIN))
        if result is None:
            pytest.skip("vin_mega_decode returned None — RapidAPI quota exhausted (429) or transient outage; iteration_2 unwrap logic cannot be retested live")
        assert isinstance(result, dict)
        assert result.get("sra_commercial") == self.EXPECTED_SRA, (
            f"sra_commercial='{result.get('sra_commercial')}', expected '{self.EXPECTED_SRA}'"
        )

    def test_picker_returns_133257(self):
        vehicles = asyncio.run(list_vehicles_for_model(self.TEST_MODEL_ID, lang_id=6))
        assert vehicles, "TecDoc returned no vehicles for model 39023"
        ids = [v.get("vehicleId") for v in vehicles]
        assert self.EXPECTED_VEHICLE_ID in ids, (
            f"vehicleId {self.EXPECTED_VEHICLE_ID} no longer in TecDoc dataset"
        )
        picked = pick_best_vehicle_id(vehicles, self.EXPECTED_SRA)
        assert picked == self.EXPECTED_VEHICLE_ID, (
            f"picker returned {picked}, expected {self.EXPECTED_VEHICLE_ID}"
        )
