/**
 * RoleSelector.jsx
 * ================
 * Two large selectable cards — Doctor and Nurse.
 * Selected card gets blue border + light-blue fill + check badge.
 */
import { Stethoscope, HeartPulse, CheckCircle2 } from 'lucide-react';

const ROLES = [
  {
    id:       'DOCTOR',
    label:    'Doctor',
    sub:      'Monitor & manage',
    Icon:     Stethoscope,
    color:    '#2F80ED',
    lightBg:  '#EAF3FF',
  },
  {
    id:       'NURSE',
    label:    'Nurse',
    sub:      'Ward & bedside',
    Icon:     HeartPulse,
    color:    '#F0386B',
    lightBg:  '#FFF0F4',
  },
];

export function RoleSelector({ value, onChange }) {
  return (
    <div className="flex gap-3" role="radiogroup" aria-label="Select your role">
      {ROLES.map(({ id, label, sub, Icon, color, lightBg }) => {
        const selected = value === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(id)}
            className="flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{
              borderColor:     selected ? color : '#E8EEFA',
              background:      selected ? lightBg : '#FAFBFF',
              boxShadow:       selected ? `0 0 0 1px ${color}30` : 'none',
              focusVisibleRingColor: color,
            }}
          >
            {/* Icon */}
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center transition-colors"
              style={{ background: selected ? color : '#F0F4FF' }}
            >
              <Icon size={22} color={selected ? '#fff' : color} strokeWidth={1.8} />
            </div>

            {/* Text */}
            <div className="text-center leading-tight">
              <p className="text-sm font-bold" style={{ color: selected ? color : '#1E2A4A' }}>
                {label}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: '#8A94A6' }}>{sub}</p>
            </div>

            {/* Check badge */}
            {selected && (
              <CheckCircle2
                size={16}
                style={{ color }}
                className="absolute top-2 right-2"
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
