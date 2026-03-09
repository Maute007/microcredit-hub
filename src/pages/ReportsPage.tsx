import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { mockClients, mockLoans, mockPayments, mockTransactions, mockEmployees, formatCurrency } from "@/data/mockData";
import { FileText, Download, Users, Wallet, CreditCard, BarChart3, UserCog, BookOpen } from "lucide-react";

const reports = [
  {
    title: "Relatório de Clientes",
    description: "Lista completa com dados pessoais, status e estado da dívida de cada cliente",
    icon: Users,
    stats: `${mockClients.length} clientes • ${mockClients.filter(c => c.status === "ativo").length} ativos`,
    color: "bg-primary/10 text-primary",
  },
  {
    title: "Relatório de Empréstimos",
    description: "Todos os empréstimos com valores, parcelas, juros, amortização e status actualizado",
    icon: Wallet,
    stats: `${mockLoans.length} empréstimos • ${formatCurrency(mockLoans.reduce((s, l) => s + l.amount, 0))} em carteira`,
    color: "bg-info/10 text-info",
  },
  {
    title: "Relatório de Pagamentos",
    description: "Histórico detalhado de todos os pagamentos, incluindo método e comprovativo",
    icon: CreditCard,
    stats: `${mockPayments.length} pagamentos • ${formatCurrency(mockPayments.filter(p => p.status === "pago").reduce((s, p) => s + p.amount, 0))} recebido`,
    color: "bg-success/10 text-success",
  },
  {
    title: "Relatório Financeiro",
    description: "Resumo de entradas, saídas, fluxo de caixa e balanço geral da empresa",
    icon: BarChart3,
    stats: `Saldo: ${formatCurrency(mockTransactions.filter(t => t.type === "entrada").reduce((s, t) => s + t.amount, 0) - mockTransactions.filter(t => t.type === "saida").reduce((s, t) => s + t.amount, 0))}`,
    color: "bg-warning/10 text-warning",
  },
  {
    title: "Relatório de RH",
    description: "Dados de colaboradores, férias programadas e folha salarial com descontos",
    icon: UserCog,
    stats: `${mockEmployees.length} colaboradores • ${formatCurrency(mockEmployees.filter(e => e.status === "ativo").reduce((s, e) => s + e.baseSalary, 0))}/mês`,
    color: "bg-accent/10 text-accent",
  },
  {
    title: "Relatório de Inadimplência",
    description: "Clientes com empréstimos em atraso, valores devidos e histórico de cobranças",
    icon: BookOpen,
    stats: `${mockLoans.filter(l => l.status === "atrasado").length} em atraso • ${formatCurrency(mockLoans.filter(l => l.status === "atrasado").reduce((s, l) => s + l.remainingBalance, 0))}`,
    color: "bg-destructive/10 text-destructive",
  },
];

export default function ReportsPage() {
  return (
    <div>
      <PageHeader title="Relatórios" description="Gere e exporte relatórios detalhados do sistema" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((r) => (
          <div key={r.title} className="bg-card rounded-lg border p-5 flex flex-col gap-4 animate-fade-in hover:shadow-md transition-shadow">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${r.color}`}>
                <r.icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm">{r.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{r.description}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground border-t pt-2">{r.stats}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1">
                <FileText className="h-3.5 w-3.5 mr-1" /> PDF
              </Button>
              <Button variant="outline" size="sm" className="flex-1">
                <Download className="h-3.5 w-3.5 mr-1" /> Excel
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
