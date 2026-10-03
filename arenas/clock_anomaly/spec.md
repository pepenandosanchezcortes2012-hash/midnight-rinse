# Especificación: `clock_anomaly` (`clock_anomaly.py`) · Midnight Rinse · Arena 6

## 0. Entrega y restricciones (las comprueban pruebas ocultas y el motor)
- Entrega UN archivo: `clock_anomaly.py`, en la raíz, con anotaciones de tipos y docstrings. Python estándar 3.9+, portable a GDScript y C#.
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
ARENA 6 · clock_anomaly
 Contrato:
   anomaly_multiplier(now: datetime) -> float
   whispers_active(now: datetime) -> bool
 Reglas:
 - Se usa la hora local tal como viene en el datetime (hora, minuto, segundo, microsegundo), sin convertir zonas.
 - anomaly_multiplier devuelve 3.0 desde 02:00:00.000000 (incluido) hasta 05:00:00 (excluido); fuera de esa ventana, 1.0.
 - whispers_active es True desde 03:00:00 (incluido) hasta 04:00:00 (excluido); fuera, False.
 - Si now no es una instancia de datetime (por ejemplo un date o un str), TypeError.
 Pruebas adversariales: 01:59:59.999999, 02:00:00, 04:59:59.999999, 05:00:00, 02:59:59.999999, 03:00:00, 03:59:59.999999, 04:00:00, medianoche, 23:59:59, datetimes con datetime.timezone, date puro, str, None.
```
