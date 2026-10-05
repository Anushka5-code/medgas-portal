import { useState, useMemo, useCallback } from 'react';
import { Wind, Droplets, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { AlertCard } from '../components/cards/AlertCard';
import { api }       from '../api/client';

const STATUS_TABS = ['ACTIVE','ACKNOWLEDGED','ESCALATED','RESOLVED'];
const PARAM_TABS  = ['All','Pressure','Purity'];

function EmptyState({ status, param }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <svg viewBox="0 0 120 100" fill="none" className="w-28 opacity-40" aria-hidden="true">
        <circle cx="60" cy="50" r="40" fill="#EAF3FF"/>
        <path d="M44 50h32M60 34v32" stroke="#2F80ED" strokeWidth="3" strokeLinecap="round"/>
        <circle cx="60" cy="50" r="40" stroke="#2F80ED" strokeWidth="2" strokeDasharray="6 4"/>
      </svg>
      <div className="text-center">
        <p className="text-sm font-semibold" style={{ color:'#1E2A4A' }}>
          No {status.toLowerCase()} {param !== 'All' ? param.toLowerCase()+' ' : ''}alerts
        </p>
        <p className="text-xs mt-1 max-w-xs" style={{ color:'#8A94A6' }}>
          {status === 'ACTIVE'
            ? 'All devices are operating within safe thresholds.'
            : `No ${status.toLowerCase()} alerts yet.`}
        </p>
      </div>
    </div>
  );
}

