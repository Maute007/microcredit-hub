from django.urls import include, path
from rest_framework import routers

from .views import LoanViewSet, PaymentViewSet

router = routers.SimpleRouter()
router.register(r"loans", LoanViewSet, basename="loan")
router.register(r"payments", PaymentViewSet, basename="payment")

urlpatterns = [
    path("", include(router.urls)),
]
