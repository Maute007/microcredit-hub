import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { QueryErrorAlert } from "@/components/QueryErrorAlert";
import { DataTable } from "@/components/DataTable";
import { StatCard } from "@/components/StatCard";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  hrApi,
  type ApiEmployee,
  type ApiVacation,
  type ApiAttendanceRecord,
  type ApiSalarySlip,
} from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime } from "@/data/mockData";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Plus,
  Users,
  DollarSign,
  UserCheck,
  UserX,
  CalendarDays,
  FileText,
  ChevronLeft,
  ChevronRight,
  Printer,
  Clock,
  ClipboardCheck,
  MoreHorizontal,
  Pencil,
  Trash2,
  Palmtree,
  Loader2,
  UserPlus,
  CalendarCheck,
  TrendingUp,
  Mail,
  Phone,
  Settings,
  Flag,
  PartyPopper,
  Medal,
  Heart,
  Briefcase,
  Trophy,
  Shield,
  Bird,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isNationalHoliday, getHolidaysInMonth, WEEKDAY_CELL_STYLES } from "@/lib/holidays";

const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const holidayIconMap: Record<string, typeof Flag> = {
  PartyPopper: PartyPopper,
  Medal: Medal,
  Heart: Heart,
  Briefcase: Briefcase,
  Flag: Flag,
  Trophy: Trophy,
  Shield: Shield,
  Bird: Bird,
  Users: Users,
};
const weekdayHeaderStyles: Record<number, string> = {
  0: "text-rose-600 dark:text-rose-400 font-semibold",
  1: "text-sky-600 dark:text-sky-400",
  2: "text-emerald-600 dark:text-emerald-400",
  3: "text-amber-600 dark:text-amber-400",
  4: "text-violet-600 dark:text-violet-400",
  5: "text-orange-600 dark:text-orange-400",
  6: "text-blue-600 dark:text-blue-400 font-semibold",
};
const PRESET_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

function getDaysInMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate();
}
function getFirstDayOfMonth(y: number, m: number) {
  return new Date(y, m, 1).getDay();
}
function isDateInRange(dateStr: string, start: string, end: string) {
  const d = new Date(dateStr);
  const s = new Date(start);
  const e = new Date(end);
  return d >= s && d <= e;
}

function weekdayIdx(dateStr: string) {
  const d = new Date(dateStr);
  // JS: Sunday=0..Saturday=6 -> convert to Monday=0..Sunday=6
  return (d.getDay() + 6) % 7;
}

const attendanceStatusStyle: Record<string, string> = {
  presente: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  ausente: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  atrasado: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  ferias: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  justificado: "bg-slate-500/15 text-slate-600 dark:text-slate-400",
};

