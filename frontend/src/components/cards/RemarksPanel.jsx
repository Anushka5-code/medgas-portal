/**
 * RemarksPanel.jsx
 * ================
 * Reusable remarks section for the Doctor Portal.
 * Used on AlertCard (any status) and HistoryTable rows.
 *
 * - Shows existing remarks (collapsed by default, open if needs_remark=true)
 * - Inline "Add remark" textarea + submit
 * - Calls POST /alerts/{id}/remarks
 */
import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, ChevronDown, ChevronUp, Send, Loader2 } from 'lucide-react';
import { api } from '../../api/client';

function relTime(raw) {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d)) return '';
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60)  return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

const ROLE_BADGE = {
  DOCTOR: { bg:'#EAF3FF', color:'#2F80ED' },
  NURSE:  { bg:'#F0FDF4', color:'#16A34A' },
};

export function RemarksPanel({ alertId, initialCount = 0, needsRemark = false }) {
  const [open,     setOpen]     = useState(needsRemark);  // open by default if needs remark
  const [remarks,  setRemarks]  = useState(null);         // null = not yet loaded
  const [loading,  setLoading]  = useState(false);
  const [text,     setText]     = useState('');
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState('');
  const [count,    setCount]    = useState(initialCount);

  const loadRemarks = useCallback(async () => {
    if (remarks !== null) return;
    setLoading(true);
    try {
      const data = await api.get(`/alerts/${alertId}/remarks`);
      setRemarks(data);
      setCount(data.length);
    } catch { setRemarks([]); }
    finally { setLoading(false); }
  }, [alertId, remarks]);

  useEffect(() => {
    if (open) loadRemarks();
  }, [open, loadRemarks]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!text.trim()) { setErr('Remark cannot be empty.'); return; }
    setSaving(true); setErr('');
    try {
      const newRemark = await api.post(`/alerts/${alertId}/remarks`, { text: text.trim() });
      setRemarks(prev => [...(prev || []), newRemark]);
      setCount(c => c + 1);
      setText('');
    } catch (ex) { setErr(ex.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="mt-2 rounded-xl overflow-hidden border"
      style={{ borderColor: needsRemark && count === 0 ? '#FCD34D' : '#E8EEFA' }}>

      {/* Toggle header */}
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold transition-colors hover:bg-slate-50"
        style={{
          background: needsRemark && count === 0 ? '#FFFBEB' : '#FAFBFF',
          color: needsRemark && count === 0 ? '#92400E' : '#8A94A6',
        }}>
        <span className="flex items-center gap-2">
          <MessageSquare size={13}/>
          {count > 0 ? `${count} remark${count !== 1 ? 's' : ''}` : 'Add remark'}
          {needsRemark && count === 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
              Recommended
            </span>
          )}
        </span>
        {open ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
      </button>

      {open && (
        <div className="bg-white px-4 py-3 flex flex-col gap-3 border-t"
          style={{ borderColor:'#E8EEFA' }}>

          {/* Existing remarks */}
          {loading && (
            <p className="text-xs text-[#8A94A6] flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin"/> Loading…
            </p>
          )}
          {remarks?.length === 0 && !loading && (
            <p className="text-xs text-[#8A94A6] italic">No remarks yet.</p>
          )}
          {remarks?.map(r => (
            <div key={r.id} className="flex flex-col gap-1 px-3 py-2.5 rounded-xl bg-slate-50">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-[#1E2A4A]">
                  {r.author ?? 'Unknown'}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={ROLE_BADGE[r.role] || ROLE_BADGE.DOCTOR}>
                  {r.role}
                </span>
                <span className="text-[10px] text-[#8A94A6] ml-auto">{relTime(r.created_at)}</span>
              </div>
              <p className="text-xs text-[#1E2A4A] leading-relaxed">{r.text}</p>
            </div>
          ))}

          {/* Add new remark */}
          <form onSubmit={handleAdd} className="flex flex-col gap-2">
            <textarea
              value={text} onChange={e => { setText(e.target.value); setErr(''); }}
              rows={2} maxLength={500}
              placeholder="Add a clinical remark for records… (max 500 chars)"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-[#1E2A4A] resize-none focus:outline-none focus:ring-2 focus:ring-[#2F80ED]/30 bg-slate-50"
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#8A94A6]">{text.length}/500</span>
              <div className="flex items-center gap-2">
                {err && <p className="text-[10px] text-red-500">{err}</p>}
                <button type="submit" disabled={saving || !text.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50 transition-colors min-h-[32px]"
                  style={{ background:'#2F80ED' }}>
                  {saving ? <Loader2 size={11} className="animate-spin"/> : <Send size={11}/>}
                  {saving ? 'Saving…' : 'Add Remark'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
