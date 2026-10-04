/**
 * Récords: turnos terminados, mejor evaluación por dificultad y finales vistos (clave midnight-rinse/historial).
 * Se muestran en la pantalla de título; «Reiniciar todo» los borra con lo demás.
 */
(function (MR) {
  'use strict';

  var KEY = 'midnight-rinse/historial';

  // Los cinco finales, en el orden en que suelen descubrirse. Los ocultos se ven como «???» hasta verlos.
  var FINALES = [
    { id: 'bucle', titulo: 'La una y diez', desc: 'El turno no terminó.' },
    { id: 'bueno', titulo: '05:12 · Turno terminado', desc: 'La puerta por fin abrió.' },
    { id: 'paseo', titulo: 'Paseo nocturno', desc: 'Un turno sin él, en dificultad Paseo.' },
    { id: 'bosque', titulo: 'Último ciclo de lavado', desc: 'Las seis hojas, en la lavadora del claro.', oculto: true },
    { id: 'verdadero', titulo: '05:13 · Fin del turno', desc: 'La hora verdadera y las seis hojas, la misma noche.', oculto: true }
  ];
  var DIFS = ['paseo', 'tranquilo', 'normal', 'pesadilla'];

  class Historial {
    constructor() { this.d = this._load(); }

    _load() {
      var d = {};
      try { d = JSON.parse(window.localStorage.getItem(KEY) || '{}') || {}; } catch (e) { d = {}; }
      d.turnos = d.turnos || 0;
      d.mejor = d.mejor || {};
      d.finales = d.finales || {};
      return d;
    }

    _save() {
      try { window.localStorage.setItem(KEY, JSON.stringify(this.d)); } catch (e) { /* sin almacenamiento */ }
    }

    /**
     * Anota un turno terminado. r = { score, grade, difficulty, ending, night }.
     * Devuelve true si es la mejor evaluación en esa dificultad (y no es el primer turno en ella).
     */
    record(r) {
      var d = this.d;
      d.turnos += 1;
      d.finales[r.ending] = (d.finales[r.ending] || 0) + 1;
      var prev = d.mejor[r.difficulty];
      var score = Math.max(0, Math.round(r.score));
      var best = !prev || score > prev.score;
      if (best) { d.mejor[r.difficulty] = { score: score, grade: r.grade, night: r.night || 1 }; }
      this._save();
      return best && !!prev;
    }

    count() { return FINALES.filter(function (f) { return this.d.finales[f.id]; }, this).length; }
    total() { return FINALES.length; }

    /** Líneas para la pantalla de título: [{titulo, desc, hecho}] (mismo formato que los logros). */
    view() {
      var d = this.d;
      var out = [{ titulo: MR.tf('Turnos terminados: {n}', { n: d.turnos }), desc: MR.t('Cada final cuenta, también el de la una y diez.'), hecho: d.turnos > 0 }];
      DIFS.forEach(function (k) {
        var m = d.mejor[k];
        var nombre = MR.t(MR.DIFICULTAD[k].nombre);
        out.push(m ?
          { titulo: MR.tf('{d}: {nota}', { d: nombre, nota: m.grade }), desc: MR.tf('{p} puntos · noche {n}', { p: m.score, n: m.night }), hecho: true } :
          { titulo: MR.tf('{d}: —', { d: nombre }), desc: MR.t('Todavía sin turnos en esta dificultad.'), hecho: false });
      });
      FINALES.forEach(function (f) {
        var n = d.finales[f.id] || 0;
        out.push(n || !f.oculto ?
          { titulo: MR.t(f.titulo), desc: n ? MR.I18N.cat(MR.t(f.desc), ' ', (n === 1 ? MR.t('(visto una vez)') : MR.tf('(visto {n} veces)', { n: n }))) : MR.t(f.desc), hecho: n > 0 } :
          { titulo: '???', desc: MR.t('Un final oculto.'), hecho: false });
      });
      return out;
    }
  }

  Historial.FINALES = FINALES;
  MR.Historial = Historial;
})(window.MR = window.MR || {});
