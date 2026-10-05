/**
 * LoginIllustration.jsx
 * =====================
 * Left-panel branding + inline SVG illustration + feature chips.
 * No external images.
 */
import { Activity, Bell, ShieldCheck } from 'lucide-react';

const CHIPS = [
  { Icon: Activity,    label: 'Live pressure monitoring' },
  { Icon: Bell,        label: 'Instant alerts' },
  { Icon: ShieldCheck, label: 'Role-based access' },
];

export function LoginIllustration() {
  return (
    <div
      className="hidden lg:flex flex-col justify-between h-full p-10 rounded-l-3xl relative overflow-hidden"
      style={{
        background: 'linear-gradient(145deg, #1E2A4A 0%, #2F4A8A 55%, #2F80ED 100%)',
      }}
    >
      {/* Decorative blobs */}
      <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, #4FC3F7, transparent)' }} />
      <div className="absolute -bottom-16 -right-16 w-56 h-56 rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, #F0386B, transparent)' }} />

      {/* Logo */}
      <div className="flex items-center gap-3 relative z-10">
        <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center shadow">
          <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
            <rect x="9" y="5" width="6" height="14" rx="3" fill="white" opacity="0.9"/>
            <rect x="10" y="3" width="4" height="3" rx="1" fill="white" opacity="0.7"/>
            <path d="M12 18s-5-3.5-5-7a3 3 0 0 1 5-2.24A3 3 0 0 1 17 11c0 3.5-5 7-5 7z"
              fill="#F0386B" opacity="0.9"/>
          </svg>
        </div>
        <div className="leading-none">
          <span className="text-white font-bold text-xl tracking-tight">MEDI</span>
          <span className="text-[#4FC3F7] font-bold text-xl tracking-tight">GAS</span>
          <p className="text-white/50 text-[11px] mt-0.5 font-medium">Monitor</p>
        </div>
      </div>

      {/* Headline */}
      <div className="relative z-10 my-6">
        <h1 className="text-3xl font-bold text-white leading-snug">
          Safer Gas Supply.<br />Faster Response.
        </h1>
        <p className="text-white/60 text-sm mt-3 leading-relaxed max-w-xs">
          Real-time medical gas pipeline monitoring for hospital teams. Every reading, every alert, every action — tracked.
        </p>
      </div>

      {/* SVG Illustration */}
      <div className="relative z-10 flex-1 flex items-center justify-center py-4">
        <svg viewBox="0 0 340 240" fill="none" xmlns="http://www.w3.org/2000/svg"
          className="w-full max-w-xs opacity-90">

          {/* Hospital building */}
          <rect x="110" y="80" width="120" height="140" rx="4" fill="white" opacity="0.08"/>
          <rect x="120" y="90" width="100" height="130" rx="3" fill="white" opacity="0.06"/>
          {/* Windows */}
          {[0,1,2].map(col => [0,1,2].map(row => (
            <rect key={`${col}-${row}`}
              x={130 + col*28} y={100 + row*28}
              width="18" height="16" rx="2"
              fill="white" opacity="0.15"/>
          )))}
          {/* Door */}
          <rect x="155" y="185" width="30" height="35" rx="3" fill="white" opacity="0.2"/>
          {/* Cross */}
          <rect x="165" y="100" width="10" height="3" rx="1.5" fill="#4FC3F7" opacity="0.8"/>
          <rect x="168.5" y="96.5" width="3" height="10" rx="1.5" fill="#4FC3F7" opacity="0.8"/>

          {/* Pipeline */}
          <rect x="30" y="168" width="280" height="8" rx="4" fill="white" opacity="0.12"/>
          <circle cx="80"  cy="172" r="7" fill="white" opacity="0.2"/>
          <circle cx="140" cy="172" r="7" fill="white" opacity="0.2"/>
          <circle cx="200" cy="172" r="7" fill="white" opacity="0.2"/>
          <circle cx="260" cy="172" r="7" fill="white" opacity="0.2"/>

          {/* Gas Cylinder 1 — Pressure */}
          <rect x="38" y="100" width="30" height="60" rx="12" fill="#4FC3F7" opacity="0.25"/>
          <rect x="42" y="105" width="22" height="50" rx="10" fill="#4FC3F7" opacity="0.3"/>
          <rect x="48" y="94"  width="10" height="12" rx="4" fill="#4FC3F7" opacity="0.5"/>
          <text x="53" y="133" textAnchor="middle" fontSize="9" fill="white" opacity="0.8"
            fontFamily="Poppins,sans-serif" fontWeight="700">PSI</text>

          {/* Gas Cylinder 2 — O2 */}
          <rect x="272" y="104" width="28" height="58" rx="12" fill="#22C55E" opacity="0.25"/>
          <rect x="276" y="109" width="20" height="48" rx="10" fill="#22C55E" opacity="0.3"/>
          <rect x="281" y="98"  width="10" height="12" rx="4" fill="#22C55E" opacity="0.5"/>
          <text x="286" y="136" textAnchor="middle" fontSize="9" fill="white" opacity="0.8"
            fontFamily="Poppins,sans-serif" fontWeight="700">O₂</text>

          {/* Pressure Gauge */}
          <circle cx="80" cy="138" r="26" fill="white" opacity="0.1" stroke="white" strokeWidth="1.5" strokeOpacity="0.2"/>
          <circle cx="80" cy="138" r="20" fill="white" opacity="0.07"/>
          {[0,45,90,135,180,225,270].map((deg, i) => {
            const rad = (deg - 90) * Math.PI / 180;
            return <line key={i}
              x1={80 + 14 * Math.cos(rad)} y1={138 + 14 * Math.sin(rad)}
              x2={80 + 18 * Math.cos(rad)} y2={138 + 18 * Math.sin(rad)}
              stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.4"/>;
          })}
          <line x1="80" y1="138" x2="80" y2="122"
            stroke="#4FC3F7" strokeWidth="2.5" strokeLinecap="round"/>
          <circle cx="80" cy="138" r="3.5" fill="#4FC3F7"/>
          <text x="80" y="151" textAnchor="middle" fontSize="7" fill="white" opacity="0.5"
            fontFamily="Poppins,sans-serif">PSI</text>

          {/* O2 Gauge */}
          <circle cx="260" cy="140" r="20" fill="white" opacity="0.1" stroke="white" strokeWidth="1.5" strokeOpacity="0.2"/>
          <circle cx="260" cy="140" r="14" fill="white" opacity="0.07"/>
          <line x1="260" y1="140" x2="260" y2="128"
            stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round"/>
          <circle cx="260" cy="140" r="3" fill="#22C55E"/>
          <text x="260" y="152" textAnchor="middle" fontSize="7" fill="white" opacity="0.5"
            fontFamily="Poppins,sans-serif">O₂%</text>

          {/* Live ping dots on pipeline */}
          {[80, 140, 200, 260].map((cx, i) => (
            <circle key={i} cx={cx} cy="172" r="3" fill="#4FC3F7" opacity="0.7"/>
          ))}

          {/* Alert badge */}
          <circle cx="200" cy="105" r="14" fill="#F0386B" opacity="0.85"/>
          <text x="200" y="110" textAnchor="middle" fontSize="14" fill="white"
            fontFamily="Poppins,sans-serif" fontWeight="700">!</text>
        </svg>
      </div>

      {/* Feature chips */}
      <div className="relative z-10 flex flex-col gap-2 mt-2">
        {CHIPS.map(({ Icon, label }) => (
          <div key={label}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(79,195,247,0.25)' }}>
              <Icon size={14} color="#4FC3F7" strokeWidth={2} />
            </div>
            <span className="text-sm text-white/80 font-medium">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
