# Especificación: `detent_dial` (`detent_dial.py`) · Midnight Rinse · Arena 5

## 0. Entrega y restricciones (las comprueban pruebas ocultas y el motor)
- Entrega UN archivo: `detent_dial.py`, en la raíz, con anotaciones de tipos y docstrings. Python estándar 3.9+, portable a GDScript y C#.
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
ARENA 5 · detent_dial
 Contrato:
   class DetentDial:
     __init__(detent_deg: float = 15.0, resistance: float = 0.5, hysteresis_deg: float = 3.0)
     drag(delta_deg: float) -> list[dict]
     angle -> float   (propiedad)
 Reglas:
 - detent_deg > 0 y 360 / detent_deg debe ser un entero (tolerancia 1e-9); resistance en [0, 1); hysteresis_deg en [0, detent_deg / 2); si no, ValueError.
 - El ángulo inicial es 0.0 (se mantiene también un ángulo sin normalizar para los cruces). Todos los retenes empiezan armados, incluido el 0. Empezar exactamente sobre un retén no emite click.
 - drag(delta_deg): delta_deg finito (no bool). Movimiento efectivo e = delta_deg * (1 - resistance); si |e| > 1e6, ValueError. El ángulo sin normalizar va de a_prev a a_new = a_prev + e.
 - Un retén m (múltiplo de detent_deg) se cruza si a_prev < m <= a_new (sentido positivo) o a_new <= m < a_prev (sentido negativo): caer exactamente sobre m cuenta, y salir de m no.
 - Por cada cruce, en orden de recorrido, se emite {"type": "click", "angle": m % 360.0} (nunca 360.0). El retén se desarma al emitir.
 - Un retén desarmado no emite click en otro drag mientras no se rearme. Al final de cada drag, todo retén cuya distancia circular al ángulo final, min(|a - m|, 360 - |a - m|) con ambos valores módulo 360, sea mayor o igual que hysteresis_deg se rearma. Dentro de un mismo drag, el primer cruce de cada retén respeta su estado armado y los cruces posteriores del mismo retén en ese drag (vueltas completas) siempre emiten.
 - Ángulo expuesto: a = angle_sin_normalizar % 360.0; si a >= 360.0 por redondeo, a = 0.0.
 - Determinista: la misma secuencia de drags produce siempre los mismos clicks.
 Pruebas adversariales: drag 0; drag de 720 grados efectivos (24 clicks por vuelta, cada retén dos veces); negativos; vibración de ±0.5 grados sobre un retén (un solo click); cruce de 359 a 0 (click con angle 0.0); resistance 0 y 0.5 (evita valores como 0.999 en los bordes exactos; úsalo solo para comprobar que no revienta); detent_deg 7 o 25 (ValueError, no dividen 360); NaN, inf, bool; |e| de 1e6 + 1.
```
