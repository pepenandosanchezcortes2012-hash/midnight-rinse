# REPORTE FINAL · MIDNIGHT RINSE

## Resumen
El proyecto pasó por dos etapas:
1. **El Coliseo con Gemini**, la orden de misión v4. Forjó la Arena 1 completa y casi toda la Arena 7, hasta que la cuota del plan Google AI Pro se agotó.
2. **Desarrollo profesional del juego.** A pedido del usuario, el orquestador tomó el control. Rescató lo viable de Gemini, construyó el núcleo verificado y desarrolló el **juego completo y jugable**.

## 1. El Coliseo (Gemini 3.8 Flash High vía Antigravity CLI)
| Arena | Lotes | Campeón | `verify` | Llamadas | Estado |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 · blind_spot_dispatcher | 8/8 (32 gladiadores) | G002 · ALFA (fusión: 3 ideas) | **OK**; final APROBADO, 59/59 adversariales | 326, 0 fallidas | aprobada |
| 7 · shift_log | 6/8 válidos | G007 · ALFA (sin ratificar) | — | 254, 19 fallidas por cuota | interrumpida por cuota |
| 5, 4, 2, 3, 6 | 0 | — | — | 0 | sin ejecutar (cuota) |

- **Capacidad del plan medida:** unas 561 llamadas exitosas por ventana de 5 h (~9,2 M tokens de entrada y 3,1 M de razonamiento).
- **Mensaje de cuota exacto:** `Individual quota reached. Please upgrade your subscription to increase your limits.` Se reinició a las 21:34:47 del 02/10.
- El detalle completo está en `PROGRESO.md`, y las actas reales en `arenas/*/runs/*/report.md`.

## 2. Rescate y núcleo verificado
- **Auditoría** (`AUDITORIA.md`): se rescataron los dos campeones de Gemini.
  - **G002 (dispatcher):** con una corrección menor.
  - **G007 (shift_log):** corregido un **bug real de regresión de fase** que también tenía G079.
- **`core/midnight_rinse_core`:** 7 módulos de Python 3.9+, **203 pruebas verdes** (4 se saltan en Windows) y prueba de integración. Centinela: 0 hallazgos.
- **Ports a JavaScript:** idénticos a Python en todos los vectores dorados:
  - 4.000 colores;
  - 4.000 vértices;
  - 2.400 muestras de manos;
  - 2.500 arrastres de perilla;
  - 3.000 operaciones del despachador;
  - las fronteras del reloj y las transiciones de la bitácora.

## 3. El juego
- **Plataforma:** navegador (Three.js r128 incluido), porque no hay Godot ni Unity instalados. Se juega con doble clic en `juego/index.html`. Guía de portado en `PORTADO.md`.
- **Contenido:** un turno completo de 01:10 a 05:12 (~15 min reales), sin HUD, con dos finales y capa meta-diegética opcional.
- **Momentos guionizados:**
  - impresora a las 01:15 y 04:33;
  - aparición del cliente (02:20);
  - locutor (02:40);
  - susurros (03:00–04:00);
  - teléfono (03:50);
  - pregunta de la hora (04:00+).
- **Sistemas:**
  - monedas y lavadoras con perilla de retenes;
  - secadoras con filtros de pelusa;
  - charcos y trapeador, con revisiones cada 45 min;
  - radio sintonizable;
  - vaho de lentes;
  - parpadeo;
  - manos a 15 Hz;
  - horror por oclusión con 8 zonas y 13 tipos de evento;
  - regla de la mirada;
  - pavor dinámico;
  - audio procedural de 3 canales y voces opcionales.
- **Pruebas en Chrome:**
  - turno completo sin errores;
  - final bueno alcanzado con un jugador aplicado; final malo con uno descuidado;
  - las 7 interacciones táctiles verificadas;
  - aparición detrás del jugador al parpadear;
  - 16 eventos en 2 minutos en la ventana ×3;
  - capturas del banco, del pasillo empañado y del colapso.
- **Centinela del juego:** 0 hallazgos críticos, altos o medios. Quedan 15 bajos justificados (`Math.random` para el azar del juego, no criptográfico).

## 4. Actualización móvil: Zero-HUD y gestos táctiles
- **`touch.js`:** gestos invisibles y vibración (`navigator.vibrate`).
  - Joystick dinámico (centro donde apoyas el pulgar, zona muerta de 8 px, radio de 70 px, velocidad suavizada) y mirada con el pulgar derecho.
  - **Tap directo:** el rayo de interacción sale del punto tocado, no del centro.
  - Doble toque = parpadeo instantáneo; dos dedos = limpiar los lentes donde frotan; tres dedos = pausa.
  - Micro-balanceo por giroscopio con filtro paso-alto, con permiso en iOS.
- **`consumables.js`:** cigarro y petaca, desde la esquina (deslizar arriba o en diagonal) o con C y F en escritorio.
- **Objetos táctiles nuevos:**
  - bandeja de monedas del cambiador;
  - manijas de las lavadoras (trabadas mientras lavan);
  - manija de la puerta trasera (cerrada con llave);
  - un tap en una perilla la avanza un retén.
- **Pasos del Cliente Inmóvil:** audio grave y vibración sorda cuando se reubica a menos de 6 m, y pulsos cada 3–5 s si está de pie a menos de 3 m.
- **Móvil:** pantalla completa horizontal, aviso "gira el teléfono" en vertical y pausa automática si la app pasa a segundo plano.
- **Probado en Chrome con `TouchEvent` sintéticos:** 16 gestos verificados con sus vibraciones exactas. El escritorio sigue intacto: turno completo sin errores y final bueno.

## 5. Porro y tu música dentro del juego
- **Porro (`consumables.js`, tecla J o deslizar a la izquierda desde la esquina):**
  - **Efectos:** 10 s en la mano con brasa y humo verdoso más denso. El shader añade saturación, aberración cromática y deriva de color. El tiempo del turno se estira hasta ×0.82 y el pavor baja.
  - **Costo:** la paranoia acelera al director del horror hasta ×1.4 y trae susurros fuera de la ventana de las 03:00.
- **Tu música (`music.js`):**
  - **Fuentes:** el audio de la pestaña de YouTube Music, capturado con `getDisplayMedia`, que silencia la pestaña original; o archivos del dispositivo.
  - **Ruta del sonido:** sale por la radio del mostrador en la 99.9 FM, con panoramizador HRTF y el oyente pegado a la cámara. Lleva filtro lo-fi opcional, interferencia por cercanía del Cliente Inmóvil, cortes en apagones y susurros, filtro «bajo el agua» en el colapso y reverberación cuando estás colocado.
  - **Al conectar:** la radio salta sola a la 99.9 y su pantalla dice «TU».
- **Probado en Chrome:**
  - **Archivos:** conexión y salto a la 99.9.
  - **Señal:** interferencia 1.00 → 0.46 con el cliente a 0.5 m; colapso a 700 Hz; desintonizar devuelve la estática.
  - **Porro:** con la J y con el gesto. Tras 11 s: colocado 0.60, tiempo ×0.89, paranoia ×1.24, pavor 0.22 → 0.12.
  - **Turno completo:** fumando los 3 porros llega al final sin errores.
  - **Sin probar automáticamente:** la captura de pestaña necesita que tú elijas la pestaña en el selector del navegador.

## 6. Tu música en el celular: la tele de la lavandería
- **Problema:** en el celular no se puede capturar audio de otras apps, y la app de YouTube Music sin Premium se pausa en segundo plano.
- **Solución (`tele.js`):**
  - **Fuente:** el reproductor oficial de YouTube (IFrame API) en una tele CRT del mundo. Lee enlaces de canción, álbum (`OLAK5uy_…`), playlist, mix, `youtu.be`, shorts o ID.
  - **Render:** la pantalla de la tele escribe alfa 0 en el lienzo (`retro.screenMaterial`). El posproceso compone en alfa premultiplicado, así que el vaho, la viñeta y el parpadeo tapan el video de forma proporcional.
  - **Proyección:** el reproductor recibe una sola `matrix3d` proyectiva (viewport × proyección × vista × modelo).
  - **Interacción y efectos:** tocar la tele pausa o reanuda; la perilla pasa de canción. Volumen por distancia, estática por cercanía del Cliente Inmóvil y por los susurros, y apagones.
  - **Panel:** en el título y la pausa el reproductor se muestra plano dentro del panel, para tocar ▶.
