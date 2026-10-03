# Especificación: `shift_log` (`shift_log.py`) · Midnight Rinse · Arena 7

## 0. Entrega y restricciones (las comprueban pruebas ocultas y el motor)
- Entrega UN archivo: `shift_log.py`, en la raíz, con anotaciones de tipos y docstrings. Python estándar 3.9+, portable a GDScript y C#.
- El archivo DEBE contener `from __future__ import annotations` (como primera instrucción después del docstring del módulo).
- Debe ser válido con la gramática de Python 3.9: una prueba hace `ast.parse(codigo, feature_version=(3, 9))` (nada de `match`, ni otras novedades posteriores a 3.9).
- Solo puedes importar estos módulos de la biblioteca estándar (una prueba recorre los imports con `ast`): `__future__`, `typing`, `math`, `os`, `sys`, `threading`, `tempfile`, `errno`, `datetime`, `time`, `heapq`, `collections`, `itertools`, `functools`, `enum`, `dataclasses`, `numbers`, `pathlib`, `io`, `contextlib`, `stat`, `copy`, `bisect`, `abc`, `weakref`, `operator`, `random`, `fcntl`, `msvcrt`. Cualquier otro import descalifica. Los módulos que no existan en un sistema (`fcntl` en Windows, `msvcrt` en Unix) se importan dentro de `try/except ImportError`.
- Ninguna línea del archivo, incluidos comentarios y docstrings, puede empezar con la palabra `import` o `from` salvo los imports permitidos: el motor descalifica esas líneas como patrón prohibido.
- Sin red, sin lanzar procesos y sin borrar archivos.
- Esta arena SÍ permite `os.unlink(...)` y `os.remove(...)` para limpiar el archivo temporal de la escritura atómica. `os.replace` está permitido.
- Entorno de prueba: las pruebas corren en Windows (y deben funcionar igual en Unix), con hilos y procesos `spawn` a la vez y lectores que abren el archivo en bucle. Cada ejecución de la suite tiene un límite de 240 s: la sincronización entre hilos y procesos debe ser rápida, no basada en esperas de un segundo.
- Cómo se prueba: solo `unittest`, pruebas deterministas que repiten las suites 3 veces. Los requisitos de hilos se prueban de forma probabilística (`sys.setswitchinterval(1e-6)` y 200 iteraciones).

## 1. Reglas comunes a todas las arenas (literal)
Módulos Python, un archivo por arena, con anotaciones de tipos y docstrings. Errores: ValueError para entradas inválidas, salvo que se diga otra cosa. En TODAS las arenas se rechaza bool (ValueError) en cualquier parámetro numérico. NaN e infinitos: ValueError, salvo donde se diga que se limitan.

## 2. Contrato, reglas y casos borde (literal)
```text
ARENA 7 · shift_log
 Contrato:
   class ShiftLog:
     __init__(base_dir: str = "./records")
     update(phase: str) -> str
 Fases (orden fijo) y textos EXACTOS:
   "start": "Turno asignado sin incidencias. Recuerde fregar el pasillo central cada 45 minutos."
   "customer_talked": "Turno asignado. NO lo mires directamente a la cara. Si te pregunta la hora, dile que faltan cinco minutos para las seis."
   "collapse": "¿Por qué sigues limpiando si sabes que el agua nunca va a volver a ser clara?"
 Reglas:
 - update devuelve el texto de la fase SIN salto de línea final. El archivo base_dir/shift_log.txt contiene exactamente texto.encode("utf-8") + b"\n" (escribir en binario, sin conversión de saltos de línea en Windows).
 - phase debe ser uno de los tres str; cualquier otra cosa (incluidos vacío, "../x", None, int, lista) lanza ValueError.
 - Estado actual = contenido del archivo leído en binario. Si es exactamente el texto de una fase más b"\n", esa es la fase actual; si no (no existe, vacío, contenido ajeno), la fase actual es "ninguna" y cualquier fase válida, incluida "start", lo sobrescribe.
 - La fase nunca retrocede: pedir una fase anterior a la actual no escribe nada y devuelve el texto de la actual. Repetir la misma fase es idempotente.
 - Crea base_dir si no existe (os.makedirs con exist_ok). Si base_dir (sin separadores finales) o el archivo son enlaces simbólicos, ValueError y no escribe nada.
 - Escritura atómica: se escribe a un archivo temporal en la misma carpeta y se renombra con os.replace. Un lector que lea el archivo en cualquier momento ve siempre exactamente un texto válido completo (o el archivo no existe aún), nunca una mezcla. En Windows, os.replace se reintenta (hasta 50 veces cada 10 ms) si falla por PermissionError.
 - Seguro ante escrituras concurrentes de varios hilos y varios procesos: un candado de archivo (base_dir/.shift_log.lock, que se deja en disco) con fcntl.flock en Unix o msvcrt.locking en Windows, importados con try/except ImportError. El archivo termina siempre con la fase más avanzada pedida.
 Pruebas adversariales (todas en tests_hidden, con directorios temporales): enlaces simbólicos y enlace con barra final (se saltan si no se pueden crear), fases con "../" o vacías o no str, texto con acentos y "¿", archivo preexistente con contenido ajeno, 8 hilos y 4 procesos (spawn) pidiendo fases mezcladas, un lector que lee el archivo en bucle mientras otro hace 2 000 updates y afirma que cada lectura es exactamente un texto válido, base_dir sin permiso de escritura (se salta como root o en Windows).
```
