/**
 * Novedades: lo último que cambió en el juego, en un panel del título. Si hay algo que no has visto, el panel
 * lleva un «● nuevo» hasta que lo abres (se recuerda en midnight-rinse/novedades). La más nueva va primero.
 */
(function (MR) {
  'use strict';

  var KEY = 'midnight-rinse/novedades';

  MR.NOVEDADES = [
    { id: 29, texto: 'El bosque no termina. Y ahora tiene música.' },
    { id: 28, texto: 'Dos vidrieras a la avenida: Blackwood está viva a la una de la mañana. Mira cómo cambia.' },
    { id: 27, texto: 'Pelusa tiene rutina: come, se acicala, mira por la puerta, hace su ronda y, al final, no se te despega.' },
    { id: 26, texto: 'Blackwood: de noche vienen a lavar las caras blancas. Y las máscaras negras dejan órdenes.' },
    { id: 25, texto: 'Con luna llena, alguien tendió ropa en el bosque.' },
    { id: 24, texto: 'Cuando se va con la hora verdadera, algo suyo se queda un momento.' },
    { id: 23, texto: 'Hay un cesto entre las lavadoras y las secadoras. Estaba vacío.' },
    { id: 22, texto: 'No te quedes quieto mucho rato en silencio.' },
    { id: 21, texto: 'Puedes tocar el banco amarillo. Fíjate si está frío.' },
    { id: 20, texto: 'En las noches de niebla, el bosque tiene otra farola. No intentes alcanzarla.' },
    { id: 19, texto: 'Radio Nocturna tiene una dedicatoria para ti (noches 3 a 6).' },
    { id: 18, texto: 'A veces alguien dobla ropa en el mostrador. Nadie la trajo.' },
    { id: 17, texto: 'Revisa tus monedas. Y la bandeja del cambiador.' },
    { id: 16, texto: 'Noche especial «Tormenta eléctrica»: relámpagos seguidos y la luz parpadea con los truenos.' },
    { id: 15, texto: 'Logro «Álbum de la noche»: fotos en los tres lugares en un mismo turno.' },
    { id: 14, texto: 'Opción de fondo oscuro detrás de los subtítulos.' },
    { id: 13, texto: 'El teléfono dice algo distinto cada noche. Desde la sexta, contesta tu propia voz.' },
    { id: 12, texto: 'Opción «Brillo», para jugar en el celular con mucha luz.' },
    { id: 11, texto: 'El pasillo de servicio tiene un lavabo con espejo. Tú no te reflejas.' },
    { id: 10, texto: 'Noche especial «Corte de agua»: las secadoras ahora funcionan con moneda.' },
    { id: 9, texto: 'Fotos con la cámara del celular (P, Y o la pausa). Revísalas bien.' },
    { id: 8, texto: 'A veces la tele muestra algo entre la nieve.' },
    { id: 7, texto: 'Récords: tu mejor nota por dificultad y los cinco finales.' },
    { id: 6, texto: 'English version: Options → Idioma · Language.' },
    { id: 5, texto: 'Un final más, para quien hace todo en la misma noche.' },
    { id: 4, texto: 'Filtro de televisor viejo (CRT) en las opciones.' }
  ];

  MR.Novedades = {
    latest: function () { return MR.NOVEDADES[0].id; },
    seen: function () {
      try { return parseInt(window.localStorage.getItem(KEY) || '0', 10) || 0; } catch (e) { return 0; }
    },
    unseen: function () { return MR.Novedades.seen() < MR.Novedades.latest(); },
    markSeen: function () {
      try { window.localStorage.setItem(KEY, String(MR.Novedades.latest())); } catch (e) { /* sin almacenamiento */ }
    }
  };
})(window.MR = window.MR || {});
