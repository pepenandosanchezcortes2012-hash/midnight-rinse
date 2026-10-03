/**
 * Manos a pasos (port de midnight_rinse_core/stepped_hands.py): retención de orden cero.
 * slot = floor(t * hold_hz + 1e-9); solo se captura otra pose cuando cambia el slot. A 60 FPS y 15 Hz,
 * cada pose dura exactamente 4 cuadros. Devuelve el MISMO objeto retenido (sin copiar).
 * Nota de port: en JavaScript 15.0 es un entero, así que hold_hz solo exige Number.isInteger.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  else { root.MR = root.MR || {}; Object.assign(root.MR, api); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function valueError(message) {
    var error = new Error(message);
    error.name = 'ValueError';
    return error;
  }

  class SteppedHold {
    constructor(holdHz) {
      if (holdHz === undefined) { holdHz = 15; }
      if (typeof holdHz !== 'number' || !Number.isInteger(holdHz) || holdHz < 1) {
        throw valueError('hold_hz debe ser un entero mayor o igual que 1');
      }
      this._hz = holdHz;
      this._lastT = null;
      this._slot = null;
      this._pose = undefined;
    }

    /** Muestrea en el tiempo t (no decreciente) y devuelve la pose retenida. */
    sample(t, pose) {
      if (typeof t !== 'number' || !Number.isFinite(t) || t < 0) { throw valueError('t debe ser un número finito >= 0'); }
      var scaled = t * this._hz;
      if (!Number.isFinite(scaled)) { throw valueError('t * hold_hz no es finito'); }
      if (this._lastT !== null && t < this._lastT) { throw valueError('t no puede retroceder'); }
      var slot = Math.floor(scaled + 1e-9);
      if (this._slot === null || slot !== this._slot) {
        this._slot = slot;
        this._pose = pose;
      }
      this._lastT = t;
      return this._pose;
    }
  }

  return { SteppedHold: SteppedHold };
});
