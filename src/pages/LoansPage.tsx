import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mockLoans, mockClients, generateAmortizationTable, formatCurrency, formatDate, Loan, AmortizationRow } from "@/data/mockData";
import { Plus, Calculator, FileText, Printer, Table, ScrollText, Building2 } from "lucide-react";

const columns = [
  { key: "id", label: "ID" },
  { key: "clientName", label: "Cliente" },
  { key: "amount", label: "Valor", render: (l: Loan) => <span className="font-medium">{formatCurrency(l.amount)}</span> },
  { key: "interestRate", label: "Juros", render: (l: Loan) => `${l.interestRate}%` },
  { key: "term", label: "Prazo", render: (l: Loan) => `${l.term} meses` },
  { key: "monthlyPayment", label: "Parcela", render: (l: Loan) => formatCurrency(l.monthlyPayment) },
  { key: "paidInstallments", label: "Pagas", render: (l: Loan) => `${l.paidInstallments}/${l.term}` },
  { key: "remainingBalance", label: "Saldo Devedor", render: (l: Loan) => <span className="font-medium">{formatCurrency(l.remainingBalance)}</span> },
  { key: "status", label: "Status", render: (l: Loan) => <StatusBadge status={l.status} /> },
];

export default function LoansPage() {
  const [showNew, setShowNew] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [showContract, setShowContract] = useState<Loan | null>(null);
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState("");
  const [term, setTerm] = useState("");

  const calcPayment = () => {
    const a = parseFloat(amount) || 0;
    const r = parseFloat(rate) || 0;
    const t = parseInt(term) || 1;
    const interest = a * (r / 100) * (t / 12);
    const total = a + interest;
    return { monthly: total / t, total, interest };
  };
  const calc = calcPayment();

  return (
    <div>
      <PageHeader
        title="Empréstimos / Crédito"
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
                  <div><Label>Valor (MT)</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="50000" /></div>
                  <div><Label>Juros (%)</Label><Input type="number" value={rate} onChange={e => setRate(e.target.value)} placeholder="5" /></div>
                  <div><Label>Parcelas</Label><Input type="number" value={term} onChange={e => setTerm(e.target.value)} placeholder="12" /></div>
                </div>

                {amount && term && (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2 animate-fade-in">
                    <div className="flex items-center gap-2 text-primary mb-2">
                      <Calculator className="h-4 w-4" />
                      <span className="text-sm font-medium">Simulação Automática</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div><span className="text-muted-foreground block text-xs">Parcela mensal</span><p className="font-bold">{formatCurrency(calc.monthly)}</p></div>
                      <div><span className="text-muted-foreground block text-xs">Total juros</span><p className="font-bold">{formatCurrency(calc.interest)}</p></div>
                      <div><span className="text-muted-foreground block text-xs">Total a pagar</span><p className="font-bold">{formatCurrency(calc.total)}</p></div>
                    </div>
                  </div>
                )}

                <Button className="w-full" onClick={() => setShowNew(false)}>Criar Empréstimo</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {(["ativo", "pago", "atrasado", "pendente"] as const).map(s => {
          const items = mockLoans.filter(l => l.status === s);
          return (
            <div key={s} className="bg-card rounded-lg border p-4">
              <div className="flex items-center justify-between mb-1">
                <StatusBadge status={s} />
                <span className="text-lg font-bold">{items.length}</span>
              </div>
              <p className="text-xs text-muted-foreground">{formatCurrency(items.reduce((sum, l) => sum + l.amount, 0))}</p>
            </div>
          );
        })}
      </div>

      <DataTable data={mockLoans} columns={columns} searchKeys={["clientName", "id"]} onRowClick={setSelectedLoan} />

      {/* ==================== LOAN DETAIL DIALOG ==================== */}
      <Dialog open={!!selectedLoan} onOpenChange={() => setSelectedLoan(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selectedLoan && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Empréstimo {selectedLoan.id}
                  <StatusBadge status={selectedLoan.status} />
                </DialogTitle>
              </DialogHeader>

              <Tabs defaultValue="details" className="mt-2">
                <TabsList>
                  <TabsTrigger value="details"><ScrollText className="h-4 w-4 mr-1" />Detalhes</TabsTrigger>
                  <TabsTrigger value="amortization"><Table className="h-4 w-4 mr-1" />Amortização</TabsTrigger>
                  <TabsTrigger value="contract"><FileText className="h-4 w-4 mr-1" />Contrato</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="bg-muted rounded-lg p-3"><p className="text-xs text-muted-foreground">Cliente</p><p className="font-medium text-sm">{selectedLoan.clientName}</p></div>
                    <div className="bg-muted rounded-lg p-3"><p className="text-xs text-muted-foreground">Valor</p><p className="font-medium text-sm">{formatCurrency(selectedLoan.amount)}</p></div>
                    <div className="bg-muted rounded-lg p-3"><p className="text-xs text-muted-foreground">Taxa de Juros</p><p className="font-medium text-sm">{selectedLoan.interestRate}%</p></div>
                    <div className="bg-muted rounded-lg p-3"><p className="text-xs text-muted-foreground">Prazo</p><p className="font-medium text-sm">{selectedLoan.term} meses</p></div>
                    <div className="bg-muted rounded-lg p-3"><p className="text-xs text-muted-foreground">Parcela Mensal</p><p className="font-medium text-sm">{formatCurrency(selectedLoan.monthlyPayment)}</p></div>
                    <div className="bg-muted rounded-lg p-3"><p className="text-xs text-muted-foreground">Total</p><p className="font-medium text-sm">{formatCurrency(selectedLoan.totalAmount)}</p></div>
                  </div>

                  <div className="bg-card border rounded-lg p-4">
                    <h4 className="font-semibold text-sm mb-3">Estado da Dívida</h4>
                    <div className="relative w-full h-3 bg-muted rounded-full overflow-hidden mb-2">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(selectedLoan.paidAmount / selectedLoan.totalAmount) * 100}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Pago: {formatCurrency(selectedLoan.paidAmount)} ({selectedLoan.paidInstallments}/{selectedLoan.term})</span>
                      <span>Restante: {formatCurrency(selectedLoan.remainingBalance)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Início:</span><span>{formatDate(selectedLoan.startDate)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Fim:</span><span>{formatDate(selectedLoan.endDate)}</span></div>
                  </div>
                </TabsContent>

                <TabsContent value="amortization">
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50 border-b">
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">#</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Data</th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Prestação</th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Capital</th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Juros</th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Saldo</th>
                          <th className="px-3 py-2 text-center font-medium text-muted-foreground">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {generateAmortizationTable(selectedLoan).map((row: AmortizationRow) => (
                          <tr key={row.installment} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="px-3 py-2">{row.installment}</td>
                            <td className="px-3 py-2">{formatDate(row.date)}</td>
                            <td className="px-3 py-2 text-right font-medium">{formatCurrency(row.payment)}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(row.principal)}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(row.interest)}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(row.balance)}</td>
                            <td className="px-3 py-2 text-center"><StatusBadge status={row.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                <TabsContent value="contract">
                  <div className="border rounded-lg p-6 space-y-6 bg-card">
                    <div className="text-center border-b pb-4">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Building2 className="h-6 w-6 text-primary" />
                        <h2 className="text-xl font-bold">MicroCrédito S.A.</h2>
                      </div>
                      <p className="text-sm text-muted-foreground">CONTRATO DE CRÉDITO Nº {selectedLoan.id}</p>
                    </div>

                    <div className="text-sm space-y-3 leading-relaxed">
                      <p>Pelo presente contrato, a empresa <strong>MicroCrédito S.A.</strong>, com sede em Maputo, Moçambique, doravante designada <em>CREDORA</em>, concede ao(à) cliente <strong>{selectedLoan.clientName}</strong>, doravante designado(a) <em>DEVEDOR(A)</em>, um empréstimo nas seguintes condições:</p>

                      <div className="bg-muted/50 rounded-lg p-4 space-y-1">
                        <p><strong>Valor do Empréstimo:</strong> {formatCurrency(selectedLoan.amount)}</p>
                        <p><strong>Taxa de Juros:</strong> {selectedLoan.interestRate}% ao mês</p>
                        <p><strong>Número de Parcelas:</strong> {selectedLoan.term}</p>
                        <p><strong>Valor da Parcela:</strong> {formatCurrency(selectedLoan.monthlyPayment)}</p>
                        <p><strong>Valor Total:</strong> {formatCurrency(selectedLoan.totalAmount)}</p>
                        <p><strong>Data de Início:</strong> {formatDate(selectedLoan.startDate)}</p>
                        <p><strong>Data de Término:</strong> {formatDate(selectedLoan.endDate)}</p>
                      </div>

                      <p><strong>CLÁUSULA 1ª</strong> — O(A) DEVEDOR(A) compromete-se a pagar as parcelas mensais na data estipulada.</p>
                      <p><strong>CLÁUSULA 2ª</strong> — Em caso de atraso, será aplicada uma multa de 2% sobre o valor da parcela em atraso.</p>
                      <p><strong>CLÁUSULA 3ª</strong> — O pagamento antecipado é permitido sem penalidades adicionais.</p>
                      <p><strong>CLÁUSULA 4ª</strong> — Este contrato é regido pela legislação moçambicana.</p>

                      <div className="grid grid-cols-2 gap-8 pt-8 mt-4 border-t">
                        <div className="text-center">
                          <div className="border-b border-foreground/30 mb-2 h-12" />
                          <p className="text-xs text-muted-foreground">CREDORA — MicroCrédito S.A.</p>
                        </div>
                        <div className="text-center">
                          <div className="border-b border-foreground/30 mb-2 h-12" />
                          <p className="text-xs text-muted-foreground">DEVEDOR(A) — {selectedLoan.clientName}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" className="flex-1"><Printer className="h-4 w-4 mr-1.5" />Imprimir</Button>
                      <Button className="flex-1"><FileText className="h-4 w-4 mr-1.5" />Download PDF</Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
