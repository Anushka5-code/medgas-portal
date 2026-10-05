import { useState } from 'react';
import { X, ArrowUpCircle } from 'lucide-react';

const QUICK_NOTES = [
  'Pressure not recovering after 2 min',
  'Patient condition deteriorating',
  'Backup cylinder exhausted',
  'O₂ purity critically low',
  'Equipment fault suspected',
];

export function EscalateModal({ alert, onConfirm, onClose }) {
  const [note,    setNote]    = useState('');
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!note.trim()) { setErr('A reason is required to escalate.'); return; }
    setLoading(true);
    try { await onConfirm(alert.id, note); onClose(); }
    catch (ex) { setErr(ex.message); }
    finally { setLoading(false); }
  }

  const paramLabel = alert.parameter === 'purity' ? 'O₂ Purity' : 'Pressure';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-[#1E2A4A]/20 backdrop-blur-[2px]" onClick={onClose}/>
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-4 page-fade-in">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[#1E2A4A] flex items-center gap-2">
            <ArrowUpCircle size={18} className="text-[#F0386B]"/>
            Escalate to Doctor
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-[#8A94A6]"><X size={16}/></button>
        </div>

        <div className="px-4 py-3 rounded-2xl bg-red-50 text-sm border border-red-100">
          <p className="font-semibold text-[#1E2A4A]">
            {alert.bed_label ?? alert.device_id}
            <span className="font-normal text-[#8A94A6]"> · {alert.device_id}</span>
          </p>
          <p className="text-xs text-[#8A94A6] mt-0.5">{alert.alert_type?.replace(/_/g,' ')} · {paramLabel}</p>
          <p className="text-xs text-red-600 font-medium mt-1">⚠ The on-call doctor will be notified immediately.</p>
        </div>

        {/* Quick reason chips */}
        <div>
          <p className="text-xs font-semibold text-[#8A94A6] mb-2">Quick reason</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_NOTES.map(q => (
              <button key={q} type="button"
                onClick={() => setNote(prev => prev ? `${prev}, ${q}` : q)}
                className="text-xs px-3 py-1.5 rounded-xl border transition-colors hover:bg-red-50 hover:border-red-200 min-h-[36px]"
                style={{ borderColor:'#E8EEFA', color:'#1E2A4A' }}>
                {q}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="text-xs font-semibold text-[#1E2A4A]" htmlFor="esc-note">
            Escalation reason <span className="text-red-500">*</span>
          </label>
          <textarea id="esc-note" value={note} onChange={e => { setNote(e.target.value); setErr(''); }}
            rows={3} required placeholder="Describe the situation and actions already taken…"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300 bg-slate-50 text-[#1E2A4A]"/>
          {err && <p className="text-xs text-red-500">{err}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#8A94A6] hover:bg-slate-100 min-h-[44px]">Cancel</button>
            <button type="submit" disabled={loading || !note.trim()}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-50 min-h-[44px]"
              style={{ background:'#F0386B' }}>
              <ArrowUpCircle size={13}/> {loading ? 'Escalating…' : 'Escalate to Doctor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
