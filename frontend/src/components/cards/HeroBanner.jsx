/** Dynamic hero banner reflecting both pressure and purity status, personalised for the logged-in doctor. */
import { useAuth } from '../../hooks/useAuth';

export function HeroBanner({ stats, lastReceived }) {
  const { user } = useAuth();
  const { pHigh, pLow, oHigh, oLow } = stats;
  const pressureProblems = pHigh + pLow;
  const purityProblems   = oHigh + oLow;
  const totalProblems    = pressureProblems + purityProblems;

  const firstName = user?.name?.split(' ')[0] ?? 'Doctor';

  let headline, headlineColor, subtitle;
  if (totalProblems === 0) {
    headline      = 'All Systems Normal';
    headlineColor = '#22C55E';
    subtitle      = `All devices operating within safe pressure (40–100 PSI) and oxygen purity (93–99%) ranges.`;
  } else {
    const parts = [];
    if (pressureProblems > 0) parts.push(`${pressureProblems} pressure issue${pressureProblems > 1 ? 's' : ''}`);
    if (purityProblems   > 0) parts.push(`${purityProblems} purity issue${purityProblems > 1 ? 's' : ''}`);
    headline      = `${totalProblems} Alert${totalProblems > 1 ? 's' : ''} Active`;
    headlineColor = '#F0386B';
    subtitle      = parts.join(' · ') + ' — check devices immediately.';
  }

  const time = lastReceived
    ? `Last reading: ${lastReceived.toLocaleTimeString()}`
    : 'Awaiting first reading…';

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-6 flex items-center justify-between gap-4"
      style={{
        background: 'linear-gradient(135deg,#ffffff 55%,#EAF3FF 100%)',
        boxShadow: '0 4px 24px rgba(80,110,180,0.08)',
        border: '1px solid rgba(47,128,237,0.08)',
      }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color:'#8A94A6' }}>
          Welcome back, {firstName}
        </p>
        <h1 className="text-2xl font-bold leading-tight mb-2" style={{ color: headlineColor }}>
          {headline}
        </h1>
        <p className="text-sm leading-relaxed max-w-md" style={{ color:'#8A94A6' }}>{subtitle}</p>

        <div className="flex flex-wrap gap-2 mt-3">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
            style={{ background:'#EAF3FF', color:'#2F80ED' }}>
            Pressure: 40–100 PSI
          </span>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
            style={{ background:'#F0FDF4', color:'#16A34A' }}>
            O₂ Purity: 93–99%
          </span>
        </div>
        <p className="text-xs mt-3" style={{ color:'#8A94A6' }}>{time}</p>
      </div>

      <div className="shrink-0 hidden sm:block" aria-hidden="true">
        <svg viewBox="0 0 220 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-52 h-32">
          <rect x="30" y="78" width="160" height="8" rx="4" fill="#E0EAFF"/>
          <circle cx="80"  cy="82" r="6" fill="#C7D8F8"/>
          <circle cx="140" cy="82" r="6" fill="#C7D8F8"/>
          <rect x="42" y="30" width="28" height="52" rx="10" fill="#2F80ED" opacity="0.15"/>
          <rect x="46" y="34" width="20" height="44" rx="8"  fill="#2F80ED" opacity="0.25"/>
          <rect x="52" y="26" width="8"  height="10" rx="3"  fill="#2F80ED" opacity="0.4"/>
          <text x="56" y="60" textAnchor="middle" fontSize="8" fill="#2F80ED" opacity="0.7"
            fontFamily="Poppins,sans-serif" fontWeight="700">PSI</text>
          <rect x="86" y="34" width="24" height="48" rx="10" fill="#22C55E" opacity="0.15"/>
          <rect x="90" y="38" width="16" height="40" rx="8"  fill="#22C55E" opacity="0.25"/>
          <rect x="95" y="30" width="6"  height="10" rx="3"  fill="#22C55E" opacity="0.4"/>
          <text x="98" y="62" textAnchor="middle" fontSize="8" fill="#22C55E" opacity="0.7"
            fontFamily="Poppins,sans-serif" fontWeight="700">O₂</text>
          <circle cx="170" cy="62" r="22" fill="white" stroke="#E0EAFF" strokeWidth="2"/>
          <circle cx="170" cy="62" r="17" fill="#F4F7FC"/>
          {[0,45,90,135,180,225,270].map((deg, i) => {
            const rad = (deg-90)*Math.PI/180;
            return <line key={i}
              x1={170+12*Math.cos(rad)} y1={62+12*Math.sin(rad)}
              x2={170+15*Math.cos(rad)} y2={62+15*Math.sin(rad)}
              stroke="#C7D8F8" strokeWidth="1.5" strokeLinecap="round"/>;
          })}
          <line x1="170" y1="62" x2="170" y2="49"
            stroke={totalProblems > 0 ? '#F0386B' : '#22C55E'} strokeWidth="2" strokeLinecap="round"/>
          <circle cx="170" cy="62" r="3" fill={totalProblems > 0 ? '#F0386B' : '#22C55E'}/>
          <text x="170" y="74" textAnchor="middle" fontSize="7" fill="#8A94A6" fontFamily="Poppins,sans-serif">PSI</text>
          <circle cx="170" cy="108" r="14" fill="white" stroke="#E0EAFF" strokeWidth="1.5"/>
          <circle cx="170" cy="108" r="10" fill="#F0FDF4"/>
          <line x1="170" y1="108" x2="170" y2="99"
            stroke={purityProblems > 0 ? '#F59E0B' : '#22C55E'} strokeWidth="2" strokeLinecap="round"/>
          <circle cx="170" cy="108" r="2" fill={purityProblems > 0 ? '#F59E0B' : '#22C55E'}/>
          <text x="170" y="118" textAnchor="middle" fontSize="6" fill="#8A94A6" fontFamily="Poppins,sans-serif">O₂%</text>
          <rect x="148" y="78" width="22" height="6" rx="3" fill="#E0EAFF"/>
          <rect x="118" y="74" width="6" height="14" rx="2" fill="#C7D8F8"/>
          <rect x="114" y="78" width="14" height="4" rx="2" fill="#A0B8E8"/>
        </svg>
      </div>
    </div>
  );
}
