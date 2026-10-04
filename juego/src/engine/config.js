/**
 * Configuración central del juego: tiempos del turno, ritmo, distancias y diseño de la lavandería.
 * Todas las horas están en minutos de juego desde la medianoche (70 = 01:10).
 */
(function (MR) {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var speed = Math.max(0.1, Math.min(60, parseFloat(params.get('velocidad')) || 1));

  MR.Config = {
    RENDER_W: 320,
    RENDER_H: 240,
    // vertex_snap usa ndc * vres: con vres = 160x120 la rejilla es de 1 píxel a 320x240.
    SNAP_RES: [160, 120],
    FOV: 70,

    // Reloj del turno: 16 segundos de juego por segundo real (~15 minutos reales en total).
    GAME_SECONDS_PER_REAL_SECOND: 16 * speed,
    SHIFT_START: 70,          // 01:10
    PRINTER_START: 75,        // 01:15 la impresora térmica entrega el registro
    CUSTOMER_APPEARS: 140,    // 02:20 el Cliente Inmóvil aparece en el banco
    RADIO_HOST: 160,          // 02:40 el locutor nocturno
    CUSTOMER_TALK_FALLBACK: 190, // 03:10 si el jugador nunca se acercó, el cliente habla igual
    PHONE_RINGS: 230,         // 03:50 el teléfono público
    TIME_QUESTION_FROM: 240,  // 04:00 el cliente pregunta la hora
    TIME_QUESTION_FORCE: 252, // 04:12 la pregunta llega aunque estés lejos
    PRINTER_COLLAPSE: 273,    // 04:33 la impresora entrega el colapso
    SHIFT_END: 312,           // 05:12 el turno termina y el juego cierra limpio
    MOP_CHECKS: [120, 165, 210, 255, 300], // revisión del pasillo cada 45 minutos

    PLAYER_HEIGHT: 1.62,
    PLAYER_RADIUS: 0.3,
    WALK_SPEED: 2.3,
    REACH: 2.2,

    // Lentes empañados: evaporación 0.035 por segundo y borrado completo en 1.8 s de contacto.
    FOG_EVAPORATION: 0.035,
    FOG_WIPE_SECONDS: 1.8,
    FOG_GRID: [40, 30],

    // Mirada al rostro del cliente.
    STARE_ANGLE_DEG: 7,
    STARE_DISTANCE: 7,
    STARE_SECONDS: 1.6,

    RADIO_STATION: 94.1,
    MOP_SECONDS: 2.0,
    FILTER_CLEAN_SECONDS: 1.5,
    WASHER_CYCLE_MIN: 30,
    COINS_PER_PRESS: 4,
    BACKDOOR_OPENS: 180, // 03:00: la puerta trasera queda entreabierta (pasillo de servicio)
    DEDICATORIA_MS: 9000, // la dedicatoria de la radio llega después de la transmisión
    DEBUG_SPEED: speed
  };

  /**
   * Noches especiales: a veces (más o menos la mitad de las noches) el turno trae un modificador, con una nota
   * del gerente en la tablilla. Se puede forzar con ?noche=<clave> (pruebas).
   */
  MR.NOCHES_ESPECIALES = {
    inundacion: { nombre: 'Inundación', nota: 'Se reventó una tubería del pasillo de servicio. Va a haber más charcos de lo normal.' },
    apagones: { nombre: 'Noche de apagones', nota: 'La compañía de luz avisó de baja tensión. Si se apagan las luces, no salgas a revisar.' },
    niebla: { nombre: 'Niebla', nota: 'Hay niebla. Los lentes se te van a empañar más; lleva un trapo.' },
    luna: { nombre: 'Luna llena', nota: 'Por fin dejó de llover. Luna llena. Dicen que así se ve todo… también lo que no quieres ver.' },
    sin_gato: { nombre: '¿Y el gato?', nota: '¿Has visto a Pelusa? No vino a comer.' },
    tormenta: { nombre: 'Tormenta eléctrica', nota: 'Anuncian tormenta eléctrica toda la noche. Si truena cerca, la luz va a parpadear: no te asustes.' },
    sin_agua: { nombre: 'Corte de agua', nota: 'Cortaron el agua hasta las seis. Las lavadoras no van a arrancar: pon las secadoras o algo de música para tapar el zumbido.' }
  };

  /**
   * Dificultad (opción de la pantalla de título):
   * horror = cuántas veces más seguido actúa el director del horror; faltas = máximo para el final bueno;
   * cigarros/tragos/porros = consumibles del turno; vaho = qué tan rápido se empañan los lentes.
   */
  MR.DIFICULTAD = {
    paseo: { nombre: 'Paseo', horror: 0, faltas: 99, cigarros: 8, tragos: 6, porros: 4, vaho: 0.5, sinSustos: true },
    tranquilo: { nombre: 'Tranquilo', horror: 0.55, faltas: 6, cigarros: 8, tragos: 6, porros: 4, vaho: 0.7 },
    normal: { nombre: 'Normal', horror: 1, faltas: 3, cigarros: 5, tragos: 4, porros: 3, vaho: 1 },
    pesadilla: { nombre: 'Pesadilla', horror: 1.8, faltas: 1, cigarros: 2, tragos: 2, porros: 1, vaho: 1.4 }
  };
})(window.MR = window.MR || {});
