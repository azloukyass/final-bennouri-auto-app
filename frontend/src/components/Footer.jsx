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
    <footer className="bg-blue-900 text-white/80 border-t border-white/20" data-testid="site-footer">


      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid grid-cols-1 md:grid-cols-4 gap-10">
        <div className="md:col-span-1">
          <div className="font-display text-2xl font-black text-white tracking-tight">
            BENNOURI <span className="text-blue-300">Pièces</span>
          </div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-white-300 mt-1 mb-4"><strong>Pièces Auto Originales</strong></div>
          <p className="text-sm text-white/60 leading-relaxed">
            Le spécialiste des pièces détachées automobiles en Tunisie. Identification par VIN, livraison rapide, qualité et garantie.
          </p>
        </div>

        <div>
          <h4 className="text-white font-display font-bold text-sm uppercase tracking-wider mb-4">Contact</h4>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <MapPin className="w-4 h-4 mt-0.5 text-blue-300 flex-shrink-0" />
              <span>Blanche Morneg N53 - La Nouvelle Medina - BEN AROUS 2063</span>
            </li>
            <li className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-blue-300 flex-shrink-0" />
              <a href="tel:+21650881000" className="hover:text-blue-200">+216 50 881 000</a>
            </li>
            <li className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-blue-300 flex-shrink-0" />
              <a href="tel:+21654643643" className="hover:text-blue-200">+216 54 643 643</a>
            </li>
            <li className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-blue-300 flex-shrink-0" />
              <a href="mailto:contact@bennouri.tn" className="hover:text-blue-200">contact@bennouri.tn</a>
            </li>
            <li className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-blue-300 flex-shrink-0" />
              <span>Lun - Ven : 8h00 - 19h00</span>
            </li>
             <li className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-blue-300 flex-shrink-0" />
             <span>Samedi : 8h00 - 15h00</span>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-display font-bold text-sm uppercase tracking-wider mb-4">Liens rapides</h4>
          <ul className="space-y-2 text-sm">

            <li><Link to="/compte" className="hover:text-blue-200">Mon compte</Link></li>
            <li><Link to="/impressum" className="hover:text-blue-200">Politique de confidentialité</Link></li>
            <li><Link to="/conditions-generales-vente" className="hover:text-blue-200" data-testid="footer-cgv-link">Conditions générales de vente</Link></li>
            <li><Link to="/contact" className="hover:text-blue-200" data-testid="footer-contact-link">Nous contacter</Link></li>
          </ul>
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

      <div className="border-t border-white/10 bg-blue-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/40">
          <div>© {new Date().getFullYear()} BENNOURI PIECES AUTO — Tous droits réservés.</div>
          <div className="font-mono uppercase tracking-widest text-blue-300">Tunis · Tunisie</div>
        </div>
      </div>
    </footer>
  );
}
