import { useRef, useEffect, useState } from 'react';
import { Wind, Droplets } from 'lucide-react';
import { StatusPill } from '../../../components/ui/StatusPill';
import { Sparkline }  from '../../../components/charts/Sparkline';
import { PressureGauge } from './PressureGauge';
import { PRESSURE_MIN, PRESSURE_MAX, PURITY_MIN, PURITY_MAX } from '../../../config';

const P_COLOR = { NORMAL:'#22C55E', LOW:'#F59E0B', HIGH:'#F0386B', UNKNOWN:'#8A94A6' };
const O_COLOR = { NORMAL:'#22C55E', LOW:'#F59E0B', HIGH:'#8B5CF6', UNKNOWN:'#8A94A6' };

function fmt(v, d = 1) {
  return (v != null && !isNaN(v)) ? Number(v).toFixed(d) : '—';
}
function safeTime(raw) {
  if (!raw) return '—';
  const d = new Date(raw);
  return isNaN(d) ? '—' : d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' });
}

export function BedCard({ device }) {
  const {
    id, bed_label, ward_name,
    current_pressure, pressure_status,
    current_purity,   purity_status,
    status, last_updated,
    sparkline_p = [], sparkline_o = [],
  } = device;

  const prevRef = useRef(current_pressure);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (prevRef.current !== current_pressure) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 900);
      prevRef.current = current_pressure;
      return () => clearTimeout(t);
    }
  }, [current_pressure]);

  const isAbnormal = status === 'HIGH' || status === 'LOW';
  const isHigh     = status === 'HIGH';
  const borderColor = isHigh ? '#F0386B' : isAbnormal ? '#F59E0B' : '#E8EEFA';
  const pColor = P_COLOR[pressure_status] || P_COLOR.UNKNOWN;
  const oColor = O_COLOR[purity_status]   || O_COLOR.UNKNOWN;

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden flex flex-col transition-all duration-200"
      style={{
        border: `2px solid ${borderColor}`,
        boxShadow: pulse
          ? `0 0 0 4px ${pColor}30, 0 4px 24px rgba(80,110,180,0.12)`
          : isAbnormal
            ? `0 4px 20px ${borderColor}25`
            : '0 4px 20px rgba(80,110,180,0.07)',
        transform: pulse ? 'translateY(-2px)' : 'none',
      }}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-2"
        style={{ background: isAbnormal ? (isHigh ? '#FFF5F5' : '#FFFBEB') : '#FAFBFF' }}>
        <div>
          <p className="text-base font-bold text-[#1E2A4A]">{bed_label ?? id}</p>
          <p className="text-xs text-[#8A94A6] mt-0.5">{id} · {ward_name}</p>
        </div>
        <StatusPill status={status} size="xs" />
      </div>

      {/* Body */}
      <div className="px-5 pb-5 flex flex-col gap-4">

        {/* ── Pressure ── */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Wind size={13} color="#8A94A6"/>
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#8A94A6]">Pressure</span>
          </div>
          <div className="flex items-baseline justify-between mb-2">
            <div>
              <span className="text-3xl font-bold leading-none" style={{ color: pColor }}>{fmt(current_pressure)}</span>
              <span className="text-sm font-medium ml-1 text-[#8A94A6]">PSI</span>
            </div>
            <StatusPill status={pressure_status} size="xs"/>
          </div>
          <PressureGauge value={current_pressure} min={0} max={150}
            safeMin={PRESSURE_MIN} safeMax={PRESSURE_MAX} unit=" PSI" color={pColor}/>
          <Sparkline data={sparkline_p} color={pColor}/>
        </div>

        {/* ── O2 Purity ── */}
        <div style={{ borderTop:'1px solid #F4F7FC', paddingTop:'12px' }}>
          <div className="flex items-center gap-1.5 mb-2">
            <Droplets size={13} color="#8A94A6"/>
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#8A94A6]">O₂ Purity</span>
          </div>
          <div className="flex items-baseline justify-between mb-2">
            <div>
              <span className="text-3xl font-bold leading-none" style={{ color: oColor }}>{fmt(current_purity)}</span>
              <span className="text-sm font-medium ml-1 text-[#8A94A6]">%</span>
            </div>
            <StatusPill status={purity_status} size="xs"/>
          </div>
          <PressureGauge value={current_purity} min={85} max={100}
            safeMin={PURITY_MIN} safeMax={PURITY_MAX} unit="%" color={oColor}/>
          <Sparkline data={sparkline_o} color={oColor}/>
        </div>

        <p className="text-[10px] text-right text-[#8A94A6] -mt-2">{safeTime(last_updated)}</p>
      </div>
    </div>
  );
}
