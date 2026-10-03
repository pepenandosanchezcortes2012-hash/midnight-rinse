# Guía de portado: GDScript (Godot 4) y C# (Unity URP)

Los 7 módulos de `core/midnight_rinse_core` usan solo la biblioteca estándar, sin metaprogramación. Esta guía da los tipos y las trampas de cada uno. La versión JavaScript (`juego/src/core/`) es el ejemplo de port ya verificado: replica a Python con exactitud en miles de vectores.

**Regla general.** Porta también las pruebas. `juego/tests/vectores.json` tiene entradas y salidas exactas: cárgalo desde un test de GUT (Godot) o de NUnit (Unity) y compara.

| Python | GDScript 4 | C# |
| :--- | :--- | :--- |
| `ValueError` | `push_error()` + valor de error, o `assert` en depuración | `ArgumentException` |
| `TypeError` | igual que arriba | `ArgumentException` |
| `int`/`float` (bool rechazado) | `typeof(x) == TYPE_INT / TYPE_FLOAT` | sobrecargas tipadas (`int`, `double`) |
| `x % y` con flotantes | `fposmod(x, y)` (signo del divisor, como Python) | `((x % y) + y) % y` |
| `math.floor` | `floor()` / `floori()` | `Math.Floor` (en `double`) |

## 1. blind_spot_dispatcher: `Dispatcher`
- **API:** `schedule(id: String, payload: Dictionary, priority: int = 0)`, `tick(visibility: float, blink: bool) -> Array[Dictionary]`, `pending() -> int`.
- **Estructura:** `Dictionary[int, Array]` para las cubetas y `Dictionary[String, bool]` como conjunto de pendientes. En `tick`, recorre las prioridades de mayor a menor (`keys.sort(); keys.reverse()`).
- **Hilos:** en Godot, si llamas desde un `Thread`, protege con `Mutex`. En Unity el bucle de juego es de un solo hilo; con Jobs usa `lock`.
- **Uso en el motor:** un dispatcher por zona. La visibilidad sale del frustum de la cámara. En Godot: `camera.is_position_in_frustum()` sobre puntos de la zona, o un `VisibleOnScreenNotifier3D` por zona. En Unity: `GeometryUtility.TestPlanesAABB`.
```gdscript
var d := Dispatcher.new()
d.schedule("cliente_mueve#12", {"to": "entrada"}, 3)
for e in d.tick(zone_visibility, eyes_closed):
    apply_event(e["payload"])
```

## 2. shift_log: `ShiftLog`
- **API:** `update(phase: String) -> String`. Fases: `start` < `customer_talked` < `collapse`. Nunca retrocede.
- **Godot:** `FileAccess` en `user://records/shift_log.txt`. Escritura atómica: escribe `shift_log.tmp` y luego `DirAccess.rename_absolute()`. Godot 4 reemplaza el destino en todas las plataformas. Escribe bytes (`store_buffer(text.to_utf8_buffer() + PackedByteArray([10]))`) para que no haya conversión de saltos de línea.
- **Unity:** `File.WriteAllBytes(tmp)` + `File.Replace(tmp, dst, null)`. Si el destino aún no existe, usa `File.Move`. El candado entre procesos solo hace falta si hay más de una instancia: `FileStream` con `FileShare.None` sobre `.shift_log.lock`.
- **Trampa:** si la lectura falla (archivo bloqueado), propaga el error. **No** lo trates como "sin fase" (era el bug del campeón de Gemini).

## 3. bayer_rgb555: `quantize`
- **Fórmula:** `umbral = (M[y % 8][x % 8] + 0.5) / 64`; `nivel = floor(c * 31 + umbral)`, limitado a 0..31; salida `nivel / 31`.
- **En el motor va en un shader.** Godot: `canvas_item` o efecto de postproceso con `FRAGCOORD`. Unity URP: un `Renderer Feature` de pantalla completa. Usa la matriz como `const int bayer[64]` (Godot) o como textura de 8×8 con filtro `Point` (como `retro.js`).
- `y` crece hacia abajo (origen arriba a la izquierda). En shaders con origen abajo, invierte `y` como hace `retro.js`.

## 4. vertex_snap: `snap`
- **Fórmula:** `nx = floor(ndc_x * vres_x + 1e-9)`; `x' = nx / vres_x * w` (igual para `y`); `z` y `w` no cambian.
- **Godot (spatial shader):**
```glsl
void vertex() {
    vec4 clip = PROJECTION_MATRIX * MODELVIEW_MATRIX * vec4(VERTEX, 1.0);
    vec2 ndc = clip.xy / clip.w;
    clip.xy = floor(ndc * snap_res + 1e-9) / snap_res * clip.w;
    POSITION = clip;
}
```
- `snap_res = (160, 120)` da una rejilla de 1 píxel a 320×240 (el NDC mide 2 unidades). Es lo que usa el juego.
- **Mapeo afín (PS1):** Godot admite `varying noperspective vec2 uv_affine;`. En Unity HLSL usa el modificador `noperspective`.
- **Límite conocido de la especificación:** la idempotencia se rompe con |ndc| > ~1e4 por redondeo. Es irrelevante para vértices reales (|ndc| apenas pasa de 1).

## 5. stepped_hands: `SteppedHold`
- **API:** `sample(t: float, pose) -> pose`, con `slot = floor(t * hold_hz + 1e-9)`. Captura una pose nueva solo cuando cambia el slot y devuelve la **misma referencia** retenida.
- **Godot:** en `_process(delta)` acumula `t`, calcula la pose objetivo de las manos (balanceo, alcance, acción) y aplica `hold.sample(t, pose)` a los `Node3D` de las manos. A 60 FPS y 15 Hz, cada pose dura 4 cuadros.
- **Trampa:** usa siempre `t = i / 60` (o tiempo acumulado en doble precisión), nunca sumas de `1/60` en float32.

## 6. detent_dial: `DetentDial`
- **API:** `drag(delta_deg: float) -> Array[{type, angle}]` y la propiedad `angle` normalizada en [0, 360).
- **Clave del port:** usa `fposmod` (Godot) o el módulo con signo del divisor (C#) en **todos** los `% 360`. El `%` nativo de C# conserva el signo del dividendo y rompe los clics al cruzar el 0.
- **Entrada:** mantener clic + `InputEventMouseMotion.relative.x * 0.6` (Godot) o `Input.GetAxis("Mouse X")` (Unity) → `drag()`. Reproduce un clic de audio por cada evento.

## 7. clock_anomaly: `anomaly_multiplier`, `whispers_active`
- 3.0 de 02:00 a 05:00 (excluido) y susurros de 03:00 a 04:00, con la hora local tal como viene.
- **Capa meta:** `Time.get_datetime_dict_from_system()` (Godot) o `DateTime.Now` (Unity). Debe ser una **opción avisada al jugador**, igual que el nombre en los susurros: es requisito de privacidad y de Steam.
