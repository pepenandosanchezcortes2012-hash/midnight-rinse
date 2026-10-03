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

    ['Pelusa, el gato: duerme, se deja acariciar, camina sin atravesar muebles y avisa', async function () {
      var ctx = await load();
      start(ctx);
      var g = ctx.g;
      var cat = g.gato;
      check(cat.state === 'duerme' && cat.perch === 'secadora', 'no empezó dormido en la secadora');
      var d0 = g.dread = 0.3;
      g.gameplay._begin({ kind: 'gato', index: 0 }, g.input);
      check(cat.pets === 1 && g.dread < d0 && g.logros.has('gato'), 'acariciarlo no funcionó');
      // Que camine un buen rato: nunca dentro de un mueble ni fuera de la sala.
      var inside = 0;
      var colliders = g.world.colliders.filter(function (c) { return c.maxZ < 50; });
      for (var i = 0; i < 30 * 90; i += 1) {
        if (cat.state === 'duerme' || cat.state === 'sentado') { cat.timer = Math.min(cat.timer, 0.5); }
        step(ctx, 1);
        var p = cat.position();
        if (p.y < 0.05) {
          colliders.forEach(function (c) { if (p.x > c.minX + 0.05 && p.x < c.maxX - 0.05 && p.z > c.minZ + 0.05 && p.z < c.maxZ - 0.05) { inside += 1; } });
        }
        check(Math.abs(p.x) < 8 && Math.abs(p.z) < 5, 'el gato salió de la sala');
      }
      check(inside === 0, 'el gato atravesó muebles ' + inside + ' cuadros');
      // Alarma: él de pie junto al gato.
      cat.state = 'sentado'; cat.perch = null; cat.timer = 30;
      cat.mesh.root.position.set(-1, 0, -2); cat.node = 'F2';
      var hisses = 0;
      var orig = g.audio.bufido.bind(g.audio);
      g.audio.bufido = function (pan) { hisses += 1; return orig(pan); };
      g.horror.customer.present = true;
      g.horror._placeAt('lavadoras_mira');
      g.world.customer.group.position.set(-1.5, 0, -2.6);
      g.horror.customer.seated = false;
      step(ctx, 15);
      check(hisses === 1 && (cat.state === 'eriza' || cat.state === 'huye'), 'no bufó (estado ' + cat.state + ')');
      step(ctx, 30 * 4);
      var away = Math.hypot(cat.position().x + 1.5, cat.position().z + 2.6);
      check(away > 3, 'no huyó lejos (a ' + away.toFixed(1) + ' m)');
      // Afuera: te espera junto a la puerta.
      g.horror.customer.present = false;
      g.bosque.go(); step(ctx, 40);
      check(cat.waitingDoor && cat.position().z > 3.5, 'no te esperó en la puerta');
      noErrors(ctx);
      return 'acariciado, 90 s caminando sin atravesar nada, bufó y huyó a ' + away.toFixed(1) + ' m';
    }],

    ['Dificultad: Tranquilo perdona, Pesadilla no', async function () {
      async function play(mode, faults) {
        var ctx = await load();
        var d = ctx.w.document;
        var sel = d.getElementById('opt-dificultad');
        sel.value = mode; sel.dispatchEvent(new ctx.w.Event('input'));
        start(ctx);
        var g = ctx.g;
        var counts = [g.consumables.cigarettes, g.consumables.sips, g.consumables.joints].join('/');
        // Frecuencia del director: intervalo medio de 40 sorteos.
        var sum = 0;
        for (var i = 0; i < 40; i += 1) { g.horror.nextEvent = 0; g.minutes = 200; g.horror._director(0.001); sum += g.horror.nextEvent; }
        g.stats.respuesta = 'correcta'; g.stats.pasillo = faults; g.stats.mirada = 0; g.stats.filtro = 0;
        g.end();
        noErrors(ctx);
        return { counts: counts, interval: sum / 40, title: d.getElementById('final-titulo').textContent };
      }
      var calm = await play('tranquilo', 5);
      var hell = await play('pesadilla', 2);
      check(calm.counts === '8/6/4', 'consumibles de Tranquilo: ' + calm.counts);
      check(hell.counts === '2/2/1', 'consumibles de Pesadilla: ' + hell.counts);
      check(/05:12/.test(calm.title), 'Tranquilo no perdonó 5 faltas (' + calm.title + ')');
      check(!/05:12/.test(hell.title), 'Pesadilla perdonó 2 faltas');
      check(hell.interval < calm.interval * 0.5, 'Pesadilla no es más intensa (' + hell.interval.toFixed(1) + ' s vs ' + calm.interval.toFixed(1) + ' s)');
      localStorage.removeItem('midnight-rinse/opciones');
      return 'consumibles 8/6/4 vs 2/2/1; eventos cada ' + calm.interval.toFixed(0) + ' s vs ' + hell.interval.toFixed(0) + ' s';
    }],

    ['Continuar turno: se guarda solo y vuelve igual', async function () {
      localStorage.removeItem('midnight-rinse/partida');
      var ctx = await load();
      check(ctx.w.document.getElementById('btn-continuar-turno').hidden, 'apareció «Continuar» sin turno guardado');
      start(ctx);
      var g = ctx.g;
      // Un turno a media noche con muchas cosas en juego.
      g.minutes = 200; g.dread = 0.42;
      g.gameplay.coins = 3; g.gameplay.washers[5].running = true; g.gameplay.washers[5].remaining = 17;
      g.gameplay.puddleActive = [true, false, true, false, false, true, false, false].slice(0, g.gameplay.puddleActive.length);
      g.gameplay._applyPuddles();
      g.horror.placeCustomer('mostrador'); g.horror.customer.present = true;
      g.consumables.used.cigarros = 2; g.consumables.cigarettes = 3;
      g.bosque.go(); step(ctx, 40);
      g.bosque.takePage(0); g.closeNote(); g.bosque.takePage(3); g.closeNote();
      g.player.pos.set(-2.1, 0, 118.4); g.player.yaw = 1.1;
      g.pause();
      check(localStorage.getItem('midnight-rinse/partida'), 'no se guardó al pausar');
      // Como si la app se hubiera cerrado: cargar de nuevo y continuar.
      var ctx2 = await load();
      var b = ctx2.w.document.getElementById('btn-continuar-turno');
      check(!b.hidden && /03:20/.test(b.textContent), 'el botón no ofrece continuar a las 03:20 («' + b.textContent + '»)');
      b.click();
      var g2 = ctx2.g;
      step(ctx2, 1);
      check(g2.state === 'playing' && Math.abs(g2.minutes - 200) < 1, 'no continuó a la misma hora');
      check(g2.bosque.outside && Math.hypot(g2.player.pos.x + 2.1, g2.player.pos.z - 118.4) < 0.5, 'no volvió al mismo lugar del bosque');
      check(g2.bosque.pagesFound() === 2 && !g2.world.forest.pages[0].visible, 'no recordó las hojas');
      check(g2.gameplay.coins === 3 && g2.gameplay.washers[5].running, 'no recordó monedas y lavadoras');
      check(g2.horror.customer.present && g2.horror.customer.anchor === 'mostrador', 'él no volvió a su lugar');
      check(g2.consumables.used.cigarros === 2 && g2.consumables.cigarettes === 3, 'no recordó los consumibles');
      // Al terminar, el guardado se borra.
      g2.end();
      check(!localStorage.getItem('midnight-rinse/partida'), 'el guardado siguió después del final');
      noErrors(ctx2);
      return 'continuó a las 03:20 en el bosque con 2 hojas, monedas, lavadoras, él y consumibles';
    }],

    ['Sustos nuevos: radio sola, golpe en la secadora, llamada fantasma y mano en la lavadora', async function () {
      var ctx = await load();
      start(ctx);
      var g = ctx.g;
      var h = g.horror;
      var subs = function () { return ctx.w.document.getElementById('subtitulos').textContent; };
      g.gameplay.tuneTo(101.3);
      h._apply({ type: 'radio_sola' }, 'mostrador');
      check(Math.abs(g.gameplay.radioFreq - 94.1) < 0.05 && /no lo mires/.test(subs()), 'la radio no se sintonizó sola');
      var x0 = g.gameplay.dryers[1].mesh.body.position.x;
      h._apply({ type: 'golpe_secadora', index: 1 }, 'secadoras');
      step(ctx, 3);
      var moved = g.gameplay.dryers[1].mesh.body.position.x !== x0;
      step(ctx, 30);
      check(moved && g.gameplay.dryers[1].mesh.body.position.x === x0, 'la secadora no tembló o no volvió a su lugar');
      h._apply({ type: 'telefono_breve' }, 'mostrador');
      check(g.gameplay.phoneRinging && g.gameplay.phoneGhost, 'el teléfono fantasma no sonó');
      g.gameplay._phone();
      check(/lavadora girando/.test(subs()) && !g.flags.phone, 'la llamada fantasma no se contestó bien');
      h._apply({ type: 'mano_lavadora', index: 2 }, 'lavadoras');
      check(g.world.washerHand.visible && g.world.washerHand.parent === g.world.washers[2].doorPivot, 'no apareció la mano en la lavadora 3');
      noErrors(ctx);
      return 'los cuatro eventos funcionan';
    }],

    ['Pasillo de servicio: se abre a las 03:00, casilleros, fusibles y regreso', async function () {
      var ctx = await load();
      start(ctx);
      var g = ctx.g;
      var subs = function () { return ctx.w.document.getElementById('subtitulos').textContent; };
      g.gameplay._begin({ kind: 'backDoor', index: 0 }, g.input);
      check(!g.pasillo.travel && /cerrada con llave/.test(subs()), 'la puerta trasera no estaba cerrada antes de las 03:00');
      g.minutes = 179.9; step(ctx, 30);
      check(g.pasillo.unlocked && /entreabierta/.test(subs()), 'la puerta no se abrió a las 03:00');
      g.ui.options.name = 'Prueba';
      g.gameplay._begin({ kind: 'backDoor', index: 0 }, g.input); step(ctx, 40);
      check(g.pasillo.inside && g.player.pos.x > 58, 'no entró al pasillo');
      g.input.keys.add('KeyW'); step(ctx, 60); g.input.keys.delete('KeyW');
      check(g.pasillo.inside && g.player.pos.z < 4 && g.player.pos.x > 58.5 && g.player.pos.x < 61.5, 'caminar en el pasillo falló');
      check(g.gato.waitingDoor && g.gato.position().z < -3, 'el gato no esperó junto a la puerta trasera');
      g.pasillo.locker(6);
      check(/tu nombre/.test(subs()) && g.logros.has('casillero'), 'el último casillero no funcionó');
      g.pasillo.fuseBox();
      check(g.pasillo.fuses && g.logros.has('fusibles'), 'los fusibles no se restablecieron');
      g.horror.flickers[3] = 0;
      g.horror._apply({ type: 'apagon', light: 3, seconds: 2 }, 'mostrador');
      check(Math.abs(g.horror.flickers[3] - 1) < 0.01, 'con fusibles el apagón no duró la mitad');
      g.horror.placeCustomer('banco'); g.horror.customer.present = true;
      g.horror._scheduleKind('cliente_pasillo'); g.player.forceBlink(); step(ctx, 20);
      check(/^pasillo_/.test(g.horror.customer.anchor || ''), 'él no apareció en el pasillo (' + g.horror.customer.anchor + ')');
      g.gameplay._begin({ kind: 'volverSala', index: 0 }, g.input); step(ctx, 40);
      check(!g.pasillo.inside && g.player.pos.z < -3.5 && Math.abs(g.player.pos.x - 6.8) < 0.5, 'no volvió a la sala junto a la puerta trasera');
      check(Math.abs(g.retro.shared.uFogFar.value - 17) < 0.01, 'la niebla de la sala no volvió');
      noErrors(ctx);
      return 'abre 03:00, entra, camina, casillero con tu nombre, fusibles, él al fondo y regreso';
    }],

    ['Máquina de café y evaluación del gerente', async function () {
      var ctx = await load();
      start(ctx);
      var g = ctx.g;
      var c = g.consumables;
      var d = ctx.w.document;
      // La máquina se puede tocar de verdad.
      g.player.pos.set(-3.2, 0, 3.4); g.player.yaw = Math.PI; g.player.pitch = -0.1; step(ctx, 1);
      var t = g.gameplay.targetAt(g.player.camera, new ctx.w.THREE.Vector2(0, 0));
      check(t && t.kind === 'cafe', 'la máquina de café no se puede tocar (' + (t && t.kind) + ')');
      g.gameplay.coins = 0;
      c.tryCoffee();
      check(/moneda/.test(d.getElementById('subtitulos').textContent) && c.brewing === 0, 'sin monedas no avisó');
      g.gameplay.coins = 2;
      var bf0 = c.blinkFactor();
      g.gameplay._begin(t, g.input);
      step(ctx, 30 * 3);
      check(c.used.cafes === 1 && g.gameplay.coins === 1 && c.awake > 0.5 && c.blinkFactor() > bf0, 'el café no hizo efecto');
      // Evaluación: un turno perfecto saca A.
      g.stats.respuesta = 'correcta'; g.stats.mirada = 0; g.stats.pasillo = 0; g.stats.filtro = 0;
      g.end();
      check(d.getElementById('final-letra').textContent === 'A', 'un turno perfecto no sacó A (' + d.getElementById('final-letra').textContent + ')');
      check(/Evaluación del turno: A/.test(d.getElementById('final-resumen').textContent), 'el resumen no muestra la evaluación');
      // Y uno desastroso, F.
      check(ctx.w.MR.Game.grade(100 - 15 * 6 - 25)[0] === 'F', 'la escala de notas no da F');
      noErrors(ctx);
      return 'café: 1 moneda, parpadeo ×' + (c.blinkFactor() / bf0).toFixed(2) + '; turno perfecto = A';
    }],

    ['Compartir resultado al final del turno', async function () {
      var ctx = await load();
      start(ctx);
      var g = ctx.g;
      g.stats.respuesta = 'correcta';
      g.bosque.found = [true, true, false, false, false, false];
      g.end();
      var shared = null;
      Object.defineProperty(ctx.w.navigator, 'share', { configurable: true, value: function (data) { shared = data; return Promise.resolve(); } });
      ctx.w.document.getElementById('btn-compartir').click();
      check(shared && /Saqué [A-F] en Midnight Rinse/.test(shared.text), 'no compartió el texto');
      check(/2 de 6 hojas/.test(shared.text), 'el texto no menciona las hojas');
      var dir = ctx.w.location.origin + ctx.w.location.pathname.replace(/[^/]*$/, '');
      check(shared.url === dir, 'el enlace no apunta a la carpeta del juego: ' + shared.url);
      noErrors(ctx);
      return 'compartido con nota ' + g.grade + ' y 2 de 6 hojas';
    }],

    ['Respuesta secreta: con las seis hojas, él se va', async function () {
      var ctx = await load();
      start(ctx);
      var g = ctx.g;
      var d = ctx.w.document;
      g.horror.placeCustomer('banco'); g.horror.customer.present = true;
      g._ask();
      check(d.querySelectorAll('#dialogo-opciones li').length === 3, 'sin hojas ya había respuesta secreta');
      g._answer(3);
      g.bosque.found = [true, true, true, true, true, true];
      g._ask();
      var lis = d.querySelectorAll('#dialogo-opciones li');
      check(lis.length === 4 && /cinco y trece/.test(lis[3].textContent), 'con las seis hojas no apareció la cuarta respuesta');
      lis[3].click();
      await wait(1600);
      check(!g.horror.customer.present && !g.world.customer.group.visible, 'él no se fue');
      check(g.stats.respuesta === 'correcta' && g.logros.has('secreto'), 'no contó como correcta o no dio el logro');
      g.horror._apply({ type: 'cliente_aparece' }, 'banco');
      check(!g.horror.customer.present, 'volvió a aparecer después de irse');
      noErrors(ctx);
      return 'cuarta respuesta → se va y no vuelve; logro «La hora verdadera»';
    }],

    ['Contador de noches en el título', async function () {
      localStorage.removeItem('midnight-rinse/noches');
      var ctx = await load();
      check(ctx.w.document.getElementById('noche').hidden, 'la primera noche ya mostraba contador');
      start(ctx);
      ctx.g.end();
      check(localStorage.getItem('midnight-rinse/noches') === '1', 'no contó la noche');
      var ctx2 = await load();
      var el = ctx2.w.document.getElementById('noche');
      check(!el.hidden && el.textContent === 'Noche 2', 'el título no dice «Noche 2» (' + el.textContent + ')');
      return 'Noche 2 tras un turno';
    }],

    ['Radio por noche: la noche 7 revela la hora verdadera; después, estática', async function () {
      async function nightRadio(n) {
        localStorage.setItem('midnight-rinse/noches', String(n - 1));
        var ctx = await load();
        start(ctx);
        var g = ctx.g;
        g.gameplay.tuneTo(94.1);
        step(ctx, 2);
        g.minutes = ctx.w.MR.Config.RADIO_HOST - 0.05;
        step(ctx, 10);
        var subs = ctx.w.document.getElementById('subtitulos').textContent;
        g.horror.placeCustomer('banco'); g.horror.customer.present = true;
        g._ask();
        var options = ctx.w.document.querySelectorAll('#dialogo-opciones li').length;
        noErrors(ctx);
        return { subs: subs, options: options, night: g.night };
      }
      var n2 = await nightRadio(2);
      var n7 = await nightRadio(7);
      var n9 = await nightRadio(9);
      localStorage.removeItem('midnight-rinse/noches');
      check(/tambores/.test(n2.subs) && n2.options === 3, 'la noche 2 no tuvo su transmisión');
      check(/cinco y trece/.test(n7.subs) && n7.options === 4, 'la noche 7 no reveló la hora o no habilitó la respuesta');
      check(/solo estática/.test(n9.subs), 'después de la noche 8 no quedó estática');
      return 'noche 2, 7 (respuesta secreta habilitada) y 9 (estática)';
    }],

    ['Ahorro de batería: a lo más 30 cuadros por segundo', async function () {
      var ctx = await load();
      var g = ctx.g;
      var renders = 0;
      var orig = g.retro.render.bind(g.retro);
      g.retro.render = function (a, b, c) { renders += 1; return orig(a, b, c); };
      ctx.w.requestAnimationFrame = function () { return 0; }; // el bucle lo movemos a mano
      function run(saver) {
        g.ui.options.batterySaver = saver;
        renders = 0;
        var t = 100000;
        g.lastTime = t;
        for (var i = 1; i <= 60; i += 1) { g.frame(t + i * 16.7); } // 1 s a 60 Hz
        return renders;
      }
      var on = run(true);
      var off = run(false);
      check(on <= 31 && on >= 28, 'con ahorro dibujó ' + on + ' cuadros en 1 s');
      check(off === 60, 'sin ahorro dibujó ' + off + ' cuadros en 1 s');
      return 'con ahorro ' + on + ' cuadros/s, sin ahorro ' + off;
    }],

    ['Ambiente sonoro en la pantalla de título', async function () {
      var ctx = await load();
      var g = ctx.g;
      check(!g.audio.ambience, 'sonaba antes de tocar nada');
      ctx.w.dispatchEvent(new ctx.w.Event('pointerdown'));
      check(g.audio.ambience && g.audio.ctx && g.state === 'title', 'el primer toque no encendió el ambiente');
      var vol = g.ui.options.volume;
      check(Math.abs(g.audio.master.gain.value - vol * 0.6) < 0.01, 'el título no suena más bajito');
      start(ctx);
      check(Math.abs(g.audio.master.gain.value - vol) < 0.01, 'al empezar no subió al volumen normal');
      noErrors(ctx);
      return 'lluvia y zumbido al primer toque, a ' + Math.round(vol * 60) + ' % del volumen';
    }],

    ['Tablilla de tareas en el mostrador', async function () {
      var ctx = await load();
      start(ctx);
      var g = ctx.g;
      var d = ctx.w.document;
      g.player.pos.set(5.62, 0, 1.2); g.player.yaw = Math.PI; g.player.pitch = -0.75; step(ctx, 1);
      var boardMesh = g.world.interactables.filter(function (m) { return m.userData.interact.kind === 'tareas'; })[0];
      var v = boardMesh.getWorldPosition(new ctx.w.THREE.Vector3()).project(g.player.camera);
      var t = g.gameplay.targetAt(g.player.camera, new ctx.w.THREE.Vector2(v.x, v.y));
      check(t && t.kind === 'tareas', 'la tablilla no se puede tocar (' + (t && t.kind) + ')');
      g.gameplay.puddleActive = g.gameplay.puddleActive.map(function (v, i) { return i < 3; });
      g.gameplay.washers.forEach(function (w, i) { w.running = i < 4; });
      g.gameplay._begin(t, g.input);
      var text = d.getElementById('nota-texto').textContent;
      check(g.noteOpen && /TAREAS DEL TURNO/.test(d.querySelector('#nota .encabezado').textContent), 'no se abrió la tablilla');
      check(/☐ Pasillo central: 3 charcos/.test(text), 'no marcó los charcos pendientes');
      check(/✔ Lavadoras funcionando: 4 de 6/.test(text), 'no contó las lavadoras');
      g.closeNote();
      g.openNote();
      check(!d.getElementById('nota').classList.contains('tareas'), 'el registro quedó con el estilo de la tablilla');
      noErrors(ctx);
      return 'charcos, lavadoras y filtros al día';
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

    ['Caos: turnos completos apretando todo al azar (3 dificultades)', async function () {
      var KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyC', 'KeyF', 'KeyJ', 'KeyB', 'KeyE', 'Digit1', 'Digit2', 'Digit3'];
      var ACTIONS = ['blink', 'cigarro', 'petaca', 'porro'];
      var report = [];
      var seed = 12345;
      function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
      var modes = ['tranquilo', 'normal', 'pesadilla'];
      for (var mi = 0; mi < modes.length; mi += 1) {
        var ctx = await load('?velocidad=8');
        var sel = ctx.w.document.getElementById('opt-dificultad');
        sel.value = modes[mi]; sel.dispatchEvent(new ctx.w.Event('input'));
        start(ctx);
        var g = ctx.g;
        var frames = 0;
        var travels = { bosque: 0, pasillo: 0 };
        var held = {};
        while (g.state === 'playing' && frames < 30 * 60 * 5) {
          // Teclas que se mantienen o se sueltan al azar.
          if (rnd() < 0.15) {
            var k = KEYS[Math.floor(rnd() * KEYS.length)];
            if (held[k]) { g.input.keys.delete(k); held[k] = false; } else { g.input.keys.add(k); g.input.pressed.add(k); held[k] = true; }
          }
          if (rnd() < 0.02) { g.input.actions.add(ACTIONS[Math.floor(rnd() * ACTIONS.length)]); }
          g.input.mouseDX = (rnd() - 0.5) * 40; g.input.mouseDY = (rnd() - 0.5) * 20;
          if (rnd() < 0.05) { g.input.buttonPressed = true; g.input.buttons = 1; } else if (rnd() < 0.08) { g.input.buttons = 0; }
          if (rnd() < 0.004 && g.bosque.canTravel()) { if (g.bosque.go()) { travels.bosque += 1; } }
          if (rnd() < 0.004 && g.pasillo.unlocked && g.pasillo.canTravel()) { if (g.pasillo.go()) { travels.pasillo += 1; } }
          if (rnd() < 0.003) { g.gato.pet(); }
          if (rnd() < 0.002 && g.bosque.outside) { g.bosque.takePage(Math.floor(rnd() * 6)); }
          if (g.noteOpen && rnd() < 0.1) { g.closeNote(); }
          if (g.question && rnd() < 0.02) { g.answerChoice(1 + Math.floor(rnd() * 3)); }
          if (rnd() < 0.003) { g.pause(); step(ctx, 1); g.resume(); }
          step(ctx, 1);
          frames += 1;
          var p = g.player.pos;
          check(isFinite(p.x) && isFinite(p.z) && isFinite(g.player.yaw) && isFinite(g.dread) && isFinite(g.minutes),
            modes[mi] + ': valor no numérico en el cuadro ' + frames);
          var a = g.player.area || { minX: -8, maxX: 8, minZ: -5, maxZ: 5 };
          check(p.x >= a.minX - 0.01 && p.x <= a.maxX + 0.01 && p.z >= a.minZ - 0.01 && p.z <= a.maxZ + 0.01,
            modes[mi] + ': el jugador quedó fuera de su área en el cuadro ' + frames);
          if (frames % 900 === 0) { await wait(0); }
        }
        check(g.state === 'ended', modes[mi] + ': el turno no terminó');
        noErrors(ctx);
        report.push(modes[mi] + ' ' + (frames / 30).toFixed(0) + ' s (bosque ' + travels.bosque + ', pasillo ' + travels.pasillo + ')');
      }
      return report.join(' · ');
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
