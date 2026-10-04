---
name: lorekeeper-blackwood
description: Guardián del canon y la narrativa diegética de Midnight Rinse. Úsala antes de agregar o cambiar cualquier texto del juego (ticket de la impresora, radio, teléfono, hojas del bosque, susurros, objetos perdidos, casilleros, notas del gerente, subtítulos, finales) o al discutir la historia. Mantiene CANON.md y verifica que cada texto aporte al misterio sin contradecir lo establecido.
---

# Guardián del canon

- **Archivo maestro:** `.claude/skills/lorekeeper-blackwood/CANON.md`.
- **Verificador:** `py .claude/skills/lorekeeper-blackwood/lore_check.py ["texto nuevo" …]`.

## Antes de que un texto entre al juego
1. Leer las secciones relevantes de **CANON.md**: el lugar, el tiempo, él, los que estuvieron antes y las reglas del misterio.
2. Correr `lore_check.py "texto"`. Detecta solo:
   - una hora verdadera que no sea las 05:13;
   - un turno que no sea de 01:10 a 05:12;
   - Radio Nocturna fuera de la 94.1;
   - números equivocados de casilleros u hojas;
   - firmas o fechas fuera de orden;
   - llamadas sin la instrucción «faltan cinco minutos para las seis»;
   - él atacando;
   - elementos sin aprobar.
3. Revisión a mano, con tres preguntas:
   - **¿Aporta al misterio?** Agrega una pista o una sensación nueva y no repite lo que ya dice otro texto (`midnight-creative-engine/estado.py` los lista).
   - **¿Explica de más?** Nada se explica del todo: él no tiene nombre ni motivo, y el bosque no tiene origen confirmado.
   - **¿Es diegético?** Lo dice algo del mundo (la impresora, la radio, una hoja, una etiqueta, el teléfono), no un narrador externo. Los subtítulos entre paréntesis describen lo que haces o percibes.
4. Si el texto agrega un hecho nuevo (una fecha, un nombre, un lugar, una regla), **CANON.md se actualiza en el mismo commit**.
5. Traducción con el glosario fijo (`juego/herramientas/textos.py --agregar`): la «hora verdadera» siempre es *five thirteen* y la instrucción siempre es *it's five minutes to six*.

## Lo que no se toca sin decisión de Yesda
- La sección **§7 de CANON.md**: el embalse de 1986, las caras blancas, las máscaras negras, el bosque infinito y el nombre «Blackwood». Mientras estén ahí, `lore_check.py` los rechaza en textos del juego.
- Los textos del registro (`juego/src/core/shiftLog.js`) también viven en el núcleo de Python (`core/midnight_rinse_core/shift_log.py`) y en sus vectores de prueba.
- Las cifras fijas: 6 hojas, 7 casilleros, 6 lavadoras, 4 secadoras, 94.1 y 99.9, la hora verdadera 05:13, la instrucción del teléfono.

## Para mantener el canon al día
- Al aprobar una propuesta de §7: moverla a la sección que le toca, quitar su patrón de `NO_APROBADOS` en `lore_check.py` y anotar la decisión con fecha.
- Al agregar contenido (una llamada, un objeto, una transmisión): actualizar la §6 (inventario).
