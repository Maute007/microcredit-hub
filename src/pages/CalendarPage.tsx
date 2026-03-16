import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { QueryErrorAlert } from "@/components/QueryErrorAlert";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  AlertTriangle,
  CreditCard,
  Users,
  Bell,
  Palmtree,
  Plus,
  Loader2,
  Sparkles,
  Flag,
  PartyPopper,
  Medal,
  Heart,
  Briefcase,
  Trophy,
  Shield,
  Bird,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { calendarApi, type ApiCalendarEvent } from "@/lib/api";
import { isNationalHoliday, isWeekend, getHolidaysInMonth, WEEKDAY_CELL_STYLES } from "@/lib/holidays";
import { formatCurrency, formatDate } from "@/data/mockData";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const weekDaysShort = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const holidayIconMap: Record<string, typeof Flag> = {
  PartyPopper,
  Medal,
  Heart,
  Briefcase,
  Flag,
  Trophy,
  Shield,
  Bird,
  Users,
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

function getDaysInMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate();
}
function getFirstDayOfMonth(y: number, m: number) {
  return new Date(y, m, 1).getDay();
}

const typeConfig: Record<
  string,
  { icon: typeof CreditCard; bg: string; dot: string; label: string }
> = {
  payment: {
    icon: CreditCard,
    bg: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    dot: "bg-emerald-500",
    label: "Pagamento",
  },
  overdue: {
    icon: AlertTriangle,
    bg: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800",
    dot: "bg-rose-500",
    label: "Atraso",
  },
  vacation: {
    icon: Palmtree,
    bg: "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800",
    dot: "bg-violet-500",
    label: "Férias",
  },
  meeting: {
    icon: Users,
    bg: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800",
    dot: "bg-sky-500",
    label: "Reunião",
  },
  alert: {
    icon: Bell,
    bg: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    dot: "bg-amber-500",
    label: "Alerta",
  },
  other: {
    icon: Sparkles,
    bg: "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-800",
    dot: "bg-slate-500",
    label: "Outro",
  },
  reminder: {
    icon: Bell,
    bg: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    dot: "bg-amber-500",
    label: "Lembrete",
  },
};

const PRESET_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

function getEventStyle(e: ApiCalendarEvent): { bg: string; dot: string } {
  const hex = e.color?.trim();
  if (hex && /^#[0-9A-Fa-f]{6}$/.test(hex)) {
    return {
      bg: "",
      dot: "",
    };
  }
  const cfg = typeConfig[e.type] || typeConfig.other;
  return { bg: cfg.bg, dot: cfg.dot };
}

function getEventLabel(e: ApiCalendarEvent): string {
  if (e.type === "payment" || e.type === "overdue") {
    const name = e.client_name?.split(" ")[0] || "Cliente";
    return e.type === "overdue" ? `Atraso ${name}` : `Pag. ${name}`;
  }
  if (e.type === "vacation") {
    return e.employee_name?.split(" ")[0] || "Férias";
  }
  if (e.type === "other" && e.type_label) return e.type_label;
  const title = (e.title ?? "").trim() || "Evento";
  return title.slice(0, 12) + (title.length > 12 ? "…" : "");
}

