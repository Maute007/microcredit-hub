"""Seed completo de dados demo para o microcredit-hub.

Cria 4 colaboradores (com utilizadores), categorias de empréstimo, clientes,
empréstimos, pagamentos, eventos de calendário e registos de RH. Cada registo
fica atribuído a um dos 4 colaboradores via `_history_user` (simple-history),
de forma que a auditoria mostre quem criou.

Uso:
    python manage.py seed_demo_full

Idempotente: pode ser executado várias vezes — apaga registos demo anteriores
(identificados por um código de email/document) antes de recriar.
"""

import random
from datetime import date, datetime, timedelta
from decimal import Decimal

from django.contrib.auth.models import Permission
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from accounts.models import Role, User
from calendario.models import CalendarEvent
from clients.models import Client
from hr.models import AttendanceRecord, Employee, Vacation
from loans.models import Loan, LoanCategory, Payment


DEMO_TAG = "demo.makira.mz"  # marcador (subdomínio) para limpar dados de execuções anteriores
DEMO_TAG_LEGACY = "demo@makira.mz"  # formato anterior (email duplo @, agora corrigido)


# ---------------------------------------------------------------------------
# Dados base — colaboradores fixos para demo
# ---------------------------------------------------------------------------
EMPLOYEES_SEED = [
    {
        "username": "joana",
        "email": "joana.macamo@demo.makira.mz",
        "first_name": "Joana",
        "last_name": "Macamo",
        "name": "Joana Macamo",
        "role": "Gestora de Crédito",
        "department": "Crédito",
        "phone": "+258 84 111 0001",
        "base_salary": "65000",
        "color": "#3b82f6",
    },
    {
        "username": "pedro",
        "email": "pedro.mahache@demo.makira.mz",
        "first_name": "Pedro",
        "last_name": "Mahache",
        "name": "Pedro Mahache",
        "role": "Oficial de Cobrança",
        "department": "Cobrança",
        "phone": "+258 84 111 0002",
        "base_salary": "48000",
        "color": "#10b981",
    },
    {
        "username": "sara",
        "email": "sara.mondlane@demo.makira.mz",
        "first_name": "Sara",
        "last_name": "Mondlane",
        "name": "Sara Mondlane",
        "role": "Atendimento ao Cliente",
        "department": "Operações",
        "phone": "+258 84 111 0003",
        "base_salary": "40000",
        "color": "#f59e0b",
    },
    {
        "username": "tomas",
        "email": "tomas.sitoe@demo.makira.mz",
        "first_name": "Tomás",
        "last_name": "Sitoé",
        "name": "Tomás Sitoé",
        "role": "Recursos Humanos",
        "department": "Administração",
        "phone": "+258 84 111 0004",
        "base_salary": "55000",
        "color": "#8b5cf6",
    },
]


# ---------------------------------------------------------------------------
# Categorias de empréstimo
# ---------------------------------------------------------------------------
CATEGORIES_SEED = [
    {
        "code": "DEMO-MENSAL30",
        "name": "Mensal 30 dias",
        "description": "Empréstimo padrão com juros mensais — produto principal.",
        "frequency_days": 30,
        "min_term_days": 30,
        "max_term_days": 180,
        "min_installments": 1,
        "max_installments": 6,
        "default_interest_rate": "5.00",
        "default_term_months": 3,
        "min_amount": "5000",
        "max_amount": "150000",
        "late_interest_rate": "2.00",
        "max_late_interest_months": 12,
        "collateral_grace_days": 30,
        "require_interest_paid_to_keep_collateral": True,
    },
    {
        "code": "DEMO-QUINZ15",
        "name": "Quinzenal 15 dias",
        "description": "Curto prazo, juros a cada quinzena. Para retalho de bairro.",
        "frequency_days": 15,
        "min_term_days": 15,
        "max_term_days": 90,
        "min_installments": 1,
        "max_installments": 6,
        "default_interest_rate": "3.00",
        "default_term_months": 1,
        "min_amount": "2000",
        "max_amount": "50000",
        "late_interest_rate": "2.50",
        "max_late_interest_months": 6,
        "collateral_grace_days": 15,
        "require_interest_paid_to_keep_collateral": True,
    },
    {
        "code": "DEMO-TRIM90",
        "name": "Trimestral 90 dias",
        "description": "Para empréstimos maiores com pagamento trimestral.",
        "frequency_days": 90,
        "min_term_days": 90,
        "max_term_days": 365,
        "min_installments": 1,
        "max_installments": 4,
        "default_interest_rate": "12.00",
        "default_term_months": 6,
        "min_amount": "50000",
        "max_amount": "500000",
        "late_interest_rate": "3.00",
        "max_late_interest_months": 12,
        "collateral_grace_days": 60,
        "require_interest_paid_to_keep_collateral": True,
    },
    {
        "code": "DEMO-COMERCIO",
        "name": "Comércio Curto",
        "description": "Capital de giro para comerciantes (15-60 dias).",
        "frequency_days": 30,
        "min_term_days": 15,
        "max_term_days": 60,
        "min_installments": 1,
        "max_installments": 2,
        "default_interest_rate": "4.50",
        "default_term_months": 1,
        "min_amount": "10000",
        "max_amount": "100000",
        "late_interest_rate": "2.50",
        "max_late_interest_months": 6,
        "collateral_grace_days": 20,
        "require_interest_paid_to_keep_collateral": False,
    },
    {
        "code": "DEMO-MICROEMP",
        "name": "Microempresa",
        "description": "Linha para pequenas empresas registadas; juros médios e prazo flexível.",
        "frequency_days": 30,
        "min_term_days": 60,
        "max_term_days": 365,
        "min_installments": 2,
        "max_installments": 12,
        "default_interest_rate": "8.00",
        "default_term_months": 6,
        "min_amount": "20000",
        "max_amount": "300000",
        "late_interest_rate": "2.00",
        "max_late_interest_months": 12,
        "collateral_grace_days": 45,
        "require_interest_paid_to_keep_collateral": True,
    },
]


