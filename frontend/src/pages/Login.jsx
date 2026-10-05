/**
 * pages/Login.jsx
 * ===============
 * Full-screen split-panel login page.
 * Left: illustration + branding  |  Right: login card
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LoginIllustration } from '../components/auth/LoginIllustration';
import { LoginForm }          from '../components/auth/LoginForm';

const ROLE_HOME = { DOCTOR: '/doctor', NURSE: '/nurse' };

export default function Login() {
  const { login, isAuthenticated, role, loading } = useAuth();
  const navigate = useNavigate();

  // Already logged in → go straight to portal
  useEffect(() => {
    if (!loading && isAuthenticated && role) {
      navigate(ROLE_HOME[role] || '/', { replace: true });
    }
  }, [isAuthenticated, role, loading, navigate]);

  async function handleLogin(credentials) {
    const user = await login(credentials);          // throws on failure
    navigate(ROLE_HOME[user.role] || '/', { replace: true });
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-hidden"
      style={{ background: '#F4F7FC' }}
    >
      {/* Background decorations */}
      <div
        className="pointer-events-none absolute top-0 left-0 w-72 h-72 bg-dots opacity-50"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -top-28 -right-28 w-96 h-96 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(47,128,237,0.12) 0%, transparent 70%)' }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-20 -left-20 w-72 h-72 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(240,56,107,0.07) 0%, transparent 70%)' }}
        aria-hidden="true"
      />

      {/* Floating container */}
      <div
        className="page-fade-in relative z-10 w-full max-w-5xl rounded-3xl overflow-hidden flex"
        style={{
          minHeight: '620px',
          boxShadow: '0 20px 60px rgba(47,128,237,0.14)',
          border: '1px solid rgba(47,128,237,0.10)',
        }}
      >
        {/* Left — illustration (hidden on mobile) */}
        <div className="hidden lg:block w-[55%]">
          <LoginIllustration />
        </div>

        {/* Right — login card */}
        <div
          className="flex-1 flex items-center justify-center p-8 sm:p-10 bg-white"
        >
          <div className="w-full max-w-sm">
            <LoginForm onLogin={handleLogin} />
          </div>
        </div>
      </div>
    </div>
  );
}
