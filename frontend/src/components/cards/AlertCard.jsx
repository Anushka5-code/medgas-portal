import { useState } from 'react';
import { Clock, AlertTriangle, TrendingUp, TrendingDown, CheckCircle, Wind, Droplets } from 'lucide-react';
import { StatusPill }               from '../ui/StatusPill';
import { DoctorAcknowledgeModal }   from './DoctorAcknowledgeModal';
import { RemarksPanel }             from './RemarksPanel';

function safeDate(raw) {
  if (!raw) return null;
  const d = raw instanceof Date ? raw : new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}
function duration(raw) {
  const d = safeDate(raw);
  if (!d) return '—';
  const diff = Date.now() - d.getTime();
  if (diff < 0) return 'just now';
  const s = Math.floor(diff/1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s/60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m/60)}h ${m%60}m`;
}
function fmtDT(raw) {
  const d = safeDate(raw);
  return d ? d.toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
}
function fmt(v, unit='') {
  return (v !== null && v !== undefined && !isNaN(v)) ? `${Number(v).toFixed(1)}${unit}` : '—';
}

const ALERT_META = {
  HIGH_PRESSURE: { label:'High Pressure',  Icon:TrendingUp,   border:'#EF4444', iconBg:'#FEE2E2', ParamIcon:Wind,     unit:' PSI', hi:'>100 PSI'  },
  LOW_PRESSURE:  { label:'Low Pressure',   Icon:TrendingDown, border:'#F5A524', iconBg:'#FEF3C7', ParamIcon:Wind,     unit:' PSI', hi:'<40 PSI'   },
  HIGH_PURITY:   { label:'High O₂ Purity', Icon:TrendingUp,   border:'#8B5CF6', iconBg:'#F5F3FF', ParamIcon:Droplets, unit:'%',    hi:'>99%'      },
  LOW_PURITY:    { label:'Low O₂ Purity',  Icon:TrendingDown, border:'#F59E0B', iconBg:'#FEF3C7', ParamIcon:Droplets, unit:'%',    hi:'<93%'      },
};

export function AlertCard({ alert, onAcknowledge, onResolve }) {
  const [showAckModal, setShowAckModal] = useState(false);
  const [loadingResolve, setLoadingResolve] = useState(false);

  const meta = ALERT_META[alert.alert_type] || ALERT_META.HIGH_PRESSURE;
  const { Icon, ParamIcon, border, iconBg, label, unit, hi } = meta;

  const startTime  = alert.started_at || alert.created_at;
  const curVal     = alert.current_value ?? alert.current_pressure;
  const maxVal     = alert.max_value     ?? alert.max_pressure;
  const paramLabel = alert.parameter === 'purity' ? 'O₂ Purity' : 'Pressure';

  async function handleResolve() {
    setLoadingResolve(true);
    try { await onResolve(alert.id); }
    catch (_) {}
    finally { setLoadingResolve(false); }
  }

  return (
    <>
      <div className="bg-white rounded-2xl p-4 flex gap-4"
        style={{ boxShadow:'0 4px 24px rgba(80,110,180,0.08)', borderLeft:`4px solid ${border}` }}>

        {/* Icon */}
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: iconBg }}>
          <Icon size={18} style={{ color:border }} strokeWidth={2} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Top row */}
          <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold" style={{ color:'#1E2A4A' }}>{alert.device_id}</span>
              {alert.bed_label && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-[#8A94A6] font-medium">
                  {alert.bed_label}
                </span>
              )}
              {/* Parameter badge */}
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: iconBg, color: border }}>
                <ParamIcon size={9} /> {paramLabel}
              </span>
              <StatusPill status={alert.alert_type} size="xs" />
              <StatusPill status={alert.status}     size="xs" />
            </div>
            <span className="text-xs flex items-center gap-1 shrink-0" style={{ color:'#8A94A6' }}>
              <Clock size={11} /> {duration(startTime)} ago
            </span>
          </div>

          {/* Alert label */}
          <p className="text-xs font-semibold mb-2" style={{ color: border }}>{label}</p>

          {/* Value stats */}
          <div className="flex flex-wrap gap-4 text-xs mb-2" style={{ color:'#8A94A6' }}>
            <span>Current: <span className="font-semibold" style={{ color:'#1E2A4A' }}>{fmt(curVal, unit)}</span></span>
            <span>Peak:    <span className="font-semibold" style={{ color:'#1E2A4A' }}>{fmt(maxVal, unit)}</span></span>
            <span>Threshold: <span className="font-semibold" style={{ color:'#1E2A4A' }}>{hi}</span></span>
          </div>

          {/* Timestamps + ack note */}
          <p className="text-[11px] mb-1" style={{ color:'#8A94A6' }}>
            Started: {fmtDT(startTime)}
            {alert.acknowledged_at && <> · Ack: {fmtDT(alert.acknowledged_at)}</>}
            {alert.resolved_at     && <> · Resolved: {fmtDT(alert.resolved_at)}</>}
          </p>

          {/* Acknowledge note (structured record) */}
          {alert.acknowledged_note && (
            <div className="mb-2 px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-100">
              <p className="font-semibold text-[#1E2A4A] mb-0.5">Clinical Record</p>
              <pre className="whitespace-pre-wrap font-sans text-[11px] text-[#8A94A6] leading-relaxed">
                {alert.acknowledged_note}
              </pre>
              {alert.acknowledged_by_name && (
                <p className="text-[10px] text-[#8A94A6] mt-1">— {alert.acknowledged_by_name}</p>
              )}
            </div>
          )}

          {/* Action buttons */}
          {alert.status !== 'RESOLVED' && (
            <div className="flex gap-2 mt-2">
              {alert.status === 'ACTIVE' && (
                <button onClick={() => setShowAckModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  style={{ background:'#FEF3C7', color:'#92400E' }}>
                  <AlertTriangle size={12} />
                  Acknowledge
                </button>
              )}
              <button onClick={handleResolve}
                disabled={loadingResolve}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                style={{ background:'#DCFCE7', color:'#166534' }}>
                <CheckCircle size={12} />
                {loadingResolve ? 'Working…' : 'Resolve'}
              </button>
            </div>
          )}

          {alert.status === 'RESOLVED' && (
            <div className="flex items-center gap-1.5 text-xs font-semibold mt-1" style={{ color:'#16A34A' }}>
              <CheckCircle size={13} /> Resolved {fmtDT(alert.resolved_at)}
            </div>
          )}

          {/* Remarks panel — visible for all statuses */}
          <RemarksPanel
            alertId={alert.id}
            initialCount={alert.remark_count ?? 0}
            needsRemark={alert.status === 'RESOLVED' && (alert.remark_count ?? 0) === 0}
          />
        </div>
      </div>

      {/* Acknowledge modal */}
      {showAckModal && (
        <DoctorAcknowledgeModal
          alert={alert}
          onConfirm={onAcknowledge}
          onClose={() => setShowAckModal(false)}
        />
      )}
    </>
  );
}
