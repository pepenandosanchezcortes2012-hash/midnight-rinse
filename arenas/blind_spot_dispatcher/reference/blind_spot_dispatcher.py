"""Blind-Spot Dispatcher: dispara eventos de horror solo cuando el jugador no mira o parpadea.

Solución de referencia de la Arena 1 (no se muestra a los gladiadores).
"""
from __future__ import annotations

import heapq
import math
import threading
from typing import Any, Dict, List, Set, Tuple


def _check_visibility(visibility: Any) -> float:
    """Valida visibility: int o float (no bool), finito y en [0.0, 1.0]."""
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
    """Cola de eventos con prioridad que solo se vacía fuera del campo de visión.

    Orden de disparo: mayor prioridad primero; en empate, el programado antes. Seguro para hilos.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._heap: List[Tuple[int, int, str, Dict[Any, Any]]] = []
        self._ids: Set[str] = set()
        self._seq = 0

    def schedule(self, event_id: str, payload: dict, priority: int = 0) -> None:
        """Programa un evento. ValueError si los tipos no son válidos o si el id ya está pendiente."""
        if not isinstance(event_id, str) or not event_id:
            raise ValueError("event_id debe ser un str no vacío")
        if not isinstance(payload, dict):
            raise ValueError("payload debe ser un dict")
        if isinstance(priority, bool) or not isinstance(priority, int):
            raise ValueError("priority debe ser int (no bool)")
        with self._lock:
            if event_id in self._ids:
                raise ValueError(f"el evento {event_id!r} ya está pendiente")
            self._ids.add(event_id)
            heapq.heappush(self._heap, (-priority, self._seq, event_id, payload))
            self._seq += 1

    def tick(self, visibility: float, blink: bool = False) -> list[dict]:
        """Si visibility == 0 o blink, dispara y consume todos los pendientes; si no, devuelve []."""
        level = _check_visibility(visibility)
        if not isinstance(blink, bool):
            raise ValueError("blink debe ser bool")
        if level != 0 and not blink:
            return []
        with self._lock:
            drained = self._heap
            self._heap = []
            self._ids = set()
        drained.sort()
        return [{"event_id": event_id, "payload": payload} for _, _, event_id, payload in drained]

    def pending(self) -> int:
        """Número de eventos que siguen en cola."""
        with self._lock:
            return len(self._heap)
