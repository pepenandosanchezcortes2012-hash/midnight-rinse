/**
 * Control de consola (Gamepad API, mapeo estándar: Xbox, PlayStation, Switch Pro, genéricos).
 * Escribe en los mismos canales que el teclado, el ratón y los gestos (MR.Input), así que todo lo demás
 * funciona igual. También navega los menús (pantalla de título, pausa, guía, confirmaciones) y hace vibrar el
 * control con los mismos patrones que el celular.
 *
 *   Stick izq.: caminar · Stick der.: mirar · A: usar (mantener: fregar, perillas con el stick der.)
 *   B: parpadear · X (mantener): limpiar lentes con el stick der. · Cruceta ↑ ← →: cigarro, porro, petaca
 *   Con una pregunta abierta: cruceta ◀ ▲ ▶ = respuestas 1 2 3 · Start: pausa · View/Select: guía
 *   Menús: cruceta o stick para moverte, A elegir, B volver, ◀ ▶ en los deslizadores.
 */
(function (MR) {
  'use strict';

  var DEAD = 0.18;
  var LOOK_SPEED = 2.6; // rad/s con el stick a fondo
  var BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
  var SCREENS = ['visor', 'reiniciar', 'guia', 'final', 'pausa', 'titulo']; // de arriba hacia abajo

  function $(id) { return document.getElementById(id); }

  function dead(v) {
    var a = Math.abs(v || 0);
    if (a < DEAD) { return 0; }
    return Math.sign(v) * (a - DEAD) / (1 - DEAD);
  }

  function visible(el) { return !!(el && el.getClientRects().length) && !el.closest('[hidden]'); }

  class GamepadControls {
    constructor(game) {
      this.game = game;
      this.index = null;
      this.prev = [];
      this.heldA = false;
      this.wiping = false;
      this.focusEl = null;
      this.navCooldown = 0;
      var self = this;
      window.addEventListener('gamepadconnected', function (e) { self._connect(e.gamepad); });
      window.addEventListener('gamepaddisconnected', function (e) {
        if (e.gamepad.index === self.index) { self.index = null; document.body.classList.remove('mando'); }
      });
      // La vibración del celular también se manda al control.
      var orig = MR.Haptics.pulse;
      MR.Haptics.pulse = function (pattern) { orig.call(MR.Haptics, pattern); self.rumble(pattern); };
    }

    _connect(gp) {
      this.index = gp.index;
      document.body.classList.add('mando');
      var name = String(gp.id || 'control').replace(/\s*\(.*$/, '').slice(0, 40);
      this.game.ui.subtitle(MR.tf('(Control conectado: {n}.)', { n: name }), 3);
    }

    pad() {
      if (this.index === null || !navigator.getGamepads) { return null; }
      return navigator.getGamepads()[this.index] || null;
    }

    rumble(pattern) {
      if (!MR.Haptics.enabled) { return; }
      var gp = this.pad();
      if (!gp || !gp.vibrationActuator || !gp.vibrationActuator.playEffect) { return; }
      var on = Array.isArray(pattern) ? pattern.reduce(function (s, v, i) { return i % 2 === 0 ? s + v : s; }, 0) : pattern;
      var p = gp.vibrationActuator.playEffect('dual-rumble', {
        duration: Math.min(450, on + 30), strongMagnitude: Math.min(1, on / 160), weakMagnitude: 0.5
      });
      if (p && p.catch) { p.catch(function () {}); }
    }

    /** Pantalla de menú visible (la de más arriba), o null si se está jugando sin menús. */
    _screen() {
      for (var i = 0; i < SCREENS.length; i += 1) {
        var el = $(SCREENS[i]);
        if (el && !el.hidden) { return el; }
      }
      return null;
    }

    /** Cada cuadro, ANTES de update(): traduce el control a los canales de MR.Input. */
    poll(dt) {
      var gp = this.pad();
      if (!gp) { return; }
      var btn = gp.buttons.map(function (b) { return !!(b && (b.pressed || b.value > 0.5)); });
      var prev = this.prev;
      var hit = function (i) { return btn[i] && !prev[i]; };
      var g = this.game;
      var input = g.input;
      var screen = this._screen();

      if (screen) {
        this._menu(screen, gp, btn, hit, dt);
      } else if (g.noteOpen) {
        if (hit(BTN.A) || hit(BTN.B)) { g.closeNote(); }
      } else if (g.state === 'playing') {
        this._play(gp, btn, hit, dt);
      }
      if (!screen && this.focusEl) { this.focusEl.classList.remove('foco-mando'); this.focusEl = null; }
      this.prev = btn;
    }

    _play(gp, btn, hit, dt) {
      var g = this.game;
      var input = g.input;
      // Caminar (si no se está usando el joystick táctil).
      if (!g.touch.joy) {
        input.moveX = dead(gp.axes[0]);
        input.moveY = dead(gp.axes[1]);
      }
      // Mirar (curva cuadrática: precisión cerca del centro). Mientras se gira una perilla o se limpian los
      // lentes, el stick derecho mueve eso en vez de la cabeza.
      var lx = dead(gp.axes[2]);
      var ly = dead(gp.axes[3]);
      var k = LOOK_SPEED * dt / (0.0048 * g.options.sensitivity);
      var holdingSomething = this.heldA || btn[BTN.X];
      if (!holdingSomething) {
        input.touchLookDX += Math.sign(lx) * lx * lx * k;
        input.touchLookDY += Math.sign(ly) * ly * ly * k;
      } else {
        input.dragDX += lx * 900 * dt;   // perillas
        input.mouseDX += lx * 700 * dt;  // cepillo de los lentes
        input.mouseDY += ly * 700 * dt;
      }
      // A: usar / mantener.
      if (hit(BTN.A)) { input.buttonPressed = true; this.heldA = true; }
      if (this.heldA) {
        input.buttons = 1;
        if (!btn[BTN.A]) { this.heldA = false; input.buttons = 0; input.buttonReleased = true; }
      }
      // X mantenido: limpiar lentes (igual que mantener E).
      if (btn[BTN.X] && !this.wiping) { this.wiping = true; input.keys.add('KeyE'); }
      if (!btn[BTN.X] && this.wiping) { this.wiping = false; input.keys.delete('KeyE'); }
      if (hit(BTN.B)) { input.actions.add('blink'); }
      // Cruceta: respuestas (si alguien te habla) o consumibles.
      if (g.question || g.dialog) {
        if (hit(BTN.LEFT)) { input.pressed.add('Digit1'); }
        if (hit(BTN.UP)) { input.pressed.add('Digit2'); }
        if (hit(BTN.RIGHT)) { input.pressed.add('Digit3'); }
        if (hit(BTN.DOWN)) { input.pressed.add('Digit4'); }
      } else {
        if (hit(BTN.UP)) { input.actions.add('cigarro'); }
        if (hit(BTN.LEFT)) { input.actions.add('porro'); }
        if (hit(BTN.RIGHT)) { input.actions.add('petaca'); }
      }
      if (hit(BTN.Y)) { input.actions.add('foto'); }
      if (hit(BTN.START)) { input.actions.add('pausa'); }
      if (hit(BTN.BACK)) { input.pressed.add('KeyH'); }
    }

    /** Menús: mover el foco entre los controles visibles, A = elegir, B = volver. */
    _menu(screen, gp, btn, hit, dt) {
      var g = this.game;
      var items = Array.prototype.filter.call(
        screen.querySelectorAll('button, summary, input[type="checkbox"], input[type="range"]'), visible);
      if (!items.length) { return; }
      var idx = items.indexOf(this.focusEl);
      var y = dead(gp.axes[1]);
      var x = dead(gp.axes[0]);
      this.navCooldown -= dt;
      var dir = 0;
      if (hit(BTN.DOWN)) { dir = 1; } else if (hit(BTN.UP)) { dir = -1; }
      else if (this.navCooldown <= 0 && Math.abs(y) > 0.6) { dir = y > 0 ? 1 : -1; this.navCooldown = 0.22; }
      if (idx < 0) { idx = 0; this._focus(items[0]); }
      if (dir) { idx = (idx + dir + items.length) % items.length; this._focus(items[idx]); }
      var el = items[idx];
      // Deslizadores: ◀ ▶ los mueven.
      if (el && el.type === 'range') {
        var side = hit(BTN.RIGHT) ? 1 : (hit(BTN.LEFT) ? -1 : 0);
        if (!side && this.navCooldown <= 0 && Math.abs(x) > 0.6) { side = x > 0 ? 1 : -1; this.navCooldown = 0.15; }
        if (side) {
          var stepv = parseFloat(el.step) || 0.1;
          el.value = String(Math.min(parseFloat(el.max), Math.max(parseFloat(el.min), parseFloat(el.value) + side * stepv)));
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
      if (hit(BTN.A) && el) { el.click(); }
      if (hit(BTN.B)) {
        if (screen.id === 'visor') { g.ui.showVisor(null); }
        else if (screen.id === 'guia') { g.ui.showGuide(false); }
        else if (screen.id === 'reiniciar') { g.ui.showReset(false); }
        else if (screen.id === 'pausa') { g.resume(); }
      }
      if (hit(BTN.START)) {
        if (screen.id === 'titulo') { $('btn-comenzar').click(); }
        else if (screen.id === 'pausa') { g.resume(); }
      }
      if (hit(BTN.BACK) && (screen.id === 'titulo' || screen.id === 'pausa')) { g.ui.showGuide(true); }
    }

    _focus(el) {
      if (this.focusEl) { this.focusEl.classList.remove('foco-mando'); }
      this.focusEl = el;
      el.classList.add('foco-mando');
      el.focus({ preventScroll: true });
      el.scrollIntoView({ block: 'nearest' });
    }
  }

  MR.GamepadControls = GamepadControls;
})(window.MR = window.MR || {});
