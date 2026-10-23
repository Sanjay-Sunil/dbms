import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center text-zinc-400 gap-3">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
        <span className="text-xs font-mono tracking-wider uppercase text-zinc-500">Loading Session...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Admin has superuser oversight, but otherwise redirect to their respective home
    if (user.role === 'ADMIN') {
      return children;
    }
    if (user.role === 'STAFF') {
      return <Navigate to="/staff" replace />;
    }
    return <Navigate to="/student" replace />;
  }

  return children;
}
