# Especificación: `vertex_snap` (`vertex_snap.py`) · Midnight Rinse · Arena 3

## 0. Entrega y restricciones (las comprueban pruebas ocultas y el motor)
- Entrega UN archivo: `vertex_snap.py`, en la raíz, con anotaciones de tipos y docstrings. Python estándar 3.9+, portable a GDScript y C#.
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
ARENA 3 · vertex_snap
 Contrato: snap(clip: tuple[float, float, float, float], vres: tuple[int, int] = (320, 240)) -> tuple[float, float, float, float]
 Reglas:
 - clip: 4 números finitos; w > 0; vres: 2 enteros (no bool) mayores que 0; si no, ValueError.
 - ndc = (x / w, y / w). Si algún ndc no es finito o su valor absoluto supera 1e6, ValueError.
 - Con el epsilon fijo EPS = 1e-9 (en unidades de celda): nx = floor(ndc_x * vres[0] + EPS); ny = floor(ndc_y * vres[1] + EPS); x' = nx / vres[0] * w; y' = ny / vres[1] * w. z y w no cambian. (El epsilon hace que la operación sea estable ante el redondeo de punto flotante.)
 - Idempotente: snap(snap(v)) coincide con snap(v) (tolerancia relativa 1e-9) para todo v permitido.
 - El resultado queda en la cuadrícula virtual: x'/w * vres[0] es un entero (tolerancia 1e-6).
 Pruebas adversariales: w muy pequeño y muy grande, ndc negativos, ndc exactos en la rejilla, ndc de 1e6 y 1.0000001e6, vres no estándar, NaN e infinitos, vres con 0 o negativos o bool, 100 000 vectores aleatorios con semilla fija comprobando la idempotencia.
```
