# Modelo de Permissões

## Estrutura: Módulos → Operações

O sistema usa permissões em dois níveis:

### 1. **Módulos** (o que o utilizador pode ver/acessar)

Cada módulo corresponde a uma área da aplicação. Ver um módulo no menu lateral exige permissão `view_*` em pelo menos um recurso desse módulo.

| Módulo | Permissão de acesso | Descrição |
|--------|---------------------|-----------|
| Clientes | `view_client` | Ver lista de clientes |
| Empréstimos | `view_loan` | Ver empréstimos |
| Pagamentos | `view_payment` | Ver pagamentos |
| Calendário | `view_calendarevent` | Ver eventos |
| Recursos Humanos | `view_employee` | Ver colaboradores |
| Contabilidade | `view_transaction` | Ver transacções |
| Relatórios | (qualquer autenticado) | Ver relatórios |
| Utilizadores & Acesso | `is_staff` | Admin |
| Histórico (Auditoria) | `is_staff` | Admin |

### 2. **Operações** (o que pode fazer dentro do módulo)

Dentro de cada módulo, o utilizador pode ter:

| Operação | Código Django | Significado |
|----------|---------------|-------------|
| **Ver** | `view_<model>` | Listar e ver detalhes |
| **Criar** | `add_<model>` | Adicionar novos registos |
| **Editar** | `change_<model>` | Alterar registos existentes |
| **Apagar** | `delete_<model>` | Eliminar registos |

Exemplo para o módulo **Clientes**:
- `view_client` — Ver clientes
- `add_client` — Criar cliente
- `change_client` — Editar cliente
- `delete_client` — Apagar cliente

### Hierarquia sugerida

1. Sem `view_*` → Não vê o módulo no menu e não acede aos endpoints.
2. Com `view_*` mas sem `add`/`change`/`delete` → Vê dados, mas botões de criar/editar/apagar ficam ocultos.
3. Superuser ou `*` → Acesso total a tudo.

### Endpoints públicos (qualquer autenticado)

- `GET /api/auth/settings/` — Configurações de marca (nome, logo, cores)
- `GET /api/auth/me/` — Dados do utilizador e permissões

### Endpoints restritos

Todos os demais usam `DjangoModelPermissions`: exigem a permissão correspondente ao método (GET → view, POST → add, etc.).
