# Especificación: `bayer_rgb555` (`bayer_rgb555.py`) · Midnight Rinse · Arena 2

## 0. Entrega y restricciones (las comprueban pruebas ocultas y el motor)
- Entrega UN archivo: `bayer_rgb555.py`, en la raíz, con anotaciones de tipos y docstrings. Python estándar 3.9+, portable a GDScript y C#.
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
ARENA 2 · bayer_rgb555
 Contrato: quantize(rgb: tuple[float, float, float], x: int, y: int) -> tuple[float, float, float]
 Matriz Bayer 8x8 (fija):
   [ 0, 32,  8, 40,  2, 34, 10, 42]
   [48, 16, 56, 24, 50, 18, 58, 26]
   [12, 44,  4, 36, 14, 46,  6, 38]
   [60, 28, 52, 20, 62, 30, 54, 22]
   [ 3, 35, 11, 43,  1, 33,  9, 41]
   [51, 19, 59, 27, 49, 17, 57, 25]
   [15, 47,  7, 39, 13, 45,  5, 37]
   [63, 31, 55, 23, 61, 29, 53, 21]
 Reglas:
 - rgb debe tener exactamente 3 elementos numéricos (int o float, no bool); si no, ValueError. x e y deben ser int (no bool); pueden ser negativos.
 - umbral = (M[y % 8][x % 8] + 0.5) / 64.
 - Por canal: se limita a [0, 1] (±inf se limita a 0.0 o 1.0; NaN lanza ValueError); nivel = floor(c * 31 + umbral), limitado a 0..31; salida = nivel / 31.
 - La salida siempre es múltiplo de 1/31. Determinista, periódica cada 8 píxeles en x e y, y monótona no decreciente respecto a la entrada para un píxel fijo.
 Pruebas adversariales: 0.0, 1.0, valores exactos k/31, negativos, flotantes diminutos, ±inf, NaN, tuplas de longitud 2 y 4, elementos no numéricos o bool, x e y negativos, x e y bool o float.
```
