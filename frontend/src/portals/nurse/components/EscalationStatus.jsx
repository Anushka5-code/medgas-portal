import { AlertTriangle, CheckCircle2 } from 'lucide-react';

function fmtTime(raw) {
  if (!raw) return '';
  const d = new Date(raw);
  return isNaN(d) ? '' : d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
}

export function EscalationStatus({ alert }) {
  const { escalation_status, escalated_at, responded_at, escalation_note, responded_by } = alert;

  if (!escalation_status || escalation_status === 'NONE') return null;

  if (escalation_status === 'PENDING') {
    return (
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl"
        style={{ background:'#FFFBEB', border:'1px solid #FCD34D' }}>
        <AlertTriangle size={15} className="text-amber-500 mt-0.5 shrink-0 live-dot-red"
          style={{ filter:'drop-shadow(0 0 4px rgba(251,191,36,0.6))' }}/>
        <div>
          <p className="text-xs font-bold text-amber-800">
            Escalated at {fmtTime(escalated_at)} — Waiting for doctor response
          </p>
          {escalation_note && (
            <p className="text-xs text-amber-700 mt-0.5 italic">"{escalation_note}"</p>
          )}
        </div>
      </div>
    );
  }

  if (escalation_status === 'RESPONDED') {
    return (
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl"
        style={{ background:'#F0FDF4', border:'1px solid #86EFAC' }}>
        <CheckCircle2 size={15} className="text-green-600 mt-0.5 shrink-0"/>
        <div>
          <p className="text-xs font-bold text-green-800">
            Doctor responded at {fmtTime(responded_at)}
          </p>
          <p className="text-xs text-green-700 mt-0.5">Response logged. Follow doctor's instructions.</p>
        </div>
      </div>
    );
  }

  return null;
}
