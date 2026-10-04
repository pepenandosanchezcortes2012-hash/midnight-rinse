# Changelog de Midnight Rinse

Registro por sprint del **modo de evolución autónoma** (pedido por Yesda). Cada sprint pasa por las cinco skills de `.claude/skills/`: planificación, creatividad y canon, código, auditoría PS1, QA y despliegue. Aquí quedan también las **decisiones** que se tomaron sin preguntar, como pide el protocolo: cuando había dos caminos válidos, se eligió el que mejor conserva el «terror tranqui PS1».

Juego publicado: https://pepenandosanchezcortes2012-hash.github.io/midnight-rinse/

## Sprint 1 — Blackwood llega al mostrador

### Lo que ya existía (verificado, no reimplementado)
- **Zero-HUD táctil:** joystick invisible a la izquierda, mirada a la derecha, tocar para usar, doble toque para parpadear, vibración. Lo cubren las pruebas de `touch.js` y del juego.
- **Fumar y beber:** cigarro (humo, lentes empañados), petaca (mareo, más parpadeos), porro (tiempo estirado, distorsión) y café. Prueba «Consumibles».
- **Salida al bosque:** puerta de vidrio, sendero, claro con la lavadora, hojas, la farola anómala de la niebla y el tendedero de luna llena. Varias pruebas de bosque.

### Nuevo
- **Canon de Blackwood** (CANON.md §7, aprobado por Yesda): el pueblo bajo el embalse (1986), las caras blancas, las máscaras negras (la Administración del Embalse) y el bosque infinito. `lore_check.py` ahora exige que el embalse sea de 1986 y que las máscaras no hablen.
- **Clientela de Blackwood** (`clientela.js`):
  - Las **caras blancas** entran por la puerta de vidrio (3 a 5 entre 01:15 y 02:15, a veces una tardía), ponen a lavar su ropa empapada en una lavadora libre, que arranca de verdad y ayuda a tapar el zumbido. Murmuran algo, responden si les hablas y se van. Si las miras de cerca, giran la cara.
  - Las **máscaras negras** llegan a las 02:50 (y a veces a las 04:05), se paran frente al mostrador sin hablar, y la impresora térmica entrega una **ORDEN** numerada que queda en el Archivo.
- **Diálogos con Gemini** (agy, en la computadora de Yesda): 40 líneas (12 de llegada, 10 de respuesta, 6 de despedida y 12 órdenes) con su traducción. Revisadas a mano y contra el canon; 6 corregidas.

### Decisiones (tomadas sin preguntar)
- **Gemini no corre en vivo en la página:** haría falta publicar una clave de API en GitHub Pages. Se usa para generar los diálogos en la computadora de Yesda, que después se revisan y se programan con voz y subtítulos.
- **Cómo se conecta el lore aprobado:** Blackwood es el pueblo bajo el embalse; La Espuma abrió en 1987 en la orilla nueva (encaja con el ticket de 1987 y con «el agua nunca va a volver a ser clara»). Las caras blancas son sus vecinos: inofensivos y amables, porque el miedo es él y las caras blancas son la vida rara. Las máscaras negras son la Administración del Embalse: no hablan, solo imprimen órdenes que nunca contradicen las reglas del turno.
- **Las caras blancas nunca te quitan tu lavadora:** nunca toman una con tu moneda adentro ni una con la puerta abierta. En la noche sin agua, su lavadora tampoco arranca.
- **Si estás en su camino, esperan:** no te empujan ni te atraviesan.
- **Solo llegan si estás en la sala:** si estás en el bosque o el pasillo, esperan a que vuelvas, para que no te pierdas la visita.

### Calidad
- Pruebas: 64/64 partidas (nueva: «Blackwood: una cara blanca pone a lavar y se va; una máscara negra deja una orden impresa»), núcleo JS y Python, rutas sin 404 y versión en vivo.
- Textos: 708 (todos traducidos).

## Sprint 2 — Pelusa con rutinas y una ciudad con vida

### Pelusa (hecho)
- Rutina por hora: dormir, comer (plato nuevo), acicalarse, mirar y rascar la puerta de vidrio, ronda, seguirte, siesta y quedarse cerca.
- **Decisión:** la alarma (bufar y huir cuando él está cerca) sigue mandando sobre la rutina. Es la mecánica que avisa dónde está él, y no se toca.
- **Decisión:** la rutina va en el orden de la noche para que se note la progresión: primero tranquila y doméstica, después vigilante (la puerta, la ronda) y al final pegada a ti.

### La avenida (hecho)
- Dos vidrieras a la avenida de Blackwood: autos, gente con paraguas, ventanas, letreros y lluvia. Se vacía con la hora y, desde las 03:30, se inunda.
- **Decisión:** la puerta de vidrio sigue llevando al bosque, y por las vidrieras se ve la ciudad. El contraste es a propósito: Blackwood es un lugar que no es lo que parece desde adentro.
- **Decisión:** la ciudad se inunda despacio en vez de desaparecer de golpe. Es la forma «tranqui» de contar el embalse de 1986, sin sustos.
- **Decisión:** vidrieras sin vidrio dibujado. Un vidrio semitransparente agujerearía el lienzo (el canal alfa se usa para la tele), así que se ven abiertas, con lluvia afuera.
- **Decisión:** solo el letrero de la farmacia se traduce en la versión en inglés. La tortillería y el hotel son nombres del lugar.
- Rendimiento: 151 llamadas de dibujo en la sala (umbral 220).

## Sprint 3 — El bosque infinito

- **Bosque infinito y no euclidiano:** en el borde, un parpadeo te devuelve al otro lado. A la segunda vuelta aparece **la secadora solitaria** («La Espuma · 1987»), con un logro oculto.
- **Pista zen / lo-fi** procedural solo en el bosque: acordes suaves, campanitas y crepitar de vinilo. Baja con el miedo.
- **Decisión:** el salto ocurre en un parpadeo, no con un fundido ni a la vista. Así respeta la regla del juego (lo que no ves puede cambiar) y no rompe la inmersión.
- **Decisión:** la pista es procedural (Web Audio) en vez de un archivo de música. No pesa nada, no necesita derechos y se puede bajar con el miedo en tiempo real.
- **Decisión:** las farolas anómalas y el tendedero ya existían (niebla y luna llena), así que este sprint no las duplica.
- **Calidad:** las pruebas en Chrome sin ventana ahora permiten audio sin gesto, para probar el sonido de verdad. 67/67.

## Sprint 4 — Personajes que hablan, anomalías y secretos

### Conversaciones (hecho)
- Las caras blancas conversan: cuatro preguntas, tres respuestas posibles cada una (Gemini, revisado) y una despedida. Lo que te dijeron queda en el Archivo.
- **Decisión:** se reusa la lista de respuestas de la pregunta de la hora, sin una interfaz nueva, para no sumar HUD. Esa pregunta siempre gana: él es el centro del turno.
- **Decisión:** las respuestas sobre él solo repiten las reglas (no mirarlo, la respuesta segura) y dan pistas («llegó antes del agua»). Nunca explican quién es.
