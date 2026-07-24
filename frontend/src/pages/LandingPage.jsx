import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  ArrowRight,
  Search,
  Headphones,
  Hash,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { BRANDS, logoUrl } from "@/data/brands";
import PartnersSearchModal from "@/components/PartnersSearchModal";
import Hero from "@/components/HeroSection";

const POPULAR_CATEGORIES = [
  { slug: "batterie", label: "Batterie", image: "/batterie.png" },
  { slug: "huile-moteur", label: "HUILE MOTEUR", image: "/huile-moteur.png" },
  { slug: "accessoires", label: "Accessoires", image: "/essuie_glace.png" },
  { slug: "eau-radiateur", label: "Eau Radiateur", image: "/eau-radiateur.png" },
];

const TRUST_BADGES = [
  { image: "/livraison-rapide.png", title: "Livraison rapide", sub: "Partout en Tunisie" },
  { image: "/produits-originaux.png", title: "Produits originaux", sub: "Qualité garantie" },
  { image: "/meilleurs-prixx.png", title: "Meilleurs prix", sub: "Offres imbattables" },
  { image: "/support-client.jpg", title: "Support client", sub: "À votre écoute" },
];

const PARTNERS = [
  { name: "Bosch", logo: "/boesch.png" },
  { name: "Brembo", logo: "/Brembo.png" },
  { name: "Shell", logo: "/shell.png" },
  { name: "Valeo", logo: "/valeo.png" },
  { name: "Mahle", logo: "/mahle.png" },
  { name: "Continental", logo: "/Continental.png" },
  { name: "Castrol", logo: "/Castrol.png" },
  { name: "Denso", logo: "/Denso.png" },
  { name: "Monroe", logo: "/monroe.png" },
  { name: "Delphi", logo: "/Delphi.png" },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { setVehicle } = useCart();
  const [vin, setVin] = useState("");
  const [loading, setLoading] = useState(false);
  const [popularCategory, setPopularCategory] = useState(null);
  const [variantPicker, setVariantPicker] = useState(null);
  const [showEngineHelp, setShowEngineHelp] = useState(false);

  const handleVin = async (e) => {
    e.preventDefault();
    const v = vin.trim().toUpperCase();

    if (v.length < 11) {
      toast.error("Le VIN doit contenir au moins 11 caractères");
      return;
    }

    setLoading(true);

    try {
      const { data: td } = await api.get(`/rapidapi/vin/${v}`);

      try {
        const { data: vv } = await api.get(`/vehicles/variants/${td.model_id}`);
        const vehicles = vv?.vehicles || [];

        if (vehicles.length > 0) {
          setVariantPicker({
            vin: v,
            manuName: td.manu_name,
            modelName: td.model_name,
            modelId: td.model_id,
            vehicles: vehicles,
          });
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error("[VIN] variants FAILED:", err?.response?.data || err.message);
      }

      // fallback direct vehicle
      setVehicle({
        vin: v,
        make: td.manu_name,
        model: td.model_name,
        source: "tecdoc",
        tecdoc_model_id: td.model_id,
      });

      navigate(`/vehicule/${v}`);
      return;
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const confirmEngineVariant = (variant) => {
    if (!variantPicker) return;

    const vehicle = {
      vin: variantPicker.vin,
      make: variantPicker.manuName,
      model: variantPicker.modelName,
      engine: variant.typeEngineName,
      vehicle_id: variant.vehicleId,
      source: "tecdoc",
      tecdoc_model_id: variantPicker.modelId,
    };

    setVehicle(vehicle);
    const vinToUse = variantPicker.vin;
    setVariantPicker(null);
    navigate(`/vehicule/${vinToUse}`);
  };

  return (
    <div className="bg-black text-white" data-testid="landing-page">
      {/* Bienvenue banner — schmaler Streifen über dem Hero */}
{/* Sale-Badge — oben rechts, dicht am Hero */}
{/* Sale-Badge — leicht eingerückt von links */}
<div className="flex items-center pl-10 sm:pl-15 lg:pl-20" data-testid="footer-payment-icons">
  <img
    src="sale.png"
    alt="Paiement sécurisé"
    className="w-48 h-auto object-contain mb-1"
    style={{ transform: "rotate(-8deg)" }}
  />
</div>
      {/* Hero — full-width banner with real auto parts photo */}
      <Hero vin={vin} setVin={setVin} loading={loading} handleVin={handleVin} />


      {/* Trust badges row — dark, compact, image + text inline */}
      <section className="bg-black text-white border-t-2 border-red-600" data-testid="trust-badges">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-y divide-white/10 lg:divide-y-0 lg:divide-x">
            {TRUST_BADGES.map((b, idx) => (
              <div
                key={b.title}
                className={`flex items-center gap-3 py-4 lg:py-0 ${idx > 0 ? "lg:pl-6" : ""} ${idx < TRUST_BADGES.length - 1 ? "lg:pr-6" : ""}`}
              >
<img src={b.image} alt={b.title} className="w-20 h-20 object-contain flex-shrink-0" />
                <div>
                  <div className="font-display font-black text-white uppercase text-xs sm:text-sm tracking-wide leading-tight">
                    {b.title}
                  </div>
                  <div className="text-xs text-white/60 mt-0.5">{b.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Catégories populaires — WHITE bg, full width */}
      <section className="bg-white text-black" data-testid="popular-categories">
        <div className="w-full px-[70px] py-16">
          <div className="flex items-end justify-between mb-8">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-red-600 mb-2">Découvrez nos catégories</div>
              <h2 className="font-display font-black text-3xl sm:text-4xl text-black tracking-tight uppercase">
                Catégories populaires
              </h2>
            </div>
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
                 <div className="relative w-full h-3/4 flex items-center justify-center">
  <img
    src={c.image}
    alt={c.label}
    className="max-w-[190px] max-h-full w-full object-contain group-hover:scale-110 transition-transform drop-shadow-md"
  />
</div>
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

      {/* Partners — animated marquee with real logo images */}
      <section className="bg-slate-50 border-y border-slate-200 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-10">
            <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-red-600 mb-2">Nos partenaires</div>
            <h2 className="font-display text-3xl sm:text-4xl font-black uppercase tracking-tight text-slate-900">
              Les meilleures marques mondiales
            </h2>
            <p className="mt-3 text-slate-600 text-sm max-w-2xl mx-auto">
              Nous travaillons exclusivement avec des équipementiers de renommée internationale pour garantir
              la fiabilité et la longévité de chaque pièce vendue.
            </p>
          </div>
        </div>

        <div className="relative w-full">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-slate-50 to-transparent z-10" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-slate-50 to-transparent z-10" />

          <div className="flex w-max animate-marquee gap-4 py-2">
            {[...PARTNERS, ...PARTNERS].map((p, idx) => (
              <div
                key={`${p.name}-${idx}`}
                className="bg-white border border-slate-200 rounded-sm py-6 px-8 flex items-center justify-center hover:shadow-md transition-all flex-shrink-0 w-44 h-20"
                data-testid={`partner-${p.name}`}
              >
                <img
                  src={p.logo}
                  alt={p.name}
                  className="max-w-full max-h-10 object-contain"
                  onError={(e) => { e.target.style.display = "none"; }}
                />
              </div>
            ))}
          </div>
        </div>
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

      {/* Engine variant picker */}
      {variantPicker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onClick={() => setVariantPicker(null)}
        >
          <div
            className="bg-white text-black rounded-md w-full max-w-md max-h-[80vh] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-zinc-200 flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase text-red-600">
                  {variantPicker.manuName} — {variantPicker.modelName}
                </div>
                <h3 className="font-black text-lg uppercase leading-tight">
                  Choisissez le moteur
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Sélectionnez la motorisation exacte de votre véhicule
                </p>
              </div>
              <button
                onClick={() => setShowEngineHelp(true)}
                className="text-[10px] font-bold uppercase bg-zinc-900 text-white px-3 py-2 rounded-sm hover:bg-red-600 transition"
              >
                Aide ?
              </button>
            </div>

            {showEngineHelp && (
              <div className="p-4 bg-red-50 border-b border-red-200 text-xs">
                <div className="font-bold text-red-700 mb-2">
                  Où trouver le type moteur ?
                </div>
                <p className="text-zinc-700 mb-3">
                  Le <b>type moteur</b> est une information technique importante pour identifier
                  la bonne pièce pour votre véhicule. Vous pouvez le trouver à plusieurs endroits :
                </p>
                <ul className="space-y-2 text-zinc-700">
                  <li>
                    📄 <b>Carte grise (Tunisie)</b><br />
                    → Regardez la section <b>D.2 / Type / Version</b> ou la ligne <b>Motorisation</b>.
                    Le code moteur peut apparaître sous forme comme : <i>1.5 BlueHDi 100</i> ou <i>PureTech 130</i>.
                  </li>
                  <li>
                    🔧 <b>Bloc moteur (sous le capot)</b><br />
                    → Le type moteur est souvent <b>gravé directement sur le moteur</b> ou sur une petite plaque métallique.
                  </li>
                  <li>
                    🚗 <b>Étiquette véhicule</b><br />
                    → Dans l&apos;ouverture de la porte conducteur ou sous le capot, il y a une étiquette constructeur avec le code moteur.
                  </li>
                </ul>
                <button
                  onClick={() => setShowEngineHelp(false)}
                  className="mt-3 text-[10px] underline text-red-600"
                >
                  fermer
                </button>
              </div>
            )}

            <div className="p-5 space-y-2 overflow-y-auto max-h-[55vh]">
              <div className="text-[10px] uppercase tracking-widest text-zinc-400 mb-2">
                moteurs disponibles
              </div>

              {Array.from(
                new Map(
                  variantPicker.vehicles
                    .filter((v) => v?.vehicleId && v?.typeEngineName)
                    .map((v) => [v.vehicleId, v])
                ).values()
              ).map((v) => (
                <button
                  key={v.vehicleId}
                  onClick={() => confirmEngineVariant(v)}
                  className="w-full text-left border border-zinc-200 hover:border-red-600 hover:bg-red-50 rounded-sm py-3 px-4 transition group"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-sm group-hover:text-red-600">
                      {v.typeEngineName}
                    </div>
                    <span className="text-[10px] text-zinc-400">
                      ID {v.vehicleId}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
