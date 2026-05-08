const rawApiBase = import.meta.env.VITE_API_BASE_URL?.trim();
const API_BASE = rawApiBase ? rawApiBase.replace(/\/$/, "") : "/api";

let onUnauthorized: (() => void) | null = null;
let sessionExpired = false;

/** Um único refresh em voo para vários 401 simultâneos (access expirado). */
let refreshInFlight: Promise<boolean> | null = null;

type RefreshResult = "ok" | "invalid" | "error";

let refreshInFlightV2: Promise<RefreshResult> | null = null;

function scheduleRefreshAttempt(): Promise<RefreshResult> {
  // Mantém compatibilidade: substitui a antiga lógica booleana por um resultado mais robusto.
  if (!refreshInFlightV2) {
    refreshInFlightV2 = (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/refresh/`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
        if (res.ok) return "ok";
        // Se o refresh foi negado, é porque o refresh token/cookie já não é válido.
        if (res.status === 401 || res.status === 403) return "invalid";
        // Outras falhas (5xx, etc.) não devem matar a sessão de imediato.
        return "error";
      } catch {
        return "error";
      }
    })();
    void refreshInFlightV2.finally(() => {
      refreshInFlightV2 = null;
    });
  }
  return refreshInFlightV2;
}

// (Legacy) Mantido apenas para não quebrar imports/uso antigo, se existir.
// Preferir `scheduleRefreshAttempt()` (v2) acima.
function scheduleRefreshAttemptLegacy(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const res = await fetch(`${API_BASE}/auth/refresh/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      return res.ok;
    })();
    void refreshInFlight.finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

function isAuthRecoveryPath(path: string): boolean {
  return (
    path.includes("/auth/login") ||
    path.includes("/auth/refresh") ||
    path.includes("/auth/me") ||
    path.includes("/auth/logout")
  );
}

export function setOnUnauthorized(fn: (() => void) | null) {
  onUnauthorized = fn;
}

export function setSessionExpired(expired: boolean) {
  sessionExpired = expired;
}

export function isSessionExpired() {
  return sessionExpired;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
  }
}

async function fetchApi<T>(
  path: string,
  options: RequestInit = {},
  didRefreshRetry = false
): Promise<T> {
  // Sessão considerada morta: bloquear pedidos exceto login/refresh/me (tentar recuperar com refresh em 401)
  if (sessionExpired && !isAuthRecoveryPath(path)) {
    throw new ApiError("Sessão expirada", 401);
  }
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const isFormData = options.body instanceof FormData;
  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: isFormData
      ? { ...options.headers }
      : {
          "Content-Type": "application/json",
          ...options.headers,
        },
  });

  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  // Se o servidor devolveu HTML em vez de JSON numa resposta 200, significa que
  // a rota /api não existe neste servidor (ex: Nginx servindo index.html para tudo).
  // Tratamos como 502 para não autenticar indevidamente.
  if (res.ok && !contentType.includes("application/json") && typeof data === "string" && data.trimStart().startsWith("<")) {
    throw new ApiError(
      "O servidor de API não está acessível. Verifique VITE_API_BASE_URL.",
      502
    );
  }

  if (!res.ok) {
    if (res.status === 401) {
      const canTryRefresh =
        !didRefreshRetry &&
        !path.includes("/auth/login") &&
        !path.includes("/auth/refresh") &&
        !path.includes("/auth/logout");

      if (canTryRefresh) {
        const refreshResult = await scheduleRefreshAttempt();
        if (refreshResult === "ok") {
          sessionExpired = false;
          return fetchApi<T>(path, options, true);
        }
        if (refreshResult === "error") {
          // Não matar sessão em falha temporária (rede/backend instável).
          // Deixa o utilizador logado e permite nova tentativa no próximo request/visibility refresh.
          throw new ApiError("Não foi possível renovar a sessão. Tente novamente.", 0, data);
        }
      }

      sessionExpired = true;
      // Evitar loop: não chamar onUnauthorized a partir do próprio logout
      if (!path.includes("/auth/logout") && onUnauthorized) {
        onUnauthorized();
      }
    }
    let msg = (data as { detail?: string })?.detail ?? (data as { message?: string })?.message ?? res.statusText;
    // DRF validation errors: { "field": ["error1", "error2"] }
    if (typeof data === "object" && data !== null && !Array.isArray(data) && !("detail" in data)) {
      const parts = Object.entries(data).map(([k, v]) =>
        `${k}: ${Array.isArray(v) ? v.join("; ") : String(v)}`
      );
      if (parts.length) msg = parts.join(" | ");
    }
    throw new ApiError(String(msg), res.status, data);
  }

  return data as T;
}

// --- Auth ---

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_superuser?: boolean;
  is_staff?: boolean;
  is_active: boolean;
  date_joined: string;
  role?: { id: number; code: string; name: string };
  profile?: {
    id: number;
    phone: string;
    avatar: string | null;
    address: string;
    birth_date: string | null;
    job_title: string;
  };
  permissions?: string[];
}

export interface LoginResponse {
  user: AuthUser;
  detail?: string;
}

