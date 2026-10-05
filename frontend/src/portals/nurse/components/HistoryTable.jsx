import { useState, useCallback } from 'react';
import { Clock, ChevronRight, X } from 'lucide-react';
import { StatusPill } from '../../../components/ui/StatusPill';
import { Drawer }     from '../../../components/ui/Drawer';
import { api }        from '../../../api/client';

const EVENT_COLOR = {
  CREATED:'#2F80ED', UPDATED:'#8A94A6', ACKNOWLEDGED:'#F59E0B',
  ESCALATED:'#F0386B', AUTO_ESCALATED:'#F0386B',
  RESPONDED:'#8B5CF6', RESOLVED:'#22C55E', AUTO_RESOLVED:'#22C55E',
};

function fmtDT(raw) {
  if (!raw) return '—';
  const d = new Date(raw);
  return isNaN(d) ? '—' : d.toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}
function durStr(startRaw, endRaw) {
  if (!startRaw || !endRaw) return '—';
  const m = Math.floor((new Date(endRaw) - new Date(startRaw)) / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function EventTimeline({ alertId }) {
  const [events,  setEvents]  = useState(null);
  const [loading, setLoading] = useState(true);

  useState(() => {
    api.get(`/alerts/${alertId}/events`)
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  });

  if (loading) return <p className="text-sm text-[#8A94A6] py-4">Loading events…</p>;
  if (!events?.length) return <p className="text-sm text-[#8A94A6] py-4">No events recorded.</p>;

  return (
    <ul className="flex flex-col gap-3 mt-2">
      {events.map((e, i) => (
        <li key={e.id} className="flex items-start gap-3 relative">
          {i < events.length - 1 && (
            <div className="absolute left-3 top-6 bottom-0 w-px bg-slate-100"/>
          )}
          <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 z-10"
            style={{ background: (EVENT_COLOR[e.event_type] || '#8A94A6') + '20' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: EVENT_COLOR[e.event_type] || '#8A94A6' }}/>
          </span>
          <div className="flex-1 pb-3">
            <p className="text-xs font-bold" style={{ color: EVENT_COLOR[e.event_type] || '#1E2A4A' }}>
              {e.event_type.replace(/_/g,' ')}
              {e.user_name && <span className="font-normal text-[#8A94A6]"> by {e.user_name}</span>}
            </p>
            {e.note && <p className="text-xs italic text-[#8A94A6] mt-0.5">"{e.note}"</p>}
            <p className="text-[10px] text-[#8A94A6] mt-0.5 flex items-center gap-1">
              <Clock size={8}/>{fmtDT(e.created_at)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function HistoryTable({ alerts }) {
  const [selected, setSelected] = useState(null);

  if (!alerts.length) return (
    <div className="py-12 text-center text-sm text-[#8A94A6]">No history in this window.</div>
  );

  return (
    <>
      <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow:'0 4px 20px rgba(80,110,180,0.08)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Alert history">
            <thead>
              <tr style={{ borderBottom:'1px solid #F4F7FC' }}>
                {['Device / Bed','Type','Started','Resolved','Duration','Ack by','Escalated',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#8A94A6] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alerts.map(a => (
                <tr key={a.id} onClick={() => setSelected(a)}
                  className="cursor-pointer transition-colors hover:bg-slate-50"
                  style={{ borderBottom:'1px solid #F4F7FC' }}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[#1E2A4A] text-xs">{a.bed_label ?? a.device_id}</p>
                    <p className="text-[10px] text-[#8A94A6]">{a.device_id}</p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={a.alert_type} size="xs"/>
                    <p className="text-[10px] text-[#8A94A6] mt-0.5">{a.parameter === 'purity' ? 'O₂ Purity' : 'Pressure'}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#8A94A6] whitespace-nowrap">{fmtDT(a.started_at ?? a.created_at)}</td>
                  <td className="px-4 py-3 text-xs text-[#8A94A6] whitespace-nowrap">{fmtDT(a.resolved_at) || '—'}</td>
                  <td className="px-4 py-3 text-xs text-[#8A94A6]">{durStr(a.started_at ?? a.created_at, a.resolved_at)}</td>
                  <td className="px-4 py-3 text-xs text-[#8A94A6]">{a.acknowledged_by_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    {a.escalation_status && a.escalation_status !== 'NONE'
                      ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Yes</span>
                      : <span className="text-[10px] text-[#8A94A6]">No</span>}
                  </td>
                  <td className="px-4 py-3">
                    <ChevronRight size={14} className="text-[#8A94A6]"/>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Drawer open={!!selected} onClose={() => setSelected(null)}
        title={selected ? `Alert #${selected.id} — ${selected.bed_label ?? selected.device_id}` : ''}>
        {selected && <EventTimeline alertId={selected.id}/>}
      </Drawer>
    </>
  );
}
