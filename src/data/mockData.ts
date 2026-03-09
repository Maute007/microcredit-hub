// ==================== TYPES ====================

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  document: string;
  address: string;
  city: string;
  status: "ativo" | "inativo";
  createdAt: string;
  totalLoans: number;
  occupation: string;
}

export interface Loan {
  id: string;
  clientId: string;
  clientName: string;
  amount: number;
  interestRate: number;
  term: number;
  monthlyPayment: number;
  totalAmount: number;
  status: "ativo" | "pago" | "atrasado" | "pendente";
  startDate: string;
  endDate: string;
  paidAmount: number;
  remainingBalance: number;
  paidInstallments: number;
}

export interface AmortizationRow {
  installment: number;
  date: string;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
  status: "pago" | "pendente" | "atrasado";
}

export interface Payment {
  id: string;
  loanId: string;
  clientName: string;
  amount: number;
  date: string;
  status: "pago" | "pendente" | "atrasado";
  method: string;
  installmentNumber: number;
  receipt?: string;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  department: string;
  baseSalary: number;
  phone: string;
  email: string;
  status: "ativo" | "inativo";
  hireDate: string;
  color: string;
}

export interface Vacation {
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  color: string;
}

export interface SalarySlip {
  employeeId: string;
  employeeName: string;
  role: string;
  month: string;
  baseSalary: number;
  overtime: number;
  bonus: number;
  grossSalary: number;
  inss: number;
  irps: number;
  otherDeductions: number;
  totalDeductions: number;
  netSalary: number;
}

export interface Transaction {
  id: string;
  type: "entrada" | "saida";
  category: string;
  description: string;
  amount: number;
  date: string;
  responsible: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: "payment" | "overdue" | "vacation" | "meeting" | "alert";
  clientName?: string;
  employeeName?: string;
  amount?: number;
  color?: string;
}

// ==================== MOCK DATA ====================

export const mockClients: Client[] = [
  { id: "C001", name: "Maria da Graça Silva", email: "maria.silva@email.com", phone: "+258 84 123 4567", document: "010203040A", address: "Av. Eduardo Mondlane, 100, 3ºA", city: "Maputo", status: "ativo", createdAt: "2024-01-15", totalLoans: 3, occupation: "Comerciante" },
  { id: "C002", name: "João Alberto Santos", email: "joao.santos@email.com", phone: "+258 85 234 5678", document: "020304050B", address: "Rua da Resistência, 45", city: "Maputo", status: "ativo", createdAt: "2024-02-20", totalLoans: 1, occupation: "Empresário" },
  { id: "C003", name: "Ana Beatriz Fernandes", email: "ana.fernandes@email.com", phone: "+258 86 345 6789", document: "030405060C", address: "Av. Julius Nyerere, 200", city: "Matola", status: "ativo", createdAt: "2024-03-10", totalLoans: 2, occupation: "Agricultora" },
  { id: "C004", name: "Pedro Manuel Machel", email: "pedro.machel@email.com", phone: "+258 87 456 7890", document: "040506070D", address: "Rua do Bagamoyo, 78", city: "Beira", status: "inativo", createdAt: "2023-11-05", totalLoans: 1, occupation: "Motorista" },
  { id: "C005", name: "Luísa Helena Mondlane", email: "luisa.mondlane@email.com", phone: "+258 84 567 8901", document: "050607080E", address: "Av. Samora Machel, 500", city: "Maputo", status: "ativo", createdAt: "2024-04-12", totalLoans: 2, occupation: "Professora" },
  { id: "C006", name: "Carlos Eduardo Neto", email: "carlos.neto@email.com", phone: "+258 85 678 9012", document: "060708090F", address: "Rua dos Lusíadas, 33", city: "Nampula", status: "ativo", createdAt: "2024-05-01", totalLoans: 1, occupation: "Mecânico" },
  { id: "C007", name: "Beatriz Esperança Lopes", email: "beatriz.lopes@email.com", phone: "+258 86 789 0123", document: "070809100G", address: "Av. Karl Marx, 150", city: "Maputo", status: "ativo", createdAt: "2024-06-18", totalLoans: 4, occupation: "Vendedora" },
  { id: "C008", name: "Manuel Francisco Costa", email: "manuel.costa@email.com", phone: "+258 87 890 1234", document: "080910110H", address: "Rua da Imprensa, 22", city: "Quelimane", status: "inativo", createdAt: "2023-09-30", totalLoans: 0, occupation: "Pedreiro" },
  { id: "C009", name: "Rosa Albertina Chissano", email: "rosa.chissano@email.com", phone: "+258 84 901 2345", document: "091011120I", address: "Av. Acordo de Lusaka, 88", city: "Maputo", status: "ativo", createdAt: "2024-07-22", totalLoans: 1, occupation: "Costureira" },
  { id: "C010", name: "Fernando José Guebuza", email: "fernando.g@email.com", phone: "+258 85 012 3456", document: "101112130J", address: "Rua da Missão, 15", city: "Inhambane", status: "ativo", createdAt: "2024-08-05", totalLoans: 2, occupation: "Pescador" },
];

