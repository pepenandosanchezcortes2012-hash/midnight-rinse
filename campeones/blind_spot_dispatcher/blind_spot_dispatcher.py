"""Blind spot event dispatcher for occlusion mechanics."""
from __future__ import annotations

import math
import threading
from typing import Any


class Dispatcher:
    """Thread-safe event dispatcher for occluded blind spot mechanics."""

    def __init__(self) -> None:
        """Initialize dispatcher state with concurrency lock and O(1) bucket storage."""
        self._lock: threading.Lock = threading.Lock()
        self._pending_ids: set[str] = set()
        self._buckets: dict[int, list[dict[str, Any]]] = {}

    def schedule(self, event_id: str, payload: dict, priority: int = 0) -> None:
        """Schedule an event if not already pending."""
        if isinstance(event_id, bool) or not isinstance(event_id, str) or len(event_id) == 0:
            raise ValueError("event_id must be a non-empty str")
        if not isinstance(payload, dict):
            raise ValueError("payload must be a dict")
        if isinstance(priority, bool) or not isinstance(priority, int):
            raise ValueError("priority must be an int (not bool)")

        with self._lock:
            if event_id in self._pending_ids:
                raise ValueError(f"event_id {event_id!r} is already pending")
            self._pending_ids.add(event_id)
            event: dict[str, Any] = {"event_id": event_id, "payload": payload}
            bucket = self._buckets.get(priority)
            if bucket is None:
                self._buckets[priority] = [event]
            else:
                bucket.append(event)

    def tick(self, visibility: float, blink: bool = False) -> list[dict]:
        """Dispatch pending events when occlusion or blink occurs."""
        if isinstance(visibility, bool) or not isinstance(visibility, (int, float)):
            raise ValueError("visibility must be a float or int (not bool)")
        if not math.isfinite(visibility):
            raise ValueError("visibility must be finite")
        if not (0.0 <= visibility <= 1.0):
            raise ValueError("visibility must be in [0.0, 1.0]")
        if not isinstance(blink, bool):
            raise ValueError("blink must be a bool")

        if not (visibility == 0 or blink):
            return []

        with self._lock:
            if not self._pending_ids:
                return []
            self._pending_ids.clear()
            buckets = self._buckets
            self._buckets = {}

        if len(buckets) == 1:
            return next(iter(buckets.values()))

        result: list[dict[str, Any]] = []
        for p in sorted(buckets.keys(), reverse=True):
            result.extend(buckets[p])
        return result

    def pending(self) -> int:
        """Return the number of currently pending events."""
        with self._lock:
            return len(self._pending_ids)
