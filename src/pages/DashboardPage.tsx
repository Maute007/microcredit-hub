import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { PageHeader } from "@/components/PageHeader";
import { mockLoans, mockPayments, mockClients, mockTransactions, formatCurrency, formatDate } from "@/data/mockData";
import { Wallet, TrendingUp, AlertTriangle, Users, ArrowUpRight, ArrowDownRight, CreditCard, Banknote } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, LineChart, Line } from "recharts";

const activeLoans = mockLoans.filter(l => l.status === "ativo" || l.status === "atrasado");
const totalActive = activeLoans.reduce((s, l) => s + l.amount, 0);
const paidPayments = mockPayments.filter(p => p.status === "pago");
const monthlyReceived = paidPayments.reduce((s, p) => s + p.amount, 0);
const overdueLoans = mockLoans.filter(l => l.status === "atrasado");
const overdueTotal = overdueLoans.reduce((s, l) => s + l.remainingBalance, 0);
const totalPortfolio = mockLoans.reduce((s, l) => s + l.amount, 0);

const monthlyData = [
  { month: "Set", recebido: 38000, emprestado: 35000 },
  { month: "Out", recebido: 45000, emprestado: 30000 },
  { month: "Nov", recebido: 52000, emprestado: 25000 },
  { month: "Dez", recebido: 48000, emprestado: 40000 },
  { month: "Jan", recebido: 58000, emprestado: 35000 },
  { month: "Fev", recebido: 62000, emprestado: 20000 },
  { month: "Mar", recebido: 32000, emprestado: 20000 },
];

const statusData = [
  { name: "Ativos", value: mockLoans.filter(l => l.status === "ativo").length, color: "hsl(210, 80%, 45%)" },
  { name: "Pagos", value: mockLoans.filter(l => l.status === "pago").length, color: "hsl(152, 60%, 42%)" },
  { name: "Atrasados", value: mockLoans.filter(l => l.status === "atrasado").length, color: "hsl(0, 72%, 51%)" },
  { name: "Pendentes", value: mockLoans.filter(l => l.status === "pendente").length, color: "hsl(38, 92%, 50%)" },
];

const cashFlowData = [
  { day: "01", entrada: 14392, saida: 38500 },
  { day: "03", entrada: 0, saida: 3500 },
  { day: "04", entrada: 0, saida: 12000 },
  { day: "05", entrada: 3422, saida: 278000 },
  { day: "07", entrada: 0, saida: 20000 },
  { day: "09", entrada: 9808, saida: 0 },
];

const clientGrowth = [
  { month: "Out", clientes: 5 },
  { month: "Nov", clientes: 5 },
  { month: "Dez", clientes: 6 },
  { month: "Jan", clientes: 7 },
  { month: "Fev", clientes: 8 },
  { month: "Mar", clientes: 10 },
];

export default function DashboardPage() {
  return (
    <div>
      <PageHeader title="Dashboard" description="Visão geral do sistema de microcrédito" />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Carteira de Crédito" value={formatCurrency(totalPortfolio)} icon={Wallet} variant="primary" trend={{ value: 15, label: "vs mês anterior" }} />
        <StatCard title="Recebido no Mês" value={formatCurrency(monthlyReceived)} icon={TrendingUp} variant="success" subtitle={`${paidPayments.length} pagamentos`} />
        <StatCard title="Total em Atraso" value={formatCurrency(overdueTotal)} icon={AlertTriangle} variant="destructive" subtitle={`${overdueLoans.length} empréstimo(s)`} />
        <StatCard title="Clientes Ativos" value={String(mockClients.filter(c => c.status === "ativo").length)} icon={Users} variant="default" trend={{ value: 8, label: "este mês" }} />
      </div>

      {/* Row 2: empréstimos por mês + pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 bg-card rounded-lg border p-5">
          <h3 className="font-semibold mb-1">Fluxo Financeiro Mensal</h3>
          <p className="text-xs text-muted-foreground mb-4">Comparativo de valores recebidos vs emprestados</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,16%,88%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="recebido" fill="hsl(210,80%,45%)" radius={[4, 4, 0, 0]} name="Recebido" />
              <Bar dataKey="emprestado" fill="hsl(165,60%,40%)" radius={[4, 4, 0, 0]} name="Emprestado" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-lg border p-5">
          <h3 className="font-semibold mb-1">Empréstimos por Status</h3>
          <p className="text-xs text-muted-foreground mb-4">{mockLoans.length} empréstimos no total</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={4}>
                {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {statusData.map(s => (
              <div key={s.name} className="flex items-center gap-2 text-xs">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                <span className="text-muted-foreground">{s.name}: <strong>{s.value}</strong></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: cash flow + client growth */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-card rounded-lg border p-5">
          <h3 className="font-semibold mb-1">Fluxo de Caixa — Março 2025</h3>
          <p className="text-xs text-muted-foreground mb-4">Entradas e saídas diárias</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={cashFlowData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,16%,88%)" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Area type="monotone" dataKey="entrada" stroke="hsl(152,60%,42%)" fill="hsl(152,60%,42%)" fillOpacity={0.1} name="Entradas" />
              <Area type="monotone" dataKey="saida" stroke="hsl(0,72%,51%)" fill="hsl(0,72%,51%)" fillOpacity={0.1} name="Saídas" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-lg border p-5">
          <h3 className="font-semibold mb-1">Crescimento de Clientes</h3>
          <p className="text-xs text-muted-foreground mb-4">Últimos 6 meses</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={clientGrowth}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,16%,88%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="clientes" stroke="hsl(210,80%,45%)" strokeWidth={2} dot={{ r: 4 }} name="Clientes" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-card rounded-lg border p-5">
        <h3 className="font-semibold mb-4">Actividade Recente</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {mockPayments.slice(0, 6).map((p) => (
            <div key={p.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${p.status === "pago" ? "bg-success/10" : p.status === "atrasado" ? "bg-destructive/10" : "bg-warning/10"}`}>
                  {p.status === "pago" ? <ArrowUpRight className="h-4 w-4 text-success" /> : p.status === "atrasado" ? <AlertTriangle className="h-4 w-4 text-destructive" /> : <CreditCard className="h-4 w-4 text-warning" />}
                </div>
                <div>
                  <p className="text-sm font-medium">{p.clientName}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(p.date)} • Parcela #{p.installmentNumber}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{formatCurrency(p.amount)}</p>
                <StatusBadge status={p.status} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
