import { MapPin, Phone, Mail, Building, FileText, Shield, Scale } from "lucide-react";

export default function Impressum() {
  return (
    <div className="bg-white" data-testid="impressum-page">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600 mb-2">Mentions légales</div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-blue-900 tracking-tight">Impressum</h1>
          <p className="mt-3 text-slate-500">Informations légales et coordonnées de la société.</p>
        </div>

        <div className="space-y-6">
          <Section icon={Building} title="Éditeur du site">
            <p><strong>BENNOURI Pièces Auto</strong></p>
            <p>Société à responsabilité limitée (SARL)</p>
            <p>Rue de France, 2043 Ben Arous, Tunisie</p>
            <p>Matricule fiscal : <span className="font-mono-vin">1234567/A/M/000</span></p>
            <p>Registre du commerce : <span className="font-mono-vin">B12345678</span></p>
          </Section>

          <Section icon={Phone} title="Contact">
            <p><strong>Téléphone :</strong> <a href="tel:+21654643643" className="text-blue-700 hover:underline">+216 54 643 643</a></p>
            <p><strong>Email :</strong> <a href="mailto:contact@bennouri.tn" className="text-blue-700 hover:underline">contact@bennouri.tn</a></p>
          </Section>

          <Section icon={FileText} title="Directeur de la publication">
            <p>Le directeur de la publication est le gérant de la société BENNOURI Pièces Auto.</p>
          </Section>

          <Section icon={Shield} title="Hébergement">
            <p>Ce site est hébergé sur une infrastructure cloud sécurisée. Les données sont stockées conformément à la réglementation tunisienne sur la protection des données personnelles.</p>
          </Section>

          <Section icon={Scale} title="Propriété intellectuelle">
            <p>L'ensemble des éléments présents sur ce site (textes, images, logos, marques, structure, base de données) est protégé par le droit d'auteur et le droit des marques. Toute reproduction, totale ou partielle, est interdite sans autorisation préalable écrite.</p>
            <p>Les marques et logos des constructeurs automobiles cités sur ce site appartiennent à leurs propriétaires respectifs. Leur utilisation est faite à des fins purement informatives et de compatibilité produit.</p>
          </Section>

          <Section icon={FileText} title="Conditions générales de vente">
            <p><strong>Paiement :</strong> Le paiement s'effectue à la livraison (en espèces ou par carte bancaire). Les prix sont indiqués en Dinar Tunisien (TND), toutes taxes comprises.</p>
            <p><strong>Livraison :</strong> Délais indicatifs 24 à 72 heures pour la Tunisie continentale. Frais offerts pour les commandes supérieures à 100 TND.</p>
            <p><strong>Garantie :</strong> Toutes nos pièces sont garanties d'origine équipementier (OEM) ou aftermarket de qualité. Garantie constructeur applicable selon les conditions du fabricant.</p>
            <p><strong>Retour :</strong> Retour possible sous 14 jours, pièce non installée et dans son emballage d'origine.</p>
          </Section>

          <Section icon={Shield} title="Données personnelles">
            <p>Conformément à la loi tunisienne n°2004-63 relative à la protection des données à caractère personnel, vous disposez d'un droit d'accès, de rectification et de suppression des données vous concernant. Pour exercer ce droit, contactez-nous à <a href="mailto:contact@bennouri.tn" className="text-blue-700 hover:underline">contact@bennouri.tn</a>.</p>
          </Section>

          <Section icon={MapPin} title="Compétence juridictionnelle">
            <p>Tout litige relatif à l'utilisation du présent site ou à une commande passée auprès de BENNOURI Pièces Auto sera soumis à la compétence exclusive des tribunaux de Tunis, Tunisie. La loi applicable est la loi tunisienne.</p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <section className="bg-white border border-blue-100 rounded-sm p-6 sm:p-8" data-testid={`impressum-section-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-blue-100">
        <div className="p-2 bg-blue-900 text-white rounded-sm">
          <Icon className="w-4 h-4" />
        </div>
        <h2 className="font-display font-bold text-lg text-blue-900">{title}</h2>
      </div>
      <div className="text-sm text-slate-600 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}
