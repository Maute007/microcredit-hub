const rawApiBase = import.meta.env.VITE_API_BASE_URL?.trim();
const API_BASE = rawApiBase ? rawApiBase.replace(/\/$/, "") : "/api";

let onUnauthorized: (() => void) | null = null;
let sessionExpired = false;

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
  options: RequestInit = {}
): Promise<T> {
  // Quando sessão expirou, bloquear novos pedidos EXCEPTO login/refresh para permitir reautenticação
  if (sessionExpired && !path.includes("/auth/login") && !path.includes("/auth/refresh")) {
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

  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    if (res.status === 401) {
      sessionExpired = true;
      // Evitar loop infinito: não chamar onUnauthorized de novo a partir do próprio logout
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
  updated_at: string;
  is_locked: boolean;
  locked_message: string;
}

export const systemApi = {
  get: () => fetchApi<ApiSystemSettings>("/auth/settings/"),
  update: (payload: Partial<Pick<ApiSystemSettings, "name" | "logo_url" | "primary_color" | "tagline" | "login_description" | "login_banner_color" | "login_card_color">>) =>
    fetchApi<ApiSystemSettings>("/auth/settings/", {
      method: "PATCH",
      body: JSON.stringify(payload),
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
  amount: number;
  interest_rate: number;
  term: number;
  monthly_payment: number;
  total_amount: number;
  status: "ativo" | "pago" | "atrasado" | "pendente";
  start_date: string;
  end_date: string;
  paid_amount: number;
  remaining_balance: number;
  paid_installments: number;
  collateral?: ApiCollateral | null;
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
};

export interface ApiLoanCategory {
  id: number;
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
