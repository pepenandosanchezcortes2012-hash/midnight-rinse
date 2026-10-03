"""Manos a pasos: retención de orden cero (zero-order hold) para animar las manos a 15 Hz sobre un juego a 60 Hz.

Solución de referencia de la Arena 4 (no se muestra a los gladiadores).
"""
from __future__ import annotations

import math
from typing import Any, Optional


class SteppedHold:
    """Devuelve la última pose capturada y solo captura otra cuando cambia el slot floor(t * hold_hz + 1e-9)."""

    def __init__(self, hold_hz: int = 15) -> None:
        if isinstance(hold_hz, bool) or not isinstance(hold_hz, int) or hold_hz < 1:
            raise ValueError("hold_hz debe ser un int (no bool) mayor o igual que 1")
        self._hz = hold_hz
        self._last_t: Optional[float] = None
        self._slot: Optional[int] = None
        self._pose: Any = None

    def sample(self, t: float, pose: Any) -> Any:
        """Muestrea en el tiempo t (no decreciente) y devuelve la pose retenida (el mismo objeto, sin copiar)."""
        if isinstance(t, bool) or not isinstance(t, (int, float)):
            raise ValueError("t debe ser int o float (no bool)")
        try:
            moment = float(t)
            scaled = moment * self._hz
        except OverflowError as exc:
            raise ValueError("t es demasiado grande") from exc
        if not math.isfinite(moment) or moment < 0:
            raise ValueError("t debe ser finito y mayor o igual que 0")
        if not math.isfinite(scaled):
            raise ValueError("t * hold_hz no es finito")
        if self._last_t is not None and moment < self._last_t:
            raise ValueError("t no puede retroceder")
        slot = math.floor(scaled + 1e-9)
        if self._slot is None or slot != self._slot:
            self._slot = slot
            self._pose = pose
        self._last_t = moment
        return self._pose
