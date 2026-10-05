import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useMemo } from 'react';

const DEVICES = ['D001','D002','D003','D004'];

function isHigh(a)   { return a.alert_type === 'HIGH' || a.alert_type === 'HIGH_PRESSURE'; }
function isLow(a)    { return a.alert_type === 'LOW'  || a.alert_type === 'LOW_PRESSURE';  }
function isHiO(a)    { return a.alert_type === 'HIGH_PURITY'; }
function isLoO(a)    { return a.alert_type === 'LOW_PURITY';  }

function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl p-3 text-xs font-medium"
      style={{ background:'#fff', border:'1px solid #E8EEFA', boxShadow:'0 8px 24px rgba(80,110,180,0.12)', minWidth:155 }}>
      <p className="font-bold mb-2" style={{ color:'#1E2A4A' }}>{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.fill }} />
          <span style={{ color:'#8A94A6' }}>{p.name}</span>
          <span className="ml-auto font-bold" style={{ color:'#1E2A4A' }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export function AlertsPerDeviceBar({ alerts = [] }) {
  const data = useMemo(() => DEVICES.map(id => {
    const da = alerts.filter(a => a.device_id === id);
    return {
      device: id,
      'P-High': da.filter(isHigh).length,
      'P-Low':  da.filter(isLow).length,
      'O-High': da.filter(isHiO).length,
      'O-Low':  da.filter(isLoO).length,
    };
  }), [alerts]);

  const hasData = data.some(d => d['P-High'] + d['P-Low'] + d['O-High'] + d['O-Low'] > 0);
  const maxVal  = Math.max(...data.flatMap(d => [d['P-High'], d['P-Low'], d['O-High'], d['O-Low']]), 1);

  const legend = [
    { key:'P-High', color:'#EF4444', label:'Pressure High' },
    { key:'P-Low',  color:'#F5A524', label:'Pressure Low'  },
    { key:'O-High', color:'#8B5CF6', label:'Purity High'   },
    { key:'O-Low',  color:'#F59E0B', label:'Purity Low'    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold" style={{ color:'#1E2A4A' }}>Alerts per Device</h3>
          <p className="text-xs mt-0.5" style={{ color:'#8A94A6' }}>
            {hasData ? `${alerts.length} total · pressure & O₂ purity` : 'No alerts yet — monitoring active'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {legend.map(l => (
            <span key={l.key} className="flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-full"
              style={{ background: l.color + '18', color: l.color }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      <div style={{ height:180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top:8, right:8, left:-20, bottom:0 }} barCategoryGap="25%" barGap={2}>
            <CartesianGrid strokeDasharray="4 4" stroke="#F0F4FF" vertical={false} />
            <XAxis dataKey="device" tick={{ fontSize:11, fill:'#8A94A6', fontFamily:'Poppins,sans-serif' }} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} domain={[0, maxVal + 1]}
              tick={{ fontSize:10, fill:'#8A94A6', fontFamily:'Poppins,sans-serif' }} tickLine={false} axisLine={false} />
            <Tooltip content={<Tip />} cursor={{ fill:'#F8FBFF', radius:4 }} />
            {legend.map(l => (
              <Bar key={l.key} dataKey={l.key} name={l.label}
                fill={l.color} radius={[4,4,0,0]} maxBarSize={16} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Per-device summary */}
      <div className="grid grid-cols-4 gap-2">
        {data.map(d => {
          const total = d['P-High'] + d['P-Low'] + d['O-High'] + d['O-Low'];
          return (
            <div key={d.device} className="rounded-xl p-2.5 text-center"
              style={{ background: total > 0 ? '#FEF2F2' : '#F4F7FC' }}>
              <p className="text-[11px] font-bold" style={{ color:'#1E2A4A' }}>{d.device}</p>
              <p className="text-base font-bold mt-0.5 leading-none"
                style={{ color: total > 0 ? '#EF4444' : '#22C55E' }}>{total}</p>
              <p className="text-[9px] mt-0.5" style={{ color:'#8A94A6' }}>
                {total === 0 ? 'ok' : `P:${d['P-High']+d['P-Low']} O:${d['O-High']+d['O-Low']}`}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
