import { useAuth } from "@/contexts/AuthContext";

/**
 * Returns whether the user has the given permission.
 * Superuser (permissions includes "*") has all permissions.
 */
export function usePermissions() {
  const { user } = useAuth();
  const perms = user?.permissions ?? [];

  const hasPermission = (codename: string): boolean => {
    if (!user) return false;
    if (user.is_superuser || perms.includes("*")) return true;
    if (perms.includes(codename)) return true;
    // Compatível se a API enviar "app_label.codename"
    return perms.some((p) => p === codename || p.endsWith(`.${codename}`));
  };

  // Clientes
  const canViewClient = hasPermission("view_client");
  const canAddClient = hasPermission("add_client");
  const canEditClient = hasPermission("change_client");
  const canDeleteClient = hasPermission("delete_client");

  // Empréstimos
  const canViewLoan = hasPermission("view_loan");
  const canAddLoan = hasPermission("add_loan");
  const canEditLoan = hasPermission("change_loan");
  const canDeleteLoan = hasPermission("delete_loan");

  // Categorias de empréstimo (configurações)
  const canAddLoanCategory = hasPermission("add_loancategory");
  const canChangeLoanCategory = hasPermission("change_loancategory");
  const canDeleteLoanCategory = hasPermission("delete_loancategory");
  const canManageLoanCategories = hasPermission("add_loancategory") || hasPermission("change_loancategory");

  // Pagamentos
  const canViewPayment = hasPermission("view_payment");
  const canAddPayment = hasPermission("add_payment");
  const canEditPayment = hasPermission("change_payment");
  const canDeletePayment = hasPermission("delete_payment");

  // Calendário
  const canViewCalendario = hasPermission("view_calendarevent");
  const canAddCalendario = hasPermission("add_calendarevent");
  const canEditCalendario = hasPermission("change_calendarevent");
  const canDeleteCalendario = hasPermission("delete_calendarevent");

  // RH
  const canViewEmployee = hasPermission("view_employee");
  const canAddEmployee = hasPermission("add_employee");
  const canEditEmployee = hasPermission("change_employee");
  const canDeleteEmployee = hasPermission("delete_employee");

  // Contabilidade
  const canViewTransaction = hasPermission("view_transaction");
  const canAddTransaction = hasPermission("add_transaction");
  const canEditTransaction = hasPermission("change_transaction");
  const canDeleteTransaction = hasPermission("delete_transaction");

  // Utilizadores & Acesso
  const canViewUser = hasPermission("view_user");
  const canAddUser = hasPermission("add_user");
  const canEditUser = hasPermission("change_user");
  const canDeleteUser = hasPermission("delete_user");

  // Papéis (accounts.role)
  const canViewRole = hasPermission("view_role");
  const canAddRole = hasPermission("add_role");
  const canChangeRole = hasPermission("change_role");
  const canDeleteRole = hasPermission("delete_role");

  // Configurações globais (singleton)
  const canViewSystemSettings = hasPermission("view_systemsettings");
  const canChangeSystemSettings = hasPermission("change_systemsettings");

  // Impostos / folha
  const canDeleteTax = hasPermission("delete_tax");
  const canChangeTax = hasPermission("change_tax");
  const canAddTax = hasPermission("add_tax");
  const canDeletePayrollAdjustment = hasPermission("delete_payrolladjustment");
  const canChangePayrollAdjustment = hasPermission("change_payrolladjustment");
  const canAddPayrollAdjustment = hasPermission("add_payrolladjustment");

  return {
    hasPermission,
    // Clientes
    canViewClient,
    canAddClient,
    canEditClient,
    canDeleteClient,
    // Empréstimos
    canViewLoan,
    canAddLoan,
    canEditLoan,
    canDeleteLoan,
    canAddLoanCategory,
    canChangeLoanCategory,
    canDeleteLoanCategory,
    canManageLoanCategories,
    // Pagamentos
    canViewPayment,
    canAddPayment,
    canEditPayment,
    canDeletePayment,
    // Calendário
    canViewCalendario,
    canAddCalendario,
    canEditCalendario,
    canDeleteCalendario,
    // RH
    canViewEmployee,
    canAddEmployee,
    canEditEmployee,
    canDeleteEmployee,
    // Contabilidade
    canViewTransaction,
    canAddTransaction,
    canEditTransaction,
    canDeleteTransaction,
    // Utilizadores
    canViewUser,
    canAddUser,
    canEditUser,
    canDeleteUser,
    canViewRole,
    canAddRole,
    canChangeRole,
    canDeleteRole,
    canViewSystemSettings,
    canChangeSystemSettings,
    canDeleteTax,
    canChangeTax,
    canAddTax,
    canDeletePayrollAdjustment,
    canChangePayrollAdjustment,
    canAddPayrollAdjustment,
  };
}
