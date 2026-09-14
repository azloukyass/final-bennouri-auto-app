import { useEffect, useState } from "react";

export default function SplashScreen({ onDone, duration = 4500 }) {
  const [stage, setStage] = useState("enter"); // enter → hold → exit
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setStage("hold"), 60);
    const t2 = setTimeout(() => setStage("exit"), duration - 600);
    const t3 = setTimeout(() => onDone && onDone(), duration);

    // Progress bar
    const startedAt = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setProgress(Math.min(100, (elapsed / (duration - 400)) * 100));
    }, 50);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearInterval(interval);
    };
  }, [duration, onDone]);

  return (
    <div
      data-testid="splash-screen"
      className={`fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden transition-opacity duration-500 ${
        stage === "exit" ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{
        background:
          "radial-gradient(ellipse at center, #1e3a5f 0%, #0f1f38 45%, #050b18 100%)",
      }}
    >
      {/* Subtle animated grid */}
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Rotating gear glow behind logo */}
      <div className="absolute w-[640px] h-[640px] rounded-full blur-3xl opacity-30 bg-blue-500/40 splash-pulse" />

      {/* Decorative motion lines (left + right) */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 hidden sm:block">
        <div className="w-32 h-px bg-gradient-to-r from-transparent to-blue-400/60 mb-3 splash-line-l" style={{ animationDelay: "0.2s" }} />
        <div className="w-20 h-px bg-gradient-to-r from-transparent to-blue-400/40 mb-3 splash-line-l" style={{ animationDelay: "0.4s" }} />
        <div className="w-40 h-px bg-gradient-to-r from-transparent to-blue-400/50 splash-line-l" style={{ animationDelay: "0.6s" }} />
      </div>
      <div className="absolute right-0 top-1/2 -translate-y-1/2 hidden sm:block">
        <div className="w-32 h-px bg-gradient-to-l from-transparent to-red-500/50 mb-3 splash-line-r" style={{ animationDelay: "0.3s" }} />
        <div className="w-20 h-px bg-gradient-to-l from-transparent to-red-500/40 mb-3 splash-line-r" style={{ animationDelay: "0.5s" }} />
        <div className="w-40 h-px bg-gradient-to-l from-transparent to-red-500/30 splash-line-r" style={{ animationDelay: "0.7s" }} />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center px-6 max-w-2xl">
        {/* Logo */}
        <div
          className={`splash-logo-wrap mb-8 transition-all duration-700 ${
            stage === "enter" ? "scale-90 opacity-0" : "scale-100 opacity-100"
          }`}
        >
          <div className="relative">
            {/* Glow ring */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-500/30 via-blue-400/10 to-red-500/20 blur-2xl scale-110 splash-pulse-slow" />
      <img
  src="/bennouri-logo.jpeg"
  alt="BENNOURI Pièces Auto"
  className="relative w-56 h-56 sm:w-72 sm:h-72 object-cover rounded-2xl shadow-2xl shadow-blue-900/50 ring-1 ring-white/10"
  style={{
    WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 20%, black 100%)",
    maskImage: "linear-gradient(to right, transparent 0%, black 20%, black 100%)",
    WebkitMaskSize: "100% 100%",
    maskSize: "100% 100%",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
  }}
  draggable={false}
/>
          </div>
        </div>

        {/* Welcome text */}
        <div
          className={`text-center transition-all duration-700 delay-300 ${
            stage === "enter" ? "translate-y-4 opacity-0" : "translate-y-0 opacity-100"
          }`}
        >
          <div className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.4em] text-blue-300/80 mb-3" data-testid="splash-eyebrow">
            Bienvenue
          </div>
          <h1 className="font-display text-2xl sm:text-4xl font-bold text-white mb-3 tracking-tight" data-testid="splash-title">
            Welcome to <span className="text-white">BENNOURI</span> Auto Pièces
          </h1>
          <p className="text-sm sm:text-base text-blue-100/70 italic" data-testid="splash-subtitle">
            Votre boutique de pièces automobiles d'origine
          </p>
        </div>

        {/* Spinner + progress */}
        <div
          className={`mt-12 flex flex-col items-center transition-opacity duration-500 delay-500 ${
            stage === "enter" ? "opacity-0" : "opacity-100"
          }`}
        >
          {/* Dual-ring spinner */}
          <div className="relative w-12 h-12 mb-5">
            <div className="absolute inset-0 rounded-full border-2 border-white/10" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-red-500 border-r-red-500/60 splash-spin" />
            <div
              className="absolute inset-2 rounded-full border-2 border-transparent border-b-blue-300 border-l-blue-300/60 splash-spin-reverse"
            />
          </div>

          {/* Progress bar */}
          <div className="w-48 sm:w-64 h-[3px] bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-400 via-blue-300 to-red-500 rounded-full transition-all duration-100 ease-out"
              style={{ width: `${progress}%` }}
              data-testid="splash-progress"
            />
          </div>
          <div className="mt-3 text-[10px] uppercase tracking-[0.3em] text-white/40 font-mono">
            Chargement…
          </div>
        </div>
      </div>

      {/* Bottom signature */}
      <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center text-center text-[10px] uppercase tracking-[0.3em] text-white/30">
        <span>Pièces d'origine · Tunis</span>
      </div>

      <style>{`
        @keyframes splashPulse {
          0%, 100% { opacity: 0.18; transform: scale(1); }
          50% { opacity: 0.32; transform: scale(1.06); }
        }
        @keyframes splashPulseSlow {
          0%, 100% { opacity: 0.4; transform: scale(1.05); }
          50% { opacity: 0.7; transform: scale(1.15); }
        }
        @keyframes splashSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes splashSpinReverse {
          to { transform: rotate(-360deg); }
        }
        @keyframes splashLineL {
          0% { transform: translateX(-100%); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes splashLineR {
          0% { transform: translateX(100%); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateX(0); opacity: 1; }
        }
        .splash-pulse { animation: splashPulse 3s ease-in-out infinite; }
        .splash-pulse-slow { animation: splashPulseSlow 4s ease-in-out infinite; }
        .splash-spin { animation: splashSpin 1.2s linear infinite; }
        .splash-spin-reverse { animation: splashSpinReverse 1.6s linear infinite; }
        .splash-line-l { animation: splashLineL 1s ease-out both; }
        .splash-line-r { animation: splashLineR 1s ease-out both; }
        .splash-logo-wrap { will-change: transform, opacity; }
      `}</style>
    </div>
  );
}
