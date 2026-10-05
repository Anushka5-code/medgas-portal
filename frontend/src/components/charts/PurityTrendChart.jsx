import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';

const DEVICE_COLORS = { D001:'#2F80ED', D002:'#22C55E', D003:'#F5A524', D004:'#F0386B' };
const ALL_DEVICES   = ['D001','D002','D003','D004'];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl p-3 text-xs font-medium"
      style={{ background:'#fff', border:'1px solid #E8EEFA', boxShadow:'0 8px 24px rgba(80,110,180,0.12)', minWidth:140 }}>
      <p className="mb-2" style={{ color:'#8A94A6' }}>{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span style={{ color:'#1E2A4A' }}>{p.dataKey}</span>
          <span className="ml-auto font-bold" style={{ color:'#1E2A4A' }}>
            {p.value != null ? `${Number(p.value).toFixed(1)}%` : '—'}
          </span>
        </div>
      ))}
    </div>
  );
}

/** O₂ Purity trend line chart for all 4 devices. */
export function PurityTrendChart({ data = [], singleDevice }) {
  const devices = singleDevice ? [singleDevice] : ALL_DEVICES;

  if (!data.length) {
    return (
      <div className="flex flex-col h-full gap-3">
        <div>
          <h3 className="text-sm font-semibold" style={{ color:'#1E2A4A' }}>O₂ Purity Trends</h3>
          <p className="text-xs mt-0.5" style={{ color:'#8A94A6' }}>Collecting readings…</p>
        </div>
        <div className="flex-1 flex items-center justify-center" style={{ minHeight:160 }}>
          <p className="text-xs" style={{ color:'#8A94A6' }}>No data yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold" style={{ color:'#1E2A4A' }}>
            {singleDevice ? `${singleDevice} O₂ Purity` : 'O₂ Purity Trends'}
          </h3>
          <p className="text-xs mt-0.5" style={{ color:'#8A94A6' }}>
            Live % · {data.length} data points
          </p>
        </div>
        {!singleDevice && (
          <div className="flex flex-wrap gap-2">
            {devices.map(d => (
              <span key={d} className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full"
                style={{ background:'#F4F7FC', color:'#1E2A4A' }}>
                <span className="w-2 h-2 rounded-full" style={{ background: DEVICE_COLORS[d] }} />
                {d}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0" style={{ minHeight:170 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top:8, right:8, left:-18, bottom:0 }}>
            <CartesianGrid strokeDasharray="4 4" stroke="#F0F4FF" vertical={false} />
            <XAxis dataKey="time"
              tick={{ fontSize:10, fill:'#8A94A6', fontFamily:'Poppins,sans-serif' }}
              tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis domain={[85, 100]}
              tick={{ fontSize:10, fill:'#8A94A6', fontFamily:'Poppins,sans-serif' }}
              tickLine={false} axisLine={false}
              tickFormatter={v => `${v}%`} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={93} stroke="#F5A524" strokeDasharray="5 3"
              label={{ value:'Min 93%', position:'insideTopLeft', fontSize:10, fill:'#F5A524', fontFamily:'Poppins' }} />
            <ReferenceLine y={99} stroke="#8B5CF6" strokeDasharray="5 3"
              label={{ value:'Max 99%', position:'insideTopLeft', fontSize:10, fill:'#8B5CF6', fontFamily:'Poppins' }} />
            {devices.map(d => (
              <Line key={d} type="monotone" dataKey={d}
                stroke={DEVICE_COLORS[d] || '#2F80ED'} strokeWidth={2}
                dot={false} activeDot={{ r:4, strokeWidth:0 }}
                connectNulls isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
