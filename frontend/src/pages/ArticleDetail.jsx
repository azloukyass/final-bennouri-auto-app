import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
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
  { key: "compatible", label: "Compatible", Icon: Car },
];

// ── Quantité minimale par type de pièce ─────────────────────────────
// Certaines pièces se vendent/se remplacent obligatoirement par paire
// (ex: disques de frein avant/arrière — on ne change jamais un seul
// disque sur un essieu) — on impose donc une quantité minimale pour ces
// catégories afin d'éviter qu'un client commande une seule unité.
// Miroir de la même règle dans PartsouqCatalog.jsx (StockProductGrid) —
// pour ajouter une nouvelle règle : copier une ligne et adapter les tokens.
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

export default function ArticleDetail() {
  const { ref } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { add: addToCart } = useCart();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [stockItem, setStockItem] = useState(null);
  const [tab, setTab] = useState("description");
  const [qty, setQty] = useState(1);
  const [imgError, setImgError] = useState(false);
  const [imgZoom, setImgZoom] = useState(false);
 const [logoError, setLogoError] = useState(false); // NEU

  // Item passed directly from PartnersSearchModal's click (designation,
  // price, stock, source, image_url...). Available immediately, before any
  // network round-trip — and it's the ONLY source of truth for suppliers
  // whose SKUs (AD-Tunisie, Copia, PartsPro) never resolve in TecDoc.
  const passedItem = location.state?.item || null;

 function getInitials(name = "") {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        // Each call is caught independently — a TecDoc 404 (very common
        // for supplier-internal SKUs like AD-Tunisie/Copia/PartsPro refs
        // that were never registered as OEM numbers) must NOT prevent the
        // page from rendering the cross-supplier price/stock lookup below.
        // `label` = le libellé attendu pour cet article (oem_name/designation
        // déjà connu via l'item passé par le popup d'origine) — permet au
        // backend de choisir, parmi tous les articles TecDoc référençant ce
        // numéro OEM, celui dont le nom correspond vraiment, au lieu de
        // prendre le premier résultat au hasard (qui pouvait afficher la
        // photo d'un tout autre article pour le même numéro OEM).
        const expectedLabel = passedItem?.oem_name || passedItem?.designation || "";
        const [infoRes, searchRes] = await Promise.all([
          api.get(`/rapidapi/article-info`, { params: { ref, label: expectedLabel } }).catch(() => null),
          api.get(`/partners/reference-search`, { params: { ref } }).catch(() => ({ data: { items: [] } })),
        ]);
        if (cancelled) return;
        setData(infoRes?.data || null);
        // Combined FadPro + Copia + PartsPro + AD-Tunisie lookup for this
        // exact reference.
        const items = searchRes?.data?.items || [];
        let match = null;
        if (passedItem?.source) {
          // Der User kam per Klick aus dem Popup, wo GENAU dieser Artikel
          // (dieser `source`) als en-stock/hors-stock angezeigt wurde. Nur
          // ein frischer Treffer VOM SELBEN Lieferanten darf ihn ersetzen —
          // sonst könnte die kombinierte Suche eine andere, evtl. nicht
          // verfügbare Lieferanten-Zeile für dieselbe Referenz liefern und
          // fälschlich "Hors stock" anzeigen, obwohl der Artikel im Popup
          // "En stock" war. Findet sich keine frische Zeile vom selben
          // Lieferanten, bleibt `match` null und `passedItem` greift unten.
          match = items.find((it) => it.source === passedItem.source && it.prix_tnd) || null;
        } else {
          // Kein Popup-Kontext (z.B. Direktlink von der OEM-Katalogsuche) —
          // bester verfügbarer Treffer über alle Lieferanten hinweg.
          match =
            items.find((it) => it.in_stock && it.prix_tnd) ||
            items.find((it) => it.prix_tnd) ||
            null;
        }
        setStockItem(match);
        // Quantité minimale (ex: disques de frein → 2) déterminée à partir
        // du meilleur libellé disponible : l'article trouvé chez le
        // partenaire, sinon la fiche TecDoc, sinon l'item passé par le
        // popup d'origine.
        const minQty = getMinQuantity({
          designation: match?.designation || passedItem?.designation,
          oem_name: infoRes?.data?.article?.articleProductName,
          categorie: match?.categorie,
        });
        setQty(minQty);
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
        <Loader2 className="w-8 h-8 text-blue-600 mx-auto mb-4 animate-spin" />
        <p className="text-sm text-slate-500">Récupération des données techniques TecDoc…</p>
      </div>
    );
  }

  // `stockItem` is now either a fresh update of the SAME listing the user
  // clicked (same source) or null (see same-source match above) — so it's
  // safe to prefer it here; it never silently swaps to a different, out-
  // of-stock supplier row. Falls back to the clicked item itself when the
  // live re-search comes back empty (e.g. a transient supplier hiccup).
  const sourceStockItem = stockItem || passedItem;
  const hasAnyData = !!(data?.article || sourceStockItem);

  if (!hasAnyData) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center" data-testid="article-error">
        <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h2 className="font-display text-2xl font-bold text-slate-900 mb-2">Article introuvable</h2>
        <p className="text-sm text-slate-500 mb-6">{error || `Aucun détail disponible pour la référence ${ref}.`}</p>
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold">
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>
      </div>
    );
  }

  // TecDoc article info when available; otherwise a lean fallback built
  // from the supplier item itself, so every `a.xxx` reference below stays
  // safe and the OEM/equivalence/compatible tabs just render their empty
  // states instead of crashing.
  const a = data?.article || {
    articleProductName: sourceStockItem?.designation || ref,
    articleNo: sourceStockItem?.reference || ref,
    supplierName: sourceStockItem?.fournisseur || "",
    s3image: sourceStockItem?.image_url || sourceStockItem?.image || "",
    allSpecifications: [],
    oemNo: [],
    compatibleCars: [],
    eanNo: "",
  };

  // Marke, die im Popup / in der Kategorieliste bereits angezeigt wurde
  // (z.B. "Velo"), MUSS hier identisch erscheinen — unabhängig davon, was
  // TecDoc (a.supplierName) für dieselbe Referenz zurückgibt. Deshalb hat
  // `passedItem.fournisseur` (der exakte Artikel, auf den geklickt wurde)
  // immer Vorrang vor allem anderen. Interne Partnercodes (FADPRO/COPIA/
  // PARTSPRO/PROAD/AD-TUNISIE) sind keine echten Marken und werden NIE
  // angezeigt — auch nicht als Fallback über `a.supplierName`: im
  // Fallback-Zweig oben (kein TecDoc-Treffer) ist `a.supplierName` selbst
  // wieder `sourceStockItem?.fournisseur`, also potenziell derselbe interne
  // Code. Ohne diesen zweiten Filter würde der alte "TecDoc"-Fallback in
  // genau diesem Fall den internen Code trotzdem durchreichen. Bleibt am
  // Ende gar keine echte Marke übrig, wird `displayBrand` leer — die
  // Anzeige wird dann komplett ausgeblendet statt "TecDoc" o.ä. zu zeigen.
  const SUPPLIER_CODES = new Set(["FADPRO", "COPIA", "PARTSPRO", "PROAD", "AD-TUNISIE"]);
  const rawBrand = (passedItem?.fournisseur || sourceStockItem?.fournisseur || "").trim();
  const tecdocBrand = (a.supplierName || "").trim();
  const displayBrand =
    rawBrand && !SUPPLIER_CODES.has(rawBrand.toUpperCase())
      ? rawBrand
      : (tecdocBrand && !SUPPLIER_CODES.has(tecdocBrand.toUpperCase()) ? tecdocBrand : "");

  const specs = Array.isArray(a.allSpecifications) ? a.allSpecifications : [];
  const oemList = Array.isArray(a.oemNo)
  ? [...a.oemNo].sort((x, y) =>
      (x.oemBrand || "").localeCompare(y.oemBrand || "", "fr", { sensitivity: "base" })
    )
  : [];
  const compat = Array.isArray(a.compatibleCars)
  ? [...a.compatibleCars].sort((x, y) =>
      (x.manufacturerName || "").localeCompare(y.manufacturerName || "", "fr", { sensitivity: "base" })
    )
  : [];

  const price = sourceStockItem?.prix_tnd ?? null;
  const stock = sourceStockItem?.stock ?? null;
  const sourceLabel = sourceStockItem?.source || null;
  // BUG FIX: le badge "En stock" se basait auparavant sur la simple présence
  // d'un `sourceStockItem` — or `stockItem` peut très bien être un article
  // HORS STOCK avec un prix (voir le fallback à 3 niveaux côté backend et le
  // `.find` ci-dessus : `items.find((it) => it.prix_tnd)` sans vérifier
  // `in_stock`). Du coup une pièce marquée "Hors stock" dans la liste
  // s'affichait à tort en "En stock" sur la page détail. Le statut réel
  // vient UNIQUEMENT du champ `in_stock` de l'article trouvé.
  const inStock = !!sourceStockItem?.in_stock;

  // Quantité minimale imposée pour cet article (ex: disques de frein → 2).
  const minQty = getMinQuantity({
    designation: sourceStockItem?.designation,
    oem_name: a.articleProductName,
    categorie: sourceStockItem?.categorie,
  });

  const handleAdd = () => {
    if (!sourceStockItem || !inStock) {
      toast.error("Cet article n'est pas en stock chez nos partenaires actuellement.");
      return;
    }
    const q = Math.max(minQty, qty);
    addToCart(
      {
        ref: sourceStockItem.reference,
        oemRef: ref,
        name: sourceStockItem.designation || a.articleProductName,
        brand: sourceStockItem.fournisseur || a.supplierName || "",
        image: a.s3image || "",
        price_tnd: sourceStockItem.prix_tnd,
        source: sourceStockItem.source || "fadpro",
      },
      q
    );
    toast.success(`${q} × ${sourceStockItem.reference} ajouté au panier`);
  };

  return (
    <div className="bg-white" data-testid="article-detail-page">
      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="text-xs text-slate-500 flex items-center gap-1.5 font-semibold">
          <Link to="/" className="hover:text-blue-600">Accueil</Link>
          <ChevronRight className="w-3 h-3 text-slate-400" />
          <button onClick={() => navigate(-1)} className="hover:text-blue-600">Catalogue OEM</button>
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
                  className="absolute top-4 right-4 bg-zinc-900/85 hover:bg-blue-600 text-white p-2 rounded-sm shadow-lg transition-colors opacity-0 group-hover:opacity-100"
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
            {inStock && (
              <div className="absolute top-4 left-4 inline-flex items-center gap-1 bg-emerald-500/95 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-sm shadow-md">
                <BadgeCheck className="w-3 h-3" /> En stock
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="p-6 sm:p-8 flex flex-col">
            {displayBrand && (
              <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-600 mb-2">
                {displayBrand}
              </div>
            )}
            <div className="flex items-start justify-between gap-4">
    <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 leading-tight tracking-tight uppercase" data-testid="article-title">
      {a.articleProductName || "—"}
    </h1>
    {inStock ? (
      <span className="flex-shrink-0 inline-flex items-center gap-1.5 bg-emerald-500 text-white text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-sm shadow-sm" data-testid="article-stock-badge">
        <BadgeCheck className="w-3.5 h-3.5" /> En stock
      </span>
    ) : (
      <span className="flex-shrink-0 inline-flex items-center gap-1.5 bg-slate-400 text-white text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-sm shadow-sm" data-testid="article-stock-badge">
        Hors stock
      </span>
    )}
  </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-sm font-mono-vin font-semibold">
                Réf. {a.articleNo}
              </span>
              <span className="bg-slate-900 text-white px-2.5 py-1 rounded-sm font-mono-vin">
                OEM {ref}
              </span>
              {minQty > 1 && (
                <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-sm font-semibold" data-testid="article-min-qty-badge">
                  Vendu par paire · quantité minimale {minQty}
                </span>
              )}
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
                      <div className="font-display text-4xl sm:text-5xl font-black text-blue-600 leading-none" data-testid="article-price">
                        {formatPrice(price)}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        · Livraison 24h-48h
                      </div>
                    </div>
                    <div className="inline-flex items-center border-2 border-slate-300 rounded-sm">
                      <button
                        onClick={() => setQty(Math.max(minQty, qty - 1))}
                        className="px-3 py-2 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        data-testid="article-qty-minus"
                        aria-label="Diminuer"
                        disabled={qty <= minQty}
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="px-4 text-base font-black w-10 text-center">{qty}</span>
                      <button onClick={() => setQty(qty + 1)} className="px-3 py-2 hover:bg-slate-50" data-testid="article-qty-plus" aria-label="Augmenter">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {minQty > 1 && (
                    <div className="mt-2 text-xs text-slate-500">
                      Cette pièce se remplace par paire — quantité minimale : {minQty} unités.
                    </div>
                  )}
                  {!inStock && (
                    <div className="mt-2 text-xs text-amber-700 font-semibold">
                      Article actuellement hors stock chez nos partenaires — prix indicatif, non commandable en ligne.
                    </div>
                  )}
                  <button
                    onClick={handleAdd}
                    disabled={!inStock}
                    className={`mt-5 inline-flex items-center justify-center gap-2 font-black uppercase text-sm tracking-wider px-6 py-4 rounded-sm transition-colors shadow-lg ${
                      inStock
                        ? "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-900/30"
                        : "bg-slate-200 text-slate-500 cursor-not-allowed shadow-none"
                    }`}
                    data-testid="article-add-cart"
                  >
                    <ShoppingCart className="w-5 h-5" /> {inStock ? "Ajouter au panier" : "Hors stock"}
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
                    ? "text-blue-600"
                    : "text-slate-500 hover:text-slate-900"
                }`}
                data-testid={`article-tab-${t.key}`}
              >
                <t.Icon className="w-4 h-4" />
                {t.label}
                {tab === t.key && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 border-t-0 rounded-b-sm p-6 sm:p-8" data-testid="article-tab-content">
          {tab === "description" && (
            <div>
              <h2 className="font-display font-black text-slate-900 uppercase text-lg tracking-wide mb-4 flex items-center gap-2">
                <span className="w-1 h-5 bg-blue-600 inline-block" /> Caractéristiques techniques
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
                      <td className="px-4 py-3">{displayBrand || "—"}</td>
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
      <span className="w-1 h-5 bg-blue-600 inline-block" /> Références constructeur
    </h2>
    {oemList.length > 0 ? (
      Object.entries(
        oemList.reduce((acc, o) => {
          const brand = o.oemBrand || "Autre";
          (acc[brand] ||= []).push(o);
          return acc;
        }, {})
      )
        .sort(([a], [b]) => a.localeCompare(b, "fr", { sensitivity: "base" }))
        .map(([brand, items]) => (
          <div key={brand} className="mb-6 last:mb-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-blue-600 mb-2">
              {brand}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((o, i) => (
                <div key={i} className="border border-slate-200 hover:border-blue-500 rounded-sm p-4 transition-colors">
                  <div className="font-mono-vin font-semibold text-slate-900 text-base break-all">
                    {o.oemDisplayNo || "—"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
    ) : (
      <EmptyTab text="Aucune référence constructeur." />
    )}
  </div>
)}

          {tab === "equivalence" && (
            <div>
              <h2 className="font-display font-black text-slate-900 uppercase text-lg tracking-wide mb-4 flex items-center gap-2">
                <span className="w-1 h-5 bg-blue-600 inline-block" /> Pièces équivalentes
              </h2>
              <EmptyTab text="Aucune équivalence référencée pour cet article." Icon={Layers} />
            </div>
          )}

          {tab === "doc" && (
            <div>
              <h2 className="font-display font-black text-slate-900 uppercase text-lg tracking-wide mb-4 flex items-center gap-2">
                <span className="w-1 h-5 bg-blue-600 inline-block" /> Documentation
              </h2>
              <EmptyTab text="Aucune fiche technique disponible — contactez-nous pour plus d'informations." Icon={FileText} />
            </div>
          )}

          {tab === "compatible" && (
            <div>
              <h2 className="font-display font-black text-slate-900 uppercase text-lg tracking-wide mb-4 flex items-center gap-2">
                <span className="w-1 h-5 bg-blue-600 inline-block" /> Véhicules compatibles
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
            className="absolute top-4 right-4 bg-white/10 hover:bg-blue-600 text-white p-2.5 rounded-sm transition-colors"
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
