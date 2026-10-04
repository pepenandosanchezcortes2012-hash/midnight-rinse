/** Arranque: crea el juego cuando el documento está listo. Expone window.midnightRinse para depurar. */
(function (MR) {
  'use strict';

  function boot() {
    try {
      MR.I18N.translateDom(); // inglés: el HTML se traduce antes de que el juego lo use
      window.midnightRinse = new MR.Game();
    } catch (error) {
      var box = document.getElementById('subtitulos');
      box.textContent = MR.tf('No se pudo iniciar el juego: {e}', { e: error.message }) + '\n' + MR.t('¿Tu navegador tiene WebGL activado?');
      throw error;
    }
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); } else { boot(); }

  // App instalable y sin conexión (solo por https o localhost; no dentro del marco de pruebas).
  if ('serviceWorker' in navigator && window.isSecureContext && window.top === window) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* sin modo sin conexión; se juega igual */ });
    });
  }

  // Botón «Instalar en el teléfono»: Chrome/Android avisa con beforeinstallprompt; iPhone necesita instrucciones.
  var installEvent = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    installEvent = e;
    var b = document.getElementById('btn-instalar');
    if (b) { b.hidden = false; }
  });
  function setupInstall() {
    var b = document.getElementById('btn-instalar');
    var note = document.getElementById('nota-instalar');
    if (!b) { return; }
    var standalone = window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || window.navigator.standalone;
    var ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    if (!standalone && ios && note) {
      note.hidden = false; // Safari no tiene botón de instalar: se hace desde Compartir.
    }
    b.addEventListener('click', function () {
      if (!installEvent) { return; }
      installEvent.prompt();
      installEvent.userChoice.then(function () { installEvent = null; b.hidden = true; });
    });
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', setupInstall); } else { setupInstall(); }
})(window.MR = window.MR || {});
