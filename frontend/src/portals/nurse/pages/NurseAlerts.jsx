import { useState, useMemo } from 'react';
import { Wind, Droplets, CheckCircle2 } from 'lucide-react';
import { NurseAlertCard } from '../components/NurseAlertCard';

const STATUS_TABS  = ['ACTIVE','ACKNOWLEDGED','ESCALATED'];
const PARAM_TABS   = ['All','Pressure','Purity'];

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center">
        <CheckCircle2 size={36} className="text-green-400"/>
      </div>
      <div className="text-center">
        <p className="text-base font-semibold text-[#1E2A4A]">No active alerts. All clear.</p>
        <p className="text-sm text-[#8A94A6] mt-1">All gas supplies are operating within safe ranges.</p>
      </div>
    </div>
  );
}

export function NurseAlerts({ alerts, onAcknowledge, onEscalate, searchQuery }) {
  const [statusTab, setStatusTab] = useState('ACTIVE');
  const [paramTab,  setParamTab]  = useState('All');

  const counts = useMemo(() => {
    const base = { ACTIVE:0, ACKNOWLEDGED:0, ESCALATED:0 };
    alerts.forEach(a => {
      if (a.escalation_status === 'PENDING') base.ESCALATED++;
      else if (base[a.status] !== undefined) base[a.status]++;
    });
    return base;
  }, [alerts]);

  const filtered = useMemo(() => {
    let list = statusTab === 'ESCALATED'
      ? alerts.filter(a => a.escalation_status === 'PENDING')
      : alerts.filter(a => a.status === statusTab);

    if (paramTab === 'Pressure') list = list.filter(a => a.parameter === 'pressure');
    if (paramTab === 'Purity')   list = list.filter(a => a.parameter === 'purity');
    if (searchQuery) list = list.filter(a =>
      a.device_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.bed_label||'').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return list.sort((a,b) => {
      const hi = x => x.alert_type?.includes('HIGH') ? 0 : 1;
      return hi(a) - hi(b) || new Date(a.started_at||a.created_at) - new Date(b.started_at||b.created_at);
    });
  }, [alerts, statusTab, paramTab, searchQuery]);

  const TAB_COLOR = { ACTIVE:'#F0386B', ACKNOWLEDGED:'#F59E0B', ESCALATED:'#8B5CF6' };

  return (
    <div className="p-5">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-[#1E2A4A]">Alerts</h2>
        <p className="text-sm text-[#8A94A6] mt-0.5">
          {counts.ACTIVE} active · {counts.ACKNOWLEDGED} acknowledged · {counts.ESCALATED} escalated · Pressure & O₂ Purity
        </p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 p-1.5 rounded-2xl w-fit mb-4"
        style={{ background:'#fff', boxShadow:'0 4px 20px rgba(80,110,180,0.08)' }}
        role="tablist">
        {STATUS_TABS.map(tab => {
          const active = statusTab === tab;
          return (
            <button key={tab} role="tab" aria-selected={active}
              onClick={() => { setStatusTab(tab); setParamTab('All'); }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all min-h-[44px]"
              style={{ background: active ? (tab === 'ESCALATED' ? '#8B5CF6' : '#2F80ED') : 'transparent',
                       color: active ? '#fff' : '#8A94A6' }}>
              {tab.charAt(0) + tab.slice(1).toLowerCase()}
              {counts[tab] > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none"
                  style={{ background: active ? 'rgba(255,255,255,0.25)' : '#F4F7FC',
                           color: active ? '#fff' : TAB_COLOR[tab] }}>
                  {counts[tab]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Param filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {PARAM_TABS.map(p => {
          const active = paramTab === p;
          const Icon   = p === 'Pressure' ? Wind : p === 'Purity' ? Droplets : null;
          const pCount = p === 'All'
            ? filtered.length
            : (statusTab === 'ESCALATED'
                ? alerts.filter(a => a.escalation_status==='PENDING' && a.parameter===(p==='Purity'?'purity':'pressure')).length
                : alerts.filter(a => a.status===statusTab && a.parameter===(p==='Purity'?'purity':'pressure')).length);
          return (
            <button key={p} onClick={() => setParamTab(p)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors min-h-[44px]"
              style={{ background: active ? '#1E2A4A' : '#fff',
                       color: active ? '#fff' : '#8A94A6',
                       border:'1px solid', borderColor: active ? '#1E2A4A' : '#E8EEFA' }}>
              {Icon && <Icon size={13}/>}
              {p} <span style={{ opacity:0.7 }}>({pCount})</span>
            </button>
          );
        })}
      </div>

      {/* Cards */}
      {filtered.length === 0
        ? <EmptyState/>
        : <div className="flex flex-col gap-4">
            {filtered.map(a => (
              <NurseAlertCard key={a.id} alert={a}
                onAcknowledge={onAcknowledge} onEscalate={onEscalate}/>
            ))}
          </div>
      }
    </div>
  );
}
