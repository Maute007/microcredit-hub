import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  /** Tamanho compacto, indicado para uso dentro de tabelas */
  compact?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center animate-fade-in",
        compact ? "py-10 px-4" : "py-16 px-6",
        className,
      )}
    >
      {Icon && (
        <div
          className={cn(
            "rounded-full bg-muted/60 flex items-center justify-center mb-4",
            compact ? "h-12 w-12" : "h-16 w-16",
          )}
        >
          <Icon
            className={cn(
              "text-muted-foreground",
              compact ? "h-5 w-5" : "h-7 w-7",
            )}
          />
        </div>
      )}
      <h3 className={cn("font-semibold text-foreground", compact ? "text-sm" : "text-base")}>
        {title}
      </h3>
      {description && (
        <p
          className={cn(
            "text-muted-foreground max-w-sm mt-1",
            compact ? "text-xs" : "text-sm",
          )}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
