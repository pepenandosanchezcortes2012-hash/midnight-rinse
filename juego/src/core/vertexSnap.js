/**
 * Vertex snapping estilo PS1 (port de midnight_rinse_core/vertex_snap.py).
 * nx = floor(ndc_x * vres[0] + EPS); x' = nx / vres[0] * w (igual para y); z y w no cambian.
 * El shader de los materiales retro aplica exactamente esta fórmula por vértice (ver engine/retro.js).
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  else { root.MR = root.MR || {}; Object.assign(root.MR, api); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var EPS = 1e-9;
  var NDC_LIMIT = 1e6;

  function valueError(message) {
    var error = new Error(message);
    error.name = 'ValueError';
    return error;
  }

  function finite(value, name) {
    if (typeof value !== 'number' || !Number.isFinite(value)) { throw valueError(name + ' debe ser un número finito'); }
    return value;
  }

  /** Ajusta (x, y) de un vértice en espacio de recorte [x, y, z, w] a la cuadrícula vres. */
  function snap(clip, vres) {
    if (vres === undefined) { vres = [320, 240]; }
    if (!Array.isArray(clip) || clip.length !== 4) { throw valueError('clip debe tener 4 números'); }
    if (!Array.isArray(vres) || vres.length !== 2) { throw valueError('vres debe tener 2 enteros'); }
    var x = finite(clip[0], 'x');
    var y = finite(clip[1], 'y');
    finite(clip[2], 'z');
    var w = finite(clip[3], 'w');
    if (w <= 0) { throw valueError('w debe ser mayor que 0'); }
    var vx = vres[0];
    var vy = vres[1];
    if (!Number.isInteger(vx) || !Number.isInteger(vy) || vx <= 0 || vy <= 0) {
      throw valueError('vres debe tener 2 enteros mayores que 0');
    }
    var ndcX = x / w;
    var ndcY = y / w;
    if (!Number.isFinite(ndcX) || !Number.isFinite(ndcY) || Math.abs(ndcX) > NDC_LIMIT || Math.abs(ndcY) > NDC_LIMIT) {
      throw valueError('ndc no finito o con valor absoluto mayor que 1e6');
    }
    var nx = Math.floor(ndcX * vx + EPS);
    var ny = Math.floor(ndcY * vy + EPS);
    return [nx / vx * w, ny / vy * w, clip[2], clip[3]];
  }

  return { snap: snap, SNAP_EPS: EPS };
});
