import { CheckCircle, Clock, AlertTriangle } from "lucide-react";

type Status = "pago" | "pendente" | "atrasado";

const config: Record<
  Status,
  { Icon: typeof CheckCircle; className: string; label: string }
> = {
  pago: {
    Icon: CheckCircle,
    className: "text-emerald-600 dark:text-emerald-400",
    label: "Pago",
  },
  pendente: {
    Icon: Clock,
    className: "text-amber-600 dark:text-amber-400",
    label: "Pendente",
  },
  atrasado: {
    Icon: AlertTriangle,
    className: "text-red-600 dark:text-red-400",
    label: "Atrasado",
  },
};

interface PaymentStatusCellProps {
  status: string;
  showIcon?: boolean;
}

export function PaymentStatusCell({ status, showIcon = true }: PaymentStatusCellProps) {
  const s = (status || "").toLowerCase() as Status;
  const cfg = config[s] ?? {
    Icon: Clock,
    className: "text-muted-foreground",
    label: status || "—",
  };
  const { Icon, className, label } = cfg;

  return (
    <span className={`inline-flex items-center gap-1.5 font-medium capitalize ${className}`}>
      {showIcon && <Icon className="h-4 w-4 shrink-0" />}
      {label}
    </span>
  );
}
