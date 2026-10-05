import { LayoutGrid, Bell, Clock, LogOut } from 'lucide-react';
import { useAuth }     from '../../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const NAV = [
  { id: 'ward',    label: 'Ward',    Icon: LayoutGrid },
  { id: 'alerts',  label: 'Alerts',  Icon: Bell       },
  { id: 'history', label: 'History', Icon: Clock      },
];

function HospitalSVG() {
  return (
    <svg viewBox="0 0 160 80" fill="none" className="w-full opacity-20">
      <rect x="50" y="20" width="60" height="55" rx="2" fill="#2F80ED"/>
      <rect x="70" y="30" width="20" height="15" rx="1" fill="white" opacity="0.6"/>
      <rect x="76" y="34" width="8"  height="2" rx="1" fill="#2F80ED"/>
      <rect x="79" y="31" width="2"  height="8" rx="1" fill="#2F80ED"/>
      <rect x="72" y="55" width="16" height="20" rx="2" fill="white" opacity="0.5"/>
      <circle cx="30"  cy="55" r="12" fill="#22C55E" opacity="0.4"/>
      <circle cx="130" cy="58" r="10" fill="#22C55E" opacity="0.4"/>
    </svg>
  );
}

export function NurseSidebar({ activeTab, onTabChange, alertCount = 0, connected, collapsed }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'NU';

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <aside
      className={`flex flex-col h-full bg-white border-r border-slate-100 transition-all duration-300 shrink-0 ${collapsed ? 'w-16' : 'w-52'}`}
      style={{ boxShadow: '4px 0 24px rgba(80,110,180,0.06)' }}
      aria-label="Nurse navigation"
    >
      {/* Logo */}
      <div className={`flex items-center gap-2.5 px-4 py-5 border-b border-slate-50 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2F80ED] to-[#4FC3F7] flex items-center justify-center shrink-0 shadow-sm">
          <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
            <rect x="9" y="5" width="6" height="14" rx="3" fill="white" opacity="0.9"/>
            <rect x="10" y="3" width="4" height="3" rx="1" fill="white" opacity="0.7"/>
            <path d="M12 18s-5-3.5-5-7a3 3 0 0 1 5-2.24A3 3 0 0 1 17 11c0 3.5-5 7-5 7z"
              fill="#F0386B" opacity="0.85"/>
          </svg>
        </div>
        {!collapsed && (
          <div className="leading-none">
            <span className="text-[#1E2A4A] font-bold text-base tracking-tight">MEDI</span>
            <span className="text-[#2F80ED] font-bold text-base tracking-tight">GAS</span>
            <p className="text-[10px] text-[#8A94A6] mt-0.5 font-semibold">Nurse Portal</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 flex flex-col gap-1">
        {NAV.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <button key={id} onClick={() => onTabChange(id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex items-center gap-3 px-3 py-3 rounded-xl w-full text-left transition-all duration-150 min-h-[48px]
                ${isActive ? 'bg-blue-50 text-[#2F80ED] font-semibold' : 'text-[#8A94A6] hover:bg-slate-50 hover:text-[#1E2A4A] font-medium'}
                ${collapsed ? 'justify-center' : ''}`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
              {!collapsed && <span className="text-sm">{label}</span>}
              {id === 'alerts' && alertCount > 0 && (
                <span className={`live-dot-red bg-[#F0386B] text-white text-[10px] font-bold rounded-full leading-none flex items-center justify-center
                  ${collapsed ? 'absolute -top-1 -right-1 w-5 h-5' : 'ml-auto w-5 h-5'}`}>
                  {alertCount > 9 ? '9+' : alertCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Live indicator */}
      <div className={`px-3 pb-2 ${collapsed ? 'flex justify-center' : ''}`}>
        <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl ${connected ? 'bg-green-50' : 'bg-red-50'} ${collapsed ? 'justify-center' : ''}`}>
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${connected ? 'bg-green-500 live-dot' : 'bg-red-500 live-dot-red'}`} />
          {!collapsed && (
            <span className={`text-xs font-semibold ${connected ? 'text-green-700' : 'text-red-600'}`}>
              {connected ? 'Live' : 'Offline'}
            </span>
          )}
        </div>
      </div>

      {/* User + logout */}
      {!collapsed && (
        <div className="px-3 pb-3 flex flex-col gap-1 border-t border-slate-50 pt-3">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-50">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2F80ED] to-[#4FC3F7] flex items-center justify-center text-white text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[#1E2A4A] truncate">{user?.name}</p>
              <p className="text-[10px] text-[#8A94A6] truncate">{user?.ward_name ?? 'Ward'}</p>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600">NURSE</span>
            </div>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-[#8A94A6] hover:text-red-500 hover:bg-red-50 transition-colors min-h-[40px]">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      )}

      {!collapsed && <div className="px-3 pb-3"><HospitalSVG /></div>}
    </aside>
  );
}