- **Hallazgo:**
  - **Fallo:** el método clásico de CSS3DRenderer (`perspective` + `preserve-3d`) se dibujaba desplazado en Chrome con escala de pantalla al 125 %, aunque `getBoundingClientRect` decía lo contrario. Lo confirmé con un contorno de prueba.
  - **Arreglo:** la matriz proyectiva única queda clavada sobre el hueco, también en vista oblicua.
- **Probado en Chrome con un video real de YouTube:**
  - **Opacidad:** lienzo 100 % opaco sin enlace y de espaldas. Hueco de 14 372 px mirando la tele; parcial con medio parpadeo o con vaho; tapado con los ojos cerrados.
  - **Toques:** la pantalla y la perilla se detectan como objetos y llaman al reproductor.
  - **Sonido y efectos:** volumen 100 cerca y 27 en el mostrador; en el apagón, apagada y en silencio; con el cliente a 0.6 m, estática 0.46.
  - **Pausa y partida:** el panel queda alineado en la pausa y el turno completo termina sin errores.
  - **Sin probar:** el audio no se pudo oír (la pestaña de prueba no tiene gesto del usuario, igual que la regla del iPhone). Pruébalo en tu teléfono.

## 7. Guía de controles
- **Dónde:** pantalla propia, que se abre desde el título y desde la pausa. Abre en la pestaña de tu dispositivo, Teclado y ratón o Celular (gestos).
- **Contenido:**
  - **Teclado y ratón:** teclas dibujadas, agrupadas en moverte, usar, tu cuerpo, consumibles, tu música, y hablar y menú.
  - **Celular:** un esquema de la pantalla con las zonas de caminar, mirar y la esquina de consumibles.
- **Cierre y aviso:** se cierra con Volver o Esc, y al reanudar el turno. Al empezar un turno, un subtítulo dice cómo abrirla.
- **Probado en Chrome:**
  - Se abre desde el título y la pausa, y cambia de pestaña.
  - Esc la cierra; al reanudar también se cierra.
  - Cada pestaña tiene 15 filas.
  - Ninguna prueba dio errores.

## 8. Arreglo: «no me deja abrir el menú de controles»
- **Causa más probable: caché mezclada.**
  - Al recargar, Chrome baja el `index.html` nuevo (que ya trae el botón) pero reutiliza el `ui.js` viejo de la caché, que no sabía abrir la guía.
  - Resultado: el botón aparecía y no hacía nada.
  - **Arreglo:** `juego/herramientas/sellar_version.py` sella los 27 scripts y estilos con `?v=<fecha-hora>`. Una página nueva siempre baja sus scripts nuevos.
- **El botón estaba escondido** al final del título, debajo de Opciones y Música. Ahora está junto a «Comenzar turno».
- **Tecla H** en la computadora: abre la guía desde el título, la pausa o en plena partida. En partida pausa y suelta el ratón. No se activa al escribir en un campo de texto.
- **Probado en Chrome con mouse y teclado reales:**
  - El clic en el botón del título abre la guía, Esc la cierra y H la abre.
  - Escribir «Hugo» en el campo de nombre no la abre.
  - Los tres dedos pausan, y el clic real en «Guía de controles» de la pausa abre la guía.
  - H en partida pausa y abre la guía (probado inyectando la tecla, porque la pestaña de prueba en segundo plano no recibe teclas durante la partida).

## 9. Reiniciar todo
- **Dónde:** botón rojo «Reiniciar todo» en el título (junto a Comenzar turno y Guía de controles) y en la pausa.
- **Confirmación:** una pantalla propia, sin ventanas del navegador, que explica qué se borra. Cancelar o Esc no borran nada.
- **Al confirmar:**
  - Corta la música (radio y tele).
  - Borra solo las claves `midnight-rinse/…` del navegador: registro del turno, opciones y enlace de música.
  - Sale de pantalla completa y recarga desde cero.
- **Probado en Chrome con clics reales:**
  - Cancelar conserva los datos.
  - Desde la pausa, «Sí, reiniciar todo» recarga en el título con el nombre vacío, el volumen de fábrica (0.8), sin enlace de música y con el registro vacío.
  - Una clave ajena de otra app quedó intacta.

## 10. Salir al bosque
- **Cómo se llega:** botón «Salir al bosque» / «Volver a la lavandería» en la pausa (el texto cambia según dónde estés). También tocando la puerta de vidrio, o la puerta de la fachada desde afuera.
- **Escenario (`world._forest`):**
  - **Contenido:** 165 pinos low-poly unidos en dos geometrías (troncos y copas) y 26 rocas. Suelo, sendero hasta un claro, fachada con letrero, farola y una lavadora tocable en el claro.
  - **Límites:** colisiones por tronco y bordes invisibles.
  - **Texturas nuevas:** tierra, sendero, corteza, pino, ladrillo y roca.
  - **Ubicación:** está a unos 100 m de la sala. Como la cámara ve 30 m, nunca se dibujan los dos a la vez.
- **El cruce (`bosque.js`):**
  - **Al cruzar:** fundido a negro y cambio de las 6 luces del shader, la luz ambiente y la niebla.
  - **Luces de afuera:** brillo del interior por el vidrio, farola, foco del claro y la linterna del celular, que sigue al jugador.
  - **Sonido:** más lluvia y viento; las lavadoras, el zumbido y la radio se oyen ahogados.
  - **Lentes:** gotas de lluvia.
- **Horror afuera:** ramas que crujen en la zona que no miras, búho y parpadeos de linterna. El Cliente Inmóvil se mueve entre 6 anclas del bosque, cerca de ti, cuando no lo ves; al volver, regresa a la entrada. Mientras tanto, la lavandería sigue generando charcos y puertas abiertas.
- **Arreglo encontrado al probar:** `player._collide` forzaba la posición dentro de la sala, así que el primer paso afuera te habría devuelto adentro. Ahora el límite depende del área (`player.area`).
- **Probado en Chrome:**
  - **Cruces:** el clic real en el botón de la pausa saca al bosque; las dos puertas funcionan en ambos sentidos.
  - **Movimiento y choques:** caminé 9 m por el sendero. Los pinos y el borde detienen, y no se puede rodear la fachada.
  - **Lentes y horror:** los lentes se mojan y el Cliente Inmóvil te sigue y vuelve a la entrada.
  - **Turno completo:** con 3 salidas al bosque, sin errores.

## 11. Pruebas de partida automáticas
- **Qué es:** `juego/pruebas.html` + `juego/tests/partida.js`. Cargan el juego real en un iframe y lo juegan paso a paso con `g.update(1/30)`, que no depende de la velocidad de la máquina. Respaldan y restauran el `localStorage` del juego.
- **Resultado:** 10 pruebas, todas en verde en unos 4 s.

## 12. App instalable (PWA)
- **Archivos:**
  - `manifest.webmanifest`: pantalla completa, horizontal y fondo oscuro.
  - Iconos pixel art generados con `herramientas/iconos.py`: una lavadora con dos ojos en el agua. Incluye versión *maskable*, `apple-touch-icon` y favicon.
  - `sw.js`, el service worker que hace funcionar el modo sin internet.
- **Estrategia del service worker:**
  - Al instalarse lee `index.html` y guarda todo lo que necesita, así funciona sin internet desde la primera visita (33 archivos).
  - La página va primero a la red, para recibir actualizaciones.
  - Los recursos con `?v=` salen de la caché y se borran sus versiones viejas.
  - Lo demás va a la red primero; YouTube no pasa por el service worker.
- **Botón «Instalar en el teléfono»** (`beforeinstallprompt`) y, en iPhone, instrucciones para Compartir → Agregar a pantalla de inicio.

## 13. Tormenta
- **`clima.js`:** la lluvia son 1400 hilos en una caja que sigue a la cámara, con caída y viento calculados en el shader en un solo dibujo.
- **Relámpagos:** 1 a 3 destellos que suben la luz ambiente; adentro solo brillan las puertas de vidrio. El trueno llega 1 a 4 s después, y adentro se oye ahogado.
- **Susto:** el 40 % de los relámpagos en el bosque revela al Cliente Inmóvil en un ancla delante de ti, entre 4 y 12 m.
- **«Reducir destellos»:** un solo resplandor suave.
- **Pasos:** sobre tierra mojada suenan distinto.
- **Prueba nueva:** lluvia solo afuera, el relámpago ilumina (0.04 → 0.31), un trueno, vuelta a la normalidad y modo suave. Resultado: 11/11 pruebas en verde.

