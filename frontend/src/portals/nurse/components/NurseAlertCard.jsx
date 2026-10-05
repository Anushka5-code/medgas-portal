import { useState } from 'react';
import { Clock, Wind, Droplets, TrendingUp, TrendingDown } from 'lucide-react';
import { StatusPill }       from '../../../components/ui/StatusPill';
import { ActionChecklist }  from './ActionChecklist';
import { AutoEscalateTimer } from './AutoEscalateTimer';
import { EscalationStatus } from './EscalationStatus';
import { AcknowledgeModal } from './AcknowledgeModal';
import { EscalateModal }    from './EscalateModal';

function elapsed(raw) {
  if (!raw) return '—';
  const s = Math.floor((Date.now() - new Date(raw)) / 1000);
  if (s < 60)  return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
function fmtDT(raw) {
  if (!raw) return '—';
  const d = new Date(raw);
  return isNaN(d) ? '—' : d.toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}
function fmt(v, unit='') {
  return (v != null && !isNaN(v)) ? `${Number(v).toFixed(1)}${unit}` : '—';
}

export function NurseAlertCard({ alert, onAcknowledge, onEscalate }) {
  const [showAck, setShowAck] = useState(false);
  const [showEsc, setShowEsc] = useState(false);

  const isPressure = alert.parameter === 'purity' ? false : true;
  const isHigh     = alert.alert_type?.includes('HIGH');
  const isLow      = alert.alert_type?.includes('LOW');
  const border     = isHigh ? '#F0386B' : '#F59E0B';
  const Icon       = isPressure ? Wind : Droplets;
  const paramLabel = isPressure ? 'Pressure' : 'O₂ Purity';
  const unit       = isPressure ? ' PSI' : '%';
  const safeRange  = isPressure ? '40–100 PSI' : '93–99%';

  const curVal  = alert.current_value ?? alert.current_pressure;
  const maxVal  = alert.max_value     ?? alert.max_pressure;
  const startAt = alert.started_at    ?? alert.created_at;

  return (
    <>
      <div className="bg-white rounded-2xl overflow-hidden"
        style={{ borderLeft:`4px solid ${border}`, boxShadow:`0 4px 20px rgba(80,110,180,0.08)` }}>

        {/* Header */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-bold text-[#1E2A4A]">{alert.bed_label ?? alert.device_id}</span>
              <span className="text-xs text-[#8A94A6]">{alert.device_id}</span>
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: border + '18', color: border }}>
                <Icon size={9}/> {paramLabel}
              </span>
              <StatusPill status={alert.alert_type} size="xs"/>
              <StatusPill status={alert.status} size="xs"/>
            </div>
            <span className="text-xs text-[#8A94A6] flex items-center gap-1 shrink-0">
              <Clock size={11}/> Active for {elapsed(startAt)}
            </span>
          </div>

          {/* Auto-escalate timer */}
          <div className="mb-2">
            <AutoEscalateTimer createdAt={startAt} status={alert.status}
              escalationStatus={alert.escalation_status ?? 'NONE'}/>
          </div>

          {/* Values */}
          <div className="flex flex-wrap gap-4 text-sm mb-2">
            <div>
              <span className="text-xs text-[#8A94A6]">Current </span>
              <span className="font-bold text-[#1E2A4A]" style={{ color: border }}>{fmt(curVal, unit)}</span>
            </div>
            <div>
              <span className="text-xs text-[#8A94A6]">Peak </span>
              <span className="font-bold text-[#1E2A4A]">{fmt(maxVal, unit)}</span>
            </div>
            <div>
              <span className="text-xs text-[#8A94A6]">Safe range </span>
              <span className="font-semibold text-green-600">{safeRange}</span>
            </div>
          </div>
          <p className="text-xs text-[#8A94A6]">Started: {fmtDT(startAt)}</p>
        </div>

        {/* Escalation status */}
        <div className="px-5 pb-3">
          <EscalationStatus alert={alert}/>
        </div>

        {/* Action checklist */}
        <div className="px-5 pb-3">
          <ActionChecklist alertType={alert.alert_type} defaultOpen={alert.status === 'ACTIVE'}/>
        </div>

        {/* Auto-resolve helper */}
        <div className="px-5 pb-3">
          <p className="text-[11px] text-[#8A94A6] italic">
            Auto-resolves when {isPressure ? 'pressure returns to 40–100 PSI' : 'O₂ purity returns to 93–99%'}.
          </p>
        </div>

        {/* Action buttons */}
        {alert.status !== 'RESOLVED' && (
          <div className="px-5 pb-5 flex gap-3 flex-wrap">
            {alert.status === 'ACTIVE' && (
              <button onClick={() => setShowAck(true)}
                className="flex-1 min-h-[48px] flex items-center justify-center gap-2 rounded-xl text-sm font-bold transition-colors"
                style={{ background:'#EAF3FF', color:'#2F80ED' }}>
                Acknowledge
              </button>
            )}
            {(alert.escalation_status === 'NONE' || !alert.escalation_status) && (
              <button onClick={() => setShowEsc(true)}
                className="flex-1 min-h-[48px] flex items-center justify-center gap-2 rounded-xl text-sm font-bold transition-colors"
                style={{ background:'#FEF2F2', color:'#F0386B' }}>
                Escalate to Doctor
              </button>
            )}
          </div>
        )}
      </div>

      {showAck && (
        <AcknowledgeModal alert={alert} onConfirm={onAcknowledge} onClose={() => setShowAck(false)}/>
      )}
      {showEsc && (
        <EscalateModal alert={alert} onConfirm={onEscalate} onClose={() => setShowEsc(false)}/>
      )}
    </>
  );
}
