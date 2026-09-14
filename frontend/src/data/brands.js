/**
 * Brands data — logos via simpleicons CDN (real brand color; CSS handles grayscale→color on hover)
 * Models with diverse real car photos from Unsplash/Pexels.
 */

// Image pools per body type — randomized assignment so each model has a different photo
const POOLS = {
  hatchback: [
    "https://images.pexels.com/photos/170811/pexels-photo-170811.jpeg?auto=compress&cs=tinysrgb&w=700",
    "https://images.pexels.com/photos/3786091/pexels-photo-3786091.jpeg?auto=compress&cs=tinysrgb&w=700",
    "https://images.pexels.com/photos/120049/pexels-photo-120049.jpeg?auto=compress&cs=tinysrgb&w=700",
    "https://images.pexels.com/photos/305070/pexels-photo-305070.jpeg?auto=compress&cs=tinysrgb&w=700",
    "https://images.pexels.com/photos/3608542/pexels-photo-3608542.jpeg?auto=compress&cs=tinysrgb&w=700",
    "https://images.pexels.com/photos/1592384/pexels-photo-1592384.jpeg?auto=compress&cs=tinysrgb&w=700",
  ],
  sedan: [
    "https://images.pexels.com/photos/170811/pexels-photo-170811.jpeg?auto=compress&cs=tinysrgb&w=700",
    "https://images.pexels.com/photos/810357/pexels-photo-810357.jpeg?auto=compress&cs=tinysrgb&w=700",
    "https://images.pexels.com/photos/116675/pexels-photo-116675.jpeg?auto=compress&cs=tinysrgb&w=700",
    "https://images.pexels.com/photos/97075/pexels-photo-97075.jpeg?auto=compress&cs=tinysrgb&w=700",
    "https://images.pexels.com/photos/164634/pexels-photo-164634.jpeg?auto=compress&cs=tinysrgb&w=700",
    "https://images.pexels.com/photos/1149831/pexels-photo-1149831.jpeg?auto=compress&cs=tinysrgb&w=700",
    "https://images.pexels.com/photos/3954422/pexels-photo-3954422.jpeg?auto=compress&cs=tinysrgb&w=700",
  ],
  suv: [
    "https://images.pexels.com/photos/2127733/pexels-photo-2127733.jpeg?auto=compress&cs=tinysrgb&w=700",
    "https://images.pexels.com/photos/24353/pexels-photo.jpg?auto=compress&cs=tinysrgb&w=700",
    "https://images.pexels.com/photos/1592384/pexels-photo-1592384.jpeg?auto=compress&cs=tinysrgb&w=700",
    "https://images.pexels.com/photos/13861/IMG_3496bfree.jpg?auto=compress&cs=tinysrgb&w=700",
    "https://images.pexels.com/photos/210019/pexels-photo-210019.jpeg?auto=compress&cs=tinysrgb&w=700",
    "https://images.pexels.com/photos/3954425/pexels-photo-3954425.jpeg?auto=compress&cs=tinysrgb&w=700",
    "https://images.pexels.com/photos/3729464/pexels-photo-3729464.jpeg?auto=compress&cs=tinysrgb&w=700",
  ],
  van: [
    "https://images.pexels.com/photos/2533092/pexels-photo-2533092.jpeg?auto=compress&cs=tinysrgb&w=700",
    "https://images.pexels.com/photos/2516118/pexels-photo-2516118.jpeg?auto=compress&cs=tinysrgb&w=700",
    "https://images.pexels.com/photos/1112597/pexels-photo-1112597.jpeg?auto=compress&cs=tinysrgb&w=700",
    "https://images.pexels.com/photos/1059384/pexels-photo-1059384.jpeg?auto=compress&cs=tinysrgb&w=700",
    "https://images.pexels.com/photos/2799465/pexels-photo-2799465.jpeg?auto=compress&cs=tinysrgb&w=700",
  ],
  coupe: [
    "https://images.pexels.com/photos/707046/pexels-photo-707046.jpeg?auto=compress&cs=tinysrgb&w=700",
    "https://images.pexels.com/photos/1719648/pexels-photo-1719648.jpeg?auto=compress&cs=tinysrgb&w=700",
    "https://images.pexels.com/photos/1545743/pexels-photo-1545743.jpeg?auto=compress&cs=tinysrgb&w=700",
  ],
};

