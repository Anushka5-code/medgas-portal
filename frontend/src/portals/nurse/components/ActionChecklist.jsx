import { useState } from 'react';
import { ChevronDown, ChevronUp, Square, CheckSquare2 } from 'lucide-react';

const CHECKLISTS = {
  LOW_PRESSURE: {
    label: 'Low Pressure Actions',
    color: '#F59E0B',
    steps: [
      'Check the patient\'s SpO₂ and clinical condition.',
      'Switch the patient to a backup/portable cylinder.',
      'Check the wall outlet and flowmeter for obstruction.',
      'Escalate to doctor if pressure does not recover.',
    ],
  },
  HIGH_PRESSURE: {
    label: 'High Pressure Actions',
    color: '#F0386B',
    steps: [
      'Check the patient\'s condition and flowmeter settings.',
      'Reduce flow or isolate the outlet if clinically safe.',
      'Notify the doctor immediately.',
      'Do NOT adjust the pipeline yourself — contact biomedical.',
    ],
  },
  LOW_PURITY: {
    label: 'Low O₂ Purity Actions',
    color: '#F59E0B',
    steps: [
      'Check patient SpO₂ and breathing immediately.',
      'Switch to a backup oxygen source.',
      'Check the oxygen concentrator/supply source for faults.',
      'Escalate to doctor/biomedical team if purity doesn\'t recover.',
    ],
  },
  HIGH_PURITY: {
    label: 'High O₂ Purity Actions',
    color: '#8B5CF6',
    steps: [
      'Check the patient\'s condition and oxygen delivery device.',
      'Verify the O₂ analyser calibration.',
      'Reduce O₂ flow if clinically appropriate.',
      'Notify the doctor — do not adjust pipeline settings.',
    ],
  },
};

export function ActionChecklist({ alertType, defaultOpen = true }) {
  const meta = CHECKLISTS[alertType];
  const [open,    setOpen]    = useState(defaultOpen);
  const [checked, setChecked] = useState({});

  if (!meta) return null;

  function toggle(i) {
    setChecked(prev => ({ ...prev, [i]: !prev[i] }));
  }

  const doneCount = Object.values(checked).filter(Boolean).length;

  return (
    <div className="rounded-xl overflow-hidden border" style={{ borderColor: meta.color + '40' }}>
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold transition-colors"
        style={{ background: meta.color + '12', color: meta.color }}>
        <span>{meta.label} ({doneCount}/{meta.steps.length})</span>
        {open ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
      </button>
      {open && (
        <ul className="px-4 py-3 flex flex-col gap-2.5 bg-white">
          {meta.steps.map((step, i) => (
            <li key={i}>
              <label className="flex items-start gap-2.5 cursor-pointer group">
                <button type="button" onClick={() => toggle(i)}
                  className="mt-0.5 shrink-0 transition-colors min-w-[20px] min-h-[20px]"
                  aria-label={checked[i] ? 'Uncheck step' : 'Check step'}>
                  {checked[i]
                    ? <CheckSquare2 size={18} style={{ color: meta.color }}/>
                    : <Square size={18} className="text-slate-300 group-hover:text-slate-400"/>}
                </button>
                <span className={`text-xs leading-relaxed transition-colors ${checked[i] ? 'line-through text-[#8A94A6]' : 'text-[#1E2A4A]'}`}>
                  {i + 1}. {step}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
