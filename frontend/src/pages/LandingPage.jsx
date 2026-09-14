import { Link, useNavigate, useNavigationType } from "react-router-dom";
import { useEffect, useState } from "react";
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
  { slug: "eau-radiateur", label: "Eau Radiateur", image: "/eau-radiateur.png" },
    { slug: "accessoires", label: "Accessoires", image: "/essuie_glace.png" },
];

const TRUST_BADGES = [
  { image: "/livirsion-blue.png", title: "Livraison rapide", sub: "Partout en Tunisie" },
  { image: "/prix-blue.png", title: "Produits originaux", sub: "Qualité garantie" },
  { image: "/produits-blue.png", title: "Support client", sub: "À votre écoute" },
    { image: "/support-blue.png", title: "Meilleurs prix", sub: "Offres imbattables" },

];



const PARTNERS = [
  { name: "Bosch", logo: "boesch.png" },
  { name: "Shell", logo: "shell.png" },
  { name: "Valeo", logo: "valeo.png" },
  { name: "Mahle", logo: "mahle.png" },
  { name: "Continental", logo: "Continental.png" },
  { name: "Castrol", logo: "Castrol.png" },
  { name: "Denso", logo: "Denso.png" },
  { name: "Monroe", logo: "monroe.png" },
  { name: "PRASCO", logo: "logo_PRASCO.png" },
  { name: "Misfat Filtration", logo: "logo_misfat_filtration.png" },
  { name: "Kamoka", logo: "logo_KAMOKA_v2.png" },
  { name: "Liqui Moly", logo: "logo_LIQUI_MOLY.png" },
  { name: "LuK", logo: "logo_LUK.png" },
  { name: "Motul", logo: "logo_MOTUL.png" },
  { name: "Fare Automotive", logo: "logo_FARE_automotive.png" },
  { name: "Metelli", logo: "logo_metelli.png" },
  { name: "LPR Brakes", logo: "logo_LPR_brakes.png" },
  { name: "Amortisseurs Record", logo: "logo_amortisseurs_record.png" },
  { name: "LTM", logo: "logo_LTM.png" },
];

// Modul-weiter Speicher (überlebt das Unmounten von LandingPage, das bei
// JEDEM Routenwechsel passiert — z.B. Klick auf einen Artikel im
// Kategorien-Popup navigiert zu /article/:ref, wodurch React-Router
// LandingPage komplett demontiert). Wird nur bei echter Browser-
// Zurück-Navigation (POP) gelesen — bei normaler Navigation (z.B. Klick auf
// "Accueil" im Header) startet die Seite bewusst mit geschlossenem Popup.
let lastPopularCategory = null;