export const authApi = {
  login: (identifier: string, password: string) =>
    fetchApi<LoginResponse>("/auth/login/", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    }),

  logout: () =>
    fetchApi<{ detail: string }>("/auth/logout/", { method: "POST" }),

  refresh: () =>
    fetchApi<{ detail: string }>("/auth/refresh/", { method: "POST" }),

  me: () => fetchApi<AuthUser>("/auth/me/"),
  audit: (params?: { user?: number; date_from?: string; date_to?: string; action_type?: string; limit?: number; offset?: number }) => {
    const p = { ...params };
    delete (p as Record<string, unknown>).format;
    const qs = p && Object.keys(p).length
      ? "?" + new URLSearchParams(
          Object.entries(p).filter(([, v]) => v != null && v !== "") as [string, string][]
        ).toString()
      : "";
    return fetchApi<{ results: ApiAuditEntry[]; count: number; limit: number; offset: number }>(`/auth/audit/${qs}`);
  },
  auditExportUrl: (params?: { user?: number; date_from?: string; date_to?: string; action_type?: string }) => {
    const q = { ...params, format: "csv" };
    const qs = "?" + new URLSearchParams(
      Object.entries(q).filter(([, v]) => v != null && v !== "") as [string, string][]
    ).toString();
    return `${API_BASE}/auth/audit/${qs}`;
  },
  auditDetail: (params: { entity?: string; source?: string; history_id: number }) => {
    const qs = "?" + new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null && v !== "") as [string, string][]
    ).toString();
    return fetchApi<ApiAuditDetail>(`/auth/audit/detail/${qs}`);
  },
  auditLatest: (params?: { user?: number; limit?: number }) => {
    const qs = params && Object.keys(params).length
      ? "?" + new URLSearchParams(
          Object.entries(params).filter(([, v]) => v != null && v !== "") as [string, string][]
        ).toString()
      : "";
    return fetchApi<{ results: ApiAuditEntry[] }>(`/auth/audit/latest/${qs}`);
  },
};

export interface ApiAuditEntry {
  id: number;
  source?: string;
  entity: string;
  object_id: number | null;
  display_name?: string;
  action: string;
  action_label: string;
  date: string | null;
  date_date?: string;
  user_id: number | null;
  user_name: string | null;
  user_username: string | null;
  change_reason: string;
}

export interface ApiAuditDetail {
  entity: string;
  display_name: string;
  history_id: number;
  action: string;
  action_label: string;
  date: string | null;
  user_name: string | null;
  object_id: number | null;
  change_reason: string;
  details: { label: string; value: string }[];
  changes: { field: string; old: string | null; new: string | null }[];
}

export interface ApiSystemSettings {
  id: number;
  name: string;
  logo_url: string | null;
  primary_color: string;
  tagline: string;
  login_description?: string;
  login_banner_color?: string;
  login_card_color?: string;
  login_banner_kicker?: string;
  login_banner_image_url?: string;
  login_banner_title?: string;
  login_banner_subtitle?: string;
  login_banner_body?: string;
  login_banner_text_align?: string;
  login_banner_block_align?: string;
  login_banner_vertical_align?: string;
  login_banner_max_width?: string;
  login_banner_padding?: string;
  login_title_font_size?: string;
  login_title_color?: string;
  login_subtitle_font_size?: string;
  login_subtitle_color?: string;
  login_body_font_size?: string;
  login_body_color?: string;
  login_show_feature_boxes?: boolean;
  calendar_type_labels?: Record<string, string>;
  loan_default_interest_rate?: number;
  loan_allowed_terms_days?: number[];
  creditor_legal_name?: string;
  creditor_address?: string;
  creditor_city?: string;
  // BdM Report fields
  bom_province?: string;
  bom_phone?: string;
  bom_fax?: string;
  bom_email?: string;
  bom_num_workers?: number;
  bom_start_date?: string;
  bom_operator_name?: string;
  bom_initial_capital?: number;
  bom_current_capital?: number;
  bom_own_capital?: number;
  bom_foreign_capital_national?: number;
  bom_foreign_capital_foreign?: number;
  bom_financing_loans?: number;
  bom_financing_donations?: number;
  bom_financing_capital_increase?: number;
  bom_financial_situation?: Array<{ caixa: number; bancos: number; outros_activos: number }>;
  contract_theme_color?: string;
  contract_page_bg_color?: string;
  contract_logo_url?: string;
  /** URL absoluta do ficheiro carregado no servidor (prioridade sobre `contract_logo_url`). */
  contract_logo_upload_url?: string | null;
  contract_header_title?: string;
  contract_header_subtitle?: string;
  contract_doc_badge?: string;
  /** Texto legal fixo da instituição (secção 03 da folha); distinto dos T&C da categoria do empréstimo. */
  contract_general_clauses?: string;
  /** Se falso, a folha omite o bloco institucional (cláusulas gerais / lista padrão); T&C da categoria mantêm-se. */
  contract_include_clauses_on_sheet?: boolean;
  updated_at: string;
  is_locked: boolean;
  locked_message: string;
}

