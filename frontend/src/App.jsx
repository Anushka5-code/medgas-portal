/**
 * App.jsx
 * =======
 * Root router. Wraps everything in AuthProvider + BrowserRouter.
 *
 * Routes:
 *   /login    → Login page (public)
 *   /doctor/* → DoctorApp (DOCTOR only)
 *   /         → redirect to /doctor if authenticated, /login otherwise
 *   *         → redirect to /login
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth }      from './hooks/useAuth';
import { ProtectedRoute } from './components/routing/ProtectedRoute';
import Login      from './pages/Login';
import DoctorApp  from './portals/doctor/DoctorApp';

/** Root redirect: authenticated → /doctor, otherwise → /login */
function RootRedirect() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to="/doctor" replace />;
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
