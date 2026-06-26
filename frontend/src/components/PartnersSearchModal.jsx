import { useEffect, useState } from "react";
import { X, ShoppingCart, Package, Loader2, Search, AlertCircle, Tag, BadgeCheck, Layers } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiError, formatPrice } from "@/lib/api";
import { useCart } from "@/context/CartContext";

const SOURCE_THEME = {
  fadpro:   { name: "Fournisseur", accent: "from-amber-400 to-amber-600",  ring: "ring-amber-400/40",  text: "text-amber-300",  bgChip: "bg-amber-500/15" },
  copia:    { name: "Fournisseur", accent: "from-sky-400 to-sky-600",      ring: "ring-sky-400/40",    text: "text-sky-300",    bgChip: "bg-sky-500/15" },
  partspro: { name: "Fournisseur", accent: "from-violet-400 to-violet-600",ring: "ring-violet-400/40", text: "text-violet-300", bgChip: "bg-violet-500/15" },
};

/**
 * PartnersSearchModal — modern dark-tinted overlay that fetches a reference
 * from FadPro + Copia + PartsPro in parallel and lets the user add the
 * best match to their cart.  Visually distinct from any supplier portal:
 * jet-black canvas, gradient brand stripes, neon accents per source.
 */
export default function PartnersSearchModal({ open, query, categorySlug, onClose }) {
  const { add: addToCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [qtys, setQtys] = useState({});

  useEffect(() => {
    if (!open) return;
    if (!query && !categorySlug) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      setItems([]);
      try {
        const endpoint = categorySlug ? `/partners/category-products` : `/partners/reference-search`;
        const params = categorySlug ? { slug: categorySlug, limit: 12 } : { ref: query };
        const { data } = await api.get(endpoint, { params });
        if (!cancelled) setItems(data.items || []);
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 overflow-y-auto"
      onClick={onClose}
      data-testid="partners-search-modal"
      style={{ background: "radial-gradient(ellipse at top, rgba(220,38,38,0.20), rgba(0,0,0,0.92))", backdropFilter: "blur(8px)" }}
    >
      <div
        className="w-full max-w-6xl bg-zinc-950 text-white rounded-md shadow-[0_25px_80px_-15px_rgba(220,38,38,0.5)] ring-1 ring-red-600/30 overflow-hidden my-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Brand stripe header */}
        <div className="relative bg-zinc-950 border-b border-white/10 px-6 sm:px-8 py-6 overflow-hidden">
          <div className="absolute inset-0 opacity-20" style={{ background: "linear-gradient(90deg, rgba(245,158,11,0.6) 0%, rgba(220,38,38,0.6) 33%, rgba(56,189,248,0.6) 66%, rgba(168,85,247,0.6) 100%)" }} />
          <div className="absolute -bottom-px left-0 right-0 h-px bg-gradient-to-r from-amber-400 via-red-500 via-sky-400 to-violet-400" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-red-400 mb-1.5">
                {categorySlug ? "Catégorie populaire" : "Recherche partenaires"}
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-black tracking-tight uppercase leading-none" data-testid="partners-search-title">
                {categorySlug
                  ? <>Pièces disponibles <span className="font-mono-vin text-red-500">{categorySlug.replace(/-/g, " ")}</span></>
                  : query
                    ? <>Référence <span className="font-mono-vin text-red-500">{query}</span></>
                    : "Recherche…"}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px]">
                <span className="inline-flex items-center gap-1.5 text-white/70">
                  {loading ? (
                    <Loader2 className="w-3 h-3 animate-spin text-red-400" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-gradient-to-r from-amber-400 via-red-500 to-violet-400" />
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
        <div className="max-h-[70vh] overflow-y-auto bg-zinc-950 px-4 sm:px-8 py-6">
          {loading && (
            <div className="py-16 text-center text-white/70" data-testid="partners-loading">
              <Loader2 className="w-8 h-8 mx-auto mb-3 text-red-500 animate-spin" />
              <div className="text-sm">Interrogation simultanée de nos partenaires…</div>
              <div className="text-xs mt-1 text-white/40">Recherche en stock chez nous</div>
            </div>
          )}

          {!loading && error && (
            <div className="py-12 text-center" data-testid="partners-error">
              <AlertCircle className="w-10 h-10 mx-auto mb-3 text-red-500" />
              <div className="text-sm text-red-300">{error}</div>
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
                return (
                  <div
                    key={`${it.source}-${it.reference}-${i}`}
                    className={`relative bg-zinc-900/80 border border-white/10 hover:border-white/30 rounded-sm overflow-hidden ring-1 ${theme.ring} hover:-translate-y-0.5 transition-all`}
                    data-testid={`partners-card-${it.source}-${it.reference}`}
                  >
                    {/* Top accent stripe */}
                    <div className={`h-1 bg-gradient-to-r ${theme.accent}`} />

                    <div className="p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <div className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.25em] ${theme.text} mb-1`}>
                            <span className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${theme.accent}`} />
                            {theme.name}
                          </div>
                          <div className="font-display font-black text-base text-white leading-tight line-clamp-2">
                            {it.designation || it.reference}
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px]">
                            <span className={`${theme.bgChip} ${theme.text} font-mono-vin px-2 py-0.5 rounded-sm`}>
                              <Tag className="inline w-3 h-3 -mt-px mr-0.5" /> {it.reference}
                            </span>
                            {it.fournisseur && (
                              <span className="bg-white/5 text-white/70 px-2 py-0.5 rounded-sm">{it.fournisseur}</span>
                            )}
                            {it.in_stock && (
                              <span className="bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-sm inline-flex items-center gap-1">
                                <BadgeCheck className="w-3 h-3" /> En stock
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-end justify-between gap-3 mt-4">
                        <div>
                          <div className="text-[10px] uppercase tracking-widest text-white/50 mb-0.5">Prix</div>
                          <div className="font-display font-black text-2xl text-red-500 leading-none">
                            {formatPrice(it.prix_tnd)}
                          </div>
                          <div className={`text-[11px] mt-1 ${stockColor}`}>
                            {it.in_stock ? `${it.stock} disponible${it.stock > 1 ? "s" : ""}` : "Non en stock"}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="inline-flex items-center border border-white/20 rounded-sm bg-zinc-900">
                            <button onClick={() => setQtys((s) => ({ ...s, [it.reference]: Math.max(1, q - 1) }))} className="px-2 py-1.5 text-white/70 hover:text-white hover:bg-white/5">−</button>
                            <span className="px-2.5 text-sm font-bold w-8 text-center">{q}</span>
                            <button onClick={() => setQtys((s) => ({ ...s, [it.reference]: q + 1 }))} className="px-2 py-1.5 text-white/70 hover:text-white hover:bg-white/5">+</button>
                          </div>
                          <button
                            onClick={() => handleAdd(it)}
                            disabled={!it.in_stock}
                            className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-wider px-3 py-2 rounded-sm transition-colors"
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
        <div className="bg-black/60 border-t border-white/5 px-6 py-3 text-[11px] text-white/40 flex items-center justify-between">
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
