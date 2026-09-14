import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  ShoppingCart,
  User,
  LogOut,
  Shield,
  Menu,
  X,
  Search,
  Truck,
  Facebook,
  Instagram,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { toast } from "sonner";
import PartnersSearchModal from "@/components/PartnersSearchModal";

// Inline WhatsApp icon (lucide doesn't ship one)
const WhatsAppIcon = ({ className = "" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.149-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
  </svg>
);

const TikTokIcon = ({ className = "" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z"/>
  </svg>
);

const SEARCH_STORAGE_KEY = "bennouri:lastSearchQuery";

const readLastSearch = () => {
  try {
    return sessionStorage.getItem(SEARCH_STORAGE_KEY) || "";
  } catch {
    return "";
  }
};

const saveLastSearch = (v) => {
  try {
    sessionStorage.setItem(SEARCH_STORAGE_KEY, v);
  } catch {
    // sessionStorage unavailable (private mode etc.) — fail silently
  }
};

export default function Header() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const submitSearch = (e) => {
    e.preventDefault();
    const v = q.trim();
    if (v.length < 2) return;
    saveLastSearch(v);
    setSearchQuery(v);
    setSearchOpen(true);
    setOpen(false);
  };

  const handleSearchFocus = () => {
    if (q) return;
    const last = readLastSearch();
    if (last) setQ(last);
  };

  const navLink = ({ isActive }) =>
    `text-sm font-semibold tracking-wide uppercase transition-colors ${
      isActive ? "text-blue-900 underline decoration-2 underline-offset-4" : "text-blue-900/60 hover:text-blue-900"
    }`;

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-blue-900/20" data-testid="site-header">
      {/* Top utility bar */}
      <div className="bg-white border-b border-blue-900/10">
        <div className="px-4 sm:px-6 lg:px-[70px] flex items-center justify-between h-9 sm:h-10 text-[11px] sm:text-xs text-blue-900 gap-3">
          <div className="hidden sm:inline-flex items-center gap-2 font-medium truncate">
            <Truck className="w-3.5 h-3.5 text-blue-900 flex-shrink-0" />
            <span className="truncate">Livraison rapide dans toute la Tunisie</span>
          </div>
          <div className="flex items-center gap-2.5 sm:gap-5 font-medium ml-auto">
            <Link to="/a-propos" className="text-blue-900 hover:text-blue-500 transition-colors hidden sm:inline">À propos de nous</Link>
            <Link to="/contact" className="text-blue-900 hover:text-blue-500 transition-colors whitespace-nowrap">Contactez-nous</Link>
            <div className="flex items-center gap-2 sm:gap-3 pl-2 border-l border-blue-900/15">
              <a href="https://www.facebook.com/profile.php?id=61575421658002" target="_blank" rel="noopener noreferrer" className="text-blue-900 hover:text-blue-500" aria-label="Facebook" data-testid="header-fb"><Facebook className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></a>
              <a href="https://www.instagram.com/bennouri_auto?igsh=MWxleDN1bW41NHhwdg==" target="_blank" rel="noopener noreferrer" className="text-blue-900 hover:text-blue-500" aria-label="Instagram"><Instagram className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></a>
              <a href="https://www.tiktok.com/@bennouri_piece_auto?_r=1&_t=ZS-977PCfpZzRS" target="_blank" rel="noopener noreferrer" className="text-blue-900 hover:text-blue-500" aria-label="TikTok" data-testid="header-wa"><TikTokIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></a>
              <a href="https://wa.me/21650881000" target="_blank" rel="noopener noreferrer" className="text-blue-900 hover:text-blue-500" aria-label="WhatsApp" data-testid="header-wa"><WhatsAppIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></a>
            </div>
          </div>
        </div>
      </div>

      {/* Main header row */}
      <div className="bg-white">
        <div className="px-4 sm:px-6 lg:px-[70px] py-2.5 sm:py-4 grid grid-cols-[auto_1fr_auto] items-center gap-3 sm:gap-6">

          {/* Logo - links */}
          <div className="flex justify-start min-w-0">
            <Link to="/" className="flex-shrink-0" data-testid="logo-link">
              <img src="/new_logo.png" alt="BENNOURI Pièces" className="h-11 sm:h-14 md:h-20 lg:h-24 w-auto object-contain" />
            </Link>
          </div>

          {/* Search bar - Mitte, nimmt jetzt den ganzen verbleibenden Platz */}
          <div className="flex justify-center min-w-0">
            <form
              onSubmit={submitSearch}
              className="hidden md:flex w-full max-w-5xl bg-white rounded-full overflow-hidden shadow-md border border-blue-900/15 focus-within:ring-2 focus-within:ring-blue-400 transition-all"
              data-testid="header-search"
            >
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onFocus={handleSearchFocus}
                placeholder="Référence d'origine (ex: 813317, 96550057)…"
                className="flex-1 min-w-0 px-5 py-3 text-sm text-black focus:outline-none font-mono-vin tracking-wider bg-transparent"
                data-testid="header-search-input"
              />
              <button
                type="submit"
                className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 px-6 flex items-center justify-center transition-colors"
                data-testid="header-search-btn"
              >
                <Search className="w-5 h-5 text-white" />
              </button>
            </form>
          </div>

          {/* Account & cart - rechts */}
          <div className="flex items-center justify-end gap-2.5 sm:gap-6 lg:gap-7">
            {user ? (
              <Link to="/compte" className="hidden sm:inline-flex items-center gap-2 text-blue-900 hover:text-blue-500 transition-colors" data-testid="header-account">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-blue-900/30 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-blue-900" />
                </div>
                <div className="leading-tight hidden lg:block">
                  <div className="text-[10px] uppercase tracking-wider text-blue-900">Mon compte</div>
                  <div className="text-sm font-semibold flex items-center gap-1 text-blue-900">{user.name?.split(" ")[0]} <ChevronDown className="w-3 h-3" /></div>
                </div>
              </Link>
            ) : (
              <Link to="/connexion" className="inline-flex items-center gap-2 text-blue-900 hover:text-blue-500 text-sm font-semibold" data-testid="header-login">
                <User className="w-5 h-5 flex-shrink-0" />
                <span className="hidden lg:inline">Connexion</span>
              </Link>
            )}
            <Link to="/panier" className="relative inline-flex items-center gap-2 text-blue-900" data-testid="header-cart">
              <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-blue-900/30 flex items-center justify-center flex-shrink-0">
                <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-blue-900" />
                {count > 0 && (
                  <span className="absolute -top-1 -right-1 bg-blue-900 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center" data-testid="cart-count">{count}</span>
                )}
              </div>
              <div className="hidden lg:block leading-tight">
                <div className="text-[10px] uppercase tracking-wider text-blue-900">Panier</div>
                <div className="text-sm font-semibold text-blue-900">{count} article{count !== 1 && "s"}</div>
              </div>
            </Link>
            {user?.role === "admin" && (
              <Link to="/admin" className="hidden lg:inline-flex items-center gap-1 text-xs text-blue-900 border border-blue-900/20 hover:border-blue-900 px-3 py-2 rounded-sm" data-testid="header-admin">
                <Shield className="w-3.5 h-3.5" /> Admin
              </Link>
            )}
            {user && (
              <button onClick={logout} className="hidden xl:inline-flex items-center gap-1 text-xs text-blue-900/70 hover:text-blue-900" data-testid="header-logout">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              className="md:hidden text-blue-900 flex-shrink-0"
              onClick={() => setOpen(!open)}
              aria-label="Toggle menu"
              data-testid="header-menu-toggle"
            >
              {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-white border-t border-blue-900/10" data-testid="mobile-menu">
          <form onSubmit={submitSearch} className="p-4 border-b border-blue-900/10">
            <div className="flex bg-white border border-blue-900/15 rounded-sm overflow-hidden">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onFocus={handleSearchFocus}
                placeholder="Rechercher..."
                className="flex-1 min-w-0 px-3 py-2 text-sm text-black focus:outline-none"
              />
              <button type="submit" className="flex-shrink-0 bg-blue-600 px-4">
                <Search className="w-4 h-4 text-white" />
              </button>
            </div>
          </form>
          <div className="px-4 py-3 space-y-2">
            <Link to="/a-propos" onClick={() => setOpen(false)} className="block py-2 text-blue-900 font-semibold">À propos de nous</Link>
            {user ? (
              <>
                <Link to="/compte" onClick={() => setOpen(false)} className="block py-2 text-blue-900">Mon compte</Link>
                {user.role === "admin" && (
                  <Link to="/admin" onClick={() => setOpen(false)} className="block py-2 text-blue-900">Admin</Link>
                )}
                <button onClick={() => { logout(); setOpen(false); }} className="block w-full text-left py-2 text-blue-900/70">Déconnexion</button>
              </>
            ) : (
              <Link to="/connexion" onClick={() => setOpen(false)} className="block py-2 text-blue-900 font-semibold">Connexion</Link>
            )}
          </div>
        </div>
      )}
      <PartnersSearchModal
        open={searchOpen}
        query={searchQuery}
        onClose={() => setSearchOpen(false)}
      />
    </header>
  );
}
