import { useEffect, useState } from "react";
import { Users, Package, AlertCircle, TrendingUp, Mail, Phone, MapPin, MessageSquare, Check, ChevronDown, ChevronRight } from "lucide-react";
import { api, formatApiError, formatPrice } from "@/lib/api";
import { toast } from "sonner";

const STATUS_OPTIONS = ["En attente", "Confirmée", "Expédiée", "Livrée", "Annulée"];

const SOURCE_LABELS = {
  fadpro: { label: "FadPro", color: "bg-blue-100 text-blue-700 border-blue-200" },
  copia: { label: "Copia", color: "bg-purple-100 text-purple-700 border-purple-200" },
  partspro: { label: "PartsPro", color: "bg-orange-100 text-orange-700 border-orange-200" },
  partsouq: { label: "PartSouq", color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  proad: { label: "ProAd", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  internal: { label: "Catalogue", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

function SourceBadge({ source }) {
  const s = SOURCE_LABELS[source?.toLowerCase()] ?? { label: source || "—", color: "bg-slate-100 text-slate-600 border-slate-200" };
  return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${s.color}`}>
      {s.label}
    </span>
  );
}

export default function AdminDashboard() {
  const [tab, setTab] = useState("orders");
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [s, u, o, m] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/users"),
        api.get("/admin/orders"),
        api.get("/admin/messages"),
      ]);
      setStats(s.data);
      setUsers(u.data);
      setOrders(o.data);
      setMessages(m.data);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/admin/orders/${id}`, { status });
      toast.success("Statut mis à jour");
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const markMessageRead = async (id) => {
    try {
      await api.patch(`/admin/messages/${id}/read`);
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10" data-testid="admin-dashboard">
        <div className="mb-8">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-red-600 mb-2">Tableau de bord</div>
          <h1 className="font-display text-4xl font-bold text-slate-900 tracking-tight">Administration</h1>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Users} label="Utilisateurs" value={stats?.users ?? "…"} color="text-blue-600" testid="stat-users" />
          <StatCard icon={Package} label="Commandes" value={stats?.orders ?? "…"} color="text-emerald-600" testid="stat-orders" />
          <StatCard icon={AlertCircle} label="En attente" value={stats?.pending_orders ?? "…"} color="text-amber-600" testid="stat-pending" />
        </div>

        <div className="bg-white border border-slate-200 rounded-sm">
          <div className="border-b border-slate-200 flex">
            <TabButton active={tab === "orders"} onClick={() => setTab("orders")} testid="admin-tab-orders">
              Commandes ({orders.length})
            </TabButton>
            <TabButton active={tab === "users"} onClick={() => setTab("users")} testid="admin-tab-users">
              Utilisateurs ({users.length})
            </TabButton>
            <TabButton active={tab === "articles"} onClick={() => setTab("articles")} testid="admin-tab-articles">
              Articles
            </TabButton>
          </div>

          {loading ? (
              <div className="p-10 text-center text-slate-500">Chargement…</div>
          ) : tab === "orders" ? (
              <OrdersTable orders={orders} onStatusChange={updateStatus} />
          ) : tab === "users" ? (
              <UsersTable users={users} />
          ) : (
              <ArticlesManager />
          )}
        </div>
      </div>
  );
}

function StatCard({ icon: Icon, label, value, color, testid }) {
  return (
      <div className="bg-white border border-slate-200 rounded-sm p-5 flex items-center gap-4" data-testid={testid}>
        <div className={`p-3 bg-slate-50 rounded-sm ${color}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wider">{label}</div>
          <div className="font-display text-2xl font-bold text-slate-900">{value}</div>
        </div>
      </div>
  );
}

function TabButton({ active, onClick, children, testid }) {
  return (
      <button
          onClick={onClick}
          className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
              active ? "border-red-600 text-red-600" : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
          data-testid={testid}
      >
        {children}
      </button>
  );
}

function OrdersTable({ orders, onStatusChange }) {
  const [expandedId, setExpandedId] = useState(null);

  if (orders.length === 0)
    return <div className="p-10 text-center text-slate-500">Aucune commande pour le moment.</div>;

  return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
          <tr>
            <th className="px-4 py-3 text-left w-6"></th>
            <th className="px-4 py-3 text-left">#</th>
            <th className="px-4 py-3 text-left">Date</th>
            <th className="px-4 py-3 text-left">Client</th>
            <th className="px-4 py-3 text-left">Téléphone</th>
            <th className="px-4 py-3 text-left">Adresse</th>
            <th className="px-4 py-3 text-left">Véhicule</th>
            <th className="px-4 py-3 text-right">Total</th>
            <th className="px-4 py-3 text-left">Statut</th>
          </tr>
          </thead>
          <tbody>
          {orders.map((o, idx) => {
            const isExpanded = expandedId === o.id;
            return (
                <>
                  <tr
                      key={o.id}
                      className={`border-t border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${idx % 2 ? "bg-slate-50/50" : ""}`}
                      onClick={() => setExpandedId(isExpanded ? null : o.id)}
                      data-testid={`admin-order-${o.id}`}
                  >
                    {/* Expand toggle */}
                    <td className="px-3 py-3 text-slate-400">
                      {isExpanded
                          ? <ChevronDown className="w-4 h-4" />
                          : <ChevronRight className="w-4 h-4" />
                      }
                    </td>

                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{o.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{new Date(o.created_at).toLocaleDateString("fr-FR")}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{o.customer_name || o.user_name}</div>
                      <div className="text-xs text-slate-500">{o.user_email}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap" data-testid={`order-phone-${o.id}`}>
                      {o.phone ? (
                          <a href={`tel:${o.phone}`} className="inline-flex items-center gap-1 hover:text-red-600" onClick={e => e.stopPropagation()}>
                            <Phone className="w-3 h-3" /> {o.phone}
                          </a>
                      ) : (
                          <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700 max-w-[180px]" data-testid={`order-address-${o.id}`}>
                      {o.shipping_address ? (
                          <div className="inline-flex items-start gap-1">
                            <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0 text-slate-400" />
                            <span className="text-xs leading-snug line-clamp-2" title={o.shipping_address}>{o.shipping_address}</span>
                          </div>
                      ) : (
                          <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-700 text-xs">{o.vehicle_label || "—"}</div>
                      <div className="text-xs font-mono text-slate-400">{o.vehicle_vin}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900 whitespace-nowrap">{formatPrice(o.total_tnd)}</td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <select
                          value={o.status}
                          onChange={(e) => onStatusChange(o.id, e.target.value)}
                          className="text-xs border border-slate-300 rounded-sm px-2 py-1.5 focus:border-red-600 outline-none bg-white"
                          data-testid={`order-status-${o.id}`}
                      >
                        {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                  </tr>

                  {/* ── Expanded items row ── */}
                  {isExpanded && (
                      <tr key={`${o.id}-items`} className="bg-slate-50 border-t border-slate-100">
                        <td colSpan={9} className="px-6 py-3">
                          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                            Articles commandés ({o.items?.length ?? 0})
                          </div>
                          <table className="w-full text-xs">
                            <thead>
                            <tr className="text-slate-400 border-b border-slate-200">
                              <th className="pb-1 text-left font-medium">Référence</th>
                              <th className="pb-1 text-left font-medium">Nom de l'article</th>
                              <th className="pb-1 text-left font-medium">Marque</th>
                              <th className="pb-1 text-left font-medium">Partenaire</th>
                              <th className="pb-1 text-center font-medium">Qté</th>
                              <th className="pb-1 text-right font-medium">P.U.</th>
                              <th className="pb-1 text-right font-medium">Total</th>
                            </tr>
                            </thead>
                            <tbody>
                            {(o.items ?? []).map((item, i) => (
                                <tr key={i} className="border-b border-slate-100 last:border-0">
                                  <td className="py-1.5 pr-4 font-mono text-slate-600 whitespace-nowrap">{item.ref || "—"}</td>
                                  <td className="py-1.5 pr-4 text-slate-800 font-medium">{item.name || "—"}</td>
                                  <td className="py-1.5 pr-4 text-slate-500">{item.brand || "—"}</td>
                                  <td className="py-1.5 pr-4">
                                    <SourceBadge source={item.source} />
                                  </td>
                                  <td className="py-1.5 pr-4 text-center text-slate-700">{item.quantity}</td>
                                  <td className="py-1.5 pr-4 text-right text-slate-600">{formatPrice(item.unit_price_tnd)}</td>
                                  <td className="py-1.5 text-right font-semibold text-slate-800">{formatPrice(item.line_total_tnd)}</td>
                                </tr>
                            ))}
                            </tbody>
                            <tfoot>
                            <tr className="border-t border-slate-200">
                              <td colSpan={5} className="pt-2 text-right text-slate-500 pr-4">Sous-total</td>
                              <td colSpan={2} className="pt-2 text-right font-semibold text-slate-800">{formatPrice(o.subtotal_tnd)}</td>
                            </tr>
                            {o.delivery_cost_tnd > 0 && (
                                <tr>
                                  <td colSpan={5} className="text-right text-slate-500 pr-4">Livraison ({o.delivery_method})</td>
                                  <td colSpan={2} className="text-right text-slate-600">{formatPrice(o.delivery_cost_tnd)}</td>
                                </tr>
                            )}
                            <tr>
                              <td colSpan={5} className="pt-1 text-right font-semibold text-slate-700 pr-4">Total</td>
                              <td colSpan={2} className="pt-1 text-right font-bold text-red-600">{formatPrice(o.total_tnd)}</td>
                            </tr>
                            </tfoot>
                          </table>
                          {o.notes && (
                              <div className="mt-2 text-xs text-slate-500 italic">
                                <span className="font-semibold not-italic text-slate-600">Note : </span>{o.notes}
                              </div>
                          )}
                        </td>
                      </tr>
                  )}
                </>
            );
          })}
          </tbody>
        </table>
      </div>
  );
}

function UsersTable({ users }) {
  if (users.length === 0)
    return <div className="p-10 text-center text-slate-500">Aucun utilisateur.</div>;
  return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
          <tr>
            <th className="px-4 py-3 text-left">Nom</th>
            <th className="px-4 py-3 text-left">Email</th>
            <th className="px-4 py-3 text-left">Téléphone</th>
            <th className="px-4 py-3 text-left">Adresse</th>
            <th className="px-4 py-3 text-left">Rôle</th>
            <th className="px-4 py-3 text-left">Inscrit le</th>
          </tr>
          </thead>
          <tbody>
          {users.map((u, idx) => (
              <tr key={u.id} className={`border-t border-slate-100 ${idx % 2 ? "bg-slate-50/50" : ""}`} data-testid={`admin-user-${u.id}`}>
                <td className="px-4 py-3 font-medium text-slate-800">{u.name}</td>
                <td className="px-4 py-3 text-slate-600"><span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" /> {u.email}</span></td>
                <td className="px-4 py-3 text-slate-600">{u.phone ? <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {u.phone}</span> : "—"}</td>
                <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{u.address ? <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {u.address}</span> : "—"}</td>
                <td className="px-4 py-3">
                  <span className={`bn-chip ${u.role === "admin" ? "bg-red-100 text-red-700 border-red-200" : ""}`}>{u.role}</span>
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">{new Date(u.created_at).toLocaleDateString("fr-FR")}</td>
              </tr>
          ))}
          </tbody>
        </table>
      </div>
  );
}

function MessagesTable({ messages, onMarkRead }) {
  if (messages.length === 0)
    return <div className="p-10 text-center text-slate-500">Aucun message pour le moment.</div>;
  return (
      <div className="divide-y divide-slate-100">
        {messages.map((m) => (
            <div key={m.id} className={`p-5 sm:p-6 ${!m.read ? "bg-red-50/40" : ""}`} data-testid={`admin-message-${m.id}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    {!m.read && <span className="inline-block w-2 h-2 bg-red-600 rounded-full" title="Non lu" />}
                    <h3 className="font-display font-bold text-slate-900">{m.subject}</h3>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" /> <a href={`mailto:${m.email}`} className="hover:text-red-600">{m.email}</a></span>
                    <span>·</span>
                    <span>{m.name}</span>
                    <span>·</span>
                    <span>{new Date(m.created_at).toLocaleString("fr-FR")}</span>
                  </div>
                </div>
                {!m.read && (
                    <button onClick={() => onMarkRead(m.id)} className="text-xs inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 text-white rounded-sm hover:bg-slate-700" data-testid={`mark-read-${m.id}`}>
                      <Check className="w-3 h-3" /> Marquer lu
                    </button>
                )}
              </div>
              <p className="mt-3 text-sm text-slate-700 leading-relaxed whitespace-pre-line">{m.message}</p>
            </div>
        ))}
      </div>
  );
}

function ArticlesManager() {
  const [sections, setSections] = useState([]);
  const [sectionSlug, setSectionSlug] = useState("");
  const [sectionData, setSectionData] = useState(null);
  const [pathSlugs, setPathSlugs] = useState([]);
  const [manualParts, setManualParts] = useState([]);
  const [form, setForm] = useState({
    ref: "",
    name: "",
    brand: "",
    price_tnd: "",
    image: "",
    reference_origine: "",
    compatible_refs: "",
    stock: 25,
  });
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState("");

  useEffect(() => {
    api.get("/catalog/sections").then(r => setSections(r.data));
    loadManualParts();
  }, []);

  const loadManualParts = () => api.get("/admin/parts").then(r => setManualParts(r.data)).catch(() => {});

  const onSelectSection = async (slug) => {
    setSectionSlug(slug);
    setPathSlugs([]);
    if (!slug) { setSectionData(null); return; }
    const { data } = await api.get(`/catalog/${slug}`);
    setSectionData(data);
  };

  const levels = [];
  if (sectionData) {
    let nodes = sectionData.categories;
    let i = 0;
    while (nodes && nodes.length > 0) {
      levels.push({ level: i, options: nodes, selected: pathSlugs[i] || "" });
      const chosen = nodes.find(n => n.slug === pathSlugs[i]);
      if (!chosen) break;
      nodes = chosen.children || [];
      i++;
    }
  }
  const lastChosen = levels.length ? levels[levels.length - 1].options.find(o => o.slug === pathSlugs[levels.length - 1]) : null;
  const isLeaf = pathSlugs.length > 0 && lastChosen && (!lastChosen.children || lastChosen.children.length === 0);

  const handlePick = (level, slug) => {
    const next = pathSlugs.slice(0, level);
    if (slug) next.push(slug);
    setPathSlugs(next);
  };

  // Bild vom PC hochladen
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Merci de sélectionner un fichier image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image trop volumineuse (max 5 Mo)");
      return;
    }

    // Sofortige lokale Vorschau
    const localPreview = URL.createObjectURL(file);
    setImagePreview(localPreview);

    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/admin/upload-image", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      // Backend gibt einen relativen Pfad zurück ("/uploads/xxx.jpg") —
      // wir bauen daraus die volle URL basierend auf dem API-Host.
      const backendOrigin = (api.defaults.baseURL || "").replace(/\/api\/?$/, "");
      const fullUrl = `${backendOrigin}${data.url}`;
      setForm((f) => ({ ...f, image: fullUrl }));
      toast.success("Image téléchargée");
    } catch (err) {
      toast.error(formatApiError(err));
      setImagePreview("");
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = () => {
    setForm((f) => ({ ...f, image: "" }));
    setImagePreview("");
  };

  const submit = async () => {
    if (!sectionSlug || !isLeaf) {
      toast.error("Sélectionnez une catégorie/sous-catégorie complète (jusqu'à la dernière étape)");
      return;
    }
    if (!form.ref || !form.name || !form.price_tnd) {
      toast.error("Référence, nom et prix sont obligatoires");
      return;
    }
    setSaving(true);
    try {
      const compatibleRefsArray = form.compatible_refs
        .split(/[,\n]/)
        .map(r => r.trim())
        .filter(Boolean);

      await api.post("/admin/parts", {
        section: sectionSlug,
        category_path: pathSlugs,
        ref: form.ref,
        name: form.name,
        brand: form.brand,
        price_tnd: parseFloat(form.price_tnd),
        image: form.image,
        reference_origine: form.reference_origine,
        compatible_refs: compatibleRefsArray,
        stock: parseInt(form.stock, 10) || 0,
      });
      toast.success("Article ajouté");
      setForm({
        ref: "", name: "", brand: "", price_tnd: "", image: "",
        reference_origine: "", compatible_refs: "", stock: 25,
      });
      setImagePreview("");
      loadManualParts();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/admin/parts/${id}`);
      toast.success("Article supprimé");
      loadManualParts();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  return (
    <div className="p-6 grid lg:grid-cols-2 gap-8">
      <div className="bg-slate-50 border border-slate-200 rounded-sm p-5">
        <h3 className="font-display font-bold text-slate-900 mb-4">Ajouter un article</h3>

        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Section</label>
        <select value={sectionSlug} onChange={e => onSelectSection(e.target.value)}
                className="w-full mt-1 mb-4 text-sm border border-slate-300 rounded-sm px-3 py-2">
          <option value="">— Choisir —</option>
          {sections.map(s => <option key={s.slug} value={s.slug}>{s.label}</option>)}
        </select>

        {levels.map(lvl => (
          <div key={lvl.level}>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {lvl.level === 0 ? "Catégorie" : `Sous-catégorie ${lvl.level + 1}`}
            </label>
            <select value={lvl.selected} onChange={e => handlePick(lvl.level, e.target.value)}
                    className="w-full mt-1 mb-4 text-sm border border-slate-300 rounded-sm px-3 py-2">
              <option value="">— Choisir —</option>
              {lvl.options.map(o => <option key={o.slug} value={o.slug}>{o.label}</option>)}
            </select>
          </div>
        ))}

        {isLeaf && (
          <div className="space-y-3 border-t border-slate-200 pt-4 mt-2">
            <input placeholder="Référence" value={form.ref} onChange={e => setForm({ ...form, ref: e.target.value })}
                   className="w-full text-sm border border-slate-300 rounded-sm px-3 py-2" />
            <input placeholder="Nom" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                   className="w-full text-sm border border-slate-300 rounded-sm px-3 py-2" />
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Marque" value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })}
                     className="text-sm border border-slate-300 rounded-sm px-3 py-2" />
              <input type="number" step="0.001" placeholder="Prix TND" value={form.price_tnd}
                     onChange={e => setForm({ ...form, price_tnd: e.target.value })}
                     className="text-sm border border-slate-300 rounded-sm px-3 py-2" />
            </div>

            {/* Bild-Upload vom PC */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Image du produit
              </label>
              {(imagePreview || form.image) ? (
                <div className="relative w-full h-40 bg-white border border-slate-300 rounded-sm overflow-hidden flex items-center justify-center">
                  <img
                    src={imagePreview || form.image}
                    alt="Aperçu"
                    className="max-w-full max-h-full object-contain"
                  />
                  {uploadingImage && (
                    <div className="absolute inset-0 bg-white/70 flex items-center justify-center text-xs font-semibold text-slate-600">
                      Téléchargement…
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute top-2 right-2 bg-slate-900/80 hover:bg-red-600 text-white text-[10px] font-bold uppercase px-2 py-1 rounded-sm"
                  >
                    Retirer
                  </button>
                </div>
              ) : (
                <label className="w-full h-32 border-2 border-dashed border-slate-300 rounded-sm flex flex-col items-center justify-center text-slate-400 hover:border-red-400 hover:text-red-500 cursor-pointer transition-colors">
                  <span className="text-xs font-semibold">Cliquez pour choisir une image</span>
                  <span className="text-[10px] mt-1">JPG, PNG, WEBP — max 5 Mo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Référence origine */}
            <input
              placeholder="Référence origine"
              value={form.reference_origine}
              onChange={e => setForm({ ...form, reference_origine: e.target.value })}
              className="w-full text-sm border border-slate-300 rounded-sm px-3 py-2"
            />

            {/* Références compatibles */}
            <div>
              <textarea
                placeholder="Références compatibles (séparées par une virgule ou une nouvelle ligne)"
                rows={3}
                value={form.compatible_refs}
                onChange={e => setForm({ ...form, compatible_refs: e.target.value })}
                className="w-full text-sm border border-slate-300 rounded-sm px-3 py-2"
              />
              <div className="text-[11px] text-slate-400 mt-1">
                Ex: 1608745980, 160874KIT, 083075
              </div>
            </div>

            <input type="number" placeholder="Stock" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })}
                   className="w-full text-sm border border-slate-300 rounded-sm px-3 py-2" />
            <button
              onClick={submit}
              disabled={saving || uploadingImage}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold text-sm py-2.5 rounded-sm disabled:opacity-50"
            >
              {saving ? "Ajout en cours…" : uploadingImage ? "Image en cours…" : "Ajouter l'article"}
            </button>
          </div>
        )}
      </div>

      <div>
        <h3 className="font-display font-bold text-slate-900 mb-4">Articles manuels ({manualParts.length})</h3>
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {manualParts.map(p => (
            <div key={p.id} className="bg-white border border-slate-200 rounded-sm p-3 flex items-center gap-3">
              {p.image && (
                <img src={p.image} alt={p.name} className="w-12 h-12 object-cover rounded-sm border border-slate-200 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-800">{p.name}</div>
                <div className="text-xs text-slate-500">{p.category_label} · {p.ref} · {p.price_tnd} TND</div>
                {p.reference_origine && (
                  <div className="text-[11px] text-slate-400 mt-0.5">Réf. origine : {p.reference_origine}</div>
                )}
                {p.compatible_refs?.length > 0 && (
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Compatibles : {p.compatible_refs.join(", ")}
                  </div>
                )}
              </div>
              <button onClick={() => remove(p.id)} className="text-xs text-red-600 hover:text-red-700 font-semibold flex-shrink-0">
                Supprimer
              </button>
            </div>
          ))}
          {manualParts.length === 0 && <div className="text-sm text-slate-400">Aucun article ajouté.</div>}
        </div>
      </div>
    </div>
  );
}