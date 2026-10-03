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

## Pendientes y siguiente paso
- **Coliseo:** si quieres completar las 5 arenas restantes con Gemini, hacen falta unas 3–4 ventanas de cuota. No es necesario para jugar: esas piezas ya están verificadas con pruebas de mutación y vectores dorados.
- **Material NO VERIFICADO de tu diseño:** shader en motor nativo, arte con Midjourney/SDXL/FLUX y música con Suno/Udio. El juego no depende de él: genera sus texturas y su audio por código. Si produces ese arte y audio, se pueden integrar sustituyendo `textures.js` y los buses de `audio.js`.
- **SIGUIENTE PASO (tú):** abre `juego/index.html`, ponte audífonos y juega un turno completo. Dime qué ajustar: duración, dificultad o frecuencia de sustos.
- **En el celular:** se necesita un teléfono real para afinar la vibración, el giroscopio y la sensación de los gestos (en Chrome se probaron con toques sintéticos). Para abrirlo en el teléfono, súbelo a un hosting estático (GitHub Pages, Netlify) o sírvelo desde tu PC en la red local.
