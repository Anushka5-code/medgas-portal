import { useEffect, useRef } from 'react';

/**
 * Single stat tile with colored icon, big number, label.
 * Props: value, label, Icon, iconBg, iconColor, change (optional trend text)
 */
export function StatCard({ value, label, Icon, iconBg, iconColor, change }) {
  const numRef  = useRef(null);
  const prevVal = useRef(value);

  // Trigger count-up animation when value changes
  useEffect(() => {
    if (prevVal.current !== value && numRef.current) {
      numRef.current.classList.remove('count-up');
      void numRef.current.offsetWidth; // reflow
      numRef.current.classList.add('count-up');
    }
    prevVal.current = value;
  }, [value]);

  return (
    <div className="bg-white rounded-2xl p-4 flex items-center gap-4" style={{ boxShadow: '0 4px 24px rgba(80,110,180,0.08)' }}>
      {/* Icon tile */}
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}
        aria-hidden="true"
      >
        {Icon && <Icon size={22} className={iconColor} strokeWidth={1.8} />}
      </div>
      {/* Text */}
      <div className="min-w-0">
        <p
          ref={numRef}
          className="text-2xl font-bold text-navy leading-none"
          aria-live="polite"
          aria-atomic="true"
        >
          {value ?? '—'}
        </p>
        <p className="text-xs text-muted mt-1 font-medium truncate">{label}</p>
        {change && <p className="text-[10px] text-muted/70 mt-0.5">{change}</p>}
      </div>
    </div>
  );
}
