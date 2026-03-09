import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import DashboardPage from "./pages/DashboardPage";
import ClientsPage from "./pages/ClientsPage";
import LoansPage from "./pages/LoansPage";
import PaymentsPage from "./pages/PaymentsPage";
import CalendarPage from "./pages/CalendarPage";
import HRPage from "./pages/HRPage";
import AccountingPage from "./pages/AccountingPage";
import ReportsPage from "./pages/ReportsPage";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/clientes" element={<ClientsPage />} />
            <Route path="/emprestimos" element={<LoansPage />} />
            <Route path="/pagamentos" element={<PaymentsPage />} />
            <Route path="/calendario" element={<CalendarPage />} />
            <Route path="/rh" element={<HRPage />} />
            <Route path="/contabilidade" element={<AccountingPage />} />
            <Route path="/relatorios" element={<ReportsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
