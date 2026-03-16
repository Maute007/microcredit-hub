"""Serviços para empréstimos: cálculo de status automático e validação de pagamentos."""

import calendar
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from django.db.models import Sum

from .models import Loan, Payment


def _installment_due_date(loan: Loan, installment: int) -> date | None:
    """Data de vencimento da parcela N (1-based)."""
    if installment < 1 or installment > loan.term:
        return None
    month = loan.start_date.month - 1 + installment
    year = loan.start_date.year + (month // 12)
    month = (month % 12) + 1
    try:
        return loan.start_date.replace(year=year, month=month)
    except ValueError:
        last_day = calendar.monthrange(year, month)[1]
        return date(year, month, min(loan.start_date.day, last_day))


def compute_loan_status(loan: Loan) -> str:
    """
    Calcula o status do empréstimo com base nos pagamentos e datas.
    - pago: todas as parcelas pagas
    - atrasado: existe parcela vencida (data < hoje) não paga
    - ativo: em curso, sem atrasos
    - pendente: primeira parcela ainda não venceu (empréstimo recém-criado ou por iniciar)
    """
    today = date.today()
    paid_installments = set(
        loan.payments.filter(status="pago").values_list("installment_number", flat=True)
    )

    if len(paid_installments) >= loan.term:
        return "pago"

    has_overdue = False
    for i in range(1, loan.term + 1):
        due = _installment_due_date(loan, i)
        if not due:
            continue
        if i in paid_installments:
            continue
        if due < today:
            has_overdue = True
            break

    if has_overdue:
        return "atrasado"
    first_due = _installment_due_date(loan, 1)
    if first_due and first_due <= today:
        return "ativo"
    return "pendente"


def update_loan_status(loan: Loan) -> bool:
    """Actualiza o status do empréstimo na BD se mudou. Retorna True se alterou."""
    new_status = compute_loan_status(loan)
    if loan.status != new_status:
        loan.status = new_status
        loan.save(update_fields=["status"])
        return True
    return False


def _get_paid_amount(loan: Loan, exclude_payment_id: int | None = None) -> tuple[Decimal, set[int]]:
    """Retorna (total pago, set de números de parcelas pagas)."""
    qs = loan.payments.filter(status="pago")
    if exclude_payment_id:
        qs = qs.exclude(id=exclude_payment_id)
    paid_sum = qs.aggregate(s=Sum("amount"))["s"] or Decimal("0")
    paid_installments = set(qs.values_list("installment_number", flat=True))
    return paid_sum, paid_installments


def compute_min_payment_for_installment(
    loan: Loan,
    installment_number: int,
    exclude_payment_id: int | None = None,
) -> Decimal:
    """
    Valor mínimo aceite para a parcela N.
    - Parcela 1: valor previsto no plano (monthly_payment)
    - Parcelas 2+: saldo devedor restante / parcelas restantes
    """
    if installment_number < 1 or installment_number > loan.term:
        return Decimal("0")
    paid_sum, paid_installments = _get_paid_amount(loan, exclude_payment_id)
    remaining_debt = Decimal(str(loan.total_amount or 0)) - paid_sum
    remaining_installments = loan.term - len(paid_installments)
    if remaining_installments <= 0:
        return Decimal("0")
    if installment_number == 1 and 1 not in paid_installments:
        return Decimal(str(loan.monthly_payment or 0))
    min_val = (remaining_debt / remaining_installments).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    return max(Decimal("0.01"), min_val)


def compute_remaining_balance(loan: Loan, exclude_payment_id: int | None = None) -> Decimal:
    """Saldo devedor actual (total - pago)."""
    paid_sum, _ = _get_paid_amount(loan, exclude_payment_id)
    return max(Decimal("0"), Decimal(str(loan.total_amount or 0)) - paid_sum)


def compute_late_interest(
    loan: Loan,
    as_of_date: date | None = None,
    exclude_payment_id: int | None = None,
) -> Decimal:
    """
    Juros de mora acumulados sobre saldo em atraso (após end_date).
    Usa late_interest_rate e max_late_interest_months da categoria.
    """
    today = as_of_date or date.today()
    if loan.end_date >= today:
        return Decimal("0")
    remaining = compute_remaining_balance(loan, exclude_payment_id)
    if remaining <= 0:
        return Decimal("0")
    category = getattr(loan, "category", None)
    if not category:
        return Decimal("0")
    rate = Decimal(str(getattr(category, "late_interest_rate", 0) or 0)) / 100
    max_months = int(getattr(category, "max_late_interest_months", 12) or 12)
    months_overdue = max(0, (today.year - loan.end_date.year) * 12 + (today.month - loan.end_date.month))
    months_overdue = min(months_overdue, max_months)
    return (remaining * rate * months_overdue).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def compute_total_due_with_late_interest(
    loan: Loan,
    exclude_payment_id: int | None = None,
    as_of_date: date | None = None,
) -> Decimal:
    """Saldo devedor + juros de mora (quando prazo expirou)."""
    remaining = compute_remaining_balance(loan, exclude_payment_id)
    late = compute_late_interest(loan, as_of_date, exclude_payment_id)
    return remaining + late


def refresh_loan_statuses_batch() -> int:
    """Actualiza o status dos empréstimos ativo/pendente que podem ter ficado atrasados pelo tempo."""
    updated = 0
    for loan in Loan.objects.filter(status__in=["ativo", "pendente"]).prefetch_related("payments"):
        if update_loan_status(loan):
            updated += 1
    return updated
