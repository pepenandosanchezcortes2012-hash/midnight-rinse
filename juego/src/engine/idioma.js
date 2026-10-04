/**
 * Idioma: español (original) o inglés.
 * - El texto en español es la clave: MR.t('texto') devuelve la traducción si el idioma es inglés y existe.
 * - Textos con datos: MR.tf('Hojas del registro: {n} de 6.', { n: 3 }) (la plantilla también se traduce).
 * - Se traduce en los puntos de salida (subtítulos, hojas, menús, paneles, voces) y el HTML una vez al cargar.
 *   Un párrafo con etiquetas de formato (<b>, <span class="tecla">…) se traduce entero, con sus etiquetas.
 * - Idioma: ?lang=es|en, la opción guardada o, si no hay, el del navegador (español si empieza con «es»).
 * - En inglés, lo que no tiene traducción queda en MR.I18N.missing (la prueba de idioma lo revisa).
 */
(function (MR) {
  'use strict';

  var INLINE = /^(B|I|EM|STRONG|SPAN|BR|KBD|SMALL)$/;
  var LETTERS = /[A-Za-zÁÉÍÓÚáéíóúñÑ]/;

  function detect() {
    var q = (location.search.match(/[?&]lang=(es|en)/) || [])[1];
    if (q) { return q; }
    try {
      var o = JSON.parse(window.localStorage.getItem('midnight-rinse/opciones') || '{}');
      if (o.lang === 'es' || o.lang === 'en') { return o.lang; }
    } catch (e) { /* sin almacenamiento */ }
    return /^es/i.test(navigator.language || 'es') ? 'es' : 'en';
  }

  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  /** ¿Se traduce como una unidad (texto con etiquetas de formato dentro)? */
  function isUnit(el) {
    var text = false;
    var inline = false;
    for (var n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3) { if (LETTERS.test(n.nodeValue)) { text = true; } }
      else if (n.nodeType === 1) {
        if (!INLINE.test(n.nodeName) || n.querySelector('input,select,button,textarea')) { return false; }
        inline = true;
      }
    }
    return text && inline;
  }

  var I = {
    lang: detect(),
    missing: {},
    done: {}, // textos que ya salieron traducidos (para no buscarlos otra vez en las salidas)

    /** Traducción exacta (respeta espacios al principio y al final). */
    t: function (s) {
      if (I.lang === 'es' || s === null || s === undefined || s === '') { return s; }
      var key = String(s);
      if (has(I.done, key)) { return key; }
      var dict = MR.TEXTOS_EN || {};
      var out = null;
      if (has(dict, key)) { out = dict[key]; }
      else {
        var trimmed = key.trim();
        if (!LETTERS.test(trimmed)) { return s; }
        if (has(dict, trimmed)) { out = key.replace(trimmed, dict[trimmed]); }
        else { I.missing[trimmed] = (I.missing[trimmed] || 0) + 1; return s; }
      }
      I.done[out] = true;
      return out;
    },

    /** Plantilla con datos: la plantilla se traduce y luego se rellenan {claves}. */
    tf: function (tpl, vars) {
      var out = String(I.t(tpl)).replace(/\{(\w+)\}/g, function (m, k) {
        return vars && vars[k] !== undefined ? vars[k] : m;
      });
      if (I.lang !== 'es') { I.done[out] = true; }
      return out;
    },

    /** Une partes que ya vienen traducidas (para que la salida no las busque como un texto nuevo). */
    cat: function () {
      var out = Array.prototype.join.call(arguments, '');
      if (I.lang !== 'es') { I.done[out] = true; }
      return out;
    },

    /** Traduce el HTML estático: párrafos con formato enteros, el resto nodo por nodo, y los atributos visibles. */
    translateDom: function (root) {
      if (I.lang === 'es') { return; }
      document.documentElement.lang = I.lang;
      document.title = I.t(document.title);
      (function walk(el) {
        if (el.getAttribute && el.getAttribute('translate') === 'no') { return; }
        if (/^(SCRIPT|STYLE)$/.test(el.nodeName)) { return; }
        ['placeholder', 'title', 'aria-label'].forEach(function (a) {
          var v = el.getAttribute && el.getAttribute(a);
          if (v) { el.setAttribute(a, I.t(v)); }
        });
        if (el.nodeType === 1 && isUnit(el)) {
          var key = el.innerHTML.replace(/\s+/g, ' ').trim();
          var tr = I.t(key);
          if (tr !== key) { el.innerHTML = tr; }
          return;
        }
        for (var n = el.firstChild; n; n = n.nextSibling) {
          if (n.nodeType === 3) {
            var v = n.nodeValue;
            if (LETTERS.test(v)) { n.nodeValue = I.t(v.replace(/\s+/g, ' ')); }
          } else if (n.nodeType === 1) { walk(n); }
        }
      })(root || document.body);
    },

    /** Cambia de idioma: se guarda en las opciones y la página se recarga. */
    set: function (lang) {
      try {
        var o = JSON.parse(window.localStorage.getItem('midnight-rinse/opciones') || '{}');
        o.lang = lang;
        window.localStorage.setItem('midnight-rinse/opciones', JSON.stringify(o));
      } catch (e) { /* sin almacenamiento: solo por la URL */ }
      var url = location.href.replace(/([?&])lang=(es|en)&?/, '$1').replace(/[?&]$/, '');
      location.href = url + (url.indexOf('?') < 0 ? '?' : '&') + 'lang=' + lang;
    },

    /** Hora dicha en voz alta en el idioma actual. */
    spokenTime: function (minutes) {
      if (I.lang === 'es') { return MR.Util.spokenTime(minutes); }
      var words = ['twelve', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven'];
      var h = Math.floor(minutes / 60) % 12;
      var m = Math.floor(minutes % 60);
      if (m === 0) { return words[h] + " o'clock"; }
      return words[h] + ' ' + (m < 10 ? 'oh ' + m : m);
    }
  };

  MR.I18N = I;
  MR.t = I.t;
  MR.tf = I.tf;
})(window.MR = window.MR || {});
