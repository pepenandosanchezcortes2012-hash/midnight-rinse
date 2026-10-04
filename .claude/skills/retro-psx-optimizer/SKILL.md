---
name: retro-psx-optimizer
description: Especialista en el render PS1 y el rendimiento de Midnight Rinse (Three.js r128, WebGL). Úsala al tocar shaders, materiales, texturas, luces, el espejo, las fotos o la tele; al agregar geometría o áreas; o si algo va lento en el celular. Audita vertex snapping, UV afines, tramado Bayer 8×8, RGB555 y la resolución 320×240, y mide llamadas de dibujo, triángulos y ms por área.
---

# Optimizador retro PSX

Cuida dos cosas: que el juego se vea como PlayStation y que corra fluido en PC y celular.

## Cuándo correr
Antes de subir cualquier cambio visual: shaders en `retro.js`, materiales, texturas en `textures.js`, mallas en `world.js`, el espejo, las fotos, la tele o el clima.

## Pasos
1. **Invariantes:** `py .claude/skills/retro-psx-optimizer/auditar_psx.py`
   - Resolución interna 320×240 con NearestFilter, sin antialias y con pixelRatio 1.
   - Vertex snapping: `floor(ndc * uSnapRes)` con `SNAP_RES` 160×120.
   - UV afines, sin corrección de perspectiva: `vUvW = uv * w` y la división en el fragmento. Así se tuerce la textura como en PS1.
   - Tramado Bayer 8×8 (64 niveles) y cuantización RGB555 (31 niveles por canal).
   - Gouraud por vértice con 6 luces como máximo y niebla por vértice.
   - Texturas procedurales de 256 px o menos. El espejo va a 192×144 y las fotos a 320×240.
2. **Medición:** `py .claude/skills/retro-psx-optimizer/auditar_psx.py medir`, con el servidor local corriendo. Usa `juego/tests/rendimiento.html` en Chrome sin ventana y da llamadas de dibujo, triángulos y ms por área (sala, bosque, pasillo con espejo).
   - Umbrales para el celular: 220 llamadas y 60 000 triángulos por cuadro como máximo.
   - Los ms son de CPU con SwiftShader: sirven para comparar versiones, no son los FPS reales.
3. Si algo se pasa o un efecto da tirones en el celular, refactoriza antes de seguir:
   - **Llamadas de dibujo:** juntar mallas estáticas del mismo material (`BufferGeometryUtils.mergeBufferGeometries`) y reusar materiales (`R.material` crea uno nuevo cada vez).
   - **Pasadas extra** (espejo, fotos): solo cuando se ven, a baja resolución, y nunca dentro de un bucle.
   - **Efectos por cuadro:** nada de `new THREE.Vector3()` en el bucle; reusar temporales (`this.tmp`).
   - **Celular:** respetar el ahorro de batería (30 FPS); evitar `readPixels` y `toDataURL` en el bucle (solo en acciones del jugador).
4. Después de refactorizar, compara la tabla de medición antes y después y guárdala en `REPORTE.md`.

## Reglas
- **No «mejorar» lo que es estilo.** Los temblores de los vértices, las texturas que se tuercen, el tramado y la paleta de 15 bits son el look. No se arreglan.
- Todo efecto nuevo pasa por el posproceso existente (`POST_FRAG`) o por los materiales de `R.material`, para heredar la niebla, el tramado y las luces.
- Si un cambio toca `uSnapRes`, `tBayer` o la cuantización, hay que justificarlo en `REPORTE.md`.
