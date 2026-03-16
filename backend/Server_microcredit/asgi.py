import os

from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "Server_microcredit.settings")

django_asgi_app = get_asgi_application()

try:
    from Server_microcredit import routing as server_routing
except Exception:  # pragma: no cover - fallback if routing not ready
    server_routing = None


application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": AuthMiddlewareStack(
            URLRouter(getattr(server_routing, "websocket_urlpatterns", []))
        ),
    }
)

