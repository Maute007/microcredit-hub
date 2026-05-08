import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ApiAuthBridge } from "@/components/ApiAuthBridge";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppLayout } from "@/components/AppLayout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ClientsPage from "./pages/ClientsPage";
import LoansPage from "./pages/LoansPage";
import PaymentsPage from "./pages/PaymentsPage";
import CalendarPage from "./pages/CalendarPage";
import HRPage from "./pages/HRPage";
import UsersPage from "./pages/UsersPage";
import ReportsPage from "./pages/ReportsPage";
import AuditLogPage from "./pages/AuditLogPage";
import VerifyContractPage from "./pages/VerifyContractPage";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // 5min - evita refetch desnecessários
      gcTime: 30 * 60 * 1000,        // 30min - mantém cache mais tempo
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: (failureCount, error) => {
        const status = (error as { status?: number })?.status;
        if (status === 401) return false;
        if (status === 429) return false;
        if (status === 0) return false;
        return failureCount < 2;
      },
    },
  },
});

const App = () => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ApiAuthBridge />
        <ThemeProvider>
        <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Raiz redireciona sempre para login — utilizadores autenticados são enviados
                para /dashboard pelo LoginPage automaticamente */}
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* Página pública */}
            <Route path="/login" element={<LoginPage />} />

            {/* Rotas protegidas */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <DashboardPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/clientes"
              element={
                <ProtectedRoute requiredPermission="view_client">
                  <AppLayout>
                    <ClientsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/emprestimos"
              element={
                <ProtectedRoute requiredPermission="view_loan">
                  <AppLayout>
                    <LoansPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/pagamentos"
              element={
                <ProtectedRoute requiredPermission="view_payment">
                  <AppLayout>
                    <PaymentsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/calendario"
              element={
                <ProtectedRoute requiredPermission="view_calendarevent">
                  <AppLayout>
                    <CalendarPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            {/* Compatibilidade: atalhos antigos de tarefas/agendamento redirecionam para Calendário */}
            <Route path="/tasks" element={<Navigate to="/calendario" replace />} />
            <Route path="/tarefas" element={<Navigate to="/calendario" replace />} />
            <Route path="/suite/tasks" element={<Navigate to="/calendario" replace />} />
            <Route path="/suite/tarefas" element={<Navigate to="/calendario" replace />} />
            <Route path="/agendamento" element={<Navigate to="/calendario" replace />} />
            <Route path="/schedule" element={<Navigate to="/calendario" replace />} />
            <Route
              path="/rh"
              element={
                <ProtectedRoute requiredPermission="view_employee">
                  <AppLayout>
                    <HRPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/utilizadores"
              element={
                <ProtectedRoute
                  anyOfPermissions={[
                    "view_user",
                    "add_user",
                    "change_user",
                    "delete_user",
                    "view_role",
                    "add_role",
                    "change_role",
                    "delete_role",
                    "view_systemsettings",
                    "change_systemsettings",
                  ]}
                >
                  <AppLayout>
                    <UsersPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/auditoria"
              element={
                <ProtectedRoute requiredPermission="view_user">
                  <AppLayout>
                    <AuditLogPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/relatorios"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ReportsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/verificar"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <VerifyContractPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            {/* Rota desconhecida → redireciona para login (protegido por default) */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
        </ThemeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
