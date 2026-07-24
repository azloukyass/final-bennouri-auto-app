/**
 * Realistic product silhouettes for auto parts.
 * Reliable, brand-safe and visually consistent — render as inline SVG.
 */

export const OilBottle = ({ className = "" }) => (
  <svg viewBox="0 0 200 200" className={className} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="oil-body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#FCD34D" />
        <stop offset="1" stopColor="#D97706" />
      </linearGradient>
    </defs>
    {/* Cap */}
    <rect x="80" y="20" width="40" height="20" rx="3" fill="#1E293B" />
    <rect x="83" y="38" width="34" height="6" fill="#0F172A" />
    {/* Neck */}
    <rect x="88" y="44" width="24" height="14" fill="#334155" />
    {/* Body */}
    <path d="M 60 60 L 140 60 L 145 70 L 145 175 Q 145 185 135 185 L 65 185 Q 55 185 55 175 L 55 70 Z" fill="url(#oil-body)" stroke="#92400E" strokeWidth="2" />
    {/* Label */}
    <rect x="65" y="90" width="70" height="60" fill="white" fillOpacity="0.9" rx="2" />
    <text x="100" y="115" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#1E293B" fontFamily="sans-serif">SHELL</text>
    <text x="100" y="135" textAnchor="middle" fontSize="10" fill="#475569" fontFamily="sans-serif">HELIX</text>
    <rect x="65" y="155" width="70" height="14" fill="#DC2626" rx="1" />
    <text x="100" y="166" textAnchor="middle" fontSize="9" fontWeight="bold" fill="white" fontFamily="monospace">5W-30</text>
  </svg>
);

export const BrakeDisc = ({ className = "" }) => (
  <svg viewBox="0 0 200 200" className={className} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="disc-grad">
        <stop offset="0.7" stopColor="#94A3B8" />
        <stop offset="0.85" stopColor="#475569" />
        <stop offset="1" stopColor="#1E293B" />
      </radialGradient>
    </defs>
    {/* Outer disc */}
    <circle cx="100" cy="100" r="85" fill="url(#disc-grad)" />
    {/* Drilled holes pattern */}
    {Array.from({ length: 12 }).map((_, i) => {
      const angle = (i * 30 * Math.PI) / 180;
      const cx = 100 + Math.cos(angle) * 62;
      const cy = 100 + Math.sin(angle) * 62;
      return <circle key={i} cx={cx} cy={cy} r="5" fill="#0F172A" />;
    })}
    {/* Caliper red top */}
    <path d="M 50 50 Q 50 30 70 30 L 130 30 Q 150 30 150 50 L 150 80 L 50 80 Z" fill="#DC2626" />
    <rect x="50" y="78" width="100" height="8" fill="#991B1B" />
    <text x="100" y="60" textAnchor="middle" fontSize="14" fontWeight="bold" fill="white" fontFamily="sans-serif" letterSpacing="2">BREMBO</text>
    {/* Center hub */}
    <circle cx="100" cy="100" r="32" fill="#1E293B" />
    <circle cx="100" cy="100" r="8" fill="#94A3B8" />
  </svg>
);

export const CarBattery = ({ className = "" }) => (
  <svg viewBox="0 0 200 200" className={className} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bat-body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#1E293B" />
        <stop offset="1" stopColor="#0F172A" />
      </linearGradient>
    </defs>
    {/* Body */}
    <rect x="30" y="55" width="140" height="120" rx="4" fill="url(#bat-body)" stroke="#0F172A" strokeWidth="2" />
    {/* Top cover */}
    <rect x="30" y="55" width="140" height="22" fill="#334155" />
    {/* Terminals */}
    <rect x="48" y="40" width="22" height="20" fill="#94A3B8" stroke="#475569" strokeWidth="1.5" rx="2" />
    <rect x="130" y="40" width="22" height="20" fill="#475569" stroke="#1E293B" strokeWidth="1.5" rx="2" />
    <text x="59" y="56" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#DC2626">+</text>
    <text x="141" y="56" textAnchor="middle" fontSize="14" fontWeight="bold" fill="white">−</text>
    {/* Label */}
    <rect x="40" y="90" width="120" height="60" fill="white" rx="3" />
    <text x="100" y="110" textAnchor="middle" fontSize="16" fontWeight="900" fill="#DC2626" fontFamily="sans-serif">BOSCH</text>
    <text x="100" y="128" textAnchor="middle" fontSize="11" fill="#1E293B" fontFamily="sans-serif">S5 · 70Ah</text>
    <text x="100" y="145" textAnchor="middle" fontSize="9" fill="#64748B" fontFamily="monospace">12V · 760A</text>
    {/* Vents */}
    {[55, 80, 105, 130].map((x, i) => (
      <circle key={i} cx={x + 8} cy="66" r="2" fill="#0F172A" />
    ))}
  </svg>
);

