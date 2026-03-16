from django.urls import include, path
from rest_framework import routers

from .views import TransactionViewSet

router = routers.SimpleRouter()
router.register(r"transactions", TransactionViewSet, basename="transaction")

urlpatterns = [
    path("", include(router.urls)),
]
