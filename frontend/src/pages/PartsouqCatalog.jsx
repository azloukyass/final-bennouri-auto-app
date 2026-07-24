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

// Normalize text for loose manufacturer-name comparison: lowercase, strip accents
function normalizeCompatText(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// Tokenize an engine name into ≥3-char alphanumeric tokens (mirrors the
// backend's _designation_query_tokens), so "1.6 BlueHDi 100" and
// "1.6 Bluehdi 100" compare equal regardless of case/formatting.
function engineTokens(s) {
  const norm = normalizeCompatText((s || "").replace(/[,\-]/g, " "));
  return (norm.match(/[a-z0-9]{3,}/g) || []);
}

// Extract engine-displacement tokens like "1.6", "2.0", "1.9" from free text.
// Matches patterns such as "1.6", "1,6" (some suppliers use comma as decimal
// separator) — normalized to dot form. Ignores plain integers (avoids false
// positives from years, part numbers, etc.) by requiring a decimal point.
function extractDisplacements(s) {
  const norm = (s || "").replace(/,/g, ".");
  const matches = norm.match(/\b\d\.\d(?!\d)/g) || [];
  return [...new Set(matches)];
}

// True iff the item's title/designation explicitly mentions a displacement
// that conflicts with the searched vehicle's displacement. If either side
// has no displacement info, we don't block (fail-open, same policy as the
// rest of the compat check).
function hasConflictingDisplacement(item, wantedDisplacements) {
  if (wantedDisplacements.length === 0) return false;
  const itemText = [item.designation, item.oem_name, item.reference]
    .filter(Boolean)
    .join(" ");
  const itemDisplacements = extractDisplacements(itemText);
  if (itemDisplacements.length === 0) return false;
  // Conflict = item mentions a displacement, but NONE of them match any
  // wanted displacement.
  return !itemDisplacements.some((d) => wantedDisplacements.includes(d));
}

export default function PartsouqCatalog() {
  const { vin } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
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
  const [isPartial, setIsPartial] = useState(false);

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
              vehicle_id: vehicle?.vehicle_id,
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
    setIsPartial(false);
    try {
      const useSplit = typeof splitOverride === "boolean" ? splitOverride : initialSplit;
      const params = { model_id: tecdoc.model_id, q: query, lang_id: 6, limit: 50 };
      if (useSplit) params.split = "true";
      // Pass the VIN so the backend can pick the right TecDoc variant
      // (engine-token match via sra_commercial) instead of always defaulting
      // to the first vehicleId returned by list-vehicles-id.
      if (vin) params.vin = vin;
      // Hand the vehicle name to the backend so it can verify supplier items
      // against piecesautos.tn compatibility lists when their title doesn't
      // already mention the model.
      if (vehicle?.vehicle_id) params.vehicle_id = vehicle.vehicle_id;

      const veh = [tecdoc.manu_name, tecdoc.model_name].filter(Boolean).join(" ").trim();
      if (veh) params.vehicle_name = veh;
      // Precise compatibility check: manufacturer + exact engine name of the
      // selected TecDoc vehicle variant (from the fuel/engine dropdown).
      if (tecdoc.manu_name) params.manufacturer_name = tecdoc.manu_name;
      if (vehicle?.engine && vehicle.engine !== "—") params.engine_name = vehicle.engine;
      const { data } = await api.get(`/oem-stock-search`, { params });
      // Vehicle to match against: manufacturer + exact engine name of the
      // selected TecDoc variant.
      const wantedManu = normalizeCompatText(tecdoc.manu_name);
      const wantedEngineToks = engineTokens(vehicle?.engine || "");

      // Two-step RapidAPI compatibility check, per item, run in parallel:
      //   1) oem_ref -> RapidAPI matches -> take the FIRST articleNo
      //   2) articleNo -> list of compatible vehicles
      // Then keep the item only if at least one compatible entry matches
      // BOTH the manufacturer and every engine token.
      const checked = await Promise.all(
        (data?.items || []).map(async (item) => {
          try {
            const { data: oemMatches } = await api.get(
              `/rapidapi/oem-search/artikel-no/${encodeURIComponent(item.oem_ref)}`
            );
            const items = oemMatches?.items || [];

const matchingItem = items.find(
  (item) => normalizeCompatText(item.manufacturerName) === wantedManu
) || items[0];

const firstArticleNo = matchingItem?.articleNo;
            if (!firstArticleNo) {
              // No RapidAPI match for this ref → can't verify, keep it (fail-open)
              return { item, compatible: true };
            }

            const { data: compatData } = await api.get(
              `/rapidapi/compatible-cars/${encodeURIComponent(firstArticleNo)}`
            );

            console.log(compatData);
            const compatList = compatData?.items || [];

            if (compatList.length === 0) {
              // Empty compat list → no data available, not proof of
              // incompatibility → keep it (fail-open)
              return { item, compatible: true };
            }

            const isCompatible = compatList.some((entry) => {
              const entryManu = normalizeCompatText(entry.manufacturerName);
              const manuOk = !wantedManu || entryManu.includes(wantedManu) || wantedManu.includes(entryManu);
              const entryEngineToks = engineTokens(entry.typeEngineName || "");
              const engineOk = wantedEngineToks.length === 0
                || wantedEngineToks.every((t) => entryEngineToks.includes(t));
              return manuOk && engineOk;
            });

            return { item, compatible: isCompatible };
          } catch (e) {
            // Any error while checking → don't block the user, keep the item
            console.warn("compat check failed for", item.oem_ref, e);
            return { item, compatible: true };
          }
        })
      );

  const wantedDisplacements = extractDisplacements(vehicle?.engine || "");

      const finalItems = checked
        .filter((c) => c.compatible)
        .map((c) => c.item)
        .filter((item) => !hasConflictingDisplacement(item, wantedDisplacements));

      const filteredData = {
        ...data,
        items: finalItems,
      };
      filteredData.count = filteredData.items.length;
      setResults(filteredData);
      setIsPartial(data.is_partial === true);
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
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1 text-sm text-slate-300 hover:text-white"
              data-testid="back-to-subcategories"
            >
              <ChevronLeft className="w-4 h-4" /> Retour aux sous-catégories
            </button>
            <span className="text-slate-600">·</span>
            <Link
              to={`/vehicule/${vin}`}
              className="inline-flex items-center gap-1 text-sm text-slate-300 hover:text-white"
              data-testid="back-to-vehicle"
            >
              <Car className="w-4 h-4" /> Véhicule
            </Link>
          </div>

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
            {vehicle?.engine && vehicle.engine !== "—" && (
  <span className="bn-chip bg-white/10 text-white border-white/20">
    <Car className="w-3 h-3" /> {vehicle.engine}
  </span>
)}
          </div>

          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
            Catalogue OEM officiel
          </h1>
        </div>
      </div>

      {/* Search bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <form onSubmit={handleSubmit} className="flex items-center gap-2" data-testid="oem-search-form">
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
              </div>
              <div className="text-right">
                <div className="font-display text-2xl font-bold text-emerald-600">{results.count}</div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">en stock chez nous</div>
              </div>
            </div>

             {/* Partial-results Banner */}
    {isPartial && (
      <div className="flex items-start sm:items-center gap-3 mb-5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-sm text-sm text-amber-800" data-testid="partial-results-banner">
        <svg className="w-5 h-5 shrink-0 text-amber-500 mt-0.5 sm:mt-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        <span className="flex-1 text-xs leading-relaxed">
          <strong className="font-bold">Résultats partiels</strong> — certaines références n&apos;ont pas pu être vérifiées à temps.
          Cliquez sur <em>Rechercher</em> à nouveau pour afficher plus d&apos;articles
          <span className="text-amber-600"> (le catalogue se charge en arrière-plan)</span>.
        </span>
        <button
          type="button"
          onClick={() => runSearch()}
          disabled={loadingSearch}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-sm text-xs font-bold uppercase tracking-wider transition-colors"
          data-testid="partial-results-reload"
        >
          <Loader2 className={`w-3.5 h-3.5 ${loadingSearch ? "animate-spin" : "hidden"}`} />
          🔄 Recharger
        </button>
      </div>
    )}

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
                  const urlTokens = (initialQuery || "")
    .toLowerCase()
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
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

function StockProductGrid({ items }) {
  /* Grid of product cards from any supplier. Each card supports quantity
   * selection and "Ajouter au panier". Supplier identity is intentionally
   * hidden — only the price, brand of the part, and stock status are shown. */
  const navigate = useNavigate();
  const { add: addToCart } = useCart();
  const [qty, setQty] = useState({});
  const [images, setImages] = useState({});       // { [oem_ref]: s3image_url | null }
  const [imgErrors, setImgErrors] = useState({});  // { [oem_ref]: true }

    useEffect(() => {
    let cancelled = false;
    const refsToFetch = items
      .map((it) => it.oem_ref || it.reference)
      .filter((ref) => ref && images[ref] === undefined);

    if (refsToFetch.length === 0) return;

    (async () => {
      const results = await Promise.all(
        refsToFetch.map((ref) =>
          api
            .get(`/rapidapi/article-info`, { params: { ref } })
            .then(({ data }) => [ref, data?.article?.s3image || null])
            .catch(() => [ref, null])
        )
      );
      if (cancelled) return;
      setImages((prev) => {
        const next = { ...prev };
        results.forEach(([ref, url]) => { next[ref] = url; });
        return next;
      });
    })();

    return () => { cancelled = true; };
  }, [items, images]);


  const setQuantity = (ref, value) => {
    setQty((s) => ({ ...s, [ref]: Math.max(1, value) }));
  };

  const handleAdd = (item) => {
    const q = Math.max(1, Math.min(qty[item.reference] || 1, item.stock || 1));
    addToCart(
      {
        ref: item.reference,
         oemRef: item.oem_ref || item.reference,
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
        const hasPrice = it.prix_tnd != null && it.prix_tnd > 0;
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
              </div>
              <div className="flex items-center gap-2">
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
              {(() => {
                const f = (it.fournisseur || "").toUpperCase().trim();
                // Hide supplier names, show only real part brands (e.g. SNR, FEBI, BOSCH)
                const SUPPLIER_NAMES = new Set(["FADPRO", "COPIA", "PARTSPRO"]);
                if (!f || SUPPLIER_NAMES.has(f)) return null;
                return (
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-600 mb-1">
                    {it.fournisseur}
                  </div>
                );
              })()}
             <div className="flex items-start gap-3 mb-2">
                <div className="w-23 h-20 flex-shrink-0 rounded-sm border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden" data-testid={`stock-image-container-${it.reference}`}>
                  {(() => {
                    const ref = it.oem_ref || it.reference;
                    const url = images[ref];
                    if (url === undefined) {
                      return <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-red-600 rounded-full animate-spin" />;
                    }
                    if (!url || imgErrors[ref]) {
                      return <Package className="w-5 h-5 text-slate-300" />;
                    }
                    return (
                      <img
                        src={url}
                        alt={it.designation || it.oem_name || ""}
                        className="max-w-full max-h-full object-contain mix-blend-multiply p-1"
                        onError={() => setImgErrors((prev) => ({ ...prev, [ref]: true }))}
                        data-testid={`stock-image-${it.reference}`}
                      />
                    );
                  })()}
                </div>
                <h3 className="font-display font-black text-slate-900 text-base leading-tight" data-testid={`stock-name-${it.reference}`}>
                  {it.designation || it.oem_name || "—"}
                </h3>
              </div>
              <div className="text-xs text-slate-500 mb-3">
                Réf. <span className="font-mono-vin font-semibold text-slate-700">{it.reference}</span>
              </div>
            

              <div className="mt-auto">
                <div className="flex items-end justify-between mb-3">
                  <div>
                    <div className="font-display font-black text-2xl text-red-600 leading-none" data-testid={`stock-price-${it.reference}`}>
                      {hasPrice ? formatPrice(it.prix_tnd) : (
                        <span className="text-base text-slate-500 italic font-semibold">Prix sur demande</span>
                      )}
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
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SourceBadge({ source }) {
  // Kept as a no-op to avoid breaking any external import. Supplier identity
  // is intentionally hidden in the UI.
  return null;
}
