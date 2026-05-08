export type RiskLevel = "green" | "yellow" | "red" | "neutral";

export function clientRiskLevel(
  loans: Array<{ status: string }>
): RiskLevel {
  if (!loans || loans.length === 0) return "neutral";
  const overdue = loans.filter((l) => l.status === "atrasado").length;
  if (overdue === 0) return "green";
  if (overdue / loans.length < 0.4) return "yellow";
  return "red";
}

export const RISK_CONFIG: Record<RiskLevel, { label: string; classes: string }> = {
  green:   { label: "Bom pagador",    classes: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  yellow:  { label: "Atenção",        classes: "text-amber-700 bg-amber-50 border-amber-200" },
  red:     { label: "Em risco",       classes: "text-red-700 bg-red-50 border-red-200" },
  neutral: { label: "Sem histórico",  classes: "text-muted-foreground bg-muted border-border" },
};
