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

### Secretos y anomalías (hecho)
- **La campana de la escuela** (tercera vuelta del bosque): suena bajo el agua, otra contesta y, al volver, una máscara deja la ORDEN N.º 22. Logro oculto.
- **«1986» en el vaho**, escrito al revés desde afuera, sin que lo veas escribirse.
- **Decisión:** la campana y la orden 22 se conectan por causa y efecto, y nunca se explica. Es la regla del canon: cada cosa agrega una pista, nunca la respuesta.
- **Decisión:** el «1986» va en espejo. Es un detalle que se entiende solo («desde afuera»), sin texto de más.

## Sprint 5 — La vida conectada

- Pelusa le bufa a las máscaras negras y acompaña a las caras blancas. Las caras cruzan la avenida (por la vidriera) antes de entrar. La vigía mira la lavandería desde la vereda de enfrente.
- **Decisión:** las máscaras asustan a Pelusa igual que él; las caras blancas no. El gato es el mejor detector de qué es peligroso, así que el jugador aprende sin que nadie se lo diga.
- **Decisión:** las caras blancas se quedan 22 s (antes 9). Es coherente con sus propias líneas («esperamos a que termine el centrifugado»), da tiempo a conversar y a que Pelusa llegue.
- **Decisión:** si el gato acompaña a alguien, no lo hace mientras duerme. La rutina manda.

## Sprint 6 — El amanecer en Blackwood

- El final verdadero se juega: la lavandería a oscuras a las 05:13, la avenida de día, pájaros, la farmacia por fin apagada y la puerta de vidrio que da a la calle.
- **Decisión:** es la única vez que la puerta no lleva al bosque. Es la recompensa del final y cierra el contraste entre la vidriera y la puerta que se abrió en el Sprint 2.
- **Decisión:** el reloj se queda en 05:13 y no hay sustos. Es un momento de calma; el jugador decide cuándo irse.
- **Decisión:** la luz es gris de mañana, no un sol brillante. Mantiene la paleta PS1 apagada y el tono melancólico de Blackwood.

## Sprint 7 — Tocar en el celular y variaciones de los personajes

- 7a: una prueba de toques con el dedo encontró que el parteluz de la vidriera tapaba el toque. Corregido: los marcos son inertes al rayo.
- 7b: la caja de la segunda máscara (placa del puente, objeto 16), la cara blanca que se despide desde la avenida y la cara blanca en el espejo.
- **Decisión:** la placa no sale de las lavadoras para que la caja tenga sentido como regalo. Un jugador que ya tenía los 15 objetos ve el contador subir a 16.
- **Decisión:** la despedida y la cara del espejo son probabilísticas (50 % y 40 %), para que no se vuelvan rutina.
- **Decisión:** en la prueba del espejo, el umbral de la cara blanca es menor que el de él. Se comprobó con captura que se ve; el abrigo pardo tiene menos contraste que el traje negro.

## Sprint 8 — Lo que recuerdan, lo que mira Pelusa y el puente

- 8a: preguntas condicionadas en la charla con las caras blancas (Gemini, revisado).
- **Decisión:** como mucho dos preguntas nuevas por charla, primero las más inmediatas (Pelusa, vigía) y después las de memoria larga (placa, mañana). Con más de siete opciones la lista no cabe bien en un celular horizontal.
- **Decisión:** las respuestas de la placa son la pista del puente del bosque. Así el secreto se puede descubrir sin guía.
- 8b: Pelusa mira el banco amarillo (anomalía) y el puente de Blackwood (secreto de la cuarta vuelta, con la placa).
- **Decisión:** el puente aparece en la cuarta vuelta, después de la campana (tercera). Cada vuelta más adentro guarda algo más viejo del pueblo.
- **Decisión:** la placa cuenta aunque la hayas conseguido en otra noche (la colección es permanente). Así el secreto no exige que en la misma noche vengan dos máscaras y además des cuatro vueltas.
- **Decisión:** Pelusa no sufre ni huye al mirar el banco. Solo mira; el susto es el crujido, y solo si el jugador mira el banco.

## Sprint 9 — La avenida tiene horario

- El autobús 86 «BLACKWOOD», la barredora de la 01:40 y las conversaciones entre dos caras blancas (Gemini, revisado).
- **Decisión:** el autobús trae a las visitas que ya estaban por venir, sin sumar visitas nuevas. Así no cambia el ritmo de la noche ni la cantidad de caras.
- **Decisión:** en el primer 86 bajan siempre dos caras. Las conversaciones entre ellas necesitan que coincidan, y antes casi nunca pasaba (cada visita dura unos 22 s).
- **Decisión:** se callan si te acercas. Refuerza que no hablan para ti y te invita a escuchar desde lejos.
- **Decisión:** la barredora pasa a la 01:40 y no a las 04:20, porque desde las 03:30 la calle se inunda.

