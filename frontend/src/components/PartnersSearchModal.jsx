import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, ShoppingCart, Package, Loader2, Search, AlertCircle, Tag, BadgeCheck, Layers } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiError, formatPrice } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";

const SOURCE_THEME = {
  fadpro:   { name: "Fournisseur", accent: "from-amber-400 to-amber-600",  ring: "ring-amber-400/40",  text: "text-amber-300",  bgChip: "bg-amber-500/15" },
  copia:    { name: "Fournisseur", accent: "from-sky-400 to-sky-600",      ring: "ring-sky-400/40",    text: "text-sky-300",    bgChip: "bg-sky-500/15" },
  partspro: { name: "Fournisseur", accent: "from-violet-400 to-violet-600",ring: "ring-violet-400/40", text: "text-violet-300", bgChip: "bg-violet-500/15" },
  proad:    { name: "Fournisseur", accent: "from-emerald-400 to-emerald-600", ring: "ring-emerald-400/40", text: "text-emerald-300", bgChip: "bg-emerald-500/15" },  // 👈 NEU
  steq:     { name: "Fournisseur", accent: "from-rose-400 to-rose-600",     ring: "ring-rose-400/40",   text: "text-rose-300",   bgChip: "bg-rose-500/15" },
};

// Badge-Farben für die INTERNE Lieferantenquelle (fadpro/copia/partspro/
// proad) — wird NUR für user?.role === "admin" gerendert, siehe unten.
// Normale Kunden sehen dieses Badge nie.
const ADMIN_SOURCE_BADGE = {
  fadpro:   "bg-amber-500/20 text-amber-300",
  copia:    "bg-sky-500/20 text-sky-300",
  partspro: "bg-violet-500/20 text-violet-300",
  proad:    "bg-emerald-500/20 text-emerald-300",
  steq:     "bg-rose-500/20 text-rose-300",
};

// Interne Partner-/Lieferantencodes, die NIE als "fournisseur"-Badge auf der
// Karte angezeigt werden sollen (weder im Original-Case noch in Varianten
// wie "AD-Tunisie", "ProAd", "COPIA", ...) — der Kunde soll unsere internen
// Lieferantennamen nicht sehen, nur die echte Produktmarke (falls vorhanden).
const HIDDEN_FOURNISSEUR_CODES = new Set(["FADPRO", "COPIA", "PARTSPRO", "PROAD", "AD-TUNISIE", "STEQ"]);

// Modul-weiter Ergebnis-Cache, keyed nach categorySlug (oder query bei
// Referenzsuche). Überlebt das Unmounten der Modal-Instanz (z.B. wenn der
// Parent — LandingPage — beim Navigieren zu /article/:ref demontiert und
// beim Zurück-Navigieren neu gemountet wird), damit das Popup beim
// automatischen Wiederöffnen die Artikel SOFORT aus dem Cache zeigt statt
// erneut die API abzufragen. TTL verhindert dauerhaft veraltete Preise/
// Bestände innerhalb einer langen Session.
const resultsCache = new Map();
const RESULTS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 Minuten

/**
 * PartnersSearchModal — modern blue-tinted overlay that fetches a reference
 * from FadPro + Copia + PartsPro in parallel and lets the user add the
 * best match to their cart.  Visually distinct from any supplier portal:
 * deep-blue canvas, gradient brand stripes, neon accents per source.
 */
