"""Signals para actualizar o status do empréstimo quando pagamentos mudam."""

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from .models import Payment
from .services import update_loan_status


@receiver(post_save, sender=Payment)
def payment_saved(sender, instance, **kwargs):
    """Quando um pagamento é criado ou editado, actualiza o status do empréstimo."""
    if instance.loan_id:
        update_loan_status(instance.loan)


@receiver(post_delete, sender=Payment)
def payment_deleted(sender, instance, **kwargs):
    """Quando um pagamento é eliminado, actualiza o status do empréstimo."""
    if instance.loan_id:
        update_loan_status(instance.loan)
