/**
 * La tele de la lavandería: tu música de YouTube / YouTube Music DENTRO del mundo 3D. Funciona en el celular.
 *
 * Cómo:
 *  - Pegas el enlace de una canción, álbum o playlist (YouTube Music → Compartir → Copiar enlace). Se usa el
 *    reproductor oficial de YouTube (IFrame API): no hace falta Premium, ni archivos, ni cuenta.
 *  - El reproductor vive en una capa DETRÁS del lienzo. Cada cuadro recibe UNA sola matrix3d proyectiva
 *    (viewport × proyección × vista × modelo), la misma cuenta que hace la GPU con la tele, así que queda
 *    clavado sobre la pantalla. (Con perspective + preserve-3d, Chrome lo dibujaba desplazado con escalas de
 *    pantalla no enteras.) La pantalla de la tele es un "hueco" en el lienzo (retro.screenMaterial): solo por
 *    ahí se ve el video. Así las paredes, las manos, el vaho, el parpadeo y el Cliente Inmóvil lo tapan de verdad.
 *  - El volumen depende de la distancia a la tele; el Cliente Inmóvil cerca y los susurros meten estática; los
 *    apagones apagan la tele. (En iPhone el volumen de un video incrustado no se puede cambiar por código:
 *    suena al volumen del teléfono.)
 *  - En la pantalla de título y en la pausa el reproductor se muestra plano dentro del panel "Tu música",
 *    para tocar ▶ (iPhone lo exige) o cambiar de canción.
 *
 * Nada se descarga ni se graba: es el reproductor de YouTube, visible, con sus controles y su marca.
 */
