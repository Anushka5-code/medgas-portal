import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = { Normal:'#22C55E', Low:'#F59E0B', High:'#8B5CF6' };

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-white border border-slate-100 rounded-xl shadow-hover px-3 py-2 text-xs font-medium">
      <span style={{ color: d.payload.fill }}>{d.name}</span>
      <span className="ml-2 font-bold" style={{ color:'#1E2A4A' }}>{d.value} device{d.value !== 1 ? 's' : ''}</span>
    </div>
  );
}

/**
 * O₂ Purity StatusDonut — single donut for oxygen purity classification.
 */
export function StatusDonut({ oNormal, oLow, oHigh, total }) {
  const data = [
    { name:'Normal', value: oNormal, fill: COLORS.Normal },
    { name:'Low',    value: oLow,    fill: COLORS.Low    },
    { name:'High',   value: oHigh,   fill: COLORS.High   },
  ].filter(d => d.value > 0);
  const chartData = data.length ? data : [{ name:'No data', value:1, fill:'#E8EEFA' }];

  return (
    <div className="flex flex-col gap-3 h-full">
      <div>
        <h3 className="text-sm font-semibold" style={{ color:'#1E2A4A' }}>Device O₂ Status</h3>
        <p className="text-xs mt-0.5" style={{ color:'#8A94A6' }}>Oxygen purity classification</p>
      </div>
      <div className="flex items-center gap-4 flex-1">
        {/* Donut */}
        <div className="relative shrink-0" style={{ width:120, height:120 }}>
          <ResponsiveContainer width={120} height={120}>
            <PieChart>
              <Pie data={chartData} cx="50%" cy="50%"
                innerRadius={36} outerRadius={54}
                paddingAngle={data.length > 1 ? 3 : 0}
                dataKey="value" strokeWidth={0} cornerRadius={3}>
                {chartData.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xl font-bold" style={{ color:'#1E2A4A' }}>{total}</span>
            <span className="text-[9px] font-medium" style={{ color:'#8A94A6' }}>Devices</span>
          </div>
        </div>
        {/* Legend */}
        <div className="flex flex-col gap-2 flex-1">
          {[
            { label:'Normal', count:oNormal, color:COLORS.Normal, bg:'bg-green-50' },
            { label:'Low O₂', count:oLow,    color:COLORS.Low,    bg:'bg-amber-50' },
            { label:'High O₂',count:oHigh,   color:COLORS.High,   bg:'bg-purple-50' },
          ].map(({ label, count, color, bg }) => (
            <div key={label} className={`flex items-center justify-between px-3 py-2 rounded-xl ${bg}`}>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="text-xs font-medium" style={{ color:'#1E2A4A' }}>{label}</span>
              </div>
              <span className="text-sm font-bold" style={{ color }}>{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
