import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";
import { Button } from "../components/ui/Button";
import { AuthShell, AuthField, AuthAlert, PASSWORD_HINT } from "../components/auth/AuthShell";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Checked here as well as on the server, purely so the person sees the problem
  // before submitting; the server check is the one that counts.
  const mismatch = confirm.length > 0 && password !== confirm;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword: password }),
      });
      setDone(true);
      // Every session was revoked by the reset, so the only way forward is a
      // fresh login with the new password.
      setTimeout(() => navigate("/login", { replace: true }), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não consegui redefinir agora. Tente de novo.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <AuthShell
        title="Link inválido"
        footer={
          <Link to="/esqueci-senha" style={{ color: "var(--accent-text)" }} className="hover:underline">
            Pedir um novo link
          </Link>
        }
      >
        <AuthAlert kind="error">
          Este endereço não tem um código de redefinição. Abra o link direto do e-mail que você recebeu.
        </AuthAlert>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Escolha uma nova senha"
      subtitle="Depois de salvar, todas as sessões abertas serão encerradas"
      footer={
        <Link to="/login" style={{ color: "var(--accent-text)" }} className="hover:underline">
          Voltar para o login
        </Link>
      }
    >
      {done ? (
        <AuthAlert kind="success">Senha alterada. Levando você para o login…</AuthAlert>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <AuthField
            label="Nova senha"
            type="password"
            value={password}
            onChange={setPassword}
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
          <Button type="submit" disabled={submitting || !password || mismatch} className="w-full">
            {submitting ? "Salvando…" : "Salvar nova senha"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