(function (MR) {
  'use strict';

  var API_URL = 'https://www.youtube.com/iframe_api';
  var PX_W = 480;          // tamaño del reproductor en el mundo, en CSS px (4:3 como la tele; YouTube pide ≥ 200x200)
  var PX_H = 360;
  var OVERSIZE = 1.08;     // un poco más grande que el hueco: los bordes del hueco siempre muestran video
  var ID_RE = /^[A-Za-z0-9_-]{11}$/;
  var LIST_RE = /^[A-Za-z0-9_-]{2,64}$/;
  var apiPromise = null;

  function $(id) { return document.getElementById(id); }
  function eps(v) { return Math.abs(v) < 1e-10 ? 0 : v; }

  /** Enlace de YouTube / YouTube Music → {video, list} o {error}. Canciones, álbumes, playlists, youtu.be, shorts, IDs. */
  function parseLink(text) {
    text = String(text || '').trim();
    if (!text) { return { error: 'Pega un enlace de YouTube Music o de YouTube.' }; }
    if (ID_RE.test(text)) { return { video: text, list: null }; }
    var url;
    try { url = new URL(/^https?:\/\//i.test(text) ? text : 'https://' + text); } catch (e) { return { error: 'Eso no parece un enlace.' }; }
    var host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, '');
    if (host !== 'youtube.com' && host !== 'youtu.be' && host !== 'youtube-nocookie.com') {
      return { error: 'Solo funcionan enlaces de YouTube o YouTube Music.' };
    }
    var parts = url.pathname.split('/').filter(Boolean);
    var video = null;
    if (host === 'youtu.be') { video = parts[0]; }
    else if (parts[0] === 'watch') { video = url.searchParams.get('v'); }
    else if (['shorts', 'embed', 'live', 'v'].indexOf(parts[0]) >= 0) { video = parts[1]; }
    else if (parts[0] === 'browse' || parts[0] === 'channel') {
      return { error: 'Ese es el enlace de una página. En YouTube Music abre el álbum o la playlist y usa Compartir → Copiar enlace (trae «list=»).' };
    }
    var list = url.searchParams.get('list');
    if (video && !ID_RE.test(video)) { video = null; }
    if (list && !LIST_RE.test(list)) { list = null; }
    if (list === 'LM' || list === 'LL' || list === 'WL') {
      if (!video) {
        return { error: 'Tus «Me gusta» y «Ver más tarde» son privados y YouTube no los deja salir de su app. Haz una playlist pública o no listada y pega su enlace.' };
      }
      list = null;
    }
    if (!video && !list) { return { error: 'No encontré ninguna canción ni playlist en ese enlace.' }; }
    return { video: video, list: list };
  }

  function loadApi() {
    if (window.YT && window.YT.Player) { return Promise.resolve(window.YT); }
    if (apiPromise) { return apiPromise; }
    apiPromise = new Promise(function (resolve, reject) {
      var prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () { if (prev) { prev(); } resolve(window.YT); };
      var s = document.createElement('script');
      s.src = API_URL;
      s.async = true;
      s.onerror = function () { apiPromise = null; reject(new Error('sin conexión')); };
      document.head.appendChild(s);
    });
    return apiPromise;
  }

  class Tele {
    constructor(game) {
      this.game = game;
      this.tv = game.world.tv;
      this.layer = $('tele');
      this.cam = $('tele-camara');
      this.el = $('tele-pantalla');
      this.slot = $('tele-hueco');
      this.player = null;
      this.ready = false;
      this.playing = false;
      this.link = null;
      this.title = '';
      this.errors = 0;
      this.volume = -1;
      this.dropout = 0;
      this.power = true;
      this.mode = '';
      this.status = '';
      this.onStatus = null;
      this.tmp = new THREE.Vector3();
      this.fwd = new THREE.Vector3();
      this.tv.anchor.scale.set(this.tv.width * OVERSIZE / PX_W, this.tv.height * OVERSIZE / PX_H, 1);
      // Píxel del reproductor (origen arriba a la izquierda, y hacia abajo) → plano local del ancla.
      this.toLocal = new THREE.Matrix4().set(1, 0, 0, -PX_W / 2, 0, -1, 0, PX_H / 2, 0, 0, 1, 0, 0, 0, 0, 1);
      this.viewport = new THREE.Matrix4();
      this.full = new THREE.Matrix4();
    }

    has() { return !!this.link; }

    _setStatus(text) {
      this.status = text;
      if (this.onStatus) { this.onStatus(text); }
    }

    /** Pone un enlace en la tele. Llamar desde un clic (gesto del usuario). */
    load(text) {
      var link = parseLink(text);
      if (link.error) { this._setStatus(link.error); return Promise.resolve(false); }
      if (location.protocol === 'file:') {
        this._setStatus('YouTube no funciona abriendo el archivo con doble clic: juega desde la página publicada (GitHub Pages).');
        return Promise.resolve(false);
      }
      this.link = link;
      this.errors = 0;
      this._setStatus('Conectando con YouTube…');
      var self = this;
      return loadApi().then(function (YT) {
        self._build(YT, link);
        return true;
      }).catch(function () {
        self.link = null;
        self._setStatus('No se pudo cargar YouTube. ¿Hay internet?');
        return false;
      });
    }

    _build(YT, link) {
      if (this.player) { try { this.player.destroy(); } catch (e) { /* ya no existe */ } }
      this.player = null;
      this.ready = false;
      this.playing = false;
      this.volume = -1;
      this.el.textContent = '';
      var div = document.createElement('div');
      div.id = 'tele-yt';
      this.el.appendChild(div);
      var vars = { playsinline: 1, rel: 0, autoplay: 1, origin: location.origin };
      if (link.list) { vars.listType = 'playlist'; vars.list = link.list; }
      var self = this;
      var opts = {
        width: '100%',
        height: '100%',
        playerVars: vars,
        events: {
          onReady: function () { self._onReady(); },
          onStateChange: function (e) { self._onState(e.data); },
          onError: function (e) { self._onError(e.data); }
        }
      };
      if (link.video) { opts.videoId = link.video; }
      this.player = new YT.Player(div, opts);
    }

    _onReady() {
      this.ready = true;
      this._play();
      var self = this;
      // iPhone (y a veces otros) no deja empezar con sonido sin tocar el reproductor.
      setTimeout(function () {
        if (self.ready && !self.playing) { self._setStatus('Listo. Toca ▶ en el reproductor para que empiece a sonar.'); }
      }, 1800);
    }

    _onState(s) {
      var S = window.YT.PlayerState;
      this.playing = s === S.PLAYING;
      if (s === S.PLAYING) {
        var d = this.player.getVideoData ? this.player.getVideoData() : null;
        this.title = d && d.title ? d.title : '';
        this.errors = 0;
        this._setStatus('Sonando en la tele' + (this.title ? ': «' + this.title + '»' : '') + '.');
      } else if (s === S.PAUSED) {
        this._setStatus('En pausa' + (this.title ? ': «' + this.title + '»' : '') + '.');
      } else if (s === S.ENDED && this.link && !this.link.list) {
        this.player.seekTo(0, true); // una sola canción: se repite toda la noche
        this._play();
      }
    }

    _onError(code) {
      var blocked = 'Esa canción no se deja reproducir fuera de YouTube (lo decide la disquera).';
      var msg = { 2: 'El enlace no es válido.', 5: 'Tu navegador no pudo reproducir ese video.', 100: 'Ese video no existe o es privado.',
        101: blocked, 150: blocked, 153: 'YouTube rechazó la conexión desde esta página.' }[code] || 'YouTube dio un error (' + code + ').';
      if (this.link && this.link.list && this.errors < 6) {
        this.errors += 1;
        this._setStatus(msg + ' Paso a la siguiente…');
        var p = this.player;
        setTimeout(function () { try { p.nextVideo(); } catch (e) { /* reproductor reemplazado */ } }, 900);
      } else {
        this._setStatus(msg + ' Prueba otra versión de la canción (por ejemplo, la de «Audio» o «Letra»).');
      }
    }

    _play() { if (this.player && this.player.playVideo) { this.player.playVideo(); } }

    /** Tocar la tele en el mundo: reproducir / pausar. */
    togglePlay() {
      var g = this.game;
      g.audio.click();
      MR.Haptics.pulse(12);
      if (!this.link || !this.ready) {
        g.ui.subtitle('(La tele solo da nieve. Pon tu música desde la pausa: «Tu música dentro del juego».)', 4);
        return;
      }
      if (!this.power) { g.ui.subtitle('(No hay luz.)', 2.5); return; }
      if (this.playing) { this.player.pauseVideo(); } else { this._play(); }
    }

    /** Tocar la perilla de la tele: siguiente canción (o vuelve a empezar si es una sola). */
    next() {
      var g = this.game;
      g.audio.click();
      MR.Haptics.pulse([10, 30, 10]);
      if (!this.link || !this.ready) { g.ui.subtitle('(Cambias de canal. Nieve en todos.)', 3); return; }
      if (this.link.list) { this.player.nextVideo(); } else { this.player.seekTo(0, true); }
    }

    _slotRect() {
      if (!this.slot || this.slot.hidden) { return null; }
      var r = this.slot.getBoundingClientRect();
      return r.width > 0 && r.height > 0 ? r : null;
    }

    /** Por cuadro, DESPUÉS de renderizar (usa las matrices de la cámara de este cuadro). */
    frame(dt, time) {
      var g = this.game;
      var u = this.tv.screen.material.uniforms;
      u.uTime.value = time;
      this.power = g.horror.lightLevel() > 0.45;
      var slot = this._slotRect();
      var mode = slot && g.state !== 'playing' ? 'panel' : 'mundo';
      if (mode !== this.mode) { this.mode = mode; this.layer.className = mode; }
      var behind = false;
      var distance = 0;
      if (mode === 'panel') {
        this.layer.style.left = '0px';
        this.layer.style.top = '0px';
        this.layer.style.width = window.innerWidth + 'px';
        this.layer.style.height = window.innerHeight + 'px';
        this.el.style.width = slot.width + 'px';
        this.el.style.height = slot.height + 'px';
        this.el.style.transform = 'translate(' + slot.left + 'px,' + slot.top + 'px)';
        this.el.style.visibility = 'visible';
      } else {
        var r = g.canvas.getBoundingClientRect();
        var camera = g.player.camera;
        this.layer.style.left = r.left + 'px';
        this.layer.style.top = r.top + 'px';
        this.layer.style.width = r.width + 'px';
        this.layer.style.height = r.height + 'px';
        this.el.style.width = PX_W + 'px';
        this.el.style.height = PX_H + 'px';
        // Matriz completa: píxel del reproductor → píxel del lienzo (con la división homogénea en la 4.ª fila).
        this.viewport.set(r.width / 2, 0, 0, r.width / 2, 0, -r.height / 2, 0, r.height / 2, 0, 0, 1, 0, 0, 0, 0, 1);
        this.full.copy(this.viewport).multiply(camera.projectionMatrix).multiply(camera.matrixWorldInverse)
          .multiply(this.tv.anchor.matrixWorld).multiply(this.toLocal);
        var e = this.full.elements;
        // w de las 4 esquinas: si alguna queda detrás de la cámara, la proyección no sirve → se oculta (sigue sonando).
        var minW = Math.min(e[15], e[3] * PX_W + e[15], e[7] * PX_H + e[15], e[3] * PX_W + e[7] * PX_H + e[15]);
        var hidden = !(minW > 0.05);
        this.el.style.visibility = hidden ? 'hidden' : 'visible';
        if (!hidden) { this.el.style.transform = 'matrix3d(' + e.map(eps).join(',') + ')'; }
        var to = this.tmp.setFromMatrixPosition(this.tv.anchor.matrixWorld).sub(camera.position);
        distance = to.length();
        behind = to.dot(g.player.forward(this.fwd)) < 0.05 * distance;
      }

      // Pantalla: nieve sin señal, oscura sin luz, estática por el Cliente Inmóvil, los susurros y el colapso.
      var hasVideo = !!(this.link && this.ready);
      var st = 0;
      if (g.state === 'playing') {
        var near = g.horror.distanceToCustomer(g.player);
        if (near < 3) { st = 0.1 + 0.45 * (1 - near / 3); }
        if (g.whispers && Math.random() < dt * 0.6) { this.dropout = 0.3 + Math.random() * 0.5; }
        if (g.collapsed) { st = Math.max(st, 0.25); }
      }
      if (this.dropout > 0) { this.dropout -= dt; st = Math.max(st, 0.85); }
      u.uOpen.value = hasVideo && this.power ? 1 : 0;
      u.uStatic.value = !this.power ? 0 : (hasVideo ? st : 0.55);
      this.tv.led.material.uniforms.uEmissive.value = this.power ? 1.3 : 0;

      if (!this.ready || !this.player.setVolume) { return; }
      var vol = 80;
      if (mode === 'mundo' && g.state === 'playing') {
        vol = 100 * Math.pow(Math.min(1, 2.0 / Math.max(distance, 0.5)), 0.85);
        if (behind) { vol *= 0.75; }
        vol *= 1 - 0.6 * Math.min(1, st);
        if (g.collapsed) { vol *= 0.6; }
        if (!this.power) { vol = 0; }
      }
      vol = Math.round(Math.max(0, Math.min(100, vol)));
      if (Math.abs(vol - this.volume) >= 2 || (vol === 0) !== (this.volume === 0)) {
        this.player.setVolume(vol);
        this.volume = vol;
      }
    }
  }

  Tele.parseLink = parseLink;
  MR.Tele = Tele;
})(window.MR = window.MR || {});