export const mockLoans: Loan[] = [
  { id: "E001", clientId: "C001", clientName: "Maria da Graça Silva", amount: 50000, interestRate: 5, term: 12, monthlyPayment: 4583.33, totalAmount: 55000, status: "ativo", startDate: "2024-06-01", endDate: "2025-06-01", paidAmount: 27500, remainingBalance: 27500, paidInstallments: 6 },
  { id: "E002", clientId: "C002", clientName: "João Alberto Santos", amount: 30000, interestRate: 4.5, term: 6, monthlyPayment: 5225, totalAmount: 31350, status: "ativo", startDate: "2024-09-01", endDate: "2025-03-01", paidAmount: 15675, remainingBalance: 15675, paidInstallments: 3 },
  { id: "E003", clientId: "C003", clientName: "Ana Beatriz Fernandes", amount: 100000, interestRate: 3.5, term: 24, monthlyPayment: 4604.17, totalAmount: 110500, status: "atrasado", startDate: "2024-01-15", endDate: "2026-01-15", paidAmount: 55250, remainingBalance: 55250, paidInstallments: 12 },
  { id: "E004", clientId: "C005", clientName: "Luísa Helena Mondlane", amount: 25000, interestRate: 5.5, term: 8, monthlyPayment: 3421.88, totalAmount: 27375, status: "ativo", startDate: "2024-10-01", endDate: "2025-06-01", paidAmount: 10265, remainingBalance: 17110, paidInstallments: 3 },
  { id: "E005", clientId: "C001", clientName: "Maria da Graça Silva", amount: 15000, interestRate: 4, term: 6, monthlyPayment: 2600, totalAmount: 15600, status: "pago", startDate: "2024-01-01", endDate: "2024-07-01", paidAmount: 15600, remainingBalance: 0, paidInstallments: 6 },
  { id: "E006", clientId: "C007", clientName: "Beatriz Esperança Lopes", amount: 75000, interestRate: 4, term: 18, monthlyPayment: 4583.33, totalAmount: 82500, status: "ativo", startDate: "2024-08-01", endDate: "2026-02-01", paidAmount: 32083, remainingBalance: 50417, paidInstallments: 7 },
  { id: "E007", clientId: "C006", clientName: "Carlos Eduardo Neto", amount: 20000, interestRate: 5, term: 10, monthlyPayment: 2200, totalAmount: 22000, status: "pendente", startDate: "2025-04-01", endDate: "2026-02-01", paidAmount: 0, remainingBalance: 22000, paidInstallments: 0 },
  { id: "E008", clientId: "C009", clientName: "Rosa Albertina Chissano", amount: 35000, interestRate: 4.5, term: 12, monthlyPayment: 3354.17, totalAmount: 40250, status: "ativo", startDate: "2024-11-01", endDate: "2025-11-01", paidAmount: 13416, remainingBalance: 26834, paidInstallments: 4 },
  { id: "E009", clientId: "C010", clientName: "Fernando José Guebuza", amount: 60000, interestRate: 3.8, term: 18, monthlyPayment: 3700, totalAmount: 66600, status: "ativo", startDate: "2024-07-01", endDate: "2026-01-01", paidAmount: 29600, remainingBalance: 37000, paidInstallments: 8 },
];

