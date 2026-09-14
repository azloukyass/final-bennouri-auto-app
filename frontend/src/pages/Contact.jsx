import { useState } from "react";
import { Mail, Phone, MapPin, Clock, Send, User, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
  const [loading, setLoading] = useState(false);

  const onChange = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
   if (!form.name.trim() || !form.email.trim() || !form.phone.trim() || !form.message.trim()) {
  toast.error("Nom, email, téléphone et message sont obligatoires");
  return;
}
    setLoading(true);
    try {
      await api.post("/contact", form);
      toast.success("Message envoyé ! Nous vous répondrons rapidement.");
      setForm({ name: "", email: "", phone: "", subject: "", message: "" });
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16" data-testid="contact-page">
      <div className="text-center mb-12">
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600 mb-2">Nous écrire</div>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight">Contactez-nous</h1>
        <p className="mt-3 text-slate-500 max-w-2xl mx-auto">Une question, un devis, une demande de pièce introuvable ? Notre équipe vous répond en moins de 24h.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-4">
         {
  [
    { Icon: MapPin, t: "Adresse", v: "Blanche Morneg N53 - La Nouvelle Medina - BEN AROUS 2063" },
    {
      Icon: Phone,
      t: "Téléphone",
      numbers: [
        { v: "+216 54 643 643", href: "tel:+21654643643" },
        { v: "+216 50 881 000", href: "tel:+21650881000" },
      ],
    },
    { Icon: Mail, t: "Email", v: "contact@bennouri.tn", href: "mailto:contact@bennouri.tn" },
    { Icon: Clock, t: "Horaires", v: "Lun – Ven : 8h00 – 19h00\nSamedi : 8h00 – 15h00" },
  ].map((it, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-sm p-5 flex items-start gap-4" data-testid={`contact-info-${i}`}>
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-sm flex-shrink-0">
                <it.Icon className="w-5 h-5" />
              </div>
             <div>
  <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">{it.t}</div>
  {it.numbers ? (
    <div className="font-display font-semibold text-slate-900 space-y-0.5">
      {it.numbers.map((n, idx) => (
        <a key={idx} href={n.href} className="block hover:text-blue-600">
          {n.v}
        </a>
      ))}
    </div>
  ) : it.href ? (
    <a href={it.href} className="font-display font-semibold text-slate-900 hover:text-blue-600">{it.v}</a>
  ) : (
    <div className="font-display font-semibold text-slate-900">
      {it.v.split("\n").map((line, idx) => (
        <span key={idx}>
          {idx > 0 && <br />}
          {line}
        </span>
      ))}
    </div>
  )}
</div>
            </div>
          ))}
        </div>

        <form onSubmit={submit} className="lg:col-span-2 bg-white border border-slate-200 rounded-sm p-8 shadow-sm space-y-4" data-testid="contact-form">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field icon={User} label="Nom complet" value={form.name} onChange={onChange("name")} testid="contact-name" required />
            <Field icon={Mail} label="Email" type="email" value={form.email} onChange={onChange("email")} testid="contact-email" required />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
          <Field icon={Phone} label="Téléphone" type="tel" value={form.phone} onChange={onChange("phone")} testid="contact-phone" placeholder="+216 XX XXX XXX" required />  
            <Field icon={MessageSquare} label="Objet" value={form.subject} onChange={onChange("subject")} testid="contact-subject" placeholder="ex: Demande de pièce, devis, livraison..." />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Message *</label>
            <textarea
              value={form.message}
              onChange={onChange("message")}
              rows={6}
              required
              data-testid="contact-message"
              className="w-full px-3 py-3 border border-slate-300 rounded-sm focus:border-blue-600 outline-none text-sm resize-none"
              placeholder="Décrivez votre demande..."
            />
          </div>

          <button
  type="submit"
  disabled={loading}
  data-testid="contact-submit"
  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-6 py-3 rounded-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
>
  {loading ? "Envoi..." : (<><Send className="w-4 h-4" /> Envoyer le message</>)}
</button>

        </form>
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, type = "text", value, onChange, testid, required, placeholder }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">{label}{required && " *"}</label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type={type}
          value={value}
          onChange={onChange}
          required={required}
          placeholder={placeholder}
          data-testid={testid}
          className="w-full pl-10 pr-3 py-3 border border-slate-300 rounded-sm focus:border-blue-600 outline-none text-sm"
        />
      </div>
    </div>
  );
}