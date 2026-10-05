/**
 * App.jsx
 * =======
 * Root router. Wraps everything in AuthProvider + BrowserRouter.
 *
 * Routes:
 *   /login        → Login page (public)
 *   /doctor/*     → DoctorApp (DOCTOR only)
 *   /nurse/*      → NurseApp  (NURSE only)
 *   /             → redirect by role
 *   *             → redirect to /login
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth }      from './hooks/useAuth';
import { ProtectedRoute } from './components/routing/ProtectedRoute';
import Login      from './pages/Login';
import DoctorApp  from './portals/doctor/DoctorApp';
import NurseApp   from './portals/nurse/NurseApp';

/** Root redirect: authenticated → portal, otherwise → /login */
function RootRedirect() {
  const { isAuthenticated, role, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={role === 'NURSE' ? '/nurse' : '/doctor'} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/doctor/*" element={
        <ProtectedRoute role="DOCTOR">
          <DoctorApp />
        </ProtectedRoute>
      } />

      <Route path="/nurse/*" element={
        <ProtectedRoute role="NURSE">
          <NurseApp />
        </ProtectedRoute>
      } />

      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
