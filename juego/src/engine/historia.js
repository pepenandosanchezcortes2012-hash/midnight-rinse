/**
 * Historia del bosque: seis hojas mojadas del registro de turnos anteriores y el tercer final.
 * Borrador de Gemini 3.8 Flash (Antigravity CLI), revisado y editado a mano para que encaje con las reglas y
 * mecánicas del juego (los filtros están adentro; él pregunta la hora cerca de las 04:00).
 */
(function (MR) {
  'use strict';

  MR.HISTORIA = {
    paginas: [
      { firma: 'Turno del 14 de octubre · R.',
        texto: 'Salí a tirar la basura y el estacionamiento ya no existía. Hay pinos altísimos pegados al cristal de la entrada y el olor a lluvia no viene de la calle. Juro que cuando checamos tarjeta a la una todavía había pavimento.' },
      { firma: 'Turno del 22 de octubre · E.',
        texto: 'Me escapé a fumar entre los árboles porque el zumbido del pasillo me estaba volviendo loco. En un claro encontré una lavadora blanca centrifugando sola, sin ningún cable. El tambor vibra caliente y huele a jabón fresco.' },
      { firma: 'Turno del 29 de octubre · S.',
        texto: 'El tipo del abrigo largo no solo se sienta en la banca amarilla. Lo vi parado detrás de un tronco grueso, mirándome fijo en la oscuridad. Cada vez que parpadeaba para enfocar la vista, aparecía dos metros más cerca.' },
      { firma: 'Turno del 6 de noviembre · D.',
        texto: 'Me acerqué a la máquina del bosque con la linterna para ver qué tenía dentro. La ropa que da vueltas lleva mi gafete bordado y la misma mancha de cloro en la manga. No quise tocar el cristal: sentí frío en el pecho, como si estuviera empapado.' },
      { firma: 'Turno del 12 de noviembre · T.',
        texto: 'El reloj no va a marcar las 05:12 jamás mientras estas hojas sigan regadas en el lodo. Cada turno fallido arrancó una página y alimentó la niebla de afuera. El local se queda con nuestras horas perdidas para no tener que apagar la luz nunca.' },
      { firma: 'Turno del 19 de noviembre · A.',
        texto: 'Si encontraste las seis hojas del registro, llévalas a la lavadora entre los pinos antes de las 05:12. Abre la tapa y mételas todas con el uniforme que gira. Es la única forma de cortar el ciclo. No dejes que te vea hacerlo.' }
    ],
    // Radio Nocturna 94.1 a las 02:40: una transmisión distinta por noche (la 1 es la original). Borrador de
    // Gemini 3.8 Flash, revisado. Después de la noche 8 solo queda estática.
    radio: [
      'Son las dos y cuarenta en Radio Nocturna, noventa y cuatro punto uno. Para quienes siguen despiertos: si esta noche alguien les pregunta la hora, respondan con cuidado.',
      'Son las dos y cuarenta en Radio Nocturna. Saludos a quien nos sintoniza entre el olor a jabón y centrifugados. No dejes que se apaguen los tambores; el silencio trae visitas.',
      'Son las dos y cuarenta en Radio Nocturna, bajo esta lluvia interminable. Si miras por el cristal, verás que los árboles crecieron demasiado cerca. Mejor concéntrate en fregar el pasillo.',
      'Son las dos y cuarenta aquí en Radio Nocturna. Me pregunto cuántos nombres caben en siete casilleros de metal oxidado. El tuyo ya estaba grabado antes de que llegaras, querido oyente.',
      'Son las dos y cuarenta en Radio Nocturna. Dicen que en el claro del bosque una máquina sin cable sigue lavando tu ropa. No vayas a buscarla; el zumbido tiene hambre esta noche.',
      'Son las dos y cuarenta en Radio Nocturna. Tu reloj siempre se rinde a las cinco y doce, pero la noche no termina ahí. Falta un minuto que nadie te pagará jamás.',
      'Son las dos y cuarenta en Radio Nocturna. Grábate bien este secreto: la hora verdadera son las cinco y trece. Si logras ver ese minuto en tu reloj, tal vez vuelvas a casa.',
      'Son las dos y cuarenta en Radio Nocturna, y esta es nuestra última transmisión para ti. Ya reconoces al hombre del abrigo, ¿verdad? Buen turno eterno, amigo; de aquí ya nadie sale.'
    ],
    // El teléfono público a las 03:50: una llamada distinta por noche, siempre con la instrucción que importa.
    // Desde la sexta noche, la voz es la tuya.
    telefono: [
      'No lo mires a la cara. Si te pregunta la hora... faltan cinco minutos para las seis. Faltan cinco minutos para las seis.',
      'Soy yo otra vez. No lo mires a la cara. Si te pregunta la hora, faltan cinco minutos para las seis. No le digas nada más.',
      'Ya estuviste aquí, ¿verdad? Se te nota en la voz. No lo mires a la cara. Faltan cinco minutos para las seis.',
      'No te quedes mucho frente al espejo del pasillo. Y si te pregunta la hora: faltan cinco minutos para las seis.',
      'Escucha, que se corta... no lo mires... faltan cinco minutos para las seis... las hojas... el claro...',
      'No lo mires a la cara. Faltan cinco minutos para las seis. Yo tampoco salí, ¿sabes? Sigo aquí, en el turno de antes.'
    ],
    // Susurros (uno cambiado a mano para no empujar al jugador a una falta).
    susurros: [
      '…no levantes la vista…',
      '…gira sin corriente…',
      '…limpia el filtro rápido…',
      '…el abrigo huele a tierra…',
      '…no lo mires al rostro…',
      '…el agua viene turbia…',
      '…tapa el zumbido grave…',
      '…los árboles tocan el vidrio…',
      '…pregunta siempre lo mismo…',
      '…tu nombre ya estaba ahí…',
      '…cinco y doce para siempre…',
      '…la hora verdadera vendrá…',
      '…cinco y trece no llega…',
      '…el banco amarillo está frío…',
      '…siete ya se quedaron…',
      '…nadie vendrá a relevarte…'
    ],
    // Final verdadero: la hora verdadera y las seis hojas, en la misma noche.
    verdadero: {
      titulo: '05:13 · Fin del turno',
      texto: 'Él ya no estaba para verlo. Metes las seis hojas en el tambor y la lavadora se detiene por primera vez. Cuando vuelves, la lavandería está a oscuras y el letrero dice CERRADO. Sobre el mostrador, el registro está en blanco. Afuera ya es de día. Por fin sales a la calle.'
    },
    final: {
      titulo: 'Último ciclo de lavado',
      texto: 'Metes las seis páginas empapadas en el tambor y la máquina traga la tinta disuelta con un crujido metálico. El zumbido grave se apaga de golpe junto con los pinos, devolviéndote al pavimento frío de la avenida. Tu reloj de pulsera por fin marca las 05:13.'
    }
  };
})(window.MR = window.MR || {});