export const OilFilter = ({ className = "" }) => (
  <svg viewBox="0 0 200 200" className={className} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="filter-body" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#1E40AF" />
        <stop offset="0.5" stopColor="#3B82F6" />
        <stop offset="1" stopColor="#1E40AF" />
      </linearGradient>
    </defs>
    {/* Top cap */}
    <ellipse cx="100" cy="35" rx="46" ry="8" fill="#1E293B" />
    <rect x="54" y="35" width="92" height="10" fill="#334155" />
    {/* Body */}
    <rect x="54" y="45" width="92" height="120" fill="url(#filter-body)" />
    {/* Pleats */}
    {[60, 70, 80, 90, 100, 110, 120, 130, 140].map((x) => (
      <line key={x} x1={x} y1="45" x2={x} y2="165" stroke="#1E3A8A" strokeWidth="0.5" opacity="0.4" />
    ))}
    {/* Bottom cap */}
    <ellipse cx="100" cy="165" rx="46" ry="8" fill="#1E293B" />
    {/* Label */}
    <rect x="60" y="85" width="80" height="40" fill="white" rx="2" />
    <text x="100" y="103" textAnchor="middle" fontSize="13" fontWeight="900" fill="#DC2626" fontFamily="sans-serif">BOSCH</text>
    <text x="100" y="118" textAnchor="middle" fontSize="9" fill="#1E293B" fontFamily="sans-serif">FILTRE À HUILE</text>
  </svg>
);

export const ShockAbsorber = ({ className = "" }) => (
  <svg viewBox="0 0 200 200" className={className} xmlns="http://www.w3.org/2000/svg">
    {/* Top mount */}
    <circle cx="100" cy="22" r="12" fill="#475569" stroke="#1E293B" strokeWidth="2" />
    <circle cx="100" cy="22" r="5" fill="#0F172A" />
    {/* Upper shaft */}
    <rect x="92" y="30" width="16" height="40" fill="#94A3B8" />
    {/* Spring (top) */}
    <g fill="none" stroke="#1E293B" strokeWidth="3">
      {[60, 75, 90].map((y) => (
        <ellipse key={y} cx="100" cy={y} rx="32" ry="6" />
      ))}
    </g>
    {/* Main body */}
    <rect x="78" y="100" width="44" height="60" fill="#1E293B" rx="3" />
    {/* Yellow KYB label */}
    <rect x="80" y="115" width="40" height="22" fill="#FBBF24" />
    <text x="100" y="131" textAnchor="middle" fontSize="13" fontWeight="900" fill="#1E293B" fontFamily="sans-serif">KYB</text>
    {/* Spring (bottom) */}
    <g fill="none" stroke="#1E293B" strokeWidth="3">
      {[110, 125, 140, 155].map((y) => (
        <ellipse key={y} cx="100" cy={y} rx="32" ry="5" />
      ))}
    </g>
    {/* Lower mount */}
    <rect x="92" y="160" width="16" height="20" fill="#94A3B8" />
    <circle cx="100" cy="184" r="10" fill="#475569" stroke="#1E293B" strokeWidth="2" />
    <circle cx="100" cy="184" r="4" fill="#0F172A" />
  </svg>
);