export const mockPayments: Payment[] = [
  { id: "P001", loanId: "E001", clientName: "Maria da Graça Silva", amount: 4583.33, date: "2025-03-01", status: "pago", method: "Transferência", installmentNumber: 7 },
  { id: "P002", loanId: "E002", clientName: "João Alberto Santos", amount: 5225, date: "2025-03-01", status: "pago", method: "M-Pesa", installmentNumber: 4 },
  { id: "P003", loanId: "E003", clientName: "Ana Beatriz Fernandes", amount: 4604.17, date: "2025-03-01", status: "atrasado", method: "Pendente", installmentNumber: 15 },
  { id: "P004", loanId: "E004", clientName: "Luísa Helena Mondlane", amount: 3421.88, date: "2025-03-05", status: "pendente", method: "Pendente", installmentNumber: 4 },
  { id: "P005", loanId: "E006", clientName: "Beatriz Esperança Lopes", amount: 4583.33, date: "2025-03-01", status: "pago", method: "Depósito", installmentNumber: 8 },
  { id: "P006", loanId: "E001", clientName: "Maria da Graça Silva", amount: 4583.33, date: "2025-02-01", status: "pago", method: "Transferência", installmentNumber: 6 },
  { id: "P007", loanId: "E003", clientName: "Ana Beatriz Fernandes", amount: 4604.17, date: "2025-02-01", status: "pago", method: "M-Pesa", installmentNumber: 14 },
  { id: "P008", loanId: "E006", clientName: "Beatriz Esperança Lopes", amount: 4583.33, date: "2025-02-01", status: "pago", method: "Depósito", installmentNumber: 7 },
  { id: "P009", loanId: "E002", clientName: "João Alberto Santos", amount: 5225, date: "2025-02-01", status: "pago", method: "M-Pesa", installmentNumber: 3 },
  { id: "P010", loanId: "E004", clientName: "Luísa Helena Mondlane", amount: 3421.88, date: "2025-02-05", status: "pago", method: "Transferência", installmentNumber: 3 },
  { id: "P011", loanId: "E008", clientName: "Rosa Albertina Chissano", amount: 3354.17, date: "2025-03-01", status: "pago", method: "M-Pesa", installmentNumber: 5 },
  { id: "P012", loanId: "E009", clientName: "Fernando José Guebuza", amount: 3700, date: "2025-03-01", status: "pendente", method: "Pendente", installmentNumber: 9 },
];

const employeeColors = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#F97316"];

export const mockEmployees: Employee[] = [
  { id: "F001", name: "António Ribeiro", role: "Gerente Geral", department: "Administração", baseSalary: 85000, phone: "+258 84 111 2222", email: "antonio@microcredito.co.mz", status: "ativo", hireDate: "2022-01-10", color: employeeColors[0] },
  { id: "F002", name: "Fátima Nguema", role: "Analista de Crédito", department: "Crédito", baseSalary: 45000, phone: "+258 85 222 3333", email: "fatima@microcredito.co.mz", status: "ativo", hireDate: "2022-06-15", color: employeeColors[1] },
  { id: "F003", name: "Ricardo Tembe", role: "Cobrador", department: "Cobrança", baseSalary: 35000, phone: "+258 86 333 4444", email: "ricardo@microcredito.co.mz", status: "ativo", hireDate: "2023-02-01", color: employeeColors[2] },
  { id: "F004", name: "Sara Mabote", role: "Atendimento ao Cliente", department: "Atendimento", baseSalary: 30000, phone: "+258 87 444 5555", email: "sara@microcredito.co.mz", status: "ativo", hireDate: "2023-08-20", color: employeeColors[3] },
  { id: "F005", name: "David Chissano", role: "Contador", department: "Contabilidade", baseSalary: 55000, phone: "+258 84 555 6666", email: "david@microcredito.co.mz", status: "ativo", hireDate: "2022-03-01", color: employeeColors[4] },
  { id: "F006", name: "Teresa Macamo", role: "Assistente Admin", department: "Administração", baseSalary: 28000, phone: "+258 85 666 7777", email: "teresa@microcredito.co.mz", status: "inativo", hireDate: "2023-01-15", color: employeeColors[5] },
  { id: "F007", name: "Jorge Mondlane", role: "Analista de Crédito Jr.", department: "Crédito", baseSalary: 32000, phone: "+258 86 777 8888", email: "jorge@microcredito.co.mz", status: "ativo", hireDate: "2024-01-10", color: employeeColors[6] },
  { id: "F008", name: "Mariana Sitoe", role: "Gerente de Cobrança", department: "Cobrança", baseSalary: 50000, phone: "+258 87 888 9999", email: "mariana@microcredito.co.mz", status: "ativo", hireDate: "2023-06-01", color: employeeColors[7] },
];

