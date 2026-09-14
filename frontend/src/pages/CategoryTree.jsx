import { useEffect, useState } from "react";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
import { ChevronLeft, ChevronRight, ArrowRight, Loader2, Layers, Package, Hash, Search } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { useCart } from "@/context/CartContext";

const SECTION_META = {
  mecanique: { label: "Mécanique", bar: "from-blue-700 to-blue-500", color: "text-blue-600" },
  electrique: { label: "Électrique", bar: "from-blue-700 to-blue-500", color: "text-blue-600" },
  carrosserie: { label: "Carrosserie", bar: "from-blue-700 to-blue-500", color: "text-blue-600" },
};

export default function CategoryTree() {
  const { section } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { vehicle } = useCart();

  // Extract everything after /catalogue/:section/  → the slug path
  const pathPrefix = `/catalogue/${section}/`;
  const slugPath = location.pathname.startsWith(pathPrefix)
    ? location.pathname.slice(pathPrefix.length)
    : "";

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const { data: node } = await api.get(`/catalog-tree/${section}/${slugPath}`);
        if (!cancelled) setData(node);
      } catch (err) {
        if (!cancelled) {
          setError(formatApiError(err));
          toast.error(formatApiError(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [section, slugPath]);

  const meta = SECTION_META[section] || SECTION_META.mecanique;

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-slate-500" data-testid="catalog-tree-loading">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500 mb-4">{error || "Catégorie introuvable."}</p>
        <button onClick={() => navigate(-1)} className="text-blue-600 hover:underline font-semibold">← Retour</button>
      </div>
    );
  }

  const hasChildren = Array.isArray(data.children) && data.children.length > 0;
  const isLeaf = !hasChildren;
  // Build the slug paths for child links
  const buildChildPath = (childSlug) => `${pathPrefix}${slugPath ? slugPath + "/" : ""}${childSlug}`;

  return (
    <div data-testid={`catalog-tree-${slugPath || "root"}`}>
      {/* Header with breadcrumb */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Breadcrumb section={section} sectionLabel={meta.label} breadcrumb={data.breadcrumb} />
          <div className="text-[10px] font-bold uppercase tracking-[0.35em] text-blue-600 mt-4 mb-2">Catégorie</div>
          <h1 className={`font-display text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight uppercase ${meta.color}`} data-testid="tree-node-title">
            {data.label}
          </h1>
          {hasChildren && (
            <p className="mt-2 text-sm text-slate-500">
              {data.children.length} sous-{data.children.length > 1 ? "catégories" : "catégorie"} · Choisissez une option
            </p>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {hasChildren ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="tree-children-grid">
            {data.children.map((child) => {
              const childHasMore = (child.children || []).length > 0;
              return (
                <Link
                  key={child.slug}
                  to={buildChildPath(child.slug)}
                  className="group bg-white border border-slate-200 hover:border-blue-600 hover:shadow-lg transition-all rounded-sm overflow-hidden"
                  data-testid={`tree-child-${child.slug}`}
                >
                  <div className={`h-1.5 bg-gradient-to-r ${meta.bar}`} />
                  <div className="p-5 flex items-center gap-4">
<div className="w-20 h-20 rounded-sm bg-blue-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
  {child.image ? (
    <img
      src={child.image}
      alt={child.label}
      className="w-full h-full object-contain p-1.5"
      onError={(e) => { e.target.style.display = "none"; }}
    />
  ) : childHasMore ? (
    <Layers className="w-8 h-8 text-blue-600 transition-colors" />
  ) : (
    <Package className="w-8 h-8 text-blue-600 transition-colors" />
  )}
</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-display font-black text-slate-900 text-base leading-tight uppercase">
                        {child.label}
                      </div>
                      <div className="mt-1 text-[11px] uppercase tracking-wider font-semibold text-slate-400 group-hover:text-blue-600 transition-colors">
                        {childHasMore
                          ? `${child.children.length} sous-${child.children.length > 1 ? "catégories" : "catégorie"} →`
                          : "Voir les pièces →"}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all flex-shrink-0" />
                  </div>
                </Link>
              );
            })}
          </div>
        ) : isLeaf ? (
          <LeafPanel
            label={data.label}
            searchKeyword={data.search_keyword || data.label}
            splitKeywords={!!data.split_keywords}
            vehicle={vehicle}
            navigate={navigate}
          />
        ) : null}
      </div>
    </div>
  );
}

function LeafPanel({ label, searchKeyword, splitKeywords, vehicle, navigate }) {
  const [vinInput, setVinInput] = useState("");
  const queryEncoded = encodeURIComponent(searchKeyword || label);
  const splitParam = splitKeywords ? "&split=true" : "";

  // Auto-redirect to OEM catalog if a vehicle is already selected
  useEffect(() => {
    if (vehicle?.vin) {
      navigate(`/vehicule/${vehicle.vin}/catalogue-oem?q=${queryEncoded}${splitParam}`, { replace: true });
    }
  }, [vehicle, queryEncoded, splitParam, navigate]);

  if (vehicle?.vin) {
    return (
      <div className="bg-white border border-slate-200 rounded-sm p-12 text-center" data-testid="tree-leaf-redirecting">
        <Loader2 className="w-8 h-8 text-blue-600 mx-auto mb-3 animate-spin" />
        <p className="text-sm text-slate-500">Recherche &ldquo;{label}&rdquo; pour {vehicle.make} {vehicle.model}…</p>
      </div>
    );
  }

  const submitVin = (e) => {
    e.preventDefault();
    const v = (vinInput || "").trim().toUpperCase();
    if (v.length !== 17) {
      toast.error("Le VIN doit contenir 17 caractères.");
      return;
    }
    navigate(`/vehicule/${v}/catalogue-oem?q=${queryEncoded}${splitParam}`);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-sm overflow-hidden" data-testid="tree-leaf-placeholder">
      {/* Hero header */}
      <div className="bg-gradient-to-r from-black via-zinc-900 to-blue-900 px-8 py-8 relative overflow-hidden">
        <div className="absolute -right-20 top-1/2 -translate-y-1/2 w-72 h-72 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-2xl">
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400 mb-2">Recherche par VIN</div>
          <h2 className="font-display text-2xl sm:text-3xl font-black uppercase text-white tracking-tight leading-tight">
            Trouvez votre <span className="text-blue-500">{label}</span>
          </h2>
          <p className="text-slate-300 text-sm mt-3 max-w-lg">
            Saisissez votre numéro VIN ci-dessous — nous interrogeons en direct nos partenaires
            (<span className="text-amber-300">FadPro</span>, <span className="text-sky-300">Copia</span>, <span className="text-violet-300">PartsPro</span>)
            et n&apos;affichons que les références disponibles en stock pour votre véhicule.
          </p>
        </div>
      </div>

      {/* VIN form */}
      <div className="p-8">
        <form onSubmit={submitVin} className="max-w-2xl" data-testid="leaf-vin-form">
          <label className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500 mb-2 block">
            Numéro VIN (17 caractères)
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={vinInput}
                onChange={(e) => setVinInput(e.target.value.toUpperCase())}
                maxLength={17}
                placeholder="VF15R0K0H48649991"
                className="w-full pl-9 pr-3 py-3 text-sm font-mono-vin tracking-wider text-slate-900 border border-slate-300 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                data-testid="leaf-vin-input"
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-sm tracking-wider px-6 py-3 rounded-sm transition-colors shadow-lg shadow-blue-900/30"
              data-testid="leaf-vin-submit"
            >
              <Search className="w-4 h-4" /> Rechercher
            </button>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            {vinInput.length}/17 caractères · Le VIN se trouve sur la carte grise (champ E) ou sur le pare-brise côté conducteur.
          </div>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-xs text-slate-500">
            Vous n&apos;avez pas le VIN ? Recherchez par marque et modèle.
          </p>
          <div className="flex gap-3">
            <Link to="/recherche-vin" className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-600 hover:text-blue-700">
              Recherche par marque →
            </Link>
            <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-900">
              <ChevronLeft className="w-3.5 h-3.5" /> Retour
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Breadcrumb({ section, sectionLabel, breadcrumb }) {
  const items = breadcrumb || [];
  return (
    <div className="text-xs text-slate-500 flex items-center gap-1.5 font-semibold flex-wrap" data-testid="tree-breadcrumb">
      <Link to="/" className="hover:text-blue-600">Accueil</Link>
      <ChevronRight className="w-3 h-3 text-slate-300" />
      <Link to={`/catalogue/${section}`} className="hover:text-blue-600">{sectionLabel}</Link>
      {items.map((b, i) => {
        const path = "/catalogue/" + section + "/" + items.slice(0, i + 1).map((x) => x.slug).join("/");
        const isLast = i === items.length - 1;
        return (
          <span key={b.slug} className="flex items-center gap-1.5">
            <ChevronRight className="w-3 h-3 text-slate-300" />
            {isLast ? (
              <span className="text-slate-900">{b.label}</span>
            ) : (
              <Link to={path} className="hover:text-blue-600">{b.label}</Link>
            )}
          </span>
        );
      })}
    </div>
  );
}