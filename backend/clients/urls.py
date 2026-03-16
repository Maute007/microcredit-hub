from django.urls import include, path

from rest_framework import routers

from .views import ClientViewSet

router = routers.SimpleRouter()
router.register(r"", ClientViewSet, basename="client")

urlpatterns = [
    path("", include(router.urls)),
]