## 14. Control de consola
- **`gamepad.js`:** usa la Gamepad API con mapeo estándar y escribe en los mismos canales de `MR.Input` que el teclado, el ratón y los gestos.
- **Controles:**
  - Sticks con zona muerta; la mirada tiene curva cuadrática.
  - A con mantener: el stick derecho gira las perillas y cepilla los lentes.
  - La cruceta maneja los consumibles, o las respuestas si alguien te habla.
  - Start pausa y View abre la guía.
- **Menús:** foco visible, A, B y ◀ ▶ en los deslizadores.
- **Vibración:** `MR.Haptics.pulse` también hace vibrar el control (`dual-rumble`).
- **Guía:** pestaña «Control (mando)», que se abre sola si hay un control conectado.
- **Prueba nueva con un control simulado.** Resultado: 12/12 pruebas en verde.

## 15. La historia del bosque y el tercer final
- **Origen de los textos (`historia.js`):** seis hojas del registro de turnos anteriores, más el final «Último ciclo de lavado». El borrador lo escribió **Gemini 3.8 Flash** por Antigravity CLI, en una sola llamada sin herramientas; su respuesta se trató como dato.
- **Edición:** revisé y edité dos frases para que encajaran con las mecánicas: los filtros están adentro, y él pregunta la hora cerca de las 04:00.
- **Hojas en el bosque:** las hojas 1 a 5 están en el suelo cerca del sendero y la 6, sobre la lavadora del claro.
- **Al recogerlas:** cada una se lee de cerca con su firma y el contador «n de 6».
- **La lavadora del claro:** con menos de 6 hojas dice cuántas llevas; con las 6 cierra el ciclo y termina el turno en el tercer final.
- **Resumen final:** cuenta las hojas.
- **Prueba nueva:** una hoja tocada de verdad con un rayo, el contador en la lavadora y el tercer final. Resultado: 13/13.

## 16. Logros y opciones de vista
- **Logros (`logros.js`):** 13 en total, 3 de ellos ocultos.
  - **Al conseguir uno:** subtítulo «★ Logro», campanita de secadora y vibración.
  - **Panel en el título:** los ocultos aparecen como «???» hasta conseguirlos.
  - **Guardado:** en `midnight-rinse/logros`; «Reiniciar todo» los borra.
  - **Cuándo se dan:** al terminar el turno (final bueno, malo o del bosque; pasillo impecable; ojos al suelo; paranoia), en el bosque, con las hojas, el relámpago, la tele, la radio a las 02:40 y las seis lavadoras.
- **Opciones nuevas:** campo de visión (55–95°), invertir el eje vertical y tamaño de subtítulos (Normal, Grande y Enorme).
- **Prueba nueva.** Resultado: 14/14.

## 17. Pelusa, el gato
- **`gato.js`:** red de 9 puntos en el piso con caminos rectos que no cruzan muebles (búsqueda en anchura) y 3 lugares altos a los que salta en arco: secadora, banco y mostrador.
- **Estados y animación:** duerme, sentado (voltea la cabeza hacia él o hacia ti), camina, salta, se eriza y huye. Animación a 12 Hz.
- **Acariciarlo:** ronroneo con modulación a 26 Hz, el pavor baja 0.08, vibración y logro «Pelusa».
- **Alarma:** si él está de pie a menos de 3.5 m, el gato bufa con paneo y huye al punto más lejano.
- **El bosque:** el gato espera junto a la puerta y maúlla al volver.
- **Sonidos procedurales:** maullido (diente de sierra con filtro que imita la boca), ronroneo y bufido.
- **Resumen final:** caricias y bufidos.
- **Prueba nueva:** 90 s caminando sin atravesar ningún mueble, el bufido y la huida a 7.6 m. Resultado: 15/15.

## 18. Dificultad
- **`MR.DIFICULTAD` (en `config.js`):** cada nivel ajusta la frecuencia del director del horror (×0.55, ×1 o ×1.8), las faltas permitidas para el final bueno (6, 3 o 1), los consumibles y la velocidad del vaho.
- **Dónde se ve:** la opción está en la pantalla de título y el nivel aparece en el resumen final.
- **Logro oculto:** «Turno de pesadilla».
- **Prueba nueva:** Tranquilo perdona 5 faltas y Pesadilla no perdona 2; eventos cada ~20 s contra ~6 s. Resultado: 16/16.

## 19. Pantalla de título viva
- **Recorrido de cámara:** en la pantalla de título, la cámara recorre despacio la lavandería, de la entrada hacia las lavadoras y de regreso, y un fluorescente titila de vez en cuando.
- **Fondo degradado:** se ve la escena arriba y el texto queda legible abajo.
- **Al empezar el turno:** `player.update` vuelve a tomar la cámara.

## 20. Continuar turno
- **`partida.js`:** guarda solo datos, sin objetos de three.js, en `midnight-rinse/partida`, cada 10 s y al pausar (incluye salir de la app).
- **Cuándo no guarda:** con una pregunta abierta o a mitad de un cruce de puerta.
- **Qué restaura:** hora, pavor, faltas, banderas del guion, consumibles, monedas, bandeja, charcos, lavadoras y secadoras, radio, trapeador, el cliente en su ancla, el bosque (afuera y hojas) y la posición.
- **Botón en el título:** «Continuar turno (hora · dificultad)».
- **Cuándo se borra:** al terminar, al empezar un turno nuevo o al abandonar.
- **Prueba nueva:** se guarda a las 03:20 en el bosque, se recarga y todo vuelve igual. Resultado: 17/17.

## 21. Sustos nuevos en la lavandería
- **Cuatro eventos más en el director, cada uno en la zona que no estás mirando:**
  - **Radio sola:** se sintoniza sola en la 94.1 y susurra «…no lo mires a la cara…».
  - **Golpe en la secadora:** golpe por dentro y la máquina tiembla.
  - **Llamada fantasma:** el teléfono suena dos veces; si contestas, solo se oye una lavadora.
  - **Mano en la lavadora:** una mano por dentro del vidrio de una lavadora durante 70 s.
- **Prueba nueva.** Resultado: 18/18.

## 22. El pasillo de servicio
- **`world._pasillo` y `pasillo.js`:** zona aparte (x ≈ 60) con concreto, bombilla, tubería con goteo, caldera con llama, caja de fusibles y 7 casilleros.
- **Casilleros:** tienen las iniciales de las hojas del bosque más el tuyo, con el nombre de las opciones o «TÚ».
- **Cuándo se abre:** a las 03:00 (`C.BACKDOOR_OPENS`), con un clic, y la puerta queda entreabierta.
- **El cruce:** fundido como el del bosque, con sus propias luces, ambiente y niebla; las lavadoras y la radio se oyen ahogadas.
- **Horror en el pasillo:** la bombilla titila y él aparece al fondo o junto a la puerta. Al salir, regresa a las secadoras.
- **Fusibles:** al restablecerlos, los apagones duran la mitad (logro «Electricista»). El último casillero da el logro oculto «Ya tenías casillero».
- **El gato:** te espera junto a la puerta trasera.
- **El guardado:** incluye el pasillo.
- **Prueba nueva.** Resultado: 19/19.

## 23. Prueba de caos
- **Qué hace:** tres turnos completos (Tranquilo, Normal y Pesadilla) a velocidad ×8, apretando todo al azar con semilla fija:
  - teclas mantenidas y soltadas, mirada, clics, consumibles y parpadeos;
  - cruces al bosque y al pasillo, hojas y caricias al gato;
  - pausas y respuestas al azar.
- **Qué revisa en cada cuadro:** que no haya NaN y que el jugador nunca salga de su área. Al final, que el turno termine sin errores.
- **Resultado:** 21 cruces al bosque y 19 al pasillo sin un solo fallo. 20/20.

## 24. Máquina de café y evaluación del gerente
- **Café:** una moneda. Tras 2.5 s, `awake` sube 0.6, baja con el tiempo y alarga el intervalo entre parpadeos hasta ×1.8. Logro «Turno largo» con 3 cafés.
- **Evaluación:** `100 − 15·faltas − (25 incorrecta | 12 sin respuesta) + 5·hojas + 15 (final del bosque) + 10 (final bueno) + 2·charcos` (máx. 10). Letra A–F con comentario del gerente en la pantalla final y en el resumen.
- **Prueba nueva.** Resultado: 21/21.

