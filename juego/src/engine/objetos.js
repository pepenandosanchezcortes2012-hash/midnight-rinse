/**
 * Objetos perdidos: cuando una lavadora termina su ciclo, a veces queda algo olvidado entre la ropa. Si abres la
 * puerta, lo encuentras. La colección es permanente (midnight-rinse/objetos) y se ve en la pantalla de título.
 * «Reiniciar todo» la borra.
 */
(function (MR) {
  'use strict';

  var KEY = 'midnight-rinse/objetos';

  var LIST = [
    { id: 'calcetin', nombre: 'Un calcetín de niño', desc: 'Seco, aunque el ciclo acaba de terminar.' },
    { id: 'anillo', nombre: 'Un anillo de matrimonio', desc: 'Grabado por dentro: «14·10». La misma fecha de la primera hoja del bosque.' },
    { id: 'moneda', nombre: 'Una moneda extranjera', desc: 'De ningún país que conozcas. Cabe justo en la ranura.' },
    { id: 'boton', nombre: 'Un botón de abrigo', desc: 'Negro, enorme. Huele a tierra mojada.' },
    { id: 'ticket', nombre: 'Un ticket de 1987', desc: 'Lavandería La Espuma. Turno de 01:10 a 05:12. La letra es la tuya.' },
    { id: 'reloj', nombre: 'Un reloj de pulsera', desc: 'Detenido a las 05:13. No tiene corona para darle cuerda.' },
    { id: 'gafete', nombre: 'Un gafete desteñido', desc: 'Solo se lee la inicial: R. La foto está raspada.' },
    { id: 'hoja_pino', nombre: 'Una aguja de pino', desc: 'En el centro del tambor. Ninguna ventana da al bosque.' },
    { id: 'llave', nombre: 'Una llave pequeña', desc: 'Con una etiqueta: «casillero 7».' },
    { id: 'diente', nombre: 'Un diente de leche', desc: 'En una bolsita de plástico con tu nombre de niño.' },
    { id: 'polaroid', nombre: 'Una foto instantánea', desc: 'Tú, dormido en el banco amarillo. Tomada desde muy cerca.' },
    { id: 'nota', nombre: 'Una nota doblada', desc: 'Con letra apretada: «No te voy a dejar salir. Me gusta tu compañía».' },
    { id: 'espejito', nombre: 'Un espejo de bolsillo', desc: 'Empañado por dentro, como si alguien hubiera respirado del otro lado.' },
    { id: 'rollo', nombre: 'Un rollo de fotos sin revelar', desc: 'Doce exposiciones. En la etiqueta, con tu letra: «no las revelen».' },
    { id: 'llave_paso', nombre: 'Una llave de paso', desc: 'Fría y mojada. Alguien cerró el agua a propósito.' },
    // Regalo de la Administración del Embalse (la caja del mostrador, clientela.js): no sale de las lavadoras.
    { id: 'placa', nombre: 'Una placa de bronce', desc: '«PUENTE MUNICIPAL · BLACKWOOD». Huele a río.', regalo: true }
  ];

  class Objetos {
    constructor(game) {
      this.game = game;
      this.got = this._load();
      this.foundTonight = 0;
    }

    _load() {
      try { return JSON.parse(window.localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; }
    }

    _save() {
      try { window.localStorage.setItem(KEY, JSON.stringify(this.got)); } catch (e) { /* sin almacenamiento */ }
    }

    count() { return Object.keys(this.got).length; }
    total() { return LIST.length; }

    /** Al terminar un ciclo: 35 % de que quede algo adentro (prefiere lo que aún no tienes). */
    onCycleEnd(washer) {
      if (washer.item || Math.random() > 0.35) { return; }
      var normal = LIST.filter(function (o) { return !o.regalo; });
      var missing = normal.filter(function (o) { return !this.got[o.id]; }, this);
      var pool = missing.length ? missing : normal;
      washer.item = pool[Math.floor(Math.random() * pool.length)].id;
    }

    /** Un objeto que no sale de una lavadora: la caja de la Administración, la moneda de una cara blanca, Pelusa. */
    give(id, template) {
      var def = LIST.filter(function (o) { return o.id === id; })[0];
      var g = this.game;
      var isNew = !this.got[def.id];
      if (isNew) { this.got[def.id] = g.night || 1; this._save(); }
      this.foundTonight += 1;
      g.ui.subtitle(MR.tf(template || '(En la caja: {n}. {d})', { n: MR.t(def.nombre).toLowerCase(), d: MR.t(def.desc) }), 7);
      g.audio.ding();
      g.ui.renderObjetos(this);
      if (g.logros && this.count() >= 6) { g.logros.unlock('objetos'); }
    }

    /** Al abrir la puerta de una lavadora detenida: si había algo, lo encuentras. */
    onDoorOpen(washer) {
      if (!washer.item) { return false; }
      var def = LIST.filter(function (o) { return o.id === washer.item; })[0];
      washer.item = null;
      var g = this.game;
      var isNew = !this.got[def.id];
      if (isNew) { this.got[def.id] = g.night || 1; this._save(); }
      this.foundTonight += 1;
      g.ui.subtitle(MR.I18N.cat(MR.tf('(Entre la ropa húmeda: {n}. {d})', { n: MR.t(def.nombre).toLowerCase(), d: MR.t(def.desc) }),
        isNew ? '' : ' ' + MR.t('(Ya tenías uno igual.)')), 7);
      g.audio.ding();
      MR.Haptics.pulse([15, 30, 15]);
      g.ui.renderObjetos(this);
      if (g.logros && this.count() >= 6) { g.logros.unlock('objetos'); }
      return true;
    }

    /** Lista para la pantalla de título (lo que no has encontrado, como «???»). */
    view() {
      var got = this.got;
      return LIST.map(function (o) {
        var have = !!got[o.id];
        return { titulo: have ? o.nombre : '???', desc: have ? MR.I18N.cat(MR.t(o.desc), ' ', MR.tf('(noche {n})', { n: got[o.id] })) : 'Algún ciclo lo dejará.', hecho: have };
      });
    }
  }

  Objetos.LIST = LIST;
  MR.Objetos = Objetos;
})(window.MR = window.MR || {});
