import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { QueryErrorAlert } from "@/components/QueryErrorAlert";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { StatCard } from "@/components/StatCard";
import { formatCurrency, formatDate } from "@/data/mockData";
import { loansApi, clientsApi, loanCategoriesApi, type ApiLoan, type ApiClient, type ApiLoanCategory } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { Plus, Calculator, FileText, Printer, Table, ScrollText, ShieldCheck, MoreHorizontal, Pencil, Trash2, Wallet, AlertTriangle, TrendingUp, Banknote, Tag, Calendar, Percent, Shield } from "lucide-react";
import type { ApiCollateral } from "@/lib/api";

const COLLATERAL_TYPES: { value: string; label: string }[] = [
  { value: "documento", label: "Documento" },
  { value: "eletronico", label: "Eletrónico" },
  { value: "veiculo", label: "Veículo" },
  { value: "imovel", label: "Imóvel" },
  { value: "joias", label: "Joias/Ourivesaria" },
  { value: "maquinaria", label: "Maquinaria/Equipamento" },
  { value: "outro", label: "Outro" },
];

const COLLATERAL_CONDITIONS: { value: string; label: string }[] = [
  { value: "novo", label: "Novo" },
  { value: "bom", label: "Bom estado" },
  { value: "usado", label: "Usado" },
  { value: "danificado", label: "Danificado" },
  { value: "não_aplicavel", label: "Não aplicável" },
];

function formatCollateralForContract(c: ApiCollateral | null | undefined): string {
  if (!c) return "Nenhum item de garantia registado.";
  const lines = [
    `• Descrição: ${c.description}`,
    `• Tipo: ${COLLATERAL_TYPES.find((t) => t.value === c.item_type)?.label ?? c.item_type}`,
  ];
  if (c.estimated_value) lines.push(`• Valor estimado: ${formatCurrency(c.estimated_value)}`);
  if (c.condition && c.condition !== "não_aplicavel")
    lines.push(`• Estado: ${COLLATERAL_CONDITIONS.find((x) => x.value === c.condition)?.label ?? c.condition}`);
  if (c.serial_number) lines.push(`• Identificação/Nº série: ${c.serial_number}`);
  if (c.notes) lines.push(`• Observações: ${c.notes}`);
  return lines.join("\n");
}

function buildContractText(loan: ApiLoan): string {
  const freqText =
    loan.category_frequency_days && loan.category_frequency_days > 0
      ? `Pagamentos com frequência aproximada de ${loan.category_frequency_days} dia(s).`
      : "Pagamentos em prestações conforme plano acordado.";

  const garantiaText = (() => {
    if (!loan.category_name) return "";
    const grace =
      loan.category_collateral_grace_days && loan.category_collateral_grace_days > 0
        ? `Se o atraso ultrapassar ${loan.category_collateral_grace_days} dia(s) sem regularização, a CREDORA poderá executar a garantia conforme a legislação em vigor.`
        : "";
    const keep =
      loan.category_require_interest_paid_to_keep_collateral
        ? "Enquanto o(a) DEVEDOR(A) liquidar pelo menos os juros em cada período, a garantia não será perdida, mesmo que o principal ainda esteja em aberto."
        : "";
    return [
      `Categoria de Empréstimo: ${loan.category_name} (${loan.category_code ?? "sem código"})`,
      freqText,
      keep,
      grace,
    ]
      .filter(Boolean)
      .join("\n");
  })();

  return `MicroCrédito S.A.
CONTRATO DE CRÉDITO Nº ${loan.id}

Pelo presente contrato, a empresa MicroCrédito S.A., com sede em Maputo, Moçambique, doravante designada CREDORA, concede ao(à) cliente ${loan.client_name}, doravante designado(a) DEVEDOR(A), um empréstimo nas seguintes condições:

• Valor do Empréstimo: ${formatCurrency(loan.amount)}
• Taxa de Juros: ${loan.interest_rate}% ao mês
• Número de Parcelas: ${loan.term}
• Valor da Parcela: ${formatCurrency(loan.monthly_payment)}
• Valor Total: ${formatCurrency(loan.total_amount)}
• Data de Início: ${formatDate(loan.start_date)}
• Data de Término: ${formatDate(loan.end_date)}

${garantiaText ? `\nCondições específicas da categoria:\n${garantiaText}\n` : ""}

Item de Garantia (deixado em custódia pelo DEVEDOR):
${formatCollateralForContract(loan.collateral)}

CLÁUSULA 1ª — O(A) DEVEDOR(A) compromete-se a pagar as parcelas mensais na data estipulada.
CLÁUSULA 2ª — Em caso de atraso, será aplicada uma multa de 2% sobre o valor da parcela em atraso.
CLÁUSULA 3ª — O pagamento antecipado é permitido sem penalidades adicionais.
CLÁUSULA 4ª — Este contrato é regido pela legislação moçambicana.

_________________________          _________________________
CREDORA — MicroCrédito S.A.        DEVEDOR(A) — ${loan.client_name}`;
}

function ContractTab({
  loan,
  contractText,
  setContractText,
}: {
  loan: ApiLoan;
  contractText: string;
  setContractText: (v: string) => void;
}) {
  useEffect(() => {
    setContractText(buildContractText(loan));
  }, [loan.id]);

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      window.print();
      return;
    }
    const escaped = contractText.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>Contrato Nº ${loan.id}</title>
      <style>body{font-family:system-ui,sans-serif;padding:2rem;max-width:60ch;margin:0 auto;white-space:pre-wrap;}</style></head>
      <body><pre>${escaped}</pre></body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  return (
    <div className="border rounded-lg p-6 space-y-4 bg-card">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Edite o texto conforme necessário antes da emissão. Dados reais do empréstimo foram preenchidos da base de dados.
        </p>
        <Button variant="outline" size="sm" onClick={() => setContractText(buildContractText(loan))} type="button">
          Restaurar template
        </Button>
      </div>
      <Textarea
        value={contractText}
        onChange={(e) => setContractText(e.target.value)}
        className="min-h-[320px] font-mono text-sm whitespace-pre-wrap"
        placeholder="A carregar contrato..."
      />
      <div className="flex gap-2 pt-2">
        <Button variant="outline" className="flex-1" onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-1.5" />Imprimir
        </Button>
        <Button className="flex-1" onClick={handlePrint}>
          <FileText className="h-4 w-4 mr-1.5" />Guardar como PDF
        </Button>
      </div>
    </div>
  );
}

