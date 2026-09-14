import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowRight } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-16 bg-white" data-testid="forgot-password-page">
      <div className="text-center mb-8">
        <h1 className="font-display text-4xl font-black tracking-tight text-slate-900 uppercase">Mot de passe oublié</h1>
        <p className="mt-2 text-sm font-semibold tracking-wide text-slate-500">
          Recevez un lien de réinitialisation par email
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-sm p-8 shadow-sm">
        {sent ? (
          <div className="text-center py-4" data-testid="forgot-password-sent">
            <div className="text-sm text-slate-600 mb-4">
              Si un compte existe avec l'adresse <strong className="text-slate-900">{email}</strong>,
              vous recevrez un email contenant un lien de réinitialisation dans quelques instants.
            </div>
            <Link to="/connexion" className="text-blue-600 hover:underline font-medium text-sm">
              ← Retour à la connexion
            </Link>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-3 py-3 border border-slate-300 rounded-sm focus:border-blue-600 outline-none"
                placeholder="email@exemple.com"
                required
                data-testid="forgot-password-email-input"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold uppercase tracking-wider px-6 py-3 rounded-sm transition-colors"
              data-testid="forgot-password-submit"
            >
              {loading ? "Envoi..." : (<>Envoyer le lien <ArrowRight className="w-4 h-4" /></>)}
            </button>

            <p className="mt-6 text-sm text-center text-slate-500">
              <Link to="/connexion" className="text-blue-600 hover:underline font-medium">← Retour à la connexion</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
