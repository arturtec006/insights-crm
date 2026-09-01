import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { Button } from "../components/ui/Button";

export function LoginPage() {
  const { login, status, error } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (status === "authenticated") {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password);
    } catch {
      // error already captured in the store
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: "var(--surface-0)" }}>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div
            className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl text-base font-bold"
            style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
          >
            IA
          </div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
            Insights CRM
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            Entre com a conta da sua empresa
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border p-6 shadow-sm"
          style={{ background: "var(--surface-1)", borderColor: "var(--border-strong)" }}
        >
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              E-mail
            </label>
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
              style={{ background: "var(--surface-2)", borderColor: "var(--border-strong)", color: "var(--text-primary)" }}
              placeholder="voce@empresa.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              Senha
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
              style={{ background: "var(--surface-2)", borderColor: "var(--border-strong)", color: "var(--text-primary)" }}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div
              className="rounded-lg px-3 py-2 text-sm"
              style={{ background: "color-mix(in oklab, var(--status-critical) 12%, transparent)", color: "var(--status-critical)" }}
              role="alert"
            >
              {error}
            </div>
          )}

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        {/* The demo credentials that used to sit here were printed on a public
            login page. They belong in the README, not in production. */}
        <div className="mt-4 text-center text-sm">
          <Link to="/esqueci-senha" style={{ color: "var(--accent-text)" }} className="hover:underline">
            Esqueci minha senha
          </Link>
        </div>
      </div>
    </div>
  );
}
