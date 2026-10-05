import { useState, useMemo } from 'react';
import { Eye, TrendingUp, TrendingDown, Minus, Wind, Droplets } from 'lucide-react';
import { StatusPill }        from '../components/ui/StatusPill';
import { Drawer }            from '../components/ui/Drawer';
import { PressureTrendChart }from '../components/charts/PressureTrendChart';
import { PurityTrendChart }  from '../components/charts/PurityTrendChart';
import { AlertCard }         from '../components/cards/AlertCard';

const STATUS_FILTERS = ['All','Normal','Low','High'];

function safeLocale(raw) {
  if (!raw) return '—';
  const d = raw instanceof Date ? raw : new Date(raw);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}
function fmt(v, unit='') {
  return (v !== null && v !== undefined && !isNaN(v)) ? `${Number(v).toFixed(1)}${unit}` : '—';
}

function DualBar({ pValue, oValue }) {
  const pPct = pValue != null ? Math.min(Math.max(pValue/150*100,0),100) : null;
  const oPct = oValue != null ? Math.min(Math.max((oValue-85)/15*100,0),100) : null;
  const pColor = pValue < 40 ? '#F5A524' : pValue > 100 ? '#EF4444' : '#22C55E';
  const oColor = oValue < 93 ? '#F59E0B' : oValue > 99 ? '#8B5CF6' : '#22C55E';

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex items-center gap-2">
        <Wind size={10} color="#8A94A6" />
        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          {pPct !== null && <div className="h-full rounded-full transition-all duration-500"
            style={{ width:`${pPct}%`, background:pColor }} />}
        </div>
        <span className="text-[10px] font-semibold w-16 text-right" style={{ color:'#1E2A4A' }}>
          {fmt(pValue,' PSI')}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Droplets size={10} color="#8A94A6" />
        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          {oPct !== null && <div className="h-full rounded-full transition-all duration-500"
            style={{ width:`${oPct}%`, background:oColor }} />}
        </div>
        <span className="text-[10px] font-semibold w-16 text-right" style={{ color:'#1E2A4A' }}>
          {fmt(oValue,'%')}
        </span>
      </div>
    </div>
  );
}

function TrendIcon({ sparkline = [] }) {
  if (sparkline.length < 2) return <Minus size={13} color="#8A94A6" />;
  const l = sparkline[sparkline.length-1], p = sparkline[sparkline.length-2];
  if (l > p + 0.5) return <TrendingUp  size={13} color="#EF4444" />;
  if (l < p - 0.5) return <TrendingDown size={13} color="#22C55E" />;
  return <Minus size={13} color="#8A94A6" />;
}

