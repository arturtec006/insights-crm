import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";
import { Button } from "../components/ui/Button";
import { AuthShell, AuthField, AuthAlert } from "../components/auth/AuthShell";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch<{ ok: boolean; emailConfigured: boolean }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setEmailConfigured(res.emailConfigured);
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não consegui enviar agora. Tente de novo em instantes.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Esqueceu a senha?"
      subtitle="Enviamos um link para você escolher uma nova"
      footer={
        <Link to="/login" style={{ color: "var(--accent-text)" }} className="hover:underline">
          Voltar para o login
        </Link>
      }
    >
      {sent ? (
        <div className="space-y-3">
          {/* Deliberately says "if there is an account": confirming that an
              address is registered would turn this page into a way to discover
              who uses the system. */}
          <AuthAlert kind="success">
            Se existir uma conta com <strong>{email}</strong>, o link acabou de ser enviado. Ele vale por 30 minutos e
            só pode ser usado uma vez.
          </AuthAlert>

          {!emailConfigured && (
            <AuthAlert kind="error">
              Atenção: este servidor ainda não tem serviço de e-mail configurado, então nada foi realmente enviado.
              Fale com quem administra o sistema.
            </AuthAlert>
          )}

          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Não chegou? Confira a caixa de spam, ou peça outro link — o anterior deixa de valer.
          </p>
          <Button variant="secondary" className="w-full" onClick={() => setSent(false)}>
            Pedir outro link
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <AuthField
            label="E-mail"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="username"
            placeholder="voce@empresa.com"
          />
          {error && <AuthAlert kind="error">{error}</AuthAlert>}
          <Button type="submit" disabled={submitting || !email} className="w-full">
            {submitting ? "Enviando…" : "Enviar link de redefinição"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
