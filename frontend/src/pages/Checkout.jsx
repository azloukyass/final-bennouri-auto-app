import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Home, Zap, MapPin, Wallet, CreditCard, Banknote,
  Shield, Lock, BadgeCheck, ChevronLeft, User, Phone, FileText,
} from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { api, formatApiError, formatPrice } from "@/lib/api";

const FREE_SHIPPING_THRESHOLD = 100;

const DELIVERY_OPTIONS = [
  {
    code: "domicile",
    title: "Livraison à domicile",
    sub: "24h - 48h",
    Icon: Home,
    cost: (total) => (total >= FREE_SHIPPING_THRESHOLD ? 0 : 7),
  },
  {
    code: "express",
    title: "Livraison express",
    sub: "Le jour même (Tunis)",
    Icon: Zap,
    cost: () => 10,
  },
  {
    code: "relais",
    title: "Retrait en point relais",
    sub: "24h - 48h",
    Icon: MapPin,
    cost: () => 5,
  },
];

const PAYMENT_OPTIONS = [
  { code: "cod", title: "Paiement à la livraison", sub: "Payez à réception", Icon: Wallet },
  { code: "card", title: "Paiement par carte", sub: "Visa, Mastercard", Icon: CreditCard, disabled: true  },
  { code: "transfer", title: "Virement bancaire", sub: "Virement bancaire", Icon: Banknote },
];

