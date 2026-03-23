import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { QueryErrorAlert } from "@/components/QueryErrorAlert";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  usersApi,
  rolesApi,
  permissionsApi,
  systemApi,
  hrApi,
  type ApiUser,
  type ApiRole,
  type ApiPermission,
  type ApiSystemSettings,
  type ApiEmployee,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  MODULE_LABELS,
  ACTION_LABELS,
  getPermissionHelpText,
  getFriendlyResourceName,
} from "@/data/permissionsLabels";
import {
  loginBannerBodyText,
  loginBannerSubtitleText,
  loginBannerTitleText,
} from "@/lib/loginBannerStyles";
import { Shield, UserPlus, Users, Settings2, Trash2, Pencil, CheckCircle2, XCircle, HelpCircle } from "lucide-react";

const userColumns = [
  {
    key: "display_name",
    label: "Nome",
    render: (u: ApiUser) => u.employee_name || u.username,
  },
  { key: "username", label: "Username" },
  { key: "email", label: "Email" },
  {
    key: "role",
    label: "Papel",
    render: (u: ApiUser) => u.role?.name ?? "—",
  },
  {
    key: "employee_name",
    label: "Colaborador",
    render: (u: ApiUser) => u.employee_name ?? "—",
  },
  {
    key: "is_active",
    label: "Estado",
    render: (u: ApiUser) =>
      u.is_active ? (
        <Badge variant="outline" className="border-emerald-500 text-emerald-700">
          Activo
        </Badge>
      ) : (
        <Badge variant="outline" className="border-slate-400 text-slate-600">
          Inactivo
        </Badge>
      ),
  },
];

