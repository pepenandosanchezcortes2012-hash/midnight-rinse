/**
 * Logros: metas que se guardan en este navegador (clave midnight-rinse/logros) y se muestran en la pantalla de
 * título. Al conseguir uno aparece un subtítulo y suena una campanita de secadora. «Reiniciar todo» los borra.
 */
(function (MR) {
  'use strict';

  var KEY = 'midnight-rinse/logros';

  var LIST = [
    { id: 'primer_turno', titulo: 'Primer turno', desc: 'Termina un turno, del modo que sea.' },
    { id: 'final_bueno', titulo: '05:12', desc: 'Consigue que la puerta por fin abra.' },
    { id: 'bucle', titulo: 'La una y diez otra vez', desc: 'Que el turno no termine.' },
    { id: 'final_bosque', titulo: 'Último ciclo', desc: 'Mete las seis hojas en la lavadora del claro.', oculto: true },
    { id: 'verdadero', titulo: 'Fin del turno', desc: 'Dile la hora verdadera y cierra el ciclo en la misma noche.', oculto: true },
    { id: 'bosque', titulo: 'Aire fresco', desc: 'Sal al bosque.' },
    { id: 'hoja', titulo: 'Archivista', desc: 'Encuentra una hoja mojada del registro.', oculto: true },
    { id: 'relampago', titulo: 'Lo viste', desc: 'Un relámpago lo reveló entre los árboles.', oculto: true },
    { id: 'tele', titulo: 'Canal propio', desc: 'Pon tu música en la tele de la lavandería.' },
    { id: 'radio', titulo: '94.1', desc: 'Ten la radio sintonizada cuando habla el locutor.' },
    { id: 'lavadoras', titulo: 'Ruido blanco', desc: 'Ten las seis lavadoras funcionando a la vez.' },
    { id: 'pulcro', titulo: 'Pasillo impecable', desc: 'Termina un turno sin faltas en el pasillo ni en los filtros.' },
    { id: 'ojos_al_suelo', titulo: 'Ojos al suelo', desc: 'Termina un turno con él presente sin mirarlo nunca a la cara.' },
    { id: 'paranoia', titulo: 'Paranoia', desc: 'Fuma los tres porros en un mismo turno.' },
    { id: 'gato', titulo: 'Pelusa', desc: 'Acaricia al gato de la lavandería.' },
    { id: 'pesadilla', titulo: 'Turno de pesadilla', desc: 'Consigue que la puerta abra en dificultad Pesadilla.', oculto: true },
    { id: 'fusibles', titulo: 'Electricista', desc: 'Restablece los fusibles del pasillo de servicio.' },
    { id: 'cafe', titulo: 'Turno largo', desc: 'Tómate tres cafés de máquina en un mismo turno.' },
    { id: 'secreto', titulo: 'La hora verdadera', desc: 'Dile la hora que nadie más sabe.', oculto: true },
    { id: 'reflejo', titulo: 'Detrás de ti', desc: 'Velo en el vidrio de una lavadora.', oculto: true },
    { id: 'objetos', titulo: 'Objetos perdidos', desc: 'Encuentra seis objetos olvidados en las lavadoras.' },
    { id: 'solitaria', titulo: 'La secadora solitaria', desc: 'Encuéntrala en el bosque que no termina.', oculto: true },
    { id: 'album', titulo: 'Álbum de la noche', desc: 'Saca fotos en la lavandería, el bosque y el pasillo en un mismo turno.' },
    { id: 'espejo', titulo: 'Dos en el espejo', desc: 'Míralo detrás de ti en el espejo del pasillo.', oculto: true },
    { id: 'foto', titulo: 'En la foto', desc: 'Sácale una foto cuando no está.', oculto: true },
    { id: 'casillero', titulo: 'Ya tenías casillero', desc: 'Abre el último casillero del pasillo.', oculto: true }
  ];

  class Logros {
    constructor(game) {
      this.game = game;
      this.got = this._load();
    }

    _load() {
      try { return JSON.parse(window.localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; }
    }

    _save() {
      try { window.localStorage.setItem(KEY, JSON.stringify(this.got)); } catch (e) { /* sin almacenamiento */ }
    }

    has(id) { return !!this.got[id]; }
    count() { return LIST.filter(function (l) { return this.got[l.id]; }, this).length; }
    total() { return LIST.length; }

    /** Desbloquea un logro (una sola vez). Devuelve true si es nuevo. */
    unlock(id) {
      if (this.got[id]) { return false; }
      var def = LIST.filter(function (l) { return l.id === id; })[0];
      if (!def) { return false; }
      this.got[id] = Date.now();
      this._save();
      var g = this.game;
      if (g.state !== 'ended') { g.ui.subtitle(MR.tf('★ Logro: {t}', { t: MR.t(def.titulo) }), 4); }
      if (g.audio.ctx) { g.audio.ding(); }
      MR.Haptics.pulse([15, 40, 15]);
      g.ui.renderLogros(this);
      return true;
    }

    /** Lista para la pantalla de título: [{titulo, desc, hecho}] (los ocultos sin conseguir, como «???»). */
    view() {
      var got = this.got;
      return LIST.map(function (l) {
        var hecho = !!got[l.id];
        return { titulo: hecho || !l.oculto ? l.titulo : '???', desc: hecho || !l.oculto ? l.desc : 'Un logro oculto.', hecho: hecho };
      });
    }
  }

  Logros.LIST = LIST;
  MR.Logros = Logros;
})(window.MR = window.MR || {});