## 25. Compartir resultado
- **Qué hace:** botón en la pantalla final. Usa Web Share (menú del teléfono) o, si no está, copia al portapapeles. El texto lleva la nota, la dificultad, el final y las hojas encontradas, más el enlace a la carpeta del juego.
- **Prueba nueva.** Resultado: 22/22.

## 26. La respuesta secreta
- **Cuándo aparece:** si encontraste las 6 hojas del bosque o abriste tu casillero (su etiqueta dice «05:13»), la pregunta de la hora tiene una cuarta respuesta: «Son las cinco y trece. Ya terminó.».
- **Qué pasa:** cuenta como correcta, el pavor baja a 0 y él responde «…Entonces ya lo sabes». Se va por la puerta de vidrio y no vuelve en el turno.
- **Final bueno:** suma una frase.
- **Controles:** tecla 4, cruceta ▼ o tocar la opción.
- **Logro oculto:** «La hora verdadera».
- **Prueba nueva.** Resultado: 23/23.

## 27. Contador de noches y título más limpio
- **Noche n:** el título muestra «Noche n» con los turnos terminados (`midnight-rinse/noches`). «Reiniciar todo» lo borra.
- **Opciones:** el panel empieza cerrado.
- **Prueba nueva.** Resultado: 24/24.

## 28. Radio por noche y susurros
- **Origen:** `MR.HISTORIA.radio`, 8 transmisiones (la 1 es la original y las 2 a 8 son un borrador de Gemini 3.8 Flash, revisado), y `MR.HISTORIA.susurros`, 16 susurros (cambié uno que empujaba a una falta).
- **Cómo se elige:** la transmisión depende de la noche (`game.night`). La noche 7 revela «las cinco y trece» y habilita la respuesta secreta; después de la noche 8 solo hay estática.
- **Susurros:** si diste tu nombre, la mitad de las veces dicen tu nombre.
- **Prueba nueva:** noches 2, 7 y 9. Resultado: 25/25.

## 29. Rendimiento y ahorro de batería
- **Medición en Chrome:** sala 1.0 ms de cálculo + 1.3 ms de render por cuadro; bosque y pasillo, ~0.5 ms cada uno. Hay margen de sobra incluso en celulares 6 a 8 veces más lentos.
- **Opción «Ahorro de batería (30 FPS)»:** activada por defecto en pantallas táctiles. El bucle se salta cuadros y el tiempo se acumula.
- **Prueba determinista:** 30 cuadros por segundo con ahorro y 60 sin él. Resultado: 26/26.

## 30. Ambiente en la pantalla de título
- **Qué suena:** con el primer toque o tecla en el título empieza el ambiente (lluvia, retumbo, zumbido y drone) al 60 % del volumen; al empezar el turno sube al normal.
- **Botón:** «Instalar en el teléfono» pasa a «Instalar la app».
- **Prueba nueva.** Resultado: 27/27.

## 31. Tablilla de tareas
- **Qué es:** una tablilla física en el mostrador (sin HUD) que abre una hoja con el estado del turno:
  - hora;
  - charcos y próxima revisión (falta con 3 o más);
  - lavadoras funcionando;
  - el filtro de pelusa más lleno;
  - recordatorios que aparecen según avanza la noche (no mirarlo a la cara, la hora si contestaste el teléfono, la puerta trasera y los fusibles, las hojas del bosque).
- **Prueba nueva.** Resultado: 28/28.

## 32. Él te observa
- **Qué hace:** mientras su zona no está a la vista (o parpadeas), la cabeza del Cliente Inmóvil gira despacio hacia ti, hasta ±75°. Al mirarlo, se queda donde quedó; al cambiar de lugar, vuelve al frente.
- **Regla de la mirada:** usa ahora hacia dónde mira la cabeza.
- **Prueba nueva.** Resultado: 29/29.

## 33. Revisión de diseño en tamaño de celular
- **Cómo se revisó:** el título, la pausa y la guía en un marco de 844×390 (teléfono en horizontal).
- **Pausa:** pasa a cuatro filas compactas, porque «Reiniciar todo» quedaba cortado.
- **En pantallas bajas:** menos espacio entre elementos y botones un poco más chicos.
- **Barras de desplazamiento:** oscuras.
- **Resultado:** 29/29.

## 34. Noches especiales
- **`MR.NOCHES_ESPECIALES`:** con un 55 % de probabilidad, el turno trae un modificador, que se anuncia con la nota del gerente y aparece en la tablilla, el resumen y el guardado:
  - **Inundación:** charcos ×2.
  - **Apagones:** apagones ×3.
  - **Niebla:** vaho ×1.5 y niebla del bosque a 9 m.
  - **Luna llena:** sin lluvia ni tormenta; ambiente más claro con cielo y niebla azul oscuro.
  - **¿Y el gato?:** Pelusa aparece a las 03:00, dormido en el mostrador.
- **Para pruebas:** `?noche=<clave>` fuerza una noche y `?noche=ninguna`, una normal. El arnés de pruebas usa siempre `ninguna` para ser determinista.
- **Arreglos al probar:**
  - con luna llena ya no puede dispararse un relámpago pendiente;
  - la prueba de «él te observa» desactiva el parpadeo, porque al parpadear también gira, a propósito.
- **Resultado:** 30/30.

## 35. Amanecer en el título
- **Qué cambia:** tras conseguir el tercer final (logro «Último ciclo»), la pantalla de título amanece:
  - luz ambiente cálida y niebla ámbar;
  - la puerta de vidrio iluminada por la mañana y los fluorescentes apagados;
  - debajo del logo, «Amaneció. Pero esta noche vuelves.».
- **Al empezar el turno:** vuelve la noche.
- **Prueba nueva.** Resultado: 31/31.

## 36. Pistas para quien empieza
- **Cuándo salen:** en las noches 1 y 2 (o siempre en Tranquilo), una vez cada una y solo si el jugador parece atorado.
- **Cuáles son:** leer el registro, poner a lavar, los charcos antes de una revisión, el filtro lleno y la tablilla.
- **Prueba nueva:** la noche 1 da pistas y la 5 no. Resultado: 32/32.

## 37. Un Cliente Inmóvil más inquietante
- **Modelo nuevo de pie:** ~2 m de alto, con abrigo hasta las rodillas, brazos que cuelgan de más y manos pálidas.
- **Sombrero:** de ala ancha, hijo de la cabeza, así que gira con ella cuando te observa. También lo lleva sentado.
- **Resultado:** 32/32.

## 38. El vaso de café en la mano
- **Qué cambia:** al salir el café, un vaso de cartón aparece en la mano derecha y se levanta durante 2.2 s, con la pose ajustada para que el vaso quede a la vista.
- **Resultado:** 32/32.

## 39. Reflejos en el vidrio de las lavadoras
- **Vidrio:** cada lavadora tiene ahora un ojo de buey de vidrio (que también brilla con los relámpagos).
- **El susto:**
  - **Cuándo:** al acercarte a menos de 1.5 m y empezar a mirar el vidrio. Pasa con un 12 % de probabilidad, o un 30 % desde la noche 2 o con pavor alto, y luego espera de 60 a 120 s antes de poder repetirse.
  - **Qué se ve:** durante 0.45 s, una silueta de sombrero con ojos pálidos (lo que está detrás de ti), con susurro y vibración.
  - **Si él ya llegó:** aparece a tu espalda en el siguiente parpadeo.
- **Logro oculto:** «Detrás de ti».
- **Prueba nueva.** Resultado: 33/33.

## 40. Transición a los finales
- **Fundido:** al terminar, el mundo se desvanece en 3 s en vez de irse a negro de golpe, el audio se apaga en ~3 s y el texto final aparece con una transición CSS.
- **Sonido de cada final:** campanita y puerta en el bueno, golpe y zumbido en el malo, trueno y campanita en el del bosque.
- **Prueba determinista del fundido.** Resultado: 34/34.

