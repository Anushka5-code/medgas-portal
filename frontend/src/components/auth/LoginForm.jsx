/**
 * LoginForm.jsx
 * =============
 * Right-panel login card: role selector, username + password inputs,
 * remember-me, submit button, error banner, demo credentials.
 */
import { useState, useEffect } from 'react';
import { User, Lock, Eye, EyeOff, LogIn, Loader2, AlertCircle } from 'lucide-react';
import { RoleSelector }    from './RoleSelector';
import { DemoCredentials } from './DemoCredentials';

const REMEMBER_KEY = 'medigas_remember_username';

export function LoginForm({ onLogin }) {
  const [role,     setRole]     = useState('DOCTOR');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [errors,   setErrors]   = useState({});   // field-level

  // Restore remembered username on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) { setUsername(saved); setRemember(true); }
    } catch {}
  }, []);

  function validate() {
    const e = {};
    if (!username.trim()) e.username = 'Username is required';
    if (!password)        e.password = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!validate()) return;

    try {
      setLoading(true);
      await onLogin({ username: username.trim(), password, role });
      // Save / clear remembered username
      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, username.trim());
        else          localStorage.removeItem(REMEMBER_KEY);
      } catch {}
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  function handleFill({ username: u, password: p }) {
    setUsername(u); setPassword(p); setErrors({});
  }

  const accent = role === 'NURSE' ? '#F0386B' : '#2F80ED';

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-5 w-full"
      aria-label="Login form"
    >
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold" style={{ color: '#1E2A4A' }}>Welcome back</h2>
        <p className="text-sm mt-1" style={{ color: '#8A94A6' }}>Sign in to your portal</p>
      </div>

      {/* Role selector */}
      <div>
        <label className="block text-xs font-semibold mb-2 uppercase tracking-wide"
          style={{ color: '#8A94A6' }}>
          Your role
        </label>
        <RoleSelector value={role} onChange={r => { setRole(r); setError(''); }} />
      </div>

      {/* Role label */}
      <p className="text-sm font-semibold -mt-1" style={{ color: accent }}>
        {role === 'DOCTOR' ? 'Doctor Sign In' : 'Nurse Sign In'}
      </p>

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm font-medium"
          style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Username */}
      <div>
        <label htmlFor="username" className="block text-xs font-semibold mb-1.5"
          style={{ color: '#1E2A4A' }}>
          Username
        </label>
        <div className="relative">
          <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: '#8A94A6' }} />
          <input
            id="username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={e => { setUsername(e.target.value); setErrors(v => ({ ...v, username: '' })); }}
            placeholder="Enter your username"
            aria-describedby={errors.username ? 'username-err' : undefined}
            aria-invalid={!!errors.username}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-all outline-none"
            style={{
              borderColor: errors.username ? '#EF4444' : '#E8EEFA',
              background: '#FAFBFF',
              color: '#1E2A4A',
            }}
            onFocus={e  => e.target.style.borderColor = accent}
            onBlur={e   => e.target.style.borderColor = errors.username ? '#EF4444' : '#E8EEFA'}
          />
        </div>
        {errors.username && (
          <p id="username-err" className="text-xs mt-1" style={{ color: '#EF4444' }}>
            {errors.username}
          </p>
        )}
      </div>

      {/* Password */}
      <div>
        <label htmlFor="password" className="block text-xs font-semibold mb-1.5"
          style={{ color: '#1E2A4A' }}>
          Password
        </label>
        <div className="relative">
          <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: '#8A94A6' }} />
          <input
            id="password"
            type={showPwd ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={e => { setPassword(e.target.value); setErrors(v => ({ ...v, password: '' })); }}
            placeholder="Enter your password"
            aria-describedby={errors.password ? 'password-err' : undefined}
            aria-invalid={!!errors.password}
            className="w-full pl-10 pr-10 py-2.5 rounded-xl border text-sm transition-all outline-none"
            style={{
              borderColor: errors.password ? '#EF4444' : '#E8EEFA',
              background: '#FAFBFF',
              color: '#1E2A4A',
            }}
            onFocus={e => e.target.style.borderColor = accent}
            onBlur={e  => e.target.style.borderColor = errors.password ? '#EF4444' : '#E8EEFA'}
          />
          <button
            type="button"
            onClick={() => setShowPwd(v => !v)}
            aria-label={showPwd ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded"
            style={{ color: '#8A94A6' }}
          >
            {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        {errors.password && (
          <p id="password-err" className="text-xs mt-1" style={{ color: '#EF4444' }}>
            {errors.password}
          </p>
        )}
      </div>

      {/* Remember me */}
      <label className="flex items-center gap-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={remember}
          onChange={e => setRemember(e.target.checked)}
          className="w-4 h-4 rounded accent-blue-500"
          aria-label="Remember my username"
        />
        <span className="text-xs font-medium" style={{ color: '#8A94A6' }}>
          Remember my username
        </span>
      </label>

      {/* Submit button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl text-sm font-bold text-white transition-all duration-150 disabled:opacity-70"
        style={{ background: loading ? '#8A94A6' : accent }}
      >
        {loading
          ? <><Loader2 size={16} className="animate-spin" /> Signing in…</>
          : <><LogIn size={16} /> Sign in as {role === 'DOCTOR' ? 'Doctor' : 'Nurse'}</>
        }
      </button>

      {/* Demo credentials */}
      <DemoCredentials role={role} onFill={handleFill} />

      {/* Footer */}
      <div className="flex items-center justify-between pt-1">
        <p className="text-[11px] flex items-center gap-1.5" style={{ color: '#8A94A6' }}>
          <Lock size={11} />
          Secure, encrypted session
        </p>
        <p className="text-[10px]" style={{ color: '#C4CBD8' }}>v2.0.0</p>
      </div>
    </form>
  );
}
