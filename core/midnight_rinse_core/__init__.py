"""midnight_rinse_core: núcleo lógico verificado de Midnight Rinse (Turno de Medianoche).

Siete módulos de Python estándar (3.9+), sin dependencias, portables a GDScript/C# y portados a JavaScript en
juego/src/core. Cada uno tiene su batería de pruebas en core/tests (públicas, ocultas y de restricciones).

Origen:
- blind_spot_dispatcher, shift_log: campeones de Gemini en el Coliseo, refactorizados (ver AUDITORIA.md).
- bayer_rgb555, vertex_snap, stepped_hands, detent_dial, clock_anomaly: soluciones de referencia del
  orquestador, validadas con pruebas de mutación (Gemini no llegó a competir en esas arenas por cuota).
"""
from __future__ import annotations

from .bayer_rgb555 import quantize
from .blind_spot_dispatcher import Dispatcher
from .clock_anomaly import anomaly_multiplier, whispers_active
from .detent_dial import DetentDial
from .shift_log import PHASES, TEXTS, ShiftLog
from .stepped_hands import SteppedHold
from .vertex_snap import snap

__all__ = [
    "Dispatcher", "quantize", "snap", "SteppedHold", "DetentDial", "anomaly_multiplier", "whispers_active",
    "ShiftLog", "PHASES", "TEXTS",
]
__version__ = "1.0.0"
