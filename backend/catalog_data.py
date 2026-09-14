"""
BENNOURI Pièces Auto — Catalogue de pièces détachées.
Structure: section -> category (avec sub_items inline) -> parts list.
"""

PEX = lambda i: f"https://images.pexels.com/photos/{i}/pexels-photo-{i}.jpeg?auto=compress&cs=tinysrgb&w=800"


def _p(ref: str, name: str, price: float, brand: str, img: str, desc: str = ""):
    return {
        "ref": ref,
        "name": name,
        "price_tnd": price,
        "brand": brand,
        "image": img,
        "description": desc or f"Pièce d'origine équipementier — {name}",
        "stock": 25,
    }

def IMG(slug):
    return f"/{slug}.png"

CATALOG = {
    "mecanique": {
        "label": "Mécanique",
        "icon": "engine",
        "description": "Moteur, boîte de vitesses, suspension et freinage.",
        "categories": [
            {
                "slug": "moteur",
                "label": "Moteur",
                "image": IMG("moteur-car"),
                "children": [
                    {"slug": "support-moteur-d", "label": "Support Moteur D/G", "image": IMG("turbo"), "search_keyword": "Support moteur", "children": []},
                    {"slug": "kit-chaine", "label": "Kit chaîne", "image": IMG("vase-eau"), "search_keyword": "Kit,chaine,distribution", "split_keywords": True, "children": []},
                    {"slug": "pompe-a-eau", "label": "Pompe à eau", "image": IMG("pompe-assistee"), "search_keyword": "Pompe à eau, refroidissement du moteur", "children": []},
                    {"slug": "radiateur-eau", "label": "Radiateur d'eau", "image": IMG("ventilateur"), "search_keyword": "Caisse à eau, radiateur", "children": []},
                    {"slug": "joint-culasse", "label": "Joint culasse", "image": IMG("kit-chaine"), "search_keyword": "Joint d'étanchéité, culasse", "children": []},
                    {"slug": "radiateur-chauffage", "label": "Radiateur chauffage", "image": IMG("radiateur-eau"), "search_keyword": "Système de chauffage", "children": []},
                    {"slug": "filtre-huile", "label": "Filtre à huile", "image": IMG("pompe-a-eau"), "search_keyword": "Filtre à huile", "children": []},
                    {"slug": "filtre-air", "label": "Filtre à air", "image": IMG("support-moteur-d"), "search_keyword": "Filtre à air", "children": []},
                    {"slug": "filtre-gazoil", "label": "Filtre gazoil / Filtre à essence", "image": IMG("joint-culasse"), "search_keyword": "Filtre à carburant", "children": []},
                    {"slug": "radiateur-turbo", "label": "Radiateur turbo", "image": IMG("radiateur-chauffage"), "search_keyword": "Intercooler, échangeur", "children": []},
                    {"slug": "filtre-habitacle", "label": "Filtre habitacle", "image": IMG("filtre-huile"), "search_keyword": "Filtre, air de l'habitacle", "children": []},
                    {"slug": "turbo", "label": "Turbo", "image": IMG("filtre-air"), "search_keyword": "Turbocompresseur, suralimentation", "children": []},
                    {"slug": "vase-eau", "label": "Vase d'eau", "image": IMG("filtre-habitacle"), "search_keyword": "Vase d'expansion, liquide de refroidissement", "children": []},
                    {"slug": "ventilateur", "label": "Ventilateur", "image": IMG("filtre-gazoil"), "search_keyword": "Ventilateur, refroidissement du moteur", "children": []},
                    {"slug": "pompe-assistee", "label": "Pompe assistée", "image": IMG("radiateur-turbo"), "search_keyword": "Pompe hydraulique, direction", "children": []},
                ],
                "parts": [],
            },
            {
                "slug": "boite-vitesses",
                "label": "Boîte de vitesses",
                "image": IMG("boite-vitesses"),
                "children": [
                    {"slug": "kit-embrayage", "label": "Kit embrayage", "image": IMG("filtre-boite"), "search_keyword": "Kit d'embrayage", "children": []},
                    {"slug": "recepteur-embrayage", "label": "Récepteur embrayage", "image": IMG("cable-vitesse"), "search_keyword": "Cylindre récepteur, embrayage", "children": []},
                    {"slug": "emetteur-embrayage", "label": "Émetteur embrayage", "image": IMG("kit-embrayage"), "search_keyword": "Cylindre émetteur, embrayage", "children": []},
                    {"slug": "butee-embrayage", "label": "Butée embrayage", "image": IMG("recepteur-embrayage"), "search_keyword": "Butée de débrayage", "children": []},
                    {"slug": "volant-moteur", "label": "Volant moteur", "image": IMG("emetteur-embrayage"), "search_keyword": "Volant moteur", "children": []},
                    {"slug": "filtre-boite", "label": "Filtre boîte", "image": IMG("butee-embrayage"), "search_keyword": "Boîte, filtre à air", "children": []},
                    {"slug": "cable-vitesse", "label": "Câble vitesse", "image": IMG("volant-moteur"), "search_keyword": "Tirette à câble, boîte de vitesse manuelle", "children": []},
                ],
                "parts": [],
            },
            {
                "slug": "suspension",
                "label": "Suspension",
                "image": IMG("suspension"),
                "children": [
                    {
                        "slug": "av", "label": "Avant (AV) / Arrière (AR)", "image": IMG("triangle-av"), "children": [
                        {"slug": "amortisseur", "label": "Amortisseur", "image": IMG("ressort-boudin-av"), "search_keyword": "Amortisseur", "children": []},
                        {"slug": "triangle-av", "label": "Triangle", "image": IMG("moyeu-av"), "children": [
                            {"slug": "triangle", "label": "Triangle", "image": IMG("rotule-sup"), "search_keyword": "Rotule de suspension", "children": []},
                            {"slug": "rotule-sup", "label": "Rotule supérieure", "image": IMG("rotule-sup"), "search_keyword": "Rotule de suspension", "children": []},
                            {"slug": "silent-bloc", "label": "Silent bloc", "image": IMG("silent-bloc"), "search_keyword": "Suspension, bras de liaison", "children": []},
                        ]},
                        {"slug": "biellette-suspension-av", "label": "Biellette suspension", "image": IMG("rotule-sup"), "search_keyword": "Entretoise/tige, stabilisateur", "children": []},
                        {"slug": "ressort-boudin-av", "label": "Ressort à boudin", "image": IMG("roulement-av"), "search_keyword": "Ressort de suspension", "children": []},
                        {"slug": "moyeu-av", "label": "Moyeu", "image": IMG("ressort-boudin-av"), "search_keyword": "Kit de roulements de roue", "children": []},
                        {"slug": "roulement-av", "label": "Roulement", "image": IMG("fusee-moyeu-av"), "search_keyword": "Kit de roulements de roue", "children": []},
                        {"slug": "toc-amortisseur-ar", "label": "Toc amortisseur AR", "image": IMG("cremaillere"), "search_keyword": "Coupelle de suspension", "children": []},
                        {"slug": "antichoc", "label": "Antichoc", "image": IMG("toc-amortisseur-ar"), "search_keyword": "Butée élastique, suspension", "children": []},
                        {"slug": "fusee-moyeu-av", "label": "Fusée moyeu AV", "image": IMG("rotule-direction"), "search_keyword": "Fusée d'essieu, suspension de roue", "children": []},
                    ]},
                    {"slug": "direction", "label": "Direction", "image": IMG("biellette-direction"), "children": [
                        {"slug": "cremaillere", "label": "Crémaillère", "image": IMG("biellette-direction"), "search_keyword": "Crémaillère de direction", "children": []},
                        {"slug": "rotule-direction", "label": "Rotule de direction", "image": IMG("antichoc"), "search_keyword": "Rotule de barre de connexion", "children": []},
                        {"slug": "biellette-direction", "label": "Biellette de direction", "image": IMG("silent-bloc"), "search_keyword": "Rotule de direction intérieure, barre de connexion", "children": []},
                  ]},
                ],
                "parts": [],
            },
            {
                "slug": "freinage",
                "label": "Freinage",
                "image": IMG("engine"),
                "children": [
                    {"slug": "av", "label": "Avant (AV) / Arrière (AR)", "image": IMG("av-freinage"), "children": [
                        {"slug": "plaquettes-av", "label": "Plaquettes AV", "image": IMG("plaquettes-av"), "search_keyword": "Kit de plaquettes de frein, frein à disque", "children": []},
                        {"slug": "disque-frein-av", "label": "Disque frein AV", "image": IMG("disque-frein-av"), "search_keyword": "Disque de frein", "children": []},
                        {"slug": "etrier-av", "label": "Étrier", "image": IMG("etrier-av"), "search_keyword": "Étrier de frein", "children": []},
                        {"slug": "maitre-cylindre", "label": "Maître-cylindre", "image": IMG("maitre-cylindre"), "search_keyword": "Maître-cylindre de frein", "children": []},
                        {"slug": "tambour-ar", "label": "Tambour AR", "image": IMG("tambour-ar"), "search_keyword": "Tambour de frein", "children": []},
                        {"slug": "cylindre-roue", "label": "Cylindre de roue", "image": IMG("cylindre-roue"), "search_keyword": "Cylindre de roue", "children": []},
                        {"slug": "flexible-ar", "label": "Flexible AR", "image": IMG("flexible-ar"), "search_keyword": "Flexible de frein", "children": []},
                    ]},
                ],
                "parts": [],
            },
        ],
    },
    "electrique": {
        "label": "Électrique",
        "icon": "fuses",
        "description": "Batterie, démarrage, éclairage, électronique embarquée et confort.",
        "categories": [
            {
                "slug": "optique",
                "label": "Optique G+D",
                "image": IMG("optique"),
                "search_keyword": "Kit de réparation, phare principal (support)",
                "children": [],
                "parts": [],
            },
            {
                "slug": "feu-ar",
                "label": "Feu AR G+D",
                "image": IMG("feu-ar"),
                "search_keyword": "Feu arrière",
                "children": [],
                "parts": [],
            },
            {
                "slug": "capteur-abs",
                "label": "Capteur ABS",
                "image": IMG("capteurabs"),
                "search_keyword": "Capteur, vitesse de roue",
                "children": [],
                "parts": [],
            },
            {
                "slug": "antibrouillard",
                "label": "Antibrouillard",
                "image": IMG("antibrouillard"),
                "search_keyword": "Projecteur antibrouillard",
                "children": [],
                "parts": [],
            },
            {
                "slug": "retrouneuse",
                "label": "Rétroviseur",
                "image": IMG("retroviseur"),
                "search_keyword": "Rétroviseur extérieur",
                "children": [],
                "parts": [],
            },
            {
                "slug": "klaxon",
                "label": "Klaxon",
                "image": IMG("klaxon"),
                "search_keyword": "Avertisseur sonore",
                "children": [],
                "parts": [],
            },
            {
                "slug": "batterie",
                "label": "Batterie",
                "image": IMG("batterie-electrique"),
                "search_keyword": "Batterie de démarrage",
                "parts": [],
            },
            {
                "slug": "bouton",
                "label": "bouton Lave Vitre",
                "image": IMG("bouton"),
                "search_keyword": "Interrupteur, lève-vitre",
                "parts": [],
            },
             {
                "slug": "demarreur",
                "label": "Demarreur",
                "image": IMG("dimarreur"),
                "search_keyword": "Démarreur",
                "parts": [],
            },
             {
                "slug": "bougie",
                "label": "Bougie",
                "image": IMG("bougie"),
                "search_keyword": "Bougie d'allumage",
                "parts": [],
            },
             {
                "slug": "compresseur",
                "label": "Compresseur",
                "image": IMG("compresseur"),
                "search_keyword": "Compresseur, climatisation",
                "parts": [],
            },
             {
                "slug": "condenseur",
                "label": "Condenseur",
                "image": IMG("condenseur"),
                "search_keyword": "Condenseur, climatisation",
                "parts": [],
            },
             {
                "slug": "Tuyau CLIM",
                "label": "Tuyau de climatisation",
                "image": IMG("tuyau-clim"),
                "search_keyword": "Conduite à haute pression, climatisation",
                "parts": [],
            },
             {
                "slug": "comodos-volant",
                "label": "Comodos-Volant",
                "image": IMG("comodos-volant"),
                "search_keyword": "Commutateur de colonne de direction",
                "parts": [],
            },
             {
                "slug": "alternateur",
                "label": "Alternateur",
                "image": IMG("alternateur"),
                "search_keyword": "Alternateur",
                "parts": [],
            },
        ],
    },
        "carrosserie": {
        "label": "Carrosserie",
        "icon": "car-front",
        "description": "Pare-chocs, ailes, capots, portes, vitres et pièces de carrosserie.",
        "categories": [
            {
    "slug": "av", "label": "Avant (AV)", "image": IMG("carrossiere-av"), "children": [
        {"slug": "capot-moteur", "label": "Capot moteur", "icon": "brake", "image": IMG("capot-moteur"), "search_keyword": "Capot-moteur", "children": []},
        {"slug": "aile-av", "label": "Aile AV", "icon": "brake", "image": IMG("aile-av"), "search_keyword": "Aile", "children": []},
        {"slug": "parechoc-av", "label": "Pare-choc AV", "icon": "brake", "image": IMG("parechoc-av"), "search_keyword": "Pare-chocs", "children": []},
        {"slug": "cache-moteur", "label": "Cache moteur", "icon": "brake", "image": IMG("cache-moteur"), "search_keyword": "Cache moteur", "children": []},
        {"slug": "plage-av", "label": "Plage AV", "icon": "brake", "image": IMG("support-plage"), "search_keyword": "Revêtement avant", "children": []},
        {"slug": "support-plage", "label": "Support plage", "icon": "brake", "image": IMG("support-parechoc-av"), "search_keyword": "Fixation de phare", "children": []},
        {"slug": "berceau", "label": "Berceau", "icon": "brake", "image": IMG("berceau"), "search_keyword": "Traverse", "children": []},
        {"slug": "pare-boue-av", "label": "Pare-boue AV", "icon": "brake", "image": IMG("pare-boue-av"), "search_keyword": "Garniture, passage de roue", "children": []},
        {"slug": "support-parechoc-av", "label": "Support pare-choc AV", "icon": "brake", "image": IMG("plage-av"), "search_keyword": "Support, pare-chocs", "children": []},
        {"slug": "porte-av", "label": "Porte AV", "icon": "brake", "image": IMG("porte-av"), "search_keyword": "Porte, Carrosserie", "children": []},
                {"slug": "calandre", "label": "Calandre", "icon": "brake", "image": IMG("calandre"), "search_keyword": "Grille de radiateur", "children": []},
        {"slug": "renfort", "label": "Renfort", "icon": "brake", "image": IMG("renfort"), "search_keyword": "Amortisseur de choc, pare-chocs", "children": []},
        {"slug": "spolier para choc", "label": "Spoiler para choc", "icon": "brake", "image": IMG("spolier"), "search_keyword": "Spoiler", "children": []},
        {"slug": "grille parachoc", "label": "Grille parachoc", "icon": "brake", "image": IMG("grille"), "search_keyword": "Grille de ventilation, pare-chocs", "children": []},

        {
                "slug": "retrouneuse-carrossiere",
                "label": "Rétroviseur",
                 "icon": "brake",
                "image": IMG("retroviseur-carssoiere"),
                "search_keyword": "Rétroviseur extérieur",
                "children": [],
               
            },
            {
                "slug": "antibrouillard-carrossiere",
                "label": "Antibrouillard",
                "image": IMG("antibrouillard-carssoiere"),
                "search_keyword": "Projecteur antibrouillard",
                "children": [],
                "icon": "brake",
            },
            {
                "slug": "optique-carrossiere",
                "label": "Optique G+D",
                "image": IMG("optique-carssoiere"),
                "search_keyword": "Kit de réparation, phare principal (support)",
                "children": [],
                "icon": "brake",
            },
    ]
},
{
    "slug": "ar", "label": "Arrière (AR)", "image": IMG("carrossiere-ar"), "children": [
        {"slug": "parechoc-ar", "label": "Pare-choc AR", "icon": "brake", "image": IMG("parechoc-ar"), "search_keyword": "Pare-chocs", "children": []},
        {"slug": "malle-ar", "label": "Malle AR", "icon": "brake", "image": IMG("malle-ar"), "search_keyword": "Porte arrière", "children": []},
        {"slug": "traverse-ar", "label": "Traverse AR", "icon": "brake", "image": IMG("support-parechoc-ar"), "search_keyword": "Traverse", "children": []},
        {"slug": "porte-ar", "label": "Porte AR", "icon": "brake", "image": IMG("porte-ar"), "search_keyword": "Porte, Carrosserie", "children": []},
        {"slug": "support-parechoc-ar", "label": "Support pare-choc AR", "icon": "brake", "image": IMG("traverse-ar"), "search_keyword": "Support, pare-chocs", "children": []},
    ]
},
        ],
    },
}


def get_section(section_slug: str):
    return CATALOG.get(section_slug)


def get_category(section_slug: str, category_slug: str):
    section = CATALOG.get(section_slug)
    if not section:
        return None
    for cat in section["categories"]:
        if cat["slug"] == category_slug:
            return cat
    return None


def find_part(ref: str):
    for section in CATALOG.values():
        for cat in section["categories"]:
            for part in cat["parts"]:
                if part["ref"] == ref:
                    return part
    return None



CATALOG_INDEX = {}

def build_label_index():
    index = {}

    def walk_categories(categories):
        for cat in categories:
            if not isinstance(cat, dict):
                continue

            slug = cat.get("slug")
            label = cat.get("label")

            if slug and label:
                index[slug] = label

            children = cat.get("children", [])
            if children:
                walk_categories(children)

    # sections level
    for section in CATALOG.values():
        categories = section.get("categories", [])
        walk_categories(categories)

    return index


CATALOG_INDEX = build_label_index()


def get_label_from_slug(slug: str):
    return CATALOG_INDEX.get(slug)
