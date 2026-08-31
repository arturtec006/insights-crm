import { NavLink } from "react-router-dom";
import clsx from "clsx";
import { RoleGate } from "../ui/RoleGate";
import { Icon } from "../ui/Icon";

const navGroups = [
  {
    label: null,
    items: [
      { to: "/", label: "Visão geral", Icon: Icon.Overview, end: true },
      { to: "/leads", label: "Leads", Icon: Icon.Leads },
      { to: "/funil", label: "Funil", Icon: Icon.Pipeline },
      { to: "/garimpo", label: "Garimpo", Icon: Icon.Prospect },
    ],
  },
  {
    label: "Pós-venda",
    items: [
      { to: "/vendas", label: "Vendas", Icon: Icon.Sales },
      { to: "/clientes", label: "Clientes", Icon: Icon.Customers },
      { to: "/financeiro", label: "Financeiro", Icon: Icon.Finance },
    ],
  },
];

interface NavItemProps {
  to: string;
  label: string;
  Icon: (p: { size?: number }) => React.ReactElement;
  end?: boolean;
  onClose: () => void;
}

// One row of navigation. The active state is carried by background *and* text
// colour rather than colour alone, so it survives a colour-vision difference.
function NavItem({ to, label, Icon: ItemIcon, end, onClose }: NavItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClose}
      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
      style={({ isActive }) => ({
        background: isActive ? "var(--accent-soft)" : "transparent",
        color: isActive ? "var(--accent-text)" : "var(--text-secondary)",
      })}
    >
      <ItemIcon size={16} />
      {label}
    </NavLink>
  );
}

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

        <nav className="flex-1 space-y-4 px-3">
          {navGroups.map((group, i) => (
            <div key={group.label ?? i} className="space-y-1">
              {group.label && (
                <p
                  className="px-3 pb-1 text-[11px] font-medium uppercase"
                  style={{ color: "var(--text-muted)", letterSpacing: "0.06em" }}
                >
                  {group.label}
                </p>
              )}
              {group.items.map((item) => (
                <NavItem key={item.to} {...item} onClose={onClose} />
              ))}
            </div>
          ))}

          <RoleGate allow={["ADMIN"]}>
            <div className="space-y-1 border-t pt-4" style={{ borderColor: "var(--border-subtle)" }}>
              <NavItem to="/usuarios" label="Usuários" Icon={Icon.Settings} onClose={onClose} />
            </div>
          </RoleGate>
        </nav>

        <div className="px-5 py-4 text-xs" style={{ color: "var(--text-muted)" }}>
          © {new Date().getFullYear()} Insights Analytics
        </div>
      </aside>
    </>
  );
}
