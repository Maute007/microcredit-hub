import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QueryErrorAlertProps {
  message?: string;
  onRetry: () => void;
}

export function QueryErrorAlert({ message = "Não foi possível carregar os dados.", onRetry }: QueryErrorAlertProps) {
  return (
    <div
      className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3"
      role="alert"
    >
      <div className="rounded-lg bg-destructive/10 p-2 shrink-0">
        <AlertTriangle className="h-5 w-5 text-destructive" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-destructive">Erro ao carregar</p>
        <p className="text-sm text-muted-foreground mt-0.5">{message}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}
