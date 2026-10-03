# PROGRESO · MIDNIGHT RINSE (Turno de Medianoche) · v4

Orquestador: Claude Code (terminal del usuario). Motor de los agentes: Gemini vía Antigravity CLI (`agy`), cuenta Google AI Pro.

## Decisiones y notas de plataforma
- **Sistema: Windows 11 (AMD64), Python 3.12.10.** Comandos con `py` y PowerShell. El sandbox local de la skill limita menos en Windows: sin límites de CPU, memoria ni tamaño de archivo (solo tiempo de ejecución y entorno sin secretos).
- **Modelo: Gemini 3.8 Flash (High) — `gemini-3.8-flash-high` — en TODOS los roles**, por instrucción directa del usuario ("usa gemini 3.8 flash"). Sustituye el reparto rápido/capaz de la sección 3.1. Es el modelo por defecto de agy; se fija explícito en `models_cli` para que no cambie si agy cambia su predeterminado.
- **Backend: `cli` con `cli_bin: agy`** (adaptador stream-json en `apex_llm.py`, instalado el 01/10/2026). Sin `GEMINI_API_KEY`.
- **Ejecución de las cadenas:** `Start-Process` no sirve aquí: los procesos que lanza el orquestador mueren al terminar cada comando (verificado el 02/10 11:55). El método de desacoplar por WMI fue bloqueado por el sistema de permisos ("persistencia no autorizada") y no se usa. Las cadenas corren como tareas en segundo plano de la sesión (máximo 2 h cada una); al vencer, se comprueba que no quede ningún `coliseo.py` vivo y se relanza el mismo comando, que reanuda sin repetir lotes. Costo: como mucho, el lote en curso cada 2 h.
- **Mantener despierto:** proceso con `SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED)` activo desde el 02/10 12:10, renovado cada 2 h; no cambia la configuración de energía. A las 12:09 la laptop estaba al 6% de batería y desconectada: con batería se suspende a los 45 min y se apaga en nivel crítico. Pedido al usuario: conectar el cargador y no cerrar la tapa.

## Fase 0 · Preparación — COMPLETADA (02/10/2026)
- **Parche del modo cadena:** el mensaje llegó con mojibake (UTF-8 leído como cp1252); los 3 archivos se extrajeron del registro de la sesión y se repararon por programa. SHA-256 coinciden al primer intento:
  - `aplicar_parche.py` b61a1fb4…e6b · `cadena.py` 6f4ec006…d81 · `seccion_skill_4_8.md` 4ea2d02a…98b
- `aplicar_parche.py` en `~/.gemini/skills/…` y `~/.gemini/config/skills/…` (esta es la que lee agy): ambos "Listo: cadena.py instalado y verificado (8 lotes de 4 = 32 gladiadores distintos)", con `coliseo.py.bak`.
- Verificado que `cadena.py` encuentra en `coliseo.py` todo lo que lee (sha256_files, read_text_tree, DIVISIONS, runs/LATEST, G000, telemetría: verdict, ledger, champion, rounds, burn_categories, redteam, final, sentinel.llm, observations).
- **Adaptador de agy:** presente (`apex_llm.py`: flavor agy, `_agy_command`, `_invoke_agy`; `coliseo.py` `cli_bin: agy`). Llamada real mínima por `CliBackend` con `gemini-3.8-flash-high`: OK en 9,8 s.
- `doctor.py`: exit 0, backend recomendado cli con agy. `selftest.py`: **6/6**.

### Calibración 3.1 (medida, 02/10/2026 11:52, modelo `gemini-3.8-flash-high`)
| Llamadas | Concurrencia | OK | 429 / avisos de cuota | Latencia mín · mediana · p95 · máx | Ritmo efectivo | Tokens medios (entrada · salida · razonamiento) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 12 (prompts tipo gladiador) | 4 | 12/12 | ninguno | 9,8 s · 15,2 s · **79,2 s** · 103,3 s | 6,1 llamadas/min | 12 809 · 594 · 7 067 |

- `request_timeout_s` = máx(120, 3 × 79,2) = **238 s**.
- `--rpm 20` inicial (sin 429 en la sonda). El ritmo medido (6,1/min) ya queda por debajo de 20: por la regla de 3.2 nunca se sube el rpm.
- Referencia (torneos previos del 02/10): gladiadores mediana 94,5 s, p95 122,7 s, máx. 154,1 s; jurado p95 52,3 s.

