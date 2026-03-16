# Testes do Backend

## O que são estes testes?

Testes automatizados que verificam se a API funciona correctamente: login, listagem de clientes, relatórios, etc. Cada teste faz um pedido HTTP simulado e verifica a resposta.

## Para que servem?

- **Detectar regressões:** Alterou código e quer saber se quebrou algo? Execute os testes.
- **Segurança:** Garantir que credenciais inválidas não entram e que endpoints protegidos exigem autenticação.
- **Documentação viva:** Os testes mostram como a API deve ser usada.

## Quando executar?

1. **Antes de fazer commit** — `pytest tests/ -v`
2. **Depois de alterar auth, clients, reports** — testes relacionados
3. **Em CI/CD** — para correcção automática antes de deploy

## Comandos

Na pasta `backend`:

```bash
# Todos os testes (verbose)
make test
# ou
pytest tests/ -v

# Com cobertura de código
make test-cov
# ou
pytest tests/ -v --cov=. --cov-report=term-missing

# Apenas um ficheiro
pytest tests/test_auth.py -v

# Apenas um teste
pytest tests/test_auth.py::TestAuth::test_login_with_username -v
```

## Estrutura

| Ficheiro | O que testa |
|----------|-------------|
| `test_auth.py` | Login (username, email, senha errada), endpoints protegidos |
| `test_clients_api.py` | Listagem e criação de clientes |
| `test_reports.py` | Listagem de relatórios disponíveis |

## Fixtures (conftest.py)

- `api_client` — Cliente HTTP para testes
- `user` — Utilizador normal (testuser)
- `superuser` — Admin (usado em testes autenticados)
- `authenticated_client` — Cliente já autenticado
- `client_instance` — Um cliente de exemplo na base de dados
