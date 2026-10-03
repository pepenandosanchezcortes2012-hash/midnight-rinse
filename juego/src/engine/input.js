/**
 * Entrada: teclado, ratón con bloqueo de puntero y bordes de pulsación (pressed/released por cuadro).
 * Los gestos táctiles (touch.js) escriben en los mismos campos más los canales analógicos:
 * moveX/moveY (joystick invisible), touchLookDX/DY (mirada), dragDX (perillas), aimNdc (punto tocado)
 * y actions (gestos de un cuadro: 'blink', 'cigarro', 'petaca', 'pausa').
 */
(function (MR) {
  'use strict';

  class Input {
    constructor(element) {
      this.element = element;
      this.keys = new Set();
      this.pressed = new Set();
      this.released = new Set();
      this.mouseDX = 0;
      this.mouseDY = 0;
      this.buttons = 0;
      this.buttonPressed = false;
      this.buttonReleased = false;
      this.locked = false;
      this.onUnlock = null;
      this.touchMode = false;
      this.moveX = 0;
      this.moveY = 0;
      this.touchLookDX = 0;
      this.touchLookDY = 0;
      this.dragDX = 0;
      this.aimNdc = null;
      this.tapNudge = false;
      this.actions = new Set();
      var self = this;

      window.addEventListener('keydown', function (e) {
        if (!self.keys.has(e.code)) { self.pressed.add(e.code); }
        self.keys.add(e.code);
        if (self.locked && ['Space', 'ArrowUp', 'ArrowDown'].indexOf(e.code) >= 0) { e.preventDefault(); }
      });
      window.addEventListener('keyup', function (e) {
        self.keys.delete(e.code);
        self.released.add(e.code);
      });
      window.addEventListener('mousemove', function (e) {
        if (!self.locked) { return; }
        self.mouseDX += e.movementX || 0;
        self.mouseDY += e.movementY || 0;
      });
      window.addEventListener('mousedown', function (e) {
        if (!self.locked || e.button !== 0) { return; }
        self.buttons = 1;
        self.buttonPressed = true;
      });
      window.addEventListener('mouseup', function (e) {
        if (e.button !== 0) { return; }
        if (self.buttons) { self.buttonReleased = true; }
        self.buttons = 0;
      });
      document.addEventListener('pointerlockchange', function () {
        var wasLocked = self.locked;
        self.locked = document.pointerLockElement === self.element;
        if (wasLocked && !self.locked) {
          self.buttons = 0;
          self.keys.clear();
          if (self.onUnlock) { self.onUnlock(); }
        }
      });
    }

    lock() {
      if (!this.element.requestPointerLock) { return; }
      var r = this.element.requestPointerLock();
      if (r && r.catch) { r.catch(function () { /* el navegador puede negarlo sin gesto; se reintenta con clic */ }); }
    }

    unlock() { if (document.pointerLockElement) { document.exitPointerLock(); } }

    down(code) { return this.keys.has(code); }
    hit(code) { return this.pressed.has(code); }

    /** Llamar al final de cada cuadro. */
    endFrame() {
      this.pressed.clear();
      this.released.clear();
      this.mouseDX = 0;
      this.mouseDY = 0;
      this.buttonPressed = false;
      this.buttonReleased = false;
      this.touchLookDX = 0;
      this.touchLookDY = 0;
      this.dragDX = 0;
      this.tapNudge = false;
      this.actions.clear();
      if (!this.buttons) { this.aimNdc = null; }
    }

    /** Gesto de un cuadro (tecla o toque). */
    action(name) { return this.actions.has(name); }
  }

  MR.Input = Input;
})(window.MR = window.MR || {});
