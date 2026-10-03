"""Vertex snapping estilo PS1: ajusta x e y del espacio de recorte a la cuadrícula de una resolución virtual.

Solución de referencia de la Arena 3 (no se muestra a los gladiadores).
"""
from __future__ import annotations

import math
from typing import Any, Tuple

EPS = 1e-9
_NDC_LIMIT = 1e6


def _finite(value: Any, name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{name} debe ser int o float (no bool)")
    try:
        result = float(value)
    except OverflowError as exc:
        raise ValueError(f"{name} es demasiado grande") from exc
    if not math.isfinite(result):
        raise ValueError(f"{name} debe ser finito")
    return result


def _resolution(value: Any) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise ValueError("vres debe tener 2 enteros (no bool) mayores que 0")
    return value


def snap(clip: tuple[float, float, float, float], vres: tuple[int, int] = (320, 240)) -> tuple[float, float, float, float]:
    """Ajusta (x, y) de un vértice en espacio de recorte a la cuadrícula vres; z y w no cambian."""
    try:
        if len(clip) != 4:
            raise ValueError("clip debe tener 4 números")
        if len(vres) != 2:
            raise ValueError("vres debe tener 2 enteros")
    except TypeError as exc:
        raise ValueError("clip y vres deben ser secuencias") from exc
    x, y, _z, w = (_finite(c, name) for c, name in zip(clip, ("x", "y", "z", "w")))
    if w <= 0:
        raise ValueError("w debe ser mayor que 0")
    vx, vy = _resolution(vres[0]), _resolution(vres[1])
    try:
        ndc_x = x / w
        ndc_y = y / w
        if not (math.isfinite(ndc_x) and math.isfinite(ndc_y)) or abs(ndc_x) > _NDC_LIMIT or abs(ndc_y) > _NDC_LIMIT:
            raise ValueError("ndc no finito o con valor absoluto mayor que 1e6")
        nx = math.floor(ndc_x * vx + EPS)
        ny = math.floor(ndc_y * vy + EPS)
        out: Tuple[Any, Any, Any, Any] = (nx / vx * w, ny / vy * w, clip[2], clip[3])
    except OverflowError as exc:
        raise ValueError("desbordamiento numérico") from exc
    return out
