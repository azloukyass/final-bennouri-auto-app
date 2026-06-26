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


CATALOG = {
    "mecanique": {
        "label": "Mécanique",
        "icon": "engine",
        "description": "Moteur, boîte de vitesses, suspension et freinage.",
        "categories": [
            {
                "slug": "moteur",
                "label": "Moteur",
                "icon": "engine",
                "image": PEX(4489732),
                "children": [
                    {"slug": "support-moteur", "label": "Support moteur", "search_keyword": "support,moteur", "children": [
                        {"slug": "support-boot", "label": "Support Boot", "search_keyword": "support,boite,automatique", "children": []},
                        {"slug": "support-moteur-d", "label": "Support Moteur D", "search_keyword": "support,moteur", "children": []},
                        {"slug": "support-moteur-g", "label": "Support Moteur G", "search_keyword": "support,moteur", "children": []},
                    ]},
                    {"slug": "kit-chaine", "label": "Kit chaîne", "search_keyword": "kit,chaine,distribution", "children": []},
                    {"slug": "pompe-a-eau", "label": "Pompe à eau", "search_keyword": "pompe,eau", "children": []},
                    {"slug": "radiateur-eau", "label": "Radiateur d'eau", "search_keyword": "caisse,eau,radiateur", "children": []},
                    {"slug": "refrigerant", "label": "Réfrigérant", "search_keyword": "refrigerant,refroidisseur", "children": []},
                    {"slug": "joint-culasse", "label": "Joint culasse", "search_keyword": "joint,etancheite,culasse", "children": []},
                    {"slug": "radiateur-chauffage", "label": "Radiateur chauffage", "search_keyword": "chauffage,radiateur", "children": []},
                    {"slug": "filtre-huile", "label": "Filtre à huile", "search_keyword": "filtre,huile", "children": []},
                    {"slug": "filtre-air", "label": "Filtre à air", "search_keyword": "filtre,air", "children": []},
                    {"slug": "filtre-gazoil", "label": "Filtre gazoil", "search_keyword": "gazole,carburant,filtre", "children": []},
                    {"slug": "filtre-essence", "label": "Filtre à essence", "search_keyword": "essence,carburant,filtre", "children": []},
                    {"slug": "radiateur-turbo", "label": "Radiateur turbo", "search_keyword": "turbo", "children": []},
                    {"slug": "filtre-habitacle", "label": "Filtre habitacle", "search_keyword": "filtre,air,habitacle", "children": []},
                    {"slug": "turbo", "label": "Turbo", "search_keyword": "turbo", "children": []},
                    {"slug": "vase-eau", "label": "Vase d'eau", "search_keyword": "condenseur,climatisation", "children": []},
                    {"slug": "tube-eau", "label": "Tube d'eau", "search_keyword": "tube,eau,durite", "children": []},
                    {"slug": "pipette-eau", "label": "Pipette d'eau", "search_keyword": "pipette,raccord", "children": []},
                    {"slug": "ventilateur", "label": "Ventilateur", "search_keyword": "ventilateur,refroidissement,moteur", "children": []},
                    {"slug": "injecteur", "label": "Injecteur", "search_keyword": "injecteur", "children": []},
                    {"slug": "pompe-assistee", "label": "Pompe assistée", "search_keyword": "pompe", "children": []},
                ],
                "parts": [],
            },
            {
                "slug": "boite-vitesses",
                "label": "Boîte de vitesses",
                "icon": "gearbox",
                "image": PEX(13065690),
                "children": [
                    {"slug": "kit-embrayage", "label": "Kit embrayage", "search_keyword": "kit,embrayage", "children": []},
                    {"slug": "recepteur-embrayage", "label": "Récepteur embrayage", "search_keyword": "cylindre,recepteur,embrayage", "children": []},
                    {"slug": "emetteur-embrayage", "label": "Émetteur embrayage", "search_keyword": "cylindre,emetteur,embrayage", "children": []},
                    {"slug": "butee-embrayage", "label": "Butée embrayage", "search_keyword": "butee,embrayage", "children": []},
                    {"slug": "volant-moteur", "label": "Volant moteur", "search_keyword": "volant,moteur", "children": []},
                    {"slug": "filtre-boite", "label": "Filtre boîte", "search_keyword": "boite,vitesse,transmission", "children": []},
                    {"slug": "cable-vitesse", "label": "Câble vitesse", "search_keyword": "tirette,cable,boite,vitesse", "children": []},
                ],
                "parts": [],
            },
            {
                "slug": "suspension",
                "label": "Suspension",
                "icon": "suspension",
                "image": PEX(4480456),
                "children": [
                    {"slug": "av", "label": "Avant (AV)", "children": [
                        {"slug": "amortisseur-av", "label": "Amortisseur AV", "search_keyword": "amortisseur", "children": []},
                        {"slug": "triangle-av", "label": "Triangle AV", "children": [
                            {"slug": "rotule-sup", "label": "Rotule supérieure", "search_keyword": "rotule,suspension", "children": []},
                            {"slug": "silent-bloc", "label": "Silent bloc", "search_keyword": "silent,bloc,suspension", "children": []},
                        ]},
                        {"slug": "biellette-suspension-av", "label": "Biellette suspension AV", "search_keyword": "biellette,suspension,direction", "children": []},
                        {"slug": "ressort-boudin-av", "label": "Ressort à boudin AV", "search_keyword": "ressort,suspension", "children": []},
                        {"slug": "moyeu-av", "label": "Moyeu AV", "search_keyword": "moyeu,roue", "children": []},
                        {"slug": "roulement-av", "label": "Roulement AV", "search_keyword": "kit,roulement,roue", "children": []},
                    ]},
                    {"slug": "direction", "label": "Direction", "children": [
                        {"slug": "toc-amortisseur", "label": "Toc amortisseur", "search_keyword": "toc,amortisseur", "children": []},
                        {"slug": "fusee-moyeu-av", "label": "Fusée moyeu AV", "search_keyword": "moyeu,roulement", "children": []},
                        {"slug": "cremaillere", "label": "Crémaillère", "search_keyword": "cremaillere,direction", "children": []},
                        {"slug": "rotule-direction", "label": "Rotule de direction", "search_keyword": "rotule,barre,connexion", "children": []},
                        {"slug": "biellette-direction", "label": "Biellette de direction", "search_keyword": "biellette,suspension,direction", "children": []},
                        {"slug": "antichoc", "label": "Antichoc", "search_keyword": "antichoc,butee,suspension", "children": []},
                    ]},
                    {"slug": "ar", "label": "Arrière (AR)", "children": [
                        {"slug": "amortisseur-ar", "label": "Amortisseur AR", "search_keyword": "amortisseur", "children": []},
                        {"slug": "biellette-suspension-ar", "label": "Biellette suspension AR", "search_keyword": "biellette,suspension,direction", "children": []},
                        {"slug": "ressort-boudin-ar", "label": "Ressort à boudin AR", "search_keyword": "ressort,suspension", "children": []},
                        {"slug": "silent-bloc-trame-ar", "label": "Silent bloc trame AR", "search_keyword": "silent,bloc,suspension", "children": []},
                        {"slug": "antichoc-ar", "label": "Antichoc AR", "search_keyword": "antichoc,butee,suspension", "children": []},
                        {"slug": "toc-amortisseur-ar", "label": "Toc amortisseur AR", "search_keyword": "toc,amortisseur", "children": []},
                    ]},
                ],
                "parts": [],
            },
            {
                "slug": "freinage",
                "label": "Freinage",
                "icon": "brake",
                "image": PEX(1545743),
                "children": [
                    {"slug": "av", "label": "Avant (AV)", "children": [
                        {"slug": "plaquettes-av", "label": "Plaquettes AV", "search_keyword": "plaquette,frein", "children": []},
                        {"slug": "disque-frein-av", "label": "Disque frein AV", "search_keyword": "disque,frein", "children": []},
                        {"slug": "etrier-av", "label": "Étrier AV", "search_keyword": "etrier", "children": []},
                        {"slug": "maitre-cylindre", "label": "Maître-cylindre", "search_keyword": "maitre,cylindre,frein", "children": []},
                        {"slug": "servo-frein", "label": "Servo de frein", "search_keyword": "servo,frein,amplificateur", "children": []},
                    ]},
                    {"slug": "ar", "label": "Arrière (AR)", "children": [
                        {"slug": "plaquettes-ar", "label": "Plaquettes AR", "search_keyword": "plaquette,frein", "children": []},
                        {"slug": "disque-ar", "label": "Disque AR", "search_keyword": "disque,frein", "children": []},
                        {"slug": "tambour-ar", "label": "Tambour AR", "search_keyword": "tambour,frein", "children": []},
                        {"slug": "flexible-ar", "label": "Flexible AR", "search_keyword": "flexible,frein,durite", "children": []},
                        {"slug": "etrier-ar", "label": "Étrier AR", "search_keyword": "etrier", "children": []},
                        {"slug": "cylindre-roue", "label": "Cylindre de roue", "search_keyword": "cylindre,frein,maitre", "children": []},
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
                "slug": "bougie",
                "label": "Bougie",
                "icon": "engine",
                "image": PEX(4489732),
                "children": [
                    {"slug": "Bouton lave-vitre", "label": "Bouton lave-vitre", "children": [
                    ]},
                ],
                "parts": [],
            },
            {
                "slug": "bobine-allumage",
                "label": "Bobine d'allumage",
                "icon": "gearbox",
                "image": PEX(13065690),
                "children": [
                    {"slug": "Bouton lave-vitre", "label": "Bouton lave-vitre", "children": [
                    ]},
                ],
                "parts": [],
            },
            {
                "slug": "optique",
                "label": "Optique G+D",
                "icon": "suspension",
                "image": PEX(4480456),
                "children": [
                    {"slug": "Bouton lave-vitre", "label": "Bouton lave-vitre", "children": [
                    ]},
                ],
                "parts": [],
            },
            {
                "slug": "feu-ar",
                "label": "Feu AR G+D",
                "icon": "brake",
                "image": PEX(1545743),
                "children": [
                    {"slug": "Bouton lave-vitre", "label": "Bouton lave-vitre", "children": [
                    ]},
                ],
                "parts": [],
            },
            {
                "slug": "feu-de-position",
                "label": "Feu de position",
                "icon": "brake",
                "image": PEX(1545743),
                "children": [
                    {"slug": "Bouton lave-vitre", "label": "Bouton lave-vitre", "children": [
                    ]},
                ],
                "parts": [],
            },
            {
                "slug": "culipe-bougie",
                "label": "Culipe bougie",
                "icon": "brake",
                "image": PEX(1545743),
                "children": [
                    {"slug": "Bouton lave-vitre", "label": "Bouton lave-vitre", "children": [
                    ]},
                ],
                "parts": [],
            },
            {
                "slug": "capteur-arb-acave",
                "label": "Capteur ARB A'Cave",
                "icon": "brake",
                "image": PEX(1545743),
                "children": [
                    {"slug": "Bouton lave-vitre", "label": "Bouton lave-vitre", "children": [
                    ]},
                ],
                "parts": [],
            },
            {
                "slug": "capteur-abs",
                "label": "Capteur ABS",
                "icon": "brake",
                "image": PEX(1545743),
                "children": [
                    {"slug": "Bouton lave-vitre", "label": "Bouton lave-vitre", "children": [
                    ]},
                ],
                "parts": [],
            },
            {
                "slug": "antibrouillard",
                "label": "Antibrouillard",
                "icon": "brake",
                "image": PEX(1545743),
                "children": [
                    {"slug": "Bouton lave-vitre", "label": "Bouton lave-vitre", "children": [
                    ]},
                ],
                "parts": [],
            },
            {
                "slug": "retrouneuse",
                "label": "Rétroviseur",
                "icon": "brake",
                "image": PEX(1545743),
                "children": [
                    {"slug": "Bouton lave-vitre", "label": "Bouton lave-vitre", "children": [
                    ]},
                ],
                "parts": [],
            },
            {
                "slug": "porte-pass",
                "label": "Porte Pass",
                "icon": "brake",
                "image": PEX(1545743),
                "children": [
                    {"slug": "Bouton lave-vitre", "label": "Bouton lave-vitre", "children": [
                    ]},
                ],
                "parts": [],
            },
            {
                "slug": "klaxon",
                "label": "Klaxon",
                "icon": "brake",
                "image": PEX(1545743),
                "children": [
                    {"slug": "Bouton lave-vitre", "label": "Bouton lave-vitre", "children": [
                    ]},
                ],
                "parts": [],
            },
            {
                "slug": "sond-pompe-a",
                "label": "Sonde pompe A",
                "icon": "brake",
                "image": PEX(1545743),
                "children": [
                    {"slug": "Boulon lave-vitre", "label": "Bouton lave-vitre", "children": [
                    ]},
                ],
                "parts": [],
            },
            {
                "slug": "batterie",
                "label": "Batterie",
                "icon": "brake",
                "image": PEX(1545743),
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
                "slug": "av", "label": "Avant (AV)", "icon": "brake", "image": PEX(1545743), "children": [
                {"slug": "capot-moteur", "label": "Capot moteur", "icon": "brake", "image": PEX(1545743), "search_keyword": "capot,moteur", "children": []},
                {"slug": "aile-av", "label": "Aile AV", "icon": "brake", "image": PEX(1545743), "search_keyword": "aile", "children": []},
                {
                    "slug": "parechoc-av", "label": "Pare-choc AV", "icon": "brake", "image": PEX(1545743), "search_keyword": "pare-chocs", "children": [
                    {"slug": "spoiler", "label": "Spoiler", "icon": "brake", "image": PEX(1545743), "search_keyword": "spoiler", "children": []},
                    {"slug": "grille-centrale", "label": "Grille centrale", "icon": "brake",  "image": PEX(1545743), "search_keyword": "grille,radiateur", "children": []},
                    {"slug": "cache-antibrouillard", "label": "Cache antibrouillard", "icon": "brake", "image": PEX(1545743),
                     "search_keyword": "antibrouillard", "children": []},
                ]
                },
                {"slug": "cache-moteur", "label": "Cache moteur", "icon": "brake", "image": PEX(1545743), "search_keyword": "cache,moteur", "children": []},
                {"slug": "calandre", "label": "Calandre", "icon": "brake",  "image": PEX(1545743), "search_keyword": "calandre,radiateur,grille", "children": []},
                {"slug": "plage-av", "label": "Plage AV",  "icon": "brake", "image": PEX(1545743), "search_keyword": "plage", "children": []},
                {"slug": "support-plage", "label": "Support plage", "icon": "brake", "image": PEX(1545743), "search_keyword": "fixation,phare", "children": []},
                {"slug": "traverse-sup", "label": "Traverse supérieure", "icon": "brake", "image": PEX(1545743), "search_keyword": "traverse", "children": []},
                {"slug": "traverse-sup-inf", "label": "Traverse Sup/Inf", "icon": "brake", "image": PEX(1545743), "search_keyword": "traverse", "children": []},
                {"slug": "berceau", "label": "Berceau", "icon": "brake", "image": PEX(1545743), "search_keyword": "plot,berceau,agregats", "children": []},
                {"slug": "pare-boue-av", "label": "Pare-boue AV", "icon": "brake", "image": PEX(1545743), "search_keyword": "pare-boue", "children": []},
                {"slug": "support-parechoc-av", "label": "Support pare-choc AV", "icon": "brake", "image": PEX(1545743), "search_keyword": "support,pare-chocs", "children": []},
                {"slug": "porte-av", "label": "Porte AV", "icon": "brake", "image": PEX(1545743), "search_keyword": "porte,carrosserie", "children": []},
                {"slug": "support-parachoc-av2", "label": "Support paracloc AV", "icon": "brake", "image": PEX(1545743), "search_keyword": "support,pare-chocs", "children": []},
            ]
            },
            {
                "slug": "ar", "label": "Arrière (AR)", "icon": "brake",  "image": PEX(1545743), "children": [
                {"slug": "parechoc-ar", "label": "Pare-choc AR", "icon": "brake", "image": PEX(1545743), "search_keyword": "pare-chocs", "children": []},
                {"slug": "malle-ar", "label": "Malle AR",  "icon": "brake", "image": PEX(1545743), "search_keyword": "porte,arriere", "children": []},
                {"slug": "traverse-ar", "label": "Traverse AR", "icon": "brake", "image": PEX(1545743), "search_keyword": "traverse", "children": []},
                {"slug": "porte-ar", "label": "Porte AR", "icon": "brake", "image": PEX(1545743), "search_keyword": "porte,carrosserie", "children": []},
                {"slug": "support-parechoc-ar", "label": "Support pare-choc AR", "icon": "brake", "image": PEX(1545743), "search_keyword": "support,pare-chocs", "children": []},
                {"slug": "jeep-ar", "label": "Jeep AR",  "icon": "brake", "image": PEX(1545743), "search_keyword": "jeep,arriere", "children": []},
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
