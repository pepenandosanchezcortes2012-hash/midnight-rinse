/** Arranque: crea el juego cuando el documento está listo. Expone window.midnightRinse para depurar. */
(function (MR) {
  'use strict';

  function boot() {
    try {
      window.midnightRinse = new MR.Game();
    } catch (error) {
      var box = document.getElementById('subtitulos');
      box.textContent = 'No se pudo iniciar el juego: ' + error.message + '\n¿Tu navegador tiene WebGL activado?';
      throw error;
    }
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); } else { boot(); }
})(window.MR = window.MR || {});
