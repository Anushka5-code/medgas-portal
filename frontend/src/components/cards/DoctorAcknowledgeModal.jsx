/**
 * DoctorAcknowledgeModal.jsx
 * ==========================
 * Structured acknowledgement form for doctors.
 * Fields go into the `note` string as a formatted record so the backend
 * (which expects a single `note` field) stays unchanged.
 *
 * Fields:
 *   - Clinical assessment  (textarea, required)
 *   - Action taken         (select + free text)
 *   - Patient condition    (Normal / Stable / Unstable / Critical)
 *   - Follow-up required   (Yes / No + instructions if Yes)
 */
import { useState } from 'react';
import { X, Stethoscope, Send, ClipboardList } from 'lucide-react';

const ACTION_OPTIONS = [
  'Reviewed and monitored',
  'Adjusted oxygen flow',
  'Ordered equipment check',
  'Prescribed supplemental O₂',
  'Ordered biomedical inspection',
  'Escalated to senior doctor',
  'Other (specify below)',
];

const CONDITION_OPTIONS = ['Normal', 'Stable', 'Unstable', 'Critical'];

function buildNote({ assessment, action, actionFree, condition, followUp, followUpNote }) {
  const parts = [
    `[Clinical Assessment] ${assessment}`,
    `[Action Taken] ${action === 'Other (specify below)' ? actionFree : action}`,
    `[Patient Condition] ${condition}`,
    `[Follow-up] ${followUp === 'yes' ? `Required — ${followUpNote}` : 'Not required'}`,
  ];
  return parts.join('\n');
}

export function DoctorAcknowledgeModal({ alert, onConfirm, onClose }) {
  const [assessment,  setAssessment]  = useState('');
  const [action,      setAction]      = useState(ACTION_OPTIONS[0]);
  const [actionFree,  setActionFree]  = useState('');
  const [condition,   setCondition]   = useState('Stable');
  const [followUp,    setFollowUp]    = useState('no');
  const [followUpNote,setFollowUpNote]= useState('');
  const [loading,     setLoading]     = useState(false);
  const [err,         setErr]         = useState('');

  const paramLabel = alert.parameter === 'purity' ? 'O₂ Purity' : 'Pressure';

  async function handleSubmit(e) {
    e.preventDefault();
    if (!assessment.trim()) { setErr('Clinical assessment is required.'); return; }
    if (action === 'Other (specify below)' && !actionFree.trim()) {
      setErr('Please specify the action taken.'); return;
    }
    if (followUp === 'yes' && !followUpNote.trim()) {
      setErr('Please describe the follow-up instruction.'); return;
    }
    const note = buildNote({ assessment, action, actionFree, condition, followUp, followUpNote });
    setLoading(true);
    try { await onConfirm(alert.id, note); onClose(); }
    catch (ex) { setErr(ex.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog" aria-modal="true" aria-label="Acknowledge alert">
      <div className="absolute inset-0 bg-[#1E2A4A]/20 backdrop-blur-[2px]" onClick={onClose}/>
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg my-4 flex flex-col page-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-[#1E2A4A] flex items-center gap-2">
            <ClipboardList size={18} className="text-[#2F80ED]"/>
            Acknowledge Alert — Clinical Record
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-[#8A94A6]">
            <X size={16}/>
          </button>
        </div>

        {/* Alert summary */}
        <div className="px-6 pt-4">
          <div className="px-4 py-3 rounded-2xl bg-slate-50 text-sm mb-4">
            <p className="font-semibold text-[#1E2A4A]">
              {alert.bed_label ?? alert.device_id}
              <span className="font-normal text-[#8A94A6]"> · {alert.device_id}</span>
            </p>
            <p className="text-xs text-[#8A94A6] mt-0.5">
              {alert.alert_type?.replace(/_/g,' ')} · {paramLabel} ·
              Current: {Number(alert.current_value ?? alert.current_pressure ?? 0).toFixed(1)}
              {alert.parameter === 'purity' ? '%' : ' PSI'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 flex flex-col gap-4">

          {/* 1. Clinical assessment */}
          <div>
            <label className="block text-xs font-semibold text-[#1E2A4A] mb-1.5">
              Clinical Assessment <span className="text-red-500">*</span>
            </label>
            <textarea
              value={assessment} onChange={e => { setAssessment(e.target.value); setErr(''); }}
              rows={3} required
              placeholder="Describe your clinical findings, patient status and relevant observations…"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-[#1E2A4A] resize-none focus:outline-none focus:ring-2 focus:ring-[#2F80ED]/30 bg-slate-50"
            />
          </div>

          {/* 2. Action taken */}
          <div>
            <label className="block text-xs font-semibold text-[#1E2A4A] mb-1.5">
              Action Taken <span className="text-red-500">*</span>
            </label>
            <select value={action} onChange={e => { setAction(e.target.value); setErr(''); }}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-[#1E2A4A] bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#2F80ED]/30">
              {ACTION_OPTIONS.map(o => <option key={o}>{o}</option>)}
            </select>
            {action === 'Other (specify below)' && (
              <input type="text" value={actionFree}
                onChange={e => { setActionFree(e.target.value); setErr(''); }}
                placeholder="Describe action…"
                className="mt-2 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-[#1E2A4A] bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#2F80ED]/30"/>
            )}
          </div>

          {/* 3. Patient condition */}
          <div>
            <label className="block text-xs font-semibold text-[#1E2A4A] mb-1.5">
              Patient Condition
            </label>
            <div className="flex gap-2 flex-wrap">
              {CONDITION_OPTIONS.map(c => {
                const active = condition === c;
                const colors = {
                  Normal:   { bg:'#F0FDF4', color:'#16A34A', active:'#16A34A' },
                  Stable:   { bg:'#EAF3FF', color:'#2F80ED', active:'#2F80ED' },
                  Unstable: { bg:'#FFFBEB', color:'#D97706', active:'#D97706' },
                  Critical: { bg:'#FEF2F2', color:'#DC2626', active:'#DC2626' },
                }[c];
                return (
                  <button key={c} type="button" onClick={() => setCondition(c)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold border-2 transition-all min-h-[36px]"
                    style={{
                      background:  active ? colors.bg  : '#F4F7FC',
                      color:       active ? colors.color : '#8A94A6',
                      borderColor: active ? colors.color : 'transparent',
                    }}>
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Follow-up */}
          <div>
            <label className="block text-xs font-semibold text-[#1E2A4A] mb-1.5">
              Follow-up Required?
            </label>
            <div className="flex gap-2 mb-2">
              {['no','yes'].map(v => (
                <button key={v} type="button" onClick={() => setFollowUp(v)}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold border-2 transition-all min-h-[36px]"
                  style={{
                    background:  followUp === v ? '#EAF3FF' : '#F4F7FC',
                    color:       followUp === v ? '#2F80ED' : '#8A94A6',
                    borderColor: followUp === v ? '#2F80ED' : 'transparent',
                  }}>
                  {v === 'yes' ? 'Yes' : 'No'}
                </button>
              ))}
            </div>
            {followUp === 'yes' && (
              <input type="text" value={followUpNote}
                onChange={e => { setFollowUpNote(e.target.value); setErr(''); }}
                placeholder="Describe follow-up instruction or schedule…"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-[#1E2A4A] bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#2F80ED]/30"/>
            )}
          </div>

          {err && <p className="text-xs text-red-500 font-medium">{err}</p>}

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#8A94A6] hover:bg-slate-100 min-h-[44px]">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-50 min-h-[44px]"
              style={{ background:'#2F80ED' }}>
              <Send size={13}/>
              {loading ? 'Saving…' : 'Acknowledge & Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
