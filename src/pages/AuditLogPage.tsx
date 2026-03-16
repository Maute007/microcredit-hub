import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { QueryErrorAlert } from "@/components/QueryErrorAlert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  authApi,
  usersApi,
  type ApiAuditEntry,
  type ApiUser,
} from "@/lib/api";
import { formatDateTime } from "@/data/mockData";
import {
  Loader2,
  Download,
  History,
  Filter,
  User,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Shield,
  Users,
  UserCheck,
  CreditCard,
  Banknote,
  FileText,
  CalendarCheck,
  Receipt,
  FolderOpen,
  ShieldCheck,
  ArrowLeftRight,
  Percent,
  UserCircle,
  Plane,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Sparkles,
  MessageSquare,
  Search,
  Activity,
  TrendingUp,
  BarChart3,
  Clock,
  Zap,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ACTION_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "+", label: "Criado" },
  { value: "~", label: "Alterado" },
  { value: "-", label: "Eliminado" },
];

const ENTITY_ICONS: Record<string, typeof User> = {
  Utilizador: User,
  Perfil: UserCircle,
  Papel: Shield,
  Cliente: Users,
  Colaborador: UserCheck,
  Férias: Plane,
  Presença: CalendarCheck,
  Recibo: FileText,
  "Lançamento folha": Receipt,
  Empréstimo: CreditCard,
  Pagamento: Banknote,
  "Categoria empréstimo": FolderOpen,
  Garantia: ShieldCheck,
  Transação: ArrowLeftRight,
  Imposto: Percent,
};

const DATE_PRESETS = [
  {
    id: "today",
    label: "Hoje",
    getValue: () => {
      const d = new Date().toISOString().slice(0, 10);
      return { from: d, to: d };
    },
  },
  {
    id: "week",
    label: "7 dias",
    getValue: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 6);
      return {
        from: start.toISOString().slice(0, 10),
        to: end.toISOString().slice(0, 10),
      };
    },
  },
  {
    id: "month",
    label: "Mês",
    getValue: () => {
      const d = new Date();
      const from = new Date(
        d.getFullYear(),
        d.getMonth(),
        1
      ).toISOString().slice(0, 10);
      const to = d.toISOString().slice(0, 10);
      return { from, to };
    },
  },
  {
    id: "clear",
    label: "Limpar",
    getValue: () => ({ from: "", to: "" }),
  },
];

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "agora";
  if (diffMins < 60) return `há ${diffMins} min`;
  if (diffHours < 24) return `há ${diffHours}h`;
  if (diffDays < 7) return `há ${diffDays} dias`;
  return formatDateTime(dateStr);
}

