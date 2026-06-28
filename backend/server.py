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

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, BackgroundTasks
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr

from catalog_data import CATALOG, get_section, get_category, find_part
from vehicles_catalog import get_catalog as get_vehicles_catalog, VEHICLES
from partsouq_scraper import scrape_vin as partsouq_scrape, scrape_subgroup_parts
from fadpro_client import (
    search_reference as fadpro_search,
    search_by_niv_levels as fadpro_niv_search,
    search_by_designation as fadpro_designation_search,
)
from iis_supplier_client import get_copia, get_partspro
from email_service import send_welcome_email, send_order_confirmation, send_contact_to_admin
from rapidapi_client import (
    vin_lookup as rapid_vin_lookup,
    search_oem as rapid_search_oem,
    list_vehicles_for_model as rapid_list_vehicles,
    find_article_by_oem as rapid_find_article_by_oem,
    article_complete_details as rapid_article_details,
)

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


class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: Optional[str] = ""
    address: Optional[str] = ""


class LoginIn(BaseModel):
    email: EmailStr
    password: str


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


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Non authentifié")
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
                "icon": c["icon"],
                "image": c["image"],
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

    return {
        "section": section,
        "slug": node["slug"],
        "label": node["label"],
        "image": node.get("image"),
        "children": [_ser_child(c) for c in (node.get("children") or [])],
        "parts": node.get("parts", []),
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


import asyncio


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


POPULAR_CATEGORIES = {
    "batterie": {
        "label": "Batterie",
        "icon": "Zap",
        "image": "https://images.unsplash.com/photo-1620714223084-8fcacc6dfd8d?auto=format&fit=crop&w=600&q=70",
        "mode": "niv",
        "niv1": "ELECTRIQUE",
        "niv2": "DEMARREUR / COMPOSANTS",
        "niv3": "BATTERIE",
        # Drop ancillary parts (supports, covers) — only show actual batteries.
        # Includes the "supp" abbreviation used by some suppliers (e.g. "SUPP BATTERIE").
        "exclude_terms": ["support", "supp ", "cache"],
    },
    "filtre-huile": {
        "label": "Filtre Huile",
        "icon": "Droplet",
        "image": "https://images.unsplash.com/photo-1635775017492-1eb935a082a2?auto=format&fit=crop&w=600&q=70",
        "mode": "niv",
        "niv1": "FILTRATION",
        "niv2": "FILTRE HUILE",
        "niv3": "FILTRES",
    },
    "accessoires": {
        "label": "Accessoires",
        "icon": "Package",
        "image": "https://images.unsplash.com/photo-1486006920555-c77dcf18193c?auto=format&fit=crop&w=600&q=70",
        "mode": "designation",
        "designation": "ACCESSOIRE",
    },
    "eau-radiateur": {
        "label": "Eau Radiateur",
        "icon": "Thermometer",
        "image": "https://images.unsplash.com/photo-1632823469850-2f77dd9c7f93?auto=format&fit=crop&w=600&q=70",
        "mode": "designation",
        "designation": "EAU RADIATEUR",
        # Drop accessories (caps) — only show actual coolant items
        "exclude_terms": ["bouchon"],
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
    limit: int = 24,
    user: dict = Depends(get_current_user),
):
    """Fetch products for a popular category directly from FadPro's
    hierarchical browse API (`searchByNivLevels`). Falls back to an empty
    list if FadPro doesn't have any priced entries.
    """
    cfg = POPULAR_CATEGORIES.get(slug)
    if not cfg:
        raise HTTPException(404, f"Catégorie '{slug}' introuvable")

    try:
        if cfg.get("mode") == "designation":
            raw = await fadpro_designation_search(cfg["designation"])
        else:
            raw = await fadpro_niv_search(
                cfg["niv1"], cfg.get("niv2"), cfg.get("niv3"), cfg.get("niv4"),
            )
    except Exception as e:
        logging.warning(f"FadPro category lookup failed for {slug}: {e}")
        raw = []

    # Filter: only items with adjusted price > 0
    items = [it for it in raw if it.get("prix_tnd") and it["prix_tnd"] > 0]

    # Apply per-category exclusion terms (e.g. drop "Support Batterie" / "Cache Batterie"
    # from the Batterie tile, "Bouchon" from the Eau Radiateur tile).
    exclude_terms = [t.lower() for t in (cfg.get("exclude_terms") or [])]
    if exclude_terms:
        def _keep(it):
            title = (it.get("designation") or it.get("name") or "").lower()
            return not any(term in title for term in exclude_terms)
        items = [it for it in items if _keep(it)]

    # Order: in-stock first, then price ascending
    items.sort(key=lambda x: (0 if x.get("in_stock") else 1, x.get("prix_tnd") or 1e9))
    for it in items:
        it["source"] = "fadpro"

    return {
        "slug": slug,
        "label": cfg["label"],
        "image": cfg.get("image"),
        "count": len(items),
        "items": items[:limit],
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
    )

    aggregated = []
    seen = set()
    for source, items in (fp, co, pp):
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
    from piecesautos_compat import (
        fetch_compatibility as pa_fetch,
        vehicle_tokens as pa_tokens,
        title_matches_vehicle as pa_title_match,
        compat_list_matches_vehicle as pa_compat_match,
    )

    query = (q or "").strip()
    if len(query) < 2:
        raise HTTPException(400, "Recherche trop courte (min. 2 caractères)")

    # 0. Resolve modelId → vehicleId (TecDoc requires the concrete vehicle variant)
    veh_cache_key = {"model_id": model_id, "lang_id": lang_id}
    veh_cached = await db.tecdoc_vehicle_cache.find_one(veh_cache_key, {"_id": 0, "cached_at": 0})
    if veh_cached and veh_cached.get("vehicle_id"):
        vehicle_id = veh_cached["vehicle_id"]
    else:
        vehicles = await rapid_list_vehicles(model_id, lang_id)
        if not vehicles:
            raise HTTPException(404, f"Aucune variante véhicule trouvée pour modelId={model_id}")
        # Take the first vehicleId variant (most recent / default)
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

    # 2. Multi-supplier (FadPro + Copia + PartsPro) lookups with concurrency cap.
    # Higher semaphore (25) so 25 OEM refs are checked simultaneously — keeps
    # the total endpoint time roughly constant regardless of candidate count
    # (was: 10 → 50 OEMs took 5 × 8s = 40s; now: 50 OEMs in ~10s).
    sem = asyncio.Semaphore(25)

    # 2bis. Vehicle-compatibility filter via piecesautos.tn.
    # Activated only when the client passes `vehicle_name` (e.g. "RENAULT CLIO IV").
    # Items whose supplier title contains the model token (cheap path) are
    # kept directly; the others are double-checked against the scraped
    # compatibility list (cached 7 days in Mongo).
    vn = (vehicle_name or "").strip()
    if vn:
        # Split into manu + model: first word = manu, rest = model
        # e.g. "RENAULT CLIO IV (BH_)" → manu="RENAULT", model="CLIO IV (BH_)"
        bits = vn.split(maxsplit=1)
        if len(bits) == 2:
            manu_norm, model_toks = pa_tokens(bits[0], bits[1])
        else:
            manu_norm, model_toks = pa_tokens("", vn)
    else:
        manu_norm, model_toks = "", []

    pa_sem = asyncio.Semaphore(10)
    COMPAT_TTL = 7 * 24 * 3600  # 7 days

    async def get_compat_list(ref: str):
        """Cached piecesautos.tn compatibility fetch (per OEM ref)."""
        if not model_toks:
            return None  # skip filter entirely
        cached = await db.piecesautos_compat_cache.find_one(
            {"ref": ref}, {"_id": 0, "compat": 1, "fetched_at": 1}
        )
        if cached and cached.get("compat") is not None:
            return cached["compat"]
        async with pa_sem:
            compat = await pa_fetch(ref)
        await db.piecesautos_compat_cache.update_one(
            {"ref": ref},
            {"$set": {
                "ref": ref,
                "compat": compat,
                "fetched_at": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True,
        )
        return compat

    async def lookup(c):
        async with sem:
            tasks = [
                fadpro_search(c["ref"]),
                get_copia().search_reference(c["ref"]),
                get_partspro().search_reference(c["ref"]),
            ]
            try:
                # 5 s timeout per OEM lookup — prevents single slow supplier from
                # blocking ingress (Cloudflare 100s gateway limit).
                fp, co, pp = await asyncio.wait_for(
                    asyncio.gather(*tasks, return_exceptions=True),
                    timeout=5.0,
                )
            except asyncio.TimeoutError:
                logging.warning(f"Multi-supplier lookup timed out for {c['ref']}")
                return []
            except Exception as e:
                logging.warning(f"Multi-supplier lookup failed for {c['ref']}: {e}")
                return []
            picked = []
            for batch, source in ((fp, "fadpro"), (co, "copia"), (pp, "partspro")):
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
            # kept immediately. The rest are checked against piecesautos.tn.
            if model_toks and picked:
                # Cheap-path first: any item that already mentions the model
                cheap_pass = [it for it in picked if pa_title_match(it.get("designation") or "", model_toks)]
                if cheap_pass:
                    return cheap_pass
                # Slow-path: scrape compatibility list (one fetch per ref, cached)
                compat = await get_compat_list(c["ref"])
                if compat is None:
                    return picked  # no model_toks — shouldn't reach here
                if not compat or pa_compat_match(compat, manu_norm, model_toks):
                    return picked
                # Compatibility check explicitly returned False → drop
                return []
            return picked

    # Process ALL candidates in parallel (concurrency is bounded by the
    # semaphore inside `lookup`). This keeps total wall-time roughly equal to
    # `ceil(N_candidates / 25) × 5s` instead of `N_candidates × 5s` sequential.
    # A global 60 s timeout protects against Cloudflare's 100 s gateway limit.
    checked = len(candidates)
    try:
        all_results = await asyncio.wait_for(
            asyncio.gather(*[lookup(c) for c in candidates]),
            timeout=60.0,
        )
    except asyncio.TimeoutError:
        logging.warning(f"oem-stock-search global timeout for q={query!r}")
        all_results = []

    results = []
    seen_refs = set()
    for batch in all_results:
        for r in batch:
            key = (r.get("source", ""), r["reference"])
            if key in seen_refs:
                continue
            seen_refs.add(key)
            results.append(r)

    # Sort: in-stock items first, then by price ascending. Out-of-stock items
    # are still shown so the user can see what's available in the supplier
    # catalog (labelled "Hors stock" on the card).
    results.sort(key=lambda r: (0 if r.get("in_stock") else 1, r.get("prix_tnd") or 1e9))

    return {
        "query": query,
        "model_id": model_id,
        "vehicle_id": vehicle_id,
        "checked": checked,
        "count": len(results),
        "items": results[:limit],
    }


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


app.include_router(api)

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
