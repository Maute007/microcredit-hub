import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { PageHeader } from "@/components/PageHeader";
import { mockLoans, mockPayments, mockClients, formatCurrency, formatDate } from "@/data/mockData";
import { Wallet, TrendingUp, AlertTriangle, Users, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from "recharts";

const activeLoans = mockLoans.filter(l => l.status === "ativo" || l.status === "atrasado");
const totalActive = activeLoans.reduce((s, l) => s + l.amount, 0);
const todayPayments = mockPayments.filter(p => p.status === "pago" && p.date === "2025-03-01");
const todayTotal = todayPayments.reduce((s, p) => s + p.amount, 0);
const overdueLoans = mockLoans.filter(l => l.status === "atrasado");
const overdueTotal = overdueLoans.reduce((s, l) => s + (l.totalAmount - l.paidAmount), 0);

const monthlyData = [
  { month: "Out", recebido: 45000, emprestado: 30000 },
  { month: "Nov", recebido: 52000, emprestado: 25000 },
  { month: "Dez", recebido: 48000, emprestado: 40000 },
  { month: "Jan", recebido: 58000, emprestado: 35000 },
  { month: "Fev", recebido: 62000, emprestado: 20000 },
  { month: "Mar", recebido: 14391, emprestado: 20000 },
];

const statusData = [
  { name: "Ativos", value: mockLoans.filter(l => l.status === "ativo").length, color: "hsl(210, 80%, 45%)" },
  { name: "Pagos", value: mockLoans.filter(l => l.status === "pago").length, color: "hsl(152, 60%, 42%)" },
  { name: "Atrasados", value: mockLoans.filter(l => l.status === "atrasado").length, color: "hsl(0, 72%, 51%)" },
  { name: "Pendentes", value: mockLoans.filter(l => l.status === "pendente").length, color: "hsl(38, 92%, 50%)" },
];

const cashFlowData = [
  { day: "01", entrada: 14391, saida: 33000 },
  { day: "03", entrada: 0, saida: 3500 },
  { day: "05", entrada: 3421, saida: 278000 },
  { day: "07", entrada: 20000, saida: 0 },
  { day: "09", entrada: 9808, saida: 0 },
];

export default function DashboardPage() {
  return (
    <div>
      <PageHeader title="Dashboard" description="Visão geral do sistema de microcrédito" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Empréstimos Ativos" value={formatCurrency(totalActive)} icon={Wallet} variant="primary" trend={{ value: 12, label: "vs mês anterior" }} />
        <StatCard title="Recebido Hoje" value={formatCurrency(todayTotal)} icon={TrendingUp} variant="success" subtitle="3 pagamentos" />
        <StatCard title="Total em Atraso" value={formatCurrency(overdueTotal)} icon={AlertTriangle} variant="destructive" subtitle={`${overdueLoans.length} empréstimo(s)`} />
        <StatCard title="Total de Clientes" value={String(mockClients.filter(c => c.status === "ativo").length)} icon={Users} variant="default" trend={{ value: 8, label: "este mês" }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Monthly chart */}
        <div className="lg:col-span-2 bg-card rounded-lg border p-5">
          <h3 className="font-semibold mb-4">Fluxo Mensal</h3>
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

        {/* Status pie */}
        <div className="bg-card rounded-lg border p-5">
          <h3 className="font-semibold mb-4">Status dos Empréstimos</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={4}>
                {statusData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {statusData.map((s) => (
              <div key={s.name} className="flex items-center gap-2 text-xs">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-muted-foreground">{s.name}: {s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cash flow + recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card rounded-lg border p-5">
          <h3 className="font-semibold mb-4">Fluxo de Caixa (Março)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={cashFlowData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,16%,88%)" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Area type="monotone" dataKey="entrada" stroke="hsl(152,60%,42%)" fill="hsl(152,60%,42%)" fillOpacity={0.1} name="Entradas" />
              <Area type="monotone" dataKey="saida" stroke="hsl(0,72%,51%)" fill="hsl(0,72%,51%)" fillOpacity={0.1} name="Saídas" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-lg border p-5">
          <h3 className="font-semibold mb-4">Atividade Recente</h3>
          <div className="space-y-3">
            {mockPayments.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${p.status === "pago" ? "bg-success/10" : "bg-destructive/10"}`}>
                    {p.status === "pago" ? <ArrowUpRight className="h-4 w-4 text-success" /> : <ArrowDownRight className="h-4 w-4 text-destructive" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{p.clientName}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(p.date)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{formatCurrency(p.amount)}</p>
                  <StatusBadge status={p.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
