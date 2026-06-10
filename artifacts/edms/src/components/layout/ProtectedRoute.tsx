import type { ReactNode } from "react";
import { Navigate } from "react-router";
import type { UserRole } from "../../lib/auth";
import { useAuth } from "../../lib/auth";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, hasPermission } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!hasPermission(allowedRoles)) {
    return <Navigate to="/restricted" replace />;
  }

  return <>{children}</>;
}
