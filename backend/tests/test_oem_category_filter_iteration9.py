"""Iteration 9 — full coverage of the 21 user-listed sub-category rules.

Schema extension under test:
  • `required_category_tokens` may be a flat list (AND) OR a list-of-lists
    (OR-of-AND). Detected by the helper `_category_matches(category_str, req)`.
  • Resolver `_category_filter_for_query(q)` scans the rules top-down and
    returns the first whose `query_tokens` are a subset of the query's
    tokens — so longer / more-specific rules MUST be placed above shorter
    ones (e.g. "Toc Amortisseur" before "Amortisseur").
"""
import os
import sys
import unicodedata
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

sys.path.insert(0, "/app/backend")
import server  # noqa: E402


def _strip(s: str) -> str:
    n = unicodedata.normalize("NFKD", s or "")
    return "".join(c for c in n if not unicodedata.combining(c)).lower()


# ─── Resolver unit tests (21 sub-categories) ────────────────────────────────
# Each tuple: (search_query, expected_requirement)
RESOLVER_CASES = [
    ("Pompe à eau",               ["refroidissement", "moteur", "pompe", "eau"]),
    ("Radiateur eau",             ["refroidissement", "moteur", "radiateur", "eau"]),
    ("Joint culasse",             ["moteur", "culasse", "joint"]),
    ("Radiateur chauffage",       ["electrique", "chauffage", "radiateur"]),
    ("Filtre à huile",            ["filtration", "filtre", "huile"]),
    ("Filtre,carburant",          [["filtration", "filtre", "essence"],
                                   ["filtration", "filtre", "gasoil"]]),
    ("Filtre habitacle",          ["filtration", "filtre", "habitacle"]),
    ("Turbo",                     ["moteur", "echappement", "suralimentation", "turbo"]),
    ("Ventilateur",               ["refroidissement", "moteur", "ventilateur"]),
    ("Injecteur",                 ["moteur", "alimentation", "carburant", "injecteur"]),
    ("Cylindre récepteur embrayage",
                                  ["embrayage", "boite", "vitesse", "cylindre", "recepteur"]),
    ("Cylindre émetteur embrayage",
                                  ["embrayage", "boite", "vitesse", "cylindre", "emetteur"]),
    ("Butée de débrayage",        ["embrayage", "butee"]),
    ("Volant moteur",             ["embrayage", "volant", "moteur"]),
    ("Cable vitesse",             ["commande", "vitesse", "cable"]),
    ("Amortisseur",               ["suspension", "amortisseur"]),
    ("Rotule de suspension",      ["suspension", "essieu", "avant", "triangle"]),
    ("Silenbloc",                 [["suspension", "essieu", "arriere", "train", "silenbloc"],
                                   ["suspension", "essieu", "avant", "triangle", "silenbloc"]]),
    ("Moyeu de roue",             ["suspension", "essieu", "avant", "moyeu", "roue"]),
    ("Kit de roulements de roue", ["suspension", "essieu", "avant", "roulement", "roue"]),
    ("Toc Amortisseur",           ["suspension", "amortisseur", "toc"]),
]


@pytest.mark.parametrize("query,expected", RESOLVER_CASES,
                         ids=[c[0] for c in RESOLVER_CASES])
def test_resolver_returns_expected_requirement(query, expected):
    got = server._category_filter_for_query(query)
    assert got == expected, f"q={query!r}: expected {expected}, got {got}"