export default function LandingPage() {
  const navigate = useNavigate();
  const navigationType = useNavigationType(); // "POP" | "PUSH" | "REPLACE"
  const { setVehicle } = useCart();
  const [vin, setVin] = useState("");
  const [loading, setLoading] = useState(false);
  const [popularCategory, setPopularCategory] = useState(
    navigationType === "POP" ? lastPopularCategory : null
  );
  const [variantPicker, setVariantPicker] = useState(null);
  const [showEngineHelp, setShowEngineHelp] = useState(false);

  // Zustand synchron mit dem modul-weiten Cache halten, damit ein späteres
  // Zurück-Navigieren (z.B. von /article/:ref) das Popup exakt so
  // wiederherstellen kann, wie der User es verlassen hat.
  useEffect(() => {
    lastPopularCategory = popularCategory;
  }, [popularCategory]);

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

      // Ein VIN-Präfix kann mehrere mögliche TecDoc-Modelle treffen (z.B.
      // LEON, LEON ST, ATECA für dasselbe WMI/VDS) — `matching_vehicles`
      // liefert dann die VOLLSTÄNDIGE Liste aller konkreten vehicleId über
      // ALLE diese Modelle hinweg. Die zeigen wir direkt im Motor-Picker,
      // statt nur ein geratenes Modell abzufragen und den Rest zu verwerfen.
      const directVehicles = td.matching_vehicles || [];
      if (directVehicles.length > 0) {
        setVariantPicker({
          vin: v,
          manuName: td.manu_name,
          modelName: td.model_name,
          modelId: td.model_id,
          vehicles: directVehicles,
        });
        setLoading(false);
        return;
      }

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
      // Bei `matching_vehicles` (mehrere mögliche Modelle pro VIN) trägt
      // JEDE Zeile ihr EIGENES manufacturerName/modelName/modelId — das
      // kann vom ursprünglich geratenen variantPicker.modelId abweichen
      // (z.B. LEON vs. LEON ST). Immer die Werte der konkret gewählten
      // Variante bevorzugen, mit dem VIN-Rateergebnis nur als Fallback.
      make: variant.manufacturerName || variantPicker.manuName,
      model: variant.modelName || variantPicker.modelName,
      engine: variant.typeEngineName,
      vehicle_id: variant.vehicleId,
      source: "tecdoc",
      tecdoc_model_id: variant.modelId || variantPicker.modelId,
    };

    setVehicle(vehicle);
    const vinToUse = variantPicker.vin;
    setVariantPicker(null);
    navigate(`/vehicule/${vinToUse}`);
  };

  return (
    <div className="bg-white text-blue-900" data-testid="landing-page">
      {/* Hero — full-width banner with real auto parts photo */}
      <Hero vin={vin} setVin={setVin} loading={loading} handleVin={handleVin} />


{/* Trust badges row — images only, text is baked into the graphics */}
<section className="bg-white text-blue-900 border-t-2 border-blue-900/20" data-testid="trust-badges">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
    <div className="grid grid-cols-2 lg:grid-cols-4 divide-y divide-blue-900/10 lg:divide-y-0 lg:divide-x">
      {TRUST_BADGES.map((b, idx) => (
        <div
          key={b.title}
          className={`flex items-center justify-center py-0 ${idx > 0 ? "lg:pl-6" : ""} ${idx < TRUST_BADGES.length - 1 ? "lg:pr-6" : ""}`}
          data-testid={`trust-badge-${idx}`}
        >
          <img src={b.image} alt={b.title} className="h-40 sm:h-44 w-auto max-w-full object-contain" />
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
              <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-600 mb-2">Découvrez nos catégories</div>
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
      className="group relative bg-zinc-50 border border-zinc-200 hover:border-blue-600 rounded-sm overflow-hidden aspect-square flex flex-col items-center justify-center p-1 transition-all hover:bg-white hover:shadow-xl"
      data-testid={`popular-cat-${c.slug}`}
    >
      <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-blue-600/0 group-hover:bg-blue-600/10 rounded-full blur-2xl transition-colors" />
      <div className="relative w-full flex-1 flex items-center justify-center overflow-hidden">
        <img
          src={c.image}
          alt={c.label}
  className="max-w-none w-full h-full object-contain scale-110 group-hover:scale-120 transition-transform drop-shadow-md"
        />
      </div>
      <div className="relative py-1.5 text-center">
        <div className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">
          Voir produits →
        </div>
      </div>
    </button>
  ))}
</div>
        </div>
      </section>


{/* Marques auto compatibles — single logo grid image, no card/border */}
<section className="bg-white text-black border-t border-slate-200" data-testid="car-brands">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
    <div className="text-center mb-10">
      <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-blue-600 mb-2">
        Toutes les marques
      </div>
      <h2 className="font-display text-3xl sm:text-4xl font-black uppercase tracking-tight text-black">
        Compatible avec votre véhicule
      </h2>
      <p className="mt-3 text-slate-600 text-sm max-w-2xl mx-auto">
        Trouvez des pièces pour toutes les grandes marques automobiles, quel que soit
        le modèle ou l&apos;année de votre véhicule.
      </p>
    </div>

    <img
      src="/logos.jpg"
      alt="Marques compatibles: Peugeot, Citroën, Fiat, Opel, Renault, Nissan, Dacia, Volkswagen, Seat, Skoda, Audi, Porsche, BMW, Mercedes-Benz, Toyota, Mitsubishi, Isuzu, Tata, Mahindra, Ford, Chevrolet, MG, Kia, Hyundai, Suzuki"
      className="w-full max-w-5xl mx-auto h-auto object-contain"
      data-testid="brands-grid-image"
    />
  </div>
</section>

      {/* Partners — animated marquee with real logo images */}
      <section className="bg-slate-50 border-y border-slate-200 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-10">
            <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-blue-600 mb-2">Nos partenaires</div>
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
        className="max-w-full max-h-15 object-contain"
        onError={(e) => { e.target.style.display = "none"; }}
      />
    </div>
  ))}
