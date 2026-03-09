import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { mockClients, mockLoans, formatCurrency, formatDate, Client, Loan } from "@/data/mockData";
import { Plus, Mail, Phone, MapPin, Briefcase, Building } from "lucide-react";

const columns = [
  { key: "id", label: "ID" },
  {
    key: "name", label: "Nome", render: (c: Client) => (
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-primary">{c.name.split(" ").map(n => n[0]).join("").slice(0, 2)}</span>
        </div>
        <span className="font-medium">{c.name}</span>
      </div>
    ),
  },
  { key: "phone", label: "Telefone" },
  { key: "city", label: "Cidade" },
  { key: "occupation", label: "Profissão" },
  { key: "totalLoans", label: "Empréstimos", render: (c: Client) => <span className="font-medium">{c.totalLoans}</span> },
  { key: "status", label: "Status", render: (c: Client) => <StatusBadge status={c.status} /> },
  { key: "createdAt", label: "Cadastro", render: (c: Client) => formatDate(c.createdAt) },
];

export default function ClientsPage() {
  const [selected, setSelected] = useState<Client | null>(null);
  const [showNew, setShowNew] = useState(false);

  const clientLoans = selected ? mockLoans.filter(l => l.clientId === selected.id) : [];
  const totalDebt = clientLoans.filter(l => l.status !== "pago").reduce((s, l) => s + l.remainingBalance, 0);

  return (
    <div>
      <PageHeader
        title="Clientes"
        description={`${mockClients.length} clientes cadastrados`}
        actions={
          <Dialog open={showNew} onOpenChange={setShowNew}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Novo Cliente</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Cadastrar Novo Cliente</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Nome completo</Label><Input placeholder="Nome completo do cliente" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Telefone</Label><Input placeholder="+258 84..." /></div>
                  <div><Label>Nº Documento</Label><Input placeholder="Nº do BI/DIRE" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Email</Label><Input type="email" placeholder="email@exemplo.com" /></div>
                  <div><Label>Profissão</Label><Input placeholder="Profissão" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Cidade</Label><Input placeholder="Cidade" /></div>
                  <div><Label>Endereço</Label><Input placeholder="Endereço completo" /></div>
                </div>
                <Button className="w-full" onClick={() => setShowNew(false)}>Cadastrar Cliente</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <DataTable
        data={mockClients}
        columns={columns}
        searchKeys={["name", "email", "phone", "document", "city", "occupation"]}
        onRowClick={setSelected}
      />

      {/* Client Profile Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Perfil do Cliente</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xl font-bold text-primary">{selected.name.split(" ").map(n => n[0]).join("").slice(0, 2)}</span>
                </div>
                <div>
                  <p className="font-bold text-lg">{selected.name}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <StatusBadge status={selected.status} />
                    <span className="text-xs text-muted-foreground">ID: {selected.id}</span>
                  </div>
                </div>
              </div>

              {/* Contact info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4 shrink-0" />{selected.phone}</div>
                <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4 shrink-0" />{selected.email}</div>
                <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4 shrink-0" />{selected.address}, {selected.city}</div>
                <div className="flex items-center gap-2 text-muted-foreground"><Briefcase className="h-4 w-4 shrink-0" />{selected.occupation}</div>
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted rounded-lg p-3 text-center">
                  <p className="text-xl font-bold">{selected.totalLoans}</p>
                  <p className="text-xs text-muted-foreground">Empréstimos</p>
                </div>
                <div className="bg-muted rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-destructive">{formatCurrency(totalDebt)}</p>
                  <p className="text-xs text-muted-foreground">Dívida Actual</p>
                </div>
                <div className="bg-muted rounded-lg p-3 text-center">
                  <p className="text-xl font-bold">{formatDate(selected.createdAt)}</p>
                  <p className="text-xs text-muted-foreground">Cadastro</p>
                </div>
              </div>

              {/* Loan history */}
              {clientLoans.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-3">Histórico de Empréstimos</h4>
                  <div className="space-y-2">
                    {clientLoans.map(loan => (
                      <div key={loan.id} className="border rounded-lg p-3 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{loan.id}</span>
                            <StatusBadge status={loan.status} />
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{formatDate(loan.startDate)} → {formatDate(loan.endDate)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-sm">{formatCurrency(loan.amount)}</p>
                          <p className="text-xs text-muted-foreground">{loan.paidInstallments}/{loan.term} parcelas</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1">Editar Cliente</Button>
                <Button className="flex-1">Novo Empréstimo</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
