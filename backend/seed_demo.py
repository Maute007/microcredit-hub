
"""Seed/reset data for microcredit-hub demo.

Runs from inside backend/. Wipes loans/payments/clients,
configures SystemSettings, creates 2 LoanCategories and a
realistic mix of loans (paid, active, overdue, partial).
"""
import os
import django
import sys
from decimal import Decimal
from datetime import date, timedelta

# Bootstrap Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "Server_microcredit.settings")
django.setup()

from accounts.models import SystemSettings  # noqa: E402
from clients.models import Client  # noqa: E402
from loans.models import Loan, LoanCategory, Payment  # noqa: E402

print("=" * 60)
print("microcredit-hub — seed/reset")
print("=" * 60)

# --- 1. Wipe ---------------------------------------------------------------
n_pay = Payment.objects.all().count()
n_loan = Loan.objects.all().count()
n_cat = LoanCategory.objects.all().count()
n_cli = Client.objects.all().count()
Payment.objects.all().delete()
Loan.objects.all().delete()
LoanCategory.objects.all().delete()
Client.objects.all().delete()
print(f"\nDeleted: {n_pay} payments, {n_loan} loans, {n_cat} categories, {n_cli} clients")

# --- 2. SystemSettings ------------------------------------------------------
ss = SystemSettings.get_solo()
ss.name = ss.name or "Nalata Microcrédito"
ss.creditor_legal_name = "Nalata Microcrédito EI"
ss.creditor_address = "Bairro Albazine, Distrito KaMavota, Maputo"
ss.creditor_city = "Maputo"
# Loan defaults: 30% baseline, common terms 15 and 30 days
ss.loan_default_interest_rate = Decimal("30.00")
ss.loan_allowed_terms_days = [15, 30]
# BdM defaults
ss.bom_province = "Maputo"
ss.bom_phone = "+258 85 338 7304"
ss.bom_fax = ""
ss.bom_email = "nalata.corporate@gmail.com"
ss.bom_num_workers = 1
ss.bom_start_date = "Dezembro de 2024"
ss.bom_operator_name = "Atilio Jossias Arlindo Macave"
ss.bom_initial_capital = Decimal("75000.00")
ss.bom_current_capital = Decimal("405000.00")
ss.bom_own_capital = Decimal("405000.00")
ss.bom_foreign_capital_national = Decimal("0.00")
ss.bom_foreign_capital_foreign = Decimal("0.00")
ss.bom_financing_loans = Decimal("0.00")
ss.bom_financing_donations = Decimal("0.00")
ss.bom_financing_capital_increase = Decimal("0.00")
ss.bom_financial_situation = [
    {"caixa": 50000, "bancos": 200000, "outros_activos": 0},
    {"caixa": 75000, "bancos": 180000, "outros_activos": 0},
    {"caixa": 90000, "bancos": 220000, "outros_activos": 5000},
]
ss.save()
print("✓ SystemSettings configured")

# --- 3. LoanCategories ------------------------------------------------------
cat_15 = LoanCategory.objects.create(
    name="Curto prazo (15 dias)",
    code="CP15",
    description="Empréstimo de curto prazo, prestação única ao fim de 15 dias.",
    terms_and_conditions=(
        "Pagamento único do principal + juros ao fim de 15 dias. "
        "Em caso de atraso, aplicam-se juros de mora."
    ),
    min_amount=Decimal("500"),
    max_amount=Decimal("20000"),
    frequency_days=15,
    min_term_days=15,
    max_term_days=15,
    min_installments=1,
    max_installments=1,
    default_interest_rate=Decimal("15.00"),
    default_term_months=1,
    late_interest_rate=Decimal("2.00"),
    max_late_interest_months=6,
    collateral_grace_days=30,
    require_interest_paid_to_keep_collateral=True,
    is_active=True,
)
cat_30 = LoanCategory.objects.create(
    name="Mensal (30 dias)",
    code="M30",
    description="Empréstimo mensal, taxa de 30%.",
    terms_and_conditions=(
        "Pagamento único do principal + juros ao fim de 30 dias. "
        "Pode ser renovado mediante aprovação."
    ),
    min_amount=Decimal("1000"),
    max_amount=Decimal("100000"),
    frequency_days=30,
    min_term_days=30,
    max_term_days=30,
    min_installments=1,
    max_installments=1,
    default_interest_rate=Decimal("30.00"),
    default_term_months=1,
    late_interest_rate=Decimal("3.00"),
    max_late_interest_months=6,
    collateral_grace_days=60,
    require_interest_paid_to_keep_collateral=True,
    is_active=True,
)
print(f"✓ Categories: {cat_15.code} (15% / 15d), {cat_30.code} (30% / 30d)")

# --- 4. Clients -------------------------------------------------------------
clients_data = [
    ("João Mucavel",       "M", "comercio",   "+258 84 111 1111", "joao@example.mz"),
    ("Maria Tembe",        "F", "comercio",   "+258 84 222 2222", "maria@example.mz"),
    ("Carlos Sitoe",       "M", "servicos",   "+258 84 333 3333", "carlos@example.mz"),
    ("Ana Macuácua",       "F", "agricultura","+258 84 444 4444", "ana@example.mz"),
    ("Pedro Cossa",        "M", "industria",  "+258 84 555 5555", "pedro@example.mz"),
    ("Júlia Bila",         "F", "servicos",   "+258 84 666 6666", "julia@example.mz"),
    ("Domingos Nhacuongue","M", "pecuaria",   "+258 84 777 7777", "domingos@example.mz"),
    ("Helena Manjate",     "F", "comercio",   "+258 84 888 8888", "helena@example.mz"),
    ("Rui Macamo",         "M", "servicos",   "+258 84 999 9999", "rui@example.mz"),
    ("Fátima Chissano",    "F", "consumo",    "+258 85 111 2222", "fatima@example.mz"),
]
clients = {}
for name, gender, _sector, phone, email in clients_data:
    c = Client.objects.create(
        name=name,
        gender=gender,
        phone=phone,
        email=email,
        document=f"DOC{name.split()[0].upper()[:6]}",
        city="Maputo",
        address="Bairro Albazine",
        occupation="Comerciante",
        status="ativo",
    )
    clients[name] = c
