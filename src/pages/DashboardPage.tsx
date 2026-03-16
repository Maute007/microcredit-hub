import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { PageHeader } from "@/components/PageHeader";
import {
  dashboardApi,
  systemApi,
  type ApiDashboardSummary,
  type ApiSystemSettings,
} from "@/lib/api";
import {
  Wallet,
  TrendingUp,
  AlertTriangle,
  Users,
  ArrowUpRight,
  CreditCard,
  Banknote,
  PieChart as PieIcon,
  BarChart3,
  Activity,
  HandCoins,
  BarChart2,
  UserCheck,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  LineChart,
  Line,
} from "recharts";
import { formatCurrency, formatDate } from "@/data/mockData";
import { QueryErrorAlert } from "@/components/QueryErrorAlert";

const formatK = (v: unknown): string => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : 0;
  return `${(n / 1000).toFixed(0)}k`;
};

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function DashboardPage() {
  const { data: systemSettings } = useQuery<ApiSystemSettings>({
    queryKey: ["system-settings"],
    queryFn: systemApi.get,
  });
  const { data: dashboard, isLoading, isError, refetch } = useQuery<ApiDashboardSummary>({
    queryKey: ["dashboard-summary"],
    queryFn: dashboardApi.getSummary,
  });

  const brandName = systemSettings?.name ?? "MicroCrédito Hub";
  const tagline = systemSettings?.tagline ?? "Plataforma integrada para gestão de microcrédito";
  const primaryColor = systemSettings?.primary_color ?? "#0f766e";
  const bannerColor = systemSettings?.login_banner_color?.trim() || primaryColor;
  const logoUrl = systemSettings?.logo_url;

  const rawSummary = dashboard?.summary;
  const summary = {
    clients_total: Number(rawSummary?.clients_total) || 0,
    clients_active: Number(rawSummary?.clients_active) || 0,
    loans_total: Number(rawSummary?.loans_total) || 0,
    loans_overdue_count: Number(rawSummary?.loans_overdue_count) || 0,
    portfolio_total: Number(rawSummary?.portfolio_total) || 0,
    monthly_received: Number(rawSummary?.monthly_received) || 0,
    monthly_received_count: Number(rawSummary?.monthly_received_count) || 0,
    overdue_total: Number(rawSummary?.overdue_total) || 0,
    entradas: Number(rawSummary?.entradas) || 0,
    saidas: Number(rawSummary?.saidas) || 0,
    employees_active: Number(rawSummary?.employees_active) || 0,
  };
  const statusData = dashboard?.status_data ?? [
    { name: "Ativos", value: 0, color: "hsl(210, 80%, 45%)" },
    { name: "Pagos", value: 0, color: "hsl(152, 60%, 42%)" },
    { name: "Atrasados", value: 0, color: "hsl(0, 72%, 51%)" },
    { name: "Pendentes", value: 0, color: "hsl(38, 92%, 50%)" },
  ];
  const monthlyFlow = dashboard?.monthly_flow ?? [];
  const clientGrowth = dashboard?.client_growth ?? [];
  const cashFlow = dashboard?.cash_flow ?? [];
  const recentPayments = dashboard?.recent_payments ?? [];
  const safeNum = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : 0);
  const sparkReceived = (dashboard?.spark_received ?? []).map(safeNum);
  const sparkPortfolio = (dashboard?.spark_portfolio ?? []).map(safeNum);
  const sparkClients = (dashboard?.spark_clients ?? []).map(safeNum);
  const sparkOverdue = (dashboard?.spark_overdue ?? []).map(safeNum);
  // Garantir arrays com pelo menos 1 elemento para MiniSparkline (evita Math.max de vazio)
  const pad = (arr: number[]) => (arr.length >= 7 ? arr : [...Array(7 - arr.length).fill(0), ...arr]);

  const currentMonth = MONTH_NAMES[new Date().getMonth()];
  const currentYear = new Date().getFullYear();
  const [activityTab, setActivityTab] = useState<"upcoming" | "paid">("upcoming");
  const today = new Date();

  const isOverdue = (p: ApiDashboardSummary["recent_payments"][number]) => {
    const d = new Date(p.date);
    return p.status === "atrasado" || (p.status !== "pago" && d < today);
  };

  const isNearDue = (p: ApiDashboardSummary["recent_payments"][number]) => {
    if (p.status !== "pendente") return false;
    const d = new Date(p.date);
    const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 0 && diff <= 3;
  };

  const upcomingPayments = recentPayments.filter((p) => p.status !== "pago");
  const paidPayments = recentPayments.filter((p) => p.status === "pago");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-48 rounded-2xl border bg-muted/30 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-xl border bg-muted/30 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <QueryErrorAlert message="Não foi possível carregar o resumo do painel." onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div>
      {/* Hero: nome e cor vindos das definições */}
      <section
        className="relative mb-6 overflow-hidden rounded-2xl border bg-card"
        style={{ borderColor: bannerColor + "40" }}
      >
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
          style={{
            backgroundImage: `url(https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1200&q=80)`,
          }}
          aria-hidden
        />
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${bannerColor}e6 0%, ${bannerColor}cc 50%, ${bannerColor}b3 100%)`,
          }}
          aria-hidden
        />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
          aria-hidden
        />
        <div className="relative px-6 py-12 lg:py-16 lg:px-10">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-sm font-medium text-white/95 mb-4">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="h-4 w-4 rounded" />
              ) : (
                <HandCoins className="h-4 w-4" />
              )}
              {tagline}
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight mb-3">
              {brandName}
            </h1>
            <p className="text-base sm:text-lg text-white/90 max-w-2xl leading-relaxed">
              {systemSettings?.login_description ||
                "Clientes, empréstimos, pagamentos, recursos humanos e contabilidade. Acompanhe a carteira e fluxo de caixa em tempo real."}
            </p>
            <div className="flex flex-wrap gap-6 mt-6 text-white/80">
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="text-sm">{summary.clients_active} clientes ativos</span>
              </span>
              <span className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                <span className="text-sm">{summary.loans_total} empréstimos</span>
              </span>
              <span className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                <span className="text-sm">{summary.monthly_received_count} pagamentos este mês</span>
              </span>
              <span className="flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                <span className="text-sm">{summary.employees_active} colaboradores</span>
              </span>
              <span className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4" />
                <span className="text-sm">Relatórios</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      <PageHeader title="Visão geral" description="Indicadores e atividade recente" />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Carteira de Crédito"
          value={formatCurrency(summary.portfolio_total)}
          icon={Wallet}
          variant="primary"
          sparkData={pad(sparkPortfolio)}
        />
        <StatCard
          title="Recebido no Mês"
          value={formatCurrency(summary.monthly_received)}
          icon={TrendingUp}
          variant="success"
          subtitle={`${summary.monthly_received_count} pagamentos realizados`}
          sparkData={pad(sparkReceived)}
        />
        <StatCard
          title="Total em Atraso"
          value={formatCurrency(summary.overdue_total)}
          icon={AlertTriangle}
          variant="destructive"
          subtitle={`${summary.loans_overdue_count} empréstimo(s) atrasado(s)`}
          progress={{
            value: summary.loans_overdue_count,
            max: Math.max(summary.loans_total, 1),
            label: "Taxa de inadimplência",
          }}
        />
        <StatCard
          title="Clientes Ativos"
          value={String(summary.clients_active)}
          icon={Users}
          variant="default"
          sparkData={pad(sparkClients)}
        />
      </div>

      {/* Row 2: secondary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-xl border p-4 flex items-center gap-3">
          <div className="rounded-lg p-2 bg-success/10">
            <ArrowUpRight className="h-4 w-4 text-success" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Entradas
            </p>
            <p className="text-sm font-bold">{formatCurrency(summary.entradas)}</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border p-4 flex items-center gap-3">
          <div className="rounded-lg p-2 bg-destructive/10">
            <Banknote className="h-4 w-4 text-destructive" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Saídas
            </p>
            <p className="text-sm font-bold">{formatCurrency(summary.saidas)}</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border p-4 flex items-center gap-3">
          <div className="rounded-lg p-2 bg-primary/10">
            <CreditCard className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Empréstimos
            </p>
            <p className="text-sm font-bold">{summary.loans_total} total</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border p-4 flex items-center gap-3">
          <div className="rounded-lg p-2 bg-info/10">
            <Activity className="h-4 w-4 text-info" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Funcionários
            </p>
            <p className="text-sm font-bold">{summary.employees_active} ativos</p>
          </div>
        </div>
      </div>

      {/* Row 3: charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 bg-card rounded-xl border p-5">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">Fluxo Financeiro Mensal</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Comparativo de valores recebidos vs emprestados
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyFlow}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,16%,88%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={formatK} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="recebido" fill="hsl(210,80%,45%)" radius={[4, 4, 0, 0]} name="Recebido" />
              <Bar dataKey="emprestado" fill="hsl(165,60%,40%)" radius={[4, 4, 0, 0]} name="Emprestado" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-xl border p-5">
          <div className="flex items-center gap-2 mb-1">
            <PieIcon className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">Empréstimos por Status</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">{summary.loans_total} empréstimos no total</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={75}
                dataKey="value"
                paddingAngle={4}
              >
                {statusData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => v} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {statusData.map((s) => (
              <div key={s.name} className="flex items-center gap-2 text-xs">
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: s.color }}
                />
                <span className="text-muted-foreground">
                  {s.name}: <strong>{s.value}</strong>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4: cash flow + client growth */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-card rounded-xl border p-5">
          <h3 className="font-semibold mb-1">
            Fluxo de Caixa — {currentMonth} {currentYear}
          </h3>
          <p className="text-xs text-muted-foreground mb-4">Entradas e saídas diárias</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={cashFlow}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,16%,88%)" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={formatK} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Area
                type="monotone"
                dataKey="entrada"
                stroke="hsl(152,60%,42%)"
                fill="hsl(152,60%,42%)"
                fillOpacity={0.1}
                name="Entradas"
              />
              <Area
                type="monotone"
                dataKey="saida"
                stroke="hsl(0,72%,51%)"
                fill="hsl(0,72%,51%)"
                fillOpacity={0.1}
                name="Saídas"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-xl border p-5">
          <h3 className="font-semibold mb-1">Crescimento de Clientes</h3>
          <p className="text-xs text-muted-foreground mb-4">Novos clientes por mês</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={clientGrowth}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,16%,88%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="clientes"
                stroke="hsl(210,80%,45%)"
                strokeWidth={2}
                dot={{ r: 4 }}
                name="Novos"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-card rounded-xl border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Actividade de Pagamentos</h3>
          <div className="inline-flex rounded-full bg-muted p-1 text-xs">
            <button
              type="button"
              onClick={() => setActivityTab("upcoming")}
              aria-selected={activityTab === "upcoming"}
              role="tab"
              className={`px-3 py-1 rounded-full transition-colors ${
                activityTab === "upcoming" ? "bg-background shadow-sm font-semibold" : "text-muted-foreground"
              }`}
            >
              Por receber
            </button>
            <button
              type="button"
              onClick={() => setActivityTab("paid")}
              aria-selected={activityTab === "paid"}
              role="tab"
              className={`px-3 py-1 rounded-full transition-colors ${
                activityTab === "paid" ? "bg-background shadow-sm font-semibold" : "text-muted-foreground"
              }`}
            >
              Já pagos
            </button>
          </div>
        </div>
        {(activityTab === "upcoming" ? upcomingPayments : paidPayments).length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Sem pagamentos recentes.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(activityTab === "upcoming" ? upcomingPayments : paidPayments).map((p) => {
              const overdue = isOverdue(p);
              const nearDue = isNearDue(p);
              const rowHighlight = overdue
                ? "bg-destructive/10 border-destructive/40"
                : nearDue
                  ? "bg-warning/10 border-warning/40"
                  : "hover:bg-muted/30";
              return (
              <div
                key={p.id}
                className={`flex items-center justify-between py-2.5 px-3 rounded-lg border transition-colors ${rowHighlight}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center ${
                      p.status === "pago"
                        ? "bg-success/10"
                        : p.status === "atrasado"
                          ? "bg-destructive/10"
                          : "bg-warning/10"
                    }`}
                  >
                    {p.status === "pago" ? (
                      <ArrowUpRight className="h-4 w-4 text-success" />
                    ) : p.status === "atrasado" ? (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    ) : (
                      <CreditCard className="h-4 w-4 text-warning" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{p.client_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(p.date)} • Parcela #{p.installment_number}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatCurrency(p.amount)}</p>
                  <StatusBadge status={p.status} />
                </div>
              </div>
            );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
