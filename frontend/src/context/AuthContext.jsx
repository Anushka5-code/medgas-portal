/**
 * AuthContext.jsx
 * ===============
 * Provides auth state (user, token, role, loading) and actions (login, logout)
 * to the entire app via React context.
 *
 * Token storage: sessionStorage key "medigas_token"
 * (session ends when the browser tab / window is closed)
 */

import { createContext, useState, useEffect, useCallback } from 'react';

const TOKEN_KEY = 'medigas_token';
const BASE_URL  = 'http://localhost:8000';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(null);
  const [loading, setLoading] = useState(true); // true while restoring session

  // ── Restore session on mount ───────────────────────────────────────────────
  useEffect(() => {
    const stored = (() => {
      try { return sessionStorage.getItem(TOKEN_KEY); }
      catch { return null; }
    })();

    if (!stored) { setLoading(false); return; }

    // Validate the stored token with GET /auth/me
    fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${stored}` },
    })
      .then(r => {
        if (!r.ok) throw new Error('Token invalid');
        return r.json();
      })
      .then(userData => {
        setToken(stored);
        setUser(userData);
      })
      .catch(() => {
        try { sessionStorage.removeItem(TOKEN_KEY); } catch {}
      })
      .finally(() => setLoading(false));
  }, []);

  // ── login ──────────────────────────────────────────────────────────────────
  const login = useCallback(async ({ username, password, role }) => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password, role }),
    });

    const data = await res.json();

    if (!res.ok) {
      // Throw the backend detail message so LoginForm can show it
      throw new Error(data.detail || 'Login failed');
    }

    try { sessionStorage.setItem(TOKEN_KEY, data.access_token); } catch {}

    setToken(data.access_token);
    setUser(data.user);
    return data.user;
  }, []);

  // ── logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    // Fire-and-forget stateless logout
    const t = token;
    setToken(null);
    setUser(null);
    try { sessionStorage.removeItem(TOKEN_KEY); } catch {}
    if (t) {
      fetch(`${BASE_URL}/auth/logout`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${t}` },
      }).catch(() => {});
    }
  }, [token]);

  const value = {
    user,
    token,
    role:    user?.role ?? null,
    loading,
    login,
    logout,
    isAuthenticated: !!token && !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
