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
      <div className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { icon: Truck, t: "Livraison rapide", s: "Toute la Tunisie" },
            { icon: Shield, t: "Pièces garanties", s: "Qualité OEM" },
            { icon: Award, t: "Marques premium", s: "Bosch, Valeo, Bilstein" },
            { icon: Clock, t: "Support 7j/7", s: "8h - 20h" },
          ].map((it, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-red-600/10 border border-red-600/30 flex items-center justify-center flex-shrink-0">
                <it.icon className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <div className="text-white font-bold uppercase text-sm tracking-wider">{it.t}</div>
                <div className="text-white/50 text-xs">{it.s}</div>
              </div>
            </div>
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
              <span>Lun - Sam: 8h00 - 20h00</span>
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
          <h4 className="text-white font-display font-bold text-sm uppercase tracking-wider mb-4">Paiement</h4>
          <p className="text-sm text-white/60 mb-4">Paiement sécurisé à la livraison ou par carte bancaire.</p>
          <div className="flex items-center gap-2" data-testid="footer-payment-icons">
            <VisaIcon />
            <MastercardIcon />
            <CashIcon />
          </div>
        </div>
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