export default function UsersPage() {
  const [showNewUser, setShowNewUser] = useState(false);
  const [editingUser, setEditingUser] = useState<ApiUser | null>(null);
  const [editingRole, setEditingRole] = useState<ApiRole | null>(null);
  const [showNewRole, setShowNewRole] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const {
    canViewUser,
    canAddUser,
    canChangeUser,
    canDeleteUser,
    canViewRole,
    canAddRole,
    canChangeRole,
    canDeleteRole,
    canViewSystemSettings,
    canChangeSystemSettings,
  } = usePermissions();

  const showUsersTab = canViewUser || canAddUser;
  const showRolesTab = canViewRole || canAddRole || canChangeRole || canDeleteRole;
  const showSettingsTab = canViewSystemSettings || canChangeSystemSettings;
  const defaultTab = showUsersTab ? "users" : showRolesTab ? "roles" : "settings";

  const { data: users = [], isError: usersError, refetch: refetchUsers } = useQuery<ApiUser[]>({
    queryKey: ["users"],
    queryFn: usersApi.list,
    enabled: canViewUser,
  });

  const { data: roles = [] } = useQuery<ApiRole[]>({
    queryKey: ["roles"],
    queryFn: rolesApi.list,
    enabled: showRolesTab,
  });

  const { data: permissions = [] } = useQuery<ApiPermission[]>({
    queryKey: ["permissions"],
    queryFn: permissionsApi.list,
    enabled: showRolesTab,
  });

  const { data: employees = [] } = useQuery<ApiEmployee[]>({
    queryKey: ["employees-all"],
    queryFn: () => hrApi.employees.list({ page_size: 200 }),
    enabled: canAddUser || canChangeUser,
  });

  const { data: systemSettings } = useQuery<ApiSystemSettings>({
    queryKey: ["system-settings"],
    queryFn: systemApi.get,
  });

  const createUser = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setShowNewUser(false);
      toast({ title: "Utilizador criado" });
    },
    onError: (e: unknown) => {
      toast({
        title: "Erro ao criar utilizador",
        description: e instanceof Error ? e.message : "Não foi possível criar o utilizador.",
        variant: "destructive",
      });
    },
  });

  const updateUser = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<ApiUser> & { password?: string } }) =>
      usersApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditingUser(null);
      toast({ title: "Utilizador actualizado" });
    },
  });

  const deleteUser = useMutation({
    mutationFn: usersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "Utilizador eliminado" });
    },
  });

  const rolesVisible = (roles ?? []).filter((r) =>
    authUser?.is_superuser ? true : r.code !== "superuser",
  );

  const createRole = useMutation({
    mutationFn: rolesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      setShowNewRole(false);
      toast({ title: "Papel criado" });
    },
  });

  const updateRole = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<{ name: string; description: string; permissions_ids: number[] }> }) =>
      rolesApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      setEditingRole(null);
      toast({ title: "Papel actualizado" });
    },
  });

  const deleteRole = useMutation({
    mutationFn: rolesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      toast({ title: "Papel eliminado" });
    },
  });

  const updateSettings = useMutation({
    mutationFn: systemApi.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
      toast({ title: "Configurações actualizadas" });
    },
  });

  const visibleUsers = (users ?? []).filter((u) =>
    authUser?.is_superuser ? true : !u.is_superuser,
  );

  return (
    <div>
      {usersError && (
        <div className="mb-4">
          <QueryErrorAlert onRetry={() => refetchUsers()} />
        </div>
      )}
      <PageHeader
        title="Utilizadores & Acesso"
        description="Gestão de utilizadores, papéis, permissões e identidade visual do sistema."
        actions={
          canAddUser ? (
          <Dialog open={showNewUser} onOpenChange={setShowNewUser}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Novo utilizador
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Novo utilizador</DialogTitle>
              </DialogHeader>
              <UserForm
                roles={rolesVisible}
                employees={employees}
                loading={createUser.isLoading}
                allowSuperuserFields={!!authUser?.is_superuser}
                onSubmit={(payload) => createUser.mutate(payload)}
              />
            </DialogContent>
          </Dialog>
          ) : null
        }
      />

      <Tabs defaultValue={defaultTab} className="mt-4 space-y-4">
        <TabsList className="bg-muted/50 p-1 rounded-xl flex-wrap gap-1">
          {showUsersTab && (
            <TabsTrigger value="users" className="rounded-lg">
              <Users className="h-4 w-4 mr-1" />
              Utilizadores
            </TabsTrigger>
          )}
          {showRolesTab && (
            <TabsTrigger value="roles" className="rounded-lg">
              <Shield className="h-4 w-4 mr-1" />
              Papéis & Permissões
            </TabsTrigger>
          )}
          {showSettingsTab && (
            <TabsTrigger value="settings" className="rounded-lg">
              <Settings2 className="h-4 w-4 mr-1" />
              Configurações do sistema
            </TabsTrigger>
          )}
        </TabsList>

        {showUsersTab && (
        <TabsContent value="users" className="space-y-4">
          <DataTable
            data={visibleUsers}
            columns={userColumns}
            searchKeys={["username", "email", "employee_name"]}
            onRowClick={canViewUser || canChangeUser ? setEditingUser : undefined}
          />

          <Dialog open={!!editingUser} onOpenChange={(o) => !o && setEditingUser(null)}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Editar utilizador</DialogTitle>
              </DialogHeader>
              {editingUser && (
                <UserForm
                  initial={editingUser}
                  roles={rolesVisible}
                  employees={employees}
                  loading={updateUser.isLoading}
                  allowSuperuserFields={!!authUser?.is_superuser}
                  readOnly={!canChangeUser}
                  canDelete={canDeleteUser}
                  onSubmit={(payload) =>
                    updateUser.mutate({
                      id: editingUser.id,
                      payload,
                    })
                  }
                  onDelete={() => {
                    if (editingUser) {
                      deleteUser.mutate(editingUser.id);
                      setEditingUser(null);
                    }
                  }}
                />
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>
        )}

        {showRolesTab && (
        <TabsContent value="roles" className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h3 className="font-semibold text-lg">Papéis de acesso</h3>
              <p className="text-sm text-muted-foreground">
                Agrupe permissões por função (ex.: gestor, caixa, analista) e atribua esses papéis aos utilizadores.
              </p>
            </div>
            {canAddRole && (
            <Dialog open={showNewRole} onOpenChange={setShowNewRole}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Shield className="h-4 w-4 mr-2" />
                  Novo papel
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>Novo papel</DialogTitle>
                </DialogHeader>
                <RoleForm
                  permissions={permissions}
                  loading={createRole.isLoading}
                  onSubmit={(payload) => createRole.mutate(payload)}
                />
              </DialogContent>
            </Dialog>
            )}
          </div>

          <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
            <div className="p-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Nome</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Código</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Permissões</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Acções</th>
                  </tr>
                </thead>
                <tbody>
                  {rolesVisible.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                        Nenhum papel configurado.
                      </td>
                    </tr>
                  ) : (
                    rolesVisible.map((r) => (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <span className="font-medium">{r.name}</span>
                            {r.is_system && (
                              <Badge variant="outline" className="text-[10px] ml-1">
                                sistema
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{r.code}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {r.permissions.length === 0
                            ? "Sem permissões associadas"
                            : `${r.permissions.length} permissão(ões)`}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="inline-flex gap-1">
                            {canChangeRole && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingRole(r)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {!r.is_system && canDeleteRole && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                onClick={() => deleteRole.mutate(r.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <Dialog open={!!editingRole} onOpenChange={(o) => !o && setEditingRole(null)}>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Editar papel</DialogTitle>
              </DialogHeader>
              {editingRole && (
                <RoleForm
                  initial={editingRole}
                  permissions={permissions}
                  loading={updateRole.isLoading}
                  onSubmit={(payload) => updateRole.mutate({ id: editingRole.id, payload })}
                />
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>
        )}

        {showSettingsTab && (
        <TabsContent value="settings">
          <SystemSettingsForm
            initial={systemSettings}
            loading={updateSettings.isLoading}
            canLock={!!authUser?.is_superuser}
            canEdit={canChangeSystemSettings}
            onSubmit={(payload) => updateSettings.mutate(payload)}
          />
        </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function UserForm({
  initial,
  roles,
  employees,
  loading,
  allowSuperuserFields,
  readOnly = false,
  canDelete = true,
  onSubmit,
  onDelete,
}: {
  initial?: ApiUser;
  roles: ApiRole[];
  employees: ApiEmployee[];
  loading: boolean;
  allowSuperuserFields?: boolean;
  /** Só visualização (ex.: tem view_user mas não change_user). */
  readOnly?: boolean;
  /** Mostrar botão eliminar (requer delete_user no papel). */
  canDelete?: boolean;
  onSubmit: (payload: Partial<ApiUser> & { password?: string }) => void;
  onDelete?: () => void;
}) {
  const [username, setUsername] = useState(initial?.username ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState<string>(initial?.role?.id ? String(initial.role.id) : "");
  const [employeeId, setEmployeeId] = useState<string>(
    initial?.employee_id ? String(initial.employee_id) : "none",
  );
  const [isActive, setIsActive] = useState<boolean>(initial?.is_active ?? true);
  const [isStaff, setIsStaff] = useState<boolean>(initial?.is_staff ?? false);
  const [isSuperuser, setIsSuperuser] = useState<boolean>(initial?.is_superuser ?? false);

  useEffect(() => {
    setUsername(initial?.username ?? "");
    setEmail(initial?.email ?? "");
    setPassword("");
    setRoleId(initial?.role?.id ? String(initial.role.id) : "");
    setEmployeeId(initial?.employee_id ? String(initial.employee_id) : "none");
    setIsActive(initial?.is_active ?? true);
    setIsStaff(initial?.is_staff ?? false);
    setIsSuperuser(initial?.is_superuser ?? false);
  }, [initial?.id]);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (readOnly) return;
        const base: Partial<ApiUser> & { password?: string } = {
          username: username.trim(),
          email: email.trim() || undefined,
          password: password || undefined,
          is_active: isActive,
          role_id: roleId ? Number(roleId) : null,
          employee_id: employeeId === "none" ? null : Number(employeeId),
        };
        if (allowSuperuserFields) {
          base.is_staff = isStaff;
          base.is_superuser = isSuperuser;
        }
        onSubmit(base);
      }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Username</Label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} required readOnly={readOnly} />
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} readOnly={readOnly} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>{initial ? "Nova password (opcional)" : "Password"}</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={initial ? "Deixe em branco para não alterar" : ""}
            required={!initial && !readOnly}
            readOnly={readOnly}
            disabled={readOnly}
          />
        </div>
        <div>
          <Label>Papel</Label>
          <Select value={roleId} onValueChange={setRoleId} disabled={readOnly}>
            <SelectTrigger>
              <SelectValue placeholder="Selecionar papel" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r.id} value={String(r.id)}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Colaborador associado (opcional)</Label>
          <Select value={employeeId} onValueChange={setEmployeeId} disabled={readOnly}>
            <SelectTrigger>
              <SelectValue placeholder="Sem colaborador" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem colaborador</SelectItem>
              {employees.map((e) => (
                <SelectItem key={e.id} value={String(e.id)}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pt-6">
          <input
            id="user-active"
            type="checkbox"
            checked={isActive}
            onChange={(ev) => setIsActive(ev.target.checked)}
            className="rounded"
            disabled={readOnly}
          />
          <Label htmlFor="user-active" className="cursor-pointer flex items-center gap-1">
            {isActive ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Activo
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-slate-400" /> Inactivo
              </>
            )}
          </Label>
        </div>
      </div>
      {allowSuperuserFields && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
          <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
            Acesso de sistema (apenas superutilizador)
          </p>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={isStaff} onChange={(ev) => setIsStaff(ev.target.checked)} className="rounded" disabled={readOnly} />
              Staff (admin API / Django admin)
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={isSuperuser}
                onChange={(ev) => setIsSuperuser(ev.target.checked)}
                className="rounded"
                disabled={readOnly}
              />
              Superutilizador
            </label>
          </div>
        </div>
      )}
      <div className="pt-2 flex justify-between gap-2">
        {initial && onDelete && canDelete && !readOnly && (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Eliminar
          </Button>
        )}
        <div className="flex-1" />
        {!readOnly && (
          <Button type="submit" disabled={loading}>
            {loading ? "A guardar..." : initial ? "Guardar alterações" : "Criar utilizador"}
          </Button>
        )}
      </div>
    </form>
  );
}

function RoleForm({
  initial,
  permissions,
  loading,
  onSubmit,
}: {
  initial?: ApiRole;
  permissions: ApiPermission[];
  loading: boolean;
  onSubmit: (payload: { code: string; name: string; description?: string; permissions_ids?: number[] }) => void;
}) {
  const [code, setCode] = useState(initial?.code ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [selected, setSelected] = useState<Set<number>>(new Set(initial?.permissions.map((p) => p.id) ?? []));

  const togglePermission = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          code: code.trim(),
          name: name.trim(),
          description: description.trim() || undefined,
          permissions_ids: Array.from(selected),
        });
      }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Código</Label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Ex.: gestor, caixa, analista"
            required
          />
        </div>
        <div>
          <Label>Nome</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Gestor de crédito"
            required
          />
        </div>
      </div>
      <div>
        <Label>Descrição (opcional)</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Explique brevemente o que este papel pode fazer."
        />
      </div>
      <div className="rounded-xl border border-border/70 bg-gradient-to-b from-muted/40 to-muted/20 p-4 max-h-[28rem] overflow-y-auto shadow-inner">
        <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-3">
          Permissões — seleccione o módulo e marque o que pode fazer
        </p>
        <Accordion type="single" collapsible className="w-full space-y-1">
          {buildModuleMatrix(permissions).map((mod) => {
            const moduleLabel = MODULE_LABELS[mod.key] ?? mod.label;
            const selectedInMod = mod.rows.reduce((total, row) => {
              const count = (["view", "add", "change", "delete"] as const).filter(
                (a) => row[a] && selected.has(row[a]!.id)
              ).length;
              return total + count;
            }, 0);
            return (
              <AccordionItem
                key={mod.key}
                value={mod.key}
                className="rounded-lg border border-border/50 bg-card/80 px-3 shadow-sm data-[state=open]:bg-card"
              >
                <AccordionTrigger className="text-sm py-3.5 hover:no-underline hover:bg-muted/30 rounded-lg px-2 -mx-2">
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{moduleLabel}</span>
                    {selectedInMod > 0 && (
                      <Badge variant="secondary" className="text-[10px] font-normal bg-primary/15 text-primary">
                        {selectedInMod} seleccionada{selectedInMod !== 1 ? "s" : ""}
                      </Badge>
                    )}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-3 pt-1 pl-1">
                  <div className="space-y-3 pl-1">
                    {mod.rows.map((row) => {
                      const modelName = row.modelKey.split(".")[1] ?? row.modelKey;
                      const permWithDisplay = row.view ?? row.add ?? row.change ?? row.delete;
                      const resLabel =
                        permWithDisplay?.model_display_name ?? getFriendlyResourceName(modelName);
                      return (
                        <div
                          key={row.modelKey}
                          className="rounded-lg border border-border/50 bg-background/80 p-3 space-y-2.5"
                        >
                          <p className="text-xs font-medium text-foreground/90">{resLabel}</p>
                          <div className="flex flex-wrap gap-2">
                            {(["view", "add", "change", "delete"] as const).map((action) => {
                              const perm = row[action];
                              if (!perm) return null;
                              const checked = selected.has(perm.id);
                              const actionLabel = ACTION_LABELS[action] ?? action;
                              const helpText = getPermissionHelpText(action, resLabel);
                              return (
                                <div
                                  key={perm.id}
                                  className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card shadow-sm px-2.5 py-1.5 hover:border-primary/30 transition-colors"
                                >
                                  <button
                                    type="button"
                                    onClick={() => togglePermission(perm.id)}
                                    className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors ${
                                      checked
                                        ? "bg-primary text-primary-foreground shadow-sm"
                                        : "border border-border bg-muted/50 hover:bg-muted"
                                    }`}
                                    title={actionLabel}
                                    aria-label={`${actionLabel} ${resLabel}`}
                                  >
                                    {checked ? <CheckCircle2 className="h-4 w-4" /> : null}
                                  </button>
                                  <span className="text-xs font-medium">{actionLabel}</span>
                                  {helpText && (
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <button
                                          type="button"
                                          className="flex items-center justify-center h-6 w-6 rounded-md border border-dashed border-primary/40 bg-primary/5 text-primary hover:bg-primary/15 hover:border-primary/60 transition-colors"
                                          aria-label="Clique para ver explicação"
                                          title="Clique para ver explicação"
                                        >
                                          <HelpCircle className="h-3.5 w-3.5" />
                                        </button>
                                      </PopoverTrigger>
                                      <PopoverContent
                                        side="right"
                                        align="start"
                                        className="max-w-sm text-sm leading-relaxed whitespace-pre-line p-4 shadow-lg"
                                      >
                                        {helpText}
                                      </PopoverContent>
                                    </Popover>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
      <div className="pt-2 flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading ? "A guardar..." : initial ? "Guardar alterações" : "Criar papel"}
        </Button>
      </div>
    </form>
  );
}

function SystemSettingsForm({
  initial,
  loading,
  canLock,
  canEdit,
  onSubmit,
}: {
  initial?: ApiSystemSettings;
  loading: boolean;
  canLock: boolean;
  /** Permissão change_systemsettings (ou superuser). */
  canEdit: boolean;
  onSubmit: (payload: Partial<ApiSystemSettings>) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "Microcredit Hub");
  const [logoUrl, setLogoUrl] = useState(initial?.logo_url ?? "");
  const [primaryColor, setPrimaryColor] = useState(initial?.primary_color ?? "#0f766e");
  const [tagline, setTagline] = useState(initial?.tagline ?? "");
  const [loginDescription, setLoginDescription] = useState(initial?.login_description ?? "");
  const [loginBannerColor, setLoginBannerColor] = useState(initial?.login_banner_color ?? "");
  const [loginCardColor, setLoginCardColor] = useState(initial?.login_card_color ?? "");
  const [loginBannerTitle, setLoginBannerTitle] = useState(initial?.login_banner_title ?? "");
  const [loginBannerSubtitle, setLoginBannerSubtitle] = useState(initial?.login_banner_subtitle ?? "");
  const [loginBannerBody, setLoginBannerBody] = useState(initial?.login_banner_body ?? "");
  const [loginBannerTextAlign, setLoginBannerTextAlign] = useState(initial?.login_banner_text_align ?? "left");
  const [loginBannerBlockAlign, setLoginBannerBlockAlign] = useState(initial?.login_banner_block_align ?? "start");
  const [loginBannerVerticalAlign, setLoginBannerVerticalAlign] = useState(
    initial?.login_banner_vertical_align ?? "between",
  );
  const [loginBannerMaxWidth, setLoginBannerMaxWidth] = useState(initial?.login_banner_max_width ?? "100%");
  const [loginBannerPadding, setLoginBannerPadding] = useState(initial?.login_banner_padding ?? "0");
  const [loginTitleFontSize, setLoginTitleFontSize] = useState(initial?.login_title_font_size ?? "");
  const [loginSubtitleFontSize, setLoginSubtitleFontSize] = useState(initial?.login_subtitle_font_size ?? "");
  const [loginBodyFontSize, setLoginBodyFontSize] = useState(initial?.login_body_font_size ?? "");
  const [loginShowFeatureBoxes, setLoginShowFeatureBoxes] = useState(initial?.login_show_feature_boxes !== false);

  useEffect(() => {
    if (!initial) return;
    setName(initial.name ?? "Microcredit Hub");
    setLogoUrl(initial.logo_url ?? "");
    setPrimaryColor(initial.primary_color ?? "#0f766e");
    setTagline(initial.tagline ?? "");
    setLoginDescription(initial.login_description ?? "");
    setLoginBannerColor(initial.login_banner_color ?? "");
    setLoginCardColor(initial.login_card_color ?? "");
    setLoginBannerTitle(initial.login_banner_title ?? "");
    setLoginBannerSubtitle(initial.login_banner_subtitle ?? "");
    setLoginBannerBody(initial.login_banner_body ?? "");
    setLoginBannerTextAlign(initial.login_banner_text_align ?? "left");
    setLoginBannerBlockAlign(initial.login_banner_block_align ?? "start");
    setLoginBannerVerticalAlign(initial.login_banner_vertical_align ?? "between");
    setLoginBannerMaxWidth(initial.login_banner_max_width ?? "100%");
    setLoginBannerPadding(initial.login_banner_padding ?? "0");
    setLoginTitleFontSize(initial.login_title_font_size ?? "");
    setLoginSubtitleFontSize(initial.login_subtitle_font_size ?? "");
    setLoginBodyFontSize(initial.login_body_font_size ?? "");
    setLoginShowFeatureBoxes(initial.login_show_feature_boxes !== false);
  }, [initial?.id, initial?.updated_at]);

  return (
    <form
      className="grid grid-cols-1 lg:grid-cols-3 gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canEdit) return;
        onSubmit({
          name: name.trim(),
          logo_url: logoUrl.trim() || null,
          primary_color: primaryColor.trim(),
          tagline: tagline.trim(),
          login_description: loginDescription.trim() || undefined,
          login_banner_color: loginBannerColor.trim() || undefined,
          login_card_color: loginCardColor.trim() || undefined,
          login_banner_title: loginBannerTitle.trim() || undefined,
          login_banner_subtitle: loginBannerSubtitle.trim() || undefined,
          login_banner_body: loginBannerBody.trim() || undefined,
          login_banner_text_align: loginBannerTextAlign,
          login_banner_block_align: loginBannerBlockAlign,
          login_banner_vertical_align: loginBannerVerticalAlign,
          login_banner_max_width: loginBannerMaxWidth.trim() || "100%",
          login_banner_padding: loginBannerPadding.trim() || "0",
          login_title_font_size: loginTitleFontSize.trim() || undefined,
          login_subtitle_font_size: loginSubtitleFontSize.trim() || undefined,
          login_body_font_size: loginBodyFontSize.trim() || undefined,
          login_show_feature_boxes: loginShowFeatureBoxes,
        });
      }}
    >
      {!canEdit && (
        <p className="lg:col-span-3 text-sm text-muted-foreground rounded-lg border bg-muted/30 px-3 py-2">
          Só pode visualizar estas definições. Peça a permissão <strong>Alterar configuração do sistema</strong> ao administrador.
        </p>
      )}
      <div
        className={`lg:col-span-2 space-y-4 rounded-2xl border bg-card p-6 shadow-sm ${!canEdit ? "pointer-events-none opacity-65" : ""}`}
      >
        <div>
          <Label>Nome do sistema</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Logo (URL)</Label>
            <Input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div>
            <Label>Cor primária</Label>
            <div className="flex items-center gap-2">
              <Input
                type="color"
                className="w-16 h-9 p-1"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
              />
              <Input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#0f766e ou rgba(...)"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-muted/40 p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Painel esquerdo do login (ecrã grande)
          </p>
          <div>
            <Label>Frase de impacto (tagline)</Label>
            <Input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Ex.: Gestão moderna de microcrédito."
            />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea
              value={loginDescription}
              onChange={(e) => setLoginDescription(e.target.value)}
              placeholder="Parágrafo exibido no painel esquerdo. Ex.: Organize clientes, empréstimos, pagamentos..."
              rows={3}
              className="resize-none"
            />
          </div>
          <div>
            <Label>Cor do banner esquerdo</Label>
            <div className="flex items-center gap-2">
              <Input
                type="color"
                className="w-16 h-9 p-1"
                value={loginBannerColor || primaryColor}
                onChange={(e) => setLoginBannerColor(e.target.value)}
              />
              <Input
                type="text"
                value={loginBannerColor}
                onChange={(e) => setLoginBannerColor(e.target.value)}
                placeholder="Vazio = usa cor primária"
              />
            </div>
          </div>
          <p className="text-xs font-semibold text-muted-foreground pt-2">Texto do banner (título, subtítulo, corpo)</p>
          <div>
            <Label>Título do banner</Label>
            <Input
              value={loginBannerTitle}
              onChange={(e) => setLoginBannerTitle(e.target.value)}
              placeholder="Vazio = usa a frase de impacto (tagline) acima"
            />
          </div>
          <div>
            <Label>Subtítulo (opcional)</Label>
            <Input value={loginBannerSubtitle} onChange={(e) => setLoginBannerSubtitle(e.target.value)} />
          </div>
          <div>
            <Label>Corpo / texto principal</Label>
            <Textarea
              value={loginBannerBody}
              onChange={(e) => setLoginBannerBody(e.target.value)}
              placeholder="Vazio = usa «Descrição» acima. Pode usar várias linhas."
              rows={3}
              className="resize-none"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Alinhamento do texto</Label>
              <Select value={loginBannerTextAlign} onValueChange={setLoginBannerTextAlign}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Esquerda</SelectItem>
                  <SelectItem value="center">Centro</SelectItem>
                  <SelectItem value="right">Direita</SelectItem>
                  <SelectItem value="justify">Justificado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Posição horizontal do bloco</Label>
              <Select value={loginBannerBlockAlign} onValueChange={setLoginBannerBlockAlign}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="start">Início (esquerda)</SelectItem>
                  <SelectItem value="center">Centro</SelectItem>
                  <SelectItem value="end">Fim (direita)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Distribuição vertical do painel</Label>
              <Select value={loginBannerVerticalAlign} onValueChange={setLoginBannerVerticalAlign}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="start">Topo</SelectItem>
                  <SelectItem value="center">Centro</SelectItem>
                  <SelectItem value="end">Fundo</SelectItem>
                  <SelectItem value="between">Espaçado (texto + destaques)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Largura máx. do texto</Label>
              <Input
                value={loginBannerMaxWidth}
                onChange={(e) => setLoginBannerMaxWidth(e.target.value)}
                placeholder="100%, 36rem..."
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Padding do bloco de texto</Label>
              <Input
                value={loginBannerPadding}
                onChange={(e) => setLoginBannerPadding(e.target.value)}
                placeholder="0, 1rem, 1rem 2rem..."
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Tamanho fonte título</Label>
              <Input
                value={loginTitleFontSize}
                onChange={(e) => setLoginTitleFontSize(e.target.value)}
                placeholder="Ex.: 1.75rem"
              />
            </div>
            <div>
              <Label>Tamanho fonte subtítulo</Label>
              <Input
                value={loginSubtitleFontSize}
                onChange={(e) => setLoginSubtitleFontSize(e.target.value)}
                placeholder="Ex.: 1rem"
              />
            </div>
            <div>
              <Label>Tamanho fonte corpo</Label>
              <Input
                value={loginBodyFontSize}
                onChange={(e) => setLoginBodyFontSize(e.target.value)}
                placeholder="Ex.: 0.875rem"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="rounded"
              checked={loginShowFeatureBoxes}
              onChange={(e) => setLoginShowFeatureBoxes(e.target.checked)}
            />
            Mostrar caixas de destaques no login (Clientes, Pagamentos, etc.)
          </label>
        </div>

        <div>
          <Label>Cor do cartão de login (formulário à direita)</Label>
          <div className="flex items-center gap-2">
            <Input
              type="color"
              className="w-16 h-9 p-1"
              value={loginCardColor || "#ffffff"}
              onChange={(e) => setLoginCardColor(e.target.value)}
            />
            <Input
              type="text"
              value={loginCardColor}
              onChange={(e) => setLoginCardColor(e.target.value)}
              placeholder="#ffffff ou rgba(...)"
            />
          </div>
        </div>
        {canLock && (
          <div className="mt-2 rounded-xl border bg-muted/40 p-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Estado do sistema
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <input
                  id="lock-system"
                  type="checkbox"
                  className="rounded"
                  checked={initial?.is_locked ?? false}
                  onChange={(e) =>
                    onSubmit({
                      is_locked: e.target.checked,
                      locked_message:
                        initial?.locked_message ||
                        "Sistema temporariamente indisponível. Fale com o responsável pelo sistema.",
                    })
                  }
                />
                <Label htmlFor="lock-system" className="cursor-pointer text-sm">
                  Bloquear acesso para todos excepto superuser
                </Label>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Apenas o superuser pode alterar este bloqueio. Útil para manutenção, migrações ou quando o cliente não
              está autorizado a usar o sistema.
            </p>
          </div>
        )}
        {canEdit && (
          <div className="pt-2 flex justify-end">
            <Button type="submit" disabled={loading}>
              {loading ? "A guardar..." : "Guardar configurações"}
            </Button>
          </div>
        )}
      </div>
      <div className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
        <h3 className="font-semibold text-lg mb-1">Pré-visualização</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Uma visão rápida de como estas configurações representam o sistema.
        </p>
        <div
          className="rounded-xl border overflow-hidden text-white p-4 min-h-[120px]"
          style={{
            background: `linear-gradient(135deg, ${loginBannerColor || primaryColor}, ${loginBannerColor || primaryColor}CC)`,
            textAlign: (loginBannerTextAlign as "left" | "center" | "right" | "justify") || "left",
          }}
        >
          <p
            className="font-semibold text-sm"
            style={loginTitleFontSize.trim() ? { fontSize: loginTitleFontSize.trim() } : undefined}
          >
            {loginBannerTitleText(
              {
                login_banner_title: loginBannerTitle || undefined,
                tagline: tagline || undefined,
              } as ApiSystemSettings,
              tagline || "Gestão moderna de microcrédito.",
            )}
          </p>
          {loginBannerSubtitleText({
            login_banner_subtitle: loginBannerSubtitle || undefined,
          } as ApiSystemSettings) ? (
            <p
              className="opacity-95 mt-1 text-xs"
              style={loginSubtitleFontSize.trim() ? { fontSize: loginSubtitleFontSize.trim() } : undefined}
            >
              {loginBannerSubtitleText({ login_banner_subtitle: loginBannerSubtitle || undefined } as ApiSystemSettings)}
            </p>
          ) : null}
          <p
            className="text-xs opacity-90 mt-1 line-clamp-4 whitespace-pre-wrap"
            style={loginBodyFontSize.trim() ? { fontSize: loginBodyFontSize.trim() } : undefined}
          >
            {loginBannerBodyText(
              {
                login_banner_body: loginBannerBody || undefined,
                login_description: loginDescription || undefined,
              } as ApiSystemSettings,
              "Organize clientes, empréstimos, pagamentos...",
            )}
          </p>
        </div>
        <div className="rounded-xl border bg-muted/50 p-4 flex flex-col items-center gap-3">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo preview"
              className="h-12 w-12 rounded-full object-cover border"
            />
          ) : (
            <div
              className="h-12 w-12 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: primaryColor || "#0f766e" }}
            >
              {name
                .split(" ")
                .map((p) => p[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
          )}
          <div className="text-center">
            <p className="font-semibold" style={{ color: primaryColor || "#0f766e" }}>
              {name || "Microcredit Hub"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {tagline || "Microcrédito inteligente e humano."}
            </p>
          </div>
        </div>
      </div>
    </form>
  );
}

function groupPermissionsByModule(perms: ApiPermission[]) {
  const byModule: Record<string, { key: string; label: string; items: ApiPermission[] }> = {};
  for (const p of perms) {
    const key = p.app_label;
    if (!byModule[key]) {
      byModule[key] = { key, label: moduleLabel(key), items: [] };
    }
    byModule[key].items.push(p);
  }
  return Object.values(byModule).sort((a, b) => a.label.localeCompare(b.label));
}

type ModuleMatrixRow = {
  modelKey: string;
  modelLabel: string;
  view?: ApiPermission;
  add?: ApiPermission;
  change?: ApiPermission;
  delete?: ApiPermission;
};

type ModelPerms = { view?: ApiPermission; add?: ApiPermission; change?: ApiPermission; delete?: ApiPermission };

function buildModuleMatrix(perms: ApiPermission[]) {
  const byModule: Record<string, { key: string; label: string; byModel: Record<string, ModelPerms> }> = {};
  for (const p of perms) {
    const key = p.app_label;
    if (!byModule[key]) {
      byModule[key] = { key, label: moduleLabel(key), byModel: {} };
    }
    let action: "view" | "add" | "change" | "delete" | undefined;
    if (p.codename.startsWith("view_")) action = "view";
    else if (p.codename.startsWith("add_")) action = "add";
    else if (p.codename.startsWith("change_")) action = "change";
    else if (p.codename.startsWith("delete_")) action = "delete";
    if (action) {
      const modelKey = p.model;
      if (!byModule[key].byModel[modelKey]) byModule[key].byModel[modelKey] = {};
      byModule[key].byModel[modelKey][action] = p;
    }
  }
  return Object.values(byModule)
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((mod) => ({
      key: mod.key,
      label: mod.label,
      rows: Object.entries(mod.byModel)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([modelKey, acts]) => ({
          modelKey: `${mod.key}.${modelKey}`,
          modelLabel: modelLabel(modelKey),
          view: acts.view,
          add: acts.add,
          change: acts.change,
          delete: acts.delete,
        })) as ModuleMatrixRow[],
    }))
    .filter((mod) => mod.rows.length > 0);
}

function modelLabel(model: string): string {
  return getFriendlyResourceName(model);
}

function moduleLabel(appLabel: string): string {
  const map: Record<string, string> = {
    accounts: "Utilizadores & Acesso",
    clients: "Clientes",
    loans: "Empréstimos",
    hr: "Recursos Humanos",
    accounting: "Contabilidade",
    calendario: "Calendário",
    reports: "Relatórios",
    dashboard: "Dashboard",
    auth: "Autenticação",
    admin: "Administração Django",
  };
  return map[appLabel] ?? appLabel;
}

function friendlyAction(codename: string): string {
  if (codename.startsWith("add_")) return "Criar";
  if (codename.startsWith("change_")) return "Editar";
  if (codename.startsWith("delete_")) return "Apagar";
  if (codename.startsWith("view_")) return "Ver";
  return "Outro";
}

function friendlyResource(p: ApiPermission): string {
  const modelMap: Record<string, string> = {
    client: "cliente",
    loan: "empréstimo",
    payment: "pagamento",
    employee: "colaborador",
    vacation: "férias",
    attendancerecord: "registo de ponto",
    salaryslip: "folha salarial",
    transaction: "transacção",
    tax: "imposto",
    role: "papel",
    user: "utilizador",
  };
  const resource = modelMap[p.model] ?? p.model;
  return `${friendlyAction(p.codename)} ${resource}`;
}

