import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft, ChevronRight, ImageOff, Loader2, Package, ShoppingCart,
  Minus, Plus, ListChecks, FileText, BadgeCheck, Layers, Car, Tag, ZoomIn, X,
} from "lucide-react";
import { api, formatApiError, formatPrice } from "@/lib/api";
import { useCart } from "@/context/CartContext";

const TABS = [
  { key: "description", label: "Description", Icon: ListChecks },
  { key: "oem", label: "Références OEM", Icon: Tag },
  { key: "equivalence", label: "Equivalence", Icon: BadgeCheck },
  { key: "doc", label: "Documentation", Icon: FileText },
  { key: "compatible", label: "Compatible", Icon: Car },
];

export default function ArticleDetail() {
  const { ref } = useParams();
  const navigate = useNavigate();
  const { add: addToCart } = useCart();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [stockItem, setStockItem] = useState(null);
  const [tab, setTab] = useState("description");
  const [qty, setQty] = useState(1);
  const [imgError, setImgError] = useState(false);
  const [imgZoom, setImgZoom] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [{ data: info }, fadRes] = await Promise.all([
          api.get(`/rapidapi/article-info`, { params: { ref } }),
          api.get(`/fadpro/search`, { params: { ref } }).catch(() => ({ data: { items: [] } })),
        ]);
        if (cancelled) return;
        setData(info);
        // Find a matching in-stock FadPro item if any
        const match = (fadRes?.data?.items || []).find((it) => it.in_stock && it.prix_tnd);
        setStockItem(match || null);
      } catch (err) {
        if (!cancelled) setError(formatApiError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [ref]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center" data-testid="article-loading">
        <Loader2 className="w-8 h-8 text-red-600 mx-auto mb-4 animate-spin" />
        <p className="text-sm text-slate-500">Récupération des données techniques TecDoc…</p>
      </div>
    );
  }

  if (error || !data?.article) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center" data-testid="article-error">
        <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h2 className="font-display text-2xl font-bold text-slate-900 mb-2">Article introuvable</h2>
        <p className="text-sm text-slate-500 mb-6">{error || `Aucun détail TecDoc pour la référence ${ref}.`}</p>
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-red-600 hover:text-red-700 font-semibold">
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>
      </div>
    );
  }

  const a = data.article;
  const specs = Array.isArray(a.allSpecifications) ? a.allSpecifications : [];
  const oemList = Array.isArray(a.oemNo) ? a.oemNo : [];
  const compat = Array.isArray(a.compatibleCars) ? a.compatibleCars : [];

  const price = stockItem?.prix_tnd ?? null;
  const stock = stockItem?.stock ?? null;
  const sourceLabel = stockItem?.source || null;

  const handleAdd = () => {
    if (!stockItem) {
      toast.error("Cet article n'est pas en stock chez nos partenaires actuellement.");
      return;
    }
    addToCart(
      {
        ref: stockItem.reference,
        name: stockItem.designation || a.articleProductName,
        brand: stockItem.fournisseur || a.supplierName || "",
        image: a.s3image || "",
        price_tnd: stockItem.prix_tnd,
        source: stockItem.source || "fadpro",
      },
      Math.max(1, qty)
    );
    toast.success(`${qty} × ${stockItem.reference} ajouté au panier`);
  };

  return (
    <div className="bg-white" data-testid="article-detail-page">
      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="text-xs text-slate-500 flex items-center gap-1.5 font-semibold">
          <Link to="/" className="hover:text-red-600">Accueil</Link>
          <ChevronRight className="w-3 h-3 text-slate-400" />
          <button onClick={() => navigate(-1)} className="hover:text-red-600">Catalogue OEM</button>
          <ChevronRight className="w-3 h-3 text-slate-400" />
          <span className="text-slate-900 font-mono-vin">{ref}</span>
        </div>
      </div>

      {/* Hero card: image + summary + price */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-[420px_1fr] gap-8 bg-white border border-slate-200 rounded-sm overflow-hidden">
          {/* Image */}
          <div className="relative bg-gradient-to-br from-slate-50 to-slate-100 aspect-square flex items-center justify-center p-8 group" data-testid="article-image-container">
            {a.s3image && !imgError ? (
              <>
                <img
                  src={a.s3image}
                  alt={a.articleProductName}
                  className="max-w-full max-h-full object-contain mix-blend-multiply cursor-zoom-in transition-transform group-hover:scale-105"
                  onError={() => setImgError(true)}
                  onClick={() => setImgZoom(true)}
                  data-testid="article-image"
                />
                <button
                  type="button"
                  onClick={() => setImgZoom(true)}
                  className="absolute top-4 right-4 bg-zinc-900/85 hover:bg-red-600 text-white p-2 rounded-sm shadow-lg transition-colors opacity-0 group-hover:opacity-100"
                  aria-label="Agrandir l'image"
                  data-testid="article-image-zoom-btn"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </>
            ) : (
              <div className="text-center text-slate-300">
                <ImageOff className="w-20 h-20 mx-auto mb-2" />
                <div className="text-xs">Aucune image disponible</div>
              </div>
            )}
            {sourceLabel && (
              <div className="absolute top-4 left-4 inline-flex items-center gap-1 bg-emerald-500/95 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-sm shadow-md">
                <BadgeCheck className="w-3 h-3" /> En stock
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="p-6 sm:p-8 flex flex-col">
            <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-red-600 mb-2">
              {a.supplierName || "TecDoc"}
            </div>
            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 leading-tight tracking-tight uppercase" data-testid="article-title">
              {a.articleProductName || "—"}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-sm font-mono-vin font-semibold">
                Réf. {a.articleNo}
              </span>
              <span className="bg-slate-900 text-white px-2.5 py-1 rounded-sm font-mono-vin">
                OEM {ref}
              </span>
              {(() => {
                const ean = typeof a.eanNo === "string" ? a.eanNo : (a.eanNo?.eanNumbers && Array.isArray(a.eanNo.eanNumbers) ? a.eanNo.eanNumbers.filter(Boolean).join(", ") : "");
                return ean ? (
                  <span className="border border-slate-300 text-slate-600 px-2.5 py-1 rounded-sm font-mono-vin">
                    EAN {ean}
                  </span>
                ) : null;
              })()}
            </div>

            <div className="mt-6 border-t border-slate-100 pt-5 flex-1 flex flex-col justify-end">
              {price ? (
                <>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500 font-semibold mb-1">Prix BENNOURI</div>
                      <div className="font-display text-4xl sm:text-5xl font-black text-red-600 leading-none" data-testid="article-price">
                        {formatPrice(price)}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {stock} disponible{stock > 1 ? "s" : ""} · Livraison 24h-48h
                      </div>
                    </div>
                    <div className="inline-flex items-center border-2 border-slate-300 rounded-sm">
                      <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-3 py-2 hover:bg-slate-50" data-testid="article-qty-minus" aria-label="Diminuer">
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="px-4 text-base font-black w-10 text-center">{qty}</span>
                      <button onClick={() => setQty(qty + 1)} className="px-3 py-2 hover:bg-slate-50" data-testid="article-qty-plus" aria-label="Augmenter">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={handleAdd}
                    className="mt-5 inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-black uppercase text-sm tracking-wider px-6 py-4 rounded-sm transition-colors shadow-lg shadow-red-900/30"
                    data-testid="article-add-cart"
                  >
                    <ShoppingCart className="w-5 h-5" /> Ajouter au panier
                  </button>
                </>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-sm px-4 py-3 text-sm">
                  <div className="font-semibold text-amber-900">Stock non disponible chez nos partenaires</div>
                  <div className="text-amber-700 text-xs mt-1">Contactez-nous pour une commande spéciale — nous l&apos;importons sous 7-10 jours.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="border-b border-slate-200 overflow-x-auto">
          <div className="flex items-center gap-1 min-w-max" data-testid="article-tabs">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-2 px-5 py-3.5 text-sm font-semibold uppercase tracking-wider transition-colors relative ${
                  tab === t.key
                    ? "text-red-600"
                    : "text-slate-500 hover:text-slate-900"
                }`}
                data-testid={`article-tab-${t.key}`}
              >
                <t.Icon className="w-4 h-4" />
                {t.label}
                {tab === t.key && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 border-t-0 rounded-b-sm p-6 sm:p-8" data-testid="article-tab-content">
          {tab === "description" && (
            <div>
              <h2 className="font-display font-black text-slate-900 uppercase text-lg tracking-wide mb-4 flex items-center gap-2">
                <span className="w-1 h-5 bg-red-600 inline-block" /> Caractéristiques techniques
              </h2>
              {specs.length > 0 ? (
                <table className="w-full text-sm">
                  <tbody>
                    {specs.map((s, i) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-slate-50" : ""}>
                        <td className="px-4 py-3 text-slate-600 font-semibold w-1/3 sm:w-1/4">{s.criteriaName}</td>
                        <td className="px-4 py-3 text-slate-900 font-medium">{s.criteriaValue || "—"}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="px-4 py-3 text-slate-600 font-semibold">Référence article</td>
                      <td className="px-4 py-3 font-mono-vin">{a.articleNo}</td>
                    </tr>
                    <tr className="bg-slate-50">
                      <td className="px-4 py-3 text-slate-600 font-semibold">Fabricant</td>
                      <td className="px-4 py-3">{a.supplierName || "—"}</td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <EmptyTab text="Aucune caractéristique technique disponible." />
              )}
            </div>
          )}

          {tab === "oem" && (
            <div>
              <h2 className="font-display font-black text-slate-900 uppercase text-lg tracking-wide mb-4 flex items-center gap-2">
                <span className="w-1 h-5 bg-red-600 inline-block" /> Références constructeur
              </h2>
              {oemList.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {oemList.map((o, i) => (
                    <div key={i} className="border border-slate-200 hover:border-red-500 rounded-sm p-4 transition-colors">
                      <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-red-600">{o.oemBrand || "—"}</div>
                      <div className="font-mono-vin font-semibold text-slate-900 text-base mt-1 break-all">{o.oemDisplayNo || "—"}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyTab text="Aucune référence constructeur." />
              )}
            </div>
          )}

          {tab === "equivalence" && (
            <div>
              <h2 className="font-display font-black text-slate-900 uppercase text-lg tracking-wide mb-4 flex items-center gap-2">
                <span className="w-1 h-5 bg-red-600 inline-block" /> Pièces équivalentes
              </h2>
              <EmptyTab text="Aucune équivalence référencée pour cet article." Icon={Layers} />
            </div>
          )}

          {tab === "doc" && (
            <div>
              <h2 className="font-display font-black text-slate-900 uppercase text-lg tracking-wide mb-4 flex items-center gap-2">
                <span className="w-1 h-5 bg-red-600 inline-block" /> Documentation
              </h2>
              <EmptyTab text="Aucune fiche technique disponible — contactez-nous pour plus d'informations." Icon={FileText} />
            </div>
          )}

          {tab === "compatible" && (
            <div>
              <h2 className="font-display font-black text-slate-900 uppercase text-lg tracking-wide mb-4 flex items-center gap-2">
                <span className="w-1 h-5 bg-red-600 inline-block" /> Véhicules compatibles
              </h2>
              {compat.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left">
                      <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="px-4 py-3">Marque</th>
                        <th className="px-4 py-3">Modèle</th>
                        <th className="px-4 py-3">Motorisation</th>
                        <th className="px-4 py-3">Année</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compat.map((c, i) => (
                        <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-3 font-semibold text-slate-900">{c.manufacturerName || "—"}</td>
                          <td className="px-4 py-3 text-slate-700">{c.modelName || "—"}</td>
                          <td className="px-4 py-3 text-slate-700">{c.typeEngineName || "—"}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                            {(c.constructionIntervalStart || "").slice(0, 7)}
                            {" → "}
                            {(c.constructionIntervalEnd || "—").slice(0, 7)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyTab text="Aucun véhicule compatible référencé." Icon={Car} />
              )}
            </div>
          )}
        </div>
      </section>

      {/* Image zoom overlay */}
      {imgZoom && a.s3image && !imgError && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 sm:p-8 cursor-zoom-out"
          onClick={() => setImgZoom(false)}
          data-testid="article-image-zoom-overlay"
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setImgZoom(false); }}
            className="absolute top-4 right-4 bg-white/10 hover:bg-red-600 text-white p-2.5 rounded-sm transition-colors"
            aria-label="Fermer l'aperçu"
            data-testid="article-image-zoom-close"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={a.s3image}
            alt={a.articleProductName}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
            data-testid="article-image-zoomed"
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[11px] uppercase tracking-[0.3em] text-white/60 font-semibold">
            Cliquez en dehors pour fermer
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyTab({ text, Icon = Package }) {
  return (
    <div className="text-center py-12 text-slate-500">
      <Icon className="w-10 h-10 mx-auto mb-3 text-slate-300" />
      <p className="text-sm">{text}</p>
    </div>
  );
}
