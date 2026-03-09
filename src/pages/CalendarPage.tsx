import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { mockCalendarEvents, formatCurrency, CalendarEvent } from "@/data/mockData";
import { ChevronLeft, ChevronRight, CalendarDays, AlertTriangle, CreditCard, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

const months = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const weekDays = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

const eventColors: Record<string, string> = {
  payment: "bg-primary/10 text-primary border-primary/20",
  overdue: "bg-destructive/10 text-destructive border-destructive/20",
  meeting: "bg-accent/10 text-accent border-accent/20",
};

const eventIcons: Record<string, any> = {
  payment: CreditCard,
  overdue: AlertTriangle,
  meeting: Users,
};

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date(2025, 2)); // March 2025
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const [selectedDay, setSelectedDay] = useState<number | null>(9);

  const navigate = (dir: number) => setCurrentDate(new Date(year, month + dir));

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return mockCalendarEvents.filter(e => e.date === dateStr);
  };

  const selectedEvents = selectedDay ? getEventsForDay(selectedDay) : [];

  return (
    <div>
      <PageHeader title="Calendário" description="Calendário de cobranças e pagamentos" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card rounded-lg border p-5">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">{months[month]} {year}</h3>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" onClick={() => navigate(1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-px">
            {weekDays.map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
            ))}
            {Array.from({ length: firstDay }, (_, i) => <div key={`empty-${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const events = getEventsForDay(day);
              const isSelected = selectedDay === day;
              const isToday = day === 9 && month === 2 && year === 2025;
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`relative p-2 min-h-[60px] text-left rounded-lg transition-colors ${
                    isSelected ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-muted/50"
                  } ${isToday ? "font-bold" : ""}`}
                >
                  <span className={`text-sm ${isToday ? "bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center" : ""}`}>
                    {day}
                  </span>
                  {events.length > 0 && (
                    <div className="flex gap-0.5 mt-1">
                      {events.map((e, idx) => (
                        <div key={idx} className={`w-1.5 h-1.5 rounded-full ${e.type === "overdue" ? "bg-destructive" : e.type === "payment" ? "bg-primary" : "bg-accent"}`} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-card rounded-lg border p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            {selectedDay ? `${selectedDay} ${months[month]}` : "Selecione um dia"}
          </h3>
          {selectedEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum evento neste dia</p>
          ) : (
            <div className="space-y-3">
              {selectedEvents.map(e => {
                const Icon = eventIcons[e.type];
                return (
                  <div key={e.id} className={`rounded-lg border p-3 ${eventColors[e.type]}`}>
                    <div className="flex items-start gap-2">
                      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{e.title}</p>
                        {e.clientName && <p className="text-xs mt-0.5 opacity-80">{e.clientName}</p>}
                        {e.amount && <p className="text-xs font-medium mt-1">{formatCurrency(e.amount)}</p>}
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
