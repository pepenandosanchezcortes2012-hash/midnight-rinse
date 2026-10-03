# Auditoría del material generado por Gemini

Inventario de todo lo que produjo Gemini (Gemini 3.8 Flash High vía Antigravity CLI) durante el Coliseo y decisión sobre cada pieza.

## Inventario

| Material | Origen | Estado | Decisión |
| :--- | :--- | :--- | :--- |
| `blind_spot_dispatcher.py` | Arena 1, campeón G002 (fusión con 3 ideas de los finalistas) | Cadena completa: 8 lotes, 32 gladiadores, `verify` OK, acta final APROBADA (10/10, 20/20, 59/59 adversariales) | **Rescatado y refactorizado** |
| `shift_log.py`, 4 campeones sucesivos (G001, G052, G079, G007) | Arena 7, lotes 1–7 | Cadena interrumpida por cuota en el lote 7 (jurado incompleto: 11/30 votos); ninguno ratificado | **Se rescata G007** (el más robusto), con 2 correcciones |
| Las otras 5 arenas | — | Gemini no compitió en ellas (la cuota se agotó antes) | Se usan las soluciones de referencia del orquestador, validadas con 71 pruebas de mutación |
| Código de los gladiadores perdedores | Actas en `arenas/*/runs/` | Quemado por el Coliseo (solo queda su huella SHA-256) | Descartado |
| Pruebas de humo previas (caché LRU, evaluador de expresiones) | Pruebas de instalación de la skill | Sin relación con el juego | Descartadas |
| Diseño del juego (lavandería, reglas, horarios, textos del registro, audio, shader) | Orden de misión v4 | Documento de diseño | **Conservado íntegro** como base del juego |

## blind_spot_dispatcher (G002) → `core/…/blind_spot_dispatcher.py` y `juego/src/core/dispatcher.js`

**Se conserva:**
- Cubetas por prioridad (`dict[prioridad] → lista`): programar es O(1) y el orden FIFO dentro de cada prioridad sale gratis.
- El candado alrededor del intercambio de cubetas en `tick`: un `tick` concurrente nunca duplica ni pierde eventos.
- La validación completa de tipos: bool rechazado, payload dict, id pendiente duplicado.

**Se corrige y se limpia:**
- `math.isfinite(10**400)` lanzaba `OverflowError`, no el `ValueError` del contrato. Ahora los enteros se validan por rango antes de convertirse.
- Se quita la rama especial que devolvía la lista interna cuando había una sola cubeta: era una optimización sin efecto medible.
- Docstrings en español y en el estilo del resto del núcleo.

## shift_log (G007) → `core/…/shift_log.py` y `juego/src/core/shiftLog.js`

**Se conserva:**
- Candado de hilos por carpeta canónica más candado de archivo entre procesos (`fcntl.flock` en Unix, `msvcrt.locking` no bloqueante con espera progresiva en Windows). Es mejor que la espera fija de la referencia del orquestador.
- Escritura atómica (temporal en la misma carpeta + `os.replace` con 50 reintentos en Windows) y rechazo de enlaces simbólicos, incluido el del archivo de candado.
- Normalización de separadores finales que no rompe raíces como `C:\`.

**Bug real corregido (también estaba en G079):**
- Si la lectura del estado fallaba con `PermissionError` (en Windows, cuando un lector tiene el archivo abierto), el campeón la trataba como "contenido ajeno" y **sobrescribía la fase, que podía retroceder**. Eso viola la regla central del módulo. Ahora la lectura se reintenta y, si sigue fallando, el error se propaga sin escribir nada.

**Limpieza:**
- `except OSError: _err = None` (un truco para no dejar `pass`) se sustituye por `contextlib.suppress(OSError)`.
- Se agrega `fsync` antes del renombrado (durabilidad ante cortes de luz).

## Verificación del rescate
- Las 7 baterías del Coliseo (públicas, ocultas y de restricciones) pasan contra el código refactorizado: **203 pruebas**, de ellas 4 se saltan en Windows (enlaces simbólicos y permisos).
- Los ports a JavaScript coinciden con Python en miles de vectores dorados (`node --test juego/tests/nucleo.test.js`).
- Centinela: 0 hallazgos en `core/`.
