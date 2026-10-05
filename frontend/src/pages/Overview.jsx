import { Monitor, Bell, Droplets, Wind } from 'lucide-react';
import { HeroBanner }         from '../components/cards/HeroBanner';
import { DeviceCard }         from '../components/cards/DeviceCard';
import { ActivityFeed }       from '../components/cards/ActivityFeed';
import { SystemInfoCard }     from '../components/cards/SystemInfoCard';
import { EscalationsPanel }   from '../components/cards/EscalationsPanel';
import { PressureTrendChart } from '../components/charts/PressureTrendChart';
import { PurityTrendChart }   from '../components/charts/PurityTrendChart';
import { StatusDonut }        from '../components/charts/StatusDonut';
import { AlertsPerDeviceBar } from '../components/charts/AlertsPerDeviceBar';

const CARD = { boxShadow:'0 4px 24px rgba(80,110,180,0.08)' };

export function Overview({
  devices, trendData, purityTrend, alerts, activities,
  stats, connected, lastReceived, rpm,
  onRespond, onResolve,
}) {
  const devList = Object.values(devices);
  const sorted  = [...devList].sort((a, b) => {
    const o = { HIGH:0, LOW:1, NORMAL:2, UNKNOWN:3 };
    return (o[a.status] ?? 3) - (o[b.status] ?? 3);
  });

  const problemCount = stats.high + stats.low;

  return (
    <div className="p-5 flex flex-col gap-5">
      <div className="flex gap-5 items-start flex-col xl:flex-row">

        {/* ── Main column ─────────────────────────────── */}
        <div className="flex flex-col gap-5 flex-1 min-w-0">
          <HeroBanner stats={stats} lastReceived={lastReceived} />

          {/* Trend charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl p-5" style={{ ...CARD, minHeight:290 }}>
              <PressureTrendChart data={trendData} />
            </div>
            <div className="bg-white rounded-2xl p-5" style={{ ...CARD, minHeight:290 }}>
              <PurityTrendChart data={purityTrend} />
            </div>
          </div>

          {/* Status donuts */}
          <div className="bg-white rounded-2xl p-5" style={{ ...CARD, minHeight:260 }}>
            <StatusDonut
              pNormal={stats.pNormal} pLow={stats.pLow} pHigh={stats.pHigh}
              oNormal={stats.oNormal} oLow={stats.oLow} oHigh={stats.oHigh}
              total={stats.total}
            />
          </div>

          {/* Alerts per device */}
          <div className="bg-white rounded-2xl p-5" style={{ ...CARD, minHeight:220 }}>
            <AlertsPerDeviceBar alerts={alerts} />
          </div>

          {/* Device cards */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold" style={{ color:'#1E2A4A' }}>Devices</h2>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{
                  background: problemCount > 0 ? '#FEE2E2' : '#DCFCE7',
                  color:      problemCount > 0 ? '#EF4444' : '#16A34A',
                }}>
                {problemCount > 0 ? `${problemCount} abnormal` : 'All normal'}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {sorted.length === 0
                ? ['D001','D002','D003','D004'].map(id => (
                    <div key={id} className="rounded-2xl animate-pulse"
                      style={{ height:260, background:'#F4F7FC' }} />
                  ))
                : sorted.map((dev) => (
                    <DeviceCard
                      key={dev.id}
                      device={dev}
                      index={['D001','D002','D003','D004'].indexOf(dev.id)}
                    />
                  ))
              }
            </div>
          </div>
        </div>

        {/* ── Right column ────────────────────────────── */}
        <div className="flex flex-col gap-5 w-full xl:w-72 shrink-0">

          {/* Statistics */}
          <div className="bg-white rounded-2xl p-5" style={CARD}>
            <h3 className="text-sm font-semibold mb-4" style={{ color:'#1E2A4A' }}>Statistics</h3>

            <div className="flex items-center gap-1.5 mb-2">
              <Wind size={11} color="#2F80ED" />
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color:'#8A94A6' }}>Pressure</span>
            </div>
            <div className="flex flex-col gap-1.5 mb-4">
              {[
                { label:'Normal', value: stats.pNormal, color:'#22C55E', bg:'#F0FDF4' },
                { label:'Low',    value: stats.pLow,    color:'#F5A524', bg:'#FFFBEB' },
                { label:'High',   value: stats.pHigh,   color:'#EF4444', bg:'#FEF2F2' },
              ].map(({ label, value, color, bg }) => (
                <div key={label} className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: bg }}>
                  <span className="text-xs font-medium" style={{ color:'#1E2A4A' }}>{label}</span>
                  <span className="text-sm font-bold" style={{ color }}>{value ?? 0}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-1.5 mb-2">
              <Droplets size={11} color="#22C55E" />
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color:'#8A94A6' }}>O₂ Purity</span>
            </div>
            <div className="flex flex-col gap-1.5 mb-4">
              {[
                { label:'Normal', value: stats.oNormal, color:'#22C55E', bg:'#F0FDF4' },
                { label:'Low',    value: stats.oLow,    color:'#F59E0B', bg:'#FFFBEB' },
                { label:'High',   value: stats.oHigh,   color:'#8B5CF6', bg:'#F5F3FF' },
              ].map(({ label, value, color, bg }) => (
                <div key={`o-${label}`} className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: bg }}>
                  <span className="text-xs font-medium" style={{ color:'#1E2A4A' }}>{label}</span>
                  <span className="text-sm font-bold" style={{ color }}>{value ?? 0}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-1.5 mb-2">
              <Bell size={11} color="#EF4444" />
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color:'#8A94A6' }}>Active Alerts</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {[
                { label:'All Alerts',  value: stats.activeAlerts,   color:'#EF4444', bg: stats.activeAlerts   > 0 ? '#FEF2F2' : '#F4F7FC' },
                { label:'Pressure',    value: stats.pressureAlerts, color:'#F5A524', bg: stats.pressureAlerts > 0 ? '#FFFBEB' : '#F4F7FC' },
                { label:'O₂ Purity',   value: stats.purityAlerts,   color:'#8B5CF6', bg: stats.purityAlerts   > 0 ? '#F5F3FF' : '#F4F7FC' },
              ].map(({ label, value, color, bg }) => (
                <div key={`a-${label}`} className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: bg }}>
                  <span className="text-xs font-medium" style={{ color:'#1E2A4A' }}>{label}</span>
                  <span className="text-sm font-bold" style={{ color: value > 0 ? color : '#22C55E' }}>{value ?? 0}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Escalations panel */}
          <div className="bg-white rounded-2xl p-5" style={CARD}>
            <EscalationsPanel alerts={alerts} onRespond={onRespond} onResolve={onResolve} />
          </div>

          {/* Activity feed */}
          <div className="bg-white rounded-2xl p-5" style={CARD}>
            <ActivityFeed activities={activities} />
          </div>

          {/* System info */}
          <div className="bg-white rounded-2xl p-5" style={CARD}>
            <SystemInfoCard connected={connected} lastReceived={lastReceived} rpm={rpm} />
          </div>
        </div>
      </div>
    </div>
  );
}