# ─── Specificity ordering — longer rules must win over shorter ones ─────────
class TestSpecificityOrdering:
    def test_toc_amortisseur_wins_over_amortisseur(self):
        # 2-token rule "toc amortisseur" must be picked, NOT the 1-token
        # "amortisseur" rule which would otherwise also match the query.
        got = server._category_filter_for_query("Toc Amortisseur")
        assert got == ["suspension", "amortisseur", "toc"], got
        # Sanity check: the bare 1-token rule still resolves correctly.
        assert server._category_filter_for_query("Amortisseur") == \
            ["suspension", "amortisseur"]

    def test_kit_roulements_roue_wins_over_generic(self):
        # 3-token plural rule "kit roulements roue" must take precedence
        # over any shorter rule whose tokens are also present.
        got = server._category_filter_for_query("Kit de roulements de roue")
        assert got == ["suspension", "essieu", "avant", "roulement", "roue"], got
        # Singular variant too
        got2 = server._category_filter_for_query("Kit de roulement de roue")
        assert got2 == ["suspension", "essieu", "avant", "roulement", "roue"], got2

    def test_rules_list_ordered_longest_first(self):
        """Module-level invariant: query_tokens lengths must be non-increasing
        (modulo equal-length groups) so that supersets are evaluated first."""
        lengths = [len(e["query_tokens"]) for e in server.SUBCATEGORY_CATEGORY_FILTERS]
        # Allow equal-length runs but no shorter rule before a longer one.
        for i in range(1, len(lengths)):
            assert lengths[i] <= lengths[i - 1], (
                f"rule #{i} ({server.SUBCATEGORY_CATEGORY_FILTERS[i]['query_tokens']}) "
                f"has more tokens than rule #{i-1} "
                f"({server.SUBCATEGORY_CATEGORY_FILTERS[i-1]['query_tokens']}) — "
                f"shorter rules must come AFTER longer ones."
            )


# ─── `_category_matches` matcher: flat-list AND vs list-of-lists OR ─────────
class TestCategoryMatcher:
    def test_or_of_and_filtre_carburant_essence_passes(self):
        req = [["filtration", "filtre", "essence"],
               ["filtration", "filtre", "gasoil"]]
        cat = "FILTRATION / FILTRE ESSENCE / FILTRES / FILTRE ESSENCE"
        assert server._category_matches(cat, req) is True

    def test_or_of_and_filtre_carburant_gasoil_passes(self):
        req = [["filtration", "filtre", "essence"],
               ["filtration", "filtre", "gasoil"]]
        cat = "FILTRATION / FILTRE GASOIL / FILTRES / FILTRE GASOIL"
        assert server._category_matches(cat, req) is True

    def test_or_of_and_unrelated_category_fails(self):
        req = [["filtration", "filtre", "essence"],
               ["filtration", "filtre", "gasoil"]]
        assert server._category_matches("MOTEUR / DISTRIBUTION", req) is False

    def test_or_of_and_empty_category_fails(self):
        req = [["filtration", "filtre", "essence"],
               ["filtration", "filtre", "gasoil"]]
        assert server._category_matches("", req) is False

    def test_flat_and_amortisseur_passes(self):
        req = ["suspension", "amortisseur"]
        cat = "SUSPENSION / AMORTISSEUR AVANT / AMORTISSEUR / AMORTISSEUR"
        assert server._category_matches(cat, req) is True

    def test_flat_and_unrelated_fails(self):
        req = ["suspension", "amortisseur"]
        assert server._category_matches("MOTEUR / EMBRAYAGE", req) is False

    def test_flat_and_empty_requirement_returns_true(self):
        # `_category_matches` returns True when the requirement is empty —
        # this mirrors `_designation_has_all_tokens([])`.
        assert server._category_matches("anything", []) is True

    def test_flat_and_accent_case_insensitive(self):
        # Verify the matcher is accent + case insensitive (uses _strip_accents).
        req = ["embrayage", "butee"]
        cat = "EMBRAYAGE / Butée De Débrayage / KIT"
        assert server._category_matches(cat, req) is True


# ─── HTTP integration tests — admin login & live OEM search ─────────────────
@pytest.fixture(scope="module")
def auth_headers():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "admin@bennouri.com", "password": "Admin@123"},
        timeout=30,
    )
    if r.status_code != 200:
        pytest.skip(f"login failed: {r.status_code} {r.text[:200]}")
    token = r.json().get("token") or r.json().get("access_token")
    return {"Authorization": f"Bearer {token}"} if token else {}


def _live_search(headers, query, split=True, timeout=180):
    params = {
        "model_id": 39023,
        "q": query,
        "lang_id": 6,
        "limit": 50,
        "split": "true" if split else "false",
        "vin": "VR7EF9HNAKJ575626",
        "vehicle_name": "CITROËN BERLINGO Box Body/MPV (K9)",
    }
    r = requests.get(
        f"{BASE_URL}/api/oem-stock-search",
        params=params, headers=headers, timeout=timeout,
    )
    assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
    return r.json()


