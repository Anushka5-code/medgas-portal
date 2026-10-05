/** Small colored badge showing device/alert status. */
export function StatusPill({ status, size = 'sm' }) {
  const cfg = {
    NORMAL:       'bg-green-100 text-green-700',
    LOW:          'bg-amber-100 text-amber-700',
    HIGH:         'bg-red-100 text-red-700',
    ACTIVE:       'bg-red-100 text-red-700',
    ACKNOWLEDGED: 'bg-amber-100 text-amber-700',
    RESOLVED:     'bg-green-100 text-green-700',
    UNKNOWN:      'bg-gray-100 text-gray-500',
  };
  const dot = {
    NORMAL: 'bg-green-500', LOW: 'bg-amber-500', HIGH: 'bg-red-500',
    ACTIVE: 'bg-red-500', ACKNOWLEDGED: 'bg-amber-500', RESOLVED: 'bg-green-500', UNKNOWN: 'bg-gray-400',
  };
  const label = status || 'UNKNOWN';
  const px = size === 'xs' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${px} ${cfg[label] || cfg.UNKNOWN}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot[label] || dot.UNKNOWN}`} />
      {label}
    </span>
  );
}
