export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  document: string;
  address: string;
  status: "ativo" | "inativo";
  createdAt: string;
  totalLoans: number;
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
}

export interface Payment {
  id: string;
  loanId: string;
  clientName: string;
  amount: number;
  date: string;
  status: "pago" | "pendente" | "atrasado";
  method: string;
  receipt?: string;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  salary: number;
  phone: string;
  email: string;
  status: "ativo" | "inativo";
  hireDate: string;
}

export interface Transaction {
  id: string;
  type: "entrada" | "saida";
  category: string;
  description: string;
  amount: number;
  date: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: "payment" | "overdue" | "meeting";
  clientName?: string;
  amount?: number;
}

export const mockClients: Client[] = [
  { id: "C001", name: "Maria Silva", email: "maria@email.com", phone: "+258 84 123 4567", document: "123456789", address: "Av. Eduardo Mondlane, 100", status: "ativo", createdAt: "2024-01-15", totalLoans: 3 },
  { id: "C002", name: "João Santos", email: "joao@email.com", phone: "+258 85 234 5678", document: "987654321", address: "Rua da Resistência, 45", status: "ativo", createdAt: "2024-02-20", totalLoans: 1 },
  { id: "C003", name: "Ana Fernandes", email: "ana@email.com", phone: "+258 86 345 6789", document: "456789123", address: "Av. Julius Nyerere, 200", status: "ativo", createdAt: "2024-03-10", totalLoans: 2 },
  { id: "C004", name: "Pedro Machel", email: "pedro@email.com", phone: "+258 87 456 7890", document: "321654987", address: "Rua do Bagamoyo, 78", status: "inativo", createdAt: "2023-11-05", totalLoans: 1 },
  { id: "C005", name: "Luísa Mondlane", email: "luisa@email.com", phone: "+258 84 567 8901", document: "654987321", address: "Av. Samora Machel, 500", status: "ativo", createdAt: "2024-04-12", totalLoans: 2 },
  { id: "C006", name: "Carlos Neto", email: "carlos@email.com", phone: "+258 85 678 9012", document: "789123456", address: "Rua dos Lusíadas, 33", status: "ativo", createdAt: "2024-05-01", totalLoans: 1 },
  { id: "C007", name: "Beatriz Lopes", email: "beatriz@email.com", phone: "+258 86 789 0123", document: "147258369", address: "Av. Karl Marx, 150", status: "ativo", createdAt: "2024-06-18", totalLoans: 4 },
  { id: "C008", name: "Manuel Costa", email: "manuel@email.com", phone: "+258 87 890 1234", document: "369258147", address: "Rua da Imprensa, 22", status: "inativo", createdAt: "2023-09-30", totalLoans: 0 },
];

export const mockLoans: Loan[] = [
  { id: "E001", clientId: "C001", clientName: "Maria Silva", amount: 50000, interestRate: 5, term: 12, monthlyPayment: 4583.33, totalAmount: 55000, status: "ativo", startDate: "2024-06-01", endDate: "2025-06-01", paidAmount: 27500 },
  { id: "E002", clientId: "C002", clientName: "João Santos", amount: 30000, interestRate: 4.5, term: 6, monthlyPayment: 5225, totalAmount: 31350, status: "ativo", startDate: "2024-09-01", endDate: "2025-03-01", paidAmount: 15675 },
  { id: "E003", clientId: "C003", clientName: "Ana Fernandes", amount: 100000, interestRate: 3.5, term: 24, monthlyPayment: 4604.17, totalAmount: 110500, status: "atrasado", startDate: "2024-01-15", endDate: "2026-01-15", paidAmount: 55250 },
  { id: "E004", clientId: "C005", clientName: "Luísa Mondlane", amount: 25000, interestRate: 5.5, term: 8, monthlyPayment: 3421.88, totalAmount: 27375, status: "ativo", startDate: "2024-10-01", endDate: "2025-06-01", paidAmount: 10265 },
  { id: "E005", clientId: "C001", clientName: "Maria Silva", amount: 15000, interestRate: 4, term: 6, monthlyPayment: 2600, totalAmount: 15600, status: "pago", startDate: "2024-01-01", endDate: "2024-07-01", paidAmount: 15600 },
  { id: "E006", clientId: "C007", clientName: "Beatriz Lopes", amount: 75000, interestRate: 4, term: 18, monthlyPayment: 4583.33, totalAmount: 82500, status: "ativo", startDate: "2024-08-01", endDate: "2026-02-01", paidAmount: 32083 },
  { id: "E007", clientId: "C006", clientName: "Carlos Neto", amount: 20000, interestRate: 5, term: 10, monthlyPayment: 2200, totalAmount: 22000, status: "pendente", startDate: "2025-04-01", endDate: "2026-02-01", paidAmount: 0 },
];

