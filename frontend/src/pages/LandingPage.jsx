import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  ArrowRight,
  Search,
  Truck,
  Shield,
  Award,
  Headphones,
  Hash,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { BRANDS, logoUrl } from "@/data/brands";
import { OilBottle, BrakeDisc, CarBattery, OilFilter, Engine, ShockAbsorber } from "@/components/ProductIcons";
import PartnersSearchModal from "@/components/PartnersSearchModal";

const POPULAR_CATEGORIES = [
  { slug: "batterie", label: "Batterie", Icon: CarBattery },
  { slug: "filtre-huile", label: "Filtre Huile", Icon: OilFilter },
  { slug: "accessoires", label: "Accessoires", Icon: Engine },
  { slug: "eau-radiateur", label: "Eau Radiateur", Icon: OilBottle },
];

const TRUST_BADGES = [
  { Icon: Truck, title: "Livraison rapide", sub: "Partout en Tunisie" },
  { Icon: Shield, title: "Produits originaux", sub: "Qualité garantie" },
  { Icon: Award, title: "Meilleurs prix", sub: "Offres imbattables" },
  { Icon: Headphones, title: "Support client", sub: "À votre écoute" },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { setVehicle } = useCart();
  const [vin, setVin] = useState("");
  const [loading, setLoading] = useState(false);
  const [popularCategory, setPopularCategory] = useState(null);

  const handleVin = async (e) => {
    e.preventDefault();
    const v = vin.trim().toUpperCase();
    if (v.length < 11) {
      toast.error("Le VIN doit contenir au moins 11 caractères");
      return;
    }
    setLoading(true);
    try {
      // Try TecDoc first via RapidAPI
      try {
        const { data: td } = await api.get(`/rapidapi/vin/${v}`);
        // Build a vehicle object compatible with VehicleDetail
        const vehicle = {
          vin: v,
          make: td.manu_name,
          model: td.model_name,
          year: "—",
          fuel: "—",
          engine: "—",
          trim: "—",
          source: "tecdoc",
          tecdoc_model_id: td.model_id,
        };
        setVehicle(vehicle);
        navigate(`/vehicule/${v}`);
        return;
      } catch (_) {
        // Fallback to NHTSA / WMI decoder
        const { data } = await api.post("/vin/decode", { vin: v });
        setVehicle(data);
        navigate(`/vehicule/${data.vin}`);
      }
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-black text-white" data-testid="landing-page">
      {/* Hero — full-width banner with real auto parts photo */}
      <section className="relative overflow-hidden bg-black min-h-[640px] lg:min-h-[680px] flex items-center" data-testid="hero-section">
        {/* Background image — full bleed, parts on the right, dark fade to the left */}
        <div className="absolute inset-0 z-0">
          <img
            src="https://customer-assets.emergentagent.com/job_mechanic-hub-200/artifacts/5q4klcwe_section%20body_vin%20.jpg"
            alt="Pièces auto originales"
            className="absolute inset-0 w-full h-full object-cover object-right"
            onError={(e) => {
              e.target.src = "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=1920&q=80";
              e.target.onerror = null;
            }}
          />
          {/* Strong left-to-transparent gradient so text is readable */}
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/95 to-black/10" />
          <div className="absolute inset-y-0 left-0 w-1/2 bg-black/60" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />
          {/* Red glow accent */}
          <div className="absolute -right-40 top-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-600/15 rounded-full blur-3xl pointer-events-none" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20 w-full">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.4em] text-red-500 mb-4">
              <span className="w-6 h-px bg-red-500"></span> Pièces auto en Tunisie
            </div>
            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-black leading-[0.95] tracking-tight text-white">
              PIÈCES AUTO<br />
              <span className="text-red-600">ORIGINALES</span>
            </h1>
            <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white font-semibold">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-red-500" /> Qualité garantie</span>
              <span className="text-white/40">|</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-red-500" /> Meilleurs prix</span>
              <span className="text-white/40">|</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-red-500" /> Livraison rapide</span>
            </div>

            {/* VIN search */}
            <form onSubmit={handleVin} className="mt-8 max-w-xl" data-testid="hero-vin-form">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-red-500 mb-3">
                <span className="w-4 h-px bg-red-500"></span>
                <Hash className="w-3 h-3" />
                Trouvez vos pièces par VIN
              </div>
              <div className="group flex items-stretch bg-white rounded-sm overflow-hidden shadow-2xl shadow-red-900/40 ring-1 ring-white/10 focus-within:ring-2 focus-within:ring-red-500 transition-all">
                <div className="flex items-center pl-4 pr-2 text-black/30 border-r border-zinc-100">
                  <Hash className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={vin}
                  onChange={(e) => setVin(e.target.value.toUpperCase())}
                  placeholder="VF15R0K0H48649991"
                  maxLength={17}
                  className="flex-1 px-3 py-3 text-sm font-mono tracking-wider text-black focus:outline-none placeholder:text-black/25"
                  data-testid="hero-vin-input"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-red-400 px-6 text-white text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-2 group-focus-within:bg-red-700"
                  data-testid="hero-vin-submit"
                >
                  {loading ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Recherche
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      Rechercher
                    </>
                  )}
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px]">
                <span className="text-white/60">17 caractères en général · <span className="text-red-400 font-semibold">{vin.length}/17</span></span>
                <a
                  href="#brands-section"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById("brands-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="text-red-400 hover:text-red-300 font-semibold uppercase tracking-wider"
                  data-testid="hero-brand-link"
                >
                  Recherche par marque →
                </a>
              </div>
            </form>

            <div className="mt-8">
              <Link
                to="/recherche-vin"
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold uppercase text-sm tracking-wider px-7 py-3.5 rounded-sm transition-colors shadow-lg shadow-red-900/40"
                data-testid="hero-cta-discover"
              >
                Découvrir nos produits <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trust badges row — WHITE bg, polished marker badges */}
      <section className="bg-white text-black" data-testid="trust-badges">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-10 gap-x-6">
            {TRUST_BADGES.map((b, idx) => (
              <div key={b.title} className="group flex items-center gap-5">
                {/* Polished marker / leaf badge */}
                <div className="relative flex-shrink-0 transition-transform duration-300 group-hover:-translate-y-1">
                  <svg viewBox="0 0 72 88" className="w-16 h-20 sm:w-[72px] sm:h-[88px] drop-shadow-[0_6px_12px_rgba(220,38,38,0.18)]">
                    <defs>
                      <linearGradient id={`badge-fill-${idx}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fff5f5" />
                        <stop offset="100%" stopColor="#ffe4e6" />
                      </linearGradient>
                      <linearGradient id={`badge-stroke-${idx}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#ef4444" />
                        <stop offset="100%" stopColor="#b91c1c" />
                      </linearGradient>
                    </defs>
                    {/* Leaf / marker silhouette with subtle gradient fill */}
                    <path
                      d="M36 4 C 50 4, 64 20, 64 42 C 64 62, 50 80, 36 84 C 22 80, 8 62, 8 42 C 8 20, 22 4, 36 4 Z"
                      fill={`url(#badge-fill-${idx})`}
                      stroke={`url(#badge-stroke-${idx})`}
                      strokeWidth="2.5"
                    />
                    {/* Inner highlight ring */}
                    <path
                      d="M36 12 C 47 12, 58 25, 58 42 C 58 58, 47 74, 36 77 C 25 74, 14 58, 14 42 C 14 25, 25 12, 36 12 Z"
                      fill="none"
                      stroke="#fecaca"
                      strokeWidth="0.8"
                    />
                  </svg>
                  {/* Icon centered above the curved part */}
                  <div className="absolute inset-0 flex items-center justify-center" style={{ paddingBottom: 8 }}>
                    <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center shadow-md shadow-red-700/30 transition-transform duration-300 group-hover:scale-110">
                      <b.Icon className="w-4 h-4 text-white" strokeWidth={2.5} />
                    </div>
                  </div>
                </div>
                <div>
                  <div className="font-display font-black text-black uppercase text-base sm:text-lg tracking-wide leading-tight">
                    {b.title}
                  </div>
                  <div className="text-sm text-zinc-500 mt-1">{b.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Catégories populaires — WHITE bg */}
      <section className="bg-white text-black" data-testid="popular-categories">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex items-end justify-between mb-8">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-red-600 mb-2">Découvrez nos catégories</div>
              <h2 className="font-display font-black text-3xl sm:text-4xl text-black tracking-tight uppercase">
                Catégories populaires
              </h2>
            </div>
            <Link to="/recherche-vin" className="text-sm font-semibold text-red-600 hover:text-red-700 inline-flex items-center gap-1">
              Voir toutes les catégories <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {POPULAR_CATEGORIES.map((c) => (
              <button
                key={c.slug}
                onClick={() => setPopularCategory(c.slug)}
                className="group relative bg-zinc-50 border border-zinc-200 hover:border-red-600 rounded-sm overflow-hidden aspect-square flex flex-col items-center justify-center p-5 transition-all hover:bg-white hover:shadow-xl"
                data-testid={`popular-cat-${c.slug}`}
              >
                <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-red-600/0 group-hover:bg-red-600/10 rounded-full blur-2xl transition-colors" />
                <div className="relative w-full h-2/3 flex items-center justify-center">
                  <c.Icon className="w-full h-full max-w-[100px] group-hover:scale-110 transition-transform" />
                </div>
                <div className="relative mt-3 text-center">
                  <div className="font-display font-black text-black text-base uppercase tracking-wide">{c.label}</div>
                  <div className="text-[10px] text-red-600 mt-1 font-bold uppercase tracking-widest">Voir produits →</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Constructeurs / Brands — WHITE bg */}
      <section id="brands-section" className="bg-zinc-50 text-black border-y border-zinc-200" data-testid="brands-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-8 gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-red-600 mb-2">Constructeurs</div>
              <h2 className="font-display font-black text-3xl sm:text-4xl text-black tracking-tight uppercase">
                Constructeurs automobile
              </h2>
              <p className="text-zinc-600 mt-2 text-sm">
                {BRANDS.length} marques · plus de {BRANDS.reduce((s, b) => s + b.models.length, 0)} modèles couverts
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10" data-testid="brands-grid">
            {BRANDS.map((b) => (
              <Link
                key={b.slug}
                to={`/marque/${b.slug}`}
                className="brand-card-light group flex flex-col items-center justify-center p-3 transition-all duration-300"
                style={{ "--brand-color": b.color }}
                data-testid={`brand-card-${b.slug}`}
              >
                <div className="brand-logo-wrap relative w-full h-20 sm:h-24 flex items-center justify-center">
                  <img
                    src={logoUrl(b.slug)}
                    alt={b.name}
                    className="brand-logo max-h-full max-w-[80%] object-contain transition-all duration-300"
                    loading="lazy"
                    onError={(e) => {
                      e.target.style.display = "none";
                      const fb = e.target.parentNode.querySelector(".brand-logo-fallback");
                      if (fb) fb.style.display = "block";
                    }}
                  />
                  <span className="brand-logo-fallback font-display font-bold text-zinc-700 group-hover:text-[color:var(--brand-color)] transition-colors text-lg" style={{ display: "none" }}>
                    {b.name}
                  </span>
                </div>
                <div className="mt-3 text-[10px] sm:text-xs font-semibold text-zinc-600 group-hover:text-[color:var(--brand-color)] transition-colors uppercase tracking-wider text-center truncate w-full">
                  {b.name}
                </div>
              </Link>
            ))}
          </div>
        </div>

        <style>{`
          .brand-card-light .brand-logo {
            filter: grayscale(1) brightness(0.7);
            opacity: 0.6;
          }
          .brand-card-light:hover .brand-logo {
            filter: none;
            opacity: 1;
            transform: scale(1.12);
          }
        `}</style>
      </section>

      {/* Final CTA strip — RED */}
      <section className="bg-red-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col sm:flex-row items-start sm:items-center gap-6 justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/80 mb-2">Besoin d&apos;aide ?</div>
            <h3 className="font-display font-black text-2xl sm:text-3xl uppercase tracking-tight">
              Notre équipe est à votre service
            </h3>
            <p className="text-white/90 text-sm mt-1">Du lundi au samedi · 8h00 - 20h00 · Tunis, Tunisie</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href="tel:+21671123456" className="bg-black text-white font-bold uppercase text-sm tracking-wider px-6 py-3 rounded-sm hover:bg-zinc-900 transition-colors inline-flex items-center gap-2">
              <Headphones className="w-4 h-4" /> +216 54 643 643
            </a>
            <Link to="/contact" className="border-2 border-white text-white font-bold uppercase text-sm tracking-wider px-6 py-3 rounded-sm hover:bg-white hover:text-red-600 transition-colors">
              Nous écrire
            </Link>
          </div>
        </div>
      </section>

      <PartnersSearchModal
        open={!!popularCategory}
        query={popularCategory ? `Catégorie : ${popularCategory}` : ""}
        categorySlug={popularCategory}
        onClose={() => setPopularCategory(null)}
      />
    </div>
  );
}
