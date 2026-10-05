import { useState, useEffect } from 'react';
import { Printer, RefreshCw, AlertTriangle, CheckCircle2, ArrowUpCircle } from 'lucide-react';
import { api } from '../../../api/client';

export function ShiftHandoverCard() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  async function load() {
    setLoading(true); setError(null);
    try { setData(await api.get('/handover/summary')); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="bg-white rounded-2xl p-5" style={{ boxShadow:'0 4px 20px rgba(80,110,180,0.08)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-[#1E2A4A]">Shift Handover Summary</h3>
          <p className="text-xs text-[#8A94A6] mt-0.5">
            {data ? `${data.ward_name} · Last ${data.shift_hours}h` : 'Loading…'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} aria-label="Refresh"
            className="p-2 rounded-xl hover:bg-slate-50 text-[#8A94A6] min-h-[40px] min-w-[40px] flex items-center justify-center">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''}/>
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold min-h-[40px] transition-colors"
            style={{ background:'#EAF3FF', color:'#2F80ED' }}>
            <Printer size={13}/> Print
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {data && !loading && (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { label:'Total alerts',  value: data.total_alerts,        bg:'#F4F7FC', color:'#1E2A4A'   },
              { label:'Still open',    value: data.active_alerts,       bg: data.active_alerts   > 0 ? '#FEF2F2'  : '#F0FDF4', color: data.active_alerts   > 0 ? '#DC2626' : '#16A34A' },
              { label:'Acknowledged',  value: data.acknowledged_alerts, bg:'#F0FDF4',              color:'#16A34A'  },
              { label:'Escalated',     value: data.escalated_alerts,    bg: data.escalated_alerts > 0 ? '#FFFBEB'  : '#F4F7FC', color: data.escalated_alerts > 0 ? '#D97706' : '#8A94A6' },
            ].map(({ label, value, bg, color }) => (
              <div key={label} className="rounded-2xl p-3 text-center" style={{ background: bg }}>
                <p className="text-2xl font-bold" style={{ color }}>{value}</p>
                <p className="text-[10px] font-medium text-[#8A94A6] mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Safe ranges */}
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background:'#EAF3FF', color:'#2F80ED' }}>
              Pressure: 40–100 PSI
            </span>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background:'#F0FDF4', color:'#16A34A' }}>
              O₂ Purity: 93–99%
            </span>
          </div>

          {/* Unstable devices */}
          {data.unstable_devices?.length > 0 && (
            <div className="rounded-xl px-4 py-3" style={{ background:'#FEF2F2' }}>
              <p className="text-xs font-bold text-red-700 mb-1.5 flex items-center gap-1.5">
                <AlertTriangle size={12}/> Unstable devices at handover
              </p>
              <div className="flex flex-wrap gap-2">
                {data.unstable_devices.map(d => (
                  <span key={d} className="text-xs font-bold px-2.5 py-1 rounded-lg bg-red-100 text-red-700">{d}</span>
                ))}
              </div>
            </div>
          )}

          {data.unstable_devices?.length === 0 && (
            <div className="rounded-xl px-4 py-3 flex items-center gap-2" style={{ background:'#F0FDF4' }}>
              <CheckCircle2 size={14} className="text-green-500"/>
              <p className="text-xs font-semibold text-green-700">All devices stable at handover</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