export default function PartnersSearchModal({ open, query, categorySlug, onClose }) {
  const { add: addToCart } = useCart();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const cacheKey = categorySlug || query || "";
  const cachedEntry = resultsCache.get(cacheKey);
  const cachedIsFresh = cachedEntry && Date.now() - cachedEntry.cachedAt < RESULTS_CACHE_TTL_MS;
  // Direkt aus dem Cache initialisieren, damit beim Wiederöffnen (z.B. nach
  // Browser-Zurück von der Artikel-Detailseite) gar kein Lade-Spinner/leerer
  // Zustand aufblitzt — die Artikel sind vom allerersten Render an da.
  const [loading, setLoading] = useState(!cachedIsFresh && !!(query || categorySlug));
  const [error, setError] = useState("");
  const [items, setItems] = useState(cachedIsFresh ? cachedEntry.items : []);
  const [qtys, setQtys] = useState({});

  useEffect(() => {
    if (!open) return;
    if (!query && !categorySlug) return;
    const key = categorySlug || query;
    const cached = resultsCache.get(key);
    if (cached && Date.now() - cached.cachedAt < RESULTS_CACHE_TTL_MS) {
      // Cache-Treffer — Artikel sofort anzeigen, kein erneuter Request.
      setItems(cached.items);
      setError("");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      setItems([]);
      try {
        const endpoint = categorySlug ? `/partners/category-products` : `/partners/reference-search`;
        const params = categorySlug ? { slug: categorySlug, limit: 12 } : { ref: query };
        const { data } = await api.get(endpoint, { params });
        // In-Stock-Artikel immer zuerst, danach nach Preis aufsteigend —
        // unabhängig davon, in welcher Reihenfolge das Backend liefert.
        const sorted = [...(data.items || [])].sort((a, b) => {
          if (!!a.in_stock !== !!b.in_stock) return a.in_stock ? -1 : 1;
          return (a.prix_tnd ?? Infinity) - (b.prix_tnd ?? Infinity);
        });
        if (!cancelled) {
          setItems(sorted);
          resultsCache.set(key, { items: sorted, cachedAt: Date.now() });
        }
      } catch (e) {
        if (!cancelled) setError(formatApiError(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, query, categorySlug]);

  if (!open) return null;

  const grouped = items.reduce((acc, it) => {
    const s = it.source || "fadpro";
    (acc[s] = acc[s] || []).push(it);
    return acc;
  }, {});

  const handleAdd = (it) => {
    const q = Math.max(1, qtys[it.reference] || 1);
    addToCart(
      {
        ref: it.reference,
        name: it.designation || it.reference,
        brand: it.fournisseur || "",
        image: "",
        price_tnd: it.prix_tnd,
        source: it.source || "fadpro",
      },
      q,
    );
    toast.success(`${q} × ${it.reference} ajouté au panier`);
  };

  const goToDetail = (it) => {
    // WICHTIG: hier bewusst KEIN onClose(). Der Parent (z.B. LandingPage)
    // merkt sich den zuletzt offenen Kategorie-/Suchzustand in einem
    // modul-weiten Cache, SOBALD er gesetzt wird — ruft man hier onClose()
    // auf, würde der Parent-State auf "geschlossen" zurückgesetzt, kurz
    // bevor die Seite beim Routenwechsel entmountet wird, und genau dieser
    // "geschlossen"-Wert würde dann gecacht. Beim Zurück-Navigieren (Browser
    // Back) bliebe das Popup dann fälschlich zu. Ein echtes Schließen
    // passiert nur über die expliziten "Fermer"-Buttons/Backdrop-Klick, die
    // weiterhin onClose() aufrufen.
    //
    // Pass the full clicked item along via router state so ArticleDetail
    // can render immediately from it (designation, price, stock, source)
    // even when the reference doesn't resolve in TecDoc — this is the
    // normal case for AD-Tunisie / Copia / PartsPro supplier-internal SKUs.

      if (!categorySlug) {
    onClose();
  }
    navigate(`/article/${encodeURIComponent(it.reference)}`, { state: { item: it } });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 overflow-y-auto"
      onClick={onClose}
      data-testid="partners-search-modal"
      style={{ background: "radial-gradient(ellipse at top, rgba(30,58,138,0.25), rgba(2,6,23,0.92))", backdropFilter: "blur(8px)" }}
    >
      <div
        className="w-full max-w-6xl bg-blue-950 text-white rounded-md shadow-[0_25px_80px_-15px_rgba(30,58,138,0.5)] ring-1 ring-blue-600/30 overflow-hidden my-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Brand stripe header */}
        <div className="relative bg-blue-950 border-b border-white/10 px-6 sm:px-8 py-6 overflow-hidden">
          <div className="absolute inset-0 opacity-20" style={{ background: "linear-gradient(90deg, rgba(245,158,11,0.6) 0%, rgba(37,99,235,0.6) 33%, rgba(56,189,248,0.6) 66%, rgba(168,85,247,0.6) 100%)" }} />
          <div className="absolute -bottom-px left-0 right-0 h-px bg-gradient-to-r from-amber-400 via-blue-500 via-sky-400 to-violet-400" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-blue-400 mb-1.5">
                {categorySlug ? "Catégorie populaire" : "Recherche partenaires"}
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-black tracking-tight uppercase leading-none" data-testid="partners-search-title">
                {categorySlug
                  ? <>Pièces disponibles <span className="font-mono-vin text-blue-400">{categorySlug.replace(/-/g, " ")}</span></>
                  : query
                    ? <>Référence <span className="font-mono-vin text-blue-400">{query}</span></>
                    : "Recherche…"}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px]">
                <span className="inline-flex items-center gap-1.5 text-white/70">
                  {loading ? (
                    <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-gradient-to-r from-amber-400 via-blue-500 to-violet-400" />
                  )}
                  <span className="font-semibold">
                    {loading ? "Recherche en cours…" : `${items.length} article${items.length > 1 ? "s" : ""} trouvé${items.length > 1 ? "s" : ""}`}
                  </span>
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white p-2 hover:bg-white/10 rounded-sm transition-colors"
              aria-label="Fermer"
              data-testid="partners-modal-close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto bg-blue-950 px-4 sm:px-8 py-6">
          {loading && (
            <div className="py-16 text-center text-white/70" data-testid="partners-loading">
              <Loader2 className="w-8 h-8 mx-auto mb-3 text-blue-500 animate-spin" />
              <div className="text-sm">Interrogation simultanée de nos partenaires…</div>
              <div className="text-xs mt-1 text-white/40">Recherche en stock chez nous</div>
            </div>
          )}

          {!loading && error && (
            <div className="py-12 text-center" data-testid="partners-error">
              <AlertCircle className="w-10 h-10 mx-auto mb-3 text-blue-500" />
              <div className="text-sm text-blue-300">{error}</div>
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="py-16 text-center text-white/60" data-testid="partners-empty">
              <Package className="w-10 h-10 mx-auto mb-3 text-white/30" />
              <div className="text-sm">Aucun article trouvé chez nos partenaires pour cette référence.</div>
              <div className="text-xs mt-1 text-white/40">Essayez avec une référence OEM plus précise.</div>
            </div>
          )}

          {!loading && items.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {items.map((it, i) => {
                const theme = SOURCE_THEME[it.source] || SOURCE_THEME.fadpro;
                const q = qtys[it.reference] || 1;
                const stockColor = it.in_stock ? "text-emerald-400" : "text-red-400";
                // Interne Lieferantencodes (FadPro/Copia/PartsPro/AD-Tunisie/
                // ProAd) nie als Badge zeigen — nur eine ECHTE Produktmarke
                // (falls das Feld die mal enthält) wird angezeigt.
                const fournisseurUpper = (it.fournisseur || "").trim().toUpperCase();
                const showFournisseur =
                  it.fournisseur && !HIDDEN_FOURNISSEUR_CODES.has(fournisseurUpper);
                return (
                  <div
                    key={`${it.source}-${it.reference}-${i}`}
                    onClick={() => goToDetail(it)}
                    className={`relative bg-blue-900/40 border border-white/10 hover:border-white/30 rounded-sm overflow-hidden ring-1 ${theme.ring} hover:-translate-y-0.5 transition-all`}
                    data-testid={`partners-card-${it.source}-${it.reference}`}
                  >
                    {/* Top accent stripe */}
                    <div className={`h-1 bg-gradient-to-r ${theme.accent}`} />

                    <div className="p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <div className="font-display font-black text-base text-white leading-tight line-clamp-2">
                            {it.designation || it.reference}
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px]">
                            <span className={`${theme.bgChip} ${theme.text} font-mono-vin px-2 py-0.5 rounded-sm`}>
                              <Tag className="inline w-3 h-3 -mt-px mr-0.5" /> {it.reference}
                            </span>
                             {showFournisseur && (
                              <span className="bg-white/5 text-white/70 px-2 py-0.5 rounded-sm">{it.fournisseur}</span>
                            )}
                            {/* Interne Lieferantenquelle (fadpro/copia/partspro/proad) —
                                NUR für Admins sichtbar. Normale Kunden sehen dieses Badge nie. */}
                            {isAdmin && it.source && (
                              <span
                                className={`${ADMIN_SOURCE_BADGE[it.source] || "bg-white/10 text-white/70"} px-2 py-0.5 rounded-sm font-mono-vin uppercase`}
                                data-testid={`admin-source-badge-${it.reference}`}
                                title="Visible uniquement par l'administrateur"
                              >
                                {it.source}
                              </span>
                            )}
{it.in_stock ? (
  <span className="bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-sm inline-flex items-center gap-1">
    <BadgeCheck className="w-3 h-3" /> En stock
  </span>
) : (
  <span className="bg-red-500 text-white px-2 py-0.5 rounded-sm inline-flex items-center gap-1 font-semibold">
    Hors stock
  </span>
)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-end justify-between gap-3 mt-4">
                        <div>
                          <div className="text-[10px] uppercase tracking-widest text-white/50 mb-0.5">Prix</div>
                          <div className="font-display font-black text-2xl text-blue-400 leading-none">
                            {formatPrice(it.prix_tnd)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <div className="inline-flex items-center border border-white/20 rounded-sm bg-blue-950">
                            <button onClick={() => setQtys((s) => ({ ...s, [it.reference]: Math.max(1, q - 1) }))} className="px-2 py-1.5 text-white/70 hover:text-white hover:bg-white/5">−</button>
                            <span className="px-2.5 text-sm font-bold w-8 text-center">{q}</span>
                            <button onClick={() => setQtys((s) => ({ ...s, [it.reference]: q + 1 }))} className="px-2 py-1.5 text-white/70 hover:text-white hover:bg-white/5">+</button>
                          </div>
                          <button
                            onClick={() => handleAdd(it)}
                            disabled={!it.in_stock}
                            className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-wider px-3 py-2 rounded-sm transition-colors"
                            data-testid={`partners-add-${it.source}-${it.reference}`}
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                            Ajouter
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-blue-950/80 border-t border-white/5 px-6 py-3 text-[11px] text-white/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5" />
            <span>Recherche en stock — pièces disponibles immédiatement</span>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white font-semibold uppercase tracking-wider text-[10px]" data-testid="partners-modal-footer-close">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

function SourceLight({ code, count, loading }) {
  // Deprecated — supplier names are anonymised in the UI; kept for backward compat
  // in case other components import it. Safe to remove once unused everywhere.
  const theme = SOURCE_THEME[code];
  if (!theme) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      {loading ? (
        <Loader2 className={`w-3 h-3 animate-spin ${theme.text}`} />
      ) : (
        <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${theme.accent}`} />
      )}
      <span className="text-white/80 font-semibold">{theme.name}</span>
      <span className="text-white/40">{loading ? "…" : `(${count})`}</span>
    </span>
  );
}
