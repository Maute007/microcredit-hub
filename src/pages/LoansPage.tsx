import { useRef, useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { QueryErrorAlert } from "@/components/QueryErrorAlert";
import { DataTable } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { DEFAULT_INSTITUTIONAL_CONTRACT_CLAUSES_PT } from "@/data/defaultInstitutionalContractClausesPt";
import { loansApi, clientsApi, loanCategoriesApi, paymentsApi, systemApi, type ApiLoan, type ApiClient, type ApiLoanCategory, type ApiPayment, type ApiSystemSettings, type ApiLoanContractProof } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { Plus, Calculator, FileText, Printer, Table, ScrollText, ShieldCheck, MoreHorizontal, Pencil, Trash2, Wallet, AlertTriangle, TrendingUp, Banknote, Shield, HandCoins, Copy, FolderOpen, Power, Search, Layers, CheckCircle2, Activity, Tag } from "lucide-react";
import type { ApiCollateral } from "@/lib/api";
import { SignaturePadField } from "@/components/SignaturePadField";
import { ContractLogoCropDialog } from "@/components/ContractLogoCropDialog";
import QRCode from "qrcode";

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

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  transferencia: "Transferência",
  m_pesa: "M-Pesa",
  emola_mkesh: "eMola Mkesh",
  deposito: "Depósito",
  dinheiro: "Dinheiro",
  outro: "Outro",
};

/** Modelo para o separador Termos (T&C) — personalize por categoria. */
const CATEGORY_TERMS_HINT = `TERMOS E CONDIÇÕES — MODELO (personalize)

1. Entrega do bem como garantia
1.1 O cliente entrega um bem de valor como garantia do pagamento.
1.2 O bem ficará sob custódia até liquidação do valor acordado.

2. Prazo de pagamento
2.1 O prazo total segue os limites em dias definidos nesta categoria no sistema.
2.2 É permitido pagamento antecipado.

3. Taxa de juros
3.1 Aplicam-se a taxa e o plano constantes no presente contrato e na simulação.

4. Resgate da garantia
4.1 O bem será devolvido após pagamento total.
4.2 Em incumprimento, aplicam-se a lei e estas condições.`;

/** Alinha com o cálculo em `LoanSerializer.validate` (backend). */
function computeLoanPreview(amount: number, ratePercent: number, termMonths: number) {
  const t = Math.max(1, Math.floor(termMonths) || 1);
  const a = Math.max(0, amount);
  const principal = a / t;
  const rate = ratePercent / 100;
  const interestPerMonth = (a * rate) / t;
  const monthly = Math.round((principal + interestPerMonth) * 100) / 100;
  const total = Math.round(monthly * t * 100) / 100;
  const interestTotal = Math.round((total - a) * 100) / 100;
  return { monthly, total, interestTotal };
}

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

type ContractTemplateDraftSlice = {
  contract_general_clauses?: string;
  contract_include_clauses_on_sheet?: boolean;
};

function buildContractText(
  loan: ApiLoan,
  client: ApiClient | null,
  system: ApiSystemSettings | null,
  templateDraft?: ContractTemplateDraftSlice | null,
): string {
  const creditorSystemName = (system?.name || "Microcrédito").trim();
  const creditorLegal = (system?.creditor_legal_name || creditorSystemName).trim();
  const creditorAddress = (system?.creditor_address || "______________________________").trim();
  const creditorCity = (system?.creditor_city || "Maputo").trim();

  const debtorName = (client?.name || loan.client_name || "________________").trim();
  const debtorDoc = (client?.document || "________________").trim();
  const debtorAddress = (client?.address || "________________").trim();
  const debtorCity = (client?.city || "________________").trim();

  const principal = Number(loan.amount) || 0;
  const total = Number(loan.total_amount) || 0;
  const interestValue = Math.max(0, total - principal);
  const ratePercent = Number(loan.interest_rate) || 0;
  const termDays = Number(loan.term) || 0;
  const termMonthsApprox = termDays ? Math.max(1, Math.round(termDays / 30)) : 1;

  const collateralInline = (() => {
    const c = loan.collateral;
    if (!c) return "____________________________________________";
    const desc = c.description?.trim() || "—";
    const type = COLLATERAL_TYPES.find((t) => t.value === c.item_type)?.label ?? c.item_type;
    const condition =
      c.condition && c.condition !== "não_aplicavel"
        ? (COLLATERAL_CONDITIONS.find((x) => x.value === c.condition)?.label ?? c.condition)
        : "";
    const serial = c.serial_number?.trim() ? `, Nº série/identificação ${c.serial_number.trim()}` : "";
    const cond = condition ? `, ${condition}` : "";
    return `${type}: ${desc}${cond}${serial}`.trim();
  })();

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

  const tc = loan.category_terms_and_conditions?.trim();
  const termsBlock = tc
    ? `\n\n————————————————————————————————————————\nTERMOS E CONDIÇÕES DA CATEGORIA (${loan.category_name ?? "—"})\n————————————————————————————————————————\n\n${tc}\n`
    : "";

  const includeOfficial =
    (templateDraft?.contract_include_clauses_on_sheet ?? system?.contract_include_clauses_on_sheet) !== false;
  const rawClauses = (templateDraft?.contract_general_clauses ?? system?.contract_general_clauses ?? "").trim();
  const officialClauses = includeOfficial
    ? rawClauses || DEFAULT_INSTITUTIONAL_CONTRACT_CLAUSES_PT.trim()
    : "";
  const officialBlock = officialClauses
    ? `\n\n————————————————————————————————————————\nCONDIÇÕES GERAIS E OBRIGAÇÕES (MODELO DA INSTITUIÇÃO)\n————————————————————————————————————————\n\n${officialClauses}\n`
    : "";

  return `CONFISSÃO DE DÍVIDA

Eu, ${debtorName}, maior, titular do documento de identificação nº ${debtorDoc}, residente em ${debtorAddress}, Cidade de ${debtorCity}, declaro por este meio que reconheço e confesso, de forma livre, consciente e irrevogável, que sou devedor(a) da ${creditorLegal}, pessoa colectiva legalmente constituída ao abrigo das leis da República de Moçambique, com sede em ${creditorAddress}, na qualidade de Credor(a).

A presente dívida tem origem no Contrato de um empréstimo concedido a ${formatDate(loan.start_date)} através do qual recebi o montante de ${formatCurrency(principal)} e deixei ${collateralInline} como garantia de que o pagamento será efetuado nas datas acordadas.

Nos termos do referido contrato, foi acordado o pagamento de juros no valor de ${formatCurrency(interestValue)}, correspondentes a ${ratePercent}% do capital emprestado, pelo período de ${termDays || "____"} dia(s) (${termMonthsApprox} mês(es)), totalizando ${formatCurrency(total)}. Assim, reconheço que o valor total da dívida, correspondente ao capital e juros, é de ${formatCurrency(total)}, que deverá ser pago até o dia ${formatDate(loan.end_date)}. Pelo incumprimento do pagamento da dívida, reconheço e autorizo que o bem penhorado seja vendido pelo Credor como forma de recuperar o empréstimo a mim concedido.

${garantiaText ? `\nCondições específicas da categoria:\n${garantiaText}\n` : ""}
${officialBlock}
${termsBlock}

Item de Garantia (detalhado):
${formatCollateralForContract(loan.collateral)}

Declaro ainda que a presente dívida é líquida, certa e exigível, comprometendo-me ao seu integral pagamento, respondendo pelo cumprimento da obrigação com todo o meu património presente e futuro, nos termos da lei da República de Moçambique. Para firmeza e validade, assino a presente Confissão de Dívida.

${creditorCity}, ____ de ______________ de ________

O(A) DEVEDOR(A)

____________________________
${debtorName}
`;
}

