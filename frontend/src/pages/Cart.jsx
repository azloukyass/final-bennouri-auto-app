import { Link, useNavigate } from "react-router-dom";
import { Trash2, Plus, Minus, ShoppingCart, ArrowLeft, Truck, Shield, ShieldCheck } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { api, formatPrice } from "@/lib/api";
import { useEffect, useState } from "react";

const FREE_SHIPPING_THRESHOLD = 100; // DT

export default function Cart() {
  const { items, updateQty, remove, total } = useCart();
  const navigate = useNavigate();
  const freeShipping = total >= FREE_SHIPPING_THRESHOLD;
  const [images, setImages] = useState({});      // { [ref]: s3image_url | null }
  const [imgErrors, setImgErrors] = useState({}); // { [ref]: true }

useEffect(() => {
  let cancelled = false;
  const refsToFetch = items
    .map((p) => p.oemRef || p.ref)
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
  
  const goToDetail = (ref) => {
    if (!ref) return;
    navigate(`/article/${encodeURIComponent(ref)}`);
  };

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16" data-testid="cart-empty-page">
        <div className="bg-white border border-slate-200 rounded-sm p-16 text-center">
          <ShoppingCart className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="font-display text-2xl font-bold text-slate-900">Votre panier est vide</h2>
          <p className="text-slate-500 mt-2">Trouvez vos pièces grâce au numéro VIN.</p>
          <Link to="/recherche-vin" className="bn-btn-primary inline-flex mt-6" data-testid="cart-go-vin">
            Rechercher par VIN
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10" data-testid="cart-page">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-3xl sm:text-4xl font-black text-slate-900 tracking-tight uppercase">
          Votre panier
        </h1>
        <Link to="/" className="hidden sm:inline-flex items-center gap-1 text-sm text-slate-600 hover:text-red-600 font-semibold">
          <ArrowLeft className="w-4 h-4" /> Continuer mes achats
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Items table */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
            <div className="hidden md:grid grid-cols-[1fr_140px_140px_120px_40px] gap-4 px-5 py-3 bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
              <span>Produit</span>
              <span className="text-center">Prix unitaire</span>
              <span className="text-center">Quantité</span>
              <span className="text-right">Total</span>
              <span></span>
            </div>
            {items.map((p) => (
              <div
                key={p.ref}
                className="grid grid-cols-[1fr_40px] md:grid-cols-[1fr_140px_140px_120px_40px] gap-4 px-5 py-4 border-b border-slate-100 items-center"
                data-testid={`cart-item-${p.ref}`}
              >
                {/* Product — clickable, navigates to article detail */}
                <div
                  className="flex items-center gap-4 cursor-pointer group"
                  onClick={() => goToDetail(p.ref)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") goToDetail(p.ref);
                  }}
                  data-testid={`cart-item-link-${p.ref}`}
                >
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-100 rounded-sm flex-shrink-0 overflow-hidden flex items-center justify-center" data-testid={`cart-image-container-${p.ref}`}>
  {(() => {
    const lookupRef = p.oemRef || p.ref;
    const url = images[lookupRef];
    if (url === undefined) {
      return <div className="w-4 h-4 border-2 border-slate-300 border-t-red-600 rounded-full animate-spin" />;
    }
    if (!url || imgErrors[lookupRef]) {
      return <ShoppingCart className="w-6 h-6 text-slate-300" />;
    }
    return (
      <img
        src={url}
        alt={p.name}
        className="w-full h-full object-contain mix-blend-multiply p-1.5"
        onError={() => setImgErrors((prev) => ({ ...prev, [lookupRef]: true }))}
        data-testid={`cart-image-${p.ref}`}
      />
    );
  })()}
</div>
                  <div className="min-w-0">
                    <div className="font-display font-bold text-slate-900 text-sm sm:text-base leading-tight group-hover:text-red-600 transition-colors" data-testid={`cart-name-${p.ref}`}>{p.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5"><span className="font-mono-vin">{p.ref}</span></div>
                    {/* Mobile: price + qty inline (stop propagation so it doesn't navigate) */}
                    <div className="md:hidden mt-2 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                      <span className="text-sm font-bold text-slate-900">{formatPrice(p.price_tnd)}</span>
                      <div className="inline-flex items-center border border-slate-300 rounded-sm">
                        <button onClick={() => updateQty(p.ref, p.quantity - 1)} className="px-2 py-1 hover:bg-slate-50"><Minus className="w-3.5 h-3.5" /></button>
                        <span className="px-3 text-sm font-bold w-8 text-center">{p.quantity}</span>
                        <button onClick={() => updateQty(p.ref, p.quantity + 1)} className="px-2 py-1 hover:bg-slate-50"><Plus className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Desktop columns */}
                <div className="hidden md:block text-center text-sm font-semibold text-slate-700" data-testid={`cart-unit-${p.ref}`}>
                  {formatPrice(p.price_tnd)}
                </div>
                <div className="hidden md:flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                  <div className="inline-flex items-center border border-slate-300 rounded-sm">
                    <button onClick={() => updateQty(p.ref, p.quantity - 1)} className="px-2 py-1.5 hover:bg-slate-50" data-testid={`qty-minus-${p.ref}`}><Minus className="w-3.5 h-3.5" /></button>
                    <span className="px-3 text-sm font-bold w-8 text-center">{p.quantity}</span>
                    <button onClick={() => updateQty(p.ref, p.quantity + 1)} className="px-2 py-1.5 hover:bg-slate-50" data-testid={`qty-plus-${p.ref}`}><Plus className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <div className="hidden md:block text-right font-display font-black text-slate-900" data-testid={`cart-line-total-${p.ref}`}>
                  {formatPrice(p.price_tnd * p.quantity)}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); remove(p.ref); }}
                  className="text-slate-400 hover:text-red-600 justify-self-end"
                  aria-label="Supprimer"
                  data-testid={`cart-remove-${p.ref}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Promo code */}
          <div className="mt-5 bg-white border border-slate-200 rounded-sm p-5">
            <div className="text-sm font-semibold text-slate-700 mb-2">Vous avez un code promo ?</div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Entrez votre code"
                className="flex-1 px-3 py-2.5 text-sm text-slate-900 border border-slate-300 rounded-sm focus:outline-none focus:border-red-500"
                data-testid="promo-input"
              />
              <button className="bg-slate-900 hover:bg-black text-white font-bold uppercase text-xs tracking-wider px-5 py-2.5 rounded-sm" data-testid="promo-apply">
                Appliquer
              </button>
            </div>
          </div>
        </div>

        {/* Summary card */}
        <aside className="lg:col-span-1">
          <div className="bg-white border border-slate-200 rounded-sm p-6 sticky top-24" data-testid="cart-summary">
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 uppercase text-xs font-bold tracking-wider">Sous-total</span>
                <span className="font-display font-black text-slate-900" data-testid="cart-subtotal">{formatPrice(total)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 uppercase text-xs font-bold tracking-wider">Livraison</span>
                <span className={`font-semibold ${freeShipping ? "text-emerald-600" : "text-slate-700"}`} data-testid="cart-shipping-label">
                  {freeShipping ? "Gratuite" : "à partir de 7 DT"}
                </span>
              </div>
              {!freeShipping && (
                <div className="text-[11px] text-slate-500 italic">
                  Livraison gratuite à partir de <span className="font-bold text-red-600">{FREE_SHIPPING_THRESHOLD} DT</span>
                  <div className="mt-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500" style={{ width: `${Math.min(100, (total / FREE_SHIPPING_THRESHOLD) * 100)}%` }} />
                  </div>
                </div>
              )}
              <div className="border-t border-slate-200 pt-3 flex items-center justify-between">
                <span className="font-display font-black text-slate-900 uppercase">Total</span>
                <span className="font-display font-black text-2xl text-red-600" data-testid="cart-total">{formatPrice(total)}</span>
              </div>
            </div>

            <button
              onClick={() => navigate("/commande")}
              className="mt-6 w-full bg-red-600 hover:bg-red-700 text-white font-black uppercase text-sm tracking-wider px-6 py-3.5 rounded-sm transition-colors shadow-lg shadow-red-900/30"
              data-testid="cart-checkout-btn"
            >
              Passer la commande →
            </button>
            <Link to="/" className="mt-3 block text-center text-xs text-slate-500 hover:text-red-600 font-semibold">
              ← Continuer mes achats
            </Link>
          </div>
        </aside>
      </div>

      {/* Trust strip */}
      <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-200 pt-8">
        {[
          { Icon: Truck, title: "Livraison rapide", sub: "Partout en Tunisie" },
          { Icon: Shield, title: "Paiement à la livraison", sub: "Payez à réception" },
          { Icon: ShieldCheck, title: "Produits originaux", sub: "Qualité garantie" },
        ].map((b) => (
          <div key={b.title} className="flex items-center gap-3">
            <div className="w-10 h-10 border-2 border-red-600 text-red-600 flex items-center justify-center rounded-sm">
              <b.Icon className="w-5 h-5" />
            </div>
            <div>
              <div className="font-display font-black text-slate-900 uppercase text-sm">{b.title}</div>
              <div className="text-xs text-slate-500">{b.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