export default function HRPage() {
  const [showNewEmployee, setShowNewEmployee] = useState(false);
  const [showNewVacation, setShowNewVacation] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<ApiEmployee | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<ApiEmployee | null>(null);
  const [calDate, setCalDate] = useState(new Date());
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payrollMonth, setPayrollMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedSlip, setSelectedSlip] = useState<ApiSalarySlip | null>(null);
  const [showNewAttendance, setShowNewAttendance] = useState(false);
  const [editingAttendance, setEditingAttendance] = useState<ApiAttendanceRecord | null>(null);
  const [deletingAttendance, setDeletingAttendance] = useState<ApiAttendanceRecord | null>(null);
  const [editingVacation, setEditingVacation] = useState<ApiVacation | null>(null);
  const [deletingVacation, setDeletingVacation] = useState<ApiVacation | null>(null);
  const [preselectedEmployeeId, setPreselectedEmployeeId] = useState<number | null>(null);
  const [hrTab, setHrTab] = useState("employees");
  const [vacationFormStartDate, setVacationFormStartDate] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { canEditEmployee, canDeleteEmployee } = usePermissions();

  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const { data: employees = [], isLoading: employeesLoading, isError: employeesError, refetch: refetchEmployees } = useQuery({
    queryKey: ["employees"],
    queryFn: () => hrApi.employees.list({ page_size: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: vacations = [] } = useQuery({
    queryKey: ["vacations"],
    queryFn: () => hrApi.vacations.list(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: attendanceRecords = [] } = useQuery({
    queryKey: ["attendance", attendanceDate],
    queryFn: () =>
      hrApi.attendance.list({ date_from: attendanceDate, date_to: attendanceDate }),
    staleTime: 2 * 60 * 1000,
  });

  const { data: hrSettings } = useQuery({
    queryKey: ["hr-settings"],
    queryFn: () => hrApi.settings.get(),
    staleTime: 10 * 60 * 1000,
  });

  const { data: payrollData, isLoading: payrollLoading } = useQuery({
    queryKey: ["payroll", payrollMonth],
    queryFn: () => hrApi.salarySlips.simulateBulk({ month: payrollMonth }),
    enabled: employees.some((e) => e.status === "ativo"),
  });

  const { data: savedSlips = [], isLoading: savedSlipsLoading } = useQuery({
    queryKey: ["salary-slips", payrollMonth],
    queryFn: () => hrApi.salarySlips.list({ month: payrollMonth }),
  });

  const { data: payrollAdjustments = [] } = useQuery({
    queryKey: ["payroll-adjustments", payrollMonth],
    queryFn: () => hrApi.payrollAdjustments.list({ month: payrollMonth }),
  });

  const activeEmployees = employees.filter((e) => e.status === "ativo");
  const totalSalary = activeEmployees.reduce((s, e) => s + e.base_salary, 0);
  const payrollNetFromDb = savedSlips.reduce((s, slip) => s + (slip.net_salary || 0), 0);
  const payrollNetFromSim = payrollData?.slips?.reduce((s, slip) => s + (slip.net_salary || 0), 0) ?? 0;
  const rawPayrollCardValue = savedSlips.length ? payrollNetFromDb : payrollNetFromSim || totalSalary;
  const payrollCardValue = Number.isFinite(rawPayrollCardValue) ? rawPayrollCardValue : 0;
  const payrollCardLabel = savedSlips.length ? "Folha (líquido • DB)" : "Folha (líquido • simulação)";

  const getVacationsForDay = (day: number): ApiVacation[] => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return vacations.filter((v) =>
      isDateInRange(dateStr, v.start_date, v.end_date)
    );
  };

  const dayAttendance = attendanceRecords.filter((a) => a.date === attendanceDate);
  const presentToday = dayAttendance.filter((a) => a.status === "presente").length;
  const lateToday = dayAttendance.filter((a) => a.status === "atrasado").length;
  const absentToday = dayAttendance.filter((a) => a.status === "ausente").length;
  const validHours = dayAttendance
    .map((a) => (typeof a.hours_worked === "number" && !Number.isNaN(a.hours_worked) ? a.hours_worked : 0))
    .filter((h) => h > 0);
  const avgHours =
    validHours.length > 0
      ? (validHours.reduce((s, h) => s + h, 0) / validHours.length).toFixed(1)
      : "0";

  const expectedHoursForSelectedDay = (() => {
    const w = weekdayIdx(attendanceDate);
    const isWknd = hrSettings?.weekend_days?.includes(w) ?? false;
    const start = (isWknd ? hrSettings?.weekend_start : hrSettings?.workday_start) ?? "08:00";
    const end = (isWknd ? hrSettings?.weekend_end : hrSettings?.workday_end) ?? "17:00";
    const [sh, sm] = String(start).slice(0, 5).split(":").map(Number);
    const [eh, em] = String(end).slice(0, 5).split(":").map(Number);
    if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 8;
    return Math.max(0, (eh + em / 60) - (sh + sm / 60));
  })();
  const avgHoursNum = parseFloat(avgHours);
  const avgRatio = expectedHoursForSelectedDay > 0 ? avgHoursNum / expectedHoursForSelectedDay : 0;
  const goodRatio = hrSettings?.good_hours_ratio ?? 0.9;
  const okRatio = hrSettings?.ok_hours_ratio ?? 0.75;
  const avgHoursTone =
    avgRatio >= goodRatio ? "good" : avgRatio >= okRatio ? "ok" : "bad";
  const avgHoursCls =
    avgHoursTone === "good"
      ? "from-emerald-500/20 to-emerald-600/5 text-emerald-700 border-emerald-200/50"
      : avgHoursTone === "ok"
        ? "from-amber-500/20 to-amber-600/5 text-amber-700 border-amber-200/50"
        : "from-rose-500/20 to-rose-600/5 text-rose-700 border-rose-200/50";

  const slips = savedSlips.length > 0 ? savedSlips : (payrollData?.slips ?? []);
  const summary = payrollData?.summary;
  const isPayrollSaved = savedSlips.length > 0;

  const savePayrollMut = useMutation({
    mutationFn: async () => {
      if (!payrollData?.slips?.length || !payrollMonth) return;
      for (const slip of payrollData.slips) {
        const employeeId = slip.employee_id ?? slip.employee;
        if (employeeId == null) continue;
        await hrApi.salarySlips.create({
          employee: employeeId,
          month: payrollMonth,
          base_salary: slip.base_salary,
          overtime: slip.overtime,
          bonus: slip.bonus,
          gross_salary: slip.gross_salary,
          inss: slip.inss,
          irps: slip.irps,
          other_deductions: slip.other_deductions ?? 0,
          total_deductions: slip.total_deductions ?? slip.inss + slip.irps,
          net_salary: slip.net_salary,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salary-slips"] });
      toast({ title: "Folha guardada" });
    },
    onError: (e: unknown) => {
      toast({
        title: "Erro ao guardar folha",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    },
  });

  const adjByEmployee = new Map<number, (typeof payrollAdjustments)[number]>(
    payrollAdjustments.map((a) => [a.employee, a])
  );

  return (
    <div className="space-y-6">
      {employeesError && (
        <QueryErrorAlert onRetry={() => refetchEmployees()} />
      )}
      <PageHeader
        title="Recursos Humanos"
        description="Colaboradores, férias, presença e folha salarial"
        actions={
          <Dialog open={showNewEmployee} onOpenChange={setShowNewEmployee}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Colaborador
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Novo Colaborador</DialogTitle>
              </DialogHeader>
              <EmployeeForm
                onSuccess={() => {
                  setShowNewEmployee(false);
                  queryClient.invalidateQueries({ queryKey: ["employees"] });
                }}
              />
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border bg-gradient-to-br from-sky-500/10 to-sky-600/5 p-5 transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Colaboradores</p>
              <p className="text-2xl font-bold mt-1">{employees.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-sky-500/20 flex items-center justify-center">
              <Users className="h-6 w-6 text-sky-600" />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 p-5 transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Ativos</p>
              <p className="text-2xl font-bold mt-1 text-emerald-600">{activeEmployees.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <UserCheck className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${Math.min(100, (activeEmployees.length / Math.max(employees.length, 1)) * 100)}%` }}
            />
          </div>
        </div>
        <div className="rounded-2xl border bg-gradient-to-br from-amber-500/10 to-amber-600/5 p-5 transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Inativos</p>
              <p className="text-2xl font-bold mt-1 text-amber-600">{employees.length - activeEmployees.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <UserX className="h-6 w-6 text-amber-600" />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border bg-gradient-to-br from-violet-500/10 to-violet-600/5 p-5 transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{payrollCardLabel}</p>
              <p className="text-xl font-bold mt-1 text-violet-600">{formatCurrency(payrollCardValue)}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-violet-600" />
            </div>
          </div>
        </div>
      </div>

      <Tabs value={hrTab} onValueChange={setHrTab} className="space-y-4">
        <TabsList className="flex-wrap gap-1.5 bg-card/60 backdrop-blur-sm border p-1.5 rounded-2xl shadow-sm">
          <TabsTrigger value="employees" className="rounded-xl data-[state=active]:shadow-sm">
            <Users className="h-4 w-4 mr-1.5" />
            Colaboradores
            <span className="ml-2 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {employees.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="attendance" className="rounded-xl data-[state=active]:shadow-sm">
            <ClipboardCheck className="h-4 w-4 mr-1.5" />
            Presença
            <span className="ml-2 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {dayAttendance.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="vacations" className="rounded-xl data-[state=active]:shadow-sm">
            <CalendarDays className="h-4 w-4 mr-1.5" />
            Férias
            <span className="ml-2 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {vacations.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="payroll" className="rounded-xl data-[state=active]:shadow-sm">
            <FileText className="h-4 w-4 mr-1.5" />
            Folha Salarial
            <span className="ml-2 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {slips.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-xl data-[state=active]:shadow-sm">
            <Settings className="h-4 w-4 mr-1.5" />
            Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
            {employeesLoading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">A carregar colaboradores...</p>
              </div>
            ) : employees.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <UserPlus className="h-10 w-10 text-primary" />
                </div>
                <h3 className="font-semibold text-lg">Nenhum colaborador</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Adicione o primeiro colaborador para começar a gerir a equipa.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => setShowNewEmployee(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Colaborador
                </Button>
              </div>
            ) : (
              <DataTable
                data={employees}
                loading={employeesLoading}
                pageSize={10}
                getRowClassName={(e) =>
                  (e as ApiEmployee).status !== "ativo"
                    ? "bg-muted/40 text-muted-foreground"
                    : ""
                }
                columns={[
                  { key: "id", label: "ID" },
                  {
                    key: "name",
                    label: "Nome",
                    render: (e: ApiEmployee) => (
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 shadow-sm"
                          style={{
                            backgroundColor: (e.color || "#3b82f6") + "25",
                            color: e.color || "#3b82f6",
                          }}
                        >
                          {e.name
                            .split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")}
                        </div>
                        <div>
                          <span className="font-medium block">{e.name}</span>
                          {e.email && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {e.email}
                            </span>
                          )}
                        </div>
                      </div>
                    ),
                  },
                  { key: "role", label: "Cargo" },
                  { key: "department", label: "Departamento" },
                  {
                    key: "base_salary",
                    label: "Salário Base",
                    render: (e: ApiEmployee) => formatCurrency(e.base_salary),
                  },
                  { key: "phone", label: "Telefone" },
                  {
                    key: "status",
                    label: "Status",
                    render: (e: ApiEmployee) => (
                      <span
                        className={cn(
                          "inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium",
                          e.status === "ativo"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                            : "bg-slate-500/15 text-slate-600"
                        )}
                      >
                        {e.status}
                      </span>
                    ),
                  },
                  {
                    key: "hire_date",
                    label: "Admissão",
                    render: (e: ApiEmployee) =>
                      e.hire_date ? formatDate(e.hire_date) : "—",
                  },
                ]}
                searchKeys={["name", "role", "department", "email"]}
                renderRowActions={(canEditEmployee || canDeleteEmployee) ? (e) => (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(ev) => ev.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canEditEmployee && (
                        <DropdownMenuItem onClick={() => setEditingEmployee(e)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                      )}
                      {canDeleteEmployee && (
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeletingEmployee(e)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : undefined}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="attendance">
          <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
            <div className="p-5 border-b bg-gradient-to-r from-muted/50 to-transparent">
              <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center">
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Data</Label>
                    <Input
                      type="date"
                      value={attendanceDate}
                      onChange={(e) => setAttendanceDate(e.target.value)}
                      className="w-44 mt-1.5 rounded-lg"
                    />
                  </div>
                  <Dialog open={showNewAttendance} onOpenChange={(open) => { setShowNewAttendance(open); if (!open) setPreselectedEmployeeId(null); }}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Clock className="h-4 w-4 mr-2" />
                        Registrar ponto
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Registrar ponto</DialogTitle>
                      </DialogHeader>
                      <AttendanceForm
                        employees={activeEmployees}
                        defaultDate={attendanceDate}
                        initialEmployeeId={preselectedEmployeeId ?? undefined}
                        hrSettings={hrSettings}
                        onSuccess={(saved) => {
                          setShowNewAttendance(false);
                          setPreselectedEmployeeId(null);
                          if (saved?.date) setAttendanceDate(saved.date);
                          queryClient.invalidateQueries({ queryKey: ["attendance"] });
                        }}
                      />
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="flex flex-wrap gap-4">
                  {[
                    { label: "Presentes", value: presentToday, icon: UserCheck, cls: "from-emerald-500/20 to-emerald-600/5 text-emerald-700 border-emerald-200/50" },
                    { label: "Atrasados", value: lateToday, icon: Clock, cls: "from-amber-500/20 to-amber-600/5 text-amber-700 border-amber-200/50" },
                    { label: "Ausentes", value: absentToday, icon: UserX, cls: "from-rose-500/20 to-rose-600/5 text-rose-700 border-rose-200/50" },
                    { label: "Média Horas", value: `${avgHours}h`, icon: TrendingUp, cls: avgHoursCls },
                  ].map((s) => {
                    const Icon = s.icon;
                    return (
                      <div
                        key={s.label}
                        className={cn(
                          "rounded-xl border bg-gradient-to-br px-5 py-3 min-w-[100px] transition-shadow hover:shadow-sm",
                          s.cls
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 opacity-70" />
                          <p className="text-2xl font-bold">{s.value}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Colaborador
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Cargo
                    </th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                      Entrada
                    </th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                      Saída
                    </th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                      Horas
                    </th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                      Acções
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activeEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-16 text-center">
                        <CalendarCheck className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
                        <p className="text-sm text-muted-foreground">Nenhum colaborador activo</p>
                        <p className="text-xs text-muted-foreground mt-1">Adicione colaboradores para ver presenças</p>
                      </td>
                    </tr>
                  ) : activeEmployees.map((emp) => {
                    const record = dayAttendance.find(
                      (a) => a.employee === emp.id
                    );
                    const notHiredYet = !!emp.hire_date && attendanceDate < emp.hire_date;
                    const status = record?.status || "ausente";
                    return (
                      <tr
                        key={emp.id}
                        className="border-b last:border-0 hover:bg-muted/30"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                              style={{
                                backgroundColor: (emp.color || "#3b82f6") + "25",
                                color: emp.color || "#3b82f6",
                              }}
                            >
                              {emp.name
                                .split(" ")
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join("")}
                            </div>
                            <div>
                              <span className="font-medium block">{emp.name}</span>
                              {emp.role && (
                                <span className="text-xs text-muted-foreground">{emp.role}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {emp.role}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {record?.check_in ? (
                            <span className="inline-flex items-center gap-1 text-xs">
                              <Clock className="h-3 w-3" />
                              {record.check_in}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {record?.check_out ? (
                            <span className="inline-flex items-center gap-1 text-xs">
                              {record.check_out}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center font-medium">
                          {record?.hours_worked
                            ? `${record.hours_worked}h`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize",
                              notHiredYet
                                ? "bg-slate-500/15 text-slate-600 dark:text-slate-400"
                                : attendanceStatusStyle[status] || attendanceStatusStyle.ausente
                            )}
                          >
                            {notHiredYet ? "—" : status}
                          </span>
                          {notHiredYet ? (
                            <p className="text-[10px] text-muted-foreground mt-1">
                              A partir de {formatDate(emp.hire_date!)}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            {notHiredYet ? (
                              <Button variant="ghost" size="sm" className="h-8" disabled>
                                —
                              </Button>
                            ) : record ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8"
                                  onClick={() => setEditingAttendance(record)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-destructive"
                                  onClick={() => setDeletingAttendance(record)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs"
                                onClick={() => {
                                  setPreselectedEmployeeId(emp.id);
                                  setShowNewAttendance(true);
                                }}
                              >
                                Registrar
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="vacations">
          <div className="rounded-2xl border border-border/80 bg-card shadow-xl overflow-hidden backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 border-b bg-gradient-to-r from-violet-500/10 via-violet-500/5 to-transparent">
              <div>
                <h3 className="text-xl font-bold tracking-tight">
                  {months[month]} {year} — Calendário de Férias
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">Férias e feriados nacionais</p>
              </div>
              <div className="flex gap-2">
                <Dialog open={showNewVacation} onOpenChange={(o) => { setShowNewVacation(o); if (!o) setVacationFormStartDate(null); }}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Palmtree className="h-4 w-4 mr-2" />
                      Registrar Férias
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Registrar Férias</DialogTitle>
                    </DialogHeader>
                    <VacationForm
                      employees={activeEmployees}
                      initialStartDate={vacationFormStartDate ?? undefined}
                      onSuccess={() => {
                        setShowNewVacation(false);
                        setVacationFormStartDate(null);
                        queryClient.invalidateQueries({ queryKey: ["vacations"] });
                      }}
                    />
                  </DialogContent>
                </Dialog>
                <div className="flex rounded-lg border bg-background p-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCalDate(new Date(year, month - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCalDate(new Date())}
                  >
                    Hoje
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCalDate(new Date(year, month + 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            {/* Feriados do mês — cartões premium */}
            {(() => {
              const holidays = getHolidaysInMonth(year, month);
              if (holidays.length === 0) return null;
              return (
                <div className="px-4 py-3 border-b bg-gradient-to-r from-amber-50/50 via-orange-50/30 to-rose-50/50 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-rose-950/30">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Flag className="h-3.5 w-3.5" />
                    Feriados em {months[month]}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {holidays.map(({ day, info }) => {
                      const Icon = holidayIconMap[info.icon ?? "Flag"] ?? Flag;
                      return (
                        <div
                          key={`${day}-${info.name}`}
                          className={cn(
                            "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium text-white shadow-md",
                            "bg-gradient-to-r",
                            info.gradient ?? "from-red-500 to-rose-600"
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0 opacity-90" />
                          <span>{day}</span>
                          <span className="opacity-95">{info.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
            <div className="flex flex-wrap gap-3 p-4 border-b bg-muted/20">
              {vacations.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Nenhuma férias no mês</p>
              ) : null}
              {vacations
                .filter((v) => {
                  const vStart = new Date(v.start_date);
                  const vEnd = new Date(v.end_date);
                  const mStart = new Date(year, month, 1);
                  const mEnd = new Date(year, month + 1, 0);
                  return vStart <= mEnd && vEnd >= mStart;
                })
                .map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl border shadow-sm"
                    style={{ backgroundColor: (v.color || "#8b5cf6") + "20", borderColor: (v.color || "#8b5cf6") + "40" }}
                  >
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: v.color || "#8b5cf6" }}
                    />
                    <span>{v.employee_name}</span>
                  </div>
                ))}
            </div>
            <div className="p-4">
              <div className="grid grid-cols-7 text-center text-xs font-medium mb-2 gap-1">
                {weekDays.map((d, idx) => (
                  <div key={d} className={cn("py-2.5 rounded-lg", weekdayHeaderStyles[idx] ?? "text-muted-foreground")}>
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: firstDay }, (_, i) => (
                  <div key={`e-${i}`} className="min-h-[88px] rounded-xl bg-muted/20 border border-transparent" />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1;
                  const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const dayVacations = getVacationsForDay(day);
                  const today = new Date();
                  const isToday =
                    day === today.getDate() &&
                    month === today.getMonth() &&
                    year === today.getFullYear();
                  const dateObj = new Date(year, month, day);
                  const jsWeekday = dateObj.getDay();
                  const { isHoliday, name: holidayName, info: holidayInfo } = isNationalHoliday(year, month, day);
                  const weekdayStyle = WEEKDAY_CELL_STYLES[jsWeekday] ?? "";
                  const HolidayIcon = holidayInfo ? (holidayIconMap[holidayInfo.icon ?? "Flag"] ?? Flag) : Flag;
                  return (
                    <DropdownMenu key={day}>
                      <HoverCard openDelay={200} closeDelay={100}>
                        <HoverCardTrigger asChild>
                          <DropdownMenuTrigger asChild>
                            <div
                              className={cn(
                                "group relative min-h-[88px] rounded-xl p-2 border transition-all hover:shadow-lg hover:scale-[1.02] cursor-pointer",
                                isToday && "ring-2 ring-primary/50 bg-primary/5 shadow-md",
                                isHoliday && "bg-gradient-to-br from-red-100 to-rose-100 dark:from-red-900/50 dark:to-rose-900/50 border-red-200/60 dark:border-red-700/50",
                                !isToday && !isHoliday && weekdayStyle
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <span
                                  className={cn(
                                    "inline-flex items-center justify-center w-9 h-9 rounded-xl text-sm font-bold",
                                    isToday ? "bg-primary text-primary-foreground shadow-md" : "text-foreground bg-background/60",
                                    isHoliday && !isToday && "bg-gradient-to-br from-red-500/90 to-rose-600/90 text-white shadow"
                                  )}
                                >
                                  {day}
                                </span>
                                {isHoliday && <HolidayIcon className="h-4 w-4 text-rose-500 shrink-0" />}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-0.5">
                                {dayVacations.slice(0, 3).map((v) => (
                                  <div
                                    key={v.id}
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: v.color || "#8b5cf6" }}
                                    title={v.employee_name}
                                  />
                                ))}
                                {dayVacations.length > 3 && <span className="text-[9px] text-muted-foreground">+{dayVacations.length - 3}</span>}
                              </div>
                              <div className="mt-auto pt-1 text-[10px] text-muted-foreground">
                                {dayVacations.length > 0 ? `${dayVacations.length} férias` : isHoliday ? "Feriado" : "—"}
                              </div>
                              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                              </div>
                            </div>
                          </DropdownMenuTrigger>
                        </HoverCardTrigger>
                        <HoverCardContent side="top" className="w-72 p-0 overflow-hidden rounded-xl border-2 shadow-xl" align="center">
                          <div className="bg-gradient-to-br from-muted/50 to-background">
                            <div className="p-4 border-b">
                              <div className="flex items-center gap-3">
                                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 font-bold text-lg">
                                  {day}
                                </span>
                                <div>
                                  <p className="font-semibold">{day} de {months[month]}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {weekDays[jsWeekday]} · {dayVacations.length > 0 ? `${dayVacations.length} férias` : isHoliday ? "Feriado" : "Dia livre"}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="p-4 space-y-3 max-h-48 overflow-y-auto">
                              {isHoliday && holidayName && (
                                <div className={cn("rounded-xl p-3 text-white shadow-md", holidayInfo?.gradient ? `bg-gradient-to-r ${holidayInfo.gradient}` : "bg-gradient-to-r from-red-500 to-rose-600")}>
                                  <div className="flex items-center gap-2">
                                    <HolidayIcon className="h-5 w-5" />
                                    <span className="font-semibold">{holidayName}</span>
                                  </div>
                                  <p className="text-xs opacity-90 mt-1">Feriado nacional · Moçambique</p>
                                </div>
                              )}
                              {dayVacations.length === 0 && !isHoliday && (
                                <p className="text-sm text-muted-foreground text-center py-2">Dia sem férias registadas</p>
                              )}
                              {dayVacations.map((v) => (
                                <div key={v.id} className="flex items-center gap-2 rounded-lg border p-2" style={{ borderColor: (v.color || "#8b5cf6") + "50", backgroundColor: (v.color || "#8b5cf6") + "15" }}>
                                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: v.color || "#8b5cf6" }} />
                                  <span className="font-medium text-sm">{v.employee_name}</span>
                                  <Palmtree className="h-4 w-4 text-muted-foreground ml-auto" />
                                </div>
                              ))}
                            </div>
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                      <DropdownMenuContent align="start" className="min-w-[180px]">
                        <DropdownMenuItem
                          onClick={() => {
                            setHrTab("attendance");
                            setAttendanceDate(dateStr);
                            setShowNewAttendance(true);
                          }}
                        >
                          <Clock className="h-4 w-4 mr-2" />
                          Registrar ponto
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setVacationFormStartDate(dateStr);
                            setShowNewVacation(true);
                          }}
                        >
                          <Palmtree className="h-4 w-4 mr-2" />
                          Adicionar férias
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  );
                })}
              </div>
            </div>
            <div className="border-t">
              <div className="p-4">
                <h4 className="font-medium text-sm text-muted-foreground mb-3">Lista de férias</h4>
                {vacations.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">Nenhuma férias registada</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="px-4 py-2 text-left font-medium text-muted-foreground">Colaborador</th>
                          <th className="px-4 py-2 text-left font-medium text-muted-foreground">Início</th>
                          <th className="px-4 py-2 text-left font-medium text-muted-foreground">Fim</th>
                          <th className="px-4 py-2 text-center font-medium text-muted-foreground">Cor</th>
                          <th className="px-4 py-2 text-center font-medium text-muted-foreground">Acções</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vacations.map((v) => (
                          <tr key={v.id} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="px-4 py-2 font-medium">{v.employee_name}</td>
                            <td className="px-4 py-2">{formatDate(v.start_date)}</td>
                            <td className="px-4 py-2">{formatDate(v.end_date)}</td>
                            <td className="px-4 py-2 text-center">
                              <span
                                className="inline-block w-4 h-4 rounded-full border"
                                style={{ backgroundColor: v.color || "#8b5cf6" }}
                                title={v.color || ""}
                              />
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8"
                                  onClick={() => setEditingVacation(v)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-destructive"
                                  onClick={() => setDeletingVacation(v)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="payroll">
          <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 border-b bg-gradient-to-r from-emerald-500/5 to-transparent">
              <h3 className="font-semibold text-lg">
                Recibos de Vencimento — {months[parseInt(payrollMonth.slice(5, 7), 10) - 1]} {payrollMonth.slice(0, 4)}
              </h3>
              <div className="flex items-center gap-3">
                <Input
                  type="month"
                  value={payrollMonth}
                  onChange={(e) => setPayrollMonth(e.target.value)}
                  className="w-44"
                />
                {isPayrollSaved ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    <ClipboardCheck className="h-3.5 w-3.5" />
                    Folha guardada
                  </span>
                ) : payrollData?.slips?.length ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => savePayrollMut.mutate()}
                    disabled={savePayrollMut.isPending}
                  >
                    {savePayrollMut.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        A guardar...
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4 mr-2" />
                        Guardar folha
                      </>
                    )}
                  </Button>
                ) : null}
              </div>
            </div>
            {payrollLoading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">A calcular folha salarial...</p>
              </div>
            ) : activeEmployees.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <FileText className="h-10 w-10 text-primary" />
                </div>
                <h3 className="font-semibold text-lg">Sem dados para este mês</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Adicione colaboradores activos para visualizar a folha salarial.
                </p>
              </div>
            ) : (
              <>
                {summary && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 border-b">
                    <div className="rounded-xl bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Colaboradores</p>
                      <p className="text-lg font-bold">{summary.total_employees}</p>
                    </div>
                    <div className="rounded-xl bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Total Bruto</p>
                      <p className="text-lg font-bold">{formatCurrency(summary.total_gross_salary)}</p>
                    </div>
                    <div className="rounded-xl bg-rose-500/10 p-3">
                      <p className="text-xs text-rose-600">Total Descontos</p>
                      <p className="text-lg font-bold text-rose-600">-{formatCurrency(summary.total_deductions)}</p>
                    </div>
                    <div className="rounded-xl bg-emerald-500/10 p-3">
                      <p className="text-xs text-emerald-600">Total Líquido</p>
                      <p className="text-lg font-bold text-emerald-600">{formatCurrency(summary.total_net_salary)}</p>
                    </div>
                  </div>
                )}

                <div className="p-4 border-b bg-muted/10">
                  <PayrollAdjustmentsPanel
                    month={payrollMonth}
                    employees={activeEmployees}
                    adjustments={payrollAdjustments}
                    onSaved={() => {
                      queryClient.invalidateQueries({ queryKey: ["payroll-adjustments", payrollMonth] });
                      queryClient.invalidateQueries({ queryKey: ["payroll", payrollMonth] });
                      queryClient.invalidateQueries({ queryKey: ["salary-slips", payrollMonth] });
                    }}
                  />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          Colaborador
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          Cargo
                        </th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                          Salário Base
                        </th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                          INSS
                        </th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                          IRPS
                        </th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                          Outros/penal.
                        </th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                          Salário Líquido
                        </th>
                        <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                          Acções
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {slips.map((s) => (
                        <tr
                          key={s.id ?? s.employee_id ?? s.employee ?? s.employee_name}
                          className="border-b last:border-0 hover:bg-muted/30"
                        >
                          <td className="px-4 py-3 font-medium">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                                style={{
                                  backgroundColor: (activeEmployees.find((e) => e.id === (s.employee_id ?? s.employee))?.color || "#3b82f6") + "25",
                                  color: activeEmployees.find((e) => e.id === (s.employee_id ?? s.employee))?.color || "#3b82f6",
                                }}
                              >
                                {s.employee_name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .slice(0, 2)
                                  .join("")}
                              </div>
                              <span className="truncate">{s.employee_name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {s.role}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {formatCurrency(s.base_salary)}
                          </td>
                          <td className="px-4 py-3 text-right text-rose-600">
                            -{formatCurrency(s.inss)}
                          </td>
                          <td className="px-4 py-3 text-right text-rose-600">
                            -{formatCurrency(s.irps)}
                          </td>
                          <td className="px-4 py-3 text-right text-rose-600">
                            -{formatCurrency(s.other_deductions ?? 0)}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-600">
                            {formatCurrency(s.net_salary)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedSlip(s)}
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {summary && (
                      <tfoot>
                        <tr className="bg-muted/50 font-semibold">
                          <td className="px-4 py-3" colSpan={2}>
                            Total
                          </td>
                          <td className="px-4 py-3 text-right">
                            {formatCurrency(summary.total_gross_salary)}
                          </td>
                          <td className="px-4 py-3 text-right text-rose-600">
                            -{formatCurrency(summary.total_deductions)}
                          </td>
                          <td></td>
                          <td className="px-4 py-3 text-right text-emerald-600">
                            {formatCurrency(summary.total_net_salary)}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
            <div className="p-6 border-b bg-gradient-to-r from-slate-500/5 to-transparent">
              <h3 className="text-lg font-semibold">Configurações de RH</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Defina fins‑de‑semana, horários e auto-preenchimento diário de ponto.
              </p>
            </div>
            <div className="p-6">
              <HRSettingsForm
                initial={hrSettings}
                onSaved={() => {
                  queryClient.invalidateQueries({ queryKey: ["hr-settings"] });
                  queryClient.invalidateQueries({ queryKey: ["attendance"] });
                }}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!editingEmployee} onOpenChange={(o) => !o && setEditingEmployee(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Colaborador</DialogTitle>
          </DialogHeader>
          {editingEmployee && (
            <EmployeeForm
              employee={editingEmployee}
              onSuccess={() => {
                setEditingEmployee(null);
                queryClient.invalidateQueries({ queryKey: ["employees"] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingEmployee} onOpenChange={(o) => !o && setDeletingEmployee(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar colaborador?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingEmployee?.name} será removido. Esta acção não pode ser revertida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive"
              onClick={() => {
                if (deletingEmployee) {
                  hrApi.employees.delete(deletingEmployee.id).then(() => {
                    setDeletingEmployee(null);
                    queryClient.invalidateQueries({ queryKey: ["employees"] });
                    toast({ title: "Colaborador eliminado" });
                  });
                }
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!editingAttendance} onOpenChange={(o) => !o && setEditingAttendance(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar ponto</DialogTitle>
          </DialogHeader>
          {editingAttendance && (
            <AttendanceForm
              record={editingAttendance}
              employees={activeEmployees}
              defaultDate={editingAttendance.date}
              hrSettings={hrSettings}
              onSuccess={(saved) => {
                setEditingAttendance(null);
                if (saved?.date) setAttendanceDate(saved.date);
                queryClient.invalidateQueries({ queryKey: ["attendance"] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingAttendance} onOpenChange={(o) => !o && setDeletingAttendance(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar registo de ponto?</AlertDialogTitle>
            <AlertDialogDescription>
              O registo de {deletingAttendance?.employee_name} em {deletingAttendance?.date} será removido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive"
              onClick={() => {
                if (deletingAttendance) {
                  hrApi.attendance.delete(deletingAttendance.id).then(() => {
                    setDeletingAttendance(null);
                    queryClient.invalidateQueries({ queryKey: ["attendance"] });
                    toast({ title: "Registo eliminado" });
                  });
                }
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!editingVacation} onOpenChange={(o) => !o && setEditingVacation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar férias</DialogTitle>
          </DialogHeader>
          {editingVacation && (
            <VacationEditForm
              vacation={editingVacation}
              onSuccess={() => {
                setEditingVacation(null);
                queryClient.invalidateQueries({ queryKey: ["vacations"] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingVacation} onOpenChange={(o) => !o && setDeletingVacation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar férias?</AlertDialogTitle>
            <AlertDialogDescription>
              Férias de {deletingVacation?.employee_name} ({formatDate(deletingVacation?.start_date ?? "")} a {formatDate(deletingVacation?.end_date ?? "")}) serão removidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive"
              onClick={() => {
                if (deletingVacation) {
                  hrApi.vacations.delete(deletingVacation.id).then(() => {
                    setDeletingVacation(null);
                    queryClient.invalidateQueries({ queryKey: ["vacations"] });
                    toast({ title: "Férias eliminadas" });
                  });
                }
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!selectedSlip} onOpenChange={() => setSelectedSlip(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Recibo de Vencimento</DialogTitle>
          </DialogHeader>
          {selectedSlip && (
            <SalarySlipDetail slip={selectedSlip} month={payrollMonth} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AttendanceForm({
  employees,
  defaultDate,
  initialEmployeeId,
  record,
  hrSettings,
  onSuccess,
}: {
  employees: ApiEmployee[];
  defaultDate: string;
  initialEmployeeId?: number;
  record?: ApiAttendanceRecord;
  hrSettings?: { weekend_days: number[]; workday_start: string; workday_end: string; weekend_start: string; weekend_end: string };
  onSuccess: (saved?: ApiAttendanceRecord) => void;
}) {
  const [employeeId, setEmployeeId] = useState(
    record ? String(record.employee) : (initialEmployeeId ? String(initialEmployeeId) : "")
  );
  const [date, setDate] = useState(record?.date ?? defaultDate);
  const isWeekend = hrSettings?.weekend_days?.includes(weekdayIdx(record?.date ?? defaultDate)) ?? false;
  const defaultIn = isWeekend ? hrSettings?.weekend_start : hrSettings?.workday_start;
  const defaultOut = isWeekend ? hrSettings?.weekend_end : hrSettings?.workday_end;
  const [checkIn, setCheckIn] = useState(
    record?.check_in ? String(record.check_in).slice(0, 5) : (defaultIn ? String(defaultIn).slice(0, 5) : "08:00")
  );
  const [checkOut, setCheckOut] = useState(
    record?.check_out ? String(record.check_out).slice(0, 5) : (defaultOut ? String(defaultOut).slice(0, 5) : "17:00")
  );
  const [status, setStatus] = useState<ApiAttendanceRecord["status"]>(
    record?.status ?? "presente"
  );
  const { toast } = useToast();

  const selectedEmployee = employees.find((e) => String(e.id) === employeeId);
  const minDate = selectedEmployee?.hire_date ?? undefined;

  const createMut = useMutation({
    mutationFn: hrApi.attendance.create,
    onSuccess: (saved) => {
      toast({ title: "Ponto registado" });
      onSuccess(saved);
    },
    onError: (e: unknown) => {
      toast({
        title: "Erro",
        description: e instanceof Error ? e.message : "Erro ao registrar",
        variant: "destructive",
      });
    },
  });

  const updateMut = useMutation({
    mutationFn: (id: number) =>
      hrApi.attendance.update(id, {
        date,
        check_in: checkIn?.trim() ? checkIn : undefined,
        check_out: checkOut?.trim() ? checkOut : undefined,
        status,
      }),
    onSuccess: (saved) => {
      toast({ title: "Ponto actualizado" });
      onSuccess(saved);
    },
    onError: (e: unknown) => {
      toast({
        title: "Erro",
        description: e instanceof Error ? e.message : "Erro ao actualizar",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) {
      toast({ title: "Seleccione a data", variant: "destructive" });
      return;
    }
    if (minDate && date < minDate) {
      toast({ title: "Data inválida", description: "Não é possível registrar antes da data de admissão.", variant: "destructive" });
      return;
    }
    if (record) {
      updateMut.mutate(record.id);
    } else {
      if (!employeeId) {
        toast({ title: "Seleccione o colaborador", variant: "destructive" });
        return;
      }
      const emp = parseInt(employeeId, 10);
      if (Number.isNaN(emp)) {
        toast({ title: "Colaborador inválido", variant: "destructive" });
        return;
      }
      createMut.mutate({
        employee: emp,
        date,
        check_in: checkIn?.trim() ? checkIn : undefined,
        check_out: checkOut?.trim() ? checkOut : undefined,
        status,
      });
    }
  };

  const loading = createMut.isPending || updateMut.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!record ? (
        <div>
          <Label>Colaborador</Label>
          <Select value={employeeId} onValueChange={setEmployeeId} required>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              {employees.map((e) => (
                <SelectItem key={e.id} value={String(e.id)}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Colaborador: <span className="font-medium text-foreground">{record.employee_name}</span>
        </p>
      )}
      <div>
        <Label>Data</Label>
        <Input
          type="date"
          value={date}
          min={minDate || undefined}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        {minDate ? (
          <p className="text-xs text-muted-foreground mt-1">
            Disponível a partir de {formatDate(minDate)}.
          </p>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Entrada</Label>
          <Input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
        </div>
        <div>
          <Label>Saída</Label>
          <Input type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Status</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as ApiAttendanceRecord["status"])}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="presente">Presente</SelectItem>
            <SelectItem value="ausente">Ausente</SelectItem>
            <SelectItem value="atrasado">Atrasado</SelectItem>
            <SelectItem value="ferias">Férias</SelectItem>
            <SelectItem value="justificado">Justificado</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "A guardar..." : record ? "Guardar" : "Registrar"}
      </Button>
    </form>
  );
}

function HRSettingsForm({
  initial,
  onSaved,
}: {
  initial?: {
    weekend_days: number[];
    workday_start: string;
    workday_end: string;
    weekend_start: string;
    weekend_end: string;
    auto_fill_attendance: boolean;
    late_grace_minutes?: number;
    good_hours_ratio?: number;
    ok_hours_ratio?: number;
    auto_detect_late?: boolean;
  };
  onSaved: () => void;
}) {
  const week = [
    { idx: 0, label: "Seg" },
    { idx: 1, label: "Ter" },
    { idx: 2, label: "Qua" },
    { idx: 3, label: "Qui" },
    { idx: 4, label: "Sex" },
    { idx: 5, label: "Sáb" },
    { idx: 6, label: "Dom" },
  ];

  const [weekendDays, setWeekendDays] = useState<number[]>(initial?.weekend_days ?? [5, 6]);
  const [autoFill, setAutoFill] = useState(initial?.auto_fill_attendance ?? true);
  const [workStart, setWorkStart] = useState((initial?.workday_start ?? "08:00").slice(0, 5));
  const [workEnd, setWorkEnd] = useState((initial?.workday_end ?? "17:00").slice(0, 5));
  const [weekendStart, setWeekendStart] = useState((initial?.weekend_start ?? "08:00").slice(0, 5));
  const [weekendEnd, setWeekendEnd] = useState((initial?.weekend_end ?? "13:00").slice(0, 5));
  const [lateGrace, setLateGrace] = useState(String(initial?.late_grace_minutes ?? 10));
  const [goodRatioPct, setGoodRatioPct] = useState(String(((initial?.good_hours_ratio ?? 0.9) * 100).toFixed(0)));
  const [okRatioPct, setOkRatioPct] = useState(String(((initial?.ok_hours_ratio ?? 0.75) * 100).toFixed(0)));
  const [autoDetectLate, setAutoDetectLate] = useState(initial?.auto_detect_late ?? true);
  const { toast } = useToast();

  const saveMut = useMutation({
    mutationFn: () =>
      hrApi.settings.update({
        weekend_days: weekendDays,
        auto_fill_attendance: autoFill,
        workday_start: workStart,
        workday_end: workEnd,
        weekend_start: weekendStart,
        weekend_end: weekendEnd,
        late_grace_minutes: parseInt(lateGrace, 10) || 0,
        good_hours_ratio: Math.max(0, Math.min(1, (parseFloat(goodRatioPct) || 0) / 100)),
        ok_hours_ratio: Math.max(0, Math.min(1, (parseFloat(okRatioPct) || 0) / 100)),
        auto_detect_late: autoDetectLate,
      } as any),
    onSuccess: () => {
      toast({ title: "Configurações guardadas" });
      onSaved();
    },
    onError: (e: unknown) => {
      toast({
        title: "Erro",
        description: e instanceof Error ? e.message : "Não foi possível guardar",
        variant: "destructive",
      });
    },
  });

  const toggleWeekend = (idx: number) => {
    setWeekendDays((prev) =>
      prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx].sort((a, b) => a - b)
    );
  };

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        saveMut.mutate();
      }}
    >
      <div className="rounded-xl border bg-muted/20 p-4">
        <p className="font-semibold">Dias de fim‑de‑semana</p>
        <p className="text-xs text-muted-foreground mt-1">
          O sistema irá marcar ponto automático (ausente) apenas nos dias que não forem fim‑de‑semana.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          {week.map((d) => {
            const active = weekendDays.includes(d.idx);
            return (
              <Button
                key={d.idx}
                type="button"
                variant={active ? "default" : "outline"}
                size="sm"
                onClick={() => toggleWeekend(d.idx)}
              >
                {d.label}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
          <p className="font-semibold">Horário (dias úteis)</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Entrada</Label>
              <Input type="time" value={workStart} onChange={(e) => setWorkStart(e.target.value)} />
            </div>
            <div>
              <Label>Saída</Label>
              <Input type="time" value={workEnd} onChange={(e) => setWorkEnd(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
          <p className="font-semibold">Horário (fim‑de‑semana)</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Entrada</Label>
              <Input type="time" value={weekendStart} onChange={(e) => setWeekendStart(e.target.value)} />
            </div>
            <div>
              <Label>Saída</Label>
              <Input type="time" value={weekendEnd} onChange={(e) => setWeekendEnd(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-muted/20 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold">Auto-preenchimento diário</p>
            <p className="text-xs text-muted-foreground mt-1">
              Se activado, ao consultar um intervalo passado o sistema cria automaticamente pontos “ausente”
              para dias úteis em falta (e “férias” quando aplicável).
            </p>
          </div>
          <Button
            type="button"
            variant={autoFill ? "default" : "outline"}
            onClick={() => setAutoFill((v) => !v)}
          >
            {autoFill ? "Activado" : "Desactivado"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold">Políticas de presença</p>
            <p className="text-xs text-muted-foreground mt-1">
              Regras globais para atraso e classificação automática.
            </p>
          </div>
          <Button
            type="button"
            variant={autoDetectLate ? "default" : "outline"}
            onClick={() => setAutoDetectLate((v) => !v)}
          >
            {autoDetectLate ? "Auto‑atraso: ON" : "Auto‑atraso: OFF"}
          </Button>
        </div>
        <div className="rounded-lg border bg-background/60 px-3 py-2 text-xs text-muted-foreground leading-relaxed">
          <p className="font-medium text-foreground">O que é Auto‑atraso?</p>
          <p className="mt-1">
            Quando está <span className="font-medium text-foreground">ON</span>, ao registrar um ponto com
            <span className="font-medium text-foreground"> Entrada</span> o sistema compara com o horário padrão do dia
            (dias úteis/fim‑de‑semana) + <span className="font-medium text-foreground">tolerância</span>.
            Se ultrapassar, o status pode ser marcado como <span className="font-medium text-foreground">atrasado</span>
            automaticamente.
          </p>
          <p className="mt-1">
            Exemplo: entrada 08:00, tolerância 10min → limite 08:10. Se entrar 08:12, fica <span className="font-medium text-foreground">atrasado</span>.
          </p>
          <p className="mt-1">
            Quando está <span className="font-medium text-foreground">OFF</span>, você escolhe o status manualmente.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>Tolerância atraso (min)</Label>
            <Input type="number" value={lateGrace} onChange={(e) => setLateGrace(e.target.value)} />
          </div>
          <div>
            <Label>Horas “Bom” (≥ %)</Label>
            <Input type="number" value={goodRatioPct} onChange={(e) => setGoodRatioPct(e.target.value)} />
          </div>
          <div>
            <Label>Horas “Normal” (≥ %)</Label>
            <Input type="number" value={okRatioPct} onChange={(e) => setOkRatioPct(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          O semáforo usa \(média\_horas / horas\_esperadas\) do dia selecionado.
        </p>
      </div>

      <Button type="submit" className="w-full" disabled={saveMut.isPending}>
        {saveMut.isPending ? "A guardar..." : "Guardar configurações"}
      </Button>
    </form>
  );
}

type AdjustmentItem = {
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
};

function PayrollAdjustmentsPanel({
  month,
  employees,
  adjustments,
  onSaved,
}: {
  month: string;
  employees: ApiEmployee[];
  adjustments: AdjustmentItem[];
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdjustmentItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdjustmentItem | null>(null);
  const [historyFor, setHistoryFor] = useState<AdjustmentItem | null>(null);

  const [date, setDate] = useState<string>("");
  const [overtime, setOvertime] = useState<string>("0");
  const [bonus, setBonus] = useState<string>("0");
  const [ded, setDed] = useState<string>("0");
  const [notes, setNotes] = useState<string>("");
  const [selectedEmp, setSelectedEmp] = useState<string>("");

  const resetForm = () => {
    setEditing(null);
    setDate("");
    setOvertime("0");
    setBonus("0");
    setDed("0");
    setNotes("");
    setSelectedEmp("");
  };

  const openAdd = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEdit = (a: AdjustmentItem) => {
    setEditing(a);
    setSelectedEmp(String(a.employee));
    setDate(a.date || "");
    setOvertime(String(a.overtime ?? 0));
    setBonus(String(a.bonus ?? 0));
    setDed(String(a.other_deductions_manual ?? 0));
    setNotes(a.notes || "");
    setFormOpen(true);
  };

  const upsertMut = useMutation({
    mutationFn: (payload: { employee: number; month: string; date?: string; overtime?: number; bonus?: number; other_deductions_manual?: number; notes?: string }) =>
      hrApi.payrollAdjustments.upsert(payload),
    onSuccess: () => {
      toast({ title: "Lançamento guardado" });
      onSaved();
      setFormOpen(false);
      resetForm();
    },
    onError: (e: unknown) => {
      toast({
        title: "Erro",
        description: e instanceof Error ? e.message : "Não foi possível guardar",
        variant: "destructive",
      });
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { overtime: number; bonus: number; other_deductions_manual: number; notes?: string; date?: string } }) =>
      hrApi.payrollAdjustments.update(id, payload),
    onSuccess: () => {
      toast({ title: "Lançamento actualizado" });
      onSaved();
      setFormOpen(false);
      resetForm();
    },
    onError: (e: unknown) => {
      toast({
        title: "Erro",
        description: e instanceof Error ? e.message : "Não foi possível actualizar",
        variant: "destructive",
      });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => hrApi.payrollAdjustments.delete(id),
    onSuccess: () => {
      toast({ title: "Lançamento removido" });
      onSaved();
      setDeleteTarget(null);
    },
    onError: (e: unknown) => {
      toast({
        title: "Erro",
        description: e instanceof Error ? e.message : "Não foi possível remover",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    const empId = parseInt(selectedEmp, 10);
    if (Number.isNaN(empId)) {
      toast({ title: "Selecione um colaborador", variant: "destructive" });
      return;
    }
    const payload = {
      employee: empId,
      month,
      date: date || undefined,
      overtime: parseFloat(overtime) || 0,
      bonus: parseFloat(bonus) || 0,
      other_deductions_manual: parseFloat(ded) || 0,
      notes: notes || undefined,
    };
    if (editing) {
      updateMut.mutate({
        id: editing.id,
        payload: {
          overtime: payload.overtime,
          bonus: payload.bonus,
          other_deductions_manual: payload.other_deductions_manual,
          notes: payload.notes,
          date: payload.date,
        },
      });
    } else {
      upsertMut.mutate(payload);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-background overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">Lançamentos do mês</p>
            <p className="text-xs text-muted-foreground">
              Bónus, horas extras e descontos manuais. Impacta a simulação e folha guardada.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar lançamento
            </Button>
            <span className="text-xs text-muted-foreground">{adjustments.length} registados</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20">
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Colaborador</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Data</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Horas extra</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Bónus</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Desc. manual</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Notas</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground w-32">Ações</th>
              </tr>
            </thead>
            <tbody>
              {adjustments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                    Sem lançamentos neste mês
                  </td>
                </tr>
              ) : (
                adjustments.map((a) => (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-2 font-medium">{a.employee_name}</td>
                    <td className="px-4 py-2 text-left text-xs text-muted-foreground">{a.date ?? "—"}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(a.overtime)}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(a.bonus)}</td>
                    <td className="px-4 py-2 text-right text-rose-600">-{formatCurrency(a.other_deductions_manual)}</td>
                    <td className="px-4 py-2 text-muted-foreground">{a.notes || "—"}</td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => { e.stopPropagation(); openEdit(a); }}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={(e) => { e.stopPropagation(); setHistoryFor(a); }}
                          title="Histórico"
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(a); }}
                          title="Apagar"
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

      {/* Modal Adicionar/Editar */}
      <Dialog open={formOpen} onOpenChange={(o) => { setFormOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs text-muted-foreground">Colaborador</Label>
              <Select value={selectedEmp} onValueChange={setSelectedEmp} disabled={!!editing}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Selecionar colaborador" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Data</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Horas extra (MT)</Label>
                <Input type="number" value={overtime} onChange={(e) => setOvertime(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Bónus (MT)</Label>
                <Input type="number" value={bonus} onChange={(e) => setBonus(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Desc. manual (MT)</Label>
                <Input type="number" value={ded} onChange={(e) => setDed(e.target.value)} className="mt-1.5" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Notas (opcional)</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1.5" placeholder="Ex: cobertura, turno extra, prémio..." />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button
                onClick={handleSubmit}
                disabled={!selectedEmp || upsertMut.isPending || updateMut.isPending}
              >
                {(upsertMut.isPending || updateMut.isPending) ? "A guardar..." : editing ? "Guardar alterações" : "Guardar lançamento"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmação de eliminação */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              O lançamento de {deleteTarget?.employee_name} será eliminado permanentemente. Esta acção será registada no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? "A remover..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal Histórico */}
      <Dialog open={!!historyFor} onOpenChange={(o) => { if (!o) setHistoryFor(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico — {historyFor?.employee_name}
            </DialogTitle>
          </DialogHeader>
          {historyFor && (
            <PayrollAdjustmentHistory adjustmentId={historyFor.id} onClose={() => setHistoryFor(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PayrollAdjustmentHistory({ adjustmentId, onClose }: { adjustmentId: number; onClose: () => void }) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["payroll-adjustment-history", adjustmentId],
    queryFn: () => hrApi.payrollAdjustments.history(adjustmentId),
    enabled: !!adjustmentId,
  });

  return (
    <div className="flex-1 overflow-y-auto min-h-0 py-2">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : history.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum histórico disponível</p>
      ) : (
        <div className="space-y-2">
          {history.map((h) => (
            <div
              key={h.history_id}
              className={cn(
                "rounded-lg border p-3 text-sm",
                h.history_type === "+" && "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30",
                h.history_type === "~" && "border-amber-200 bg-amber-50/30 dark:border-amber-900 dark:bg-amber-950/20",
                h.history_type === "-" && "border-rose-200 bg-rose-50/30 dark:border-rose-900 dark:bg-rose-950/20",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{h.history_type_label}</span>
                <span className="text-xs text-muted-foreground">
                  {h.history_date ? formatDateTime(h.history_date) : "—"}
                  {h.history_user ? ` · ${h.history_user}` : ""}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 mt-2 text-xs">
                <span>H. extra: {formatCurrency(h.overtime)}</span>
                <span>Bónus: {formatCurrency(h.bonus)}</span>
                <span className="text-rose-600">Desc: {formatCurrency(h.other_deductions_manual)}</span>
                {h.notes && <span className="col-span-4 truncate" title={h.notes}>Notas: {h.notes}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmployeeForm({
  employee,
  onSuccess,
}: {
  employee?: ApiEmployee;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(employee?.name ?? "");
  const [role, setRole] = useState(employee?.role ?? "");
  const [department, setDepartment] = useState(employee?.department ?? "");
  const [baseSalary, setBaseSalary] = useState(
    employee ? String(employee.base_salary) : ""
  );
  const [phone, setPhone] = useState(employee?.phone ?? "");
  const [email, setEmail] = useState(employee?.email ?? "");
  const [hireDate, setHireDate] = useState(employee?.hire_date ?? "");
  const [status, setStatus] = useState(employee?.status ?? "ativo");
  const [color, setColor] = useState(employee?.color || PRESET_COLORS[0]);
  const [inssPct, setInssPct] = useState(() =>
    String(((employee?.inss_rate ?? 0.03) * 100).toFixed(2))
  );
  const [irpsPct, setIrpsPct] = useState(() =>
    String(((employee?.irps_rate ?? 0.10) * 100).toFixed(2))
  );
  const [otherPct, setOtherPct] = useState(() =>
    String(((employee?.other_deductions_rate ?? 0.01) * 100).toFixed(2))
  );
  const [overtimePct, setOvertimePct] = useState(() =>
    String(((employee?.overtime_rate_default ?? 0) * 100).toFixed(2))
  );
  const [penAbsentPct, setPenAbsentPct] = useState(() =>
    String(((employee?.penalty_absent_rate ?? 0) * 100).toFixed(2))
  );
  const [penLatePct, setPenLatePct] = useState(() =>
    String(((employee?.penalty_late_rate ?? 0) * 100).toFixed(2))
  );
  const { toast } = useToast();

  const pctToRate = (v: string, fallback: number) => {
    const n = parseFloat(String(v).replace(",", "."));
    if (Number.isNaN(n)) return fallback;
    return Math.max(0, Math.min(1, n / 100));
  };

  const createMut = useMutation({
    mutationFn: hrApi.employees.create,
    onSuccess: () => {
      toast({ title: "Colaborador criado" });
      onSuccess();
    },
    onError: (e: unknown) => {
      toast({
        title: "Erro",
        description: e instanceof Error ? e.message : "Erro ao criar",
        variant: "destructive",
      });
    },
  });

  const updateMut = useMutation({
    mutationFn: (id: number) =>
      hrApi.employees.update(id, {
        name,
        role,
        department,
        base_salary: parseFloat(baseSalary) || 0,
        phone,
        email,
        hire_date: hireDate || undefined,
        status: status as "ativo" | "inativo",
        color,
        inss_rate: pctToRate(inssPct, employee?.inss_rate ?? 0.03),
        irps_rate: pctToRate(irpsPct, employee?.irps_rate ?? 0.10),
        other_deductions_rate: pctToRate(otherPct, employee?.other_deductions_rate ?? 0.01),
        overtime_rate_default: pctToRate(overtimePct, employee?.overtime_rate_default ?? 0),
        penalty_absent_rate: pctToRate(penAbsentPct, employee?.penalty_absent_rate ?? 0),
        penalty_late_rate: pctToRate(penLatePct, employee?.penalty_late_rate ?? 0),
      }),
    onSuccess: () => {
      toast({ title: "Colaborador actualizado" });
      onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (employee) {
      updateMut.mutate(employee.id);
    } else {
      createMut.mutate({
        name,
        role,
        department,
        base_salary: parseFloat(baseSalary) || 0,
        phone,
        email,
        hire_date: hireDate || undefined,
        status: status as "ativo" | "inativo",
        color,
        inss_rate: pctToRate(inssPct, 0.03),
        irps_rate: pctToRate(irpsPct, 0.10),
        other_deductions_rate: pctToRate(otherPct, 0.01),
        overtime_rate_default: pctToRate(overtimePct, 0),
        penalty_absent_rate: pctToRate(penAbsentPct, 0),
        penalty_late_rate: pctToRate(penLatePct, 0),
      });
    }
  };

  const loading = createMut.isLoading || updateMut.isLoading;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Tabs defaultValue="dados" className="space-y-4">
        <TabsList className="flex-wrap gap-1 bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="dados" className="rounded-lg">Dados</TabsTrigger>
          <TabsTrigger value="contacto" className="rounded-lg">Contacto</TabsTrigger>
          <TabsTrigger value="politicas" className="rounded-lg">Políticas</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label>Cargo</Label>
              <Input value={role} onChange={(e) => setRole(e.target.value)} required />
            </div>
            <div>
              <Label>Departamento</Label>
              <Input value={department} onChange={(e) => setDepartment(e.target.value)} />
            </div>
            <div>
              <Label>Salário Base (MT)</Label>
              <Input
                type="number"
                value={baseSalary}
                onChange={(e) => setBaseSalary(e.target.value)}
                required
              />
            </div>
            <div>
              <Label>Data Contratação</Label>
              <Input
                type="date"
                value={hireDate}
                onChange={(e) => setHireDate(e.target.value)}
              />
            </div>
          </div>

          {employee && (
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Cor (calendário)</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "w-8 h-8 rounded-full border-2",
                    color === c ? "border-foreground" : "border-transparent"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-8 h-8 rounded-full cursor-pointer"
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="contacto" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Telefone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="politicas" className="space-y-4">
          <div className="rounded-xl border bg-muted/20 p-4 space-y-4">
            <div>
              <p className="text-sm font-semibold">Impostos & descontos</p>
              <p className="text-xs text-muted-foreground mt-1">
                Percentagens usadas na folha salarial e penalizações automáticas.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>INSS (%)</Label>
                <Input type="number" value={inssPct} onChange={(e) => setInssPct(e.target.value)} />
              </div>
              <div>
                <Label>IRPS (%)</Label>
                <Input type="number" value={irpsPct} onChange={(e) => setIrpsPct(e.target.value)} />
              </div>
              <div>
                <Label>Outras deduções (%)</Label>
                <Input type="number" value={otherPct} onChange={(e) => setOtherPct(e.target.value)} />
              </div>
              <div>
                <Label>Horas extra padrão (%)</Label>
                <Input type="number" value={overtimePct} onChange={(e) => setOvertimePct(e.target.value)} />
              </div>
              <div>
                <Label>Penalização por falta (%)</Label>
                <Input type="number" value={penAbsentPct} onChange={(e) => setPenAbsentPct(e.target.value)} />
              </div>
              <div>
                <Label>Penalização por atraso (%)</Label>
                <Input type="number" value={penLatePct} onChange={(e) => setPenLatePct(e.target.value)} />
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "A guardar..." : employee ? "Guardar" : "Cadastrar"}
      </Button>
    </form>
  );
}

function VacationForm({
  employees,
  initialStartDate,
  onSuccess,
}: {
  employees: ApiEmployee[];
  initialStartDate?: string;
  onSuccess: () => void;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [startDate, setStartDate] = useState(initialStartDate ?? "");
  const [endDate, setEndDate] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const { toast } = useToast();

  const createMut = useMutation({
    mutationFn: hrApi.vacations.create,
    onSuccess: () => {
      toast({ title: "Férias registadas" });
      onSuccess();
    },
    onError: (e: unknown) => {
      toast({
        title: "Erro",
        description: e instanceof Error ? e.message : "Erro ao registrar",
        variant: "destructive",
      });
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!employeeId) {
          toast({ title: "Seleccione o colaborador", variant: "destructive" });
          return;
        }
        if (!startDate || !endDate) {
          toast({ title: "Preencha as datas", variant: "destructive" });
          return;
        }
        if (endDate < startDate) {
          toast({ title: "Data fim deve ser posterior à data início", variant: "destructive" });
          return;
        }
        const emp = parseInt(employeeId, 10);
        if (Number.isNaN(emp)) {
          toast({ title: "Colaborador inválido", variant: "destructive" });
          return;
        }
        createMut.mutate({
          employee: emp,
          start_date: startDate,
          end_date: endDate,
          color,
        });
      }}
      className="space-y-4"
    >
      <div>
        <Label>Colaborador</Label>
        <Select value={employeeId} onValueChange={setEmployeeId} required>
          <SelectTrigger>
            <SelectValue placeholder="Selecionar" />
          </SelectTrigger>
          <SelectContent>
            {employees.map((e) => (
              <SelectItem key={e.id} value={String(e.id)}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Data início</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>
        <div>
          <Label>Data fim</Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </div>
      </div>
      <div>
        <Label>Cor</Label>
        <div className="flex gap-2 mt-1">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={cn(
                "w-8 h-8 rounded-full border-2",
                color === c ? "border-foreground" : "border-transparent"
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={createMut.isLoading}>
        {createMut.isLoading ? "A guardar..." : "Registrar"}
      </Button>
    </form>
  );
}

function VacationEditForm({
  vacation,
  onSuccess,
}: {
  vacation: ApiVacation;
  onSuccess: () => void;
}) {
  const [startDate, setStartDate] = useState(vacation.start_date);
  const [endDate, setEndDate] = useState(vacation.end_date);
  const [color, setColor] = useState(vacation.color || PRESET_COLORS[0]);
  const { toast } = useToast();

  const updateMut = useMutation({
    mutationFn: () =>
      hrApi.vacations.update(vacation.id, { start_date: startDate, end_date: endDate, color }),
    onSuccess: () => {
      toast({ title: "Férias actualizadas" });
      onSuccess();
    },
    onError: (e: unknown) => {
      toast({
        title: "Erro",
        description: e instanceof Error ? e.message : "Erro ao actualizar",
        variant: "destructive",
      });
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        updateMut.mutate();
      }}
      className="space-y-4"
    >
      <p className="text-sm text-muted-foreground">
        Colaborador: <span className="font-medium text-foreground">{vacation.employee_name}</span>
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Data início</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>
        <div>
          <Label>Data fim</Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </div>
      </div>
      <div>
        <Label>Cor</Label>
        <div className="flex gap-2 mt-1">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={cn(
                "w-8 h-8 rounded-full border-2",
                color === c ? "border-foreground" : "border-transparent"
              )}
              style={{ backgroundColor: c }}
            />
          ))}
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-8 h-8 rounded-full cursor-pointer"
          />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={updateMut.isPending}>
        {updateMut.isPending ? "A guardar..." : "Guardar"}
      </Button>
    </form>
  );
}

function SalarySlipDetail({ slip, month }: { slip: ApiSalarySlip; month: string }) {
  const [y, m] = month.split("-");
  const monthName = months[parseInt(m, 10) - 1];

  return (
    <div className="space-y-4">
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
        <div className="flex justify-between items-start">
          <div>
            <p className="font-bold text-lg">{slip.employee_name}</p>
            <p className="text-sm text-muted-foreground">{slip.role}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">{monthName} {y}</p>
            <p className="text-xs text-muted-foreground">MicroCrédito</p>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <h4 className="font-semibold text-sm border-b pb-1">Rendimentos</h4>
        <div className="flex justify-between text-sm">
          <span>Salário Base</span>
          <span>{formatCurrency(slip.base_salary)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Horas Extra</span>
          <span>{formatCurrency(slip.overtime)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Bónus</span>
          <span>{formatCurrency(slip.bonus)}</span>
        </div>
        <div className="flex justify-between text-sm font-semibold border-t pt-1">
          <span>Salário Bruto</span>
          <span>{formatCurrency(slip.gross_salary)}</span>
        </div>
      </div>
      <div className="space-y-2">
        <h4 className="font-semibold text-sm border-b pb-1">Descontos</h4>
        <div className="flex justify-between text-sm">
          <span>INSS</span>
          <span className="text-rose-600">-{formatCurrency(slip.inss)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>IRPS</span>
          <span className="text-rose-600">-{formatCurrency(slip.irps)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Outros / Penalizações</span>
          <span className="text-rose-600">-{formatCurrency(slip.other_deductions ?? 0)}</span>
        </div>
        <div className="flex justify-between text-sm font-semibold border-t pt-1">
          <span>Total descontos</span>
          <span className="text-rose-600">-{formatCurrency(slip.total_deductions ?? (slip.inss + slip.irps + (slip.other_deductions ?? 0)))}</span>
        </div>
      </div>
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex justify-between items-center">
        <span className="font-bold text-lg">Salário Líquido</span>
        <span className="font-bold text-xl text-emerald-600">
          {formatCurrency(slip.net_salary)}
        </span>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1">
          <Printer className="h-4 w-4 mr-1.5" />
          Imprimir
        </Button>
        <Button className="flex-1">
          <FileText className="h-4 w-4 mr-1.5" />
          Exportar
        </Button>
      </div>
    </div>
  );
}
