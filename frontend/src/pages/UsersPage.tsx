import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiError } from "../lib/api";
import { Card, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { PageState } from "../components/ui/PageState";
import type { Role } from "../types/auth";
import { useAuthStore } from "../store/authStore";

interface OrgUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
}

const roleLabel: Record<Role, string> = { ADMIN: "Administrador", MANAGER: "Gerente", ANALYST: "Analista" };

export function UsersPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const { data, isLoading, isError } = useQuery({ queryKey: ["users"], queryFn: () => apiFetch<{ users: OrgUser[] }>("/users") });

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("ANALYST");
  const [formError, setFormError] = useState<string | null>(null);

  const createUser = useMutation({
    mutationFn: () => apiFetch("/users", { method: "POST", body: JSON.stringify({ name, email, password, role }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setFormOpen(false);
      setName("");
      setEmail("");
      setPassword("");
      setRole("ANALYST");
      setFormError(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Erro ao criar usuário"),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      isActive
        ? apiFetch(`/users/${id}`, { method: "DELETE" })
        : apiFetch(`/users/${id}`, { method: "PATCH", body: JSON.stringify({ isActive: true }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  if (isLoading) return <PageState kind="loading" />;
  if (isError || !data) return <PageState kind="error" />;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    createUser.mutate();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Usuários da empresa"
          subtitle="Gerencie contas e níveis de acesso (RBAC)"
          action={<Button onClick={() => setFormOpen((v) => !v)}>{formOpen ? "Cancelar" : "Novo usuário"}</Button>}
        />

        {formOpen && (
          <form onSubmit={handleSubmit} className="mx-5 my-4 grid grid-cols-1 gap-3 rounded-lg border p-4 sm:grid-cols-2" style={{ borderColor: "var(--border-strong)" }}>
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Nome</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" style={{ background: "var(--surface-2)", borderColor: "var(--border-strong)", color: "var(--text-primary)" }} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>E-mail</label>
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" style={{ background: "var(--surface-2)", borderColor: "var(--border-strong)", color: "var(--text-primary)" }} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Senha temporária</label>
              <input required type="password" minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" style={{ background: "var(--surface-2)", borderColor: "var(--border-strong)", color: "var(--text-primary)" }} />
              <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>Mín. 10 caracteres, com maiúscula, minúscula e número.</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Nível de acesso</label>
              <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="w-full rounded-lg border px-3 py-2 text-sm" style={{ background: "var(--surface-2)", borderColor: "var(--border-strong)", color: "var(--text-primary)" }}>
                <option value="ANALYST">Analista (somente leitura)</option>
                <option value="MANAGER">Gerente</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </div>
            {formError && (
              <div className="sm:col-span-2 rounded-lg px-3 py-2 text-sm" style={{ background: "color-mix(in oklab, var(--status-critical) 12%, transparent)", color: "var(--status-critical)" }}>
                {formError}
              </div>
            )}
            <div className="sm:col-span-2">
              <Button type="submit" disabled={createUser.isPending}>{createUser.isPending ? "Criando..." : "Criar usuário"}</Button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto px-5 pb-5 pt-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase" style={{ color: "var(--text-muted)" }}>
                <th className="pb-2 font-medium">Nome</th>
                <th className="pb-2 font-medium">E-mail</th>
                <th className="pb-2 font-medium">Nível</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 text-right font-medium">Ação</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.id} className="border-t" style={{ borderColor: "var(--border-strong)" }}>
                  <td className="py-2" style={{ color: "var(--text-primary)" }}>{u.name}</td>
                  <td className="py-2" style={{ color: "var(--text-secondary)" }}>{u.email}</td>
                  <td className="py-2" style={{ color: "var(--text-secondary)" }}>{roleLabel[u.role]}</td>
                  <td className="py-2">
                    <Badge tone={u.isActive ? "good" : "neutral"}>{u.isActive ? "Ativo" : "Inativo"}</Badge>
                  </td>
                  <td className="py-2 text-right">
                    {u.id !== currentUser?.id && (
                      <button
                        onClick={() => toggleActive.mutate({ id: u.id, isActive: u.isActive })}
                        className="text-xs font-medium"
                        style={{ color: u.isActive ? "var(--status-critical)" : "var(--accent)" }}
                      >
                        {u.isActive ? "Desativar" : "Reativar"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