## 41. Objetos perdidos
- **`objetos.js`:** al terminar un ciclo, un 35 % de probabilidad de que quede un objeto (prefiere los que no tienes). Abrir la puerta de la lavadora lo encuentra.
- **Colección:** 12 objetos guardados en `midnight-rinse/objetos`, con la noche en que lo encontraste. Panel en el título con «???» para los que faltan.
- **Recompensas:** logro «Objetos perdidos» con 6, conteo en el resumen final y el objeto pendiente en el guardado de partida.
- **Prueba nueva.** Resultado: 35/35.

## 42. El Archivo
- **`archivo.js`:** guarda de forma permanente las hojas encontradas y las transmisiones de radio escuchadas (`midnight-rinse/archivo`). Panel en el título agrupado por hojas y radio; las entradas encontradas se releen en la vista de la hoja.
- **Prueba nueva.** Resultado: 36/36.

## 43. Modo Paseo
- **Qué es:** la dificultad «Paseo» (`sinSustos`): el director del horror no actúa, él no aparece (ni se programa) y no hay faltas. Termina con el final «Paseo nocturno». Sirve para explorar sin miedo, buscar objetos y leer la historia.
- **Opción renombrada:** «Sensibilidad del ratón» pasa a «Sensibilidad de la mirada», porque también aplica al celular y al control.
- **Prueba nueva:** un turno completo en Paseo, sin él, sin sustos ni faltas. Resultado: 37/37.

## 44. Filtro CRT opcional
- **Qué hace:** en el posproceso, tras el dithering, oscurece la línea entre filas del objetivo de 320×240 y aplica una rejilla de fósforo RGB por columnas de pantalla. Sin curvatura, para no desalinear el video de la tele.
- **Opción:** desactivada por defecto.
- **Resultado:** 37/37.

## 45. El final verdadero
- **Cómo se consigue:** en la misma noche, dar la respuesta secreta (él se va) y meter las seis hojas en la lavadora del claro.
- **Qué da:** el final «05:13 · Fin del turno», 25 puntos extra en la evaluación y el logro oculto «Fin del turno». A partir de ahí, el título amanece con «Ya no vuelves… a menos que quieras».
- **Prueba nueva.** Resultado: 38/38.

## 46. Versión en inglés
- **Cómo funciona:** se traduce a la salida. `MR.t` busca el texto en español en el diccionario (`textos_en.js`, 541 textos); `MR.tf` traduce plantillas con datos (horas, conteos, nombres). El HTML se traduce al arrancar, y los párrafos con formato (`<b>`, teclas) se traducen enteros con sus etiquetas. Las voces sintetizadas usan una voz en inglés y la hora se dice en inglés («four oh seven»).
- **Idioma:** el del navegador, la opción *Idioma · Language* (recarga la página) o `?lang=en`.
- **Traducción:** borrador de Gemini 3.8 Flash (agy) en 7 lotes, con contexto del juego y un glosario fijo para que las mecánicas se digan igual (la hora, el teléfono, las faltas → *strikes*). Revisé las 541 entradas a mano y corregí algunas. `herramientas/textos.py` extrae los textos (HTML y literales de JS) y valida cada traducción (mismas etiquetas, mismos `{marcadores}`, sin enlaces ni código nuevos).
- **Cambios para que todo se pueda traducir:** unas 45 concatenaciones pasaron a ser plantillas. Las pruebas se cargan con `lang=es`.
- **Prueba nueva:** juega en inglés (menús, tablilla, susurros, teléfono, diálogo, logro, bosque, final y compartir) y falla si algún texto llega sin traducir. Resultado: 39/39.

## 47. Récords y finales vistos
- **Panel «Récords · finales»** en el título: turnos terminados, mejor nota y puntos por dificultad (con la noche en que se logró) y los cinco finales: la una y diez, 05:12, paseo, el bosque y el verdadero. Los dos últimos salen como «???» hasta verlos. Se guarda en `midnight-rinse/historial`; «Reiniciar todo» lo borra.
- **Al terminar:** si superas tu mejor nota en esa dificultad, el resumen dice «¡Nuevo récord en …!». El primer turno no cuenta como récord.
- **También en inglés:** 18 textos nuevos, 559 en total. Prueba nueva. Resultado: 40/40.

## 48. Fotos con la cámara del celular
- **Cómo:** P, Y/△ en el control o «Sacar una foto» en la pausa (en el celular no hay tecla libre). Se renderiza un cuadro con flash y se copia al instante a un lienzo de 320×240 (JPEG de unos 12 KB). La polaroid asoma 3,6 s en la esquina y el flash es suave si está activado «Reducir destellos». El flash tarda 1,6 s en recargarse.
- **Galería:** las últimas 12, en `midnight-rinse/fotos`; si no caben, se borran las más viejas. Panel «Fotos» en el título, con visor y «Descargar». Se navega con el control (B cierra).
- **El susto:** desde que lo viste (o desde la segunda noche), con 35 % de probabilidad él sale en la foto, de pie frente a ti, aunque en el cuarto no haya nadie. Un rayo busca espacio libre para que no atraviese paredes, y su posición real se restaura después de la foto. Da un subtítulo, sube el miedo y desbloquea el logro oculto «En la foto». Nunca pasa en Paseo.
- **También en inglés:** 15 textos nuevos, 574 en total. Prueba nueva. Resultado: 41/41.

## 49. Su cara en la nieve de la tele
- **Qué pasa:** desde que lo viste, el director puede dejar listo el susto «tele_rostro» (hasta dos por noche, solo en la sala). Aparece la próxima vez que miras la tele de cerca (a menos de 8 m, en pantalla y con luz): durante 0,85 s, entre la estática, se forma una cara pálida con sombrero, en píxeles gruesos de 64×48. Suena un zumbido y sube el miedo. Si tienes música en la tele, la cara tapa el video.
- **Cómo:** uniforme `uFace` en el shader de la pantalla (cabeza, ojos, boca y sombrero con elipses y bandas), con entrada de 0,08 s y salida de 0,15 s. `tele._onScreen()` comprueba que la tele esté de verdad en el cuadro.
- **Prueba nueva:** de espaldas no sale; al mirarla sale, llega a 1 y se va. Resultado: 42/42.

## 50. Compartir con foto y pruebas sin ventana
- **Compartir resultado** en el celular: si sacaste fotos esa noche, la última va adjunta como JPEG (Web Share con archivos). Sin soporte, se comparte o copia el texto como antes. El visor de fotos tiene un botón «Compartir» que solo aparece si el navegador lo permite. La foto se convierte a archivo de forma síncrona, porque Safari pide compartir dentro del mismo toque.
- **`herramientas/probar.py`:** corre `pruebas.html?auto` en un Chrome sin ventana (perfil temporal, SwiftShader, tiempo virtual) y lee el resultado del DOM final. Tarda unos 30 s y no depende de la extensión del navegador.
- **Prueba:** la de fotos ahora también comparte, con un `navigator.share` de mentira. Resultado: 42/42.

## 51. Noche especial «Corte de agua» y secadoras con moneda
- **Secadoras:** ahora se ponen a girar con una moneda (clic en el frente; el filtro, delante, tiene prioridad), cualquier noche. Giran de 40 a 60 minutos y juntan pelusa en el filtro, así que dejarlas sin cuidar trae vaho y faltas.
- **Corte de agua:** sexta noche especial. Las lavadoras empiezan paradas y no arrancan («no entra agua»; la moneda no se pierde). Solo esa noche, cada secadora cuenta como una lavadora para tapar el zumbido, y tu música (tele o radio 99.9) cuenta como una y media. `game.calmSources()` junta todo eso. La tablilla y las pistas lo explican. Las noches normales no cambian.
- **También en inglés:** 10 textos nuevos, 585 en total. Prueba nueva. Resultado: 43/43.

