/**
 * Controles móviles Zero-HUD: gestos invisibles, vibración y micro-balanceo por giroscopio.
 *
 *  - Mitad izquierda: joystick dinámico invisible (el centro es donde apoyas el pulgar).
 *  - Mitad derecha: arrastre libre para mover la cabeza.
 *  - Tap directo sobre un objeto: interactuar con ESE objeto. El rayo sale del punto tocado, no del centro.
 *    Mantener el dedo sobre una perilla y arrastrar la gira; un tap rápido la avanza un retén.
 *  - Doble tap rápido en el vacío: parpadeo instantáneo.
 *  - Dos dedos deslizando hacia abajo: frotar los lentes justo donde pasan los dedos.
 *  - Esquina inferior derecha: deslizar hacia arriba = cigarro; en diagonal (arriba-izquierda) = petaca.
 *  - Tres dedos: pausa.
 */
(function (MR) {
  'use strict';

  var TAP_MS = 230;
  var TAP_PX = 14;
  var DOUBLE_TAP_MS = 320;
  var DOUBLE_TAP_PX = 60;
  var JOY_RADIUS = 70;
  var JOY_DEADZONE = 8;

  /** Vibración nativa (navigator.vibrate). En navegadores sin soporte (iOS Safari) no hace nada. */
  MR.Haptics = {
    enabled: true,
    supported: typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function',
    pulse: function (pattern) {
      if (!this.enabled || !this.supported) { return; }
      try { navigator.vibrate(pattern); } catch (e) { /* el navegador puede rechazarla sin gesto previo */ }
    }
  };

  /** ¿El puntero principal es táctil (teléfono, tableta)? Las laptops híbridas se detectan al primer toque. */
  MR.isTouchDevice = function () {
    return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  };

  class TouchControls {
    constructor(game) {
      this.game = game;
      this.input = game.input;
      this.joy = null;
      this.look = null;
      this.act = null;
      this.corner = null;
      this.two = null;
      this.lastTap = null;
      this.wipe = { active: false, points: [] };
      var el = document.getElementById('escenario');
      var opts = { passive: false };
      el.addEventListener('touchstart', this._start.bind(this), opts);
      el.addEventListener('touchmove', this._move.bind(this), opts);
      el.addEventListener('touchend', this._end.bind(this), opts);
      el.addEventListener('touchcancel', this._end.bind(this), opts);
    }

    _playing() { return this.game.state === 'playing'; }

    _ndc(x, y) {
      var r = this.game.canvas.getBoundingClientRect();
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) { return null; }
      return new THREE.Vector2((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    }

    _uv(x, y) {
      var r = this.game.canvas.getBoundingClientRect();
      return { u: MR.Util.clamp((x - r.left) / r.width, 0, 1), v: MR.Util.clamp(1 - (y - r.top) / r.height, 0, 1) };
    }

    _inCorner(x, y) {
      var el = document.getElementById('consumibles');
      if (!el) { return false; }
      var r = el.getBoundingClientRect();
      var pad = 36;
      return r.width > 0 && x >= r.left - pad && y >= r.top - pad;
    }

    _start(e) {
      e.preventDefault();
      this.input.touchMode = true;
      this.game.onTouchActivity();
      if (!this._playing()) { return; }
      if (e.touches.length >= 3) {
        this.input.actions.add('pausa');
        return;
      }
      var now = performance.now();
      var fresh = [];
      for (var c = 0; c < e.changedTouches.length; c += 1) {
        var ct = e.changedTouches[c];
        var fp = { id: ct.identifier, x: ct.clientX, y: ct.clientY, x0: ct.clientX, y0: ct.clientY, t0: now };
        if (!this.corner && this._inCorner(fp.x, fp.y)) { this.corner = fp; } else { fresh.push(fp); }
      }
      // Dos dedos que se apoyan casi a la vez (en cualquier mitad): frotar los lentes.
      var existing = [this.joy, this.look, this.act].filter(Boolean);
      if (!this.two && existing.length + fresh.length === 2 && (existing.length === 0 || now - existing[0].t0 < 200)) {
        var pair = existing.concat(fresh);
        if (this.act) { this._releaseAct(false); }
        this.joy = null;
        this.look = null;
        this.input.moveX = 0;
        this.input.moveY = 0;
        this.two = { a: pair[0], b: pair[1], started: false };
        return;
      }
      for (var i = 0; i < fresh.length; i += 1) {
        var p = fresh[i];
        if (p.x < window.innerWidth / 2 && !this.joy) {
          this.joy = p;
          continue;
        }
        if (this.act || this.look) { continue; }
        var ndc = this._ndc(p.x, p.y);
        var target = ndc ? this.game.gameplay.targetAt(this.game.player.camera, ndc) : null;
        if (target) {
          p.target = target;
          this.act = p;
          this.input.aimNdc = ndc;
          this.input.buttonPressed = true;
          this.input.buttons = 1;
        } else {
          this.look = p;
        }
      }
    }

    _find(id) {
      var slots = ['joy', 'look', 'act', 'corner'];
      for (var i = 0; i < slots.length; i += 1) {
        if (this[slots[i]] && this[slots[i]].id === id) { return slots[i]; }
      }
      if (this.two && (this.two.a.id === id || this.two.b.id === id)) { return 'two'; }
      return null;
    }

    _move(e) {
      e.preventDefault();
      if (!this._playing()) { return; }
      for (var i = 0; i < e.changedTouches.length; i += 1) {
        var t = e.changedTouches[i];
        var slot = this._find(t.identifier);
        if (!slot) { continue; }
        if (slot === 'two') {
          var f = this.two.a.id === t.identifier ? this.two.a : this.two.b;
          f.x = t.clientX; f.y = t.clientY;
          this._updateTwo();
          continue;
        }
        var p = this[slot];
        var dx = t.clientX - p.x;
        var dy = t.clientY - p.y;
        p.x = t.clientX;
        p.y = t.clientY;
        if (slot === 'joy') {
          var vx = p.x - p.x0;
          var vy = p.y - p.y0;
          var len = Math.hypot(vx, vy);
          if (len < JOY_DEADZONE) { this.input.moveX = 0; this.input.moveY = 0; } else {
            var k = Math.min(1, (len - JOY_DEADZONE) / (JOY_RADIUS - JOY_DEADZONE)) / len;
            this.input.moveX = vx * k;
            this.input.moveY = vy * k;
          }
        } else if (slot === 'look') {
          this.input.touchLookDX += dx;
          this.input.touchLookDY += dy;
        } else if (slot === 'act') {
          this.input.dragDX += dx;
        }
      }
    }

    _updateTwo() {
      var a = this.two.a;
      var b = this.two.b;
      var dyA = a.y - a.y0;
      var dyB = b.y - b.y0;
      if (!this.two.started && dyA > 16 && dyB > 16) { this.two.started = true; }
      if (this.two.started) {
        this.wipe.active = true;
        this.wipe.points = [this._uv(a.x, a.y), this._uv(b.x, b.y)];
      }
    }

    _isTap(p, now) {
      return now - p.t0 < TAP_MS && Math.hypot(p.x - p.x0, p.y - p.y0) < TAP_PX;
    }

    _releaseAct(tap) {
      this.input.buttons = 0;
      this.input.buttonReleased = true;
      if (tap) { this.input.tapNudge = true; }
      this.act = null;
    }

    _end(e) {
      e.preventDefault();
      var now = performance.now();
      for (var i = 0; i < e.changedTouches.length; i += 1) {
        var t = e.changedTouches[i];
        var slot = this._find(t.identifier);
        if (!slot) { continue; }
        if (slot === 'two') {
          this.two = null;
          this.wipe.active = false;
          this.wipe.points = [];
          continue;
        }
        var p = this[slot];
        p.x = t.clientX;
        p.y = t.clientY;
        if (slot === 'corner') {
          this._cornerSwipe(p);
          this.corner = null;
        } else if (slot === 'joy') {
          this.joy = null;
          this.input.moveX = 0;
          this.input.moveY = 0;
          if (this._isTap(p, now)) { this._tap(p, now); }
        } else if (slot === 'look') {
          this.look = null;
          if (this._isTap(p, now)) { this._tap(p, now); }
        } else if (slot === 'act') {
          var tap = this._isTap(p, now);
          this._releaseAct(tap);
          this.lastTap = { time: now, x: p.x, y: p.y, hit: true };
        }
      }
    }

    /** Tap en la mitad izquierda o en el vacío: interactúa si toca un objeto; dos seguidos en el vacío = parpadeo. */
    _tap(p, now) {
      if (!this._playing()) { return; }
      var ndc = this._ndc(p.x, p.y);
      var target = ndc ? this.game.gameplay.targetAt(this.game.player.camera, ndc) : null;
      if (target) {
        this.input.aimNdc = ndc;
        this.input.buttonPressed = true;
        this.input.tapNudge = true;
        this.lastTap = { time: now, x: p.x, y: p.y, hit: true };
        return;
      }
      var last = this.lastTap;
      if (last && !last.hit && now - last.time < DOUBLE_TAP_MS && Math.hypot(p.x - last.x, p.y - last.y) < DOUBLE_TAP_PX) {
        this.input.actions.add('blink');
        this.lastTap = null;
      } else {
        this.lastTap = { time: now, x: p.x, y: p.y, hit: false };
      }
    }

    _cornerSwipe(p) {
      var dx = p.x - p.x0;
      var dy = p.y - p.y0;
      if (dy < -40 && Math.abs(dx) < 30) { this.input.actions.add('cigarro'); }
      else if (dx < -40 && Math.abs(dy) < 25) { this.input.actions.add('porro'); }
      else if (dy < -25 && dx < -25) { this.input.actions.add('petaca'); }
    }

    reset() {
      this.joy = this.look = this.act = this.corner = this.two = null;
      this.input.moveX = 0;
      this.input.moveY = 0;
      this.input.buttons = 0;
      this.wipe.active = false;
      this.wipe.points = [];
    }
  }

  /**
   * Micro-balanceo por giroscopio: filtro paso-alto sobre la orientación del teléfono (la línea base sigue
   * lentamente a la postura), de modo que solo los movimientos leves se notan, como mirar con tus propios ojos.
   */
  class Tilt {
    constructor() {
      this.enabled = false;
      this.base = null;
      this.yaw = 0;
      this.pitch = 0;
      this.targetYaw = 0;
      this.targetPitch = 0;
      this._handler = this._onOrientation.bind(this);
    }

    /** Debe llamarse dentro de un gesto del usuario (iOS pide permiso). */
    start() {
      var self = this;
      if (typeof window.DeviceOrientationEvent === 'undefined') { return Promise.resolve(false); }
      var ask = window.DeviceOrientationEvent.requestPermission;
      var permission = typeof ask === 'function' ? ask.call(window.DeviceOrientationEvent) : Promise.resolve('granted');
      return permission.then(function (state) {
        if (state === 'granted' && !self.enabled) {
          window.addEventListener('deviceorientation', self._handler);
          self.enabled = true;
        }
        return self.enabled;
      }).catch(function () { return false; });
    }

    stop() {
      window.removeEventListener('deviceorientation', this._handler);
      this.enabled = false;
      this.targetYaw = this.targetPitch = 0;
    }

    _onOrientation(e) {
      if (e.beta === null || e.gamma === null || e.beta === undefined) { return; }
      var angle = (window.screen.orientation && window.screen.orientation.angle) || window.orientation || 0;
      var pitchSrc;
      var yawSrc;
      if (angle === 90) { pitchSrc = -e.gamma; yawSrc = e.beta; }
      else if (angle === -90 || angle === 270) { pitchSrc = e.gamma; yawSrc = -e.beta; }
      else { pitchSrc = e.beta; yawSrc = e.gamma; }
      if (!this.base) { this.base = { p: pitchSrc, y: yawSrc }; }
      this.base.p += (pitchSrc - this.base.p) * 0.03;
      this.base.y += (yawSrc - this.base.y) * 0.03;
      this.targetPitch = MR.Util.clamp((pitchSrc - this.base.p) * 0.006, -0.06, 0.06);
      this.targetYaw = MR.Util.clamp(-(yawSrc - this.base.y) * 0.006, -0.07, 0.07);
    }

    update(dt) {
      var k = Math.min(1, dt * 6);
      this.yaw += (this.targetYaw - this.yaw) * k;
      this.pitch += (this.targetPitch - this.pitch) * k;
    }
  }

  MR.TouchControls = TouchControls;
  MR.Tilt = Tilt;
})(window.MR = window.MR || {});
