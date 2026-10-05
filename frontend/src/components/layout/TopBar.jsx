import { useState, useRef, useEffect } from 'react';
import { Search, Bell, ChevronDown, X, MapPin } from 'lucide-react';
import { StatusPill } from '../ui/StatusPill';
import { useAuth }    from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

function AlertDropdown({ alerts, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const latest = alerts.filter(a => a.status === 'ACTIVE').slice(0, 5);

  return (
    <div ref={ref}
      className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-hover border border-slate-100 z-50 animate-fade-in overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
        <span className="text-sm font-semibold text-navy">Active Alerts</span>
        <button onClick={onClose} aria-label="Close alerts dropdown" className="text-muted hover:text-navy">
          <X size={15} />
        </button>
      </div>
      {latest.length === 0
        ? <p className="px-4 py-6 text-sm text-muted text-center">No active alerts</p>
        : (
          <ul className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
            {latest.map(a => (
              <li key={a.id} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-navy">{a.device_id}</span>
                  <StatusPill status={a.alert_type} size="xs" />
                </div>
                <p className="text-xs text-muted">
                  {a.max_pressure} PSI · {new Date(a.started_at || a.created_at).toLocaleTimeString()}
                </p>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}

/**
 * TopBar
 * Props: alerts, searchQuery, onSearchChange, wards, selectedWard, onWardChange
 */
export function TopBar({ alerts = [], searchQuery, onSearchChange, wards = [], selectedWard, onWardChange }) {
  const [showAlerts, setShowAlerts] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const activeCount = alerts.filter(a => a.status === 'ACTIVE').length;
  const pendingEsc  = alerts.filter(a => a.escalation_status === 'PENDING').length;

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'DR';

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="flex items-center justify-between gap-4 px-6 py-3.5 bg-white border-b border-slate-100">
      {/* Search */}
      <div className="relative flex-1 max-w-xs">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          type="search"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Enter device ID..."
          aria-label="Search by device ID"
          className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-100 text-sm text-navy placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
        />
      </div>

      {/* Ward filter — doctor only */}
      {wards.length > 0 && (
        <div className="relative hidden sm:flex items-center gap-1.5">
          <MapPin size={14} className="text-muted" />
          <select
            value={selectedWard ?? ''}
            onChange={e => onWardChange(e.target.value ? Number(e.target.value) : null)}
            className="text-xs font-semibold pl-2 pr-7 py-2 rounded-xl bg-slate-50 border border-slate-100 text-navy focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none cursor-pointer"
            aria-label="Filter by ward"
          >
            <option value="">All Wards</option>
            {wards.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        </div>
      )}

      {/* Right actions */}
      <div className="flex items-center gap-3">
        {/* Bell */}
        <div className="relative">
          <button
            onClick={() => setShowAlerts(v => !v)}
            aria-label={`${activeCount} active alerts`}
            className="relative p-2 rounded-xl hover:bg-slate-50 transition-colors text-muted hover:text-navy"
          >
            <Bell size={19} />
            {(activeCount > 0 || pendingEsc > 0) && (
              <span className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${pendingEsc > 0 ? 'bg-accent live-dot-red' : 'bg-accent'}`} aria-hidden="true" />
            )}
          </button>
          {showAlerts && <AlertDropdown alerts={alerts} onClose={() => setShowAlerts(false)} />}
        </div>

        <div className="w-px h-6 bg-slate-100" aria-hidden="true" />

        {/* User menu */}
        <div className="relative group">
          <button className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-slate-50 transition-colors"
            aria-label="User menu">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-blue-400 flex items-center justify-center text-white text-xs font-bold shrink-0"
              aria-hidden="true">
              {initials}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold text-navy leading-none">{user?.name ?? 'Doctor'}</p>
              <p className="text-[10px] text-muted mt-0.5">Doctor Portal</p>
            </div>
            <ChevronDown size={14} className="text-muted" aria-hidden="true" />
          </button>

          {/* Dropdown */}
          <div className="absolute right-0 top-11 w-44 bg-white rounded-2xl shadow-hover border border-slate-100 z-50 overflow-hidden opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-150">
            <div className="px-4 py-3 border-b border-slate-50">
              <p className="text-xs font-bold text-navy truncate">{user?.name}</p>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600">
                DOCTOR
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
