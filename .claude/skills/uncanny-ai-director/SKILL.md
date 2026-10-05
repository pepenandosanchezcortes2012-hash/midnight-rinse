---
name: uncanny-ai-director
description: Arquitectura de IA y comportamiento de los NPCs de Midnight Rinse (caras blancas, el niño, las máscaras negras y él, en la sala y en el bosque). Úsala al crear o cambiar cualquier personaje que camine, mire o decida; al tocar clientela.js, horror.js (él) o src/core/director.js; o si un NPC se ve robótico, predecible o se atasca. Toma de decisiones por utilidad, navegación por fuerzas sin atascos, pausa de contemplación, mirada desfasada, respiración, puntos ciegos y mimetismo arbóreo.
---

# Director de IA inquietante

El terror del juego depende de que los personajes **no** se sientan scripts: que parezcan darse cuenta de ti, que no
sean predecibles y que se muevan como cuerpos con peso. Esta skill es el cerebro de conducta de todos ellos.

- **Núcleo:** `juego/src/core/director.js` (puro, sin THREE: se prueba en node). Expone `MR.Director`.
- **Quién lo usa:** `clientela.js` (caras blancas, el niño, las máscaras) y `horror.js` (él, en la sala y en el bosque).
  Pelusa y la gente de la avenida siguen con su cerebro de mosca (`mosca.js`), que convive con esto: el director decide
  *cómo* se mueve y reacciona un cuerpo; la mosca, *qué le llama la atención*.
- **Herramienta:** `py .claude/skills/uncanny-ai-director/revisar_ia.py [partida]`.

## Las piezas (y para qué sirve cada una)
| Pieza | Qué hace | Dónde se nota |
|---|---|---|
| `percibir(j, p)` | Cuánto te mira el jugador: `foco` (<20°), `periferia`, `fuera`, `ojos_cerrados`, `limpiando` (el vaho) | Todo lo demás depende de esto |
| `Utilidad` | Puntúa conductas y elige una; se compromete un rato y lleva ruido (no predecible). `puede=false` congela la decisión | La rutina de las caras blancas; el modo de él |
| `Contemplacion` | Si lo miras **de golpe** (venía de `fuera` hace < 0,35 s), se congela 3–5 s; una mirada lenta o un parpadeo no | Caras y máscaras caminando o esperando |
| `Mirada` | El cuello gira despacio; los ojos (la máscara) se clavan **1 s después** | Las máscaras te siguen |
| `Respiracion` | Respira; a < 1,3 m contiene el aire y para los micro-movimientos | Caras, niño, máscaras |
| `Agente` | Fuerzas de dirección: buscar, llegar frenando, rodear cajas, espacio personal (1 m), inercia, paso pesado, desatasco y A* si no ve el camino | Todo el que camina en la sala |
| `elegirPuntoCiego` | A dónde moverse sin que lo veas aparecer: periferia, acercarse a tu espalda, rutina o lejos | Él |
| `elegirArbol`, `escondite`, `tapado` | Siempre un tronco entre él y tus ojos | Él en el bosque |

## Reglas de diseño (no romper)
1. **Nada de líneas rectas de A a B.** Todo NPC que camina en la sala usa un `D.Agente` con la ruta como guía (los puntos
   de paso se recortan solos si se ve libre el siguiente, y se varían un poco por personaje: `_organica`).
2. **Nunca dentro de una caja de colisión** y **nunca atascado**: el agente resuelve la penetración como el jugador y,
   si no ve libre el punto siguiente, planifica (A* en una cuadrícula de 20 cm). Si de verdad se atasca (no debería),
   solo se resuelve si nadie lo ve.
3. **Inercia:** no se arranca ni se frena en seco (aceleración y frenado limitados; al llegar, se planta en el punto y
   termina de frenar quieto). La única excepción es a propósito: la **contemplación** los congela a media zancada.
4. **El canon manda** (`lorekeeper-blackwood/CANON.md`):
   - Las **caras blancas nunca te miran a los ojos** y no hacen daño: se inclinan hacia ti con la cara girada.
   - **Él solo se mueve cuando no lo miras** (fuera de vista, parpadeando o limpiando el vaho), y nunca aparece a la
     vista: el destino también tiene que estar oculto. En el bosque, detrás de un tronco y lejos (> 7 m) cuenta como oculto.
   - Las **máscaras no hablan**: se comunican con la mirada.
   - Cifras fijas: 6 lavadoras, 4 secadoras. Si un pedido menciona otra máquina («la secadora 07»), se adapta a lo que hay.
5. **Barato:** todo corre por cuadro con unos pocos NPCs. El A* es a demanda (~0,1 ms). Nada de `new` en el bucle salvo
   objetos chicos de contexto.

## Al agregar un NPC o una conducta
1. Si camina: créale un `D.Agente` y muévelo con `paso(dt, mundo)` (`clientela._mundo` arma obstáculos, límites, tú y
   los demás). Las piernas van con `agente.fase` (las pisadas siguen lo que avanza: nunca patina).
2. Si reacciona a tu mirada: `D.percibir` + `D.Contemplacion`. Si te sigue con la vista: `D.Mirada` (cuello + cabeza).
3. Si decide entre varias cosas: `D.Utilidad` con puntajes de 0 a 1 que lean el estado de la tienda (`g.horror.lightLevel()`,
   luces fallando, `g.gameplay.radioProximity` para la estática, `g.dread`) y `puede = per.nivel !== 'foco'` si solo debe
   cambiar de pose cuando no lo miras.
4. Textos nuevos: **lorekeeper-blackwood** y traducción (`juego/herramientas/textos.py --agregar`).
5. Pruebas: una en `juego/tests/director.test.js` si es lógica pura, y una partida en `juego/tests/partida.js`
   (las del director empiezan con «Director de IA»). Toda conducta de oclusión prueba las dos cosas: **no** pasa mirando
   y **sí** pasa sin mirar.
6. `py .claude/skills/uncanny-ai-director/revisar_ia.py partida` y después **qa-sentinel-audio**.
