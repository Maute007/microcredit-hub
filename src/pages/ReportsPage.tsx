import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/data/mockData";
import { FileText, Download, Users, Wallet, CreditCard, BarChart3, UserCog, BookOpen, Loader2, Building2, TrendingUp, TrendingDown, Activity, Target, Percent, Receipt } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QueryErrorAlert } from "@/components/QueryErrorAlert";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Area, AreaChart, Legend } from "recharts";
import { format, parseISO } from "date-fns";
import type { ExportColumn, ExportMeta } from "@/lib/exporters";
import {
  clientsApi,
  loansApi,
  paymentsApi,
  hrApi,
  reportsApi,
  type ApiClient,
  type ApiLoan,
  type ApiPayment,
  type ApiEmployee,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/data/mockData";

const DATE_PRESETS = [
  {
    id: "today",
    label: "Hoje",
    getValue: () => {
      const d = new Date().toISOString().slice(0, 10);
      return { from: d, to: d };
    },
  },
  {
    id: "week",
    label: "7 dias",
    getValue: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 6);
      return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
    },
  },
  {
    id: "month",
    label: "Mês",
    getValue: () => {
      const d = new Date();
      const from = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
      const to = d.toISOString().slice(0, 10);
      return { from, to };
    },
  },
  {
    id: "quarter",
    label: "Trimestre",
    getValue: () => {
      const d = new Date();
      const q = Math.floor(d.getMonth() / 3);
      const from = new Date(d.getFullYear(), q * 3, 1).toISOString().slice(0, 10);
      const to = d.toISOString().slice(0, 10);
      return { from, to };
    },
  },
  {
    id: "clear",
    label: "Tudo",
    getValue: () => ({ from: "", to: "" }),
  },
] as const;

const LOAN_STATUS_COLORS: Record<string, string> = {
  atrasado: "hsl(var(--destructive))",
  ativo: "hsl(var(--primary))",
  pendente: "hsl(var(--warning))",
  pago: "hsl(var(--success))",
  cancelado: "hsl(var(--muted-foreground))",
};

/** Tokens visuais para Recharts respeitarem o tema actual (light/dark). */
const CHART_AXIS = "hsl(var(--muted-foreground))";
const CHART_GRID = "hsl(var(--border))";
const CHART_TOOLTIP_STYLE: React.CSSProperties = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
  color: "hsl(var(--popover-foreground))",
  boxShadow: "0 8px 24px -8px hsl(var(--foreground) / 0.15)",
};

/* Defini\u00e7\u00f5es das colunas de cada relat\u00f3rio \u2014 partilhadas entre Excel/PDF/CSV. */
const STATUS_LABELS: Record<string, string> = {
  ativo: "Ativo",
  pago: "Pago",
  atrasado: "Atrasado",
  pendente: "Pendente",
  cancelado: "Cancelado",
  inativo: "Inativo",
};

const clientColumns: ExportColumn<ApiClient>[] = [
  { header: "ID", accessor: (c) => c.id, width: 8, align: "right" },
  { header: "Nome", accessor: (c) => c.name, width: 28 },
  { header: "Email", accessor: (c) => c.email ?? "", width: 24 },
  { header: "Telefone", accessor: (c) => c.phone ?? "", width: 14 },
  { header: "Documento", accessor: (c) => c.document ?? "", width: 14 },
  { header: "Cidade", accessor: (c) => c.city ?? "", width: 14 },
  { header: "Profiss\u00e3o", accessor: (c) => c.occupation ?? "", width: 16 },
  { header: "Status", accessor: (c) => STATUS_LABELS[c.status] ?? c.status, width: 10 },
  { header: "Empr\u00e9stimos", accessor: (c) => c.total_loans ?? 0, width: 12, align: "right" },
];

const loanColumns: ExportColumn<ApiLoan>[] = [
  { header: "ID", accessor: (l) => l.id, width: 8, align: "right" },
  { header: "Cliente", accessor: (l) => l.client_name ?? "", width: 26 },
  { header: "Valor (MT)", accessor: (l) => l.amount, width: 14, align: "right",
    pdfFormatter: (v) => formatCurrency(Number(v)) },
  { header: "Taxa %", accessor: (l) => l.interest_rate, width: 8, align: "right" },
  { header: "Prazo", accessor: (l) => l.term, width: 8, align: "right" },
  { header: "Presta\u00e7\u00e3o", accessor: (l) => l.monthly_payment, width: 14, align: "right",
    pdfFormatter: (v) => formatCurrency(Number(v)) },
  { header: "Total", accessor: (l) => l.total_amount, width: 14, align: "right",
    pdfFormatter: (v) => formatCurrency(Number(v)) },
  { header: "Saldo devedor", accessor: (l) => l.remaining_balance, width: 14, align: "right",
    pdfFormatter: (v) => formatCurrency(Number(v)) },
  { header: "Status", accessor: (l) => STATUS_LABELS[l.status] ?? l.status, width: 10 },
  { header: "In\u00edcio", accessor: (l) => l.start_date ?? "", width: 12 },
  { header: "Fim", accessor: (l) => l.end_date ?? "", width: 12 },
];

