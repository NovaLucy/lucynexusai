import { Navigate } from "react-router-dom";
import { useSupaAuth } from "./useSupaAuth";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSupaAuth();
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-muted-foreground text-sm">
        …
      </div>
    );
  }
  if (!session) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}
