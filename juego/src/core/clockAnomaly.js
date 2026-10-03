/**
 * Anomalía del reloj (port de midnight_rinse_core/clock_anomaly.py).
 * anomalyMultiplier: 3.0 de 02:00:00 (incluido) a 05:00:00 (excluido); 1.0 fuera.
 * whispersActive: true de 03:00:00 (incluido) a 04:00:00 (excluido).
 * Se usa la hora local tal como viene, sin convertir zonas. Acepta un Date (hora local del sistema, para la
 * capa meta-diegética) o una HoraLocal (reloj del juego). Cualquier otra cosa: TypeError.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  else { root.MR = root.MR || {}; Object.assign(root.MR, api); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Hora local sin zona: el reloj del juego. */
  class HoraLocal {
    constructor(hour, minute, second, micro) {
      this.hour = hour;
      this.minute = minute || 0;
      this.second = second || 0;
      this.micro = micro || 0;
    }
  }

  function hourOf(now) {
    if (now instanceof HoraLocal) { return now.hour; }
    if (now instanceof Date && !Number.isNaN(now.getTime())) { return now.getHours(); }
    throw new TypeError('now debe ser una HoraLocal o un Date válido');
  }

  function anomalyMultiplier(now) {
    var hour = hourOf(now);
    return hour >= 2 && hour < 5 ? 3.0 : 1.0;
  }

  function whispersActive(now) {
    return hourOf(now) === 3;
  }

  return { HoraLocal: HoraLocal, anomalyMultiplier: anomalyMultiplier, whispersActive: whispersActive };
});