function AuditTimeline({ alertId }) {
  const [events, setEvents]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen]       = useState(false);

  const load = useCallback(async () => {
    if (events !== null) return; // already loaded
    setLoading(true);
    try {
      const data = await api.get(`/alerts/${alertId}/events`);
      setEvents(data);
    } catch { setEvents([]); }
    finally { setLoading(false); }
  }, [alertId, events]);

  function toggle() {
    if (!open) load();
    setOpen(v => !v);
  }

  const EVENT_COLOR = {
    CREATED:       '#2F80ED', UPDATED:    '#8A94A6',
    ACKNOWLEDGED:  '#F59E0B', ESCALATED:  '#F0386B',
    AUTO_ESCALATED:'#F0386B', RESPONDED:  '#8B5CF6',
    RESOLVED:      '#22C55E', AUTO_RESOLVED:'#22C55E',
  };

  return (
    <div className="mt-2">
      <button
        onClick={toggle}
        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
        style={{ background: open ? '#F4F7FC' : 'transparent', color:'#8A94A6' }}>
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        Audit trail
      </button>

      {open && (
        <div className="mt-2 pl-3 border-l-2 border-slate-100 flex flex-col gap-2">
          {loading && <p className="text-xs text-muted">Loading…</p>}
          {events?.length === 0 && <p className="text-xs text-muted">No events yet.</p>}
          {events?.map(e => (
            <div key={e.id} className="flex items-start gap-2">
              <span className="w-2 h-2 rounded-full mt-1 shrink-0"
                style={{ background: EVENT_COLOR[e.event_type] || '#8A94A6' }} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-bold" style={{ color: EVENT_COLOR[e.event_type] || '#1E2A4A' }}>
                    {e.event_type.replace(/_/g,' ')}
                  </span>
                  {e.user_name && (
                    <span className="text-[10px] text-muted">by {e.user_name}</span>
                  )}
                </div>
                {e.note && <p className="text-[10px] italic text-navy/70 mt-0.5">"{e.note}"</p>}
                <p className="text-[9px] text-muted flex items-center gap-1 mt-0.5">
                  <Clock size={8} />
                  {new Date(e.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Alerts({ alerts, onAcknowledge, onResolve, searchQuery }) {
  const [statusTab, setStatusTab] = useState('ACTIVE');
  const [paramTab,  setParamTab]  = useState('All');

  const counts = useMemo(() => {
    const base = { ACTIVE:0, ACKNOWLEDGED:0, ESCALATED:0, RESOLVED:0 };
    alerts.forEach(a => {
      if (a.status === 'ACTIVE' && a.escalation_status === 'PENDING') base.ESCALATED++;
      else if (base[a.status] !== undefined) base[a.status]++;
    });
    return base;
  }, [alerts]);

  const paramCounts = useMemo(() => {
    const inTab = statusTab === 'ESCALATED'
      ? alerts.filter(a => a.escalation_status === 'PENDING')
      : alerts.filter(a => a.status === statusTab);
    return {
      All:      inTab.length,
      Pressure: inTab.filter(a => a.parameter === 'pressure').length,
      Purity:   inTab.filter(a => a.parameter === 'purity').length,
    };
  }, [alerts, statusTab]);

  const filtered = useMemo(() => {
    let list;
    if (statusTab === 'ESCALATED') {
      list = alerts.filter(a => a.escalation_status === 'PENDING');
    } else {
      list = alerts.filter(a => a.status === statusTab);
    }
    if (paramTab === 'Pressure') list = list.filter(a => a.parameter === 'pressure');
    if (paramTab === 'Purity')   list = list.filter(a => a.parameter === 'purity');
    if (searchQuery) list = list.filter(a => a.device_id.toLowerCase().includes(searchQuery.toLowerCase()));
    return list.sort((a,b) => new Date(b.started_at||b.created_at) - new Date(a.started_at||a.created_at));
  }, [alerts, statusTab, paramTab, searchQuery]);

  const TAB_META = {
    ACTIVE:       { label:'Active',       color:'#EF4444' },
    ACKNOWLEDGED: { label:'Acknowledged', color:'#F59E0B' },
    ESCALATED:    { label:'Escalated',    color:'#F0386B' },
    RESOLVED:     { label:'Resolved',     color:'#22C55E' },
  };

  return (
    <div className="p-5">
      <div className="mb-5">
        <h2 className="text-base font-bold" style={{ color:'#1E2A4A' }}>Alerts</h2>
        <p className="text-xs mt-0.5" style={{ color:'#8A94A6' }}>
          {counts.ACTIVE} active · {counts.ACKNOWLEDGED} acknowledged · {counts.ESCALATED} escalated · {counts.RESOLVED} resolved
        </p>
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-1 p-1.5 rounded-2xl w-fit mb-4"
        style={{ background:'#fff', boxShadow:'0 4px 24px rgba(80,110,180,0.08)' }}
        role="tablist" aria-label="Alert status">
        {STATUS_TABS.map(tab => {
          const active = statusTab === tab;
          const meta   = TAB_META[tab];
          return (
            <button key={tab} role="tab" aria-selected={active}
              onClick={() => { setStatusTab(tab); setParamTab('All'); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: active ? (tab === 'ESCALATED' ? '#F0386B' : '#2F80ED') : 'transparent',
                color: active ? '#fff' : '#8A94A6',
              }}>
              {meta.label}
              {counts[tab] > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none"
                  style={{ background: active ? 'rgba(255,255,255,0.25)' : '#F4F7FC',
                           color: active ? '#fff' : meta.color }}>
                  {counts[tab]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Param filter */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {PARAM_TABS.map(p => {
          const active = paramTab === p;
          const Icon   = p === 'Pressure' ? Wind : p === 'Purity' ? Droplets : null;
          return (
            <button key={p} onClick={() => setParamTab(p)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
              style={{
                background:  active ? '#1E2A4A' : '#fff',
                color:       active ? '#fff' : '#8A94A6',
                border:'1px solid', borderColor: active ? '#1E2A4A' : '#E8EEFA',
              }}>
              {Icon && <Icon size={11} />}
              {p} <span style={{ opacity:0.7 }}>({paramCounts[p]})</span>
            </button>
          );
        })}
      </div>

      {/* Alert cards */}
      {filtered.length === 0
        ? <EmptyState status={statusTab} param={paramTab} />
        : (
          <div className="flex flex-col gap-4" role="tabpanel">
            {filtered.map(alert => (
              <div key={alert.id} className="flex flex-col">
                <AlertCard alert={alert} onAcknowledge={onAcknowledge} onResolve={onResolve} />
                {/* Escalation detail */}
                {alert.escalation_status && alert.escalation_status !== 'NONE' && (
                  <div className="ml-4 mt-1 px-4 py-2 rounded-b-2xl text-xs"
                    style={{ background:'#FFF7ED', borderTop:'1px dashed #FED7AA' }}>
                    <span className="font-semibold" style={{ color:'#92400E' }}>
                      {alert.escalation_status === 'PENDING' ? '⚠ Escalated — awaiting doctor response' : '✅ Doctor responded'}
                    </span>
                    {alert.escalation_note && (
                      <span className="text-muted ml-2 italic">"{alert.escalation_note}"</span>
                    )}
                    {alert.acknowledged_by_name && (
                      <span className="text-muted ml-2">· Ack by {alert.acknowledged_by_name}</span>
                    )}
                  </div>
                )}
                {/* Audit trail toggle */}
                <AuditTimeline alertId={alert.id} />
              </div>
            ))}
          </div>
        )
      }
    </div>
  );
}
