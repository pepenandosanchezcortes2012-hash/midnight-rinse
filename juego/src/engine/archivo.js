/**
 * Archivo: todo lo que has leído y escuchado, para releerlo desde la pantalla de título.
 * - Hojas del registro encontradas en el bosque (6).
 * - Transmisiones de Radio Nocturna que escuchaste a las 02:40 (8).
 * Se guarda en midnight-rinse/archivo; «Reiniciar todo» lo borra.
 */
(function (MR) {
  'use strict';

  var KEY = 'midnight-rinse/archivo';

  class Archivo {
    constructor(game) {
      this.game = game;
      this.data = this._load();
    }

    _load() {
      var d = {};
      try { d = JSON.parse(window.localStorage.getItem(KEY) || '{}') || {}; } catch (e) { d = {}; }
      d.paginas = d.paginas || {};
      d.radio = d.radio || {};
      return d;
    }

    _save() {
      try { window.localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* sin almacenamiento */ }
      this.game.ui.renderArchivo(this);
    }

    page(i) { if (!this.data.paginas[i]) { this.data.paginas[i] = this.game.night || 1; this._save(); } }
    radio(i) { if (!this.data.radio[i]) { this.data.radio[i] = this.game.night || 1; this._save(); } }

    count() { return Object.keys(this.data.paginas).length + Object.keys(this.data.radio).length; }
    total() { return MR.HISTORIA.paginas.length + MR.HISTORIA.radio.length; }

    /** Entradas para el panel: [{grupo, titulo, texto, encabezado, hecho}]. */
    view() {
      var d = this.data;
      var out = [];
      MR.HISTORIA.paginas.forEach(function (p, i) {
        var have = !!d.paginas[i];
        out.push({ grupo: 'Hojas del registro', titulo: have ? p.firma : MR.tf('Hoja {n} · ???', { n: i + 1 }), texto: p.texto,
          encabezado: MR.tf('HOJA MOJADA DEL REGISTRO · {f}', { f: MR.t(p.firma).toUpperCase() }), hecho: have });
      });
      MR.HISTORIA.radio.forEach(function (line, i) {
        var have = !!d.radio[i];
        out.push({ grupo: 'Radio Nocturna 94.1', titulo: MR.tf(have ? 'Noche {n}' : 'Noche {n} · ???', { n: i + 1 }), texto: line,
          encabezado: MR.tf('RADIO NOCTURNA · 94.1 · NOCHE {n} · 02:40', { n: i + 1 }), hecho: have });
      });
      return out;
    }
  }

  MR.Archivo = Archivo;
})(window.MR = window.MR || {});
