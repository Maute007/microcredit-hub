import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { QueryErrorAlert } from "@/components/QueryErrorAlert";
import { DataTable } from "@/components/DataTable";
import { PaymentStatusCell } from "@/components/PaymentStatusCell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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

function safeNum(x: unknown): number {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  return 0;
}

function MiniPaymentSparkline({ data, color }: { data: number[]; color: string }) {
  const valid = data.filter((v) => typeof v === "number" && Number.isFinite(v));
  if (valid.length === 0) return null;
  const max = Math.max(...valid, 1);
  const h = 28;
  const w = 120;
  const points = valid.map((v, i) => {
    const x = (i / Math.max(valid.length - 1, 1)) * w;
    const y = h - (v / max) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} className="mt-3 opacity-60" aria-hidden>
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
import {
  loansApi,
  paymentsApi,
  type ApiLoan,
  type ApiPayment,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Plus,
  CheckCircle,
  Clock,
  AlertTriangle,
  MoreHorizontal,
  Pencil,
  Trash2,
  ChevronsUpDown,
  HandCoins,
  Users,
  FileText,
} from "lucide-react";

const METHOD_LABELS: Record<string, string> = {
  transferencia: "Transferência",
  m_pesa: "M-Pesa",
  emola_mkesh: "eMola Mkesh",
  deposito: "Depósito",
  dinheiro: "Dinheiro",
  outro: "Outro",
};

const statusFilterOptions = [
  { value: "all", label: "Todos" },
  { value: "pago", label: "Pagos" },
  { value: "pendente", label: "Pendentes" },
  { value: "atrasado", label: "Atrasados" },
];

export default function PaymentsPage() {
  const location = useLocation();
  const state = location.state as { loanId?: number; status?: string } | null;
  const [showNew, setShowNew] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (state?.status === "atrasado") setStatusFilter("atrasado");
  }, [state?.status]);

  const [editingPayment, setEditingPayment] = useState<ApiPayment | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<ApiPayment | null>(null);

  const [selectedLoanId, setSelectedLoanId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [method, setMethod] = useState<
    | "transferencia"
    | "m_pesa"
    | "emola_mkesh"
    | "deposito"
    | "dinheiro"
    | "outro"
    | ""
  >("");
  const [methodOther, setMethodOther] = useState("");
  const [installment, setInstallment] = useState("");
  const [receipt, setReceipt] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [status, setStatus] = useState<
    "pago" | "pendente" | "atrasado" | ""
  >("");

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { canEditPayment, canDeletePayment } = usePermissions();

  const { data: allPayments = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["payments"],
    queryFn: () => paymentsApi.list(),
    placeholderData: (prev) => prev,
    staleTime: 5 * 60 * 1000,
  });

  const { data: summary } = useQuery({
    queryKey: ["payments-summary"],
    queryFn: () => paymentsApi.getSummary(),
    staleTime: 2 * 60 * 1000,
  });

  const payments = statusFilter === "all"
    ? allPayments
    : allPayments.filter((p) => p.status === statusFilter);

  const { data: loans = [], isLoading: loansLoading } = useQuery({
    queryKey: ["loans"],
    queryFn: () => loansApi.list({ page_size: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  // Ao selecionar empréstimo no novo pagamento, sugerir apenas a próxima parcela.
  useEffect(() => {
    if (!showNew || !selectedLoanId) return;
    const loan = loans.find((l) => String(l.id) === selectedLoanId);
    if (loan) {
      const nextInst = (loan.paid_installments ?? 0) + 1;
      setInstallment(String(nextInst));
    }
  }, [showNew, selectedLoanId, loans]);

  const invalidatePayments = () => {
    queryClient.invalidateQueries({ queryKey: ["payments"] });
    queryClient.invalidateQueries({ queryKey: ["payments-summary"] });
  };
  const invalidateLoans = () =>
    queryClient.invalidateQueries({ queryKey: ["loans"] });

  const createPayment = useMutation({
    mutationFn: paymentsApi.create,
    onSuccess: async () => {
      await invalidatePayments();
      await invalidateLoans();
      setShowNew(false);
      resetForm();
      toast({
        title: "Pagamento registado",
        description: "O pagamento foi registado com sucesso.",
      });
    },
    onError: (error: unknown) => {
      const msg =
        error &&
        typeof error === "object" &&
        "message" in error
          ? String((error as { message?: string }).message)
          : "Não foi possível registar o pagamento.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    },
  });

  const updatePayment = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof paymentsApi.update>[1] }) =>
      paymentsApi.update(id, payload),
    onSuccess: async () => {
      await invalidatePayments();
      await invalidateLoans();
      setEditingPayment(null);
      resetForm();
      toast({
        title: "Pagamento actualizado",
        description: "O pagamento foi actualizado com sucesso.",
      });
    },
    onError: (error: unknown) => {
      const msg =
        error &&
        typeof error === "object" &&
        "message" in error
          ? String((error as { message?: string }).message)
          : "Não foi possível actualizar o pagamento.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    },
  });

  const deletePayment = useMutation({
    mutationFn: paymentsApi.delete,
    onSuccess: async () => {
      await invalidatePayments();
      await invalidateLoans();
      setDeletingPayment(null);
      toast({
        title: "Pagamento eliminado",
        description: "O pagamento foi eliminado.",
      });
    },
    onError: (error: unknown) => {
      const msg =
        error &&
        typeof error === "object" &&
        "message" in error
          ? String((error as { message?: string }).message)
          : "Não foi possível eliminar o pagamento.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    },
  });

  function resetForm() {
    setSelectedLoanId("");
    setAmount("");
    setMethod("");
    setMethodOther("");
    setInstallment("");
    setReceipt("");
    setReceiptFile(null);
    setDate(new Date().toISOString().slice(0, 10));
    setStatus("");
  }

  function openEdit(p: ApiPayment) {
    setEditingPayment(p);
    setSelectedLoanId(String(p.loan));
    setAmount(String(p.amount));
    setDate(p.date);
    setMethod(p.method as any);
    setMethodOther(p.method_other ?? "");
    setInstallment(String(p.installment_number));
    setReceipt(p.receipt ?? "");
    setStatus(p.status);
  }

  const columns = [
    { key: "id", label: "ID" },
    {
      key: "loan",
      label: "Empréstimo",
      render: (p: ApiPayment) => {
        const lid = p.loan_id ?? p.loan;
        const client = p.loan_client_name ?? p.client_name;
        const falta = p.loan_remaining_balance;
        return (
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">#{lid} — {client}</span>
            {typeof falta === "number" && Number.isFinite(falta) && (
              <span className="text-xs text-muted-foreground">
                Falta {formatCurrency(falta)}
              </span>
            )}
          </div>
        );
      },
    },
    { key: "client_name", label: "Cliente" },
    {
      key: "installment_number",
      label: "Parcela",
      render: (p: ApiPayment) => `#${p.installment_number}`,
    },
    {
      key: "amount",
      label: "Valor",
      render: (p: ApiPayment) => (
        <span className="font-medium">{formatCurrency(p.amount)}</span>
      ),
    },
    {
      key: "method",
      label: "Método",
      render: (p: ApiPayment) => {
        const label = METHOD_LABELS[p.method] ?? p.method;
        return p.method === "outro" && p.method_other
          ? `${label}: ${p.method_other}`
          : label;
      },
    },
    {
      key: "status",
      label: "Status",
      render: (p: ApiPayment) => <PaymentStatusCell status={p.status} />,
    },
    {
      key: "date",
      label: "Data",
      render: (p: ApiPayment) => formatDate(p.date),
    },
    {
      key: "receipt",
      label: "Recibo",
      render: (p: ApiPayment) =>
        p.receipt_file ? (
          <a
            href={p.receipt_file}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Ver ficheiro
          </a>
        ) : p.receipt ? (
          <span className="text-muted-foreground">{p.receipt}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  const paid = allPayments.filter((p) => p.status === "pago");
  const pending = allPayments.filter((p) => p.status === "pendente");
  const overdue = allPayments.filter((p) => p.status === "atrasado");
  const totalPaidAmount = summary?.total_received ?? paid.reduce((s, p) => s + safeNum(p.amount), 0);
  const totalPendingAmount = summary?.total_pending ?? pending.reduce((s, p) => s + safeNum(p.amount), 0);
  const totalOverdueAmount = summary?.total_overdue ?? overdue.reduce((s, p) => s + safeNum(p.amount), 0);
  const receivedThisMonth = summary?.received_this_month ?? paid
    .filter((p) => p.date && p.date.startsWith(new Date().toISOString().slice(0, 7)))
    .reduce((s, p) => s + safeNum(p.amount), 0);

  const paidClients = summary?.clients_paid_count ?? (() => {
    const keys = new Set(paid.map((p) => (p.loan_client_name ?? p.client_name ?? `loan-${p.loan}`).trim()).filter(Boolean));
    return keys.size;
  })();
  const paidCount = summary?.paid_count ?? paid.length;
  const pendingCount = summary?.pending_count ?? pending.length;
  const overdueCount = summary?.overdue_count ?? overdue.length;
  const pendingClients = summary?.pending_clients_count ?? (() => {
    const keys = new Set(pending.map((p) => (p.loan_client_name ?? p.client_name ?? `loan-${p.loan}`).trim()).filter(Boolean));
    return keys.size;
  })();
  const overdueClients = summary?.overdue_clients_count ?? (() => {
    const keys = new Set(overdue.map((p) => (p.loan_client_name ?? p.client_name ?? `loan-${p.loan}`).trim()).filter(Boolean));
    return keys.size;
  })();
  const sparkReceived = summary?.spark_received ?? (() => {
    const arr: number[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const val = paid.filter((p) => p.date?.startsWith(ym)).reduce((s, p) => s + safeNum(p.amount), 0);
      arr.push(val);
    }
    return arr;
  })();
  const padSpark = (arr: number[]) =>
    arr.length >= 7 ? arr : [...Array(7 - arr.length).fill(0), ...arr];

  const showRowActions = canEditPayment || canDeletePayment;

  return (
    <div>
      {isError && (
        <div className="mb-4">
          <QueryErrorAlert onRetry={() => refetch()} />
        </div>
      )}
      <PageHeader
        title="Pagamentos"
        description={
          isLoading
            ? "A carregar pagamentos..."
            : "Parcelas e recebimentos dos empréstimos"
        }
        actions={
          <Dialog open={showNew} onOpenChange={setShowNew}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Registrar Pagamento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md" aria-describedby={undefined}>
              <DialogHeader>
                <DialogTitle>Registrar Pagamento</DialogTitle>
              </DialogHeader>
              {loansLoading ? (
                <p className="text-sm text-muted-foreground py-4">A carregar empréstimos...</p>
              ) : (
              <>
              <PaymentForm
                loans={loans}
                selectedLoanId={selectedLoanId}
                setSelectedLoanId={setSelectedLoanId}
                amount={amount}
                setAmount={setAmount}
                date={date}
                setDate={setDate}
                method={method}
                setMethod={setMethod}
                methodOther={methodOther}
                setMethodOther={setMethodOther}
                installment={installment}
                setInstallment={setInstallment}
                receipt={receipt}
                setReceipt={setReceipt}
                receiptFile={receiptFile}
                setReceiptFile={setReceiptFile}
                isEdit={false}
              />
              <Button
                className="w-full"
                disabled={
                  createPayment.isLoading ||
                  !selectedLoanId ||
                  !amount.trim() ||
                  !date ||
                  !method ||
                  !installment.trim() ||
                  (method === "outro" && !methodOther.trim())
                }
                onClick={() => {
                  const loan = parseInt(selectedLoanId, 10);
                  const amt = parseFloat(amount) || 0;
                  const inst = parseInt(installment, 10) || 1;
                  createPayment.mutate({
                    loan,
                    amount: amt,
                    date,
                    status: "pago",
                    method: method as any,
                    method_other: method === "outro" ? methodOther.trim() : undefined,
                    installment_number: inst,
                    receipt: receipt || undefined,
                    receipt_file: receiptFile ?? undefined,
                  });
                }}
              >
                {createPayment.isLoading ? "A guardar..." : "Registrar Pagamento"}
              </Button>
              </>
              )}
            </DialogContent>
          </Dialog>
        }
      />

      {/* Cards: Total Recebido, Pendente, Atrasado — dados reais de parcelas de empréstimos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Total Recebido */}
        <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-success/10 to-success/5 border-success/25 p-5 transition-shadow hover:shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-success/80">
                Total Recebido
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight">
                {formatCurrency(totalPaidAmount)}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5 text-success/70" />
                  <strong className="text-foreground/90">{paidClients}</strong> cliente{paidClients !== 1 ? "s" : ""}
                </span>
                <span className="text-muted-foreground/70">•</span>
                <span className="inline-flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5 text-success/70" />
                  <strong className="text-foreground/90">{paidCount}</strong> parcela{paidCount !== 1 ? "s" : ""}
                </span>
              </div>
              {receivedThisMonth > 0 && (
                <p className="mt-1.5 text-[11px] font-medium text-success">
                  {formatCurrency(receivedThisMonth)} este mês
                </p>
              )}
            </div>
            <div className="rounded-xl bg-success/15 p-2.5 shrink-0">
              <CheckCircle className="h-5 w-5 text-success" />
            </div>
          </div>
          {padSpark(sparkReceived).some((v) => v > 0) && (
            <MiniPaymentSparkline data={padSpark(sparkReceived)} color="hsl(var(--success))" />
          )}
        </div>

        {/* Total Pendente */}
        <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-warning/10 to-warning/5 border-warning/25 p-5 transition-shadow hover:shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-warning/80">
                Total Pendente
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight">
                {formatCurrency(totalPendingAmount)}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5 text-warning/70" />
                  <strong className="text-foreground/90">{pendingClients}</strong> cliente{pendingClients !== 1 ? "s" : ""}
                </span>
                <span className="text-muted-foreground/70">•</span>
                <span className="inline-flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5 text-warning/70" />
                  <strong className="text-foreground/90">{pendingCount}</strong> parcela{pendingCount !== 1 ? "s" : ""}
                </span>
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                A receber
              </p>
            </div>
            <div className="rounded-xl bg-warning/15 p-2.5 shrink-0">
              <Clock className="h-5 w-5 text-warning" />
            </div>
          </div>
        </div>

        {/* Total Atrasado — valor que já devia ter entrado */}
        <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/25 p-5 transition-shadow hover:shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-destructive/80">
                Total Atrasado
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight">
                {formatCurrency(totalOverdueAmount)}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5 text-destructive/70" />
                  <strong className="text-foreground/90">{overdueClients}</strong> cliente{overdueClients !== 1 ? "s" : ""}
                </span>
                <span className="text-muted-foreground/70">•</span>
                <span className="inline-flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5 text-destructive/70" />
                  <strong className="text-foreground/90">{overdueCount}</strong> parcela{overdueCount !== 1 ? "s" : ""}
                </span>
              </div>
              <p className="mt-1.5 text-[11px] font-medium text-destructive/90">
                Já devia ter entrado
              </p>
            </div>
            <div className="rounded-xl bg-destructive/15 p-2.5 shrink-0">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
          </div>
        </div>
      </div>

      <DataTable
        data={payments}
        columns={columns}
        searchKeys={["client_name", "loan", "method"]}
        loading={isLoading}
        pageSize={10}
        getRowClassName={(p) =>
          (p as ApiPayment).status === "atrasado"
            ? "bg-red-50/95 dark:bg-red-950/50 border-l-4 border-l-red-500 text-red-900 dark:text-red-100 [&_td]:font-medium hover:bg-red-100/90 dark:hover:bg-red-950/60"
            : undefined
        }
        filterConfig={{
          key: "status",
          placeholder: "Status",
          options: statusFilterOptions,
        }}
        filterValue={statusFilter}
        onFilterChange={setStatusFilter}
        renderRowActions={
          showRowActions
            ? (p) => (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    {canEditPayment && (
                      <DropdownMenuItem onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                    )}
                    {canDeletePayment && (
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeletingPayment(p)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )
            : undefined
        }
      />

      <Dialog open={!!editingPayment} onOpenChange={(o) => !o && setEditingPayment(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Pagamento</DialogTitle>
          </DialogHeader>
          {editingPayment && (
            <>
              <PaymentForm
                loans={loans}
                selectedLoanId={selectedLoanId}
                setSelectedLoanId={setSelectedLoanId}
                amount={amount}
                setAmount={setAmount}
                date={date}
                setDate={setDate}
                method={method}
                setMethod={setMethod}
                methodOther={methodOther}
                setMethodOther={setMethodOther}
                installment={installment}
                setInstallment={setInstallment}
                receipt={receipt}
                setReceipt={setReceipt}
                receiptFile={null}
                setReceiptFile={() => {}}
                status={status}
                setStatus={setStatus}
                isEdit={true}
              />
              <Button
                className="w-full"
                disabled={
                  updatePayment.isLoading ||
                  !amount.trim() ||
                  !date ||
                  !method ||
                  !installment.trim() ||
                  !status ||
                  (method === "outro" && !methodOther.trim())
                }
                onClick={() => {
                  const amt = parseFloat(amount) || 0;
                  const inst = parseInt(installment, 10) || 1;
                  updatePayment.mutate({
                    id: editingPayment.id,
                    payload: {
                      amount: amt,
                      date,
                      status: status as "pago" | "pendente" | "atrasado",
                      method: method as any,
                      method_other: method === "outro" ? methodOther.trim() : undefined,
                      installment_number: inst,
                      receipt: receipt || undefined,
                    },
                  });
                }}
              >
                {updatePayment.isLoading ? "A guardar..." : "Guardar alterações"}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deletingPayment}
        onOpenChange={(o) => !o && setDeletingPayment(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar pagamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acção não pode ser revertida. O pagamento será removido
              permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deletingPayment && deletePayment.mutate(deletingPayment.id)
              }
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface PaymentFormProps {
  loans: ApiLoan[];
  selectedLoanId: string;
  setSelectedLoanId: (v: string) => void;
  amount: string;
  setAmount: (v: string) => void;
  date: string;
  setDate: (v: string) => void;
  method: string;
  setMethod: (v: string) => void;
  methodOther: string;
  setMethodOther: (v: string) => void;
  installment: string;
  setInstallment: (v: string) => void;
  receipt: string;
  setReceipt: (v: string) => void;
  receiptFile?: File | null;
  setReceiptFile?: (f: File | null) => void;
  status?: string;
  setStatus?: (v: string) => void;
  isEdit: boolean;
}

function LoanCombobox({
  loans,
  value,
  onSelect,
  disabled,
  placeholder = "Pesquisar ou selecionar empréstimo...",
}: {
  loans: ApiLoan[];
  value: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const filtered = loans.filter((l) => l.status !== "pago");
  const selected = filtered.find((l) => String(l.id) === value);

  if (disabled) {
    return (
      <div className="flex h-10 w-full items-center rounded-md border bg-muted px-3 py-2 text-sm">
        {selected ? (
          <span>
            #{selected.id} — {selected.client_name} ({formatCurrency(selected.monthly_payment)})
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selected ? (
            <span className="truncate">
              #{selected.id} — {selected.client_name} ({formatCurrency(selected.monthly_payment)})
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Escreva o nome do cliente ou ID..." />
          <CommandList>
            <CommandEmpty>Nenhum empréstimo encontrado.</CommandEmpty>
            <CommandGroup>
              {filtered.map((loan) => (
                <CommandItem
                  key={loan.id}
                  value={`${loan.id} ${loan.client_name}`}
                  onSelect={() => {
                    onSelect(String(loan.id));
                    setOpen(false);
                  }}
                >
                  <span className="truncate">
                    #{loan.id} — {loan.client_name} ({formatCurrency(loan.monthly_payment)})
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function PaymentForm({
  loans,
  selectedLoanId,
  setSelectedLoanId,
  amount,
  setAmount,
  date,
  setDate,
  method,
  setMethod,
  methodOther,
  setMethodOther,
  installment,
  setInstallment,
  receipt,
  setReceipt,
  receiptFile,
  setReceiptFile,
  status = "",
  setStatus,
  isEdit,
}: PaymentFormProps) {
  const selectedLoan = selectedLoanId
    ? loans.find((l) => String(l.id) === selectedLoanId)
    : null;
  const loanTotal = selectedLoan ? safeNum(selectedLoan.total_amount) : 0;
  const loanRemaining = selectedLoan ? safeNum(selectedLoan.remaining_balance) : 0;
  const loanPaid = selectedLoan ? (selectedLoan.paid_installments ?? 0) : 0;
  const loanTerm = selectedLoan ? (selectedLoan.term ?? 0) : 0;
  const loanMonthly = selectedLoan ? safeNum(selectedLoan.monthly_payment) : 0;

  return (
    <div className="space-y-4">
      <div>
        <Label>Empréstimo</Label>
        <LoanCombobox
          loans={loans}
          value={selectedLoanId}
          onSelect={setSelectedLoanId}
          disabled={isEdit}
        />
      </div>
      {selectedLoan && !isEdit && (
        <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
          <p className="text-sm font-medium text-foreground">Resumo do empréstimo</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <span className="text-muted-foreground">Total:</span>
            <span className="font-medium">{formatCurrency(loanTotal)}</span>
            <span className="text-muted-foreground">Já pago:</span>
            <span className="font-medium">{formatCurrency(loanTotal - loanRemaining)}</span>
            <span className="text-muted-foreground">Falta:</span>
            <span className="font-medium text-amber-600 dark:text-amber-400">{formatCurrency(loanRemaining)}</span>
            <span className="text-muted-foreground">Parcelas:</span>
            <span className="font-medium">{loanPaid} / {loanTerm}</span>
            <span className="text-muted-foreground">Prestação mensal:</span>
            <span className="font-medium">{formatCurrency(loanMonthly)}</span>
          </div>
          <p className="text-xs text-muted-foreground pt-1">
            A parcela é sugerida automaticamente. O valor pode ser qualquer montante válido até ao máximo devido.
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Valor (MT)</Label>
          <Input
            type="number"
            placeholder="Valor do pagamento"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div>
          <Label>Data</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Método de Pagamento</Label>
          <Select
            value={method || "__none__"}
            onValueChange={(v) => {
              const val = v === "__none__" ? "" : v;
              setMethod(val);
              if (val !== "outro") setMethodOther("");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecionar método" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__" className="hidden">
                Selecionar método
              </SelectItem>
              <SelectItem value="transferencia">Transferência Bancária</SelectItem>
              <SelectItem value="m_pesa">M-Pesa</SelectItem>
              <SelectItem value="emola_mkesh">eMola Mkesh</SelectItem>
              <SelectItem value="deposito">Depósito Bancário</SelectItem>
              <SelectItem value="dinheiro">Dinheiro</SelectItem>
              <SelectItem value="outro">Outro (especifique)</SelectItem>
            </SelectContent>
          </Select>
          {method === "outro" && (
            <Input
              className="mt-2"
              placeholder="Especifique o método de pagamento"
              value={methodOther}
              onChange={(e) => setMethodOther(e.target.value)}
            />
          )}
        </div>
        <div>
          <Label>Parcela (nº)</Label>
          <Input
            type="number"
            placeholder="Ex: 7"
            value={installment}
            onChange={(e) => setInstallment(e.target.value)}
          />
        </div>
      </div>
      {isEdit && setStatus && (
        <div>
          <Label>Status</Label>
          <Select
            value={status || "__none__"}
            onValueChange={(v) => setStatus(v === "__none__" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__" className="hidden">
                Status
              </SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="atrasado">Atrasado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-2">
        <Label>Recibo / Comprovativo (opcional)</Label>
        {!isEdit && setReceiptFile ? (
          <>
            <Input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
            />
            {receiptFile && (
              <p className="text-xs text-muted-foreground">
                Ficheiro: {receiptFile.name}
              </p>
            )}
            <Input
              placeholder="Referência do recibo (opcional)"
              value={receipt}
              onChange={(e) => setReceipt(e.target.value)}
            />
          </>
        ) : (
          <Input
            placeholder="Referência do recibo, ex: REC-001"
            value={receipt}
            onChange={(e) => setReceipt(e.target.value)}
          />
        )}
      </div>
      {!isEdit && (
        <div className="bg-info/5 border border-info/20 rounded-lg p-3 text-sm">
          <p className="font-medium text-info">Actualização automática</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ao registrar o pagamento, o saldo devedor do empréstimo será
            actualizado automaticamente.
          </p>
        </div>
      )}
    </div>
  );
}
