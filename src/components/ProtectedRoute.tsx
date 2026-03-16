import { Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { systemApi, type ApiSystemSettings } from "@/lib/api";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // Chamar sempre o hook de query, mas só activar depois de autenticado
  const {
    data: systemSettings,
    isLoading: settingsLoading,
  } = useQuery<ApiSystemSettings>({
    queryKey: ["system-settings"],
    queryFn: systemApi.get,
    enabled: isAuthenticated, // evita 401 antes de login e mantém ordem de hooks estável
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">A carregar...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (settingsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">A verificar estado do sistema...</div>
      </div>
    );
  }

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
