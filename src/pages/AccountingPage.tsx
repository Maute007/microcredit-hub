import { useMemo, useState } from "react";
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
import {
  accountingApi,
  type ApiCompanyFinanceSettings,
  type ApiFinancialOverview,
  type ApiMonthlyFinanceSnapshot,
  type ApiMonthlySnapshotActionLog,
  type ApiTransaction,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Plus, TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, Settings, Percent, Trash2, Pencil, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { useAuth } from "@/contexts/AuthContext";

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
  const { user } = useAuth();
  const canManageClosings = !!user && (user.is_staff || user.is_superuser);

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

  const { data: overview } = useQuery<ApiFinancialOverview>({
    queryKey: ["transactions-overview", filterFrom, filterTo],
    queryFn: () =>
      accountingApi.overview({
        date_from: filterFrom || undefined,
        date_to: filterTo || undefined,
      }),
  });

  const { data: financeSettings } = useQuery<ApiCompanyFinanceSettings>({
    queryKey: ["finance-settings"],
    queryFn: () => accountingApi.financeSettings.get(),
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
  const [openingBalanceInput, setOpeningBalanceInput] = useState("");
  const [closeMonth, setCloseMonth] = useState(() => new Date().toISOString().slice(0, 7));

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

  const saveFinanceSettingsMut = useMutation({
    mutationFn: (payload: Partial<Pick<ApiCompanyFinanceSettings, "opening_balance">>) =>
      accountingApi.financeSettings.update(payload),
    onSuccess: async () => {
      toast({ title: "Saldo inicial actualizado" });
      await queryClient.invalidateQueries({ queryKey: ["finance-settings"] });
      await queryClient.invalidateQueries({ queryKey: ["transactions-overview"] });
      setOpeningBalanceInput("");
    },
    onError: (e: unknown) => {
      toast({
        title: "Erro ao guardar saldo inicial",
        description: e instanceof Error ? e.message : "Não foi possível guardar",
        variant: "destructive",
      });
    },
  });

  const { data: monthlySnapshots = [] } = useQuery<ApiMonthlyFinanceSnapshot[]>({
    queryKey: ["monthly-snapshots"],
    queryFn: () => accountingApi.monthlySnapshots.list(),
  });

  const { data: snapshotAudit = [] } = useQuery<ApiMonthlySnapshotActionLog[]>({
    queryKey: ["monthly-snapshot-audit"],
    queryFn: () => accountingApi.monthlySnapshotAudit(),
  });

  const createSnapshotMut = useMutation({
    mutationFn: (payload: { month: string }) => accountingApi.monthlySnapshots.create(payload),
    onSuccess: async () => {
      toast({ title: "Fecho mensal criado com sucesso" });
      await queryClient.invalidateQueries({ queryKey: ["monthly-snapshots"] });
    },
    onError: (e: unknown) => {
      toast({
        title: "Erro ao criar fecho mensal",
        description: e instanceof Error ? e.message : "Não foi possível criar o fecho",
        variant: "destructive",
      });
    },
  });

  const [reopenReason, setReopenReason] = useState("");
  const [reopenId, setReopenId] = useState<number | null>(null);
  const reopenSnapshotMut = useMutation({
    mutationFn: (payload: { id: number; reason: string }) =>
      accountingApi.monthlySnapshots.reopen(payload.id, { reason: payload.reason }),
    onSuccess: async () => {
      toast({ title: "Fecho reaberto" });
      setReopenId(null);
      setReopenReason("");
      await queryClient.invalidateQueries({ queryKey: ["monthly-snapshots"] });
      await queryClient.invalidateQueries({ queryKey: ["transactions-overview"] });
    },
    onError: (e: unknown) => {
      toast({
        title: "Erro ao reabrir fecho",
        description: e instanceof Error ? e.message : "Não foi possível reabrir",
        variant: "destructive",
      });
    },
  });

  const snapshotsById = useMemo(
    () => new Map(monthlySnapshots.map((s) => [s.id, s] as const)),
    [monthlySnapshots]
  );

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
          <TabsTrigger value="overview" className="rounded-lg">
            <TrendingUp className="h-4 w-4 mr-1.5" />
            Visão Global
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

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Entradas Consolidadas"
              value={formatCurrency(overview?.entries.total_entries ?? 0)}
              icon={TrendingUp}
              variant="success"
              subtitle="Contabilidade + Pagamentos"
            />
            <StatCard
              title="Saídas Consolidadas"
              value={formatCurrency(overview?.exits.total_exits ?? 0)}
              icon={TrendingDown}
              variant="destructive"
              subtitle="Contabilidade + RH + Desembolso"
            />
            <StatCard
              title="Saldo Real (Auditável)"
              value={formatCurrency(overview?.consolidated_balance ?? 0)}
              icon={Wallet}
              variant={(overview?.consolidated_balance ?? 0) >= 0 ? "primary" : "destructive"}
            />
          </div>

          <div className="rounded-2xl border bg-card p-5">
            <h3 className="font-semibold mb-2">Regra de cálculo (sem inventar valores)</h3>
            <p className="text-sm text-muted-foreground">
              O saldo real usa apenas movimentos efetivamente registados: saldo inicial + entradas confirmadas - saídas confirmadas.
              Valores “a receber” e “planejados” aparecem separados e não entram no saldo auditável.
            </p>
          </div>

          <div className="rounded-2xl border bg-card p-5">
            <h3 className="font-semibold mb-3">Base financeira da empresa</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Registe aqui o saldo inicial (caixa/capital de base). O sistema usa este valor para calcular
              o saldo consolidado real com todos os movimentos dos módulos.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label>Saldo inicial (MT)</Label>
                <Input
                  type="number"
                  className="mt-1 w-60"
                  placeholder={String(financeSettings?.opening_balance ?? 0)}
                  value={openingBalanceInput}
                  onChange={(e) => setOpeningBalanceInput(e.target.value)}
                />
              </div>
              <Button
                type="button"
                disabled={saveFinanceSettingsMut.isPending || !openingBalanceInput.trim()}
                onClick={() => {
                  const value = parseFloat(openingBalanceInput) || 0;
                  saveFinanceSettingsMut.mutate({ opening_balance: value });
                }}
              >
                {saveFinanceSettingsMut.isPending ? "A guardar..." : "Guardar saldo inicial"}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              Saldo inicial actual:{" "}
              <span className="font-medium text-foreground">
                {formatCurrency(overview?.opening_balance ?? 0)}
              </span>
            </p>
          </div>

          <div className="rounded-2xl border bg-card p-5">
            <h3 className="font-semibold mb-4">Composição das entradas</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground">Entradas manuais (Contabilidade)</p>
                <p className="font-semibold mt-1">{formatCurrency(overview?.entries.accounting_entries ?? 0)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground">Pagamentos recebidos</p>
                <p className="font-semibold mt-1">{formatCurrency(overview?.entries.payments_received ?? 0)}</p>
              </div>
              <div className="rounded-lg border p-3 bg-muted/20">
                <p className="text-muted-foreground">Total de entradas</p>
                <p className="font-semibold mt-1">{formatCurrency(overview?.entries.total_entries ?? 0)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5">
            <h3 className="font-semibold mb-4">Composição das saídas</h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground">Saídas manuais (Contabilidade)</p>
                <p className="font-semibold mt-1">{formatCurrency(overview?.exits.accounting_exits ?? 0)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground">Desembolso de empréstimos</p>
                <p className="font-semibold mt-1">{formatCurrency(overview?.exits.loans_disbursed ?? 0)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground">Folha salarial (RH)</p>
                <p className="font-semibold mt-1">{formatCurrency(overview?.exits.hr_payroll_paid ?? 0)}</p>
              </div>
              <div className="rounded-lg border p-3 bg-muted/20">
                <p className="text-muted-foreground">Total de saídas</p>
                <p className="font-semibold mt-1">{formatCurrency(overview?.exits.total_exits ?? 0)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              title="Carteira em aberto (a receber)"
              value={formatCurrency(overview?.analysis.receivables_open ?? 0)}
              icon={TrendingUp}
              subtitle="Não entra no saldo real"
            />
            <StatCard
              title="A receber em atraso"
              value={formatCurrency(overview?.analysis.receivables_overdue ?? 0)}
              icon={TrendingDown}
              variant="destructive"
              subtitle="Risco de cobrança"
            />
            <StatCard
              title="Entradas futuras lançadas"
              value={formatCurrency(overview?.analysis.scheduled_entries ?? 0)}
              icon={ArrowUpRight}
              subtitle="Planejado na contabilidade"
            />
            <StatCard
              title="Saídas futuras lançadas"
              value={formatCurrency(overview?.analysis.scheduled_exits ?? 0)}
              icon={ArrowDownRight}
              subtitle={`Impacto líquido futuro: ${formatCurrency(overview?.analysis.net_scheduled ?? 0)}`}
            />
          </div>

          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <h3 className="font-semibold">Fecho mensal (snapshot auditável)</h3>
            <p className="text-sm text-muted-foreground">
              O fecho mensal guarda um retrato imutável do mês para auditoria e comparações históricas.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label>Mês de fecho</Label>
                <Input
                  type="month"
                  value={closeMonth}
                  onChange={(e) => setCloseMonth(e.target.value)}
                  className="mt-1 w-56"
                />
              </div>
              <Button
                type="button"
                disabled={createSnapshotMut.isPending || !closeMonth}
                onClick={() => createSnapshotMut.mutate({ month: closeMonth })}
              >
                {createSnapshotMut.isPending ? "A fechar..." : "Criar fecho mensal"}
              </Button>
            </div>

            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Mês</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Entradas</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Saídas</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Saldo final</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Criado por</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Data</th>
                    {canManageClosings && (
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">Ações</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {monthlySnapshots.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                        Nenhum fecho mensal criado ainda.
                      </td>
                    </tr>
                  ) : (
                    monthlySnapshots.map((s) => (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="px-3 py-2 font-medium">{s.month}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(s.total_entries)}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(s.total_exits)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{formatCurrency(s.consolidated_balance)}</td>
                        <td className="px-3 py-2">{s.created_by_name || "—"}</td>
                        <td className="px-3 py-2">{formatDate(s.created_at)}</td>
                        {canManageClosings && (
                          <td className="px-3 py-2 text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setReopenId(s.id)}
                            >
                              Reabrir
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <Dialog open={reopenId != null} onOpenChange={(o) => !o && setReopenId(null)}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Reabrir fecho mensal</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Isto vai anular o fecho e permitir criar um novo para o mesmo mês. Esta ação fica registada em auditoria.
                  </p>
                  <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                    <p>
                      <span className="text-muted-foreground">Mês:</span>{" "}
                      <span className="font-medium">
                        {reopenId ? (snapshotsById.get(reopenId)?.month ?? "—") : "—"}
                      </span>
                    </p>
                  </div>
                  <div>
                    <Label>Motivo (obrigatório)</Label>
                    <Input
                      className="mt-1"
                      value={reopenReason}
                      onChange={(e) => setReopenReason(e.target.value)}
                      placeholder="Ex: Ajuste de lançamento atrasado"
                    />
                  </div>
                  <div className="flex gap-2 justify-end pt-2">
                    <Button variant="outline" onClick={() => setReopenId(null)} type="button">
                      Cancelar
                    </Button>
                    <Button
                      variant="destructive"
                      type="button"
                      disabled={reopenSnapshotMut.isPending || !reopenReason.trim() || reopenId == null}
                      onClick={() => {
                        if (reopenId == null) return;
                        reopenSnapshotMut.mutate({ id: reopenId, reason: reopenReason.trim() });
                      }}
                    >
                      {reopenSnapshotMut.isPending ? "A reabrir..." : "Reabrir fecho"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <h3 className="font-semibold">Auditoria de fechos</h3>
            <p className="text-sm text-muted-foreground">
              Registo de reaberturas (quem, quando e porquê). Isto ajuda a manter a rastreabilidade e confiança no saldo auditável.
            </p>
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Mês</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Ação</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Motivo</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Utilizador</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshotAudit.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                        Nenhuma ação registada ainda.
                      </td>
                    </tr>
                  ) : (
                    snapshotAudit.map((a) => (
                      <tr key={a.id} className="border-b last:border-0">
                        <td className="px-3 py-2 font-medium">{a.snapshot_month}</td>
                        <td className="px-3 py-2">{a.action === "reopen" ? "Reabertura" : a.action}</td>
                        <td className="px-3 py-2">{a.reason || "—"}</td>
                        <td className="px-3 py-2">{a.user_name || "—"}</td>
                        <td className="px-3 py-2">{formatDate(a.created_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
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