## Sprint 10 — Radio Nocturna en vivo

- Boletines del locutor a la 01:45, 02:10, 03:30 y 04:30 (solo en la 94.1) que comentan la noche: el 86, la barredora, el embalse y el puente.
- **Decisión:** los boletines no comparten la hora de las 02:40, que sigue siendo el mensaje especial de cada noche.
- **Decisión:** a las 02:10, prioridad para lo que viste esa noche (el 86, si no la barredora). El embalse queda de relleno, y es lo único que también puede sonar a las 03:30, cuando empieza a subir el agua.
- **Decisión:** sin locutor (noche 9 en adelante), tampoco hay boletines. La estática de siempre.
- Herramienta: `fuzz.py` (turnos completos con semilla) ahora vive en el repo.

## Sprint 11 — Favores y regalos

- La moneda para la secadora (con la moneda extranjera de regalo), Pelusa que trae una aguja de pino del bosque y el 86 que pasa bajo el agua.
- **Decisión:** la moneda que te dan es la que ya existía en la colección («de ningún país que conozcas»). Así su descripción por fin tiene historia: es dinero de Blackwood.
- **Decisión:** la cara pide la moneda antes de la charla y después la charla sigue. El favor no reemplaza la conversación.
- **Decisión:** el 86 bajo el agua es solo luz y sonido. Sin el autobús entero, el agua sigue siendo opaca (el canvas no usa transparencias).

## Sprint 12 — Modelos 3D

- Pelusa, las caras blancas, las máscaras negras y él, mejorados sin dejar el estilo PS1 (pocas caras, sin suavizado, texturas de 16 a 32 px). Hay una galería para revisarlos.
- **Decisión:** formas de pocas caras (esferas de 7×5, cilindros de 6 lados) en vez de solo cajas. Mejora la silueta sin perder el aire de PS1 y casi sin costo.
- **Decisión:** el rostro de él sigue siendo pequeño y está en sombra. Asusta más lo que apenas se ve, y el juego pide no mirarlo a la cara.
- **Decisión:** el collar de Pelusa queda casi oculto bajo la cabeza, como en un gato de verdad; se ve de costado.
- Herramientas: servidor temporal en las pruebas (ya no hace falta dejar uno encendido).

## Sprint 13 — La clientela camina

- Brazos y piernas con articulación: las caras blancas balancean al caminar y las máscaras caminan rígidas.
- **Decisión:** balanceo de 0,42 rad para las caras y de 0,16 para las máscaras. La rigidez de la Administración se nota sin decir nada.

## Sprint 14 — El niño de cara blanca

- A veces una cara blanca llega con un niño de impermeable amarillo: acaricia a Pelusa, se esconde si le hablas y le pregunta cosas bajito al adulto.
- **Decisión:** el niño es un acompañante del adulto, no un visitante. No rompe los límites de visitas ni cambia el ritmo de la noche.
- **Decisión:** el impermeable amarillo lo hace legible de lejos en la sala gris y repite el amarillo del banco y de la placa del cambiador.
- **Decisión:** nunca se explica qué le pasó. La melancolía queda en lo que pregunta («¿Mis calcetines ya están secos?»).

## Sprint 15 — La ropa gira

- Ropa que gira por el ojo de buey de las lavadoras y en las secadoras en marcha (antes no se veía nada).
- **Decisión:** se reemplazó la barra oculta en vez de hacer transparente el vidrio. El canvas usa alfa 0 para la tele de YouTube, así que el juego evita las transparencias.

## Sprint 16 — El cerebro de mosca

- `mosca.js`: un cerebro de *Drosophila* en miniatura (anillo E-PG, cuerpo fungiforme con dopamina, reloj y neuronas descendentes) para Pelusa, las caras blancas, el niño y la gente de la avenida.
- **Decisión:** miniatura en vez del conectoma completo. Corre en el celular y conserva la estructura que da a la mosca su comportamiento: atención, aprendizaje y selección de acción.
- **Decisión:** el cerebro tuerce la rutina sin reemplazarla. La rutina por hora sigue siendo la base (el reloj), y el cerebro decide cuando hay cariño o miedo de por medio.
- **Decisión:** las caras blancas nunca te miran ni con cerebro: tu dirección entra como estímulo negativo, que es inhibición lateral.
- **Decisión:** él y las máscaras no llevan cerebro, por lore.

