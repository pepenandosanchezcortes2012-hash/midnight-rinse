/**
 * Blind-Spot Dispatcher (port de midnight_rinse_core/blind_spot_dispatcher.py).
 * El horror solo ocurre fuera del campo de visión (visibility === 0) o durante un parpadeo.
 * Orden de disparo: mayor prioridad primero; en empate, el programado antes.
 * Origen: campeón de Gemini G002 (cubetas por prioridad, programar es O(1)).
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

  function checkVisibility(visibility) {
    if (typeof visibility !== 'number' || !Number.isFinite(visibility) || visibility < 0 || visibility > 1) {
      throw valueError('visibility debe ser un número finito en [0, 1]');
    }
    return visibility;
  }

  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  class Dispatcher {
    constructor() {
      this._ids = new Set();
      this._buckets = new Map();
    }

    /** Programa un evento. ValueError si los tipos no son válidos o si el id ya está pendiente. */
    schedule(eventId, payload, priority) {
      if (priority === undefined) { priority = 0; }
      if (typeof eventId !== 'string' || eventId.length === 0) { throw valueError('event_id debe ser un string no vacío'); }
      if (!isPlainObject(payload)) { throw valueError('payload debe ser un objeto'); }
      if (typeof priority !== 'number' || !Number.isInteger(priority)) { throw valueError('priority debe ser entero'); }
      if (this._ids.has(eventId)) { throw valueError('el evento ' + eventId + ' ya está pendiente'); }
      this._ids.add(eventId);
      var bucket = this._buckets.get(priority);
      if (!bucket) { bucket = []; this._buckets.set(priority, bucket); }
      bucket.push({ event_id: eventId, payload: payload });
    }

    /** Si visibility === 0 o blink, dispara y consume todos los pendientes; si no, devuelve []. */
    tick(visibility, blink) {
      if (blink === undefined) { blink = false; }
      var level = checkVisibility(visibility);
      if (typeof blink !== 'boolean') { throw valueError('blink debe ser booleano'); }
      if (level !== 0 && !blink) { return []; }
      if (this._ids.size === 0) { return []; }
      var buckets = this._buckets;
      this._buckets = new Map();
      this._ids = new Set();
      var priorities = Array.from(buckets.keys()).sort(function (a, b) { return b - a; });
      var fired = [];
      for (var i = 0; i < priorities.length; i += 1) {
        var bucket = buckets.get(priorities[i]);
        for (var k = 0; k < bucket.length; k += 1) { fired.push(bucket[k]); }
      }
      return fired;
    }

    /** Número de eventos que siguen en cola. */
    pending() {
      return this._ids.size;
    }
  }

  return { Dispatcher: Dispatcher };
});