## Fase 1 · Plan — COMPLETADA (02/10 11:55)
- `dag.py init` (MIDNIGHT-RINSE, America/Mexico_City), `import plan.json` (16 tareas, 3 criterios de DoD), `validate` OK, `plan` → `plan.md` (salida literal). Camino crítico calculado por el programa: 19 h. Sin gh-sync, vault ni ics.
- Las arenas se encadenan como dependencias porque corren de una en una. La integración (core/) va en la fase A) Núcleo táctil.

## Fase 2 · Prueba de conexión — CUMPLIDA (02/10 16:43)
- 1.er intento (12:14): interrumpido. La laptop se quedó sin batería (6%, desconectada) y entró en baja energía hasta las 16:39. Ese lote no llegó a terminar.
- 2.º intento (16:41–16:43, 2 min 23 s): veredicto **APROBADO**, `ledger.failed` = 0, `retries` = 0, 4/4 sobreviven R0, 14 llamadas reales. Campeón de prueba G001.
- `runs/` de la Arena 1 borrada (la prueba no cuenta).
- Desde aquí las cadenas corren con `correr.ps1`, que pide a Windows `ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED` solo mientras dura la ejecución. Con espera moderna, apagar la pantalla puede suspender los programas, por eso la pantalla queda encendida.

## Validación de las arenas antes de lanzarlas (sin tokens)
Cada arena: `spec.md` con la sección 5 copiada por programa desde la orden reparada (literal), `arena.json` con la plantilla 3.5, `coliseo.py check --backend cli` OK y **pruebas de mutación**: versiones defectuosas de la referencia que las pruebas deben atrapar. Ninguna suite deja residuos en el directorio de trabajo.

| Arena | Públicas | Ocultas | Mutantes atrapados | Benchmark de la referencia |
| :--- | :--- | :--- | :--- | :--- |
| 1 · blind_spot_dispatcher | 10 | 20 | 10/10 (incluida la carrera sin candado) | 0,99 s |
| 7 · shift_log | 9 | 17 (4 se saltan en Windows: enlaces simbólicos y permisos) | 10/10 (escritura no atómica, sin candados, sin reintentos de os.replace…) | 6,6 s |
| 5 · detent_dial | 11 | 27 | 12/12 (distancia no circular, vueltas completas, histéresis…) | ~4 s |
| 4 · stepped_hands | 9 | 18 | 10/10 | 0,55 s |
| 2 · bayer_rgb555 | 10 | 18 | 10/10 (matriz traspuesta, umbral sin +0.5, round…) | 0,44 s |
| 3 · vertex_snap | 10 | 18 | 10/10 | 0,72 s |
| 6 · clock_anomaly | 8 | 13 | 9/9 (convierte zona, ValueError en vez de TypeError, rechaza subclases…) | 0,44 s |

Correcciones hechas durante la validación, todas en mis pruebas y no en la especificación:
- Arena 1: `assertEqual` sobre 50 000 elementos sustituido, porque su diff cuadrático agotaba el tiempo límite con soluciones erróneas.
- Arena 5: un valor esperado mal calculado (24 → 23 clicks con el retén desarmado). Se agregó la prueba de distancia circular cerca de 0/360.
- Arena 4: se agregó el t negativo como primera llamada (el mutante "acepta negativos" escapaba).
- Arena 2: el valor de la prueba de matriz traspuesta pasó de 0,49 a 0,495 (con 0,49 no distinguía).
- Arena 3: z con más decimales (el mutante "redondea z" escapaba).
- Arena 7: el `spec.md` incluye el dato de entorno (Windows/Unix, límite de 240 s por ejecución), porque en Windows `msvcrt.locking` con LK_LOCK reintenta cada 1 s.

**Defecto de la especificación detectado (Arena 3 · vertex_snap):** la fórmula literal NO es idempotente para |ndc| grandes. El error de redondeo (~4e-16 × nx) supera EPS = 1e-9. Medido sobre 100 000 vectores: 0 fallos con |ndc| ≤ 1e4, 2,5% con |ndc| ≤ 1e5 y 9,2% con |ndc| ≤ 1e6. Por eso la prueba de idempotencia de 100 000 vectores usa |ndc| ≤ 1e3 (un vértice real apenas pasa de 1), y en el borde 1e6 solo se prueban la aceptación y la cuadrícula. Así no se penaliza a quien implemente la fórmula literal.

