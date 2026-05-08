from django.urls import include, path
from rest_framework import routers

from .views import LoanViewSet, PaymentViewSet, LoanRenewView

router = routers.SimpleRouter()
router.register(r"loans", LoanViewSet, basename="loan")
router.register(r"payments", PaymentViewSet, basename="payment")

urlpatterns = [
    path("", include(router.urls)),
    path("<int:pk>/renew/", LoanRenewView.as_view(), name="loan_renew"),
]
