import { useEffect, useState, useRef } from "react";
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
import { useAuth } from "@/context/AuthContext";

const SUGGESTIONS = [
  "frein", "pompe", "filtre", "huile", "courroie", "bougie",
  "amortisseur", "embrayage", "alternateur", "démarreur",
  "phare", "rétroviseur", "radiateur", "thermostat",
];

// Cache der zuletzt gesehenen Suchergebnisse pro VIN. Überlebt einen Remount
// der Seite (z.B. Browser-Zurück von /article/:ref), damit dort nicht
// erneut ein Request ausgelöst wird — die Ergebnisse werden direkt aus dem
// Cache wiederhergestellt.
const searchStateCache = new Map();

// Normalize text for loose manufacturer-name comparison: lowercase, strip accents
function normalizeCompatText(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
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

// ── Quantité minimale par type de pièce ─────────────────────────────
// Certaines pièces se vendent/se remplacent obligatoirement par paire
// (ex: disques de frein avant/arrière — on ne change jamais un seul
// disque sur un essieu) — on impose donc une quantité minimale pour ces
// catégories afin d'éviter qu'un client commande une seule unité.
// Pour ajouter une nouvelle règle : copier une ligne et adapter les tokens.
function normalizeMinQtyText(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

const MIN_QTY_RULES = [
  { tokens: ["disque", "frein"], minQty: 2 },
];

function getMinQuantity(item) {
  const haystack = normalizeMinQtyText(
    [item?.designation, item?.oem_name, item?.categorie]
      .filter(Boolean)
      .join(" ")
  );
  for (const rule of MIN_QTY_RULES) {
    if (rule.tokens.every((t) => haystack.includes(t))) {
      return rule.minQty;
    }
  }
  return 1;
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
  // Beim Mount zunächst prüfen, ob für DIESES Fahrzeug UND DIESE Suchanfrage
  // (vin + q) bereits ein gecachter Suchzustand existiert (z.B. weil man von
  // /article/:ref per Browser-Zurück hierher zurückkommt) — falls ja, direkt
  // daraus starten statt mit leeren Werten. Der Cache-Key MUSS die Query
  // enthalten (nicht nur die VIN) — sonst würde ein Wechsel von einer
  // Unterkategorie (z.B. "Capot moteur") zu einer anderen (z.B. "Pare-choc
  // AV") fälschlich die alten Ergebnisse der vorherigen Suche anzeigen.
  const cacheKey = `${vin}::${initialQuery}`;
  const cached = searchStateCache.get(cacheKey);
  const [search, setSearch] = useState(cached?.search ?? initialQuery);
  const [results, setResults] = useState(cached?.results ?? null);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [error, setError] = useState("");
  const [designationFilter, setDesignationFilter] = useState(cached?.designationFilter ?? "");
  const [isPartial, setIsPartial] = useState(cached?.isPartial ?? false);
  // Tracks which query the currently-held `results` actually belong to. Die
  // Route wechselt bei einem Klick auf eine andere Unterkategorie oft NUR
  // den `q`-Parameter, ohne die Komponente neu zu mounten — ein einfaches
  // "!results"-Check im Auto-Search-Effekt unten würde dann fälschlich
  // annehmen, die (alten) Ergebnisse seien schon aktuell, und die neue Suche
  // nie auslösen. Das war die Ursache des gemeldeten Bugs.
  const lastRunQueryRef = useRef(cached ? initialQuery : null);

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

  // Auto-run search if a query was passed via URL (?q=...). Läuft erneut,
  // sobald sich `initialQuery` von der zuletzt tatsächlich ausgeführten
  // Suche unterscheidet — unabhängig davon, ob `results` schon (von einer
  // ANDEREN Unterkategorie) befüllt ist. Genau das war der gemeldete Bug:
  // Capot-moteur-Ergebnisse blieben stehen, wenn man danach auf Pare-choc
  // wechselte, weil der alte "!results"-Check die neue Suche blockierte.
  useEffect(() => {
    if (
      tecdoc?.model_id &&
      initialQuery &&
      initialQuery.length >= 2 &&
      !loadingSearch &&
      lastRunQueryRef.current !== initialQuery
    ) {
      runSearch(initialQuery);
    }
  }, [tecdoc, initialQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cache immer synchron mit dem aktuellen Suchzustand halten, damit ein
  // späterer Remount dieser Komponente (z.B. Browser-Zurück von
  // /article/:ref) exakt diesen Zustand wiederherstellen kann, ohne einen
  // neuen Request auszulösen. Key = vin + Query, damit unterschiedliche
  // Unterkategorien sich nicht gegenseitig überschreiben.
  useEffect(() => {
    searchStateCache.set(cacheKey, { search, results, designationFilter, isPartial });
  }, [cacheKey, search, results, designationFilter, isPartial]);

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
    // Markiere diese Query sofort als "bereits ausgeführt" — verhindert,
    // dass der Auto-Search-Effekt sie während des laufenden Requests erneut
    // (oder nach Abschluss fälschlich für eine andere Query) auslöst.
    lastRunQueryRef.current = query;
    // Suchfeld synchron halten — relevant, wenn `runSearch` durch einen
    // Unterkategorie-Wechsel (initialQuery) statt durch manuelle Eingabe
    // ausgelöst wurde, damit die Anzeige nicht die alte Suchanfrage zeigt.
    setSearch(query);
    setLoadingSearch(true);
    setError("");
    setDesignationFilter("");
    setIsPartial(false);
    try {
      const useSplit = typeof splitOverride === "boolean" ? splitOverride : initialSplit;
      // WICHTIG: `tecdoc.model_id` ist immer das erste von TecDoc GERATENE
      // Modell für diese VIN (matchingModels[0], z.B. LEON 5F1) — nicht
      // zwingend das Modell, das der Kunde im Motor-Picker tatsächlich
      // ausgewählt hat (z.B. LEON ST 5F8). `vehicle.tecdoc_model_id` trägt
      // die korrekte modelId der GEWÄHLTEN Variante (siehe
      // confirmEngineVariant in LandingPage) und hat deshalb Vorrang.
      const modelIdToUse = vehicle?.tecdoc_model_id || tecdoc.model_id;
      const params = { model_id: modelIdToUse, q: query, lang_id: 6, limit: 50 };
      if (useSplit) params.split = "true";
      // Pass the VIN so the backend can pick the right TecDoc variant
      // (engine-token match via sra_commercial) instead of always defaulting
      // to the first vehicleId returned by list-vehicles-id.
      if (vin) params.vin = vin;
      // Hand the vehicle name to the backend so it can verify supplier items
      // against piecesautos.tn compatibility lists when their title doesn't
      // already mention the model.
      if (vehicle?.vehicle_id) params.vehicle_id = vehicle.vehicle_id;

      const veh = [vehicle?.make || tecdoc.manu_name, vehicle?.model || tecdoc.model_name].filter(Boolean).join(" ").trim();
      if (veh) params.vehicle_name = veh;
      // Precise compatibility check: manufacturer + exact engine name of the
      // selected TecDoc vehicle variant (from the fuel/engine dropdown).
      if (vehicle?.make || tecdoc.manu_name) params.manufacturer_name = vehicle?.make || tecdoc.manu_name;
      if (vehicle?.engine && vehicle.engine !== "—") params.engine_name = vehicle.engine;
      const { data } = await api.get(`/oem-stock-search`, { params });
      // Vehicle to match against: manufacturer + exact engine name of the
      // selected TecDoc variant.
      const wantedManu = normalizeCompatText(vehicle?.make || tecdoc.manu_name);
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
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-600" />
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
        <Link to={`/vehicule/${vin}`} className="text-blue-600 hover:underline text-sm">
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
            {/* tecdoc.manu_name/model_name kommen aus /rapidapi/vin/{vin} und
                sind IMMER das erste geratene Modell (matchingModels[0]) —
                unabhängig davon, welches Modell im Motor-Picker tatsächlich
                gewählt wurde (z.B. LEON 5F1 geraten, aber LEON ST 5F8
                ausgewählt). `vehicle.make`/`vehicle.model` aus dem
                CartContext tragen die WIRKLICH gewählte Variante (siehe
                confirmEngineVariant in LandingPage) und haben deshalb
                Vorrang; der TecDoc-Rateversuch dient nur als Fallback,
                falls kein Motor-Picker durchlaufen wurde. */}
            <span className="bn-chip bg-white/10 text-white border-white/20">
              <Car className="w-3 h-3" /> {vehicle?.make || tecdoc.manu_name}
            </span>
            <span className="bn-chip bg-white/10 text-white border-white/20">{vehicle?.model || tecdoc.model_name}</span>
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
            <span className="bn-chip bg-blue-600/30 text-blue-200 border-blue-500/40 font-mono-vin">
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
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold px-5 py-2.5 rounded-sm transition-colors inline-flex items-center gap-2 whitespace-nowrap"
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
                  className="text-xs px-2.5 py-1 border border-slate-200 rounded-sm bg-white hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
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
          <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-sm text-sm" data-testid="oem-error">
            {error}
          </div>
        )}

        {loadingSearch && (
          <div className="flex items-center justify-center py-20 text-slate-500" data-testid="oem-loading">
            <Loader2 className="w-7 h-7 animate-spin mr-3 text-blue-600" />
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
                          className="mt-3 text-xs text-blue-600 hover:underline font-semibold"
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

// Farb-Badges für die interne Partnerquelle — nur für Admins sichtbar (siehe
// isAdmin-Check in StockProductGrid). Normale Kunden sehen diese Codes nie,
// nur den echten Teile-Hersteller (falls im `fournisseur`-Feld vorhanden).
const ADMIN_SOURCE_BADGE = {
  fadpro: "bg-amber-500/20 text-amber-300",
  copia: "bg-sky-500/20 text-sky-300",
  partspro: "bg-violet-500/20 text-violet-300",
  proad: "bg-emerald-500/20 text-emerald-300",
  steq: "bg-rose-500/20 text-rose-300",
};

function StockProductGrid({ items }) {
  /* Grid of product cards from any supplier. Each card supports quantity
   * selection and "Ajouter au panier". Supplier identity is intentionally
   * hidden from regular customers — only admins see which internal partner
   * (FadPro / Copia / PartsPro / AD-Tunisie) an item came from. Certain
   * part types (see MIN_QTY_RULES / getMinQuantity above) enforce a
   * minimum order quantity, e.g. brake discs are always sold as a pair. */
  const navigate = useNavigate();
  const { add: addToCart } = useCart();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [qty, setQty] = useState({});
  const [images, setImages] = useState({});       // { [oem_ref]: s3image_url | null }
  const [imgErrors, setImgErrors] = useState({});  // { [oem_ref]: true }

    useEffect(() => {
    let cancelled = false;
    // Pour chaque ref, on transmet aussi le libellé attendu (oem_name /
    // designation) — le backend s'en sert pour choisir, parmi TOUS les
    // articles TecDoc référençant cet OEM, celui dont l'`articleProductName`
    // correspond réellement (ex: "Pare-chocs"), au lieu de prendre
    // aveuglément le premier résultat renvoyé par l'API (qui pouvait montrer
    // une photo d'un article différent pour le même numéro OEM).
    const seenRefs = new Set();
    const toFetch = [];
    items.forEach((it) => {
      const ref = it.oem_ref || it.reference;
      if (!ref || images[ref] !== undefined || seenRefs.has(ref)) return;
      seenRefs.add(ref);
      toFetch.push({ ref, label: it.oem_name || it.designation || "" });
    });

    if (toFetch.length === 0) return;

    (async () => {
      const results = await Promise.all(
        toFetch.map(({ ref, label }) =>
          api
            .get(`/rapidapi/article-info`, { params: { ref, label } })
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


  const setQuantity = (ref, value, minQty = 1) => {
    setQty((s) => ({ ...s, [ref]: Math.max(minQty, value) }));
  };

  const handleAdd = (item) => {
    const minQty = getMinQuantity(item);
    const requested = qty[item.reference] ?? minQty;
    // `item.stock` n'est presque jamais renseigné par les fournisseurs —
    // on ne plafonne donc QUE si c'est un nombre positif exploitable
    // (auparavant `item.stock || 1` ramenait systématiquement la quantité
    // à 1, ce qui empêchait toute commande multiple).
    const maxQty = typeof item.stock === "number" && item.stock > 0 ? item.stock : Infinity;
    const q = Math.max(minQty, Math.min(requested, maxQty));
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
    setQuantity(item.reference, minQty, minQty);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="stock-product-grid">
      {items.map((it, i) => {
        const minQty = getMinQuantity(it);
        const q = qty[it.reference] ?? minQty;
        const inStock = !!it.in_stock;
        const hasPrice = it.prix_tnd != null && it.prix_tnd > 0;
        return (
          <div
            key={`${it.reference}-${i}`}
            className={`group bg-white border rounded-sm overflow-hidden flex flex-col cursor-pointer transition-all ${
              inStock
                ? "border-slate-200 hover:border-blue-500 hover:shadow-xl"
                : "border-slate-200 opacity-90 hover:border-slate-400 hover:shadow-lg"
            }`}
onClick={() => navigate(`/article/${encodeURIComponent(it.oem_ref || it.reference)}`, { state: { item: it } })}
            data-testid={`stock-card-${it.reference}`}
          >
            {/* Header strip */}
            <div className="flex items-center justify-between bg-gradient-to-r from-blue-900 to-blue-950 text-white px-4 py-2.5">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-blue-300">
                <Tag className="w-3 h-3" />
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && it.source && (
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm ${ADMIN_SOURCE_BADGE[it.source] || "bg-white/10 text-white/70"}`}
                    data-testid={`admin-source-badge-${it.reference}`}
                    title="Visible uniquement par l'administrateur"
                  >
                    {it.source}
                  </span>
                )}
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
                // Hide internal supplier codes from regular customers, show only
                // real part brands (e.g. SNR, FEBI, BOSCH). Admins already see the
                // internal source via the badge above, so this stays as-is for them.
                const SUPPLIER_NAMES = new Set(["FADPRO", "COPIA", "PARTSPRO", "PROAD"]);
                if (!f || SUPPLIER_NAMES.has(f)) return null;
                return (
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600 mb-1">
                    {it.fournisseur}
                  </div>
                );
              })()}
              {/* Image en haut, nom directement en dessous */}
              <div className="mb-2">
                <div className="w-full h-32 rounded-sm border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden mb-2" data-testid={`stock-image-container-${it.reference}`}>
                  {(() => {
                    const ref = it.oem_ref || it.reference;
                    const url = images[ref];
                    if (url === undefined) {
                      return <div className="w-4 h-4 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />;
                    }
                    if (!url || imgErrors[ref]) {
                      return <Package className="w-8 h-8 text-slate-300" />;
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
              <div className="text-xs text-slate-500 mb-3 flex items-center flex-wrap gap-x-2 gap-y-1">
                <span>Réf. <span className="font-mono-vin font-semibold text-slate-700">{it.reference}</span></span>
                {minQty > 1 && (
                  <span
                    className="inline-flex items-center bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm"
                    data-testid={`min-qty-badge-${it.reference}`}
                  >
                    Vendu par paire · min. {minQty}
                  </span>
                )}
              </div>


              <div className="mt-auto">
                <div className="flex items-end justify-between mb-3">
                  <div>
                    <div className="font-display font-black text-2xl text-blue-600 leading-none" data-testid={`stock-price-${it.reference}`}>
                      {hasPrice ? formatPrice(it.prix_tnd) : (
                        <span className="text-base text-slate-500 italic font-semibold">Prix sur demande</span>
                      )}
                    </div>
                  </div>
                  <div className="inline-flex items-center border border-slate-300 rounded-sm">
                    <button
                      onClick={(e) => { e.stopPropagation(); setQuantity(it.reference, q - 1, minQty); }}
                      className="px-2 py-1.5 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      data-testid={`stock-qty-minus-${it.reference}`}
                      aria-label="Diminuer"
                      disabled={!inStock || q <= minQty}
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-3 text-sm font-bold w-8 text-center">{q}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setQuantity(it.reference, q + 1, minQty); }}
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
                      ? "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-900/20"
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
  // is intentionally hidden from regular customers in the UI.
  return null;
}