## Sprint 17 — Todos los modelos (1): la avenida

- Se corrigió el z-fighting de las fachadas (las «rayas» eran eso) y de otras superficies lejanas. Edificios con cornisa y puertas, autos con ruedas y ventanillas, gente con cara y paraguas en la mano.
- **Decisión:** separar las superficies según la precisión real (z²/3277 m) en vez de cambiar el buffer de profundidad. Es más seguro en celulares viejos.

## Sprint 18 — Todos los modelos (2): la sala

- Teléfono público completo, cambiador con letrero y ranura, café con vasito y luz, tele con antenas.

## Sprint 19 — Todos los modelos (3): el pasillo

- Caldera con manómetro, válvula, rejilla y caños; etiqueta de advertencia en los fusibles.

## Sprint 20 — Todos los modelos (4): el bosque

- Farola con base, brazo y carcasa; fachada con alero, marco y bajantes.

## Sprint 21 — Todos los modelos (5): tus manos

- Dedos de dos falanges, puño de la manga y reloj de pulsera; la piel de cada mano en una sola malla (menos llamadas de dibujo).
- **Decisión:** el reloj no muestra la hora. El juego no tiene HUD y la hora del turno vive en el reloj de pared.

## Sprint 22 — Ventanas con vida

- Sombras que cruzan, teles que titilan y una cara blanca en una ventana (una vez por noche).
- **Decisión:** la cara es pequeña y se apaga al verla. Es un detalle para quien mira por la vidriera, no un susto.

## Sprint 23 — Él, quieto

- Su cabeza se inclina mientras no lo miras; de cerca, no respira.
- **Decisión:** el cambio es lento y acumulativo, y nunca ocurre a la vista. El jugador lo descubre comparando, no con un salto.

## Sprint 24 — El cerebro oye

- Los sonidos del juego entran al cerebro de mosca: Pelusa y las caras blancas voltean hacia donde sonó algo.
- **Decisión:** el sonido pesa más y llega más lejos que lo que se ve. Así gana la competencia en el anillo, como un sobresalto.

## Sprint 25 — Lo que recuerda Pelusa

- Panel en la pantalla de título con lo que aprendió su cerebro de mosca: cariño, miedos y el niño.
- **Decisión:** se muestra en palabras, no en números. El jugador entiende el cariño sin ver la neurociencia, aunque todo sale de las sinapsis del cuerpo fungiforme.

## Sprint 26 — Pelusa al amanecer

- En el final verdadero, Pelusa va a la puerta. Si te tiene cariño (cerebro de mosca), sale contigo a la calle.
- **Decisión:** el cariño acumulado en todas las noches cambia el cierre del juego, en una frase. Es la recompensa de haberla cuidado.
- `probar.py` falla si la página de pruebas no terminó.

## Sprint 27 — Lo que la cámara ve

- En las fotos, las caras blancas (y el niño) tienen el rostro de antes. Logro oculto «Retrato».
- **Decisión de canon:** extensión del §7. La cámara ve lo que el ojo no ve; a simple vista nada cambia. Los ojos de la foto miran hacia un lado, y la regla de que nunca te miran se mantiene.

## Sprint 28 — Lo que la cámara ve (2)

- Las máscaras no salen en las fotos; los pasajeros del 86 tienen cara.
- **Decisión:** la cámara revela la naturaleza de cada uno. Las caras blancas fueron personas; las máscaras nunca estuvieron.

## Sprint 29 — La cámara ve el agua

- En las fotos, la avenida está inundada y bajo el puente corre el río.
- **Decisión:** la cámara muestra la verdad de Blackwood (está bajo el agua). Es el cierre del tema de «lo que la cámara ve» (Sprints 27 a 29).
- `probar.py`: un reintento avisado si Chrome entrega la página a medias.

## Sprint 30 — El álbum recuerda

- Pie de foto con lo que la cámara reveló y borde dorado en las fotos que revelaron algo.

## Director de IA — los clientes dejan de tener «cerebro de mosca» para moverse (pedido por Yesda)

