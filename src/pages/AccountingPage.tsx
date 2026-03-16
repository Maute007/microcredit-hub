import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/data/mockData";
import { QueryErrorAlert } from "@/components/QueryErrorAlert";
import { usePermissions } from "@/hooks/usePermissions";
import { accountingApi, type ApiTransaction } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Plus, TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, Settings, Percent, Trash2, Pencil, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

const columns = [
  { key: "id", label: "ID" },
  {
    key: "type", label: "Tipo", render: (t: ApiTransaction) => (
      <div className="flex items-center gap-1.5">
        {t.type === "entrada"
          ? <ArrowUpRight className="h-4 w-4 text-success" />
          : <ArrowDownRight className="h-4 w-4 text-destructive" />}
        <span className="capitalize">{t.type}</span>
      </div>
    ),
  },
  { key: "category", label: "Categoria" },
  { key: "description", label: "Descrição" },
  {
    key: "responsible_name",
    label: "Responsável",
    render: (t: ApiTransaction) => t.responsible_name || "—",
  },
  {
    key: "amount", label: "Valor", render: (t: ApiTransaction) => (
      <span className={`font-medium ${t.type === "entrada" ? "text-success" : "text-destructive"}`}>
        {t.type === "entrada" ? "+" : "-"}{formatCurrency(t.amount)}
      </span>
    ),
  },
  { key: "date", label: "Data", render: (t: ApiTransaction) => formatDate(t.date) },
];

