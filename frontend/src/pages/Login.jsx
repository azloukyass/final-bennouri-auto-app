import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Mail, Lock, LogIn, Facebook } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export default function Login() {
  const { login, formatApiError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success(`Bienvenue ${user.name} !`);
      navigate(user.role === "admin" ? "/admin" : from);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-16" data-testid="login-page">
      <div className="text-center mb-8">
        <h1 className="font-display text-4xl font-black tracking-tight text-slate-900 uppercase">Connexion</h1>
        <p className="mt-2 text-sm font-semibold tracking-wide text-slate-500">Accédez à votre compte <span className="text-red-600 font-bold">BENNOURI</span></p>
      </div>

      <form onSubmit={submit} className="bg-white border border-slate-200 rounded-sm p-8 shadow-sm">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">Email</label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full pl-10 pr-3 py-3 border border-slate-300 rounded-sm focus:border-red-600 outline-none"
            placeholder="email@exemple.com"
            required
            data-testid="login-email-input"
          />
        </div>

        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1 mt-4">Mot de passe</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full pl-10 pr-3 py-3 border border-slate-300 rounded-sm focus:border-red-600 outline-none"
            placeholder="••••••••"
            required
            data-testid="login-password-input"
          />
        </div>

         <div className="mt-2 text-right">
  <Link to="/mot-de-passe-oublie" className="text-xs text-red-600 hover:underline font-medium" data-testid="login-forgot-password-link">
    Mot de passe oublié ?
  </Link>
</div>
        <button type="submit" disabled={loading} className="mt-6 w-full bn-btn-primary disabled:opacity-60" data-testid="login-submit-button">
          {loading ? "Connexion..." : (<><LogIn className="w-4 h-4" /> Se connecter</>)}
        </button>

        <div className="mt-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-xs uppercase tracking-widest text-slate-400">ou</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        <button
          type="button"
          onClick={() => toast.info("Connexion Facebook — bientôt disponible. Configurez d'abord votre application Facebook Developer.")}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-[#1877F2] hover:bg-[#0e64d8] text-white font-medium px-6 py-3 rounded-sm transition-colors"
          data-testid="login-facebook-button"
        >
          <Facebook className="w-4 h-4 fill-current" /> Continuer avec Facebook
        </button>

        <p className="mt-6 text-sm text-center text-slate-500">
          Pas encore de compte ?{" "}
          <Link to="/inscription" className="text-red-600 hover:underline font-medium" data-testid="login-to-register">S'inscrire</Link>
        </p>
      </form>
    </div>
  );
}
