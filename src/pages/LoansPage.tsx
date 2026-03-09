import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mockLoans, mockClients, formatCurrency, formatDate, Loan } from "@/data/mockData";
import { Plus, Calculator } from "lucide-react";

const columns = [
  { key: "id", label: "ID" },
  { key: "clientName", label: "Cliente" },
  { key: "amount", label: "Valor", render: (l: Loan) => <span className="font-medium">{formatCurrency(l.amount)}</span> },
  { key: "interestRate", label: "Juros", render: (l: Loan) => `${l.interestRate}%` },
  { key: "term", label: "Prazo", render: (l: Loan) => `${l.term} meses` },
  { key: "monthlyPayment", label: "Parcela", render: (l: Loan) => formatCurrency(l.monthlyPayment) },
  { key: "status", label: "Status", render: (l: Loan) => <StatusBadge status={l.status} /> },
  { key: "startDate", label: "Início", render: (l: Loan) => formatDate(l.startDate) },
];

export default function LoansPage() {
  const [showNew, setShowNew] = useState(false);
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState("");
  const [term, setTerm] = useState("");

  const calcPayment = () => {
    const a = parseFloat(amount) || 0;
    const r = parseFloat(rate) || 0;
    const t = parseInt(term) || 1;
    const total = a * (1 + r / 100 * (t / 12));
    return { monthly: total / t, total };
  };

  const calc = calcPayment();

  return (
    <div>
      <PageHeader
        title="Empréstimos"
        description={`${mockLoans.length} empréstimos registrados`}
        actions={
          <Dialog open={showNew} onOpenChange={setShowNew}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Novo Empréstimo</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Novo Empréstimo</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Cliente</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                    <SelectContent>
                      {mockClients.filter(c => c.status === "ativo").map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Valor (MZN)</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="50000" /></div>
                  <div><Label>Juros (%)</Label><Input type="number" value={rate} onChange={e => setRate(e.target.value)} placeholder="5" /></div>
                  <div><Label>Prazo (meses)</Label><Input type="number" value={term} onChange={e => setTerm(e.target.value)} placeholder="12" /></div>
                </div>

                {amount && term && (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2 animate-fade-in">
                    <div className="flex items-center gap-2 text-primary mb-2">
                      <Calculator className="h-4 w-4" />
                      <span className="text-sm font-medium">Simulação</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-muted-foreground">Parcela mensal:</span><p className="font-bold">{formatCurrency(calc.monthly)}</p></div>
                      <div><span className="text-muted-foreground">Total a pagar:</span><p className="font-bold">{formatCurrency(calc.total)}</p></div>
                    </div>
                  </div>
                )}

                <Button className="w-full" onClick={() => setShowNew(false)}>Criar Empréstimo</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        {(["ativo", "pago", "atrasado", "pendente"] as const).map(s => {
          const count = mockLoans.filter(l => l.status === s).length;
          const total = mockLoans.filter(l => l.status === s).reduce((sum, l) => sum + l.amount, 0);
          return (
            <div key={s} className="bg-card rounded-lg border p-4">
              <div className="flex items-center justify-between mb-1">
                <StatusBadge status={s} />
                <span className="text-lg font-bold">{count}</span>
              </div>
              <p className="text-xs text-muted-foreground">{formatCurrency(total)}</p>
            </div>
          );
        })}
      </div>

      <DataTable data={mockLoans} columns={columns} searchKeys={["clientName", "id"]} />
    </div>
  );
}
