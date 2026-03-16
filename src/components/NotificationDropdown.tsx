import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  AlertTriangle,
  Clock,
  CreditCard,
  Palmtree,
  Users,
  Sparkles,
  AlertCircle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { calendarApi, type ApiNotification } from "@/lib/api";
import { formatCurrency, formatDate } from "@/data/mockData";

function getNotificationRoute(n: ApiNotification): { path: string; state?: object } {
  if (n.loan_id != null) {
    const status = n.type === "overdue" || n.type === "collateral_risk" ? "atrasado" : undefined;
    return { path: "/pagamentos", state: { loanId: n.loan_id, status } };
  }
  if (n.type === "vacation") return { path: "/rh" };
  if (String(n.id).startsWith("evt-")) return { path: "/calendario" };
  return { path: "/calendario" };
}

const isImportant = (n: ApiNotification) => n.type === "overdue" || n.type === "collateral_risk";

export function NotificationDropdown({
  variant = "topbar",
  collapsed,
}: {
  variant?: "topbar" | "sidebar";
  collapsed?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => calendarApi.notifications(),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  const notifications = data?.notifications ?? [];

  const visibleNotifications = useMemo(
    () => notifications.filter((n) => !hiddenIds.includes(n.id)),
    [notifications, hiddenIds]
  );

  const important = visibleNotifications.filter(isImportant);
  const others = visibleNotifications.filter((n) => !isImportant(n));
  const unreadCount = visibleNotifications.length;

  const handleNotificationClick = (n: ApiNotification) => {
    // ao abrir, consideramos "lida" e removemos da lista visual
    setHiddenIds((prev) => (prev.includes(n.id) ? prev : [...prev, n.id]));
    setOpen(false);
    const { path, state } = getNotificationRoute(n);
    navigate(path, { state });
  };

  const handleClearOne = (id: string) => {
    setHiddenIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const handleClearAll = () => {
    if (visibleNotifications.length === 0) return;
    setHiddenIds((prev) => {
      const extra = visibleNotifications
        .map((n) => n.id)
        .filter((id) => !prev.includes(id));
      return [...prev, ...extra];
    });
  };

  const bellTrigger = (
    <span className="relative inline-flex shrink-0 items-center justify-center rounded-full bg-muted/60 hover:bg-muted px-2 py-2 transition-colors">
      <Bell className="h-4 w-4 text-foreground" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground animate-bounce ring-2 ring-background shadow-lg">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </span>
  );

  if (variant === "sidebar") {
    return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm w-full transition-all text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${collapsed ? "justify-center" : ""}`}
            title="Notificações"
          >
            {bellTrigger}
            {!collapsed && <span>Notificações</span>}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right" className="w-80">
          <NotificationList
            notifications={visibleNotifications}
            isLoading={isLoading}
            onNotificationClick={handleNotificationClick}
            onClearOne={handleClearOne}
            onClearAll={handleClearAll}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setOpen(true)}
      >
        {bellTrigger}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b bg-muted/30">
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Notificações
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Pagamentos, calendário e férias
            </p>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                A carregar...
              </div>
            ) : visibleNotifications.length === 0 ? (
              <div className="py-12 text-center">
                <Bell className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
              </div>
            ) : (
              <div className="p-4 space-y-6">
                {important.length > 0 && (
                  <div>
                    <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-destructive mb-3">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Importantes ({important.length})
                    </h4>
                    <div className="space-y-1 rounded-2xl border border-destructive/40 bg-destructive/5 overflow-hidden shadow-sm">
                      {important.map((n) => (
                        <NotificationItem
                          key={n.id}
                          notification={n}
                          onClick={() => handleNotificationClick(n)}
                          onClear={() => handleClearOne(n.id)}
                          highlight
                        />
                      ))}
                    </div>
                  </div>
                )}
                {others.length > 0 && (
                  <div>
                    <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                      Outras ({others.length})
                    </h4>
                    <div className="space-y-1 rounded-2xl border bg-background/40 overflow-hidden shadow-sm">
                      {others.map((n) => (
                        <NotificationItem
                          key={n.id}
                          notification={n}
                          onClick={() => handleNotificationClick(n)}
                          onClear={() => handleClearOne(n.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          {visibleNotifications.length > 0 && (
            <div className="border-t p-4 bg-muted/20 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-foreground justify-start px-0"
                onClick={handleClearAll}
              >
                Limpar todas
              </Button>
              <Link to="/calendario" onClick={() => setOpen(false)}>
                <Button variant="outline" className="w-full sm:w-auto">
                  Ver calendário
                </Button>
              </Link>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function NotificationList({
  notifications,
  isLoading,
  onNotificationClick,
  onClearOne,
  onClearAll,
}: {
  notifications: ApiNotification[];
  isLoading: boolean;
  onNotificationClick: (n: ApiNotification) => void;
  onClearOne: (id: string) => void;
  onClearAll: () => void;
}) {
  if (isLoading)
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        A carregar...
      </div>
    );
  if (notifications.length === 0)
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Nenhuma notificação
      </div>
    );
  return (
    <>
      <div className="border-b px-3 py-2">
        <p className="font-semibold text-sm">Notificações</p>
        <p className="text-xs text-muted-foreground">Calendário, férias e pagamentos</p>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {notifications.slice(0, 10).map((n) => (
          <NotificationItem
            key={n.id}
            notification={n}
            onClick={() => onNotificationClick(n)}
            onClear={() => onClearOne(n.id)}
            highlight={isImportant(n)}
          />
        ))}
      </div>
      {notifications.length > 0 && (
        <div className="border-t px-2 py-2 flex items-center justify-between gap-2">
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={onClearAll}
          >
            Limpar todas
          </button>
          <Link
            to="/calendario"
            className="block rounded-md px-2 py-1.5 text-center text-xs font-medium text-primary hover:bg-muted"
          >
            Ver todas no calendário
          </Link>
        </div>
      )}
    </>
  );
}

function NotificationItem({
  notification,
  onClick,
  onClear,
  highlight,
}: {
  notification: ApiNotification;
  onClick: () => void;
  onClear?: () => void;
  highlight?: boolean;
}) {
  const Icon =
    notification.type === "overdue" || notification.type === "collateral_risk"
      ? AlertTriangle
      : notification.type === "upcoming"
        ? Clock
        : notification.type === "vacation"
          ? Palmtree
          : notification.type === "meeting"
            ? Users
            : notification.type === "new_loan"
              ? Sparkles
              : notification.type === "other"
                ? Sparkles
                : CreditCard;

  const typeLabel =
    notification.type === "overdue"
      ? "Atraso"
      : notification.type === "collateral_risk"
        ? "Risco de garantia"
        : notification.type === "upcoming"
          ? "Próximo vencimento"
          : notification.type === "vacation"
            ? "Férias"
            : notification.type === "meeting"
              ? "Reunião"
              : notification.type === "new_loan"
                ? "Novo empréstimo"
                : notification.type === "reminder"
                  ? "Lembrete"
                  : notification.type === "other"
                    ? "Evento"
                    : "Alerta";

  return (
    <div
      className={`flex gap-3 w-full text-sm transition-colors ${
        highlight
          ? "px-4 py-3 hover:bg-destructive/10 border-l-4 border-l-destructive rounded-xl bg-destructive/5"
          : "px-3 py-2.5 border-b last:border-0 hover:bg-muted/40"
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex flex-1 min-w-0 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-sm gap-3"
      >
        <div
          className={`shrink-0 rounded-full p-1.5 ${
            notification.type === "overdue" || notification.type === "collateral_risk"
              ? "bg-destructive/15 text-destructive"
              : notification.type === "upcoming"
                ? "bg-amber-500/15 text-amber-600"
                : notification.type === "vacation"
                  ? "bg-violet-500/15 text-violet-600"
                  : notification.type === "meeting"
                    ? "bg-sky-500/15 text-sky-600"
                    : notification.type === "other"
                      ? "bg-slate-500/15 text-slate-600"
                      : "bg-primary/15 text-primary"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`font-medium truncate ${highlight ? "text-destructive" : "text-sm"}`}>
            {notification.title}
          </p>
          <p className="text-xs text-muted-foreground">
            {typeLabel} • {formatDate(notification.date)}
            {notification.amount != null && ` • ${formatCurrency(notification.amount)}`}
          </p>
          {notification.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {notification.description}
            </p>
          )}
        </div>
      </button>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className="mt-1 ml-1 text-muted-foreground/60 hover:text-muted-foreground"
          title="Remover esta notificação"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