## Estado de las arenas
| Orden | Arena | Estado | Lotes | Llamadas | Modelo | Reinicio de cuota |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Arena 1 · blind_spot_dispatcher | **aprobada** (02/10 16:45–17:18) | 8/8 | 326 | gemini-3.8-flash-high | — |
| 2 | Arena 7 · shift_log | **interrumpida por cuota** (6/8 válidos; el 7 se repite) | 6/8 | 254 (19 fallidas en el lote 7) | gemini-3.8-flash-high | **21:34:47 del 02/10** |
| 3 | Arena 5 · detent_dial | pendiente | 0/8 | — | gemini-3.8-flash-high | — |
| 4 | Arena 4 · stepped_hands | pendiente | 0/8 | — | gemini-3.8-flash-high | — |
| 5 | Arena 2 · bayer_rgb555 | pendiente | 0/8 | — | gemini-3.8-flash-high | — |
| 6 | Arena 3 · vertex_snap | pendiente | 0/8 | — | gemini-3.8-flash-high | — |
| 7 | Arena 6 · clock_anomaly | pendiente | 0/8 | — | gemini-3.8-flash-high | — |

## Arenas terminadas

### Arena 1 · blind_spot_dispatcher — APROBADA
- `coliseo.py check` OK · cadena de 8 lotes, 32 gladiadores distintos · `cadena.py verify`: **OK** · lote final APROBADO (públicas 10/10, ocultas 20/20, adversariales 59/59; fusión aceptada con 3 ideas; Centinela sin hallazgos serios).
- Campeón: **G002 · ALFA · Estructuras de datos O(1)** (le quitó el título a G076 en el lote 2 y lo defendió en los lotes 3 a 8). Copiado en `campeones/blind_spot_dispatcher/`. SHA del árbol = acta del lote final = `campeon_actual` = 8708dcbe…219e02.
- 326 llamadas, 0 fallidas, 0 reintentos en todos los lotes. Regla 3.2 sin alarmas. 33 min.

| Lote | Retadores | Veredicto | Campeón del lote | Título | Llamadas |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | G001, G026, G051, G076 | APROBADO | G076 | nuevo campeón | 26 |
| 2 | G002, G027, G052, G077 | APROBADO | G002 | nuevo campeón | 38 |
| 3 | G003, G028, G053, G078 | APROBADO | G000 | defendido | 38 |
| 4 | G004, G029, G054, G079 | APROBADO | G000 | defendido | 38 |
| 5 | G005, G030, G055, G080 | APROBADO | G000 | defendido | 38 |
| 6 | G006, G031, G056, G081 | APROBADO | G000 | defendido | 38 |
| 7 | G007, G032, G057, G082 | APROBADO | G000 | defendido | 38 |
| 8 (final) | G008, G033, G058, G083 | APROBADO | G000 | defendido (con fusión) | 72 |

## Incidencias
- **02/10 18:42 · Cuota de ventana agotada (Arena 7, lote 7).** Error exacto de agy (código 3): `Individual quota reached. Please upgrade your subscription to increase your limits. Resets in 2h52m26s.` Hubo 19 llamadas del jurado fallidas tras 6 reintentos cada una (125 reintentos, 329% de las llamadas), entre las 18:42:20 y las 18:51:39. El lote "aprobó" con 11/30 votos, pero por la regla 3.2 **se descarta y se repite completo**.
  - Reinicio de la cuota: **21:34:47** (los 19 avisos coinciden al segundo). Ventana aparente de 5 h (16:35 → 21:35).
  - Consumo medido en la ventana: **561 llamadas exitosas** en ~2 h (9,2 M tokens de entrada, 3,1 M de razonamiento). Es la capacidad del plan con Gemini 3.8 Flash (High) vía agy.
  - Acciones: cadena detenida a las 18:53 al empezar el lote 8, en la validación y sin gastar tokens, para poder repetir el lote 7 (`--redo` solo repite el ÚLTIMO lote terminado). Sin procesos vivos. `--rpm` se baja de 20 a 10 (regla 3.2: failed > 0). Espera en segundo plano hasta las 21:37; luego una llamada de prueba y relanzo `cadena.py run … --redo 7 --rpm 10`.
  - Previsión: con ~560 llamadas por ventana de 5 h, lo pendiente (~1 900 llamadas) necesita unas 3–4 ventanas más.

## Cambio de rumbo (02/10, noche)
- Por instrucción del usuario se detuvo el Coliseo y el orquestador tomó el control del desarrollo. Ver `AUDITORIA.md` y `REPORTE.md`.
- Sin procesos del Coliseo vivos. Quedan sin uso en `~/.gemini/skills/.../apex_llm.py` unos cambios del motor Claude (el usuario canceló su prueba). Compilan, pero no están probados ni replicados a `config/skills`.
- Entregado: `core/` (núcleo Python, 203 pruebas), `juego/` (juego completo en navegador, probado en Chrome) y la documentación (`README.md`, `AUDITORIA.md`, `PORTADO.md`, `REPORTE.md`).
