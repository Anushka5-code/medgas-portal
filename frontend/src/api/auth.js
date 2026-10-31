/**
 * api/auth.js
 * ===========
 * Thin wrappers for auth endpoints. AuthContext calls these directly
 * using its own fetch (to avoid chicken-and-egg with token injection).
 * Exported here for any component that needs them independently.
 */

const BASE_URL = '';

export async function apiLogin({ username, password, role }) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ username, password, role }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Login failed');
  return data; // { access_token, token_type, user }
}

export async function apiMe(token) {
  const res = await fetch(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Invalid session');
  return res.json(); // UserOut
}
