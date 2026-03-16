import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { QueryErrorAlert } from "@/components/QueryErrorAlert";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency, formatDate } from "@/data/mockData";
import { clientsApi, loansApi, type ApiClient, type ApiLoan } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus as PlusIcon, ShieldCheck } from "lucide-react";

const COLLATERAL_TYPES = [
  { value: "documento", label: "Documento" },
  { value: "eletronico", label: "Eletrónico" },
  { value: "veiculo", label: "Veículo" },
  { value: "imovel", label: "Imóvel" },
  { value: "joias", label: "Joias" },
  { value: "maquinaria", label: "Maquinaria" },
  { value: "outro", label: "Outro" },
];
const COLLATERAL_CONDITIONS = [
  { value: "novo", label: "Novo" },
  { value: "bom", label: "Bom estado" },
  { value: "usado", label: "Usado" },
  { value: "danificado", label: "Danificado" },
  { value: "não_aplicavel", label: "Não aplicável" },
];
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { Plus, Mail, Phone, MapPin, Briefcase, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

const columns = [
  { key: "id", label: "ID" },
  {
    key: "name", label: "Nome", render: (c: ApiClient) => (
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
  { key: "total_loans", label: "Empréstimos", render: (c: ApiClient) => <span className="font-medium">{c.total_loans}</span> },
  { key: "status", label: "Status", render: (c: ApiClient) => <StatusBadge status={c.status} /> },
  { key: "created_at", label: "Cadastro", render: (c: ApiClient) => formatDate(c.created_at) },
];

export default function ClientsPage() {
  const [selected, setSelected] = useState<ApiClient | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [editingClient, setEditingClient] = useState<ApiClient | null>(null);
  const [deletingClient, setDeletingClient] = useState<ApiClient | null>(null);
  const [showNewLoan, setShowNewLoan] = useState(false);
  const [loanForm, setLoanForm] = useState({
    amount: "",
    rate: "",
    term: "",
    hasCollateral: true,
    collateral: {
      description: "",
      item_type: "documento" as const,
      estimated_value: "",
      condition: "não_aplicavel" as const,
      serial_number: "",
      notes: "",
    },
  });
  const [form, setForm] = useState({
    name: "",
    phone: "",
    document: "",
    email: "",
    occupation: "",
    city: "",
    address: "",
  });
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get("q") ?? "";
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { canEditClient, canDeleteClient } = usePermissions();

  const { data: clients, isLoading, isError, refetch } = useQuery({
    queryKey: ["clients"],
    queryFn: clientsApi.list,
  });

  const updateClient = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof clientsApi.update>[1] }) =>
      clientsApi.update(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      setEditingClient(null);
      toast({ title: "Cliente actualizado", description: "As alterações foram guardadas." });
    },
    onError: (error: unknown) => {
      const msg = error && typeof error === "object" && "message" in error
        ? String((error as { message?: string }).message)
        : "Não foi possível actualizar o cliente.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    },
  });

  const deleteClient = useMutation({
    mutationFn: clientsApi.delete,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      setDeletingClient(null);
      setSelected(null);
      toast({ title: "Cliente eliminado", description: "O cliente foi removido." });
    },
    onError: (error: unknown) => {
      const msg = error && typeof error === "object" && "message" in error
        ? String((error as { message?: string }).message)
        : "Não foi possível eliminar o cliente.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    },
  });

  const createLoan = useMutation({
    mutationFn: loansApi.create,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["client-loans"] });
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      await queryClient.invalidateQueries({ queryKey: ["loans"] });
      setShowNewLoan(false);
      setLoanForm({
        amount: "",
        rate: "",
        term: "",
        hasCollateral: true,
        collateral: { description: "", item_type: "documento", estimated_value: "", condition: "não_aplicavel", serial_number: "", notes: "" },
      });
      toast({ title: "Empréstimo criado", description: "O empréstimo foi registado para o cliente." });
    },
    onError: (error: unknown) => {
      const msg = error && typeof error === "object" && "message" in error
        ? String((error as { message?: string }).message)
        : "Não foi possível criar o empréstimo.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    },
  });

  const createClient = useMutation({
    mutationFn: clientsApi.create,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      setShowNew(false);
      setForm({
        name: "",
        phone: "",
        document: "",
        email: "",
        occupation: "",
        city: "",
        address: "",
      });
      toast({ title: "Cliente cadastrado", description: "O cliente foi criado com sucesso." });
    },
    onError: (error: unknown) => {
      const msg =
        error && typeof error === "object" && "message" in error
          ? String((error as any).message)
          : "Não foi possível cadastrar o cliente.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    },
  });

  const { data: clientLoans = [] } = useQuery({
    queryKey: ["client-loans", selected?.id],
    queryFn: () => (selected ? clientsApi.loans(selected.id) : Promise.resolve([] as ApiLoan[])),
    enabled: !!selected,
  });
  const totalDebt = clientLoans.filter(l => l.status !== "pago").reduce((s, l) => s + l.remaining_balance, 0);

  return (
    <div>
      {isError && (
        <div className="mb-4">
          <QueryErrorAlert onRetry={() => refetch()} />
        </div>
      )}
      <PageHeader
        title="Clientes"
        description={
          isLoading
            ? "A carregar clientes..."
            : `${clients?.length ?? 0} cliente(s) cadastrados`
        }
        actions={
          <Dialog open={showNew} onOpenChange={setShowNew}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Novo Cliente</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Cadastrar Novo Cliente</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nome completo</Label>
                  <Input
                    placeholder="Nome completo do cliente"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Telefone</Label>
                    <Input
                      placeholder="+258 84..."
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Nº Documento</Label>
                    <Input
                      placeholder="Nº do BI/DIRE"
                      value={form.document}
                      onChange={(e) => setForm((f) => ({ ...f, document: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      placeholder="email@exemplo.com"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Profissão</Label>
                    <Input
                      placeholder="Profissão"
                      value={form.occupation}
                      onChange={(e) => setForm((f) => ({ ...f, occupation: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Cidade</Label>
                    <Input
                      placeholder="Cidade"
                      value={form.city}
                      onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Endereço</Label>
                    <Input
                      placeholder="Endereço completo"
                      value={form.address}
                      onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    />
                  </div>
                </div>
                <Button
                  className="w-full"
                  disabled={createClient.isLoading || !form.name.trim()}
                  onClick={() =>
                    createClient.mutate({
                      name: form.name.trim(),
                      phone: form.phone || undefined,
                      document: form.document || undefined,
                      email: form.email || undefined,
                      occupation: form.occupation || undefined,
                      city: form.city || undefined,
                      address: form.address || undefined,
                    })
                  }
                >
                  {createClient.isLoading ? "A guardar..." : "Cadastrar Cliente"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <DataTable
        data={clients ?? []}
        columns={columns}
        searchKeys={["name", "email", "phone", "document", "city", "occupation"]}
        initialSearch={searchQuery}
        onRowClick={setSelected}
        renderRowActions={
          (canEditClient || canDeleteClient)
            ? (c) => (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    {canEditClient && (
                      <DropdownMenuItem onClick={() => setEditingClient(c)}>
                        <Pencil className="h-4 w-4 mr-2" />Editar
                      </DropdownMenuItem>
                    )}
                    {canDeleteClient && (
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeletingClient(c)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />Eliminar
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )
            : undefined
        }
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
                  <p className="text-xl font-bold">{selected.total_loans}</p>
                  <p className="text-xs text-muted-foreground">Empréstimos</p>
                </div>
                <div className="bg-muted rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-destructive">{formatCurrency(totalDebt)}</p>
                  <p className="text-xs text-muted-foreground">Dívida Actual</p>
                </div>
                <div className="bg-muted rounded-lg p-3 text-center">
                  <p className="text-xl font-bold">{formatDate(selected.created_at)}</p>
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
                          <p className="text-xs text-muted-foreground mt-0.5">{formatDate(loan.start_date)} → {formatDate(loan.end_date)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-sm">{formatCurrency(loan.amount)}</p>
                          <p className="text-xs text-muted-foreground">{loan.paid_installments}/{loan.term} parcelas</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {canEditClient && (
                  <Button variant="outline" className="flex-1" onClick={() => setEditingClient(selected)}>
                    Editar Cliente
                  </Button>
                )}
                <Button className="flex-1" onClick={() => setShowNewLoan(true)}>
                  <PlusIcon className="h-4 w-4 mr-1.5" />Novo Empréstimo
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Novo Empréstimo (para cliente selecionado) */}
      <Dialog open={showNewLoan && !!selected} onOpenChange={(o) => !o && setShowNewLoan(false)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Empréstimo — {selected?.name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="text-muted-foreground">Cliente</p>
                <p className="font-medium">{selected.name}</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Valor (MT)</Label><Input type="number" placeholder="50000" value={loanForm.amount} onChange={(e) => setLoanForm((f) => ({ ...f, amount: e.target.value }))} /></div>
                <div><Label>Juros (%)</Label><Input type="number" placeholder="5" value={loanForm.rate} onChange={(e) => setLoanForm((f) => ({ ...f, rate: e.target.value }))} /></div>
                <div><Label>Parcelas</Label><Input type="number" placeholder="12" value={loanForm.term} onChange={(e) => setLoanForm((f) => ({ ...f, term: e.target.value }))} /></div>
              </div>
              {loanForm.amount && loanForm.term && (() => {
                const amt = parseFloat(loanForm.amount) || 0;
                const rate = parseFloat(loanForm.rate) || 0;
                const t = parseInt(loanForm.term, 10) || 1;
                const interest = amt * (rate / 100) * (t / 12);
                const total = amt + interest;
                const monthly = total / t;
                return (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm flex gap-4">
                    <div><span className="text-muted-foreground text-xs block">Parcela mensal</span><p className="font-bold">{formatCurrency(monthly)}</p></div>
                    <div><span className="text-muted-foreground text-xs block">Total a pagar</span><p className="font-bold">{formatCurrency(total)}</p></div>
                  </div>
                );
              })()}
              <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <Label className="flex-1">Item de garantia</Label>
                  <input type="checkbox" checked={loanForm.hasCollateral} onChange={(e) => setLoanForm((f) => ({ ...f, hasCollateral: e.target.checked }))} className="rounded" />
                </div>
                {loanForm.hasCollateral && (
                  <div className="grid gap-2 text-sm">
                    <div><Label>Descrição *</Label><Input placeholder="Ex: Bilhete de Identidade..." value={loanForm.collateral.description} onChange={(e) => setLoanForm((f) => ({ ...f, collateral: { ...f.collateral, description: e.target.value } }))} /></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><Label>Tipo</Label><Select value={loanForm.collateral.item_type} onValueChange={(v) => setLoanForm((f) => ({ ...f, collateral: { ...f.collateral, item_type: v as typeof f.collateral.item_type } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{COLLATERAL_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
                      <div><Label>Valor estimado (MT)</Label><Input type="number" placeholder="Opcional" value={loanForm.collateral.estimated_value} onChange={(e) => setLoanForm((f) => ({ ...f, collateral: { ...f.collateral, estimated_value: e.target.value } }))} /></div>
                    </div>
                    <div><Label>Estado</Label><Select value={loanForm.collateral.condition} onValueChange={(v) => setLoanForm((f) => ({ ...f, collateral: { ...f.collateral, condition: v as typeof f.collateral.condition } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{COLLATERAL_CONDITIONS.map((x) => <SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Nº série / Observações</Label><Input placeholder="Opcional" value={loanForm.collateral.serial_number} onChange={(e) => setLoanForm((f) => ({ ...f, collateral: { ...f.collateral, serial_number: e.target.value } }))} /></div>
                  </div>
                )}
              </div>
              <Button
                className="w-full"
                disabled={
                  createLoan.isLoading || !loanForm.amount.trim() || !loanForm.rate.trim() || !loanForm.term.trim() ||
                  (loanForm.hasCollateral && !loanForm.collateral.description.trim())
                }
                onClick={() => {
                  const a = parseFloat(loanForm.amount) || 0;
                  const r = parseFloat(loanForm.rate) || 0;
                  const t = parseInt(loanForm.term, 10) || 1;
                  const today = new Date();
                  const start = today.toISOString().slice(0, 10);
                  const end = new Date(today);
                  end.setMonth(end.getMonth() + t);
                  const endStr = end.toISOString().slice(0, 10);
                  const collateralPayload = loanForm.hasCollateral && loanForm.collateral.description.trim()
                    ? { description: loanForm.collateral.description.trim(), item_type: loanForm.collateral.item_type, estimated_value: loanForm.collateral.estimated_value ? parseFloat(loanForm.collateral.estimated_value) : null, condition: loanForm.collateral.condition, serial_number: loanForm.collateral.serial_number.trim() || undefined, notes: loanForm.collateral.notes.trim() || undefined }
                    : undefined;
                  createLoan.mutate({
                    client: selected.id,
                    amount: a,
                    interest_rate: r,
                    term: t,
                    start_date: start,
                    end_date: endStr,
                    collateral: collateralPayload ?? null,
                  });
                }}
              >
                {createLoan.isLoading ? "A criar..." : "Criar Empréstimo"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Client Dialog */}
      <Dialog open={!!editingClient} onOpenChange={(o) => !o && setEditingClient(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar Cliente</DialogTitle></DialogHeader>
          {editingClient && (
            <ClientEditForm
              client={editingClient}
              onSubmit={(data) =>
                updateClient.mutate({ id: editingClient.id, payload: data })
              }
              isLoading={updateClient.isLoading}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingClient} onOpenChange={(o) => !o && setDeletingClient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acção não pode ser revertida. O cliente e os dados associados serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingClient && deleteClient.mutate(deletingClient.id)}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ClientEditForm({
  client,
  onSubmit,
  isLoading,
}: {
  client: ApiClient;
  onSubmit: (data: Parameters<typeof clientsApi.update>[1]) => void;
  isLoading: boolean;
}) {
  const [form, setForm] = useState({
    name: client.name,
    phone: client.phone ?? "",
    document: client.document ?? "",
    email: client.email ?? "",
    occupation: client.occupation ?? "",
    city: client.city ?? "",
    address: client.address ?? "",
  });
  useEffect(() => {
    setForm({
      name: client.name,
      phone: client.phone ?? "",
      document: client.document ?? "",
      email: client.email ?? "",
      occupation: client.occupation ?? "",
      city: client.city ?? "",
      address: client.address ?? "",
    });
  }, [client.id]);
  return (
    <div className="space-y-4">
      <div>
        <Label>Nome completo</Label>
        <Input
          placeholder="Nome completo do cliente"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Telefone</Label>
          <Input placeholder="+258 84..." value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        </div>
        <div>
          <Label>Nº Documento</Label>
          <Input placeholder="Nº do BI/DIRE" value={form.document} onChange={(e) => setForm((f) => ({ ...f, document: e.target.value }))} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Email</Label>
          <Input type="email" placeholder="email@exemplo.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </div>
        <div>
          <Label>Profissão</Label>
          <Input placeholder="Profissão" value={form.occupation} onChange={(e) => setForm((f) => ({ ...f, occupation: e.target.value }))} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Cidade</Label>
          <Input placeholder="Cidade" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
        </div>
        <div>
          <Label>Endereço</Label>
          <Input placeholder="Endereço completo" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
        </div>
      </div>
      <Button
        className="w-full"
        disabled={isLoading || !form.name.trim()}
        onClick={() =>
          onSubmit({
            name: form.name.trim(),
            phone: form.phone || undefined,
            document: form.document || undefined,
            email: form.email || undefined,
            occupation: form.occupation || undefined,
            city: form.city || undefined,
            address: form.address || undefined,
          })
        }
      >
        {isLoading ? "A guardar..." : "Guardar alterações"}
      </Button>
    </div>
  );
}

function ClientForm({
  form,
  setForm,
  onSubmit,
  isLoading,
  submitLabel,
}: {
  form: { name: string; phone: string; document: string; email: string; occupation: string; city: string; address: string };
  setForm: React.Dispatch<React.SetStateAction<{ name: string; phone: string; document: string; email: string; occupation: string; city: string; address: string }>>;
  onSubmit: (data: Parameters<typeof clientsApi.create>[0]) => void;
  isLoading: boolean;
  submitLabel: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Nome completo</Label>
        <Input placeholder="Nome completo do cliente" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Telefone</Label>
          <Input placeholder="+258 84..." value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        </div>
        <div>
          <Label>Nº Documento</Label>
          <Input placeholder="Nº do BI/DIRE" value={form.document} onChange={(e) => setForm((f) => ({ ...f, document: e.target.value }))} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Email</Label>
          <Input type="email" placeholder="email@exemplo.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </div>
        <div>
          <Label>Profissão</Label>
          <Input placeholder="Profissão" value={form.occupation} onChange={(e) => setForm((f) => ({ ...f, occupation: e.target.value }))} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Cidade</Label>
          <Input placeholder="Cidade" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
        </div>
        <div>
          <Label>Endereço</Label>
          <Input placeholder="Endereço completo" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
        </div>
      </div>
      <Button className="w-full" disabled={isLoading || !form.name.trim()} onClick={() => onSubmit({ name: form.name.trim(), phone: form.phone || undefined, document: form.document || undefined, email: form.email || undefined, occupation: form.occupation || undefined, city: form.city || undefined, address: form.address || undefined })}>
        {isLoading ? "A guardar..." : submitLabel}
      </Button>
    </div>
  );
}