def _assert_all_items_satisfy_flat(data, required, query_label):
    """Every item's `categorie` (accent/case-insensitive) must contain all
    tokens in `required`. Acceptable if count == 0 (vehicle has no parts in
    this sub-category)."""
    items = data.get("items", [])
    bad = []
    for it in items:
        cat = it.get("categorie") or ""
        norm = _strip(cat)
        if not all(t in norm for t in required):
            bad.append({"ref": it.get("ref"),
                        "designation": it.get("designation"),
                        "categorie": cat})
    sample = items[0].get("categorie") if items else None
    print(f"\n[iter9 LIVE] q={query_label!r} count={data.get('count')} "
          f"sample_categorie={sample!r} all_pass={not bad}")
    assert not bad, (
        f"{len(bad)} item(s) violate {required} for q={query_label!r} — "
        f"first 3: {bad[:3]}"
    )


def _assert_all_items_satisfy_or(data, groups, query_label):
    items = data.get("items", [])
    bad = []
    for it in items:
        cat = it.get("categorie") or ""
        norm = _strip(cat)
        if not any(all(t in norm for t in g) for g in groups):
            bad.append({"ref": it.get("ref"),
                        "designation": it.get("designation"),
                        "categorie": cat})
    sample = items[0].get("categorie") if items else None
    print(f"\n[iter9 LIVE] q={query_label!r} count={data.get('count')} "
          f"sample_categorie={sample!r} all_pass={not bad}")
    assert not bad, (
        f"{len(bad)} item(s) violate OR-of-AND {groups} for q={query_label!r}"
        f" — first 3: {bad[:3]}"
    )


class TestLiveSearchPerSubcategory:
    def test_pompe_a_eau(self, auth_headers):
        data = _live_search(auth_headers, "Pompe à eau")
        _assert_all_items_satisfy_flat(
            data, ["refroidissement", "moteur", "pompe", "eau"], "Pompe à eau")

    def test_filtre_huile(self, auth_headers):
        data = _live_search(auth_headers, "Filtre,huile")
        _assert_all_items_satisfy_flat(
            data, ["filtration", "filtre", "huile"], "Filtre,huile")

    def test_filtre_carburant_or_essence_gasoil(self, auth_headers):
        data = _live_search(auth_headers, "Filtre,carburant")
        _assert_all_items_satisfy_or(
            data,
            [["filtration", "filtre", "essence"],
             ["filtration", "filtre", "gasoil"]],
            "Filtre,carburant",
        )
        # Extra assertion from spec: no item may lack BOTH essence and gasoil
        for it in data.get("items", []):
            norm = _strip(it.get("categorie") or "")
            assert ("essence" in norm) or ("gasoil" in norm), (
                f"item {it.get('ref')} categorie={it.get('categorie')!r} "
                f"lacks both 'essence' and 'gasoil' tokens"
            )

    def test_amortisseur(self, auth_headers):
        data = _live_search(auth_headers, "Amortisseur")
        _assert_all_items_satisfy_flat(
            data, ["suspension", "amortisseur"], "Amortisseur")

    def test_toc_amortisseur_wins_over_amortisseur_live(self, auth_headers):
        data = _live_search(auth_headers, "Toc,Amortisseur")
        _assert_all_items_satisfy_flat(
            data, ["suspension", "amortisseur", "toc"], "Toc,Amortisseur")


# ─── Regression: iteration_8 behaviour + iter_6 caps intact ─────────────────
class TestRegression:
    def test_kit_chaine_distribution_live(self, auth_headers):
        data = _live_search(auth_headers, "Kit,chaine,distribution")
        assert data["count"] >= 1, f"expected ≥1 item; got {data['count']}"
        _assert_all_items_satisfy_flat(
            data, ["moteur", "distribution", "composants"],
            "Kit,chaine,distribution")

    def test_iter6_constants_intact(self):
        src = open("/app/backend/server.py").read()
        assert "PA_COMPAT_CAP = 50" in src
        assert "LOCKED_SUPPLIER_CAP = 60" in src
        assert "asyncio.wait_for(pa_fetch(ref), timeout=2.0)" in src
        assert "deadline = 40.0" in src
        assert "asyncio.as_completed(pending_tasks, timeout=deadline)" in src
        assert "Semaphore(60)" in src

    def test_iter6_variants_intact(self):
        src = open("/app/backend/server.py").read()
        assert "def oem_search_variants" in src
        assert "oem_search_variants(" in src
