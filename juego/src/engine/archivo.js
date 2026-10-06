/**
 * Archivo: todo lo que has leído y escuchado, para releerlo desde la pantalla de título.
 * - Hojas del registro encontradas en el bosque (6).
 * - Transmisiones de Radio Nocturna que escuchaste a las 02:40 (8).
 * - Llamadas del teléfono público que contestaste a las 03:50 (6).
 * - Órdenes de la Administración del Embalse que imprimió la impresora (12).
 * - Cuaderno de campo: notas de los que estuvieron antes sobre cada ser de La Espuma y del bosque (8).
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
      d.telefono = d.telefono || {};
      d.ordenes = d.ordenes || {};
      d.charla = d.charla || {};
      d.entre = d.entre || {};
      d.boletin = d.boletin || {};
      d.seres = d.seres || {};
      return d;
    }

    _save() {
      try { window.localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* sin almacenamiento */ }
      this.game.ui.renderArchivo(this);
    }

    page(i) { if (!this.data.paginas[i]) { this.data.paginas[i] = this.game.night || 1; this._save(); } }
    radio(i) { if (!this.data.radio[i]) { this.data.radio[i] = this.game.night || 1; this._save(); } }
    phone(i) { if (!this.data.telefono[i]) { this.data.telefono[i] = this.game.night || 1; this._save(); } }
    order(i) { if (!this.data.ordenes[i]) { this.data.ordenes[i] = this.game.night || 1; this._save(); } }
    chat(key) { if (!this.data.charla[key]) { this.data.charla[key] = this.game.night || 1; this._save(); } }
    overheard(i) { if (!this.data.entre[i]) { this.data.entre[i] = this.game.night || 1; this._save(); } }
    bulletin(key, n) { if (!this.data.boletin[key + n]) { this.data.boletin[key + n] = this.game.night || 1; this._save(); } }
    ser(id) { if (!this.data.seres[id]) { this.data.seres[id] = this.game.night || 1; this._save(); } }

    /**
     * Cuaderno de campo: anota a cada ser la primera vez que lo ves de verdad (en tu vista, cerca y con los ojos
     * abiertos), o al acariciar a Pelusa, o cuando él te pregunta la hora. game.js lo llama dos veces por segundo.
     */
    seres(g) {
      var s = this.data.seres;
      var p = g.player;
      if (p.eyesClosed) { return; }
      var cam = p.camera;
      var tmp = this.tmp || (this.tmp = new THREE.Vector3());
      var ve = function (pos, alto, max) {
        if (Math.hypot(pos.x - p.pos.x, pos.z - p.pos.z) > max) { return false; }
        var v = tmp.set(pos.x, alto, pos.z).project(cam);
        return Math.abs(v.x) < 0.85 && Math.abs(v.y) < 0.85 && v.z < 1;
      };
      var self = this;
      if (!s.pelusa && g.gato && g.gato.pets > 0) { this.ser('pelusa'); }
      if (!s.el && g.question) { this.ser('el'); }
      if (!s.venado && g.venado && g.venado.seenSaid) { this.ser('venado'); }
      if (!s.lechuza && g.lechuza && g.lechuza.seenSaid) { this.ser('lechuza'); }
      (g.clientela ? g.clientela.visitors : []).forEach(function (v) {
        var grp = v.model.group;
        if (!grp.visible) { return; }
        if (v.kind === 'cara' && !s.caras && v.state === 'llego' && ve(grp.position, 1.5, 6)) { self.ser('caras'); }
        if (v.kind === 'mascara' && !s.mascaras && v.state === 'llego' && ve(grp.position, 1.6, 7)) { self.ser('mascaras'); }
        if (v.child && !s.nino && v.child.model.group.visible && ve(v.child.model.group.position, 0.9, 6)) { self.ser('nino'); }
      });
      var ci = g.world.city;
      if (!s.pasajeros && g.ciudad && g.ciudad.busStopped && ci && ci.bus && ci.bus.visible && ve(ci.bus.position, 1.8, 22)) { this.ser('pasajeros'); }
    }

    _bulletinTotal() {
      var B = MR.HISTORIA.boletines;
      return Object.keys(B).reduce(function (n, k) { return n + B[k].length; }, 0);
    }

    count() { return Object.keys(this.data.paginas).length + Object.keys(this.data.radio).length + Object.keys(this.data.telefono).length +
      Object.keys(this.data.ordenes).length + Object.keys(this.data.charla).length + Object.keys(this.data.entre).length +
      Object.keys(this.data.boletin).length + Object.keys(this.data.seres).length; }
    total() { return MR.HISTORIA.paginas.length + MR.HISTORIA.radio.length + MR.HISTORIA.telefono.length +
      MR.HISTORIA.blackwood.ordenes.length + this._chatTotal() + MR.HISTORIA.blackwood.entre.length + this._bulletinTotal() +
      MR.HISTORIA.seres.length; }

    _chatTotal() {
      var ch = MR.HISTORIA.blackwood.charla;
      return ch.preguntas.concat(ch.extra).reduce(function (n, q) { return n + ch[q[0]].length; }, 0);
    }

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
      var calls = MR.HISTORIA.telefono;
      calls.forEach(function (line, i) {
        var have = !!d.telefono[i];
        var mine = i === calls.length - 1; // la última llamada: tu propia voz (y desde ahí, todas las noches)
        out.push({ grupo: 'Teléfono público', titulo: MR.tf(have ? (mine ? 'Noche {n} en adelante' : 'Noche {n}') : 'Noche {n} · ???', { n: i + 1 }),
          texto: line, encabezado: MR.tf(mine ? 'TELÉFONO PÚBLICO · TU PROPIA VOZ · 03:50' : 'TELÉFONO PÚBLICO · NOCHE {n} · 03:50', { n: i + 1 }), hecho: have });
      });
      MR.HISTORIA.blackwood.ordenes.forEach(function (line, i) {
        var have = !!d.ordenes[i];
        out.push({ grupo: 'Órdenes de la Administración del Embalse', titulo: MR.tf(have ? 'ORDEN N.º {n}' : 'Orden {n} · ???', { n: have ? (line.match(/N\.º (\d+)/) || [0, i + 1])[1] : i + 1 }),
          texto: line, encabezado: 'ADMINISTRACIÓN DEL EMBALSE · ORDEN IMPRESA', hecho: have });
      });
      var ch = MR.HISTORIA.blackwood.charla;
      ch.preguntas.concat(ch.extra).forEach(function (q) {
        ch[q[0]].forEach(function (line, i) {
          var have = !!d.charla[q[0] + i];
          out.push({ grupo: 'Lo que dijeron las caras blancas', titulo: have ? q[1] : MR.tf('{q} · ???', { q: MR.t(q[1]) }),
            texto: line, encabezado: 'UNA CARA BLANCA, BAJITO', hecho: have });
        });
      });
      var temas = { apertura: 'Apertura', embalse: 'El embalse', bus86: 'El 86', barredora: 'La barredora', puente: 'El puente', fotos: 'Las fotos', cierre: 'Cierre' };
      Object.keys(MR.HISTORIA.boletines).forEach(function (k) {
        MR.HISTORIA.boletines[k].forEach(function (line, n) {
          var have = !!d.boletin[k + n];
          out.push({ grupo: 'Radio Nocturna: boletines', titulo: have ? temas[k] : MR.tf('{q} · ???', { q: MR.t(temas[k]) }),
            texto: line, encabezado: 'RADIO NOCTURNA · 94.1', hecho: have });
        });
      });
      MR.HISTORIA.seres.forEach(function (n, i) {
        var have = !!d.seres[n.id];
        out.push({ grupo: 'Cuaderno de campo', titulo: have ? n.nombre : MR.tf('Nota {n} · ???', { n: i + 1 }), texto: n.texto,
          encabezado: 'CUADERNO DE CAMPO · AL MARGEN DEL REGISTRO', hecho: have });
      });
      MR.HISTORIA.blackwood.entre.forEach(function (ex, i) {
        var have = !!d.entre[i];
        out.push({ grupo: 'Lo que se dicen entre ellas', titulo: have ? MR.tf('Conversación {n}', { n: i + 1 }) : MR.tf('Conversación {n} · ???', { n: i + 1 }),
          texto: have ? MR.I18N.cat('— ', MR.t(ex[0]), '\n— ', MR.t(ex[1])) : '', encabezado: 'DOS CARAS BLANCAS, JUNTO A LAS LAVADORAS', hecho: have });
      });
      return out;
    }
  }

  MR.Archivo = Archivo;
})(window.MR = window.MR || {});
