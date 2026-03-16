import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ApiAuthBridge } from "@/components/ApiAuthBridge";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ClientsPage from "./pages/ClientsPage";
import LoansPage from "./pages/LoansPage";
import PaymentsPage from "./pages/PaymentsPage";
import CalendarPage from "./pages/CalendarPage";
import HRPage from "./pages/HRPage";
import AccountingPage from "./pages/AccountingPage";
import UsersPage from "./pages/UsersPage";
import ReportsPage from "./pages/ReportsPage";
import AuditLogPage from "./pages/AuditLogPage";
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
        return failureCount < 2;
      },
    },
  },
});

const App = () => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ApiAuthBridge />
        <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
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
                <ProtectedRoute>
                  <AppLayout>
                    <ClientsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/emprestimos"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <LoansPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/pagamentos"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <PaymentsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/calendario"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <CalendarPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/rh"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <HRPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/contabilidade"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <AccountingPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/utilizadores"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <UsersPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/auditoria"
              element={
                <ProtectedRoute>
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
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
