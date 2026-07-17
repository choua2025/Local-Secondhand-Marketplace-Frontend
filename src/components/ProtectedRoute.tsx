import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Gates a route behind a session.
 *
 * The isLoading check is what makes a reload work. Without it, a logged-in user
 * refreshing /dashboard would be redirected to /login in the instant before
 * `/auth/me` comes back — a logout that looks like a bug.
 *
 * `state={{ from }}` and `replace` matter too: we remember where they were
 * headed so LoginPage can send them on, and we replace rather than push so the
 * back button doesn't bounce them into the redirect again.
 */
export function ProtectedRoute({ children }: { children: ReactNode }): React.JSX.Element {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" aria-busy="true">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}
