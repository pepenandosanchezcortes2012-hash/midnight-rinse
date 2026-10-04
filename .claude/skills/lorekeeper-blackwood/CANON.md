# Canon de Midnight Rinse

Archivo maestro de la historia. Todo texto nuevo del juego (tickets de la impresora, radio, teléfono, hojas, susurros, objetos, notas del gerente, subtítulos) se revisa contra esto antes de entrar. `lore_check.py` verifica automáticamente lo que se puede verificar.

Estado: **canon vigente** = lo que ya está en el juego más lo aprobado por Yesda en la §7 (octubre de 2026). Lo que no está aquí no es canon.

## 1. El lugar
- **Lavandería La Espuma**, abierta 24 h. Sala con 6 lavadoras y 4 secadoras, banco amarillo, mostrador con la impresora térmica, la radio, la tablilla de tareas y el teléfono público junto a la entrada; tele colgada entre lavadoras y secadoras; cambiador de monedas; almacén con el trapeador (al fondo a la izquierda); máquina de café.
- **Afuera de la puerta de vidrio** ya no está el estacionamiento: hay un **bosque de pinos** (fachada iluminada, farola, sendero) que termina en un **claro con una lavadora blanca sin cable** que sigue lavando un **uniforme como el tuyo** (tu gafete bordado, la misma mancha de cloro).
- **Pasillo de servicio** (detrás de la puerta trasera, se abre a las **03:00**): bombilla que titila, tubería que gotea, caldera, caja de fusibles, **siete casilleros** con las iniciales **R., E., S., D., T., A.** y el último con **tu nombre**, y un **lavabo con espejo** donde **no te reflejas**.

## 2. El tiempo
- El turno es de **01:10 a 05:12**. La impresora entrega el registro a las 01:15; él aparece a las **02:20**; la **Radio Nocturna 94.1** habla a las **02:40**; la puerta trasera se abre a las 03:00; el **teléfono público** suena a las **03:50**; él pregunta la hora desde las **04:00**; la impresora entrega el **colapso** a las **04:33**.
- Las revisiones del pasillo central son a las 02:00, 02:45, 03:30, 04:15 y 05:00 (3 charcos o más = falta).
- **La hora verdadera es las 05:13** («las cinco y trece»). El reloj siempre «se rinde» a las 05:12; el minuto 05:13 es el que nadie paga y el que corta el ciclo. Nunca se da otra hora verdadera.
- La respuesta segura a «¿qué hora es?» es **«faltan cinco minutos para las seis»** (la da el teléfono y el registro). Decirle la hora real es una falta. Decirle «las cinco y trece» (si la conoces) hace que se vaya.

## 3. Él (el Cliente Inmóvil)
- Hombre alto (~2 m), **abrigo largo, sombrero**, cara pálida; se sienta en el banco amarillo. **No tiene nombre** en el juego.
- **Nunca ataca de frente.** Solo se mueve cuando no lo miras o mientras parpadeas; su cabeza gira hacia ti cuando no lo ves. Mirarlo a la cara después de la advertencia es una falta.
- Aparece donde no debería: detrás de los árboles al relampaguear, en el vidrio de una lavadora, en las fotos, en el espejo del pasillo, entre la estática de la tele. **En la realidad no está** cuando lo buscas.
- Pregunta siempre lo mismo: la hora.

## 4. Los que estuvieron antes
- Seis empleados firmaron las **hojas mojadas del registro** en el bosque: **R.** (14 oct), **E.** (22 oct), **S.** (29 oct), **D.** (6 nov), **T.** (12 nov), **A.** (19 nov). Cada turno fallido arrancó una hoja y alimentó la niebla.
- Sus casilleros guardan restos: el gafete raspado de R., la cajetilla de E., el «parpadea menos» de S., la linterna y la manga de D., hojas en blanco a las 05:12 de T., lodo de bosque en el de A.
- **Tu casillero** ya tenía tu nombre antes de que llegaras: un gancho vacío, tibio, y una etiqueta «05:13».
- Desde la sexta noche, **la voz del teléfono es la tuya** («Yo tampoco salí… Sigo aquí, en el turno de antes»).

