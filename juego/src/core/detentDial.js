/**
 * Perilla con retenes (port de midnight_rinse_core/detent_dial.py).
 * Emite {type: 'click', angle} al cruzar múltiplos de detent_deg; histéresis para no vibrar sobre un retén.
 * Se replica el módulo flotante de Python (resultado con el signo del divisor) para que el port sea exacto.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  else { root.MR = root.MR || {}; Object.assign(root.MR, api); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAX_EFFECTIVE = 1e6;

  function valueError(message) {
    var error = new Error(message);
    error.name = 'ValueError';
    return error;
  }

  function number(value, name) {
    if (typeof value !== 'number' || !Number.isFinite(value)) { throw valueError(name + ' debe ser un número finito'); }
    return value;
  }

  /** x % y con la semántica de Python para flotantes (el resultado toma el signo del divisor). */
  function pyMod(x, y) {
    var m = x % y;
    if (m !== 0 && (y < 0) !== (m < 0)) { m += y; }
    else if (m === 0) { m = 0; }
    return m;
  }

  function intMod(j, n) { return ((j % n) + n) % n; }

  class DetentDial {
    constructor(detentDeg, resistance, hysteresisDeg) {
      if (detentDeg === undefined) { detentDeg = 15.0; }
      if (resistance === undefined) { resistance = 0.5; }
      if (hysteresisDeg === undefined) { hysteresisDeg = 3.0; }
      var detent = number(detentDeg, 'detent_deg');
      if (detent <= 0) { throw valueError('detent_deg debe ser mayor que 0'); }
      var ratio = 360.0 / detent;
      var count = Math.round(ratio);
      if (count < 1 || Math.abs(ratio - count) > 1e-9) { throw valueError('360 / detent_deg debe ser un entero'); }
      var res = number(resistance, 'resistance');
      if (!(res >= 0 && res < 1)) { throw valueError('resistance debe estar en [0, 1)'); }
      var hyst = number(hysteresisDeg, 'hysteresis_deg');
      if (!(hyst >= 0 && hyst < detent / 2)) { throw valueError('hysteresis_deg debe estar en [0, detent_deg / 2)'); }
      this._detent = detent;
      this._count = count;
      this._factor = 1.0 - res;
      this._hysteresis = hyst;
      this._raw = 0.0;
      this._disarmed = new Set();
    }

    /** Ángulo normalizado en [0, 360). */
    get angle() {
      var a = pyMod(this._raw, 360.0);
      return a >= 360.0 ? 0.0 : a;
    }

    /** Gira la perilla y devuelve los clicks de los retenes cruzados, en orden de recorrido. */
    drag(deltaDeg) {
      var delta = number(deltaDeg, 'delta_deg');
      var effective = delta * this._factor;
      if (Math.abs(effective) > MAX_EFFECTIVE) { throw valueError('el movimiento efectivo supera 1e6 grados'); }
      var d = this._detent;
      var aPrev = this._raw;
      var aNew = aPrev + effective;
      var clicks = [];
      var seen = new Set();
      var self = this;

      function cross(j) {
        var k = intMod(j, self._count);
        if (seen.has(k) || !self._disarmed.has(k)) {
          var angle = pyMod(j * d, 360.0);
          clicks.push({ type: 'click', angle: angle >= 360.0 ? 0.0 : angle });
          self._disarmed.add(k);
        }
        seen.add(k);
      }

      var j;
      if (effective > 0) {
        j = Math.floor(aPrev / d);
        while (j * d <= aPrev) { j += 1; }
        while ((j - 1) * d > aPrev) { j -= 1; }
        while (j * d <= aNew) { cross(j); j += 1; }
      } else if (effective < 0) {
        j = Math.ceil(aPrev / d);
        while (j * d >= aPrev) { j -= 1; }
        while ((j + 1) * d < aPrev) { j += 1; }
        while (j * d >= aNew) { cross(j); j -= 1; }
      }
      this._raw = aNew;
      var final = this.angle;
      var disarmed = Array.from(this._disarmed);
      for (var i = 0; i < disarmed.length; i += 1) {
        var k = disarmed[i];
        var diff = Math.abs(final - pyMod(k * d, 360.0));
        if (Math.min(diff, 360.0 - diff) >= this._hysteresis) { this._disarmed.delete(k); }
      }
      return clicks;
    }
  }

  return { DetentDial: DetentDial };
});
