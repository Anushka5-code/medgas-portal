import { useState, useRef, useEffect } from 'react';
import { Search, Bell, Volume2, VolumeX, X, ChevronDown, LogOut } from 'lucide-react';
import { StatusPill } from '../../../components/ui/StatusPill';
import { useAuth }    from '../../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

function AlertDropdown({ alerts, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  const latest = alerts.filter(a => a.status === 'ACTIVE').slice(0, 5);

  return (
    <div ref={ref}
      className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-lg border border-slate-100 z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
        <span className="text-sm font-semibold text-[#1E2A4A]">Active Alerts</span>
        <button onClick={onClose} className="text-[#8A94A6] hover:text-[#1E2A4A]"><X size={15}/></button>
      </div>
      {latest.length === 0
        ? <p className="px-4 py-6 text-sm text-[#8A94A6] text-center">No active alerts</p>
        : <ul className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
            {latest.map(a => (
              <li key={a.id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-[#1E2A4A]">{a.bed_label ?? a.device_id}</span>
                  <StatusPill status={a.alert_type} size="xs" />
                </div>
                <p className="text-xs text-[#8A94A6]">
                  {a.parameter === 'purity' ? 'O₂ Purity' : 'Pressure'} · {a.device_id}
                </p>
              </li>
            ))}
          </ul>
      }
    </div>
  );
}

export function NurseTopBar({ alerts = [], searchQuery, onSearchChange, soundEnabled, onToggleSound }) {
  const [showAlerts, setShowAlerts] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const activeCount = alerts.filter(a => a.status === 'ACTIVE').length;
  const initials = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? 'NU';

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="flex items-center justify-between gap-4 px-6 py-3.5 bg-white border-b border-slate-100">
      {/* Ward chip */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-blue-50 text-[#2F80ED]">
          {user?.ward_name ?? 'My Ward'}
        </span>
      </div>

      {/* Search */}
      <div className="relative flex-1 max-w-xs">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A94A6]" />
        <input type="search" value={searchQuery} onChange={e => onSearchChange(e.target.value)}
          placeholder="Search bed or device ID…" aria-label="Search bed or device"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-100 text-sm text-[#1E2A4A] placeholder-[#8A94A6] focus:outline-none focus:ring-2 focus:ring-[#2F80ED]/30 transition-all" />
      </div>

      <div className="flex items-center gap-2">
        {/* Sound toggle */}
        <button onClick={onToggleSound}
          aria-label={soundEnabled ? 'Mute alarms' : 'Enable alarms'}
          className="p-2.5 rounded-xl hover:bg-slate-50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          style={{ color: soundEnabled ? '#2F80ED' : '#8A94A6' }}>
          {soundEnabled ? <Volume2 size={18}/> : <VolumeX size={18}/>}
        </button>

        {/* Bell */}
        <div className="relative">
          <button onClick={() => setShowAlerts(v => !v)}
            aria-label={`${activeCount} active alerts`}
            className="relative p-2.5 rounded-xl hover:bg-slate-50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center text-[#8A94A6] hover:text-[#1E2A4A]">
            <Bell size={19}/>
            {activeCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#F0386B] rounded-full live-dot-red" />
            )}
          </button>
          {showAlerts && <AlertDropdown alerts={alerts} onClose={() => setShowAlerts(false)} />}
        </div>

        <div className="w-px h-6 bg-slate-100" />

        {/* User menu */}
        <div className="relative group">
          <button className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-slate-50 transition-colors min-h-[44px]">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2F80ED] to-[#4FC3F7] flex items-center justify-center text-white text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold text-[#1E2A4A] leading-none">{user?.name}</p>
              <p className="text-[10px] text-[#8A94A6] mt-0.5">Nurse Portal</p>
            </div>
            <ChevronDown size={14} className="text-[#8A94A6]" />
          </button>
          <div className="absolute right-0 top-11 w-44 bg-white rounded-2xl shadow-lg border border-slate-100 z-50 overflow-hidden opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-150">
            <div className="px-4 py-3 border-b border-slate-50">
              <p className="text-xs font-bold text-[#1E2A4A] truncate">{user?.name}</p>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600">NURSE</span>
            </div>
            <button onClick={handleLogout}
              className="w-full flex items-center gap-2 text-left px-4 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors">
              <LogOut size={13}/> Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
