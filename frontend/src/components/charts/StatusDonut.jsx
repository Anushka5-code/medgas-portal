import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = { Normal:'#22C55E', Low:'#F5A524', High:'#EF4444' };

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

function DonutPanel({ title, normal, low, high, total, colorScheme }) {
  const data = [
    { name:'Normal', value: normal, fill: COLORS.Normal },
    { name:'Low',    value: low,    fill: COLORS.Low    },
    { name:'High',   value: high,   fill: colorScheme === 'purity' ? '#8B5CF6' : COLORS.High },
  ].filter(d => d.value > 0);
  const chartData = data.length ? data : [{ name:'No data', value:1, fill:'#E8EEFA' }];

  return (
    <div className="flex flex-col gap-2 flex-1">
      <p className="text-xs font-semibold text-center" style={{ color:'#1E2A4A' }}>{title}</p>
      <div className="flex items-center gap-3">
        {/* Donut */}
        <div className="relative shrink-0" style={{ width:110, height:110 }}>
          <ResponsiveContainer width={110} height={110}>
            <PieChart>
              <Pie data={chartData} cx="50%" cy="50%"
                innerRadius={34} outerRadius={50}
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
        <div className="flex flex-col gap-1.5 flex-1">
          {[
            { label:'Normal', count:normal, color:COLORS.Normal, bg:'bg-green-50' },
            { label:'Low',    count:low,    color:COLORS.Low,    bg:'bg-amber-50' },
            { label:'High',   count:high,   color: colorScheme === 'purity' ? '#8B5CF6' : COLORS.High,
              bg: colorScheme === 'purity' ? 'bg-purple-50' : 'bg-red-50' },
          ].map(({ label, count, color, bg }) => (
            <div key={label} className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl ${bg}`}>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="text-[11px] font-medium" style={{ color:'#1E2A4A' }}>{label}</span>
              </div>
              <span className="text-xs font-bold" style={{ color }}>{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Dual StatusDonut — shows Pressure and O₂ Purity side by side.
 */
export function StatusDonut({ pNormal, pLow, pHigh, oNormal, oLow, oHigh, total }) {
  return (
    <div className="flex flex-col gap-3 h-full">
      <div>
        <h3 className="text-sm font-semibold" style={{ color:'#1E2A4A' }}>Device Status</h3>
        <p className="text-xs mt-0.5" style={{ color:'#8A94A6' }}>Pressure & O₂ purity classification</p>
      </div>
      <div className="flex gap-4 flex-1">
        <DonutPanel
          title="Pressure" colorScheme="pressure"
          normal={pNormal} low={pLow} high={pHigh} total={total}
        />
        <div style={{ width:1, background:'#F0F4FF' }} />
        <DonutPanel
          title="O₂ Purity" colorScheme="purity"
          normal={oNormal} low={oLow} high={oHigh} total={total}
        />
      </div>
    </div>
  );
}
