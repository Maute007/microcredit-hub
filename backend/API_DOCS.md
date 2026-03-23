# MicroCredit Hub – Documentação da API

**Base URL (dev):** `http://localhost:8000/api/`  
**Autenticação:** JWT (cookies HttpOnly ou header `Authorization: Bearer <access_token>`)

---

## Índice

1. [Auth (Contas)](#1-auth-contas)
2. [Users / Profiles / Roles](#2-users--profiles--roles)
3. [Clients (Clientes)](#3-clients-clientes)
4. [Loans (Empréstimos)](#4-loans-empréstimos)
5. [Payments (Pagamentos)](#5-payments-pagamentos)
6. [HR (Recursos Humanos)](#6-hr-recursos-humanos)
7. [Accounting (Contabilidade)](#7-accounting-contabilidade)
8. [Calendar / Reports / Dashboard](#8-calendar--reports--dashboard)

---

## 1. Auth (Contas)

**Prefixo:** `/api/auth/`

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/login/` | Login (identifier + password) |
| POST | `/refresh/` | Renovar access token |
| POST | `/logout/` | Logout (blacklist + remove cookies) |
| GET | `/me/` | Utilizador atual (profile, role, permissions) |
| GET | `/permissions/` | Lista todas as permissões (admin) |

### POST `/api/auth/login/`

**Body (JSON):**
```json
{
  "identifier": "user@email.com",
  "password": "senha123"
}
```
- `identifier`: username ou email

**Resposta 200:** Tokens em cookies (access_token, refresh_token). Body: `{"detail": "..."}`

### POST `/api/auth/refresh/`

Lê `refresh_token` do cookie. **Resposta 200:** novos tokens em cookies.

### POST `/api/auth/logout/`

Requer autenticação. Coloca refresh token em blacklist e remove cookies.

### GET `/api/auth/me/`

Requer autenticação. Retorna utilizador com `profile`, `role`, `permissions`.

### Papéis (roles) e limpeza da base

Os **papéis** são o modelo `Role` (não o `Group` do Django). As permissões efectivas vêm de `role.permissions` + `user_permissions`; superusers recebem `["*"]` na API.

- **Configuração:** `backend/accounts/config/role_permissions.json` — edite `permissions_mode` (`all` / `none` / `list`) e o array `permissions` (codenames, ex.: `view_client`).
- **Sincronizar papéis sem apagar dados:** `python manage.py seed_roles`
- **Apagar todos os dados + histórico + repovoar permissões e papéis:**  
  `python manage.py reset_environment --confirm [--demo-users --password=...] [--admin-password=...]`  
  (executa `flush`, `migrate` para recriar `auth_permission`, depois `seed_roles` e o superutilizador bootstrap).

- **Arranque automático (migrações + papéis + `Maute007` ou `BOOTSTRAP_SUPERUSER_*`):**  
  `python manage.py bootstrap_system`  
  (ou `npm run bootstrap:backend` na raiz do repo). Com `DEBUG=True` e sem `BOOTSTRAP_SUPERUSER_PASSWORD` no `.env`, usa palavra-passe de desenvolvimento definida em `settings.py`.

Documentação: `backend/accounts/config/README.md`.

---

## 2. Users / Profiles / Roles

**Prefixo:** `/api/`

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/users/` | Lista utilizadores (admin) |
| POST | `/users/` | Criar utilizador (admin) |
| GET | `/users/<id>/` | Detalhe utilizador (admin) |
| PUT/PATCH | `/users/<id>/` | Atualizar utilizador (admin) |
| DELETE | `/users/<id>/` | Remover utilizador (admin) |
| GET | `/profiles/` | Lista perfis (admin) |
| GET/POST | `/profiles/<id>/` | CRUD perfil (admin) |
| GET | `/roles/` | Lista papéis (admin) |
| GET/POST | `/roles/<id>/` | CRUD papel (admin) |

### Users

- **Query params:** `?search=`, `?is_active=`, `?role=`, `?ordering=`
- **Campos:** id, username, email, first_name, last_name, is_active, role, profile

### Roles

- **Campos:** id, code, name, description, is_system, permissions
- **Write:** `permissions_ids` (lista de IDs de Permission)

---

## 3. Clients (Clientes)

**Prefixo:** `/api/clients/`

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/clients/` | Lista clientes (paginado) |
| POST | `/clients/` | Criar cliente |
| GET | `/clients/<id>/` | Detalhe cliente |
| PUT | `/clients/<id>/` | Atualizar cliente |
| PATCH | `/clients/<id>/` | Atualização parcial |
| DELETE | `/clients/<id>/` | Remover cliente |
| GET | `/clients/<id>/loans/` | Empréstimos do cliente |

### GET `/api/clients/`

**Query params:**

| Parâmetro | Descrição |
|-----------|-----------|
| `search` | Busca em nome, email, documento, telefone, morada, profissão |
| `status` | `ativo` \| `inativo` |
| `city` | Filtrar por cidade (parcial) |
| `ordering` | `id`, `name`, `email`, `city`, `status`, `created_at` (prefixo `-` para descendente) |
| `page` | Página |
| `page_size` | Itens por página (máx. 100, default 20) |

**Resposta (lista paginada):**
```json
{
  "count": 10,
  "next": "http://.../api/clients/?page=2",
  "previous": null,
  "results": [
    {
      "id": 1,
      "name": "Maria da Graça Silva",
      "email": "maria@email.com",
      "phone": "+258 84 123 4567",
      "document": "010203040A",
      "address": "Av. Eduardo Mondlane, 100",
      "city": "Maputo",
      "occupation": "Comerciante",
      "status": "ativo",
      "created_at": "2024-01-15T00:00:00Z",
      "total_loans": 3
    }
  ]
}
```

### POST `/api/clients/`

**Body (JSON):**
```json
{
  "name": "Maria Silva",
  "email": "maria@email.com",
  "phone": "+258 84 123 4567",
  "document": "010203040A",
  "address": "Av. Eduardo Mondlane, 100",
  "city": "Maputo",
  "occupation": "Comerciante",
  "status": "ativo"
}
```
- `name` obrigatório
- `document` e `email` únicos (se informados)

---

## 4. Loans (Empréstimos)

**Prefixo:** `/api/loans/`

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/loans/` | Lista empréstimos (paginado) |
| POST | `/loans/` | Criar empréstimo |
| GET | `/loans/<id>/` | Detalhe empréstimo |
| PUT | `/loans/<id>/` | Atualizar empréstimo |
| PATCH | `/loans/<id>/` | Atualização parcial |
| DELETE | `/loans/<id>/` | Remover empréstimo |
| GET | `/loans/<id>/payments/` | Pagamentos do empréstimo |
| GET | `/loans/<id>/amortization/` | Tabela de amortização |

### GET `/api/loans/`

**Query params:**

| Parâmetro | Descrição |
|-----------|-----------|
| `status` | `ativo` \| `pago` \| `atrasado` \| `pendente` |
| `client` | ID do cliente |
| `search` | Busca por nome ou documento do cliente |
| `ordering` | `id`, `amount`, `total_amount`, `start_date`, `end_date`, `status` (prefixo `-`) |
| `page`, `page_size` | Paginação (default 20) |

**Resposta (result):**
```json
{
  "id": 1,
  "client": 1,
  "client_name": "Maria Silva",
  "amount": "50000.00",
  "interest_rate": "5.00",
  "term": 12,
  "monthly_payment": "4583.33",
  "total_amount": "55000.00",
  "status": "ativo",
  "start_date": "2024-06-01",
  "end_date": "2025-06-01",
  "paid_amount": 27500.0,
  "remaining_balance": 27500.0,
  "paid_installments": 6
}
```

### POST `/api/loans/`

**Body (JSON):**
```json
{
  "client": 1,
  "amount": "50000.00",
  "interest_rate": "5.00",
  "term": 12,
  "start_date": "2024-06-01",
  "end_date": "2025-06-01",
  "status": "pendente"
}
```
- `monthly_payment` e `total_amount` são calculados automaticamente se omitidos

### GET `/api/loans/<id>/amortization/`

Retorna tabela de amortização:
```json
[
  {
    "installment": 1,
    "date": "2024-07-01",
    "payment": 4583.33,
    "principal": 4166.67,
    "interest": 416.67,
    "balance": 50416.67,
    "status": "pago"
  }
]
```
- `status`: `pago` | `pendente` | `atrasado`

---

## 5. Payments (Pagamentos)

**Prefixo:** `/api/payments/`

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/payments/` | Lista pagamentos (paginado) |
| POST | `/payments/` | Registrar pagamento |
| GET | `/payments/<id>/` | Detalhe pagamento |
| PUT/PATCH | `/payments/<id>/` | Atualizar pagamento |
| DELETE | `/payments/<id>/` | Remover pagamento |

### GET `/api/payments/`

**Query params:**

| Parâmetro | Descrição |
|-----------|-----------|
| `status` | `pago` \| `pendente` \| `atrasado` |
| `loan` | ID do empréstimo |
| `page`, `page_size` | Paginação (default 30) |

### POST `/api/payments/`

**Body (JSON):**
```json
{
  "loan": 1,
  "amount": "4583.33",
  "date": "2025-03-01",
  "status": "pago",
  "method": "transferencia",
  "installment_number": 7,
  "receipt": "REC-001"
}
```
- `method`: `transferencia`, `m_pesa`, `deposito`, `dinheiro`, `outro`
- `status`: `pago`, `pendente`, `atrasado`

---

## 6. HR (Recursos Humanos)

**Prefixo:** `/api/`

Registos manuais, sem integrações. Inclui simulações de folha salarial.

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET/POST | `/employees/` | Lista / criar colaborador |
| GET/PUT/PATCH/DELETE | `/employees/<id>/` | CRUD colaborador |
| GET/POST | `/vacations/` | Lista / criar férias |
| GET/PUT/PATCH/DELETE | `/vacations/<id>/` | CRUD férias |
| GET/POST | `/attendance/` | Lista / criar registo de ponto |
| GET/PUT/PATCH/DELETE | `/attendance/<id>/` | CRUD ponto |
| GET/POST | `/salary-slips/` | Lista / criar recibo de vencimento |
| GET/PUT/PATCH/DELETE | `/salary-slips/<id>/` | CRUD recibo |
| **POST** | **`/salary-slips/simulate/`** | **Simular recibo (não grava)** |
| **POST** | **`/salary-slips/simulate-bulk/`** | **Simular folha salarial (todos ativos)** |

### Employees

**Query params:** `?status=ativo|inativo`, `?department=`, `?search=`, `?ordering=`, `?page=`, `?page_size=`

**Campos:** id, name, role, department, base_salary, phone, email, status, hire_date, color

### Vacations

**Query params:** `?employee=<id>`, `?page=`, `?page_size=`

**Campos:** id, employee, employee_name, start_date, end_date, color  
**Validação:** end_date >= start_date

### Attendance

**Query params:** `?employee=`, `?date_from=`, `?date_to=`, `?status=`, `?page=`, `?page_size=`

**Campos:** id, employee, employee_name, date, check_in, check_out, status, hours_worked  
**status:** `presente`, `ausente`, `atrasado`, `ferias`, `justificado`  
**Validação:** um registo por (employee, date) por dia

### Salary Slips

**Query params:** `?employee=`, `?month=YYYY-MM`, `?page=`, `?page_size=`

**Campos:** id, employee, employee_name, role, month, base_salary, overtime, bonus, gross_salary, inss, irps, other_deductions, total_deductions, net_salary

### POST `/api/salary-slips/simulate/`

Simula recibo sem gravar. Taxas: INSS 3%, IRPS 10%, outras 1%. Horas extras padrão 5%.

**Body:**
```json
{
  "employee": 1,
  "month": "2025-03",
  "overtime": 2000,
  "bonus": 0
}
```
**Resposta:** Recibo calculado (base_salary, overtime, gross_salary, inss, irps, net_salary, etc.)

### POST `/api/salary-slips/simulate-bulk/`

Simula folha de todos os colaboradores ativos para um mês.

**Body:** `{"month": "2025-03"}`  
**Resposta:** `{ "month", "slips": [...], "summary": { "total_employees", "total_gross_salary", "total_net_salary", "total_deductions" } }`

---

## 7. Accounting (Contabilidade)

**Prefixo:** `/api/transactions/`

Registos manuais, sem integrações. Inclui saldo e simulação.

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/transactions/` | Lista transações (paginado) |
| POST | `/transactions/` | Criar transação |
| GET | `/transactions/<id>/` | Detalhe transação |
| PUT/PATCH | `/transactions/<id>/` | Atualizar transação |
| DELETE | `/transactions/<id>/` | Remover transação |
| **GET** | **`/transactions/balance/`** | **Saldo e totais por período** |
| **GET** | **`/transactions/categories/`** | **Lista categorias sugeridas + usadas** |
| **POST** | **`/transactions/simulate/`** | **Simular impacto de transação no saldo** |

### GET `/api/transactions/`

**Query params:** `?type=entrada|saida`, `?category=`, `?date_from=`, `?date_to=`, `?search=`, `?ordering=`, `?page=`, `?page_size=`

**Campos:** id, type, category, description, amount, date, responsible, responsible_name, loan  
**Create:** `responsible` omite-se → assume utilizador autenticado

### GET `/api/transactions/balance/`

**Query params:** `?date_from=YYYY-MM-DD`, `?date_to=YYYY-MM-DD`

**Resposta:**
```json
{
  "date_from": "2025-01-01",
  "date_to": "2025-03-31",
  "total_entradas": 125000.50,
  "total_saidas": 350000.00,
  "saldo": -224999.50
}
```

### GET `/api/transactions/categories/`

Retorna categorias comuns + categorias já usadas em transações (para dropdown).

**Resposta:** `{"categories": ["Pagamento Empréstimo", "Salários", ...]}`

### POST `/api/transactions/simulate/`

Simula o impacto de uma transação no saldo sem gravar.

**Body:**
```json
{
  "type": "entrada",
  "amount": 5000,
  "date": "2025-03-15"
}
```
**Resposta:** `{ "simulated": {...}, "saldo_projetado", "total_entradas_projetado", "total_saidas_projetado" }`

---

## 8. Calendar / Reports / Dashboard

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/calendar/events/` | Eventos (placeholder) |
| GET | `/api/reports/` | Lista relatórios (placeholder) |
| GET | `/api/dashboard/summary/` | Resumo/KPIs (placeholder) |

Estes endpoints retornam respostas vazias/placeholders até implementação futura.

---

## Autenticação

Todas as rotas (exceto login e refresh) requerem autenticação JWT:

- **Cookies:** `access_token`, `refresh_token` (HttpOnly)
- **Header:** `Authorization: Bearer <access_token>`
- **CORS:** `credentials: 'include'` nas chamadas do frontend

---

## Erros comuns

| Código | Significado |
|--------|-------------|
| 401 | Não autenticado ou token expirado |
| 403 | Sem permissão |
| 404 | Recurso não encontrado |
| 400 | Dados inválidos (validação) |
