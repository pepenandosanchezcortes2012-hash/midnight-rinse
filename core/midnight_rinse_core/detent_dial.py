"""Perilla con retenes (detents): emite clicks al cruzar posiciones fijas, con histéresis para no vibrar.

Solución de referencia de la Arena 5 (no se muestra a los gladiadores).
"""
from __future__ import annotations

import math
from typing import Any, Dict, List, Set

_MAX_EFFECTIVE = 1e6


def _number(value: Any, name: str) -> float:
    """int o float (no bool), finito; si no, ValueError."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{name} debe ser int o float (no bool)")
    try:
        result = float(value)
    except OverflowError as exc:
        raise ValueError(f"{name} es demasiado grande") from exc
    if not math.isfinite(result):
        raise ValueError(f"{name} debe ser finito")
    return result


class DetentDial:
    """Perilla de retenes cada `detent_deg` grados, con resistencia al arrastre e histéresis de rearme."""

    def __init__(self, detent_deg: float = 15.0, resistance: float = 0.5, hysteresis_deg: float = 3.0) -> None:
        detent = _number(detent_deg, "detent_deg")
        if detent <= 0:
            raise ValueError("detent_deg debe ser mayor que 0")
        ratio = 360.0 / detent
        count = round(ratio)
        if count < 1 or abs(ratio - count) > 1e-9:
            raise ValueError("360 / detent_deg debe ser un entero")
        res = _number(resistance, "resistance")
        if not 0.0 <= res < 1.0:
            raise ValueError("resistance debe estar en [0, 1)")
        hyst = _number(hysteresis_deg, "hysteresis_deg")
        if not 0.0 <= hyst < detent / 2.0:
            raise ValueError("hysteresis_deg debe estar en [0, detent_deg / 2)")
        self._detent = detent
        self._count = int(count)
        self._factor = 1.0 - res
        self._hysteresis = hyst
        self._raw = 0.0
        self._disarmed: Set[int] = set()

    @property
    def angle(self) -> float:
        """Ángulo normalizado en [0, 360)."""
        a = self._raw % 360.0
        return 0.0 if a >= 360.0 else a

    def drag(self, delta_deg: float) -> list[dict]:
        """Gira la perilla y devuelve los clicks de los retenes cruzados, en orden de recorrido."""
        delta = _number(delta_deg, "delta_deg")
        effective = delta * self._factor
        if abs(effective) > _MAX_EFFECTIVE:
            raise ValueError("el movimiento efectivo supera 1e6 grados")
        d = self._detent
        a_prev = self._raw
        a_new = a_prev + effective
        clicks: List[Dict[str, Any]] = []
        seen: Set[int] = set()

        def cross(j: int) -> None:
            k = j % self._count
            if k in seen or k not in self._disarmed:
                angle = (j * d) % 360.0
                clicks.append({"type": "click", "angle": 0.0 if angle >= 360.0 else angle})
                self._disarmed.add(k)
            seen.add(k)

        if effective > 0:
            j = math.floor(a_prev / d)
            while j * d <= a_prev:
                j += 1
            while (j - 1) * d > a_prev:
                j -= 1
            while j * d <= a_new:
                cross(j)
                j += 1
        elif effective < 0:
            j = math.ceil(a_prev / d)
            while j * d >= a_prev:
                j -= 1
            while (j + 1) * d < a_prev:
                j += 1
            while j * d >= a_new:
                cross(j)
                j -= 1
        self._raw = a_new
        final = self.angle
        for k in list(self._disarmed):
            diff = abs(final - (k * d) % 360.0)
            if min(diff, 360.0 - diff) >= self._hysteresis:
                self._disarmed.discard(k)
        return clicks
