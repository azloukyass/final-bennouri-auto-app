from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
import uuid
import bcrypt
import jwt
import httpx
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, BackgroundTasks, UploadFile, File
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr

from catalog_data import CATALOG, get_section, get_category, find_part, get_label_from_slug
from vehicles_catalog import get_catalog as get_vehicles_catalog, VEHICLES
from partsouq_scraper import scrape_vin as partsouq_scrape, scrape_subgroup_parts
from fadpro_client import (
    search_reference as fadpro_search,
    search_by_niv_levels as fadpro_niv_search,
    search_by_designation as fadpro_designation_search,
)
from iis_supplier_client import get_copia, get_partspro
from proad_client import search_reference as proad_search 
from email_service import send_welcome_email, send_order_confirmation, send_contact_to_admin, send_password_reset_email
from rapidapi_client import (
    vin_lookup as rapid_vin_lookup,
    search_oem as rapid_search_oem,
    list_vehicles_for_model as rapid_list_vehicles,
    find_article_by_oem as rapid_find_article_by_oem,
    article_complete_details as rapid_article_details,
)
import secrets


mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_ALGORITHM = "HS256"


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


app = FastAPI(title="BENNOURI Pièces Auto API")
api = APIRouter(prefix="/api")
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: Optional[str] = ""
    address: Optional[str] = ""


class LoginIn(BaseModel):
    email: EmailStr
    password: str

class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    token: str
    new_password: str


class VinIn(BaseModel):
    vin: str


class CartItem(BaseModel):
    ref: str
    quantity: int = 1
    # Optional external item info (e.g. FadPro / PartSouq parts not in internal catalog)
    source: Optional[str] = ""        # "fadpro", "partsouq", or "" for internal
    name: Optional[str] = ""
    brand: Optional[str] = ""
    image: Optional[str] = ""
    price_tnd: Optional[float] = None


class OrderIn(BaseModel):
    items: List[CartItem]
    vehicle_vin: Optional[str] = ""
    vehicle_label: Optional[str] = ""
    customer_name: Optional[str] = ""
    shipping_address: str
    city: Optional[str] = ""
    postal_code: Optional[str] = ""
    phone: str
    notes: Optional[str] = ""
    delivery_method: Optional[str] = "domicile"  # domicile | express | relais
    payment_method: Optional[str] = "cod"  # cod | card | transfer


class OrderStatusIn(BaseModel):
    status: str


class ContactIn(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = ""
    subject: str
    message: str


class ManualPartIn(BaseModel):
    section: str                 # z.B. "mecanique"
    category_path: List[str]     # slug-Pfad, z.B. ["moteur", "filtre-huile"]
    ref: str
    name: str
    brand: str = ""
    price_tnd: float
    image: str = ""
    reference_origine: str = ""       
    compatible_refs: List[str] = []
    stock: int = 25

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Connectez-vous pour accéder à la recherche de pièces auto.")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Token invalide")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Utilisateur introuvable")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expiré")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invalide")


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé à l'administrateur")
    return user


def set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=60 * 60 * 24 * 7,
        path="/",
    )


def user_to_dict(u: dict) -> dict:
    return {
        "id": u["id"],
        "name": u["name"],
        "email": u["email"],
        "phone": u.get("phone", ""),
        "address": u.get("address", ""),
        "role": u.get("role", "user"),
        "created_at": u["created_at"],
    }


@api.post("/auth/register")
async def register(data: RegisterIn, response: Response, background_tasks: BackgroundTasks):
    email = data.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "name": data.name.strip(),
        "email": email,
        "password_hash": hash_password(data.password),
        "phone": data.phone or "",
        "address": data.address or "",
        "role": "user",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    token = create_access_token(user_id, email)
    set_auth_cookie(response, token)
    # Welcome email (async, non-blocking)
    background_tasks.add_task(send_welcome_email, doc["name"], doc["email"])
    return {"user": user_to_dict(doc), "token": token}


@api.post("/auth/login")
async def login(data: LoginIn, response: Response):
    email = data.email.lower().strip()
    u = await db.users.find_one({"email": email})
    if not u or not verify_password(data.password, u["password_hash"]):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    token = create_access_token(u["id"], email)
    set_auth_cookie(response, token)
    return {"user": user_to_dict(u), "token": token}


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


RESET_TOKEN_TTL_MINUTES = 30


@api.post("/auth/forgot-password")
async def forgot_password(data: ForgotPasswordIn, background_tasks: BackgroundTasks):
    email = data.email.lower().strip()
    user = await db.users.find_one({"email": email})
    # Bewusst IMMER "ok" zurückgeben, egal ob der Account existiert —
    # sonst könnten Angreifer per Trial-and-Error herausfinden, welche
    # Emails registriert sind (User-Enumeration).
    if not user:
        return {"ok": True}

    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_TTL_MINUTES)

    await db.password_resets.insert_one({
        "token": token,
        "user_id": user["id"],
        "email": email,
        "expires_at": expires_at,
        "used": False,
        "created_at": datetime.now(timezone.utc),
    })

    background_tasks.add_task(send_password_reset_email, user["name"], email, token)
    return {"ok": True}