/* ── Device detail drawer ─────────────────────────────── */
function DeviceDetail({ deviceId, devices, alerts, trendData, purityTrend, onAcknowledge, onResolve }) {
  const device    = devices[deviceId];
  const devAlerts = alerts.filter(a => a.device_id === deviceId);
  const pAlerts   = devAlerts.filter(a => a.parameter === 'pressure');
  const oAlerts   = devAlerts.filter(a => a.parameter === 'purity');

  const devPTrend = useMemo(() =>
    trendData.filter(pt => pt[deviceId] != null).map(pt => ({ time:pt.time, [deviceId]:pt[deviceId] })),
    [trendData, deviceId]);
  const devOTrend = useMemo(() =>
    purityTrend.filter(pt => pt[deviceId] != null).map(pt => ({ time:pt.time, [deviceId]:pt[deviceId] })),
    [purityTrend, deviceId]);

  if (!device) return <p className="text-sm text-center py-8" style={{ color:'#8A94A6' }}>Loading…</p>;

  const pVals = (device.sparkline_p||[]).filter(v => !isNaN(v));
  const oVals = (device.sparkline_o||[]).filter(v => !isNaN(v));

  const stat3 = (vals) => vals.length ? {
    min: Math.min(...vals).toFixed(1),
    avg: (vals.reduce((s,v)=>s+v,0)/vals.length).toFixed(1),
    max: Math.max(...vals).toFixed(1),
  } : { min:'—', avg:'—', max:'—' };

  const pS = stat3(pVals);
  const oS = stat3(oVals);

  return (
    <div className="flex flex-col gap-6">
      {/* Live values */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { Icon:Wind,     label:'Pressure', value: fmt(device.current_pressure,' PSI'), status: device.pressure_status,
            color: device.pressure_status==='HIGH'?'#EF4444': device.pressure_status==='LOW'?'#F5A524':'#22C55E' },
          { Icon:Droplets, label:'O₂ Purity', value: fmt(device.current_purity,'%'), status: device.purity_status,
            color: device.purity_status==='HIGH'?'#8B5CF6': device.purity_status==='LOW'?'#F59E0B':'#22C55E' },
        ].map(({ Icon, label, value, status, color }) => (
          <div key={label} className="rounded-2xl p-3 flex flex-col gap-1" style={{ background:'#F4F7FC' }}>
            <div className="flex items-center gap-1.5">
              <Icon size={12} color="#8A94A6" />
              <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color:'#8A94A6' }}>{label}</span>
            </div>
            <p className="text-xl font-bold leading-none" style={{ color }}>{value}</p>
            <StatusPill status={status} size="xs" />
          </div>
        ))}
      </div>

      {/* Min/Avg/Max — Pressure */}
      <div>
        <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color:'#1E2A4A' }}>
          <Wind size={12} /> Pressure Stats (PSI)
        </p>
        <div className="grid grid-cols-3 gap-2">
          {[['Min',pS.min,'#F5A524'],['Avg',pS.avg,'#2F80ED'],['Max',pS.max,'#EF4444']].map(([l,v,c]) => (
            <div key={l} className="rounded-xl p-2.5 text-center" style={{ background:'#F4F7FC' }}>
              <p className="text-base font-bold" style={{ color:c }}>{v}</p>
              <p className="text-[10px]" style={{ color:'#8A94A6' }}>{l} PSI</p>
            </div>
          ))}
        </div>
      </div>

      {/* Min/Avg/Max — Purity */}
      <div>
        <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color:'#1E2A4A' }}>
          <Droplets size={12} /> O₂ Purity Stats (%)
        </p>
        <div className="grid grid-cols-3 gap-2">
          {[['Min',oS.min,'#F59E0B'],['Avg',oS.avg,'#22C55E'],['Max',oS.max,'#8B5CF6']].map(([l,v,c]) => (
            <div key={l} className="rounded-xl p-2.5 text-center" style={{ background:'#F4F7FC' }}>
              <p className="text-base font-bold" style={{ color:c }}>{v}</p>
              <p className="text-[10px]" style={{ color:'#8A94A6' }}>{l} %</p>
            </div>
          ))}
        </div>
      </div>

      {/* Charts */}
      {devPTrend.length >= 2 && (
        <div style={{ height:180 }}><PressureTrendChart data={devPTrend} singleDevice={deviceId} /></div>
      )}
      {devOTrend.length >= 2 && (
        <div style={{ height:180 }}><PurityTrendChart data={devOTrend} singleDevice={deviceId} /></div>
      )}

      {/* Alert history */}
      <div>
        <p className="text-xs font-semibold mb-3" style={{ color:'#1E2A4A' }}>
          Alert History ({devAlerts.length})
          <span className="ml-2 font-normal text-[11px]" style={{ color:'#8A94A6' }}>
            P:{pAlerts.length} · O₂:{oAlerts.length}
          </span>
        </p>
        {devAlerts.length === 0
          ? <div className="rounded-xl py-5 text-center" style={{ background:'#F4F7FC' }}>
              <p className="text-xs" style={{ color:'#8A94A6' }}>No alerts for this device.</p>
            </div>
          : <div className="flex flex-col gap-3">
              {devAlerts.slice(0,6).map(a => (
                <AlertCard key={a.id} alert={a} onAcknowledge={onAcknowledge} onResolve={onResolve} />
              ))}
            </div>
        }
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────── */
export function Devices({ devices, alerts, trendData, purityTrend, searchQuery, onAcknowledge, onResolve }) {
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedId,   setSelectedId]   = useState(null);

  const devList = useMemo(() => {
    let list = Object.values(devices);
    if (statusFilter !== 'All') list = list.filter(d => d.status === statusFilter.toUpperCase());
    if (searchQuery) list = list.filter(d => d.id.toLowerCase().includes(searchQuery.toLowerCase()));
    const o = { HIGH:0, LOW:1, NORMAL:2, UNKNOWN:3 };
    return list.sort((a,b) => (o[a.status]??3) - (o[b.status]??3));
  }, [devices, statusFilter, searchQuery]);

  return (
    <div className="p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold" style={{ color:'#1E2A4A' }}>Devices</h2>
          <p className="text-xs mt-0.5" style={{ color:'#8A94A6' }}>
            {devList.length} device{devList.length!==1?'s':''} · pressure & O₂ purity
          </p>
        </div>
        <div className="flex gap-2 flex-wrap" role="group" aria-label="Filter by status">
          {STATUS_FILTERS.map(f => {
            const count = f==='All'
              ? Object.values(devices).length
              : Object.values(devices).filter(d=>d.status===f.toUpperCase()).length;
            return (
              <button key={f} onClick={()=>setStatusFilter(f)} aria-pressed={statusFilter===f}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
                style={{
                  background: statusFilter===f ? '#2F80ED' : '#fff',
                  color:      statusFilter===f ? '#fff' : '#8A94A6',
                  border:'1px solid', borderColor: statusFilter===f ? '#2F80ED' : '#E8EEFA',
                }}>
                {f}
                <span className="px-1.5 py-0.5 rounded-full text-[10px] leading-none"
                  style={{ background: statusFilter===f ? 'rgba(255,255,255,0.25)' : '#F4F7FC',
                           color: statusFilter===f ? '#fff' : '#8A94A6' }}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow:'0 4px 24px rgba(80,110,180,0.08)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Devices table">
            <thead>
              <tr style={{ borderBottom:'1px solid #F4F7FC' }}>
                {['Device','Pressure & O₂ Purity','Trend','Status','Last Updated',''].map(h => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap"
                    style={{ color:'#8A94A6' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {devList.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-sm" style={{ color:'#8A94A6' }}>
                  No devices match the filter.
                </td></tr>
              ) : devList.map(dev => (
                <tr key={dev.id} onClick={()=>setSelectedId(dev.id)}
                  className="group cursor-pointer transition-colors"
                  style={{ borderBottom:'1px solid #F4F7FC' }}
                  onMouseEnter={e=>e.currentTarget.style.background='#F8FBFF'}
                  onMouseLeave={e=>e.currentTarget.style.background=''}>
                  <td className="px-5 py-3.5 font-bold" style={{ color:'#1E2A4A' }}>{dev.id}</td>
                  <td className="px-5 py-3.5 w-60">
                    <DualBar pValue={dev.current_pressure} oValue={dev.current_purity} />
                  </td>
                  <td className="px-5 py-3.5">
                    <TrendIcon sparkline={dev.sparkline_p} />
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-col gap-1">
                      <StatusPill status={dev.pressure_status} size="xs" />
                      <StatusPill status={dev.purity_status}   size="xs" />
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-xs" style={{ color:'#8A94A6' }}>
                    {safeLocale(dev.last_updated)}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button aria-label={`View ${dev.id}`}
                      className="flex items-center gap-1.5 text-xs font-semibold ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color:'#2F80ED' }}>
                      <Eye size={13} /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Drawer open={!!selectedId} onClose={()=>setSelectedId(null)}
        title={selectedId ? `Device ${selectedId}` : ''}>
        {selectedId && (
          <DeviceDetail
            deviceId={selectedId}
            devices={devices} alerts={alerts}
            trendData={trendData} purityTrend={purityTrend}
            onAcknowledge={onAcknowledge} onResolve={onResolve}
          />
        )}
      </Drawer>
    </div>
  );
}
