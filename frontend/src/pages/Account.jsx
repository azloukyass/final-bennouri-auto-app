import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  LayoutDashboard,
  ShoppingBag,
  Heart,
  MapPin,
  UserCircle,
  Lock,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Truck,
  Mail,
  Phone,
  Calendar,
  ClipboardCheck,
  Headphones,
  Edit2,
  ShoppingCart,
  Star,
  Package,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api, formatApiError, formatPrice } from "@/lib/api";
import ProductIcon, { Engine, OilBottle, BrakeDisc, CarBattery, OilFilter, ShockAbsorber, SparkPlug } from "@/components/ProductIcons";

const STATUS_COLOR = {
  "En attente": "bg-amber-100 text-amber-800 border-amber-200",
  "Confirmée": "bg-blue-100 text-blue-800 border-blue-200",
  "Expédiée": "bg-purple-100 text-purple-800 border-purple-200",
  "Livrée": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Annulée": "bg-slate-100 text-slate-700 border-slate-200",
};

const STAT_DEFS = [
  { key: "orders", label: "Commandes", Icon: ShoppingBag, bg: "bg-red-50", iconColor: "text-red-600", link: "/compte/commandes" },
  { key: "in_progress", label: "En cours", Icon: ClipboardCheck, bg: "bg-emerald-50", iconColor: "text-emerald-600", link: "/compte/commandes?status=encours" },
  { key: "delivered", label: "Livrées", Icon: Truck, bg: "bg-sky-50", iconColor: "text-sky-600", link: "/compte/commandes?status=livrees" },
  { key: "favorites", label: "Favoris", Icon: Heart, bg: "bg-amber-50", iconColor: "text-amber-600", link: "/compte/favoris" },
];

const MENU = [
  { key: "dashboard", label: "Tableau de bord", Icon: LayoutDashboard, view: "dashboard" },
  { key: "orders", label: "Mes commandes", Icon: ShoppingBag, view: "orders" },
  { key: "personal", label: "Mes informations personnelles", Icon: UserCircle, view: "personal" },
];

const RECOMMENDED = [
  {
    ref: "shell-helix-5w30",
    name: "Huile Moteur Shell Helix Ultra",
    sub: "5W-30 - 4L",
    rating: 4.5,
    reviews: 128,
    price: 85,
    Icon: OilBottle,
    bg: "from-amber-100 via-orange-50 to-yellow-100",
  },
  {
    ref: "brembo-kit-front",
    name: "Kit Freinage Brembo",
    sub: "Avant - Disques + Plaquettes",
    rating: 4.5,
    reviews: 96,
    price: 245,
    Icon: BrakeDisc,
    bg: "from-slate-200 via-slate-100 to-red-50",
  },
  {
    ref: "bosch-s5-a08",
    name: "Batterie Bosch S5 A08",
    sub: "70Ah - 12V",
    rating: 4.5,
    reviews: 74,
    price: 310,
    Icon: CarBattery,
    bg: "from-slate-200 via-slate-100 to-slate-50",
  },
  {
    ref: "bosch-kit-filtres",
    name: "Kit Filtres BOSCH",
    sub: "Clio 4 1.5 dCi",
    rating: 4.5,
    reviews: 53,
    price: 68,
    Icon: OilFilter,
    bg: "from-blue-100 via-sky-50 to-indigo-50",
  },
  {
    ref: "kyb-amortisseur",
    name: "Amortisseur KYB",
    sub: "Avant - Gaz",
    rating: 4.5,
    reviews: 41,
    price: 120,
    Icon: ShockAbsorber,
    bg: "from-amber-50 via-slate-100 to-amber-100",
  },
  {
    ref: "bougies-ngk",
    name: "Bougies d'allumage NGK",
    sub: "Iridium IX - x4",
    rating: 4.7,
    reviews: 89,
    price: 95,
    Icon: SparkPlug,
    bg: "from-red-100 via-red-50 to-orange-50",
  },
];

