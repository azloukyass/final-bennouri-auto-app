import { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Lock, CheckCircle2 } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }
    if (password !== confirm) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, new_password: password });
      setDone(true);
      setTimeout(() => navigate("/connexion"), 2500);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="max-w-md mx-auto px-4 sm:px-6 py-16 text-center" data-testid="reset-password-no-token">
        <p className="text-slate-600 mb-4">Lien invalide — aucun token trouvé.</p>
        <Link to="/mot-de-passe-oublie" className="text-red-600 hover:underline font-medium text-sm">
          Demander un nouveau lien
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-16" data-testid="reset-password-page">
      <div className="text-center mb-8">
        <h1 className="font-display text-4xl font-black tracking-tight text-slate-900 uppercase">Nouveau mot de passe</h1>
      </div>

      <div className="bg-white border border-slate-200 rounded-sm p-8 shadow-sm">
        {done ? (
          <div className="text-center py-4" data-testid="reset-password-success">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <p className="text-sm text-slate-600">Mot de passe réinitialisé avec succès. Redirection...</p>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">Nouveau mot de passe</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-3 py-3 border border-slate-300 rounded-sm focus:border-red-600 outline-none"
                placeholder="••••••••"
                required
                data-testid="reset-password-input"
              />
            </div>

            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1 mt-4">Confirmer le mot de passe</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full pl-10 pr-3 py-3 border border-slate-300 rounded-sm focus:border-red-600 outline-none"
                placeholder="••••••••"
                required
                data-testid="reset-password-confirm-input"
              />
            </div>

            <button type="submit" disabled={loading} className="mt-6 w-full bn-btn-primary disabled:opacity-60" data-testid="reset-password-submit">
              {loading ? "Réinitialisation..." : "Réinitialiser le mot de passe"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}