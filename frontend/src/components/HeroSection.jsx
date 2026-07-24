import { useState, useEffect } from "react";
import { Hash, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";

// Deine eigenen Bilder hier eintragen (Reihenfolge = Reihenfolge im Slider)
const ALBUM_IMAGES = [
  "/huile-silder.jpg",
  "/engine-person-silder.jpg",
  "/new_logo.jpeg",
  "/huile-silder.jpg",
  "/album-5.jpg",
];

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
<div className="absolute right-0 top-0 bottom-0 z-0 w-full sm:w-[80%] lg:w-[65%] flex items-center justify-center">
  <div className="relative w-full h-full rounded-sm overflow-hidden bg-zinc-900/40">
        {ALBUM_IMAGES.map((src, i) => (
          <img
            key={src}
            src={src}
            alt=""
            className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-1000 ease-in-out ${
              i === active ? "opacity-100" : "opacity-0"
            }`}
            onError={(e) => { e.target.style.display = "none"; }}
          />
        ))}
      </div>

      {/* Dark overlay for text legibility on the left edge */}
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/30 to-transparent pointer-events-none" />

   

      {/* Dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2" data-testid="hero-slider-dots">
        {ALBUM_IMAGES.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActive(i)}
            aria-label={`Aller à l'image ${i + 1}`}
            className={`rounded-full transition-all ${
              i === active ? "w-6 h-2.5 bg-red-600" : "w-2.5 h-2.5 bg-white/50 hover:bg-white/80"
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

  return (
    <section className="relative overflow-hidden bg-black min-h-[640px] lg:min-h-[680px] flex items-center" data-testid="hero-section">
      <HeroSlider active={active} setActive={setActive} />

      <div className="relative z-10 w-full pl-[70px] pr-[40px] py-14 lg:py-20">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.4em] text-red-500 mb-4">
            <span className="w-6 h-px bg-red-500"></span> Pièces auto en Tunisie
          </div>
          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-black leading-[0.95] tracking-tight text-white">
            PIÈCES AUTO<br />
            <span className="text-red-600">ORIGINALES</span>
          </h1>
          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white font-semibold">
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-red-500" /> Qualité garantie</span>
            <span className="text-white/40">|</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-red-500" /> Meilleurs prix</span>
            <span className="text-white/40">|</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-red-500" /> Livraison rapide</span>
          </div>

          <form onSubmit={handleVin} className="mt-8 max-w-xl" data-testid="hero-vin-form">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-red-500 mb-3">
              <span className="w-4 h-px bg-red-500"></span>
              <Hash className="w-3 h-3" />
              Trouvez vos pièces par VIN
            </div>
            <div className="group flex items-stretch bg-white rounded-sm overflow-hidden shadow-2xl shadow-red-900/40 ring-1 ring-white/10 focus-within:ring-2 focus-within:ring-red-500 transition-all">
              <div className="flex items-center pl-4 pr-2 text-black/30 border-r border-zinc-100">
                <Hash className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={vin}
                onChange={(e) => setVin(e.target.value.toUpperCase())}
                placeholder="VF15R0K0H48649991"
                maxLength={17}
                className="flex-1 px-3 py-3 text-sm font-mono tracking-wider text-black focus:outline-none placeholder:text-black/25"
                data-testid="hero-vin-input"
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-red-600 hover:bg-red-700 disabled:bg-red-400 px-6 text-white text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-2 group-focus-within:bg-red-700"
                data-testid="hero-vin-submit"
              >
                {loading ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Recherche
                  </>
                ) : (
                  "Rechercher"
                )}
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="text-white/60">17 caractères en général · <span className="text-red-400 font-semibold">{vin.length}/17</span></span>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}