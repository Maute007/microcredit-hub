import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { systemApi, type ApiSystemSettings } from "@/lib/api";
import {
  LayoutDashboard,
  Users,
  Wallet,
  CreditCard,
  CalendarDays,
  UserCog,
  BookOpen,
  FileBarChart,
  ChevronLeft,
  Menu,
  Search,
  LogOut,
  Building2,
  History,
} from "lucide-react";
import { NotificationDropdown } from "@/components/NotificationDropdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const navItems: Array<{
  title: string;
  path: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
  /** Permissão necessária para ver o módulo (ex: view_client). Se não definida, qualquer autenticado vê. */
  viewPermission?: string;
}> = [
  { title: "Dashboard", path: "/", icon: LayoutDashboard },
  { title: "Clientes", path: "/clientes", icon: Users, viewPermission: "view_client" },
  { title: "Empréstimos", path: "/emprestimos", icon: Wallet, viewPermission: "view_loan" },
  { title: "Pagamentos", path: "/pagamentos", icon: CreditCard, viewPermission: "view_payment" },
  { title: "Calendário", path: "/calendario", icon: CalendarDays, viewPermission: "view_calendarevent" },
  { title: "Recursos Humanos", path: "/rh", icon: UserCog, viewPermission: "view_employee" },
  { title: "Contabilidade", path: "/contabilidade", icon: BookOpen, viewPermission: "view_transaction" },
  { title: "Relatórios", path: "/relatorios", icon: FileBarChart },
  { title: "Utilizadores & Acesso", path: "/utilizadores", icon: Building2, adminOnly: true },
  { title: "Histórico de acções", path: "/auditoria", icon: History, adminOnly: true },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const username = (user?.username ?? "").trim();
  const initials = user
    ? [user.first_name, user.last_name]
        .filter(Boolean)
        .map((n) => n[0])
        .join("")
        .toUpperCase() || username.slice(0, 2).toUpperCase() || "US"
    : "?";
  const displayName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(" ") || username || "Utilizador"
    : "";
  const roleLabel = user?.profile?.job_title || user?.role?.name || "";

  const { data: systemSettings } = useQuery<ApiSystemSettings>({
    queryKey: ["system-settings"],
    queryFn: systemApi.get,
  });
  const vendorName = "MAKIRA";
  const brandName = systemSettings?.name || vendorName;
  const brandSubtitle =
    systemSettings?.tagline || (brandName === vendorName ? "Sistema de Gestão" : `${vendorName} · Sistema de Gestão`);
  const brandColor = systemSettings?.primary_color || undefined;

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const perms = user?.permissions ?? [];
  const hasViewPermission = (codename: string) =>
    !user ? false : user.is_superuser || perms.includes("*") || perms.includes(codename);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-16 border-b border-sidebar-border shrink-0">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: brandColor || "var(--sidebar-primary)" }}
        >
          {systemSettings?.logo_url ? (
            <img
              src={systemSettings.logo_url}
              alt={brandName}
              className="h-5 w-5 rounded-md object-cover"
            />
          ) : (
            <Building2 className="h-4 w-4 text-sidebar-primary-foreground" />
          )}
        </div>
        {!collapsed && (
          <div className="animate-slide-in">
            <p className="font-bold text-sm text-sidebar-accent-foreground truncate">
              {brandName}
            </p>
            <p className="text-[10px] text-sidebar-foreground truncate">{brandSubtitle}</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {navItems
          .filter((item) => {
            if (item.adminOnly) return user?.is_staff || user?.is_superuser;
            if (item.viewPermission) return hasViewPermission(item.viewPermission);
            return true;
          })
          .map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-sm"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              } ${collapsed ? "justify-center" : ""}`}
              title={collapsed ? item.title : undefined}
              aria-current={active ? "page" : undefined}
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span>{item.title}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3">
        {!collapsed ? (
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-sidebar-primary/20 flex items-center justify-center">
              <span className="text-xs font-medium text-sidebar-primary">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-sidebar-accent-foreground truncate">{displayName || "Utilizador"}</p>
              <p className="text-[10px] text-sidebar-foreground truncate">{roleLabel || "—"}</p>
            </div>
            <button
              onClick={() => logout()}
              className="text-sidebar-foreground hover:text-sidebar-accent-foreground"
              title="Terminar sessão"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex justify-center">
            <button
              onClick={() => logout()}
              className="w-8 h-8 rounded-full bg-sidebar-primary/20 flex items-center justify-center hover:bg-sidebar-primary/30"
              title="Terminar sessão"
            >
              <span className="text-xs font-medium text-sidebar-primary">{initials}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <a
        href="#main-content"
        className="sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:w-auto focus:h-auto focus:m-0 focus:overflow-visible focus:[clip:auto]"
      >
        Ir para o conteúdo
      </a>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar - mobile */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-sidebar transform transition-transform lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Sidebar - desktop */}
      <aside
        className={`relative hidden lg:flex flex-col shrink-0 bg-sidebar transition-all duration-300 ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        <SidebarContent />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex items-center justify-center absolute top-1/2 -translate-y-1/2 -right-3 w-7 h-7 rounded-full bg-card border border-border shadow-sm hover:bg-muted z-20"
          aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
        >
          <ChevronLeft className={`h-3.5 w-3.5 transition-transform ${collapsed ? "rotate-180" : ""}`} />
        </button>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-16 border-b bg-card/80 backdrop-blur-sm flex items-center justify-between px-4 lg:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <form
              className="relative hidden sm:block"
              onSubmit={(e) => {
                e.preventDefault();
                const q = searchQuery.trim();
                if (q) navigate(`/clientes?q=${encodeURIComponent(q)}`);
              }}
            >
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar clientes..."
                className="pl-9 w-64 bg-muted/50 border-0"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </form>
          </div>

          <div className="flex items-center gap-2">
            <NotificationDropdown />
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center lg:hidden">
              <span className="text-xs font-medium text-primary">{initials}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main id="main-content" className="flex-1 overflow-y-auto p-4 lg:p-6" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
