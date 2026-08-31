import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

const titles: Record<string, string> = {
  "/": "Visão geral",
  "/leads": "Leads",
  "/funil": "Funil",
  "/garimpo": "Garimpo",
  "/vendas": "Vendas",
  "/clientes": "Clientes",
  "/financeiro": "Financeiro",
  "/usuarios": "Usuários",
};

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  // Longest-prefix match, so nested routes inherit their section's name:
  // an exact lookup left /leads/<id> — the lead detail page — titled "Dashboard".
  const title =
    Object.entries(titles)
      .filter(([path]) => path === "/" ? location.pathname === "/" : location.pathname.startsWith(path))
      .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ?? "Insights CRM";

  return (
    <div className="flex h-full" style={{ background: "var(--surface-0)" }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setSidebarOpen(true)} title={title} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