function contractDataSignature(loan: ApiLoan, client: ApiClient | null, system: ApiSystemSettings | null): string {
  return JSON.stringify({
    id: loan.id,
    client_name: loan.client_name,
    client: client,
    system: system
      ? {
          name: system.name,
          creditor_legal_name: system.creditor_legal_name,
          creditor_address: system.creditor_address,
          creditor_city: system.creditor_city,
          contract_general_clauses: system.contract_general_clauses,
          contract_include_clauses_on_sheet: system.contract_include_clauses_on_sheet,
        }
      : null,
    amount: loan.amount,
    interest_rate: loan.interest_rate,
    term: loan.term,
    monthly_payment: loan.monthly_payment,
    total_amount: loan.total_amount,
    start_date: loan.start_date,
    end_date: loan.end_date,
    category_name: loan.category_name,
    category_code: loan.category_code,
    category_frequency_days: loan.category_frequency_days,
    category_collateral_grace_days: loan.category_collateral_grace_days,
    category_require_interest_paid_to_keep_collateral: loan.category_require_interest_paid_to_keep_collateral,
    category_terms_and_conditions: loan.category_terms_and_conditions,
    collateral: loan.collateral,
  });
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
  const [signatureDataUrl, setSignatureDataUrl] = useState<string>("");
  const [rubricaDataUrl, setRubricaDataUrl] = useState<string>("");
  const [proof, setProof] = useState<ApiLoanContractProof | null>(null);
  const [proofLookup, setProofLookup] = useState("");
  const [previewQrDataUrl, setPreviewQrDataUrl] = useState<string>("");
  const [viewMode, setViewMode] = useState<"folha" | "texto">("folha");
  const [cropLogoOpen, setCropLogoOpen] = useState(false);
  const [cropLogoSrc, setCropLogoSrc] = useState<string | null>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { canChangeSystemSettings } = usePermissions();

  const { data: systemSettings } = useQuery<ApiSystemSettings>({
    queryKey: ["system-settings"],
    queryFn: systemApi.get,
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: client,
    isLoading: clientLoading,
  } = useQuery<ApiClient>({
    queryKey: ["contract-client", loan.client],
    queryFn: () => clientsApi.get(loan.client),
    enabled: !!loan.client,
    staleTime: 5 * 60 * 1000,
  });

  const dataSig = contractDataSignature(loan, client ?? null, systemSettings ?? null);

  const [contractBrandDraft, setContractBrandDraft] = useState(() => ({
    contract_theme_color: "",
    contract_page_bg_color: "",
    contract_logo_url: "",
    contract_header_title: "",
    contract_header_subtitle: "",
    contract_doc_badge: "",
    contract_general_clauses: "",
    contract_include_clauses_on_sheet: true,
    creditor_legal_name: "",
    creditor_address: "",
    creditor_city: "",
  }));

  useEffect(() => {
    if (!systemSettings) return;
    setContractBrandDraft({
      contract_theme_color: systemSettings.contract_theme_color ?? "",
      contract_page_bg_color: systemSettings.contract_page_bg_color ?? "",
      contract_logo_url: systemSettings.contract_logo_url ?? "",
      contract_header_title: systemSettings.contract_header_title ?? "",
      contract_header_subtitle: systemSettings.contract_header_subtitle ?? "",
      contract_doc_badge: systemSettings.contract_doc_badge ?? "",
      contract_general_clauses: systemSettings.contract_general_clauses ?? "",
      contract_include_clauses_on_sheet: systemSettings.contract_include_clauses_on_sheet !== false,
      creditor_legal_name: systemSettings.creditor_legal_name ?? "",
      creditor_address: systemSettings.creditor_address ?? "",
      creditor_city: systemSettings.creditor_city ?? "",
    });
  }, [systemSettings?.updated_at, systemSettings?.id]);

  useEffect(() => {
    setContractText(
      buildContractText(loan, client ?? null, systemSettings ?? null, {
        contract_general_clauses: contractBrandDraft.contract_general_clauses,
        contract_include_clauses_on_sheet: contractBrandDraft.contract_include_clauses_on_sheet,
      }),
    );
  }, [
    dataSig,
    loan,
    client,
    systemSettings,
    contractBrandDraft.contract_general_clauses,
    contractBrandDraft.contract_include_clauses_on_sheet,
    setContractText,
  ]);

  const updateSettingsMut = useMutation({
    mutationFn: (payload: Partial<ApiSystemSettings>) => systemApi.update(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
    },
  });

  const esc = (v: string) =>
    String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const toQrDataUrl = async (proofId: string) => {
    const url = `${window.location.origin}/verificar?proof=${encodeURIComponent(proofId)}`;
    return await QRCode.toDataURL(url, { margin: 1, width: 180 });
  };

  useEffect(() => {
    if (!proof?.id) {
      setPreviewQrDataUrl("");
      return;
    }
    void toQrDataUrl(proof.id)
      .then((d) => setPreviewQrDataUrl(d))
      .catch(() => setPreviewQrDataUrl(""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proof?.id]);

  const buildContractSheetHtml = (opts?: { proof?: ApiLoanContractProof | null; qrDataUrl?: string }) => {
    const p = opts?.proof ?? proof;
    const qr = opts?.qrDataUrl ?? previewQrDataUrl ?? "";

    const systemName = (systemSettings?.name || "Microcrédito").trim();
    const theme = ((contractBrandDraft.contract_theme_color || systemSettings?.contract_theme_color) || systemSettings?.primary_color || "#b91c1c").trim();
    const pageBg = ((contractBrandDraft.contract_page_bg_color || systemSettings?.contract_page_bg_color) || "#ffffff").trim();
    const uploadedLogo = (systemSettings?.contract_logo_upload_url || "").trim();
    const urlLogo = (contractBrandDraft.contract_logo_url || systemSettings?.contract_logo_url || "").trim();
    const logoUrl = (uploadedLogo || urlLogo || (systemSettings?.logo_url || "")).trim();
    const headerTitle = ((contractBrandDraft.contract_header_title || systemSettings?.contract_header_title) || systemName).trim();
    const headerSubtitle =
      ((contractBrandDraft.contract_header_subtitle || systemSettings?.contract_header_subtitle) || systemSettings?.tagline || "Instituição de crédito comunitário").trim();
    const badge = ((contractBrandDraft.contract_doc_badge || systemSettings?.contract_doc_badge) || "DOCUMENTO OFICIAL").trim();
    const includeInstitutional = contractBrandDraft.contract_include_clauses_on_sheet !== false;
    const generalClauses = (
      (contractBrandDraft.contract_general_clauses || systemSettings?.contract_general_clauses) || ""
    ).trim();
    const displayClauses = generalClauses || DEFAULT_INSTITUTIONAL_CONTRACT_CLAUSES_PT.trim();
    const section03Main = !includeInstitutional
      ? `<p class="tiny muted" style="margin:0 0 10px 0;">Nesta versão da folha não incluiu o texto geral do contrato da instituição (pode voltar a activar na personalização abaixo).</p>`
      : `<div class="wide-field" style="border-style:solid;border-color:#e2e8f0;margin-bottom:10px;">
           <div class="k">Condições gerais do contrato</div>
           <div class="v" style="white-space:pre-wrap;font-weight:500;line-height:1.45;">${esc(displayClauses)}</div>
         </div>`;

    const contractNo = `MCS-${new Date(loan.start_date || Date.now()).getFullYear()}-${loan.id}`;
    const date = loan.start_date ? formatDate(loan.start_date) : "____/____/______";

    const creditorName = esc(((contractBrandDraft.creditor_legal_name || systemSettings?.creditor_legal_name) || systemName || "________________").trim());
    const creditorAddress = esc(((contractBrandDraft.creditor_address || systemSettings?.creditor_address) || "________________").trim());
    const creditorCity = esc(((contractBrandDraft.creditor_city || systemSettings?.creditor_city) || "________________").trim());

    const debtorName = esc((client?.name || loan.client_name || "________________").trim());
    const debtorDoc = esc((client?.document || "________________").trim());
    const debtorPhone = esc((client?.phone || "________________").trim());
    const debtorAddress = esc((client?.address || "________________").trim());
    const debtorCity = esc((client?.city || "________________").trim());

    const principal = Number(loan.amount) || 0;
    const rate = Number(loan.interest_rate) || 0;
    const termDays = Number(loan.term) || 0;
    const termMonthsApprox = termDays ? Math.max(1, Math.round(termDays / 30)) : 1;
    const monthly = Number(loan.monthly_payment) || 0;

    const collateralType = loan.collateral
      ? esc(COLLATERAL_TYPES.find((t) => t.value === loan.collateral?.item_type)?.label ?? loan.collateral.item_type)
      : "—";
    const collateralDesc = loan.collateral ? esc(loan.collateral.description || "—") : "—";
    const collateralDoc = loan.collateral?.serial_number?.trim() ? esc(loan.collateral.serial_number.trim()) : "—";
    const collateralNotes = loan.collateral?.notes?.trim() ? esc(loan.collateral.notes.trim()) : "—";

    const footerVerify = p
      ? `<div class="verify">
           <div class="verify-left">
             <span class="tiny" style="color:#475569;line-height:1.4;">Este documento dispõe de registo de autenticidade. Pode confirmá-lo junto da instituição ou utilizando o código ao lado.</span>
           </div>
           ${qr ? `<img class="qr" src="${qr}" alt="Verificar documento" />` : ""}
         </div>`
      : "";

    const debtorSig =
      signatureDataUrl || rubricaDataUrl
        ? `<div class="sig-images">
             ${rubricaDataUrl ? `<img src="${rubricaDataUrl}" alt="Rubrica" class="sig small" />` : ""}
             ${signatureDataUrl ? `<img src="${signatureDataUrl}" alt="Assinatura" class="sig" />` : ""}
           </div>`
        : "";

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Contrato • ${esc(contractNo)}</title>
          <meta charset="utf-8" />
          <style>
            @page { size: A4; margin: 14mm; }
            html, body { height: 100%; }
            body {
              font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
              background: #eef2f7;
              margin: 0;
              padding: 18px;
            }
            .sheet {
              width: min(920px, 100%);
              margin: 0 auto;
              color: #0f172a;
              background: ${esc(pageBg)};
              border-radius: 14px;
              box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
              padding: 16px;
              border: 1px solid rgba(148, 163, 184, 0.35);
            }
            @media print {
              body { background: ${esc(pageBg)}; padding: 0; }
              .sheet { width: 100%; box-shadow: none; border: 0; border-radius: 0; padding: 0; }
            }
            .header {
              background: ${esc(theme)};
              color: #fff;
              border-radius: 10px;
              padding: 16px 16px 14px 16px;
              position: relative;
              overflow: hidden;
            }
            .header::after{
              content:"";
              position:absolute; inset:-40px -60px auto auto;
              width:260px; height:260px;
              background: rgba(255,255,255,.10);
              transform: rotate(25deg);
              border-radius: 28px;
            }
            .header-top{ display:flex; gap:14px; align-items:center; justify-content:space-between; position:relative; z-index:1;}
            .brand{ display:flex; gap:12px; align-items:center; min-width:0;}
            .logo{
              width:52px; height:52px; border-radius: 999px; background: rgba(255,255,255,.18);
              display:flex; align-items:center; justify-content:center; overflow:hidden; flex:0 0 auto;
            }
            .logo img{ width:100%; height:100%; object-fit:cover; }
            .brand-text{ min-width:0;}
            .brand-title{ font-weight: 800; font-size: 22px; letter-spacing: .2px; line-height: 1.05; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
            .brand-sub{ font-size: 11px; opacity: .9; letter-spacing: .6px; text-transform: uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            .doc{
              text-align:right;
              padding-left:12px;
              border-left: 1px solid rgba(255,255,255,.22);
            }
            .doc-badge{ font-size: 10px; letter-spacing: .7px; opacity:.9; text-transform: uppercase; }
            .doc-title{ font-weight: 800; font-size: 13px; letter-spacing: .7px; margin-top: 3px; text-transform: uppercase; }
            .meta{ margin-top: 12px; display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; position:relative; z-index:1;}
            .meta .cell{ background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.18); border-radius: 10px; padding: 10px 10px 9px 10px;}
            .meta .k{ font-size: 9px; opacity:.9; letter-spacing: .8px; text-transform: uppercase;}
            .meta .v{ font-size: 11px; font-weight: 700; margin-top: 4px; }
            .section{ margin-top: 12px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: rgba(255,255,255,.72); }
            .section-title{
              background: linear-gradient(0deg, rgba(15,23,42,.03), rgba(15,23,42,.03)), #fff;
              border-bottom: 1px solid #e2e8f0;
              padding: 10px 12px;
              display:flex; align-items:center; gap:10px;
            }
            .badge{
              width: 16px; height: 16px; border-radius: 4px;
              background: ${esc(theme)};
              box-shadow: 0 1px 0 rgba(0,0,0,.08);
              flex:0 0 auto;
            }
            .section-title h3{ margin:0; font-size: 12px; letter-spacing:.7px; text-transform: uppercase; }
            .section-body{ padding: 12px; }
            .grid-2{ display:grid; grid-template-columns: 1fr 1fr; gap: 12px; }
            .panel{
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              overflow:hidden;
              background: #fff;
            }
            .panel-head{
              background: ${esc(theme)};
              color:#fff;
              padding: 8px 10px;
              font-size: 10px;
              letter-spacing: .9px;
              text-transform: uppercase;
              font-weight: 800;
              display:flex; justify-content:center;
            }
            .panel-body{ padding: 10px; }
            .field{ border-bottom: 1px solid #eef2f7; padding: 7px 0; }
            .field:last-child{ border-bottom: 0; }
            .field .k{ font-size: 9px; color:#64748b; letter-spacing: .7px; text-transform: uppercase; }
            .field .v{ font-size: 11px; font-weight: 700; margin-top: 3px; word-break: break-word; }
            .wide-field{ margin-top: 10px; border: 1px dashed #e2e8f0; border-radius: 12px; padding: 10px; background: #fff; }
            .wide-field .k{ font-size:9px; color:#64748b; letter-spacing:.7px; text-transform: uppercase;}
            .wide-field .v{ margin-top:6px; font-size: 11px; font-weight: 700; }
            .kpi-grid{ display:grid; grid-template-columns: 1.1fr .9fr .9fr 1.1fr; gap: 10px; }
            .kpi{
              border:1px solid #e2e8f0;
              border-radius: 12px;
              background: #fff;
              overflow:hidden;
            }
            .kpi.dark{ background: ${esc(theme)}; color:#fff; border-color: rgba(255,255,255,.18); }
            .kpi .k{ padding: 8px 10px 0 10px; font-size: 9px; letter-spacing:.7px; text-transform: uppercase; opacity:.85;}
            .kpi .v{ padding: 6px 10px 10px 10px; font-size: 17px; font-weight: 900; letter-spacing:.2px;}
            .kpi .sub{ padding: 0 10px 10px 10px; font-size: 9px; opacity:.85;}
            ul{ margin:0; padding-left: 16px; }
            li{ margin: 6px 0; font-size: 11px; color:#0f172a; }
            .muted{ color:#64748b; }
            .sign-grid{ display:grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
            .sign{
              border:1px solid #e2e8f0;
              border-radius: 12px;
              background:#fff;
              overflow:hidden;
              min-height: 108px;
              display:flex;
              flex-direction:column;
              justify-content:space-between;
            }
            .sign .head{
              background: #fff;
              padding: 8px 10px;
              font-size: 10px;
              letter-spacing:.9px;
              text-transform: uppercase;
              font-weight: 900;
              color: #0f172a;
              border-bottom:1px solid #eef2f7;
            }
            .sign .body{ padding: 10px; flex:1; display:flex; align-items:flex-end; justify-content:center; }
            .line{ width: 100%; border-top: 1px solid #cbd5e1; margin-top: 10px; padding-top: 6px; font-size: 9px; color:#64748b; text-align:center; }
            .sig-images{ display:flex; gap:12px; align-items:flex-end; justify-content:center; flex-wrap:wrap; }
            .sig{ max-width: 220px; max-height: 70px; object-fit: contain; }
            .sig.small{ max-width: 150px; max-height: 50px; opacity:.95; }
            .verify{
              margin-top: 10px;
              padding-top: 10px;
              border-top: 1px solid #e2e8f0;
              display:flex; align-items:center; justify-content:space-between; gap: 10px;
              font-size: 10px; color:#64748b;
            }
            .verify-left{ display:flex; gap: 10px; align-items:center; flex-wrap:wrap; }
            .mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
            .dot{ opacity:.6; }
            .qr{ width: 64px; height: 64px; opacity: .92; }
            .page-foot{ margin-top: 10px; font-size: 9px; color:#64748b; display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;}
            .tiny{ font-size: 9px; }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="header">
              <div class="header-top">
                <div class="brand">
                  <div class="logo">
                    ${logoUrl ? `<img src="${esc(logoUrl)}" alt="Logo" />` : `<span class="tiny">MC</span>`}
                  </div>
                  <div class="brand-text">
                    <div class="brand-title">${esc(headerTitle)}</div>
                    <div class="brand-sub">${esc(headerSubtitle)}</div>
                  </div>
                </div>
                <div class="doc">
                  <div class="doc-badge">${esc(badge)}</div>
                  <div class="doc-title">CONTRATO DE CRÉDITO</div>
                </div>
              </div>
              <div>
                <Label>Sector de Actividade</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={form.sector ?? "outros"}
                  onChange={(e) => setForm((p) => ({ ...p, sector: e.target.value }))}
                >
                  <option value="comercio">Comércio</option>
                  <option value="agricultura">Agricultura</option>
                  <option value="pecuaria">Pecuária</option>
                  <option value="industria">Indústria</option>
                  <option value="servicos">Serviços</option>
                  <option value="consumo">Consumo</option>
                  <option value="outros">Outros</option>
                </select>
              </div>
              <div class="meta">
                <div class="cell"><div class="k">Nº CONTRATO</div><div class="v">${esc(contractNo)}</div></div>
                <div class="cell"><div class="k">DATA</div><div class="v">${esc(date)}</div></div>
                <div class="cell"><div class="k">AGÊNCIA</div><div class="v">________________</div></div>
              </div>
            </div>

            <div class="section">
              <div class="section-title"><div class="badge"></div><h3>01. IDENTIFICAÇÃO DAS PARTES</h3></div>
              <div class="section-body">
                <div class="grid-2">
                  <div class="panel">
                    <div class="panel-head">CREDOR / MUTUANTE</div>
                    <div class="panel-body">
                      <div class="field"><div class="k">Instituição</div><div class="v">${creditorName}</div></div>
                      <div class="field"><div class="k">NUIT</div><div class="v">________________</div></div>
                      <div class="field"><div class="k">Endereço / Sede</div><div class="v">${creditorAddress}</div></div>
                      <div class="field"><div class="k">Cidade</div><div class="v">${creditorCity}</div></div>
                    </div>
                  </div>
                  <div class="panel">
                    <div class="panel-head">DEVEDOR / MUTUÁRIO</div>
                    <div class="panel-body">
                      <div class="field"><div class="k">Nome completo</div><div class="v">${debtorName}</div></div>
                      <div class="field"><div class="k">BI / Passaporte Nº</div><div class="v">${debtorDoc}</div></div>
                      <div class="field"><div class="k">Contacto / Celular</div><div class="v">${debtorPhone}</div></div>
                      <div class="field"><div class="k">Morada</div><div class="v">${debtorAddress}</div></div>
                      <div class="field"><div class="k">Cidade</div><div class="v">${debtorCity}</div></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="section">
              <div class="section-title"><div class="badge"></div><h3>02. CONDIÇÕES FINANCEIRAS DO CRÉDITO</h3></div>
              <div class="section-body">
                <div class="kpi-grid">
                  <div class="kpi dark">
                    <div class="k">VALOR DO CRÉDITO</div>
                    <div class="v">${esc(formatCurrency(principal))}</div>
                    <div class="sub">MZN</div>
                  </div>
                  <div class="kpi">
                    <div class="k">TAXA DE JURO</div>
                    <div class="v">${esc(String(rate))}%</div>
                    <div class="sub muted">por período</div>
                  </div>
                  <div class="kpi">
                    <div class="k">PRAZO</div>
                    <div class="v">${esc(String(termMonthsApprox))} meses</div>
                    <div class="sub muted">${esc(String(termDays || "—"))} dia(s)</div>
                  </div>
                  <div class="kpi">
                    <div class="k">PRESTAÇÃO MENSAL</div>
                    <div class="v">${esc(formatCurrency(monthly))}</div>
                    <div class="sub muted">MZN</div>
                  </div>
                </div>
                <div class="wide-field">
                  <div class="k">FINALIDADE DO CRÉDITO</div>
                  <div class="v">${esc((loan.category_name || "________________").trim())}</div>
                </div>
              </div>
            </div>

            <div class="section">
              <div class="section-title"><div class="badge"></div><h3>03. CONDIÇÕES GERAIS E OBRIGAÇÕES</h3></div>
              <div class="section-body">
                ${section03Main}
                ${loan.category_terms_and_conditions?.trim()
                  ? `<div class="wide-field" style="margin-top:10px;">
                       <div class="k">Termos do tipo de empréstimo</div>
                       <p class="tiny muted" style="margin:0 0 6px 0;">Condições específicas acordadas para esta linha de crédito (complementam o texto geral acima).</p>
                       <div class="v" style="white-space:pre-wrap;font-weight:600;">${esc(
                         loan.category_terms_and_conditions.trim(),
                       )}</div>
                     </div>`
                  : ""}
              </div>
            </div>

            <div class="section">
              <div class="section-title"><div class="badge"></div><h3>04. GARANTIAS E FIADOR</h3></div>
              <div class="section-body">
                <div class="grid-2">
                  <div class="panel">
                    <div class="panel-head">GARANTIA</div>
                    <div class="panel-body">
                      <div class="field"><div class="k">Tipo de garantia</div><div class="v">${collateralType}</div></div>
                      <div class="field"><div class="k">Descrição</div><div class="v">${collateralDesc}</div></div>
                      <div class="field"><div class="k">BI/Passaporte / Nº Série</div><div class="v">${collateralDoc}</div></div>
                      <div class="field"><div class="k">Observações</div><div class="v">${collateralNotes}</div></div>
                    </div>
                  </div>
                  <div class="panel">
                    <div class="panel-head">FIADOR</div>
                    <div class="panel-body">
                      <div class="field"><div class="k">Nome do fiador</div><div class="v">________________</div></div>
                      <div class="field"><div class="k">BI / Passaporte Nº</div><div class="v">________________</div></div>
                      <div class="field"><div class="k">Contacto do fiador</div><div class="v">________________</div></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="section">
              <div class="section-title"><div class="badge"></div><h3>05. ASSINATURAS E AUTENTICAÇÃO</h3></div>
              <div class="section-body">
                <div class="sign-grid">
                  <div class="sign">
                    <div class="head">MUTUÁRIO</div>
                    <div class="body">
                      ${debtorSig || `<div class="muted tiny">Assinatura e data</div>`}
                    </div>
                    <div class="line">${debtorName}</div>
                  </div>
                  <div class="sign">
                    <div class="head">FIADOR / AVALISTA</div>
                    <div class="body"><div class="muted tiny">Assinatura e data</div></div>
                    <div class="line">________________</div>
                  </div>
                  <div class="sign">
                    <div class="head">INSTITUIÇÃO CREDORA</div>
                    <div class="body"><div class="muted tiny">Assinatura da instituição</div></div>
                    <div class="line">Responsável / Gestor</div>
                  </div>
                </div>
                ${footerVerify}
                <div class="page-foot">
                  <span>Este documento pode ser confirmado junto da instituição.</span>
                  <span>${esc(systemName)}</span>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  };

  const sheetHtml = buildContractSheetHtml();

  const handlePrint = (opts?: { proof?: ApiLoanContractProof | null; qrDataUrl?: string }) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      window.print();
      return;
    }
    printWindow.document.write(buildContractSheetHtml(opts));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const proofMut = useMutation({
    mutationFn: () =>
      loansApi.createContractProof(loan.id, {
        contract_text: contractText,
        signature_data_url: signatureDataUrl || undefined,
        rubrica_data_url: rubricaDataUrl || undefined,
      }),
    onSuccess: (p) => {
      setProof(p);
    },
  });

  useEffect(() => {
    if (!contractText.trim() || clientLoading) return;
    const t = window.setTimeout(() => {
      void proofMut.mutate();
    }, 1100);
    return () => window.clearTimeout(t);
    // proofMut estável; dependências principais são o conteúdo do contrato e assinaturas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractText, signatureDataUrl, rubricaDataUrl, loan.id, clientLoading]);

  const doPrintWithProof = async () => {
    try {
      const p = await proofMut.mutateAsync();
      setProof(p);
      const qr = await toQrDataUrl(p.id).catch(() => "");
      handlePrint({ proof: p, qrDataUrl: qr });
    } catch {
      handlePrint();
    }
  };

  return (
    <div className="border rounded-lg p-6 space-y-4 bg-card">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-sm text-muted-foreground space-y-2 max-w-3xl">
          <p className="text-foreground/90">
            <strong>Folha</strong> — documento oficial com o resumo do empréstimo e as condições.{" "}
            <strong>Texto</strong> — declaração de dívida e texto livre, também editável.
          </p>
          <p>
            O contrato já inclui <strong>condições gerais</strong> alargadas (mútuo, pagamentos, garantias, dados,
            foro, confissão de dívida); pode ajustá-las à sua instituição abaixo. Os <strong>termos do tipo de
            empréstimo</strong> vêm da categoria e aparecem na mesma secção, como complemento.
          </p>
          <p className="text-xs">
            Se o seu modelo existir só como imagem num ficheiro Word, o sistema não consegue copiar o texto
            automaticamente: reescreva ou cole o conteúdo no campo «Texto das condições gerais» ou nas definições da
            instituição.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={viewMode === "folha" ? "secondary" : "outline"}
            size="sm"
            onClick={() => setViewMode("folha")}
          >
            Folha
          </Button>
          <Button
            type="button"
            variant={viewMode === "texto" ? "secondary" : "outline"}
            size="sm"
            onClick={() => setViewMode("texto")}
          >
            Texto
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setContractText(buildContractText(loan, client ?? null, systemSettings ?? null))}
            type="button"
            disabled={clientLoading}
          >
            Restaurar template
          </Button>
        </div>
      </div>
      {viewMode === "texto" ? (
        <Textarea
          value={contractText}
          onChange={(e) => setContractText(e.target.value)}
          className="min-h-[320px] text-sm leading-relaxed whitespace-pre-wrap"
          placeholder={clientLoading ? "A carregar dados do cliente..." : "A carregar contrato..."}
        />
      ) : (
        <div className="rounded-xl border bg-muted/10 p-2 space-y-3">
          <iframe
            title="Pré-visualização do contrato"
            className="w-full h-[780px] rounded-lg bg-white"
            srcDoc={sheetHtml}
          />
          <p className="px-2 pt-2 text-xs text-muted-foreground">
            Pré-visualização em tamanho A4. A folha e o registo de autenticidade actualizam-se quando altera o texto ou
            as assinaturas.
          </p>

          <div className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <p className="text-sm font-semibold">Personalizar a sua folha</p>
                <p className="text-xs text-muted-foreground">
                  Cores, logótipo, dados do credor e texto do contrato. Guarde para aplicar em todos os empréstimos.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setContractBrandDraft((p) => ({
                      ...p,
                      contract_theme_color: "",
                      contract_page_bg_color: "",
                      contract_logo_url: "",
                      contract_header_title: "",
                      contract_header_subtitle: "",
                      contract_doc_badge: "",
                      contract_general_clauses: "",
                      contract_include_clauses_on_sheet: systemSettings?.contract_include_clauses_on_sheet !== false,
                      creditor_legal_name: "",
                      creditor_address: "",
                      creditor_city: "",
                    }))
                  }
                >
                  Limpar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    updateSettingsMut.mutate({
                      contract_theme_color: contractBrandDraft.contract_theme_color.trim(),
                      contract_page_bg_color: contractBrandDraft.contract_page_bg_color.trim(),
                      contract_logo_url: contractBrandDraft.contract_logo_url.trim(),
                      contract_header_title: contractBrandDraft.contract_header_title.trim(),
                      contract_header_subtitle: contractBrandDraft.contract_header_subtitle.trim(),
                      contract_doc_badge: contractBrandDraft.contract_doc_badge.trim(),
                      contract_general_clauses: contractBrandDraft.contract_general_clauses.trim(),
                      contract_include_clauses_on_sheet: contractBrandDraft.contract_include_clauses_on_sheet,
                      creditor_legal_name: contractBrandDraft.creditor_legal_name.trim(),
                      creditor_address: contractBrandDraft.creditor_address.trim(),
                      creditor_city: contractBrandDraft.creditor_city.trim(),
                    })
                  }
                  disabled={updateSettingsMut.isLoading}
                >
                  {updateSettingsMut.isLoading ? "A guardar..." : "Guardar alterações"}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Cor do tema</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    className="w-16 h-9 p-1"
                    value={contractBrandDraft.contract_theme_color || (systemSettings?.primary_color ?? "#b91c1c")}
                    onChange={(e) =>
                      setContractBrandDraft((p) => ({ ...p, contract_theme_color: e.target.value }))
                    }
                    aria-label="Selecionar cor do tema"
                    title="Selecionar cor do tema"
                  />
                  <Input
                    value={contractBrandDraft.contract_theme_color}
                    onChange={(e) =>
                      setContractBrandDraft((p) => ({ ...p, contract_theme_color: e.target.value }))
                    }
                    placeholder="Vazio = usa cor primária"
                  />
                </div>
              </div>
              <div>
                <Label>Cor de fundo da folha</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    className="w-16 h-9 p-1"
                    value={contractBrandDraft.contract_page_bg_color || "#ffffff"}
                    onChange={(e) =>
                      setContractBrandDraft((p) => ({ ...p, contract_page_bg_color: e.target.value }))
                    }
                    aria-label="Selecionar cor de fundo"
                    title="Selecionar cor de fundo"
                  />
                  <Input
                    value={contractBrandDraft.contract_page_bg_color}
                    onChange={(e) =>
                      setContractBrandDraft((p) => ({ ...p, contract_page_bg_color: e.target.value }))
                    }
                    placeholder="Vazio = branco"
                  />
                </div>
              </div>
              <div className="md:col-span-3 space-y-2">
                <Label>Logo do contrato</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    className="min-w-[200px] flex-1"
                    value={contractBrandDraft.contract_logo_url}
                    onChange={(e) =>
                      setContractBrandDraft((p) => ({ ...p, contract_logo_url: e.target.value }))
                    }
                    placeholder="URL (https://...) ou use carregar abaixo"
                  />
                  <input
                    ref={logoFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (!f) return;
                      setCropLogoSrc(URL.createObjectURL(f));
                      setCropLogoOpen(true);
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={!canChangeSystemSettings}
                    onClick={() => logoFileInputRef.current?.click()}
                  >
                    Carregar e recortar
                  </Button>
                  {systemSettings?.contract_logo_upload_url ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!canChangeSystemSettings}
                      onClick={async () => {
                        try {
                          await systemApi.deleteContractLogoUpload();
                          await queryClient.invalidateQueries({ queryKey: ["system-settings"] });
                          toast({ title: "Logo carregado removido" });
                        } catch {
                          toast({
                            title: "Erro",
                            description: "Não foi possível remover o logo.",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      Remover logo carregado
                    </Button>
                  ) : null}
                </div>
                {systemSettings?.contract_logo_upload_url ? (
                  <p className="text-[11px] text-muted-foreground">
                    Existe um ficheiro no servidor (tem prioridade sobre a URL).
                  </p>
                ) : null}
              </div>
              <div className="md:col-span-2">
                <Label>Título do cabeçalho</Label>
                <Input
                  value={contractBrandDraft.contract_header_title}
                  onChange={(e) =>
                    setContractBrandDraft((p) => ({ ...p, contract_header_title: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Selo do documento</Label>
                <Input
                  value={contractBrandDraft.contract_doc_badge}
                  onChange={(e) =>
                    setContractBrandDraft((p) => ({ ...p, contract_doc_badge: e.target.value }))
                  }
                />
              </div>
              <div className="md:col-span-3">
                <Label>Subtítulo do cabeçalho</Label>
                <Input
                  value={contractBrandDraft.contract_header_subtitle}
                  onChange={(e) =>
                    setContractBrandDraft((p) => ({ ...p, contract_header_subtitle: e.target.value }))
                  }
                />
              </div>
              <div className="md:col-span-3 space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="include-contract-sheet">Mostrar condições gerais do contrato na folha</Label>
                    <p className="text-[11px] text-muted-foreground max-w-xl">
                      Se desligar, a folha deixa de mostrar este bloco; os termos do tipo de empréstimo continuam visíveis
                      quando existirem.
                    </p>
                  </div>
                  <Switch
                    id="include-contract-sheet"
                    checked={contractBrandDraft.contract_include_clauses_on_sheet}
                    onCheckedChange={(v) =>
                      setContractBrandDraft((p) => ({ ...p, contract_include_clauses_on_sheet: v }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="contract-general-clauses">Texto das condições gerais (editável)</Label>
                  <Textarea
                    id="contract-general-clauses"
                    rows={10}
                    className="resize-y min-h-[200px] text-sm"
                    value={contractBrandDraft.contract_general_clauses}
                    onChange={(e) =>
                      setContractBrandDraft((p) => ({ ...p, contract_general_clauses: e.target.value }))
                    }
                    placeholder="Deixe vazio para usar o modelo sugerido pelo sistema, ou escreva o texto da sua instituição."
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Os termos específicos de cada <strong>tipo de empréstimo</strong> configuram-se na categoria.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Nome legal do credor</Label>
                <Input
                  value={contractBrandDraft.creditor_legal_name}
                  onChange={(e) =>
                    setContractBrandDraft((p) => ({ ...p, creditor_legal_name: e.target.value }))
                  }
                />
              </div>
              <div className="md:col-span-2">
                <Label>Morada / sede do credor</Label>
                <Input
                  value={contractBrandDraft.creditor_address}
                  onChange={(e) =>
                    setContractBrandDraft((p) => ({ ...p, creditor_address: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Cidade do credor</Label>
                <Input
                  value={contractBrandDraft.creditor_city}
                  onChange={(e) =>
                    setContractBrandDraft((p) => ({ ...p, creditor_city: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
        <SignaturePadField
          kind="rubrica"
          value={rubricaDataUrl}
          onChange={setRubricaDataUrl}
          height={120}
          helpText="Assinatura breve ou rubrica, se desejar."
        />
        <div className="border-t pt-4">
          <SignaturePadField
            kind="signature"
            value={signatureDataUrl}
            onChange={setSignatureDataUrl}
            height={150}
            helpText="Assinatura completa (nome e traço)."
          />
        </div>
      </div>

        <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <p className="font-semibold text-sm">Registo do documento</p>
            <p className="text-xs text-muted-foreground">
              Actualiza-se automaticamente quando muda o texto ou as assinaturas. Use o botão se precisar de refrescar
              antes de imprimir.
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => void proofMut.mutate()} disabled={proofMut.isLoading}>
            {proofMut.isLoading ? "A actualizar…" : "Actualizar registo"}
          </Button>
        </div>

        {proof ? (
          <div className="rounded-lg border bg-card p-3 text-xs space-y-1">
            <p className="text-muted-foreground">Referência do registo</p>
            <p className="font-mono break-all text-[11px]">{proof.id}</p>
            <p className="text-muted-foreground pt-2">Chave de verificação</p>
            <p className="font-mono break-all text-[11px]">{proof.contract_sha256}</p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {proofMut.isLoading ? "A preparar o registo…" : "A aguardar o conteúdo do contrato…"}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <Label>Procurar documento registado</Label>
            <Input value={proofLookup} onChange={(e) => setProofLookup(e.target.value)} placeholder="Código de verificação ou referência…" />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              className="w-full"
              variant="secondary"
              onClick={async () => {
                const q = proofLookup.trim();
                if (!q) return;
                const res = await loansApi.lookupContractProof(q);
                const first = res.results?.[0];
                if (first) {
                  setProof(first);
                  setProofLookup(first.contract_sha256);
                }
              }}
            >
              Verificar
            </Button>
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="outline" className="flex-1" onClick={() => void doPrintWithProof()}>
          <Printer className="h-4 w-4 mr-1.5" />Imprimir
        </Button>
        <Button className="flex-1" onClick={() => void doPrintWithProof()}>
          <FileText className="h-4 w-4 mr-1.5" />Guardar como PDF
        </Button>
      </div>

      <ContractLogoCropDialog
        open={cropLogoOpen}
        onOpenChange={(o) => {
          setCropLogoOpen(o);
          if (!o && cropLogoSrc?.startsWith("blob:")) {
            URL.revokeObjectURL(cropLogoSrc);
            setCropLogoSrc(null);
          }
        }}
        imageSrc={cropLogoSrc}
        onUploaded={() => void queryClient.invalidateQueries({ queryKey: ["system-settings"] })}
      />
    </div>
  );
}

/** Modelos pré-prontos para acelerar a criação de categorias. */
const CATEGORY_TEMPLATES: Array<{
  id: string;
  label: string;
  description: string;
  icon: typeof Tag;
  values: {
    frequency_days: number;
    min_term_days: number;
    max_term_days: number;
    default_term_days: number;
    default_interest_rate: number;
    late_interest_rate: number;
    collateral_grace_days: number;
  };
}> = [
  {
    id: "mensal",
    label: "Mensal · 30 dias",
    description: "Pagamento de juros a cada 30 dias. Prazo 30–180 dias.",
    icon: Tag,
    values: {
      frequency_days: 30,
      min_term_days: 30,
      max_term_days: 180,
      default_term_days: 90,
      default_interest_rate: 5,
      late_interest_rate: 2,
      collateral_grace_days: 30,
    },
  },
  {
    id: "quinzenal",
    label: "Quinzenal · 15 dias",
    description: "Juros a cada 15 dias. Indicado para curto prazo.",
    icon: Tag,
    values: {
      frequency_days: 15,
      min_term_days: 15,
      max_term_days: 90,
      default_term_days: 45,
      default_interest_rate: 3,
      late_interest_rate: 2,
      collateral_grace_days: 15,
    },
  },
  {
    id: "trimestral",
    label: "Trimestral · 90 dias",
    description: "Juros a cada 90 dias. Para empréstimos maiores.",
    icon: Tag,
    values: {
      frequency_days: 90,
      min_term_days: 90,
      max_term_days: 365,
      default_term_days: 180,
      default_interest_rate: 12,
      late_interest_rate: 3,
      collateral_grace_days: 60,
    },
  },
];

function LoanCategoryForm({
  initial,
  onSubmit,
  loading,
  submitLabel = "Criar",
  allowedTermPresets = [],
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
    terms_and_conditions?: string;
  }) => void;
  loading: boolean;
  submitLabel?: string;
  /** Prazos em dias permitidos globalmente (Utilizadores → definições). */
  allowedTermPresets?: number[];
}) {
  const { toast } = useToast();
  const termDayOptions = useMemo(() => {
    const base =
      allowedTermPresets.length > 0
        ? [...allowedTermPresets].sort((a, b) => a - b)
        : [15, 30, 60, 90, 120, 180];
    const s = new Set(base);
    if (initial?.min_term_days) s.add(initial.min_term_days);
    if (initial?.max_term_days) s.add(initial.max_term_days);
    return Array.from(s).sort((a, b) => a - b);
  }, [allowedTermPresets, initial?.min_term_days, initial?.max_term_days]);

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
  const interestCycleOptions = useMemo(() => {
    const f = initial?.frequency_days ?? 30;
    const s = new Set([15, 30, f]);
    return Array.from(s)
      .filter((n) => n > 0)
      .sort((a, b) => a - b);
  }, [initial?.frequency_days]);
  const [minTermDays, setMinTermDays] = useState(String(initial?.min_term_days ?? 30));
  const [maxTermDays, setMaxTermDays] = useState(String(initial?.max_term_days ?? 120));
  const [defaultInterest, setDefaultInterest] = useState(
    initial?.default_interest_rate != null ? String(initial.default_interest_rate) : "0",
  );
  const initDefaultDays = Math.max(
    15,
    (initial?.default_term_months != null ? initial.default_term_months : 1) * 30,
  );
  const [defaultTermDays, setDefaultTermDays] = useState(String(initDefaultDays));
  const [lateInterestRate, setLateInterestRate] = useState(
    initial?.late_interest_rate != null ? String(initial.late_interest_rate) : "0",
  );
  const [maxLateInterestMonths, setMaxLateInterestMonths] = useState(
    String(initial?.max_late_interest_months ?? 12),
  );
  const [collateralGraceDays, setCollateralGraceDays] = useState(
    String(initial?.collateral_grace_days ?? 30),
  );
  const [keepOnInterest, setKeepOnInterest] = useState(
    initial?.require_interest_paid_to_keep_collateral ?? true,
  );
  const [active, setActive] = useState(initial?.is_active ?? true);
  const [termsAndConditions, setTermsAndConditions] = useState(initial?.terms_and_conditions ?? "");

  useEffect(() => {
    if (!initial?.id) return;
    setTermsAndConditions(initial.terms_and_conditions ?? "");
  }, [initial?.id, initial?.terms_and_conditions]);

  useEffect(() => {
    const m = Math.max(1, parseInt(minTermDays, 10) || 1);
    setMaxTermDays((prev) => {
      const x = Math.max(1, parseInt(prev, 10) || 1);
      return x < m ? String(m) : prev;
    });
  }, [minTermDays]);

  useEffect(() => {
    const m = Math.max(1, parseInt(minTermDays, 10) || 1);
    const x = Math.max(m, parseInt(maxTermDays, 10) || m);
    setDefaultTermDays((prev) => {
      const d = parseInt(prev, 10) || m;
      if (d < m) return String(m);
      if (d > x) return String(x);
      return prev;
    });
  }, [minTermDays, maxTermDays]);

  const freqN = Math.max(1, parseInt(frequencyDays, 10) || 30);
  const minDN = Math.max(1, parseInt(minTermDays, 10) || 1);
  const maxDN = Math.max(minDN, parseInt(maxTermDays, 10) || minDN);
  const minInstCalc = Math.max(1, Math.ceil(minDN / freqN));
  const maxInstCalc = Math.max(minInstCalc, Math.ceil(maxDN / freqN));

  const submitPayload = () => {
    const freq = Math.max(1, parseInt(frequencyDays, 10) || 30);
    const minD = Math.max(1, parseInt(minTermDays, 10) || 1);
    const maxD = Math.max(minD, parseInt(maxTermDays, 10) || minD);
    let defDays = parseInt(defaultTermDays, 10) || minD;
    if (defDays < minD) defDays = minD;
    if (defDays > maxD) defDays = maxD;
    const minI = Math.max(1, Math.ceil(minD / freq));
    const maxI = Math.max(minI, Math.ceil(maxD / freq));
    const defaultTermMonths = Math.max(1, Math.round(defDays / 30));
    return {
      name: name.trim(),
      code: code.trim(),
      description: description.trim() || undefined,
      terms_and_conditions: termsAndConditions.trim() || undefined,
      min_amount: parseFloat(minAmount) || 0,
      max_amount: maxAmount.trim() ? parseFloat(maxAmount) || null : null,
      frequency_days: freq,
      min_term_days: minD,
      max_term_days: maxD,
      min_installments: minI,
      max_installments: maxI,
      default_interest_rate: Math.max(0, parseFloat(defaultInterest) || 0),
      default_term_months: defaultTermMonths,
      late_interest_rate: parseFloat(lateInterestRate) || 0,
      max_late_interest_months: Math.max(0, parseInt(maxLateInterestMonths, 10) || 12),
      collateral_grace_days: Math.max(0, parseInt(collateralGraceDays, 10) || 0),
      require_interest_paid_to_keep_collateral: keepOnInterest,
      is_active: active,
    };
  };

  const defaultTermPickOptions = termDayOptions.filter((d) => d >= minDN && d <= maxDN);

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        const minD = Math.max(1, parseInt(minTermDays, 10) || 1);
        const maxD = Math.max(1, parseInt(maxTermDays, 10) || 1);
        if (minD > maxD) {
          toast({
            title: "Prazos inválidos",
            description: "O prazo mínimo (dias) não pode ser maior que o prazo máximo.",
            variant: "destructive",
          });
          return;
        }
        const minA = parseFloat(minAmount) || 0;
        const maxA = maxAmount.trim() ? parseFloat(maxAmount) : null;
        if (maxA != null && !Number.isNaN(maxA) && minA > maxA) {
          toast({
            title: "Montantes inválidos",
            description: "O montante mínimo não pode ser superior ao montante máximo.",
            variant: "destructive",
          });
          return;
        }
        onSubmit(submitPayload());
      }}
    >
      <div className="rounded-xl border bg-gradient-to-br from-muted/40 to-muted/10 p-4 space-y-2">
        <p className="text-sm font-medium text-foreground">Como funciona</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          A cada <strong>{freqN} dia(s)</strong> o cliente deve pagar os juros desse período. Se não pagar a tempo,
          aplicam-se <strong>juros de mora</strong> (abaixo). O prazo total do empréstimo é entre{" "}
          <strong>{minDN}</strong> e <strong>{maxDN}</strong> dias — o sistema calcula{" "}
          <strong>
            {minInstCalc} a {maxInstCalc}
          </strong>{" "}
          prestações nesse ciclo.
        </p>
      </div>

      {/* Templates rápidos — só aparecem ao criar (sem `initial`) */}
      {!initial?.id && (
        <div className="rounded-xl border bg-card p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Começar a partir de um modelo
              </p>
            </div>
            <span className="text-[10px] text-muted-foreground">Opcional · pode ajustar depois</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {CATEGORY_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                className="text-left rounded-lg border p-3 hover:border-primary/40 hover:bg-primary/5 transition-colors group"
                onClick={() => {
                  setFrequencyDays(String(t.values.frequency_days));
                  setMinTermDays(String(t.values.min_term_days));
                  setMaxTermDays(String(t.values.max_term_days));
                  setDefaultTermDays(String(t.values.default_term_days));
                  setDefaultInterest(String(t.values.default_interest_rate));
                  setLateInterestRate(String(t.values.late_interest_rate));
                  setCollateralGraceDays(String(t.values.collateral_grace_days));
                  toast({
                    title: "Modelo aplicado",
                    description: `Valores de "${t.label}" carregados. Pode ajustar antes de guardar.`,
                  });
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <t.icon className="h-3.5 w-3.5 text-primary group-hover:scale-110 transition-transform" />
                  <p className="text-sm font-semibold">{t.label}</p>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">{t.description}</p>
                <p className="text-[10px] mt-1.5 text-muted-foreground tabular-nums">
                  {t.values.default_interest_rate}% juros · Mora {t.values.late_interest_rate}%
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Simulação ao vivo do empréstimo com os parâmetros actuais */}
      {(() => {
        const exampleAmount = 10000;
        const interestRate = Math.max(0, parseFloat(defaultInterest) || 0);
        const defDays = Math.max(minDN, parseInt(defaultTermDays, 10) || minDN);
        const installments = Math.max(1, Math.ceil(defDays / freqN));
        const months = Math.max(1, defDays / 30);
        const totalInterest = exampleAmount * (interestRate / 100) * months;
        const totalToPay = exampleAmount + totalInterest;
        const perInstallment = totalToPay / installments;
        const lateRate = Math.max(0, parseFloat(lateInterestRate) || 0);
        const oneMonthLatePenalty = lateRate > 0 ? exampleAmount * (lateRate / 100) : 0;
        return (
          <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-primary" />
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Simulação · empréstimo de {formatCurrency(exampleAmount)}
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Parcela</p>
                <p className="text-base font-bold tabular-nums">{formatCurrency(perInstallment)}</p>
                <p className="text-[10px] text-muted-foreground">a cada {freqN} dias</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total a pagar</p>
                <p className="text-base font-bold tabular-nums">{formatCurrency(totalToPay)}</p>
                <p className="text-[10px] text-muted-foreground">{installments} parcela(s)</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Juros totais</p>
                <p className="text-base font-bold tabular-nums text-info">{formatCurrency(totalInterest)}</p>
                <p className="text-[10px] text-muted-foreground">{interestRate}% × {months.toFixed(1)} meses</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Mora · 1 mês</p>
                <p className="text-base font-bold tabular-nums text-destructive">
                  {oneMonthLatePenalty > 0 ? `+${formatCurrency(oneMonthLatePenalty)}` : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground">se atrasar todo o saldo</p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground italic border-t border-primary/10 pt-2">
              Os valores acima reflectem em tempo real os parâmetros que está a editar.
              Apenas exemplo — empréstimos reais usam o valor solicitado pelo cliente.
            </p>
          </div>
        );
      })()}

      <div className="rounded-xl border bg-card p-4 space-y-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Identificação</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <Label>Nome da categoria</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Empréstimo mensal"
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
                onClick={() => setCode(`CAT-${Math.random().toString(36).slice(2, 6).toUpperCase()}`)}
              >
                Gerar
              </button>
            </Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="CAT-8F3K" required className="mt-1" />
          </div>
        </div>
        <div>
          <Label>Nota interna (opcional)</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Uma linha sobre quando usar esta categoria…"
            className="mt-1 resize-none"
            rows={2}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Montante mínimo (MT)</Label>
            <Input type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} min={0} className="mt-1" />
          </div>
          <div>
            <Label>Montante máximo (MT)</Label>
            <Input
              type="number"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
              min={0}
              placeholder="Vazio = sem limite"
              className="mt-1"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prazos e juros</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Pagamento de juros a cada</Label>
            <Select value={frequencyDays} onValueChange={setFrequencyDays}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {interestCycleOptions.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} dias
                    {n === 30 ? " (mensal — habitual)" : n === 15 ? " (quinzenal)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Depois deste período o juro deve ser pago; caso contrário entram juros de mora.
            </p>
          </div>
          <div>
            <Label>Prazo sugerido ao criar empréstimo</Label>
            <Select value={defaultTermDays} onValueChange={setDefaultTermDays}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Escolher" />
              </SelectTrigger>
              <SelectContent>
                {(defaultTermPickOptions.length ? defaultTermPickOptions : [minDN]).map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d} dias
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Duração mínima do empréstimo</Label>
            <Select value={minTermDays} onValueChange={(v) => setMinTermDays(v)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {termDayOptions.map((d) => (
                  <SelectItem key={`min-${d}`} value={String(d)}>
                    {d} dias
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Duração máxima do empréstimo</Label>
            <Select
              value={maxTermDays}
              onValueChange={(v) => {
                setMaxTermDays(v);
                const m = parseInt(minTermDays, 10) || 1;
                const x = parseInt(v, 10) || m;
                const cur = parseInt(defaultTermDays, 10) || m;
                if (cur > x || cur < m) setDefaultTermDays(String(Math.min(x, Math.max(m, cur))));
              }}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {termDayOptions
                  .filter((d) => d >= (parseInt(minTermDays, 10) || 1))
                  .map((d) => (
                    <SelectItem key={`max-${d}`} value={String(d)}>
                      {d} dias
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label>Taxa de juro (%)</Label>
            <Input
              type="number"
              value={defaultInterest}
              onChange={(e) => setDefaultInterest(e.target.value)}
              min={0}
              step={0.5}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Juros de mora (% / mês)</Label>
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
            <Label>Limite de meses em mora</Label>
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

      <div className="rounded-xl border bg-card p-4 space-y-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Garantia</p>
        <div>
          <Label>Dias de tolerância após atraso</Label>
          <Input
            type="number"
            value={collateralGraceDays}
            onChange={(e) => setCollateralGraceDays(e.target.value)}
            min={0}
            className="mt-1 max-w-[220px]"
          />
          <p className="text-[11px] text-muted-foreground mt-1.5 max-w-md">
            Dias em atraso antes de a instituição poder executar ou perder a garantia, conforme a sua política e a lei.
          </p>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-1">
          <div className="flex items-center gap-3">
            <Switch id="cat-keep-interest" checked={keepOnInterest} onCheckedChange={setKeepOnInterest} />
            <Label htmlFor="cat-keep-interest" className="text-sm font-normal leading-snug cursor-pointer">
              Manter garantia se o cliente pagar os juros em cada período
            </Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="cat-active" checked={active} onCheckedChange={setActive} />
            <Label htmlFor="cat-active" className="text-sm font-normal cursor-pointer">
              Categoria activa
            </Label>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Termos no contrato</p>
          <Button type="button" variant="outline" size="sm" onClick={() => setTermsAndConditions(CATEGORY_TERMS_HINT)}>
            Inserir modelo
          </Button>
        </div>
        <Textarea
          value={termsAndConditions}
          onChange={(e) => setTermsAndConditions(e.target.value)}
          placeholder="Texto que aparece no contrato para esta categoria…"
          rows={10}
          className="text-sm leading-relaxed"
        />
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={loading}>
          {loading ? "A guardar…" : submitLabel}
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
  const { data: systemSettings } = useQuery<ApiSystemSettings>({
    queryKey: ["system-settings"],
    queryFn: systemApi.get,
  });
  const systemDefaultRate = Number(systemSettings?.loan_default_interest_rate ?? 0);
  const allowedTermsDays = Array.isArray(systemSettings?.loan_allowed_terms_days) && systemSettings!.loan_allowed_terms_days.length
    ? systemSettings!.loan_allowed_terms_days
    : [15, 30, 60, 90, 120];

  const allowedTermsMonths = allowedTermsDays
    .map((d) => Math.max(1, Math.round(Number(d) / 30)))
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort((a, b) => a - b);

  const categoryTermPresets = useMemo(() => {
    const base =
      allowedTermsDays.length > 0 ? allowedTermsDays.map((d) => Number(d)).filter((n) => n > 0) : [15, 30, 60, 90, 120, 180];
    return Array.from(new Set(base)).sort((a, b) => a - b);
  }, [allowedTermsDays]);
  const [showNew, setShowNew] = useState(false);
  const [showCatDialog, setShowCatDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ApiLoanCategory | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<ApiLoan | null>(null);
  const [selectedLoanTab, setSelectedLoanTab] = useState<"details" | "payments" | "garantia" | "amortization" | "contract">("details");
  const [editingLoan, setEditingLoan] = useState<ApiLoan | null>(null);
  const [deletingLoan, setDeletingLoan] = useState<ApiLoan | null>(null);
  const [contractText, setContractText] = useState("");
  const [showNewPaymentForLoan, setShowNewPaymentForLoan] = useState(false);
  const [editingPayment, setEditingPayment] = useState<ApiPayment | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<ApiPayment | null>(null);
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
  const { canEditLoan, canDeleteLoan, canAddLoan, canManageLoanCategories, canAddLoanCategory, canChangeLoanCategory, canDeleteLoanCategory, canEditPayment, canDeletePayment } = usePermissions();

  const [pAmount, setPAmount] = useState("");
  const [pDate, setPDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [pStatus, setPStatus] = useState<"pago" | "pendente" | "atrasado">("pago");
  const [pMethod, setPMethod] = useState<"transferencia" | "m_pesa" | "emola_mkesh" | "deposito" | "dinheiro" | "outro">("dinheiro");
  const [pMethodOther, setPMethodOther] = useState("");
  const [pInstallment, setPInstallment] = useState("");
  const [pReceipt, setPReceipt] = useState("");
  const [pReceiptFile, setPReceiptFile] = useState<File | null>(null);

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

  const { data: loanPayments = [], isLoading: loanPaymentsLoading, refetch: refetchLoanPayments } = useQuery({
    queryKey: ["loan-payments", selectedLoan?.id],
    queryFn: () => (selectedLoan ? paymentsApi.list({ loan: selectedLoan.id }) : Promise.resolve([])),
    enabled: !!selectedLoan,
    placeholderData: (prev) => prev,
  });

  useEffect(() => {
    if (!selectedLoan) return;
    const next = (selectedLoan.paid_installments ?? 0) + 1;
    setPInstallment(String(next));
    setPAmount(String(selectedLoan.monthly_payment ?? ""));
    setPReceipt("");
    setPReceiptFile(null);
  }, [selectedLoan?.id]);

  const resetPaymentForm = () => {
    setPAmount("");
    setPDate(new Date().toISOString().slice(0, 10));
    setPStatus("pago");
    setPMethod("dinheiro");
    setPMethodOther("");
    setPInstallment(selectedLoan ? String((selectedLoan.paid_installments ?? 0) + 1) : "");
    setPReceipt("");
    setPReceiptFile(null);
  };

  const createPaymentForLoan = useMutation({
    mutationFn: paymentsApi.create,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["loan-payments"] });
      await queryClient.invalidateQueries({ queryKey: ["loans"] });
      setShowNewPaymentForLoan(false);
      resetPaymentForm();
      toast({ title: "Pagamento registado", description: "O pagamento foi registado com sucesso." });
    },
    onError: (error: unknown) => {
      const msg =
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: string }).message)
          : "Não foi possível registar o pagamento.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    },
  });

  const updatePaymentForLoan = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof paymentsApi.update>[1] }) =>
      paymentsApi.update(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["loan-payments"] });
      await queryClient.invalidateQueries({ queryKey: ["loans"] });
      setEditingPayment(null);
      toast({ title: "Pagamento actualizado", description: "As alterações foram guardadas." });
    },
    onError: (error: unknown) => {
      const msg =
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: string }).message)
          : "Não foi possível actualizar o pagamento.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    },
  });

  const deletePaymentForLoan = useMutation({
    mutationFn: paymentsApi.delete,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["loan-payments"] });
      await queryClient.invalidateQueries({ queryKey: ["loans"] });
      setDeletingPayment(null);
      toast({ title: "Pagamento removido", description: "O pagamento foi eliminado." });
    },
    onError: (error: unknown) => {
      const msg =
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: string }).message)
          : "Não foi possível eliminar o pagamento.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    },
  });

  const updateLoan = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof loansApi.update>[1] }) =>
      loansApi.update(id, payload),
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({ queryKey: ["loans"] });
      await queryClient.invalidateQueries({ queryKey: ["loan-amortization", updated.id] });
      setSelectedLoan((prev) => (prev?.id === updated.id ? updated : prev));
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
    onSuccess: async (created: ApiLoan) => {
      await queryClient.invalidateQueries({ queryKey: ["loans"] });
      setShowNew(false);
      setSelectedClientId("");
      setAmount("");
      setRate("");
      setTerm("");
      setHasCollateral(true);
      setCollateral({ description: "", item_type: "documento", estimated_value: "", condition: "não_aplicavel", serial_number: "", notes: "" });
      // Abrir o detalhe imediatamente e já mostrar o contrato para revisão/edição.
      setSelectedLoan(created);
      setSelectedLoanTab("contract");
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

  const [deletingCategory, setDeletingCategory] = useState<ApiLoanCategory | null>(null);
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryStatusFilter, setCategoryStatusFilter] = useState<"all" | "active" | "inactive">("all");

  /** Quantidade de empréstimos por categoria — calculado a partir da lista carregada. */
  const loanCountByCategory = useMemo(() => {
    const map: Record<number, number> = {};
    (loans ?? []).forEach((l) => {
      const cid = (l as ApiLoan & { category?: number | null }).category;
      if (cid != null) map[cid] = (map[cid] || 0) + 1;
    });
    return map;
  }, [loans]);

  const filteredCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    return categories.filter((c) => {
      if (categoryStatusFilter === "active" && !c.is_active) return false;
      if (categoryStatusFilter === "inactive" && c.is_active) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.code || "").toLowerCase().includes(q) ||
        (c.description || "").toLowerCase().includes(q)
      );
    });
  }, [categories, categorySearch, categoryStatusFilter]);

  /** Toggle inline da categoria (activa/inactiva) sem abrir o form. */
  const toggleCategoryActive = (c: ApiLoanCategory) => {
    updateCategory.mutate({ id: c.id, payload: { is_active: !c.is_active } });
  };

  /** Duplica uma categoria existente (gera código novo, prefixa nome com "Cópia"). */
  const duplicateCategory = (c: ApiLoanCategory) => {
    const newCode = `CAT-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    createCategory.mutate({
      name: `${c.name} (cópia)`,
      code: newCode,
      description: c.description,
      terms_and_conditions: c.terms_and_conditions,
      min_amount: c.min_amount,
      max_amount: c.max_amount,
      frequency_days: c.frequency_days,
      min_term_days: c.min_term_days,
      max_term_days: c.max_term_days,
      min_installments: c.min_installments,
      max_installments: c.max_installments,
      default_interest_rate: c.default_interest_rate,
      default_term_months: c.default_term_months,
      late_interest_rate: c.late_interest_rate ?? 0,
      max_late_interest_months: c.max_late_interest_months ?? 12,
      collateral_grace_days: c.collateral_grace_days,
      require_interest_paid_to_keep_collateral: c.require_interest_paid_to_keep_collateral,
      is_active: false,
    });
  };

  // Taxa e prazo vêm da categoria (definidos em Configurações), sempre que a categoria muda
  useEffect(() => {
    if (!selectedCategoryId || selectedCategoryId === "none") return;
    const cat = categories.find((c) => String(c.id) === selectedCategoryId);
    if (!cat) return;
    const catRate = Number(cat.default_interest_rate ?? 0);
    setRate(String(catRate || systemDefaultRate || 0));
    setTerm(String(cat.default_term_months ?? 12));
  }, [selectedCategoryId, categories, systemDefaultRate]);

  const selectedNewLoanCategory =
    selectedCategoryId !== "none"
      ? categories.find((c) => String(c.id) === selectedCategoryId)
      : undefined;
  const previewRate = selectedNewLoanCategory
    ? Number(selectedNewLoanCategory.default_interest_rate ?? 0)
    : (parseFloat(rate) || 0);
  const previewTerm = selectedNewLoanCategory
    ? Math.max(1, Number(selectedNewLoanCategory.default_term_months ?? 1))
    : (parseInt(term, 10) || 1);
  const calc = computeLoanPreview(amt, previewRate, previewTerm);

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
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Novo Empréstimo</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Escolha a <span className="font-medium text-foreground">categoria</span> em Configurações: a taxa e o prazo
                  padrão vêm dela. Sem categoria, define juros e parcelas manualmente.
                </p>
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
                    {selectedCategoryId !== "none" && selectedNewLoanCategory ? (
                      <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Regras da categoria (Configurações)
                        </p>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-muted-foreground text-xs block">Juro padrão</span>
                            <span className="font-semibold">{selectedNewLoanCategory.default_interest_rate}%</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs block">Parcelas padrão</span>
                            <span className="font-semibold">{selectedNewLoanCategory.default_term_months} meses</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs block">Frequência</span>
                            <span className="font-medium">{selectedNewLoanCategory.frequency_days} dias</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs block">Parcelas permitidas</span>
                            <span className="font-medium">
                              {selectedNewLoanCategory.min_installments}–{selectedNewLoanCategory.max_installments}
                            </span>
                          </div>
                          {(selectedNewLoanCategory.late_interest_rate ?? 0) > 0 && (
                            <div className="col-span-2">
                              <span className="text-muted-foreground text-xs block">Juros de mora (categoria)</span>
                              <span className="font-medium">
                                {selectedNewLoanCategory.late_interest_rate}% / mês
                                {selectedNewLoanCategory.max_late_interest_months != null
                                  ? ` · máx. ${selectedNewLoanCategory.max_late_interest_months} meses`
                                  : ""}
                              </span>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Para mudar estes valores, edite a categoria no separador <span className="font-medium">Configurações</span>.
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-lg border bg-amber-500/10 p-4 space-y-3">
                        <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                          Sem categoria — defina juros e parcelas manualmente
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
                            <Label>Prazo (dias)</Label>
                            <Select
                              value={String((parseInt(term, 10) || 1) * 30)}
                              onValueChange={(v) => setTerm(String(Math.max(1, Math.round(parseInt(v, 10) / 30))))}
                            >
                              <SelectTrigger className="mt-1"><SelectValue placeholder="Selecionar prazo" /></SelectTrigger>
                              <SelectContent>
                                {allowedTermsMonths.map((m) => (
                                  <SelectItem key={m} value={String(m * 30)}>{m * 30} dias</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-[11px] text-muted-foreground mt-1">
                              Prazos comuns (30/60/90/120). Internamente isto vira “parcelas” (\(mês≈30 dias\)).
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
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
                      <span className="text-sm font-medium">Pré-visualização (igual ao cálculo do sistema)</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Taxa aplicada: <strong>{previewRate}%</strong> · Parcelas: <strong>{previewTerm}</strong>
                      {selectedCategoryId !== "none" && selectedNewLoanCategory && (
                        <> · Categoria: <strong>{selectedNewLoanCategory.name}</strong></>
                      )}
                    </p>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div><span className="text-muted-foreground block text-xs">Parcela (média)</span><p className="font-bold">{formatCurrency(calc.monthly)}</p></div>
                      <div><span className="text-muted-foreground block text-xs">Total juros</span><p className="font-bold">{formatCurrency(calc.interestTotal)}</p></div>
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
                    !term.trim() ||
                    (selectedCategoryId === "none" && !rate.trim())
                  }
                  onClick={() => {
                    const client = parseInt(selectedClientId, 10);
                    if (hasCollateral && !collateral.description.trim()) {
                      toast({
                        title: "Garantia obrigatória",
                        description: "Preencha a descrição do item de garantia (ou desative a opção de garantia).",
                        variant: "destructive",
                      });
                      return;
                    }
                    const a = parseFloat(amount) || 0;
                    const r = selectedNewLoanCategory
                      ? Number(selectedNewLoanCategory.default_interest_rate ?? 0)
                      : (parseFloat(rate) || 0);
                    const t = selectedNewLoanCategory
                      ? Math.max(1, Number(selectedNewLoanCategory.default_term_months ?? 1))
                      : (parseInt(term, 10) || 1);
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
              Tipos de empréstimo
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
            emptyState={
              <EmptyState
                icon={Wallet}
                title="Nenhum empréstimo activo"
                description="Quando criar um empréstimo a partir do perfil de um cliente, ele aparecerá aqui."
              />
            }
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
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedLoan(l);
                            setSelectedLoanTab("contract");
                          }}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Ver contrato
                        </DropdownMenuItem>
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

        <TabsContent value="settings" className="space-y-5">
          {/* KPIs das categorias */}
          {(() => {
            const total = categories.length;
            const active = categories.filter((c) => c.is_active).length;
            const inUse = categories.filter((c) => (loanCountByCategory[c.id] ?? 0) > 0).length;
            const mostUsed = [...categories]
              .map((c) => ({ c, n: loanCountByCategory[c.id] ?? 0 }))
              .sort((a, b) => b.n - a.n)[0];
            return (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 text-primary p-2">
                      <Layers className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total</p>
                      <p className="text-lg font-bold tracking-tight">{total}</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-success/10 text-success p-2">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Activas</p>
                      <p className="text-lg font-bold tracking-tight">{active}</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-info/10 text-info p-2">
                      <Activity className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Em uso</p>
                      <p className="text-lg font-bold tracking-tight">{inUse}</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-accent/10 text-accent p-2">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Mais usada</p>
                      <p className="text-sm font-bold tracking-tight truncate" title={mostUsed?.c.name ?? "—"}>
                        {mostUsed && mostUsed.n > 0 ? `${mostUsed.c.name} · ${mostUsed.n}` : "—"}
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            );
          })()}

          <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
            <div className="p-5 border-b flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-semibold text-lg tracking-tight flex items-center gap-2">
                  <FolderOpen className="h-5 w-5 text-primary" />
                  Tipos de empréstimo
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
                  Defina políticas reutilizáveis: prazo, juros, frequência de pagamento e regras da garantia.
                  Cada empréstimo herda as configurações da categoria escolhida.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Pesquisar categoria…"
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    className="pl-8 h-9"
                  />
                </div>
                <Select value={categoryStatusFilter} onValueChange={(v: "all" | "active" | "inactive") => setCategoryStatusFilter(v)}>
                  <SelectTrigger className="h-9 w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Activas</SelectItem>
                    <SelectItem value="inactive">Inactivas</SelectItem>
                  </SelectContent>
                </Select>
                {canAddLoanCategory && (
                  <Button onClick={() => setShowCatDialog(true)}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Novo tipo
                  </Button>
                )}
              </div>
            </div>

            {filteredCategories.length === 0 ? (
              <EmptyState
                icon={FolderOpen}
                title={
                  categories.length === 0
                    ? "Nenhuma categoria de empréstimo"
                    : "Nenhuma categoria corresponde à pesquisa"
                }
                description={
                  categories.length === 0
                    ? "Crie a sua primeira política. Pode começar por um modelo (Mensal 30 dias, Trimestral 90 dias)."
                    : "Tente outro termo ou limpe os filtros."
                }
                action={
                  categories.length === 0 && canAddLoanCategory ? (
                    <Button onClick={() => setShowCatDialog(true)}>
                      <Plus className="h-4 w-4 mr-1.5" />
                      Criar primeira categoria
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Categoria</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Juros</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Frequência</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Duração</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Garantia</th>
                      <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">Em uso</th>
                      <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">Activa</th>
                      <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Acções</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCategories.map((c) => {
                      const usage = loanCountByCategory[c.id] ?? 0;
                      return (
                        <tr key={c.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <div className={`mt-0.5 h-7 w-7 rounded-md flex items-center justify-center shrink-0 ${
                                c.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                              }`}>
                                <Tag className="h-3.5 w-3.5" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium truncate">{c.name}</p>
                                {c.code && (
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">
                                    {c.code}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold tabular-nums">{c.default_interest_rate}%</p>
                            {(c.late_interest_rate ?? 0) > 0 && (
                              <p className="text-[10px] text-muted-foreground">
                                + Mora {c.late_interest_rate}%/mês
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <p className="tabular-nums font-medium">{c.frequency_days}d</p>
                            <p className="text-[10px] text-muted-foreground">
                              {c.frequency_days === 30 ? "mensal" : c.frequency_days === 15 ? "quinzenal" : c.frequency_days === 7 ? "semanal" : "personalizada"}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="tabular-nums">
                              {c.min_term_days}–{c.max_term_days}d
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {c.min_installments}–{c.max_installments} parc.
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs">
                              {c.collateral_grace_days > 0 ? `${c.collateral_grace_days}d tolerância` : "Sem tolerância"}
                            </p>
                            {c.require_interest_paid_to_keep_collateral && (
                              <p className="text-[10px] text-muted-foreground">Mantida se pagar juros</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {usage > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-info/10 text-info px-2 py-0.5 text-xs font-semibold tabular-nums">
                                {usage}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {canChangeLoanCategory ? (
                              <button
                                type="button"
                                onClick={() => toggleCategoryActive(c)}
                                disabled={updateCategory.isLoading}
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                                  c.is_active
                                    ? "bg-success/15 text-success hover:bg-success/25"
                                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                                }`}
                                title={c.is_active ? "Clique para desativar" : "Clique para ativar"}
                              >
                                <Power className="h-3 w-3" />
                                {c.is_active ? "Sim" : "Não"}
                              </button>
                            ) : (
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                c.is_active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                              }`}>
                                {c.is_active ? "Sim" : "Não"}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {(canChangeLoanCategory || canDeleteLoanCategory || canAddLoanCategory) && (
                              <div className="inline-flex gap-0.5">
                                {canChangeLoanCategory && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => setEditingCategory(c)}
                                    title="Editar"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                {canAddLoanCategory && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => duplicateCategory(c)}
                                    title="Duplicar"
                                    disabled={createCategory.isLoading}
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                {canDeleteLoanCategory && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                    onClick={() => setDeletingCategory(c)}
                                    title={usage > 0 ? `${usage} empréstimo(s) usam esta — eliminação bloqueada` : "Eliminar"}
                                    disabled={usage > 0}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Confirm de eliminação */}
          <AlertDialog open={!!deletingCategory} onOpenChange={(o) => !o && setDeletingCategory(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Eliminar categoria?</AlertDialogTitle>
                <AlertDialogDescription>
                  A categoria <strong>{deletingCategory?.name}</strong> será removida permanentemente.
                  Empréstimos já criados não serão afectados, mas perderão a referência.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => {
                    if (deletingCategory) {
                      deleteCategory.mutate(deletingCategory.id);
                      setDeletingCategory(null);
                    }
                  }}
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>
      </Tabs>

      <Dialog open={showCatDialog} onOpenChange={setShowCatDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto border-0 shadow-xl sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Novo tipo de empréstimo</DialogTitle>
          </DialogHeader>
          <LoanCategoryForm
            allowedTermPresets={categoryTermPresets}
            onSubmit={(payload) => createCategory.mutate(payload)}
            loading={createCategory.isLoading}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingCategory} onOpenChange={(o) => !o && setEditingCategory(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto border-0 shadow-xl sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Editar tipo de empréstimo</DialogTitle>
          </DialogHeader>
          {editingCategory && (
            <LoanCategoryForm
              allowedTermPresets={categoryTermPresets}
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
      <Dialog
        open={!!selectedLoan}
        onOpenChange={(o) => {
          if (!o) {
            setSelectedLoan(null);
            setSelectedLoanTab("details");
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
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

              <Tabs value={selectedLoanTab} onValueChange={(v) => setSelectedLoanTab(v as any)} className="mt-2">
                <TabsList className="flex-wrap h-auto gap-1 bg-muted/50 p-1 rounded-xl">
                  <TabsTrigger value="details" className="rounded-lg"><ScrollText className="h-4 w-4 mr-1" />Detalhes</TabsTrigger>
                  <TabsTrigger value="payments" className="rounded-lg"><HandCoins className="h-4 w-4 mr-1" />Pagamentos</TabsTrigger>
                  <TabsTrigger value="garantia" className="rounded-lg"><Shield className="h-4 w-4 mr-1" />Garantia</TabsTrigger>
                  <TabsTrigger value="amortization" className="rounded-lg"><Table className="h-4 w-4 mr-1" />Amortização</TabsTrigger>
                  <TabsTrigger value="contract" className="rounded-lg"><FileText className="h-4 w-4 mr-1" />Contrato</TabsTrigger>
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

                  {selectedLoan.collateral ? (
                    <p className="text-xs text-muted-foreground">
                      Item de garantia na aba <span className="font-medium text-foreground">Garantia</span>.
                    </p>
                  ) : null}
                </TabsContent>

                <TabsContent value="payments" className="space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <p className="font-semibold">Pagamentos do empréstimo</p>
                      <p className="text-xs text-muted-foreground">
                        Registos associados ao empréstimo {selectedLoan.id}. Use isto para controlar parcelas pagas e pendentes.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetchLoanPayments()}
                        disabled={loanPaymentsLoading}
                      >
                        Actualizar
                      </Button>
                      {canEditPayment && (
                        <Dialog open={showNewPaymentForLoan} onOpenChange={(o) => { setShowNewPaymentForLoan(o); if (!o) resetPaymentForm(); }}>
                          <DialogTrigger asChild>
                            <Button size="sm">
                              <Plus className="h-4 w-4 mr-1.5" />
                              Registar pagamento
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md">
                            <DialogHeader>
                              <DialogTitle>Novo pagamento</DialogTitle>
                            </DialogHeader>
                            <form
                              className="space-y-3"
                              onSubmit={(e) => {
                                e.preventDefault();
                                if (!selectedLoan) return;
                                const amt = parseFloat(String(pAmount).replace(",", ".")) || 0;
                                const inst = parseInt(pInstallment, 10) || 1;
                                createPaymentForLoan.mutate({
                                  loan: selectedLoan.id,
                                  amount: amt,
                                  date: pDate,
                                  status: pStatus,
                                  method: pMethod,
                                  method_other: pMethod === "outro" ? pMethodOther.trim() || undefined : undefined,
                                  installment_number: inst,
                                  receipt: pReceipt.trim() || undefined,
                                  receipt_file: pReceiptFile || undefined,
                                });
                              }}
                            >
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="sm:col-span-2">
                                  <Label>Montante (MT)</Label>
                                  <Input value={pAmount} onChange={(e) => setPAmount(e.target.value)} type="number" />
                                </div>
                                <div>
                                  <Label>Data</Label>
                                  <Input value={pDate} onChange={(e) => setPDate(e.target.value)} type="date" />
                                </div>
                                <div>
                                  <Label>Prestação #</Label>
                                  <Input value={pInstallment} onChange={(e) => setPInstallment(e.target.value)} type="number" min={1} />
                                </div>
                                <div>
                                  <Label>Status</Label>
                                  <Select value={pStatus} onValueChange={(v) => setPStatus(v as any)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="pago">Pago</SelectItem>
                                      <SelectItem value="pendente">Pendente</SelectItem>
                                      <SelectItem value="atrasado">Atrasado</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label>Método</Label>
                                  <Select value={pMethod} onValueChange={(v) => setPMethod(v as any)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {Object.entries(PAYMENT_METHOD_LABELS).map(([k, label]) => (
                                        <SelectItem key={k} value={k}>{label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                {pMethod === "outro" && (
                                  <div className="sm:col-span-2">
                                    <Label>Especificar método</Label>
                                    <Input value={pMethodOther} onChange={(e) => setPMethodOther(e.target.value)} />
                                  </div>
                                )}
                                <div className="sm:col-span-2">
                                  <Label>Recibo / referência (opcional)</Label>
                                  <Input value={pReceipt} onChange={(e) => setPReceipt(e.target.value)} placeholder="Ex.: REC-2026-001" />
                                </div>
                                <div className="sm:col-span-2">
                                  <Label>Ficheiro do recibo (opcional)</Label>
                                  <Input
                                    type="file"
                                    onChange={(e) => setPReceiptFile(e.target.files?.[0] ?? null)}
                                  />
                                </div>
                              </div>
                              <Button type="submit" className="w-full" disabled={createPaymentForLoan.isLoading || !pAmount}>
                                {createPaymentForLoan.isLoading ? "A guardar..." : "Guardar pagamento"}
                              </Button>
                            </form>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  </div>

                  {loanPayments.length === 0 ? (
                    <div className="rounded-xl border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                      Sem pagamentos registados para este empréstimo.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50 border-b">
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Data</th>
                            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Montante</th>
                            <th className="px-3 py-2 text-center font-medium text-muted-foreground">Prestação</th>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Método</th>
                            <th className="px-3 py-2 text-center font-medium text-muted-foreground">Status</th>
                            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Acções</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loanPayments.map((p) => (
                            <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20">
                              <td className="px-3 py-2">{formatDate(p.date)}</td>
                              <td className="px-3 py-2 text-right font-medium">{formatCurrency(p.amount)}</td>
                              <td className="px-3 py-2 text-center">{p.installment_number}</td>
                              <td className="px-3 py-2">
                                {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                                {p.method === "outro" && p.method_other ? ` (${p.method_other})` : ""}
                                {p.receipt ? <span className="text-xs text-muted-foreground"> · {p.receipt}</span> : null}
                              </td>
                              <td className="px-3 py-2 text-center"><StatusBadge status={p.status} /></td>
                              <td className="px-3 py-2 text-right">
                                {(canEditPayment || canDeletePayment) ? (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      {canEditPayment && (
                                        <DropdownMenuItem
                                          onClick={() => {
                                            setEditingPayment(p);
                                          }}
                                        >
                                          <Pencil className="h-4 w-4 mr-2" />Editar
                                        </DropdownMenuItem>
                                      )}
                                      {canDeletePayment && (
                                        <DropdownMenuItem
                                          className="text-destructive"
                                          onClick={() => setDeletingPayment(p)}
                                        >
                                          <Trash2 className="h-4 w-4 mr-2" />Eliminar
                                        </DropdownMenuItem>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <Dialog open={!!editingPayment} onOpenChange={(o) => !o && setEditingPayment(null)}>
                    <DialogContent className="max-w-md">
                      <DialogHeader><DialogTitle>Editar pagamento</DialogTitle></DialogHeader>
                      {editingPayment && (
                        <form
                          className="space-y-3"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const amt = parseFloat(String(pAmount || editingPayment.amount).replace(",", ".")) || 0;
                            const inst = parseInt(pInstallment || String(editingPayment.installment_number), 10) || 1;
                            updatePaymentForLoan.mutate({
                              id: editingPayment.id,
                              payload: {
                                amount: amt,
                                date: pDate || editingPayment.date,
                                status: pStatus || editingPayment.status,
                                method: pMethod || editingPayment.method,
                                method_other: (pMethod || editingPayment.method) === "outro" ? (pMethodOther || editingPayment.method_other || "") : "",
                                installment_number: inst,
                                receipt: pReceipt || editingPayment.receipt || "",
                              },
                            });
                          }}
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="sm:col-span-2">
                              <Label>Montante (MT)</Label>
                              <Input
                                defaultValue={String(editingPayment.amount)}
                                onChange={(e) => setPAmount(e.target.value)}
                                type="number"
                              />
                            </div>
                            <div>
                              <Label>Data</Label>
                              <Input defaultValue={editingPayment.date} onChange={(e) => setPDate(e.target.value)} type="date" />
                            </div>
                            <div>
                              <Label>Prestação #</Label>
                              <Input defaultValue={String(editingPayment.installment_number)} onChange={(e) => setPInstallment(e.target.value)} type="number" min={1} />
                            </div>
                            <div>
                              <Label>Status</Label>
                              <Select defaultValue={editingPayment.status} onValueChange={(v) => setPStatus(v as any)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pago">Pago</SelectItem>
                                  <SelectItem value="pendente">Pendente</SelectItem>
                                  <SelectItem value="atrasado">Atrasado</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Método</Label>
                              <Select defaultValue={editingPayment.method} onValueChange={(v) => setPMethod(v as any)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {Object.entries(PAYMENT_METHOD_LABELS).map(([k, label]) => (
                                    <SelectItem key={k} value={k}>{label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="sm:col-span-2">
                              <Label>Recibo / referência (opcional)</Label>
                              <Input defaultValue={editingPayment.receipt || ""} onChange={(e) => setPReceipt(e.target.value)} />
                            </div>
                          </div>
                          <Button type="submit" className="w-full" disabled={updatePaymentForLoan.isLoading}>
                            {updatePaymentForLoan.isLoading ? "A guardar..." : "Guardar alterações"}
                          </Button>
                        </form>
                      )}
                    </DialogContent>
                  </Dialog>

                  <AlertDialog open={!!deletingPayment} onOpenChange={(o) => !o && setDeletingPayment(null)}>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Eliminar pagamento?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acção não pode ser revertida.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => deletingPayment && deletePaymentForLoan.mutate(deletingPayment.id)}
                        >
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TabsContent>

                <TabsContent value="garantia" className="space-y-4">
                  {selectedLoan.collateral ? (
                    <div className="border rounded-lg p-4 bg-muted/30">
                      <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        Item de Garantia
                      </h4>
                      <div className="text-sm space-y-1">
                        <p><span className="text-muted-foreground">Descrição:</span> {selectedLoan.collateral.description}</p>
                        <p><span className="text-muted-foreground">Tipo:</span> {COLLATERAL_TYPES.find((t) => t.value === selectedLoan.collateral!.item_type)?.label ?? selectedLoan.collateral!.item_type}</p>
                        {selectedLoan.collateral.estimated_value != null && selectedLoan.collateral.estimated_value > 0 && (
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
                  ) : (
                    <p className="text-sm text-muted-foreground py-6 text-center">
                      Nenhum item de garantia registado neste empréstimo.
                    </p>
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
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Empréstimo</DialogTitle></DialogHeader>
          {editingLoan && (
            <LoanEditForm
              loan={editingLoan}
              clients={clients ?? []}
              categories={categories}
              allowedTermsMonths={allowedTermsMonths}
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

function loanEditSyncToken(loan: ApiLoan): string {
  return JSON.stringify({
    id: loan.id,
    client: loan.client,
    category: loan.category ?? null,
    amount: loan.amount,
    interest_rate: loan.interest_rate,
    term: loan.term,
    start_date: loan.start_date,
    end_date: loan.end_date,
    collateral: loan.collateral
      ? {
          id: loan.collateral.id,
          description: loan.collateral.description,
          item_type: loan.collateral.item_type,
          estimated_value: loan.collateral.estimated_value,
          condition: loan.collateral.condition,
          serial_number: loan.collateral.serial_number,
          notes: loan.collateral.notes,
        }
      : null,
  });
}

function LoanEditForm({
  loan,
  clients,
  categories,
  allowedTermsMonths,
  onSubmit,
  isLoading,
}: {
  loan: ApiLoan;
  clients: ApiClient[];
  categories: ApiLoanCategory[];
  allowedTermsMonths: number[];
  onSubmit: (payload: Parameters<typeof loansApi.update>[1]) => void;
  isLoading: boolean;
}) {
  const c = loan.collateral;
  const [clientId, setClientId] = useState(String(loan.client));
  const [categoryId, setCategoryId] = useState<string>(
    loan.category != null ? String(loan.category) : "none",
  );
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

  const syncTok = loanEditSyncToken(loan);
  useEffect(() => {
    setClientId(String(loan.client));
    setCategoryId(loan.category != null ? String(loan.category) : "none");
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
  }, [syncTok, loan]);

  const selectedCat =
    categoryId !== "none" ? categories.find((x) => String(x.id) === categoryId) : undefined;

  const handleCategoryChange = (v: string) => {
    setCategoryId(v);
    if (v === "none") return;
    const cat = categories.find((x) => String(x.id) === v);
    if (cat) {
      setRate(String(cat.default_interest_rate ?? 0));
      setTerm(String(cat.default_term_months ?? 12));
    }
  };

  const amt = parseFloat(amount) || 0;
  const previewRate = parseFloat(rate) || 0;
  const previewTerm = parseInt(term, 10) || 1;
  const preview = computeLoanPreview(amt, previewRate, previewTerm);

  return (
    <div className="space-y-4">
      <Tabs defaultValue="dados" className="w-full">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="dados">Dados do empréstimo</TabsTrigger>
          <TabsTrigger value="garantia">Item de garantia</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="space-y-4 mt-4">
          <div>
            <Label>Cliente</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder="Cliente" /></SelectTrigger>
              <SelectContent>
                {clients.filter((cl) => cl.status === "ativo").map((client) => (
                  <SelectItem key={client.id} value={String(client.id)}>{client.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Categoria</Label>
            <Select value={categoryId} onValueChange={handleCategoryChange}>
              <SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem categoria</SelectItem>
                {categories.filter((cat) => cat.is_active).map((cat) => (
                  <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Ao mudar a categoria, a taxa e o prazo são sugeridos a partir de Configurações; pode ajustar abaixo se este
              contrato tiver condições específicas.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-3">
              <Label>Valor (MT)</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div><Label>Juros (%)</Label><Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} step={0.5} /></div>
            <div>
              <Label>Prazo (dias)</Label>
              <Select
                value={String((parseInt(term, 10) || 1) * 30)}
                onValueChange={(v) => setTerm(String(Math.max(1, Math.round(parseInt(v, 10) / 30))))}
              >
                <SelectTrigger><SelectValue placeholder="Selecionar prazo" /></SelectTrigger>
                <SelectContent>
                  {allowedTermsMonths.map((m) => (
                    <SelectItem key={m} value={String(m * 30)}>{m * 30} dias</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedCat && (
            <div className="rounded-lg border bg-muted/20 p-3 text-xs space-y-1">
              <p className="font-medium text-foreground">{selectedCat.name}</p>
              <p className="text-muted-foreground">
                Frequência {selectedCat.frequency_days} dias · Parcelas permitidas{" "}
                {selectedCat.min_installments}–{selectedCat.max_installments}
                {(selectedCat.late_interest_rate ?? 0) > 0
                  ? ` · Mora ${selectedCat.late_interest_rate}%/mês`
                  : ""}
              </p>
            </div>
          )}

          {amt > 0 && term.trim() && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-primary text-sm font-medium">
                <Calculator className="h-4 w-4" />
                Pré-visualização
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs sm:text-sm">
                <div>
                  <span className="text-muted-foreground block text-[10px] sm:text-xs">Parcela</span>
                  <span className="font-semibold">{formatCurrency(preview.monthly)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] sm:text-xs">Juros total</span>
                  <span className="font-semibold">{formatCurrency(preview.interestTotal)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] sm:text-xs">Total a pagar</span>
                  <span className="font-semibold">{formatCurrency(preview.total)}</span>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Data início</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div><Label>Data fim</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          </div>
        </TabsContent>

        <TabsContent value="garantia" className="mt-4 space-y-3">
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
        </TabsContent>
      </Tabs>

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
            category: categoryId === "none" ? null : parseInt(categoryId, 10),
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
