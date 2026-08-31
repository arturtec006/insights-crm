import { useState } from "react";
import { useAuthStore } from "../../store/authStore";
import { useThemeStore } from "../../store/themeStore";
import { Badge } from "../ui/Badge";

const roleLabel: Record<string, string> = {
  ADMIN: "Administrador",
  MANAGER: "Gerente",
  ANALYST: "Analista",
};

export function Topbar({ onMenuClick, title }: { onMenuClick: () => void; title: string }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { theme, toggle } = useThemeStore();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-20 flex items-center justify-between border-b px-4 py-3 backdrop-blur md:px-6"
      style={{ background: "color-mix(in oklab, var(--surface-0) 88%, transparent)", borderColor: "var(--border-strong)" }}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-md p-2 md:hidden"
          style={{ color: "var(--text-secondary)" }}
          aria-label="Abrir menu"
        >
          ☰
        </button>
        <h1 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          className="rounded-lg p-2 text-sm"
          style={{ color: "var(--text-secondary)", border: "1px solid var(--border-strong)" }}
          aria-label="Alternar tema"
          title="Alternar tema claro/escuro"
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm"
            style={{ color: "var(--text-primary)" }}
          >
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold"
              style={{ background: "var(--accent-soft)", color: "var(--accent-text)" }}
            >
              {user?.name?.slice(0, 2).toUpperCase()}
            </div>
            <span className="hidden text-left sm:block">
              <span className="block text-sm font-medium leading-tight">{user?.name}</span>
              <span className="block text-xs leading-tight" style={{ color: "var(--text-muted)" }}>
                {user && roleLabel[user.role]}
              </span>
            </span>
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div
                className="absolute right-0 z-20 mt-2 w-56 rounded-lg border p-2 shadow-lg"
                style={{ background: "var(--surface-1)", borderColor: "var(--border-strong)" }}
              >
                <div className="px-2 py-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                  {user?.email}
                </div>
                <div className="px-2 pb-2">
                  <Badge tone="neutral">{user && roleLabel[user.role]}</Badge>
                </div>
                <button
                  onClick={logout}
                  className="w-full rounded-md px-2 py-1.5 text-left text-sm font-medium"
                  style={{ color: "var(--status-critical)" }}
                >
                  Sair
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
