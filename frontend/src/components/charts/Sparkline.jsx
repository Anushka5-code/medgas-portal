import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';

/**
 * Tiny sparkline for a device card.
 * Props: data — number[], color — hex string
 */
export function Sparkline({ data = [], color = '#2F80ED' }) {
  const chartData = data.map((v, i) => ({ i, v }));

  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <Line
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
        <Tooltip
          contentStyle={{ display: 'none' }}
          cursor={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
