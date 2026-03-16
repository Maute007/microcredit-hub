import { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
}

export interface FilterConfig {
  key: string;
  placeholder?: string;
  options: { value: string; label: string }[];
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  /** Chave única para cada item (ex: "id"). Usada como key nas linhas em vez do índice. */
  rowKey?: keyof T | ((item: T) => string | number);
  searchKeys?: string[];
  pageSize?: number;
  onRowClick?: (item: T) => void;
  filterConfig?: FilterConfig;
  filterValue?: string;
  onFilterChange?: (value: string) => void;
  renderRowActions?: (item: T) => React.ReactNode;
  getRowClassName?: (item: T) => string | undefined;
  loading?: boolean;
  /** Valor inicial da pesquisa (ex: vindo da URL) */
  initialSearch?: string;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  rowKey = "id",
  searchKeys = [],
  pageSize = 8,
  onRowClick,
  filterConfig,
  filterValue = "",
  onFilterChange,
  renderRowActions,
  getRowClassName,
  loading = false,
  initialSearch = "",
}: DataTableProps<T>) {
  const [search, setSearch] = useState(initialSearch);
  useEffect(() => {
    if (initialSearch !== search) setSearch(initialSearch);
  }, [initialSearch]);
  const [page, setPage] = useState(0);
  const [pageSizeInternal, setPageSizeInternal] = useState(pageSize);

  const filtered = useMemo(() => {
    const base: T[] = Array.isArray(data) ? data : [];
    let result = base;
    if (search && searchKeys.length > 0) {
      const q = search.toLowerCase();
      result = result.filter((item) =>
        searchKeys.some((key) => String(item[key] ?? "").toLowerCase().includes(q))
      );
    }
    // Quando filterValue é "all" consideramos que não há filtro aplicado
    if (filterConfig && filterValue && filterValue !== "all") {
      result = result.filter((item) => String(item[filterConfig.key] ?? "") === filterValue);
    }
    return result;
  }, [data, search, searchKeys, filterConfig, filterValue]);

  const totalPages = Math.ceil(filtered.length / pageSizeInternal);
  const paged = filtered.slice(page * pageSizeInternal, (page + 1) * pageSizeInternal);

  const displayColumns = renderRowActions
    ? [...columns, { key: "_actions", label: "Ações" }]
    : columns;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {searchKeys.length > 0 && (
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-9"
            />
          </div>
        )}
        {filterConfig && (
          <Select
            value={filterValue}
            onValueChange={(v) => {
              onFilterChange?.(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={filterConfig.placeholder ?? "Filtrar"} />
            </SelectTrigger>
            <SelectContent>
              {filterConfig.options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span>Linhas por página</span>
          <Select
            value={String(pageSizeInternal)}
            onValueChange={(v) => {
              const next = parseInt(v, 10) || pageSize;
              setPageSizeInternal(next);
              setPage(0);
            }}
          >
            <SelectTrigger className="h-8 w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[5, 10, 25, 50].map((opt) => (
                <SelectItem key={opt} value={String(opt)}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {displayColumns.map((col) => (
                  <th key={col.key} className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={displayColumns.length} className="px-4 py-8 text-center text-muted-foreground">
                    A carregar...
                  </td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={displayColumns.length} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum resultado encontrado
                  </td>
                </tr>
              ) : (
                paged.map((item, idx) => {
                  const key = rowKey
                    ? typeof rowKey === "function"
                      ? String(rowKey(item))
                      : String(item[rowKey as keyof T] ?? "")
                    : `row-${idx}`;
                  return (
                  <tr
                    key={key}
                    onClick={() => onRowClick?.(item)}
                    className={cn(
                      "border-b last:border-0 transition-all duration-200",
                      getRowClassName?.(item),
                      onRowClick ? "cursor-pointer hover:bg-muted/30" : "hover:bg-muted/20"
                    )}
                  >
                    {displayColumns.map((col) => (
                      <td
                        key={col.key}
                        className="px-4 py-3 whitespace-nowrap"
                        onClick={(e) => col.key === "_actions" && e.stopPropagation()}
                      >
                        {col.key === "_actions" && renderRowActions
                          ? renderRowActions(item)
                          : col.render
                            ? col.render(item)
                            : String(item[col.key] ?? "")}
                      </td>
                    ))}
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            Mostrando <strong className="text-foreground">{page * pageSizeInternal + 1}</strong>
            {"–"}
            <strong className="text-foreground">{Math.min((page + 1) * pageSizeInternal, filtered.length)}</strong>
            {" de "}
            <strong className="text-foreground">{filtered.length}</strong> registro(s)
            {totalPages > 1 && (
              <span className="ml-2"> • Página <strong className="text-foreground">{page + 1}</strong> de <strong className="text-foreground">{totalPages}</strong></span>
            )}
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(0)} disabled={page === 0}>
                Primeira
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[90px] text-center font-medium">
                {page + 1} / {totalPages}
              </span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}>
                Última
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
