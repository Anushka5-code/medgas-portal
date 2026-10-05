import { useState, useMemo } from 'react';
import { CheckCircle2, Bell, History, ChevronDown, ChevronUp,
         Activity, AlertTriangle, RefreshCw } from 'lucide-react';
import { StatusBanner }   from '../components/StatusBanner';
import { BedCard }        from '../components/BedCard';
import { NurseAlertCard } from '../components/NurseAlertCard';

/* ─── Activity helpers ───────────────────────────────────────────────── */
const TYPE_CFG = {
  alert_created:      { color:'text-red-500',   bg:'bg-red-50',   Icon: AlertTriangle },
  alert_acknowledged: { color:'text-amber-500', bg:'bg-amber-50', Icon: CheckCircle2  },
  alert_resolved:     { color:'text-green-500', bg:'bg-green-50', Icon: CheckCircle2  },
  reading:            { color:'text-blue-500',  bg:'bg-blue-50',  Icon: Activity      },
  default:            { color:'text-slate-400', bg:'bg-slate-50', Icon: RefreshCw     },
};

function relTime(raw) {
  if (!raw) return 'just now';
  const d   = raw instanceof Date ? raw : new Date(raw);
  if (isNaN(d)) return 'just now';
  const s   = Math.floor((Date.now() - d) / 1000);
  if (s < 5)   return 'just now';
  if (s < 60)  return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

/**
 * Collapse identical auto-resolved/auto-escalated bursts for the same device
 * within 10 seconds into one item with a "×N" count.
 */
function collapseActivities(items) {
  const out = [];
  for (const act of items) {
    const last = out[out.length - 1];
    const isBurst =
      last &&
      last.type     === act.type &&
      last.deviceId === act.deviceId &&
      last.message  === act.message &&
      Math.abs((new Date(act.time) - new Date(last.time)) / 1000) < 10;

    if (isBurst) {
      last._count = (last._count || 1) + 1;
    } else {
      out.push({ ...act, _count: 1 });
    }
  }
  return out;
}

/* ─── Full-width Activity strip ─────────────────────────────────────── */
function ActivityStrip({ activities }) {
  const [expanded, setExpanded] = useState(false);
  const DEFAULT_SHOW = 6;

  const collapsed = useMemo(() => collapseActivities(activities), [activities]);
  const visible   = expanded ? collapsed : collapsed.slice(0, DEFAULT_SHOW);
  const hasMore   = collapsed.length > DEFAULT_SHOW;

  return (
    <div className="bg-white rounded-2xl p-5"
      style={{ boxShadow:'0 4px 20px rgba(80,110,180,0.08)' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-[#1E2A4A]">Recent Activities</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-[#8A94A6] font-semibold">
            {collapsed.length} event{collapsed.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {collapsed.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6">
          <Activity size={26} className="text-slate-200"/>
          <p className="text-xs text-[#8A94A6]">No activity yet — waiting for live readings…</p>
        </div>
      ) : (
        <>
          {/* 2-col grid (3-col at 2xl) */}
          <ul className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-x-6 gap-y-1"
            aria-label="Recent activity events">
            {visible.map((act) => {
              const cfg  = TYPE_CFG[act.type] || TYPE_CFG.default;
              const { Icon } = cfg;
              return (
                <li key={act.id} className="flex items-start gap-2.5 py-2 min-w-0">
                  <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${cfg.bg}`}>
                    <Icon size={13} className={cfg.color} strokeWidth={2.2}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium leading-snug text-[#1E2A4A] truncate">
                      {act.message}
                      {act._count > 1 && (
                        <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-[#8A94A6]">
                          ×{act._count}
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-[#8A94A6] mt-0.5">{relTime(act.time)}</p>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Show more / less toggle */}
          {hasMore && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[#2F80ED] hover:text-blue-700 transition-colors"
            >
              {expanded
                ? <><ChevronUp size={13}/> Show less</>
                : <><ChevronDown size={13}/> Show {collapsed.length - DEFAULT_SHOW} more</>}
            </button>
          )}
        </>
      )}
    </div>
  );
}

/* ─── Needs Attention panel ─────────────────────────────────────────── */
function NeedsAttention({ activeAlerts, onAcknowledge, onEscalate }) {
  return (
    <div className="bg-white rounded-2xl p-5 self-stretch sticky top-4 flex flex-col"
      style={{ boxShadow:'0 4px 20px rgba(80,110,180,0.08)' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h3 className="text-sm font-bold text-[#1E2A4A] flex items-center gap-2">
          <Bell size={15} className={activeAlerts.length > 0 ? 'text-[#F0386B]' : 'text-[#8A94A6]'}/>
          Needs Attention
        </h3>
        {activeAlerts.length > 0 && (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
            {activeAlerts.length}
          </span>
        )}
      </div>

      {/* Body */}
      {activeAlerts.length === 0 ? (
        /* Vertically centred empty state */
        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-6">
          <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
            <CheckCircle2 size={24} className="text-green-400"/>
          </div>
          <p className="text-xs text-[#8A94A6] text-center font-medium">
            All clear — no active alerts
          </p>
        </div>
      ) : (
        /* Scrollable list if many alerts */
        <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-0.5"
          style={{ maxHeight:'calc(100vh - 280px)' }}>
          {activeAlerts.map(a => (
            <NurseAlertCard key={a.id} alert={a}
              onAcknowledge={onAcknowledge} onEscalate={onEscalate}/>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── WardPage ───────────────────────────────────────────────────────── */
export function WardPage({ devices, alerts, activities, stats, lastReceived,
                           onAcknowledge, onEscalate, searchQuery }) {

  const devList = Object.values(devices);
  const sorted  = [...devList].sort((a, b) => {
    const o = { HIGH:0, LOW:1, NORMAL:2, UNKNOWN:3 };
    return (o[a.status] ?? 3) - (o[b.status] ?? 3);
  });
  const filtered = sorted.filter(d =>
    !searchQuery ||
    d.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.bed_label || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeAlerts = alerts
    .filter(a => a.status === 'ACTIVE')
    .sort((a, b) => {
      const hi = x => x.alert_type?.includes('HIGH') ? 0 : 1;
      return hi(a) - hi(b) ||
        new Date(a.started_at || a.created_at) - new Date(b.started_at || b.created_at);
    });

  return (
    <div className="p-5 flex flex-col gap-6">

      {/* 1. Status banner */}
      <StatusBanner alerts={alerts} lastReceived={lastReceived}/>

      {/* 2. Quick stats + safe-range chips */}
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-3">
          {[
            { label:'Devices', value: stats.total,  color:'#2F80ED', bg:'#EAF3FF' },
            { label:'Normal',  value: stats.normal, color:'#16A34A', bg:'#F0FDF4' },
            { label:'Low',     value: stats.low,    color:'#D97706', bg:'#FFFBEB' },
            { label:'High',    value: stats.high,   color:'#DC2626', bg:'#FEF2F2' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className="rounded-2xl p-4 text-center"
              style={{ background: bg, boxShadow:'0 2px 12px rgba(80,110,180,0.06)' }}>
              <p className="text-2xl font-bold" style={{ color }}>{value}</p>
              <p className="text-xs font-semibold text-[#8A94A6] mt-0.5">{label}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-xl"
            style={{ background:'#EAF3FF', color:'#2F80ED' }}>
            Pressure safe: 40–100 PSI
          </span>
          <span className="text-xs font-semibold px-3 py-1.5 rounded-xl"
            style={{ background:'#F0FDF4', color:'#16A34A' }}>
            O₂ Purity safe: 93–99%
          </span>
        </div>
      </div>

      {/* 3. Main row: bed grid (70%) + Needs Attention (30%) */}
      {/*    Below 1280px: Needs Attention full-width on top, then bed grid */}
      <div className="flex flex-col xl:grid xl:grid-cols-[1fr_320px] gap-6 items-start">

        {/* Needs Attention — full-width on mobile, stacks above beds */}
        <div className="xl:hidden">
          <NeedsAttention
            activeAlerts={activeAlerts}
            onAcknowledge={onAcknowledge}
            onEscalate={onEscalate}
          />
        </div>

        {/* Bed cards grid */}
        <div className="min-w-0">
          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl py-12 text-center text-sm text-[#8A94A6]"
              style={{ boxShadow:'0 4px 20px rgba(80,110,180,0.08)' }}>
              No devices found.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filtered.map(d => <BedCard key={d.id} device={d}/>)}
            </div>
          )}
        </div>

        {/* Needs Attention — sticky right panel, desktop only */}
        <div className="hidden xl:block">
          <NeedsAttention
            activeAlerts={activeAlerts}
            onAcknowledge={onAcknowledge}
            onEscalate={onEscalate}
          />
        </div>
      </div>

      {/* 4. Recent Activities — full width */}
      <ActivityStrip activities={activities}/>

    </div>
  );
}
