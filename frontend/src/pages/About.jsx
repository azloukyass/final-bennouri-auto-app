import { Link } from "react-router-dom";
import {
  MapPin, Phone, Mail, Clock, Award, ShieldCheck, Truck, Wrench, Users, Building2, Sparkles, ArrowRight,
} from "lucide-react";

const PARTNERS = [
  { name: "Bosch", logo: "boesch.png" },
  { name: "Shell", logo: "shell.png" },
  { name: "Valeo", logo: "valeo.png" },
  { name: "Mahle", logo: "mahle.png" },
  { name: "Continental", logo: "Continental.png" },
  { name: "Castrol", logo: "Castrol.png" },
  { name: "Denso", logo: "Denso.png" },
  { name: "Monroe", logo: "monroe.png" },
  { name: "Monroe", logo: "logo_PRASCO.png" },{ name: "Monroe", logo: "logo_misfat_filtration.png" },  { name: "Kamoka", logo: "logo_KAMOKA_v2.png" }
,{ name: "Monroe", logo: "logo_LIQUI_MOLY.png" },{ name: "Monroe", logo: "logo_LUK.png" },{ name: "Monroe", logo: "logo_MOTUL.png" },
  { name: "Monroe", logo: "logo_FARE_automotive.png" },{ name: "Monroe", logo: "logo_metelli.png" },{ name: "Monroe", logo: "logo_LPR_brakes.png" },{ name: "Monroe", logo: "logo_amortisseurs_record.png" },{ name: "Monroe", logo: "logo_LTM.png" },
];

const STATS = [
  { value: "+15", label: "Années d'expérience" },
  { value: "+50 000", label: "Pièces référencées" },
  { value: "+12", label: "Partenaires majeurs" },
  { value: "24h-48h", label: "Livraison Tunisie" },
];

const VALUES = [
  { Icon: Award, title: "Qualité d'origine", text: "Toutes nos pièces proviennent directement d'équipementiers reconnus mondialement." },
  { Icon: ShieldCheck, title: "Garantie & sécurité", text: "Chaque commande est protégée. Vos données et votre paiement sont 100% sécurisés." },
  { Icon: Truck, title: "Livraison rapide", text: "Expédié sous 24h en région tunisoise et 48h partout en Tunisie." },
  { Icon: Wrench, title: "Conseil pro", text: "Notre équipe technique vous aide à choisir la bonne référence pour votre véhicule." },
];

export default function About() {
  return (
    <div data-testid="about-page">
      {/* Hero */}
      <section className="relative overflow-hidden bg-white text-blue-900">
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: "linear-gradient(rgba(30,58,138,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(30,58,138,0.5) 1px, transparent 1px)",
          backgroundSize: "50px 50px",
        }} />
        <div className="absolute -right-40 top-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.4em] text-blue-600 mb-4">
              <span className="w-6 h-px bg-blue-600"></span> À propos de nous
            </div>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.05] uppercase">
              BENNOURI <span className="text-blue-600">pièces auto</span><br/>
              <span className="text-blue-900/80 font-bold text-2xl sm:text-3xl lg:text-4xl normal-case tracking-normal">Votre partenaire pièces auto en Tunisie</span>
            </h1>
    <p className="mt-6 text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl">
  Forts de plus de 15 ans d'expérience dans le domaine des pièces automobiles, nous avons choisi d'adopter une nouvelle approche en intégrant les solutions du
  <br />
  e-commerce afin de mieux répondre aux attentes de nos clients.
  <br />
  <br />
  Notre priorité reste la même : offrir une expérience d'achat simple, rapide et fiable. C'est pourquoi nous proposons désormais un service de livraison rapide couvrant l'ensemble du territoire tunisien.
  <br />
  <br />
  Nous vous invitons à découvrir notre site <strong className="text-blue-900">bennouri.tn</strong>, où vous trouverez un large choix de pièces automobiles d'origine ou de qualité équivalente, sélectionnées avec soin et proposées à des prix compétitifs.
