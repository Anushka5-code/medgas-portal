/** Dynamic hero banner for O₂ purity status, personalised for the logged-in doctor. */
import { useAuth } from '../../hooks/useAuth';

export function HeroBanner({ stats, lastReceived }) {
  const { user } = useAuth();
  const { oHigh, oLow } = stats;
  const totalProblems = oHigh + oLow;

  const firstName = user?.name?.split(' ')[0] ?? 'Doctor';

  let headline, headlineColor, subtitle;
  if (totalProblems === 0) {
    headline      = 'All Systems Normal';
    headlineColor = '#22C55E';
    subtitle      = `All devices operating within safe oxygen purity range (93–99%).`;
  } else {
    headline      = `${totalProblems} Alert${totalProblems > 1 ? 's' : ''} Active`;
    headlineColor = '#F0386B';
    subtitle      = `${totalProblems} purity issue${totalProblems > 1 ? 's' : ''} — check devices immediately.`;
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
            style={{ background:'#F0FDF4', color:'#16A34A' }}>
            O₂ Purity: 93–99%
          </span>
        </div>
        <p className="text-xs mt-3" style={{ color:'#8A94A6' }}>{time}</p>
      </div>

      <div className="shrink-0 hidden sm:block" aria-hidden="true">
        <svg viewBox="0 0 180 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-44 h-32">
          <rect x="86" y="34" width="24" height="48" rx="10" fill="#22C55E" opacity="0.15"/>
          <rect x="90" y="38" width="16" height="40" rx="8"  fill="#22C55E" opacity="0.25"/>
          <rect x="95" y="30" width="6"  height="10" rx="3"  fill="#22C55E" opacity="0.4"/>
          <text x="98" y="62" textAnchor="middle" fontSize="8" fill="#22C55E" opacity="0.7"
            fontFamily="Poppins,sans-serif" fontWeight="700">O₂</text>
          <circle cx="140" cy="70" r="28" fill="white" stroke="#E0EAFF" strokeWidth="2"/>
          <circle cx="140" cy="70" r="22" fill="#F4F7FC"/>
          {[0,45,90,135,180,225,270,315].map((deg, i) => {
            const rad = (deg-90)*Math.PI/180;
            return <line key={i}
              x1={140+16*Math.cos(rad)} y1={70+16*Math.sin(rad)}
              x2={140+19*Math.cos(rad)} y2={70+19*Math.sin(rad)}
              stroke="#C7D8F8" strokeWidth="1.5" strokeLinecap="round"/>;
          })}
          <line x1="140" y1="70" x2="140" y2="53"
            stroke={totalProblems > 0 ? '#F59E0B' : '#22C55E'} strokeWidth="2.5" strokeLinecap="round"/>
          <circle cx="140" cy="70" r="4" fill={totalProblems > 0 ? '#F59E0B' : '#22C55E'}/>
          <text x="140" y="86" textAnchor="middle" fontSize="8" fill="#8A94A6" fontFamily="Poppins,sans-serif">O₂%</text>
        </svg>
      </div>
    </div>
  );
}
