/**
 * DemoCredentials.jsx
 * ===================
 * Collapsible hint panel showing demo username + password with a Fill button.
 */
import { useState } from 'react';
import { ChevronDown, ChevronUp, FlaskConical } from 'lucide-react';

const DEMO = {
  DOCTOR: { username: 'dr.sharma',    password: 'Doctor@123' },
  NURSE:  { username: 'nurse.priya',  password: 'Nurse@123'  },
};

export function DemoCredentials({ role, onFill }) {
  const [open, setOpen] = useState(false);
  const creds = DEMO[role] || DEMO.DOCTOR;

  return (
    <div className="rounded-xl overflow-hidden border"
      style={{ borderColor: '#E8EEFA', background: '#FAFBFF' }}>

      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold transition-colors hover:bg-slate-50"
        style={{ color: '#8A94A6' }}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <FlaskConical size={13} />
          Demo credentials ({role === 'NURSE' ? 'Nurse' : 'Doctor'})
        </span>
        {open
          ? <ChevronUp size={14} />
          : <ChevronDown size={14} />}
      </button>

      {/* Body */}
      {open && (
        <div className="px-4 pb-3 pt-1 flex flex-col gap-1.5 border-t" style={{ borderColor: '#E8EEFA' }}>
          <div className="flex items-center justify-between text-xs">
            <span style={{ color: '#8A94A6' }}>Username</span>
            <code className="font-mono font-semibold" style={{ color: '#1E2A4A' }}>{creds.username}</code>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span style={{ color: '#8A94A6' }}>Password</span>
            <code className="font-mono font-semibold" style={{ color: '#1E2A4A' }}>{creds.password}</code>
          </div>
          <button
            type="button"
            onClick={() => onFill(creds)}
            className="mt-1.5 w-full py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{ background: '#EAF3FF', color: '#2F80ED' }}
          >
            Fill credentials
          </button>
        </div>
      )}
    </div>
  );
}