export const mockVacations: Vacation[] = [
  { employeeId: "F002", employeeName: "Fátima Nguema", startDate: "2025-03-03", endDate: "2025-03-14", color: employeeColors[1] },
  { employeeId: "F004", employeeName: "Sara Mabote", startDate: "2025-03-10", endDate: "2025-03-21", color: employeeColors[3] },
  { employeeId: "F003", employeeName: "Ricardo Tembe", startDate: "2025-03-24", endDate: "2025-04-04", color: employeeColors[2] },
  { employeeId: "F001", employeeName: "António Ribeiro", startDate: "2025-04-07", endDate: "2025-04-18", color: employeeColors[0] },
  { employeeId: "F007", employeeName: "Jorge Mondlane", startDate: "2025-03-17", endDate: "2025-03-28", color: employeeColors[6] },
];

export function generateSalarySlip(employee: Employee, month: string): SalarySlip {
  const overtime = Math.round(employee.baseSalary * 0.05);
  const bonus = 0;
  const grossSalary = employee.baseSalary + overtime + bonus;
  const inss = Math.round(grossSalary * 0.03); // 3% INSS worker
  const irps = Math.round(grossSalary * 0.10); // simplified IRPS
  const otherDeductions = Math.round(grossSalary * 0.01);
  const totalDeductions = inss + irps + otherDeductions;
  const netSalary = grossSalary - totalDeductions;

  return {
    employeeId: employee.id,
    employeeName: employee.name,
    role: employee.role,
    month,
    baseSalary: employee.baseSalary,
    overtime,
    bonus,
    grossSalary,
    inss,
    irps,
    otherDeductions,
    totalDeductions,
    netSalary,
  };
}

export function generateAmortizationTable(loan: Loan): AmortizationRow[] {
  const rows: AmortizationRow[] = [];
  let balance = loan.totalAmount;
  const monthlyInterest = loan.interestRate / 100;
  const principalPerMonth = loan.amount / loan.term;

  for (let i = 1; i <= loan.term; i++) {
    const interest = Math.round((loan.amount * monthlyInterest) / loan.term * 100) / 100;
    const principal = Math.round(principalPerMonth * 100) / 100;
    const payment = Math.round((principal + interest) * 100) / 100;
    balance = Math.max(0, Math.round((balance - payment) * 100) / 100);

    const startDate = new Date(loan.startDate);
    startDate.setMonth(startDate.getMonth() + i);
    const dateStr = startDate.toISOString().slice(0, 10);

    let status: "pago" | "pendente" | "atrasado" = "pendente";
    if (i <= loan.paidInstallments) status = "pago";
    else if (new Date(dateStr) < new Date("2025-03-09")) status = loan.status === "atrasado" ? "atrasado" : "pendente";

    rows.push({ installment: i, date: dateStr, payment, principal, interest, balance, status });
  }
  return rows;
}