export default function AccountingPage() {
  const [showNew, setShowNew] = useState(false);
  const [showTaxDialog, setShowTaxDialog] = useState(false);
  const [editingTax, setEditingTax] = useState<null | { id: number; name: string; code: string; rate: number; scope: "ambos" | "entrada" | "saida"; is_active: boolean }>(null);
  const [filterFrom, setFilterFrom] = useState<string>("");
  const [filterTo, setFilterTo] = useState<string>("");
  const [filterType, setFilterType] = useState<"all" | "entrada" | "saida">("all");
  const [editingTx, setEditingTx] = useState<ApiTransaction | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { canEditTransaction, canDeleteTransaction } = usePermissions();

  const { data: categoryResponse } = useQuery({
    queryKey: ["transactions-categories"],
    queryFn: () => accountingApi.categories(),
  });
  const categorySuggestions = categoryResponse?.categories ?? [];

  const { data: taxes = [] } = useQuery({
    queryKey: ["taxes"],
    queryFn: () => accountingApi.taxes.list(),
  });

  const createTaxMut = useMutation({
    mutationFn: accountingApi.taxes.create,
    onSuccess: () => {
      toast({ title: "Imposto criado" });
      queryClient.invalidateQueries({ queryKey: ["taxes"] });
      setShowTaxDialog(false);
    },
    onError: (e: unknown) => {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Não foi possível criar", variant: "destructive" });
    },
  });

  const updateTaxMut = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<{ name: string; code: string; rate: number; scope: "ambos" | "entrada" | "saida"; is_active: boolean }> }) =>
      accountingApi.taxes.update(id, payload),
    onSuccess: () => {
      toast({ title: "Imposto actualizado" });
      queryClient.invalidateQueries({ queryKey: ["taxes"] });
      setEditingTax(null);
    },
  });

  const deleteTaxMut = useMutation({
    mutationFn: accountingApi.taxes.delete,
    onSuccess: () => {
      toast({ title: "Imposto removido" });
      queryClient.invalidateQueries({ queryKey: ["taxes"] });
    },
  });

  const { data: transactions = [], isLoading: txLoading, isError: txError, refetch: refetchTx } = useQuery<ApiTransaction[]>({
    queryKey: ["transactions", filterFrom, filterTo, filterType],
    queryFn: () =>
      accountingApi.transactions.list({
        date_from: filterFrom || undefined,
        date_to: filterTo || undefined,
        type: filterType === "all" ? undefined : filterType,
      }),
  });

  const { data: balance } = useQuery({
    queryKey: ["transactions-balance", filterFrom, filterTo, filterType],
    queryFn: () => accountingApi.balance({
      date_from: filterFrom || undefined,
      date_to: filterTo || undefined,
    }),
  });

  const totalEntries = balance?.total_entradas ?? 0;
  const totalExits = balance?.total_saidas ?? 0;

  const categoryData = Object.entries(
    transactions.reduce<Record<string, { entrada: number; saida: number }>>((acc, t) => {
      const cat = t.category || "Outros";
      if (!acc[cat]) acc[cat] = { entrada: 0, saida: 0 };
      acc[cat][t.type] += t.amount;
      return acc;
    }, {})
  ).map(([name, vals]) => ({ name: name.length > 15 ? name.slice(0, 15) + "…" : name, ...vals }));

  const dailyFlow = Object.entries(
    transactions.reduce<Record<string, { entrada: number; saida: number }>>((acc, t) => {
      const d = formatDate(t.date);
      if (!acc[d]) acc[d] = { entrada: 0, saida: 0 };
      acc[d][t.type] += t.amount;
      return acc;
    }, {})
  ).map(([day, vals]) => ({ day, ...vals }));

  const createTxMut = useMutation({
    mutationFn: accountingApi.transactions.create,
    onSuccess: () => {
      toast({ title: "Transação registada" });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transactions-balance"] });
      // Limpar formulário após registo
      setNewType("");
      setNewAmount("");
      setNewDate(new Date().toISOString().slice(0, 10));
      setNewCategory("");
      setNewDescription("");
      setNewTaxId("none");
      setSimResult(null);
      setShowNew(false);
    },
    onError: (e: unknown) => {
      toast({
        title: "Erro ao registar",
        description: e instanceof Error ? e.message : "Não foi possível registar a transação",
        variant: "destructive",
      });
    },
  });

  const [newType, setNewType] = useState<"entrada" | "saida" | "">("");
  const [newAmount, setNewAmount] = useState("");
  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newCategory, setNewCategory] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newTaxId, setNewTaxId] = useState<string>("none");

  const [simResult, setSimResult] = useState<{
    saldo_projetado: number;
    total_entradas_projetado: number;
    total_saidas_projetado: number;
  } | null>(null);

  const simulateMut = useMutation({
    mutationFn: accountingApi.simulate,
    onSuccess: (data) => {
      setSimResult({
        saldo_projetado: data.saldo_projetado,
        total_entradas_projetado: data.total_entradas_projetado,
        total_saidas_projetado: data.total_saidas_projetado,
      });
    },
  });

  const baseAmount = parseFloat(newAmount) || 0;
  const selectedTax = taxes.find((t: any) => String(t.id) === newTaxId);
  const taxRate = selectedTax?.rate ?? 0;
  const taxAmount = Math.round(baseAmount * taxRate * 100) / 100;
  const totalWithTax = Math.round((baseAmount + taxAmount) * 100) / 100;

  const updateTxMut = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<{ type: "entrada" | "saida"; amount: number; date: string; category: string; description?: string; tax?: number | null }> }) =>
      accountingApi.transactions.update(id, payload),
    onSuccess: () => {
      toast({ title: "Transação actualizada" });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transactions-balance"] });
      setEditingTx(null);
      setShowNew(false);
      setNewType("");
      setNewAmount("");
      setNewDate(new Date().toISOString().slice(0, 10));
      setNewCategory("");
      setNewDescription("");
      setNewTaxId("none");
      setSimResult(null);
    },
    onError: (e: unknown) => {
      toast({
        title: "Erro ao actualizar",
        description: e instanceof Error ? e.message : "Não foi possível actualizar a transação",
        variant: "destructive",
      });
    },
  });

  const entradasSerie = dailyFlow.map((d) => d.entrada);
  const saidasSerie = dailyFlow.map((d) => d.saida);

  return (
    <div>
      {txError && (
        <div className="mb-4">
          <QueryErrorAlert onRetry={() => refetchTx()} />
        </div>
      )}
      <PageHeader
        title="Contabilidade"
        description="Controle financeiro e registo de operações"
        actions={
          <div className="flex gap-2">
            <Dialog
              open={showNew}
              onOpenChange={(open) => {
                setShowNew(open);
                if (!open) {
                  setEditingTx(null);
                  setNewType("");
                  setNewAmount("");
                  setNewDate(new Date().toISOString().slice(0, 10));
                  setNewCategory("");
                  setNewDescription("");
                  setNewTaxId("none");
                  setSimResult(null);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Nova Transação</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>{editingTx ? "Editar Transação" : "Registrar Transação"}</DialogTitle></DialogHeader>
                <div className="space-y-4">
                <div>
                  <Label>Tipo</Label>
                  <Select value={newType} onValueChange={(v) => setNewType(v as "entrada" | "saida")}>
                    <SelectTrigger><SelectValue placeholder="Selecionar tipo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entrada">Entrada</SelectItem>
                      <SelectItem value="saida">Saída</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Valor (MT)</Label>
                    <Input
                      type="number"
                      placeholder="Valor"
                      value={newAmount}
                      onChange={(e) => setNewAmount(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Data</Label>
                    <Input
                      type="date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label>Imposto (opcional)</Label>
                  <Select value={newTaxId} onValueChange={setNewTaxId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sem imposto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem imposto</SelectItem>
                      {taxes.map((t: any) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.name} ({t.code}) — {(t.rate * 100).toFixed(2)}%
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="mt-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Base</span>
                      <span className="font-medium">{formatCurrency(baseAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Imposto</span>
                      <span className="font-medium">{formatCurrency(taxAmount)}</span>
                    </div>
                    <div className="flex justify-between border-t mt-2 pt-2">
                      <span className="font-semibold">Total</span>
                      <span className="font-semibold">{formatCurrency(totalWithTax)}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Input
                    placeholder="Ex: Pagamento Empréstimo, Salários..."
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                  />
                  {categorySuggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {categorySuggestions.slice(0, 6).map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setNewCategory(cat)}
                          className="px-2 py-0.5 rounded-full text-[11px] bg-muted hover:bg-muted/80 text-muted-foreground"
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Input
                    placeholder="Descrição da transação"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Responsável</Label>
                  <Input value="Você" disabled />
                </div>
                <Button
                  className="w-full"
                  disabled={!newType || !newAmount || !newDate || !newCategory || createTxMut.isPending || updateTxMut.isPending}
                  onClick={() => {
                    const payload = {
                      type: newType as "entrada" | "saida",
                      amount: baseAmount,
                      date: newDate,
                      category: newCategory,
                      description: newDescription || undefined,
                      tax: newTaxId === "none" ? null : parseInt(newTaxId, 10),
                    };
                    if (editingTx) {
                      updateTxMut.mutate({ id: editingTx.id, payload });
                    } else {
                      createTxMut.mutate(payload);
                    }
                  }}
                >
                  {editingTx
                    ? updateTxMut.isPending
                      ? "A guardar..."
                      : "Guardar alterações"
                    : createTxMut.isPending
                      ? "A registar..."
                      : "Registrar"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={!newType || !newAmount}
                  onClick={() => {
                    simulateMut.mutate({
                      type: newType as "entrada" | "saida",
                      amount: totalWithTax,
                      date: newDate || undefined,
                    });
                  }}
                >
                  Ver impacto no saldo
                </Button>
                {simResult && (
                  <div className="mt-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs space-y-1">
                    <p className="font-semibold">Saldo projetado: {formatCurrency(simResult.saldo_projetado)}</p>
                    <p className="text-muted-foreground">
                      Entradas: {formatCurrency(simResult.total_entradas_projetado)} • Saídas: {formatCurrency(simResult.total_saidas_projetado)}
                    </p>
                  </div>
                )}
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={showTaxDialog} onOpenChange={setShowTaxDialog}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Settings className="h-4 w-4 mr-2" />
                  Impostos
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Novo imposto</DialogTitle>
                </DialogHeader>
                <TaxForm
                  onSubmit={(payload) => createTaxMut.mutate(payload)}
                  loading={createTaxMut.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <Tabs defaultValue="transactions" className="space-y-4">
        <TabsList className="flex-wrap gap-1 bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="transactions" className="rounded-lg">
            <Wallet className="h-4 w-4 mr-1.5" />
            Transações
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-lg">
            <Percent className="h-4 w-4 mr-1.5" />
            Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">De</Label>
              <Input
                type="date"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
                className="mt-1.5 w-40"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Até</Label>
              <Input
                type="date"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
                className="mt-1.5 w-40"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Tipo</Label>
              <Select
                value={filterType}
                onValueChange={(v) => setFilterType(v as "all" | "entrada" | "saida")}
              >
                <SelectTrigger className="mt-1.5 w-40">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="entrada">Entradas</SelectItem>
                  <SelectItem value="saida">Saídas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="ml-auto flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const today = new Date();
                  const y = today.getFullYear();
                  const m = today.getMonth();
                  const first = new Date(y, m, 1).toISOString().slice(0, 10);
                  const last = new Date(y, m + 1, 0).toISOString().slice(0, 10);
                  setFilterFrom(first);
                  setFilterTo(last);
                }}
              >
                Este mês
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterFrom("");
                  setFilterTo("");
                  setFilterType("all");
                }}
              >
                Limpar
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Total Entradas"
              value={formatCurrency(totalEntries)}
              icon={TrendingUp}
              variant="success"
              sparkData={entradasSerie}
            />
            <StatCard
              title="Total Saídas"
              value={formatCurrency(totalExits)}
              icon={TrendingDown}
              variant="destructive"
              sparkData={saidasSerie}
            />
            <StatCard
              title="Saldo Geral"
              value={formatCurrency(totalEntries - totalExits)}
              icon={Wallet}
              variant={totalEntries - totalExits >= 0 ? "primary" : "destructive"}
              progress={{
                value: Math.round(totalEntries),
                max: Math.round(totalEntries + totalExits) || 1,
                label: "Entradas vs Total",
              }}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card rounded-xl border p-5">
              <h3 className="font-semibold mb-4">Fluxo de Caixa Diário</h3>
              <ResponsiveContainer width="100%" height={230}>
                <AreaChart data={dailyFlow}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,16%,88%)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v / 1000}k`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Area type="monotone" dataKey="entrada" stroke="hsl(152,60%,42%)" fill="hsl(152,60%,42%)" fillOpacity={0.1} name="Entradas" />
                  <Area type="monotone" dataKey="saida" stroke="hsl(0,72%,51%)" fill="hsl(0,72%,51%)" fillOpacity={0.1} name="Saídas" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card rounded-xl border p-5">
              <h3 className="font-semibold mb-4">Por Categoria</h3>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={categoryData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,16%,88%)" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${v / 1000}k`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="entrada" fill="hsl(152,60%,42%)" radius={[0, 4, 4, 0]} name="Entrada" />
                  <Bar dataKey="saida" fill="hsl(0,72%,51%)" radius={[0, 4, 4, 0]} name="Saída" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <DataTable
            data={transactions}
            columns={columns}
            loading={txLoading}
            searchKeys={["category", "description", "responsible_name", "description"]}
            pageSize={10}
            renderRowActions={(canEditTransaction || canDeleteTransaction) ? (t) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canEditTransaction && (
                  <DropdownMenuItem
                    onClick={() => {
                      const tx = t as ApiTransaction;
                      setEditingTx(tx);
                      setShowNew(true);
                      setNewType(tx.type);
                      setNewAmount(String(tx.amount));
                      setNewDate(tx.date);
                      setNewCategory(tx.category);
                      setNewDescription(tx.description || "");
                      setNewTaxId(tx.tax ? String(tx.tax) : "none");
                      setSimResult(null);
                    }}
                  >
                    <Pencil className="h-4 w-4 mr-2" />Editar
                  </DropdownMenuItem>
                  )}
                  {canDeleteTransaction && (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => {
                      const tx = t as ApiTransaction;
                      if (!window.confirm("Deseja eliminar esta transação?")) return;
                      accountingApi.transactions
                        .delete(tx.id)
                        .then(() => {
                          toast({ title: "Transação eliminada" });
                          queryClient.invalidateQueries({ queryKey: ["transactions"] });
                          queryClient.invalidateQueries({ queryKey: ["transactions-balance"] });
                        })
                        .catch((e: unknown) => {
                          toast({
                            title: "Erro ao eliminar",
                            description: e instanceof Error ? e.message : "Não foi possível eliminar a transação",
                            variant: "destructive",
                          });
                        });
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />Eliminar
                  </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : undefined}
          />
        </TabsContent>

        <TabsContent value="settings">
          <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
            <div className="p-6 border-b bg-muted/20 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">Impostos</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Crie/edite impostos e use em transações (e futuramente em outros módulos).
                </p>
              </div>
              <Button variant="outline" onClick={() => setShowTaxDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Novo imposto
              </Button>
            </div>
            <div className="p-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Nome</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Código</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Taxa</th>
                    <th className="px-3 py-2 text-center font-medium text-muted-foreground">Activo</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Acções</th>
                  </tr>
                </thead>
                <tbody>
                  {taxes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                        Nenhum imposto cadastrado
                      </td>
                    </tr>
                  ) : (
                    taxes.map((t: any) => (
                      <tr key={t.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-3 py-2 font-medium">{t.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{t.code}</td>
                        <td className="px-3 py-2 text-right">{(t.rate * 100).toFixed(2)}%</td>
                        <td className="px-3 py-2 text-center">
                          <Button
                            type="button"
                            variant={t.is_active ? "default" : "outline"}
                            size="sm"
                            onClick={() => updateTaxMut.mutate({ id: t.id, payload: { is_active: !t.is_active } })}
                          >
                            {t.is_active ? "Sim" : "Não"}
                          </Button>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="inline-flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setEditingTax(t)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => deleteTaxMut.mutate(t.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <Dialog open={!!editingTax} onOpenChange={(o) => !o && setEditingTax(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Editar imposto</DialogTitle>
              </DialogHeader>
              {editingTax && (
                <TaxForm
                  initial={editingTax}
                  submitLabel="Guardar"
                  loading={updateTaxMut.isPending}
                  onSubmit={(payload) => updateTaxMut.mutate({ id: editingTax.id, payload })}
                />
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TaxForm({
  initial,
  onSubmit,
  loading,
  submitLabel = "Criar",
}: {
  initial?: { name: string; code: string; rate: number; scope: "ambos" | "entrada" | "saida"; is_active: boolean };
  onSubmit: (payload: { name: string; code: string; rate: number; scope: "ambos" | "entrada" | "saida"; is_active?: boolean }) => void;
  loading: boolean;
  submitLabel?: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [ratePct, setRatePct] = useState(String(((initial?.rate ?? 0) * 100).toFixed(2)));
  const [scope, setScope] = useState<"ambos" | "entrada" | "saida">(initial?.scope ?? "ambos");
  const [active, setActive] = useState(initial?.is_active ?? true);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const pct = parseFloat(ratePct.replace(",", ".")) || 0;
        const rate = Math.max(0, Math.min(1, pct / 100));
        onSubmit({ name: name.trim(), code: code.trim(), rate, scope, is_active: active });
      }}
    >
      <div>
        <Label>Nome</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Código</Label>
          <Input value={code} onChange={(e) => setCode(e.target.value)} required />
        </div>
        <div>
          <Label>Percentagem (%)</Label>
          <Input type="number" value={ratePct} onChange={(e) => setRatePct(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Aplicação</Label>
          <Select value={scope} onValueChange={(v) => setScope(v as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ambos">Entradas e Saídas</SelectItem>
              <SelectItem value="entrada">Apenas Entradas</SelectItem>
              <SelectItem value="saida">Apenas Saídas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Activo</Label>
          <Select value={active ? "true" : "false"} onValueChange={(v) => setActive(v === "true")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Sim</SelectItem>
              <SelectItem value="false">Não</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "A guardar..." : submitLabel}
      </Button>
    </form>
  );
}
