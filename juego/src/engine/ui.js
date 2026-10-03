/** Pantallas DOM: título y opciones, pausa, hoja del registro, subtítulos, respuestas y final. */
(function (MR) {
  'use strict';

  var OPTIONS_KEY = 'midnight-rinse/opciones';

  function $(id) { return document.getElementById(id); }

  class UI {
    constructor(game) {
      this.game = game;
      this.lines = [];
      this.el = {
        title: $('titulo'), pause: $('pausa'), note: $('nota'), noteText: $('nota-texto'), dialog: $('dialogo'),
        question: $('dialogo-pregunta'), choices: $('dialogo-opciones'), end: $('final'), endTitle: $('final-titulo'),
        endText: $('final-texto'), endList: $('final-resumen'), subs: $('subtitulos'), crosshair: $('mira'),
        realTime: $('aviso-hora-real'), registry: $('estado-registro')
      };
      this.options = this._loadOptions();
      this._bindOptions();
      var self = this;
      $('btn-comenzar').addEventListener('click', function () { self._saveOptions(); game.start(); });
      $('btn-continuar').addEventListener('click', function () { game.resume(); });
      $('btn-abandonar').addEventListener('click', function () { window.location.reload(); });
      $('btn-volver').addEventListener('click', function () { window.location.reload(); });
      $('btn-borrar-registro').addEventListener('click', function () { game.shift.reset(); self.refreshRegistry(); });
      // Móvil: tocar la hoja la deja; tocar una respuesta la elige.
      this.el.note.addEventListener('click', function () { if (game.noteOpen) { game.closeNote(); } });
      this.el.choices.addEventListener('click', function (e) {
        var li = e.target.closest('li');
        if (li && li.dataset.n) { game.answerChoice(parseInt(li.dataset.n, 10)); }
      });
      this.refreshRegistry();
      this.refreshRealTime();
      setInterval(function () { self._renderSubtitles(); }, 200);
    }

    _loadOptions() {
      var defaults = { subtitles: true, voices: true, reduceFlashes: false, crosshair: false, meta: false, sensitivity: 1.2, volume: 0.8, name: '',
        vibration: true, gyro: true, lofi: true, mixMode: false };
      try {
        var saved = JSON.parse(window.localStorage.getItem(OPTIONS_KEY) || '{}');
        return Object.assign(defaults, saved);
      } catch (e) {
        return defaults;
      }
    }

    _saveOptions() {
      try { window.localStorage.setItem(OPTIONS_KEY, JSON.stringify(this.options)); } catch (e) { /* almacenamiento no disponible */ }
    }

    _bindOptions() {
      var o = this.options;
      var self = this;
      var map = [['opt-subtitulos', 'subtitles', 'checked'], ['opt-voces', 'voices', 'checked'], ['opt-destellos', 'reduceFlashes', 'checked'],
        ['opt-mira', 'crosshair', 'checked'], ['opt-meta', 'meta', 'checked'], ['opt-sensibilidad', 'sensitivity', 'value'],
        ['opt-volumen', 'volume', 'value'], ['opt-nombre', 'name', 'value'], ['opt-vibracion', 'vibration', 'checked'],
        ['opt-giroscopio', 'gyro', 'checked'], ['opt-lofi', 'lofi', 'checked'], ['opt-mezcla', 'mixMode', 'checked']];
      map.forEach(function (m) {
        var input = $(m[0]);
        input[m[2]] = o[m[1]];
        input.addEventListener('input', function () {
          var v = input[m[2]];
          o[m[1]] = m[2] === 'value' && m[1] !== 'name' ? parseFloat(v) : (m[1] === 'name' ? String(v).trim().slice(0, 24) : v);
          if (m[1] === 'meta') { self.refreshRealTime(); }
          if (m[1] === 'volume') { self.game.audio.setVolume(o.volume); }
          if (m[1] === 'vibration') { MR.Haptics.enabled = o.vibration; if (o.vibration) { MR.Haptics.pulse(25); } }
          if (m[1] === 'lofi' && self.game.music) { self.game.music.setLofi(o.lofi); }
          self._saveOptions();
        });
      });
    }

    refreshRegistry() {
      var text = this.game.shift.currentText();
      this.el.registry.textContent = text ? 'El registro guardado dice: «' + text + '»' : 'El registro del turno está vacío.';
    }

    refreshRealTime() {
      var now = new Date();
      var h = now.getHours();
      var show = this.options.meta && h >= 2 && h < 5;
      this.el.realTime.hidden = !show;
      if (show) {
        this.el.realTime.textContent = 'Son las ' + MR.Util.clockText(h * 60 + now.getMinutes()) + '. Deberías estar durmiendo.';
      }
    }

    /** Panel "Tu música": YouTube Music (captura de pestaña) o archivos del dispositivo. */
    bindMusic(music) {
      var o = this.options;
      music.lofi = o.lofi;
      music.onStatus = function (text) { $('musica-estado').textContent = text; };
      $('btn-abrir-ytm').addEventListener('click', function () { window.open('https://music.youtube.com/', '_blank', 'noopener'); });
      $('btn-conectar-pestana').addEventListener('click', function () { music.connectTab(); });
      $('musica-archivos').addEventListener('change', function (e) { music.loadFiles(e.target.files); });
      $('btn-desconectar-musica').addEventListener('click', function () { music.disconnect(); });
      if (!MR.MusicLink.canCaptureTab()) { $('btn-conectar-pestana').disabled = true; }
    }

    hideTitle() {
      this.el.title.hidden = true;
      this.el.crosshair.hidden = !this.options.crosshair;
      // El panel de música pasa al menú de pausa para poder conectar o cambiar la música a mitad del turno.
      var panel = $('panel-musica');
      if (panel) { panel.open = false; $('pausa-musica').appendChild(panel); }
    }
    showPause(on) { this.el.pause.hidden = !on; }

    showNote(text) {
      this.el.noteText.textContent = text || '(hoja en blanco)';
      this.el.note.hidden = false;
    }

    hideNote() { this.el.note.hidden = true; }

    subtitle(text, seconds) {
      if (!this.options.subtitles) { return; }
      this.lines.push({ text: text, until: performance.now() + (seconds || 4) * 1000 });
      if (this.lines.length > 3) { this.lines.shift(); }
      this._renderSubtitles();
    }

    _renderSubtitles() {
      var now = performance.now();
      this.lines = this.lines.filter(function (l) { return l.until > now; });
      this.el.subs.textContent = this.lines.map(function (l) { return l.text; }).join('\n');
    }

    showChoices(question, options) {
      this.el.question.textContent = question;
      this.el.choices.textContent = '';
      var list = this.el.choices;
      options.forEach(function (o, i) {
        var li = document.createElement('li');
        li.textContent = o;
        li.dataset.n = String(i + 1);
        list.appendChild(li);
      });
      this.el.dialog.hidden = false;
    }

    /** Esquina de consumibles: el cigarro asoma si quedan; el tapón se apaga si la petaca está vacía. */
    updateConsumables(c) {
      var cig = $('consumible-cigarro');
      var cap = $('consumible-petaca');
      var joint = $('consumible-porro');
      if (cig) { cig.style.visibility = c.cigarettes > 0 ? 'visible' : 'hidden'; }
      if (cap) { cap.style.opacity = c.sips > 0 ? '1' : '0.3'; }
      if (joint) { joint.style.visibility = c.joints > 0 ? 'visible' : 'hidden'; }
    }

    hideChoices() { this.el.dialog.hidden = true; }

    showEnd(title, text, summary) {
      this.el.endTitle.textContent = title;
      this.el.endText.textContent = text;
      this.el.endList.textContent = '';
      var list = this.el.endList;
      summary.forEach(function (s) {
        var li = document.createElement('li');
        li.textContent = s;
        list.appendChild(li);
      });
      this.el.end.hidden = false;
      this.el.crosshair.hidden = true;
    }
  }

  MR.UI = UI;
})(window.MR = window.MR || {});
