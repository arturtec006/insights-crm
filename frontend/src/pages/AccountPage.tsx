import { useState } from "react";
import type { FormEvent } from "react";
import { apiFetch, ApiError } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import { Card, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { AuthField, AuthAlert, PASSWORD_HINT } from "../components/auth/AuthShell";
import type { Role } from "../types/auth";

const roleLabel: Record<Role, string> = {
  ADMIN: "Administrador",
  MANAGER: "Gerente",
  ANALYST: "Analista",
};

export function AccountPage() {
  const user = useAuthStore((s) => s.user);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const mismatch = confirm.length > 0 && next !== confirm;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setDone(false);
    try {
      await apiFetch("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não consegui trocar a senha agora.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <Card>
        <CardHeader title="Sua conta" />
        <dl className="space-y-3 p-5 pt-3">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Nome
            </dt>
            <dd className="mt-0.5 text-sm" style={{ color: "var(--text-primary)" }}>
              {user?.name}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              E-mail
            </dt>
            <dd className="mt-0.5 text-sm" style={{ color: "var(--text-primary)" }}>
              {user?.email}
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Papel
            </dt>
            <dd>
              <Badge tone="neutral">{user && roleLabel[user.role]}</Badge>
            </dd>
          </div>
        </dl>
      </Card>

      <Card>
        <CardHeader
          title="Trocar senha"
          subtitle="Ao salvar, as outras sessões são encerradas — esta continua aberta"
        />
        <form onSubmit={handleSubmit} className="space-y-4 p-5 pt-3">
          {/* A hidden username field is what lets a password manager know which
              account these fields belong to. */}
          <input type="hidden" autoComplete="username" value={user?.email ?? ""} readOnly />

          <AuthField
            label="Senha atual"
            type="password"
            value={current}
            onChange={setCurrent}
            autoComplete="current-password"
          />
          <AuthField
            label="Nova senha"
            type="password"
            value={next}
            onChange={setNext}
            autoComplete="new-password"
            hint={PASSWORD_HINT}
          />
          <AuthField
            label="Repita a nova senha"
            type="password"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
          />

          {mismatch && <AuthAlert kind="error">As duas senhas não são iguais.</AuthAlert>}
          {error && <AuthAlert kind="error">{error}</AuthAlert>}
          {done && <AuthAlert kind="success">Senha alterada. As outras sessões foram encerradas.</AuthAlert>}

          <Button type="submit" disabled={submitting || !current || !next || mismatch}>
            {submitting ? "Salvando…" : "Trocar senha"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
