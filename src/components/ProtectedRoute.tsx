import { Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { systemApi, type ApiSystemSettings } from "@/lib/api";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Permissão única exigida para aceder à rota. Ex: "view_loan". */
  requiredPermission?: string;
  /** Lista de permissões — basta UMA delas para passar. Útil para módulos com várias entidades. */
  anyOfPermissions?: readonly string[];
}

export function ProtectedRoute({
  children,
  requiredPermission,
  anyOfPermissions,
}: ProtectedRouteProps) {
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

  // Verificação de permissão a nível de rota — impede acesso directo via URL
  // por utilizadores sem privilégio (a sidebar já filtra, mas isto blinda navegação directa).
  if (requiredPermission || anyOfPermissions?.length) {
    const perms = user?.permissions ?? [];
    const isSuper = !!user?.is_superuser;
    const has = (codename: string) =>
      isSuper ||
      perms.includes("*") ||
      perms.includes(codename) ||
      perms.some((p) => p === codename || p.endsWith(`.${codename}`));

    const allowed =
      isSuper ||
      (requiredPermission ? has(requiredPermission) : false) ||
      (anyOfPermissions?.length ? anyOfPermissions.some((p) => has(p)) : false);

    if (!allowed) {
      return <PermissionDenied />;
    }
  }

  return <>{children}</>;
}

/** Mensagem amigável quando o utilizador autenticado não tem permissão para a página. */
function PermissionDenied() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <div className="max-w-md w-full rounded-2xl border bg-card shadow-lg p-8 text-center space-y-4 animate-fade-in">
        <div className="mx-auto h-14 w-14 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">Sem permissão</h1>
          <p className="text-sm text-muted-foreground mt-1">
            A sua conta não tem privilégios para aceder a este módulo. Se isto parecer um erro,
            contacte um administrador para rever as permissões do seu perfil.
          </p>
        </div>
        <Button asChild variant="outline">
          <a href="/dashboard">Voltar ao Dashboard</a>
        </Button>
      </div>
    </div>
  );
}
