# MIDNIGHT RINSE · Turno de Medianoche

Terror liminal acogedor en primera persona, con estética PS1 a 320×240. **+18:** contiene consumo de tabaco, alcohol y cannabis (ficción). Es tu turno de noche en la Lavandería La Espuma, de 01:10 a 05:12. No hay HUD: todo se hace con las manos (monedas, perillas, filtros de pelusa, el trapeador y el vaho de tus lentes). El horror nunca ataca de frente: solo ocurre fuera de tu campo de visión o mientras parpadeas.

## Cómo jugar

**Doble clic en `juego/index.html`.** No necesita instalación, servidor ni internet: Three.js r128 va incluido en `juego/vendor/`. Funciona en Chrome, Edge o Firefox con WebGL. Usa audífonos.

| Control | Acción |
| :--- | :--- |
| **WASD** / flechas | Caminar |
| **Ratón** | Mirar |
| **Clic** | Usar: monedas, ranuras, la hoja del registro, el teléfono, el trapeador |
| **Mantener clic + mover el ratón** | Girar perillas (lavadoras, radio) |
| **Mantener clic** | Fregar un charco (con el trapeador) o limpiar un filtro de pelusa |
| **E** (mantener) + ratón | Limpiar el vaho de los lentes |
| **B** | Cerrar los ojos (cuidado: lo que no ves puede moverse) |
| **C** · **F** · **J** | Fumar un cigarro · beber de la petaca · fumar un porro |
| **1 · 2 · 3** | Responder cuando alguien te habla |
| **Esc** | Pausa |

### En el celular (Zero-HUD: pantalla 100 % limpia)
Abre `juego/index.html` en el navegador del teléfono (o publícalo en cualquier hosting estático) y juega en horizontal. No hay joysticks dibujados ni botones:

| Gesto | Acción |
| :--- | :--- |
| **Pulgar izquierdo** (mitad izquierda) | Joystick dinámico invisible: donde apoyas el dedo queda el centro; arrastra para caminar con suavidad |
| **Pulgar derecho** (mitad derecha) | Arrastrar para mover la cabeza |
| **Tocar un objeto** | Usar ESE objeto: monedas de la bandeja, ranura, manija de la puerta, la hoja, el teléfono, el trapeador |
| **Mantener sobre un objeto y arrastrar** | Girar una perilla; mantener sobre un charco o un filtro para fregar o limpiar. Un toque rápido en una perilla la avanza un retén |
| **Doble toque** en el vacío | Parpadeo instantáneo |
| **Dos dedos hacia abajo** | Frotar los lentes: el vaho se limpia justo donde pasan los dedos, como si limpiaras la pantalla |
| **Esquina inferior derecha** | Asoman la punta de un cigarro y el tapón de la petaca: desliza **hacia arriba** para el cigarro, **hacia la izquierda** para el porro, **en diagonal** para beber |
| **Tres dedos** | Pausa |
| **Inclinar el teléfono** | Micro-balanceo de la mirada con el giroscopio (opcional) |

**Vibración** (si el navegador la soporta; iOS Safari no):
- 10 ms en cada retén de una perilla y 25 ms secos al meter una moneda.
- Pulso rítmico mientras friegas.
- Pulsación sorda y pesada cuando el Cliente Inmóvil camina cerca de ti.

Se puede desactivar en las opciones.

### Consumibles
- **Cigarro (5):** baja el pavor poco a poco, pero el humo empaña tus lentes.
- **Petaca (4 tragos):** baja mucho el pavor, pero te marea la vista y te hace **parpadear más seguido**. Y el horror ocurre en cada parpadeo.
- **Porro (3):** colores más intensos con aberración cromática, el tiempo del turno se estira (hasta un 18 % más lento), tu música suena con reverberación y el pavor baja mucho… pero la **paranoia** acelera los eventos y trae susurros fuera de hora.

### Tu música dentro del juego (YouTube Music u otra)
En la pantalla de título (y en la pausa) está el panel **«Tu música dentro del juego»**. Tu música no suena encima del juego: suena **desde la radio del mostrador, en la 99.9 FM**, en audio 3D.
- **Computadora (Chrome o Edge):** abre YouTube Music en otra pestaña con tu cuenta y pon lo que quieras. Pulsa **Conectar pestaña**, elige esa pestaña y marca **«Compartir audio de la pestaña»**. La pestaña original se silencia y su audio entra al juego.
- **Celular:** el navegador no deja tomar el audio de otra app, así que eliges canciones de tu teléfono. O deja tu música sonando en otra app y activa **«Callar la radio del juego»**.
- **Cómo suena en el juego:**
  - Baja si te alejas y cambia de oído según hacia dónde miras (HRTF).
  - Si mueves la perilla fuera de la 99.9, se pierde entre la estática. En la pantalla de la radio dice **«TU»** cuando estás sintonizado.
  - Se ahoga cuando el Cliente Inmóvil está cerca y se corta en los apagones y los susurros. En el colapso suena «bajo el agua».
  - Opción **«Sonido de radio vieja»** (lo-fi) o fidelidad completa.
- **Requisitos:** para YouTube Music hace falta internet y servir el juego por `http(s)`, por ejemplo GitHub Pages. La captura de pestaña no funciona abriendo el archivo con doble clic. Nada se graba ni se sube: el audio solo pasa por tu navegador.

Un turno dura unos 15 minutos reales. Para probar más rápido: `index.html?velocidad=4`.

