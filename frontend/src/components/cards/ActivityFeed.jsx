import { AlertTriangle, CheckCircle, Bell, Activity, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

const TYPE_CONFIG = {
  alert_created:      { Icon: Bell,          bg: 'bg-red-50',    color: 'text-red-500',    label: 'Alert' },
  alert_acknowledged: { Icon: AlertTriangle, bg: 'bg-amber-50',  color: 'text-amber-500',  label: 'Ack'   },
  alert_resolved:     { Icon: CheckCircle,   bg: 'bg-green-50',  color: 'text-green-500',  label: 'Resolved' },
  reading:            { Icon: Activity,      bg: 'bg-blue-50',   color: 'text-blue-500',   label: 'Reading'  },
  default:            { Icon: RefreshCw,     bg: 'bg-slate-50',  color: 'text-slate-400',  label: 'Event'    },
};

/**
 * Safe relative-time formatter — never produces "NaN" or crashes.
 * Accepts a Date object, ISO string, or anything new Date() can parse.
 */
function relativeTime(raw) {
  if (!raw) return 'just now';
  const d = raw instanceof Date ? raw : new Date(raw);
  if (isNaN(d.getTime())) return 'just now';

  const diff = Date.now() - d.getTime();
  if (diff < 0)     return 'just now';          // clock skew guard
  const s = Math.floor(diff / 1000);
  if (s < 5)        return 'just now';
  if (s < 60)       return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)       return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)       return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/**
 * Vertical timeline activity feed.
 * Props: activities — [{ id, type, deviceId, message, time }]
 */
export function ActivityFeed({ activities = [] }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold" style={{ color: '#1E2A4A' }}>Recent Activities</h3>
        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100" style={{ color: '#8A94A6' }}>
          {activities.length} event{activities.length !== 1 ? 's' : ''}
        </span>
      </div>

      {activities.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8">
          <Activity size={28} className="text-slate-200" />
          <p className="text-xs text-center" style={{ color: '#8A94A6' }}>
            No activity yet — waiting for live readings…
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-0" aria-label="Recent system activities">
          {activities.slice(0, 10).map((act, i) => {
            const cfg   = TYPE_CONFIG[act.type] || TYPE_CONFIG.default;
            const { Icon } = cfg;
            const isLast = i === Math.min(activities.length, 10) - 1;

            return (
              <li key={act.id} className="flex items-start gap-3 relative">
                {/* Vertical connector line */}
                {!isLast && (
                  <div
                    className="absolute left-4 top-8 bottom-0 w-px"
                    style={{ background: '#F0F4FF', zIndex: 0 }}
                    aria-hidden="true"
                  />
                )}

                {/* Icon */}
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 relative z-10 ${cfg.bg}`}
                  aria-hidden="true"
                >
                  <Icon size={13} className={cfg.color} strokeWidth={2.2} />
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0 pb-4 pt-0.5">
                  <p
                    className="text-xs font-medium leading-snug"
                    style={{ color: '#1E2A4A' }}
                  >
                    {act.message}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: '#8A94A6' }}>
                    {relativeTime(act.time)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
