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
      // Guía de controles: desde el título y desde la pausa; Esc la cierra.
      $('btn-guia').addEventListener('click', function () { self.showGuide(true); });
      $('btn-guia-pausa').addEventListener('click', function () { self.showGuide(true); });
      $('btn-bosque').addEventListener('click', function () { game.travelFromPause(); });
      $('btn-guia-cerrar').addEventListener('click', function () { self.showGuide(false); });
      $('guia-tab-escritorio').addEventListener('click', function () { self._guideTab('escritorio'); });
      $('guia-tab-tactil').addEventListener('click', function () { self._guideTab('tactil'); });
      $('guia-tab-mando').addEventListener('click', function () { self._guideTab('mando'); });
      // Reiniciar todo: primero una pantalla de confirmación (no una ventana del navegador).
      $('btn-reiniciar').addEventListener('click', function () { self.showReset(true); });
      $('btn-reiniciar-pausa').addEventListener('click', function () { self.showReset(true); });
      $('btn-reiniciar-no').addEventListener('click', function () { self.showReset(false); });
      $('btn-reiniciar-si').addEventListener('click', function () { self.resetAll(); });
      window.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !$('reiniciar').hidden) { e.preventDefault(); self.showReset(false); return; }
        if (e.key === 'Escape' && !$('guia').hidden) { e.preventDefault(); self.showGuide(false); return; }
        // H en la pantalla de título o en la pausa (en plena partida la maneja game.js). No al escribir en un campo.
        var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
        if (e.code === 'KeyH' && !typing && game.state !== 'playing') { self.showGuide($('guia').hidden); }
      });
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
        vibration: true, gyro: true, lofi: true, mixMode: false, teleLink: '' };
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
          if (m[1] === 'mixMode') { MR.Game.audioSession(o.mixMode); }
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

    /** Tele: pegar un enlace de YouTube Music / YouTube (se recuerda el último, solo en este navegador). */
    bindTele(tele) {
      var o = this.options;
      var self = this;
      var input = $('tele-enlace');
      var slot = $('tele-hueco');
      if (o.teleLink) { input.value = o.teleLink; }
      tele.onStatus = function (text) { $('tele-estado').textContent = text; };
      function go() {
        slot.hidden = false; // el reproductor aparece aquí: en iPhone hay que tocar ▶ la primera vez
        tele.load(input.value).then(function (ok) {
          if (!ok) { slot.hidden = !tele.has(); return; }
          o.teleLink = input.value.trim().slice(0, 300);
          self._saveOptions();
        });
      }
      $('btn-tele').addEventListener('click', go);
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } });
    }

    hideTitle() {
      this.el.title.hidden = true;
      this.el.crosshair.hidden = !this.options.crosshair;
      // El panel de música pasa al menú de pausa para poder conectar o cambiar la música a mitad del turno.
      var panel = $('panel-musica');
      if (panel) { panel.open = false; $('pausa-musica').appendChild(panel); }
    }
    showPause(on) {
      this.el.pause.hidden = !on;
      if (!on) { $('guia').hidden = true; }
      if (on && this.game.bosque) {
        $('btn-bosque').textContent = this.game.bosque.outside ? 'Volver a la lavandería' : 'Salir al bosque';
      }
    }

    /** Abre la guía en la pestaña del dispositivo que estás usando (se puede cambiar a la otra). */
    showGuide(on) {
      $('guia').hidden = !on;
      if (on) {
        var b = document.body.classList;
        this._guideTab(b.contains('mando') ? 'mando' : (b.contains('tactil') ? 'tactil' : 'escritorio'));
        $('guia').scrollTop = 0;
        $('btn-guia-cerrar').focus({ preventScroll: true });
      }
    }

    showReset(on) {
      $('reiniciar').hidden = !on;
      if (on) { $('btn-reiniciar-no').focus({ preventScroll: true }); }
    }

    /**
     * Borra TODO lo que el juego guarda en este navegador (claves "midnight-rinse/…": registro del turno,
     * opciones y enlace de la música), corta la música y recarga la página desde cero.
     */
    resetAll() {
      var g = this.game;
      try { g.music.disconnect(true); } catch (e) { /* sin música */ }
      try { if (g.tele.player && g.tele.player.destroy) { g.tele.player.destroy(); } } catch (e) { /* sin tele */ }
      try { g.shift.reset(); } catch (e) { /* almacenamiento no disponible */ }
      try {
        var keys = [];
        for (var i = 0; i < window.localStorage.length; i += 1) {
          var k = window.localStorage.key(i);
          if (k && k.indexOf('midnight-rinse/') === 0) { keys.push(k); }
        }
        keys.forEach(function (k) { window.localStorage.removeItem(k); });
      } catch (e) { /* almacenamiento no disponible */ }
      this._saveOptions = function () {}; // que ningún guardado posterior vuelva a escribir las opciones viejas
      var reload = function () { window.location.reload(); };
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().then(reload, reload);
      } else {
        reload();
      }
    }

    _guideTab(which) {
      ['escritorio', 'tactil', 'mando'].forEach(function (k) {
        $('guia-' + k).hidden = k !== which;
        $('guia-tab-' + k).setAttribute('aria-selected', String(k === which));
      });
    }

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
