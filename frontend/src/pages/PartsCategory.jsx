import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronLeft, ArrowRight } from "lucide-react";
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
        <div className="bg-white border border-slate-200 rounded-sm divide-y divide-slate-100 overflow-hidden">
          {data.categories.map((c) => (
            <div key={c.slug} className="group" data-testid={`subcategory-row-${c.slug}`}>
              {/* Gradient header bar with category title */}
              <Link
                to={`/catalogue/${section}/${c.slug}`}
                className={`block bg-gradient-to-r ${meta.bar} px-5 py-2 hover:brightness-110 transition-all`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm sm:text-base font-bold text-white tracking-wide uppercase">{c.label}</span>
                  <ArrowRight className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>

              {/* Content: icon + sub-items inline */}
              <Link
                to={`/catalogue/${section}/${c.slug}`}
                className="flex items-start gap-5 px-5 py-5 hover:bg-slate-50 transition-colors"
                data-testid={`subcategory-${c.slug}`}
              >
                <div className="flex-shrink-0 w-16 h-16 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-sm group-hover:border-slate-400 transition-colors">
                  <CategoryIcon name={c.icon} className="w-10 h-10" stroke={meta.iconStroke} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-3xl sm:text-4xl font-display font-black text-red-600 leading-none">
                    {c.sub_items?.length || 0}
                  </div>
                  <div className="mt-2 text-xs uppercase tracking-widest font-semibold text-slate-500">
                    sous-{(c.sub_items?.length || 0) > 1 ? "catégories" : "catégorie"} disponibles
                  </div>
                  <div className="mt-3 text-xs text-red-600 font-bold uppercase tracking-wider">
                    Explorer la sélection →
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