export default function Checkout() {
  const { items, total, vehicle, clear } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [address, setAddress] = useState(user?.address || "");
  const [city, setCity] = useState("Tunis");
  const [postal, setPostal] = useState("1002");
  const [notes, setNotes] = useState("");
  const [deliveryCode, setDeliveryCode] = useState("domicile");
  const [paymentCode, setPaymentCode] = useState("cod");
  const [submitting, setSubmitting] = useState(false);

  if (!user) {
    navigate("/connexion", { state: { from: "/commande" } });
    return null;
  }

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center" data-testid="checkout-empty">
        <p className="text-slate-500 mb-4">Votre panier est vide.</p>
        <Link to="/" className="text-red-600 font-semibold hover:underline">← Retour à l&apos;accueil</Link>
      </div>
    );
  }

  const deliveryOpt = DELIVERY_OPTIONS.find((d) => d.code === deliveryCode);
  const deliveryCost = deliveryOpt ? deliveryOpt.cost(total) : 0;
  const grandTotal = total + deliveryCost;

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !address.trim()) {
      toast.error("Nom, téléphone et adresse sont requis.");
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post("/orders", {
        items: items.map((i) => ({
          ref: i.ref,
          name: i.name,
          brand: i.brand || "",
          image: i.image || "",
          price_tnd: i.price_tnd,
          source: i.source || "",
          quantity: i.quantity,
        })),
        vehicle_vin: vehicle?.vin || "",
        vehicle_label: vehicle ? `${vehicle.make} ${vehicle.model}` : "",
        customer_name: name,
        shipping_address: address,
        city,
        postal_code: postal,
        phone,
        notes,
        delivery_method: deliveryCode,
        payment_method: paymentCode,
      });
      toast.success("Commande passée avec succès !");
      clear();
      navigate(`/commande/confirmation/${data.id}`, { state: { order: data } });
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="checkout-page">
      {/* Breadcrumb */}
      <div className="text-xs text-slate-500 mb-6 flex items-center gap-1.5 font-semibold">
        <Link to="/" className="hover:text-red-600">Accueil</Link>
        <span>›</span>
        <Link to="/panier" className="hover:text-red-600">Panier</Link>
        <span>›</span>
        <span className="text-slate-900">Commande</span>
      </div>

      <form onSubmit={submit} className="grid lg:grid-cols-3 gap-6">
        {/* Left: Shipping info */}
        <div className="lg:col-span-1 space-y-5">
          <div className="bg-white border border-slate-200 rounded-sm p-6">
            <h2 className="font-display font-black text-slate-900 uppercase text-sm tracking-wider mb-4 flex items-center gap-2">
              <span className="w-1 h-5 bg-red-600 inline-block" /> Informations de livraison
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-1 block">Nom complet</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-sm text-slate-900 border border-slate-300 rounded-sm focus:outline-none focus:border-red-500"
                    placeholder="Ahmed Ben Ali"
                    required
                    data-testid="checkout-name"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-1 block">Téléphone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-sm text-slate-900 border border-slate-300 rounded-sm focus:outline-none focus:border-red-500"
                    placeholder="+216 99 123 456"
                    required
                    data-testid="checkout-phone"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-1 block">Adresse</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2.5 text-sm text-slate-900 border border-slate-300 rounded-sm focus:outline-none focus:border-red-500"
                  placeholder="Rue Mohamed V, Tunis 1002, Tunisie"
                  required
                  data-testid="checkout-address"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-1 block">Ville</label>
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm text-slate-900 border border-slate-300 rounded-sm focus:outline-none focus:border-red-500"
                    placeholder="Tunis"
                    data-testid="checkout-city"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-1 block">Code postal</label>
                  <input
                    value={postal}
                    onChange={(e) => setPostal(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm text-slate-900 border border-slate-300 rounded-sm focus:outline-none focus:border-red-500"
                    placeholder="1002"
                    data-testid="checkout-postal"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-1 block">Notes (optionnel)</label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="w-full pl-9 pr-3 py-2.5 text-sm text-slate-900 border border-slate-300 rounded-sm focus:outline-none focus:border-red-500"
                    placeholder="Informations complémentaires…"
                    data-testid="checkout-notes"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Middle: Delivery method + Payment method */}
        <div className="lg:col-span-1 space-y-5">
          {/* Delivery method */}
          <div className="bg-white border border-slate-200 rounded-sm p-6">
            <h2 className="font-display font-black text-slate-900 uppercase text-sm tracking-wider mb-4 flex items-center gap-2">
              <span className="w-1 h-5 bg-red-600 inline-block" /> Mode de livraison
            </h2>
            <div className="space-y-3">
              {DELIVERY_OPTIONS.map((d) => {
                const cost = d.cost(total);
                const selected = deliveryCode === d.code;
                return (
                  <label
                    key={d.code}
                    className={`flex items-center gap-3 border rounded-sm p-3 cursor-pointer transition-all ${selected ? "border-red-600 bg-red-50/40 ring-2 ring-red-600/15" : "border-slate-200 hover:border-slate-400"}`}
                    data-testid={`delivery-opt-${d.code}`}
                  >
                    <input
                      type="radio"
                      name="delivery"
                      value={d.code}
                      checked={selected}
                      onChange={() => setDeliveryCode(d.code)}
                      className="w-4 h-4 accent-red-600"
                    />
                    <d.Icon className={`w-5 h-5 ${selected ? "text-red-600" : "text-slate-500"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-display font-bold text-sm text-slate-900">{d.title}</div>
                      <div className="text-xs text-slate-500">{d.sub}</div>
                    </div>
                    <div className={`text-sm font-bold ${cost === 0 ? "text-emerald-600" : "text-slate-700"}`}>
                      {cost === 0 ? "Gratuite" : `${cost.toFixed(3).replace(".", ",")} DT`}
                    </div>
                  </label>
                );
              })}
            </div>
            {total < FREE_SHIPPING_THRESHOLD && (
              <div className="mt-3 text-[11px] text-slate-500 bg-amber-50 border border-amber-200 rounded-sm px-3 py-2">
                Astuce : Ajoutez <span className="font-bold text-red-600">{formatPrice(FREE_SHIPPING_THRESHOLD - total)}</span> pour bénéficier de la <strong>livraison à domicile gratuite</strong>.
              </div>
            )}
          </div>

   {/* Payment method */}
<div className="bg-white border border-slate-200 rounded-sm p-6">
  <h2 className="font-display font-black text-slate-900 uppercase text-sm tracking-wider mb-4 flex items-center gap-2">
    <span className="w-1 h-5 bg-red-600 inline-block" /> Mode de paiement
  </h2>
  <div className="space-y-3">
    {PAYMENT_OPTIONS.map((p) => {
      const selected = paymentCode === p.code;
      return (
        <label
          key={p.code}
          className={`flex items-center gap-3 border rounded-sm p-3 transition-all ${
            p.disabled
              ? "border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed"
              : selected
              ? "border-red-600 bg-red-50/40 ring-2 ring-red-600/15 cursor-pointer"
              : "border-slate-200 hover:border-slate-400 cursor-pointer"
          }`}
          data-testid={`payment-opt-${p.code}`}
        >
          <input
            type="radio"
            name="payment"
            value={p.code}
            checked={selected}
            disabled={p.disabled}
            onChange={() => !p.disabled && setPaymentCode(p.code)}
            className="w-4 h-4 accent-red-600 disabled:cursor-not-allowed"
          />
          <p.Icon className={`w-5 h-5 ${p.disabled ? "text-slate-400" : selected ? "text-red-600" : "text-slate-500"}`} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <div className={`font-display font-bold text-sm ${p.disabled ? "text-slate-500" : "text-slate-900"}`}>{p.title}</div>
              {p.disabled && (
                <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-2 py-0.5 rounded-sm">
                  Bientôt disponible
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500">{p.sub}</div>
          </div>
        </label>
      );
    })}
  </div>
</div>
        </div>

        {/* Right: Recap */}
        <aside className="lg:col-span-1">
          <div className="bg-white border border-slate-200 rounded-sm p-6 sticky top-24" data-testid="checkout-summary">
            <h2 className="font-display font-black text-slate-900 uppercase text-sm tracking-wider mb-4 flex items-center gap-2">
              <span className="w-1 h-5 bg-red-600 inline-block" /> Récapitulatif
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-700">
                <span>Sous-total</span>
                <span className="font-bold" data-testid="recap-subtotal">{formatPrice(total)}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>Livraison</span>
                <span className={`font-bold ${deliveryCost === 0 ? "text-emerald-600" : ""}`} data-testid="recap-shipping">
                  {deliveryCost === 0 ? "Gratuite" : formatPrice(deliveryCost)}
                </span>
              </div>
              <div className="border-t border-slate-200 pt-3 mt-2 flex items-center justify-between">
                <span className="font-display font-black text-slate-900 uppercase">Total</span>
                <span className="font-display font-black text-2xl text-red-600" data-testid="recap-total">{formatPrice(grandTotal)}</span>
              </div>
            </div>

            <div className="mt-4 text-[11px] text-slate-500 leading-relaxed">
              En passant votre commande, vous acceptez nos <Link to="/impressum" className="text-red-600 hover:underline">Conditions générales de vente</Link>.
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-5 w-full bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-black uppercase text-sm tracking-wider px-6 py-3.5 rounded-sm transition-colors shadow-lg shadow-red-900/30"
              data-testid="checkout-submit-btn"
            >
              {submitting ? "Confirmation..." : "Confirmer la commande"}
            </button>
            <Link to="/panier" className="mt-3 inline-flex items-center justify-center gap-1 w-full text-xs text-slate-500 hover:text-red-600 font-semibold">
              <ChevronLeft className="w-3.5 h-3.5" /> Retour au panier
            </Link>
          </div>
        </aside>
      </form>

      {/* Trust strip */}
      <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-200 pt-8">
        {[
          { Icon: Lock, title: "Paiement sécurisé", sub: "Données chiffrées" },
          { Icon: Shield, title: "Données protégées", sub: "Confidentialité garantie" },
          { Icon: BadgeCheck, title: "Satisfaction garantie", sub: "Service client 7j/7" },
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
