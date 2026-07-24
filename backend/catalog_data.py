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
                    {"slug": "support-moteur-d", "label": "Support Moteur D/G", "search_keyword": "Support moteur", "children": []},
                    {"slug": "kit-chaine", "label": "Kit chaîne", "search_keyword": "Kit,chaine,distribution", "split_keywords": True, "children": []},
                    {"slug": "pompe-a-eau", "label": "Pompe à eau", "search_keyword": "Pompe à eau, refroidissement du moteur", "children": []},
                    {"slug": "radiateur-eau", "label": "Radiateur d'eau", "search_keyword": "Caisse à eau, radiateur", "children": []},
                    {"slug": "joint-culasse", "label": "Joint culasse", "search_keyword": "Joint d'étanchéité, culasse", "children": []},
                    {"slug": "radiateur-chauffage", "label": "Radiateur chauffage", "search_keyword": "Système de chauffage", "children": []},
                    {"slug": "filtre-huile", "label": "Filtre à huile", "search_keyword": "Filtre à huile", "children": []},
                    {"slug": "filtre-air", "label": "Filtre à air", "search_keyword": "Filtre à air", "children": []},
                    {"slug": "filtre-gazoil", "label": "Filtre gazoil / Filtre à essence", "search_keyword": "Filtre à carburant", "children": []},
                    {"slug": "radiateur-turbo", "label": "Radiateur turbo", "search_keyword": "Intercooler, échangeur", "children": []},
                    {"slug": "filtre-habitacle", "label": "Filtre habitacle", "search_keyword": "Filtre, air de l'habitacle", "children": []},
                    {"slug": "turbo", "label": "Turbo", "search_keyword": "Turbocompresseur, suralimentation", "children": []},
                    {"slug": "vase-eau", "label": "Vase d'eau", "search_keyword": "Vase d'expansion, liquide de refroidissement", "children": []},
                    {"slug": "ventilateur", "label": "Ventilateur", "search_keyword": "Ventilateur, refroidissement du moteur", "children": []},
                    {"slug": "pompe-assistee", "label": "Pompe assistée", "search_keyword": "Pompe hydraulique, direction", "children": []},
                ],
                "parts": [],
            },
            {
                "slug": "boite-vitesses",
                "label": "Boîte de vitesses",
                "image": IMG("boite-vitesses"),
                "children": [
                    {"slug": "kit-embrayage", "label": "Kit embrayage", "search_keyword": "Kit d'embrayage", "children": []},
                    {"slug": "recepteur-embrayage", "label": "Récepteur embrayage", "search_keyword": "Cylindre récepteur, embrayage", "children": []},
                    {"slug": "emetteur-embrayage", "label": "Émetteur embrayage", "search_keyword": "Cylindre émetteur, embrayage", "children": []},
                    {"slug": "butee-embrayage", "label": "Butée embrayage", "search_keyword": "Butée de débrayage", "children": []},
                    {"slug": "volant-moteur", "label": "Volant moteur", "search_keyword": "Volant moteur", "children": []},
                    {"slug": "filtre-boite", "label": "Filtre boîte", "search_keyword": "Boîte, filtre à air", "children": []},
                    {"slug": "cable-vitesse", "label": "Câble vitesse", "search_keyword": "Tirette à câble, boîte de vitesse manuelle", "children": []},
                ],
                "parts": [],
            },
            {
                "slug": "suspension",
                "label": "Suspension",
                "image": IMG("suspension"),
                "children": [
                    {"slug": "av", "label": "Avant (AV) / Arrière (AR)", "children": [
                        {"slug": "amortisseur", "label": "Amortisseur", "search_keyword": "Amortisseur", "children": []},
                        {"slug": "triangle-av", "label": "Triangle", "children": [
                            {"slug": "rotule-sup", "label": "Rotule supérieure", "search_keyword": "Rotule de suspension", "children": []},
                            {"slug": "silent-bloc", "label": "Silent bloc", "search_keyword": "Suspension, bras de liaison", "children": []},
                        ]},
                        {"slug": "biellette-suspension-av", "label": "Biellette suspension", "search_keyword": "Jeu de bras, suspension de roue", "children": []},
                        {"slug": "ressort-boudin-av", "label": "Ressort à boudin", "search_keyword": "Ressort de suspension", "children": []},
                        {"slug": "moyeu-av", "label": "Moyeu", "search_keyword": "Moyeu de roue", "children": []},
                        {"slug": "roulement-av", "label": "Roulement", "search_keyword": "Kit de roulements de roue", "children": []},
                        {"slug": "toc-amortisseur-ar", "label": "Toc amortisseur AR", "search_keyword": "Toc amortisseur", "children": []},
                    ]},
                    {"slug": "direction", "label": "Direction", "children": [
                        {"slug": "toc-amortisseur", "label": "Toc amortisseur", "search_keyword": "Kit de réparation, coupelle de suspension", "children": []},
                        {"slug": "fusee-moyeu-av", "label": "Fusée moyeu AV", "search_keyword": "Fusée d'essieu, suspension de roue", "children": []},
                        {"slug": "cremaillere", "label": "Crémaillère", "search_keyword": "Crémaillère de direction", "children": []},
                        {"slug": "rotule-direction", "label": "Rotule de direction", "search_keyword": "Rotule de barre de connexion", "children": []},
                        {"slug": "biellette-direction", "label": "Biellette de direction", "search_keyword": "Rotule de direction intérieure, barre de connexion", "children": []},
                        {"slug": "antichoc", "label": "Antichoc", "search_keyword": "Butée élastique, suspension", "children": []},
                    ]},
                ],
                "parts": [],
            },
            {
                "slug": "freinage",
                "label": "Freinage",
                "image": IMG("engine"),
                "children": [
                    {"slug": "av", "label": "Avant (AV) / Arrière (AR)", "children": [
                        {"slug": "plaquettes-av", "label": "Plaquettes AV", "search_keyword": "Kit de plaquettes de frein, frein à disque", "children": []},
                        {"slug": "disque-frein-av", "label": "Disque frein AV", "search_keyword": "Disque de frein", "children": []},
                        {"slug": "etrier-av", "label": "Étrier", "search_keyword": "Étrier de frein", "children": []},
                        {"slug": "maitre-cylindre", "label": "Maître-cylindre", "search_keyword": "Maître-cylindre de frein", "children": []},
                        {"slug": "tambour-ar", "label": "Tambour AR", "search_keyword": "Tambour de frein", "children": []},
                        {"slug": "cylindre-roue", "label": "Cylindre de roue", "search_keyword": "Cylindre de roue", "children": []},
                        {"slug": "flexible-ar", "label": "Flexible AR", "search_keyword": "Flexible de frein", "children": []},
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
                "image": IMG("batterie"),
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
        ],
    },
        "carrosserie": {
        "label": "Carrosserie",
        "icon": "car-front",
        "description": "Pare-chocs, ailes, capots, portes, vitres et pièces de carrosserie.",
        "categories": [
            {
                "slug": "av", "label": "Avant (AV)", "image": IMG("crarossiere-av"), "children": [
                {"slug": "capot-moteur", "label": "Capot moteur", "icon": "brake", "image": PEX(1545743), "search_keyword": "Capot-moteur", "children": []},
                {"slug": "aile-av", "label": "Aile AV", "icon": "brake", "image": PEX(1545743), "search_keyword": "Aile", "children": []},
                {"slug": "parechoc-av", "label": "Pare-choc AV", "icon": "brake", "image": PEX(1545743), "search_keyword": "Pare-chocs", "children": []},
                {"slug": "cache-moteur", "label": "Cache moteur", "icon": "brake", "image": PEX(1545743), "search_keyword": "Cache moteur", "children": []},
                {"slug": "plage-av", "label": "Plage AV",  "icon": "brake", "image": PEX(1545743), "search_keyword": "Revêtement avant", "children": []},
                {"slug": "support-plage", "label": "Support plage", "icon": "brake", "image": PEX(1545743), "search_keyword": "Fixation de phare", "children": []},
                {"slug": "berceau", "label": "Berceau", "icon": "brake", "image": PEX(1545743), "search_keyword": "Traverse", "children": []},
                {"slug": "pare-boue-av", "label": "Pare-boue AV", "icon": "brake", "image": PEX(1545743), "search_keyword": "Garniture, passage de roue", "children": []},
                {"slug": "support-parechoc-av", "label": "Support pare-choc AV", "icon": "brake", "image": PEX(1545743), "search_keyword": "Support, pare-chocs", "children": []},
                {"slug": "porte-av", "label": "Porte AV", "icon": "brake", "image": PEX(1545743), "search_keyword": "Porte, Carrosserie", "children": []},
            ]
            },
            {
                "slug": "ar", "label": "Arrière (AR)", "image": IMG("crarossiere-ar"), "children": [
                {"slug": "parechoc-ar", "label": "Pare-choc AR", "icon": "brake", "image": PEX(1545743), "search_keyword": "Pare-chocs", "children": []},
                {"slug": "malle-ar", "label": "Malle AR",  "icon": "brake", "image": PEX(1545743), "search_keyword": "Porte arrière", "children": []},
                {"slug": "traverse-ar", "label": "Traverse AR", "icon": "brake", "image": PEX(1545743), "search_keyword": "Traverse", "children": []},
                {"slug": "porte-ar", "label": "Porte AR", "icon": "brake", "image": PEX(1545743), "search_keyword": "Porte, Carrosserie", "children": []},
                {"slug": "support-parechoc-ar", "label": "Support pare-choc AR", "icon": "brake", "image": PEX(1545743), "search_keyword": "Support, pare-chocs", "children": []},
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