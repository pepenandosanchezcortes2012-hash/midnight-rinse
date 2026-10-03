"""Blind-Spot Dispatcher: el horror solo ocurre fuera del campo de visión o durante un parpadeo.

Origen: campeón de Gemini G002 (Arena 1, cadena de 8 lotes, ratificado con 59/59 pruebas adversariales),
refactorizado. Se conserva su diseño de cubetas por prioridad (programar es O(1)); se corrige que un entero
gigante como visibilidad lanzara OverflowError en lugar de ValueError.
"""
from __future__ import annotations

import math
import threading
from typing import Any, Dict, List


def _check_visibility(visibility: Any) -> float:
    """visibility: int o float (no bool), finito y en [0.0, 1.0]."""
    if isinstance(visibility, bool) or not isinstance(visibility, (int, float)):
        raise ValueError("visibility debe ser int o float (no bool)")
    if isinstance(visibility, int):
        if not 0 <= visibility <= 1:
            raise ValueError("visibility fuera de [0.0, 1.0]")
        return float(visibility)
    if not math.isfinite(visibility) or not 0.0 <= visibility <= 1.0:
        raise ValueError("visibility debe ser finito y estar en [0.0, 1.0]")
    return visibility


class Dispatcher:
    """Cola de eventos por prioridad que solo se vacía cuando nadie mira (visibility == 0) o al parpadear.

    Orden de disparo: mayor prioridad primero; en empate, el programado antes. Seguro para hilos.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._pending_ids: set = set()
        self._buckets: Dict[int, List[Dict[str, Any]]] = {}

    def schedule(self, event_id: str, payload: dict, priority: int = 0) -> None:
        """Programa un evento. ValueError si los tipos no son válidos o si el id ya está pendiente."""
        if not isinstance(event_id, str) or not event_id:
            raise ValueError("event_id debe ser un str no vacío")
        if not isinstance(payload, dict):
            raise ValueError("payload debe ser un dict")
        if isinstance(priority, bool) or not isinstance(priority, int):
            raise ValueError("priority debe ser int (no bool)")
        with self._lock:
            if event_id in self._pending_ids:
                raise ValueError(f"el evento {event_id!r} ya está pendiente")
            self._pending_ids.add(event_id)
            self._buckets.setdefault(priority, []).append({"event_id": event_id, "payload": payload})

    def tick(self, visibility: float, blink: bool = False) -> list[dict]:
        """Si visibility == 0 o blink, dispara y consume todos los pendientes; si no, devuelve []."""
        level = _check_visibility(visibility)
        if not isinstance(blink, bool):
            raise ValueError("blink debe ser bool")
        if level != 0 and not blink:
            return []
        with self._lock:
            if not self._pending_ids:
                return []
            self._pending_ids = set()
            buckets, self._buckets = self._buckets, {}
        fired: List[Dict[str, Any]] = []
        for priority in sorted(buckets, reverse=True):
            fired.extend(buckets[priority])
        return fired

    def pending(self) -> int:
        """Número de eventos que siguen en cola."""
        with self._lock:
            return len(self._pending_ids)
