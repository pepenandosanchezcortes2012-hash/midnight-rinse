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
      $('btn-continuar-turno').addEventListener('click', function () { self._saveOptions(); game.continueShift(); });
      this.refreshContinue();
      this.refreshNight();
      $('btn-continuar').addEventListener('click', function () { game.resume(); });
      $('btn-abandonar').addEventListener('click', function () { MR.Partida.clear(); window.location.reload(); });
      $('btn-volver').addEventListener('click', function () { window.location.reload(); });
      $('btn-compartir').addEventListener('click', function () { self.share(); });
      $('btn-borrar-registro').addEventListener('click', function () { game.shift.reset(); self.refreshRegistry(); });
      // Guía de controles: desde el título y desde la pausa; Esc la cierra.
      $('btn-guia').addEventListener('click', function () { self.showGuide(true); });
      $('btn-guia-pausa').addEventListener('click', function () { self.showGuide(true); });
      $('btn-bosque').addEventListener('click', function () { game.travelFromPause(); });
      $('btn-foto').addEventListener('click', function () { game.photoFromPause(); });
      $('btn-visor-cerrar').addEventListener('click', function () { self.showVisor(null); });
      $('btn-visor-compartir').addEventListener('click', function () {
        if (self.visorFoto) { navigator.share({ files: [MR.Fotos.toFile(self.visorFoto)], title: 'Midnight Rinse' }).catch(function () { /* cancelado */ }); }
      });
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
        if (e.key === 'Escape' && !$('visor').hidden) { e.preventDefault(); self.showVisor(null); return; }
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
      // Idioma: cambiarlo guarda la opción y recarga la página.
      var lang = $('opt-idioma');
      lang.value = MR.I18N.lang;
      lang.addEventListener('change', function () { MR.I18N.set(lang.value); });
      this.refreshRegistry();
      this.refreshRealTime();
      setInterval(function () { self._renderSubtitles(); }, 200);
    }

    _loadOptions() {
      var defaults = { subtitles: true, voices: true, reduceFlashes: false, crosshair: false, meta: false, sensitivity: 1.2, volume: 0.8, name: '',
        vibration: true, gyro: true, lofi: true, mixMode: false, teleLink: '', fov: 70, invertY: false, subsScale: 1,
        difficulty: 'normal', crt: false, batterySaver: MR.isTouchDevice ? MR.isTouchDevice() : false };
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
        ['opt-giroscopio', 'gyro', 'checked'], ['opt-lofi', 'lofi', 'checked'], ['opt-mezcla', 'mixMode', 'checked'],
        ['opt-fov', 'fov', 'value'], ['opt-invertir', 'invertY', 'checked'], ['opt-subs-tam', 'subsScale', 'value'],
        ['opt-dificultad', 'difficulty', 'value'], ['opt-bateria', 'batterySaver', 'checked'], ['opt-crt', 'crt', 'checked']];
      map.forEach(function (m) {
        var input = $(m[0]);
        input[m[2]] = o[m[1]];
        input.addEventListener('input', function () {
          var v = input[m[2]];
          var text = m[1] === 'name' || m[1] === 'difficulty'; // opciones de texto (no números)
          o[m[1]] = m[2] === 'value' && !text ? parseFloat(v) : (m[1] === 'name' ? String(v).trim().slice(0, 24) : v);
          if (m[1] === 'meta') { self.refreshRealTime(); }
          if (m[1] === 'volume') { self.game.audio.setVolume(o.volume); }
          if (m[1] === 'vibration') { MR.Haptics.enabled = o.vibration; if (o.vibration) { MR.Haptics.pulse(25); } }
          if (m[1] === 'lofi' && self.game.music) { self.game.music.setLofi(o.lofi); }
          if (m[1] === 'mixMode') { MR.Game.audioSession(o.mixMode); }
          if (m[1] === 'fov' || m[1] === 'subsScale') { self.applyView(); }
          self._saveOptions();
        });
      });
    }

    refreshRegistry() {
      var text = this.game.shift.currentText();
      this.el.registry.textContent = text ? MR.tf('El registro guardado dice: «{t}»', { t: MR.t(text) }) : MR.t('El registro del turno está vacío.');
    }

    refreshRealTime() {
      var now = new Date();
      var h = now.getHours();
      var show = this.options.meta && h >= 2 && h < 5;
      this.el.realTime.hidden = !show;
      if (show) {
        this.el.realTime.textContent = MR.tf('Son las {h}. Deberías estar durmiendo.', { h: MR.Util.clockText(h * 60 + now.getMinutes()) });
      }
    }

    /** «Noche n»: cuántos turnos llevas (se guarda en midnight-rinse/noches). */
    refreshNight() {
      var n = 0;
      try { n = parseInt(window.localStorage.getItem('midnight-rinse/noches') || '0', 10) || 0; } catch (e) { n = 0; }
      var el = $('noche');
      el.hidden = n < 1;
      el.textContent = MR.tf('Noche {n}', { n: n + 1 });
    }

    /** Botón «Continuar turno (02:47 · Normal)» si hay un turno guardado. */
    refreshContinue() {
      var b = $('btn-continuar-turno');
      var d = MR.Partida && MR.Partida.load();
      b.hidden = !d;
      if (d) {
        var diff = MR.DIFICULTAD[d.difficulty] || MR.DIFICULTAD.normal;
        b.textContent = MR.tf('Continuar turno ({h} · {d})', { h: MR.Util.clockText(Math.floor(d.minutes)), d: MR.t(diff.nombre) });
      }
    }

    /** Campo de visión y tamaño de subtítulos (se llama al arrancar y al cambiar la opción). */
    applyView() {
      var o = this.options;
      document.documentElement.style.setProperty('--subs-escala', String(o.subsScale || 1));
      var cam = this.game.player && this.game.player.camera;
      if (cam && o.fov) { cam.fov = o.fov; cam.updateProjectionMatrix(); }
    }

    /** Archivo: hojas y transmisiones que ya encontraste; tocar una la abre para releerla. */
    renderArchivo(archivo) {
      $('archivo-cuenta').textContent = archivo.count() + '/' + archivo.total();
      var list = $('archivo-lista');
      list.textContent = '';
      var game = this.game;
      var self = this;
      var group = null;
      archivo.view().forEach(function (e) {
        if (e.grupo !== group) {
          group = e.grupo;
          var h = document.createElement('li');
          h.className = 'grupo';
          h.textContent = MR.t(group);
          list.appendChild(h);
        }
        var li = document.createElement('li');
        li.className = e.hecho ? 'hecho' : '';
        var mark = document.createElement('span');
        mark.className = 'marca';
        mark.textContent = e.hecho ? '▤' : '·';
        var body = document.createElement('span');
        body.textContent = MR.t(e.titulo);
        li.appendChild(mark);
        li.appendChild(body);
        if (e.hecho) {
          li.classList.add('leer');
          li.tabIndex = 0;
          li.addEventListener('click', function () { game.noteOpen = true; self.showNote(e.texto, e.encabezado); });
        }
        list.appendChild(li);
      });
    }

    /** Panel de récords: turnos, mejor nota por dificultad y finales vistos. */
    renderHistorial(historial) {
      $('historial-cuenta').textContent = historial.count() + '/' + historial.total();
      this._renderList($('historial-lista'), historial.view(), '▣', '□');
    }

    /** Panel «Fotos»: miniaturas (la más nueva primero); tocar una la abre en grande. */
    renderFotos(fotos) {
      $('fotos-cuenta').textContent = String(fotos.count());
      var list = $('fotos-lista');
      list.textContent = '';
      var self = this;
      fotos.list.slice().reverse().forEach(function (f) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'foto-mini';
        b.title = MR.tf('Noche {n} · {h}', { n: f.noche, h: f.hora });
        var img = document.createElement('img');
        img.src = f.src;
        img.alt = b.title;
        b.appendChild(img);
        b.addEventListener('click', function () { self.showVisor(f); });
        list.appendChild(b);
      });
      $('fotos-vacio').hidden = fotos.count() > 0;
    }

    /** Una foto en grande, con «Descargar». showVisor(null) la cierra. */
    showVisor(f) {
      $('visor').hidden = !f;
      this.visorFoto = f;
      if (!f) { return; }
      $('btn-visor-compartir').hidden = !MR.Fotos.canShare(f);
      $('visor-img').src = f.src;
      $('visor-pie').textContent = MR.tf('Noche {n} · {h}', { n: f.noche, h: f.hora });
      var a = $('visor-descargar');
      a.href = f.src;
      a.download = 'midnight-rinse-noche' + f.noche + '-' + f.hora.replace(':', '') + '.jpg';
      $('btn-visor-cerrar').focus({ preventScroll: true });
    }

    /** La foto recién sacada asoma un momento como polaroid en la esquina. */
    showPolaroid(f) {
      var el = $('polaroid');
      el.querySelector('img').src = f.src;
      el.querySelector('span').textContent = f.hora;
      el.hidden = false;
      el.classList.remove('sale');
      void el.offsetWidth; // reinicia la animación
      el.classList.add('sale');
      clearTimeout(this._polaroidTimer);
      this._polaroidTimer = setTimeout(function () { el.hidden = true; }, 3600);
    }

    /** Panel de objetos perdidos (misma presentación que los logros). */
    renderObjetos(objetos) {
      $('objetos-cuenta').textContent = objetos.count() + '/' + objetos.total();
      this._renderList($('objetos-lista'), objetos.view(), '◆', '◇');
    }

    _renderList(list, items, on, off) {
      list.textContent = '';
      items.forEach(function (l) {
        var li = document.createElement('li');
        li.className = l.hecho ? 'hecho' : '';
        var mark = document.createElement('span');
        mark.className = 'marca';
        mark.textContent = l.hecho ? on : off;
        var body = document.createElement('span');
        var b = document.createElement('b');
        b.textContent = MR.t(l.titulo);
        body.appendChild(b);
        body.appendChild(document.createElement('br'));
        body.appendChild(document.createTextNode(MR.t(l.desc)));
        li.appendChild(mark);
        li.appendChild(body);
        list.appendChild(li);
      });
    }

    /** Panel de logros de la pantalla de título. */
    renderLogros(logros) {
      $('logros-cuenta').textContent = logros.count() + '/' + logros.total();
      var list = $('logros-lista');
      list.textContent = '';
      logros.view().forEach(function (l) {
        var li = document.createElement('li');
        li.className = l.hecho ? 'hecho' : '';
        var mark = document.createElement('span');
        mark.className = 'marca';
        mark.textContent = l.hecho ? '★' : '☆';
        var body = document.createElement('span');
        var b = document.createElement('b');
        b.textContent = MR.t(l.titulo);
        body.appendChild(b);
        body.appendChild(document.createElement('br'));
        body.appendChild(document.createTextNode(MR.t(l.desc)));
        li.appendChild(mark);
        li.appendChild(body);
        list.appendChild(li);
      });
    }

    /** Panel "Tu música": YouTube Music (captura de pestaña) o archivos del dispositivo. */
    bindMusic(music) {
      var o = this.options;
      music.lofi = o.lofi;
      music.onStatus = function (text) { $('musica-estado').textContent = MR.t(text); };
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
      tele.onStatus = function (text) { $('tele-estado').textContent = MR.t(text); };
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
        var away = this.game.bosque.outside || (this.game.pasillo && this.game.pasillo.inside);
        $('btn-bosque').textContent = MR.t(away ? 'Volver a la lavandería' : 'Salir al bosque');
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

    /** La hoja vista de cerca: el registro del mostrador o una hoja mojada del bosque (con su firma). */
    showNote(text, header, cls) {
      this.el.note.classList.toggle('tareas', cls === 'tareas');
      // Línea por línea: la tablilla de tareas llega como varias líneas ya armadas.
      this.el.noteText.textContent = String(text || '(hoja en blanco)').split('\n').map(MR.t).join('\n');
      this.el.note.querySelector('.encabezado').textContent = MR.t(header || 'REGISTRO DE TURNO · LAVANDERÍA LA ESPUMA');
      this.el.note.hidden = false;
    }

    hideNote() { this.el.note.hidden = true; }

    subtitle(text, seconds) {
      if (!this.options.subtitles) { return; }
      this.lines.push({ text: MR.t(text), until: performance.now() + (seconds || 4) * 1000 });
      if (this.lines.length > 3) { this.lines.shift(); }
      this._renderSubtitles();
    }

    _renderSubtitles() {
      var now = performance.now();
      this.lines = this.lines.filter(function (l) { return l.until > now; });
      this.el.subs.textContent = this.lines.map(function (l) { return l.text; }).join('\n');
    }

    showChoices(question, options) {
      this.el.question.textContent = MR.t(question);
      this.el.choices.textContent = '';
      var list = this.el.choices;
      options.forEach(function (o, i) {
        var li = document.createElement('li');
        li.textContent = MR.t(o);
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

    /** Texto para compartir el resultado del turno. */
    shareText() {
      var g = this.game;
      var title = this.el.endTitle.textContent;
      var diff = MR.t(g.diff ? g.diff.nombre : 'Normal');
      var pages = g.bosque.pagesFound();
      return MR.tf('Saqué {nota} en Midnight Rinse ({dif}): «{titulo}».', { nota: g.grade || '?', dif: diff, titulo: title }) +
        (pages ? ' ' + MR.tf('Encontré {n} de 6 hojas en el bosque.', { n: pages }) : '') +
        ' ' + MR.t('¿Aguantas el turno de medianoche?');
    }

    /** Compartir: menú del teléfono (Web Share) o, si no hay, copiar al portapapeles. */
    share() {
      var text = this.shareText();
      var url = location.origin + location.pathname.replace(/[^/]*$/, '');
      var status = $('compartir-estado');
      // Con la última foto de la noche, si el teléfono deja compartir imágenes.
      var foto = this.game.fotos && this.game.fotos.lastTonight();
      if (foto && MR.Fotos.canShare(foto)) {
        navigator.share({ files: [MR.Fotos.toFile(foto)], title: 'Midnight Rinse', text: text + ' ' + url }).catch(function () { /* cancelado */ });
        return;
      }
      if (navigator.share) {
        navigator.share({ title: 'Midnight Rinse', text: text, url: url }).catch(function () { /* cancelado */ });
        return;
      }
      var full = text + ' ' + url;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(full).then(function () { status.textContent = MR.t('Copiado. Pégalo donde quieras.'); },
          function () { status.textContent = full; });
      } else {
        status.textContent = full;
      }
    }

    /** La nota del gerente (A–F) en la pantalla final. */
    showGrade(letter, comment) {
      $('final-letra').textContent = letter;
      $('final-gerente').textContent = MR.t(comment);
    }

    showEnd(title, text, summary) {
      this.el.endTitle.textContent = MR.t(title);
      this.el.endText.textContent = MR.t(text);
      this.el.endList.textContent = '';
      var list = this.el.endList;
      summary.forEach(function (s) {
        var li = document.createElement('li');
        li.textContent = MR.t(s);
        list.appendChild(li);
      });
      this.el.end.hidden = false;
      this.el.crosshair.hidden = true;
    }
  }

  MR.UI = UI;
})(window.MR = window.MR || {});
