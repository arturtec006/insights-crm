import type { ReactNode } from "react";
import type { Role } from "../../types/auth";
import { useAuthStore } from "../../store/authStore";

// Client-side gating is a UX convenience only — every role check that
// actually matters is re-enforced by the API (see backend requireRole).
export function RoleGate({ allow, children }: { allow: Role[]; children: ReactNode }) {
  const role = useAuthStore((s) => s.user?.role);
  if (!role || !allow.includes(role)) return null;
  return <>{children}</>;
}
