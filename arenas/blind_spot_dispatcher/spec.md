# Especificación: `blind_spot_dispatcher` (`blind_spot_dispatcher.py`) · Midnight Rinse · Arena 1

## 0. Entrega y restricciones (las comprueban pruebas ocultas y el motor)
- Entrega UN archivo: `blind_spot_dispatcher.py`, en la raíz, con anotaciones de tipos y docstrings. Python estándar 3.9+, portable a GDScript y C#.
- El archivo DEBE contener `from __future__ import annotations` (como primera instrucción después del docstring del módulo).
- Debe ser válido con la gramática de Python 3.9: una prueba hace `ast.parse(codigo, feature_version=(3, 9))` (nada de `match`, ni otras novedades posteriores a 3.9).
- Solo puedes importar estos módulos de la biblioteca estándar (una prueba recorre los imports con `ast`): `__future__`, `typing`, `math`, `os`, `sys`, `threading`, `tempfile`, `errno`, `datetime`, `time`, `heapq`, `collections`, `itertools`, `functools`, `enum`, `dataclasses`, `numbers`, `pathlib`, `io`, `contextlib`, `stat`, `copy`, `bisect`, `abc`, `weakref`, `operator`, `random`, `fcntl`, `msvcrt`. Cualquier otro import descalifica. Los módulos que no existan en un sistema (`fcntl` en Windows, `msvcrt` en Unix) se importan dentro de `try/except ImportError`.
- Ninguna línea del archivo, incluidos comentarios y docstrings, puede empezar con la palabra `import` o `from` salvo los imports permitidos: el motor descalifica esas líneas como patrón prohibido.
- Sin red, sin lanzar procesos y sin borrar archivos.
- Cómo se prueba: solo `unittest`, pruebas deterministas que repiten las suites 3 veces. Los requisitos de hilos se prueban de forma probabilística (`sys.setswitchinterval(1e-6)` y 200 iteraciones).

## 1. Reglas comunes a todas las arenas (literal)
Módulos Python, un archivo por arena, con anotaciones de tipos y docstrings. Errores: ValueError para entradas inválidas, salvo que se diga otra cosa. En TODAS las arenas se rechaza bool (ValueError) en cualquier parámetro numérico. NaN e infinitos: ValueError, salvo donde se diga que se limitan.

## 2. Contrato, reglas y casos borde (literal)
```text
ARENA 1 · blind_spot_dispatcher (el corazón del horror por oclusión)
 Contrato:
   class Dispatcher:
     schedule(event_id: str, payload: dict, priority: int = 0) -> None
     tick(visibility: float, blink: bool = False) -> list[dict]
     pending() -> int
 Reglas:
 - schedule: event_id debe ser str no vacío, payload dict y priority int (no bool); si no, ValueError. Un event_id que ya está PENDIENTE lanza ValueError. Un id ya disparado se olvida: puede programarse otra vez (eventos recurrentes).
 - tick: visibility es int o float (no bool), finito y en [0.0, 1.0]; blink debe ser bool; si no, ValueError.
 - Si visibility == 0 o blink es True, tick dispara y consume TODOS los eventos pendientes; si no, devuelve [] y no consume nada.
 - Cada evento disparado sale como {"event_id": ..., "payload": ...}, con el MISMO objeto payload (sin copiar). Orden: mayor priority primero; en empate, el que se programó antes.
 - pending() devuelve cuántos eventos quedan en cola.
 - Seguro para hilos: 8 hilos programando y haciendo tick a la vez no duplican ni pierden eventos (requisito probabilístico, ver REGLAS DE PRUEBAS).
 Pruebas adversariales: visibility 1e-12, 0, 0.0 y 1.0, NaN, inf, negativos, 1.0000001, bool y str como visibility, blink no bool, ids duplicados pendientes y reprogramados tras disparar, payload no dict, 50 000 eventos, tick con cola vacía, concurrencia.
```
