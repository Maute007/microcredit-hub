import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  variant?: "default" | "primary" | "success" | "warning" | "destructive";
  sparkData?: number[];
  progress?: { value: number; max: number; label?: string };
}

const variantStyles = {
  default: "bg-card border-border",
  primary: "bg-gradient-to-br from-primary/8 to-primary/3 border-primary/20",
  success: "bg-gradient-to-br from-success/8 to-success/3 border-success/20",
  warning: "bg-gradient-to-br from-warning/8 to-warning/3 border-warning/20",
  destructive: "bg-gradient-to-br from-destructive/8 to-destructive/3 border-destructive/20",
};

const iconVariantStyles = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary/15 text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/15 text-destructive",
};

const sparkColorMap = {
  default: "hsl(var(--muted-foreground))",
  primary: "hsl(var(--primary))",
  success: "hsl(var(--success))",
  warning: "hsl(var(--warning))",
  destructive: "hsl(var(--destructive))",
};

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const h = 32;
  const w = 80;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={w} height={h} className="opacity-60">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProgressBar({ value, max, label, variant }: { value: number; max: number; label?: string; variant: string }) {
  const pct = Math.min((value / max) * 100, 100);
  const barColor = variant === "destructive" ? "bg-destructive" : variant === "warning" ? "bg-warning" : variant === "success" ? "bg-success" : "bg-primary";

  return (
    <div className="mt-2">
      <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
        <span>{label || `${Math.round(pct)}%`}</span>
        <span>{value}/{max}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function StatCard({ title, value, subtitle, icon: Icon, trend, variant = "default", sparkData, progress }: StatCardProps) {
  return (
    <div className={`rounded-xl border p-5 animate-fade-in transition-shadow hover:shadow-md ${variantStyles[variant]}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold tracking-tight mt-1.5">{value}</p>
          <div className="flex items-center gap-2 mt-1.5">
            {trend && (
              <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-md ${
                trend.value >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
              }`}>
                {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}%
              </span>
            )}
            {trend && <span className="text-[10px] text-muted-foreground">{trend.label}</span>}
            {subtitle && !trend && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className={`rounded-xl p-2.5 ${iconVariantStyles[variant]}`}>
            <Icon className="h-5 w-5" />
          </div>
          {sparkData && <MiniSparkline data={sparkData} color={sparkColorMap[variant]} />}
        </div>
      </div>
      {progress && <ProgressBar value={progress.value} max={progress.max} label={progress.label} variant={variant} />}
    </div>
  );
}