### Qué hacer durante el turno
- **Lee la hoja del registro** sobre el mostrador. La imprime la impresora térmica a las 01:15… y cambia sola durante la noche.
- **Friega el pasillo central** (entre las lavadoras y el banco): cada 45 minutos alguien revisa si hay charcos. El trapeador está en el almacén, al fondo a la izquierda.
- **Mantén las lavadoras en marcha:** saca monedas del cambiador junto a la entrada, mete una en la ranura y gira la perilla. Su ruido tapa un zumbido grave que no quieres oír.
- **Limpia los filtros de pelusa** de las secadoras antes de que se saturen: el vapor empaña tus lentes.
- **Sintoniza la radio** del mostrador en la 94.1. A las 02:40 habla el locutor.
- **Las reglas del registro importan.** Hay dos finales.

### Accesibilidad y privacidad (pantalla de título)
- Subtítulos (activados), voces sintetizadas del navegador (opcionales), **reducir destellos de luz**, punto de mira opcional, sensibilidad y volumen.
- **Capa meta-diegética (opcional y avisada):** puede usar la hora real de tu computadora. Si juegas entre las 02:00 y las 05:00, las anomalías se triplican.
- **Tu nombre en los susurros:** opcional. Lo escribes tú y no sale de tu navegador. El juego no lee tu nombre de usuario del sistema.
- El registro del turno **persiste entre partidas** y nunca retrocede. Se puede borrar desde la pantalla de título.

## Estructura

```
midnight-rinse/
├── juego/                         ← el juego (abrir index.html)
│   ├── index.html                 pantallas DOM + orden de carga
│   ├── vendor/three.min.js        Three.js r128 (MIT)
│   ├── src/core/                  núcleo verificado: ports exactos de core/ a JavaScript
│   │   ├── dispatcher.js          Blind-Spot Dispatcher (campeón de Gemini G002)
│   │   ├── shiftLog.js            bitácora monótona y persistente (campeón de Gemini G007)
│   │   ├── bayer.js · vertexSnap.js · steppedHold.js · detentDial.js · clockAnomaly.js
│   ├── src/engine/                motor del juego
│   │   ├── config.js · util.js    constantes del turno y utilidades
│   │   ├── textures.js            texturas procedurales 8–128 px (sin archivos)
│   │   ├── retro.js               pipeline PS1: 320×240, vertex snap, afín, Gouraud, Bayer RGB555
│   │   ├── audio.js               audio procedural: radio, estática, infrasonido, susurros, voces
│   │   ├── input.js · player.js   control en primera persona, parpadeo, manos a 15 Hz
│   │   ├── touch.js               móvil Zero-HUD: gestos invisibles, vibración y giroscopio
│   │   ├── consumables.js         cigarro, petaca y porro (calman, pero con costo)
│   │   ├── music.js               tu música (pestaña de YouTube Music o archivos) por la radio 3D
│   │   ├── world.js               la lavandería: geometría, colisiones, zonas y anclas
│   │   ├── glasses.js             vaho de lentes: mapa de humedad de dos pasadas
│   │   ├── gameplay.js            interacción táctil y sistemas (lavadoras, secadoras, charcos…)
│   │   ├── horror.js              Blind-Spot Engine: eventos por zona y el Cliente Inmóvil
│   │   ├── ui.js · game.js        pantallas, director del turno, infracciones y finales
│   └── tests/                     nucleo.test.js + vectores.json (dorados desde Python)
├── core/                          núcleo lógico en Python 3.9+ (especificación ejecutable)
│   ├── midnight_rinse_core/       los 7 módulos
│   ├── tests/                     203 pruebas (las 7 baterías del Coliseo + integración)
│   └── generar_vectores.py        genera juego/tests/vectores.json
├── AUDITORIA.md                   qué se rescató del material de Gemini y por qué
├── PORTADO.md                     guía de portado a GDScript (Godot 4) y C# (Unity)
├── REPORTE.md                     reporte final del proyecto
├── arenas/ · campeones/           el Coliseo: arenas, actas reales y campeones de Gemini
└── PROGRESO.md · plan.md · plan.json
```

## Arquitectura en una página

- **Núcleo verificado → motor.** Las 7 piezas de lógica (despachador de horror por oclusión, bitácora, dithering, vertex snapping, manos a pasos, perilla con retenes y anomalía del reloj) viven en `core/` (Python) y en `juego/src/core/` (JavaScript). Los ports de JavaScript se prueban contra miles de entradas y salidas exactas generadas desde Python.
- **El horror por oclusión.** `horror.js` le da a cada zona de la lavandería su propio `Dispatcher`. En cada cuadro, la visibilidad de la zona sale del frustum de la cámara, y `tick(visibilidad, ojosCerrados)` solo dispara los eventos de esa zona si nadie la mira o si parpadeas. La zona "jugador" (detrás de ti) solo se activa al parpadear.
- **La estética PS1 es la misma matemática del núcleo.** El shader de los materiales aplica la fórmula de `vertex_snap` por vértice, y el postproceso aplica la de `bayer_rgb555` por píxel. Las manos pasan por `SteppedHold(15)`, y las perillas son `DetentDial`.
- **Sin HUD.** La información está en el mundo: el reloj de pared, la hoja del registro, la pantalla de la radio, la luz de cada lavadora, las monedas en tu mano y el vapor de las secadoras.

## Verificación

```bash
cd core && py -m unittest discover -s tests -t .      # 203 pruebas del núcleo Python
node --test juego/tests/nucleo.test.js               # ports JS idénticos a Python (7 baterías)
py core/generar_vectores.py                          # regenerar los vectores dorados
```

Además, el turno completo se probó en Chrome. La simulación paso a paso del turno entero no dio errores, y con un jugador aplicado se llega al final bueno. También se probaron todas las interacciones táctiles, la regla de la mirada, la aparición detrás del jugador al parpadear, los eventos de la ventana ×3, el vaho de lentes y el colapso. El Centinela no reporta hallazgos críticos, altos ni medios.