export default function CalendarPage() {
  const now = new Date();
  const [currentDate, setCurrentDate] = useState(new Date(now.getFullYear(), now.getMonth()));
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [newEventDate, setNewEventDate] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["calendar-events", year, month],
    queryFn: () => calendarApi.events({ year, month: month + 1 }),
    placeholderData: (prev) => prev,
  });

  const events: ApiCalendarEvent[] = data?.events ?? [];

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return events.filter((e) => e.date === dateStr);
  };

  const selectedEvents = selectedDay ? getEventsForDay(selectedDay) : [];
  const today = new Date();
  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  return (
    <div className="space-y-6">
      {isError && (
        <QueryErrorAlert onRetry={() => refetch()} />
      )}
      <PageHeader
        title="Calendário"
        description="Vencimentos, férias, eventos e feriados — visão completa do mês com destaque para dias especiais"
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
        {/* Calendário principal */}
        <div className="rounded-2xl border border-border/80 bg-card shadow-xl overflow-hidden backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 border-b bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5">
            <div>
              <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
                {monthNames[month]} {year}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">Calendário · Moçambique</p>
            </div>
            <div className="flex items-center gap-2">
              <Dialog open={showNewEvent} onOpenChange={(o) => { setShowNewEvent(o); if (!o) setNewEventDate(null); }}>
                <DialogTrigger asChild>
                  <Button className="shadow-md">
                    <Plus className="h-4 w-4 mr-2" />
                    Novo evento
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Novo evento</DialogTitle>
                  </DialogHeader>
                  <NewEventForm
                    year={year}
                    month={month}
                    initialDate={newEventDate ?? undefined}
                    onSuccess={() => {
                      setShowNewEvent(false);
                      setNewEventDate(null);
                      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
                    }}
                  />
                </DialogContent>
              </Dialog>
              <div className="flex rounded-lg border bg-background p-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentDate(new Date(year, month - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-w-[100px] font-medium"
                  onClick={() => setCurrentDate(new Date())}
                >
                  Hoje
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentDate(new Date(year, month + 1))}
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
                  Feriados em {monthNames[month]}
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

          {/* Legenda */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 px-6 py-3 border-b bg-muted/20 text-xs">
            {Object.entries(typeConfig).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-2">
                <div className={cn("w-2 h-2 rounded-full", cfg.dot)} />
                <span className="text-muted-foreground">{cfg.label}</span>
              </div>
            ))}
          </div>

          {/* Grid do mês */}
          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="p-4">
              <div className="grid grid-cols-7 text-center text-xs font-medium mb-2 gap-1">
                {weekDaysShort.map((d, idx) => (
                  <div
                    key={d}
                    className={cn(
                      "py-2.5 rounded-lg",
                      weekdayHeaderStyles[idx] ?? "text-muted-foreground"
                    )}
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: firstDay }, (_, i) => (
                  <div key={`empty-${i}`} className="min-h-[110px] rounded-xl bg-muted/20 border border-transparent" />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1;
                  const dayEvents = getEventsForDay(day);
                  const isSelected = selectedDay === day;
                  const { isHoliday, name: holidayName, info: holidayInfo } = isNationalHoliday(year, month, day);
                  const dateObj = new Date(year, month, day);
                  const weekday = dateObj.getDay();
                  const weekdayStyle = WEEKDAY_CELL_STYLES[weekday] ?? "";
                  const HolidayIcon = holidayInfo ? (holidayIconMap[holidayInfo.icon ?? "Flag"] ?? Flag) : Flag;
                  const cfg = typeConfig;
                  return (
                    <HoverCard key={day} openDelay={200} closeDelay={100}>
                      <HoverCardTrigger asChild>
                        <button
                          onClick={() => setSelectedDay(day)}
                          onDoubleClick={() => {
                            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                            setNewEventDate(dateStr);
                            setShowNewEvent(true);
                          }}
                          className={cn(
                            "min-h-[110px] rounded-xl p-2 text-left transition-all duration-200 flex flex-col border",
                            "hover:shadow-lg hover:scale-[1.02] hover:z-10",
                            isSelected && "ring-2 ring-primary shadow-lg bg-primary/5 border-primary/30",
                            isToday(day) && !isSelected && "ring-2 ring-primary/50 shadow-md",
                            !isToday(day) && !isSelected && isHoliday && "bg-gradient-to-br from-red-100 to-rose-100 dark:from-red-900/50 dark:to-rose-900/50 border-red-200/60 dark:border-red-700/50 shadow-sm",
                            !isToday(day) && !isSelected && !isHoliday && weekdayStyle
                          )}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={cn(
                                "inline-flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold shrink-0",
                                isToday(day)
                                  ? "bg-primary text-primary-foreground shadow-md"
                                  : isHoliday
                                    ? "bg-gradient-to-br from-red-500/90 to-rose-600/90 text-white shadow"
                                    : "text-foreground bg-background/60"
                              )}
                            >
                              {day}
                            </span>
                            {isHoliday && <HolidayIcon className="h-4 w-4 text-rose-500 dark:text-rose-400 shrink-0" />}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-0.5">
                            {dayEvents.slice(0, 4).map((e) => {
                              const style = getEventStyle(e);
                              const useCustom = e.color && /^#[0-9A-Fa-f]{6}$/.test(e.color);
                              return (
                                <div
                                  key={e.id}
                                  className={cn("w-2 h-2 rounded-full shrink-0", !useCustom && style.dot)}
                                  style={useCustom ? { backgroundColor: e.color } : undefined}
                                  title={e.title}
                                />
                              );
                            })}
                            {dayEvents.length > 4 && (
                              <span className="text-[9px] text-muted-foreground ml-0.5">+{dayEvents.length - 4}</span>
                            )}
                          </div>
                          <div className="mt-auto pt-1 text-[10px] text-muted-foreground">
                            {dayEvents.length > 0 ? `${dayEvents.length} evento${dayEvents.length > 1 ? "s" : ""}` : isHoliday ? "Feriado" : "—"}
                          </div>
                        </button>
                      </HoverCardTrigger>
                      <HoverCardContent side="top" className="w-80 p-0 overflow-hidden rounded-xl border-2 shadow-xl" align="center">
                        <div className="bg-gradient-to-br from-muted/50 to-background">
                          <div className="p-4 border-b">
                            <div className="flex items-center gap-3">
                              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-lg">
                                {day}
                              </span>
                              <div>
                                <p className="font-semibold">{day} de {monthNames[month]}</p>
                                <p className="text-xs text-muted-foreground">
                                  {weekDaysShort[weekday]} · {dayEvents.length > 0 ? `${dayEvents.length} evento${dayEvents.length > 1 ? "s" : ""}` : "Sem eventos"}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
                            {isHoliday && holidayName && (
                              <div className={cn("rounded-xl p-3 text-white shadow-md", holidayInfo?.gradient ? `bg-gradient-to-r ${holidayInfo.gradient}` : "bg-gradient-to-r from-red-500 to-rose-600")}>
                                <div className="flex items-center gap-2">
                                  <HolidayIcon className="h-5 w-5" />
                                  <span className="font-semibold">{holidayName}</span>
                                </div>
                                <p className="text-xs opacity-90 mt-1">Feriado nacional de Moçambique</p>
                              </div>
                            )}
                            {dayEvents.length === 0 && !isHoliday && (
                              <p className="text-sm text-muted-foreground text-center py-4">Nenhum evento neste dia</p>
                            )}
                            {dayEvents.map((e) => {
                              const style = getEventStyle(e);
                              const CfgIcon = (cfg[e.type] || cfg.other).icon;
                              const useCustom = e.color && /^#[0-9A-Fa-f]{6}$/.test(e.color);
                              return (
                                <div key={e.id} className={cn("rounded-lg border p-3", !useCustom && style.bg)} style={useCustom ? { backgroundColor: `${e.color}15`, borderColor: `${e.color}40` } : undefined}>
                                  <div className="flex gap-2">
                                    <div className={cn("rounded-lg p-1.5 shrink-0", !useCustom && style.dot)} style={useCustom ? { backgroundColor: e.color } : undefined}>
                                      <CfgIcon className="h-3.5 w-3.5 text-white" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium text-sm truncate">{e.title}</p>
                                      {(e.client_name || e.employee_name) && (
                                        <p className="text-xs text-muted-foreground">{e.client_name || e.employee_name}</p>
                                      )}
                                      {e.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{e.description}</p>}
                                      {e.amount != null && <p className="text-xs font-semibold mt-0.5">{formatCurrency(e.amount)}</p>}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Painel do dia seleccionado */}
        <div className="rounded-2xl border border-border/80 bg-card shadow-xl overflow-hidden flex flex-col">
          <div className="p-6 border-b bg-gradient-to-br from-primary/10 via-primary/5 to-primary/10">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  {selectedDay
                    ? `${selectedDay} de ${monthNames[month]}`
                    : "Selecione um dia"}
                </h3>
              {selectedDay && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`;
                    setNewEventDate(dateStr);
                    setShowNewEvent(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Novo evento
                </Button>
              )}
              {selectedDay && (() => {
                const { isHoliday, name: hName, info: hInfo } = isNationalHoliday(year, month, selectedDay);
                if (!isHoliday) return null;
                const HIcon = hInfo ? (holidayIconMap[hInfo.icon ?? "Flag"] ?? Flag) : Flag;
                return (
                  <div
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-white shadow-md",
                      hInfo?.gradient ? `bg-gradient-to-r ${hInfo.gradient}` : "bg-gradient-to-r from-red-500 to-rose-600"
                    )}
                  >
                    <HIcon className="h-4 w-4" />
                    <span>{hName}</span>
                  </div>
                );
              })()}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {!selectedDay ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 p-6 mb-4 border border-primary/20">
                  <CalendarDays className="h-12 w-12 text-primary" />
                </div>
                <p className="font-medium text-foreground">Selecione um dia</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Clique num dia ou aproxime o cursor para ver a agenda
                </p>
              </div>
            ) : selectedEvents.length === 0 && !(selectedDay && isNationalHoliday(year, month, selectedDay).isHoliday) ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-2xl bg-muted/50 p-6 mb-4">
                  <Sparkles className="h-10 w-10 text-muted-foreground" />
                </div>
                <p className="font-medium text-muted-foreground">Nenhum evento neste dia</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Use o botão acima para criar um evento
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {selectedDay && (() => {
                  const { isHoliday, name: hName, info: hInfo } = isNationalHoliday(year, month, selectedDay);
                  if (!isHoliday) return null;
                  const HIcon = hInfo ? (holidayIconMap[hInfo.icon ?? "Flag"] ?? Flag) : Flag;
                  return (
                    <div className={cn("rounded-xl p-4 text-white shadow-lg", hInfo?.gradient ? `bg-gradient-to-r ${hInfo.gradient}` : "bg-gradient-to-r from-red-500 to-rose-600")}>
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-white/20 p-2">
                          <HIcon className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="font-bold">{hName}</p>
                          <p className="text-xs opacity-90">Feriado nacional de Moçambique</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                {selectedEvents.map((e) => {
                  const style = getEventStyle(e);
                  const cfg = typeConfig[e.type] || typeConfig.other;
                  const Icon = cfg.icon;
                  const useCustom = e.color && /^#[0-9A-Fa-f]{6}$/.test(e.color);
                  return (
                    <div
                      key={e.id}
                      className={cn(
                        "rounded-xl border-2 p-4 transition-all hover:shadow-lg hover:scale-[1.01]",
                        !useCustom && style.bg
                      )}
                      style={useCustom ? { backgroundColor: `${e.color}12`, borderColor: `${e.color}40` } : undefined}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn("rounded-xl p-2.5 shrink-0 shadow-sm", !useCustom && style.dot)}
                          style={useCustom ? { backgroundColor: e.color } : undefined}
                        >
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold truncate">{e.title}</p>
                          {(e.client_name || e.employee_name) && (
                            <p className="text-xs mt-0.5 text-muted-foreground flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {e.client_name || e.employee_name}
                            </p>
                          )}
                          {e.description ? (
                            <p className="text-sm mt-2 text-muted-foreground leading-relaxed">
                              {e.description}
                            </p>
                          ) : null}
                          {e.amount != null && (
                            <p className="text-base font-bold mt-2 text-foreground">
                              {formatCurrency(e.amount)}
                            </p>
                          )}
                          {e.type === "other" && e.type_label && (
                            <span className="inline-flex items-center gap-1 mt-2 text-xs px-2 py-1 rounded-lg bg-background/60">
                              <Sparkles className="h-3 w-3" />
                              {e.type_label}
                            </span>
                          )}
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
      </div>
    </div>
  );
}

function NewEventForm({
  year,
  month,
  initialDate,
  onSuccess,
}: {
  year: number;
  month: number;
  initialDate?: string;
  onSuccess: () => void;
}) {
  const defaultDate = initialDate ?? `${year}-${String(month + 1).padStart(2, "0")}-15`;
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState<string>("meeting");
  const [eventTypeOther, setEventTypeOther] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [dateVal, setDateVal] = useState(defaultDate);
  useEffect(() => {
    if (initialDate) setDateVal(initialDate);
  }, [initialDate]);
  const [description, setDescription] = useState("");
  const { toast } = useToast();

  const createEvent = useMutation({
    mutationFn: calendarApi.custom.create,
    onSuccess: () => {
      toast({ title: "Evento criado", description: "O evento foi adicionado ao calendário." });
      onSuccess();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Não foi possível criar o evento.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    },
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        createEvent.mutate({
          title,
          event_type: eventType as any,
          event_type_other: eventType === "other" ? eventTypeOther.trim() : undefined,
          color: color || undefined,
          date: dateVal,
          description: description || undefined,
        });
      }}
    >
      <div>
        <Label>Título</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex: Reunião mensal, Auditoria..."
          required
        />
      </div>
      <div>
        <Label>Tipo de evento</Label>
        <Select value={eventType} onValueChange={(v) => { setEventType(v); if (v !== "other") setEventTypeOther(""); }}>
          <SelectTrigger>
            <SelectValue placeholder="Selecionar tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="meeting">Reunião</SelectItem>
            <SelectItem value="alert">Alerta</SelectItem>
            <SelectItem value="reminder">Lembrete</SelectItem>
            <SelectItem value="other">Outro</SelectItem>
          </SelectContent>
        </Select>
        {eventType === "other" && (
          <Input
            className="mt-2"
            placeholder="Especifique o tipo (ex: Auditoria, Visita, Formação...)"
            value={eventTypeOther}
            onChange={(e) => setEventTypeOther(e.target.value)}
          />
        )}
      </div>
      <div>
        <Label>Cor do evento</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={cn(
                "w-8 h-8 rounded-full border-2 transition-transform hover:scale-110",
                color === c ? "border-foreground ring-2 ring-offset-2" : "border-transparent"
              )}
              style={{ backgroundColor: c }}
            />
          ))}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-8 h-8 rounded-full border-0 cursor-pointer bg-transparent"
            />
            <span className="text-xs text-muted-foreground">Personalizar</span>
          </label>
        </div>
      </div>
      <div>
        <Label>Data</Label>
        <Input
          type="date"
          value={dateVal}
          onChange={(e) => setDateVal(e.target.value)}
          required
        />
      </div>
      <div>
        <Label>Descrição (opcional)</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Detalhes do evento..."
          rows={2}
        />
      </div>
      <Button type="submit" className="w-full" disabled={createEvent.isLoading || !title.trim()}>
        {createEvent.isLoading ? "A guardar..." : "Criar evento"}
      </Button>
    </form>
  );
}
