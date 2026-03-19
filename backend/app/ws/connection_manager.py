from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.connections.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self.connections.discard(websocket)

    async def send_event(
        self,
        websocket: WebSocket,
        event_type: str,
        payload: dict,
    ) -> None:
        await websocket.send_json({"type": event_type, "payload": payload})

    async def broadcast(self, event_type: str, payload: dict) -> None:
        stale_connections: list[WebSocket] = []
        for websocket in list(self.connections):
            try:
                await self.send_event(websocket, event_type, payload)
            except Exception:
                stale_connections.append(websocket)

        for websocket in stale_connections:
            self.disconnect(websocket)
