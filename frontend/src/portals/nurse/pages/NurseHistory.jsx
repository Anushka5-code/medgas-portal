import { useState, useEffect } from 'react';
import { ShiftHandoverCard } from '../components/ShiftHandoverCard';
import { HistoryTable }      from '../components/HistoryTable';
import { api }               from '../../../api/client';
import { PageSkeleton }      from '../../../components/ui/Skeleton';

const WINDOW_OPTIONS = [
  { label: 'Last 8h',  hours: 8  },
  { label: 'Last 24h', hours: 24 },
  { label: 'Last 48h', hours: 48 },
];

export function NurseHistory() {
  const [hours,   setHours]   = useState(24);
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    setLoading(true); setError(null);
    api.get(`/alerts/history?hours=${hours}`)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [hours]);

  return (
    <div className="p-5 flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold text-[#1E2A4A]">History</h2>
        <p className="text-sm text-[#8A94A6] mt-0.5">Resolved alerts in my ward · Pressure & O₂ Purity</p>
      </div>

      <ShiftHandoverCard/>

      {/* Window filter */}
      <div className="flex gap-2">
        {WINDOW_OPTIONS.map(({ label, hours: h }) => (
          <button key={h} onClick={() => setHours(h)}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors min-h-[44px]"
            style={{ background: hours===h ? '#2F80ED' : '#fff',
                     color: hours===h ? '#fff' : '#8A94A6',
                     border:'1px solid', borderColor: hours===h ? '#2F80ED' : '#E8EEFA' }}>
            {label}
          </button>
        ))}
        <span className="ml-auto text-xs font-medium text-[#8A94A6] flex items-center">
          {data.length} records
        </span>
      </div>

      {loading && <PageSkeleton/>}
      {error   && <p className="text-sm text-red-500">Error: {error}</p>}
      {!loading && !error && <HistoryTable alerts={data}/>}
    </div>
  );
}
