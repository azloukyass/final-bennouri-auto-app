"""
BENNOURI – VIN-based intelligent vehicle_id picker tests.

Covers:
  1. rapidapi_client.vin_mega_decode() unwraps payload["data"] and returns
     a dict whose `sra_commercial` matches the expected Peugeot 1.6 HDi
     value for VIN VR7EF9HNAKJ575626.
  2. rapidapi_client.pick_best_vehicle_id() returns 133257 against the
     TecDoc list of vehicles for modelId=39023 when given that sra value.
  3. GET /api/oem-stock-search succeeds (200) with VIN=VR7EF9HNAKJ575626,
     model_id=39023, q='filtre à huile' and that the matching log line
     is emitted. The MongoDB cache row for that VIN is wiped first so the
     resolution path is exercised on a cold cache.
"""
import os
import sys
import asyncio
import uuid
import pytest
import requests
from dotenv import load_dotenv

# Load backend .env so RAPIDAPI_KEY is available when we import the client
load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")

# Make the backend package importable
sys.path.insert(0, "/app/backend")

from rapidapi_client import (  # noqa: E402
    vin_mega_decode,
    pick_best_vehicle_id,
    list_vehicles_for_model,
)

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

TEST_VIN = "VR7EF9HNAKJ575626"
TEST_MODEL_ID = 39023
EXPECTED_VEHICLE_ID = 133257
EXPECTED_SRA = "1.6 HDI 75 (MF9HW, GJ9HWC, GF9HWC, GN9HWC)"


# ---------- 1. vin_mega_decode unwraps "data" ----------
class TestVinMegaDecode:
    def test_vin_mega_returns_sra_commercial(self):
        result = asyncio.run(vin_mega_decode(TEST_VIN))
        assert result is not None, "vin_mega_decode returned None — RapidAPI down or VIN rejected"
        assert isinstance(result, dict), f"expected dict, got {type(result)}"
        sra = result.get("sra_commercial")
        assert sra, f"sra_commercial missing — fix did not unwrap data. Keys: {list(result.keys())}"
        assert sra == EXPECTED_SRA, f"sra_commercial mismatch: got '{sra}', expected '{EXPECTED_SRA}'"


# ---------- 2. pick_best_vehicle_id picks 133257 ----------
class TestPickBestVehicleId:
    def test_picks_133257_for_peugeot_16_hdi(self):
        vehicles = asyncio.run(list_vehicles_for_model(TEST_MODEL_ID, lang_id=6))
        assert vehicles, f"No vehicles returned for modelId={TEST_MODEL_ID}"
        # Pre-check: 133257 must be in the variant list, else the test is
        # invalid (TecDoc dataset changed).
        ids = [v.get("vehicleId") for v in vehicles]
        assert EXPECTED_VEHICLE_ID in ids, (
            f"vehicleId {EXPECTED_VEHICLE_ID} not in TecDoc list for model {TEST_MODEL_ID}; got {ids}"
        )
        picked = pick_best_vehicle_id(vehicles, EXPECTED_SRA)
        assert picked == EXPECTED_VEHICLE_ID, (
            f"pick_best_vehicle_id returned {picked}, expected {EXPECTED_VEHICLE_ID}"
        )

    def test_blue_hdi_normalisation(self):
        """Sanity-check token normalisation: 'BlueHDi' must match 'HDI'."""
        fake_vehicles = [
            {"vehicleId": 1, "typeEngineName": "1.6 BlueHDi 100"},
            {"vehicleId": 2, "typeEngineName": "1.6 BlueHDi 75"},
            {"vehicleId": 3, "typeEngineName": "1.2 PureTech 75"},
        ]
        picked = pick_best_vehicle_id(fake_vehicles, "1.6 HDI 75 (whatever)")
        assert picked == 2


# ---------- 3. /api/oem-stock-search integration ----------
@pytest.fixture(scope="module")
def auth_token():
    """Register a fresh test user and return JWT."""
    email = f"TEST_vin_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(
        f"{API}/auth/register",
        json={
            "name": "VIN Test",
            "email": email,
            "password": "VinTest@123",
            "phone": "+216 22 222 222",
            "address": "Tunis",
        },
        timeout=30,
    )
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def wipe_cache():
    """Remove the cached vehicle row so the endpoint re-resolves via VIN."""
    from motor.motor_asyncio import AsyncIOMotorClient

    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    assert mongo_url and db_name, "MONGO_URL/DB_NAME missing in backend env"

    async def _clear():
        cli = AsyncIOMotorClient(mongo_url)
        db = cli[db_name]
        res = await db.tecdoc_vehicle_cache.delete_many({"vin": TEST_VIN})
        cli.close()
        return res.deleted_count

    deleted = asyncio.run(_clear())
    return deleted


class TestOemStockSearchWithVin:
    def test_oem_stock_search_resolves_via_vin(self, auth_token, wipe_cache):
        # Cache wiped (deleted = wipe_cache, may be 0 on first run)
        r = requests.get(
            f"{API}/oem-stock-search",
            params={
                "model_id": TEST_MODEL_ID,
                "q": "filtre à huile",
                "lang_id": 6,
                "vin": TEST_VIN,
                "limit": 5,
            },
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=90,
        )
        assert r.status_code == 200, f"oem-stock-search failed: {r.status_code} {r.text[:500]}"
        data = r.json()
        # Response shape sanity
        assert isinstance(data, dict), f"expected dict, got {type(data)}"
        # Items list must exist (may be empty if no supplier has stock, but key must be there)
        assert "items" in data or "results" in data, f"missing items/results key. Got keys: {list(data.keys())}"

    def test_log_contains_match_line(self, auth_token):
        """After the call above, the backend log should contain the
        'matched vehicle_id=133257 via sra=' line at least once."""
        import subprocess
        # Look in the most recent supervisor backend log
        out = subprocess.run(
            ["bash", "-lc", "tail -n 500 /var/log/supervisor/backend.*.log 2>/dev/null | grep -E 'matched vehicle_id=133257' || true"],
            capture_output=True, text=True, timeout=10,
        )
        assert "matched vehicle_id=133257" in out.stdout, (
            f"Expected log line not found. Tail snippet: {out.stdout[-500:] or '<empty>'}"
        )