## 52. El espejo del pasillo (reflejo de verdad)
- **El lavabo:** en la pared derecha del pasillo de servicio, frente a los casilleros. Echarte agua en la cara baja el miedo (0,15; una vez cada 40 s). En la noche sin agua, el grifo solo tose aire.
- **El espejo:** una cámara virtual, reflejada sobre el plano del espejo, dibuja la escena en una textura de 192×144 (sin suavizado, como el resto). El espejo la lee con proyección (`texture2DProj`). Solo se dibuja si estás en el pasillo, a menos de 7 m y con el espejo en pantalla. En esa pasada se esconden el propio espejo, su marco y tus manos: **no te reflejas**, y la primera vez un subtítulo lo nota. La pared queda detrás del plano y no tapa el reflejo, porque su cara trasera no se dibuja.
- **El susto «espejo»:** desde que lo viste, el director lo deja listo (hasta dos por noche, nunca en Paseo). Si te miras en el espejo de frente, cerca y con los ojos abiertos durante más de 0,6 s, él aparece de pie detrás de ti, solo en el reflejo, durante 1,8 s. Si dejas de mirar o parpadeas, ya no está. Da un susurro, sube el miedo y desbloquea el logro oculto «Dos en el espejo».
- **Arreglo:** los colores de las luces se calculaban solo dentro de `retro.render()`; ahora `retro.applyLights()` también lo usa la pasada del espejo.
- **Prueba nueva:** el reflejo tiene luz, él ocupa más de 300 píxeles distintos y vuelve a su lugar, sin errores de WebGL, y el lavabo funciona. Lo revisé con capturas de Chrome sin ventana. Resultado: 44/44.

## 53. Turno al azar (con semilla) y revisión en celular
- **Prueba nueva:** tres turnos completos (normal; sin agua; apagones en inglés) con el reloj ×10. Cada 20 cuadros elige: acercarse a un objeto interactivo de su área, mirarlo y hacer clic (a veces mantener, moviendo el ratón para las perillas); caminar; o apretar una tecla (cigarro, petaca, porro, foto, parpadeo, lentes, respuestas). Responde la pregunta de la hora al azar. El azar del juego y el de la prueba tienen semilla, así que un fallo se puede repetir. Comprueba que nada quede en NaN, que el turno termine y que no haya errores. Toca de 9 a 16 tipos de objeto por turno.
- **`probar.py --todo`** muestra el resultado de cada prueba, no solo las que fallan.
- **En el celular:** capturas a 844×390 del título (se desplaza, con todos los paneles) y de la pausa (cinco botones en tres filas). No hubo que cambiar nada.
- Resultado: 45/45.

## 54. Búsqueda de fallos con 24 turnos al azar, vibración en los sustos nuevos y tres objetos
- **Búsqueda de fallos (no se sube):** 24 turnos completos con semilla, todas las noches especiales y las cuatro dificultades (un tercio en inglés), dibujando también el espejo y la tele. Los 24 terminaron sin excepciones ni errores, con finales paseo, bueno y la una y diez.
- **Vibración** (celular y control) al ver su cara en la tele, al verlo en el espejo y al revisar la foto donde sale él.
- **Tres objetos perdidos nuevos**, ligados a lo que se agregó: un espejo de bolsillo, un rollo de fotos sin revelar y una llave de paso. Ahora son 15 en total. También en inglés: 602 textos.
- Resultado: 45/45.

## 55. Opción «Brillo»
- **Qué hace:** en el posproceso, una corrección gamma (`pow(col, 1/uGamma)`) antes del tramado RGB555. Levanta los oscuros sin quemar los claros ni perder el aspecto PS1. El rango va de 0,7 a 1,8 (1 = sin cambio). Se guarda con las opciones y también aplica a las fotos. Se ve en vivo en el título, porque el fondo se sigue dibujando.
- **Prueba nueva:** con brillo 1,6, la luminosidad media del cuadro pasa de 34,7 a 71,1, y la opción se guarda. Resultado: 46/46.

## 56. Una llamada distinta cada noche (y tu propia voz)
- **El teléfono público (03:50):** seis llamadas en `MR.HISTORIA.telefono`, una por noche. Todas dicen «faltan cinco minutos para las seis», la instrucción que hace falta para el final bueno. La cuarta advierte del espejo y la quinta se corta, mencionando las hojas y el claro. Desde la sexta noche el subtítulo es «[Teléfono, con tu propia voz]»: «Yo tampoco salí… Sigo aquí, en el turno de antes».
- **Archivo:** nuevo grupo «Teléfono público», con las llamadas que contestaste. Ahora son 20 entradas en total.
- **También en inglés:** 613 textos. Prueba nueva (noches 1, 4, 6 y 10, más el archivo). Resultado: 47/47.

## 57. Panel «Novedades»
- **En el título:** las últimas 10 novedades del juego, la más nueva primero. Si hay alguna que no viste, el panel lleva «● nuevo» (parpadea suave) hasta que lo abres. Lo visto se guarda en `midnight-rinse/novedades`.
- **Para publicar algo nuevo:** se agrega una línea con un `id` mayor en `MR.NOVEDADES`, más su traducción. Está anotado en el README.
- Prueba nueva. Resultado: 48/48.

## 58. Subtítulos con fondo oscuro (opción)
- **Opción** «Fondo oscuro detrás de los subtítulos»: una franja negra al 72 % detrás del texto, solo cuando hay subtítulos. Se lee mejor con brillo alto, en el bosque con luna llena o en el celular a pleno sol. Se guarda con las opciones y aparece en «Novedades».
- Prueba nueva. Resultado: 49/49.

## 59. Álbum de la noche y Pelusa en las fotos
- **Logro «Álbum de la noche»:** sacar fotos en la lavandería, el bosque y el pasillo en el mismo turno. Invita a explorar con la cámara.
- **Pelusa en la foto:** si el gato sale en cuadro (a menos de 4,5 m), al revisar la foto: «Pelusa sale movida, como en todas las fotos». Una vez por turno, y nunca en la foto en que sale él.
- Prueba nueva. Resultado: 50/50.

## 60. Noche especial «Tormenta eléctrica»
- **Qué cambia:** relámpagos cada 7–16 s (en vez de 24–55; el primero llega a los 4–9 s) y truenos cercanos más seguidos (60 % en vez de 35 %). Un trueno cercano, estando adentro, hace parpadear algunas luces, y los apagones del director salen 1,8 veces más. En el bosque, cada relámpago es otra oportunidad de verlo entre los árboles. Es la séptima noche especial.
- **Novedades:** se agregaron esta noche y el «Álbum de la noche».
- Prueba nueva: 4 relámpagos en un minuto de juego y luces que parpadean con el trueno. Resultado: 51/51.

## 61. «Continuar turno» recuerda lo nuevo
- **El autoguardado** ahora incluye los sustos ya vistos esa noche (la cara en la tele, él en el espejo, si ya notaste que no te reflejas) y las fotos del turno (lugares del «Álbum», cuántas, si ya salió él o Pelusa). Al recargar, los sustos no pasan de su límite por noche y no se pierde el progreso del álbum. Los guardados viejos siguen sirviendo: los campos nuevos son opcionales.
- Prueba nueva. Resultado: 52/52.

## 62. Cinco skills del proyecto y el pipeline completo
- **Skills en `.claude/skills/`**, pedidas por Yesda: `midnight-creative-engine`, `retro-psx-optimizer`, `perpetual-task-runner`, `qa-sentinel-audio` y `lorekeeper-blackwood`. Cada una tiene su `SKILL.md`, con cuándo usarla, los pasos y las reglas, y una herramienta que funciona. Son instrucciones y scripts que se cargan al trabajar en el proyecto, no procesos que corran solos: el «automático» es el ciclo del `perpetual-task-runner`, que llama a las otras en cada vuelta.
- **`TASK_BACKLOG.md`:** pendientes, 5 ideas del motor creativo (3 microanomalías y 2 variaciones, revisadas contra el canon), bloqueadas y hechas.
- **`CANON.md`:** el canon real del juego (lugar, horarios, él, los seis de antes, reglas del misterio, inventario de textos). Las propuestas de Yesda (el embalse de 1986, las caras blancas, las máscaras negras, el bosque infinito, «Blackwood») quedan en la §7 como pendientes de decisión: hoy no están en el juego y `lore_check.py` las rechaza en textos nuevos hasta que se aprueben.
- **Primera tarea del ciclo:** `textos_en.js` (~80 KB) solo se descarga en inglés. La etiqueta en `index.html` es inerte (`type="text/plain"`), así que el sellado de versión y el service worker la siguen viendo y el modo sin conexión en inglés sigue funcionando. `idioma.js` la carga con `document.write` antes que los demás scripts. Prueba: en español `MR.TEXTOS_EN` no existe, y la prueba en inglés sigue pasando.
- **Prueba nueva del audio:** el primer toque despierta el ambiente, y un `AudioContext` suspendido (llamada, otra app) se reanuda con el siguiente toque.
- **Resultados del pipeline:**
  - Centinela: estático, núcleo JS, 53/53 partidas y, en el modo completo, las 203 pruebas de Python y la versión en vivo.
  - Auditoría PS1: todos los invariantes en orden.
  - Canon: sin contradicciones.

