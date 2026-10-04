---
name: qa-sentinel-audio
description: Auditor de pruebas de Midnight Rinse. Úsala después de cada cambio al juego y antes de cada commit o despliegue a GitHub Pages. Corre las pruebas (núcleo en Python, vectores JS y partidas en Chrome sin ventana), comprueba que todas las rutas sean relativas y existan con las mayúsculas exactas (cero 404 en Pages), valida el desbloqueo del AudioContext y que el despachador de oclusión no rompa eventos.
---

# Centinela de QA

Su trabajo es prevenir regresiones y que GitHub Pages nunca dé 404.

- **Herramienta:** `py .claude/skills/qa-sentinel-audio/centinela.py [completo]`.
- **Requisito:** el servidor local (`py -m http.server 8765 --bind 127.0.0.1` desde `juego/`).

## Qué revisa
| Paso | Qué | Por qué |
|---|---|---|
| 1 | Cada `src`/`href` de `juego/index.html` es relativo y el archivo existe con las **mayúsculas exactas** | GitHub Pages distingue mayúsculas y Windows no: es la causa típica de 404 |
| 1 | Todos los `?v=` tienen el mismo sello | Mezclar scripts viejos y nuevos de la caché rompe el juego (ya pasó con la guía) |
| 2 | Manifest, `sw.js` y la redirección de la raíz `index.html` → `juego/` | App instalable y sin conexión |
| 3 | Ningún script pide rutas absolutas (`/src…`, `C:\`, `file:`) | Pages sirve el sitio en `/midnight-rinse/` |
| 4 | Textos en inglés completos | La versión en inglés no muestra español suelto |
| 5 | `node juego/tests/nucleo.test.js`: el núcleo JS contra miles de vectores de Python | El **despachador de oclusión** (`src/core/dispatcher.js`) y el resto del núcleo son ports exactos |
| 6 | `juego/herramientas/probar.py`: unas 53 partidas en Chrome sin ventana | Incluye «Audio: el primer toque despierta el ambiente…», los sustos por oclusión, turnos al azar con semilla y la versión en inglés |
| 7 | (completo) `core/tests`: 203 pruebas de Python | La referencia del núcleo |
| 8 | (completo) En vivo: cada recurso responde 200 en Pages y las pruebas pasan allá | El despliegue real, no solo el local |

## Audio (Web Audio)
- Los navegadores crean el `AudioContext` suspendido hasta un gesto. El juego lo despierta con el primer `pointerdown`, `keydown` o `touchstart` (`game.js`). Si el sistema lo suspende a mitad del turno (una llamada, otra app), el siguiente toque lo reanuda.
- La prueba de partida lo verifica con un `AudioContext` suspendido simulado.
- Si se agrega audio nuevo: debe pasar por `MR.AudioEngine` (volumen, ambiente y modo mezcla del iPhone), nunca crear su propio `AudioContext`.

## Despachador de oclusión
- Los sustos «de zona» solo ocurren con la zona fuera de vista o con los ojos cerrados (`Dispatcher.tick(vis, blink)`).
- Toda idea nueva que dependa de la oclusión necesita una prueba que demuestre dos cosas: que **no** ocurre mientras miras y que **sí** ocurre al apartar la vista o parpadear.
- Ejemplos: «Él te observa» y «La tele: su cara en la nieve» en `partida.js`.

## Reglas
- Si algo sale en rojo, no se hace commit. Se arregla y se vuelve a correr.
- Si una prueba falla de vez en cuando, se busca la causa, no se reintenta hasta que pase. Ejemplo: un parpadeo a medias, §53 de REPORTE.
- Después de cada push: `centinela.py completo`, o al menos `probar.py` contra la URL en vivo.
