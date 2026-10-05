/**
 * useAuth.js
 * ==========
 * Convenience hook — import this instead of useContext(AuthContext) everywhere.
 */
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
