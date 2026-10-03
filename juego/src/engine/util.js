/** Utilidades pequeñas y sin estado. */
(function (MR) {
  'use strict';

  MR.Util = {
    clamp: function (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    smoothstep: function (a, b, x) {
      var t = MR.Util.clamp((x - a) / (b - a), 0, 1);
      return t * t * (3 - 2 * t);
    },
    rand: function (a, b) { return a + Math.random() * (b - a); },
    pick: function (list) { return list[Math.floor(Math.random() * list.length)]; },
    /** "02:40" a partir de minutos de juego. */
    clockText: function (minutes) {
      var h = Math.floor(minutes / 60) % 24;
      var m = Math.floor(minutes % 60);
      return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
    },
    /** Hora dicha en voz alta: "las cuatro y siete". */
    spokenTime: function (minutes) {
      var words = ['doce', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once'];
      var h = Math.floor(minutes / 60) % 12;
      var m = Math.floor(minutes % 60);
      var base = (h === 1 ? 'la ' : 'las ') + words[h];
      return m === 0 ? base + ' en punto' : base + ' y ' + m;
    },
    distXZ: function (a, b) {
      var dx = a.x - b.x;
      var dz = a.z - b.z;
      return Math.sqrt(dx * dx + dz * dz);
    }
  };
})(window.MR = window.MR || {});
