import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/data/mockData";
import { FileText, Download, Users, Wallet, CreditCard, BarChart3, UserCog, BookOpen, Loader2 } from "lucide-react";
import {
  clientsApi,
  loansApi,
  paymentsApi,
  accountingApi,
  hrApi,
  type ApiClient,
  type ApiLoan,
  type ApiPayment,
  type ApiTransaction,
  type ApiEmployee,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/data/mockData";

function downloadCsv(content: string, filename: string) {
  const blob = new Blob(["\ufeff" + content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeCsv(val: unknown): string {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function exportClientsCsv(clients: ApiClient[]) {
  const headers = ["ID", "Nome", "Email", "Telefone", "Documento", "Cidade", "Ocupação", "Status", "Empréstimos"];
  const rows = clients.map((c) => [
    c.id,
    c.name,
    c.email,
    c.phone,
    c.document,
    c.city,
    c.occupation,
    c.status,
    c.total_loans ?? 0,
  ]);
  const csv = [headers.map(escapeCsv).join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join("\n");
  downloadCsv(csv, `relatorio-clientes-${new Date().toISOString().slice(0, 10)}.csv`);
}

function exportLoansCsv(loans: ApiLoan[]) {
  const headers = ["ID", "Cliente", "Valor", "Taxa %", "Parcelas", "Prestação", "Total", "Status", "Saldo Devedor", "Início", "Fim"];
  const rows = loans.map((l) => [
    l.id,
    l.client_name,
    l.amount,
    l.interest_rate,
    l.term,
    l.monthly_payment,
    l.total_amount,
    l.status,
    l.remaining_balance,
    l.start_date,
    l.end_date,
  ]);
  const csv = [headers.map(escapeCsv).join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join("\n");
  downloadCsv(csv, `relatorio-emprestimos-${new Date().toISOString().slice(0, 10)}.csv`);
}

function exportPaymentsCsv(payments: ApiPayment[]) {
  const headers = ["ID", "Empréstimo", "Cliente", "Valor", "Data", "Método", "Parcela", "Status"];
  const rows = payments.map((p) => [
    p.id,
    p.loan,
    p.loan_client_name ?? p.client_name,
    p.amount,
    p.date,
    p.method,
    p.installment_number,
    p.status,
  ]);
  const csv = [headers.map(escapeCsv).join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join("\n");
  downloadCsv(csv, `relatorio-pagamentos-${new Date().toISOString().slice(0, 10)}.csv`);
}

function exportTransactionsCsv(transactions: ApiTransaction[]) {
  const headers = ["ID", "Tipo", "Categoria", "Descrição", "Valor", "Data", "Responsável"];
  const rows = transactions.map((t) => [
    t.id,
    t.type,
    t.category,
    t.description ?? "",
    t.amount,
    t.date,
    t.responsible_name ?? "",
  ]);
  const csv = [headers.map(escapeCsv).join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join("\n");
  downloadCsv(csv, `relatorio-financeiro-${new Date().toISOString().slice(0, 10)}.csv`);
}

function exportEmployeesCsv(employees: ApiEmployee[]) {
  const headers = ["ID", "Nome", "Email", "Cargo", "Telefone", "Salário Base", "Status", "Data Admissão"];
  const rows = employees.map((e) => [
    e.id,
    e.name,
    e.email ?? "",
    e.role ?? "",
    e.phone ?? "",
    e.base_salary,
    e.status,
    e.hire_date ?? "",
  ]);
  const csv = [headers.map(escapeCsv).join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join("\n");
  downloadCsv(csv, `relatorio-rh-${new Date().toISOString().slice(0, 10)}.csv`);
}

function exportOverdueCsv(loans: ApiLoan[]) {
  const overdue = loans.filter((l) => l.status === "atrasado");
  const headers = ["ID", "Cliente", "Valor", "Saldo Devedor", "Prestação", "Início", "Fim"];
  const rows = overdue.map((l) => [
    l.id,
    l.client_name,
    l.amount,
    l.remaining_balance,
    l.monthly_payment,
    l.start_date,
    l.end_date,
  ]);
  const csv = [headers.map(escapeCsv).join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join("\n");
  downloadCsv(csv, `relatorio-inadimplencia-${new Date().toISOString().slice(0, 10)}.csv`);
}

function openPrintWindow(title: string, html: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`
    <!DOCTYPE html>
    <html><head><meta charset="utf-8"><title>${title}</title>
    <style>body{font-family:sans-serif;padding:20px;font-size:12px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:6px;text-align:left}th{background:#f5f5f5}</style>
    </head><body><h1>${title}</h1>${html}</body></html>
  `);
  w.document.close();
  w.print();
  w.close();
}

export default function ReportsPage() {
  const { toast } = useToast();

  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ["reports-clients"],
    queryFn: () => clientsApi.list(),
  });

  const { data: loans = [], isLoading: loansLoading } = useQuery({
    queryKey: ["reports-loans"],
    queryFn: () => loansApi.list({ page_size: 500 }),
  });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["reports-payments"],
    queryFn: () => paymentsApi.list(),
  });

  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ["reports-transactions"],
    queryFn: () => accountingApi.transactions.list(),
  });

  const { data: balance } = useQuery({
    queryKey: ["reports-balance"],
    queryFn: () => accountingApi.balance(),
  });

  const { data: employees = [], isLoading: employeesLoading } = useQuery({
    queryKey: ["reports-employees"],
    queryFn: () => hrApi.employees.list({ page_size: 200 }),
  });

  const activeClients = clients.filter((c) => c.status === "ativo");
  const paidAmount = payments.filter((p) => p.status === "pago").reduce((s, p) => s + p.amount, 0);
  const totalEntradas = balance?.total_entradas ?? transactions.filter((t) => t.type === "entrada").reduce((s, t) => s + t.amount, 0);
  const totalSaidas = balance?.total_saidas ?? transactions.filter((t) => t.type === "saida").reduce((s, t) => s + t.amount, 0);
  const saldo = balance?.saldo ?? totalEntradas - totalSaidas;
  const activeEmployees = employees.filter((e) => e.status === "ativo");
  const totalSalary = activeEmployees.reduce((s, e) => s + e.base_salary, 0);
  const overdueLoans = loans.filter((l) => l.status === "atrasado");
  const overdueTotal = overdueLoans.reduce((s, l) => s + l.remaining_balance, 0);
  const portfolioTotal = loans.reduce((s, l) => s + (l.remaining_balance ?? l.amount), 0);

  const reports = [
    {
      id: "clientes",
      title: "Relatório de Clientes",
      description: "Lista completa com dados pessoais, status e estado da dívida de cada cliente",
      icon: Users,
      stats: `${clients.length} clientes • ${activeClients.length} ativos`,
      color: "bg-primary/10 text-primary",
      onExcel: () => { exportClientsCsv(clients); toast({ title: "Exportado", description: "Relatório de clientes exportado em CSV." }); },
      onPdf: () => {
        const rows = clients.map((c) => `<tr><td>${c.id}</td><td>${escapeCsv(c.name)}</td><td>${c.email}</td><td>${c.phone}</td><td>${c.status}</td><td>${c.total_loans ?? 0}</td></tr>`).join("");
        openPrintWindow("Relatório de Clientes", `<table><thead><tr><th>ID</th><th>Nome</th><th>Email</th><th>Telefone</th><th>Status</th><th>Empréstimos</th></tr></thead><tbody>${rows}</tbody></table>`);
        toast({ title: "Impressão", description: "Janela de impressão aberta." });
      },
    },
    {
      id: "emprestimos",
      title: "Relatório de Empréstimos",
      description: "Todos os empréstimos com valores, parcelas, juros e status actualizado",
      icon: Wallet,
      stats: `${loans.length} empréstimos • ${formatCurrency(portfolioTotal)} em carteira`,
      color: "bg-info/10 text-info",
      onExcel: () => { exportLoansCsv(loans); toast({ title: "Exportado", description: "Relatório de empréstimos exportado em CSV." }); },
      onPdf: () => {
        const rows = loans.map((l) => `<tr><td>${l.id}</td><td>${escapeCsv(l.client_name)}</td><td>${formatCurrency(l.amount)}</td><td>${formatCurrency(l.remaining_balance)}</td><td>${l.status}</td></tr>`).join("");
        openPrintWindow("Relatório de Empréstimos", `<table><thead><tr><th>ID</th><th>Cliente</th><th>Valor</th><th>Saldo</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`);
        toast({ title: "Impressão", description: "Janela de impressão aberta." });
      },
    },
    {
      id: "pagamentos",
      title: "Relatório de Pagamentos",
      description: "Histórico detalhado de todos os pagamentos, incluindo método e comprovativo",
      icon: CreditCard,
      stats: `${payments.length} pagamentos • ${formatCurrency(paidAmount)} recebido`,
      color: "bg-success/10 text-success",
      onExcel: () => { exportPaymentsCsv(payments); toast({ title: "Exportado", description: "Relatório de pagamentos exportado em CSV." }); },
      onPdf: () => {
        const rows = payments.map((p) => `<tr><td>${p.id}</td><td>${p.loan}</td><td>${escapeCsv(p.loan_client_name ?? p.client_name)}</td><td>${formatCurrency(p.amount)}</td><td>${formatDate(p.date)}</td><td>${p.status}</td></tr>`).join("");
        openPrintWindow("Relatório de Pagamentos", `<table><thead><tr><th>ID</th><th>Empréstimo</th><th>Cliente</th><th>Valor</th><th>Data</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`);
        toast({ title: "Impressão", description: "Janela de impressão aberta." });
      },
    },
    {
      id: "financeiro",
      title: "Relatório Financeiro",
      description: "Resumo de entradas, saídas, fluxo de caixa e balanço geral da empresa",
      icon: BarChart3,
      stats: `Saldo: ${formatCurrency(saldo)}`,
      color: "bg-warning/10 text-warning",
      onExcel: () => { exportTransactionsCsv(transactions); toast({ title: "Exportado", description: "Relatório financeiro exportado em CSV." }); },
      onPdf: () => {
        const rows = transactions.slice(0, 100).map((t) => `<tr><td>${formatDate(t.date)}</td><td>${t.type}</td><td>${t.category}</td><td>${formatCurrency(t.amount)}</td></tr>`).join("");
        openPrintWindow("Relatório Financeiro", `<p><strong>Entradas:</strong> ${formatCurrency(totalEntradas)} | <strong>Saídas:</strong> ${formatCurrency(totalSaidas)} | <strong>Saldo:</strong> ${formatCurrency(saldo)}</p><table><thead><tr><th>Data</th><th>Tipo</th><th>Categoria</th><th>Valor</th></tr></thead><tbody>${rows}</tbody></table>`);
        toast({ title: "Impressão", description: "Janela de impressão aberta." });
      },
    },
    {
      id: "rh",
      title: "Relatório de RH",
      description: "Dados de colaboradores, férias programadas e folha salarial com descontos",
      icon: UserCog,
      stats: `${employees.length} colaboradores • ${formatCurrency(totalSalary)}/mês`,
      color: "bg-accent/10 text-accent",
      onExcel: () => { exportEmployeesCsv(employees); toast({ title: "Exportado", description: "Relatório de RH exportado em CSV." }); },
      onPdf: () => {
        const rows = employees.map((e) => `<tr><td>${e.id}</td><td>${escapeCsv(e.name)}</td><td>${e.role ?? ""}</td><td>${formatCurrency(e.base_salary)}</td><td>${e.status}</td></tr>`).join("");
        openPrintWindow("Relatório de RH", `<table><thead><tr><th>ID</th><th>Nome</th><th>Cargo</th><th>Salário</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`);
        toast({ title: "Impressão", description: "Janela de impressão aberta." });
      },
    },
    {
      id: "inadimplencia",
      title: "Relatório de Inadimplência",
      description: "Clientes com empréstimos em atraso, valores devidos e histórico de cobranças",
      icon: BookOpen,
      stats: `${overdueLoans.length} em atraso • ${formatCurrency(overdueTotal)}`,
      color: "bg-destructive/10 text-destructive",
      onExcel: () => { exportOverdueCsv(loans); toast({ title: "Exportado", description: "Relatório de inadimplência exportado em CSV." }); },
      onPdf: () => {
        const rows = overdueLoans.map((l) => `<tr><td>${l.id}</td><td>${escapeCsv(l.client_name)}</td><td>${formatCurrency(l.remaining_balance)}</td><td>${formatDate(l.start_date)}</td></tr>`).join("");
        openPrintWindow("Relatório de Inadimplência", `<table><thead><tr><th>ID</th><th>Cliente</th><th>Saldo Devedor</th><th>Início</th></tr></thead><tbody>${rows}</tbody></table>`);
        toast({ title: "Impressão", description: "Janela de impressão aberta." });
      },
    },
  ];

  const loading = clientsLoading || loansLoading || paymentsLoading || txLoading || employeesLoading;

  return (
    <div>
      <PageHeader
        title="Relatórios"
        description={
          loading ? "A carregar dados..." : "Gere e exporte relatórios detalhados do sistema"
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((r) => (
          <div key={r.id} className="bg-card rounded-lg border p-5 flex flex-col gap-4 animate-fade-in hover:shadow-md transition-shadow">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${r.color}`}>
                <r.icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm">{r.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{r.description}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground border-t pt-2">{loading ? <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> A carregar...</span> : r.stats}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={r.onPdf} disabled={loading}>
                <FileText className="h-3.5 w-3.5 mr-1" /> PDF
              </Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={r.onExcel} disabled={loading}>
                <Download className="h-3.5 w-3.5 mr-1" /> Excel
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
