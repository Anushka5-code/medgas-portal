import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts';

const DEVICE_COLORS = {
  D001: '#2F80ED',
  D002: '#22C55E',
  D003: '#F5A524',
  D004: '#F0386B',
};
const ALL_DEVICES = ['D001', 'D002', 'D003', 'D004'];

/* Custom rounded tooltip */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl p-3 text-xs font-medium"
      style={{
        background: '#FFFFFF',
        border: '1px solid #E8EEFA',
        boxShadow: '0 8px 32px rgba(80,110,180,0.14)',
        minWidth: 140,
      }}
    >
      <p className="mb-2" style={{ color: '#8A94A6' }}>{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span style={{ color: '#1E2A4A' }}>{p.dataKey}</span>
          <span className="ml-auto font-bold" style={{ color: '#1E2A4A' }}>
            {p.value !== undefined && p.value !== null ? `${Number(p.value).toFixed(1)} PSI` : '—'}
          </span>
        </div>
      ))}
    </div>
  );
}

/* Legend pills */
function LegendPills({ devices }) {
  return (
    <div className="flex flex-wrap gap-2">
      {devices.map(d => (
        <span
          key={d}
          className="flex items-center gap-1.5 text-[11px] font-medium rounded-full px-2.5 py-1"
          style={{ background: '#F4F7FC', color: '#1E2A4A' }}
        >
          <span className="w-2 h-2 rounded-full" style={{ background: DEVICE_COLORS[d] }} />
          {d}
        </span>
      ))}
    </div>
  );
}

/**
 * PressureTrendChart
 * Props:
 *   data         — [{ time, D001?, D002?, D003?, D004? }]
 *   singleDevice — optional device ID string; shows only that device
 */
export function PressureTrendChart({ data = [], singleDevice }) {
  const devices = singleDevice ? [singleDevice] : ALL_DEVICES;

  // Guard against completely empty data
  if (!data.length) {
    return (
      <div className="flex flex-col h-full gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: '#1E2A4A' }}>
              {singleDevice ? `${singleDevice} Pressure` : 'Pressure Trends'}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: '#8A94A6' }}>Live PSI readings</p>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center" style={{ minHeight: 180 }}>
          <p className="text-xs" style={{ color: '#8A94A6' }}>Collecting readings…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: '#1E2A4A' }}>
            {singleDevice ? `${singleDevice} Pressure History` : 'Pressure Trends'}
          </h3>
          <p className="text-xs mt-0.5" style={{ color: '#8A94A6' }}>
            Live PSI · {data.length} data points
          </p>
        </div>
        {!singleDevice && <LegendPills devices={devices} />}
      </div>

      <div className="flex-1 min-h-0" style={{ minHeight: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="4 4" stroke="#F0F4FF" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: '#8A94A6', fontFamily: 'Poppins, sans-serif' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 140]}
              tick={{ fontSize: 10, fill: '#8A94A6', fontFamily: 'Poppins, sans-serif' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Safe-zone band hints */}
            <ReferenceLine
              y={40}
              stroke="#F5A524"
              strokeDasharray="5 3"
              label={{ value: 'Min 40', position: 'insideTopLeft', fontSize: 10, fill: '#F5A524', fontFamily: 'Poppins' }}
            />
            <ReferenceLine
              y={100}
              stroke="#EF4444"
              strokeDasharray="5 3"
              label={{ value: 'Max 100', position: 'insideTopLeft', fontSize: 10, fill: '#EF4444', fontFamily: 'Poppins' }}
            />

            {devices.map(d => (
              <Line
                key={d}
                type="monotone"
                dataKey={d}
                stroke={DEVICE_COLORS[d] || '#2F80ED'}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
