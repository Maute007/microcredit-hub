"""
Validação a nível do backend — protecção contra manipulação/ataques.
Limites ligeiramente mais permissivos que o frontend (ex: frontend 10, backend 20).
"""

from decimal import Decimal

# Montantes (MT) — limites máximos por operação
MAX_LOAN_AMOUNT = Decimal("50_000_000")  # 50M MT
MAX_PAYMENT_AMOUNT = Decimal("50_000_000")
MAX_TRANSACTION_AMOUNT = Decimal("100_000_000")
MAX_SALARY = Decimal("50_000_000")
MAX_COLLATERAL_VALUE = Decimal("100_000_000")
MAX_CALENDAR_AMOUNT = Decimal("50_000_000")

# Prazos e parcelas
MAX_LOAN_TERM_MONTHS = 120  # 10 anos
MAX_INSTALLMENT_NUMBER = 999

# Taxas (0–100% ou 0–1 consoante o campo)
MAX_INTEREST_RATE = Decimal("100")

# Comprimento de strings (backend mais permissivo que frontend)
MAX_NAME_LENGTH = 300
MAX_DESCRIPTION_LENGTH = 2000
MAX_CODE_LENGTH = 80
MAX_REFERENCE_LENGTH = 300

# Paginação
MAX_PAGE_SIZE = 200  # frontend usa tipicamente 10–50