// Deterministic picker so same model → same image
let _idx = {};
const pick = (kind) => {
  const pool = POOLS[kind] || POOLS.sedan;
  _idx[kind] = (_idx[kind] || 0) + 1;
  return pool[(_idx[kind] - 1) % pool.length];
};

// Reset counters between brands so each brand starts from the first image
const resetPools = () => { _idx = {}; };

// Helper to build model array with a "kind" string
const M = (name, kind = "sedan") => ({ name, kind });

const BRAND_DEFS = [
  {
    name: "Volkswagen", slug: "volkswagen", color: "#001E50", bg: "rgba(0,30,80,0.08)", country: "Allemagne",
    models: [
      M("Golf 4", "hatchback"), M("Golf 5", "hatchback"), M("Golf 6", "hatchback"),
      M("Golf 7", "hatchback"), M("Golf 8", "hatchback"),
      M("Polo", "hatchback"), M("Passat B6", "sedan"), M("Passat B7", "sedan"), M("Passat B8", "sedan"),
      M("Tiguan", "suv"), M("Touareg", "suv"), M("Touran", "van"),
      M("Jetta", "sedan"), M("Caddy", "van"), M("Transporter T5", "van"), M("Transporter T6", "van"),
    ],
  },
  {
    name: "Audi", slug: "audi", color: "#BB0A30", bg: "rgba(187,10,48,0.08)", country: "Allemagne",
    models: [
      M("A1", "hatchback"), M("A3", "hatchback"),
      M("A4 B7", "sedan"), M("A4 B8", "sedan"), M("A4 B9", "sedan"),
      M("A5", "coupe"), M("A6 C6", "sedan"), M("A6 C7", "sedan"), M("A7", "sedan"), M("A8", "sedan"),
      M("Q3", "suv"), M("Q5", "suv"), M("Q7", "suv"), M("TT", "coupe"),
    ],
  },
  {
    name: "BMW", slug: "bmw", color: "#1C69D4", bg: "rgba(28,105,212,0.08)", country: "Allemagne",
    models: [
      M("Série 1 E87", "hatchback"), M("Série 1 F20", "hatchback"), M("Série 1 F40", "hatchback"),
      M("Série 3 E90", "sedan"), M("Série 3 F30", "sedan"), M("Série 3 G20", "sedan"),
      M("Série 5 F10", "sedan"), M("Série 5 G30", "sedan"), M("Série 7", "sedan"),
      M("X1", "suv"), M("X3", "suv"), M("X5", "suv"), M("X6", "suv"),
    ],
  },
  {
    name: "Peugeot", slug: "peugeot", color: "#0F4B8F", bg: "rgba(15,75,143,0.08)", country: "France",
    models: [
      M("206", "hatchback"), M("207", "hatchback"), M("208", "hatchback"), M("208 II", "hatchback"),
      M("301", "sedan"), M("307", "hatchback"), M("308", "hatchback"), M("308 II", "hatchback"),
      M("407", "sedan"), M("508", "sedan"),
      M("2008", "suv"), M("3008", "suv"), M("5008", "suv"),
      M("Partner", "van"), M("Boxer", "van"), M("Expert", "van"),
    ],
  },
  {
    name: "Renault", slug: "renault", color: "#FFCC33", bg: "rgba(255,204,51,0.14)", country: "France",
    models: [
      M("Clio II", "hatchback"), M("Clio III", "hatchback"), M("Clio IV", "hatchback"), M("Clio V", "hatchback"),
      M("Symbol", "sedan"),
      M("Mégane II", "hatchback"), M("Mégane III", "hatchback"), M("Mégane IV", "hatchback"),
      M("Scénic", "van"), M("Captur", "suv"), M("Kadjar", "suv"), M("Koleos", "suv"),
      M("Talisman", "sedan"), M("Fluence", "sedan"), M("Twingo", "hatchback"),
      M("Trafic", "van"), M("Master", "van"), M("Kangoo", "van"),
    ],
  },
  {
    name: "Citroën", slug: "citroen", color: "#862633", bg: "rgba(134,38,51,0.08)", country: "France",
    models: [
      M("C1", "hatchback"), M("C2", "hatchback"), M("C3", "hatchback"), M("C3 Picasso", "van"),
      M("C4", "hatchback"), M("C4 Picasso", "van"), M("C5", "sedan"),
      M("Berlingo", "van"), M("Jumpy", "van"), M("Jumper", "van"),
      M("DS3", "hatchback"), M("DS4", "hatchback"), M("DS5", "sedan"),
    ],
  },
  {
    name: "Dacia", slug: "dacia", color: "#646B52", bg: "rgba(100,107,82,0.10)", country: "Roumanie",
    models: [
      M("Logan", "sedan"), M("Logan II", "sedan"),
      M("Sandero", "hatchback"), M("Sandero II", "hatchback"), M("Sandero Stepway", "suv"),
      M("Duster", "suv"), M("Duster II", "suv"),
      M("Lodgy", "van"), M("Dokker", "van"), M("Spring", "hatchback"),
    ],
  },
  {
    name: "Toyota", slug: "toyota", color: "#EB0A1E", bg: "rgba(235,10,30,0.08)", country: "Japon",
    models: [
      M("Yaris", "hatchback"), M("Yaris II", "hatchback"), M("Yaris III", "hatchback"), M("Yaris IV", "hatchback"),
      M("Corolla", "sedan"), M("Corolla E150", "sedan"), M("Corolla E170", "sedan"), M("Corolla E210", "sedan"),
      M("Auris", "hatchback"), M("Avensis", "sedan"),
      M("RAV4", "suv"), M("Land Cruiser", "suv"), M("C-HR", "suv"),
      M("Hilux", "van"), M("Hiace", "van"),
    ],
  },
  {
    name: "Hyundai", slug: "hyundai", color: "#002C5F", bg: "rgba(0,44,95,0.08)", country: "Corée du Sud",
    models: [
      M("i10", "hatchback"), M("i20", "hatchback"), M("i30", "hatchback"), M("i40", "sedan"),
      M("Accent", "sedan"), M("Elantra", "sedan"), M("Sonata", "sedan"),
      M("Tucson", "suv"), M("Santa Fe", "suv"), M("Kona", "suv"), M("ix35", "suv"),
      M("H1", "van"), M("Atos", "hatchback"),
    ],
  },
  {
    name: "Kia", slug: "kia", color: "#05141F", bg: "rgba(5,20,31,0.10)", country: "Corée du Sud",
    models: [
      M("Picanto", "hatchback"), M("Rio", "hatchback"), M("Cerato", "sedan"),
      M("Ceed", "hatchback"), M("Optima", "sedan"),
      M("Sportage", "suv"), M("Sorento", "suv"), M("Stonic", "suv"), M("Soul", "suv"),
      M("Carnival", "van"),
    ],
  },
  {
    name: "Ford", slug: "ford", color: "#003478", bg: "rgba(0,52,120,0.08)", country: "USA",
    models: [
      M("Fiesta", "hatchback"), M("Focus II", "hatchback"), M("Focus III", "hatchback"), M("Focus IV", "hatchback"),
      M("Mondeo", "sedan"), M("Kuga", "suv"), M("EcoSport", "suv"), M("C-Max", "van"),
      M("Transit", "van"), M("Ranger", "van"),
    ],
  },
  {
    name: "Nissan", slug: "nissan", color: "#C3002F", bg: "rgba(195,0,47,0.08)", country: "Japon",
    models: [
      M("Micra", "hatchback"), M("Note", "hatchback"),
      M("Juke", "suv"), M("Qashqai", "suv"), M("X-Trail", "suv"), M("Pathfinder", "suv"),
      M("Navara", "van"), M("Sunny", "sedan"), M("Almera", "sedan"),
    ],
  },
  {
    name: "Opel", slug: "opel", color: "#F7FF14", bg: "rgba(247,255,20,0.18)", country: "Allemagne",
    models: [
      M("Corsa C", "hatchback"), M("Corsa D", "hatchback"), M("Corsa E", "hatchback"),
      M("Astra G", "hatchback"), M("Astra H", "hatchback"), M("Astra J", "hatchback"), M("Astra K", "hatchback"),
      M("Insignia", "sedan"), M("Mokka", "suv"), M("Zafira", "van"), M("Vivaro", "van"),
    ],
  },
  {
    name: "Fiat", slug: "fiat", color: "#A50A1E", bg: "rgba(165,10,30,0.08)", country: "Italie",
    models: [
      M("Panda", "hatchback"), M("500", "hatchback"), M("Punto", "hatchback"), M("Punto Evo", "hatchback"),
      M("Bravo", "hatchback"), M("Tipo", "sedan"),
      M("Doblo", "van"), M("Ducato", "van"), M("500X", "suv"), M("500L", "van"),
    ],
  },
  {
    name: "Seat", slug: "seat", color: "#C6362E", bg: "rgba(198,54,46,0.08)", country: "Espagne",
    models: [
      M("Ibiza", "hatchback"), M("Leon", "hatchback"), M("Toledo", "sedan"), M("Cordoba", "sedan"),
      M("Altea", "van"), M("Ateca", "suv"), M("Arona", "suv"), M("Tarraco", "suv"),
    ],
  },
  {
    name: "Skoda", slug: "skoda", color: "#4BA82E", bg: "rgba(75,168,46,0.08)", country: "Tchéquie",
    models: [
      M("Fabia", "hatchback"), M("Octavia", "sedan"), M("Superb", "sedan"), M("Rapid", "sedan"),
      M("Kodiaq", "suv"), M("Karoq", "suv"), M("Yeti", "suv"), M("Roomster", "van"),
    ],
  },
  {
    name: "Honda", slug: "honda", color: "#CC0000", bg: "rgba(204,0,0,0.08)", country: "Japon",
    models: [
      M("Civic", "sedan"), M("Accord", "sedan"),
      M("CR-V", "suv"), M("HR-V", "suv"), M("Jazz", "hatchback"),
    ],
  },
  {
    name: "Mazda", slug: "mazda", color: "#A6192E", bg: "rgba(166,25,46,0.08)", country: "Japon",
    models: [
      M("Mazda 2", "hatchback"), M("Mazda 3", "hatchback"), M("Mazda 6", "sedan"),
      M("CX-3", "suv"), M("CX-5", "suv"), M("CX-30", "suv"),
    ],
  },
  {
    name: "Suzuki", slug: "suzuki", color: "#E60012", bg: "rgba(230,0,18,0.08)", country: "Japon",
    models: [
      M("Swift", "hatchback"), M("Vitara", "suv"), M("Jimny", "suv"), M("S-Cross", "suv"),
      M("Baleno", "hatchback"), M("Alto", "hatchback"),
    ],
  },
];

// Materialise: for each brand, keep the kind for silhouette rendering
export const BRANDS = BRAND_DEFS.map((brand) => ({
  ...brand,
  models: brand.models.map((m) => ({ name: m.name, kind: m.kind })),
}));

export const BRAND_BY_SLUG = Object.fromEntries(BRANDS.map((b) => [b.slug, b]));

export const logoUrl = (slug, color) => {
  if (color) {
    const c = color.replace("#", "");
    return `https://cdn.simpleicons.org/${slug}/${c}`;
  }
  // Default: brand color (controlled via CSS filter for hover)
  return `https://cdn.simpleicons.org/${slug}`;
};
