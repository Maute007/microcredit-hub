/**
 * Labels e textos de ajuda para permissões, em linguagem amigável (não técnica).
 * Transforma nomes de modelos/funções (ex: historicalclient) em nomes legíveis.
 */

export const MODULE_LABELS: Record<string, string> = {
  accounts: "Utilizadores e Acesso",
  clients: "Clientes",
  loans: "Empréstimos",
  hr: "Recursos Humanos",
  accounting: "Contabilidade",
  calendario: "Calendário",
  reports: "Relatórios",
  dashboard: "Painel",
};

/** Mapeia nomes técnicos de modelos para nomes amigáveis (inclui modelos historical*) */
export const RESOURCE_LABELS: Record<string, string> = {
  // Modelos principais
  client: "Clientes",
  loan: "Empréstimos",
  payment: "Pagamentos",
  loancategory: "Categorias de empréstimo",
  collateral: "Garantias",
  employee: "Colaboradores",
  vacation: "Férias",
  attendancerecord: "Pontos e presenças",
  salaryslip: "Folhas de vencimento",
  payrolladjustment: "Ajustes salariais",
  transaction: "Transacções",
  tax: "Impostos",
  calendarevent: "Eventos do calendário",
  user: "Utilizadores",
  role: "Papéis",
  profile: "Perfis",
  systemsettings: "Configurações do sistema",
  hrsettings: "Configurações de RH",
  // Modelos de histórico (simple_history) — nomes amigáveis
  historicalclient: "Histórico de clientes",
  historicalloan: "Histórico de empréstimos",
  historicalpayment: "Histórico de pagamentos",
  historicalloancategory: "Histórico de categorias",
  historicalcollateral: "Histórico de garantias",
  historicaluser: "Histórico de utilizadores",
  historicalprofile: "Histórico de perfis",
  historicalrole: "Histórico de papéis",
  historicalemployee: "Histórico de colaboradores",
  historicalvacation: "Histórico de férias",
  historicalattendancerecord: "Histórico de presenças",
  historicalsalaryslip: "Histórico de vencimentos",
  historicalpayrolladjustment: "Histórico de ajustes salariais",
  historicaltransaction: "Histórico de transacções",
  historicaltax: "Histórico de impostos",
};

/**
 * Retorna o nome amigável para um modelo. Se não existir mapeamento,
 * transforma "historicalclient" → "Histórico de clientes" (extrai base).
 */
export function getFriendlyResourceName(modelKey: string): string {
  const key = modelKey.toLowerCase();
  if (RESOURCE_LABELS[key]) return RESOURCE_LABELS[key];
  if (key.startsWith("historical")) {
    const base = key.replace(/^historical/, "");
    const baseLabel = RESOURCE_LABELS[base];
    return baseLabel ? `Histórico de ${baseLabel.toLowerCase()}` : `Histórico`;
  }
  return key;
}

/** Labels amigáveis para as acções (em vez de view/add/change/delete) */
export const ACTION_LABELS: Record<string, string> = {
  view: "Ver e consultar",
  add: "Registrar novos",
  change: "Alterar registos",
  delete: "Remover",
};

/**
 * Textos de ajuda que explicam o que acontece ao escolher ou não cada opção.
 * Aparecem apenas quando o utilizador clica no botão de ajuda.
 */
export function getPermissionHelpText(
  action: "view" | "add" | "change" | "delete",
  resourceLabel: string
): string {
  const r = resourceLabel.toLowerCase();
  switch (action) {
    case "view":
      return `Se activar: o utilizador poderá ver e consultar ${r} no sistema. O módulo aparecerá no menu lateral.\n\nSe não activar: o utilizador não verá este módulo nem terá acesso aos dados.`;
    case "add":
      return `Se activar: o utilizador poderá criar e registar novos ${r}.\n\nSe não activar: o utilizador verá os dados existentes mas não poderá adicionar novos.`;
    case "change":
      return `Se activar: o utilizador poderá editar e alterar ${r} já existentes.\n\nSe não activar: poderá ver mas não modificar os dados.`;
    case "delete":
      return `Se activar: o utilizador poderá eliminar ${r}. Esta acção é irreversível.\n\nRecomendação: conceda apenas a quem precisa desta responsabilidade.`;
    default:
      return "";
  }
}