## 5. Reglas del misterio (no romper)
1. **El local se queda con las horas perdidas**: el ciclo se repite (la una y diez otra vez) hasta que se cumple el ritual.
2. **Cortar el ciclo** = llevar las **seis hojas** a la lavadora del claro antes de las 05:12. Hacerlo **la misma noche** que le dices la hora verdadera = final verdadero (amanece; el registro queda en blanco; letrero CERRADO).
3. El agua «nunca va a volver a ser clara» (colapso de la impresora). El agua, la ropa mojada y el zumbido son el idioma del lugar.
4. **Las máquinas sostienen la cordura**: el ruido de 3 lavadoras (o secadoras, o tu música) tapa el **zumbido**; el silencio «trae visitas».
5. **Pelusa**, el gato de la lavandería, bufa cuando él está cerca. En las fotos siempre sale movida.
6. Nada se explica del todo: cada texto agrega una pista, nunca la respuesta completa.
7. Cifras fijas: 6 hojas, 7 casilleros, 6 lavadoras, 4 secadoras, Radio Nocturna **94.1** (8 transmisiones; después solo estática), tu música en la **99.9**, 6 llamadas del teléfono.

## 6. Inventario de textos (dónde vive cada cosa)
- Hojas, radio, teléfono, susurros y los finales del bosque: `juego/src/engine/historia.js` La radio, en las noches 3 a 6, cierra con una **dedicatoria** «para alguien que sigue doblando ropa ajena» (y tu nombre entre la estática, si lo diste).
- Registro de la impresora: `juego/src/core/shiftLog.js` (idéntico al núcleo de Python; no se cambia sin cambiar ambos).
- Objetos perdidos (15): `objetos.js` — calcetín de niño, anillo «14·10», moneda extranjera, botón de abrigo, **ticket de 1987** (turno de 01:10 a 05:12 con tu letra), reloj detenido a las 05:13, gafete de R., aguja de pino, llave del «casillero 7», diente de leche, foto instantánea (tú dormido en el banco), nota («Me gusta tu compañía»), espejo de bolsillo, rollo sin revelar («no las revelen»), llave de paso.
- Casilleros: `pasillo.js`. Notas del gerente (noches especiales): `config.js`. Pistas, diálogo y finales: `game.js`.
- Todo texto visible tiene traducción en `textos_en.js` (glosario fijo: shift log, log page, strike, clipboard, yellow bench, the clearing, Night Radio…).

## 7. Blackwood y el embalse (aprobado por Yesda, octubre de 2026)
- **Blackwood** era el pueblo del valle. En **1986** el **embalse** lo cubrió: casas, calles, la farmacia, la escuela. Nadie dice en voz alta qué pasó con los que no se fueron. **La Espuma** abrió en **1987** en la orilla nueva (de ahí el ticket de 1987). El agua «nunca va a volver a ser clara» porque debajo sigue el pueblo.
- **El bosque de Blackwood es infinito y no euclidiano**: el sendero da la vuelta sobre sí mismo, y lo que dejaste atrás vuelve a estar delante. Lo que hay más adentro (la secadora solitaria, las farolas que no estaban) son restos del pueblo que el bosque guarda.
- **Las caras blancas** son vecinos de Blackwood. Vienen de noche a lavar su ropa, que siempre está empapada. Tienen la cara lisa y blanca, sin rasgos. Son amables a su modo, hablan poco y bajito, nunca te miran a los ojos y se van por la puerta de vidrio. No hacen daño. **Él no es uno de ellos** (él tiene sombrero y pregunta la hora; ellos no preguntan nada).
- **Las máscaras negras** son la **Administración del Embalse**: altos, de traje oscuro, con una máscara negra de caras planas, geométrica. **Nunca hablan.** Se paran frente al mostrador y la impresora térmica entrega una **ORDEN** numerada. Las órdenes son de oficina, frías, y nunca contradicen las reglas del turno: la instrucción del teléfono y la hora verdadera siguen valiendo.
- **Reglas del pueblo:** nadie de Blackwood dice qué pasó exactamente en 1986, el año del embalse es siempre 1986, las caras blancas no tienen nombre propio y las máscaras negras no hablan.
- **Por la vidriera** (sprint 2): la avenida con vida, como era Blackwood antes del agua, que se va apagando y llenando de agua a medida que avanza el turno.
