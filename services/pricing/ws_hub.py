"""Fan-out WebSockets. Server pulls Angel/Yahoo and pushes JSON frames."""

from __future__ import annotations

import asyncio
import json
from typing import Any

from fastapi import WebSocket


class Hub:
    def __init__(self) -> None:
        self.clients: set[WebSocket] = set()
        self.last: dict[str, Any] | None = None

    async def join(self, ws: WebSocket) -> None:
        await ws.accept()
        self.clients.add(ws)
        if self.last:
            await ws.send_text(json.dumps(self.last))

    def drop(self, ws: WebSocket) -> None:
        self.clients.discard(ws)

    async def publish(self, payload: dict[str, Any]) -> None:
        self.last = payload
        dead = []
        raw = json.dumps(payload)
        for ws in list(self.clients):
            try:
                await ws.send_text(raw)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.clients.discard(ws)


tape_hub = Hub()
nifty_hub = Hub()


async def run_tape_loop() -> None:
    from market_strip import tape

    while True:
        try:
            data = await asyncio.to_thread(tape)
            data["type"] = "tape"
            await tape_hub.publish(data)
        except Exception as e:
            await tape_hub.publish({"type": "tape", "error": str(e), "rows": []})
        await asyncio.sleep(5)


async def run_nifty_loop() -> None:
    from angel_live import configured, snapshot as angel_snapshot

    while True:
        try:
            if configured():
                snap = await asyncio.to_thread(angel_snapshot, "NIFTY", None)
                await nifty_hub.publish(
                    {
                        "type": "nifty",
                        "underlying": snap.get("underlying"),
                        "expiry": snap.get("expiry"),
                        "atm_strike": snap.get("atm_strike"),
                        "asof": snap.get("asof"),
                        "source": snap.get("source"),
                    }
                )
        except Exception as e:
            await nifty_hub.publish({"type": "nifty", "error": str(e)})
        await asyncio.sleep(3)