const QUICK_CATEGORIES = [
  {
    key: "moteur",
    label: "Moteur",
    sub: "Pistons, joints, filtres",
    Icon: Engine,
    bg: "from-red-600 via-red-700 to-red-900",
  },
  {
    key: "huiles",
    label: "Huiles & Liquides",
    sub: "Moteur, freins, refroidissement",
    Icon: OilBottle,
    bg: "from-amber-500 via-orange-600 to-amber-800",
  },
  {
    key: "freinage",
    label: "Freinage",
    sub: "Disques, plaquettes, étriers",
    Icon: BrakeDisc,
    bg: "from-slate-700 via-slate-800 to-slate-900",
  },
  {
    key: "batterie",
    label: "Batterie & Démarrage",
    sub: "Batteries, alternateurs",
    Icon: CarBattery,
    bg: "from-sky-600 via-blue-700 to-blue-900",
  },
];

function StarRating({ value = 4.5 }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-slate-200"}`}
        />
      ))}
    </div>
  );
}

function StatCard({ def, value, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden bg-white border border-slate-200/70 rounded-md p-5 hover:shadow-lg hover:-translate-y-0.5 hover:border-slate-300 transition-all text-left w-full"
      data-testid={`stat-${def.key}`}
    >
      <div className={`absolute -top-4 -right-4 w-20 h-20 ${def.bg} rounded-full opacity-60 group-hover:scale-110 transition-transform`} />
      <div className="relative flex items-center gap-4">
        <div className={`${def.bg} rounded-md w-14 h-14 flex items-center justify-center flex-shrink-0 shadow-sm`}>
          <def.Icon className={`w-7 h-7 ${def.iconColor}`} strokeWidth={1.6} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-slate-500 font-medium">{def.label}</div>
          <div className="font-display text-3xl font-bold text-slate-900 leading-none mt-1">{value}</div>
          <div className="text-[11px] text-slate-400 mt-1 group-hover:text-red-600 transition-colors">
            {def.key === "favorites" ? "Voir tous →" : "Voir toutes →"}
          </div>
        </div>
      </div>
    </button>
  );
}

