| ID | Fase / Milestone | Tarea / Vector | Destino | Ejecutor | Dependencia | Estimado | Holgura | Prioridad | Estado |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **★ TSK-00** | C) Blind-Spot Engine | Prueba de conexión: lote de prueba de la Arena 1 por el camino real (no cuenta) | Shell | [AUTÓNOMO] | Ninguna | 0.5 h | 0 h | P0 | 🟢 LISTO |
| **★ TSK-01** | C) Blind-Spot Engine | Arena 1 · blind_spot_dispatcher: cadena de 8 lotes (32 gladiadores) | Shell | [AUTÓNOMO] | TSK-00 | 2 h | 0 h | P0 | ⚪ BLOQUEADO |
| **★ TSK-02** | E) Capa meta-diegética | Arena 7 · shift_log: cadena de 8 lotes (32 gladiadores) | Shell | [AUTÓNOMO] | TSK-01 | 2 h | 0 h | P0 | ⚪ BLOQUEADO |
| **★ TSK-03** | A) Núcleo táctil | Arena 5 · detent_dial: cadena de 8 lotes (32 gladiadores) | Shell | [AUTÓNOMO] | TSK-02 | 2 h | 0 h | P0 | ⚪ BLOQUEADO |
| **★ TSK-04** | A) Núcleo táctil | Arena 4 · stepped_hands: cadena de 8 lotes (32 gladiadores) | Shell | [AUTÓNOMO] | TSK-03 | 2 h | 0 h | P0 | ⚪ BLOQUEADO |
| **★ TSK-05** | B) Pipeline retro | Arena 2 · bayer_rgb555: cadena de 8 lotes (32 gladiadores) | Shell | [AUTÓNOMO] | TSK-04 | 2 h | 0 h | P0 | ⚪ BLOQUEADO |
| **★ TSK-06** | B) Pipeline retro | Arena 3 · vertex_snap: cadena de 8 lotes (32 gladiadores) | Shell | [AUTÓNOMO] | TSK-05 | 2 h | 0 h | P0 | ⚪ BLOQUEADO |
| **TSK-07** | E) Capa meta-diegética | Arena 6 · clock_anomaly: cadena de 8 lotes (32 gladiadores) | Shell | [AUTÓNOMO] | TSK-06 | 2 h | 3 h | P0 | ⚪ BLOQUEADO |
| **TSK-08** | A) Núcleo táctil | Integración: paquete midnight_rinse_core en core/, prueba de integración de los 7 módulos, Centinela y guía de portado GDScript/C# | Shell | [AUTÓNOMO] | TSK-01, TSK-02, TSK-03, TSK-04, TSK-05, TSK-06, TSK-07 | 1.5 h | 3 h | P0 | ⚪ BLOQUEADO |
| **★ TSK-09** | B) Pipeline retro | Plan del shader retro (jitter 320x240, afín noperspective, Bayer 8x8 RGB555, vaho de lente) · NO VERIFICADO POR EL COLISEO | Shell | [AUTÓNOMO] | TSK-05, TSK-06 | 0.5 h | 0 h | P2 | ⚪ BLOQUEADO |
| **★ TSK-10** | B) Pipeline retro | Implementar el shader retro en el motor (Godot 4 / Unity URP) | Shell | [OPERADOR] | TSK-09 | 6 h | 0 h | P1 | ⚪ BLOQUEADO |
| **TSK-11** | D) Audio | Plan del mezclador de audio de 3 canales y prompts de Suno/Udio y guiones diegéticos · NO VERIFICADO POR EL COLISEO | Shell | [AUTÓNOMO] | Ninguna | 0.5 h | 14.5 h | P2 | 🟢 LISTO |
| **TSK-12** | D) Audio | Generar música, ambiente, radio y guiones de voz en herramientas externas | Shell | [OPERADOR] | TSK-11 | 4 h | 14.5 h | P2 | ⚪ BLOQUEADO |
| **TSK-13** | E) Capa meta-diegética | Plan de la capa meta-diegética (hora del sistema, cierre a las 05:12 de juego, susurros opcionales y avisados) · NO VERIFICADO POR EL COLISEO | Shell | [AUTÓNOMO] | TSK-02, TSK-07 | 0.5 h | 4 h | P2 | ⚪ BLOQUEADO |
| **TSK-14** | F) Arte | Prompts de arte (Midjourney / SDXL / FLUX) con estética de consola de 5ª generación · NO VERIFICADO POR EL COLISEO | Shell | [AUTÓNOMO] | Ninguna | 0.5 h | 12.5 h | P2 | 🟢 LISTO |
| **TSK-15** | F) Arte | Generar el arte en herramientas externas (lavandería 03:37, Cliente Inmóvil, panel de monedas) | Shell | [OPERADOR] | TSK-14 | 6 h | 12.5 h | P2 | ⚪ BLOQUEADO |

Camino crítico (★): TSK-00 → TSK-01 → TSK-02 → TSK-03 → TSK-04 → TSK-05 → TSK-06 → TSK-09 → TSK-10 · duración mínima del proyecto: 19 h