export default function AuditLogPage() {
  const [userFilter, setUserFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [actionType, setActionType] = useState("all");
  const [offset, setOffset] = useState(0);
  const [viewMode, setViewMode] = useState<"table" | "timeline">("timeline");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [detailEntry, setDetailEntry] = useState<ApiAuditEntry | null>(null);
  const limit = 25;

  const { data: users = [] } = useQuery<ApiUser[]>({
    queryKey: ["users"],
    queryFn: usersApi.list,
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["audit", userFilter, dateFrom, dateTo, actionType, offset],
    queryFn: () =>
      authApi.audit({
        user:
          userFilter && userFilter !== "all"
            ? parseInt(userFilter, 10)
            : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        action_type:
          actionType && actionType !== "all" ? actionType : undefined,
        limit,
        offset,
      }),
  });

  const rawResults: ApiAuditEntry[] = data?.results ?? [];
  const results = useMemo(() => {
    if (!searchQuery.trim()) return rawResults;
    const q = searchQuery.toLowerCase().trim();
    return rawResults.filter(
      (r) =>
        r.user_name?.toLowerCase().includes(q) ||
        r.user_username?.toLowerCase().includes(q) ||
        r.entity?.toLowerCase().includes(q) ||
        r.change_reason?.toLowerCase().includes(q) ||
        (r.object_id != null && String(r.object_id).includes(q))
    );
  }, [rawResults, searchQuery]);

  const total = data?.count ?? 0;
  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;
  const hasFilters =
    userFilter !== "all" || dateFrom || dateTo || actionType !== "all";

  const createdCount = results.filter((r) => r.action === "+").length;
  const updatedCount = results.filter((r) => r.action === "~").length;
  const deletedCount = results.filter((r) => r.action === "-").length;

  const entityCounts = useMemo(() => {
    const map: Record<string, number> = {};
    results.forEach((r) => {
      const e = r.entity || "Outro";
      map[e] = (map[e] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [results]);

  const exportUrl = authApi.auditExportUrl({
    user:
      userFilter && userFilter !== "all"
        ? parseInt(userFilter, 10)
        : undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    action_type: actionType && actionType !== "all" ? actionType : undefined,
  });

  const applyPreset = (preset: (typeof DATE_PRESETS)[number]) => {
    const { from, to } = preset.getValue();
    setDateFrom(from);
    setDateTo(to);
    setOffset(0);
  };

  const clearAllFilters = () => {
    setUserFilter("all");
    setDateFrom("");
    setDateTo("");
    setActionType("all");
    setSearchQuery("");
    setOffset(0);
  };

  return (
    <div className="space-y-6 min-h-screen">
      {isError && <QueryErrorAlert onRetry={() => refetch()} />}

      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-slate-50 via-white to-primary/5 dark:from-slate-950 dark:via-slate-900 dark:to-primary/10 p-8 sm:p-10 shadow-lg">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="relative">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                <ShieldCheck className="h-4 w-4" />
                Auditoria e conformidade
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Histórico de acções
              </h1>
              <p className="text-muted-foreground max-w-2xl text-base leading-relaxed">
                Rastreie todas as alterações no sistema em tempo real. Veja quem fez o quê,
                quando e porquê. Exporte relatórios para auditoria e conformidade.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <a
                  href={exportUrl}
                  download="auditoria.csv"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    size="lg"
                    className="gap-2 shadow-md hover:shadow-lg transition-shadow"
                  >
                    <Download className="h-4 w-4" />
                    Exportar CSV
                  </Button>
                </a>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setShowFilters((s) => !s)}
                  className="gap-2"
                >
                  <Filter className="h-4 w-4" />
                  {showFilters ? "Ocultar" : "Mostrar"} filtros
                </Button>
              </div>
            </div>
            <div className="flex gap-3 lg:flex-col">
              <StatPill
                icon={Activity}
                label="Registos"
                value={total.toLocaleString("pt-MZ")}
                sub={hasFilters ? "com filtros" : undefined}
              />
              <StatPill
                icon={Users}
                label="Utilizadores"
                value={users.length.toString()}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Total
                </p>
                <p className="text-2xl sm:text-3xl font-bold mt-1">
                  {total.toLocaleString("pt-MZ")}
                </p>
                {hasFilters && (
                  <p className="text-xs text-muted-foreground mt-1">
                    com filtros aplicados
                  </p>
                )}
              </div>
              <div className="rounded-2xl bg-primary/10 p-3">
                <History className="h-8 w-8 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md overflow-hidden border-l-4 border-l-emerald-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                  Criados
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {createdCount}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  nesta página
                </p>
              </div>
              <Sparkles className="h-8 w-8 text-emerald-500/40" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md overflow-hidden border-l-4 border-l-amber-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                  Alterados
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                  {updatedCount}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  nesta página
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-amber-500/40" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md overflow-hidden border-l-4 border-l-rose-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wider">
                  Eliminados
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                  {deletedCount}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  nesta página
                </p>
              </div>
              <Zap className="h-8 w-8 text-rose-500/40" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3 space-y-4">
          {/* Filters */}
          {showFilters && (
            <Card className="border shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Filter className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Filtros</CardTitle>
                      <CardDescription>
                        Refine os registos por utilizador, período e tipo
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {DATE_PRESETS.map((p) => (
                      <Button
                        key={p.id}
                        variant={p.id === "clear" ? "ghost" : "outline"}
                        size="sm"
                        onClick={() => applyPreset(p)}
                        className={p.id === "clear" ? "text-muted-foreground" : ""}
                      >
                        {p.label}
                      </Button>
                    ))}
                    {hasFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearAllFilters}
                        className="text-destructive hover:text-destructive"
                      >
                        Limpar tudo
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div>
                    <Label className="text-xs font-medium">Utilizador</Label>
                    <Select
                      value={userFilter}
                      onValueChange={(v) => {
                        setUserFilter(v);
                        setOffset(0);
                      }}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os utilizadores</SelectItem>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={String(u.id)}>
                            {u.employee_name || u.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Data início
                    </Label>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => {
                        setDateFrom(e.target.value);
                        setOffset(0);
                      }}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Data fim</Label>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => {
                        setDateTo(e.target.value);
                        setOffset(0);
                      }}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Tipo de acção</Label>
                    <Select
                      value={actionType}
                      onValueChange={(v) => {
                        setActionType(v);
                        setOffset(0);
                      }}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTION_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium flex items-center gap-1">
                      <Search className="h-3 w-3" /> Pesquisar
                    </Label>
                    <Input
                      placeholder="Utilizador, entidade, motivo..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Main content */}
          <Card className="border shadow-sm overflow-hidden">
            <CardHeader className="border-b bg-muted/20 py-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Registos de auditoria
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {searchQuery
                      ? `${results.length} resultado(s) para "${searchQuery}"`
                      : `${total.toLocaleString("pt-MZ")} registos no total`}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex p-0.5 rounded-lg bg-muted/80 border">
                    <Button
                      variant={viewMode === "table" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("table")}
                      className="rounded-md"
                    >
                      Tabela
                    </Button>
                    <Button
                      variant={viewMode === "timeline" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("timeline")}
                      className="rounded-md"
                    >
                      Linha do tempo
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-24">
                  <Loader2 className="h-14 w-14 animate-spin text-primary mb-4" />
                  <p className="text-sm font-medium text-muted-foreground">
                    A carregar registos...
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    A processar histórico de acções
                  </p>
                </div>
              ) : results.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 px-6">
                  <div className="rounded-full bg-muted/80 p-8 mb-6">
                    <History className="h-20 w-20 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-xl mb-2">
                    Nenhum registo encontrado
                  </h3>
                  <p className="text-muted-foreground text-center max-w-md mb-6">
                    {searchQuery
                      ? `Não há resultados para "${searchQuery}". Tente outra pesquisa ou limpe os filtros.`
                      : "Ajuste os filtros ou seleccione outro período para ver o histórico de acções."}
                  </p>
                  <Button variant="outline" onClick={clearAllFilters}>
                    Limpar filtros
                  </Button>
                </div>
              ) : viewMode === "timeline" ? (
                <ScrollArea className="h-[560px]">
                  <div className="relative px-6 py-6">
                    <div className="absolute left-8 top-4 bottom-4 w-px bg-gradient-to-b from-primary/40 via-muted to-transparent" />
                    <div className="space-y-0">
                      {results.map((r, idx) => (
                        <AuditTimelineItem
                          key={`audit-${r.source ?? r.entity}-${r.id}-${idx}`}
                          entry={r}
                          isFirst={idx === 0}
                          onViewDetails={() => setDetailEntry(r)}
                        />
                      ))}
                    </div>
                  </div>
                </ScrollArea>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="px-5 py-4 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                          <Clock className="h-3.5 w-3.5 inline mr-1.5" />
                          Data
                        </th>
                        <th className="px-5 py-4 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                          <User className="h-3.5 w-3.5 inline mr-1.5" />
                          Utilizador
                        </th>
                        <th className="px-5 py-4 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                          Entidade
                        </th>
                        <th className="px-5 py-4 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                          Acção
                        </th>
                        <th className="px-5 py-4 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                          ID
                        </th>
                        <th className="px-5 py-4 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider min-w-[160px]">
                          Motivo
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r, idx) => (
                        <tr
                          key={`audit-${r.source ?? r.entity}-${r.id}-${idx}`}
                          className="border-b last:border-0 hover:bg-muted/15 transition-colors group"
                        >
                          <td className="px-5 py-3.5">
                            <span
                              className="text-muted-foreground"
                              title={r.date ? formatDateTime(r.date) : ""}
                            >
                              {r.date ? formatRelativeTime(r.date) : "—"}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 font-medium">
                            {r.user_name || r.user_username || "—"}
                          </td>
                          <td className="px-5 py-3.5">
                            <EntityLink
                              entry={r}
                              onViewDetails={() => setDetailEntry(r)}
                            />
                          </td>
                          <td className="px-5 py-3.5">
                            <ActionBadge
                              action={r.action}
                              label={r.action_label}
                            />
                          </td>
                          <td className="px-5 py-3.5 text-muted-foreground tabular-nums font-mono">
                            {r.object_id ?? "—"}
                          </td>
                          <td className="px-5 py-3.5 max-w-[200px]">
                            {r.change_reason ? (
                              <span
                                className="text-muted-foreground line-clamp-2"
                                title={r.change_reason}
                              >
                                {r.change_reason}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/60">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {totalPages > 1 && (
                <div className="px-5 py-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/5">
                  <p className="text-sm text-muted-foreground order-2 sm:order-1">
                    {total.toLocaleString("pt-MZ")} registos · página{" "}
                    <span className="font-semibold text-foreground">
                      {currentPage}
                    </span>{" "}
                    de {totalPages}
                  </p>
                  <div className="flex items-center gap-2 order-1 sm:order-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={offset === 0}
                      onClick={() => setOffset((o) => Math.max(0, o - limit))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="px-4 py-2 text-sm font-medium bg-muted/50 rounded-md min-w-[80px] text-center">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={offset + limit >= total}
                      onClick={() => setOffset((o) => o + limit)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Por utilizador
              </CardTitle>
              <CardDescription>
                Filtre as acções por utilizador
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={userFilter}
                onValueChange={(v) => {
                  setUserFilter(v);
                  setOffset(0);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Utilizador" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.employee_name || u.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {entityCounts.length > 0 && (
            <Card className="border shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Por entidade
                </CardTitle>
                <CardDescription>
                  Acções nesta página por tipo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {entityCounts.slice(0, 8).map(([entity, count]) => {
                    const Icon = ENTITY_ICONS[entity] || History;
                    const pct = Math.round(
                      (count / results.length) * 100
                    );
                    return (
                      <div
                        key={entity}
                        className="flex items-center gap-3 py-2"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {entity}
                          </p>
                          <div className="h-1.5 mt-1 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary/70"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <Badge variant="secondary" className="shrink-0">
                          {count}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <AuditDetailDialog
            entry={detailEntry}
            onClose={() => setDetailEntry(null)}
          />
          <LatestActionsWidget
            userFilter={
              userFilter && userFilter !== "all"
                ? parseInt(userFilter, 10)
                : undefined
            }
            onViewDetails={(r) => setDetailEntry(r)}
          />
        </div>
      </div>
    </div>
  );
}

function AuditDetailDialog({
  entry,
  onClose,
}: {
  entry: ApiAuditEntry | null;
  onClose: () => void;
}) {
  const { data: detail, isLoading } = useQuery({
    queryKey: ["audit-detail-dialog", entry?.source ?? entry?.entity, entry?.id],
    queryFn: () =>
      authApi.auditDetail({
        entity: entry!.entity,
        source: entry!.source,
        history_id: entry!.id,
      }),
    enabled: !!entry,
  });

  const title = detail?.display_name || entry?.display_name || `${entry?.entity ?? ""} #${entry?.object_id ?? entry?.id ?? ""}`;
  const details = detail?.details ?? [];
  const changes = detail?.changes ?? [];

  return (
    <Dialog open={!!entry} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <span>{title}</span>
            {entry && (
              <ActionBadge action={entry.action} label={entry.action_label} size="sm" />
            )}
          </DialogTitle>
          <DialogDescription>
            {detail ? (
              <>
                Por <strong>{detail.user_name || "Sistema"}</strong>
                {detail.date && (
                  <>
                    {" "}em {formatDateTime(detail.date)}
                  </>
                )}
              </>
            ) : (
              "A carregar..."
            )}
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            A carregar detalhes...
          </div>
        ) : detail ? (
          <ScrollArea className="flex-1 -mx-2 px-2 max-h-[50vh]">
            <div className="space-y-6 pb-4">
              {details.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Tudo o que continha
                  </h4>
                  <div className="rounded-xl border bg-muted/20 p-4 space-y-2">
                    {details.map((d) => (
                      <div
                        key={d.label}
                        className="flex justify-between gap-4 py-1.5 border-b border-border/50 last:border-0"
                      >
                        <span className="text-sm text-muted-foreground">{d.label}</span>
                        <span className="text-sm font-medium text-right">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {changes.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    O que foi alterado
                  </h4>
                  <div className="rounded-xl border border-amber-200/50 dark:border-amber-800/50 bg-amber-50/30 dark:bg-amber-950/20 p-4 space-y-3">
                    {changes.map((c) => (
                      <div
                        key={c.field}
                        className="flex flex-wrap items-center gap-2 text-sm"
                      >
                        <span className="font-medium text-foreground">
                          {formatFieldLabel(c.field)}
                        </span>
                        <span className="text-rose-600 dark:text-rose-400 line-through">
                          {c.old || "(vazio)"}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          {c.new || "(vazio)"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {detail.change_reason && (
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Motivo</p>
                  <p className="text-sm">{detail.change_reason}</p>
                </div>
              )}
              {details.length === 0 && changes.length === 0 && !detail.change_reason && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Sem detalhes adicionais para este registo.
                </p>
              )}
            </div>
          </ScrollArea>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function StatPill({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof History;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card/50 px-4 py-3 shadow-sm">
      <div className="rounded-lg bg-primary/10 p-2">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-lg font-bold">{value}</p>
        {sub && (
          <p className="text-[10px] text-muted-foreground">{sub}</p>
        )}
      </div>
    </div>
  );
}

function EntityCell({ entity }: { entity: string }) {
  const Icon = ENTITY_ICONS[entity] || History;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="font-medium">{entity}</span>
    </span>
  );
}

function EntityLink({
  entry,
  onViewDetails,
}: {
  entry: ApiAuditEntry;
  onViewDetails: () => void;
}) {
  const Icon = ENTITY_ICONS[entry.entity] || History;
  const label = entry.display_name || entry.entity;
  return (
    <button
      type="button"
      onClick={onViewDetails}
      className="inline-flex items-center gap-2 text-left hover:opacity-80 hover:underline focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-md px-1 -mx-1 transition-colors group"
      title="Ver todos os detalhes"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="font-medium text-primary">{label}</span>
      <Eye className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
    </button>
  );
}

function ActionBadge({
  action,
  label,
  size = "default",
}: {
  action: string;
  label: string;
  size?: "default" | "sm";
}) {
  const isSm = size === "sm";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-semibold",
        isSm ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
        action === "+" &&
          "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50",
        action === "~" &&
          "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/50",
        action === "-" &&
          "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/50"
      )}
    >
      {label}
    </span>
  );
}

const FIELD_LABELS: Record<string, string> = {
  name: "Nome",
  first_name: "Nome próprio",
  last_name: "Apelido",
  email: "E-mail",
  phone: "Telefone",
  address: "Morada",
  amount: "Montante",
  interest_rate: "Taxa de juro",
  status: "Estado",
  date: "Data",
  start_date: "Data início",
  end_date: "Data fim",
  document: "Documento",
  created_at: "Criado em",
  updated_at: "Actualizado em",
};

function formatFieldLabel(field: string): string {
  return FIELD_LABELS[field] || field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function AuditTimelineItem({
  entry,
  isFirst,
  onViewDetails,
}: {
  entry: ApiAuditEntry;
  isFirst: boolean;
  onViewDetails?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = ENTITY_ICONS[entry.entity] || History;
  const canExpand = entry.action === "~";
  const { data: detail, isLoading } = useQuery({
    queryKey: ["audit-detail", entry.source ?? entry.entity, entry.id],
    queryFn: () =>
      authApi.auditDetail({
        entity: entry.entity,
        source: entry.source,
        history_id: entry.id,
      }),
    enabled: canExpand && expanded,
  });
  const changes = detail?.changes ?? [];

  return (
    <div className="relative flex gap-5 py-5 pl-2 group">
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 bg-card z-10 shadow-sm transition-all group-hover:scale-105 group-hover:shadow-md",
          entry.action === "+" &&
            "border-emerald-200 bg-emerald-50/90 dark:bg-emerald-950/60 dark:border-emerald-800",
          entry.action === "~" &&
            "border-amber-200 bg-amber-50/90 dark:bg-amber-950/60 dark:border-amber-800",
          entry.action === "-" &&
            "border-rose-200 bg-rose-50/90 dark:bg-rose-950/60 dark:border-rose-800"
        )}
      >
        <Icon
          className={cn(
            "h-5 w-5",
            entry.action === "+" && "text-emerald-600 dark:text-emerald-400",
            entry.action === "~" && "text-amber-600 dark:text-amber-400",
            entry.action === "-" && "text-rose-600 dark:text-rose-400"
          )}
        />
      </div>
      <div className="flex-1 min-w-0 pb-2">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="font-semibold">
            {entry.user_name || entry.user_username || "Sistema"}
          </span>
          <ActionBadge action={entry.action} label={entry.action_label} size="sm" />
          <span className="text-muted-foreground">·</span>
          {onViewDetails ? (
            <button
              type="button"
              onClick={onViewDetails}
              className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 rounded px-0.5 -mx-0.5"
              title="Ver todos os detalhes"
            >
              {entry.display_name || `${entry.entity} #${entry.object_id ?? entry.id}`}
              <Eye className="h-3.5 w-3.5" />
            </button>
          ) : (
            <span className="text-muted-foreground font-medium">
              {entry.display_name || entry.entity}
            </span>
          )}
        </div>
        {entry.change_reason && (
          <div className="flex items-start gap-2 mt-2 p-3 rounded-lg bg-muted/50 border border-transparent group-hover:border-muted-foreground/10">
            <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
            <span className="text-sm text-muted-foreground">
              {entry.change_reason}
            </span>
          </div>
        )}
        {canExpand && (
          <div className="mt-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 gap-1"
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  Ocultar alterações
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  Ver o que foi alterado
                </>
              )}
            </Button>
            {expanded && (
              <div className="mt-2 rounded-xl border border-amber-200/60 dark:border-amber-800/50 bg-amber-50/30 dark:bg-amber-950/20 p-4">
                {isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    A carregar detalhes...
                  </div>
                ) : changes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Não foi possível obter o detalhe das alterações para este registo.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                      Campos alterados
                    </p>
                    <div className="space-y-2">
                      {changes.map((c) => (
                        <div
                          key={c.field}
                          className="flex flex-wrap items-center gap-2 text-sm p-2 rounded-lg bg-white/60 dark:bg-black/20"
                        >
                          <span className="font-medium text-foreground shrink-0">
                            {formatFieldLabel(c.field)}
                          </span>
                          <span className="text-rose-600 dark:text-rose-400 line-through truncate max-w-[140px]" title={c.old ?? ""}>
                            {c.old || "(vazio)"}
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium truncate max-w-[180px]" title={c.new ?? ""}>
                            {c.new || "(vazio)"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <p
          className="text-xs text-muted-foreground mt-2 flex items-center gap-1"
          title={entry.date ? formatDateTime(entry.date) : ""}
        >
          <Clock className="h-3 w-3" />
          {entry.date ? formatRelativeTime(entry.date) : "—"}
        </p>
      </div>
    </div>
  );
}

function LatestActionsWidget({
  userFilter,
  onViewDetails,
}: {
  userFilter?: number;
  onViewDetails?: (entry: ApiAuditEntry) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["audit-latest", userFilter],
    queryFn: () => authApi.auditLatest({ user: userFilter, limit: 15 }),
  });
  const items = data?.results ?? [];

  return (
    <Card className="border shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Actividade recente
        </CardTitle>
        <CardDescription>
          Últimas 15 acções
          {userFilter ? " do utilizador" : " no sistema"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            <p className="text-xs text-muted-foreground mt-2">
              A carregar...
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center">
            <History className="h-12 w-12 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Nenhuma acção recente
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[320px] -mr-2 pr-2">
            <div className="space-y-2">
              {items.map((r, idx) => (
                <div
                  key={`audit-latest-${r.source ?? r.entity}-${r.id}-${idx}`}
                  className={cn(
                    "rounded-xl border bg-card/50 p-3 transition-all",
                    onViewDetails && "hover:bg-muted/30 hover:border-muted-foreground/20 cursor-pointer",
                    !onViewDetails && "cursor-default"
                  )}
                  onClick={onViewDetails ? () => onViewDetails(r) : undefined}
                  onKeyDown={onViewDetails ? (e) => e.key === "Enter" && onViewDetails(r) : undefined}
                  role={onViewDetails ? "button" : undefined}
                  tabIndex={onViewDetails ? 0 : undefined}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="font-medium text-sm truncate">
                      {r.user_name || r.user_username || "—"}
                    </span>
                    <ActionBadge
                      action={r.action}
                      label={r.action_label}
                      size="sm"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-xs mb-1">
                    <EntityCell entity={r.entity} />
                    <span className="font-medium text-primary truncate flex-1 min-w-0">
                      {r.display_name || (r.object_id != null ? `#${r.object_id}` : "")}
                      {onViewDetails && <Eye className="h-3 w-3 inline ml-0.5 opacity-70 shrink-0" />}
                    </span>
                  </div>
                  <p
                    className="text-[11px] text-muted-foreground"
                    title={r.date ? formatDateTime(r.date) : ""}
                  >
                    {r.date ? formatRelativeTime(r.date) : ""}
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