export const SparkPlug = ({ className = "" }) => (
  <svg viewBox="0 0 200 200" className={className} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="plug-cap" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#94A3B8" />
        <stop offset="1" stopColor="#475569" />
      </linearGradient>
    </defs>
    {/* Top terminal */}
    <rect x="92" y="14" width="16" height="14" fill="#1E293B" />
    {/* Insulator (porcelain) */}
    <path d="M 80 28 L 120 28 L 122 90 L 110 100 L 90 100 L 78 90 Z" fill="#F1F5F9" stroke="#94A3B8" strokeWidth="1.5" />
    <rect x="85" y="40" width="30" height="3" fill="#94A3B8" />
    <rect x="85" y="50" width="30" height="3" fill="#94A3B8" />
    {/* NGK red band */}
    <rect x="80" y="58" width="40" height="10" fill="#DC2626" />
    <text x="100" y="67" textAnchor="middle" fontSize="9" fontWeight="900" fill="white" fontFamily="sans-serif">NGK</text>
    {/* Hex nut */}
    <polygon points="78,100 122,100 130,118 122,136 78,136 70,118" fill="url(#plug-cap)" stroke="#1E293B" strokeWidth="1.5" />
    {/* Thread */}
    <rect x="88" y="136" width="24" height="40" fill="#CBD5E1" />
    {[140, 148, 156, 164, 172].map((y) => (
      <line key={y} x1="88" y1={y} x2="112" y2={y - 2} stroke="#475569" strokeWidth="1" />
    ))}
    {/* Tip electrode */}
    <rect x="96" y="176" width="8" height="10" fill="#475569" />
    <line x1="100" y1="186" x2="100" y2="194" stroke="#94A3B8" strokeWidth="3" />
    <line x1="92" y1="194" x2="108" y2="194" stroke="#475569" strokeWidth="3" />
  </svg>
);

export const Engine = ({ className = "" }) => (
  <svg viewBox="0 0 200 200" className={className} xmlns="http://www.w3.org/2000/svg">
    {/* Engine block */}
    <rect x="35" y="60" width="130" height="100" fill="#334155" stroke="#1E293B" strokeWidth="2" rx="4" />
    {/* Top valve cover */}
    <rect x="40" y="45" width="120" height="20" fill="#DC2626" rx="2" />
    {/* Bolts on valve cover */}
    {[55, 80, 105, 130, 150].map((x) => (
      <circle key={x} cx={x} cy="55" r="3" fill="#1E293B" />
    ))}
    {/* Cylinder caps */}
    {[60, 100, 140].map((x) => (
      <g key={x}>
        <circle cx={x} cy="80" r="14" fill="#475569" stroke="#0F172A" strokeWidth="1.5" />
        <circle cx={x} cy="80" r="6" fill="#1E293B" />
      </g>
    ))}
    {/* Hoses */}
    <path d="M 20 90 Q 30 90 35 100" fill="none" stroke="#0F172A" strokeWidth="6" strokeLinecap="round" />
    <path d="M 180 110 Q 170 110 165 120" fill="none" stroke="#0F172A" strokeWidth="6" strokeLinecap="round" />
    {/* Brand text */}
    <text x="100" y="135" textAnchor="middle" fontSize="14" fontWeight="900" fill="#F1F5F9" fontFamily="sans-serif" letterSpacing="2">OEM</text>
    <text x="100" y="150" textAnchor="middle" fontSize="9" fill="#94A3B8" fontFamily="sans-serif">RENAULT 1.5 dCi</text>
  </svg>
);


export const Categories = {
  moteur: Engine,
  huiles: OilBottle,
  freinage: BrakeDisc,
  batterie: CarBattery,
  filter: OilFilter,
  shock: ShockAbsorber,
  spark: SparkPlug,
};

export default function ProductIcon({ kind = "moteur", className = "" }) {
  const Comp = Categories[kind] || Engine;
  return <Comp className={className} />;
}
