import { Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { systemApi, type ApiSystemSettings } from "@/lib/api";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  const {
    data: systemSettings,
    isLoading: settingsLoading,
  } = useQuery<ApiSystemSettings>({
    queryKey: ["system-settings"],
    queryFn: systemApi.get,
    enabled: isAuthenticated,
  });

  // Enquanto verifica autenticação — mostra tela neutra (não revela conteúdo protegido)
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40">
        <div className="animate-pulse text-muted-foreground text-sm">A verificar sessão...</div>
      </div>
    );
  }

  // Não autenticado → redireciona para login, guarda origem para voltar depois
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Autenticado mas ainda a carregar configurações do sistema
  if (settingsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40">
        <div className="animate-pulse text-muted-foreground text-sm">A carregar...</div>
      </div>
    );
  }

  // Sistema bloqueado: apenas superutilizadores passam
  if (systemSettings?.is_locked && !user?.is_superuser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
        <div className="max-w-lg w-full rounded-2xl border bg-card shadow-lg p-6 space-y-4 text-center">
          <h1 className="text-xl font-semibold">Sistema temporariamente indisponível</h1>
          <p className="text-sm text-muted-foreground whitespace-pre-line">
            {systemSettings.locked_message ||
              "O sistema está em manutenção ou bloqueado. Por favor contacte o responsável pelo sistema."}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
