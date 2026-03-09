interface StatusBadgeProps {
  status: string;
  variant?: "default" | "success" | "warning" | "destructive" | "info";
}

const variantMap: Record<string, string> = {
  default: "bg-muted text-muted-foreground",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
};

const autoVariant: Record<string, string> = {
  ativo: "success",
  pago: "success",
  pendente: "warning",
  atrasado: "destructive",
  inativo: "default",
};

export function StatusBadge({ status, variant }: StatusBadgeProps) {
  const v = variant || autoVariant[status.toLowerCase()] || "default";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${variantMap[v]}`}>
      {status}
    </span>
  );
}
