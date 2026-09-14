import { useState, useEffect } from "react";
import { Hash, CheckCircle2, ChevronLeft, ChevronRight, X } from "lucide-react";

// Deine eigenen Bilder hier eintragen (Reihenfolge = Reihenfolge im Slider)
const ALBUM_IMAGES = [
  "/digram1.png",
  "/digram2.png",
  "/digram3.png",
];

const VIN_STORAGE_KEY = "bennouri:lastVin";

const readLastVin = () => {
  try {
    return sessionStorage.getItem(VIN_STORAGE_KEY) || "";
  } catch {
    return "";
  }
};

const saveLastVin = (v) => {
  try {
    sessionStorage.setItem(VIN_STORAGE_KEY, v);
  } catch {
    // sessionStorage unavailable (private mode etc.) — fail silently
  }
};

function HeroSlider({ active, setActive }) {
  useEffect(() => {
    const interval = setInterval(() => {
      setActive((prev) => (prev + 1) % ALBUM_IMAGES.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [setActive]);

  const goPrev = () =>
    setActive((prev) => (prev - 1 + ALBUM_IMAGES.length) % ALBUM_IMAGES.length);
  const goNext = () =>
    setActive((prev) => (prev + 1) % ALBUM_IMAGES.length);

  return (
    // Nur ab md sichtbar: auf Handys würde dieses absolut positionierte Bild
    // die gesamte Hero-Sektion hinter dem Text füllen (w-full) und ohne das
    // separate Weiß-Overlay den Text unlesbar machen. Ab md ist genug Platz
    // für das Split-Layout (Text links, Bild rechts).
    <div className="hidden md:flex absolute right-0 top-0 bottom-0 z-0 md:w-[70%] lg:w-[65%] items-center justify-center">
      <div className="relative w-full h-full rounded-sm overflow-hidden bg-blue-900/10">
        {ALBUM_IMAGES.map((src, i) => (
          <img
            key={src}
            src={src}
            alt=""
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${
              i === active ? "opacity-80" : "opacity-0"
            }`}
            onError={(e) => { e.target.style.display = "none"; }}
          />
        ))}
        {/* Weißer Verlauf am linken Rand — lässt das Bild sanft ins weiße
            Hero-Hintergrund übergehen, statt hart abzuschneiden (leichte
            Transparenz-Optik wie zuvor). */}
        <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-white via-white/50 to-transparent pointer-events-none z-10" />
      </div>

      {/* Dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2" data-testid="hero-slider-dots">
        {ALBUM_IMAGES.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActive(i)}
            aria-label={`Aller à l'image ${i + 1}`}
            className={`rounded-full transition-all ${
              i === active ? "w-6 h-2.5 bg-blue-900" : "w-2.5 h-2.5 bg-blue-900/30 hover:bg-blue-900/60"
            }`}
            data-testid={`hero-slider-dot-${i}`}
          />
        ))}
      </div>
    </div>
  );
}

export default function Hero({ vin, setVin, loading, handleVin }) {
  const [active, setActive] = useState(0);
  const [vinHelpOpen, setVinHelpOpen] = useState(false);

  const handleFormSubmit = (e) => {
    const v = vin.trim();
    if (v) saveLastVin(v);
    handleVin(e);
  };

  const handleVinFocus = () => {
    if (vin) return; // user already has something typed — don't overwrite
    const last = readLastVin();
    if (last) setVin(last);
  };

  return (
    <section
      className="relative overflow-hidden bg-white min-h-0 sm:min-h-[560px] md:min-h-[640px] lg:min-h-[680px] flex items-center"
      data-testid="hero-section"
    >
      <HeroSlider active={active} setActive={setActive} />

      <div className="relative z-10 w-full px-5 sm:px-8 md:px-10 lg:pl-[70px] lg:pr-[40px] py-10 sm:py-14 lg:py-20">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] sm:tracking-[0.4em] text-blue-600 mb-3 sm:mb-4">
            <span className="w-6 h-px bg-blue-600"></span> Pièces auto en Tunisie
          </div>
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-black leading-[1] sm:leading-[0.95] tracking-tight text-blue-900">
            PIÈCES AUTO<br />
            <span className="text-blue-600">ORIGINALES</span>
          </h1>
          <div className="mt-4 sm:mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-blue-900 font-semibold">
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" /> Qualité garantie</span>
            <span className="text-blue-900/30 hidden sm:inline">|</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" /> Meilleurs prix</span>
            <span className="text-blue-900/30 hidden sm:inline">|</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" /> Livraison rapide</span>
          </div>

          <form onSubmit={handleFormSubmit} className="mt-6 sm:mt-8 max-w-xl" data-testid="hero-vin-form">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] text-blue-900 mb-2.5 sm:mb-3">
              <span className="w-4 h-px bg-blue-900"></span>
              <Hash className="w-3 h-3" />
              Trouvez vos pièces par VIN
            </div>
            <div className="group flex items-stretch bg-white rounded-sm overflow-hidden shadow-2xl shadow-blue-900/20 ring-1 ring-blue-900/10 focus-within:ring-2 focus-within:ring-blue-400 transition-all">
              <div className="hidden sm:flex items-center pl-4 pr-2 text-black/30 border-r border-zinc-100">
                <Hash className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={vin}
                onChange={(e) => setVin(e.target.value.toUpperCase())}
                onFocus={handleVinFocus}
                placeholder="VF15R0K0H48649991"
                maxLength={17}
                className="flex-1 min-w-0 px-3 py-3 text-sm font-mono tracking-wider text-black focus:outline-none placeholder:text-black/25"
                data-testid="hero-vin-input"
              />
              <button
                type="submit"
                disabled={loading}
                className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 px-4 sm:px-6 text-white text-[11px] sm:text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-2 group-focus-within:bg-blue-700"
                data-testid="hero-vin-submit"
              >
                {loading ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span className="hidden sm:inline">Recherche</span>
                  </>
                ) : (
                  <>
                    <span className="sm:hidden">OK</span>
                    <span className="hidden sm:inline">Rechercher</span>
                  </>
                )}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px]">
              <span className="text-blue-900/60">17 caractères en général · <span className="text-blue-600 font-semibold">{vin.length}/17</span></span>
              <button
                type="button"
                className="text-blue-600 hover:text-blue-800 font-semibold underline underline-offset-2 transition-colors"
                onClick={() => setVinHelpOpen(true)}
                data-testid="vin-help-trigger"
              >
                Où trouver le VIN ?
              </button>
            </div>
          </form>
        </div>
      </div>

      {vinHelpOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-blue-950/70 px-4"
          onClick={() => setVinHelpOpen(false)}
        >
          <div
            className="bg-white text-black rounded-md w-full max-w-md max-h-[80vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-zinc-200 flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Aide</div>
                <h3 className="font-black text-lg uppercase leading-tight text-blue-900">
                  Où trouver mon numéro VIN ?
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Le VIN (Vehicle Identification Number) est le numéro de châssis unique à 17 caractères de votre véhicule.
                </p>
              </div>
              <button
                onClick={() => setVinHelpOpen(false)}
                className="text-blue-900/60 hover:text-blue-900 flex-shrink-0"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 text-sm text-zinc-700 space-y-4">
              <div>
                <div className="font-bold text-blue-700 mb-1">Carte grise (certificat d'immatriculation)</div>
                 <img
                src="/vin-emplacement.jpeg"
                alt="Emplacement du numéro VIN sur le véhicule"
                className="w-full h-auto rounded-sm border border-zinc-200 mt-2"
              />
              </div>
              <div>
                <div className="font-bold text-blue-700 mb-1">Pare-brise</div>
                <p>En bas du pare-brise, côté conducteur, visible depuis l'extérieur du véhicule.</p>
              </div>
              <div>
                <div className="font-bold text-blue-700 mb-1">Portière conducteur</div>
                <p>Ouvrez la portière : le VIN est souvent gravé sur une plaque métallique fixée au montant ou au seuil de la porte.</p>
              </div>
              <div>
                <div className="font-bold text-blue-700 mb-1">Sous le capot</div>
                <p>Gravé directement sur le châssis, généralement près du bloc moteur ou du radiateur.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
