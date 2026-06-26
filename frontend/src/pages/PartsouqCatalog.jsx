import { useEffect, useState } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ChevronLeft,
  Loader2,
  Hash,
  Car,
  Calendar,
  Fuel,
  Search,
  Package,
  Sparkles,
  ShoppingCart,
  CheckCircle2,
  Plus,
  Minus,
  Tag,
  Filter,
  X,
} from "lucide-react";
import { api, formatApiError, formatPrice } from "@/lib/api";
import { useCart } from "@/context/CartContext";

const SUGGESTIONS = [
  "frein", "pompe", "filtre", "huile", "courroie", "bougie",
  "amortisseur", "embrayage", "alternateur", "démarreur",
  "phare", "rétroviseur", "radiateur", "thermostat",
];

export default function PartsouqCatalog() {
  const { vin } = useParams();
  const [searchParams] = useSearchParams();
  const initialQuery = (searchParams.get("q") || "").trim();
  const initialSplit = searchParams.get("split") === "true";
  const { vehicle, setVehicle } = useCart();
  const [tecdoc, setTecdoc] = useState(null);
  const [loadingVin, setLoadingVin] = useState(true);
  const [search, setSearch] = useState(initialQuery);
  const [results, setResults] = useState(null);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [error, setError] = useState("");
  const [designationFilter, setDesignationFilter] = useState("");

  // Resolve VIN via RapidAPI TecDoc
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (vin.startsWith("MAN-")) {
        toast.error("Le catalogue OEM nécessite un VIN valide.");
        return;
      }
      setLoadingVin(true);
      try {
        const { data } = await api.get(`/rapidapi/vin/${vin}`);
        if (!cancelled) {
          setTecdoc(data);
          // Sync vehicle context (e.g. when user arrived via a deep link)
          if (!vehicle || vehicle.vin !== vin) {
            setVehicle({
              vin,
              make: data.manu_name,
              model: data.model_name,
              year: vehicle?.year || "—",
              fuel: vehicle?.fuel || "—",
              engine: vehicle?.engine || "—",
              trim: vehicle?.trim || "—",
              source: "tecdoc",
            });
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(formatApiError(err));
          toast.error(formatApiError(err));
        }
      } finally {
        if (!cancelled) setLoadingVin(false);
      }
    })();
    return () => { cancelled = true; };
  }, [vin]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-run search if a query was passed via URL (?q=...)
  useEffect(() => {
    if (tecdoc?.model_id && initialQuery && initialQuery.length >= 2 && !results && !loadingSearch) {
      runSearch(initialQuery);
    }
  }, [tecdoc, initialQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const runSearch = async (q, splitOverride) => {
    const query = (q || search).trim();
    if (query.length < 2) {
      toast.error("Saisissez au moins 2 caractères");
      return;
    }
    if (!tecdoc?.model_id) {
      toast.error("Véhicule non identifié");
      return;
    }
    setLoadingSearch(true);
    setError("");
    setDesignationFilter("");
    try {
      const useSplit = typeof splitOverride === "boolean" ? splitOverride : initialSplit;
      const params = { model_id: tecdoc.model_id, q: query, lang_id: 6, limit: 50 };
      if (useSplit) params.split = "true";
      const { data } = await api.get(`/oem-stock-search`, { params });
      setResults(data);
    } catch (err) {
      setError(formatApiError(err));
      setResults(null);
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    runSearch();
  };

  const handleSuggestion = (s) => {
    setSearch(s);
    runSearch(s);
  };

  if (loadingVin) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-500 px-4">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-red-600" />
        <p className="text-sm">Identification du véhicule…</p>
      </div>
    );
  }

  if (!tecdoc) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <Package className="w-12 h-12 mx-auto text-slate-300 mb-4" />
        <h2 className="font-display text-2xl font-bold text-slate-900 mb-2">Véhicule non trouvé</h2>
        <p className="text-slate-500 text-sm mb-6">Aucune correspondance dans la base TecDoc pour ce VIN.</p>
        <Link to={`/vehicule/${vin}`} className="text-red-600 hover:underline text-sm">
          ← Retour au véhicule
        </Link>
      </div>
    );
  }

  return (
    <div data-testid="partsouq-catalog-page">
      {/* Header */}
      <div className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link
            to={`/vehicule/${vin}`}
            className="inline-flex items-center gap-1 text-sm text-slate-300 hover:text-white mb-4"
            data-testid="back-to-vehicle"
          >
            <ChevronLeft className="w-4 h-4" /> Retour au véhicule
          </Link>

          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wider mb-4">
            <span className="text-slate-300 font-bold">Catalogue OEM TecDoc:</span>
            <span className="bn-chip bg-white/10 text-white border-white/20">
              <Car className="w-3 h-3" /> {tecdoc.manu_name}
            </span>
            <span className="bn-chip bg-white/10 text-white border-white/20">{tecdoc.model_name}</span>
            {vehicle?.year && vehicle.year !== "—" && (
              <span className="bn-chip bg-white/10 text-white border-white/20">
                <Calendar className="w-3 h-3" /> {vehicle.year}
              </span>
            )}
            {vehicle?.fuel && vehicle.fuel !== "—" && (
              <span className="bn-chip bg-white/10 text-white border-white/20">
                <Fuel className="w-3 h-3" /> {vehicle.fuel}
              </span>
            )}
            <span className="bn-chip bg-red-600/30 text-red-200 border-red-500/40 font-mono-vin">
              <Hash className="w-3 h-3" /> {vin}
            </span>
          </div>

          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
            Catalogue OEM officiel
          </h1>
          <p className="text-slate-300 mt-2 text-sm">
            Recherchez une pièce par nom (en français) — modelId TecDoc&nbsp;:{" "}
            <span className="font-mono-vin text-red-300">{tecdoc.model_id}</span>
          </p>
        </div>
      </div>

      {/* Search bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <form onSubmit={handleSubmit} className="flex items-center gap-2" data-testid="oem-search-form">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher une pièce (ex: frein, pompe, filtre, huile…)"
                className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-sm text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20"
                data-testid="oem-search-input"
              />
            </div>
            <button
              type="submit"
              disabled={loadingSearch}
              className="bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-semibold px-5 py-2.5 rounded-sm transition-colors inline-flex items-center gap-2 whitespace-nowrap"
              data-testid="oem-search-btn"
            >
              {loadingSearch ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Rechercher
            </button>
          </form>
          <p className="mt-1.5 text-[11px] text-slate-500">
            Astuce&nbsp;: saisissez plusieurs mots (ex.&nbsp;
            <span className="font-mono-vin">kit chaine distribution</span>) — chaque mot
            est cherché séparément et les résultats sont fusionnés.
          </p>
          {!results && !loadingSearch && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 inline-flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Suggestions :
              </span>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSuggestion(s)}
                  className="text-xs px-2.5 py-1 border border-slate-200 rounded-sm bg-white hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-colors"
                  data-testid={`suggestion-${s}`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-sm text-sm" data-testid="oem-error">
            {error}
          </div>
        )}

        {loadingSearch && (
          <div className="flex items-center justify-center py-20 text-slate-500" data-testid="oem-loading">
            <Loader2 className="w-7 h-7 animate-spin mr-3 text-red-600" />
            <span>Recherche TecDoc en cours…</span>
          </div>
        )}

        {!loadingSearch && !results && !error && (
          <div className="text-center py-16">
            <Search className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 text-sm">
              Saisissez le nom d&apos;une pièce et nous vérifions le stock chez nous
            </p>
          </div>
        )}

        {!loadingSearch && results && (
          <>
            <div className="bg-gradient-to-r from-emerald-50 to-white border-l-4 border-emerald-500 pl-4 py-3 pr-4 rounded-sm shadow-sm flex items-center justify-between mb-6" data-testid="oem-summary">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Articles disponibles pour
                </div>
                <div className="font-mono-vin font-semibold text-slate-800 text-sm">&ldquo;{search}&rdquo;</div>
              </div>
              <div className="text-right">
                <div className="font-display text-2xl font-bold text-emerald-600">{results.count}</div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">en stock chez nous</div>
              </div>
            </div>

            {results.count === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <Package className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <p className="text-sm font-semibold text-slate-700">Aucun article disponible pour cette recherche</p>
                <p className="text-xs mt-2">Nous avons vérifié {results.checked || 0} référence(s) OEM auprès de notre fournisseur local.</p>
                <p className="text-xs mt-1">Essayez un autre terme (ex: frein, pompe, filtre, embrayage…)</p>
              </div>
            ) : (
              (() => {
                const filterTerm = designationFilter.trim().toLowerCase();
                const filteredItems = filterTerm
                  ? (results.items || []).filter((it) => {
                      const haystack = [
                        it.designation,
                        it.oem_name,
                        it.reference,
                        it.oem_ref,
                        it.categorie,
                        it.fournisseur,
                      ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase();
                      return haystack.includes(filterTerm);
                    })
                  : results.items || [];
                return (
                  <>
                    <div className="mb-5 bg-white border border-slate-200 rounded-sm p-4" data-testid="designation-filter-block">
                      <div className="flex items-center gap-2 mb-2">
                        <Filter className="w-4 h-4 text-red-600" />
                        <label
                          htmlFor="designation-filter-input"
                          className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-700"
                        >
                          Filtrer par désignation
                        </label>
                      </div>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          id="designation-filter-input"
                          type="text"
                          value={designationFilter}
                          onChange={(e) => setDesignationFilter(e.target.value)}
                          placeholder="Ex: distribution, avant, arrière, hydraulique…"
                          className="w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-sm text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20"
                          data-testid="designation-filter-input"
                        />
                        {designationFilter && (
                          <button
                            type="button"
                            onClick={() => setDesignationFilter("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-red-600"
                            data-testid="designation-filter-clear"
                            aria-label="Effacer le filtre"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="mt-2 text-[11px] text-slate-500" data-testid="designation-filter-count">
                        {filterTerm ? (
                          <>
                            <span className="font-semibold text-slate-700">{filteredItems.length}</span> sur{" "}
                            <span className="font-semibold text-slate-700">{results.items.length}</span> article(s)
                            correspondent à &ldquo;<span className="italic">{designationFilter}</span>&rdquo;
                          </>
                        ) : (
                          <>Saisissez un mot-clé pour affiner les {results.items.length} résultat(s).</>
                        )}
                      </div>
                    </div>

                    {filteredItems.length === 0 ? (
                      <div className="text-center py-12 text-slate-500" data-testid="designation-filter-empty">
                        <Package className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                        <p className="text-sm font-semibold text-slate-700">Aucun article ne correspond au filtre</p>
                        <button
                          type="button"
                          onClick={() => setDesignationFilter("")}
                          className="mt-3 text-xs text-red-600 hover:underline font-semibold"
                          data-testid="designation-filter-reset"
                        >
                          Réinitialiser le filtre
                        </button>
                      </div>
                    ) : (
                      <StockProductGrid items={filteredItems} />
                    )}
                  </>
                );
              })()
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Grid of in-stock product cards from FadPro.
 * Each card supports quantity selection and "Add to cart".
 */
function StockProductGrid({ items }) {
  const navigate = useNavigate();
  const { add: addToCart } = useCart();
  const [qty, setQty] = useState({});

  const setQuantity = (ref, value) => {
    setQty((s) => ({ ...s, [ref]: Math.max(1, value) }));
  };

  const handleAdd = (item) => {
    const q = Math.max(1, Math.min(qty[item.reference] || 1, item.stock || 1));
    addToCart(
      {
        ref: item.reference,
        name: item.designation || item.reference,
        brand: item.fournisseur || "",
        image: "",
        price_tnd: item.prix_tnd,
        source: "fadpro",
      },
      q
    );
    toast.success(`${q} × ${item.reference} ajouté au panier`);
    setQuantity(item.reference, 1);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="stock-product-grid">
      {items.map((it, i) => {
        const q = qty[it.reference] || 1;
        const inStock = !!it.in_stock;
        return (
          <div
            key={`${it.reference}-${i}`}
            className={`group bg-white border rounded-sm overflow-hidden flex flex-col cursor-pointer transition-all ${
              inStock
                ? "border-slate-200 hover:border-red-500 hover:shadow-xl"
                : "border-slate-200 opacity-90 hover:border-slate-400 hover:shadow-lg"
            }`}
            onClick={() => navigate(`/article/${encodeURIComponent(it.oem_ref || it.reference)}`)}
            data-testid={`stock-card-${it.reference}`}
          >
            {/* Header strip */}
            <div className="flex items-center justify-between bg-gradient-to-r from-black to-zinc-900 text-white px-4 py-2.5">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-red-400">
                <Tag className="w-3 h-3" />
                <span>OEM</span>
                <span className="font-mono-vin text-white">{it.oem_ref}</span>
              </div>
              <div className="flex items-center gap-2">
                <SourceBadge source={it.source} />
                {inStock ? (
                  <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm">
                    <CheckCircle2 className="w-3 h-3" /> En stock
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm">
                    Hors stock
                  </span>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="p-5 flex-1 flex flex-col">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-600 mb-1">
                {it.fournisseur || "FadPro"}
              </div>
              <h3 className="font-display font-black text-slate-900 text-base leading-tight mb-2" data-testid={`stock-name-${it.reference}`}>
                {it.designation || it.oem_name || "—"}
              </h3>
              <div className="text-xs text-slate-500 mb-3">
                Réf. <span className="font-mono-vin font-semibold text-slate-700">{it.reference}</span>
              </div>
              {it.categorie && (
                <div className="text-[11px] text-slate-400 italic mb-3 line-clamp-2">{it.categorie}</div>
              )}

              <div className="mt-auto">
                <div className="flex items-end justify-between mb-3">
                  <div>
                    <div className="font-display font-black text-2xl text-red-600 leading-none" data-testid={`stock-price-${it.reference}`}>
                      {formatPrice(it.prix_tnd)}
                    </div>
                    <div className={`text-[10px] uppercase tracking-wider mt-1 ${inStock ? "text-slate-400" : "text-amber-600 font-semibold"}`}>
                      {inStock
                        ? `${it.stock} disponible${it.stock > 1 ? "s" : ""}`
                        : "Hors stock — sur commande"}
                    </div>
                  </div>
                  <div className="inline-flex items-center border border-slate-300 rounded-sm">
                    <button
                      onClick={(e) => { e.stopPropagation(); setQuantity(it.reference, q - 1); }}
                      className="px-2 py-1.5 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      data-testid={`stock-qty-minus-${it.reference}`}
                      aria-label="Diminuer"
                      disabled={!inStock}
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-3 text-sm font-bold w-8 text-center">{q}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setQuantity(it.reference, q + 1); }}
                      className="px-2 py-1.5 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      data-testid={`stock-qty-plus-${it.reference}`}
                      aria-label="Augmenter"
                      disabled={!inStock}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); handleAdd(it); }}
                  disabled={!inStock}
                  className={`w-full inline-flex items-center justify-center gap-2 font-black uppercase text-xs tracking-wider px-4 py-3 rounded-sm transition-colors shadow-lg ${
                    inStock
                      ? "bg-red-600 hover:bg-red-700 text-white shadow-red-900/20"
                      : "bg-slate-200 text-slate-500 cursor-not-allowed shadow-none"
                  }`}
                  data-testid={`stock-add-cart-${it.reference}`}
                >
                  <ShoppingCart className="w-4 h-4" />
                  {inStock ? "Ajouter au panier" : "Hors stock"}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/article/${encodeURIComponent(it.oem_ref || it.reference)}`); }}
                  className="mt-2 w-full text-center text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-red-600 transition-colors"
                  data-testid={`stock-view-details-${it.reference}`}
                >
                  Voir détails de l&apos;article →
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SourceBadge({ source }) {
  const map = {
    fadpro: { label: "FadPro", cls: "bg-amber-500/20 text-amber-300" },
    copia: { label: "Copia", cls: "bg-sky-500/20 text-sky-300" },
    partspro: { label: "PartsPro", cls: "bg-violet-500/20 text-violet-300" },
  };
  const info = map[source] || { label: source || "—", cls: "bg-slate-500/20 text-slate-300" };
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm ${info.cls}`} title={`Source: ${info.label}`}>
      {info.label}
    </span>
  );
}