const paymentColumns: ExportColumn<ApiPayment>[] = [
  { header: "ID", accessor: (p) => p.id, width: 8, align: "right" },
  { header: "Empr\u00e9stimo", accessor: (p) => p.loan, width: 12, align: "right" },
  { header: "Cliente", accessor: (p) => p.loan_client_name ?? p.client_name ?? "", width: 24 },
  { header: "Parcela", accessor: (p) => p.installment_number ?? "", width: 8, align: "right" },
  { header: "Valor", accessor: (p) => p.amount, width: 14, align: "right",
    pdfFormatter: (v) => formatCurrency(Number(v)) },
  { header: "Data", accessor: (p) => p.date ?? "", width: 12 },
  { header: "M\u00e9todo", accessor: (p) => p.method ?? "", width: 12 },
  { header: "Status", accessor: (p) => STATUS_LABELS[p.status] ?? p.status, width: 10 },
];

const employeeColumns: ExportColumn<ApiEmployee>[] = [
  { header: "ID", accessor: (e) => e.id, width: 8, align: "right" },
  { header: "Nome", accessor: (e) => e.name, width: 26 },
  { header: "Email", accessor: (e) => e.email ?? "", width: 24 },
  { header: "Cargo", accessor: (e) => e.role ?? "", width: 16 },
  { header: "Telefone", accessor: (e) => e.phone ?? "", width: 14 },
  { header: "Sal\u00e1rio base", accessor: (e) => e.base_salary, width: 14, align: "right",
    pdfFormatter: (v) => formatCurrency(Number(v)) },
  { header: "Status", accessor: (e) => STATUS_LABELS[e.status] ?? e.status, width: 10 },
  { header: "Admiss\u00e3o", accessor: (e) => e.hire_date ?? "", width: 12 },
];

const overdueColumns: ExportColumn<ApiLoan>[] = [
  { header: "ID", accessor: (l) => l.id, width: 8, align: "right" },
  { header: "Cliente", accessor: (l) => l.client_name ?? "", width: 28 },
  { header: "Valor original", accessor: (l) => l.amount, width: 14, align: "right",
    pdfFormatter: (v) => formatCurrency(Number(v)) },
  { header: "Saldo devedor", accessor: (l) => l.remaining_balance, width: 14, align: "right",
    pdfFormatter: (v) => formatCurrency(Number(v)) },
  { header: "Presta\u00e7\u00e3o", accessor: (l) => l.monthly_payment, width: 14, align: "right",
    pdfFormatter: (v) => formatCurrency(Number(v)) },
  { header: "In\u00edcio", accessor: (l) => l.start_date ?? "", width: 12 },
  { header: "Fim", accessor: (l) => l.end_date ?? "", width: 12 },
];

function dateLabelMemoSafe(from: string, to: string): string {
  if (!from && !to) return "Todos os dados";
  if (from && to) return `Período: ${from} — ${to}`;
  if (from) return `Desde ${from}`;
  return `Até ${to}`;
}

function withinDateRange(dateStr: string | undefined | null, from: string, to: string) {
  if (!dateStr) return false;
  const d = parseISO(dateStr);
  if (from) {
    const f = parseISO(from);
    if (d < f) return false;
  }
  if (to) {
    const t = parseISO(to);
    if (d > t) return false;
  }
  return true;
}

function monthKey(dateStr: string) {
  return format(parseISO(dateStr), "yyyy-MM");
}

const REPORTS_DATE_KEY = "ui:reports-date-range";

/** Calcula o período anterior com a mesma duração. Retorna strings ISO yyyy-mm-dd. */
function previousPeriodRange(from: string, to: string): { from: string; to: string } | null {
  if (!from || !to) return null;
  const f = parseISO(from);
  const t = parseISO(to);
  if (isNaN(f.getTime()) || isNaN(t.getTime())) return null;
  const days = Math.round((t.getTime() - f.getTime()) / (1000 * 60 * 60 * 24));
  const prevTo = new Date(f);
  prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevFrom.getDate() - days);
  return {
    from: prevFrom.toISOString().slice(0, 10),
    to: prevTo.toISOString().slice(0, 10),
  };
}

/** Calcula variação percentual; retorna null se base for 0. */
function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

