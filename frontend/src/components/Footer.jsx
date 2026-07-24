import { Link } from "react-router-dom";
import { MapPin, Phone, Mail, Clock, Shield, Truck, Award } from "lucide-react";

const LOGO_URL =
  "https://customer-assets.emergentagent.com/job_5600b1e5-a62c-421b-898c-63f49ca272d0/artifacts/ewc8z695_logo.jpeg";

function VisaIcon() {
  return (
    <svg viewBox="0 0 48 32" className="h-8 w-12" aria-label="Visa">
      <rect width="48" height="32" rx="3" fill="#1A1F71" />
      <text x="24" y="22" textAnchor="middle" fontFamily="Arial Black, Arial" fontSize="14" fontWeight="900" fill="#FFFFFF" fontStyle="italic">VISA</text>
    </svg>
  );
}

function MastercardIcon() {
  return (
    <svg viewBox="0 0 48 32" className="h-8 w-12" aria-label="Mastercard">
      <rect width="48" height="32" rx="3" fill="#000000" />
      <circle cx="20" cy="16" r="8" fill="#EB001B" />
      <circle cx="28" cy="16" r="8" fill="#F79E1B" />
      <path d="M24 10.5a8 8 0 0 1 0 11 8 8 0 0 1 0-11z" fill="#FF5F00" />
    </svg>
  );
}

function CashIcon() {
  return (
    <svg viewBox="0 0 48 32" className="h-8 w-12" aria-label="Espèces">
      <rect width="48" height="32" rx="3" fill="#16A34A" />
      <text x="24" y="21" textAnchor="middle" fontFamily="Arial Black, Arial" fontSize="11" fontWeight="900" fill="#FFFFFF">CASH</text>
    </svg>
  );
}

export default function Footer() {
  return (
    <footer className="bg-black text-white/80 border-t border-red-600/30" data-testid="site-footer">
{/* Trust strip */}
<div className="bg-white border-b border-slate-200">
  <div className="w-full px-[70px] py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    {[
{
  bg: "/engine.png",
  badge: "-20%",
  title: "Promo du mois",
  sub: "Sur une sélection de pièces",
  cta: "Profiter",
  to: "/",
  imgClass: "right-8 scale-150",
},
{
  bg: "/livrision-auto.png",
  badge: "24H",
  title: "Livraison en 24h",
  sub: "Sur toute la Tunisie",
  cta: "En savoir +",
  to: "/",
  imgClass: "right-12 scale-150 -translate-y-7",
},
      {
        bg: "/paiment.png",
        badge: "SÉCURISÉ",
        title: "Paiement sécurisé",
        sub: "100% sûr",
        cta: "En savoir +",
        to: "/",
      },
      {
        bg: "/support.png",
        badge: null,
        title: "Besoin d'aide ?",
        sub: "Notre équipe est à votre disposition",
        cta: "Contacter",
        to: "/contact",
        phone: "+216 98 123 456",
          imgClass: "right-8",
      },
    ].map((c, i) => (
      <Link
        key={i}
        to={c.to}
        className="group relative overflow-hidden rounded-sm h-40 sm:h-44 flex flex-col justify-between p-4 bg-black"
        data-testid={`footer-promo-card-${i}`}
      >
        {/* Background image — full, unscaled, bleeding to the right edge */}
        <img
          src={c.bg}
          alt=""
          className={`absolute inset-y-0 h-full w-auto object-cover object-right ${c.imgClass || "max-w-[65%] right-0"}`}
        />
        {/* Dark gradient overlay for text legibility on the left */}
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/85 to-transparent" />

        {/* Content */}
        <div className="relative z-10">
          {c.badge && (
            <span className="block text-red-500 font-display font-black text-2xl leading-none mb-1">
              {c.badge}
            </span>
          )}
          <h3 className="text-white font-display font-black uppercase text-sm sm:text-base leading-tight">
            {c.title}
          </h3>
          <p className="text-white/70 text-[11px] sm:text-xs mt-1 leading-snug max-w-[70%]">
            {c.sub}
          </p>
        </div>

        <div className="relative z-10">
          <span className="inline-flex items-center bg-red-600 group-hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-sm transition-colors">
            {c.cta}
          </span>
        </div>
      </Link>
    ))}
  </div>
</div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid grid-cols-1 md:grid-cols-4 gap-10">
        <div className="md:col-span-1">
          <div className="font-display text-2xl font-black text-white tracking-tight">
            BENNOURI <span className="text-red-600">Pièces</span>
          </div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-red-500 mt-1 mb-4">Pièces Auto Originales</div>
          <p className="text-sm text-white/60 leading-relaxed">
            Le spécialiste des pièces détachées automobiles en Tunisie. Identification par VIN, livraison rapide, qualité garantie.
          </p>
        </div>

        <div>
          <h4 className="text-white font-display font-bold text-sm uppercase tracking-wider mb-4">Contact</h4>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <MapPin className="w-4 h-4 mt-0.5 text-red-500 flex-shrink-0" />
              <span>Rue de France, 2043 Ben Arous, Tunisie</span>
            </li>
            <li className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-red-500 flex-shrink-0" />
              <a href="tel:+21650881000" className="hover:text-red-400">+216 50 881 000</a>
            </li>
            <li className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-red-500 flex-shrink-0" />
              <a href="tel:+21654643643" className="hover:text-red-400">+216 54 643 643</a>
            </li>
            <li className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-red-500 flex-shrink-0" />
              <a href="mailto:contact@bennouri.tn" className="hover:text-red-400">contact@bennouri.tn</a>
            </li>
            <li className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span>Lun - Dim: 8h00 - 20h00</span>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-display font-bold text-sm uppercase tracking-wider mb-4">Liens rapides</h4>
          <ul className="space-y-2 text-sm">
            <li><Link to="/recherche-vin" className="hover:text-red-400">Recherche par VIN</Link></li>
            <li><Link to="/catalogue/mecanique" className="hover:text-red-400">Pièces Mécanique</Link></li>
            <li><Link to="/catalogue/electrique" className="hover:text-red-400">Pièces Électrique</Link></li>
            <li><Link to="/catalogue/carrosserie" className="hover:text-red-400">Pièces Carrosserie</Link></li>
            <li><Link to="/compte" className="hover:text-red-400">Mon compte</Link></li>
            <li><Link to="/contact" className="hover:text-red-400" data-testid="footer-contact-link">Nous contacter</Link></li>
            <li><Link to="/impressum" className="hover:text-red-400" data-testid="footer-impressum-link">Mentions légales</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-display font-bold text-sm uppercase tracking-wider mb-4"></h4>
          <div className="flex items-center gap-2" data-testid="footer-payment-icons">
           <img
  src="promo.png"
  alt="Paiement sécurisé"
  className="w-30 h-auto object-contain mb-4"
  style={{ transform: "rotate(-8deg)" }}
/>
          </div>
        </div> 


      {/* <div>
          <h4 className="text-white font-display font-bold text-sm uppercase tracking-wider mb-4">Paiement</h4>
          <p className="text-sm text-white/60 mb-4">Paiement sécurisé à la livraison ou par carte bancaire.</p>
          <div className="flex items-center gap-2" data-testid="footer-payment-icons">
            <VisaIcon />
            <MastercardIcon />
            <CashIcon />
          </div>
        </div> */}
      </div>

      <div className="border-t border-white/10 bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/40">
          <div>© {new Date().getFullYear()} BENNOURI PIECES AUTO — Tous droits réservés.</div>
          <div className="font-mono uppercase tracking-widest text-red-500">Tunis · Tunisie</div>
        </div>
      </div>
    </footer>
  );
}
