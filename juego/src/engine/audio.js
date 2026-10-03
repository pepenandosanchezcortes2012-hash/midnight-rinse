/**
 * Motor de audio procedural (Web Audio, sin archivos). Mezclador de 3 canales del diseño:
 *  A) radio diegética: jazz de los años 30 ralentizado un 30 % con flutter de cinta, filtrado paso-banda
 *     300 Hz–3.4 kHz; su ganancia depende de lo cerca que esté la sintonía de la estación válida (94.1).
 *  B) estática rosa/blanca, inversa a esa cercanía.
 *  C) infrasonido de 26–32 Hz con ganancia inversa al ruido de las lavadoras.
 * Además: lluvia, zumbido fluorescente, lavadoras a 45 RPM, secadoras, drone en Re dórico a 54 BPM,
 * susurros, efectos táctiles y voces con speechSynthesis (opcionales).
 */
(function (MR) {
  'use strict';

  function noiseBuffer(ctx, kind, seconds) {
    var len = Math.floor(ctx.sampleRate * seconds);
    var buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var ch = 0; ch < 2; ch += 1) {
      var d = buf.getChannelData(ch);
      var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
      for (var i = 0; i < len; i += 1) {
        var white = Math.random() * 2 - 1;
        if (kind === 'pink') {
          b0 = 0.99886 * b0 + white * 0.0555179; b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520; b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522; b5 = -0.7616 * b5 - white * 0.0168980;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
          b6 = white * 0.115926;
        } else if (kind === 'brown') {
          last = (last + 0.02 * white) / 1.02;
          d[i] = last * 3.5;
        } else {
          d[i] = white;
        }
      }
    }
    return buf;
  }

  var MIDI = function (n) { return 440 * Math.pow(2, (n - 69) / 12); };
  // ii-V-I-VI en Do: Dm7, G7, Cmaj7, A7 (voicings cerrados) y bajos.
  var CHORDS = [[62, 65, 69, 72], [55, 59, 62, 65], [60, 64, 67, 71], [57, 61, 64, 67]];
  var BASS = [38, 43, 36, 45];
  var SCALE = [62, 64, 65, 67, 69, 71, 72, 74];

  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.voices = true;
      this.volume = 0.8;
      this.nextBeat = 0;
      this.beat = 0;
      this.ringing = false;
      this.nextRing = 0;
    }

    /** Debe llamarse dentro de un gesto del usuario (clic en "Comenzar turno"). */
    /**
     * Contexto, bus maestro y reverberación. Se puede crear antes del turno (al conectar tu música desde la
     * pantalla de título) sin que suene la ambientación. Debe llamarse dentro de un gesto del usuario.
     */
    ensureContext(volume) {
      if (this.ctx) { if (this.ctx.state === 'suspended') { this.ctx.resume(); } return this.ctx; }
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.ctx = ctx;
      this.white = noiseBuffer(ctx, 'white', 2.5);
      this.pink = noiseBuffer(ctx, 'pink', 3.0);
      this.brown = noiseBuffer(ctx, 'brown', 3.0);
      this.master = ctx.createGain();
      this.master.gain.value = volume === undefined ? this.volume : volume;
      this.muffle = ctx.createBiquadFilter();
      this.muffle.type = 'lowpass';
      this.muffle.frequency.value = 18000;
      var comp = ctx.createDynamicsCompressor();
      this.master.connect(this.muffle);
      this.muffle.connect(comp);
      comp.connect(ctx.destination);
      // Reverberación (respuesta al impulso generada): se abre al fumar un porro.
      var len = Math.floor(ctx.sampleRate * 2.6);
      var ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (var ch = 0; ch < 2; ch += 1) {
        var d = ir.getChannelData(ch);
        for (var i = 0; i < len; i += 1) { d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
      }
      this.reverb = ctx.createConvolver();
      this.reverb.buffer = ir;
      this.reverbSend = ctx.createGain();
      this.reverbSend.gain.value = 0;
      this.reverbSend.connect(this.reverb);
      this.reverb.connect(this.master);
      return ctx;
    }

    start(volume, voices) {
      this.voices = voices;
      this.volume = volume;
      this.ensureContext(volume);
      this.master.gain.value = volume;
      if (this.ambience) { this.ctx.resume(); return; }
      this.ambience = true;
      var ctx = this.ctx;

      // Ambiente: lluvia, zumbido fluorescente, drone.
      this.rain = this._loop(this.white, [['bandpass', 1500, 0.6], ['lowpass', 3800, 0.7]], 0.05);
      this.wind = this._loop(this.brown, [['lowpass', 260, 0.7]], 0.05); // retumbo; afuera, viento
      this.hum = ctx.createGain();
      this.hum.gain.value = 0.012;
      this.hum.connect(this.master);
      [120, 240].forEach(function (f, i) {
        var o = ctx.createOscillator();
        o.type = i ? 'sawtooth' : 'sine';
        o.frequency.value = f;
        var g = ctx.createGain();
        g.gain.value = i ? 0.25 : 1;
        o.connect(g); g.connect(this.hum); o.start();
      }, this);

      this.pad = ctx.createGain();
      this.pad.gain.value = 0.03;
      this.pad.connect(this.master);
      [73.42, 110.0, 130.81, 174.61].forEach(function (f, i) {
        var o = ctx.createOscillator();
        o.type = i % 2 ? 'triangle' : 'sine';
        o.frequency.value = f;
        o.detune.value = (i - 1.5) * 4;
        o.connect(this.pad); o.start();
      }, this);
      this._lfo(0.9, 0.012, this.pad.gain); // 54 BPM

      // Lavadoras (45 RPM = 0.75 Hz) y secadoras.
      this.washers = this._loop(this.brown, [['lowpass', 190, 1.0]], 0);
      this.washerAmp = ctx.createGain();
      this.washerAmp.gain.value = 0.7;
      this.washers.out.disconnect();
      this.washers.out.connect(this.washerAmp);
      this.washerAmp.connect(this.master);
      this._lfo(0.75, 0.3, this.washerAmp.gain);
      this.dryers = this._loop(this.pink, [['bandpass', 420, 0.8]], 0);

      // Canal A: radio musical con paso-banda 300 Hz–3.4 kHz.
      this.radioBus = ctx.createGain();
      var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 300;
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3400;
      this.radioGain = ctx.createGain();
      this.radioGain.gain.value = 0;
      this.radioBus.connect(hp); hp.connect(lp); lp.connect(this.radioGain); this.radioGain.connect(this.master);
      this.radioGain.connect(this.reverbSend);
      this.flutter = ctx.createGain(); this.flutter.gain.value = 9;
      var fl = ctx.createOscillator(); fl.frequency.value = 5.5; fl.connect(this.flutter); fl.start();
      this.wow = ctx.createGain(); this.wow.gain.value = 14;
      var wo = ctx.createOscillator(); wo.frequency.value = 0.4; wo.connect(this.wow); wo.start();

      // Canal B: estática.
      this.staticNoise = this._loop(this.white, [['highpass', 450, 0.7]], 0);
      // Canal C: infrasonido 26–32 Hz.
      this.infra = ctx.createGain();
      this.infra.gain.value = 0;
      this.infra.connect(this.master);
      this.infraOsc = ctx.createOscillator();
      this.infraOsc.frequency.value = 29;
      var sweep = ctx.createOscillator(); sweep.frequency.value = 0.05;
      var sweepGain = ctx.createGain(); sweepGain.gain.value = 3;
      sweep.connect(sweepGain); sweepGain.connect(this.infraOsc.frequency); sweep.start();
      this.infraOsc.connect(this.infra); this.infraOsc.start();

      this.nextBeat = ctx.currentTime + 0.3;
    }

    _loop(buffer, filters, gain) {
      var ctx = this.ctx;
      var src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.loopStart = Math.random() * 0.5;
      var node = src;
      filters.forEach(function (f) {
        var b = ctx.createBiquadFilter();
        b.type = f[0]; b.frequency.value = f[1]; b.Q.value = f[2];
        node.connect(b); node = b;
      });
      var g = ctx.createGain();
      g.gain.value = gain;
      node.connect(g);
      g.connect(this.master);
      src.start();
      return { gain: g, out: g };
    }

    _lfo(freq, depth, param) {
      var o = this.ctx.createOscillator();
      o.frequency.value = freq;
      var g = this.ctx.createGain();
      g.gain.value = depth;
      o.connect(g); g.connect(param); o.start();
    }

    _set(param, value, tau) {
      if (!this.ctx) { return; }
      param.setTargetAtTime(value, this.ctx.currentTime, tau || 0.15);
    }

    setVolume(v) { this.volume = v; if (this.ctx) { this._set(this.master.gain, v, 0.05); } }
    pause() { if (this.ctx) { this.ctx.suspend(); } if (window.speechSynthesis) { window.speechSynthesis.pause(); } }
    resume() { if (this.ctx) { this.ctx.resume(); } if (window.speechSynthesis) { window.speechSynthesis.resume(); } }
    stopAll(fadeSeconds) {
      if (window.speechSynthesis) { window.speechSynthesis.cancel(); }
      this.ringing = false;
      if (this.ctx) { this._set(this.master.gain, 0, (fadeSeconds || 1.2) / 3); }
    }

    /** Estado continuo por cuadro. */
    update(s) {
      if (!this.ctx) { return; }
      var washerLevel = Math.min(1, s.washers / 3);
      // Afuera (bosque): la lavandería se oye ahogada tras los muros; la lluvia y el viento, de frente.
      var out = s.outdoor || 0;
      var walls = 1 - 0.85 * Math.max(out, (s.muffled || 0) * 0.8); // bosque o pasillo de servicio
      this._set(this.washers.gain.gain, (0.03 + washerLevel * 0.12) * walls);
      this._set(this.dryers.gain.gain, Math.min(1, s.dryers / 2) * 0.05 * walls);
      this._set(this.rain.gain.gain, s.clearSky ? 0.012 : 0.05 + out * 0.13, 0.6);
      this._set(this.wind.gain.gain, 0.05 + out * 0.07, 0.6);
      var prox = s.collapse ? 0 : s.radioProximity;
      // Modo mezcla: la radio del juego se calla para que suene tu música desde otra app.
      this._set(this.radioGain.gain, s.mixMode ? 0 : prox * 0.22 * walls);
      this._set(this.reverbSend.gain, (s.high || 0) * 0.55, 0.6);
      // La estática solo se esconde si estás sintonizado en alguna estación (94.1 o tu 99.9).
      var tuned = Math.max(prox, s.musicProximity || 0);
      this._set(this.staticNoise.gain.gain, (1 - tuned) * (s.collapse ? 0.08 : 0.045));
      this._set(this.infra.gain, (1 - washerLevel) * (0.18 + s.dread * 0.5));
      this._set(this.hum.gain, 0.012 * s.lightLevel * walls);
      this._set(this.muffle.frequency, s.eyesClosed ? 700 : 18000, 0.05);
      this._set(this.pad.gain, 0.03 + s.dread * 0.04);
      this._scheduleMusic(prox);
      this._scheduleRing();
    }

    _scheduleMusic(prox) {
      var ctx = this.ctx;
      var beatLen = 60 / 49; // 70 BPM ralentizado un 30 %
      while (this.nextBeat < ctx.currentTime + 0.25) {
        var t = this.nextBeat;
        var bar = Math.floor(this.beat / 4) % CHORDS.length;
        var inBar = this.beat % 4;
        if (prox > 0.02) {
          if (inBar === 0 || inBar === 2) { CHORDS[bar].forEach(function (n) { this._note(MIDI(n), t, beatLen * 1.6, 0.05, 'triangle'); }, this); }
          this._note(MIDI(BASS[bar] + (inBar === 3 ? 7 : 0)), t, beatLen * 0.9, 0.12, 'sine');
          if (Math.random() < 0.45) { this._note(MIDI(MR.Util.pick(SCALE) + 12), t + beatLen * 0.5, beatLen * 0.6, 0.04, 'square'); }
        }
        this.beat += 1;
        this.nextBeat += beatLen;
      }
    }

    _note(freq, t, dur, vol, type) {
      var ctx = this.ctx;
      var o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      this.flutter.connect(o.detune);
      this.wow.connect(o.detune);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
      o.connect(g); g.connect(this.radioBus);
      o.start(t); o.stop(t + dur + 0.05);
      var self = this;
      o.onended = function () { try { self.flutter.disconnect(o.detune); self.wow.disconnect(o.detune); } catch (e) { /* ya desconectado */ } };
    }

    _burst(buffer, filterType, freq, q, dur, vol, pan) {
      var ctx = this.ctx;
      if (!ctx) { return null; }
      var t = ctx.currentTime;
      var src = ctx.createBufferSource();
      src.buffer = buffer;
      var f = ctx.createBiquadFilter();
      f.type = filterType; f.frequency.value = freq; f.Q.value = q;
      var g = ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
      var p = ctx.createStereoPanner();
      p.pan.value = pan || 0;
      src.connect(f); f.connect(g); g.connect(p); p.connect(this.master);
      src.start(t, Math.random()); src.stop(t + dur + 0.05);
      return f;
    }

    _tone(freq, dur, vol, type, endFreq) {
      var ctx = this.ctx;
      if (!ctx) { return; }
      var t = ctx.currentTime;
      var o = ctx.createOscillator();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (endFreq) { o.frequency.exponentialRampToValueAtTime(endFreq, t + dur); }
      var g = ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.05);
    }

    // ---- Efectos táctiles ----
    click() { this._tone(1900, 0.018, 0.09, 'square'); this._burst(this.white, 'highpass', 3000, 0.7, 0.02, 0.05); }
    coin() { this._tone(2400, 0.25, 0.08); var self = this; setTimeout(function () { self._tone(3150, 0.3, 0.06); }, 70); }
    /** Paso: baldosa (adentro) o tierra mojada (bosque: más grave y con un chapoteo). */
    step(pan, surface) {
      if (surface === 'tierra') {
        this._burst(this.brown, 'lowpass', 240, 0.8, 0.13, 0.3, pan);
        this._burst(this.white, 'bandpass', 1300, 1.6, 0.07, 0.05, pan);
        return;
      }
      this._burst(this.brown, 'lowpass', 180, 0.8, 0.09, 0.35, pan);
    }
    /** Trueno: retumbo largo (y un chasquido si cayó cerca). Adentro, ahogado por los muros. */
    trueno(vol, muffled) {
      var v = Math.min(1, vol);
      this._burst(this.brown, 'lowpass', muffled ? 80 : 120, 0.7, 3.8, 0.7 * v);
      this._burst(this.brown, 'lowpass', muffled ? 60 : 90, 0.6, 5.0, 0.45 * v);
      if (v > 0.85 && !muffled) { this._burst(this.white, 'lowpass', 1600, 0.6, 0.6, 0.35 * v); }
    }
    thud() { this._tone(70, 0.5, 0.35, 'sine', 40); this._burst(this.brown, 'lowpass', 120, 0.8, 0.4, 0.5); }
    drip(pan) { this._tone(1500, 0.12, 0.05, 'sine', 600); }
    mop() { this._burst(this.pink, 'bandpass', 900, 1.2, 0.35, 0.12, 0); }
    buzz() { this._tone(118, 0.25, 0.06, 'sawtooth'); }
    door() { this._tone(160, 0.9, 0.05, 'sawtooth', 90); this._burst(this.brown, 'lowpass', 300, 0.7, 0.5, 0.25); }
    /** Gato: maullido (tono que sube y baja con un filtro que imita la boca). */
    miau(pan) {
      var ctx = this.ctx;
      if (!ctx) { return; }
      var t = ctx.currentTime;
      var o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(470, t);
      o.frequency.linearRampToValueAtTime(720, t + 0.18);
      o.frequency.linearRampToValueAtTime(520, t + 0.5);
      var f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.Q.value = 5;
      f.frequency.setValueAtTime(900, t);
      f.frequency.linearRampToValueAtTime(1700, t + 0.2);
      f.frequency.linearRampToValueAtTime(1000, t + 0.5);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09, t + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.55);
      var p = ctx.createStereoPanner();
      p.pan.value = pan || 0;
      o.connect(f); f.connect(g); g.connect(p); p.connect(this.master);
      o.start(t); o.stop(t + 0.6);
    }
    /** Gato: ronroneo (retumbo grave pulsando a ~26 Hz). */
    ronroneo() {
      var ctx = this.ctx;
      if (!ctx) { return; }
      var t = ctx.currentTime;
      var src = ctx.createBufferSource();
      src.buffer = this.brown;
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 220;
      var am = ctx.createGain();
      am.gain.value = 0;
      var lfo = ctx.createOscillator();
      lfo.frequency.value = 26;
      var depth = ctx.createGain();
      depth.gain.value = 0.5;
      lfo.connect(depth); depth.connect(am.gain);
      var env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(0.5, t + 0.3);
      env.gain.setValueAtTime(0.5, t + 2.2);
      env.gain.exponentialRampToValueAtTime(0.0005, t + 2.9);
      src.connect(f); f.connect(am); am.connect(env); env.connect(this.master);
      src.start(t); lfo.start(t); src.stop(t + 3); lfo.stop(t + 3);
    }
    /** Gato: bufido (siseo agudo), con paneo: te dice de qué lado está lo que lo asustó. */
    bufido(pan) {
      this._burst(this.white, 'highpass', 2600, 0.7, 0.75, 0.22, pan);
      this._burst(this.white, 'bandpass', 4200, 1.2, 0.5, 0.1, pan);
    }
    /** Pasillo: una gota que cae en el charco. */
    gota(pan) {
      var ctx = this.ctx;
      if (!ctx) { return; }
      var t = ctx.currentTime;
      var o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(1500 + Math.random() * 500, t);
      o.frequency.exponentialRampToValueAtTime(520, t + 0.09);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.06, t);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.16);
      var p = ctx.createStereoPanner();
      p.pan.value = pan || 0;
      o.connect(g); g.connect(p); p.connect(this.master);
      o.start(t); o.stop(t + 0.2);
    }
    /** Logro: la campanita de fin de ciclo de una secadora. */
    ding() {
      this._tone(1046, 0.5, 0.05, 'sine');
      var self = this;
      setTimeout(function () { self._tone(1568, 0.7, 0.04, 'sine'); }, 160);
    }
    /** Bosque: una rama que cruje (dos chasquidos secos), con paneo. */
    rama(pan) {
      this._burst(this.white, 'bandpass', 1900, 2.2, 0.08, 0.32, pan);
      var self = this;
      setTimeout(function () { self._burst(self.white, 'bandpass', 1300, 2.0, 0.14, 0.26, pan); }, 90 + Math.random() * 120);
    }
    /** Bosque: un búho lejano (dos ululatos). */
    buho() {
      this._tone(410, 0.34, 0.035, 'sine', 370);
      var self = this;
      setTimeout(function () { self._tone(400, 0.5, 0.03, 'sine', 350); }, 520);
    }
    lint() { this._burst(this.white, 'bandpass', 2500, 0.6, 0.2, 0.06); }

    // ---- Consumibles ----
    lighter() {
      this._tone(2600, 0.03, 0.08, 'square');
      this._burst(this.white, 'highpass', 4000, 0.7, 0.06, 0.12);
      var self = this;
      setTimeout(function () { self._burst(self.pink, 'bandpass', 1800, 0.8, 0.5, 0.06); }, 90);
    }
    inhale() {
      var f = this._burst(this.pink, 'bandpass', 500, 1.5, 1.2, 0.08);
      if (f && this.ctx) { f.frequency.linearRampToValueAtTime(1400, this.ctx.currentTime + 1.0); }
      this._burst(this.white, 'highpass', 5000, 0.7, 0.9, 0.015);
    }
    exhale() {
      var f = this._burst(this.pink, 'bandpass', 1300, 1.0, 1.4, 0.07);
      if (f && this.ctx) { f.frequency.linearRampToValueAtTime(400, this.ctx.currentTime + 1.3); }
    }
    unscrew() {
      var self = this;
      [0, 110, 220].forEach(function (ms) {
        setTimeout(function () { self._tone(3400 - ms * 3, 0.025, 0.05, 'square'); self._burst(self.white, 'bandpass', 5200, 3, 0.03, 0.05); }, ms);
      });
    }
    sip() { this._tone(180, 0.35, 0.12, 'sine', 120); this._burst(this.brown, 'lowpass', 400, 1, 0.3, 0.2); }

    /** Paso del Cliente Inmóvil: sordo, grave y pesado. */
    heavyStep(vol) {
      var v = vol === undefined ? 1 : vol;
      this._tone(52, 0.45, 0.42 * v, 'sine', 34);
      this._burst(this.brown, 'lowpass', 110, 0.9, 0.35, 0.6 * v);
    }
    heavySteps(n, gapMs) {
      var self = this;
      for (var i = 0; i < n; i += 1) {
        (function (k) { setTimeout(function () { self.heavyStep(0.75 + k * 0.12); }, k * (gapMs || 520)); })(i);
      }
    }
    printer() {
      var ctx = this.ctx;
      if (!ctx) { return; }
      var t = ctx.currentTime;
      var o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 880;
      var am = ctx.createOscillator(); am.frequency.value = 31;
      var amg = ctx.createGain(); amg.gain.value = 0.03;
      var g = ctx.createGain(); g.gain.value = 0.03;
      am.connect(amg); amg.connect(g.gain);
      o.connect(g); g.connect(this.master);
      o.start(t); am.start(t); o.stop(t + 1.8); am.stop(t + 1.8);
    }

    /** Susurro procedural (formantes que barren), con paneo. */
    whisper(pan) {
      if (!this.ctx) { return; }
      var t = this.ctx.currentTime;
      [[700, 1300], [1600, 2600]].forEach(function (band) {
        var f = this._burst(this.white, 'bandpass', band[0], 7, 1.7, 0.16, pan);
        if (f) { f.frequency.linearRampToValueAtTime(band[1], t + 1.2); }
      }, this);
    }

    setRinging(on) {
      this.ringing = on;
      if (on && this.ctx) { this.nextRing = this.ctx.currentTime; }
    }

    _scheduleRing() {
      if (!this.ringing || this.nextRing > this.ctx.currentTime + 0.1) { return; }
      var ctx = this.ctx;
      var t = Math.max(this.nextRing, ctx.currentTime);
      [440, 480].forEach(function (f) {
        var o = ctx.createOscillator(); o.frequency.value = f;
        var g = ctx.createGain();
        var trem = ctx.createOscillator(); trem.frequency.value = 20;
        var tg = ctx.createGain(); tg.gain.value = 0.025;
        trem.connect(tg); tg.connect(g.gain);
        g.gain.value = 0.03;
        o.connect(g); g.connect(this.master);
        o.start(t); trem.start(t); o.stop(t + 2); trem.stop(t + 2);
      }, this);
      this.nextRing = t + 6;
    }

    /** Voz sintetizada opcional. role: 'cliente' | 'locutor' | 'telefono' | 'susurro'. */
    speak(text, role) {
      if (!this.voices || !window.speechSynthesis) { return; }
      var u = new SpeechSynthesisUtterance(text);
      var voices = window.speechSynthesis.getVoices().filter(function (v) { return /^es/i.test(v.lang); });
      if (voices.length) { u.voice = voices[0]; u.lang = voices[0].lang; } else { u.lang = 'es-MX'; }
      var conf = { cliente: [0.55, 0.78, 0.9], locutor: [0.9, 0.92, 0.55], telefono: [0.4, 0.8, 0.45], susurro: [0.2, 0.7, 0.25] }[role] ||
        [1, 1, 0.8];
      u.pitch = conf[0];
      u.rate = conf[1];
      u.volume = conf[2] * this.volume;
      window.speechSynthesis.speak(u);
    }
  }

  MR.AudioEngine = AudioEngine;
})(window.MR = window.MR || {});