| Área | Llamadas de dibujo | Triángulos | ms update+render (CPU, SwiftShader) |
|---|---|---|---|
| Sala | 138 | 2 264 | 3,2 |
| Bosque | 27 | 19 437 | 0,4 |
| Pasillo (con espejo) | 50 | 1 006 | 1,5 |

## 63. Microanomalía «La moneda de canto» (la primera del motor creativo)
- **Qué pasa:** una vez por noche, si llevas monedas y la bandeja está vacía, el director puede programar «moneda_canto» en la zona nueva del **cambiador**. Solo ocurre con esa zona fuera de vista o con los ojos cerrados (despachador de oclusión): te falta una moneda y en la bandeja aparece otra **parada de canto**, girando despacio, con unos tintineos muy bajitos cada vez más juntos. Al verla de cerca: «(En la bandeja del cambiador hay una moneda parada de canto. En tu bolsillo falta una.)». Al recogerla vuelve tu moneda: «(La moneda está tibia, como si alguien la hubiera tenido en la mano.)». No hay jumpscare; es paranoia de cuentas que no cuadran. Nunca en Paseo.
- **Proceso:** salió del backlog (idea del motor creativo, aprobada por el ciclo autónomo por ser chica y no tocar el canon). Pasó por el verificador del canon y por la auditoría PS1, y tiene su traducción y su línea en «Novedades».
- **Prueba nueva:** no ocurre mientras miras el cambiador, sí de espaldas; el subtítulo solo sale al verla; recogerla devuelve la moneda; no se repite la misma noche. Resultado: 54/54.

## 64. Microanomalía «Ropa doblada»
- **Qué pasa:** una vez por noche, con el mostrador fuera de vista (despachador de oclusión), aparece una pila de ropa doblada (gris, azul y beige) entre la impresora y la hoja del registro, con dos roces de tela a tus espaldas. Al verla de cerca: «(Alguien dobló ropa que nadie trajo. Huele a tu suavizante.)». Al tocarla: «(Está tibia, recién salida de una secadora que nadie usó.)». Tres parpadeos después de verla, ya no está. Nunca en Paseo.
- **Proceso:** segunda idea del backlog. Pasó por el canon y la auditoría PS1, y la revisé con una captura en Chrome sin ventana: la pila queda apoyada en el mostrador.
- Prueba nueva (no aparece mientras miras; sí de espaldas; aviso; tacto; tres parpadeos). Resultado: 55/55.

## 65. Huellas mojadas: al volver del bosque y «son de tu talla»
- **La idea venía duplicada:** el motor creativo propuso «Huellas mojadas» sin ver que ya existía el susto `huellas` (del vidrio al banco, solo con él presente y sin subtítulo). En vez de duplicarlo, el ciclo lo **amplió**: al volver del bosque, la mitad de las veces (una por noche, nunca en Paseo), aparecen aunque él no esté, programadas en la zona del banco (solo cuando no la miras). Al verlas de cerca: «(Hay huellas mojadas en el piso que van del vidrio al banco amarillo. Son de tu talla.)».
- **El motor creativo aprendió:** `estado.py` ahora lista también los eventos que el mundo ya tiene preparados (comentarios «evento» de `world.js`), para no proponer lo que ya existe.
- Prueba nueva. Resultado: 56/56.

## 66. Radio: la dedicatoria (noches 3 a 6)
- **Qué pasa:** en las noches 3 a 6, unos 9 s después de la transmisión de las 02:40 (si la escuchaste), el locutor agrega: «Antes de irnos: esta va para alguien que sigue doblando ropa ajena a esta hora. Ya sabe quién es.» Si escribiste tu nombre en las opciones, 3,5 s después: «(Entre la estática, alguien dice tu nombre: «…Nombre…».)», con voz de susurro. Nunca en las noches 1, 2, 7 y 8 (la 7 revela la hora verdadera y la 8 es la despedida).
- **Canon:** anotada en CANON.md §6. Va en el mismo horario de la radio, sin horarios nuevos.
- Prueba nueva (noches 2, 3 con y sin nombre, y 8). Resultado: 57/57.
- **Arreglo de la prueba:** en vivo falló porque 3 cuadros no alcanzaban a cruzar las 02:40 desde 3 s antes; en local pasaba solo porque el bucle real del juego seguía corriendo durante la espera. Ahora arranca a 0,6 s de juego de las 02:40 y comprueba que la radio habló.

## 67. Noche de niebla: la segunda farola
- **Qué pasa:** solo en las noches de niebla, más adentro del bosque hay otra farola encendida (ranura de luz 5). Si caminas hacia ella, retrocede: siempre está a ~7,5 m, un resplandor entre la niebla (que corta a los 9 m). La primera vez que la ves: «(Entre la niebla hay otra farola, más adentro. No la habías visto.)». Si la pierdes de vista 2 s, se apaga con un chasquido eléctrico; al volver a mirar: «(La farola de adentro está apagada. Como si nunca hubiera estado encendida.)». Si llega al borde del bosque, también se apaga.
- **Sin colisión:** nunca llegas a ella. Las noches normales no cambian.
- Prueba nueva (no aparece en noche normal; retrocede; aviso; se apaga a espaldas; segundo aviso). Resultado: 58/58.

## 68. El banco amarillo se puede tocar
- **Qué pasa:** el asiento y el respaldo son tocables. Antes de que él aparezca: «(El banco está frío.)». Con él sentado: «(No te atreves a sentarte a su lado.)». Cuando ya se fue: «(El banco está tibio, como si alguien acabara de levantarse.)», y el miedo sube un poco. Es la primera idea de la segunda tanda del motor creativo, que además propuso: pasos arriba, el cesto, el sombrero y el tendedero (en el backlog).
- Prueba nueva. Resultado: 59/59.

## 69. Pasos arriba (solo sonido)
- **Qué pasa:** desde que él apareció, si te quedas quieto 6 s en la sala con menos de 3 máquinas tapando el zumbido (`calmSources() < 3`), se oyen seis pasos graves y amortiguados en el techo, cruzando de izquierda a derecha. Después: «(Arriba se oyen pasos. La lavandería no tiene segundo piso.)». Una vez por noche, nunca en Paseo. No hay nada que ver: es pura paranoia de sonido, y premia mantener las máquinas andando.
- Prueba nueva (con 3 lavadoras no; caminando no; quieto y en silencio sí, con subtítulo). Resultado: 60/60.

## 70. El cesto que se llena
- **Qué pasa:** entre lavadoras y secadoras hay un cesto de plástico vacío, con su propia zona de oclusión. Desde que él apareció, el director puede programar «cesto» hasta tres veces por noche: solo cuando no lo miras (o parpadeas), aparece un uniforme más, con un roce de tela. Lleno y visto de cerca: «(El cesto está lleno de uniformes como el tuyo. Todos secos. Todos tibios.)». Al tocarlo: vacío, «(Un cesto de plástico vacío.)»; con uniformes, «(Están tibios. Ninguno tiene nombre todavía.)», una pista de que el ciclo espera a otros. Revisado con captura: la última capa asoma sobre el borde.
- **Rendimiento:** en la sala, de 138 a 142 llamadas de dibujo.
- Prueba nueva. Resultado: 61/61.

## 71. El sombrero que se queda
- **Qué pasa:** cuando él se va porque le dijiste la hora verdadera, su sombrero (ala y copa, como el de su modelo) queda sobre el banco amarillo. Al verlo: «(En el banco amarillo quedó su sombrero. Está seco.)». En el siguiente parpadeo, ya no está. Es lo único que deja, y solo un momento.
- Prueba nueva. Resultado: 62/62.

## 72. Luna llena: el tendedero
- **Qué pasa:** solo en las noches de luna llena (sin lluvia ni viento), junto a la curva del sendero hay un tendedero entre dos pinos con tres uniformes colgados, que se mecen despacio. Al verlo de cerca: «(Entre dos pinos hay un tendedero con uniformes colgados. Se mecen, pero no hay viento.)». Revisado con captura: queda entre el follaje, como dice el texto.
- **Prueba:** la primera versión medía el vaivén en solo medio segundo y fallaba si justo estaba en el punto más alto del seno. Ahora mide el rango durante 1,5 s. Resultado: 63/63.
- Con esto se terminaron las cinco ideas de la segunda tanda del motor creativo.

