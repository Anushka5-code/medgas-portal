import { useRef, useEffect, useState } from 'react';
import { Wind, Droplets } from 'lucide-react';
import { StatusPill } from '../ui/StatusPill';
import { Sparkline }  from '../charts/Sparkline';

const PALETTE = [
  { header: '#2F80ED', text: '#fff', sparkP: '#93C5FD', sparkO: '#BBF7D0' },
  { header: '#0D9488', text: '#fff', sparkP: '#99F6E4', sparkO: '#FCD34D' },
  { header: '#F59E0B', text: '#1E2A4A', sparkP: '#FCD34D', sparkO: '#93C5FD' },
  { header: '#1E2A4A', text: '#fff', sparkP: '#93C5FD', sparkO: '#6EE7B7' },
];

const P_COLOR = { NORMAL:'#22C55E', LOW:'#F5A524', HIGH:'#EF4444', UNKNOWN:'#8A94A6' };
const O_COLOR = { NORMAL:'#22C55E', LOW:'#F59E0B', HIGH:'#8B5CF6', UNKNOWN:'#8A94A6' };

function safeTime(raw) {
  if (!raw) return '—';
  const d = raw instanceof Date ? raw : new Date(raw);
  return isNaN(d.getTime()) ? '—' : d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' });
}

function fmt(v, dec=1) {
  return (v !== null && v !== undefined && !isNaN(v)) ? Number(v).toFixed(dec) : '—';
}

/** Dual-parameter device card: pressure (PSI) + oxygen purity (%). */
export function DeviceCard({ device, index = 0 }) {
  const pal = PALETTE[index % PALETTE.length];
  const { id, current_pressure, pressure_status, current_purity, purity_status,
          status, last_updated, sparkline_p = [], sparkline_o = [] } = device;

  const prevRef = useRef(current_pressure);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (prevRef.current !== current_pressure) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 800);
      prevRef.current = current_pressure;
      return () => clearTimeout(t);
    }
  }, [current_pressure]);

  const pColor = P_COLOR[pressure_status] || P_COLOR.UNKNOWN;
  const oColor = O_COLOR[purity_status]   || O_COLOR.UNKNOWN;

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col transition-all duration-200"
      style={{
        boxShadow: pulse
          ? `0 0 0 3px ${pColor}40, 0 4px 24px rgba(80,110,180,0.14)`
          : '0 4px 24px rgba(80,110,180,0.08)',
        transform: pulse ? 'translateY(-2px)' : 'translateY(0)',
      }}
    >
      {/* Coloured header */}
      <div className="px-4 pt-4 pb-3" style={{ background: pal.header }}>
        <div className="flex items-center justify-between mb-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.18)' }}>
            <Wind size={16} color={pal.text} />
          </div>
          <StatusPill status={status} size="xs" />
        </div>
        <p className="text-xs font-semibold opacity-70" style={{ color: pal.text }}>Device</p>
        <p className="text-base font-bold" style={{ color: pal.text }}>{id}</p>
      </div>

      {/* Body */}
      <div className="bg-white px-4 py-3 flex flex-col gap-3">

        {/* ── Pressure row ───────────────────────────────── */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Wind size={11} color="#8A94A6" />
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color:'#8A94A6' }}>
              Pressure
            </span>
          </div>
          <div className="flex items-end justify-between mb-1">
            <div>
              <span className="text-xl font-bold leading-none" style={{ color: pColor }}>
                {fmt(current_pressure)}
              </span>
              <span className="text-[10px] font-medium ml-1" style={{ color:'#8A94A6' }}>PSI</span>
            </div>
            <StatusPill status={pressure_status} size="xs" />
          </div>
          {/* Progress bar 0–150 */}
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            {current_pressure != null && !isNaN(current_pressure) && (
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width:`${Math.min(Math.max(current_pressure/150*100,0),100)}%`, background: pColor }} />
            )}
          </div>
          <div className="flex justify-between text-[9px] mt-0.5" style={{ color:'#8A94A6' }}>
            <span>0</span><span>40</span><span>100</span><span>150</span>
          </div>
          <Sparkline data={sparkline_p} color={pal.sparkP} />
        </div>

        {/* ── Oxygen purity row ──────────────────────────── */}
        <div className="pt-2" style={{ borderTop:'1px solid #F4F7FC' }}>
          <div className="flex items-center gap-1.5 mb-1">
            <Droplets size={11} color="#8A94A6" />
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color:'#8A94A6' }}>
              O₂ Purity
            </span>
          </div>
          <div className="flex items-end justify-between mb-1">
            <div>
              <span className="text-xl font-bold leading-none" style={{ color: oColor }}>
                {fmt(current_purity)}
              </span>
              <span className="text-[10px] font-medium ml-1" style={{ color:'#8A94A6' }}>%</span>
            </div>
            <StatusPill status={purity_status} size="xs" />
          </div>
          {/* Progress bar 85–100% */}
          {current_purity != null && !isNaN(current_purity) && (
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width:`${Math.min(Math.max((current_purity-85)/15*100,0),100)}%`, background: oColor }} />
            </div>
          )}
          <div className="flex justify-between text-[9px] mt-0.5" style={{ color:'#8A94A6' }}>
            <span>85%</span><span>93%</span><span>99%</span><span>100%</span>
          </div>
          <Sparkline data={sparkline_o} color={pal.sparkO} />
        </div>

        {/* Last updated */}
        <p className="text-[10px] text-right mt-1" style={{ color:'#8A94A6' }}>
          {safeTime(last_updated)}
        </p>
      </div>
    </div>
  );
}
