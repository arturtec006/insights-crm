import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { AppLayout } from "./components/layout/AppLayout";
import { LoginPage } from "./pages/LoginPage";
import { OverviewPage } from "./pages/OverviewPage";
import { SalesPage } from "./pages/SalesPage";
import { CustomersPage } from "./pages/CustomersPage";
import { LeadsPage } from "./pages/LeadsPage";
import { LeadDetailPage } from "./pages/LeadDetailPage";
import { PipelinePage } from "./pages/PipelinePage";
import { ProspectingPage } from "./pages/ProspectingPage";
import { FinancialPage } from "./pages/FinancialPage";
import { UsersPage } from "./pages/UsersPage";

export default function App() {
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/vendas" element={<SalesPage />} />
          <Route path="/clientes" element={<CustomersPage />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/leads/:id" element={<LeadDetailPage />} />
          <Route path="/funil" element={<PipelinePage />} />
          <Route path="/garimpo" element={<ProspectingPage />} />
          <Route path="/financeiro" element={<FinancialPage />} />
          <Route element={<ProtectedRoute allow={["ADMIN"]} />}>
            <Route path="/usuarios" element={<UsersPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
