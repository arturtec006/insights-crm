import { NavLink } from "react-router-dom";
import clsx from "clsx";
import { RoleGate } from "../ui/RoleGate";

const navItems = [
  { to: "/", label: "Visão geral", icon: "📊", end: true },
  { to: "/leads", label: "Leads", icon: "🎯" },
  { to: "/funil", label: "Funil", icon: "📋" },
  { to: "/garimpo", label: "Garimpo", icon: "⛏️" },
  { to: "/vendas", label: "Vendas", icon: "💰" },
  { to: "/clientes", label: "Clientes", icon: "👥" },
  { to: "/financeiro", label: "Financeiro", icon: "🏦" },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={clsx(
          "fixed z-40 flex h-full w-64 flex-col border-r transition-transform md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ background: "var(--surface-1)", borderColor: "var(--border-strong)" }}
      >
        <div className="flex items-center gap-2 px-5 py-5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold"
            style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
          >
            IA
          </div>
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Insights Analytics
          </span>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              style={({ isActive }) => ({
                background: isActive ? "var(--accent-soft)" : "transparent",
                color: isActive ? "var(--accent)" : "var(--text-secondary)",
              })}
            >
              <span aria-hidden>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}

          <RoleGate allow={["ADMIN"]}>
            <div className="my-2 border-t" style={{ borderColor: "var(--border-strong)" }} />
            <NavLink
              to="/usuarios"
              onClick={onClose}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              style={({ isActive }) => ({
                background: isActive ? "var(--accent-soft)" : "transparent",
                color: isActive ? "var(--accent)" : "var(--text-secondary)",
              })}
            >
              <span aria-hidden>⚙️</span>
              Usuários
            </NavLink>
          </RoleGate>
        </nav>

        <div className="px-5 py-4 text-xs" style={{ color: "var(--text-muted)" }}>
          © {new Date().getFullYear()} Insights Analytics
        </div>
      </aside>
    </>
  );
}
