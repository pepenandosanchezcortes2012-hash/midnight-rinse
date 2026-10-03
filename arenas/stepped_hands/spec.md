# Especificación: `stepped_hands` (`stepped_hands.py`) · Midnight Rinse · Arena 4

## 0. Entrega y restricciones (las comprueban pruebas ocultas y el motor)
- Entrega UN archivo: `stepped_hands.py`, en la raíz, con anotaciones de tipos y docstrings. Python estándar 3.9+, portable a GDScript y C#.
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
ARENA 4 · stepped_hands
 Contrato:
   class SteppedHold:
     __init__(hold_hz: int = 15)
     sample(t: float, pose: Any) -> Any
 Reglas (zero-order hold):
 - hold_hz debe ser int (no bool) mayor o igual que 1; si no, ValueError (15.0 se rechaza).
 - t debe ser int o float (no bool), finito y mayor o igual que 0; si t * hold_hz no es finito, ValueError. Un t menor que el t anterior lanza ValueError. t igual al anterior es válido. Un ValueError no altera el estado interno.
 - slot = floor(t * hold_hz + 1e-9). La primera llamada captura pose. Después, solo se captura una pose nueva cuando el slot cambia; mientras tanto devuelve la pose retenida (el MISMO objeto, sin copiar).
 - Muestreando con t = i / 60 (entero entre entero), cada pose se mantiene exactamente 4 ticks con hold_hz = 15.
 Pruebas adversariales: t en fronteras exactas de slot (1/15, 2/15), 6 000 ticks con t = i / 60 (nunca acumulando), t que retrocede un epsilon, saltos grandes de tiempo, poses mutables, t no numérico, bool, NaN, inf, negativo, hold_hz 0, negativo, 15.0 y bool.
```
