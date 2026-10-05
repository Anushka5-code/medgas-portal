/**
 * PressureGauge — horizontal bar gauge.
 * Works for both PSI (0–150 range, safe 40–100) and % purity (85–100, safe 93–99).
 */
export function PressureGauge({ value, min, max, safeMin, safeMax, unit = 'PSI', color }) {
  if (value == null || isNaN(value)) return (
    <div className="h-3 rounded-full bg-slate-100 flex items-center justify-center">
      <span className="text-[9px] text-[#8A94A6]">—</span>
    </div>
  );

  const pct      = Math.min(Math.max((value - min) / (max - min) * 100, 0), 100);
  const safeLPct = ((safeMin - min) / (max - min)) * 100;
  const safeRPct = ((safeMax - min) / (max - min)) * 100;

  const isAbove = value > safeMax;
  const isBelow = value < safeMin;
  const barColor = isAbove ? '#F0386B' : isBelow ? '#F59E0B' : (color || '#22C55E');

  return (
    <div>
      <div className="relative h-3 rounded-full bg-slate-100 overflow-visible">
        {/* Safe zone highlight */}
        <div className="absolute top-0 h-full rounded-full opacity-20"
          style={{ left: `${safeLPct}%`, width: `${safeRPct - safeLPct}%`, background: '#22C55E' }}/>
        {/* Value bar */}
        <div className="absolute top-0 left-0 h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: barColor }}/>
        {/* Marker dot */}
        <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow-sm transition-all duration-500"
          style={{ left: `calc(${pct}% - 6px)`, background: barColor }}/>
      </div>
      <div className="flex justify-between text-[9px] mt-0.5" style={{ color:'#8A94A6' }}>
        <span>{min}</span>
        <span style={{ color:'#22C55E' }}>{safeMin}–{safeMax}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}