export const systemApi = {
  // Usado na LoginPage e ThemeProvider: fetch direto sem cookies nem handler de 401.
  // `credentials: "omit"` é crítico — sem isto, cookies expirados (access JWT antigo) seriam
  // enviados, fazendo a JWTAuthentication rejeitar com 401 ANTES de o AllowAny ser avaliado.
  // O endpoint backend permite GET público; isto garante que de facto o tratamos como público.
  getPublic: () =>
    fetch(`${API_BASE}/auth/settings/`, { credentials: "omit" })
      .then((r) => (r.ok ? (r.json() as Promise<ApiSystemSettings>) : Promise.resolve(null)))
      .catch(() => null),
  get: () => fetchApi<ApiSystemSettings>("/auth/settings/"),
  update: (
    payload: Partial<
      Pick<
        ApiSystemSettings,
        | "name"
        | "logo_url"
        | "primary_color"
        | "tagline"
        | "login_description"
        | "login_banner_color"
        | "login_card_color"
        | "login_banner_kicker"
        | "login_banner_image_url"
        | "login_banner_title"
        | "login_banner_subtitle"
        | "login_banner_body"
        | "login_banner_text_align"
        | "login_banner_block_align"
        | "login_banner_vertical_align"
        | "login_banner_max_width"
        | "login_banner_padding"
        | "login_title_font_size"
        | "login_title_color"
        | "login_subtitle_font_size"
        | "login_subtitle_color"
        | "login_body_font_size"
        | "login_body_color"
        | "login_show_feature_boxes"
        | "calendar_type_labels"
        | "loan_default_interest_rate"
        | "loan_allowed_terms_days"
        | "creditor_legal_name"
        | "creditor_address"
        | "creditor_city"
        | "contract_theme_color"
        | "contract_page_bg_color"
        | "contract_logo_url"
        | "contract_header_title"
        | "contract_header_subtitle"
        | "contract_doc_badge"
        | "contract_general_clauses"
        | "contract_include_clauses_on_sheet"
      >
    >,
  ) =>
    fetchApi<ApiSystemSettings>("/auth/settings/", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  uploadContractLogo: (file: File) => {
    const fd = new FormData();
    fd.append("logo", file);
    return fetchApi<{ contract_logo_upload_url: string }>("/auth/settings/contract-logo/", {
      method: "POST",
      body: fd,
    });
  },
  deleteContractLogoUpload: () =>
    fetchApi<void>("/auth/settings/contract-logo/", {
      method: "DELETE",
    }),
};

export interface ApiDashboardSummary {
  summary: {
    clients_total: number;
    clients_active: number;
    loans_total: number;
    loans_overdue_count: number;
    portfolio_total: number;
    monthly_received: number;
    monthly_received_count: number;
    overdue_total: number;
    entradas: number;
    saidas: number;
    employees_active: number;
  };
  status_data: { name: string; value: number; color: string }[];
  monthly_flow: { month: string; recebido: number; emprestado: number }[];
  client_growth: { month: string; clientes: number }[];
  cash_flow: { day: string; entrada: number; saida: number }[];
  recent_payments: { id: number; amount: number; date: string; status: string; installment_number: number; client_name: string }[];
  spark_received: number[];
  spark_portfolio: number[];
  spark_clients: number[];
  spark_overdue: number[];
}

export const dashboardApi = {
  getSummary: () => fetchApi<ApiDashboardSummary>("/dashboard/summary/"),
};

export interface ApiRole {
  id: number;
  code: string;
  name: string;
  description?: string;
  is_system: boolean;
  permissions: { id: number; codename: string; name: string; app_label: string; model: string }[];
}

export interface ApiPermission {
  id: number;
  codename: string;
  name: string;
  app_label: string;
  model: string;
  /** Nome amigável do modelo (verbose_name do backend) */
  model_display_name?: string;
}

export interface ApiUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_staff?: boolean;
  is_superuser?: boolean;
  date_joined: string;
  role?: { id: number; code: string; name: string } | null;
  role_id?: number | null;
  employee_id?: number | null;
  employee_name?: string | null;
  permissions?: string[];
}

export const usersApi = {
  list: async () => {
    const res = await fetchApi<PaginatedResponse<ApiUser> | ApiUser[]>("/users/");
    if (Array.isArray(res)) return res;
    return res.results ?? [];
  },
  create: (payload: Partial<ApiUser> & { password?: string }) =>
    fetchApi<ApiUser>("/users/", { method: "POST", body: JSON.stringify(payload) }),
  update: (id: number, payload: Partial<ApiUser> & { password?: string }) =>
    fetchApi<ApiUser>(`/users/${id}/`, { method: "PATCH", body: JSON.stringify(payload) }),
  delete: (id: number) => fetchApi<void>(`/users/${id}/`, { method: "DELETE" }),
};

export const rolesApi = {
  list: async () => {
    const res = await fetchApi<PaginatedResponse<ApiRole> | ApiRole[]>("/roles/");
    if (Array.isArray(res)) return res;
    return res.results ?? [];
  },
  create: (payload: { code: string; name: string; description?: string; permissions_ids?: number[] }) =>
    fetchApi<ApiRole>("/roles/", { method: "POST", body: JSON.stringify(payload) }),
  update: (id: number, payload: Partial<{ name: string; description: string; permissions_ids: number[] }>) =>
    fetchApi<ApiRole>(`/roles/${id}/`, { method: "PATCH", body: JSON.stringify(payload) }),
  delete: (id: number) => fetchApi<void>(`/roles/${id}/`, { method: "DELETE" }),
};

export const permissionsApi = {
  list: () => fetchApi<ApiPermission[]>("/auth/permissions/"),
};

// --- Domain APIs ---

// Clients
export interface ApiClient {
  id: number;
  name: string;
  email: string;
  phone: string;
  document: string;
  address: string;
  city: string;
  occupation: string;
  gender?: "M" | "F" | "O" | "";
  status: "ativo" | "inativo";
  created_at: string;
  total_loans: number;
}

// Collateral (item de garantia)
export interface ApiCollateral {
  id: number;
  description: string;
  item_type: "documento" | "eletronico" | "veiculo" | "imovel" | "joias" | "maquinaria" | "outro";
  estimated_value: number | null;
  condition: "novo" | "bom" | "usado" | "danificado" | "não_aplicavel";
  serial_number: string;
  notes: string;
}

