import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Wrench, Zap, CarFront, ArrowRight, ChevronLeft, Car, Fuel, Calendar, Hash, Database, Loader2 } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { useCart } from "@/context/CartContext";

const SECTIONS = [
  { slug: "mecanique", label: "Mécanique", desc: "Moteur, transmission, freinage, suspension", Icon: Wrench, color: "from-red-600 to-red-700", img: "https://images.pexels.com/photos/4489732/pexels-photo-4489732.jpeg?auto=compress&cs=tinysrgb&w=900&h=600" },
  { slug: "electrique", label: "Électrique", desc: "Batterie, démarrage, éclairage, faisceaux", Icon: Zap, color: "from-amber-500 to-amber-600", img: "https://images.pexels.com/photos/2127733/pexels-photo-2127733.jpeg?auto=compress&cs=tinysrgb&w=900&h=600" },
  { slug: "carrosserie", label: "Carrosserie", desc: "Pare-chocs, ailes, capots, vitres, rétros", Icon: CarFront, color: "from-slate-700 to-slate-900", img: "https://images.pexels.com/photos/1638459/pexels-photo-1638459.jpeg?auto=compress&cs=tinysrgb&w=900&h=600" },
];

export default function VehicleDetail() {
  const { vin } = useParams();
  const navigate = useNavigate();
  const { vehicle, setVehicle } = useCart();
  const [loading, setLoading] = useState(!vehicle || vehicle.vin !== vin);

  useEffect(() => {
    if (!vehicle || vehicle.vin !== vin) {
      // For manually-built vehicles (MAN-...), we can't decode — context must be set
      if (vin.startsWith("MAN-")) {
        toast.error("Sélection manuelle perdue. Veuillez refaire la recherche.");
        navigate("/");
        return;
      }
      (async () => {
        setLoading(true);
        try {
          const { data } = await api.post("/vin/decode", { vin });
          setVehicle(data);
        } catch (err) {
          toast.error(formatApiError(err));
          navigate("/recherche-vin");
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [vin, vehicle, setVehicle, navigate]);

  // PartSouq background scraping (legacy) is best-effort and not required for
  // the user flow — the OEM catalog now comes from TecDoc + FadPro/Copia/PartsPro.
  // We keep the data available if cached, but no longer block or notify the UI.

  if (loading || !vehicle) {
    return <div className="min-h-[60vh] flex items-center justify-center text-slate-500">Chargement du véhicule…</div>;
  }

  return (
    <div data-testid="vehicle-detail-page">
      {/* Breadcrumb / vehicle header */}
      <div className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link to="/recherche-vin" className="inline-flex items-center gap-1 text-sm text-slate-300 hover:text-white mb-4" data-testid="back-to-vin-search">
            <ChevronLeft className="w-4 h-4" /> Nouvelle recherche
          </Link>

          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wider mb-4" data-testid="vehicle-breadcrumb">
            <span className="text-slate-300 mt-2 font-bold">Détails de votre modèle:</span>
            <span className="bn-chip bg-white/10 text-white border-white/20"><Car className="w-3 h-3" /> {vehicle.make}</span>
            <span className="bn-chip bg-white/10 text-white border-white/20">{vehicle.model}</span>
            <span className="bn-chip bg-white/10 text-white border-white/20"><Calendar className="w-3 h-3" /> {vehicle.year || "—"}</span>
            <span className="bn-chip bg-white/10 text-white border-white/20"><Fuel className="w-3 h-3" /> {vehicle.fuel}</span>
            <span className="bn-chip bg-red-600/30 text-red-200 border-red-500/40 font-mono-vin"><Hash className="w-3 h-3" /> {vehicle.vin}</span>
          </div>

          <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight">
            {vehicle.make} {vehicle.model}
          </h1>
          <p className="text-slate-300 mt-2">
            {vehicle.engine && vehicle.engine !== "—" ? `Moteur ${vehicle.engine} · ` : ""}
            {vehicle.trim && vehicle.trim !== "—" ? `Finition ${vehicle.trim} · ` : ""}
            Choisissez la famille de pièces ci-dessous
          </p>
        </div>
      </div>

      {/* 3 category cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-3 gap-6 bn-stagger">
          {SECTIONS.map(({ slug, label, desc, Icon, color, img }) => (
            <Link
              key={slug}
              to={`/catalogue/${slug}`}
              className="group relative overflow-hidden border border-slate-200 bg-white hover:border-slate-400 transition-all"
              data-testid={`vehicle-section-${slug}`}
            >
              <div className="relative h-64 overflow-hidden">
                <img src={img} alt={label} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                <div className={`absolute inset-0 bg-gradient-to-tr ${color} opacity-70`} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Icon className="w-24 h-24 text-white drop-shadow-2xl" strokeWidth={1.4} />
                </div>
              </div>
              <div className="p-6">
                <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400 mb-2">Famille de pièces</div>
                <h2 className="font-display text-2xl font-bold text-slate-900 mb-2">{label}</h2>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
                <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-red-600 group-hover:gap-3 transition-all">
                  Voir les pièces <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* OEM catalog CTA — uses TecDoc/RapidAPI */}
        {!vehicle.vin.startsWith("MAN-") && (
          <div className="mt-12" data-testid="partsouq-cta-section">
            <Link
              to={`/vehicule/${vehicle.vin}/catalogue-oem`}
              className="group relative block overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-red-900 border border-slate-700 hover:border-red-500 rounded-sm transition-all"
              data-testid="partsouq-catalog-cta"
            >
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,white,transparent_60%)]" />
              <div className="relative p-8 sm:p-10 flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <div className="flex-shrink-0 w-16 h-16 bg-red-600 rounded-sm flex items-center justify-center">
                  <Database className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-red-300 mb-2">
                    Catalogue OEM officiel
                  </div>
                  <h3 className="font-display text-2xl sm:text-3xl font-bold text-white mb-2">
                    Explorer toutes les pièces d&apos;origine
                  </h3>
                  <p className="text-slate-300 text-sm">
                    Recherche par mots-clés sur le catalogue TecDoc — disponibilité
                    en stock en temps réel chez nos partenaires.
                  </p>
                </div>
                <ArrowRight className="w-8 h-8 text-white group-hover:translate-x-2 transition-transform flex-shrink-0" />
              </div>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
