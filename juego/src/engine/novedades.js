/**
 * Novedades: lo último que cambió en el juego, en un panel del título. Si hay algo que no has visto, el panel
 * lleva un «● nuevo» hasta que lo abres (se recuerda en midnight-rinse/novedades). La más nueva va primero.
 */
(function (MR) {
  'use strict';

  var KEY = 'midnight-rinse/novedades';

  MR.NOVEDADES = [
    { id: 47, texto: 'Nuevo panel: «Pelusa · lo que recuerda». ¿Ya te tiene cariño?' },
    { id: 46, texto: 'Si Pelusa mira fijo hacia un lado, algo sonó ahí.' },
    { id: 45, texto: 'Las ventanas de enfrente tienen vida. Mira bien: alguna noche, alguien te devuelve la mirada… casi.' },
    { id: 44, texto: 'Modelos nuevos en todas partes: el teléfono, la caldera, la farola… y tus manos (con reloj).' },
    { id: 43, texto: 'Mira por la vidriera: la avenida por fin tiene ventanas (antes eran rayas).' },
    { id: 42, texto: 'Pelusa ahora tiene un cerebro de mosca de la fruta: recuerda quién la acaricia.' },
    { id: 41, texto: 'Ahora se ve la ropa girar por el ojo de buey.' },
    { id: 40, texto: 'A veces viene un niño. Si Pelusa está cerca, déjalo acariciarla.' },
    { id: 39, texto: 'Pelusa, las caras blancas, las máscaras y él tienen modelos nuevos. A él, igual, no lo mires a la cara.' },
    { id: 38, texto: 'Si una cara blanca te pide una moneda, dásela.' },
    { id: 37, texto: 'Deja la radio en la 94.1: el locutor habla más de una vez por noche.' },
    { id: 36, texto: 'Esta noche pasa el 86. Si bajan dos, escucha lo que se dicen.' },
    { id: 35, texto: 'Las caras blancas recuerdan tu noche. Y en lo hondo del bosque hay un puente sin nombre.' },
    { id: 34, texto: 'Las máscaras a veces dejan algo. Las caras blancas a veces se despiden.' },
    { id: 33, texto: 'El final verdadero ahora tiene amanecer. Ojalá lo veas.' },
    { id: 32, texto: 'Mira la avenida: las caras blancas cruzan antes de entrar. Y Pelusa ya eligió de quién desconfiar.' },
    { id: 31, texto: 'Si el bosque te devuelve tres veces, escucharás una campana. Y alguien escribe en el vaho de la vidriera.' },
    { id: 30, texto: 'Puedes conversar con las caras blancas. Pregúntales por 1986.' },
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
