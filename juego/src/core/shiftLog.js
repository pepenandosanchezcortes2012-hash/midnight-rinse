/**
 * Bitácora del turno (port de midnight_rinse_core/shift_log.py).
 * El registro avanza de fase y nunca retrocede; persiste entre partidas (capa meta-diegética).
 * En el navegador el "archivo" es una entrada de localStorage con exactamente texto + "\n"; contenido ajeno
 * o ausente equivale a la fase "ninguna". JavaScript es de un solo hilo: la escritura es atómica por naturaleza.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  else { root.MR = root.MR || {}; Object.assign(root.MR, api); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PHASES = ['start', 'customer_talked', 'collapse'];
  var TEXTS = {
    start: 'Turno asignado sin incidencias. Recuerde fregar el pasillo central cada 45 minutos.',
    customer_talked: 'Turno asignado. NO lo mires directamente a la cara. Si te pregunta la hora, ' +
      'dile que faltan cinco minutos para las seis.',
    collapse: '¿Por qué sigues limpiando si sabes que el agua nunca va a volver a ser clara?'
  };
  var DEFAULT_KEY = 'midnight-rinse/records/shift_log.txt';

  function valueError(message) {
    var error = new Error(message);
    error.name = 'ValueError';
    return error;
  }

  /** Almacenamiento en memoria con la interfaz de localStorage (para pruebas o si localStorage falla). */
  class MemoryStorage {
    constructor() { this._data = new Map(); }
    getItem(key) { return this._data.has(key) ? this._data.get(key) : null; }
    setItem(key, value) { this._data.set(key, String(value)); }
    removeItem(key) { this._data.delete(key); }
  }

  function phaseOf(stored) {
    for (var i = 0; i < PHASES.length; i += 1) {
      if (stored === TEXTS[PHASES[i]] + '\n') { return PHASES[i]; }
    }
    return null;
  }

  class ShiftLog {
    constructor(storage, key) {
      this._storage = storage || new MemoryStorage();
      this._key = key || DEFAULT_KEY;
    }

    _read() {
      try { return this._storage.getItem(this._key); } catch (e) { return null; }
    }

    /** Fase vigente en el registro, o null si no hay ninguna. */
    currentPhase() { return phaseOf(this._read()); }

    /** Texto vigente sin salto de línea, o null. */
    currentText() {
      var phase = this.currentPhase();
      return phase ? TEXTS[phase] : null;
    }

    /** Avanza a `phase` si es posterior a la actual; devuelve el texto de la fase vigente (sin salto de línea). */
    update(phase) {
      if (typeof phase !== 'string' || PHASES.indexOf(phase) < 0) { throw valueError('fase no válida: ' + String(phase)); }
      var current = this.currentPhase();
      if (current !== null && PHASES.indexOf(phase) <= PHASES.indexOf(current)) { return TEXTS[current]; }
      this._storage.setItem(this._key, TEXTS[phase] + '\n');
      return TEXTS[phase];
    }

    /** Borra el registro (opción explícita del menú: "Borrar registro del turno"). */
    reset() {
      try { this._storage.removeItem(this._key); } catch (e) { /* almacenamiento no disponible */ }
    }
  }

  return { ShiftLog: ShiftLog, MemoryStorage: MemoryStorage, PHASES: PHASES, TEXTS: TEXTS };
});
