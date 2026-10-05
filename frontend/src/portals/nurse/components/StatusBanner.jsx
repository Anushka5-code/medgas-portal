import { CheckCircle2, AlertTriangle } from 'lucide-react';

export function StatusBanner({ alerts, lastReceived }) {
  const activeAlerts = alerts.filter(a => a.status === 'ACTIVE');
  const isNormal     = activeAlerts.length === 0;
  const highCount    = activeAlerts.filter(a => a.alert_type?.includes('HIGH')).length;
  const lowCount     = activeAlerts.filter(a => a.alert_type?.includes('LOW')).length;
  const purityAlerts = activeAlerts.filter(a => a.parameter === 'purity').length;
  const pressAlerts  = activeAlerts.filter(a => a.parameter === 'pressure').length;

  const time = lastReceived
    ? `Last updated: ${lastReceived.toLocaleTimeString()}`
    : 'Awaiting first reading…';

  if (isNormal) {
    return (
      <div className="rounded-2xl p-5 flex items-center gap-4"
        style={{ background: 'linear-gradient(135deg,#F0FDF4,#DCFCE7)', border:'2px solid #86EFAC' }}>
        <div className="w-12 h-12 rounded-2xl bg-green-500 flex items-center justify-center shrink-0">
          <CheckCircle2 size={26} color="white" strokeWidth={2.5}/>
        </div>
        <div>
          <p className="text-xl font-bold text-green-800">All gas supply normal</p>
          <p className="text-sm text-green-700 mt-0.5">
            Pressure: 40–100 PSI · O₂ Purity: 93–99% · {time}
          </p>
        </div>
      </div>
    );
  }

  const parts = [];
  if (pressAlerts > 0) parts.push(`${pressAlerts} pressure`);
  if (purityAlerts > 0) parts.push(`${purityAlerts} O₂ purity`);

  return (
    <div className="rounded-2xl p-5 flex items-center gap-4"
      style={{ background:'linear-gradient(135deg,#FEF2F2,#FEE2E2)', border:'2px solid #FCA5A5',
               animation: 'livePulseRed 2s infinite' }}>
      <div className="w-12 h-12 rounded-2xl bg-[#F0386B] flex items-center justify-center shrink-0 live-dot-red"
        style={{ boxShadow:'0 0 0 0 rgba(240,56,107,0.4)' }}>
        <AlertTriangle size={26} color="white" strokeWidth={2.5}/>
      </div>
      <div className="flex-1">
        <p className="text-xl font-bold text-red-800">
          {activeAlerts.length} alert{activeAlerts.length > 1 ? 's' : ''} need{activeAlerts.length === 1 ? 's' : ''} attention
        </p>
        <p className="text-sm text-red-700 mt-0.5">
          {parts.join(' · ')} · {highCount > 0 ? `${highCount} HIGH` : ''}{highCount > 0 && lowCount > 0 ? ', ' : ''}{lowCount > 0 ? `${lowCount} LOW` : ''} · {time}
        </p>
      </div>
    </div>
  );
}
