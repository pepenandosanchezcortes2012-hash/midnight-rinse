# Backlog de Midnight Rinse

Lo maneja la skill `perpetual-task-runner` (`py .claude/skills/perpetual-task-runner/backlog.py`).
Formato: `- [ ] (P1) Título — detalle`. P1 va antes que P2 y P3. Las ideas del motor creativo esperan en «Ideas» hasta aprobarse (`backlog.py aprobar`). Lo que necesita una decisión de diseño grande va a «Bloqueadas».

## Pendientes
- [ ] (P2) Microanomalía «La moneda de canto» (sala) — durante un parpadeo te falta una moneda y en la bandeja del cambiador aparece una moneda parada de canto, girando apenas; sonido de moneda que gira, muy bajito, detrás. «(En la bandeja del cambiador hay una moneda parada de canto. En tu bolsillo falta una.)». Archivos: gameplay.js, horror.js; prueba: con parpadeo forzado.

## Ideas (motor creativo, sin aprobar)
- [ ] (P2) Microanomalía «Ropa doblada» (sala) — mientras no miras el mostrador, aparece una pila de ropa doblada que nadie trajo; al verla: «(Alguien dobló ropa que nadie trajo. Huele a tu suavizante.)». Disparador: despachador de oclusión, zona «mostrador»; sonido de tela (ASMR) detrás de ti; desaparece al parpadear 3 veces. Archivos: world.js (malla), horror.js (evento), historia o subtítulo + traducción; prueba: aparece solo con la zona fuera de vista.
- [ ] (P2) Microanomalía «Huellas mojadas» (sala) — al volver del bosque, huellas mojadas van del vidrio de la entrada al banco amarillo, solo si nadie entró; se secan en 60 s. Gotas (ASMR) cerca de las huellas. «(Hay huellas mojadas en el piso que van del vidrio al banco amarillo. Son de tu talla.)». Archivos: world.js (calcomanías), bosque.js (al volver), horror.js.
- [ ] (P3) Variación de bosque «La segunda farola» (noches de niebla) — más adentro del sendero aparece otra farola encendida; si caminas hacia ella siempre está a la misma distancia; al darte vuelta y volver a mirar, está apagada. Sin sonido salvo el zumbido eléctrico, que se corta. Archivos: world.js (_forest), bosque.js; respeta «el bosque tiene borde» (CANON §1 y §7).
- [ ] (P3) Variación de radio «Dedicatoria» (noche 3 en adelante, solo si escribiste tu nombre) — al final de la transmisión de las 02:40: «Antes de irnos: esta va para alguien que sigue doblando ropa ajena a esta hora. Ya sabe quién es.» y, si diste nombre, un susurro con él entre la estática. Archivos: game.js (radio), historia.js; prueba: noche 3 con y sin nombre.

## Bloqueadas (necesitan decisión)
- [ ] (P1) Lore: decidir las propuestas de Yesda — el embalse de 1986, las caras blancas, las órdenes de las máscaras negras, el bosque infinito y el nombre «Blackwood» (CANON.md §7). Hasta decidir, lore_check.py los rechaza en textos del juego. — BLOQUEADA: decisión de diseño de Yesda

## Hechas
- [x] (P3) Medir el rendimiento antes y después de cada cambio visual — guardar la tabla de auditar_psx.py medir en REPORTE.md para comparar versiones (llamadas, triángulos, ms). — commit b705c71 (2026-10-04)
- [x] (P2) Cargar textos_en.js solo en inglés — quien juega en español no necesita bajar ~80 KB de traducciones; idioma.js lo inserta antes de los demás scripts y el service worker lo sigue guardando para jugar sin internet. — commit b705c71 (2026-10-04)
