import { Wifi, WifiOff, Clock, Gauge, ShieldCheck, Droplets } from 'lucide-react';

export function SystemInfoCard({ connected, lastReceived, rpm }) {
  const safeTime = (d) => {
    if (!d) return '—';
    const dt = d instanceof Date ? d : new Date(d);
    return isNaN(dt.getTime()) ? '—'
      : dt.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  };

  const rows = [
    {
      Icon: connected ? Wifi : WifiOff,
      label: 'WebSocket',
      value: connected ? 'Connected' : 'Disconnected',
      valueColor: connected ? '#22C55E' : '#EF4444',
      iconBg: connected ? 'bg-green-50' : 'bg-red-50',
      iconColor: connected ? 'text-green-500' : 'text-red-500',
    },
    {
      Icon: Clock,
      label: 'Last Reading',
      value: safeTime(lastReceived),
      valueColor: '#1E2A4A',
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-500',
    },
    {
      Icon: Gauge,
      label: 'Readings / min',
      value: String(rpm ?? 0),
      valueColor: '#1E2A4A',
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-500',
    },
    {
      Icon: ShieldCheck,
      label: 'Pressure Range',
      value: '40–100 PSI',
      valueColor: '#22C55E',
      iconBg: 'bg-green-50',
      iconColor: 'text-green-500',
    },
    {
      Icon: Droplets,
      label: 'O₂ Purity Range',
      value: '93–99 %',
      valueColor: '#2F80ED',
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-500',
    },
  ];

  return (
    <div>
      <h3 className="text-sm font-semibold mb-4" style={{ color:'#1E2A4A' }}>System Info</h3>
      <div className="flex flex-col gap-3">
        {rows.map(({ Icon, label, value, valueColor, iconBg, iconColor }) => (
          <div key={label} className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
              <Icon size={15} className={iconColor} strokeWidth={1.8} />
            </div>
            <div className="flex-1 flex items-center justify-between gap-2">
              <span className="text-xs font-medium" style={{ color:'#8A94A6' }}>{label}</span>
              <span className="text-xs font-semibold" style={{ color: valueColor }}>{value}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