CLIENTS_SEED = [
    # name, gender, occupation, city, sector, phone, email_prefix, doc, address
    ("Anita Cuamba", "F", "Vendedora de capulanas", "Maputo", "comercio", "+258 82 300 0011", "anita.cuamba", "1100020A", "Av. 24 de Julho, 1234"),
    ("Bonifácio Tembe", "M", "Mecânico", "Matola", "servicos", "+258 84 300 0012", "bonifacio.tembe", "1100021B", "Bairro Liberdade, R.7"),
    ("Carmen Nhampossa", "F", "Costureira", "Maputo", "industria", "+258 86 300 0013", "carmen.nhampossa", "1100022C", "Bairro Polana Caniço"),
    ("Dércio Macuvele", "M", "Pedreiro", "Beira", "construcao", "+258 82 300 0014", "dercio.macuvele", "1100023D", "Bairro Munhava"),
    ("Elisa Manjate", "F", "Cabeleireira", "Matola", "servicos", "+258 84 300 0015", "elisa.manjate", "1100024E", "Bairro Tchumene"),
    ("Fernando Banze", "M", "Vendedor de frutas", "Maputo", "comercio", "+258 86 300 0016", "fernando.banze", "1100025F", "Mercado Janeta"),
    ("Glória Mucavele", "F", "Pequena agricultora", "Manhiça", "agricultura", "+258 82 300 0017", "gloria.mucavele", "1100026G", "Aldeia 3 de Fevereiro"),
    ("Hélio Sitoé", "M", "Motorista de chapa", "Maputo", "servicos", "+258 84 300 0018", "helio.sitoe", "1100027H", "Bairro George Dimitrov"),
    ("Inês Cossa", "F", "Vendedora informal", "Matola", "comercio", "+258 86 300 0019", "ines.cossa", "1100028I", "Mercado Fajardo"),
    ("João Mavume", "M", "Carpinteiro", "Beira", "industria", "+258 82 300 0020", "joao.mavume", "1100029J", "Bairro Manga"),
    ("Lúcia Bila", "F", "Lojista", "Maputo", "comercio", "+258 84 300 0021", "lucia.bila", "1100030K", "Av. Eduardo Mondlane"),
    ("Manuel Chitsondzo", "M", "Pedreiro autónomo", "Nampula", "construcao", "+258 86 300 0022", "manuel.chitsondzo", "1100031L", "Bairro Muatala"),
    ("Natália Mahumane", "F", "Padeira", "Maputo", "industria", "+258 82 300 0023", "natalia.mahumane", "1100032M", "Bairro Mafalala"),
    ("Olívio Tembe", "M", "Eletricista", "Matola", "servicos", "+258 84 300 0024", "olivio.tembe", "1100033N", "Bairro Tsalala"),
    ("Patrícia Mavie", "F", "Restaurante familiar", "Beira", "servicos", "+258 86 300 0025", "patricia.mavie", "1100034O", "Praça do Município"),
    ("Quitéria Massango", "F", "Vendedora de peixe", "Maxixe", "comercio", "+258 82 300 0026", "quiteria.massango", "1100035P", "Mercado Central"),
    ("Rui Macuácua", "M", "Apicultor", "Inhambane", "agricultura", "+258 84 300 0027", "rui.macuacua", "1100036Q", "Comunidade Cumbana"),
    ("Selma Nhantumbo", "F", "Boutique online", "Maputo", "comercio", "+258 86 300 0028", "selma.nhantumbo", "1100037R", "Av. Julius Nyerere"),
    ("Téo Mabunda", "M", "Mestre de obras", "Matola", "construcao", "+258 82 300 0029", "teo.mabunda", "1100038S", "Bairro Ndlavela"),
    ("Vitória Pelembe", "F", "Doceira", "Maputo", "industria", "+258 84 300 0030", "vitoria.pelembe", "1100039T", "Bairro Chamanculo"),
    ("Wilson Chongo", "M", "Mecatrónico", "Beira", "servicos", "+258 86 300 0031", "wilson.chongo", "1100040U", "Bairro Estoril"),
    ("Xilique Mahaule", "F", "Tecedora", "Pemba", "industria", "+258 82 300 0032", "xilique.mahaule", "1100041V", "Bairro Cariacó"),
    ("Yara Cumbe", "F", "Vendedora de ovos", "Maputo", "agricultura", "+258 84 300 0033", "yara.cumbe", "1100042W", "Bairro Maxaquene"),
    ("Zacarias Nhanombe", "M", "Mototaxista", "Matola", "servicos", "+258 86 300 0034", "zacarias.nhanombe", "1100043X", "Bairro Boquisso"),
    ("Alberto Cossa", "M", "Pequeno comerciante", "Inhambane", "comercio", "+258 82 300 0035", "alberto.cossa", "1100044Y", "Bairro Salela"),
]


