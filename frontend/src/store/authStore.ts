import { create } from "zustand";
import type { AuthUser } from "../types/auth";
import { apiFetch, ApiError } from "../lib/api";

interface AuthState {
  user: AuthUser | null;
  status: "checking" | "authenticated" | "anonymous";
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  bootstrap: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: "checking",
  error: null,

  login: async (email, password) => {
    set({ error: null });
    try {
      const { user } = await apiFetch<{ user: AuthUser }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      set({ user, status: "authenticated" });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Falha ao entrar. Tente novamente.";
      set({ error: message, status: "anonymous" });
      throw err;
    }
  },

  logout: async () => {
    await apiFetch("/auth/logout", { method: "POST" }).catch(() => {});
    set({ user: null, status: "anonymous" });
  },

  bootstrap: async () => {
    try {
      const { user } = await apiFetch<{ user: AuthUser }>("/auth/me");
      set({ user, status: "authenticated" });
    } catch {
      set({ user: null, status: "anonymous" });
    }
  },
}));