</div>>
        </div>
      </section>



      {/* Final CTA strip — BLUE */}
      <section className="bg-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col sm:flex-row items-start sm:items-center gap-6 justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/80 mb-2">Besoin d&apos;aide ?</div>
            <h3 className="font-display font-black text-2xl sm:text-3xl uppercase tracking-tight">
              Notre équipe est à votre service
            </h3>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href="tel:+21671123456" className="bg-white text-blue-700 font-bold uppercase text-sm tracking-wider px-6 py-3 rounded-sm hover:bg-blue-50 transition-colors inline-flex items-center gap-2">
              <Headphones className="w-4 h-4" /> +216 54 643 643
            </a>
            <Link to="/contact" className="border-2 border-white text-white font-bold uppercase text-sm tracking-wider px-6 py-3 rounded-sm hover:bg-white hover:text-blue-700 transition-colors">
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-blue-950/70 px-4"
          onClick={() => setVariantPicker(null)}
        >
          <div
            className="bg-white text-black rounded-md w-full max-w-md max-h-[80vh] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-zinc-200 flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase text-blue-600">
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
                className="text-[10px] font-bold uppercase bg-blue-900 text-white px-3 py-2 rounded-sm hover:bg-blue-600 transition"
              >
                Aide ?
              </button>
            </div>

            {showEngineHelp && (
              <div className="p-4 bg-blue-50 border-b border-blue-200 text-xs">
                <div className="font-bold text-blue-700 mb-2">
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
                  className="mt-3 text-[10px] underline text-blue-600"
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
              )
                // Erst numerisch nach Hubraum (1.2 vor 1.4 vor 1.6, ...), bei
                // gleichem Hubraum alphabetisch nach dem Rest des Namens —
                // z.B. "1.4 TDI" vor "1.4 TSI" (D kommt vor S).
                .sort((a, b) =>
                  (a.typeEngineName || "").localeCompare(b.typeEngineName || "", undefined, {
                    numeric: true,
                    sensitivity: "base",
                  })
                )
                .map((v) => {
                // Wenn zwei Varianten denselben Motornamen tragen (z.B. "1.4"
                // mit unterschiedlicher vehicleId), liefert das Backend für
                // GENAU diese Fälle zusätzlich power_kw/power_ps (via die neue
                // vehicle-type-details Abfrage) — damit der Kunde die beiden
                // "1.4" auseinanderhalten kann. Bei eindeutigen Motoren bleiben
                // diese Felder leer und es wird nur der Name angezeigt.
                const kw = v.power_kw ? Math.round(parseFloat(v.power_kw)) : null;
                const ps = v.power_ps ? Math.round(parseFloat(v.power_ps)) : null;
                // Vollständiger Fahrzeugname für JEDE Zeile — nicht nur bei
                // matching_vehicles (wo `carName` direkt von TecDoc kommt),
                // sondern auch im Single-Modell-Fallback (/vehicles/variants),
                // wo die Zeile nur manufacturerName/modelName getrennt liefert.
                // Fällt auf den im Header gezeigten Marken-/Modellnamen zurück,
                // falls eine Zeile diese Felder selbst nicht mitliefert.
                const displayName =
                  v.carName ||
                  [
                    v.manufacturerName || variantPicker.manuName,
                    v.modelName || variantPicker.modelName,
                    v.typeEngineName,
                  ]
                    .filter(Boolean)
                    .join(" ");
                return (
                  <button
                    key={v.vehicleId}
                    onClick={() => confirmEngineVariant(v)}
                    className="w-full text-left border border-zinc-200 hover:border-blue-600 hover:bg-blue-50 rounded-sm py-3 px-4 transition group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-sm group-hover:text-blue-600">
                        {displayName}
                        {(kw || ps) && (
                          <span className="ml-2 text-[11px] font-normal text-zinc-500">
                            {kw ? `${kw} kW` : ""}
                            {kw && ps ? " / " : ""}
                            {ps ? `${ps} ch` : ""}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-400">
                        ID {v.vehicleId}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
