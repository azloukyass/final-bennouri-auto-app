import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { CategoryIcon } from "@/lib/icons";
import { useCart } from "@/context/CartContext";

const SECTION_META = {
  mecanique:  { label: "Mécanique",  color: "text-red-600",    bar: "from-red-700 to-red-500",       iconStroke: "#dc2626" },
  electrique: { label: "Électrique", color: "text-amber-600",  bar: "from-amber-600 to-amber-400",   iconStroke: "#d97706" },
  carrosserie:{ label: "Carrosserie",color: "text-slate-700",  bar: "from-slate-700 to-slate-500",   iconStroke: "#334155" },
};

export default function PartsCategory() {
  const { section } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { vehicle } = useCart();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/catalog/${section}`);
        setData(data);
      } catch (err) {
        toast.error(formatApiError(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [section]);

  const meta = SECTION_META[section] || SECTION_META.mecanique;

  if (loading) return <div className="min-h-[50vh] flex items-center justify-center text-slate-500">Chargement…</div>;
  if (!data) return null;

  return (
    <div data-testid={`parts-category-${section}`}>
      <div className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
            {vehicle ? (
              <Link to={`/vehicule/${vehicle.vin}`} className="hover:text-red-600 inline-flex items-center gap-1" data-testid="back-to-vehicle">
                <ChevronLeft className="w-4 h-4" /> Retour {vehicle.make} {vehicle.model}
              </Link>
            ) : (
              <Link to="/" className="hover:text-red-600 inline-flex items-center gap-1">
                <ChevronLeft className="w-4 h-4" /> Accueil
              </Link>
            )}
          </div>
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-red-600 mb-2">Catégorie</div>
          <h1 className={`font-display text-4xl sm:text-5xl font-bold tracking-tight ${meta.color}`}>{data.label}</h1>
          <p className="mt-3 text-slate-600 max-w-2xl">{data.description}</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {data.categories.map((c) => (
            <Link
              key={c.slug}
              to={`/catalogue/${section}/${c.slug}`}
              className="group relative bg-white border border-slate-200 rounded-sm overflow-hidden hover:border-red-600 hover:shadow-xl transition-all"
              data-testid={`subcategory-${c.slug}`}
            >
              {/* Image showcase — image on top */}
              <div className="relative bg-zinc-50 h-40 flex items-center justify-center p-6 overflow-hidden">
                <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-red-600/0 group-hover:bg-red-600/10 rounded-full blur-2xl transition-colors" />
                <img
                  src={c.image}
                  alt={c.label}
                  className="relative max-h-full max-w-full object-contain group-hover:scale-110 transition-transform duration-300 drop-shadow-md"
                />
              </div>

              {/* Title — bottom, centered */}
              <div className="px-4 py-4 border-t border-slate-100 text-center">
                <span className="font-display text-sm font-bold text-slate-800 group-hover:text-red-600 tracking-wide uppercase transition-colors">
                  {c.label}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
