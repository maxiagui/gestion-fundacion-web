import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background dark:bg-dark-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!session) {
    // Redirect logic: they are not logged in, go to login.
    // Save the intended URL so we can redirect them back after login (optional, but good UX)
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
