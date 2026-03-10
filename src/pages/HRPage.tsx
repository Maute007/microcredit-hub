import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mockEmployees, mockVacations, mockAttendance, generateSalarySlip, formatCurrency, formatDate, Employee, SalarySlip, Vacation, AttendanceRecord } from "@/data/mockData";
import { Plus, Users, DollarSign, UserCheck, UserX, CalendarDays, FileText, ChevronLeft, ChevronRight, Printer, Clock, ClipboardCheck } from "lucide-react";

const months = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const weekDays = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDayOfMonth(y: number, m: number) { return new Date(y, m, 1).getDay(); }

function isDateInRange(dateStr: string, start: string, end: string) {
  const d = new Date(dateStr), s = new Date(start), e = new Date(end);
  return d >= s && d <= e;
}

const employeeColumns = [
  { key: "id", label: "ID" },
  { key: "name", label: "Nome" },
  { key: "role", label: "Cargo" },
  { key: "department", label: "Departamento" },
  { key: "baseSalary", label: "Salário Base", render: (e: Employee) => formatCurrency(e.baseSalary) },
  { key: "phone", label: "Telefone" },
  { key: "status", label: "Status", render: (e: Employee) => <StatusBadge status={e.status} /> },
  { key: "hireDate", label: "Admissão", render: (e: Employee) => formatDate(e.hireDate) },
];

const active = mockEmployees.filter(e => e.status === "ativo");
const totalSalary = active.reduce((s, e) => s + e.baseSalary, 0);

const attendanceStatusStyle: Record<string, string> = {
  presente: "bg-success/10 text-success",
  ausente: "bg-destructive/10 text-destructive",
  atrasado: "bg-warning/10 text-warning",
  férias: "bg-info/10 text-info",
  justificado: "bg-muted text-muted-foreground",
};