// Loans
export interface ApiLoan {
  id: number;
  client: number;
  client_name: string;
  category?: number | null;
  category_name?: string | null;
  category_code?: string | null;
  category_frequency_days?: number | null;
  category_collateral_grace_days?: number | null;
  category_require_interest_paid_to_keep_collateral?: boolean | null;
  category_terms_and_conditions?: string;
  amount: number;
  interest_rate: number;
  term: number;
  monthly_payment: number;
  total_amount: number;
  status: "ativo" | "pago" | "atrasado" | "pendente";
  sector?: "comercio" | "agricultura" | "pecuaria" | "industria" | "servicos" | "consumo" | "outros" | "";
  start_date: string;
  end_date: string;
  paid_amount: number;
  remaining_balance: number;
  paid_installments: number;
  collateral?: ApiCollateral | null;
}

export interface ApiLoanContractProof {
  id: string;
  loan: number;
  contract_sha256: string;
  signature_sha256: string;
  rubrica_sha256: string;
  server_hmac_sha256: string;
  created_at: string;
}

export interface ApiPayment {
  id: number;
  loan: number;
  client_name: string;
  /** Dados do empréstimo associado (read-only da API) */
  loan_id?: number;
  loan_client_name?: string;
  loan_total_amount?: number;
  loan_remaining_balance?: number;
  loan_paid_installments?: number;
  loan_term?: number;
  loan_monthly_payment?: number;
  amount: number;
  date: string;
  status: "pago" | "pendente" | "atrasado";
  method: "transferencia" | "m_pesa" | "emola_mkesh" | "deposito" | "dinheiro" | "outro";
  method_other?: string;
  installment_number: number;
  receipt: string;
  receipt_file?: string | null;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export const clientsApi = {
  list: async () => {
    const res = await fetchApi<PaginatedResponse<ApiClient>>("/clients/");
    return res.results;
  },
  get: (id: number) => fetchApi<ApiClient>(`/clients/${id}/`),
  create: (payload: {
    name: string;
    email?: string;
    phone?: string;
    document?: string;
    address?: string;
    city?: string;
    occupation?: string;
    status?: "ativo" | "inativo";
  }) => fetchApi<ApiClient>("/clients/", {
    method: "POST",
    body: JSON.stringify(payload),
  }),
  loans: (clientId: number) =>
    fetchApi<ApiLoan[]>(`/clients/${clientId}/loans/`),
  update: (id: number, payload: Partial<{
    name: string;
    email?: string;
    phone?: string;
    document?: string;
    address?: string;
    city?: string;
    occupation?: string;
    status?: "ativo" | "inativo";
  }>) =>
    fetchApi<ApiClient>(`/clients/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  delete: (id: number) =>
    fetchApi<void>(`/clients/${id}/`, { method: "DELETE" }),
};

export const loansApi = {
  list: async (params?: { page_size?: number }) => {
    const qs = params?.page_size ? `?page_size=${params.page_size}` : "";
    const res = await fetchApi<PaginatedResponse<ApiLoan>>(`/loans/${qs}`);
    return res.results;
  },
  create: (payload: {
    client: number;
    category?: number | null;
    amount: number;
    interest_rate: number;
    term: number;
    start_date: string;
    end_date: string;
    collateral?: {
      description: string;
      item_type?: string;
      estimated_value?: number | null;
      condition?: string;
      serial_number?: string;
      notes?: string;
    } | null;
  }) => fetchApi<ApiLoan>("/loans/", {
    method: "POST",
    body: JSON.stringify(payload),
  }),
  amortization: (loanId: number) =>
    fetchApi<{
      installment: number;
      date: string;
      payment: number;
      principal: number;
      interest: number;
      balance: number;
      status: "pago" | "pendente" | "atrasado";
    }[]>(`/loans/${loanId}/amortization/`),
  update: (id: number, payload: Partial<{
    client: number;
    category?: number | null;
    amount: number;
    interest_rate: number;
    term: number;
    start_date: string;
    end_date: string;
    collateral?: {
      description: string;
      item_type?: string;
      estimated_value?: number | null;
      condition?: string;
      serial_number?: string;
      notes?: string;
    } | null;
  }>) =>
    fetchApi<ApiLoan>(`/loans/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  delete: (id: number) =>
    fetchApi<void>(`/loans/${id}/`, { method: "DELETE" }),
  createContractProof: (
    loanId: number,
    payload: { contract_text: string; signature_data_url?: string; rubrica_data_url?: string },
  ) =>
    fetchApi<ApiLoanContractProof>(`/loans/${loanId}/contract-proof/`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  lookupContractProof: (q: string) =>
    fetchApi<{ results: ApiLoanContractProof[] }>(`/loans/contract-proof/?q=${encodeURIComponent(q)}`),
};

export interface ApiLoanCategory {
  id: number;
  name: string;
  code: string;
  description?: string;
  /** Termos e condições da categoria (aparecem no contrato do empréstimo) */
  terms_and_conditions?: string;
  min_amount?: number;
  max_amount?: number | null;
  frequency_days: number;
  min_term_days: number;
  max_term_days: number;
  min_installments: number;
  max_installments: number;
   default_interest_rate: number;
   default_term_months: number;
  late_interest_rate?: number;
  max_late_interest_months?: number;
  collateral_grace_days: number;
  require_interest_paid_to_keep_collateral: boolean;
  is_active: boolean;
}

export const loanCategoriesApi = {
  suggestByAmount: (amount: number) =>
    fetchApi<ApiLoanCategory[]>(`/loan-categories/suggest/?amount=${amount}`),
  list: async (params?: { is_active?: boolean }) => {
    const qs =
      params && Object.keys(params).length
        ? "?" +
          new URLSearchParams(
            Object.entries(params).map(([k, v]) => [k, String(v)]),
          ).toString()
        : "";
    // LoanCategoryViewSet não usa paginação; devolve lista simples
    return fetchApi<ApiLoanCategory[]>(`/loan-categories/${qs}`);
  },
  create: (payload: {
    name: string;
    code: string;
    description?: string;
    terms_and_conditions?: string;
    min_amount?: number;
    max_amount?: number | null;
    frequency_days: number;
    min_term_days: number;
    max_term_days: number;
    min_installments: number;
    max_installments: number;
    default_interest_rate: number;
    default_term_months: number;
    late_interest_rate?: number;
    max_late_interest_months?: number;
    collateral_grace_days: number;
    require_interest_paid_to_keep_collateral: boolean;
    is_active?: boolean;
  }) =>
    fetchApi<ApiLoanCategory>("/loan-categories/", { method: "POST", body: JSON.stringify(payload) }),
  update: (id: number, payload: Partial<Omit<ApiLoanCategory, "id">>) =>
    fetchApi<ApiLoanCategory>(`/loan-categories/${id}/`, { method: "PATCH", body: JSON.stringify(payload) }),
  delete: (id: number) => fetchApi<void>(`/loan-categories/${id}/`, { method: "DELETE" }),
};

export interface ApiPaymentsSummary {
  total_received: number;
  received_this_month: number;
  received_this_month_count: number;
  paid_count: number;
  clients_paid_count: number;
  total_pending: number;
  total_overdue: number;
  pending_count: number;
  overdue_count: number;
  overdue_loans_count: number;
  pending_clients_count: number;
  overdue_clients_count: number;
  spark_received: number[];
}

export const paymentsApi = {
  getSummary: () =>
    fetchApi<ApiPaymentsSummary>("/payments/summary/"),
  list: async (params?: { status?: string; loan?: number }) => {
    const search = params
      ? new URLSearchParams(
          Object.entries(params).filter(([, v]) => v != null && v !== "")
        ).toString()
      : "";
    const url = search ? `/payments/?${search}` : "/payments/";
    const res = await fetchApi<PaginatedResponse<ApiPayment>>(url);
    return res.results;
  },
  create: (payload: {
    loan: number;
    amount: number;
    date: string;
    status: "pago" | "pendente" | "atrasado";
    method: "transferencia" | "m_pesa" | "emola_mkesh" | "deposito" | "dinheiro" | "outro";
    method_other?: string;
    installment_number: number;
    receipt?: string;
    receipt_file?: File;
  }) => {
    if (payload.receipt_file) {
      const fd = new FormData();
      fd.append("loan", String(payload.loan));
      fd.append("amount", String(payload.amount));
      fd.append("date", payload.date);
      fd.append("status", payload.status);
      fd.append("method", payload.method);
      fd.append("installment_number", String(payload.installment_number));
      if (payload.method_other) fd.append("method_other", payload.method_other);
      if (payload.receipt) fd.append("receipt", payload.receipt);
      fd.append("receipt_file", payload.receipt_file);
      return fetchApi<ApiPayment>("/payments/", { method: "POST", body: fd });
    }
    const { receipt_file: _, ...rest } = payload;
    return fetchApi<ApiPayment>("/payments/", {
      method: "POST",
      body: JSON.stringify(rest),
    });
  },
  update: (id: number, payload: Partial<{
    amount: number;
    date: string;
    status: "pago" | "pendente" | "atrasado";
    method: "transferencia" | "m_pesa" | "emola_mkesh" | "deposito" | "dinheiro" | "outro";
    method_other?: string;
    installment_number: number;
    receipt?: string;
  }>) =>
    fetchApi<ApiPayment>(`/payments/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  delete: (id: number) =>
    fetchApi<void>(`/payments/${id}/`, { method: "DELETE" }),
};

// --- HR ---

export interface ApiEmployee {
  id: number;
  name: string;
  role: string;
  department: string;
  base_salary: number;
  phone: string;
  email: string;
  status: "ativo" | "inativo";
  hire_date: string | null;
  color: string;
  inss_rate?: number;
  irps_rate?: number;
  other_deductions_rate?: number;
  overtime_rate_default?: number;
  penalty_absent_rate?: number;
  penalty_late_rate?: number;
}

export interface ApiVacation {
  id: number;
  employee: number;
  employee_name: string;
  start_date: string;
  end_date: string;
  color: string;
}

export interface ApiAttendanceRecord {
  id: number;
  employee: number;
  employee_name: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: "presente" | "ausente" | "atrasado" | "ferias" | "justificado";
  hours_worked: number;
}

export interface ApiHRSettings {
  id: number;
  weekend_days: number[]; // 0=Seg .. 6=Dom
  workday_start: string; // HH:MM:SS
  workday_end: string;
  weekend_start: string;
  weekend_end: string;
  auto_fill_attendance: boolean;
  late_grace_minutes?: number;
  good_hours_ratio?: number;
  ok_hours_ratio?: number;
  auto_detect_late?: boolean;
}

export interface ApiSalarySlip {
  id?: number;
  employee_id?: number;
  employee?: number;
  employee_name: string;
  role: string;
  month: string;
  base_salary: number;
  overtime: number;
  bonus: number;
  gross_salary: number;
  inss: number;
  irps: number;
  other_deductions?: number;
  total_deductions?: number;
  net_salary: number;
  attendance?: { absent: number; late: number };
  adjustments?: { overtime: number; bonus: number; other_deductions_manual: number };
}

export const hrApi = {
  employees: {
    list: async (params?: { status?: string; page_size?: number }) => {
      const qs = params && Object.keys(params).length
        ? "?" + new URLSearchParams(
            Object.entries(params).filter(([, v]) => v != null && v !== "") as [string, string][]
          ).toString()
        : "";
      const r = await fetchApi<PaginatedResponse<ApiEmployee>>(`/employees/${qs}`);
      return r.results;
    },
    create: (payload: Partial<ApiEmployee> & { name: string; role: string }) =>
      fetchApi<ApiEmployee>("/employees/", { method: "POST", body: JSON.stringify(payload) }),
    update: (id: number, payload: Partial<ApiEmployee>) =>
      fetchApi<ApiEmployee>(`/employees/${id}/`, { method: "PATCH", body: JSON.stringify(payload) }),
    delete: (id: number) => fetchApi<void>(`/employees/${id}/`, { method: "DELETE" }),
  },
  vacations: {
    list: async (params?: { employee?: number }) => {
      const qs = params?.employee ? `?employee=${params.employee}` : "";
      const r = await fetchApi<PaginatedResponse<ApiVacation>>(`/vacations/${qs}`);
      return r.results;
    },
    create: (payload: { employee: number; start_date: string; end_date: string; color?: string }) =>
      fetchApi<ApiVacation>("/vacations/", { method: "POST", body: JSON.stringify(payload) }),
    update: (id: number, payload: Partial<{ start_date: string; end_date: string; color: string }>) =>
      fetchApi<ApiVacation>(`/vacations/${id}/`, { method: "PATCH", body: JSON.stringify(payload) }),
    delete: (id: number) => fetchApi<void>(`/vacations/${id}/`, { method: "DELETE" }),
  },
  attendance: {
    list: async (params?: { date_from?: string; date_to?: string; employee?: number }) => {
      const qs = params && Object.keys(params).length
        ? "?" + new URLSearchParams(
            Object.entries(params).filter(([, v]) => v != null && v !== "") as [string, string][]
          ).toString()
        : "";
      const r = await fetchApi<PaginatedResponse<ApiAttendanceRecord>>(`/attendance/${qs}`);
      return r.results;
    },
    create: (payload: { employee: number; date: string; check_in?: string; check_out?: string; status?: string; hours_worked?: number }) =>
      fetchApi<ApiAttendanceRecord>("/attendance/", { method: "POST", body: JSON.stringify(payload) }),
    update: (id: number, payload: Partial<{ date: string; check_in: string; check_out: string; status: string; hours_worked: number }>) =>
      fetchApi<ApiAttendanceRecord>(`/attendance/${id}/`, { method: "PATCH", body: JSON.stringify(payload) }),
    delete: (id: number) => fetchApi<void>(`/attendance/${id}/`, { method: "DELETE" }),
  },
  settings: {
    get: () => fetchApi<ApiHRSettings>("/hr-settings/"),
    update: (payload: Partial<ApiHRSettings>) =>
      fetchApi<ApiHRSettings>("/hr-settings/", { method: "POST", body: JSON.stringify(payload) }),
  },
  payrollAdjustments: {
    list: async (params?: { month?: string; employee?: number; date_from?: string; date_to?: string; has_bonus?: boolean; has_overtime?: boolean }) => {
      const qs = params && Object.keys(params).length
        ? "?" + new URLSearchParams(
            Object.entries(params).filter(([, v]) => v != null && v !== "") as [string, string][]
          ).toString()
        : "";
      const r = await fetchApi<PaginatedResponse<{
        id: number;
        employee: number;
        employee_name: string;
        month: string;
        date?: string;
        overtime: number;
        bonus: number;
        other_deductions_manual: number;
        notes: string;
        created_at: string;
        updated_at: string;
      }>>(`/payroll-adjustments/${qs}`);
      return r.results;
    },
    upsert: (payload: { employee: number; month: string; date?: string; overtime?: number; bonus?: number; other_deductions_manual?: number; notes?: string }) =>
      fetchApi<{
        id: number;
        employee: number;
        employee_name: string;
        month: string;
        overtime: number;
        bonus: number;
        other_deductions_manual: number;
        notes: string;
        created_at: string;
        updated_at: string;
      }>("/payroll-adjustments/", { method: "POST", body: JSON.stringify(payload) }),
    update: (id: number, payload: Partial<{ overtime: number; bonus: number; other_deductions_manual: number; notes: string; date?: string }>) =>
      fetchApi<{
        id: number;
        employee: number;
        employee_name: string;
        month: string;
        overtime: number;
        bonus: number;
        other_deductions_manual: number;
        notes: string;
        created_at: string;
        updated_at: string;
      }>(`/payroll-adjustments/${id}/`, { method: "PATCH", body: JSON.stringify(payload) }),
    delete: (id: number) => fetchApi<void>(`/payroll-adjustments/${id}/`, { method: "DELETE" }),
    history: (id: number) =>
      fetchApi<Array<{
        history_id: number;
        history_date: string;
        history_type: string;
        history_type_label: string;
        history_change_reason: string;
        history_user: string | null;
        history_user_username: string | null;
        overtime: number;
        bonus: number;
        other_deductions_manual: number;
        notes: string;
        date: string | null;
      }>>(`/payroll-adjustments/${id}/history/`),
  },
  salarySlips: {
    list: async (params?: { month?: string }) => {
      const qs = params?.month ? `?month=${params.month}` : "";
      const r = await fetchApi<PaginatedResponse<ApiSalarySlip>>(`/salary-slips/${qs}`);
      return r.results;
    },
    create: (payload: { employee: number; month: string; base_salary: number; overtime: number; bonus: number; gross_salary: number; inss: number; irps: number; other_deductions: number; total_deductions: number; net_salary: number }) =>
      fetchApi<ApiSalarySlip>("/salary-slips/", { method: "POST", body: JSON.stringify(payload) }),
    simulate: (payload: { employee: number; month: string; overtime?: number; bonus?: number }) =>
      fetchApi<ApiSalarySlip>("/salary-slips/simulate/", { method: "POST", body: JSON.stringify(payload) }),
    simulateBulk: (payload: { month: string }) =>
      fetchApi<{ month: string; slips: ApiSalarySlip[]; summary: { total_employees: number; total_gross_salary: number; total_net_salary: number; total_deductions: number } }>(
        "/salary-slips/simulate-bulk/", { method: "POST", body: JSON.stringify(payload) }
      ),
  },
};

// --- Calendar ---

export interface ApiCalendarEvent {
  id: string;
  title: string;
  date: string;
  type: "payment" | "overdue" | "vacation" | "meeting" | "alert" | "reminder" | "other";
  type_label?: string;
  color?: string | null;
  client_name?: string;
  employee_name?: string;
  amount?: number;
  color?: string;
  description?: string;
  loan_id?: number;
  installment_number?: number;
}

export interface ApiNotification {
  id: string;
  type: "overdue" | "upcoming" | "collateral_risk" | "new_loan" | "alert" | "reminder" | "meeting" | "other" | "vacation";
  title: string;
  date: string;
  client_name?: string;
  employee_name?: string;
  amount?: number;
  loan_id?: number;
  installment_number?: number;
  description?: string;
}

export const calendarApi = {
  events: (params?: { year?: number; month?: number }) => {
    const query = params
      ? new URLSearchParams(
          Object.entries(params).map(([k, v]) => [k, String(v)])
        ).toString()
      : "";
    const url = "/calendar/events/" + (query ? "?" + query : "");
    return fetchApi<{ events: ApiCalendarEvent[] }>(url);
  },
  custom: {
    list: () =>
      fetchApi<Array<ApiCalendarEvent & { event_type: string; notify: boolean; loan?: number }>>(
        "/calendar/custom/"
      ),
    create: (payload: {
      title: string;
      event_type?: "meeting" | "alert" | "reminder" | "other";
      event_type_other?: string;
      color?: string;
      date: string;
      description?: string;
      notify?: boolean;
      loan?: number;
      client_name?: string;
      amount?: number;
    }) =>
      fetchApi<ApiCalendarEvent>( "/calendar/custom/", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    update: (id: number, payload: Partial<{ title: string; date: string; description: string; notify: boolean }>) =>
      fetchApi<ApiCalendarEvent>(`/calendar/custom/${id}/`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    delete: (id: number) =>
      fetchApi<void>(`/calendar/custom/${id}/`, { method: "DELETE" }),
  },
  notifications: () =>
    fetchApi<{ notifications: ApiNotification[]; unread_count: number }>(
      "/calendar/notifications/"
    ),
};

// --- Accounting ---

export interface ApiTransaction {
  id: number;
  type: "entrada" | "saida";
  category: string;
  description: string;
  amount: number;
  tax?: number | null;
  tax_name?: string;
  tax_rate?: number;
  tax_amount?: number;
  total_amount?: number;
  date: string;
  responsible: number | null;
  responsible_name: string;
  loan?: number | null;
}

export interface ApiFinancialOverview {
  date_from: string | null;
  date_to: string | null;
  opening_balance: number;
  entries: {
    accounting_entries: number;
    payments_received: number;
    total_entries: number;
  };
  exits: {
    accounting_exits: number;
    loans_disbursed: number;
    hr_payroll_paid: number;
    total_exits: number;
  };
  real_balance: number;
  consolidated_balance: number;
  analysis: {
    receivables_open: number;
    receivables_overdue: number;
    scheduled_entries: number;
    scheduled_exits: number;
    net_scheduled: number;
  };
}

export interface ApiCompanyFinanceSettings {
  id: number;
  opening_balance: number;
  updated_at: string;
}

export interface ApiMonthlyFinanceSnapshot {
  id: number;
  month: string;
  date_from: string;
  date_to: string;
  opening_balance: number;
  total_entries: number;
  total_exits: number;
  real_balance: number;
  consolidated_balance: number;
  created_by: number | null;
  created_by_name: string;
  created_at: string;
}

export interface ApiMonthlySnapshotActionLog {
  id: number;
  snapshot_month: string;
  action: "reopen";
  reason: string;
  user: number | null;
  user_name: string;
  created_at: string;
}

export const accountingApi = {
  taxes: {
    list: () => fetchApi<Array<{ id: number; name: string; code: string; rate: number; scope: "ambos" | "entrada" | "saida"; is_active: boolean }>>("/taxes/?is_active=true"),
    create: (payload: { name: string; code: string; rate: number; scope?: "ambos" | "entrada" | "saida"; is_active?: boolean }) =>
      fetchApi<{ id: number; name: string; code: string; rate: number; scope: "ambos" | "entrada" | "saida"; is_active: boolean }>("/taxes/", { method: "POST", body: JSON.stringify(payload) }),
    update: (id: number, payload: Partial<{ name: string; code: string; rate: number; scope: "ambos" | "entrada" | "saida"; is_active: boolean }>) =>
      fetchApi<{ id: number; name: string; code: string; rate: number; scope: "ambos" | "entrada" | "saida"; is_active: boolean }>(`/taxes/${id}/`, { method: "PATCH", body: JSON.stringify(payload) }),
    delete: (id: number) => fetchApi<void>(`/taxes/${id}/`, { method: "DELETE" }),
  },
  transactions: {
    list: async (params?: { type?: "entrada" | "saida"; date_from?: string; date_to?: string; search?: string }) => {
      const qs = params && Object.keys(params).length
        ? "?" + new URLSearchParams(
            Object.entries(params).filter(([, v]) => v != null && v !== "") as [string, string][]
          ).toString()
        : "";
      const r = await fetchApi<PaginatedResponse<ApiTransaction>>(`/transactions/${qs}`);
      return r.results;
    },
    create: (payload: {
      type: "entrada" | "saida";
      category: string;
      description?: string;
      amount: number;
      tax?: number | null;
      date: string;
      responsible?: number | null;
      loan?: number | null;
    }) =>
      fetchApi<ApiTransaction>("/transactions/", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    update: (
      id: number,
      payload: Partial<{
        type: "entrada" | "saida";
        category: string;
        description?: string;
        amount: number;
        tax?: number | null;
        date: string;
      }>,
    ) =>
      fetchApi<ApiTransaction>(`/transactions/${id}/`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    delete: (id: number) =>
      fetchApi<void>(`/transactions/${id}/`, { method: "DELETE" }),
  },
  balance: (params?: { date_from?: string; date_to?: string }) => {
    const qs = params && Object.keys(params).length
      ? "?" + new URLSearchParams(
          Object.entries(params).filter(([, v]) => v != null && v !== "") as [string, string][]
        ).toString()
      : "";
    return fetchApi<{ date_from: string | null; date_to: string | null; total_entradas: number; total_saidas: number; saldo: number }>(
      `/transactions/balance/${qs}`
    );
  },
  overview: (params?: { date_from?: string; date_to?: string }) => {
    const qs = params && Object.keys(params).length
      ? "?" + new URLSearchParams(
          Object.entries(params).filter(([, v]) => v != null && v !== "") as [string, string][]
        ).toString()
      : "";
    return fetchApi<ApiFinancialOverview>(`/transactions/overview/${qs}`);
  },
  financeSettings: {
    get: () => fetchApi<ApiCompanyFinanceSettings>("/transactions/finance-settings/"),
    update: (payload: Partial<Pick<ApiCompanyFinanceSettings, "opening_balance">>) =>
      fetchApi<ApiCompanyFinanceSettings>("/transactions/finance-settings/", {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
  },
  monthlySnapshots: {
    list: () => fetchApi<ApiMonthlyFinanceSnapshot[]>("/transactions/monthly-snapshots/"),
    create: (payload: { month: string }) =>
      fetchApi<ApiMonthlyFinanceSnapshot>("/transactions/monthly-snapshots/", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    reopen: (id: number, payload: { reason?: string }) =>
      fetchApi<{ detail: string }>(`/transactions/monthly-snapshots/${id}/reopen/`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  },
  monthlySnapshotAudit: () =>
    fetchApi<ApiMonthlySnapshotActionLog[]>("/transactions/monthly-snapshot-audit/"),
  categories: () =>
    fetchApi<{ categories: string[] }>("/transactions/categories/"),
  simulate: (payload: { type: "entrada" | "saida"; amount: number; date?: string }) =>
    fetchApi<{
      simulated: { type: "entrada" | "saida"; amount: number; date: string | null };
      saldo_projetado: number;
      total_entradas_projetado: number;
      total_saidas_projetado: number;
    }>("/transactions/simulate/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

// --- Reports ---

export const reportsApi = {
  /**
   * Download the BdM Ficha de Reporte Trimestral as an Excel file.
   * Uses fetch with credentials (httpOnly cookie) and triggers a blob download.
   */
  bomExport: async (params: { date_from: string; date_to: string; period_label: string }): Promise<void> => {
    const url = new URL(`${API_BASE}/reports/bom-export/`);
    url.searchParams.set("date_from", params.date_from);
    url.searchParams.set("date_to", params.date_to);
    url.searchParams.set("period_label", params.period_label);

    const res = await fetch(url.toString(), { credentials: "include" });
    if (!res.ok) {
      const text = await res.text();
      throw new ApiError(`Erro ao exportar relatório BdM: ${res.statusText}`, res.status, text);
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    // Extract filename from Content-Disposition or use default
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const match = disposition.match(/filename="([^"]+)"/);
    a.download = match ? match[1] : `reporte_bom_${params.date_from.slice(0, 7).replace("-", "_")}.xlsx`;
    a.click();
    URL.revokeObjectURL(objectUrl);
  },
};

export const parMetricsApi = {
  get: (): Promise<{
    total_portfolio: number;
    total_active_loans: number;
    par30: { amount: number; count: number; ratio: number };
    par60: { amount: number; count: number; ratio: number };
    par90: { amount: number; count: number; ratio: number };
    due_this_week: { amount: number; count: number };
    overdue: { amount: number; count: number };
  }> => apiFetch("/reports/par-metrics/"),
};

