/**
 * Dithering Bayer 8x8 a RGB555 (port de midnight_rinse_core/bayer_rgb555.py).
 * umbral = (M[y % 8][x % 8] + 0.5) / 64; nivel = floor(c * 31 + umbral) limitado a 0..31; salida = nivel / 31.
 * La misma fórmula se usa en el shader de postproceso (ver engine/retro.js).
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  else { root.MR = root.MR || {}; Object.assign(root.MR, api); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var BAYER8 = [
    [0, 32, 8, 40, 2, 34, 10, 42],
    [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38],
    [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41],
    [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37],
    [63, 31, 55, 23, 61, 29, 53, 21]
  ];

  function valueError(message) {
    var error = new Error(message);
    error.name = 'ValueError';
    return error;
  }

  function mod8(n) { return ((n % 8) + 8) % 8; }

  function channel(value, threshold) {
    if (typeof value !== 'number') { throw valueError('cada canal debe ser numérico'); }
    if (Number.isNaN(value)) { throw valueError('NaN no es un canal válido'); }
    if (value <= 0) { return 0; }
    if (value >= 1) { return 1; }
    var level = Math.floor(value * 31 + threshold);
    if (level < 0) { level = 0; }
    if (level > 31) { level = 31; }
    return level / 31;
  }

  /** Cuantiza un color [r, g, b] a 32 niveles por canal con el umbral Bayer del píxel (x, y). */
  function quantize(rgb, x, y) {
    if (!Number.isInteger(x) || !Number.isInteger(y)) { throw valueError('x e y deben ser enteros'); }
    if (!Array.isArray(rgb) || rgb.length !== 3) { throw valueError('rgb debe tener exactamente 3 elementos'); }
    var threshold = (BAYER8[mod8(y)][mod8(x)] + 0.5) / 64;
    return [channel(rgb[0], threshold), channel(rgb[1], threshold), channel(rgb[2], threshold)];
  }

  return { quantize: quantize, BAYER8: BAYER8 };
});
