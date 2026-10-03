### 4.8 Modo cadena (el campeón se queda): para planes con cuota o concurrencia limitadas
Si el usuario lo pide, o si el motor no aguanta 100 gladiadores a la vez, usa la cadena en vez de un torneo único:

```bash
python3 "$SKILL_DIR/scripts/cadena.py" run arenas/<modulo> --backend <api|cli> --batches 8   # inicia o continúa
python3 "$SKILL_DIR/scripts/cadena.py" status arenas/<modulo>
python3 "$SKILL_DIR/scripts/cadena.py" verify arenas/<modulo>                                # compuertas de calidad
python3 "$SKILL_DIR/scripts/cadena.py" run arenas/<modulo> --redo 8                          # repite el último lote terminado
python3 "$SKILL_DIR/scripts/cadena.py" run arenas/<modulo> --reset                           # borra la cadena y empieza de cero
```

Cada lote es un torneo real de `coliseo.py` con 4 gladiadores nuevos (uno por división). El campeón del lote anterior entra como defensor del título y los 4 retadores compiten contra él en la Gran Final (con 4 gladiadores no hay duelos de división: deciden las pruebas, el jurado y los criterios objetivos). Si un retador lo supera, se queda con el título; si no, el defensor sigue. Con 8 lotes de 4 se completan **32 gladiadores distintos** (G001–G008, G026–G033, G051–G058 y G076–G083), siempre en orden y con pocas llamadas simultáneas. Los lotes intermedios llevan equipo rojo (2) y jurado (3) reducidos y sin fusión ni Centinela LLM; el último lote corre completo para ratificar al campeón.

Garantías: solo un veredicto APROBADO o CON OBSERVACIONES puede coronar o fusionar al campeón (un lote SIN CAMPEÓN VÁLIDO nunca cambia el título); `campeon_actual` siempre coincide con el código que ratificó el acta; no se permiten dos cadenas a la vez sobre la misma arena; si el lote 1 o 2 purga a casi todos en R0 la cadena se detiene con código 6 (fallo sistemático de la arena); y `run` siempre reanuda lo ya terminado, así que relanzarla tras una interrupción por cuota nunca repite lotes. `verify` comprueba contra las actas reales que los 8 lotes terminaron, que no hubo llamadas fallidas ni gladiadores sin entrega, que el lote final es APROBADO con jurado completo y que el campeón es consistente. Estado en `arenas/<modulo>/cadena/estado.json` y resumen en `cadena/REPORTE.md`. Con `--batches 25` se cubren los 100 gladiadores de la plantilla. El modo cadena es una alternativa explícita: si el usuario pide el Coliseo de 100, se lanza el torneo único del apartado 4.4. Los lotes duran minutos u horas: lánzala en segundo plano (apartado 4.5).
