export type Role = "ADMIN" | "MANAGER" | "ANALYST";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  organizationId: string;
}
