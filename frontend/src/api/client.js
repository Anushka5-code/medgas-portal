/**
 * api/client.js
 * =============
 * HTTP fetch wrapper that:
 *   • attaches Authorization: Bearer <token> from sessionStorage
 *   • on 401, clears the session and dispatches a custom "medigas:logout" event
 *     (AuthContext listens for this to redirect to /login)
 *   • builds WebSocket URL with ?token=<token>
 */

const BASE_URL  = 'http://localhost:8000';
const TOKEN_KEY = 'medigas_token';

function getToken() {
  try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
}

function clearSession() {
  try { sessionStorage.removeItem(TOKEN_KEY); } catch {}
  window.dispatchEvent(new CustomEvent('medigas:logout'));
}

// ── Core fetch wrapper ─────────────────────────────────────────────────────
async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearSession();
    throw new Error('Session expired. Please log in again.');
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try { const j = await res.json(); detail = j.detail || detail; } catch {}
    throw new Error(detail);
  }

  // 204 No Content
  if (res.status === 204) return null;
  return res.json();
}

// ── Convenience methods ────────────────────────────────────────────────────
export const api = {
  get:    (path, opts)         => request(path, { method: 'GET', ...opts }),
  post:   (path, body, opts)   => request(path, { method: 'POST',  body: JSON.stringify(body), ...opts }),
  patch:  (path, body, opts)   => request(path, { method: 'PATCH', body: JSON.stringify(body), ...opts }),
  delete: (path, opts)         => request(path, { method: 'DELETE', ...opts }),

  // Existing dashboard helpers (kept for backward compat)
  getDevices:        (p)  => request(`/devices${p ? `?${new URLSearchParams(p)}` : ''}`),
  getReadings:       (p)  => request(`/readings?${new URLSearchParams(p)}`),
  getAlerts:         ()   => request('/alerts'),
  acknowledgeAlert:  (id) => request(`/alerts/${id}/acknowledge`, { method: 'POST', body: '{}' }),
  resolveAlert:      (id) => request(`/alerts/${id}/resolve`,     { method: 'POST', body: '{}' }),

  // WebSocket URL builder (includes token)
  wsUrl: () => {
    const token = getToken();
    return token
      ? `ws://localhost:8000/ws?token=${encodeURIComponent(token)}`
      : `ws://localhost:8000/ws`;
  },
};
