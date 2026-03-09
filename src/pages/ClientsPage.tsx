import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { mockClients, formatDate, Client } from "@/data/mockData";
import { Plus, Mail, Phone, MapPin } from "lucide-react";

const columns = [
  { key: "id", label: "ID" },
  { key: "name", label: "Nome" },
  { key: "phone", label: "Telefone" },
  { key: "email", label: "Email" },
  { key: "totalLoans", label: "Empréstimos", render: (c: Client) => <span className="font-medium">{c.totalLoans}</span> },
  { key: "status", label: "Status", render: (c: Client) => <StatusBadge status={c.status} /> },
  { key: "createdAt", label: "Cadastro", render: (c: Client) => formatDate(c.createdAt) },
];

export default function ClientsPage() {
  const [selected, setSelected] = useState<Client | null>(null);
  const [showNew, setShowNew] = useState(false);

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
              <DialogHeader><DialogTitle>Novo Cliente</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Nome completo</Label><Input placeholder="Nome do cliente" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Telefone</Label><Input placeholder="+258 84..." /></div>
                  <div><Label>Documento</Label><Input placeholder="Nº documento" /></div>
                </div>
                <div><Label>Email</Label><Input type="email" placeholder="email@exemplo.com" /></div>
                <div><Label>Endereço</Label><Input placeholder="Endereço completo" /></div>
                <Button className="w-full" onClick={() => setShowNew(false)}>Cadastrar Cliente</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <DataTable
        data={mockClients}
        columns={columns}
        searchKeys={["name", "email", "phone", "document"]}
        onRowClick={setSelected}
      />

      {/* Client detail dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Perfil do Cliente</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-lg font-bold text-primary">{selected.name.split(" ").map(n => n[0]).join("").slice(0, 2)}</span>
                </div>
                <div>
                  <p className="font-semibold text-lg">{selected.name}</p>
                  <StatusBadge status={selected.status} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4" />{selected.email}</div>
                <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4" />{selected.phone}</div>
                <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4" />{selected.address}</div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted rounded-lg p-3 text-center">
                  <p className="text-lg font-bold">{selected.totalLoans}</p>
                  <p className="text-xs text-muted-foreground">Empréstimos</p>
                </div>
                <div className="bg-muted rounded-lg p-3 text-center">
                  <p className="text-lg font-bold">{selected.id}</p>
                  <p className="text-xs text-muted-foreground">ID</p>
                </div>
                <div className="bg-muted rounded-lg p-3 text-center">
                  <p className="text-lg font-bold">{formatDate(selected.createdAt)}</p>
                  <p className="text-xs text-muted-foreground">Cadastro</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1">Editar</Button>
                <Button className="flex-1">Ver Empréstimos</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
