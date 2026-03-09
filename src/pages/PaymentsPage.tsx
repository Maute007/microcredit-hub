import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mockPayments, mockLoans, formatCurrency, formatDate, Payment } from "@/data/mockData";
import { Plus, CreditCard, CheckCircle, Clock, AlertTriangle } from "lucide-react";

const columns = [
  { key: "id", label: "ID" },
  { key: "loanId", label: "Empréstimo" },
  { key: "clientName", label: "Cliente" },
  { key: "installmentNumber", label: "Parcela", render: (p: Payment) => `#${p.installmentNumber}` },
  { key: "amount", label: "Valor", render: (p: Payment) => <span className="font-medium">{formatCurrency(p.amount)}</span> },
  { key: "method", label: "Método" },
  { key: "status", label: "Status", render: (p: Payment) => <StatusBadge status={p.status} /> },
  { key: "date", label: "Data", render: (p: Payment) => formatDate(p.date) },
];

const paid = mockPayments.filter(p => p.status === "pago");
const pending = mockPayments.filter(p => p.status === "pendente");
const overdue = mockPayments.filter(p => p.status === "atrasado");

export default function PaymentsPage() {
  const [showNew, setShowNew] = useState(false);

  return (
    <div>
      <PageHeader
        title="Pagamentos"
        description="Gestão de pagamentos e recebimentos"
        actions={
          <Dialog open={showNew} onOpenChange={setShowNew}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Registrar Pagamento</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Registrar Pagamento</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Empréstimo</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Selecionar empréstimo" /></SelectTrigger>
                    <SelectContent>
                      {mockLoans.filter(l => l.status === "ativo" || l.status === "atrasado").map(l => (
                        <SelectItem key={l.id} value={l.id}>{l.id} - {l.clientName} ({formatCurrency(l.monthlyPayment)})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Valor (MT)</Label><Input type="number" placeholder="Valor do pagamento" /></div>
                  <div><Label>Data</Label><Input type="date" defaultValue="2025-03-09" /></div>
                </div>
                <div>
                  <Label>Método de Pagamento</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Selecionar método" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="transfer">Transferência Bancária</SelectItem>
                      <SelectItem value="mpesa">M-Pesa</SelectItem>
                      <SelectItem value="emola">e-Mola</SelectItem>
                      <SelectItem value="deposit">Depósito Bancário</SelectItem>
                      <SelectItem value="cash">Dinheiro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Comprovativo (opcional)</Label>
                  <Input type="file" accept="image/*,.pdf" />
                  <p className="text-xs text-muted-foreground mt-1">Formato: imagem ou PDF</p>
                </div>

                <div className="bg-info/5 border border-info/20 rounded-lg p-3 text-sm">
                  <p className="font-medium text-info">Actualização automática</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Ao registrar o pagamento, o saldo devedor do empréstimo será actualizado automaticamente.</p>
                </div>

                <Button className="w-full" onClick={() => setShowNew(false)}>Registrar Pagamento</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Pagamentos" value={String(mockPayments.length)} icon={CreditCard} />
        <StatCard title="Pagos" value={formatCurrency(paid.reduce((s, p) => s + p.amount, 0))} icon={CheckCircle} variant="success" subtitle={`${paid.length} pagamento(s)`} />
        <StatCard title="Pendentes" value={formatCurrency(pending.reduce((s, p) => s + p.amount, 0))} icon={Clock} variant="warning" subtitle={`${pending.length} pagamento(s)`} />
        <StatCard title="Atrasados" value={formatCurrency(overdue.reduce((s, p) => s + p.amount, 0))} icon={AlertTriangle} variant="destructive" subtitle={`${overdue.length} pagamento(s)`} />
      </div>

      <DataTable data={mockPayments} columns={columns} searchKeys={["clientName", "loanId", "method"]} />
    </div>
  );
}
