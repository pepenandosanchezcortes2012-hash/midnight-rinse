/**
 * Pruebas de partida: cargan el juego real (index.html) en un iframe y lo juegan paso a paso.
 * Se corren desde pruebas.html (en local o en GitHub Pages). Respaldan y restauran el localStorage del juego.
 * Cada prueba avanza la simulación con g.update(1/30) para no depender de la velocidad de la máquina.
 */
(function () {
  'use strict';

  var PREFIX = 'midnight-rinse/';
  var marco = document.getElementById('marco');
  var lista = document.getElementById('lista');
  var resumen = document.getElementById('resumen');

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function check(cond, msg) { if (!cond) { throw new Error(msg); } }

  function backup() {
    var saved = {};
    for (var i = 0; i < localStorage.length; i += 1) {
      var k = localStorage.key(i);
      if (k.indexOf(PREFIX) === 0) { saved[k] = localStorage.getItem(k); }
    }
    return saved;
  }

  function restore(saved) {
    var mine = [];
    for (var i = 0; i < localStorage.length; i += 1) {
      var k = localStorage.key(i);
      if (k.indexOf(PREFIX) === 0) { mine.push(k); }
    }
    mine.forEach(function (k) { localStorage.removeItem(k); });
    Object.keys(saved).forEach(function (k) { localStorage.setItem(k, saved[k]); });
  }

  /** Carga el juego en el iframe y espera a que arranque. Devuelve {w, g, errors}. */
  function load(query) {
    return new Promise(function (resolve, reject) {
      var errors = [];
      marco.onload = function () {
        var w = marco.contentWindow;
        w.addEventListener('error', function (e) { errors.push(e.message + ' @' + String(e.filename).split('/').pop().split('?')[0] + ':' + e.lineno); });
        var t0 = Date.now();
        (function poll() {
          if (w.midnightRinse) { resolve({ w: w, g: w.midnightRinse, errors: errors }); return; }
          if (Date.now() - t0 > 8000) {
            var sub = w.document.getElementById('subtitulos');
            reject(new Error('el juego no arrancó: ' + (sub ? sub.textContent : '¿sin DOM?')));
            return;
          }
          setTimeout(poll, 50);
        })();
      };
      marco.src = 'index.html' + (query || '') + ((query || '').indexOf('?') >= 0 ? '&' : '?') + 'prueba=' + Date.now();
    });
  }

  function step(ctx, n) {
    var g = ctx.g;
    for (var i = 0; i < n; i += 1) { g.update(1 / 30); g.input.endFrame(); }
  }

  function start(ctx) {
    ctx.w.document.getElementById('btn-comenzar').click();
    step(ctx, 2);
    check(ctx.g.state === 'playing', 'no empezó el turno (estado ' + ctx.g.state + ')');
  }

  function noErrors(ctx) { check(ctx.errors.length === 0, 'errores: ' + ctx.errors.slice(0, 3).join(' | ')); }

  /** Píxeles del lienzo con alfa < 255 (huecos por los que se ve la tele). */
  function holes(ctx) {
    var g = ctx.g;
    g.retro.render(g.world.scene, g.player.camera, { blink: 0, dread: 0, time: 0, flash: 0, collapse: 0, high: 0 });
    var gl = g.retro.renderer.getContext();
    var w = gl.drawingBufferWidth;
    var h = gl.drawingBufferHeight;
    var px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    var n = 0;
    for (var i = 3; i < px.length; i += 4) { if (px[i] < 255) { n += 1; } }
    return n;
  }

  var tests = [
    ['El juego arranca sin errores', async function () {
      var ctx = await load();
      check(ctx.g.state === 'title', 'estado inicial ' + ctx.g.state);
      ['Tele', 'Bosque', 'MusicLink', 'Consumables', 'TouchControls'].forEach(function (k) { check(ctx.w.MR[k], 'falta MR.' + k); });
      noErrors(ctx);
      return 'título listo; ' + ctx.g.world.forest.trees + ' pinos en el bosque';
    }],

    ['El lienzo es opaco (sin huecos falsos)', async function () {
      var ctx = await load();
      start(ctx);
      ctx.g.player.pos.set(6, 0, 0);
      ctx.g.player.yaw = -Math.PI / 2;
      step(ctx, 2);
      var n = holes(ctx);
      check(n === 0, n + ' píxeles transparentes');
      noErrors(ctx);
      return '0 píxeles transparentes';
    }],

    ['Guía de controles: abre, cambia de pestaña y se cierra', async function () {
      var ctx = await load();
      var d = ctx.w.document;
      d.getElementById('btn-guia').click();
      check(!d.getElementById('guia').hidden, 'no abrió con el botón');
      d.getElementById('guia-tab-tactil').click();
      check(!d.getElementById('guia-tactil').hidden, 'no cambió a la pestaña táctil');
      ctx.w.dispatchEvent(new ctx.w.KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
      check(d.getElementById('guia').hidden, 'Esc no la cerró');
      ctx.w.dispatchEvent(new ctx.w.KeyboardEvent('keydown', { key: 'h', code: 'KeyH' }));
      check(!d.getElementById('guia').hidden, 'H no la abrió en el título');
      ctx.g.input.endFrame(); // en el juego real pasa un cuadro entre la tecla y el siguiente clic
      d.getElementById('btn-guia-cerrar').click();
      start(ctx);
      ctx.g.input.pressed.add('KeyH');
      step(ctx, 1);
      check(ctx.g.state === 'paused' && !d.getElementById('guia').hidden, 'H en partida no pausó y abrió la guía');
      noErrors(ctx);
      return 'botón, pestañas, Esc y H';
    }],

    ['Consumibles: cigarro, petaca y porro', async function () {
      var ctx = await load();
      start(ctx);
      var c = ctx.g.consumables;
      ctx.g.input.pressed.add('KeyC'); step(ctx, 1);
      check(c.smoke > 0, 'C no encendió el cigarro');
      step(ctx, 30 * 9);
      check(c.smoke === 0 && c.used.cigarros === 1, 'el cigarro no terminó');
      ctx.g.input.pressed.add('KeyF'); step(ctx, 1);
      check(c.drink > 0, 'F no abrió la petaca');
      step(ctx, 30 * 3);
      check(c.tipsy > 0, 'la petaca no mareó');
      ctx.g.input.pressed.add('KeyJ'); step(ctx, 1);
      check(c.joint > 0, 'J no encendió el porro');
      step(ctx, 30 * 11);
      check(c.high > 0.3 && c.timeScale() < 1, 'el porro no hizo efecto');
      noErrors(ctx);
      return 'colocado ' + c.high.toFixed(2) + ', tiempo ×' + c.timeScale().toFixed(2);
    }],

    ['Tele: lee enlaces de YouTube y YouTube Music', async function () {
      var ctx = await load();
      var p = ctx.w.MR.Tele.parseLink;
      var ok = [['https://music.youtube.com/watch?v=dQw4w9WgXcQ&si=a', 'dQw4w9WgXcQ', null],
        ['https://music.youtube.com/playlist?list=OLAK5uy_abcdefghijk', null, 'OLAK5uy_abcdefghijk'],
        ['https://youtu.be/dQw4w9WgXcQ', 'dQw4w9WgXcQ', null], ['youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ', null],
        ['dQw4w9WgXcQ', 'dQw4w9WgXcQ', null]];
      ok.forEach(function (c) { var r = p(c[0]); check(r.video === c[1] && r.list === c[2], 'mal leído: ' + c[0]); });
      ['https://music.youtube.com/playlist?list=LM', 'https://open.spotify.com/track/x', 'hola'].forEach(function (c) {
        check(p(c).error, 'debió rechazar: ' + c);
      });
      return ok.length + ' enlaces bien leídos, 3 rechazados';
    }],

    ['Bosque: salir, caminar, chocar y volver', async function () {
      var ctx = await load();
      start(ctx);
      var g = ctx.g;
      check(g.bosque.go(), 'no se pudo cruzar');
      step(ctx, 40);
      check(g.bosque.outside && g.player.pos.z > 100, 'no quedó afuera');
      g.input.keys.add('KeyW'); step(ctx, 120); g.input.keys.delete('KeyW');
      check(g.bosque.outside && g.player.pos.z > 105, 'caminar afuera falló (z = ' + g.player.pos.z.toFixed(1) + ')');
      g.player.pos.set(21, 0, 125); g.player.yaw = -Math.PI / 2; g.player.vel.set(0, 0, 0);
      g.input.keys.add('KeyW'); step(ctx, 60); g.input.keys.delete('KeyW');
      check(g.player.pos.x < 22.2 && g.player.pos.z > 100, 'se salió del bosque');
      g.player.pos.set(0.4, 0, 101.4); g.player.yaw = 0; step(ctx, 1);
      var cam = g.player.camera;
      var v = g.world.forest.doors[1].getWorldPosition(new ctx.w.THREE.Vector3()).project(cam);
      var t = g.gameplay.targetAt(cam, new ctx.w.THREE.Vector2(v.x, v.y));
      check(t && t.kind === 'entrarLavanderia', 'la puerta de la fachada no es tocable');
      g.gameplay._begin(t, g.input); step(ctx, 40);
      check(!g.bosque.outside && g.player.pos.z < 5, 'no volvió a entrar');
      g.input.keys.add('KeyW'); step(ctx, 30); g.input.keys.delete('KeyW');
      check(g.player.pos.z < 5 && g.player.pos.z > -5, 'adentro quedó fuera de la sala');
      noErrors(ctx);
      return 'afuera, sendero, bordes y regreso';
    }],

    ['Bosque: el Cliente Inmóvil te sigue', async function () {
      var ctx = await load();
      start(ctx);
      var g = ctx.g;
      var h = g.horror;
      h.placeCustomer('banco'); h.customer.present = true;
      g.bosque.go(); step(ctx, 40);
      h._scheduleKind('cliente_bosque');
      g.player.forceBlink();
      step(ctx, 20);
      check(/^bosque_/.test(h.customer.anchor || ''), 'no salió al bosque (ancla ' + h.customer.anchor + ')');
      noErrors(ctx);
      return 'en ' + h.customer.anchor + ' a ' + h.distanceToCustomer(g.player).toFixed(1) + ' m';
    }],

    ['Tormenta: lluvia visible afuera, relámpago y trueno', async function () {
      var ctx = await load();
      start(ctx);
      var g = ctx.g;
      check(!g.clima.mesh.visible, 'la lluvia se ve adentro');
      g.bosque.go(); step(ctx, 40);
      check(g.clima.mesh.visible, 'no llueve afuera');
      var thunder = 0;
      var orig = g.audio.trueno.bind(g.audio);
      g.audio.trueno = function (v, m) { thunder += 1; return orig(v, m); };
      var amb0 = g.retro.shared.uAmbient.value.x;
      g.clima.nextBolt = 0;
      step(ctx, 2);
      var peak = g.retro.shared.uAmbient.value.x;
      check(peak > amb0 + 0.2, 'el relámpago no iluminó el bosque (' + amb0.toFixed(2) + ' → ' + peak.toFixed(2) + ')');
      step(ctx, 30 * 5);
      check(thunder === 1, 'el trueno sonó ' + thunder + ' veces');
      check(Math.abs(g.retro.shared.uAmbient.value.x - amb0) < 0.01, 'la luz no volvió a la normalidad');
      // Con «Reducir destellos»: un solo resplandor suave.
      g.options.reduceFlashes = true;
      g.clima.bolt = null; g.clima.nextBolt = 0; step(ctx, 1);
      check(g.clima.bolt.flashes.length === 1 && g.clima.bolt.flashes[0][2] < 0.6, 'no respetó «Reducir destellos»');
      noErrors(ctx);
      return 'luz ambiente ' + amb0.toFixed(2) + ' → ' + peak.toFixed(2) + '; 1 trueno; modo suave OK';
    }],

    ['Control de consola (simulado): menús, sticks, botones y vibración', async function () {
      var ctx = await load();
      var g = ctx.g;
      var pad = { id: 'Control de prueba (STANDARD GAMEPAD)', index: 0, axes: [0, 0, 0, 0], buttons: [], rumbles: 0 };
      for (var b = 0; b < 17; b += 1) { pad.buttons.push({ pressed: false, value: 0 }); }
      pad.vibrationActuator = { playEffect: function () { pad.rumbles += 1; return Promise.resolve('complete'); } };
      Object.defineProperty(ctx.w.navigator, 'getGamepads', { configurable: true, value: function () { return [pad]; } });
      g.gamepad._connect(pad);
      check(ctx.w.document.body.classList.contains('mando'), 'no se marcó el control como conectado');
      function frame(n) { for (var i = 0; i < (n || 1); i += 1) { g.gamepad.poll(1 / 30); if (g.state === 'playing') { g.update(1 / 30); } g.input.endFrame(); } }
      function press(i) { pad.buttons[i].pressed = true; frame(1); pad.buttons[i].pressed = false; frame(1); }
      // Título: abajo mueve el foco; Start empieza el turno.
      press(13);
      check(ctx.w.document.querySelector('.foco-mando'), 'la cruceta no movió el foco en el menú');
      press(9);
      check(g.state === 'playing', 'Start no empezó el turno');
      // Caminar y mirar.
      g.player.pos.set(-0.5, 0, 1.5); // en medio de la sala, sin nada enfrente
      var x0 = g.player.pos.x;
      var z0 = g.player.pos.z;
      var yaw0 = g.player.yaw;
      pad.axes = [0, -1, 0.8, 0]; frame(45); pad.axes = [0, 0, 0, 0]; frame(1);
      var moved = Math.hypot(g.player.pos.x - x0, g.player.pos.z - z0);
      check(moved > 0.5, 'el stick izquierdo no movió al jugador (' + moved.toFixed(2) + ' m)');
      check(Math.abs(g.player.yaw - yaw0) > 0.3, 'el stick derecho no giró la cabeza');
      // Cruceta ↑: cigarro. B: parpadeo.
      press(12);
      check(g.consumables.smoke > 0, 'la cruceta ↑ no encendió el cigarro');
      var blinks = g.stats.parpadeos;
      press(1); frame(10);
      check(g.stats.parpadeos > blinks || g.player.blink.amount > 0, 'B no hizo parpadear');
      // Start: pausa; B: vuelve. View: guía.
      press(9);
      check(g.state === 'paused', 'Start no pausó');
      press(1);
      check(g.state === 'playing', 'B no reanudó desde la pausa');
      press(8);
      check(!ctx.w.document.getElementById('guia').hidden, 'View no abrió la guía');
      check(!ctx.w.document.getElementById('guia-mando').hidden, 'la guía no abrió en la pestaña del control');
      press(1);
      check(ctx.w.document.getElementById('guia').hidden, 'B no cerró la guía');
      // Vibración: el mismo golpe que el celular.
      g.ctx = null;
      ctx.w.MR.Haptics.enabled = true;
      ctx.w.MR.Haptics.pulse([20, 40, 20]);
      check(pad.rumbles > 0, 'el control no vibró');
      noErrors(ctx);
      return 'menú, Start, sticks, cruceta, B, pausa, guía y ' + pad.rumbles + ' vibraciones';
    }],

    ['Historia del bosque: seis hojas y el tercer final', async function () {
      var ctx = await load();
      start(ctx);
      var g = ctx.g;
      var d = ctx.w.document;
      g.bosque.go(); step(ctx, 40);
      // La primera hoja se puede tocar de verdad (rayo desde la cámara).
      g.player.pos.set(1.4, 0, 104.7); g.player.yaw = Math.PI; g.player.pitch = -1.0; step(ctx, 1);
      var cam = g.player.camera;
      var v = g.world.forest.pages[0].getWorldPosition(new ctx.w.THREE.Vector3()).project(cam);
      var t = g.gameplay.targetAt(cam, new ctx.w.THREE.Vector2(v.x, v.y));
      check(t && t.kind === 'paginaBosque' && t.index === 0, 'la hoja 1 no se puede tocar');
      g.gameplay._begin(t, g.input);
      check(g.noteOpen && /HOJA MOJADA/.test(d.querySelector('#nota .encabezado').textContent), 'no se leyó la hoja');
      g.closeNote();
      // Con menos de seis, la lavadora no abre; con las seis, tercer final.
      g.bosque.touchWasher();
      check(/1 de 6/.test(d.getElementById('subtitulos').textContent), 'la lavadora no dijo cuántas faltan');
      for (var i = 1; i < 6; i += 1) { g.bosque.takePage(i); g.closeNote(); }
      check(g.bosque.pagesFound() === 6, 'no se contaron las seis hojas');
      g.bosque.touchWasher();
      step(ctx, 30 * 4);
      check(g.state === 'ended', 'no terminó el turno');
      check(d.getElementById('final-titulo').textContent === ctx.w.MR.HISTORIA.final.titulo, 'no fue el tercer final');
      // El registro del mostrador vuelve a su encabezado normal.
      noErrors(ctx);
      return '6/6 hojas → «' + ctx.w.MR.HISTORIA.final.titulo + '»';
    }],

    ['Logros y opciones de vista', async function () {
      localStorage.removeItem('midnight-rinse/logros'); // las pruebas anteriores ya desbloquean algunos
      var ctx = await load();
      var g = ctx.g;
      var d = ctx.w.document;
      check(/^0\//.test(d.getElementById('logros-cuenta').textContent), 'los logros no empiezan en cero: ' + d.getElementById('logros-cuenta').textContent);
      check(d.querySelectorAll('#logros-lista li').length === ctx.w.MR.Logros.LIST.length, 'el panel no lista todos los logros');
      check(/\?\?\?/.test(d.getElementById('logros-lista').textContent), 'los ocultos no se ven como ???');
      // Opciones: campo de visión, invertir eje y subtítulos.
      var fov = d.getElementById('opt-fov');
      fov.value = '85'; fov.dispatchEvent(new ctx.w.Event('input'));
      check(g.player.camera.fov === 85, 'el campo de visión no cambió');
      var tam = d.getElementById('opt-subs-tam');
      tam.value = '1.65'; tam.dispatchEvent(new ctx.w.Event('input'));
      check(ctx.w.getComputedStyle(d.documentElement).getPropertyValue('--subs-escala').trim() === '1.65', 'el tamaño de subtítulos no cambió');
      var inv = d.getElementById('opt-invertir');
      inv.checked = true; inv.dispatchEvent(new ctx.w.Event('input'));
      start(ctx);
      var p0 = g.player.pitch;
      g.input.touchLookDY = 20; step(ctx, 1);
      check(g.player.pitch > p0, 'invertir el eje vertical no funcionó');
      // Un logro se consigue, se guarda y aparece en el panel.
      g.bosque.go(); step(ctx, 40);
      check(g.logros.has('bosque'), 'no se desbloqueó «Aire fresco»');
      check(/^1\//.test(d.getElementById('logros-cuenta').textContent), 'el contador no subió');
      check(JSON.parse(localStorage.getItem('midnight-rinse/logros') || '{}').bosque, 'el logro no se guardó');
      noErrors(ctx);
      return 'FOV 85, subtítulos ×1.65, eje invertido, logro guardado';
    }],

    ['Turno completo con salidas al bosque', async function () {
      var ctx = await load('?velocidad=8');
      start(ctx);
      var g = ctx.g;
      var frames = 0;
      while (g.state === 'playing' && frames < 30 * 60 * 6) {
        if (g.question) { g.answerChoice(1); }
        if (g.noteOpen) { g.closeNote(); }
        if (frames % (30 * 30) === 30 * 15 && g.bosque.canTravel()) { g.bosque.go(); }
        step(ctx, 1);
        frames += 1;
        if (frames % 600 === 0) { await wait(0); } // deja respirar a la página
      }
      check(g.state === 'ended', 'no terminó (estado ' + g.state + ')');
      var items = Array.prototype.map.call(ctx.w.document.querySelectorAll('#final-resumen li'), function (li) { return li.textContent; });
      check(items.some(function (t) { return /Salidas al bosque/.test(t); }), 'el resumen no cuenta las salidas');
      noErrors(ctx);
      return (frames / 30).toFixed(0) + ' s simulados; ' + g.bosque.visits + ' salidas; final: ' + ctx.w.document.getElementById('final-titulo').textContent;
    }],

    ['App instalable: manifiesto, iconos y modo sin conexión', async function () {
      var res = await fetch('manifest.webmanifest', { cache: 'no-store' });
      check(res.ok, 'no se encontró el manifiesto');
      var m = await res.json();
      check(m.display === 'fullscreen' && m.orientation === 'landscape', 'el manifiesto no pide pantalla completa horizontal');
      for (var i = 0; i < m.icons.length; i += 1) {
        var r = await fetch(m.icons[i].src, { cache: 'no-store' });
        check(r.ok && /image\/png/.test(r.headers.get('content-type') || ''), 'icono roto: ' + m.icons[i].src);
      }
      var sw = await fetch('sw.js', { cache: 'no-store' });
      check(sw.ok, 'falta sw.js');
      var ctx = await load();
      check(ctx.w.document.querySelector('link[rel="manifest"]'), 'index.html no enlaza el manifiesto');
      return m.icons.length + ' iconos; sw.js presente';
    }],

    ['Reiniciar todo borra solo lo del juego', async function () {
      var ctx = await load();
      ctx.g.ui.options.name = 'Prueba';
      ctx.g.ui._saveOptions();
      localStorage.setItem('otra-app/prueba', '1');
      var d = ctx.w.document;
      d.getElementById('btn-reiniciar').click();
      check(!d.getElementById('reiniciar').hidden, 'no apareció la confirmación');
      // El juego recarga la página solo: esperamos esa carga del marco.
      var waitReload = new Promise(function (resolve) { marco.onload = function () { resolve(); }; });
      d.getElementById('btn-reiniciar-si').click();
      await waitReload;
      await wait(400);
      var keys = [];
      for (var i = 0; i < localStorage.length; i += 1) { keys.push(localStorage.key(i)); }
      var gameKeys = keys.filter(function (k) { return k.indexOf(PREFIX) === 0; });
      check(gameKeys.length === 0, 'quedaron claves del juego: ' + gameKeys.join(', '));
      check(localStorage.getItem('otra-app/prueba') === '1', 'borró una clave ajena');
      localStorage.removeItem('otra-app/prueba');
      return 'claves del juego borradas; la ajena intacta';
    }]
  ];

  async function runAll() {
    var btn = document.getElementById('correr');
    btn.disabled = true;
    lista.textContent = '';
    resumen.textContent = 'Corriendo…';
    var saved = backup();
    var passed = 0;
    var t0 = performance.now();
    for (var i = 0; i < tests.length; i += 1) {
      var li = document.createElement('li');
      li.textContent = tests[i][0] + ' … ';
      lista.appendChild(li);
      var ti = performance.now();
      try {
        var detail = await tests[i][1]();
        passed += 1;
        li.className = 'ok';
        li.textContent = '✔ ' + tests[i][0];
        var s = document.createElement('span');
        s.className = 'det';
        s.textContent = (detail || '') + ' · ' + Math.round(performance.now() - ti) + ' ms';
        li.appendChild(s);
      } catch (e) {
        li.className = 'mal';
        li.textContent = '✘ ' + tests[i][0];
        var m = document.createElement('span');
        m.className = 'det';
        m.textContent = e.message;
        li.appendChild(m);
      }
    }
    restore(saved);
    marco.onload = null;
    marco.src = 'about:blank';
    var all = passed === tests.length;
    resumen.className = all ? 'ok' : 'mal';
    resumen.textContent = (all ? 'Todo bien: ' : 'Fallaron ' + (tests.length - passed) + ': ') + passed + '/' + tests.length +
      ' pruebas en ' + ((performance.now() - t0) / 1000).toFixed(1) + ' s';
    window.resultadoPruebas = { passed: passed, total: tests.length };
    btn.disabled = false;
  }

  document.getElementById('correr').addEventListener('click', runAll);
  if (/[?&]auto/.test(location.search)) { runAll(); }
})();
