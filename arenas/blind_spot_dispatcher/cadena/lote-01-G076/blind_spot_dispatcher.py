"""Blind spot event dispatcher for Midnight Rinse Arena 1."""

from __future__ import annotations

import math
import threading


class Dispatcher:
    """Dispatches occlusion-driven horror events when visibility drops or blinking occurs."""

    def __init__(self) -> None:
        """Initialize an empty Dispatcher with synchronization primitives."""
        self._lock = threading.RLock()
        self._pending_ids: set[str] = set()
        self._queue: list[tuple[int, int, str, dict]] = []
        self._seq: int = 0

    def schedule(self, event_id: str, payload: dict, priority: int = 0) -> None:
        """Schedule an occlusion event to be dispatched when visibility drops.

        Raises ValueError if event_id is not a non-empty string, payload is not a dict,
        priority is not an int (or is a bool), or event_id is already pending.
        """
        if not isinstance(event_id, str) or not event_id:
            raise ValueError("event_id must be a non-empty str")
        if not isinstance(payload, dict):
            raise ValueError("payload must be a dict")
        if isinstance(priority, bool) or not isinstance(priority, int):
            raise ValueError("priority must be an int, not bool")

        with self._lock:
            if event_id in self._pending_ids:
                raise ValueError(f"event_id {event_id!r} is already pending")
            self._pending_ids.add(event_id)
            self._queue.append((-priority, self._seq, event_id, payload))
            self._seq += 1

    def tick(self, visibility: float, blink: bool = False) -> list[dict]:
        """Dispatch and consume all pending events if occluded (visibility == 0 or blink).

        Raises ValueError if visibility is not a finite float/int in [0.0, 1.0] (no bool),
        or if blink is not a bool.
        """
        if isinstance(visibility, bool) or not isinstance(visibility, (int, float)):
            raise ValueError("visibility must be an int or float, not bool")
        if math.isnan(visibility) or math.isinf(visibility):
            raise ValueError("visibility must be finite")
        if visibility < 0.0 or visibility > 1.0:
            raise ValueError("visibility must be in range [0.0, 1.0]")
        if not isinstance(blink, bool):
            raise ValueError("blink must be a bool")

        with self._lock:
            if visibility == 0 or blink:
                if not self._queue:
                    return []
                events = self._queue
                self._queue = []
                self._pending_ids.clear()
                events.sort()
                return [{"event_id": item[2], "payload": item[3]} for item in events]
            return []

    def pending(self) -> int:
        """Return the number of currently pending events."""
        with self._lock:
            return len(self._pending_ids)
