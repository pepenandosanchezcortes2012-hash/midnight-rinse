"""Anomalía del reloj: entre las 02:00 y las 05:00 el horror se triplica y de 03:00 a 04:00 hay susurros.

Solución de referencia de la Arena 6 (no se muestra a los gladiadores). Usa la hora local tal como viene en el
datetime, sin convertir zonas.
"""
from __future__ import annotations

import datetime as _dt


def _hour_of(now: _dt.datetime) -> int:
    if not isinstance(now, _dt.datetime):
        raise TypeError("now debe ser una instancia de datetime")
    return now.hour


def anomaly_multiplier(now: _dt.datetime) -> float:
    """3.0 desde las 02:00:00 (incluido) hasta las 05:00:00 (excluido); 1.0 fuera de esa ventana."""
    return 3.0 if 2 <= _hour_of(now) < 5 else 1.0


def whispers_active(now: _dt.datetime) -> bool:
    """True desde las 03:00:00 (incluido) hasta las 04:00:00 (excluido)."""
    return _hour_of(now) == 3
