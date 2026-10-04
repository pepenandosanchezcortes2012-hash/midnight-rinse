/**
 * "Tu música": tu propia música sonando DENTRO de la lavandería, desde la radio del mostrador (99.9 FM).
 *
 * Fuentes:
 *  - Pestaña de YouTube Music (u otra: Spotify web, SoundCloud…), en Chrome/Edge de escritorio: se captura el
 *    audio de la pestaña con getDisplayMedia (lo eliges tú en el selector del navegador). La pestaña original se
 *    silencia (suppressLocalAudioPlayback) y su audio pasa por la radio del juego. No se descarga nada ni se
 *    guarda nada: es tu reproducción, en tu cuenta, escuchada a través del juego.
 *  - Archivos de tu dispositivo (funciona también en el celular): lista de reproducción local.
 *
 * Cadena: fuente → filtro de radio (lo-fi opcional) → sintonía (cercanía a 99.9) → interferencias del horror →
 * filtro "bajo el agua" (colapso) → panoramizador HRTF en la posición de la radio → bus maestro (+ reverberación).
 * Así la música baja si te alejas, cambia de lado según hacia dónde miras y se ahoga cuando él está cerca.
 */
(function (MR) {
  'use strict';

  var STATION = 99.9;
  var RADIO_POS = [5.2, 1.15, 1.95];
  var AUDIO_EXT = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|webm)$/i;

  class MusicLink {
    constructor(game) {
      this.game = game;
      this.audio = game.audio;
      this.kind = null;
      this.source = null;
      this.stream = null;
      this.element = null;
      this.elementSource = null;
      this.files = [];
      this.urls = [];
      this.index = 0;
      this.lofi = true;
      this.status = 'Sin conectar.';
      this.onStatus = null;
      this.proximity = 0;
      this.dropout = 0;
      this.chain = null;
      this.fwd = new THREE.Vector3();
    }

    connected() { return !!this.source; }

    _setStatus(text) {
      this.status = text;
      if (this.onStatus) { this.onStatus(text); }
    }

    static canCaptureTab() {
      return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) && !MR.isTouchDevice();
    }

    _ensureChain() {
      if (this.chain) { return this.chain; }
      var ctx = this.audio.ensureContext(this.game.options.volume);
      var c = {};
      c.input = ctx.createGain();
      c.hp = ctx.createBiquadFilter(); c.hp.type = 'highpass';
      c.lp = ctx.createBiquadFilter(); c.lp.type = 'lowpass';
      c.drive = ctx.createWaveShaper();
      var curve = new Float32Array(1024);
      for (var i = 0; i < curve.length; i += 1) { var x = i / 511.5 - 1; curve[i] = Math.tanh(x * 1.6) / Math.tanh(1.6); }
      c.curve = curve;
      c.drive.curve = curve;
      c.tune = ctx.createGain(); c.tune.gain.value = 0;
      c.duck = ctx.createGain(); c.duck.gain.value = 1;
      c.water = ctx.createBiquadFilter(); c.water.type = 'lowpass'; c.water.frequency.value = 20000;
      c.panner = ctx.createPanner();
      c.panner.panningModel = 'HRTF';
      c.panner.distanceModel = 'inverse';
      c.panner.refDistance = 1.3;
      c.panner.rolloffFactor = 1.3;
      c.panner.maxDistance = 40;
      if (c.panner.positionX) {
        c.panner.positionX.value = RADIO_POS[0]; c.panner.positionY.value = RADIO_POS[1]; c.panner.positionZ.value = RADIO_POS[2];
      } else {
        c.panner.setPosition(RADIO_POS[0], RADIO_POS[1], RADIO_POS[2]);
      }
      c.out = ctx.createGain(); c.out.gain.value = 1.0;
      c.input.connect(c.hp); c.hp.connect(c.lp); c.lp.connect(c.drive); c.drive.connect(c.tune);
      c.tune.connect(c.duck); c.duck.connect(c.water); c.water.connect(c.panner); c.panner.connect(c.out);
      c.out.connect(this.audio.master);
      c.out.connect(this.audio.reverbSend);
      this.chain = c;
      this.setLofi(this.lofi);
      return c;
    }

    /** Sonido de radio vieja (paso-banda 300 Hz–3.4 kHz y algo de saturación) o fidelidad completa. */
    setLofi(on) {
      this.lofi = on;
      if (!this.chain) { return; }
      this.chain.hp.frequency.value = on ? 300 : 20;
      this.chain.lp.frequency.value = on ? 3400 : 20000;
      this.chain.drive.curve = on ? this.chain.curve : null;
    }

    /** Captura el audio de la pestaña de YouTube Music (u otra). Llamar desde un clic. */
    connectTab() {
      var self = this;
      if (!MusicLink.canCaptureTab()) {
        this._setStatus('Este navegador no puede capturar pestañas. Usa Chrome o Edge en una computadora, o elige archivos.');
        return Promise.resolve(false);
      }
      this.audio.ensureContext(this.game.options.volume);
      return navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser' },
        audio: { suppressLocalAudioPlayback: true, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        preferCurrentTab: false,
        selfBrowserSurface: 'exclude',
        surfaceSwitching: 'include',
        systemAudio: 'include'
      }).then(function (stream) {
        var tracks = stream.getAudioTracks();
        if (!tracks.length) {
          stream.getTracks().forEach(function (t) { t.stop(); });
          self._setStatus('No llegó audio. Vuelve a intentarlo y marca «Compartir audio de la pestaña».');
          return false;
        }
        stream.getVideoTracks().forEach(function (t) { t.enabled = false; });
        self.disconnect(true);
        var c = self._ensureChain();
        self.stream = stream;
        self.source = self.audio.ctx.createMediaStreamSource(new MediaStream(tracks));
        self.source.connect(c.input);
        self.kind = 'pestaña';
        tracks[0].addEventListener('ended', function () { self.disconnect(); });
        self._setStatus('Conectado: tu pestaña suena en la radio del mostrador (99.9 FM).');
        self._tuneIfPlaying();
        return true;
      }).catch(function (err) {
        self._setStatus(err && err.name === 'NotAllowedError' ? 'Captura cancelada.' : MR.tf('No se pudo capturar la pestaña: {e}', { e: err && err.message }));
        return false;
      });
    }

    /** Lista de reproducción con tus archivos de audio (también en el celular). */
    loadFiles(fileList) {
      var files = Array.prototype.filter.call(fileList || [], function (f) { return /^audio\//.test(f.type) || AUDIO_EXT.test(f.name); });
      if (!files.length) { this._setStatus('No elegiste archivos de audio.'); return false; }
      this.disconnect(true);
      var c = this._ensureChain();
      this.files = files;
      this.urls = files.map(function (f) { return URL.createObjectURL(f); });
      this.index = 0;
      if (!this.element) {
        this.element = new Audio();
        this.element.crossOrigin = 'anonymous';
        this.elementSource = this.audio.ctx.createMediaElementSource(this.element);
        var self = this;
        this.element.addEventListener('ended', function () { self._next(); });
      }
      this.elementSource.connect(c.input);
      this.source = this.elementSource;
      this.kind = 'archivos';
      this.element.loop = files.length === 1;
      this._playIndex();
      this._setStatus(MR.tf(files.length === 1 ? 'Conectado: {n} canción en la radio del mostrador (99.9 FM).' :
        'Conectado: {n} canciones en la radio del mostrador (99.9 FM).', { n: files.length }));
      this._tuneIfPlaying();
      return true;
    }

    _playIndex() {
      this.element.src = this.urls[this.index];
      var p = this.element.play();
      if (p && p.catch) { p.catch(function () { /* se reintenta con el siguiente gesto (inicio del turno) */ }); }
    }

    _next() {
      if (this.kind !== 'archivos' || this.files.length < 2) { return; }
      this.index = (this.index + 1) % this.files.length;
      this._playIndex();
    }

    _tuneIfPlaying() {
      if (this.game.state === 'playing' || this.game.state === 'paused') { this.game.gameplay.tuneTo(STATION); }
    }

    disconnect(silent) {
      if (this.stream) { this.stream.getTracks().forEach(function (t) { t.stop(); }); this.stream = null; }
      if (this.source) { try { this.source.disconnect(); } catch (e) { /* ya desconectado */ } }
      if (this.element) { this.element.pause(); }
      this.urls.forEach(function (u) { URL.revokeObjectURL(u); });
      this.urls = [];
      this.source = null;
      this.kind = null;
      if (!silent) { this._setStatus('Desconectado.'); }
    }

    /** Al empezar el turno (gesto del usuario): reanuda la reproducción local si el navegador la bloqueó. */
    onGameStart() {
      if (this.kind === 'archivos' && this.element.paused) { this._playIndex(); }
    }

    pause() { if (this.kind === 'archivos') { this.element.pause(); } }
    resume() { if (this.kind === 'archivos' && this.element.paused) { this.element.play().catch(function () {}); } }

    /** Por cuadro: sintonía, interferencias del horror, colapso y posición del oyente. */
    update(dt) {
      var g = this.game;
      this.proximity = this.connected() ? Math.max(0, 1 - Math.abs(g.gameplay.radioFreq - STATION) / 0.6) : 0;
      if (!this.chain || !this.source) { return; }
      var ctx = this.audio.ctx;
      var now = ctx.currentTime;
      var playing = g.state === 'playing';
      // En la pantalla de título suena como vista previa, para confirmar la conexión.
      var tune = playing ? this.proximity : (g.state === 'title' ? 0.9 : 0);
      this.chain.tune.gain.setTargetAtTime(tune, now, 0.12);

      // Interferencias: el Cliente Inmóvil cerca, los susurros y los apagones ahogan la señal.
      var near = g.horror.distanceToCustomer(g.player);
      var duck = 1;
      if (near < 3) { duck *= 0.35 + 0.65 * (near / 3); }
      if (g.whispers && Math.random() < dt * 0.5) { this.dropout = 0.4 + Math.random() * 0.6; }
      if (g.horror.lightLevel() < 0.6 && Math.random() < dt * 2) { this.dropout = 0.25; }
      if (this.dropout > 0) { this.dropout -= dt; duck *= 0.08; }
      this.chain.duck.gain.setTargetAtTime(duck, now, 0.05);
      this.chain.water.frequency.setTargetAtTime(g.collapsed ? 700 : 20000, now, 1.5);
      if (this.kind === 'archivos') { this.element.playbackRate = g.collapsed ? 0.92 : 1; }

      // Oyente = la cámara del jugador (audio 3D).
      var cam = g.player.camera;
      var l = ctx.listener;
      var f = g.player.forward(this.fwd);
      if (l.positionX) {
        l.positionX.setTargetAtTime(cam.position.x, now, 0.03);
        l.positionY.setTargetAtTime(cam.position.y, now, 0.03);
        l.positionZ.setTargetAtTime(cam.position.z, now, 0.03);
        l.forwardX.setTargetAtTime(f.x, now, 0.03);
        l.forwardY.setTargetAtTime(f.y, now, 0.03);
        l.forwardZ.setTargetAtTime(f.z, now, 0.03);
        l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
      } else {
        l.setPosition(cam.position.x, cam.position.y, cam.position.z);
        l.setOrientation(f.x, f.y, f.z, 0, 1, 0);
      }
    }
  }

  MusicLink.STATION = STATION;
  MR.MusicLink = MusicLink;
})(window.MR = window.MR || {});