function QuickCategories() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="quick-categories">
      {QUICK_CATEGORIES.map((c) => (
        <Link
          key={c.key}
          to={`/catalogue/${c.key === "huiles" ? "mecanique" : c.key === "batterie" ? "electrique" : c.key === "freinage" ? "mecanique" : "mecanique"}`}
          className={`group relative h-36 overflow-hidden rounded-md border border-slate-200 bg-gradient-to-br ${c.bg} transition-all hover:shadow-xl hover:-translate-y-0.5`}
          data-testid={`category-${c.key}`}
        >
          {/* Decorative grid */}
          <div className="absolute inset-0 opacity-[0.06]" style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }} />
          {/* SVG icon, large in background */}
          <div className="absolute -right-4 -bottom-4 w-32 h-32 opacity-30 group-hover:opacity-50 group-hover:scale-110 transition-all duration-500">
            <c.Icon className="w-full h-full" />
          </div>
          <div className="relative h-full flex flex-col justify-end p-4 text-white">
            <div className="font-display text-lg font-bold leading-tight drop-shadow-lg">{c.label}</div>
            <div className="text-[11px] text-white/90 mt-0.5 drop-shadow">{c.sub}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function RecommendedCarousel() {
  const [start, setStart] = useState(0);
  const visible = 5;
  const canPrev = start > 0;
  const canNext = start + visible < RECOMMENDED.length;
  const slice = RECOMMENDED.slice(start, start + visible);

  return (
    <div className="bg-white border border-slate-100 rounded-md p-6" data-testid="recommended-section">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-display text-lg font-bold text-slate-900">Recommandé pour vous</h3>
        <div className="flex gap-1">
          <button
            onClick={() => canPrev && setStart((s) => s - 1)}
            disabled={!canPrev}
            className="w-8 h-8 border border-slate-200 rounded-sm flex items-center justify-center hover:bg-slate-50 disabled:opacity-30"
            data-testid="reco-prev"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => canNext && setStart((s) => s + 1)}
            disabled={!canNext}
            className="w-8 h-8 border border-slate-200 rounded-sm flex items-center justify-center hover:bg-slate-50 disabled:opacity-30"
            data-testid="reco-next"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {slice.map((p) => (
          <div key={p.ref} className="group border border-slate-100 rounded-md overflow-hidden hover:shadow-md hover:border-slate-200 hover:-translate-y-0.5 transition-all bg-white">
            <div className={`relative h-40 bg-gradient-to-br ${p.bg} flex items-center justify-center overflow-hidden p-3`}>
              <div className="absolute top-2 right-2 bg-white/95 backdrop-blur-sm px-2 py-0.5 rounded-sm text-[9px] font-bold text-slate-700 shadow-sm">
                NEUF
              </div>
              <p.Icon className="w-full h-full max-h-28 group-hover:scale-110 transition-transform duration-500 drop-shadow-md" />
            </div>
            <div className="p-3">
              <div className="font-semibold text-slate-900 text-sm leading-tight mb-1 line-clamp-1">{p.name}</div>
              <div className="text-xs text-slate-500 mb-2">{p.sub}</div>
              <div className="flex items-center gap-1.5 mb-2">
                <StarRating value={p.rating} />
                <span className="text-[10px] text-slate-400">({p.reviews})</span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="font-bold text-slate-900 text-sm">{p.price.toFixed(3).replace(".", ",")} DT</span>
                <button
                  className="bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-sm transition-colors shadow-sm"
                  aria-label="Ajouter au panier"
                  data-testid={`reco-add-${p.ref}`}
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardView({ user, orders, setView }) {
  const stats = useMemo(() => {
    const total = orders.length;
    const inProgress = orders.filter((o) => ["En attente", "Confirmée", "Expédiée"].includes(o.status)).length;
    const delivered = orders.filter((o) => o.status === "Livrée").length;
    return { orders: total, in_progress: inProgress, delivered, favorites: 0 };
  }, [orders]);

  const lastOrder = orders[0];

  return (
    <>
      {/* Hero banner */}
      <div className="relative overflow-hidden rounded-md mb-6 border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-red-950" data-testid="hero-banner">
        <div className="absolute inset-0 opacity-[0.08]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />
        {/* Decorative product icons on the right */}
        <div className="absolute -right-8 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-3 opacity-25">
          <div className="w-28 h-28">
            <Engine className="w-full h-full" />
          </div>
          <div className="w-24 h-24 -ml-4">
            <BrakeDisc className="w-full h-full" />
          </div>
          <div className="w-20 h-20 -ml-2">
            <OilBottle className="w-full h-full" />
          </div>
        </div>
        {/* Soft red glow */}
        <div className="absolute -right-20 top-1/2 -translate-y-1/2 w-96 h-96 bg-red-600/20 rounded-full blur-3xl" />
        <div className="relative px-6 sm:px-10 py-8 sm:py-10 text-white flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.4em] text-red-400 mb-2">
              Bienvenue
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold leading-tight mb-2">
              Bonjour, <span className="text-red-400">{user?.name?.split(" ")[0] || "Cher client"}</span>
            </h2>
            <p className="text-slate-200/80 text-sm max-w-xl">
              Retrouvez toutes vos commandes, vos pièces favorites et vos informations en un seul endroit.
            </p>
          </div>
          <Link
            to="/recherche-vin"
            className="relative z-10 flex-shrink-0 inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-3 rounded-sm transition-colors text-sm shadow-lg shadow-red-900/40"
            data-testid="hero-cta"
          >
            Rechercher une pièce <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_DEFS.map((d) => (
          <StatCard key={d.key} def={d} value={stats[d.key] ?? 0} onClick={() => setView(d.view)} />
        ))}
      </div>

      {/* Two-column section */}
      <div className="grid lg:grid-cols-2 gap-6 mt-8">
        {/* Last order */}
        <div className="bg-white border border-slate-100 rounded-md p-6" data-testid="last-order-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg font-bold text-slate-900">Ma dernière commande</h3>
            <button onClick={() => setView("orders")} className="text-xs font-semibold text-red-600 hover:text-red-700" data-testid="see-all-orders">
              Voir toutes mes commandes →
            </button>
          </div>

          {!lastOrder ? (
            <div className="text-center py-10 text-sm text-slate-500">
              <Package className="w-10 h-10 mx-auto text-slate-200 mb-2" />
              Aucune commande pour l&apos;instant
            </div>
          ) : (
            <div className="border border-slate-200 rounded-md p-5">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                <h4 className="font-display text-xl font-bold text-slate-900">
                  Commande #{lastOrder.id.slice(0, 13).toUpperCase()}
                </h4>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded ${STATUS_COLOR[lastOrder.status] || "bg-slate-100 text-slate-700"}`}>
                  {lastOrder.status}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between text-sm text-slate-600 mb-4">
                <span>
                  Passée le {new Date(lastOrder.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                  {" à "}
                  {new Date(lastOrder.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="font-semibold text-slate-900">
                  Total : {formatPrice(lastOrder.total_tnd)}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-2 mb-4">
                {lastOrder.items.slice(0, 4).map((it, i) => (
                  <div key={i} className="aspect-square bg-slate-50 rounded-sm overflow-hidden">
                    {it.image ? (
                      <img src={it.image} alt={it.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <Package className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                ))}
                {lastOrder.items.length > 4 && (
                  <div className="aspect-square bg-slate-100 rounded-sm flex items-center justify-center text-slate-500 text-sm font-semibold">
                    +{lastOrder.items.length - 4}
                  </div>
                )}
              </div>
              <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-sm">
                <span className="text-slate-500 inline-flex items-center gap-1.5">
                  <Truck className="w-4 h-4" />
                  {lastOrder.status === "Livrée"
                    ? `Livrée le ${new Date(lastOrder.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}`
                    : "En préparation"}
                </span>
                <button className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 font-semibold text-xs px-3 py-1.5 border border-slate-200 rounded-sm">
                  Détails de la commande <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Account info */}
        <div className="bg-white border border-slate-100 rounded-md p-6" data-testid="account-info-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg font-bold text-slate-900">Informations du compte</h3>
            <button className="text-xs font-semibold text-slate-700 hover:text-slate-900 border border-slate-200 px-3 py-1.5 rounded-sm inline-flex items-center gap-1">
              <Edit2 className="w-3 h-3" /> Modifier
            </button>
          </div>

          <div className="space-y-5">
            <div className="flex gap-3">
              <UserCircle className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs text-slate-500">Nom complet</div>
                <div className="font-semibold text-slate-900">{user?.name || "—"}</div>
              </div>
            </div>
            <div className="flex gap-3">
              <Mail className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-xs text-slate-500">Email</div>
                <div className="font-semibold text-slate-900 truncate">{user?.email}</div>
              </div>
            </div>
            <div className="flex gap-3">
              <Phone className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs text-slate-500">Téléphone</div>
                <div className="font-semibold text-slate-900">{user?.phone || "—"}</div>
              </div>
            </div>
            <div className="flex gap-3">
              <Calendar className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs text-slate-500">Date d&apos;inscription</div>
                <div className="font-semibold text-slate-900">
                  {user?.created_at
                    ? new Date(user.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
                    : "—"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function OrdersView({ orders }) {
  return (
    <div className="bg-white border border-slate-100 rounded-md p-6" data-testid="orders-view">
      <h3 className="font-display text-xl font-bold text-slate-900 mb-4">Mes commandes</h3>
      {orders.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Package className="w-12 h-12 mx-auto text-slate-200 mb-3" />
          Aucune commande pour l&apos;instant
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="border border-slate-200 rounded-md p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400">#{o.id.slice(0, 8)}</div>
                  <div className="text-sm text-slate-600">{new Date(o.created_at).toLocaleString("fr-FR")}</div>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded ${STATUS_COLOR[o.status] || "bg-slate-100"}`}>
                  {o.status}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">{o.items.length} article(s)</span>
                <span className="font-bold text-slate-900">{formatPrice(o.total_tnd)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PlaceholderView({ title, message }) {
  return (
    <div className="bg-white border border-slate-100 rounded-md p-10 text-center" data-testid="placeholder-view">
      <h3 className="font-display text-xl font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}

function PersonalView({ user }) {
  return (
    <div className="bg-white border border-slate-100 rounded-md p-6 max-w-2xl" data-testid="personal-view">
      <h3 className="font-display text-xl font-bold text-slate-900 mb-5">Mes informations personnelles</h3>
      <div className="space-y-4 text-sm">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Nom complet</label>
          <div className="px-3 py-2 border border-slate-200 rounded-sm bg-slate-50">{user?.name || "—"}</div>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Email</label>
          <div className="px-3 py-2 border border-slate-200 rounded-sm bg-slate-50">{user?.email}</div>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Téléphone</label>
          <div className="px-3 py-2 border border-slate-200 rounded-sm bg-slate-50">{user?.phone || "—"}</div>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Adresse</label>
          <div className="px-3 py-2 border border-slate-200 rounded-sm bg-slate-50">{user?.address || "—"}</div>
        </div>
      </div>
    </div>
  );
}

export default function Account() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState("dashboard");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/orders/mine");
        setOrders(data);
      } catch (err) {
        toast.error(formatApiError(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Déconnecté");
      navigate("/");
    } catch { /* ignore */ }
  };

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    : "—";

  return (
    <div className="bg-slate-50 min-h-screen" data-testid="espace-client-page">
      <div className="flex flex-col lg:flex-row min-h-screen">
        {/* Sidebar */}
        <aside className="lg:w-72 bg-slate-900 text-white flex-shrink-0 flex flex-col" data-testid="account-sidebar">
          {/* Profile block */}
          <div className="p-6 border-b border-slate-800">
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-md p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full border-2 border-slate-600 flex items-center justify-center flex-shrink-0">
                <UserCircle className="w-7 h-7 text-slate-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-white truncate" data-testid="sidebar-username">{user?.name || "—"}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Client depuis : <span className="text-slate-300">{memberSince}</span>
                </div>
                <span className="inline-block mt-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-red-600/20 text-red-300 rounded-sm border border-red-500/30">
                  Client fidèle
                </span>
              </div>
            </div>
          </div>

          {/* Menu */}
          <nav className="flex-1 p-4 space-y-1" data-testid="account-menu">
            {MENU.map((m) => {
              const isActive = view === m.view;
              return (
                <button
                  key={m.key}
                  onClick={() => setView(m.view)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-sm text-sm font-medium transition-all ${
                    isActive
                      ? "bg-red-600 text-white shadow-md"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                  data-testid={`menu-${m.key}`}
                >
                  <m.Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{m.label}</span>
                </button>
              );
            })}

            <div className="pt-3 mt-3 border-t border-slate-800">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-sm text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
                data-testid="menu-logout"
              >
                <LogOut className="w-4 h-4" />
                Déconnexion
              </button>
            </div>
          </nav>

          {/* Help block */}
          <div className="p-4 border-t border-slate-800">
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-md p-4">
              <div className="flex items-center gap-2 mb-2">
                <Headphones className="w-5 h-5 text-red-400" />
                <h4 className="font-semibold text-white text-sm">Besoin d&apos;aide ?</h4>
              </div>
              <p className="text-[11px] text-slate-400 mb-2 leading-relaxed">
                Notre service client est à votre disposition
              </p>
              <a
                href="tel:+21671123456"
                className="block text-red-400 hover:text-red-300 font-bold text-sm font-mono"
              >
                +216 54 643 643
              </a>
              <div className="text-[10px] text-slate-500 mt-1">
                Lun - Sam : 08h00 - 18h00
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-6 lg:p-10 overflow-auto">
          <div className="max-w-6xl mx-auto">
            <div className="mb-6">
              <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 uppercase tracking-tight">
                Espace client
              </h1>
              <nav className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                <Link to="/" className="hover:text-red-600">Accueil</Link>
                <ChevronRight className="w-3 h-3" />
                <span className="text-slate-700">Espace client</span>
              </nav>
            </div>

            {loading ? (
              <div className="bg-white border border-slate-100 rounded-md p-10 text-center text-slate-500">
                Chargement…
              </div>
            ) : (
              <>
                {view === "dashboard" && <DashboardView user={user} orders={orders} setView={setView} />}
                {view === "orders" && <OrdersView orders={orders} />}
                {view === "favorites" && (
                  <PlaceholderView
                    title="Mes favoris"
                    message="Vous n'avez pas encore d'articles favoris."
                  />
                )}
                {view === "addresses" && (
                  <PlaceholderView
                    title="Mes adresses"
                    message="Aucune adresse enregistrée pour le moment."
                  />
                )}
                {view === "personal" && <PersonalView user={user} />}
                {view === "password" && (
                  <PlaceholderView
                    title="Changer le mot de passe"
                    message="Fonctionnalité disponible prochainement."
                  />
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