@api.post("/auth/reset-password")
async def reset_password(data: ResetPasswordIn):
    if len(data.new_password) < 6:
        raise HTTPException(400, "Le mot de passe doit contenir au moins 6 caractères")

    reset_doc = await db.password_resets.find_one({"token": data.token, "used": False})
    if not reset_doc:
        raise HTTPException(400, "Lien de réinitialisation invalide ou déjà utilisé")

    expires_at = reset_doc["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(400, "Ce lien de réinitialisation a expiré. Veuillez en demander un nouveau.")

    await db.users.update_one(
        {"id": reset_doc["user_id"]},
        {"$set": {"password_hash": hash_password(data.new_password)}},
    )
    await db.password_resets.update_one({"token": data.token}, {"$set": {"used": True}})
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {"user": user_to_dict(user)}


@api.get("/catalog/sections")
async def list_sections():
    return [
        {
            "slug": s,
            "label": data["label"],
            "description": data["description"],
            "icon": data["icon"],
        }
        for s, data in CATALOG.items()
    ]


@api.get("/catalog/{section}")
async def get_section_api(section: str):
    data = get_section(section)
    if not data:
        raise HTTPException(404, "Section introuvable")
    return {
        "slug": section,
        "label": data["label"],
        "description": data["description"],
        "categories": [
            {
                "slug": c["slug"],
                "label": c["label"],
                "image": c.get("image"),
                "children": c.get("children", []),
                "sub_items": [child["label"] for child in c.get("children", [])],
                "count": len(c.get("parts", [])),
            }
            for c in data["categories"]
        ],
    }

@api.get("/catalog-tree/{section}/{path:path}")
async def get_catalog_node(section: str, path: str):
    """Walk the catalog tree by slug path (slash-separated).
    Returns the node {slug, label, children, parts, breadcrumb} at the given path.
    """
    sec = get_section(section)
    if not sec:
        raise HTTPException(404, "Section introuvable")
    slugs = [s for s in (path or "").split("/") if s]
    if not slugs:
        raise HTTPException(400, "Chemin de catégorie manquant")

    # 1st level — categories
    node = next((c for c in sec["categories"] if c["slug"] == slugs[0]), None)
    if not node:
        raise HTTPException(404, "Catégorie introuvable")
    breadcrumb = [{"slug": node["slug"], "label": node["label"]}]

    # Descend into children
    for slug in slugs[1:]:
        children = node.get("children", [])
        next_node = next((ch for ch in children if ch["slug"] == slug), None)
        if not next_node:
            raise HTTPException(404, f"Sous-catégorie '{slug}' introuvable")
        breadcrumb.append({"slug": next_node["slug"], "label": next_node["label"]})
        node = next_node

    # Helper: serialize the children list while preserving the search hints
    # (search_keyword + split_keywords). The frontend needs these to build the
    # correct OEM-search URL for each leaf.
    def _ser_child(c):
        return {
            "slug": c.get("slug"),
            "label": c.get("label"),
            "image": c.get("image"),
            "children": [_ser_child(g) for g in (c.get("children") or [])],
            "search_keyword": c.get("search_keyword"),
            "split_keywords": bool(c.get("split_keywords")),
        }
    
    manual_items = await db.manual_parts.find(
        {"section": section, "category_path": slugs}, {"_id": 0}
        ).to_list(200)
    return {
        "section": section,
        "slug": node["slug"],
        "label": node["label"],
        "image": node.get("image"),
        "children": [_ser_child(c) for c in (node.get("children") or [])],
        "parts": node.get("parts", []) + manual_items,
        "breadcrumb": breadcrumb,
        "search_keyword": node.get("search_keyword"),
        "split_keywords": bool(node.get("split_keywords")),
    }


@api.get("/catalog/{section}/{category}")
async def get_category_api(section: str, category: str):
    cat = get_category(section, category)
    if not cat:
        raise HTTPException(404, "Catégorie introuvable")
    return cat


@api.get("/catalog-search")
async def search_parts(q: str = ""):
    query = (q or "").strip().lower()
    if not query:
        return []
    results = []
    for section_slug, section in CATALOG.items():
        for cat in section["categories"]:
            for part in cat["parts"]:
                if (
                    query in part["ref"].lower()
                    or query in part["name"].lower()
                    or query in part["brand"].lower()
                ):
                    results.append({
                        **part,
                        "section": section_slug,
                        "section_label": section["label"],
                        "category": cat["slug"],
                        "category_label": cat["label"],
                    })
                if len(results) >= 60:
                    return results
    return results


_VIN_FALLBACK = {
    "WVWZZZ1KZ8W123456": {"make": "Volkswagen", "model": "Golf 5", "year": "2008", "fuel": "Essence", "engine": "1.6 FSI", "trim": "Trendline"},
    "WAUZZZ8K9CA123456": {"make": "Audi", "model": "A4 B8", "year": "2012", "fuel": "Diesel", "engine": "2.0 TDI", "trim": "Avant"},
    "WDD2042001A123456": {"make": "Mercedes-Benz", "model": "Classe C W204", "year": "2010", "fuel": "Diesel", "engine": "C220 CDI", "trim": "Avantgarde"},
    "VF7XXXXXXXXX12345": {"make": "Peugeot", "model": "208", "year": "2015", "fuel": "Essence", "engine": "1.2 PureTech", "trim": "Active"},
}


def _translate_fuel(fuel: str) -> str:
    f = (fuel or "").lower()
    if "diesel" in f:
        return "Diesel"
    if "gasoline" in f or "petrol" in f:
        return "Essence"
    if "electric" in f:
        return "Électrique"
    if "hybrid" in f:
        return "Hybride"
    if "gas" in f or "lpg" in f:
        return "GPL"
    return fuel or "Essence"


def _fuel_category_from_engine(engine_name: str) -> str:
    """Categorize a TecDoc `typeEngineName` into a fuel-type bucket, used to
    group vehicle variants for the manual engine-picker dropdown (replaces
    the unreliable vin-decoder-mega auto-matching)."""
    e = (engine_name or "").upper()
    if "LPG" in e or "GPL" in e:
        return "GPL"
    if any(k in e for k in ["EV", "E-TECH", "EQ", "E-208", "E-2008", "ZOE", "IONIQ EV"]):
        return "Électrique"
    if any(k in e for k in ["HYBRID", "HEV", "PHEV", "E-POWER", "HYBRIDE"]):
        return "Hybride"
    if any(k in e for k in [
        "CRDI", "TDI", "HDI", "DCI", "CDI", "D4D", "DTI", "JTD",
        "BLUEHDI", "MULTIJET", "DIESEL", "DTP", "DDIS",
    ]):
        return "Diesel"
    return "Essence"

import asyncio
import re as _re


def _strip_accents(s: str) -> str:
    """Lowercase + strip diacritics for accent-insensitive comparison."""
    if not s:
        return ""
    import unicodedata
    n = unicodedata.normalize("NFKD", s)
    return "".join(c for c in n if not unicodedata.combining(c)).lower()


_DESIG_TOKEN_RE = _re.compile(r"[a-z0-9]{3,}")


def _designation_query_tokens(q: str) -> List[str]:
    """Tokenise the search query for the sub-category designation filter.

    Returns ≥3-char alphanumeric tokens, accent-stripped and lowercased.
    Splits on whitespace, commas and dashes so 'Kit,chaine,distribution',
    'kit chaine distribution' and 'kit-chaine' all yield equivalent token
    lists.
    """
    if not q:
        return []
    norm = _strip_accents(q.replace(",", " ").replace("-", " "))
    toks = _DESIG_TOKEN_RE.findall(norm)
    seen, out = set(), []
    for t in toks:
        if t not in seen:
            seen.add(t)
            out.append(t)
    return out


def _designation_has_all_tokens(desig: str, toks: List[str]) -> bool:
    """True iff every query token appears as a substring of the
    accent-stripped lowercased designation."""
    if not toks:
        return True
    norm = _strip_accents(desig)
    return all(t in norm for t in toks)

def _designation_has_any_token(desig: str, toks: List[str]) -> bool:
    """True iff AT LEAST ONE label-word appears as substring in the
    accent-stripped lowercased designation. Nur relevant für den Fallback
    bei leerer `categorie`."""
    if not toks:
        return True
    norm = _strip_accents(desig)
    return any(t in norm for t in toks)    

def _vehicle_compat_matches(compat_list: list, manufacturer_name: str, engine_name: str) -> bool:
    """True iff at least one entry in `compat_list` (from
    get_compatible_cars_by_article_number) matches BOTH the manufacturer
    name (loose substring, accent/case-insensitive) and the engine name
    (every significant engine token from the searched vehicle must appear
    in the compatible entry's typeEngineName)."""
    if not compat_list:
        return False
    manu_norm = _strip_accents(manufacturer_name or "")
    engine_toks = _designation_query_tokens(engine_name or "")
    if not manu_norm and not engine_toks:
        return False
    for entry in compat_list:
        entry_manu = _strip_accents(entry.get("manufacturerName") or "")
        entry_engine = entry.get("typeEngineName") or ""
        manu_ok = (not manu_norm) or (manu_norm in entry_manu or entry_manu in manu_norm)
        engine_ok = (not engine_toks) or _designation_has_all_tokens(entry_engine, engine_toks)
        if manu_ok and engine_ok:
            return True
    return False


def _category_matches(category_str: str, requirement) -> bool:
    """Check whether `category_str` satisfies a category requirement.

    `requirement` may be either:
      • a flat list of tokens — AND semantics (every token must appear)
      • a list-of-lists — OR over AND-groups (at least one inner group
        must be fully present). Used when a sub-category lives under two
        different category paths (e.g. "Filtre carburant" → "essence" OR
        "gasoil"; "Silentbloc" → "essieu arrière" OR "essieu avant").
    """
    if not requirement:
        return True
    if isinstance(requirement[0], list):
        return any(_designation_has_all_tokens(category_str, group) for group in requirement)
    return _designation_has_all_tokens(category_str, requirement)


# ── Sub-category → required category-path tokens ─────────────────────
# When the search query (after tokenisation & dedup) is a SUPERSET of
# `query_tokens`, every returned item's `categorie` field (built from the
# supplier as "niv1 / niv2 / niv3 / niv4") MUST satisfy the
# `required_category_tokens` requirement (case-insensitive, accent-
# insensitive). Items whose `categorie` is empty or fails the check are
# dropped.
#
# `required_category_tokens` can be either:
#   • a flat list of strings (AND — every token must appear in the path)
#   • a list of lists (OR over AND-groups — at least one inner list must
#     be fully present; used when a sub-category has two valid paths)
#
# The list is scanned top-down; the FIRST entry whose query_tokens are a
# subset of the search query wins. Always place more-specific rules
# (longer `query_tokens`) ABOVE generic ones to avoid shadowing.
SUBCATEGORY_CATEGORY_FILTERS: List[dict] = [
    # ── 4-token rules ────────────────────────────────────────────────
    {"query_tokens": ["kit", "reparation", "coupelle", "suspension"],
     "required_category_tokens": ["suspension", "amortisseur", "avant"]},
      {"query_tokens": ["kit", "plaquettes", "frein", "disque"],
     "required_category_tokens": [
         ["freinage", "frein", "arriere", "plaquette"],
         ["freinage", "frein", "avant", "plaquette"],
     ]},
    # ── 3-token rules ────────────────────────────────────────────────
    {"query_tokens": ["kit", "chaine", "distribution"],
     "required_category_tokens": ["moteur", "distribution", "composants"]},
    {"query_tokens": ["kit", "roulement", "roue"],
     "required_category_tokens": ["suspension", "essieu", "avant", "roulement", "roue"]},
    {"query_tokens": ["kit", "roulements", "roue"],   # plural variant
     "required_category_tokens": ["suspension", "essieu", "avant", "roulement", "roue"]},
    {"query_tokens": ["cylindre", "recepteur", "embrayage"],
     "required_category_tokens": ["embrayage", "boite", "vitesse", "cylindre", "recepteur"]},
    {"query_tokens": ["cylindre", "emetteur", "embrayage"],
     "required_category_tokens": ["embrayage", "boite", "vitesse", "cylindre", "emetteur"]},
    # ── 2-token rules ────────────────────────────────────────────────
    {"query_tokens": ["kit", "chaine"],
     "required_category_tokens": ["moteur", "distribution", "composants"]},
    {"query_tokens": ["chaine", "distribution"],
     "required_category_tokens": ["moteur", "distribution", "composants"]},
    {"query_tokens": ["pompe", "eau"],
     "required_category_tokens": ["refroidissement", "moteur", "pompe", "eau"]},
    {"query_tokens": ["radiateur", "eau"],
     "required_category_tokens": ["refroidissement", "moteur", "radiateur", "eau"]},
    {"query_tokens": ["systeme", "chauffage"],
     "required_category_tokens": ["electrique", "chauffage", "climatisation", "radiateur"]},
    {"query_tokens": ["radiateur", "chauffage"],
     "required_category_tokens": ["electrique", "chauffage", "climatisation", "radiateur"]},
    {"query_tokens": ["joint", "culasse"],
     "required_category_tokens": ["moteur", "culasse", "joint"]},
    {"query_tokens": ["filtre", "huile"],
     "required_category_tokens": ["filtration", "filtre", "huile"]},
    {"query_tokens": ["filtre", "habitacle"],
     "required_category_tokens": ["filtration", "filtre", "habitacle"]},
    {"query_tokens": ["filtre", "carburant"],
     "required_category_tokens": [
         ["filtration", "filtre", "essence"],
         ["filtration", "filtre", "gasoil"],
     ]},
    {"query_tokens": ["butee", "debrayage"],
     "required_category_tokens": ["embrayage", "butee"]},
    {"query_tokens": ["volant", "moteur"],
     "required_category_tokens": ["embrayage", "volant", "moteur"]},
      {"query_tokens": ["kit", "embrayage"],
     "required_category_tokens": ["embrayage", "boite", "vitesse"]},
        {"query_tokens": ["support", "moteur"],
     "required_category_tokens": ["moteur", "support", "fixation"]},
    {"query_tokens": ["cable", "vitesse"],
     "required_category_tokens": ["commande", "vitesse", "cable"]},
     {"query_tokens": ["disque", "frein"],
     "required_category_tokens": [
         ["freinage", "frein", "avant", "disque"],
         ["freinage", "frein", "arriere", "disque"],
     ]},
    {"query_tokens": ["etrier", "frein"],
     "required_category_tokens": [
         ["freinage", "frein", "arriere", "etrier"],
         ["freinage", "frein", "avant", "etrier"],
     ]},
    {"query_tokens": ["cylindre", "roue"],
     "required_category_tokens": ["freinage", "frein", "arriere", "cylindre", "roue"]},
    {"query_tokens": ["rotule", "suspension"],
     "required_category_tokens": ["suspension", "essieu", "avant", "triangle"]},
         {"query_tokens": ["suspension", "bras", "liaison"],
     "required_category_tokens": [
         ["suspension", "essieu", "arriere"],
         ["suspension", "essieu", "avant", "triangle"],
     ]},
      {"query_tokens": ["jeu", "bras", "suspension", "roue"],
     "required_category_tokens": [
         ["suspension", "essieu", "arriere"],
         ["suspension", "essieu", "avant", "triangle"],
     ]},
    {"query_tokens": ["moyeu", "roue"],
     "required_category_tokens": ["suspension", "essieu", "avant", "moyeu", "roue"]},
    {"query_tokens": ["toc", "amortisseur"],
     "required_category_tokens": ["suspension", "amortisseur", "toc"]},
    # ── 1-token rules (placed LAST so longer rules win first) ────────
    {"query_tokens": ["turbocompresseur"],
     "required_category_tokens": ["moteur", "echappement", "suralimentation", "turbo", "turbine"]},
    {"query_tokens": ["ventilateur"],
     "required_category_tokens": ["refroidissement", "moteur", "ventilateur"]},
    {"query_tokens": ["injecteur"],
     "required_category_tokens": ["moteur", "alimentation", "carburant", "injecteur"]},
    {"query_tokens": ["amortisseur"],
     "required_category_tokens": ["suspension", "amortisseur"]},
    {"query_tokens": ["silenbloc"],
     "required_category_tokens": [
         ["suspension", "essieu", "arriere", "train", "silenbloc"],
         ["suspension", "essieu", "avant", "triangle", "silenbloc"],
     ]},
    {"query_tokens": ["silentbloc"],  # alternative spelling
     "required_category_tokens": [
         ["suspension", "essieu", "arriere", "train", "silenbloc"],
         ["suspension", "essieu", "avant", "triangle", "silenbloc"],
     ]},

      {"query_tokens": ["silentbloc"],  # alternative spelling
     "required_category_tokens": [
         ["suspension", "essieu", "arriere", "train", "silenbloc"],
         ["suspension", "essieu", "avant", "triangle", "silenbloc"],
     ]},

      # ── Carrosserie ──────────────────────────────────────────────────
    {"query_tokens": ["aile", "avant"],
     "required_category_tokens": ["carrosserie", "partie", "avant", "aile"]},

    {"query_tokens": ["grille", "centrale"],
     "required_category_tokens": ["carrosserie", "partie", "avant", "pare-choc", "grille"]},
    {"query_tokens": ["grille", "pare-choc"],          # variante spelling
     "required_category_tokens": ["carrosserie", "partie", "avant", "pare-choc", "grille"]},

    {"query_tokens": ["cache", "moteur"],
     "required_category_tokens": ["carrosserie", "partie", "avant", "pare-choc", "cache", "moteur"]},

    {"query_tokens": ["retroviseur"],
     "required_category_tokens": ["carrosserie", "porte", "accessoires", "retroviseur"]},

     {"query_tokens": ["pare", "choc"],
     "required_category_tokens": [["carrosserie", "partie", "arriere", "pare-choc"], ["carrosserie", "partie", "avant", "pare-choc"]]},

      {"query_tokens": ["capot", "moteur"],
     "required_category_tokens": [["carrosserie", "partie", "avant", "capot", "moteur"]]},

     {"query_tokens": ["revetement", "avant"],
     "required_category_tokens": ["carrosserie", "partie", "avant", "plage"]},

    # ── Éclairage / Électrique ────────────────────────────────────────
    {"query_tokens": ["feu", "position"],
     "required_category_tokens": ["electrique", "eclairage", "signalisation", "phare"]},

    {"query_tokens": ["batterie"],
     "required_category_tokens": ["electrique", "demarreur", "batterie"]},

    {"query_tokens": ["bouton", "lave", "vitre"],
     "required_category_tokens": ["electrique", "interrupteur", "leve", "vitre"]},
    {"query_tokens": ["leve", "vitre"],                # variante courte
     "required_category_tokens": ["electrique", "interrupteur", "leve", "vitre"]},
    # ── To add a NEW sub-category: copy any block above and edit. ────
]


def _category_filter_for_query(q: str) -> Optional[list]:
    """Return the requirement (flat list OR list-of-lists) for query `q`,
    or None when no entry in `SUBCATEGORY_CATEGORY_FILTERS` matches."""
    q_set = set(_designation_query_tokens(q))
    if not q_set:
        return None
    for entry in SUBCATEGORY_CATEGORY_FILTERS:
        if set(entry["query_tokens"]).issubset(q_set):
            return entry["required_category_tokens"]
    return None



def oem_search_variants(ref: str) -> List[str]:
    """Generate ordered partner-search variants for a TecDoc OEM reference.

    Suppliers (FadPro/Copia/PartsPro) often store the same article under a
    shorter / un-suffixed / non-zero-padded code than what TecDoc returns:

        TecDoc            → Partner DB
        1608745980        → 160874         (first 6 of a 10-digit PSA code)
        1610577780KIT     → 1610577780     (strip "KIT" suffix)
        083075            → 83075          (strip leading zero)
        83075             → 083075         (add leading zero for short refs)

    Capped at MAX 3 variants total — beyond that the partner calls (Copia /
    PartsPro hold a per-supplier lock that serialises every concurrent
    lookup) blow past Cloudflare's 100 s gateway limit. Order of priority:
    original → suffix-stripped → first-6-digit prefix → zero-padding tweak.
    Duplicates removed while preserving order.
    """
    ref = (ref or "").strip()
    if not ref:
        return []
    out = [ref]
    # 1) strip common pack/suffix markers (KIT, _S, _F, _XS, etc.)
    base = _re.sub(r"(KIT|_S|_F|_XS)$", "", ref, flags=_re.IGNORECASE)
    if base and base != ref:
        out.append(base)
    # 2) numeric-only fallbacks (PSA / Renault style refs)
    if base.isdigit():
        if len(base) >= 7:
            out.append(base[:6])
        stripped = base.lstrip("0")
        if stripped and stripped != base:
            out.append(stripped)
        elif 5 <= len(base) <= 6 and not base.startswith("0"):
            out.append("0" + base)
    # dedupe preserving order + hard cap at 3 variants
    seen, dedup = set(), []
    for v in out:
        if v and v not in seen:
            seen.add(v)
            dedup.append(v)
        if len(dedup) >= 3:
            break
    return dedup


async def _partsouq_background_scrape(vin: str):
    """Scrape PartSouq in background and save to cache for next request."""
    try:
        ps = await partsouq_scrape(vin)
        if ps and ps.get("make"):
            doc = {
                "vin": vin,
                "make": ps["make"],
                "model": ps["model"],
                "year": ps["year"],
                "fuel": "—",
                "engine": "—",
                "trim": "—",
                "source": "partsouq",
                "partsouq_title": ps.get("title", ""),
                "partsouq_tree": ps.get("tree", []),
                "partsouq_categories": ps.get("categories", []),
                "cached_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.partsouq_cache.update_one(
                {"vin": vin}, {"$set": doc}, upsert=True
            )
            logging.info(f"PartSouq cached for VIN {vin}")
    except Exception as e:
        logging.warning(f"PartSouq background fail for {vin}: {e}")


@api.post("/vin/decode")
async def decode_vin(payload: VinIn):
    vin = (payload.vin or "").strip().upper()
    if len(vin) < 11 or len(vin) > 17:
        raise HTTPException(400, "Le numéro VIN doit contenir entre 11 et 17 caractères")

    # 0. Try PartSouq cache (MongoDB) — instant if previously scraped
    cached = await db.partsouq_cache.find_one({"vin": vin}, {"_id": 0, "cached_at": 0})
    if cached:
        return {**cached, "source": "partsouq-cache"}

    info = None

    # 1. Try RapidAPI TecDoc first (fast & accurate for all brands)
    try:
        td = await rapid_vin_lookup(vin)
        if td and td.get("manu_name"):
            info = {
                "make": td.get("manu_name") or "",
                "model": td.get("model_name") or "",
                "year": "—",
                "fuel": "—",
                "engine": "—",
                "trim": "—",
                "tecdoc_model_id": td.get("model_id"),
                "source": "tecdoc",
            }
    except Exception as e:
        logging.warning(f"RapidAPI TecDoc fail: {e}")

    # 1b. Try AutoDev API as fallback (if no TecDoc match)
    autodev_key = os.environ.get("AUTODEV_API_KEY")
    if not info and autodev_key:
        try:
            async with httpx.AsyncClient(timeout=6.0) as cl:
                r = await cl.get(f"https://auto.dev/api/vin/{vin}?apikey={autodev_key}")
                if r.status_code == 200:
                    d = r.json()
                    if d.get("status") != "NOT_FOUND":
                        make = (d.get("make") or {}).get("name", "") if isinstance(d.get("make"), dict) else ""
                        model = (d.get("model") or {}).get("name", "") if isinstance(d.get("model"), dict) else ""
                        years_list = d.get("years") or []
                        year = ""
                        engine_name = ""
                        trim = ""
                        if years_list:
                            year_obj = years_list[0]
                            year = str(year_obj.get("year") or "")
                            styles = year_obj.get("styles") or []
                            if styles:
                                engine_name = styles[0].get("name") or ""
                                trim = styles[0].get("trim") or ""
                        fuel = "Essence"
                        engine_obj = d.get("engine") or {}
                        if isinstance(engine_obj, dict):
                            ft = engine_obj.get("fuelType") or engine_obj.get("type") or ""
                            fuel = _translate_fuel(ft) if ft else "Essence"
                        if make and model:
                            info = {
                                "make": make,
                                "model": model,
                                "year": year,
                                "fuel": fuel,
                                "engine": engine_name or "—",
                                "trim": trim or "—",
                                "source": "autodev",
                            }
        except Exception as e:
            logging.warning(f"AutoDev fail: {e}")

    # 2. Trigger PartSouq scraping in background (non-blocking)
    # Result will be available on next request via cache
    if os.environ.get("SCRAPINGBEE_API_KEY"):
        asyncio.create_task(_partsouq_background_scrape(vin))

    # 2. Fallback to NHTSA (free US-centric)
    if not info:
        try:
            async with httpx.AsyncClient(timeout=8.0) as cl:
                r = await cl.get(
                    f"https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/{vin}?format=json"
                )
                if r.status_code == 200:
                    data = r.json().get("Results", [{}])[0]
                    make = (data.get("Make") or "").strip()
                    model = (data.get("Model") or "").strip()
                    year = (data.get("ModelYear") or "").strip()
                    fuel = (data.get("FuelTypePrimary") or "").strip() or "Essence"
                    engine = (data.get("EngineModel") or data.get("DisplacementL") or "").strip()
                    if make and model:
                        info = {
                            "make": make.title(),
                            "model": model,
                            "year": year,
                            "fuel": _translate_fuel(fuel),
                            "engine": engine or "—",
                            "trim": (data.get("Trim") or "—"),
                            "source": "nhtsa",
                        }
        except Exception as e:
            logging.warning(f"NHTSA fail: {e}")

    # 3. Static fallback
    if not info:
        info = _VIN_FALLBACK.get(vin)
        if info:
            info["source"] = "fallback"

    # 4. WMI-based guess
    if not info:
        wmi = vin[:3]
        guess = {
            "WVW": ("Volkswagen", "Golf", "Essence"),
            "WAU": ("Audi", "A3", "Diesel"),
            "WDD": ("Mercedes-Benz", "Classe C", "Diesel"),
            "WDB": ("Mercedes-Benz", "Classe E", "Diesel"),
            "VF7": ("Citroën", "C3", "Essence"),
            "VF1": ("Renault", "Clio", "Essence"),
            "VF3": ("Peugeot", "208", "Essence"),
            "WBA": ("BMW", "Série 3", "Essence"),
            "JTD": ("Toyota", "Corolla", "Essence"),
            "KMH": ("Hyundai", "i20", "Essence"),
        }.get(wmi)
        if guess:
            info = {
                "make": guess[0], "model": guess[1], "year": "2015",
                "fuel": guess[2], "engine": "—", "trim": "—", "source": "wmi-guess",
            }
        else:
            raise HTTPException(404, "Impossible d'identifier ce VIN. Vérifiez le numéro et réessayez.")

    return {"vin": vin, **info}


@api.get("/vin/partsouq-status/{vin}")
async def partsouq_status(vin: str):
    """Check if PartSouq scraping is complete for a VIN."""
    vin = vin.strip().upper()
    cached = await db.partsouq_cache.find_one({"vin": vin}, {"_id": 0, "cached_at": 0})
    if cached:
        return {"ready": True, **cached, "source": "partsouq-cache"}
    return {"ready": False, "vin": vin}


class SubgroupIn(BaseModel):
    vin: str
    cid: str
    url: str
    label: Optional[str] = ""


@api.post("/partsouq/subgroup")
async def partsouq_subgroup(payload: SubgroupIn):
    """Fetch all OEM parts for a given subgroup (lazy on-demand, cached by vin+cid)."""
    vin = (payload.vin or "").strip().upper()
    cid = (payload.cid or "").strip()
    url = (payload.url or "").strip()
    if not vin or not cid or not url:
        raise HTTPException(400, "vin, cid et url sont obligatoires")

    cache_key = {"vin": vin, "cid": cid}
    cached = await db.partsouq_subgroups.find_one(cache_key, {"_id": 0, "cached_at": 0})
    if cached:
        return {**cached, "source": "cache"}

    if not os.environ.get("SCRAPINGBEE_API_KEY"):
        raise HTTPException(503, "Service de scraping indisponible")

    try:
        result = await scrape_subgroup_parts(url)
    except Exception as e:
        logging.warning(f"Subgroup scrape error vin={vin} cid={cid}: {e}")
        raise HTTPException(502, "Échec de la récupération depuis PartSouq")

    if not result:
        raise HTTPException(502, "Aucune donnée renvoyée par PartSouq")

    doc = {
        "vin": vin,
        "cid": cid,
        "label": payload.label or result.get("schema_label", ""),
        "schema_label": result.get("schema_label", ""),
        "schema_url": result.get("schema_url", ""),
        "diagram_url": result.get("diagram_url", ""),
        "parts": result.get("parts", []),
        "parts_count": result.get("parts_count", len(result.get("parts", []))),
        "cached_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.partsouq_subgroups.update_one(cache_key, {"$set": doc}, upsert=True)
    return {**doc, "source": "fresh"}


@api.get("/partsouq/subgroup/{vin}/{cid}")
async def partsouq_subgroup_cached(vin: str, cid: str):
    """Read-only lookup of a cached subgroup."""
    vin = vin.strip().upper()
    cached = await db.partsouq_subgroups.find_one(
        {"vin": vin, "cid": cid}, {"_id": 0, "cached_at": 0}
    )
    if not cached:
        raise HTTPException(404, "Sous-catégorie non disponible (lancez d'abord la récupération)")
    return cached


@api.get("/rapidapi/vin/{vin}")
async def rapidapi_vin(vin: str):
    """Resolve VIN via RapidAPI TecDoc — cached by VIN in MongoDB.
    Returns {vin, manu_id, manu_name, model_id, model_name}."""
    vin = vin.strip().upper()
    cached = await db.tecdoc_vehicles.find_one({"vin": vin}, {"_id": 0})
    if cached:
        return {**cached, "source": "cache"}
    info = await rapid_vin_lookup(vin)
    if not info:
        raise HTTPException(404, "Aucun véhicule trouvé pour ce VIN dans la base TecDoc")
    doc = {**info, "cached_at": datetime.now(timezone.utc).isoformat()}
    await db.tecdoc_vehicles.update_one({"vin": vin}, {"$set": doc}, upsert=True)
    return {**info, "source": "fresh"}

@api.get("/vehicles/variants/{model_id}")
async def vehicle_variants(model_id: int, lang_id: int = 6):
    """List all TecDoc vehicle-id variants for a modelId, grouped by fuel
    type (Essence / Diesel / Hybride / GPL / Électrique). Always queries
    TecDoc in French (lang_id=6). Used by the frontend to let the user
    manually pick their exact engine."""
    vehicles = await rapid_list_vehicles(model_id, 6)
    return {
        "model_id": model_id,
        "vehicles": vehicles,
        "debug": {
            "count": len(vehicles),
        }
    }    
    if not vehicles:
        raise HTTPException(404, f"Aucune variante trouvée pour modelId={model_id} (lang_id=6)")

    grouped: dict = {}
    for v in vehicles:
        vid = v.get("vehicleId")
        if not vid:
            continue
        engine = v.get("typeEngineName") or "—"
        fuel = _fuel_category_from_engine(engine)
        grouped.setdefault(fuel, []).append({
            "vehicle_id": vid,
            "engine_name": engine,
            "manufacturer_name": v.get("manufacturerName") or "",
            "model_name": v.get("modelName") or "",
        })

    # Deduplicate identical engine_name entries within the same fuel group
    # (TecDoc sometimes lists the same engine twice under different
    # vehicleIds for minor trim/body variants).
    for fuel, variants in grouped.items():
        seen = set()
        deduped = []
        for it in variants:
            key = it["engine_name"]
            if key in seen:
                continue
            seen.add(key)
            deduped.append(it)
        grouped[fuel] = deduped

    order = ["Essence", "Diesel", "Hybride", "GPL", "Électrique"]
    fuels = [f for f in order if f in grouped] + [f for f in grouped if f not in order]

    return {
        "model_id": model_id,
        "fuels": [{"fuel": f, "variants": grouped[f]} for f in fuels],
    }


@api.get("/debug/rapidapi-vehicles/{model_id}")
async def debug_rapidapi_vehicles(model_id: int, lang_id: int = 6, country_filter_id: int = 63):
    """Temporary debug endpoint: calls RapidAPI list-vehicles-id directly
    and returns the raw status + body, so we can diagnose from the browser
    without server log access. Remove once the issue is fixed."""
    import httpx as _httpx
    from rapidapi_client import API_BASE, TYPE_ID, _headers, _api_key

    url = (
        f"{API_BASE}/types/type-id/{TYPE_ID}/list-vehicles-id/{model_id}"
        f"/lang-id/{lang_id}/country-filter-id/{country_filter_id}"
    )
    key_tail = "MISSING"
    try:
        key_tail = _api_key()[-6:]
    except Exception as e:
        key_tail = f"ERROR: {e}"

    try:
        async with _httpx.AsyncClient(timeout=30.0) as cl:
            r = await cl.get(url, headers=_headers())
            return {
                "url": url,
                "key_tail": key_tail,
                "status_code": r.status_code,
                "body": r.text[:2000],
            }
    except Exception as e:
        return {
            "url": url,
            "key_tail": key_tail,
            "exception": str(e),
        }    

@api.get("/rapidapi/article-info")
async def rapidapi_article_info(ref: str, lang_id: int = 6, country_filter_id: int = 63):
    """Two-step TecDoc lookup → full article details for a given OEM reference.
    Cached per (ref-normalised, lang_id, country_filter_id) in MongoDB."""
    ref = (ref or "").strip()
    if not ref:
        raise HTTPException(400, "Référence OEM requise")

    cache_key = {"ref": ref.upper(), "lang_id": lang_id, "country_filter_id": country_filter_id}
    cached = await db.tecdoc_article_cache.find_one(cache_key, {"_id": 0, "cached_at": 0})
    if cached and cached.get("article"):
        return {**cached, "source": "cache"}

    first = await rapid_find_article_by_oem(ref, lang_id=lang_id)
    if not first:
        raise HTTPException(404, f"Aucun article TecDoc trouvé pour la référence {ref}")
    article_id = first.get("articleId")
    if not article_id:
        raise HTTPException(404, f"Article sans ID pour {ref}")

    details = await rapid_article_details(
        article_id, type_id=1, lang_id=lang_id, country_filter_id=country_filter_id,
    )
    if not details:
        # Fall back to the summary we already have
        details = first

    doc = {
        **cache_key,
        "article_id": article_id,
        "article": details,
        "summary": first,
        "cached_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.tecdoc_article_cache.update_one(cache_key, {"$set": doc}, upsert=True)
    return {**doc, "source": "fresh"}


@api.get("/rapidapi/oem-search")
async def rapidapi_oem_search(model_id: int, q: str, lang_id: int = 6):
    """Search OEM parts for a given modelId (TecDoc vehicleId).
    `q` is the free-text search-param (e.g. 'frein', 'pompe à eau', 'filtre').
    Cached per (model_id, lang_id, q-normalised)."""
    query = (q or "").strip()
    if len(query) < 2:
        raise HTTPException(400, "Recherche trop courte (min. 2 caractères)")
    key_q = query.lower()
    cache_key = {"model_id": model_id, "lang_id": lang_id, "q": key_q}
    cached = await db.tecdoc_oem_cache.find_one(cache_key, {"_id": 0, "cached_at": 0})
    if cached:
        return {**cached, "source": "cache"}
    items = await rapid_search_oem(model_id, query, lang_id)
    doc = {
        **cache_key,
        "count": len(items),
        "items": items,
        "cached_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.tecdoc_oem_cache.update_one(cache_key, {"$set": doc}, upsert=True)
    return {**doc, "source": "fresh"}

@api.get("/rapidapi/oem-search/artikel-no/{oem}")
async def rapidapi_oem_search_artikel(oem: str, lang_id: int = 6):
    from rapidapi_client import search_by_article_oem_no as rapid_search_by_oem_no
    items = await rapid_search_by_oem_no(oem, lang_id)
    return {
        "oem": oem,
        "lang_id": lang_id,
        "count": len(items),
        "items": items,
        "cached_at": datetime.now(timezone.utc).isoformat(),
        "source": "fresh",
    }

@api.get("/rapidapi/compatible-cars/{article_no}")
async def rapidapi_compatible_cars_endpoint(
    article_no: str,
    type_id: int = 1,
    lang_id: int = 6,
    country_filter_id: int = 63,
):
    """Step 2 for frontend-driven compatibility check: given an articleNo
    (from /rapidapi/oem-search/artikel-no/{oem}), return the list of
    vehicles compatible with that article — each entry carries at least
    {manufacturerName, typeEngineName, modelName, vehicleId}."""
    from rapidapi_client import get_compatible_cars_by_article_number as rapid_compatible_cars
    compat = await rapid_compatible_cars(
        article_no, type_id=type_id, lang_id=lang_id, country_filter_id=country_filter_id,
    )
    return {
        "article_no": article_no,
        "count": len(compat),
        "items": compat,
        "cached_at": datetime.now(timezone.utc).isoformat(),
        "source": "fresh",
    }    

POPULAR_CATEGORIES = {
    "batterie": {
        "label": "Batterie",
        "icon": "Zap",
        "image": "https://images.unsplash.com/photo-1620714223084-8fcacc6dfd8d?auto=format&fit=crop&w=600&q=70",
        "mode": "niv",
        "niv1": "ELECTRIQUE",
        "niv2": "DEMARREUR / COMPOSANTS",
        "niv3": "BATTERIE",
        "niv4": "BATTERIE",
        # Drop ancillary parts (supports, covers) — only show actual batteries.
        # Includes the "supp" abbreviation used by some suppliers (e.g. "SUPP BATTERIE").
        "exclude_terms": ["support", "supp ", "cache", "console"],
    },
    "huile-moteur": {
        "label": "HUILE MOTEUR",
        "icon": "Droplet",
        "image": "https://images.unsplash.com/photo-1635775017492-1eb935a082a2?auto=format&fit=crop&w=600&q=70",
        # Combined sources: niv hierarchy + multiple designation searches.
        # Results are merged + deduped by reference.
        "mode": "niv",
        "niv1": "LUBRIFICATION MOTEUR",
        "niv2": "LUBRIFIANTS",
        "niv3": "HUILE",
        "niv4": "HUILE MOTEUR"
    },
    "accessoires": {
        "label": "Accessoires",
        "icon": "Package",
        "image": "https://images.unsplash.com/photo-1486006920555-c77dcf18193c?auto=format&fit=crop&w=600&q=70",
        "niv1": "ENTRETIEN",
        "niv2": "LAVAGE / ESSUYAGE",
        "niv3": "LAVAGE",
        "mode": "multi",
        "designations": [
            "BALAI ESSUIE-GLACE",
            "VASE EAU ESSUIE-GLACE",
            "POMPE LAVE VITRE",
        ],
    },
    "eau-radiateur": {
        "label": "Eau Radiateur",
        "icon": "Thermometer",
        "image": "https://images.unsplash.com/photo-1632823469850-2f77dd9c7f93?auto=format&fit=crop&w=600&q=70",
        "mode": "designation",
        "designation": "EAU RADIATEUR",
        # Drop accessories (caps) — only show actual coolant items
    "exclude_terms": ["bouchon", "vase"],
    },
}


@api.get("/partners/popular-categories")
async def popular_categories():
    """Static metadata of popular product categories shown on the landing page."""
    return {
        "categories": [
            {"slug": slug, "label": cfg["label"], "icon": cfg.get("icon"), "image": cfg.get("image")}
            for slug, cfg in POPULAR_CATEGORIES.items()
        ]
    }


@api.get("/partners/category-products")
async def partners_category_products(
    slug: str,
    user: dict = Depends(get_current_user),
):
    """Fetch products for a popular category from FadPro.
    For 'filtre-huile': combines the niv-hierarchy search + 4 designation
    searches, each capped at 50 items, then shows all of them together."""

    cfg = POPULAR_CATEGORIES.get(slug)
    if not cfg:
        raise HTTPException(404, f"Catégorie '{slug}' introuvable")

    PER_SOURCE_CAP = 50
    exclude_terms = [t.lower() for t in (cfg.get("exclude_terms") or [])]

    def _keep(it):
        if not exclude_terms:
            return True
        title = (it.get("designation") or it.get("name") or "").lower()
        return not any(term in title for term in exclude_terms)

    def _fallback_label_match(item: dict, slug: str) -> bool:
        label = get_label_from_slug(slug)
        if not label:
            return False

        designation = (
            item.get("designation")
            or item.get("name")
            or ""
        )

        label_tokens = _designation_query_tokens(label)
        designation_norm = _strip_accents(designation)

        return all(t in designation_norm for t in label_tokens)    

    def _process_source(raw_batch, source_label):
        """Keep only IN-STOCK priced items, apply exclude_terms, sort, cap to PER_SOURCE_CAP."""
        batch = [
            it for it in (raw_batch or [])
            if it.get("prix_tnd") and it["prix_tnd"] > 0
        ]
        filtered = []
        label = (cfg.get("label") or "").lower()
        for it in batch:
            cat = (it.get("categorie") or "").strip()

            designation = (
                it.get("designation")
                or it.get("name")
                or it.get("title")
                or ""
            ).lower()

            # 1. normal case: categorie exists
            if cat:
                if _keep(it):
                    filtered.append(it)
                continue

            # 2. fallback case: categorie is empty → check designation
            if label in designation:
                if _keep(it):
                    filtered.append(it)

        batch = filtered
        batch.sort(key=lambda x: (0 if x.get("in_stock") else 1, x.get("prix_tnd") or 1e9))
        capped = batch[:PER_SOURCE_CAP]
        logging.info(f"FadPro source '{source_label}' → {len(raw_batch or [])} raw, {len(batch)} in-stock filtered, {len(capped)} kept")
        return capped

    all_sources: list[list[dict]] = []

    try:
        # 1. Hauptquelle (niv-Hierarchie ODER einzelne designation, je nach mode)
        if cfg.get("mode") == "designation":
            main_raw = await fadpro_designation_search(cfg["designation"])
            main_label = cfg["designation"]
        else:
            main_raw = await fadpro_niv_search(
                cfg["niv1"], cfg.get("niv2"), cfg.get("niv3"), cfg.get("niv4"),
            )
            main_label = f"{cfg.get('niv1')}/{cfg.get('niv2')}/{cfg.get('niv3')}"
        all_sources.append(_process_source(main_raw, main_label))

        # 2. Zusätzliche Designation-Quellen (z.B. bei filtre-huile)
        extra_designations = cfg.get("designations") or []
        if extra_designations:
            extra_results = await asyncio.gather(
                *[fadpro_designation_search(d) for d in extra_designations],
                return_exceptions=True,
            )
            for designation, batch in zip(extra_designations, extra_results):
                if isinstance(batch, Exception):
                    logging.warning(f"FadPro designation '{designation}' failed: {batch}")
                    all_sources.append([])
                    continue
                all_sources.append(_process_source(batch, designation))

    except Exception as e:
        logging.warning(f"FadPro category lookup failed for {slug}: {e}")
        all_sources = all_sources or [[]]

    # 3. Alle Quellen zusammenführen + nach `ref`/`reference` deduplizieren
    #    (ein Artikel könnte z.B. sowohl in der Niv-Suche als auch in
    #    "HUILE MOTEUR" auftauchen)
    items = []
    seen_refs = set()
    for source_items in all_sources:
        for it in source_items:
            ref_key = (it.get("ref") or it.get("reference") or "").upper()
            if ref_key and ref_key in seen_refs:
                continue
            if ref_key:
                seen_refs.add(ref_key)
            items.append(it)

    for it in items:
        it["source"] = "fadpro"

    return {
        "slug": slug,
        "label": cfg["label"],
        "image": cfg.get("image"),
        "count": len(items),
        "items": items,
    }


@api.get("/partners/reference-search")
async def partners_reference_search(ref: str = "", user: dict = Depends(get_current_user)):
    """Combined parallel reference search across FadPro + Copia + PartsPro.
    Authenticated users only.

    Returns one normalised list (items) with `source` field telling which
    partner each result comes from."""
    import asyncio
    ref = (ref or "").strip()
    if len(ref) < 2:
        raise HTTPException(400, "Référence trop courte (min. 2 caractères)")

    async def safe_call(coro, source):
        try:
            data = await asyncio.wait_for(coro, timeout=8.0)
            return source, data if isinstance(data, list) else []
        except Exception as e:
            logging.warning(f"{source} reference-search error for ref={ref}: {e}")
            return source, []

    fp, co, pp = await asyncio.gather(
        safe_call(fadpro_search(ref), "fadpro"),
        safe_call(get_copia().search_reference(ref), "copia"),
        safe_call(get_partspro().search_reference(ref), "partspro"),
        safe_call(proad_search(ref), "proad"), 
    )

    aggregated = []
    seen = set()
    for source, items in (fp, co, pp, pa):
        for it in items:
            key = (source, (it.get("reference") or "").upper())
            if key in seen:
                continue
            seen.add(key)
            aggregated.append({**it, "source": it.get("source") or source})
    # Order: in-stock first, then by price ascending
    aggregated.sort(key=lambda x: (0 if x.get("in_stock") else 1, x.get("prix_tnd") or 1e9))
    return {"reference": ref, "count": len(aggregated), "items": aggregated}


@api.get("/fadpro/search")
async def fadpro_search_endpoint(ref: str = "", user: dict = Depends(get_current_user)):
    """Search FadPro by reference origin (refFour). Authenticated users only.
    Prices are adjusted: prix_origine × 0.19 + (prix_origine * 0.35)."""
    ref = (ref or "").strip()
    if len(ref) < 2:
        raise HTTPException(400, "Référence trop courte (min. 2 caractères)")
    try:
        items = await fadpro_search(ref)
    except RuntimeError as e:
        raise HTTPException(502, str(e))
    return {"reference": ref, "count": len(items), "items": items}


@api.get("/oem-stock-search")
async def oem_stock_search(
    model_id: int,
    q: str,
    lang_id: int = 6,
    limit: int = 5,
    split: bool = False,
    vehicle_name: str = "",
    manufacturer_name: str = "",
    engine_name: str = "",
    vin: str = "",
    slug: str = "",
    vehicle_id: int = 0,
    user: dict = Depends(get_current_user),
):

    """Combined OEM + multi-supplier lookup.

    Workflow:
      1. Fetch OEM refs from TecDoc for the given model & query.
         By default the query is sent AS-IS as a single `search-param` (phrase
         mode) — perfect for searching TecDoc product names like
         "Caisse à eau, radiateur".
         When `split=true` the query is split on commas/whitespace into separate
         keyword searches whose results are merged + deduped (used for the
         "Kit chaîne" category where TecDoc product names don't match the
         French shop terminology).
      2. For each OEM ref, look it up in FadPro/Copia/PartsPro.
      3. (Optional) Verify vehicle compatibility — when `vehicle_name` is
         provided (e.g. "RENAULT CLIO IV (BH_)"), items whose supplier title
         doesn't already mention the model are double-checked against
         piecesautos.tn. Items that don't list the customer's vehicle in their
         official compatibility list are dropped.
      4. Return items, in-stock first, then out-of-stock items (labelled
         "Hors stock" on the card).
    """
    import asyncio
    from rapidapi_client import (
        search_by_article_oem_no as rapid_search_by_oem_no,
        get_compatible_cars_by_article_number as rapid_compatible_cars,
    )

    query = (q or "").strip()
    if len(query) < 2:
        raise HTTPException(400, "Recherche trop courte (min. 2 caractères)")

    # 0. Resolve the concrete TecDoc vehicleId.
    # PRIORITY: an explicit `vehicle_id` sent by the frontend — the user
    # manually picked their exact engine from the /vehicles/variants
    # dropdown (fuel type → typeEngineName). This replaces the old
    # vin-decoder-mega auto-matching, whose sra_commercial/engine data was
    # frequently wrong and silently picked the wrong variant.
    if not vehicle_id:
        veh_cache_key = {"model_id": model_id, "lang_id": lang_id}
        veh_cached = await db.tecdoc_vehicle_cache.find_one(veh_cache_key, {"_id": 0, "cached_at": 0})
        if veh_cached and veh_cached.get("vehicle_id"):
            vehicle_id = veh_cached["vehicle_id"]
        else:
            vehicles = await rapid_list_vehicles(model_id, lang_id)
            if not vehicles:
                raise HTTPException(404, f"Aucune variante véhicule trouvée pour modelId={model_id}")
            vehicle_id = vehicles[0].get("vehicleId")
            if not vehicle_id:
                raise HTTPException(502, "Réponse TecDoc invalide (vehicleId manquant)")
            await db.tecdoc_vehicle_cache.update_one(
                veh_cache_key,
                {"$set": {
                    **veh_cache_key,
                    "vehicle_id": vehicle_id,
                    "variants": [v.get("vehicleId") for v in vehicles if v.get("vehicleId")],
                    "cached_at": datetime.now(timezone.utc).isoformat(),
                }},
                upsert=True,
            )
    
    # 1. OEM refs from TecDoc.
    # Default (split=False, phrase mode): the query is sent AS-IS as a single
    # search-param. This is what TecDoc expects for product-name searches like
    # "Caisse à eau, radiateur".
    # Opt-in (split=True): the query is split into individual keywords whose
    # results are merged + deduped. Used by categories like "Kit chaîne" where
    # the shop terminology doesn't match any TecDoc product name verbatim.

    async def search_keyword(kw: str):
        key_q = kw.lower()
        cache_key = {"vehicle_id": vehicle_id, "lang_id": lang_id, "q": key_q}
        cached = await db.tecdoc_oem_cache.find_one(cache_key, {"_id": 0, "cached_at": 0})
        if cached:
            return cached.get("items", [])
        items = await rapid_search_oem(vehicle_id, kw, lang_id)
        await db.tecdoc_oem_cache.update_one(
            cache_key,
            {"$set": {
                **cache_key,
                "count": len(items),
                "items": items,
                "cached_at": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True,
        )
        return items

    if not split:
        # Phrase mode — send full query as-is
        keywords = [query]
        keyword_results = [await search_keyword(query)]
    else:
        # Split mode — break the query into keywords, search each in parallel
        if "," in query:
            raw_tokens = [t.strip() for t in query.split(",") if t.strip()]
        else:
            import re
            raw_tokens = [t.strip() for t in re.split(r"\s+", query) if t.strip()]
        keywords = [t for t in raw_tokens if len(t) >= 2] or [query]
        keyword_results = await asyncio.gather(*[search_keyword(k) for k in keywords])

    # Round-robin merge so every keyword is fairly represented before the candidate
    # cap kicks in. Without this, a keyword that returns 100 OEM refs would push out
    # all refs from a second keyword (e.g. "kit chaine" would only show "kit" hits).
    seen_oem = set()
    oem_items = []
    max_len = max((len(b or []) for b in keyword_results), default=0)
    for i in range(max_len):
        for batch in keyword_results:
            if i >= len(batch or []):
                continue
            it = batch[i]
            ref = (it.get("ref") or "").strip()
            if ref and ref not in seen_oem:
                seen_oem.add(ref)
                oem_items.append(it)

    # Relevance filter — TWO modes:
    # • Phrase mode (split=False, default):
    #   Keep only OEM entries whose TecDoc `articleProductName` matches the
    #   query 1:1 (case-/accent-/whitespace-insensitive equality). This guarantees
    #   that searching for e.g. "Support moteur" returns ONLY items literally
    #   named "Support moteur", not "Support moteur D" or "Suspension, boîte
    #   automatique / Support moteur".
    # • Split mode (split=True):
    #   Keep OEM entries whose name contains at least one significant query
    #   phrase (looser, used for "Kit chaîne" multi-keyword unions).
    import unicodedata as _ud
    import re as _re2

    def _norm(s: str) -> str:
        s = "".join(c for c in _ud.normalize("NFD", s.lower()) if _ud.category(c) != "Mn")
        return _re2.sub(r"\s+", " ", s).strip()

    if not split:
        # Strict 1:1 match
        target = _norm(query)
        relevant = [it for it in oem_items if _norm(it.get("name") or "") == target]
        # If strict match wipes everything out, leave items untouched so the
        # caller can see what TecDoc actually returned (debug-friendly fallback).
        if relevant:
            oem_items = relevant
        else:
            oem_items = []
    else:
        # Looser phrase containment for split mode
        relevance_phrases = []
        if "," in query:
            for seg in query.split(","):
                seg = seg.strip()
                if len(seg.split()) >= 2:
                    relevance_phrases.append(_norm(seg))
        if not relevance_phrases:
            raw_tokens = _re2.split(r"[,\s]+", query)
            relevance_phrases = [_norm(t) for t in raw_tokens if len(t) >= 3]
        if relevance_phrases:
            relevant = []
            for it in oem_items:
                name_norm = _norm(it.get("name") or "")
                if any(p in name_norm for p in relevance_phrases):
                    relevant.append(it)
            if relevant:
                oem_items = relevant

    if not oem_items:
        return {"query": query, "model_id": model_id, "vehicle_id": vehicle_id, "checked": 0, "count": 0, "items": []}

    # Deduplicate OEM refs while preserving order and the friendly name.
    # No cap — ALL OEM refs returned by TecDoc are checked at the suppliers.
    # Concurrency is still capped by an asyncio.Semaphore below to avoid
    # overwhelming the supplier APIs.
    seen = set()
    candidates = []
    for it in oem_items:
        ref = (it.get("ref") or "").strip()
        if not ref or ref in seen:
            continue
        seen.add(ref)
        candidates.append({"ref": ref, "oem_name": it.get("name") or ""})

    # 2. Multi-supplier (FadPro + Copia + PartsPro) lookups.
    # FadPro has no per-instance lock so it runs fully in parallel — we use a
    # high semaphore (60) so even 600+ candidates complete in ~10-15 s.
    # Copia & PartsPro hold a per-supplier asyncio.Lock that serialises every
    # call: 600 × 5 s = 3000 s on each, so we cap them at the first
    # LOCKED_SUPPLIER_CAP candidates (TecDoc returns refs in relevance order
    # so the head of the list is the most likely to match). Without this cap
    # the global timeout fires and the FadPro variant fallback never gets a
    # chance to surface — which is exactly the user-reported bug for
    # q='Kit,chaine,distribution' (616 candidates).
    sem = asyncio.Semaphore(60)
    LOCKED_SUPPLIER_CAP = 60

    # ── Supplier-pick cache (10 min TTL) ─────────────────────────────────
    # Caches the "chosen" item per (source, ref) so repeating the same OEM
    # search returns the SAME items even when a supplier API is intermittently
    # slow. Without this, results vary between runs because cross-supplier
    # timeouts cancel partial responses.
    SUPPLIER_CACHE_TTL_S = 600

    # FadPro has no per-instance lock so it can absorb the variant loop
    # cheaply. Copia & PartsPro hold a per-supplier asyncio.Lock that
    # serialises every concurrent lookup — running 2-3 variants there would
    # multiply tail latency by 2-3x and trip Cloudflare's 100 s gateway.
    # We therefore restrict the variant fallback to FadPro only.
    VARIANT_SOURCES = {"fadpro"}

    async def cached_supplier_search(source: str, ref: str, fetcher):
        """Return the raw supplier list for `ref`, with 10-min MongoDB cache.

        FadPro stores many PSA/OEM references under non-canonical forms
        (suffix-stripped, short prefix, with/without leading zero). For
        FadPro we try a tiny ordered list of variants and surface whichever
        first returns hits; for Copia/PartsPro we only try the canonical
        ref to keep the per-supplier lock contention low.
        """
        cached = await db.supplier_lookup_cache.find_one(
            {"source": source, "ref": ref},
            {"_id": 0, "items": 1, "fetched_at": 1},
        )
        if cached and cached.get("fetched_at"):
            try:
                ts = datetime.fromisoformat(cached["fetched_at"].replace("Z", ""))
                age = (datetime.now(timezone.utc).replace(tzinfo=None) - ts).total_seconds()
                if age < SUPPLIER_CACHE_TTL_S:
                    return cached.get("items") or []
            except Exception:
                pass

        per_call_timeout = 5.0 if source not in VARIANT_SOURCES else 3.0

        async def _fetch_one(v: str) -> list:
            try:
                out = await asyncio.wait_for(fetcher(v), timeout=per_call_timeout)
            except asyncio.TimeoutError:
                return []
            except Exception as e:
                logging.warning(f"{source} fetch error for {v}: {e}")
                return []
            return out if isinstance(out, list) else []

        variants = oem_search_variants(ref) if source in VARIANT_SOURCES else [ref]
        items: list = []
        matched_variant = ref
        for v in variants:
            items = await _fetch_one(v)
            if items:
                matched_variant = v
                break

        await db.supplier_lookup_cache.update_one(
            {"source": source, "ref": ref},
            {"$set": {
                "source": source,
                "ref": ref,
                "matched_variant": matched_variant,
                "items": items,
                "fetched_at": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True,
        )
        return items

    # 2bis. Vehicle-compatibility filter via piecesautos.tn.
    # Activated only when the client passes `vehicle_name` (e.g. "RENAULT CLIO IV").
    # Items whose supplier title contains the model token (cheap path) are
    # kept directly; the others are double-checked against the scraped
    # compatibility list (cached 7 days in Mongo).
    manu_name_in = (manufacturer_name or "").strip()
    engine_name_in = (engine_name or "").strip()
    compat_check_enabled = bool(manu_name_in and engine_name_in)

    rapid_compat_sem = asyncio.Semaphore(10)
    RAPID_COMPAT_TTL_S = 7 * 24 * 3600  # 7 days
    # Cap live RapidAPI compat lookups the same way Copia/PartsPro were
    # capped — each check costs 2 RapidAPI calls, so we bound how many
    # candidates get a live check when hundreds of refs are in play.
    RAPID_COMPAT_CAP = 50

    async def get_rapid_compat_list(ref: str, allow_fetch: bool = True):
        """Cached two-step RapidAPI compatibility fetch for OEM ref `ref`:
        1) search-by-article-oem-no → articleNo
        2) get-compatible-cars-by-article-number → list of compatible
           vehicles {manufacturerName, typeEngineName, ...}
        Cached 7 days in Mongo, keyed by ref."""
        if not compat_check_enabled:
            return None  # filter disabled
        cached = await db.rapid_compat_cache.find_one(
            {"ref": ref}, {"_id": 0, "compat": 1, "fetched_at": 1}
        )
        if cached and cached.get("fetched_at"):
            try:
                ts = datetime.fromisoformat(cached["fetched_at"].replace("Z", ""))
                age = (datetime.now(timezone.utc).replace(tzinfo=None) - ts).total_seconds()
                if age < RAPID_COMPAT_TTL_S:
                    return cached.get("compat")
            except Exception:
                pass
        if not allow_fetch:
            return None  # cap exceeded — let caller keep the picked items
        try:
            async with rapid_compat_sem:
                matches = await asyncio.wait_for(rapid_search_by_oem_no(ref, lang_id=6), timeout=8.0)
                article_no = None
                if matches:
                    article_no = matches[0].get("articleNo") or matches[0].get("articleNumber")
                if not article_no:
                    compat = []
                else:
                    compat = await asyncio.wait_for(
                        rapid_compatible_cars(article_no, type_id=1, lang_id=6, country_filter_id=63),
                        timeout=8.0,
                    )
        except Exception as e:
            logging.warning(f"RapidAPI compat lookup failed for ref={ref}: {e}")
            return None  # couldn't verify → caller keeps the item
        await db.rapid_compat_cache.update_one(
            {"ref": ref},
            {"$set": {
                "ref": ref,
                "compat": compat,
                "fetched_at": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True,
        )
        return compat

    async def lookup(c, idx: int):
        async with sem:
            # FadPro runs for EVERY candidate (no lock → fully parallel).
            # Copia & PartsPro are skipped past LOCKED_SUPPLIER_CAP — their
            # per-instance asyncio.Lock would otherwise serialise all 600+
            # candidates and trip the global timeout, preventing the FadPro
            # variant fallback from ever surfacing matches.
            tasks = [
                cached_supplier_search("fadpro",   c["ref"], fadpro_search),
            ]
            check_locked = idx < LOCKED_SUPPLIER_CAP
            if check_locked:
                tasks.append(cached_supplier_search("copia",    c["ref"], lambda r: get_copia().search_reference(r)))
                tasks.append(cached_supplier_search("partspro", c["ref"], lambda r: get_partspro().search_reference(r)))
                tasks.append(cached_supplier_search("proad",    c["ref"], proad_search))
            gathered = await asyncio.gather(*tasks, return_exceptions=True)
            fp = gathered[0]
            co = gathered[1] if check_locked else []
            pp = gathered[2] if check_locked else []
            pa = gathered[3] if check_locked else []
            # Normalise exceptions to empty lists
            fp = fp if isinstance(fp, list) else []
            co = co if isinstance(co, list) else []
            pp = pp if isinstance(pp, list) else []
            pa = pa if isinstance(pa, list) else [] 
            picked = []
            for batch, source in ((fp, "fadpro"), (co, "copia"), (pp, "partspro"), (pa, "proad")):
                if isinstance(batch, Exception):
                    logging.warning(f"{source} lookup error for {c['ref']}: {batch}")
                    continue
                if not isinstance(batch, list):
                    continue
                # Three-tier preference per supplier:
                #   1. In-stock items with a price (best)
                #   2. Out-of-stock items with a price (still displayable)
                #   3. Out-of-stock items WITHOUT a price (last resort — labelled
                #      "Prix sur demande" in the UI so customers can still ask)
                in_stock_pick = None
                priced_oos_pick = None
                noprice_oos_pick = None
                for fi in batch:
                    if fi.get("in_stock") and fi.get("prix_tnd"):
                        in_stock_pick = fi
                        break
                    if fi.get("prix_tnd") and priced_oos_pick is None:
                        priced_oos_pick = fi
                    elif not fi.get("prix_tnd") and noprice_oos_pick is None:
                        noprice_oos_pick = fi
                chosen = in_stock_pick or priced_oos_pick or noprice_oos_pick
                if chosen:
                    chosen = {**chosen, "oem_ref": c["ref"], "oem_name": c["oem_name"], "source": chosen.get("source", source)}
                    picked.append(chosen)

            # Vehicle-compatibility filter (only when client passed vehicle_name).
            # Items whose supplier designation already mentions the model are
            # kept immediately. The rest are checked against piecesautos.tn —
            # but only for the first PA_COMPAT_CAP candidates (compat scrape
            # is slow; past the cap we trust the supplier match).
            if compat_check_enabled and picked:
                compat = await get_rapid_compat_list(c["ref"], allow_fetch=idx < RAPID_COMPAT_CAP)
                if compat is None:
                    return picked  # couldn't verify (disabled/timeout/cap) → keep
                # Fail-open: an EMPTY compat list means the API had no
                # compatibility data for this ref (common — supplier refs
                # don't always resolve via search-by-article-oem-no), not
                # proof of incompatibility. Only a NON-EMPTY list that
                # explicitly excludes the searched vehicle causes a drop.
                if not compat or _vehicle_compat_matches(compat, manu_name_in, engine_name_in):
                    return picked
                # Non-empty compat list that does NOT match → explicitly incompatible
                return []
            return picked

    # Process ALL candidates in parallel (concurrency is bounded by the
    # semaphore inside `lookup`). FadPro is variant-aware (≤3 calls per
    # ref × 3 s) and runs for ALL candidates; Copia/PartsPro are single-shot
    # and only run for the first LOCKED_SUPPLIER_CAP candidates (to avoid
    # the per-instance lock serialising hundreds of refs). A global 40 s
    # deadline applies — instead of cancelling all tasks (which throws
    # away ALL completed lookups), we collect whatever finished by the
    # deadline via `asyncio.as_completed` and return those partial results.
    # This is essential when 600+ candidates are checked: even if 100
    # lookups finish, the user must see those items rather than a blank
    # page caused by the few slow ones.
    checked = len(candidates)
    all_results: list = []
    timed_out = False
    deadline = 40.0
    started = asyncio.get_event_loop().time()
    pending_tasks = [asyncio.create_task(lookup(c, i)) for i, c in enumerate(candidates)]
    try:
        for fut in asyncio.as_completed(pending_tasks, timeout=deadline):
            try:
                batch = await fut
            except Exception:
                batch = []
            if batch:
                all_results.append(batch)
    except asyncio.TimeoutError:
        timed_out = True
        elapsed = asyncio.get_event_loop().time() - started
        done = sum(1 for t in pending_tasks if t.done())
        logging.warning(
            f"oem-stock-search partial timeout for q={query!r}: "
            f"{done}/{len(pending_tasks)} candidates finished in {elapsed:.1f}s"
        )
        # Laggards canceln — aber Cache-Vorwärmung im Hintergrund weiterlaufen lassen
        cancelled_candidates = []
        for i, t in enumerate(pending_tasks):
            if not t.done():
                t.cancel()
                if i < len(candidates):
                    cancelled_candidates.append((i, candidates[i]))

    # Background-Task: vorwärmt den supplier_lookup_cache für alle abgebrochenen Refs
    # → beim nächsten Request sind diese sofort aus dem Cache verfügbar
        async def _prewarm(cands):
            prewarm_sem = asyncio.Semaphore(10)
            async def _warm_one(c, idx):
                async with prewarm_sem:
                    try:
                        await cached_supplier_search("fadpro", c["ref"], fadpro_search)
                    except Exception:
                        pass
            await asyncio.gather(*[_warm_one(c, i) for i, c in cands], return_exceptions=True)

        if cancelled_candidates:
            asyncio.create_task(_prewarm(cancelled_candidates))
            logging.info(f"Prewarm task started for {len(cancelled_candidates)} uncached refs (q={query!r})")

    results = []
    seen_refs = set()
    for batch in all_results:
        for r in batch:
            key = (r.get("source", ""), r["reference"])
            if key in seen_refs:
                continue
            seen_refs.add(key)
            results.append(r)

    # Sub-category filter, two tiers:
    #  1. Items WITH a non-empty `categorie` (FadPro): pass through the
    #     configured SUBCATEGORY_CATEGORY_FILTERS rule (AND / OR-of-AND).
    #  2. Items WITHOUT a `categorie` (Copia / PartsPro often ship empty
    #     hierarchies): fall back to matching ALL tokens of the sub-category
    #     `label` against the supplier `designation`. Example: label="Plage"
    #     requires the token "plage" to appear inside the designation string.
    # Items with an empty categorie AND no label provided are kept (no info
    # to filter on) — this preserves the pre-change behaviour for legacy
    # frontend calls that don't send a label.
    cat_label = get_label_from_slug(slug) if slug else None
    label_tokens = _designation_query_tokens(cat_label) if cat_label else []
    if not label_tokens:
        label_tokens = _designation_query_tokens(query)
        
    cat_required = _category_filter_for_query(query)


    def _passes_category_filter(r: dict) -> bool:
        cat_str = r.get("categorie") or ""
        if cat_str:
            if cat_required:
                return _category_matches(cat_str, cat_required)
            return True
        if label_tokens:
            designation = r.get("designation") or r.get("name") or ""
            return _designation_has_any_token(designation, label_tokens)
        return True
    if cat_required or label_tokens:
        results = [r for r in results if _passes_category_filter(r)]        
    # Sort: in-stock items first, then by price ascending. Out-of-stock items
    # are still shown so the user can see what's available in the supplier
    # catalog (labelled "Hors stock" on the card).
    results.sort(key=lambda r: (0 if r.get("in_stock") else 1, r.get("prix_tnd") or 1e9))
    completed = sum(1 for t in pending_tasks if t.done())
    partial = completed < len(pending_tasks)
    return {
        "query": query,
        "model_id": model_id,
        "vehicle_id": vehicle_id,
        "checked": checked,
        "count": len(results),
        "items": results[:limit],
        "is_partial": partial,
        "prewarm_queued": partial,
    }

def normalize(text: str) -> set:
    if not text:
        return set()
    return set(_re.findall(r"[a-z0-9]+", text.lower()))


class ManualVehicleIn(BaseModel):
    make: str
    model: str
    year: str
    fuel: str


@api.get("/vehicles/catalog")
async def vehicles_catalog():
    return get_vehicles_catalog()


@api.post("/vehicles/manual")
async def vehicles_manual(payload: ManualVehicleIn):
    make = payload.make.strip()
    model = payload.model.strip()
    year = payload.year.strip()
    fuel = payload.fuel.strip()
    if not (make and model and year and fuel):
        raise HTTPException(400, "Tous les champs sont obligatoires")
    if make not in VEHICLES:
        raise HTTPException(400, f"Marque inconnue: {make}")
    # Synthetic ID used as URL slug
    slug = f"MAN-{make[:3].upper()}-{model.replace(' ', '').upper()[:8]}-{year}"
    return {
        "vin": slug,
        "make": make,
        "model": model,
        "year": year,
        "fuel": fuel,
        "engine": "—",
        "trim": "—",
        "source": "manual",
    }


def _delivery_cost(method: Optional[str], subtotal: float) -> float:
    """Tunisia-localized delivery pricing.
    - domicile (standard 24-48h): 7 DT, FREE if subtotal >= 100 DT
    - express (same-day Tunis): 10 DT
    - relais (pickup point): 5 DT
    """
    m = (method or "domicile").lower()
    if m == "express":
        return 10.0
    if m == "relais":
        return 5.0
    # domicile
    return 0.0 if subtotal >= 100 else 7.0


def _payment_label(code: Optional[str]) -> str:
    m = (code or "cod").lower()
    return {
        "cod": "Paiement à la livraison",
        "card": "Paiement par carte",
        "transfer": "Virement bancaire",
    }.get(m, "Paiement à la livraison")


@api.post("/orders")
async def create_order(data: OrderIn, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    if not data.items:
        raise HTTPException(400, "Le panier est vide")
    items_resolved = []
    total = 0.0
    for it in data.items:
        # External items (FadPro / PartSouq): carry their own info
        if it.source and it.price_tnd is not None:
            price = float(it.price_tnd)
            line_total = price * it.quantity
            total += line_total
            items_resolved.append({
                "ref": it.ref,
                "name": it.name or it.ref,
                "brand": it.brand or "",
                "image": it.image or "",
                "unit_price_tnd": round(price, 3),
                "quantity": it.quantity,
                "line_total_tnd": round(line_total, 3),
                "source": it.source,
            })
            continue
        # Internal catalog
        part = find_part(it.ref)
        if not part:
            raise HTTPException(400, f"Pièce introuvable: {it.ref}")
        line_total = part["price_tnd"] * it.quantity
        total += line_total
        items_resolved.append({
            "ref": part["ref"],
            "name": part["name"],
            "brand": part["brand"],
            "image": part["image"],
            "unit_price_tnd": part["price_tnd"],
            "quantity": it.quantity,
            "line_total_tnd": round(line_total, 3),
            "source": "internal",
        })
    order = {
        "id": str(uuid.uuid4()),
        "order_number": f"BC{int(datetime.now(timezone.utc).timestamp()) % 100000}",
        "user_id": user["id"],
        "user_email": user["email"],
        "user_name": user["name"],
        "customer_name": (data.customer_name or user["name"]).strip(),
        "items": items_resolved,
        "subtotal_tnd": round(total, 3),
        "delivery_method": data.delivery_method or "domicile",
        "delivery_cost_tnd": _delivery_cost(data.delivery_method, total),
        "total_tnd": round(total + _delivery_cost(data.delivery_method, total), 3),
        "vehicle_vin": data.vehicle_vin or "",
        "vehicle_label": data.vehicle_label or "",
        "shipping_address": data.shipping_address,
        "city": data.city or "",
        "postal_code": data.postal_code or "",
        "phone": data.phone,
        "notes": data.notes or "",
        "status": "En attente",
        "payment_method": _payment_label(data.payment_method),
        "payment_method_code": data.payment_method or "cod",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.orders.insert_one(order)
    order.pop("_id", None)
    # Confirmation email to customer (async)
    background_tasks.add_task(send_order_confirmation, order)
    return order


@api.get("/orders/mine")
async def my_orders(user: dict = Depends(get_current_user)):
    docs = await db.orders.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return docs


@api.get("/admin/users")
async def admin_users(admin: dict = Depends(require_admin)):
    docs = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(1000)
    return docs


@api.get("/admin/orders")
async def admin_orders(admin: dict = Depends(require_admin)):
    docs = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return docs


@api.get("/admin/stats")
async def admin_stats(admin: dict = Depends(require_admin)):
    users_count = await db.users.count_documents({})
    orders_count = await db.orders.count_documents({})
    pending = await db.orders.count_documents({"status": "En attente"})
    pipeline = [{"$group": {"_id": None, "total": {"$sum": "$total_tnd"}}}]
    revenue_agg = await db.orders.aggregate(pipeline).to_list(1)
    revenue = round(revenue_agg[0]["total"], 3) if revenue_agg else 0
    return {
        "users": users_count,
        "orders": orders_count,
        "pending_orders": pending,
        "revenue_tnd": revenue,
    }


@api.patch("/admin/orders/{order_id}")
async def update_order_status(order_id: str, payload: OrderStatusIn, admin: dict = Depends(require_admin)):
    res = await db.orders.update_one({"id": order_id}, {"$set": {"status": payload.status}})
    if res.matched_count == 0:
        raise HTTPException(404, "Commande introuvable")
    return {"ok": True}


def _walk_category_node(section_data: dict, path_slugs: List[str]):
    """Validiert den Pfad und gibt den letzten Node zurück (für label)."""
    nodes = section_data["categories"]
    node = None
    for slug in path_slugs:
        node = next((c for c in nodes if c["slug"] == slug), None)
        if not node:
            return None
        nodes = node.get("children", [])
    return node

ALLOWED_IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5 Mo


@api.post("/admin/upload-image")
async def admin_upload_image(file: UploadFile = File(...), admin: dict = Depends(require_admin)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_IMAGE_EXT:
        raise HTTPException(400, "Format d'image non supporté (jpg, png, webp, gif)")

    contents = await file.read()
    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(400, "Image trop volumineuse (max 5 Mo)")

    filename = f"{uuid.uuid4()}{ext}"
    filepath = UPLOAD_DIR / filename
    with open(filepath, "wb") as f:
        f.write(contents)

    return {"url": f"/uploads/{filename}", "filename": filename}

@api.post("/admin/parts")
async def admin_create_part(data: ManualPartIn, admin: dict = Depends(require_admin)):
    section = get_section(data.section)
    if not section:
        raise HTTPException(404, "Section introuvable")
    if not data.category_path:
        raise HTTPException(400, "Chemin de catégorie manquant")
    node = _walk_category_node(section, data.category_path)
    if not node:
        raise HTTPException(404, "Catégorie/sous-catégorie introuvable")

    compatible_refs = [r.strip() for r in (data.compatible_refs or []) if r and r.strip()]
    

    doc = {
        "id": str(uuid.uuid4()),
        "section": data.section,
        "category_path": data.category_path,
        "category_label": node["label"],
        "ref": data.ref.strip(),
        "name": data.name.strip(),
        "brand": data.brand.strip(),
        "price_tnd": data.price_tnd,
        "image": data.image or "",
        "reference_origine": data.reference_origine.strip() if data.reference_origine else "",
        "compatible_refs": compatible_refs,
        "stock": data.stock,
        "source": "manual",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.manual_parts.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/admin/parts")
async def admin_list_parts(admin: dict = Depends(require_admin)):
    return await db.manual_parts.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api.delete("/admin/parts/{part_id}")
async def admin_delete_part(part_id: str, admin: dict = Depends(require_admin)):
    res = await db.manual_parts.delete_one({"id": part_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Article introuvable")
    return {"ok": True}

@api.post("/contact")
async def create_contact_message(data: ContactIn, background_tasks: BackgroundTasks):
    if not data.message.strip():
        raise HTTPException(400, "Le message ne peut pas être vide")
    doc = {
        "id": str(uuid.uuid4()),
        "name": data.name.strip(),
        "email": data.email.lower().strip(),
        "phone": (data.phone or "").strip(),
        "subject": data.subject.strip() or "Sans objet",
        "message": data.message.strip(),
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.contact_messages.insert_one(doc)
    doc.pop("_id", None)
    # Forward to admin email (async)
    background_tasks.add_task(send_contact_to_admin, doc)
    return {"ok": True, "id": doc["id"]}


@api.get("/admin/messages")
async def admin_messages(admin: dict = Depends(require_admin)):
    docs = await db.contact_messages.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


@api.patch("/admin/messages/{message_id}/read")
async def mark_message_read(message_id: str, admin: dict = Depends(require_admin)):
    res = await db.contact_messages.update_one({"id": message_id}, {"$set": {"read": True}})
    if res.matched_count == 0:
        raise HTTPException(404, "Message introuvable")
    return {"ok": True}


@api.get("/")
async def root():
    return {"name": "BENNOURI Pièces Auto", "status": "ok"}


async def seed_admin():
    email = os.environ.get("ADMIN_EMAIL", "admin@bennouri.com").lower()
    password = os.environ.get("ADMIN_PASSWORD", "Admin@123")
    existing = await db.users.find_one({"email": email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "name": "Admin BENNOURI",
            "email": email,
            "password_hash": hash_password(password),
            "phone": "+216 71 123 456",
            "address": "Avenue Habib Bourguiba, Tunis",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logging.info(f"Admin seeded: {email}")
    elif not verify_password(password, existing["password_hash"]):
        await db.users.update_one(
            {"email": email},
            {"$set": {"password_hash": hash_password(password), "role": "admin"}},
        )


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id")
    await db.orders.create_index("user_id")
    await db.orders.create_index("id")
    await db.partsouq_cache.create_index("vin", unique=True)
    await db.partsouq_subgroups.create_index([("vin", 1), ("cid", 1)], unique=True)
    await db.tecdoc_vehicles.create_index("vin", unique=True)
    await db.tecdoc_oem_cache.create_index(
        [("vehicle_id", 1), ("lang_id", 1), ("q", 1)],
        unique=True,
        partialFilterExpression={"vehicle_id": {"$exists": True}},
        name="vehicle_id_1_lang_id_1_q_1",
    )
    await db.tecdoc_oem_cache.create_index(
        [("model_id", 1), ("lang_id", 1), ("q", 1)],
        unique=True,
        partialFilterExpression={"model_id": {"$exists": True}},
        name="model_id_1_lang_id_1_q_1",
    )
    await seed_admin()
    await db.password_resets.create_index("token", unique=True)
    await db.password_resets.create_index("expires_at", expireAfterSeconds=0)


app.include_router(api)

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@app.on_event("shutdown")
async def shutdown():
    client.close()