export const mockPayments: Payment[] = [
  { id: "P001", loanId: "E001", clientName: "Maria Silva", amount: 4583.33, date: "2025-03-01", status: "pago", method: "Transferência" },
  { id: "P002", loanId: "E002", clientName: "João Santos", amount: 5225, date: "2025-03-01", status: "pago", method: "M-Pesa" },
  { id: "P003", loanId: "E003", clientName: "Ana Fernandes", amount: 4604.17, date: "2025-03-01", status: "atrasado", method: "Pendente" },
  { id: "P004", loanId: "E004", clientName: "Luísa Mondlane", amount: 3421.88, date: "2025-03-05", status: "pendente", method: "Pendente" },
  { id: "P005", loanId: "E006", clientName: "Beatriz Lopes", amount: 4583.33, date: "2025-03-01", status: "pago", method: "Depósito" },
  { id: "P006", loanId: "E001", clientName: "Maria Silva", amount: 4583.33, date: "2025-02-01", status: "pago", method: "Transferência" },
  { id: "P007", loanId: "E003", clientName: "Ana Fernandes", amount: 4604.17, date: "2025-02-01", status: "pago", method: "M-Pesa" },
  { id: "P008", loanId: "E006", clientName: "Beatriz Lopes", amount: 4583.33, date: "2025-02-01", status: "pago", method: "Depósito" },
  { id: "P009", loanId: "E002", clientName: "João Santos", amount: 5225, date: "2025-02-01", status: "pago", method: "M-Pesa" },
  { id: "P010", loanId: "E004", clientName: "Luísa Mondlane", amount: 3421.88, date: "2025-02-05", status: "pago", method: "Transferência" },
];

export const mockEmployees: Employee[] = [
  { id: "F001", name: "António Ribeiro", role: "Gerente Geral", salary: 85000, phone: "+258 84 111 2222", email: "antonio@microcredito.co.mz", status: "ativo", hireDate: "2022-01-10" },
  { id: "F002", name: "Fátima Nguema", role: "Analista de Crédito", salary: 45000, phone: "+258 85 222 3333", email: "fatima@microcredito.co.mz", status: "ativo", hireDate: "2022-06-15" },
  { id: "F003", name: "Ricardo Tembe", role: "Cobrador", salary: 35000, phone: "+258 86 333 4444", email: "ricardo@microcredito.co.mz", status: "ativo", hireDate: "2023-02-01" },
  { id: "F004", name: "Sara Mabote", role: "Atendimento ao Cliente", salary: 30000, phone: "+258 87 444 5555", email: "sara@microcredito.co.mz", status: "ativo", hireDate: "2023-08-20" },
  { id: "F005", name: "David Chissano", role: "Contador", salary: 55000, phone: "+258 84 555 6666", email: "david@microcredito.co.mz", status: "ativo", hireDate: "2022-03-01" },
  { id: "F006", name: "Teresa Macamo", role: "Assistente Admin", salary: 28000, phone: "+258 85 666 7777", email: "teresa@microcredito.co.mz", status: "inativo", hireDate: "2023-01-15" },
];

export const mockTransactions: Transaction[] = [
  { id: "T001", type: "entrada", category: "Pagamento Empréstimo", description: "Pagamento Maria Silva - E001", amount: 4583.33, date: "2025-03-01" },
  { id: "T002", type: "entrada", category: "Pagamento Empréstimo", description: "Pagamento João Santos - E002", amount: 5225, date: "2025-03-01" },
  { id: "T003", type: "entrada", category: "Pagamento Empréstimo", description: "Pagamento Beatriz Lopes - E006", amount: 4583.33, date: "2025-03-01" },
  { id: "T004", type: "saida", category: "Salários", description: "Salários Março 2025", amount: 278000, date: "2025-03-05" },
  { id: "T005", type: "saida", category: "Aluguel", description: "Aluguel do escritório", amount: 25000, date: "2025-03-01" },
  { id: "T006", type: "saida", category: "Despesas Operacionais", description: "Material de escritório", amount: 3500, date: "2025-03-03" },
  { id: "T007", type: "entrada", category: "Desembolso", description: "Novo empréstimo Carlos Neto", amount: 20000, date: "2025-03-07" },
  { id: "T008", type: "saida", category: "Internet/Comunicações", description: "Internet e telefone", amount: 8000, date: "2025-03-01" },
  { id: "T009", type: "entrada", category: "Pagamento Empréstimo", description: "Pagamento Luísa Mondlane - E004", amount: 3421.88, date: "2025-02-05" },
  { id: "T010", type: "entrada", category: "Juros", description: "Juros recebidos Fevereiro", amount: 12500, date: "2025-02-28" },
];

export const mockCalendarEvents: CalendarEvent[] = [
  { id: "EV001", title: "Pagamento Maria Silva", date: "2025-03-09", type: "payment", clientName: "Maria Silva", amount: 4583.33 },
  { id: "EV002", title: "Pagamento João Santos", date: "2025-03-09", type: "payment", clientName: "João Santos", amount: 5225 },
  { id: "EV003", title: "Cobrança Ana Fernandes (ATRASADO)", date: "2025-03-09", type: "overdue", clientName: "Ana Fernandes", amount: 4604.17 },
  { id: "EV004", title: "Pagamento Luísa Mondlane", date: "2025-03-10", type: "payment", clientName: "Luísa Mondlane", amount: 3421.88 },
  { id: "EV005", title: "Pagamento Beatriz Lopes", date: "2025-03-15", type: "payment", clientName: "Beatriz Lopes", amount: 4583.33 },
  { id: "EV006", title: "Reunião equipe", date: "2025-03-12", type: "meeting" },
  { id: "EV007", title: "Pagamento Maria Silva", date: "2025-04-01", type: "payment", clientName: "Maria Silva", amount: 4583.33 },
  { id: "EV008", title: "Pagamento João Santos", date: "2025-04-01", type: "payment", clientName: "João Santos", amount: 5225 },
];

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-MZ", { style: "currency", currency: "MZN", minimumFractionDigits: 2 }).format(value);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-MZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}