</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/recherche-vin" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase text-sm tracking-wider px-6 py-3 rounded-sm shadow-lg shadow-blue-900/20">
                Rechercher une pièce <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/contact" className="inline-flex items-center border border-blue-900/30 hover:border-blue-900 text-blue-900 font-bold uppercase text-sm tracking-wider px-6 py-3 rounded-sm">
                Nous contacter
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="bg-white text-blue-900 border-y border-blue-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-2 lg:grid-cols-4 gap-6">
          {STATS.map((s) => (
            <div key={s.label} className="text-center" data-testid={`stat-${s.label}`}>
              <div className="font-display font-black text-3xl sm:text-4xl tracking-tight leading-none text-blue-600">{s.value}</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.2em] font-semibold text-blue-900/60">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Mission */}
      <section className="bg-white text-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-blue-600 mb-3">Notre mission</div>
            <h2 className="font-display text-3xl sm:text-4xl font-black uppercase tracking-tight leading-tight mb-5">
              Rendre la qualité <span className="text-blue-600">accessible</span> à tous les automobilistes.
            </h2>
            <p className="text-slate-700 leading-relaxed text-base mb-4">
              Que vous soyez un particulier soucieux de l&apos;entretien de votre véhicule ou un professionnel
              à la recherche d&apos;un fournisseur fiable, BENNOURI vous garantit des <strong>pièces 100% originales</strong>,
              à des <strong>prix justes</strong> et avec une <strong>livraison rapide partout en Tunisie</strong>.
            </p>
            <p className="text-slate-700 leading-relaxed text-base">
              Notre catalogue couvre plus de <strong className="text-blue-600">50 000 références</strong> issues
              des plus grandes marques mondiales. Grâce à nos partenariats stratégiques avec VALEO, LUK, SACHS, LPR, BOSCH et
              PRASCO, nous offrons une <strong>disponibilité de stock inégalée</strong> sur le marché local.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            {VALUES.map((v) => (
              <div key={v.title} className="border border-slate-200 hover:border-blue-500 rounded-sm p-5 transition-colors group" data-testid={`value-${v.title}`}>
                <div className="w-11 h-11 bg-blue-50 group-hover:bg-blue-600 rounded-sm flex items-center justify-center mb-3 transition-colors">
                  <v.Icon className="w-5 h-5 text-blue-600 group-hover:text-white transition-colors" />
                </div>
                <div className="font-display font-black text-slate-900 uppercase text-sm tracking-wide mb-1">{v.title}</div>
                <div className="text-xs text-slate-600 leading-relaxed">{v.text}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

{/* Partners — animated marquee with real logo images */}
<section className="bg-slate-50 border-y border-slate-200 overflow-hidden">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
    <div className="text-center mb-10">
      <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-blue-600 mb-2">Nos partenaires</div>
      <h2 className="font-display text-3xl sm:text-4xl font-black uppercase tracking-tight text-slate-900">
        Les meilleures marques mondiales
      </h2>
      <p className="mt-3 text-slate-600 text-sm max-w-2xl mx-auto">
        Nous travaillons exclusivement avec des équipementiers de renommée internationale pour garantir
        la fiabilité et la longévité de chaque pièce vendue.
      </p>
    </div>
  </div>

  <div className="relative w-full">
    <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-slate-50 to-transparent z-10" />
    <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-slate-50 to-transparent z-10" />

    <div className="flex w-max animate-marquee gap-4 py-2">
      {[...PARTNERS, ...PARTNERS].map((p, idx) => (
        <div
          key={`${p.name}-${idx}`}
          className="bg-white border border-slate-200 rounded-sm py-6 px-8 flex items-center justify-center hover:shadow-md transition-all flex-shrink-0 w-44 h-20"
          data-testid={`partner-${p.name}`}
        >
          <img
            src={p.logo}
            alt={p.name}
            className="max-w-full max-h-15 object-contain"
            onError={(e) => { e.target.style.display = "none"; }}
          />
        </div>
      ))}
    </div>
  </div>
</section>
      {/* Showroom & contact info */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-blue-600 mb-3">Notre Point de Vente</div>
            <h2 className="font-display text-3xl sm:text-4xl font-black uppercase tracking-tight text-slate-900 mb-4">
              Venez nous rencontrer à <span className="text-blue-600">Ben Arous</span>
            </h2>
            <p className="text-slate-700 leading-relaxed mb-6">
              Notre équipe vous accueille dans notre showroom moderne où vous pouvez consulter notre catalogue,
              poser vos questions techniques et repartir avec vos pièces le jour même.
            </p>

            <div className="space-y-4">
              <InfoLine Icon={MapPin} label="Adresse">
                Blanche Morneg, N53 <br />
                Ben Arous 2063, Tunisie
              </InfoLine>
              <InfoLine Icon={Phone} label="Téléphone">
                <a href="tel:+21650881000" className="hover:text-blue-600">+216 50 881 000</a>
                <span className="mx-2 text-slate-300">·</span>
                <a href="https://wa.me/21650881000" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">WhatsApp</a>
              </InfoLine>
              <InfoLine Icon={Mail} label="Email">
                <a href="mailto:contact@bennouri.tn" className="hover:text-blue-600">contact@benouri.tn</a>
              </InfoLine>
              <InfoLine Icon={Clock} label="Horaires d'ouverture">
                <span>Lun – Ven : 8h00 – 18h00</span>
                <br />
                <span>Samedi : 8h00 – 15h00</span>
              </InfoLine>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/contact" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase text-sm tracking-wider px-6 py-3 rounded-sm">
                Contactez-nous <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="aspect-[4/3] rounded-sm overflow-hidden bg-slate-100 border border-slate-200 relative">
<iframe
  title="BENNOURI  POINT DE VENTE — Ben Arous"
  src="https://maps.google.com/maps?q=BENNOURI+PIECES+AUTO,+Blanche+Morneg+N53,+Ben+Arous+2063,+Tunisie&ll=36.7340435,10.2493619&z=17&output=embed"
  className="absolute inset-0 w-full h-full"
  loading="lazy"
  allowFullScreen
/>
            </div>
            <div className="absolute -bottom-4 -right-4 bg-white text-blue-900 px-5 py-4 shadow-2xl rounded-sm border border-blue-100 hidden sm:block">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-blue-600 mb-1">
                <Building2 className="w-3.5 h-3.5" />  POINT DE VENTE
              </div>
              <div className="font-display font-black text-lg leading-tight">BENNOURI Ben Arous</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function InfoLine({ Icon, label, children }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 bg-blue-50 rounded-sm flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-blue-600" />
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500 mb-0.5">{label}</div>
        <div className="text-sm text-slate-700">{children}</div>
      </div>
    </div>
  );
}