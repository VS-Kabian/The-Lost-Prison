import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { ReactNode } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

export default function ProtectedRoute({
  children,
  requireAdmin = false
}: ProtectedRouteProps): JSX.Element {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mb-4 text-6xl">⏳</div>
          <div className="text-xl font-semibold text-slate-700">Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  if (requireAdmin && profile?.role !== 'admin') {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
          <div className="mb-4 text-6xl">🚫</div>
          <h1 className="mb-2 text-2xl font-bold text-red-600">Access Denied</h1>
          <p className="text-slate-600">
            You need admin privileges to access the level editor.
          </p>
          <p className="mt-4 text-sm text-slate-500">
            Contact an administrator to upgrade your account.
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="mt-6 rounded-lg bg-gradient-to-br from-brandStart to-brandEnd px-6 py-3 font-semibold text-white transition hover:shadow-lg"
          >
            Return to Game
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