- Skill nueva **`uncanny-ai-director`** y núcleo puro `juego/src/core/director.js` (se prueba en node): percepción de tu mirada, decisiones por utilidad, pausa de contemplación, mirada desfasada, respiración, navegación por fuerzas con A* de respaldo, puntos ciegos y mimetismo arbóreo.
- **Caras blancas, el niño y las máscaras** caminan con inercia y paso pesado, rodean lo que estorba, nunca se atascan y te esperan a un metro si les tapas la puerta (si solo estás en medio, te rodean). Si los miras de golpe se congelan de 3 a 5 s; si te acercas, dejan de respirar.
- **Caras blancas:** rutinas por utilidad (mirar el tambor, doblar una prenda que no está, contar monedas, correrse al borde de tu vista), que solo cambian cuando no las miras de frente. Si insistes: señalan el tambor y después se inclinan hacia ti sin mirarte.
- **Máscaras:** el cuello te sigue y la máscara se clava un segundo después. A veces vienen dos (una vigila la puerta de vidrio, pasos desfasados 0,8 s). Desde las 03:00 se van por la puerta trasera y la dejan entreabierta.
- **Él:** se mueve solo a puntos ciegos (borde de tu vista, a tu espalda o su rutina), según luces, radio y miedo; tarda 3–5 s en reaccionar si lo miraste; deja señuelos (moneda mojada, ticket doblado); en el bosque, siempre un pino entre los dos.
- **Decisiones (adaptado al canon):**
  - «La secadora 07» no existe (canon: 4 secadoras). El «ciclo» de las máscaras es la orden que imprime el mostrador.
  - «La salida trasera hacia el bosque»: por la puerta de vidrio se sale al bosque, y por la trasera, al pasillo de servicio. Las máscaras se van por la trasera solo cuando ya está abierta (03:00), así de verdad puedes seguirlas. Antes de esa hora salen por el vidrio.
  - «Señalan el producto si no los atiendes»: las caras blancas no compran nada. Su comunicación sin palabras aparece cuando insistes en hablarles: señalan su tambor y después se inclinan, siempre sin mirarte («nunca te miran a los ojos»).
  - «El cuello gira siguiendo la cámara»: lo hacen las máscaras. Él solo se mueve cuando no lo miras (canon §3), y las caras blancas nunca te miran.
- **Herramientas:** `revisar_ia.py`; `centinela.py` corre también `director.test.js`; `pruebas.html?auto&solo=texto` corre solo algunas partidas; `rendimiento.html` mide la sala con visitas y el bosque con él.

## Sprint 31 — El lenguaje corporal de Pelusa

- Orejas hacia lo que oye, cola que se agita con la alerta y saludo si te tiene cariño (todo sale de su cerebro de mosca).

## Sprint 32 — El venado

- Un venado en el bosque, con su cerebro de mosca: pasta, se alerta, huye; los ojos le brillan con la linterna.
- **Decisión:** la vida salvaje es inofensiva y escasa (una vez por noche y no vuelve). El bosque se siente vivo sin restarle protagonismo a él.

## Sprint 33 — El mundo sabe de tus fotos

- La radio comenta las fotos y el teléfono agrega una posdata según lo que revelaron.
- **Decisión:** una sola posdata por llamada, por prioridad (él antes que todo). Así cada llamada sigue siendo corta y la instrucción de la hora no se pierde.

## Sprint 34 — Pelusa movida y el resumen del final

- Doble exposición de Pelusa en las fotos, y dos líneas nuevas en el resumen: el cariño de Pelusa y cuántas fotos revelaron algo.
- **Decisión:** el doble es un clon temporal del modelo, en vez de un efecto de pantalla. Así sale con el mismo tramado y la misma iluminación PSX, y no hace falta otro pase de render.

## Sprint 35 — La lechuza del árbol seco

- Lechuza de cara blanca con cerebro de mosca: cabeza a saltos que gira casi hasta la espalda, ve a él, ulula con paneo y se va volando en silencio.
- **Decisión (lore):** su cara blanca es la de una lechuza de verdad, no una «cara blanca» del canon. Es solo un guiño, sin afirmar nada nuevo. Que ella vea a él cuando tú no lo ves sigue la regla de Pelusa: los animales notan lo que no se ve.
- **Decisión (rendimiento):** las piezas se fusionan por material y por grupo animado. La lechuza y el venado, juntos, pasan de 26 llamadas de dibujo a 15 cuando aparecen.

## Sprint 36 — Los animales saben

- El venado huye de él y la lechuza lo mira fijo: los dos lo delatan. Tres logros nuevos.
- **Decisión (diseño):** él nunca aparece a la vista (director de IA), así que la pista tiene que ser indirecta. Los animales la dan sin romper esa regla: ves de qué huyen y hacia dónde miran, no a él.
