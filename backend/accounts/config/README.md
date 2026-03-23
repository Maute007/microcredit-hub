# Papéis e permissões (parametrização)

O ficheiro **`role_permissions.json`** define os **papéis** (`Role` na app `accounts`) e as permissões Django associadas.

## Modos de permissões

| `permissions_mode` | Efeito |
|--------------------|--------|
| `all` | Todas as permissões existentes na base (após `migrate`). |
| `none` | Nenhuma permissão explícita (útil para papéis de sistema). |
| `list` | Lista no array `permissions` com **codenames** (ex.: `view_client`), como no frontend. |

## Comandos

```bash
# Só sincronizar papéis (sem apagar dados)
python manage.py seed_roles

# Apagar TODA a base e voltar a criar papéis (+ opcional demo + admin)
python manage.py reset_environment --confirm --demo-users --password=SenhaSegura123 \
  --admin-password=SenhaAdmin123
```

Depois de `reset_environment`, volte a configurar `SystemSettings` no admin se necessário (o comando chama `SystemSettings.get_solo()`).

## Papéis incluídos por defeito

- **gerente** / **rh** — `permissions_mode: all`
- **gestor_credito** — só clientes (`view/add/change/delete_client`)
- **assistente_admin** — conjunto administrativo (clientes, ver empréstimos/categorias, pagamentos, calendário, transacções, impostos, colaboradores, garantias)

Ajuste o array `permissions` de **assistente_admin** ou **gestor_credito** conforme a sua operação.
