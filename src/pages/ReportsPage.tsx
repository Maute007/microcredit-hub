import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { mockClients, mockLoans, mockPayments, formatCurrency } from "@/data/mockData";
import { FileText, Download, Users, Wallet, CreditCard, BarChart3 } from "lucide-react";

const reports = [
  {
    title: "Relatório de Clientes",
    description: "Lista completa de clientes com status e histórico",
    icon: Users,
    stats: `${mockClients.length} clientes • ${mockClients.filter(c => c.status === "ativo").length} ativos`,
  },
  {
    title: "Relatório de Empréstimos",
    description: "Todos os empréstimos com valores e status",
    icon: Wallet,
    stats: `${mockLoans.length} empréstimos • ${formatCurrency(mockLoans.reduce((s, l) => s + l.amount, 0))} total`,
  },
  {
    title: "Relatório de Pagamentos",
    description: "Histórico completo de pagamentos recebidos",
    icon: CreditCard,
    stats: `${mockPayments.length} pagamentos • ${formatCurrency(mockPayments.filter(p => p.status === "pago").reduce((s, p) => s + p.amount, 0))} recebido`,
  },
  {
    title: "Relatório Financeiro",
    description: "Resumo financeiro com entradas, saídas e balanço",
    icon: BarChart3,
    stats: "Período: Março 2025",
  },
];

export default function ReportsPage() {
  return (
    <div>
      <PageHeader title="Relatórios" description="Gere e exporte relatórios do sistema" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((r) => (
          <div key={r.title} className="bg-card rounded-lg border p-6 flex flex-col gap-4 animate-fade-in">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <r.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{r.title}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">{r.description}</p>
                <p className="text-xs text-muted-foreground mt-2">{r.stats}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1">
                <FileText className="h-4 w-4 mr-1.5" /> Exportar PDF
              </Button>
              <Button variant="outline" size="sm" className="flex-1">
                <Download className="h-4 w-4 mr-1.5" /> Exportar Excel
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