def _set_history_user(obj, user):
    """Anexa o autor para o simple-history capturar como `history_user`."""
    obj._history_user = user


class Command(BaseCommand):
    help = "Popula a base de dados com dados demo realistas (4 colaboradores + ~50 registos)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--keep-existing",
            action="store_true",
            help="Não apagar dados de execuções demo anteriores.",
        )

    @transaction.atomic
    def handle(self, *args, **opts):
        keep = opts.get("keep_existing", False)
        self.stdout.write(self.style.NOTICE("=" * 60))
        self.stdout.write(self.style.NOTICE("microcredit-hub · seed demo (full)"))
        self.stdout.write(self.style.NOTICE("=" * 60))

        if not keep:
            self._wipe_demo()

        # 1) Role para utilizadores demo
        role = self._ensure_role()

        # 2) 4 colaboradores + Users
        users, employees = self._create_employees(role)

        # 3) Categorias de empréstimo
        categories = self._create_categories(users)

        # 4) Clientes
        clients = self._create_clients(users)

        # 5) Empréstimos
        loans = self._create_loans(clients, categories, users)

        # 6) Pagamentos
        payments = self._create_payments(loans, users)

        # 7) Eventos de calendário
        events = self._create_events(loans, users)

        # 8) RH — férias, presenças
        vacations, attendance = self._create_hr(employees, users)

        # Resumo
        total = (
            len(employees)
            + len(categories)
            + len(clients)
            + len(loans)
            + len(payments)
            + len(events)
            + len(vacations)
            + len(attendance)
        )
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("Resumo:"))
        self.stdout.write(f"  · Colaboradores: {len(employees)}")
        self.stdout.write(f"  · Categorias:    {len(categories)}")
        self.stdout.write(f"  · Clientes:      {len(clients)}")
        self.stdout.write(f"  · Empréstimos:   {len(loans)}")
        self.stdout.write(f"  · Pagamentos:    {len(payments)}")
        self.stdout.write(f"  · Eventos cal.:  {len(events)}")
        self.stdout.write(f"  · Férias:        {len(vacations)}")
        self.stdout.write(f"  · Presenças:     {len(attendance)}")
        self.stdout.write(self.style.SUCCESS(f"  Total registos: {total}"))
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("Credenciais demo (todas com password: makira123):"))
        for u in users:
            self.stdout.write(f"  · {u.username}  ({u.first_name} {u.last_name})")
        self.stdout.write("")

    # ------------------------------------------------------------------
    def _wipe_demo(self):
        """Limpa tudo o que foi criado por execuções demo anteriores."""
        # Apaga em ordem inversa de dependência. Cobre formato actual (subdomínio)
        # e formato legacy (email duplo @) de execuções anteriores deste seed.
        client_filter = Client.objects.filter(
            email__icontains=DEMO_TAG,
        ) | Client.objects.filter(email__icontains=DEMO_TAG_LEGACY)
        # Também cobre clientes cujos nomes constam da seed (caso o email tenha sido alterado manualmente)
        client_filter = client_filter | Client.objects.filter(name__in=[c[0] for c in CLIENTS_SEED])

        Payment.objects.filter(loan__client__in=client_filter).delete()
        Loan.objects.filter(client__in=client_filter).delete()
        CalendarEvent.objects.filter(client_name__in=[c[0] for c in CLIENTS_SEED]).delete()
        client_filter.delete()

        # Categorias demo identificadas pelo código DEMO-*
        LoanCategory.objects.filter(code__startswith="DEMO-").delete()

        # HR
        for emp_seed in EMPLOYEES_SEED:
            for emp in Employee.objects.filter(email=emp_seed["email"]):
                Vacation.objects.filter(employee=emp).delete()
                AttendanceRecord.objects.filter(employee=emp).delete()
                emp.delete()
            User.objects.filter(username=emp_seed["username"]).delete()

        self.stdout.write(self.style.WARNING("» Dados demo anteriores apagados."))

    def _ensure_role(self):
        role, created = Role.objects.get_or_create(
            code="demo-staff",
            defaults={
                "name": "Equipa Demo",
                "description": "Papel para colaboradores demo (acesso amplo de leitura/escrita).",
                "is_system": False,
            },
        )
        # Atribui as permissões mais comuns para verem a app
        view_perms = Permission.objects.filter(
            codename__startswith="view_",
        )
        change_perms = Permission.objects.filter(
            codename__regex=r"^(add|change|delete)_(client|loan|payment|loancategory|calendarevent|employee|vacation|attendancerecord|salaryslip)$",
        )
        role.permissions.set(list(view_perms) + list(change_perms))
        if created:
            self.stdout.write("» Role demo criado.")
        return role

    def _create_employees(self, role):
        users = []
        employees = []
        for seed in EMPLOYEES_SEED:
            u, _ = User.objects.update_or_create(
                username=seed["username"],
                defaults={
                    "email": seed["email"],
                    "first_name": seed["first_name"],
                    "last_name": seed["last_name"],
                    "is_active": True,
                    "is_staff": False,
                    "role": role,
                },
            )
            u.set_password("makira123")
            u.save()
            users.append(u)

            emp, _ = Employee.objects.update_or_create(
                email=seed["email"],
                defaults={
                    "user": u,
                    "name": seed["name"],
                    "role": seed["role"],
                    "department": seed["department"],
                    "phone": seed["phone"],
                    "base_salary": Decimal(seed["base_salary"]),
                    "status": "ativo",
                    "hire_date": date(2024, 6, 1),
                    "color": seed["color"],
                },
            )
            # Auto-atribui o emp como autor da própria criação
            emp._history_user = u
            emp.save()
            employees.append(emp)
        self.stdout.write(self.style.SUCCESS(f"» {len(employees)} colaboradores."))
        return users, employees

    def _create_categories(self, users):
        cats = []
        # Tomás (RH/Operações) é quem normalmente configura categorias
        author = users[3]
        for seed in CATEGORIES_SEED:
            payload = {**seed}
            for k in (
                "min_amount",
                "max_amount",
                "default_interest_rate",
                "late_interest_rate",
            ):
                if payload.get(k) is not None:
                    payload[k] = Decimal(str(payload[k]))
            obj = LoanCategory(**payload)
            obj.is_active = True
            _set_history_user(obj, author)
            obj.save()
            cats.append(obj)
        self.stdout.write(self.style.SUCCESS(f"» {len(cats)} categorias."))
        return cats

    def _create_clients(self, users):
        # Sara (atendimento) regista clientes; Joana ocasionalmente
        clients = []
        for i, (name, gender, occupation, city, _sector, phone, email_prefix, doc, address) in enumerate(CLIENTS_SEED):
            author = users[2 if i % 4 != 0 else 0]  # Sara, com Joana ocasionalmente
            obj = Client(
                name=name,
                gender=gender,
                occupation=occupation,
                city=city,
                phone=phone,
                email=f"{email_prefix}@{DEMO_TAG}",  # ex: anita.cuamba@demo.makira.mz
                document=doc,
                address=address,
                status="ativo" if i % 7 != 0 else "inativo",
            )
            _set_history_user(obj, author)
            obj.save()
            clients.append(obj)
        self.stdout.write(self.style.SUCCESS(f"» {len(clients)} clientes."))
        return clients

    def _create_loans(self, clients, categories, users):
        random.seed(42)
        loans = []
        # Joana (gestora de crédito) é a autora principal dos empréstimos
        today = date.today()

        spec = [
            # (months_ago_start, term_months, status, amount, sector)
            (10, 6, "pago", 35000, "comercio"),
            (8, 12, "pago", 80000, "industria"),
            (9, 4, "pago", 25000, "servicos"),
            (5, 6, "ativo", 60000, "comercio"),
            (4, 12, "ativo", 150000, "industria"),
            (3, 4, "ativo", 40000, "servicos"),
            (3, 6, "ativo", 75000, "comercio"),
            (2, 3, "ativo", 18000, "agricultura"),
            (2, 12, "ativo", 200000, "industria"),
            (1, 6, "ativo", 50000, "servicos"),
            (6, 3, "atrasado", 30000, "comercio"),
            (5, 4, "atrasado", 45000, "construcao"),
            (4, 6, "atrasado", 60000, "agricultura"),
            (1, 1, "pendente", 20000, "comercio"),
            (1, 1, "pendente", 12000, "servicos"),
            (0, 2, "pendente", 35000, "comercio"),
        ]

        for i, (months_ago, term, status, amount, sector) in enumerate(spec):
            client = clients[i % len(clients)]
            cat = categories[i % len(categories)]
            start = today - timedelta(days=30 * months_ago)
            end = start + timedelta(days=30 * term)
            rate = Decimal(str(cat.default_interest_rate))
            principal = Decimal(amount)
            interest_total = principal * (rate / Decimal(100)) * Decimal(term)
            total = principal + interest_total
            monthly = total / Decimal(term)

            loan = Loan(
                client=client,
                category=cat,
                amount=principal,
                interest_rate=rate,
                term=term,
                status=status,
                sector=sector,
                start_date=start,
                end_date=end,
                monthly_payment=monthly.quantize(Decimal("0.01")),
                total_amount=total.quantize(Decimal("0.01")),
            )
            # Joana e Pedro alternam como criadores
            author = users[0] if i % 3 != 0 else users[1]
            _set_history_user(loan, author)
            loan.save()
            loans.append(loan)
        self.stdout.write(self.style.SUCCESS(f"» {len(loans)} empréstimos."))
        return loans

    def _create_payments(self, loans, users):
        """Para cada loan, gera 1-3 pagamentos coerentes com o seu estado."""
        payments = []
        methods = ["transferencia", "m_pesa", "emola_mkesh", "deposito", "dinheiro"]
        # Pedro (cobrança) regista pagamentos
        author = users[1]
        today = date.today()

        for loan in loans:
            if loan.status == "pago":
                # cria todas as parcelas como pagas
                for n in range(1, loan.term + 1):
                    p_date = loan.start_date + timedelta(days=30 * n)
                    if p_date > today:
                        p_date = today
                    p = Payment(
                        loan=loan,
                        amount=loan.monthly_payment,
                        date=p_date,
                        status="pago",
                        method=random.choice(methods),
                        installment_number=n,
                        receipt=f"REC-{loan.id:04d}-{n:02d}",
                    )
                    _set_history_user(p, author)
                    p.save()
                    payments.append(p)
            elif loan.status == "ativo":
                # algumas parcelas pagas, próxima pendente
                paid = max(1, loan.term // 2)
                for n in range(1, paid + 1):
                    p = Payment(
                        loan=loan,
                        amount=loan.monthly_payment,
                        date=loan.start_date + timedelta(days=30 * n),
                        status="pago",
                        method=random.choice(methods),
                        installment_number=n,
                        receipt=f"REC-{loan.id:04d}-{n:02d}",
                    )
                    _set_history_user(p, author)
                    p.save()
                    payments.append(p)
                # próxima parcela pendente
                next_n = paid + 1
                if next_n <= loan.term:
                    p = Payment(
                        loan=loan,
                        amount=loan.monthly_payment,
                        date=loan.start_date + timedelta(days=30 * next_n),
                        status="pendente",
                        method="outro",
                        installment_number=next_n,
                    )
                    _set_history_user(p, author)
                    p.save()
                    payments.append(p)
            elif loan.status == "atrasado":
                # 1 ou 2 pagas, próxima atrasada
                paid = 1
                for n in range(1, paid + 1):
                    p = Payment(
                        loan=loan,
                        amount=loan.monthly_payment,
                        date=loan.start_date + timedelta(days=30 * n),
                        status="pago",
                        method=random.choice(methods),
                        installment_number=n,
                        receipt=f"REC-{loan.id:04d}-{n:02d}",
                    )
                    _set_history_user(p, author)
                    p.save()
                    payments.append(p)
                # parcela em atraso
                next_n = paid + 1
                p = Payment(
                    loan=loan,
                    amount=loan.monthly_payment,
                    date=loan.start_date + timedelta(days=30 * next_n),
                    status="atrasado",
                    method="outro",
                    installment_number=next_n,
                )
                _set_history_user(p, author)
                p.save()
                payments.append(p)
            else:  # pendente
                p = Payment(
                    loan=loan,
                    amount=loan.monthly_payment,
                    date=loan.start_date + timedelta(days=30),
                    status="pendente",
                    method="outro",
                    installment_number=1,
                )
                _set_history_user(p, author)
                p.save()
                payments.append(p)

        self.stdout.write(self.style.SUCCESS(f"» {len(payments)} pagamentos."))
        return payments

    def _create_events(self, loans, users):
        """Eventos de calendário associados a empréstimos críticos."""
        events = []
        today = date.today()
        # Joana (gestora) e Pedro (cobrança) usam o calendário
        for i, loan in enumerate(loans):
            if loan.status not in {"ativo", "atrasado"}:
                continue
            if len(events) >= 8:
                break
            author = users[1] if loan.status == "atrasado" else users[0]
            event_type = "alert" if loan.status == "atrasado" else "reminder"
            title = (
                f"Cobrar {loan.client.name}"
                if loan.status == "atrasado"
                else f"Próxima parcela — {loan.client.name}"
            )
            description = (
                f"Empréstimo #{loan.id} no valor de {loan.amount} MT em {loan.status}."
            )
            ev = CalendarEvent(
                user=author,
                title=title,
                event_type=event_type,
                date=today + timedelta(days=(i + 1) * 2),
                description=description,
                notify=True,
                loan=loan,
                client_name=loan.client.name,
                amount=loan.monthly_payment,
                color="#dc2626" if loan.status == "atrasado" else "#3b82f6",
            )
            ev.save()
            events.append(ev)
        self.stdout.write(self.style.SUCCESS(f"» {len(events)} eventos de calendário."))
        return events

    def _create_hr(self, employees, users):
        """Férias e presenças para os 4 colaboradores."""
        vacations = []
        attendance = []
        today = date.today()
        # Tomás (RH) regista RH
        author = users[3]

        # Férias: 1 colaborador em férias actuais, 1 com férias futuras
        v1 = Vacation(
            employee=employees[2],  # Sara
            start_date=today - timedelta(days=2),
            end_date=today + timedelta(days=5),
            color="#f59e0b",
        )
        _set_history_user(v1, author)
        v1.save()
        vacations.append(v1)

        v2 = Vacation(
            employee=employees[1],  # Pedro
            start_date=today + timedelta(days=15),
            end_date=today + timedelta(days=22),
            color="#10b981",
        )
        _set_history_user(v2, author)
        v2.save()
        vacations.append(v2)

        # Presenças: registar últimos 5 dias úteis para cada colaborador
        for emp in employees:
            for delta in range(0, 7):
                d = today - timedelta(days=delta)
                if d.weekday() >= 5:  # fim de semana
                    continue
                # Sara está em férias, salta
                if emp == employees[2] and v1.start_date <= d <= v1.end_date:
                    status = "ferias"
                else:
                    # 80% presente, 10% atrasado, 10% justificado
                    r = random.random()
                    if r < 0.8:
                        status = "presente"
                    elif r < 0.9:
                        status = "atrasado"
                    else:
                        status = "justificado"
                rec = AttendanceRecord(
                    employee=emp,
                    date=d,
                    status=status,
                )
                if hasattr(rec, "_history_user"):
                    pass
                _set_history_user(rec, author)
                try:
                    rec.save()
                    attendance.append(rec)
                except Exception:
                    pass
        self.stdout.write(self.style.SUCCESS(f"» {len(vacations)} férias, {len(attendance)} presenças."))
        return vacations, attendance