function LoanCategoryForm({
  initial,
  onSubmit,
  loading,
  submitLabel = "Criar",
}: {
  initial?: ApiLoanCategory;
  onSubmit: (payload: {
    name: string;
    code: string;
    description?: string;
    min_amount?: number;
    max_amount?: number | null;
    frequency_days: number;
    min_term_days: number;
    max_term_days: number;
    min_installments: number;
    max_installments: number;
    default_interest_rate: number;
    default_term_months: number;
    collateral_grace_days: number;
    require_interest_paid_to_keep_collateral: boolean;
    late_interest_rate?: number;
    max_late_interest_months?: number;
    is_active?: boolean;
  }) => void;
  loading: boolean;
  submitLabel?: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(
    initial?.code ?? `CAT-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [minAmount, setMinAmount] = useState(
    initial?.min_amount != null ? String(initial.min_amount) : "0",
  );
  const [maxAmount, setMaxAmount] = useState(
    initial?.max_amount != null ? String(initial.max_amount) : "",
  );
  const [frequencyDays, setFrequencyDays] = useState(String(initial?.frequency_days ?? 30));
  const [minTermDays, setMinTermDays] = useState(String(initial?.min_term_days ?? 30));
  const [maxTermDays, setMaxTermDays] = useState(String(initial?.max_term_days ?? 365));
  const [minInstallments, setMinInstallments] = useState(String(initial?.min_installments ?? 1));
  const [maxInstallments, setMaxInstallments] = useState(String(initial?.max_installments ?? 12));
  const [defaultInterest, setDefaultInterest] = useState(
    initial?.default_interest_rate != null ? String(initial.default_interest_rate) : "0",
  );
  const [defaultTermMonths, setDefaultTermMonths] = useState(
    initial?.default_term_months != null ? String(initial.default_term_months) : "12",
  );
  const [lateInterestRate, setLateInterestRate] = useState(
    initial?.late_interest_rate != null ? String(initial.late_interest_rate) : "0",
  );
  const [maxLateInterestMonths, setMaxLateInterestMonths] = useState(
    String(initial?.max_late_interest_months ?? 12),
  );
  const [collateralGraceDays, setCollateralGraceDays] = useState(
    String(initial?.collateral_grace_days ?? 60),
  );
  const [keepOnInterest, setKeepOnInterest] = useState(
    initial?.require_interest_paid_to_keep_collateral ?? true,
  );
  const [active, setActive] = useState(initial?.is_active ?? true);

  const submitPayload = () => ({
    name: name.trim(),
    code: code.trim(),
    description: description.trim() || undefined,
    min_amount: parseFloat(minAmount) || 0,
    max_amount: maxAmount.trim() ? parseFloat(maxAmount) || null : null,
    frequency_days: Math.max(1, parseInt(frequencyDays, 10) || 30),
    min_term_days: Math.max(1, parseInt(minTermDays, 10) || 30),
    max_term_days: Math.max(
      parseInt(minTermDays, 10) || 30,
      parseInt(maxTermDays, 10) || 365,
    ),
    min_installments: Math.max(1, parseInt(minInstallments, 10) || 1),
    max_installments: Math.max(
      parseInt(minInstallments, 10) || 1,
      parseInt(maxInstallments, 10) || 12,
    ),
    default_interest_rate: Math.max(0, parseFloat(defaultInterest) || 0),
    default_term_months: Math.max(1, parseInt(defaultTermMonths, 10) || 12),
    late_interest_rate: parseFloat(lateInterestRate) || 0,
    max_late_interest_months: Math.max(0, parseInt(maxLateInterestMonths, 10) || 12),
    collateral_grace_days: Math.max(0, parseInt(collateralGraceDays, 10) || 0),
    require_interest_paid_to_keep_collateral: keepOnInterest,
    is_active: active,
  });

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(submitPayload());
      }}
    >
      <Tabs defaultValue="basico" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1 rounded-lg h-auto">
          <TabsTrigger value="basico" className="gap-1.5 py-2">
            <Tag className="h-3.5 w-3.5" />
            Básico
          </TabsTrigger>
          <TabsTrigger value="prazo" className="gap-1.5 py-2">
            <Calendar className="h-3.5 w-3.5" />
            Prazo & Juros
          </TabsTrigger>
          <TabsTrigger value="garantia" className="gap-1.5 py-2">
            <Shield className="h-3.5 w-3.5" />
            Garantia
          </TabsTrigger>
        </TabsList>
        <TabsContent value="basico" className="mt-4 space-y-4">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <Label>Nome</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Mensal padrão, Quinzenal"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="flex items-center justify-between">
                  Código
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() =>
                      setCode(`CAT-${Math.random().toString(36).slice(2, 6).toUpperCase()}`)
                    }
                  >
                    Gerar
                  </button>
                </Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="CAT-8F3K"
                  required
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Para que serve este tipo de empréstimo..."
                className="mt-1 resize-none"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
              <div>
                <Label>Montante mínimo (MT)</Label>
                <Input
                  type="number"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  min={0}
                  placeholder="0"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Aplica-se a empréstimos &gt;= este valor.
                </p>
              </div>
              <div>
                <Label>Montante máximo (MT)</Label>
                <Input
                  type="number"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  min={0}
                  placeholder="Sem limite"
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="prazo" className="mt-4 space-y-4">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>Frequência (dias)</Label>
                <Input
                  type="number"
                  value={frequencyDays}
                  onChange={(e) => setFrequencyDays(e.target.value)}
                  min={1}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">30=mensal, 15=quinzenal</p>
              </div>
              <div>
                <Label>Prazo min (dias)</Label>
                <Input
                  type="number"
                  value={minTermDays}
                  onChange={(e) => setMinTermDays(e.target.value)}
                  min={1}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Prazo máx (dias)</Label>
                <Input
                  type="number"
                  value={maxTermDays}
                  onChange={(e) => setMaxTermDays(e.target.value)}
                  min={1}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <Label>Parcelas min</Label>
                <Input
                  type="number"
                  value={minInstallments}
                  onChange={(e) => setMinInstallments(e.target.value)}
                  min={1}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Parcelas máx</Label>
                <Input
                  type="number"
                  value={maxInstallments}
                  onChange={(e) => setMaxInstallments(e.target.value)}
                  min={1}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Juros padrão (%)</Label>
                <Input
                  type="number"
                  value={defaultInterest}
                  onChange={(e) => setDefaultInterest(e.target.value)}
                  min={0}
                  step={0.5}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">Sugerido ao criar empréstimo</p>
              </div>
              <div>
                <Label>Prazo padrão (meses)</Label>
                <Input
                  type="number"
                  value={defaultTermMonths}
                  onChange={(e) => setDefaultTermMonths(e.target.value)}
                  min={1}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
              <div>
                <Label className="flex items-center gap-1.5">
                  <Percent className="h-3.5 w-3.5" />
                  Juros de mora (%/mês)
                </Label>
                <Input
                  type="number"
                  value={lateInterestRate}
                  onChange={(e) => setLateInterestRate(e.target.value)}
                  min={0}
                  step={0.5}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Máx. meses de mora</Label>
                <Input
                  type="number"
                  value={maxLateInterestMonths}
                  onChange={(e) => setMaxLateInterestMonths(e.target.value)}
                  min={0}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="garantia" className="mt-4 space-y-4">
          <div className="space-y-4">
            <div>
              <Label>Tolerância garantia (dias)</Label>
              <Input
                type="number"
                value={collateralGraceDays}
                onChange={(e) => setCollateralGraceDays(e.target.value)}
                min={0}
                className="mt-1 max-w-[200px]"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Dias de atraso antes de poder executar o bem.
              </p>
            </div>
            <div className="flex flex-col gap-3 pt-2">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={keepOnInterest}
                  onChange={(e) => setKeepOnInterest(e.target.checked)}
                  className="rounded border-input"
                />
                <span className="text-sm">Manter garantia se pagar pelo menos os juros em cada período</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="rounded border-input"
                />
                <span className="text-sm font-medium">Categoria activa (disponível ao criar empréstimo)</span>
              </label>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      <div className="flex justify-end pt-4 border-t">
        <Button type="submit" disabled={loading}>
          {loading ? "A guardar..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function safeNum(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : parseFloat(String(v ?? "")) || 0;
}

const columns = [
  { key: "id", label: "ID" },
  { key: "client_name", label: "Cliente" },
  { key: "amount", label: "Valor", render: (l: ApiLoan) => <span className="font-medium">{formatCurrency(l.amount)}</span> },
  { key: "interest_rate", label: "Juros", render: (l: ApiLoan) => `${l.interest_rate}%` },
  { key: "term", label: "Prazo", render: (l: ApiLoan) => `${l.term} meses` },
  { key: "monthly_payment", label: "Parcela", render: (l: ApiLoan) => formatCurrency(l.monthly_payment) },
  {
    key: "progress",
    label: "Progresso",
    render: (l: ApiLoan) => {
      const paid = safeNum(l.paid_installments);
      const total = Math.max(1, safeNum(l.term));
      const pct = Math.min(100, (paid / total) * 100);
      const isComplete = l.status === "pago";
      const hasStarted = paid > 0;
      return (
        <div className="flex items-center gap-2">
          <div className="w-14 h-2 bg-muted rounded-full overflow-hidden shrink-0">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isComplete ? "bg-emerald-500" : l.status === "atrasado" ? "bg-rose-500" : "bg-primary"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className={`text-xs font-medium ${hasStarted ? "text-foreground" : "text-muted-foreground"}`}>
            {paid}/{total}
          </span>
        </div>
      );
    },
  },
  { key: "remaining_balance", label: "Saldo Devedor", render: (l: ApiLoan) => <span className="font-medium">{formatCurrency(l.remaining_balance)}</span> },
  { key: "status", label: "Status", render: (l: ApiLoan) => <StatusBadge status={l.status} /> },
];

export default function LoansPage() {
  const [showNew, setShowNew] = useState(false);
  const [showCatDialog, setShowCatDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ApiLoanCategory | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<ApiLoan | null>(null);
  const [editingLoan, setEditingLoan] = useState<ApiLoan | null>(null);
  const [deletingLoan, setDeletingLoan] = useState<ApiLoan | null>(null);
  const [contractText, setContractText] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("none");
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState("");
  const [term, setTerm] = useState("");
  const [hasCollateral, setHasCollateral] = useState(true);
  const [collateral, setCollateral] = useState({
    description: "",
    item_type: "documento" as const,
    estimated_value: "",
    condition: "não_aplicavel" as const,
    serial_number: "",
    notes: "",
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { canEditLoan, canDeleteLoan, canAddLoan, canManageLoanCategories, canAddLoanCategory, canChangeLoanCategory, canDeleteLoanCategory } = usePermissions();

  const { data: loans, isLoading, isError, refetch } = useQuery({
    queryKey: ["loans"],
    queryFn: loansApi.list,
    staleTime: 5 * 60 * 1000,
  });

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: clientsApi.list,
    staleTime: 5 * 60 * 1000,
  });

  const { data: categories = [] } = useQuery<ApiLoanCategory[]>({
    queryKey: ["loan-categories"],
    queryFn: () => loanCategoriesApi.list(),
    staleTime: 10 * 60 * 1000,
  });

  const amt = parseFloat(amount) || 0;
  const { data: suggestedCategories = [] } = useQuery<ApiLoanCategory[]>({
    queryKey: ["loan-category-suggest", amt],
    queryFn: () => loanCategoriesApi.suggestByAmount(amt),
    enabled: showNew && amt > 0,
  });

  useEffect(() => {
    if (showNew && suggestedCategories.length > 0 && amt > 0) {
      const first = suggestedCategories[0];
      setSelectedCategoryId(String(first.id));
    }
  }, [showNew, suggestedCategories, amt]);

  const { data: amortizationRows = [] } = useQuery({
    queryKey: ["loan-amortization", selectedLoan?.id],
    queryFn: () => (selectedLoan ? loansApi.amortization(selectedLoan.id) : Promise.resolve([])),
    enabled: !!selectedLoan,
  });

  const updateLoan = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof loansApi.update>[1] }) =>
      loansApi.update(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["loans"] });
      setEditingLoan(null);
      toast({ title: "Empréstimo actualizado", description: "As alterações foram guardadas." });
    },
    onError: (error: unknown) => {
      const msg = error && typeof error === "object" && "message" in error
        ? String((error as { message?: string }).message)
        : "Não foi possível actualizar o empréstimo.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    },
  });

  const deleteLoan = useMutation({
    mutationFn: loansApi.delete,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["loans"] });
      setDeletingLoan(null);
      setSelectedLoan(null);
      toast({ title: "Empréstimo eliminado", description: "O empréstimo foi removido." });
    },
    onError: (error: unknown) => {
      const msg = error && typeof error === "object" && "message" in error
        ? String((error as { message?: string }).message)
        : "Não foi possível eliminar o empréstimo.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    },
  });

  const createLoan = useMutation({
    mutationFn: loansApi.create,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["loans"] });
      setShowNew(false);
      setSelectedClientId("");
      setAmount("");
      setRate("");
      setTerm("");
      setHasCollateral(true);
      setCollateral({ description: "", item_type: "documento", estimated_value: "", condition: "não_aplicavel", serial_number: "", notes: "" });
      toast({ title: "Empréstimo criado", description: "O empréstimo foi registado com sucesso." });
    },
    onError: (error: unknown) => {
      const msg =
        error && typeof error === "object" && "message" in error
          ? String((error as any).message)
          : "Não foi possível criar o empréstimo.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    },
  });

  const createCategory = useMutation({
    mutationFn: loanCategoriesApi.create,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["loan-categories"] });
      setShowCatDialog(false);
      toast({ title: "Categoria criada", description: "A categoria de empréstimo foi criada com sucesso." });
    },
    onError: (error: unknown) => {
      const msg =
        error && typeof error === "object" && "message" in error
          ? String((error as any).message)
          : "Não foi possível criar a categoria.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    },
  });

  const updateCategory = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Omit<ApiLoanCategory, "id">> }) =>
      loanCategoriesApi.update(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["loan-categories"] });
      setEditingCategory(null);
      toast({ title: "Categoria actualizada", description: "As alterações foram guardadas." });
    },
    onError: (error: unknown) => {
      const msg =
        error && typeof error === "object" && "message" in error
          ? String((error as any).message)
          : "Não foi possível actualizar a categoria.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    },
  });

  const deleteCategory = useMutation({
    mutationFn: loanCategoriesApi.delete,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["loan-categories"] });
      toast({ title: "Categoria eliminada", description: "A categoria foi removida." });
    },
    onError: (error: unknown) => {
      const msg =
        error && typeof error === "object" && "message" in error
          ? String((error as any).message)
          : "Não foi possível eliminar a categoria.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    },
  });

  const deleteCategoryMutate = (id: number) => {
    deleteCategory.mutate(id);
  };

  // Quando o utilizador escolhe uma categoria, sugerir automaticamente juros e prazo
  useEffect(() => {
    if (!selectedCategoryId || selectedCategoryId === "none") return;
    const cat = categories.find((c) => String(c.id) === selectedCategoryId);
    if (!cat) return;

    // Preencher apenas se ainda estiver vazio ou com zero, para não atropelar edição manual
    if (!rate.trim() || parseFloat(rate) === 0) {
      setRate(String(cat.default_interest_rate ?? 0));
    }
    if (!term.trim() || parseInt(term, 10) === 0) {
      setTerm(String(cat.default_term_months ?? 12));
    }
  }, [selectedCategoryId, categories]);

  const calcPayment = () => {
    const a = parseFloat(amount) || 0;
    const r = parseFloat(rate) || 0;
    const t = parseInt(term) || 1;
    const interest = a * (r / 100) * (t / 12);
    const total = a + interest;
    return { monthly: total / t, total, interest };
  };
  const calc = calcPayment();

  const loansList = loans ?? [];
  const loansOpen = loansList.filter((l) => l.status !== "pago");
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : parseFloat(String(v ?? "")) || 0);
  const totalDisbursed = loansList.reduce((s, l) => s + num(l.amount), 0);
  const totalRemaining = loansOpen.reduce((s, l) => s + num(l.remaining_balance), 0);
  const totalRecovered = totalDisbursed - totalRemaining;
  const overdueLoans = loansOpen.filter((l) => l.status === "atrasado");
  const activeLoans = loansOpen.filter((l) => l.status === "ativo" || l.status === "activo");

  return (
    <div className="space-y-6">
      {isError && (
        <QueryErrorAlert onRetry={() => refetch()} />
      )}
      <PageHeader
        title="Empréstimos / Crédito"
        description={
          isLoading
            ? "A carregar empréstimos..."
            : `${loans?.length ?? 0} empréstimo(s) registrados`
        }
        actions={
          canAddLoan && (
          <Dialog open={showNew} onOpenChange={setShowNew}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Novo Empréstimo</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Novo Empréstimo</DialogTitle>
                <p className="text-sm text-muted-foreground">Preencha os dados e ajuste juros e parcelas conforme necessário.</p>
              </DialogHeader>
              <div className="space-y-4">
                <Tabs defaultValue="dados" className="w-full">
                  <TabsList className="grid grid-cols-2 w-full">
                    <TabsTrigger value="dados">Dados do empréstimo</TabsTrigger>
                    <TabsTrigger value="garantia">Item de garantia</TabsTrigger>
                  </TabsList>

                  <TabsContent value="dados" className="space-y-5 mt-4">
                    <div>
                      <Label>Cliente</Label>
                      <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                        <SelectContent>
                          {(clients ?? [])
                            .filter((c: ApiClient) => c.status === "ativo")
                            .map((c: ApiClient) => (
                              <SelectItem key={c.id} value={String(c.id)}>
                                {c.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label>Valor (MT)</Label>
                        <Input
                          type="number"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="Ex.: 50 000"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Categoria</Label>
                        <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                          <SelectTrigger className="mt-1"><SelectValue placeholder="Sem categoria" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sem categoria</SelectItem>
                            {categories.filter((c) => c.is_active).map((cat) => (
                              <SelectItem key={cat.id} value={String(cat.id)}>
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {amt > 0 && suggestedCategories.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Sugerido para {formatCurrency(amt)}: {suggestedCategories[0].name}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Juros e parcelas — pode alterar manualmente
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Juros (%)</Label>
                          <Input
                            type="number"
                            value={rate}
                            onChange={(e) => setRate(e.target.value)}
                            placeholder="5"
                            step={0.5}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label>Nº parcelas</Label>
                          <Input
                            type="number"
                            value={term}
                            onChange={(e) => setTerm(e.target.value)}
                            placeholder="12"
                            min={1}
                            className="mt-1"
                          />
                        </div>
                      </div>
                      {selectedCategoryId !== "none" && (
                        <p className="text-xs text-muted-foreground">
                          Valores sugeridos pela categoria — altere se precisar.
                        </p>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="garantia" className="mt-4">
                    <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <Label className="cursor-pointer flex-1">Item de garantia</Label>
                    <input
                      type="checkbox"
                      checked={hasCollateral}
                      onChange={(e) => setHasCollateral(e.target.checked)}
                      className="rounded"
                    />
                  </div>
                  {hasCollateral && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div className="sm:col-span-2">
                        <Label>Descrição *</Label>
                        <Input
                          placeholder="Ex: Bilhete de Identidade, Telemóvel Samsung..."
                          value={collateral.description}
                          onChange={(e) => setCollateral((c) => ({ ...c, description: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>Tipo</Label>
                        <Select
                          value={collateral.item_type}
                          onValueChange={(v) => setCollateral((c) => ({ ...c, item_type: v as typeof c.item_type }))}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {COLLATERAL_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Valor estimado (MT)</Label>
                        <Input
                          type="number"
                          placeholder="Opcional"
                          value={collateral.estimated_value}
                          onChange={(e) => setCollateral((c) => ({ ...c, estimated_value: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>Estado</Label>
                        <Select
                          value={collateral.condition}
                          onValueChange={(v) => setCollateral((c) => ({ ...c, condition: v as typeof c.condition }))}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {COLLATERAL_CONDITIONS.map((x) => (
                              <SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-2">
                        <Label>Nº série / Identificação</Label>
                        <Input
                          placeholder="Opcional"
                          value={collateral.serial_number}
                          onChange={(e) => setCollateral((c) => ({ ...c, serial_number: e.target.value }))}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label>Observações</Label>
                        <Input
                          placeholder="Opcional"
                          value={collateral.notes}
                          onChange={(e) => setCollateral((c) => ({ ...c, notes: e.target.value }))}
                        />
                      </div>
                    </div>
                  )}
                </div>
                  </TabsContent>
                </Tabs>

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

                <Button
                  className="w-full"
                  disabled={
                    createLoan.isLoading ||
                    !selectedClientId ||
                    !amount.trim() ||
                    !rate.trim() ||
                    !term.trim()
                  }
                  onClick={() => {
                    const client = parseInt(selectedClientId, 10);
                    const a = parseFloat(amount) || 0;
                    const r = parseFloat(rate) || 0;
                    const t = parseInt(term, 10) || 1;
                    const today = new Date();
                    const start_date = today.toISOString().slice(0, 10);
                    const end = new Date(today);
                    end.setMonth(end.getMonth() + t);
                    const end_date = end.toISOString().slice(0, 10);
                    const collateralPayload = hasCollateral && collateral.description.trim()
                      ? {
                          description: collateral.description.trim(),
                          item_type: collateral.item_type,
                          estimated_value: collateral.estimated_value ? parseFloat(collateral.estimated_value) : null,
                          condition: collateral.condition,
                          serial_number: collateral.serial_number.trim() || undefined,
                          notes: collateral.notes.trim() || undefined,
                        }
                      : undefined;
                    createLoan.mutate({
                      client,
                      category: selectedCategoryId === "none" ? undefined : parseInt(selectedCategoryId, 10),
                      amount: a,
                      interest_rate: r,
                      term: t,
                      start_date,
                      end_date,
                      collateral: collateralPayload ?? null,
                    });
                  }}
                >
                  {createLoan.isLoading ? "A guardar..." : "Criar Empréstimo"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          )}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total Empréstimos"
          value={String(loansOpen.length)}
          icon={Wallet}
          subtitle={`${activeLoans.length} activos`}
          variant="primary"
        />
        <StatCard
          title="Valor Emprestado"
          value={formatCurrency(totalDisbursed)}
          icon={Banknote}
          subtitle="Capital concedido"
        />
        <StatCard
          title="Saldo Devedor"
          value={formatCurrency(totalRemaining)}
          icon={TrendingUp}
          variant="warning"
          subtitle={totalRecovered > 0 ? `${formatCurrency(totalRecovered)} já recuperado` : undefined}
        />
        <StatCard
          title="Em Atraso"
          value={formatCurrency(overdueLoans.reduce((s, l) => s + num(l.remaining_balance), 0))}
          icon={AlertTriangle}
          variant="destructive"
          subtitle={overdueLoans.length > 0 ? `${overdueLoans.length} empréstimo(s)` : "Nenhum"}
        />
      </div>

      <Tabs defaultValue="loans" className="mt-4 space-y-4">
        <TabsList className="bg-muted/50 p-1 rounded-xl flex-wrap gap-1">
          <TabsTrigger value="loans" className="rounded-lg">
            <ScrollText className="h-4 w-4 mr-1" />
            Empréstimos
          </TabsTrigger>
          {canManageLoanCategories && (
            <TabsTrigger value="settings" className="rounded-lg">
              <FileText className="h-4 w-4 mr-1" />
              Configurações
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="loans" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {(["ativo", "pago", "atrasado", "pendente"] as const).map((s) => {
              const n = loansOpen.filter((l) => l.status === s).length;
              return (
                <div key={s} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm bg-muted/50 border border-transparent">
                  <StatusBadge status={s} />
                  <span className="font-semibold tabular-nums">{n}</span>
                </div>
              );
            })}
          </div>

          <DataTable
            data={loansOpen}
            columns={columns}
            searchKeys={["client_name", "id"]}
            loading={isLoading}
            pageSize={10}
            onRowClick={setSelectedLoan}
            getRowClassName={(l) => {
              const loan = l as ApiLoan;
              const paid = safeNum(loan.paid_installments);
              const total = safeNum(loan.term);
              const hasProgress = paid > 0 && paid < total;
              if (loan.status === "atrasado")
                return "bg-rose-50/95 dark:bg-rose-950/50 border-l-4 border-l-rose-500 text-rose-900 dark:text-rose-100 [&_td]:font-medium hover:bg-rose-100/90 dark:hover:bg-rose-950/60";
              if (loan.status === "pago")
                return "bg-emerald-50/60 dark:bg-emerald-950/30 border-l-4 border-l-emerald-500/70 [&_td]:font-medium";
              if (hasProgress)
                return "bg-primary/5 dark:bg-primary/10 border-l-2 border-l-primary/40 hover:bg-primary/10 dark:hover:bg-primary/15";
              return undefined;
            }}
            renderRowActions={
              (canEditLoan || canDeleteLoan)
                ? (l) => (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        {canEditLoan && (
                          <DropdownMenuItem onClick={() => setEditingLoan(l)}>
                            <Pencil className="h-4 w-4 mr-2" />Editar
                          </DropdownMenuItem>
                        )}
                        {canDeleteLoan && (
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeletingLoan(l)}
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
        </TabsContent>

        <TabsContent value="settings">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-2xl border bg-card shadow-sm overflow-hidden lg:col-span-2">
            <div className="p-6 border-b bg-muted/20 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h3 className="font-semibold text-lg">Categorias de Empréstimo</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                  Defina tipos de empréstimo como mensal, quinzenal ou anual. Cada categoria guarda a
                  frequência dos pagamentos, limites de prazo, número de parcelas e quando o cliente pode
                  perder o bem de garantia.
                </p>
              </div>
              {canAddLoanCategory && (
                <Button variant="outline" onClick={() => setShowCatDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova categoria
                </Button>
              )}
            </div>
            <div className="p-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Nome</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Frequência</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Prazo (dias)</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Garantia</th>
                    <th className="px-3 py-2 text-center font-medium text-muted-foreground">Activa</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Acções</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                        Nenhuma categoria configurada. Ex.: “Mensal padrão”, “Anual com garantia forte”.
                      </td>
                    </tr>
                  ) : (
                    categories.map((c) => (
                      <tr key={c.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-3 py-2">
                          <div className="flex flex-col">
                            <span className="font-medium">{c.name}</span>
                            {c.code && (
                              <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
                                {c.code}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          {c.frequency_days} dias
                        </td>
                        <td className="px-3 py-2">
                          {c.min_term_days}–{c.max_term_days}
                          <span className="block text-[11px] text-muted-foreground">
                            {c.min_installments}–{c.max_installments} parcelas
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <span className="block">
                            Tolerância:{" "}
                            {c.collateral_grace_days > 0 ? `${c.collateral_grace_days} dias` : "sem tolerância"}
                          </span>
                          <span className="block">
                            Mantém bem pagando juros: {c.require_interest_paid_to_keep_collateral ? "Sim" : "Não"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={
                              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " +
                              (c.is_active
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
                                : "bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-200")
                            }
                          >
                            {c.is_active ? "Sim" : "Não"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {(canChangeLoanCategory || canDeleteLoanCategory) && (
                            <div className="inline-flex gap-1">
                              {canChangeLoanCategory && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingCategory(c)}
                                  title="Editar"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              {canDeleteLoanCategory && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive"
                                  onClick={() => deleteCategoryMutate(c.id)}
                                  title="Eliminar"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            </div>

            <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
              <div className="p-6 border-b bg-muted/20">
                <h3 className="font-semibold text-lg">Como usar (rápido)</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Pense em “categoria” como um <span className="font-medium">perfil de crédito</span>. Ao criar um
                  empréstimo, você escolhe uma categoria e o contrato já traz as regras automaticamente.
                </p>
              </div>
              <div className="p-6 space-y-4">
                <div className="rounded-xl border bg-muted/20 p-4">
                  <p className="text-sm font-medium mb-2">Exemplos prontos</p>
                  <div className="space-y-2 text-sm">
                    <div className="rounded-lg border bg-card p-3">
                      <p className="font-medium">Mensal padrão</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Frequência 30 dias • 3–24 parcelas • Tolerância garantia 60 dias • Mantém bem pagando juros
                      </p>
                    </div>
                    <div className="rounded-lg border bg-card p-3">
                      <p className="font-medium">Quinzenal (15 dias)</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Frequência 15 dias • 2–24 parcelas • Bom para pequenos negócios com fluxo rápido
                      </p>
                    </div>
                    <div className="rounded-lg border bg-card p-3">
                      <p className="font-medium">Anual (365 dias)</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Frequência 365 dias • 1–12 parcelas • Prazo longo (1–3 anos) • Garantia mais rigorosa
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border p-4">
                  <p className="text-sm font-medium mb-2">Tradução dos campos</p>
                  <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
                    <p>
                      <span className="font-medium text-foreground">Frequência (dias)</span>: em quantos dias vence
                      cada ciclo (ex.: 30=mensal, 15=quinzenal, 365=anual).
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Prazo (dias)</span>: limites do contrato. Ajuda a
                      evitar emprestar “fora da política”.
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Parcelas</span>: limites mínimos/máximos de
                      prestações permitidas.
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Garantia</span>: quantos dias pode atrasar antes de
                      perder o bem e se “pagar só juros” protege a garantia.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showCatDialog} onOpenChange={setShowCatDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova categoria de empréstimo</DialogTitle>
          </DialogHeader>
          <LoanCategoryForm
            onSubmit={(payload) => createCategory.mutate(payload)}
            loading={createCategory.isLoading}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingCategory} onOpenChange={(o) => !o && setEditingCategory(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar categoria</DialogTitle>
          </DialogHeader>
          {editingCategory && (
            <LoanCategoryForm
              initial={editingCategory}
              onSubmit={(payload) =>
                updateCategory.mutate({ id: editingCategory.id, payload })
              }
              loading={updateCategory.isLoading}
              submitLabel="Guardar"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ==================== LOAN DETAIL DIALOG ==================== */}
      <Dialog open={!!selectedLoan} onOpenChange={() => setSelectedLoan(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selectedLoan && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between gap-2">
                  <DialogTitle className="flex items-center gap-2">
                    Empréstimo {selectedLoan.id}
                    <StatusBadge status={selectedLoan.status} />
                  </DialogTitle>
                  {canEditLoan && (
                    <Button variant="outline" size="sm" onClick={() => setEditingLoan(selectedLoan)}>
                      <Pencil className="h-4 w-4 mr-1" />Editar
                    </Button>
                  )}
                </div>
              </DialogHeader>

              <Tabs defaultValue="details" className="mt-2">
                <TabsList>
                  <TabsTrigger value="details"><ScrollText className="h-4 w-4 mr-1" />Detalhes</TabsTrigger>
                  <TabsTrigger value="amortization"><Table className="h-4 w-4 mr-1" />Amortização</TabsTrigger>
                  <TabsTrigger value="contract"><FileText className="h-4 w-4 mr-1" />Contrato</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="bg-muted rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Cliente</p>
                      <p className="font-medium text-sm">{selectedLoan.client_name}</p>
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Valor</p>
                      <p className="font-medium text-sm">{formatCurrency(selectedLoan.amount)}</p>
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Taxa de Juros</p>
                      <p className="font-medium text-sm">{selectedLoan.interest_rate}%</p>
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Prazo</p>
                      <p className="font-medium text-sm">{selectedLoan.term} meses</p>
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Parcela Mensal</p>
                      <p className="font-medium text-sm">{formatCurrency(selectedLoan.monthly_payment)}</p>
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="font-medium text-sm">{formatCurrency(selectedLoan.total_amount)}</p>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-5">
                    <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Estado da Dívida
                    </h4>
                    <div className="relative w-full h-4 bg-muted/80 rounded-full overflow-hidden mb-3 shadow-inner">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ease-out ${
                          selectedLoan.status === "pago"
                            ? "bg-gradient-to-r from-emerald-500 to-teal-600"
                            : selectedLoan.status === "atrasado"
                              ? "bg-gradient-to-r from-rose-500 to-red-600"
                              : "bg-gradient-to-r from-primary to-primary/80"
                        }`}
                        style={{
                          width: `${Math.min(100, (safeNum(selectedLoan.paid_amount) / Math.max(1, safeNum(selectedLoan.total_amount))) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        Pago: <strong className="text-foreground">{formatCurrency(selectedLoan.paid_amount)}</strong> ({selectedLoan.paid_installments}/{selectedLoan.term})
                      </span>
                      <span>Restante: <strong className="text-foreground">{formatCurrency(selectedLoan.remaining_balance)}</strong></span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Início:</span>
                      <span>{formatDate(selectedLoan.start_date)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fim:</span>
                      <span>{formatDate(selectedLoan.end_date)}</span>
                    </div>
                  </div>

                  {selectedLoan.collateral && (
                    <div className="border rounded-lg p-4 bg-muted/30">
                      <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        Item de Garantia
                      </h4>
                      <div className="text-sm space-y-1">
                        <p><span className="text-muted-foreground">Descrição:</span> {selectedLoan.collateral.description}</p>
                        <p><span className="text-muted-foreground">Tipo:</span> {COLLATERAL_TYPES.find((t) => t.value === selectedLoan.collateral!.item_type)?.label ?? selectedLoan.collateral!.item_type}</p>
                        {selectedLoan.collateral.estimated_value && (
                          <p><span className="text-muted-foreground">Valor estimado:</span> {formatCurrency(selectedLoan.collateral.estimated_value)}</p>
                        )}
                        {selectedLoan.collateral.serial_number && (
                          <p><span className="text-muted-foreground">Identificação:</span> {selectedLoan.collateral.serial_number}</p>
                        )}
                        {selectedLoan.collateral.notes && (
                          <p><span className="text-muted-foreground">Observações:</span> {selectedLoan.collateral.notes}</p>
                        )}
                      </div>
                    </div>
                  )}
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
                        {amortizationRows.map((row) => {
                          const isOverdue = row.status === "atrasado";
                          const isPaid = row.status === "pago";
                          const rowClass = isOverdue
                            ? "border-b last:border-0 bg-rose-50/80 dark:bg-rose-950/40 hover:bg-rose-100/80"
                            : isPaid
                              ? "border-b last:border-0 bg-emerald-50/50 dark:bg-emerald-950/20"
                              : "border-b last:border-0 hover:bg-muted/20";
                          return (
                            <tr key={row.installment} className={rowClass}>
                              <td className="px-3 py-2">{row.installment}</td>
                              <td className="px-3 py-2">{formatDate(row.date)}</td>
                              <td className="px-3 py-2 text-right font-medium">{formatCurrency(row.payment)}</td>
                              <td className="px-3 py-2 text-right">{formatCurrency(row.principal)}</td>
                              <td className="px-3 py-2 text-right">{formatCurrency(row.interest)}</td>
                              <td className="px-3 py-2 text-right">{formatCurrency(row.balance)}</td>
                              <td className="px-3 py-2 text-center"><StatusBadge status={row.status} /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                <TabsContent value="contract">
                  <ContractTab
                    loan={selectedLoan}
                    contractText={contractText}
                    setContractText={setContractText}
                  />
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Loan Dialog */}
      <Dialog open={!!editingLoan} onOpenChange={(o) => !o && setEditingLoan(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar Empréstimo</DialogTitle></DialogHeader>
          {editingLoan && (
            <LoanEditForm
              loan={editingLoan}
              clients={clients ?? []}
              onSubmit={(payload) =>
                updateLoan.mutate({ id: editingLoan.id, payload })
              }
              isLoading={updateLoan.isLoading}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingLoan} onOpenChange={(o) => !o && setDeletingLoan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar empréstimo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acção não pode ser revertida. O empréstimo e os pagamentos associados serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingLoan && deleteLoan.mutate(deletingLoan.id)}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LoanEditForm({
  loan,
  clients,
  onSubmit,
  isLoading,
}: {
  loan: ApiLoan;
  clients: ApiClient[];
  onSubmit: (payload: Parameters<typeof loansApi.update>[1]) => void;
  isLoading: boolean;
}) {
  const c = loan.collateral;
  const [clientId, setClientId] = useState(String(loan.client));
  const [amount, setAmount] = useState(String(loan.amount));
  const [rate, setRate] = useState(String(loan.interest_rate));
  const [term, setTerm] = useState(String(loan.term));
  const [startDate, setStartDate] = useState(loan.start_date);
  const [endDate, setEndDate] = useState(loan.end_date);
  const [hasCollateral, setHasCollateral] = useState(!!c);
  const [collateral, setCollateral] = useState({
    description: c?.description ?? "",
    item_type: (c?.item_type ?? "documento") as const,
    estimated_value: c?.estimated_value != null ? String(c.estimated_value) : "",
    condition: (c?.condition ?? "não_aplicavel") as const,
    serial_number: c?.serial_number ?? "",
    notes: c?.notes ?? "",
  });

  useEffect(() => {
    setClientId(String(loan.client));
    setAmount(String(loan.amount));
    setRate(String(loan.interest_rate));
    setTerm(String(loan.term));
    setStartDate(loan.start_date);
    setEndDate(loan.end_date);
    const col = loan.collateral;
    setHasCollateral(!!col);
    setCollateral({
      description: col?.description ?? "",
      item_type: (col?.item_type ?? "documento") as const,
      estimated_value: col?.estimated_value != null ? String(col.estimated_value) : "",
      condition: (col?.condition ?? "não_aplicavel") as const,
      serial_number: col?.serial_number ?? "",
      notes: col?.notes ?? "",
    });
  }, [loan.id]);

  return (
    <div className="space-y-4">
      <div>
        <Label>Cliente</Label>
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger><SelectValue placeholder="Cliente" /></SelectTrigger>
          <SelectContent>
            {clients.filter((c) => c.status === "ativo").map((client) => (
              <SelectItem key={client.id} value={String(client.id)}>{client.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><Label>Valor (MT)</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <div><Label>Juros (%)</Label><Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} /></div>
        <div><Label>Parcelas</Label><Input type="number" value={term} onChange={(e) => setTerm(e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Data início</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
        <div><Label>Data fim</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
      </div>

      <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <Label className="cursor-pointer flex-1">Item de garantia</Label>
          <input type="checkbox" checked={hasCollateral} onChange={(e) => setHasCollateral(e.target.checked)} className="rounded" />
        </div>
        {hasCollateral && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="sm:col-span-2">
              <Label>Descrição *</Label>
              <Input
                placeholder="Ex: Bilhete de Identidade..."
                value={collateral.description}
                onChange={(e) => setCollateral((col) => ({ ...col, description: e.target.value }))}
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={collateral.item_type} onValueChange={(v) => setCollateral((col) => ({ ...col, item_type: v as typeof col.item_type }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COLLATERAL_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor estimado (MT)</Label>
              <Input
                type="number"
                placeholder="Opcional"
                value={collateral.estimated_value}
                onChange={(e) => setCollateral((col) => ({ ...col, estimated_value: e.target.value }))}
              />
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={collateral.condition} onValueChange={(v) => setCollateral((col) => ({ ...col, condition: v as typeof col.condition }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COLLATERAL_CONDITIONS.map((x) => <SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Nº série / Identificação</Label>
              <Input placeholder="Opcional" value={collateral.serial_number} onChange={(e) => setCollateral((col) => ({ ...col, serial_number: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label>Observações</Label>
              <Input placeholder="Opcional" value={collateral.notes} onChange={(e) => setCollateral((col) => ({ ...col, notes: e.target.value }))} />
            </div>
          </div>
        )}
      </div>

      <Button
        className="w-full"
        disabled={
          isLoading ||
          !clientId ||
          !amount.trim() ||
          !rate.trim() ||
          !term.trim() ||
          !startDate ||
          !endDate ||
          (hasCollateral && !collateral.description.trim())
        }
        onClick={() => {
          const collateralPayload = hasCollateral && collateral.description.trim()
            ? {
                description: collateral.description.trim(),
                item_type: collateral.item_type,
                estimated_value: collateral.estimated_value ? parseFloat(collateral.estimated_value) : null,
                condition: collateral.condition,
                serial_number: collateral.serial_number.trim() || undefined,
                notes: collateral.notes.trim() || undefined,
              }
            : null;
          onSubmit({
            client: parseInt(clientId, 10),
            amount: parseFloat(amount) || 0,
            interest_rate: parseFloat(rate) || 0,
            term: parseInt(term, 10) || 1,
            start_date: startDate,
            end_date: endDate,
            collateral: collateralPayload,
          });
        }}
      >
        {isLoading ? "A guardar..." : "Guardar alterações"}
      </Button>
    </div>
  );
}