print(f"✓ {len(clients)} clients created")

today = date.today()

def make_loan(client_name, sector, amount, term_days, status, paid_status, days_ago_start):
    """
    Create a Loan and its Payment(s).
    paid_status: 'full' (everything paid), 'none' (nothing paid),
                 'partial' (interest paid, principal pending),
                 'overdue' (nothing paid, past due).
    """
    cat = cat_15 if term_days == 15 else cat_30
    rate = Decimal("15.00") if term_days == 15 else Decimal("30.00")
    interest = (amount * rate) / Decimal("100")
    total = amount + interest
    start = today - timedelta(days=days_ago_start)
    end = start + timedelta(days=term_days)
    loan = Loan.objects.create(
        client=clients[client_name],
        category=cat,
        amount=amount,
        interest_rate=rate,
        term=1,  # 1 month
        status=status,
        sector=sector,
        start_date=start,
        end_date=end,
        monthly_payment=total,
        total_amount=total,
    )
    if paid_status == "full":
        # Single payment, paid on or before due date
        Payment.objects.create(
            loan=loan,
            amount=total,
            date=end,
            status="pago",
            method="m_pesa",
            installment_number=1,
            receipt=f"REC-{loan.id:04d}",
        )
    elif paid_status == "partial":
        # Paid only the interest part
        Payment.objects.create(
            loan=loan,
            amount=interest,
            date=end,
            status="pago",
            method="dinheiro",
            installment_number=1,
            receipt=f"REC-INT-{loan.id:04d}",
        )
        # Principal still pending — schedule a second payment
        Payment.objects.create(
            loan=loan,
            amount=amount,
            date=end + timedelta(days=15),
            status="pendente",
            method="outro",
            installment_number=2,
        )
    elif paid_status == "overdue":
        # Single payment, scheduled but not paid (overdue)
        Payment.objects.create(
            loan=loan,
            amount=total,
            date=end,
            status="atrasado",
            method="outro",
            installment_number=1,
        )
    elif paid_status == "none":
        # Single payment scheduled, still pending
        Payment.objects.create(
            loan=loan,
            amount=total,
            date=end,
            status="pendente",
            method="outro",
            installment_number=1,
        )
    return loan

# --- 5. Loans (mix of statuses) --------------------------------------------
loans_data = [
    # (client, sector, amount, term_days, loan_status, paid_status, days_ago_start)
    # Fully paid
    ("João Mucavel",        "comercio",   Decimal("5000"),  30, "pago",     "full",    45),
    ("Maria Tembe",         "comercio",   Decimal("8000"),  30, "pago",     "full",    50),
    ("Carlos Sitoe",        "servicos",   Decimal("3000"),  15, "pago",     "full",    30),

    # Active (loan running, payment not yet due)
    ("Ana Macuácua",        "agricultura",Decimal("12000"), 30, "ativo",    "none",    10),
    ("Pedro Cossa",         "industria",  Decimal("20000"), 30, "ativo",    "none",    8),
    ("Júlia Bila",          "servicos",   Decimal("4500"),  15, "ativo",    "none",    5),
    ("Helena Manjate",      "comercio",   Decimal("10000"), 30, "ativo",    "partial", 25),

    # Overdue (Class I — 1 to 30 days late)
    ("Domingos Nhacuongue", "pecuaria",   Decimal("7500"),  30, "atrasado", "overdue", 50),

    # Overdue (Class II — 31 to 90 days late)
    ("Rui Macamo",          "servicos",   Decimal("15000"), 30, "atrasado", "overdue", 90),

    # Overdue (Class III — 91 to 365 days late)
    ("Fátima Chissano",     "consumo",    Decimal("6000"),  30, "atrasado", "overdue", 200),
]

created = 0
for row in loans_data:
    loan = make_loan(*row)
    created += 1
    print(f"  • {row[0]:20s} | {row[1]:11s} | {row[2]:>8} MT | {row[3]:>2}d | {row[4]:8s} | {row[5]}")

print(f"\n✓ {created} loans + payments created")

# --- 6. Summary -------------------------------------------------------------
print("\n" + "=" * 60)
print("Summary")
print("=" * 60)
print(f"Clients:       {Client.objects.count()}")
print(f"  • Homens:    {Client.objects.filter(gender='M').count()}")
print(f"  • Mulheres:  {Client.objects.filter(gender='F').count()}")
print(f"Categories:    {LoanCategory.objects.count()}")
print(f"Loans:         {Loan.objects.count()}")
print(f"  • Pagos:     {Loan.objects.filter(status='pago').count()}")
print(f"  • Activos:   {Loan.objects.filter(status='ativo').count()}")
print(f"  • Atrasados: {Loan.objects.filter(status='atrasado').count()}")
print(f"Payments:      {Payment.objects.count()}")
print(f"  • Pagos:     {Payment.objects.filter(status='pago').count()}")
print(f"  • Pendentes: {Payment.objects.filter(status='pendente').count()}")
print(f"  • Atrasados: {Payment.objects.filter(status='atrasado').count()}")
print()
print("Done.")
