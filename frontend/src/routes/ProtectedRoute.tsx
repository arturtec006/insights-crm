import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import type { Role } from "../types/auth";

export function ProtectedRoute({ allow }: { allow?: Role[] }) {
  const { status, user } = useAuthStore();

  if (status === "checking") {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "var(--surface-0)" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" style={{ color: "var(--accent-text)" }} />
      </div>
    );
  }

  if (status === "anonymous" || !user) {
    return <Navigate to="/login" replace />;
  }

  // Server re-enforces every one of these checks — this only prevents an
  // authenticated-but-unauthorized user from seeing UI meant for another role.
  if (allow && !allow.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