export const mockTransactions: Transaction[] = [
  { id: "T001", type: "entrada", category: "Pagamento Empréstimo", description: "Pagamento Maria Silva - E001", amount: 4583.33, date: "2025-03-01", responsible: "Fátima Nguema" },
  { id: "T002", type: "entrada", category: "Pagamento Empréstimo", description: "Pagamento João Santos - E002", amount: 5225, date: "2025-03-01", responsible: "Fátima Nguema" },
  { id: "T003", type: "entrada", category: "Pagamento Empréstimo", description: "Pagamento Beatriz Lopes - E006", amount: 4583.33, date: "2025-03-01", responsible: "Ricardo Tembe" },
  { id: "T004", type: "saida", category: "Salários", description: "Folha salarial Março 2025", amount: 278000, date: "2025-03-05", responsible: "David Chissano" },
  { id: "T005", type: "saida", category: "Aluguel", description: "Aluguel do escritório - Março", amount: 25000, date: "2025-03-01", responsible: "António Ribeiro" },
  { id: "T006", type: "saida", category: "Material", description: "Material de escritório e papelaria", amount: 3500, date: "2025-03-03", responsible: "Teresa Macamo" },
  { id: "T007", type: "saida", category: "Desembolso", description: "Novo empréstimo Carlos Neto - E007", amount: 20000, date: "2025-03-07", responsible: "Fátima Nguema" },
  { id: "T008", type: "saida", category: "Comunicações", description: "Internet, telefone e dados móveis", amount: 8000, date: "2025-03-01", responsible: "Sara Mabote" },
  { id: "T009", type: "entrada", category: "Pagamento Empréstimo", description: "Pagamento Luísa Mondlane - E004", amount: 3421.88, date: "2025-02-05", responsible: "Ricardo Tembe" },
  { id: "T010", type: "entrada", category: "Juros", description: "Juros acumulados Fevereiro", amount: 12500, date: "2025-02-28", responsible: "David Chissano" },
  { id: "T011", type: "entrada", category: "Pagamento Empréstimo", description: "Pagamento Rosa Chissano - E008", amount: 3354.17, date: "2025-03-01", responsible: "Ricardo Tembe" },
  { id: "T012", type: "saida", category: "Transporte", description: "Combustível e manutenção viaturas", amount: 12000, date: "2025-03-04", responsible: "Ricardo Tembe" },
  { id: "T013", type: "entrada", category: "Pagamento Empréstimo", description: "Pagamento Fernando Guebuza - E009", amount: 3700, date: "2025-02-01", responsible: "Fátima Nguema" },
  { id: "T014", type: "saida", category: "Seguro", description: "Seguro do escritório - Março", amount: 5500, date: "2025-03-01", responsible: "David Chissano" },
];

export const mockCalendarEvents: CalendarEvent[] = [
  { id: "EV001", title: "Pagamento Maria Silva", date: "2025-03-09", type: "payment", clientName: "Maria da Graça Silva", amount: 4583.33 },
  { id: "EV002", title: "Pagamento João Santos", date: "2025-03-09", type: "payment", clientName: "João Alberto Santos", amount: 5225 },
  { id: "EV003", title: "ATRASO - Ana Fernandes", date: "2025-03-09", type: "overdue", clientName: "Ana Beatriz Fernandes", amount: 4604.17 },
  { id: "EV004", title: "Pagamento Luísa Mondlane", date: "2025-03-10", type: "payment", clientName: "Luísa Helena Mondlane", amount: 3421.88 },
  { id: "EV005", title: "Pagamento Beatriz Lopes", date: "2025-03-15", type: "payment", clientName: "Beatriz Esperança Lopes", amount: 4583.33 },
  { id: "EV006", title: "Reunião mensal equipe", date: "2025-03-12", type: "meeting" },
  { id: "EV007", title: "Pagamento Maria Silva", date: "2025-04-01", type: "payment", clientName: "Maria da Graça Silva", amount: 4583.33 },
  { id: "EV008", title: "Pagamento Rosa Chissano", date: "2025-03-01", type: "payment", clientName: "Rosa Albertina Chissano", amount: 3354.17 },
  { id: "EV009", title: "Alerta cobrança Fernando", date: "2025-03-08", type: "alert", clientName: "Fernando José Guebuza", amount: 3700 },
  { id: "EV010", title: "Férias - Fátima Nguema", date: "2025-03-03", type: "vacation", employeeName: "Fátima Nguema", color: employeeColors[1] },
  { id: "EV011", title: "Férias - Sara Mabote", date: "2025-03-10", type: "vacation", employeeName: "Sara Mabote", color: employeeColors[3] },
  { id: "EV012", title: "Férias - Jorge Mondlane", date: "2025-03-17", type: "vacation", employeeName: "Jorge Mondlane", color: employeeColors[6] },
  { id: "EV013", title: "Férias - Ricardo Tembe", date: "2025-03-24", type: "vacation", employeeName: "Ricardo Tembe", color: employeeColors[2] },
];

// ==================== FORMATTERS ====================

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-MZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) + " MT";
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatMonthYear(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}
