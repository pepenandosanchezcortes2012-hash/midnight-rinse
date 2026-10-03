"""Dithering ordenado Bayer 8x8 a RGB555 (5 bits por canal) para la estética PS1 a 320x240.

Solución de referencia de la Arena 2 (no se muestra a los gladiadores).
"""
from __future__ import annotations

import math
from typing import Any, Tuple

_BAYER = (
    (0, 32, 8, 40, 2, 34, 10, 42),
    (48, 16, 56, 24, 50, 18, 58, 26),
    (12, 44, 4, 36, 14, 46, 6, 38),
    (60, 28, 52, 20, 62, 30, 54, 22),
    (3, 35, 11, 43, 1, 33, 9, 41),
    (51, 19, 59, 27, 49, 17, 57, 25),
    (15, 47, 7, 39, 13, 45, 5, 37),
    (63, 31, 55, 23, 61, 29, 53, 21),
)
_THRESHOLDS = tuple(tuple((value + 0.5) / 64 for value in row) for row in _BAYER)
_LEVELS = tuple(level / 31 for level in range(32))


def _channel(value: Any, threshold: float) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError("cada canal debe ser int o float (no bool)")
    if value != value:
        raise ValueError("NaN no es un canal válido")
    if value <= 0:
        return _LEVELS[min(31, max(0, math.floor(threshold)))]
    if value >= 1:
        return _LEVELS[31]
    level = math.floor(value * 31 + threshold)
    return _LEVELS[min(31, max(0, level))]


def quantize(rgb: tuple[float, float, float], x: int, y: int) -> tuple[float, float, float]:
    """Cuantiza un color a 32 niveles por canal con el umbral Bayer del píxel (x, y)."""
    if isinstance(x, bool) or not isinstance(x, int) or isinstance(y, bool) or not isinstance(y, int):
        raise ValueError("x e y deben ser int (no bool)")
    try:
        size = len(rgb)
    except TypeError as exc:
        raise ValueError("rgb debe tener exactamente 3 elementos") from exc
    if size != 3:
        raise ValueError("rgb debe tener exactamente 3 elementos")
    threshold = _THRESHOLDS[y % 8][x % 8]
    r, g, b = rgb
    out: Tuple[float, float, float] = (_channel(r, threshold), _channel(g, threshold), _channel(b, threshold))
    return out
