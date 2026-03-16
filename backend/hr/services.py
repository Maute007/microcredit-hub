"""
Serviços para simulação e cálculo manual de RH.
Tudo é feito manualmente, sem integrações externas.
"""
from decimal import Decimal


# Taxas simplificadas (simuladas) - ajuste conforme legislação
INSS_RATE = Decimal("0.03")  # 3% trabalhador
IRPS_RATE = Decimal("0.10")  # 10% IRPS simplificado
OTHER_DEDUCTIONS_RATE = Decimal("0.01")  # 1% outras deduções
OVERTIME_RATE = Decimal("0.00")  # por padrão, não assumir horas extra


def simulate_salary_slip(
    base_salary,
    overtime=None,
    bonus=None,
    inss_rate=None,
    irps_rate=None,
    other_deductions_rate=None,
    penalty_deductions=None,
):
    """
    Simula o cálculo de um recibo de vencimento.
    Retorna dicionário com todos os campos calculados.
    """
    base = Decimal(str(base_salary))
    overtime = Decimal(str(overtime or 0))
    bonus = Decimal(str(bonus or 0))
    gross = base + overtime + bonus
    inss_r = Decimal(str(inss_rate)) if inss_rate is not None else INSS_RATE
    irps_r = Decimal(str(irps_rate)) if irps_rate is not None else IRPS_RATE
    other_r = (
        Decimal(str(other_deductions_rate))
        if other_deductions_rate is not None
        else OTHER_DEDUCTIONS_RATE
    )
    inss = (gross * inss_r).quantize(Decimal("0.01"))
    irps = (gross * irps_r).quantize(Decimal("0.01"))
    other = (gross * other_r).quantize(Decimal("0.01"))
    penalty = Decimal(str(penalty_deductions or 0)).quantize(Decimal("0.01"))
    total_deductions = inss + irps + other + penalty
    net = gross - total_deductions
    return {
        "base_salary": float(base),
        "overtime": float(overtime),
        "bonus": float(bonus),
        "gross_salary": float(gross),
        "inss": float(inss),
        "irps": float(irps),
        "other_deductions": float(other + penalty),
        "total_deductions": float(total_deductions),
        "net_salary": float(net),
    }


def simulate_salary_from_employee(employee, month, overtime=None, bonus=None, attendance_counts=None):
    """Simula recibo a partir de um colaborador."""
    base = employee.base_salary
    if overtime is None:
        ot_rate = getattr(employee, "overtime_rate_default", None)
        if ot_rate is None:
            overtime = Decimal("0")
        else:
            overtime = base * Decimal(str(ot_rate))
    bonus = bonus if bonus is not None else Decimal("0")
    counts = attendance_counts or {}
    absent = Decimal(str(counts.get("absent", 0) or 0))
    late = Decimal(str(counts.get("late", 0) or 0))
    pen_abs = Decimal(str(getattr(employee, "penalty_absent_rate", 0) or 0))
    pen_late = Decimal(str(getattr(employee, "penalty_late_rate", 0) or 0))
    # Penalização simples: percentagem do bruto por ocorrência (falta/atraso)
    gross_tmp = Decimal(str(base)) + Decimal(str(overtime)) + Decimal(str(bonus))
    penalty_deductions = gross_tmp * (absent * pen_abs + late * pen_late)
    data = simulate_salary_slip(
        base,
        overtime,
        bonus,
        inss_rate=getattr(employee, "inss_rate", None),
        irps_rate=getattr(employee, "irps_rate", None),
        other_deductions_rate=getattr(employee, "other_deductions_rate", None),
        penalty_deductions=penalty_deductions,
    )
    data["employee_id"] = employee.id
    data["employee_name"] = employee.name
    data["role"] = employee.role
    data["month"] = month
    data["attendance"] = {"absent": int(absent), "late": int(late)}
    return data
