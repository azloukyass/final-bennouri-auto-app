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
                        {"slug": "support-boot", "label": "Support Boot", "search_keyword": "support,moteur", "children": []},
                        {"slug": "support-moteur-d", "label": "Support Moteur D", "search_keyword": "support,moteur", "children": []},
                        {"slug": "support-moteur-g", "label": "Support Moteur G", "search_keyword": "support,moteur", "children": []},
                    ]},
                    {"slug": "kit-chaine", "label": "Kit chaîne", "search_keyword": "kit,chaine,distribution", "children": []},
                    {"slug": "pompe-a-eau", "label": "Pompe à eau", "search_keyword": "pompe,eau", "children": []},
                    {"slug": "radiateur-eau", "label": "Radiateur d'eau", "search_keyword": "radiateur,refroidissement", "children": []},
                    {"slug": "refrigerant", "label": "Réfrigérant", "search_keyword": "refrigerant,refroidisseur", "children": []},
                    {"slug": "joint-culasse", "label": "Joint culasse", "search_keyword": "culasse,joint", "children": []},
                    {"slug": "radiateur-chauffage", "label": "Radiateur chauffage", "search_keyword": "chauffage,radiateur", "children": []},
                    {"slug": "filtre-huile", "label": "Filtre à huile", "search_keyword": "huile,filtre", "children": []},
                    {"slug": "filtre-air", "label": "Filtre à air", "search_keyword": "air,filtre", "children": []},
                    {"slug": "filtre-gazoil", "label": "Filtre gazoil", "search_keyword": "gazole,carburant,filtre", "children": []},
                    {"slug": "filtre-essence", "label": "Filtre à essence", "search_keyword": "essence,carburant,filtre", "children": []},
                    {"slug": "radiateur-turbo", "label": "Radiateur turbo", "search_keyword": "turbo", "children": []},
                    {"slug": "filtre-habitacle", "label": "Filtre habitacle", "search_keyword": "habitacle,pollen,filtre", "children": []},
                    {"slug": "turbo", "label": "Turbo", "search_keyword": "turbo", "children": []},
                    {"slug": "vase-eau", "label": "Vase d'eau", "search_keyword": "vase,expansion,eau", "children": []},
                    {"slug": "tube-eau", "label": "Tube d'eau", "search_keyword": "tube,eau,durite", "children": []},
                    {"slug": "pipette-eau", "label": "Pipette d'eau", "search_keyword": "pipette,raccord", "children": []},
                    {"slug": "ventilateur", "label": "Ventilateur", "search_keyword": "ventilateur", "children": []},
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
                    {"slug": "kit-embrayage", "label": "Kit embrayage", "search_keyword": "embrayage,kit", "children": []},
                    {"slug": "recepteur-embrayage", "label": "Récepteur embrayage", "search_keyword": "embrayage,kit", "children": []},
                    {"slug": "emetteur-embrayage", "label": "Émetteur embrayage", "search_keyword": "embrayage,kit", "children": []},
                    {"slug": "butee-embrayage", "label": "Butée embrayage", "search_keyword": "embrayage,kit", "children": []},
                    {"slug": "volant-moteur", "label": "Volant moteur", "search_keyword": "volant,moteur", "children": []},
                    {"slug": "filtre-boite", "label": "Filtre boîte", "search_keyword": "boite,vitesse,transmission", "children": []},
                    {"slug": "cable-vitesse", "label": "Câble vitesse", "search_keyword": "cable,vitesse", "children": []},
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
                        {"slug": "amortisseur-av", "label": "Amortisseur AV", "search_keyword": "amortisseur,suspension", "children": []},
                        {"slug": "triangle-av", "label": "Triangle AV", "children": [
                            {"slug": "rotule-sup", "label": "Rotule supérieure", "search_keyword": "rotule,direction", "children": []},
                            {"slug": "silent-bloc", "label": "Silent bloc", "search_keyword": "silent,bloc,suspension", "children": []},
                        ]},
                        {"slug": "biellette-suspension-av", "label": "Biellette suspension AV", "search_keyword": "biellette,suspension,direction", "children": []},
                        {"slug": "ressort-boudin-av", "label": "Ressort à boudin AV", "search_keyword": "ressort,suspension", "children": []},
                        {"slug": "moyeu-av", "label": "Moyeu AV", "search_keyword": "moyeu,roulement", "children": []},
                        {"slug": "roulement-av", "label": "Roulement AV", "search_keyword": "roulement,moyeu", "children": []},
                    ]},
                    {"slug": "direction", "label": "Direction", "children": [
                        {"slug": "toc-amortisseur", "label": "Toc amortisseur", "search_keyword": "amortisseur,suspension", "children": []},
                        {"slug": "fusee-moyeu-av", "label": "Fusée moyeu AV", "search_keyword": "moyeu,roulement", "children": []},
                        {"slug": "cremaillere", "label": "Crémaillère", "search_keyword": "cremaillere,direction", "children": []},
                        {"slug": "rotule-direction", "label": "Rotule de direction", "search_keyword": "rotule,direction", "children": []},
                        {"slug": "biellette-direction", "label": "Biellette de direction", "search_keyword": "biellette,suspension,direction", "children": []},
                        {"slug": "antichoc", "label": "Antichoc", "search_keyword": "antichoc,butee,suspension", "children": []},
                    ]},
                    {"slug": "ar", "label": "Arrière (AR)", "children": [
                        {"slug": "amortisseur-ar", "label": "Amortisseur AR", "search_keyword": "amortisseur,suspension", "children": []},
                        {"slug": "biellette-suspension-ar", "label": "Biellette suspension AR", "search_keyword": "biellette,suspension,direction", "children": []},
                        {"slug": "ressort-boudin-ar", "label": "Ressort à boudin AR", "search_keyword": "ressort,suspension", "children": []},
                        {"slug": "silent-bloc-trame-ar", "label": "Silent bloc trame AR", "search_keyword": "silent,bloc,suspension", "children": []},
                        {"slug": "antichoc-ar", "label": "Antichoc AR", "search_keyword": "antichoc,butee,suspension", "children": []},
                        {"slug": "toc-amortisseur-ar", "label": "Toc amortisseur AR", "search_keyword": "amortisseur,suspension", "children": []},
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
                        {"slug": "etrier-av", "label": "Étrier AV", "search_keyword": "etrier,frein", "children": []},
                        {"slug": "maitre-cylindre", "label": "Maître-cylindre", "search_keyword": "cylindre,frein,maitre", "children": []},
                        {"slug": "servo-frein", "label": "Servo de frein", "search_keyword": "servo,frein,amplificateur", "children": []},
                    ]},
                    {"slug": "ar", "label": "Arrière (AR)", "children": [
                        {"slug": "plaquettes-ar", "label": "Plaquettes AR", "search_keyword": "plaquette,frein", "children": []},
                        {"slug": "disque-ar", "label": "Disque AR", "search_keyword": "disque,frein", "children": []},
                        {"slug": "tambour-ar", "label": "Tambour AR", "search_keyword": "tambour,frein", "children": []},
                        {"slug": "flexible-ar", "label": "Flexible AR", "search_keyword": "flexible,frein,durite", "children": []},
                        {"slug": "etrier-ar", "label": "Étrier AR", "search_keyword": "etrier,frein", "children": []},
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
                "slug": "generalites",
                "label": "Généralités",
                "icon": "fuses",
                "image": PEX(4480455),
                "sub_items": [
                    "Affectation des fusibles", "Prises / bornes / connecteurs", "Épissures",
                    "Interconnexions", "Implantations", "Boîtiers / platines / coffrets", "Divers",
                ],
                "parts": [
                    _p("EL-9001", "Kit de fusibles complet", 28.000, "FEBI", PEX(4480455)),
                    _p("EL-9003", "Boîtier de fusibles", 180.000, "BOSCH", PEX(4480455)),
                ],
            },
            {
                "slug": "electricite-moteur",
                "label": "Électricité moteur",
                "icon": "battery",
                "image": PEX(190574),
                "sub_items": [
                    "Démarrage", "Génération de courant", "Préchauffage", "Batterie", "Batterie de traction",
                ],
                "parts": [
                    _p("EL-7001", "Batterie 60Ah 540A", 240.000, "VARTA", PEX(190574)),
                    _p("EL-7002", "Batterie 70Ah 760A", 295.000, "BOSCH", PEX(190574)),
                    _p("EL-7003", "Démarreur 1.2kW", 380.000, "VALEO", PEX(190574)),
                    _p("EL-7004", "Alternateur 110A", 420.000, "DENSO", PEX(190574)),
                    _p("EL-7005", "Bougie de préchauffage (x4)", 68.000, "NGK", PEX(190574)),
                ],
            },
            {
                "slug": "faisceaux",
                "label": "Faisceaux électriques",
                "icon": "wiring",
                "image": PEX(4480455),
                "sub_items": [
                    "Connectique", "Faisceaux avant", "Faisceaux centraux",
                    "Faisceaux arrière", "Câble haute tension / 12V",
                ],
                "parts": [
                    _p("EL-9002", "Faisceau avant moteur", 320.000, "DELPHI", PEX(4480455)),
                    _p("EL-9004", "Sonde lambda", 145.000, "BOSCH", PEX(4480455)),
                ],
            },
            {
                "slug": "eclairage",
                "label": "Éclairage - signalisation",
                "icon": "headlight",
                "image": PEX(2127733),
                "sub_items": [
                    "Éclairage intérieur", "Éclairage extérieur", "Signalisation", "Commandes sous volant",
                ],
                "parts": [
                    _p("EL-8001", "Phare avant LED gauche", 480.000, "HELLA", PEX(2127733)),
                    _p("EL-8002", "Phare avant LED droit", 480.000, "HELLA", PEX(2127733)),
                    _p("EL-8003", "Feu arrière gauche", 145.000, "VALEO", PEX(112460)),
                    _p("EL-8004", "Feu arrière droit", 145.000, "VALEO", PEX(112460)),
                    _p("EL-8005", "Kit ampoules H7 LED", 95.000, "OSRAM", PEX(2127733)),
                    _p("EL-8006", "Antibrouillard avant", 110.000, "HELLA", PEX(2127733)),
                ],
            },
            {
                "slug": "informations-conducteur",
                "label": "Informations conducteur",
                "icon": "info",
                "image": PEX(3807345),
                "sub_items": [
                    "Combiné", "Messages, sons et témoins éclairage - signalisation",
                    "Messages, sons et témoins groupe motopropulseur",
                    "Messages, sons et témoins protections et ouvrants",
                    "Messages, sons et témoins poste de conduite",
                    "Messages, sons et témoins aide à la conduite",
                    "Messages, sons et témoins lavage et essuyage",
                    "Messages, sons et témoins confort et vie à bord",
                    "Messages, sons et témoins accessoires", "Systèmes d'affichage",
                ],
                "parts": [
                    _p("EL-IC-001", "Combiné d'instruments", 380.000, "VDO", PEX(3807345)),
                    _p("EL-IC-002", "Écran multifonction central", 520.000, "VALEO", PEX(3807345)),
                    _p("EL-IC-003", "Avertisseur sonore (klaxon)", 48.000, "BOSCH", PEX(4480455)),
                ],
            },
            {
                "slug": "lavage-essuyage",
                "label": "Lavage et essuyage",
                "icon": "wiper",
                "image": PEX(919073),
                "sub_items": ["Lavage", "Essuyage", "Commandes sous volant"],
                "parts": [
                    _p("EL-10001", "Balais d'essuie-glace (paire)", 42.000, "BOSCH", PEX(919073)),
                    _p("EL-10002", "Moteur essuie-glace avant", 195.000, "VALEO", PEX(919073)),
                    _p("EL-10003", "Pompe lave-glace", 38.000, "FEBI", PEX(919073)),
                    _p("EL-10004", "Balai essuie-glace arrière", 18.500, "BOSCH", PEX(919073)),
                ],
            },
            {
                "slug": "protections-ouvrants",
                "label": "Protections et ouvrants",
                "icon": "alarm",
                "image": PEX(244553),
                "sub_items": [
                    "Antidémarrage", "Alarme", "Verrouillage / déverrouillage",
                    "Porte latérale coulissante", "Lève-vitres", "Coffre motorisé",
                    "Ceintures de sécurité", "Coussins gonflables", "Choc piéton", "Toit / rideau",
                ],
                "parts": [
                    _p("EL-11001", "Alarme antivol universelle", 240.000, "COBRA", PEX(244553)),
                    _p("EL-11002", "Moteur lève-vitre avant", 165.000, "VALEO", PEX(1638459)),
                    _p("EL-11003", "Centrale clignotants", 35.000, "HELLA", PEX(4480455)),
                    _p("EL-PO-004", "Ceinture de sécurité avant", 95.000, "TRW", PEX(244553)),
                ],
            },
            {
                "slug": "poste-conduite",
                "label": "Poste de conduite",
                "icon": "seat",
                "image": PEX(3807345),
                "sub_items": [
                    "Rétroviseurs", "Colonne de direction", "Sièges",
                    "Mémorisation poste de conduite", "Commandes sous volant",
                ],
                "parts": [
                    _p("EL-PC-001", "Rétroviseur intérieur jour/nuit", 45.000, "OEM", PEX(100650)),
                    _p("EL-PC-002", "Module mémorisation siège", 280.000, "OEM", PEX(3807345)),
                    _p("EL-PC-003", "Commodo sous volant gauche", 95.000, "VALEO", PEX(3807345)),
                ],
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
                {"slug": "capot-moteur", "label": "Capot moteur", "icon": "brake", "image": PEX(1545743), "children": []},
                {"slug": "aile-av", "label": "Aile AV", "icon": "brake", "image": PEX(1545743), "children": []},
                {
                    "slug": "parechoc-av", "label": "Pare-choc AV", "icon": "brake", "image": PEX(1545743), "children": [
                    {"slug": "spoiler", "label": "Spoiler", "icon": "brake", "image": PEX(1545743), "children": []},
                    {"slug": "grille-centrale", "label": "Grille centrale", "icon": "brake",  "image": PEX(1545743), "children": []},
                    {"slug": "cache-antibrouillard", "label": "Cache antibrouillard", "icon": "brake", "image": PEX(1545743),
                     "children": []},
                ]
                },
                {"slug": "cache-moteur", "label": "Cache moteur", "icon": "brake", "image": PEX(1545743), "children": []},
                {"slug": "calandre", "label": "Calandre", "icon": "brake",  "image": PEX(1545743), "children": []},
                {"slug": "plage-av", "label": "Plage AV",  "icon": "brake", "image": PEX(1545743), "children": []},
                {"slug": "support-plage", "label": "Support plage", "icon": "brake", "image": PEX(1545743), "children": []},
                {"slug": "traverse-sup", "label": "Traverse supérieure", "icon": "brake", "image": PEX(1545743), "children": []},
                {"slug": "traverse-sup-inf", "label": "Traverse Sup/Inf", "icon": "brake", "image": PEX(1545743), "children": []},
                {"slug": "berceau", "label": "Berceau", "icon": "brake", "image": PEX(1545743), "children": []},
                {"slug": "pare-boue-av", "label": "Pare-boue AV", "icon": "brake", "image": PEX(1545743), "children": []},
                {"slug": "support-parechoc-av", "label": "Support pare-choc AV", "icon": "brake", "image": PEX(1545743), "children": []},
                {"slug": "porte-av", "label": "Porte AV", "icon": "brake", "image": PEX(1545743), "children": []},
                {"slug": "support-parachoc-av2", "label": "Support paracloc AV", "icon": "brake", "image": PEX(1545743), "children": []},
            ]
            },
            {
                "slug": "ar", "label": "Arrière (AR)", "icon": "brake",  "image": PEX(1545743), "children": [
                {"slug": "parechoc-ar", "label": "Pare-choc AR", "icon": "brake", "image": PEX(1545743), "children": []},
                {"slug": "malle-ar", "label": "Malle AR",  "icon": "brake", "image": PEX(1545743), "children": []},
                {"slug": "traverse-ar", "label": "Traverse AR", "icon": "brake", "image": PEX(1545743), "children": []},
                {"slug": "porte-ar", "label": "Porte AR", "icon": "brake", "image": PEX(1545743), "children": []},
                {"slug": "support-parechoc-ar", "label": "Support pare-choc AR", "icon": "brake", "image": PEX(1545743), "children": []},
                {"slug": "jeep-ar", "label": "Jeep AR",  "icon": "brake", "image": PEX(1545743), "children": []},
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
