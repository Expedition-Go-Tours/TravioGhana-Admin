import { Navigate } from "react-router-dom";
import { useAuthContext } from "@/auth/auth-context";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isLoading, isAuthenticated } = useAuthContext();

  // Show a spinner while the session is being confirmed so we don't flash the
  // admin shell for a user whose token has actually expired.
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-muted/50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
}
