import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { AUTO_ESCALATE_MINUTES } from '../../../config';

export function AutoEscalateTimer({ createdAt, status, escalationStatus }) {
  const [remaining, setRemaining] = useState(null);

  useEffect(() => {
    if (status !== 'ACTIVE' || escalationStatus !== 'NONE') { setRemaining(null); return; }

    function calc() {
      const elapsed  = (Date.now() - new Date(createdAt).getTime()) / 1000;
      const totalSec = AUTO_ESCALATE_MINUTES * 60;
      const left     = Math.max(totalSec - elapsed, 0);
      setRemaining(left);
    }

    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [createdAt, status, escalationStatus]);

  if (remaining === null || remaining <= 0) return null;

  const mins = String(Math.floor(remaining / 60)).padStart(2, '0');
  const secs = String(Math.floor(remaining % 60)).padStart(2, '0');
  const isUrgent = remaining < 30;

  return (
    <div className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg"
      style={{ background: isUrgent ? '#FEF2F2' : '#FFFBEB', color: isUrgent ? '#DC2626' : '#92400E' }}>
      <Clock size={11}/>
      Auto-escalates in {mins}:{secs}
    </div>
  );
}