export default function ReportsPage() {
  const { toast } = useToast();
  const [dateFrom, setDateFrom] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      return JSON.parse(window.localStorage.getItem(REPORTS_DATE_KEY) || "{}").from || "";
    } catch {
      return "";
    }
  });
  const [dateTo, setDateTo] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      return JSON.parse(window.localStorage.getItem(REPORTS_DATE_KEY) || "{}").to || "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(REPORTS_DATE_KEY, JSON.stringify({ from: dateFrom, to: dateTo }));
  }, [dateFrom, dateTo]);

  // BdM Report state
  const [bomDateFrom, setBomDateFrom] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [bomDateTo, setBomDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [bomPeriodLabel, setBomPeriodLabel] = useState(() => {
    const d = new Date();
    return `${d.toLocaleString("pt-PT", { month: "long" })} de ${d.getFullYear()}`;
  });
  const [bomExporting, setBomExporting] = useState(false);

  const {
    data: clients = [],
    isLoading: clientsLoading,
    isError: clientsError,
    error: clientsErr,
    refetch: refetchClients,
  } = useQuery({
    queryKey: ["reports-clients"],
    queryFn: () => clientsApi.list(),
  });

  const {
    data: loans = [],
    isLoading: loansLoading,
    isError: loansError,
    error: loansErr,
    refetch: refetchLoans,
  } = useQuery({
    queryKey: ["reports-loans"],
    queryFn: () => loansApi.list({ page_size: 500 }),
  });

  const {
    data: payments = [],
    isLoading: paymentsLoading,
    isError: paymentsError,
    error: paymentsErr,
    refetch: refetchPayments,
  } = useQuery({
    queryKey: ["reports-payments"],
    queryFn: () => paymentsApi.list(),
  });

  const {
    data: employees = [],
    isLoading: employeesLoading,
    isError: employeesError,
    error: employeesErr,
    refetch: refetchEmployees,
  } = useQuery({
    queryKey: ["reports-employees"],
    queryFn: () => hrApi.employees.list({ page_size: 200 }),
  });

  const activeClients = clients.filter((c) => c.status === "ativo");
  const hasDateFilter = Boolean(dateFrom || dateTo);

  const filteredPayments = useMemo(
    () =>
      hasDateFilter
        ? payments.filter((p) => withinDateRange(p.date, dateFrom, dateTo))
        : payments,
    [payments, dateFrom, dateTo, hasDateFilter],
  );
  const paidAmount = filteredPayments.filter((p) => p.status === "pago").reduce((s, p) => s + p.amount, 0);
  const expectedAmount = filteredPayments.reduce((s, p) => s + p.amount, 0);
  const collectionRate = expectedAmount > 0 ? Math.round((paidAmount / expectedAmount) * 100) : 0;

  const activeEmployees = employees.filter((e) => e.status === "ativo");
  const totalSalary = activeEmployees.reduce((s, e) => s + e.base_salary, 0);
  const overdueLoans = loans.filter((l) => l.status === "atrasado");
  const overdueTotal = overdueLoans.reduce((s, l) => s + l.remaining_balance, 0);
  const portfolioTotal = loans.reduce((s, l) => s + (l.remaining_balance ?? l.amount), 0);
  const parRate = portfolioTotal > 0 ? (overdueTotal / portfolioTotal) * 100 : 0;
  const avgTicket = loans.length > 0 ? loans.reduce((s, l) => s + l.amount, 0) / loans.length : 0;
  const avgTerm = loans.length > 0 ? loans.reduce((s, l) => s + l.term, 0) / loans.length : 0;

  // Período anterior — para deltas
  const prevRange = previousPeriodRange(dateFrom, dateTo);
  const prevPayments = useMemo(
    () =>
      prevRange
        ? payments.filter((p) => withinDateRange(p.date, prevRange.from, prevRange.to))
        : [],
    [payments, prevRange],
  );
  const prevPaidAmount = prevPayments.filter((p) => p.status === "pago").reduce((s, p) => s + p.amount, 0);
  const prevClients = useMemo(
    () =>
      prevRange
        ? clients.filter((c) => withinDateRange(c.created_at, prevRange.from, prevRange.to))
        : [],
    [clients, prevRange],
  );
  const newClientsInPeriod = hasDateFilter
    ? clients.filter((c) => withinDateRange(c.created_at, dateFrom, dateTo)).length
    : clients.length;
  const newClientsPrev = prevClients.length;

  const trendPaid = prevRange ? pctChange(paidAmount, prevPaidAmount) : null;
  const trendNewClients = prevRange ? pctChange(newClientsInPeriod, newClientsPrev) : null;

  const loanStatusData = useMemo(() => {
    const map: Record<string, number> = {};
    loans.forEach((l) => { map[l.status] = (map[l.status] || 0) + 1; });
    const labelMap: Record<string, string> = {
      ativo: "Ativo",
      pago: "Pago",
      atrasado: "Atrasado",
      pendente: "Pendente",
      cancelado: "Cancelado",
    };
    return Object.entries(map)
      .map(([k, v]) => ({ status: k, name: labelMap[k] || k, value: v, color: LOAN_STATUS_COLORS[k] || "hsl(var(--muted-foreground))" }))
      .sort((a, b) => b.value - a.value);
  }, [loans]);

  const paymentsMonthly = useMemo(() => {
    const map: Record<string, { month: string; recebido: number; pendente: number }> = {};
    filteredPayments.forEach((p) => {
      const key = monthKey(p.date);
      if (!map[key]) map[key] = { month: key, recebido: 0, pendente: 0 };
      if (p.status === "pago") map[key].recebido += p.amount;
      else map[key].pendente += p.amount;
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
  }, [filteredPayments]);

  const topClientsByBalance = useMemo(() => {
    const list = [...loans]
      .reduce((acc, l) => {
        const name = l.client_name || "—";
        acc[name] = (acc[name] || 0) + (l.remaining_balance ?? 0);
        return acc;
      }, {} as Record<string, number>);
    return Object.entries(list)
      .map(([name, value]) => ({ name, value }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [loans]);

  /** Helper que monta meta + chama o exporter pedido. Carrega o módulo de export só quando precisa. */
  const runExport = async <T,>(
    format: "xlsx" | "pdf" | "csv",
    rows: T[],
    columns: ExportColumn<T>[],
    meta: ExportMeta,
    label: string,
  ) => {
    if (rows.length === 0) {
      toast({ title: "Sem dados", description: "Não há registos para exportar.", variant: "destructive" });
      return;
    }
    try {
      const mod = await import("@/lib/exporters");
      if (format === "xlsx") mod.exportToExcel(rows, columns, meta);
      else if (format === "pdf") mod.exportToPdf(rows, columns, meta);
      else mod.exportToCsv(rows, columns, meta);
      toast({
        title: `${format.toUpperCase()} exportado`,
        description: `${label} • ${rows.length} registo(s).`,
      });
    } catch (err) {
      toast({
        title: "Erro ao exportar",
        description: err instanceof Error ? err.message : "Falha desconhecida.",
        variant: "destructive",
      });
    }
  };

  const periodSubtitle = dateLabelMemoSafe(dateFrom, dateTo);
  const baseMeta: Omit<ExportMeta, "title"> = {
    subtitle: periodSubtitle,
    brand: "MAKIRA · Microcredit Hub",
  };

  type ReportDef = {
    id: string;
    title: string;
    description: string;
    icon: typeof Users;
    stats: string;
    color: string;
    onExcel: () => void;
    onPdf: () => void;
    onCsv: () => void;
  };

  const reports: ReportDef[] = [
    {
      id: "clientes",
      title: "Relatório de Clientes",
      description: "Lista completa com dados pessoais, status e estado da dívida de cada cliente",
      icon: Users,
      stats: `${clients.length} clientes • ${activeClients.length} ativos`,
      color: "bg-primary/10 text-primary",
      onExcel: () => runExport("xlsx", clients, clientColumns, {
        ...baseMeta,
        title: "Relatório de Clientes",
        summary: [
          { label: "Total", value: String(clients.length) },
          { label: "Ativos", value: String(activeClients.length) },
        ],
      }, "Clientes"),
      onPdf: () => runExport("pdf", clients, clientColumns, {
        ...baseMeta,
        title: "Relatório de Clientes",
        summary: [
          { label: "Total", value: String(clients.length) },
          { label: "Ativos", value: String(activeClients.length) },
        ],
      }, "Clientes"),
      onCsv: () => runExport("csv", clients, clientColumns, { ...baseMeta, title: "Relatório de Clientes" }, "Clientes"),
    },
    {
      id: "emprestimos",
      title: "Relatório de Empréstimos",
      description: "Todos os empréstimos com valores, parcelas, juros e status actualizado",
      icon: Wallet,
      stats: `${loans.length} empréstimos • ${formatCurrency(portfolioTotal)} em carteira`,
      color: "bg-info/10 text-info",
      onExcel: () => runExport("xlsx", loans, loanColumns, {
        ...baseMeta,
        title: "Relatório de Empréstimos",
        summary: [
          { label: "Carteira", value: formatCurrency(portfolioTotal) },
          { label: "Empréstimos", value: String(loans.length) },
          { label: "Ticket médio", value: formatCurrency(avgTicket) },
          { label: "PAR", value: `${parRate.toFixed(1)}%` },
        ],
      }, "Empréstimos"),
      onPdf: () => runExport("pdf", loans, loanColumns, {
        ...baseMeta,
        title: "Relatório de Empréstimos",
        summary: [
          { label: "Carteira", value: formatCurrency(portfolioTotal) },
          { label: "Empréstimos", value: String(loans.length) },
          { label: "Ticket médio", value: formatCurrency(avgTicket) },
          { label: "PAR", value: `${parRate.toFixed(1)}%` },
        ],
      }, "Empréstimos"),
      onCsv: () => runExport("csv", loans, loanColumns, { ...baseMeta, title: "Relatório de Empréstimos" }, "Empréstimos"),
    },
    {
      id: "pagamentos",
      title: "Relatório de Pagamentos",
      description: "Histórico detalhado de todos os pagamentos, incluindo método e comprovativo",
      icon: CreditCard,
      stats: `${payments.length} pagamentos • ${formatCurrency(paidAmount)} recebido`,
      color: "bg-success/10 text-success",
      onExcel: () => runExport("xlsx", filteredPayments, paymentColumns, {
        ...baseMeta,
        title: "Relatório de Pagamentos",
        summary: [
          { label: "Recebido", value: formatCurrency(paidAmount) },
          { label: "Pagamentos", value: String(filteredPayments.length) },
          { label: "Taxa de cobrança", value: `${collectionRate}%` },
        ],
      }, "Pagamentos"),
      onPdf: () => runExport("pdf", filteredPayments, paymentColumns, {
        ...baseMeta,
        title: "Relatório de Pagamentos",
        summary: [
          { label: "Recebido", value: formatCurrency(paidAmount) },
          { label: "Pagamentos", value: String(filteredPayments.length) },
          { label: "Taxa de cobrança", value: `${collectionRate}%` },
        ],
      }, "Pagamentos"),
      onCsv: () => runExport("csv", filteredPayments, paymentColumns, { ...baseMeta, title: "Relatório de Pagamentos" }, "Pagamentos"),
    },
    {
      id: "rh",
      title: "Relatório de RH",
      description: "Dados de colaboradores, férias programadas e folha salarial com descontos",
      icon: UserCog,
      stats: `${employees.length} colaboradores • ${formatCurrency(totalSalary)}/mês`,
      color: "bg-accent/10 text-accent",
      onExcel: () => runExport("xlsx", employees, employeeColumns, {
        ...baseMeta,
        title: "Relatório de Recursos Humanos",
        summary: [
          { label: "Total", value: String(employees.length) },
          { label: "Ativos", value: String(activeEmployees.length) },
          { label: "Folha mensal", value: formatCurrency(totalSalary) },
        ],
      }, "RH"),
      onPdf: () => runExport("pdf", employees, employeeColumns, {
        ...baseMeta,
        title: "Relatório de Recursos Humanos",
        summary: [
          { label: "Total", value: String(employees.length) },
          { label: "Ativos", value: String(activeEmployees.length) },
          { label: "Folha mensal", value: formatCurrency(totalSalary) },
        ],
      }, "RH"),
      onCsv: () => runExport("csv", employees, employeeColumns, { ...baseMeta, title: "Relatório de Recursos Humanos" }, "RH"),
    },
    {
      id: "inadimplencia",
      title: "Relatório de Inadimplência",
      description: "Clientes com empréstimos em atraso, valores devidos e histórico de cobranças",
      icon: BookOpen,
      stats: `${overdueLoans.length} em atraso • ${formatCurrency(overdueTotal)}`,
      color: "bg-destructive/10 text-destructive",
      onExcel: () => runExport("xlsx", overdueLoans, overdueColumns, {
        ...baseMeta,
        title: "Relatório de Inadimplência",
        summary: [
          { label: "Em atraso", value: String(overdueLoans.length) },
          { label: "Total devido", value: formatCurrency(overdueTotal) },
          { label: "PAR", value: `${parRate.toFixed(1)}%` },
        ],
      }, "Inadimplência"),
      onPdf: () => runExport("pdf", overdueLoans, overdueColumns, {
        ...baseMeta,
        title: "Relatório de Inadimplência",
        summary: [
          { label: "Em atraso", value: String(overdueLoans.length) },
          { label: "Total devido", value: formatCurrency(overdueTotal) },
          { label: "PAR", value: `${parRate.toFixed(1)}%` },
        ],
      }, "Inadimplência"),
      onCsv: () => runExport("csv", overdueLoans, overdueColumns, { ...baseMeta, title: "Relatório de Inadimplência" }, "Inadimplência"),
    },
  ];

  const loading = clientsLoading || loansLoading || paymentsLoading || employeesLoading;
  const anyError = clientsError || loansError || paymentsError || employeesError;
  const retryAll = () => {
    refetchClients();
    refetchLoans();
    refetchPayments();
    refetchEmployees();
  };

  const applyPreset = (preset: (typeof DATE_PRESETS)[number]) => {
    const { from, to } = preset.getValue();
    setDateFrom(from);
    setDateTo(to);
  };

  const handleBomExport = async () => {
    setBomExporting(true);
    try {
      await reportsApi.bomExport({
        date_from: bomDateFrom,
        date_to: bomDateTo,
        period_label: bomPeriodLabel,
      });
      toast({ title: "Relatório BdM exportado", description: "O ficheiro Excel foi descarregado com sucesso." });
    } catch (err) {
      toast({
        title: "Erro ao exportar",
        description: err instanceof Error ? err.message : "Não foi possível gerar o relatório.",
        variant: "destructive",
      });
    } finally {
      setBomExporting(false);
    }
  };

  const dateLabel = useMemo(() => {
    if (!dateFrom && !dateTo) return "Todos os dados";
    if (dateFrom && dateTo) return `${formatDate(dateFrom)} — ${formatDate(dateTo)}`;
    if (dateFrom) return `Desde ${formatDate(dateFrom)}`;
    return `Até ${formatDate(dateTo)}`;
  }, [dateFrom, dateTo]);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-card via-card to-primary/5 dark:to-primary/10 p-5 sm:p-6 shadow-sm">
        <div aria-hidden className="absolute -top-24 -right-24 w-72 h-72 bg-primary/8 rounded-full blur-3xl pointer-events-none" />
        <div aria-hidden className="absolute -bottom-32 -left-16 w-72 h-72 bg-accent/8 rounded-full blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
              <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                {loading ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    A carregar dados...
                  </span>
                ) : (
                  <>
                    <span>Dashboard de performance</span>
                    <span className="text-border">•</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium">
                      {dateLabel}
                    </span>
                    {prevRange && (
                      <span className="text-[11px] text-muted-foreground hidden sm:inline">
                        comparado a {formatDate(prevRange.from)} — {formatDate(prevRange.to)}
                      </span>
                    )}
                  </>
                )}
              </p>
            </div>
            <Button size="sm" variant="ghost" className="h-8 shrink-0" onClick={retryAll} disabled={loading}>
              <Activity className="h-3.5 w-3.5 mr-1.5" />
              Atualizar
            </Button>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 max-w-3xl">
            <div>
              <Label htmlFor="reports-from" className="text-[11px]">De</Label>
              <Input id="reports-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label htmlFor="reports-to" className="text-[11px]">Até</Label>
              <Input id="reports-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9" />
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => { setDateFrom(""); setDateTo(""); }}
                disabled={!dateFrom && !dateTo}
              >
                Limpar
              </Button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {DATE_PRESETS.map((p) => {
              const range = p.getValue();
              const isActive =
                p.id === "clear"
                  ? !dateFrom && !dateTo
                  : range.from === dateFrom && range.to === dateTo;
              return (
                <Button
                  key={p.id}
                  size="sm"
                  variant={isActive ? "default" : "outline"}
                  className="h-7 text-xs"
                  onClick={() => applyPreset(p)}
                >
                  {p.label}
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      {anyError && (
        <QueryErrorAlert
          message={
            (clientsErr instanceof Error && clientsErr.message) ||
            (loansErr instanceof Error && loansErr.message) ||
            (paymentsErr instanceof Error && paymentsErr.message) ||
            (employeesErr instanceof Error && employeesErr.message) ||
            "Não foi possível carregar os dados."
          }
          onRetry={retryAll}
        />
      )}

      <Tabs defaultValue="overview">
        <TabsList className="bg-muted/60">
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="exports">Exportar</TabsTrigger>
          <TabsTrigger value="bdm">Relatório BdM</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title={hasDateFilter ? "Clientes (novos no período)" : "Clientes ativos"}
              value={hasDateFilter ? `${newClientsInPeriod}` : `${activeClients.length}`}
              subtitle={hasDateFilter ? `${clients.length} no total` : `${clients.length} no total • ${activeClients.length} ativos`}
              icon={Users}
              variant="primary"
              trend={
                trendNewClients !== null
                  ? { value: trendNewClients, label: "vs. período anterior" }
                  : undefined
              }
            />
            <StatCard
              title={hasDateFilter ? "Recebido (período)" : "Recebido (total)"}
              value={formatCurrency(paidAmount)}
              subtitle={hasDateFilter ? `${filteredPayments.filter((p) => p.status === "pago").length} pagamentos` : "Histórico completo"}
              icon={CreditCard}
              variant="success"
              sparkData={paymentsMonthly.map((m) => m.recebido)}
              trend={
                trendPaid !== null
                  ? { value: trendPaid, label: "vs. período anterior" }
                  : undefined
              }
            />
            <StatCard
              title="Carteira (saldo devedor)"
              value={formatCurrency(portfolioTotal)}
              subtitle={`${loans.length} empréstimos`}
              icon={Wallet}
              variant="default"
            />
            <StatCard
              title="Em atraso (PAR)"
              value={`${parRate.toFixed(1)}%`}
              subtitle={`${overdueLoans.length} empréstimo(s) • ${formatCurrency(overdueTotal)}`}
              icon={BookOpen}
              variant="destructive"
              progress={{ value: Math.round(parRate), max: 100, label: "% da carteira em risco" }}
            />
          </div>

          {/* KPIs secundários */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 text-primary p-2">
                  <Receipt className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Ticket médio</p>
                  <p className="text-lg font-bold tracking-tight truncate">{formatCurrency(avgTicket)}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-success/10 text-success p-2">
                  <Percent className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Taxa de cobrança</p>
                  <p className="text-lg font-bold tracking-tight">{collectionRate}%</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-info/10 text-info p-2">
                  <Activity className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Prazo médio</p>
                  <p className="text-lg font-bold tracking-tight">{avgTerm.toFixed(1)} meses</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-accent/10 text-accent p-2">
                  <Target className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Folha salarial</p>
                  <p className="text-lg font-bold tracking-tight truncate">{formatCurrency(totalSalary)}</p>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="overflow-hidden">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Recebimentos por mês</CardTitle>
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                  {paymentsMonthly.length} {paymentsMonthly.length === 1 ? "mês" : "meses"}
                </span>
              </CardHeader>
              <CardContent className="h-[280px]">
                {loading ? (
                  <div className="h-full flex flex-col gap-2 justify-end pb-4">
                    <Skeleton className="h-4 w-24 mb-2" />
                    <div className="flex items-end gap-2 h-[180px]">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <Skeleton key={i} className="flex-1 rounded-t-md" style={{ height: `${30 + (i * 7) % 70}%` }} />
                      ))}
                    </div>
                  </div>
                ) : paymentsMonthly.length === 0 ? (
                  <div className="h-full grid place-items-center text-sm text-muted-foreground">
                    Sem dados de pagamentos no período.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={paymentsMonthly} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                      <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" opacity={0.5} />
                      <XAxis dataKey="month" tickFormatter={(v) => v.slice(5)} stroke={CHART_AXIS} fontSize={11} />
                      <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} stroke={CHART_AXIS} fontSize={11} />
                      <Tooltip
                        formatter={(v: number) => formatCurrency(Number(v))}
                        contentStyle={CHART_TOOLTIP_STYLE}
                        cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                      />
                      <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: 12 }} />
                      <Area name="Recebido" type="monotone" dataKey="recebido" stroke="hsl(var(--success))" fill="hsl(var(--success) / 0.18)" strokeWidth={2} />
                      <Area name="Pendente" type="monotone" dataKey="pendente" stroke="hsl(var(--warning))" fill="hsl(var(--warning) / 0.12)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Carteira por cliente (Top 6)</CardTitle>
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                  Saldo devedor
                </span>
              </CardHeader>
              <CardContent className="h-[280px]">
                {loading ? (
                  <div className="h-full flex flex-col gap-3 justify-center px-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-3 flex-1 rounded-full" style={{ maxWidth: `${100 - i * 12}%` }} />
                      </div>
                    ))}
                  </div>
                ) : topClientsByBalance.length === 0 ? (
                  <div className="h-full grid place-items-center text-sm text-muted-foreground">
                    Sem dados para exibir.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topClientsByBalance} layout="vertical" margin={{ left: 12, right: 12, top: 8, bottom: 8 }}>
                      <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" opacity={0.4} horizontal={false} />
                      <XAxis type="number" tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} stroke={CHART_AXIS} fontSize={11} />
                      <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: CHART_AXIS }} stroke={CHART_AXIS} />
                      <Tooltip
                        formatter={(v: number) => formatCurrency(Number(v))}
                        contentStyle={CHART_TOOLTIP_STYLE}
                        cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                      />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 6, 6]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="overflow-hidden lg:col-span-1">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Empréstimos por status</CardTitle>
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                  {loans.length} total
                </span>
              </CardHeader>
              <CardContent className="h-[280px]">
                {loading ? (
                  <div className="h-full grid place-items-center">
                    <Skeleton className="h-36 w-36 rounded-full" />
                  </div>
                ) : loanStatusData.length === 0 ? (
                  <div className="h-full grid place-items-center text-sm text-muted-foreground">
                    Sem empréstimos para exibir.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip
                        formatter={(v: number) => `${v} empréstimo${v === 1 ? "" : "s"}`}
                        contentStyle={CHART_TOOLTIP_STYLE}
                      />
                      <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: 11 }} />
                      <Pie
                        data={loanStatusData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={3}
                        stroke="hsl(var(--background))"
                        strokeWidth={2}
                      >
                        {loanStatusData.map((entry) => (
                          <Cell key={entry.status} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                )}
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  {loanStatusData.slice(0, 6).map((s) => (
                    <div key={s.status} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 truncate text-muted-foreground">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: s.color }} />
                        {s.name}
                      </span>
                      <span className="font-semibold text-foreground tabular-nums">{s.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden lg:col-span-2">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Top clientes (saldo devedor)</CardTitle>
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                  % da carteira
                </span>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {loading && (
                    <div className="space-y-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full rounded-lg" />
                      ))}
                    </div>
                  )}
                  {!loading && topClientsByBalance.length === 0 && (
                    <p className="text-sm text-muted-foreground py-4 text-center">Sem saldo devedor para exibir.</p>
                  )}
                  {!loading && topClientsByBalance.map((c, idx) => {
                    const share = portfolioTotal > 0 ? (c.value / portfolioTotal) * 100 : 0;
                    return (
                      <div key={c.name} className="group relative flex items-center justify-between gap-3 rounded-lg border bg-card/40 px-3 py-2.5 hover:bg-card/80 hover:border-primary/30 transition-colors">
                        <div className="absolute inset-y-0 left-0 rounded-l-lg bg-primary/8 transition-all" style={{ width: `${Math.min(share, 100)}%` }} />
                        <div className="relative min-w-0 flex items-center gap-3 flex-1">
                          <div className="w-7 h-7 rounded-md bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                            #{idx + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{c.name}</p>
                            <p className="text-[11px] text-muted-foreground">{share.toFixed(1)}% da carteira total</p>
                          </div>
                        </div>
                        <div className="relative text-sm font-semibold tabular-nums shrink-0">{formatCurrency(c.value)}</div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="exports" className="space-y-4">
          <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="rounded-lg bg-primary/15 text-primary p-2.5 shrink-0">
                  <Download className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Exportar tudo</p>
                  <p className="text-xs text-muted-foreground">
                    Gera um Excel para cada relatório com cabeçalho, KPIs e dados completos.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="default"
                disabled={loading}
                onClick={() => {
                  reports.forEach((r, i) => setTimeout(() => r.onExcel(), i * 350));
                }}
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Baixar todos (Excel)
              </Button>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reports.map((r) => (
              <div
                key={r.id}
                className="group relative bg-card rounded-xl border p-5 flex flex-col gap-4 animate-fade-in hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/30 transition-all"
              >
                <div className={`absolute inset-x-0 top-0 h-1 rounded-t-xl ${r.color.split(" ")[0]} opacity-0 group-hover:opacity-100 transition-opacity`} />
                <div className="flex items-start gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${r.color} ring-1 ring-inset ring-current/10`}>
                    <r.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm">{r.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{r.description}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground border-t pt-2.5 font-medium">
                  {loading ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin" /> A carregar...
                    </span>
                  ) : (
                    r.stats
                  )}
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  <Button variant="outline" size="sm" onClick={r.onPdf} disabled={loading} title="Exportar PDF formatado">
                    <FileText className="h-3.5 w-3.5 mr-1" /> PDF
                  </Button>
                  <Button variant="default" size="sm" onClick={r.onExcel} disabled={loading} title="Exportar Excel (.xlsx)">
                    <Download className="h-3.5 w-3.5 mr-1" /> Excel
                  </Button>
                  <Button variant="ghost" size="sm" onClick={r.onCsv} disabled={loading} title="Exportar CSV">
                    <FileText className="h-3.5 w-3.5 mr-1" /> CSV
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="bdm" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base">Ficha de Reporte Trimestral — Banco de Moçambique</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Gera o relatório FICHA DE REPORTE TRIMESTRAL em formato Excel (.xlsx) conforme o modelo do BdM.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="bom-from">Data de início do período</Label>
                  <Input
                    id="bom-from"
                    type="date"
                    value={bomDateFrom}
                    onChange={(e) => setBomDateFrom(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="bom-to">Data de fim do período</Label>
                  <Input
                    id="bom-to"
                    type="date"
                    value={bomDateTo}
                    onChange={(e) => setBomDateTo(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="bom-label">Rótulo do período</Label>
                  <Input
                    id="bom-label"
                    type="text"
                    placeholder="Ex.: Janeiro de 2026"
                    value={bomPeriodLabel}
                    onChange={(e) => setBomPeriodLabel(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Mês actual", getValue: () => {
                    const d = new Date();
                    const from = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
                    const to = d.toISOString().slice(0, 10);
                    const label = `${d.toLocaleString("pt-PT", { month: "long" })} de ${d.getFullYear()}`;
                    return { from, to, label };
                  }},
                  { label: "Mês anterior", getValue: () => {
                    const d = new Date();
                    const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
                    const from = prev.toISOString().slice(0, 10);
                    const to = new Date(d.getFullYear(), d.getMonth(), 0).toISOString().slice(0, 10);
                    const label = `${prev.toLocaleString("pt-PT", { month: "long" })} de ${prev.getFullYear()}`;
                    return { from, to, label };
                  }},
                  { label: "Trimestre actual", getValue: () => {
                    const d = new Date();
                    const q = Math.floor(d.getMonth() / 3);
                    const from = new Date(d.getFullYear(), q * 3, 1).toISOString().slice(0, 10);
                    const to = d.toISOString().slice(0, 10);
                    const qLabels = ["1º Trimestre", "2º Trimestre", "3º Trimestre", "4º Trimestre"];
                    const label = `${qLabels[q]} de ${d.getFullYear()}`;
                    return { from, to, label };
                  }},
                ].map((preset) => (
                  <Button
                    key={preset.label}
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => {
                      const { from, to, label } = preset.getValue();
                      setBomDateFrom(from);
                      setBomDateTo(to);
                      setBomPeriodLabel(label);
                    }}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>

              <div className="border-t pt-4">
                <Button
                  onClick={handleBomExport}
                  disabled={bomExporting || !bomDateFrom || !bomDateTo}
                  className="gap-2"
                >
                  {bomExporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {bomExporting ? "A gerar relatório..." : "Exportar Excel (.xlsx)"}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  O relatório inclui dados de carteira, clientes, sectores, estrutura de risco e situação financeira configurados nas definições do sistema.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
