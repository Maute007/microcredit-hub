import json
from typing import Any

from channels.generic.websocket import AsyncWebsocketConsumer


class RealtimeConsumer(AsyncWebsocketConsumer):
    """
    Consumer genérico para sincronização em tempo real.
    Use grupos (group_send) para salas por usuário/entidade.
    """

    async def connect(self) -> None:  # type: ignore[override]
        user = self.scope.get("user")
        self.group_name = "public_realtime"

        if user and user.is_authenticated:
            self.group_name = f"user_{user.id}"

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code: int) -> None:  # type: ignore[override]
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data: str | None = None, bytes_data: bytes | None = None) -> None:  # type: ignore[override]
        payload: dict[str, Any] = {}
        if text_data:
            try:
                payload = json.loads(text_data)
            except json.JSONDecodeError:
                payload = {"raw": text_data}

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "broadcast_message",
                "payload": payload,
            },
        )

    async def broadcast_message(self, event: dict[str, Any]) -> None:
        await self.send(text_data=json.dumps(event.get("payload", {})))

