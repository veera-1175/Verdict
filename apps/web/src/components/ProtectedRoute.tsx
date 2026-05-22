import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import type { Role } from "../lib/roles";

export function ProtectedRoute({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: Role[];
}) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin border-2 border-ink-600 border-t-white" />
        <p className="mono-label mt-6">Loading Verdict</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="panel p-8">
        <p className="mono-label">Access denied</p>
        <h2 className="page-title mt-2">Insufficient permissions</h2>
        <p className="section-desc mt-2">Your role ({user.role}) cannot access this page.</p>
      </div>
    );
  }

  return <>{children}</>;
}
