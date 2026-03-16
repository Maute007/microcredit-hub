from django.urls import path

from . import ws_consumers


websocket_urlpatterns = [
    path("ws/realtime/", ws_consumers.RealtimeConsumer.as_asgi()),
]

