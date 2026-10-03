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
    final: {
      titulo: 'Último ciclo de lavado',
      texto: 'Metes las seis páginas empapadas en el tambor y la máquina traga la tinta disuelta con un crujido metálico. El zumbido grave se apaga de golpe junto con los pinos, devolviéndote al pavimento frío de la avenida. Tu reloj de pulsera por fin marca las 05:13.'
    }
  };
})(window.MR = window.MR || {});
