import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { mockCalendarEvents, mockVacations, formatCurrency, CalendarEvent } from "@/data/mockData";
import { ChevronLeft, ChevronRight, CalendarDays, AlertTriangle, CreditCard, Users, Bell, Palmtree } from "lucide-react";
import { Button } from "@/components/ui/button";

const monthNames = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const weekDays = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDayOfMonth(y: number, m: number) { return new Date(y, m, 1).getDay(); }
function isInRange(dateStr: string, start: string, end: string) {
  const d = new Date(dateStr), s = new Date(start), e = new Date(end);
  return d >= s && d <= e;
}

const typeConfig: Record<string, { icon: any; bg: string; text: string; dot: string }> = {
  payment: { icon: CreditCard, bg: "bg-primary/10 text-primary border-primary/20", text: "text-primary", dot: "bg-primary" },
  overdue: { icon: AlertTriangle, bg: "bg-destructive/10 text-destructive border-destructive/20", text: "text-destructive", dot: "bg-destructive" },
  vacation: { icon: Palmtree, bg: "bg-accent/10 text-accent border-accent/20", text: "text-accent", dot: "bg-accent" },
  meeting: { icon: Users, bg: "bg-info/10 text-info border-info/20", text: "text-info", dot: "bg-info" },
  alert: { icon: Bell, bg: "bg-warning/10 text-warning border-warning/20", text: "text-warning", dot: "bg-warning" },
};

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date(2025, 2));
  const [selectedDay, setSelectedDay] = useState<number | null>(9);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const events = mockCalendarEvents.filter(e => e.date === dateStr);
    // Add vacation events
    const vacationEvents = mockVacations
      .filter(v => isInRange(dateStr, v.startDate, v.endDate))
      .map(v => ({ id: `vac-${v.employeeId}-${day}`, title: `Férias - ${v.employeeName}`, date: dateStr, type: "vacation" as const, employeeName: v.employeeName, color: v.color }));
    return [...events, ...vacationEvents];
  };

  const selectedEvents = selectedDay ? getEventsForDay(selectedDay) : [];

  return (
    <div>
      <PageHeader title="Calendário" description="Calendário unificado — cobranças, pagamentos e férias" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar grid */}
        <div className="lg:col-span-2 bg-card rounded-lg border p-5">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">{monthNames[month]} {year}</h3>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" onClick={() => setCurrentDate(new Date(year, month - 1))}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" onClick={() => setCurrentDate(new Date(year, month + 1))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mb-4 text-xs">
            {Object.entries(typeConfig).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                <span className="capitalize text-muted-foreground">{key === "payment" ? "Pagamento" : key === "overdue" ? "Atraso" : key === "vacation" ? "Férias" : key === "meeting" ? "Reunião" : "Alerta"}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {weekDays.map(d => (
              <div key={d} className="bg-muted/50 text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
            ))}
            {Array.from({ length: firstDay }, (_, i) => <div key={`e-${i}`} className="bg-card min-h-[70px]" />)}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const events = getEventsForDay(day);
              const isSelected = selectedDay === day;
              const isToday = day === 9 && month === 2 && year === 2025;
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`bg-card min-h-[70px] p-1.5 text-left transition-colors ${isSelected ? "ring-2 ring-primary ring-inset" : "hover:bg-muted/30"}`}
                >
                  <span className={`text-xs inline-flex items-center justify-center ${isToday ? "bg-primary text-primary-foreground w-5 h-5 rounded-full font-bold" : ""}`}>
                    {day}
                  </span>
                  <div className="flex flex-wrap gap-0.5 mt-1">
                    {events.slice(0, 3).map((e, idx) => {
                      const cfg = typeConfig[e.type] || typeConfig.payment;
                      return <div key={idx} className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />;
                    })}
                    {events.length > 3 && <span className="text-[8px] text-muted-foreground">+{events.length - 3}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Day detail */}
        <div className="bg-card rounded-lg border p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            {selectedDay ? `${selectedDay} de ${monthNames[month]}` : "Selecione um dia"}
          </h3>

          {selectedEvents.length === 0 ? (
            <div className="text-center py-8">
              <CalendarDays className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum evento neste dia</p>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedEvents.map(e => {
                const cfg = typeConfig[e.type] || typeConfig.payment;
                const Icon = cfg.icon;
                return (
                  <div key={e.id} className={`rounded-lg border p-3 ${cfg.bg}`}>
                    <div className="flex items-start gap-2.5">
                      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{e.title}</p>
                        {e.clientName && <p className="text-xs mt-0.5 opacity-80">{e.clientName}</p>}
                        {e.employeeName && <p className="text-xs mt-0.5 opacity-80">{e.employeeName}</p>}
                        {e.amount && <p className="text-xs font-semibold mt-1">{formatCurrency(e.amount)}</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
