/**
 * EscalationsPanel.jsx
 * ====================
 * Shows PENDING escalations. Each row has Respond (modal with note) and Resolve buttons.
 * Used in the Overview right column.
 */
import { useState } from 'react';
import { AlertTriangle, Clock, CheckCircle, MessageSquare, X, Send, Zap } from 'lucide-react';

function duration(raw) {
  if (!raw) return '—';
  const d = new Date(raw);
  if (isNaN(d)) return '—';
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60)  return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function RespondModal({ alert, onConfirm, onClose }) {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!note.trim()) return;
    setLoading(true);
    try { await onConfirm(alert.id, note); onClose(); }
    catch {}
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-navy/20 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-navy">Respond to Escalation</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-muted"><X size={16}/></button>
        </div>

        <div className="px-4 py-3 rounded-2xl bg-slate-50 text-sm">
          <p className="font-semibold text-navy">{alert.device_id}
            {alert.bed_label && <span className="font-normal text-muted"> · {alert.bed_label}</span>}
          </p>
          <p className="text-xs text-muted mt-0.5">{alert.alert_type?.replace(/_/g,' ')} · escalated {duration(alert.escalated_at)} ago</p>
          {alert.escalation_note && (
            <p className="text-xs mt-2 italic text-navy/70">"{alert.escalation_note}"</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="text-xs font-semibold text-navy" htmlFor="respond-note">
            Your response note <span className="text-red-400">*</span>
          </label>
          <textarea
            id="respond-note"
            value={note}
            onChange={e => setNote(e.target.value)}
            required
            rows={3}
            placeholder="Describe your clinical response or instruction…"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-navy resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 bg-slate-50"
          />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-muted hover:bg-slate-100 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading || !note.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-colors disabled:opacity-50"
              style={{ background: '#2F80ED' }}>
              <Send size={12} /> {loading ? 'Sending…' : 'Send Response'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function EscalationsPanel({ alerts, onRespond, onResolve }) {
  const [respondingTo, setRespondingTo] = useState(null);

  const pending = alerts.filter(a => a.escalation_status === 'PENDING');

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-navy flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 live-dot-red" />
          Escalations
        </h3>
        <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
          style={{ background: pending.length > 0 ? '#FEE2E2' : '#F4F7FC', color: pending.length > 0 ? '#EF4444' : '#8A94A6' }}>
          {pending.length} pending
        </span>
      </div>

      {pending.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6">
          <CheckCircle size={26} className="text-green-300" />
          <p className="text-xs text-muted text-center">No pending escalations</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {pending.map(a => (
            <li key={a.id}
              className="rounded-2xl p-3 flex flex-col gap-2"
              style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>

              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-navy">{a.device_id}</span>
                    {a.bed_label && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white text-muted font-medium">
                        {a.bed_label}
                      </span>
                    )}
                    {a.escalated_by == null && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1"
                        style={{ background: '#FEF3C7', color: '#92400E' }}>
                        <Zap size={9} /> Auto
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted mt-0.5">{a.alert_type?.replace(/_/g,' ')}</p>
                </div>
                <span className="text-[10px] text-muted flex items-center gap-1 shrink-0">
                  <Clock size={10} /> {duration(a.escalated_at)}
                </span>
              </div>

              {/* Nurse note */}
              {a.escalation_note && (
                <div className="flex items-start gap-1.5 bg-white rounded-xl px-3 py-2">
                  <MessageSquare size={11} className="text-muted mt-0.5 shrink-0" />
                  <p className="text-[11px] text-navy/80 italic">"{a.escalation_note}"</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => setRespondingTo(a)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-bold transition-colors"
                  style={{ background: '#2F80ED', color: '#fff' }}>
                  <Send size={11} /> Respond
                </button>
                <button
                  onClick={() => onResolve(a.id)}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors"
                  style={{ background: '#DCFCE7', color: '#166534' }}>
                  <CheckCircle size={11} /> Resolve
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {respondingTo && (
        <RespondModal
          alert={respondingTo}
          onConfirm={onRespond}
          onClose={() => setRespondingTo(null)}
        />
      )}
    </div>
  );
}