export default function HRPage() {
  const [showNew, setShowNew] = useState(false);
  const [calDate, setCalDate] = useState(new Date(2025, 2));
  const [selectedSlip, setSelectedSlip] = useState<SalarySlip | null>(null);
  const [attendanceDate, setAttendanceDate] = useState("2025-03-07");

  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const getVacationsForDay = (day: number): Vacation[] => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return mockVacations.filter(v => isDateInRange(dateStr, v.startDate, v.endDate));
  };

  const dayAttendance = mockAttendance.filter(a => a.date === attendanceDate);
  const presentToday = dayAttendance.filter(a => a.status === "presente").length;
  const lateToday = dayAttendance.filter(a => a.status === "atrasado").length;
  const absentToday = dayAttendance.filter(a => a.status === "ausente").length;
  const avgHours = dayAttendance.length > 0 ? (dayAttendance.reduce((s, a) => s + a.hoursWorked, 0) / dayAttendance.filter(a => a.hoursWorked > 0).length || 0).toFixed(1) : "0";

  return (
    <div>
      <PageHeader
        title="Recursos Humanos"
        description="Gestão de colaboradores, férias, presença e folha salarial"
        actions={
          <Dialog open={showNew} onOpenChange={setShowNew}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Novo Colaborador</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Novo Colaborador</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Nome completo</Label><Input placeholder="Nome do colaborador" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Cargo</Label><Input placeholder="Cargo" /></div>
                  <div><Label>Departamento</Label><Input placeholder="Departamento" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Salário Base (MT)</Label><Input type="number" placeholder="Salário" /></div>
                  <div><Label>Data Contratação</Label><Input type="date" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Telefone</Label><Input placeholder="Telefone" /></div>
                  <div><Label>Email</Label><Input type="email" placeholder="Email" /></div>
                </div>
                <Button className="w-full" onClick={() => setShowNew(false)}>Cadastrar Colaborador</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Colaboradores" value={String(mockEmployees.length)} icon={Users} sparkData={[4, 5, 5, 6, 7, 8]} />
        <StatCard title="Ativos" value={String(active.length)} icon={UserCheck} variant="success" progress={{ value: active.length, max: mockEmployees.length, label: "Taxa de atividade" }} />
        <StatCard title="Inativos" value={String(mockEmployees.length - active.length)} icon={UserX} variant="warning" />
        <StatCard title="Folha Salarial" value={formatCurrency(totalSalary)} icon={DollarSign} variant="primary" trend={{ value: 5, label: "vs mês anterior" }} />
      </div>

      <Tabs defaultValue="employees" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="employees"><Users className="h-4 w-4 mr-1.5" />Colaboradores</TabsTrigger>
          <TabsTrigger value="attendance"><ClipboardCheck className="h-4 w-4 mr-1.5" />Presença</TabsTrigger>
          <TabsTrigger value="vacations"><CalendarDays className="h-4 w-4 mr-1.5" />Férias</TabsTrigger>
          <TabsTrigger value="payroll"><FileText className="h-4 w-4 mr-1.5" />Folha Salarial</TabsTrigger>
        </TabsList>

        {/* ==================== EMPLOYEES TAB ==================== */}
        <TabsContent value="employees">
          <DataTable data={mockEmployees} columns={employeeColumns} searchKeys={["name", "role", "department", "email"]} />
        </TabsContent>

        {/* ==================== ATTENDANCE TAB ==================== */}
        <TabsContent value="attendance">
          <div className="space-y-4">
            {/* Date selector & summary */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
              <div>
                <Label className="text-xs">Data</Label>
                <Input type="date" value={attendanceDate} onChange={e => setAttendanceDate(e.target.value)} className="w-44" />
              </div>
              <div className="flex gap-3">
                <div className="bg-success/10 border border-success/20 rounded-lg px-3 py-2 text-center">
                  <p className="text-lg font-bold text-success">{presentToday}</p>
                  <p className="text-[10px] text-muted-foreground">Presentes</p>
                </div>
                <div className="bg-warning/10 border border-warning/20 rounded-lg px-3 py-2 text-center">
                  <p className="text-lg font-bold text-warning">{lateToday}</p>
                  <p className="text-[10px] text-muted-foreground">Atrasados</p>
                </div>
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 text-center">
                  <p className="text-lg font-bold text-destructive">{absentToday}</p>
                  <p className="text-[10px] text-muted-foreground">Ausentes</p>
                </div>
                <div className="bg-primary/10 border border-primary/20 rounded-lg px-3 py-2 text-center">
                  <p className="text-lg font-bold text-primary">{avgHours}h</p>
                  <p className="text-[10px] text-muted-foreground">Média Horas</p>
                </div>
              </div>
            </div>

            {/* Attendance table */}
            <div className="bg-card rounded-xl border">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Colaborador</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Cargo</th>
                      <th className="px-4 py-3 text-center font-medium text-muted-foreground">Entrada</th>
                      <th className="px-4 py-3 text-center font-medium text-muted-foreground">Saída</th>
                      <th className="px-4 py-3 text-center font-medium text-muted-foreground">Horas</th>
                      <th className="px-4 py-3 text-center font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {active.map(emp => {
                      const record = dayAttendance.find(a => a.employeeId === emp.id);
                      const status = record?.status || "ausente";
                      return (
                        <tr key={emp.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold" style={{ backgroundColor: emp.color + "22", color: emp.color }}>
                                {emp.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                              </div>
                              <span className="font-medium">{emp.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{emp.role}</td>
                          <td className="px-4 py-3 text-center">
                            {record?.checkIn ? (
                              <span className="inline-flex items-center gap-1 text-xs"><Clock className="h-3 w-3" />{record.checkIn}</span>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {record?.checkOut ? (
                              <span className="inline-flex items-center gap-1 text-xs"><Clock className="h-3 w-3" />{record.checkOut}</span>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </td>
                          <td className="px-4 py-3 text-center font-medium">
                            {record?.hoursWorked ? `${record.hoursWorked}h` : "—"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize ${attendanceStatusStyle[status] || attendanceStatusStyle.ausente}`}>
                              {status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ==================== VACATIONS CALENDAR TAB ==================== */}
        <TabsContent value="vacations">
          <div className="bg-card rounded-xl border p-5">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">{months[month]} {year} — Calendário de Férias</h3>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" onClick={() => setCalDate(new Date(year, month - 1))}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" onClick={() => setCalDate(new Date(year, month + 1))}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 mb-4">
              {mockVacations.filter(v => {
                const vStart = new Date(v.startDate);
                const vEnd = new Date(v.endDate);
                const mStart = new Date(year, month, 1);
                const mEnd = new Date(year, month + 1, 0);
                return vStart <= mEnd && vEnd >= mStart;
              }).map(v => (
                <div key={v.employeeId} className="flex items-center gap-1.5 text-xs">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: v.color }} />
                  <span>{v.employeeName}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
              {weekDays.map(d => (
                <div key={d} className="bg-muted/50 text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
              ))}
              {Array.from({ length: firstDay }, (_, i) => <div key={`e-${i}`} className="bg-card min-h-[72px]" />)}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const vacations = getVacationsForDay(day);
                const isToday = day === 10 && month === 2 && year === 2025;
                return (
                  <div key={day} className="bg-card min-h-[72px] p-1.5 relative">
                    <span className={`text-xs ${isToday ? "bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center font-bold" : "text-muted-foreground"}`}>
                      {day}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {vacations.map(v => (
                        <div
                          key={v.employeeId}
                          className="text-[9px] font-medium px-1 py-0.5 rounded truncate text-primary-foreground"
                          style={{ backgroundColor: v.color }}
                          title={`${v.employeeName} - Férias`}
                        >
                          {v.employeeName.split(" ")[0]}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* ==================== PAYROLL TAB ==================== */}
        <TabsContent value="payroll">
          <div className="bg-card rounded-xl border">
            <div className="p-4 border-b">
              <h3 className="font-semibold">Recibos de Vencimento — Março 2025</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Clique num colaborador para ver o recibo detalhado</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Colaborador</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Cargo</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Salário Base</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">INSS (3%)</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">IRPS (10%)</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Salário Líquido</th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">Acções</th>
                  </tr>
                </thead>
                <tbody>
                  {active.map(emp => {
                    const slip = generateSalarySlip(emp, "2025-03");
                    return (
                      <tr key={emp.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold" style={{ backgroundColor: emp.color + "22", color: emp.color }}>
                              {emp.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                            </div>
                            <span className="font-medium">{emp.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{emp.role}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(slip.baseSalary)}</td>
                        <td className="px-4 py-3 text-right text-destructive">-{formatCurrency(slip.inss)}</td>
                        <td className="px-4 py-3 text-right text-destructive">-{formatCurrency(slip.irps)}</td>
                        <td className="px-4 py-3 text-right font-bold">{formatCurrency(slip.netSalary)}</td>
                        <td className="px-4 py-3 text-center">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedSlip(slip)}>
                            <FileText className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/50 font-semibold">
                    <td className="px-4 py-3" colSpan={2}>Total</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(active.reduce((s, e) => s + generateSalarySlip(e, "2025-03").baseSalary, 0))}</td>
                    <td className="px-4 py-3 text-right text-destructive">-{formatCurrency(active.reduce((s, e) => s + generateSalarySlip(e, "2025-03").inss, 0))}</td>
                    <td className="px-4 py-3 text-right text-destructive">-{formatCurrency(active.reduce((s, e) => s + generateSalarySlip(e, "2025-03").irps, 0))}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(active.reduce((s, e) => s + generateSalarySlip(e, "2025-03").netSalary, 0))}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Salary Slip Detail Dialog */}
          <Dialog open={!!selectedSlip} onOpenChange={() => setSelectedSlip(null)}>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Recibo de Vencimento</DialogTitle></DialogHeader>
              {selectedSlip && (
                <div className="space-y-4">
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-lg">{selectedSlip.employeeName}</p>
                        <p className="text-sm text-muted-foreground">{selectedSlip.role}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">Março 2025</p>
                        <p className="text-xs text-muted-foreground">MicroCrédito S.A.</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm border-b pb-1">Rendimentos</h4>
                    <div className="flex justify-between text-sm"><span>Salário Base</span><span>{formatCurrency(selectedSlip.baseSalary)}</span></div>
                    <div className="flex justify-between text-sm"><span>Horas Extra</span><span>{formatCurrency(selectedSlip.overtime)}</span></div>
                    <div className="flex justify-between text-sm"><span>Bónus</span><span>{formatCurrency(selectedSlip.bonus)}</span></div>
                    <div className="flex justify-between text-sm font-semibold border-t pt-1"><span>Salário Bruto</span><span>{formatCurrency(selectedSlip.grossSalary)}</span></div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm border-b pb-1">Descontos</h4>
                    <div className="flex justify-between text-sm"><span>INSS (3%)</span><span className="text-destructive">-{formatCurrency(selectedSlip.inss)}</span></div>
                    <div className="flex justify-between text-sm"><span>IRPS (10%)</span><span className="text-destructive">-{formatCurrency(selectedSlip.irps)}</span></div>
                    <div className="flex justify-between text-sm"><span>Outros Descontos</span><span className="text-destructive">-{formatCurrency(selectedSlip.otherDeductions)}</span></div>
                    <div className="flex justify-between text-sm font-semibold border-t pt-1"><span>Total Descontos</span><span className="text-destructive">-{formatCurrency(selectedSlip.totalDeductions)}</span></div>
                  </div>

                  <div className="bg-success/5 border border-success/20 rounded-lg p-4 flex justify-between items-center">
                    <span className="font-bold text-lg">Salário Líquido</span>
                    <span className="font-bold text-xl text-success">{formatCurrency(selectedSlip.netSalary)}</span>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1"><Printer className="h-4 w-4 mr-1.5" />Imprimir</Button>
                    <Button className="flex-1"><FileText className="h-4 w-4 mr-1.5" />Exportar PDF</Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}