## 73. Ritmo de sustos por turno (medición)
- **Cómo:** 6 turnos completos con semilla (Tranquilo, Normal y Pesadilla, dos de cada uno), con un jugador que pasea al azar, contando cada evento que aplica el director (sin contar los susurros).

| Dificultad | Eventos por turno | Cierres automáticos | Uno cada (sin cierres) | Sustos de esta sesión |
|---|---|---|---|---|
| Tranquilo | 75–76 | 9–12 | ~14 s | cesto 1–3, ropa doblada 0–1, huellas 1–2 |
| Normal | 139–143 | 13–20 | ~7–8 s | cesto 3, ropa doblada 1, huellas 5–7 |
| Pesadilla | 246–248 | 35–42 | ~4 s | cesto 3, ropa doblada 1, huellas 4–10 |

- **Lectura:** el ritmo lo fija el diseño del núcleo. Entre las 02:00 y las 05:00 de juego, `anomalyMultiplier` vale 3× (`clockAnomaly`, port exacto del Python), y el miedo suma hasta 1,8×. Así, los 34 s base bajan a ~6 s en la hora fuerte. La mayoría son anomalías chicas (un charco, una puerta, una luz que falla) y todas ocurren fuera de tu vista. Los sustos de esta sesión tienen tope por noche y no dominan. Las «huellas» se repiten porque el susto original vuelve cada vez que se secan.
- **Sin cambios de pesos.** Si a Yesda le parece mucho para Normal, la palanca es el multiplicador 3× de la hora fuerte o el factor del miedo. Es una decisión de diseño, así que queda anotada.

## 74. Sprint 1 del modo autónomo: Blackwood llega al mostrador
- **Canon:** CANON.md §7 aprobado e integrado (Blackwood bajo el embalse en 1986, caras blancas, máscaras negras de la Administración del Embalse, bosque infinito). `lore_check.py` con reglas nuevas.
- **`clientela.js`:** visitantes que caminan por la sala con una ruta de puntos (entrada → pasillo central → destino), esperan si estás en su camino y se balancean al caminar. Las caras blancas ponen a lavar en una lavadora libre (que arranca de verdad), murmuran y se van; si las miras de cerca, giran la cara. Las máscaras negras se paran frente al mostrador y la impresora entrega una ORDEN, que queda en el Archivo (nuevo grupo, 12 órdenes).
- **Diálogos:** 40 líneas generadas con Gemini (agy) en la computadora de Yesda, revisadas (6 corregidas) y traducidas. Voz «cara» suave en la síntesis.
- **Decisiones y lo verificado:** en `CHANGELOG.md`. Revisado con capturas: la máscara facetada junto al mostrador y la cara lisa frente a las lavadoras.
- Prueba nueva. Resultado: 64/64.

## 75. Sprint 2a: la rutina de Pelusa
- **La rutina** decide qué hace Pelusa según la hora (antes era al azar), y la alarma cuando él está cerca sigue mandando: 01:10 duerme en la secadora · 01:40 come de su plato (nuevo, junto al mostrador; crujido de croqueta) · 02:00 se acicala (la pata a la cara) · 02:30 se sienta frente a la puerta de vidrio a mirar afuera, con la cola barriendo el piso, y cada tanto la rasca («(Pelusa rasca la puerta de vidrio, despacio, mirando hacia afuera.)»; la orden N.º 31 de la Administración habla de esto) · 03:00 hace la ronda por la sala · 03:30 te sigue · 04:00 siesta en el banco (o en el mostrador si él está sentado ahí) · 04:30 se queda cerca de ti.
- **Red de caminos:** dos puntos nuevos (el plato y la puerta).
- Prueba nueva (las ocho franjas). Resultado: 65/65.

## 76. Sprint 2b: la avenida con vida por la vidriera
- **La pared del frente** tiene ahora dos vidrieras abiertas, con marco: x ∈ [−7,6; −5,3] y x ∈ [3,5; 7,6], de 0,95 a 2,45 m. Las caras de pared se rearmaron alrededor, sin tocar el cambiador, la máquina de café ni el teléfono. El jugador sigue sin poder salir por ahí (límites de la sala).
- **`world._city()`:** veredas, asfalto mojado con líneas, seis edificios de ladrillo con fachada pintada en lienzo (ventanas que se encienden y apagan; alguna con luz azul de tele), letreros («+ FARMACIA», que se traduce; «TORTILLERIA» y «HOTEL», que no), cuatro farolas con su charco de luz, tres autos con faros y luces traseras, tres personas con paraguas, lluvia (líneas de 1 px en una sola geometría) y el agua que sube. Lo fijo va unido por material. La avenida tiene su propia niebla (9–34 m) para verse viva a través de la de la sala (5–17 m), con materiales propios para no tocar los compartidos. Las vidrieras se tocan sin dibujarse (`colorWrite: false`).
- **`ciudad.js`:** la vida va de 1 a 0 entre las 01:50 y las 04:00 (autos cada 5 a 30 s, gente cada 6 a 25 s, ventanas y letreros que se apagan; la farmacia nunca). El agua sube de 03:30 a 05:00 hasta cubrir la vereda. Hay murmullo de tráfico según la vida y siseo de llantas que cruza de un lado al otro. Tocar la vidriera describe lo que se ve, según la hora. En el bosque y el pasillo no se dibuja.
- **Rendimiento:** sala de 142 a 151 llamadas de dibujo (umbral 220). Revisado con capturas a la 01:20 y a las 04:50.
- Prueba nueva. Resultado: 66/66.

## 77. Sprint 3: el bosque infinito, la secadora solitaria y la pista zen
- **Bosque infinito y no euclidiano** (`bosque._infinite`): al pasar el borde lejano (z > 148,4) o los costados (|x| > 20,6), te hace parpadear, y en el parpadeo te devuelve al otro lado (z − 41 o x ∓ 40,4), mirando hacia el mismo lado. La primera vez: «(Parpadeas. El sendero sigue igual que hace un momento. Demasiado igual.)». Las cosas cambian cuando cierras los ojos (regla del juego), así que el salto no se ve. Los bordes sólidos quedan de respaldo.
- **La secadora solitaria:** después de la segunda vuelta aparece en un claro propio (sin pinos encima), con la puerta ámbar que palpita y el cuerpo que tiembla al centrifugar. Al acercarte la notas; al tocarla: «(Está tibia. En la puerta tiene una etiqueta descolorida: «La Espuma · 1987».)». Logro oculto «La secadora solitaria».
- **Pista zen / lo-fi procedural** (`audio.setForest`): acordes de Rem9, Sol9, Do maj9 y Lam9 (2,7 s por compás) con seno y triángulo un poco desafinados, como cinta, campanitas pentatónicas, crepitar de vinilo y un filtro pasa bajos. Sube al salir, baja con el miedo y se corta al volver. En pausa no acumula compases.
- **Pruebas:** `probar.py` ahora corre Chrome con `--autoplay-policy=no-user-gesture-required`, así que las pruebas usan el audio de verdad (contexto `running`). Prueba nueva: dos vueltas, la secadora, el logro y la pista (que suena afuera y se corta adentro). El primer intento falló porque el parpadeo forzado se perdía si caía con los ojos todavía abriéndose; corregido. Resultado: 67/67.

## Pendientes y siguiente paso
- **Coliseo:** si quieres completar las 5 arenas restantes con Gemini, hacen falta unas 3–4 ventanas de cuota. No es necesario para jugar: esas piezas ya están verificadas con pruebas de mutación y vectores dorados.
- **Material NO VERIFICADO de tu diseño:** shader en motor nativo, arte con Midjourney/SDXL/FLUX y música con Suno/Udio. El juego no depende de él: genera sus texturas y su audio por código. Si produces ese arte y audio, se pueden integrar sustituyendo `textures.js` y los buses de `audio.js`.
- **SIGUIENTE PASO (tú):** abre `juego/index.html`, ponte audífonos y juega un turno completo. Dime qué ajustar: duración, dificultad o frecuencia de sustos.
- **En el celular:** se necesita un teléfono real para afinar la vibración, el giroscopio y la sensación de los gestos (en Chrome se probaron con toques sintéticos). Para abrirlo en el teléfono, súbelo a un hosting estático (GitHub Pages, Netlify) o sírvelo desde tu PC en la red local.
