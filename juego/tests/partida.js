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
      var q = query || '';
      // Lo que aprendió Pelusa (cerebro de mosca) no pasa de una prueba a otra, salvo que la prueba lo pida (?memoria).
      if (q.indexOf('memoria') < 0) { localStorage.removeItem('midnight-rinse/pelusa'); }
      if (q.indexOf('noche=') < 0) { q += (q.indexOf('?') >= 0 ? '&' : '?') + 'noche=ninguna'; } // pruebas deterministas
      if (q.indexOf('lang=') < 0) { q += '&lang=es'; } // en español salvo la prueba de idioma
      marco.src = 'index.html' + q + '&prueba=' + Date.now();
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
      check(!ctx.w.MR.TEXTOS_EN, 'en español no debería descargar los textos en inglés');
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
      var claro = g.world.forest.claroDrum;
      var giro = claro.rotation.z;
      step(ctx, 3);
      check(claro.rotation.z !== giro, 'el uniforme de la lavadora del claro no gira');
      g.bosque.touchWasher();
      giro = claro.rotation.z;
      step(ctx, 5);
      check(claro.rotation.z === giro, 'el uniforme no dejó de girar con las seis hojas');
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

    ['Él te observa: la cabeza gira cuando no lo miras', async function () {
      var ctx = await load();
      start(ctx);
      var g = ctx.g;
      var h = g.horror;
      h.placeCustomer('banco'); h.customer.present = true;
      check(Math.abs(h.headYaw) < 1e-6, 'la cabeza no empezó al frente');
      // Detrás y a la derecha de él, mirando hacia otro lado (el banco queda fuera de la vista).
      g.player.pos.set(2, 0, 3); g.player.yaw = Math.PI; g.player.pitch = 0;
      step(ctx, 30 * 5);
      check(h.zoneVisible('banco') === 0, 'el banco seguía a la vista');
      check(h.headYaw < -1.0 && Math.abs(g.world.seatedHead.rotation.y - h.headYaw) < 1e-6, 'la cabeza no giró hacia ti (' + h.headYaw.toFixed(2) + ')');
      // Al mirarlo, la cabeza se queda donde quedó.
      var y0 = h.headYaw;
      g.player.yaw = Math.atan2(-(-3.5 - 2), -(0.62 - 3));
      // Sin parpadear (si parpadeas, también gira: es a propósito). Si iba un parpadeo a medias, se termina aquí.
      g.player.blink.phase = 'open'; g.player.blink.amount = 0; g.player.blink.timer = 99;
      step(ctx, 30);
      check(h.zoneVisible('banco') > 0 && Math.abs(h.headYaw - y0) < 1e-6, 'la cabeza se movió mientras lo mirabas');
      // Al cambiar de lugar, vuelve al frente.
      h.placeCustomer('mostrador');
      check(Math.abs(h.headYaw) < 1e-6, 'la cabeza no volvió al frente al moverse');
      noErrors(ctx);
      return 'giró ' + (y0 * 180 / Math.PI).toFixed(0) + '° hacia ti mientras no mirabas';
    }],

    ['Noches especiales: inundación, luna llena y ¿y el gato?', async function () {
      // Inundación: los charcos salen el doble de rápido.
      var ctx = await load('?noche=inundacion');
      start(ctx);
      var g = ctx.g;
      check(g.mod === 'inundacion' && /tubería/.test(ctx.w.document.getElementById('subtitulos').textContent), 'no avisó de la inundación');
      g.gameplay.nextPuddle = 0; g.dread = 0; step(ctx, 1);
      check(g.gameplay.nextPuddle <= 5.01, 'los charcos no salen más rápido (' + g.gameplay.nextPuddle.toFixed(1) + ' min)');
      noErrors(ctx);
      // Luna llena: sin lluvia ni relámpagos, el bosque más claro.
      var ctx2 = await load('?noche=luna');
      start(ctx2);
      var g2 = ctx2.g;
      g2.bosque.go(); step(ctx2, 40);
      g2.clima.nextBolt = 0; step(ctx2, 5);
      check(!g2.clima.mesh.visible && !g2.clima.bolt, 'con luna llena llovió o hubo relámpago');
      check(g2.retro.shared.uAmbient.value.x > 0.07, 'el bosque no está más claro con luna');
      noErrors(ctx2);
      // ¿Y el gato?: no está hasta las 03:00.
      var ctx3 = await load('?noche=sin_gato');
      start(ctx3);
      var g3 = ctx3.g;
      step(ctx3, 3);
      check(!g3.gato.mesh.root.visible, 'el gato estaba aunque no vino');
      g3.minutes = 180.5; step(ctx3, 3);
      check(g3.gato.mesh.root.visible && g3.gato.perch === 'mostrador', 'el gato no apareció en el mostrador a las 03:00');
      noErrors(ctx3);
      return 'inundación (charcos ×2), luna llena (sin lluvia, más luz) y el gato a las 03:00';
    }],

    ['Amanecer en el título tras el tercer final', async function () {
      localStorage.setItem('midnight-rinse/logros', JSON.stringify({ final_bosque: Date.now() }));
      var ctx = await load();
      var g = ctx.g;
      g._attract(0.016);
      var n = ctx.w.document.getElementById('noche');
      check(g.dawnOn && g.retro.shared.uAmbient.value.x > 0.3 && /Amaneció/.test(n.textContent), 'no amaneció en el título');
      start(ctx);
      check(!g.dawnOn && Math.abs(g.retro.shared.uAmbient.value.x - g.bosque.inside.ambient.x) < 1e-6, 'al empezar no volvió la noche');
      noErrors(ctx);
      localStorage.removeItem('midnight-rinse/logros');
      return 'amanece en el título; de noche al empezar';
    }],

    ['Pistas para quien empieza (y no para los veteranos)', async function () {
      async function run(night) {
        localStorage.setItem('midnight-rinse/noches', String(night - 1));
        var ctx = await load();
        start(ctx);
        var g = ctx.g;
        var C = ctx.w.MR.Config;
        g.minutes = C.SHIFT_START + 13; step(ctx, 35);
        var a = ctx.w.document.getElementById('subtitulos').textContent;
        g.gameplay.washers.forEach(function (w) { w.running = false; });
        g.minutes = C.SHIFT_START + 26; step(ctx, 35);
        var b = ctx.w.document.getElementById('subtitulos').textContent;
        noErrors(ctx);
        return { registro: /Pista: la hoja del registro/.test(a), lavadoras: /Pista: pon a lavar/.test(b), hints: Object.keys(g.flags.hints || {}).length };
      }
      var first = await run(1);
      var veteran = await run(5);
      localStorage.removeItem('midnight-rinse/noches');
      check(first.registro && first.lavadoras, 'la primera noche no dio pistas');
      check(veteran.hints === 0, 'la noche 5 dio pistas');
      return 'noche 1: registro y lavadoras · noche 5: ninguna';
    }],

    ['Reflejo en el vidrio de una lavadora', async function () {
      var ctx = await load();
      start(ctx);
      var g = ctx.g;
      var h = g.horror;
      var wsh = g.world.washers[2];
      h.placeCustomer('banco'); h.customer.present = true;
      // Frente a la lavadora 3, mirando su vidrio.
      var eyeY = ctx.w.MR.Config.PLAYER_HEIGHT;
      g.player.pos.set(wsh.x, 0, -3.2); g.player.yaw = 0;
      g.player.pitch = -Math.atan2(eyeY - 0.5, 4.09 - 3.2); step(ctx, 1);
      h.reflectCooldown = 0; h.lastHover = null;
      var rnd = ctx.w.Math.random; ctx.w.Math.random = function () { return 0; };
      var pending0 = h.zones.jugador.dispatcher.pending();
      step(ctx, 2);
      ctx.w.Math.random = rnd;
      check(g.gameplay.hover && g.gameplay.hover.kind === 'washerDoor', 'no estaba mirando el vidrio (' + JSON.stringify(g.gameplay.hover) + ')');
      check(wsh.porthole.material === h.reflectMat, 'no apareció el reflejo');
      check(h.zones.jugador.dispatcher.pending() > pending0, 'no quedó programado que él aparezca detrás');
      step(ctx, 20);
      check(wsh.porthole.material === g.world.mat.glass, 'el reflejo no desapareció');
      noErrors(ctx);
      return 'silueta en el vidrio 0.45 s y él detrás en el siguiente parpadeo';
    }],

    ['Transición a los finales: fundido de 3 s', async function () {
      var ctx = await load();
      start(ctx);
      var g = ctx.g;
      var fx = null;
      var orig = g.retro.render.bind(g.retro);
      g.retro.render = function (a, b, c) { fx = c; return orig(a, b, c); };
      ctx.w.requestAnimationFrame = function () { return 0; };
      g.end();
      var t = g.endedAt;
      g.lastTime = t; g.frame(t + 1500);
      var mid = fx.blink;
      g.lastTime = t + 1500; g.frame(t + 3200);
      var full = fx.blink;
      check(mid > 0.4 && mid < 0.6, 'a la mitad del fundido la pantalla estaba en ' + mid.toFixed(2));
      check(full === 1, 'al final del fundido no quedó negro');
      var anim = ctx.w.getComputedStyle(ctx.w.document.getElementById('final')).animationName;
      check(anim === 'aparecer-final', 'el texto final no aparece con transición (' + anim + ')');
      noErrors(ctx);
      return 'fundido 0 → ' + mid.toFixed(2) + ' → 1; texto con transición';
    }],

    ['Objetos perdidos: un ciclo deja algo y se guarda en la colección', async function () {
      localStorage.removeItem('midnight-rinse/objetos');
      var ctx = await load();
      start(ctx);
      var g = ctx.g;
      var w = g.gameplay.washers[0];
      w.running = true; w.remaining = 0.2; w.doorTarget = 0; w.item = null;
      var rnd = ctx.w.Math.random; ctx.w.Math.random = function () { return 0; };
      step(ctx, 30 * 3);
      ctx.w.Math.random = rnd;
      check(!w.running && w.item, 'el ciclo no dejó nada');
      g.gameplay._toggleDoor(0);
      var subs = ctx.w.document.getElementById('subtitulos').textContent;
      check(/Entre la ropa húmeda/.test(subs) && !w.item, 'al abrir la puerta no apareció el objeto');
      check(g.objetos.count() === 1 && JSON.parse(localStorage.getItem('midnight-rinse/objetos')), 'no se guardó en la colección');
      check(/^1\//.test(ctx.w.document.getElementById('objetos-cuenta').textContent), 'el panel no se actualizó');
      noErrors(ctx);
      localStorage.removeItem('midnight-rinse/objetos');
      return 'encontrado y guardado (1/' + g.objetos.total() + ')';
    }],

    ['Archivo: lo que lees y escuchas se guarda y se puede releer', async function () {
      localStorage.removeItem('midnight-rinse/archivo');
      var ctx = await load();
      start(ctx);
      var g = ctx.g;
      g.bosque.takePage(2); g.closeNote();
      g.gameplay.tuneTo(94.1); step(ctx, 2);
      g.minutes = ctx.w.MR.Config.RADIO_HOST - 0.05; step(ctx, 10);
      check(g.archivo.count() === 2, 'el archivo no guardó la hoja y la radio (' + g.archivo.count() + ')');
      // Otra visita: desde el título se puede releer.
      var ctx2 = await load();
      var d = ctx2.w.document;
      check(/^2\//.test(d.getElementById('archivo-cuenta').textContent), 'el título no muestra 2 entradas');
      var entry = d.querySelector('#archivo-lista li.leer');
      check(entry, 'no hay entradas para releer');
      entry.click();
      check(!d.getElementById('nota').hidden && d.getElementById('nota-texto').textContent.length > 40, 'no se abrió para releer');
      d.getElementById('nota').click();
      check(d.getElementById('nota').hidden, 'no se cerró al tocarla');
      localStorage.removeItem('midnight-rinse/archivo');
      return 'hoja 3 y radio de la noche 1 guardadas y releídas desde el título';
    }],

    ['Modo Paseo: sin él, sin sustos y sin faltas', async function () {
      var ctx = await load('?velocidad=8');
      var sel = ctx.w.document.getElementById('opt-dificultad');
      sel.value = 'paseo'; sel.dispatchEvent(new ctx.w.Event('input'));
      start(ctx);
      var g = ctx.g;
      var fired = 0;
      var frames = 0;
      while (g.state === 'playing' && frames < 30 * 60 * 5) {
        step(ctx, 1); frames += 1;
        if (g.horror.customer.present) { break; }
        if (frames % 900 === 0) { await wait(0); }
      }
      var firedList = g.horror.firedLog.filter(function (e) { return !/^(cierra|vidrio|huellas_secan|mano_lavadora_fin)/.test(e.type); });
      fired = firedList.length;
      check(!g.horror.customer.present, 'él apareció en modo Paseo');
      check(fired === 0, 'hubo ' + fired + ' sustos en modo Paseo: ' + firedList.map(function (e) { return e.type; }).join(', '));
      check(g.stats.pasillo === 0 && g.stats.filtro === 0, 'hubo faltas en modo Paseo');
      check(g.state === 'ended' && /Paseo nocturno/.test(ctx.w.document.getElementById('final-titulo').textContent), 'no terminó con el final del paseo');
      noErrors(ctx);
      localStorage.removeItem('midnight-rinse/opciones');
      return 'turno completo sin él, sin sustos ni faltas';
    }],

    ['Final verdadero: la hora verdadera y las seis hojas en la misma noche', async function () {
      var ctx = await load();
      start(ctx);
      var g = ctx.g;
      g.horror.placeCustomer('banco'); g.horror.customer.present = true;
      g.bosque.found = [true, true, true, true, true, true];
      g._ask(); g._answer(4);
      check(g.flags.secreto, 'la respuesta secreta no quedó registrada');
      g.bosque.go(); step(ctx, 40);
      g.bosque.touchWasher(); step(ctx, 30 * 4);
      check(g.epilogue && g.state === 'playing', 'no empezó el amanecer');
      g.gameplay._begin({ kind: 'salirBosque', index: 0 }, g.input); step(ctx, 5); // la puerta da a la calle
      var title = ctx.w.document.getElementById('final-titulo').textContent;
      check(g.state === 'ended' && title === ctx.w.MR.HISTORIA.verdadero.titulo, 'no fue el final verdadero (' + title + ')');
      check(g.logros.has('verdadero') && g.logros.has('final_bosque'), 'no dio los logros del final');
      noErrors(ctx);
      return '«' + title + '»';
    }],

    ['Turno al azar: tocar todo, cruzar puertas y fumar, de 01:10 a 05:12, sin errores', async function () {
      // Azar con semilla (el del juego también), para que si algo falla se pueda repetir.
      function rng(seed) {
        return function () {
          seed = (seed + 0x6D2B79F5) | 0;
          var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      }
      var report = [];
      var runs = [['', 1337], ['?noche=sin_agua', 2024], ['?noche=apagones&lang=en', 77]];
      for (var r = 0; r < runs.length; r += 1) {
        var ctx = await load(runs[r][0]);
        var w = ctx.w;
        var g = ctx.g;
        var rand = rng(runs[r][1]);
        w.Math.random = rng(runs[r][1] * 7 + 1);
        var C = w.MR.Config;
        var speed = C.GAME_SECONDS_PER_REAL_SECOND;
        C.GAME_SECONDS_PER_REAL_SECOND = speed * 10; // el turno entero en ~2,5 minutos de juego
        start(ctx);
        var input = g.input;
        var counts = {};
        var hold = 0;
        var walk = 0;
        var frames = 0;
        try {
          while (g.state === 'playing' && frames < 4200) {
            frames += 1;
            if (g.noteOpen && rand() < 0.2) { g.closeNote(); }
            if (g.question && rand() < 0.05) { g._answer(1 + Math.floor(rand() * (g._knowsTrueTime() ? 4 : 3))); }
            if (hold > 0) {
              hold -= 1;
              input.buttons = 1;
              input.mouseDX = (rand() - 0.5) * 40;
              if (!hold) { input.buttons = 0; }
            } else if (walk > 0) {
              walk -= 1;
              input.keys.add('KeyW');
              if (!walk) { input.keys.delete('KeyW'); }
            } else if (frames % 20 === 0) {
              var roll = rand();
              if (roll < 0.55) {
                // Acercarse a algo de esta área, mirarlo y hacer clic (a veces mantener).
                var cam = g.player.camera;
                var here = cam.getWorldPosition(new w.THREE.Vector3());
                var near = g.world.interactables.filter(function (m) {
                  if (!g.gameplay._visible(m)) { return false; }
                  return m.getWorldPosition(new w.THREE.Vector3()).distanceTo(here) < 9;
                });
                if (near.length) {
                  var m = near[Math.floor(rand() * near.length)];
                  var t = m.getWorldPosition(new w.THREE.Vector3());
                  var ang = rand() * Math.PI * 2;
                  g.player.pos.set(t.x + Math.sin(ang) * 1.3, g.player.pos.y, t.z + Math.cos(ang) * 1.3);
                  step(ctx, 1); // la colisión lo saca de las paredes
                  var p = g.player.pos;
                  var dx = t.x - p.x;
                  var dz = t.z - p.z;
                  g.player.yaw = Math.atan2(-dx, -dz);
                  g.player.pitch = Math.atan2(t.y - C.PLAYER_HEIGHT, Math.sqrt(dx * dx + dz * dz));
                  input.buttonPressed = true;
                  input.buttons = 1;
                  hold = rand() < 0.4 ? Math.floor(rand() * 70) : 0;
                  var kind = m.userData.interact.kind;
                  counts[kind] = (counts[kind] || 0) + 1;
                }
              } else if (roll < 0.75) {
                g.player.yaw = rand() * Math.PI * 2;
                walk = 10 + Math.floor(rand() * 30);
              } else {
                var keys = ['KeyC', 'KeyF', 'KeyJ', 'KeyP', 'KeyB', 'KeyE', 'Digit1', 'Digit2'];
                input.pressed.add(keys[Math.floor(rand() * keys.length)]);
              }
            } else if (input.buttons && !hold) {
              input.buttons = 0;
            }
            g.update(1 / 30);
            input.endFrame();
            check(isFinite(g.minutes) && isFinite(g.player.pos.x) && isFinite(g.player.pos.z), 'algo quedó en NaN en el cuadro ' + frames);
          }
        } finally {
          C.GAME_SECONDS_PER_REAL_SECOND = speed;
        }
        check(g.state === 'ended', 'el turno no terminó (' + g.state + ', ' + w.MR.Util.clockText(g.minutes) + ', ' + frames + ' cuadros)');
        noErrors(ctx);
        var touched = Object.keys(counts).length;
        report.push(frames + ' cuadros, ' + touched + ' tipos de objeto, final «' + g.ending + '»');
      }
      return report.join(' · ');
    }],

    ['El espejo del pasillo: refleja, tú no sales y a veces él está detrás', async function () {
      var ctx = await load();
      var g = ctx.g;
      var e = g.espejo;
      var d = ctx.w.document;
      start(ctx);
      g.flags.customerSeen = true;
      g.pasillo.unlock(true); g.pasillo.go(); step(ctx, 40);
      check(g.pasillo.inside, 'no entró al pasillo');
      var X = e.planeX - 1.465;
      g.player.pos.set(X + 0.3, 0, 2.2); g.player.yaw = -Math.PI / 2; g.player.pitch = 0;
      g.player.blink.phase = 'open'; g.player.blink.amount = 0; g.player.blink.timer = 99;
      step(ctx, 30);
      check(e.on && e.looking > 0.6, 'el espejo no está a la vista (on ' + e.on + ', mirando ' + e.looking.toFixed(2) + ')');
      check(d.getElementById('subtitulos').textContent.indexOf('A ti no') >= 0, 'no notó que no te reflejas');
      function snap() {
        e.render();
        var px = new Uint8Array(192 * 144 * 4);
        g.retro.renderer.readRenderTargetPixels(e.rt, 0, 0, 192, 144, px);
        return px;
      }
      var a = snap();
      var lit = 0;
      for (var i = 0; i < a.length; i += 4) { if (a[i] + a[i + 1] + a[i + 2] > 30) { lit += 1; } }
      check(lit > 192 * 144 * 0.2, 'el reflejo está vacío (' + lit + ' píxeles con luz)');
      var vis = g.world.customer.group.visible;
      e.armed = true;
      step(ctx, 1);
      check(e.ghost > 0 && g.logros.has('espejo'), 'no salió en el espejo');
      var b = snap();
      check(g.world.customer.group.visible === vis, 'él quedó visible fuera del reflejo');
      var diff = 0;
      for (var j = 0; j < a.length; j += 4) { if (Math.abs(a[j] - b[j]) + Math.abs(a[j + 1] - b[j + 1]) + Math.abs(a[j + 2] - b[j + 2]) > 40) { diff += 1; } }
      check(diff > 300, 'él no se ve en el reflejo (' + diff + ' píxeles distintos)');
      var gl = g.retro.renderer.getContext();
      check(gl.getError() === 0, 'error de WebGL en la pasada del espejo');
      // Al dejar de mirar, ya no está.
      g.player.yaw = Math.PI / 2;
      step(ctx, 2);
      check(e.ghost === 0, 'siguió en el espejo sin mirarlo');
      // El lavabo.
      g.dread = 0.6;
      e.sink();
      check(g.dread < 0.5 && d.getElementById('subtitulos').textContent.indexOf('agua en la cara') >= 0, 'el lavabo no hizo nada');
      noErrors(ctx);
      return 'reflejo con ' + lit + ' px de luz · él ocupa ' + diff + ' px';
    }],

    ['Variaciones: la caja de la segunda máscara, la cara que se despide desde la avenida y la cara blanca en el espejo', async function () {
      var ctx = await load();
      var g = ctx.g;
      var c = g.clientela;
      var e = g.espejo;
      var sub = function () { return ctx.w.document.getElementById('subtitulos').textContent; };
      start(ctx);
      c.plan = [];
      g.horror.customer.present = false;
      g.player.pos.set(-6, 0, 2.5);
      // La placa del puente nunca sale de una lavadora.
      for (var n = 0; n < 300; n += 1) {
        var w = { item: null };
        g.objetos.onCycleEnd(w);
        check(w.item !== 'placa', 'la placa salió de una lavadora');
      }
      // La segunda máscara de la noche deja la caja; al tocarla, la placa entra a la colección.
      c.ordersToday = 1;
      var m = c.spawn('mascara');
      for (var i = 0; i < 30 * 30 && m.state !== 'llego'; i += 1) { step(ctx, 1); }
      check(m.state === 'llego' && c.ordersToday === 2, 'la máscara no llegó al mostrador');
      check(g.world.giftBox.visible, 'no dejó la caja');
      await wait(4300);
      check(sub().indexOf('caja de cartón') >= 0, 'no avisó de la caja');
      g.gameplay._begin({ kind: 'cajaMostrador', index: 0 }, g.input);
      check(!g.world.giftBox.visible && g.objetos.got.placa, 'la caja no dio la placa');
      check(sub().indexOf('PUENTE MUNICIPAL') >= 0, 'no dijo qué había en la caja');
      check(g.objetos.view().some(function (o) { return o.titulo === 'Una placa de bronce'; }), 'la placa no aparece en la colección');
      for (var j = 0; j < 30 * 40 && c.visitors.length; j += 1) { step(ctx, 1); }
      // La cara blanca se despide desde la vereda de enfrente (a veces: aquí, forzado).
      g.gameplay.washers.forEach(function (x) { x.running = false; x.credit = false; });
      var v = c.spawn('cara');
      for (var k = 0; k < 30 * 30 && v.state !== 'llego'; k += 1) { step(ctx, 1); }
      c._leave(v);
      var rnd = ctx.w.Math.random;
      ctx.w.Math.random = function () { return 0.3; };
      for (var q = 0; q < 30 * 30 && c.visitors.length; q += 1) { step(ctx, 1); }
      ctx.w.Math.random = rnd;
      check(!c.visitors.length && c.waver && c.waver.group.visible, 'no se despidió desde la avenida');
      check(c.waver.group.position.z > 11, 'la despedida no fue del otro lado de la avenida');
      check(sub().indexOf('Se está despidiendo') >= 0, 'faltó el subtítulo de la despedida');
      check(Math.abs(c.waver.armR.rotation.z - Math.PI) < 1e-6, 'no levantó la mano');
      step(ctx, 30 * 9);
      check(!c.waver.group.visible, 'la despedida no terminó');
      // En el espejo: una cara blanca (esa noche vino una).
      g.flags.customerSeen = true;
      g.pasillo.unlock(true); g.pasillo.go(); step(ctx, 40);
      var X = e.planeX - 1.465;
      g.player.pos.set(X + 0.3, 0, 2.2); g.player.yaw = -Math.PI / 2; g.player.pitch = 0;
      g.player.blink.phase = 'open'; g.player.blink.amount = 0; g.player.blink.timer = 99;
      step(ctx, 30);
      function snap() {
        e.render();
        var px = new Uint8Array(192 * 144 * 4);
        g.retro.renderer.readRenderTargetPixels(e.rt, 0, 0, 192, 144, px);
        return px;
      }
      var a = snap();
      e.armed = true;
      ctx.w.Math.random = function () { return 0.01; };
      step(ctx, 1);
      ctx.w.Math.random = rnd;
      check(e.ghost > 0 && e.ghostKind === 'cara', 'no salió la cara blanca en el espejo (' + e.ghostKind + ')');
      var b = snap();
      check(e.face && !e.face.group.visible, 'la cara blanca quedó visible fuera del reflejo');
      var diff = 0;
      for (var p = 0; p < a.length; p += 4) { if (Math.abs(a[p] - b[p]) + Math.abs(a[p + 1] - b[p + 1]) + Math.abs(a[p + 2] - b[p + 2]) > 40) { diff += 1; } }
      check(diff > 120, 'la cara no se ve en el reflejo (' + diff + ' píxeles distintos)'); // abrigo pardo sobre casilleros: menos contraste que él
      await wait(1500);
      check(sub().indexOf('mira el espejo contigo') >= 0, 'faltó el subtítulo del espejo');
      noErrors(ctx);
      return 'caja → placa · despedida · espejo (' + diff + ' px)';
    }],

    ['En el celular: lo nuevo se puede tocar con el dedo (visitante, vidriera, banco, lavabo, secadora sola y campana)', async function () {
      var ctx = await load();
      var g = ctx.g;
      var THREE = ctx.w.THREE;
      start(ctx);
      g.clientela.plan = [];
      // Toca el objeto donde aparece en la pantalla (como un dedo), desde cerca y mirándolo.
      function tap(obj, kind, from) {
        var t = obj.getWorldPosition(new THREE.Vector3());
        g.player.pos.set(from[0], 0, from[1]);
        var dx = t.x - from[0];
        var dz = t.z - from[1];
        g.player.yaw = Math.atan2(-dx, -dz) + 0.25; // un poco de lado: el dedo no toca el centro
        g.player.pitch = Math.atan2(t.y - 1.62, Math.hypot(dx, dz));
        step(ctx, 1);
        var cam = g.player.camera;
        cam.updateMatrixWorld();
        var v = t.clone().project(cam);
        var hit = g.gameplay.targetAt(cam, new THREE.Vector2(v.x, v.y));
        check(hit && hit.kind === kind, 'no se pudo tocar: ' + kind + ' (tocó ' + (hit ? hit.kind : 'nada') + ')');
      }
      g.gameplay.washers.forEach(function (w) { w.running = false; w.credit = false; });
      g.player.pos.set(-6, 0, 2.5);
      var v = g.clientela.spawn('cara');
      for (var i = 0; i < 30 * 30 && v.state !== 'llego'; i += 1) { step(ctx, 1); }
      var vp = v.model.group.position;
      tap(v.model.head, 'visitante', [vp.x + 0.6, vp.z + 1.8]);
      var panes = g.world.city.group.children.filter(function (o) { return o.userData.interact && o.userData.interact.kind === 'vidriera'; });
      tap(panes[1], 'vidriera', [5.0, 3.9]); // junto a la vidriera, detrás del mostrador (alcance 2,2 m)
      var bench = g.world.interactables.filter(function (o) { return o.userData.interact.kind === 'banco'; })[0];
      tap(bench, 'banco', [-3.2, 2.4]);
      g.pasillo.unlock(true); g.pasillo.go(); step(ctx, 40);
      var sink = g.world.interactables.filter(function (o) { return o.userData.interact.kind === 'lavabo'; })[0];
      var sp = sink.getWorldPosition(new THREE.Vector3());
      tap(sink, 'lavabo', [sp.x - 1.1, sp.z + 0.4]);
      g.pasillo.go(); step(ctx, 40);
      g.bosque.go(); step(ctx, 40);
      g.world.forest.loneDryer.visible = true;
      g.world.forest.bell.visible = true;
      var ld = g.world.forest.loneDryer.position;
      tap(g.world.forest.lonePort, 'secadoraSola', [ld.x + 1.0, ld.z + 1.6]);
      var bp = g.world.forest.bell.position;
      tap(g.world.forest.bellCup, 'campana', [bp.x - 1.4, bp.z - 1.8]);
      noErrors(ctx);
      return '6 objetos tocables';
    }],

    ['El amanecer en Blackwood: tras el final verdadero, la lavandería a oscuras, la avenida de día y la puerta a la calle', async function () {
      var ctx = await load();
      var g = ctx.g;
      var city = g.world.city;
      var sub = function () { return ctx.w.document.getElementById('subtitulos').textContent; };
      ctx.w.dispatchEvent(new ctx.w.PointerEvent('pointerdown'));
      start(ctx);
      g.horror.placeCustomer('banco'); g.horror.customer.present = true;
      g.bosque.found = [true, true, true, true, true, true];
      g._ask(); g._answer(4);
      await wait(1500);
      g.bosque.go(); step(ctx, 40);
      g.bosque.touchWasher(); step(ctx, 30 * 4);
      check(g.epilogue && g.state === 'playing' && !g.bosque.outside, 'no volvió a la lavandería al amanecer');
      check(sub().indexOf('luz de la mañana') >= 0, 'faltó el aviso del amanecer');
      step(ctx, 30 * 10);
      check(g.minutes === 313 && g.state === 'playing', 'el reloj siguió o el turno terminó solo (' + g.minutes + ')');
      check(g.retro.lightFactor.every(function (f) { return f === 0; }), 'las luces siguen prendidas');
      check(g.ciudad.dawn && city.signs.farmacia.uniforms.uEmissive.value === 0 && !city.rain.visible, 'la avenida no amaneció');
      check(city.water.position.y < -0.5, 'el agua no bajó');
      check(!g.horror.customer.present && !g.clientela.visitors.length, 'hay alguien en la lavandería');
      g.gameplay._begin({ kind: 'salirBosque', index: 0 }, g.input);
      step(ctx, 5);
      var title = ctx.w.document.getElementById('final-titulo').textContent;
      check(g.state === 'ended' && g.ending === 'verdadero' && title === ctx.w.MR.HISTORIA.verdadero.titulo, 'la puerta no llevó al final verdadero (' + title + ')');
      noErrors(ctx);
      return '05:13 · luces apagadas · farmacia apagada · la calle';
    }],

    ['Vida conectada: Pelusa bufa a las máscaras y acompaña a las caras; la cara cruza la avenida; la vigía', async function () {
      var ctx = await load();
      var g = ctx.g;
      var c = g.clientela;
      var cat = g.gato;
      var sub = function () { return ctx.w.document.getElementById('subtitulos').textContent; };
      start(ctx);
      c.plan = [];
      g.horror.customer.present = false;
      g.player.pos.set(-6, 0, 2.5);
      // Pelusa y la máscara: ponla en el camino al mostrador.
      cat._placeAtPerch('mostrador'); cat._jump(null, true); step(ctx, 30);
      cat.mesh.root.position.set(3.0, 0, 3.0); cat.node = 'F4'; cat.state = 'sentado'; cat.timer = 99;
      var m = c.spawn('mascara');
      var hissed = false;
      for (var i = 0; i < 30 * 12 && !hissed; i += 1) { step(ctx, 1); hissed = cat.hisses > 0; }
      check(hissed, 'Pelusa no le bufó a la máscara');
      for (var j = 0; j < 30 * 30 && c.visitors.length; j += 1) { step(ctx, 1); }
      // La cara blanca cruza la avenida antes de entrar.
      g.gameplay.washers.forEach(function (w) { w.running = false; w.credit = false; });
      c.plan = [{ at: 0, kind: 'cara' }];
      step(ctx, 1);
      check(c.approach && c.approach.model.group.position.z > 9, 'no empezó a cruzar la avenida');
      for (var k = 0; k < 30 * 12 && c.approach; k += 1) { step(ctx, 1); }
      check(!c.approach && c.visitors.length === 1, 'no entró después de cruzar');
      var face = c.visitors[0];
      for (var q = 0; q < 30 * 30 && face.state !== 'llego'; q += 1) { step(ctx, 1); }
      // Pelusa la acompaña (forzando su decisión, a una hora en que está despierta: 02:10, acicalarse).
      g.minutes = 130;
      var rnd = ctx.w.Math.random;
      ctx.w.Math.random = function () { return 0.01; };
      cat.state = 'sentado'; cat.timer = 0; cat.perch = null; step(ctx, 1);
      ctx.w.Math.random = rnd;
      for (var r = 0; r < 30 * 25 && sub().indexOf('Pelusa se sienta junto') < 0; r += 1) { step(ctx, 1); }
      check(sub().indexOf('Pelusa se sienta junto') >= 0, 'Pelusa no acompañó a la cara blanca');
      // La vigía: aparece sin mirar la vidriera, se nota al mirar y se va al apartar la vista.
      g.minutes = 200;
      g.player.blink.phase = 'open'; g.player.blink.amount = 0; g.player.blink.timer = 999;
      g.player.pos.set(4.6, 0, 1.2);
      var toward = Math.atan2(-(4.7 - 4.6), -(5.0 - 1.2));
      g.player.yaw = toward + Math.PI; g.player.pitch = 0;
      g.horror.schedule('vigia', 'vidriera', 1);
      step(ctx, 10);
      check(c.watcher && c.watcher.group.visible, 'no apareció la vigía');
      g.player.yaw = toward; step(ctx, 3);
      check(sub().indexOf('mira hacia la lavandería') >= 0, 'no notó a la vigía');
      g.player.yaw = toward + Math.PI; step(ctx, 90);
      check(!c.watcher.group.visible, 'la vigía no se fue');
      noErrors(ctx);
      return 'bufido · cruce · compañía · vigía';
    }],

    ['Secreto: la campana de la escuela (tercera vuelta) trae a una máscara con la ORDEN N.º 22', async function () {
      var ctx = await load();
      var g = ctx.g;
      var b = g.bosque;
      var sub = function () { return ctx.w.document.getElementById('subtitulos').textContent; };
      start(ctx);
      g.clientela.plan = [];
      b.go(); step(ctx, 40);
      b.wraps = 2;
      g.player.blink.phase = 'open'; g.player.blink.amount = 0; g.player.blink.timer = 999;
      g.player.pos.set(2, 0, 147.9); g.player.yaw = Math.PI; g.player.pitch = 0;
      for (var i = 0; i < 90 && b.wraps < 3; i += 1) { g.input.keys.add('KeyW'); step(ctx, 1); }
      g.input.keys.delete('KeyW');
      check(b.wraps === 3 && g.world.forest.bell.visible, 'no apareció la campana en la tercera vuelta');
      b.ringBell();
      check(sub().indexOf('bajo el agua') >= 0 && g.logros.has('campana'), 'la campana no sonó');
      check(g.clientela.pendingOrder !== null && g.clientela.pendingOrder !== undefined, 'no quedó pendiente la orden');
      b.go(); step(ctx, 40);
      g.player.pos.set(-5, 0, -1);
      var m = g.clientela.visitors.filter(function (v) { return v.kind === 'mascara'; })[0];
      check(m && m.forcedOrder !== undefined, 'no vino la máscara');
      for (var k = 0; k < 30 * 30 && m.state !== 'llego'; k += 1) { step(ctx, 1); }
      await wait(1100);
      check(sub().indexOf('N.º 22') >= 0, 'la orden no fue la 22 (' + sub().slice(-90) + ')');
      noErrors(ctx);
      return 'campana → ORDEN N.º 22';
    }],

    ['Anomalía: «1986» en el vaho de la vidriera, escrito desde afuera, solo sin mirar', async function () {
      var ctx = await load();
      var g = ctx.g;
      var h = g.horror;
      var wr = g.world.fogWriting;
      var sub = function () { return ctx.w.document.getElementById('subtitulos').textContent; };
      start(ctx);
      g.clientela.plan = [];
      g.player.blink.phase = 'open'; g.player.blink.amount = 0; g.player.blink.timer = 999;
      g.player.pos.set(4.2, 0, 2.6);
      var toward = Math.atan2(-(wr.position.x - 4.2), -(wr.position.z - 2.6));
      g.player.yaw = toward; g.player.pitch = 0.1;
      step(ctx, 2);
      check(h.zoneVisible('vidriera') > 0.4, 'la vidriera no estaba a la vista');
      h.schedule('vidriera_escrita', 'vidriera', 1);
      step(ctx, 20);
      check(!wr.visible, 'apareció mientras mirabas');
      g.player.yaw = toward + Math.PI;
      step(ctx, 20);
      check(wr.visible, 'no apareció de espaldas');
      g.player.yaw = toward;
      step(ctx, 3);
      check(sub().indexOf('Lo escribieron desde afuera') >= 0, 'no lo notó');
      g.player.yaw = toward + Math.PI;
      step(ctx, 30 * 42);
      check(!wr.visible, 'la lluvia no lo borró');
      noErrors(ctx);
      return 'aparece a espaldas, se nota y se borra';
    }],

    ['Conversar con una cara blanca: preguntas, respuestas, el Archivo y la prioridad de la pregunta de la hora', async function () {
      var ctx = await load();
      var g = ctx.g;
      var c = g.clientela;
      var d = ctx.w.document;
      var sub = function () { return d.getElementById('subtitulos').textContent; };
      var opts = function () { return d.querySelectorAll('#dialogo-opciones li').length; };
      start(ctx);
      c.plan = [];
      delete g.objetos.got.placa; g.historial.d.finales.verdadero = 0; // sin lo que dejaron otras pruebas (preguntas nuevas)
      g.player.pos.set(-6, 0, 2.5);
      g.gameplay.washers.forEach(function (w) { w.running = false; w.credit = false; });
      var v = c.spawn('cara');
      for (var i = 0; i < 30 * 30 && v.state !== 'llego'; i += 1) { step(ctx, 1); }
      g.player.pos.set(v.model.group.position.x + 1, 0, v.model.group.position.z + 1.5);
      c.talk(v.id);
      check(g.dialog && !d.getElementById('dialogo').hidden && opts() === 5, 'no se abrió la conversación (' + opts() + ' opciones)');
      g.answerChoice(2); // ¿Qué pasó en 1986?
      check(sub().indexOf('Una cara blanca') >= 0, 'no respondió');
      check(Object.keys(g.archivo.data.charla).some(function (k) { return k.indexOf('1986') === 0; }), 'la respuesta no quedó en el Archivo');
      await wait(3700);
      check(g.dialog && opts() === 4, 'no volvió a preguntar (' + opts() + ' opciones)');
      step(ctx, 30 * 12);
      check(c.visitors.indexOf(v) >= 0, 'se fue a mitad de la conversación');
      g.input.pressed.add('Digit4'); step(ctx, 1); // «(Dejarla en paz.)» con el teclado
      check(!g.dialog && v.talked && d.getElementById('dialogo').hidden, 'no terminó la conversación');
      // La pregunta de la hora corta cualquier conversación.
      var v2 = c.spawn('cara');
      for (var j = 0; j < 30 * 30 && v2.state !== 'llego'; j += 1) { step(ctx, 1); }
      g.player.pos.set(v2.model.group.position.x + 1, 0, v2.model.group.position.z + 1.5);
      c.talk(v2.id);
      check(g.dialog, 'no abrió la segunda conversación');
      g.horror.placeCustomer('banco'); g.horror.customer.present = true;
      g._ask();
      check(!g.dialog && g.question && /Cliente|Customer/.test(d.getElementById('dialogo-pregunta').textContent), 'la pregunta de la hora no tuvo prioridad');
      noErrors(ctx);
      return Object.keys(g.archivo.data.charla).length + ' respuesta(s) en el Archivo';
    }],

    ['La charla recuerda tu noche: preguntas nuevas si Pelusa la acompañó, si viste a la vigía, si tienes la placa o viste la mañana', async function () {
      var ctx = await load();
      var g = ctx.g;
      var c = g.clientela;
      var d = ctx.w.document;
      var sub = function () { return d.getElementById('subtitulos').textContent; };
      var items = function () { return Array.prototype.map.call(d.querySelectorAll('#dialogo-opciones li'), function (li) { return li.textContent; }); };
      start(ctx);
      c.plan = [];
      g.player.pos.set(-6, 0, 2.5);
      g.gameplay.washers.forEach(function (w) { w.running = false; w.credit = false; });
      var total = g.archivo.total();
      delete g.objetos.got.placa; g.historial.d.finales.verdadero = 0; // sin lo que dejaron otras pruebas
      var v = c.spawn('cara');
      for (var i = 0; i < 30 * 30 && v.state !== 'llego'; i += 1) { step(ctx, 1); }
      g.player.pos.set(v.model.group.position.x + 1, 0, v.model.group.position.z + 1.5); // cerca: a más de 4 m deja la charla
      // Una noche sin nada especial: las cuatro de siempre.
      c.talk(v.id);
      check(items().length === 5, 'sin nada especial no debería haber preguntas nuevas (' + items().length + ')');
      g.closeDialog(); v.talked = false; v.talking = false;
      // Pelusa se sentó a su lado y viste a la vigía: dos preguntas nuevas, primero.
      v.catSat = true;
      c.watcherNoticed = true;
      g.objetos.got.placa = 1;
      c.talk(v.id);
      var list = items();
      check(list.length === 7 && /Pelusa/.test(list[0]) && /otra vereda/.test(list[1]), 'faltan las preguntas nuevas: ' + list.join(' | '));
      g.answerChoice(1);
      check(sub().indexOf('Una cara blanca') >= 0, 'no respondió de Pelusa');
      check(Object.keys(g.archivo.data.charla).some(function (k) { return k.indexOf('pelusa') === 0; }), 'la respuesta de Pelusa no quedó en el Archivo');
      await wait(3700);
      check(items().length === 6 && /otra vereda/.test(items()[0]), 'no siguió con la otra pregunta nueva: ' + items().join(' | ') + ' · diálogo ' + !!g.dialog + ' · hablando ' + v.talking);
      g.closeDialog(); v.talked = false; v.talking = false;
      // Sin Pelusa ni vigía, con la placa: la pista del puente.
      v.catSat = false;
      c.watcherNoticed = false;
      c.talk(v.id);
      check(/placa del puente/.test(items()[0]), 'no apareció la pregunta de la placa');
      g.answerChoice(1);
      check(/puente|bosque|bronce|embalse/.test(sub()), 'la respuesta de la placa no habla del puente: ' + sub());
      // El Archivo cuenta las doce respuestas nuevas.
      check(g.archivo.total() === total && g.archivo.view().filter(function (e) { return e.grupo === 'Lo que dijeron las caras blancas'; }).length === 24,
        'el Archivo no cuenta las preguntas nuevas');
      noErrors(ctx);
      return '2 preguntas nuevas · placa → pista del puente · Archivo ' + total;
    }],

    ['Lo que la cámara ve: en una foto, la cara blanca tiene el rostro de antes (a la vista sigue lisa)', async function () {
      var ctx = await load();
      var g = ctx.g;
      var c = g.clientela;
      var sub = function () { return ctx.w.document.getElementById('subtitulos').textContent; };
      start(ctx);
      c.plan = []; c.childPlan = false; c.coinPlan = false;
      g.gato.stared = true;
      g.horror.nextEvent = 9999;
      g.gameplay.washers.forEach(function (w) { w.running = false; w.credit = false; });
      g.player.pos.set(-6, 0, 2.5);
      var v = c.spawn('cara');
      for (var i = 0; i < 30 * 30 && v.state !== 'llego'; i += 1) { g.horror.nextEvent = 9999; step(ctx, 1); }
      var lisa = v.model.face.material;
      var THREE = ctx.w.THREE;
      // De espaldas (lavando), su cara no sale en la foto.
      var hp = v.model.head.getWorldPosition(new THREE.Vector3());
      g.player.pos.set(hp.x + 0.6, 0, hp.z + 2.4);
      g.player.yaw = Math.atan2(-(hp.x - g.player.pos.x), -(hp.z - g.player.pos.z));
      g.player.pitch = Math.atan2(hp.y - 1.62, Math.hypot(hp.x - g.player.pos.x, hp.z - g.player.pos.z));
      g.player.blink.phase = 'open'; g.player.blink.amount = 0; g.player.blink.timer = 999;
      step(ctx, 2);
      var espalda = g.fotos.take({ ghost: false });
      check(espalda && espalda.caras === 0, 'contó una cara que estaba de espaldas');
      // Cuando se va, camina hacia la puerta: de frente a ti, que esperas junto a la entrada.
      c._leave(v);
      g.player.pos.set(1.6, 0, 4.0);
      for (var k = 0; k < 30 * 20 && v.model.group.position.z < 0.6; k += 1) { g.horror.nextEvent = 9999; step(ctx, 1); }
      hp = v.model.head.getWorldPosition(new THREE.Vector3());
      g.player.yaw = Math.atan2(-(hp.x - g.player.pos.x), -(hp.z - g.player.pos.z));
      g.player.pitch = Math.atan2(hp.y - 1.62, Math.hypot(hp.x - g.player.pos.x, hp.z - g.player.pos.z));
      g.fotos.cooldown = 0;
      var foto = g.fotos.take({ ghost: false });
      check(foto && foto.caras === 1, 'la foto no registró la cara (' + (foto && foto.caras) + ')');
      check(v.model.face.material === lisa, 'a la vista la cara no volvió a ser lisa');
      await wait(1000);
      check(sub().indexOf('tiene ojos, nariz y boca') >= 0 && g.logros.has('retrato'), 'faltó el subtítulo o el logro');
      noErrors(ctx);
      return 'foto con el rostro de antes · a la vista, lisa · logro «Retrato»';
    }],

    ['Lo que la cámara ve (2): las máscaras no salen en las fotos; los pasajeros del 86 tienen cara', async function () {
      var ctx = await load();
      var g = ctx.g;
      var c = g.clientela;
      var THREE = ctx.w.THREE;
      var sub = function () { return ctx.w.document.getElementById('subtitulos').textContent; };
      function mirar(p) {
        g.player.yaw = Math.atan2(-(p.x - g.player.pos.x), -(p.z - g.player.pos.z));
        g.player.pitch = Math.atan2(p.y - 1.62, Math.hypot(p.x - g.player.pos.x, p.z - g.player.pos.z));
      }
      start(ctx);
      c.plan = []; c.childPlan = false; c.coinPlan = false;
      g.gato.stared = true;
      g.horror.nextEvent = 9999;
      g.ciudad.busPlan = []; g.ciudad.sweepAt = null;
      g.player.blink.phase = 'open'; g.player.blink.amount = 0; g.player.blink.timer = 999;
      // Una máscara en el mostrador: en la foto, no hay nadie.
      var m = c.spawn('mascara');
      for (var i = 0; i < 30 * 30 && m.state !== 'llego'; i += 1) { g.horror.nextEvent = 9999; step(ctx, 1); }
      g.player.pos.set(3.2, 0, 2.6);
      mirar(m.model.head.getWorldPosition(new THREE.Vector3()));
      step(ctx, 2);
      var foto = g.fotos.take({ ghost: false });
      check(foto.mascaras === 1 && m.model.group.visible, 'la máscara salió en la foto (o no volvió a verse): ' + foto.mascaras);
      await wait(1000);
      check(sub().indexOf('Frente al mostrador no hay nadie') >= 0, 'faltó el subtítulo de la máscara');
      c._remove(m);
      // El 86 detenido enfrente: en la foto, sus pasajeros tienen cara.
      var riders = g.world.city.busRiders;
      var mat = riders.material;
      g.ciudad.busPlan = [g.minutes];
      g.player.pos.set(5.0, 0, 3.3);
      for (var k = 0; k < 30 * 15 && g.ciudad.bus.phase !== 'parado'; k += 1) { g.horror.nextEvent = 9999; step(ctx, 1); }
      mirar(new THREE.Vector3(g.world.city.bus.position.x, 1.8, 10.3));
      step(ctx, 2);
      g.fotos.cooldown = 0;
      foto = g.fotos.take({ ghost: false });
      check(foto.caras >= 5 && riders.material === mat, 'los pasajeros no salieron con cara (' + foto.caras + ')');
      await wait(1800);
      check(sub().indexOf('los pasajeros del 86 tienen cara') >= 0, 'faltó el subtítulo del 86');
      noErrors(ctx);
      return 'máscara ausente en la foto · pasajeros con cara';
    }],

    ['Lenguaje corporal de Pelusa: las orejas se orientan hacia lo que oye, la cola se agita y te saluda si te tiene cariño', async function () {
      async function preparar(carino) {
        var ctx = await load();
        var g = ctx.g;
        var cat = g.gato;
        start(ctx);
        g.clientela.plan = []; cat.stared = true;
        g.horror.customer.present = false; g.horror.nextEvent = 9999;
        g.minutes = 130;
        cat.perch = null; cat.route = []; cat.state = 'sentado'; cat.timer = 999; cat.node = 'F2';
        cat.mesh.root.position.set(-1, 0, -2); cat.mesh.root.rotation.y = 0;
        g.player.pos.set(-1.2, 0, -1.0);
        g.player.blink.phase = 'open'; g.player.blink.amount = 0; g.player.blink.timer = 999;
        if (carino) { for (var i = 0; i < 3; i += 1) { cat.petCooldown = 0; cat.pet(); step(ctx, 3); } }
        return ctx;
      }
      var sub = function (ctx) { return ctx.w.document.getElementById('subtitulos').textContent; };
      var ctx = await preparar(true);
      var g = ctx.g;
      var cat = g.gato;
      // Las orejas: un sonido a su izquierda (+x; ella mira a +z).
      g.player.pos.set(-1, 0, 2.5);
      step(ctx, 20);
      g.oir(1.8, -2, 1);
      step(ctx, 6);
      var oreja = cat.mesh.ears[0].rotation.y;
      var total = cat.mesh.head.rotation.y + oreja; // las orejas cuelgan de la cabeza: suman lo que a la cabeza le falta
      check(oreja > 0.1 && total > 1.25 && cat.mesh.ears[1].rotation.y === oreja, 'las orejas no se orientaron hacia el sonido (cabeza + orejas ' + total.toFixed(2) + ')');
      // La cola se agita.
      var min = 9;
      var max = -9;
      for (var t = 0; t < 30; t += 1) { g.horror.nextEvent = 9999; step(ctx, 1); var y = cat.mesh.tail.rotation.y; min = Math.min(min, y); max = Math.max(max, y); }
      check(max - min > 0.05, 'la cola no se agita (' + (max - min).toFixed(3) + ')');
      // El saludo: lejos más de 20 s y vuelves.
      g.player.pos.set(-7, 0, 4);
      for (var k = 0; k < 30 * 22; k += 1) { g.horror.nextEvent = 9999; step(ctx, 1); }
      g.player.pos.set(-1.2, 0, -0.6);
      step(ctx, 2);
      check(cat.saludos === 1 && sub(ctx).indexOf('te recibe con un maullido') >= 0, 'no te saludó');
      noErrors(ctx);
      // Sin cariño, no saluda.
      ctx = await preparar(false);
      ctx.g.player.pos.set(-7, 0, 4);
      for (var j = 0; j < 30 * 22; j += 1) { ctx.g.horror.nextEvent = 9999; step(ctx, 1); }
      ctx.g.player.pos.set(-1.2, 0, -0.6);
      step(ctx, 2);
      check(!ctx.g.gato.saludos, 'saludó sin conocerte');
      noErrors(ctx);
      return 'cabeza + orejas ' + total.toFixed(2) + ' rad hacia el sonido · cola · saludo solo con cariño';
    }],

    ['Lo que la cámara ve (3): en la foto, la avenida está bajo el agua y bajo el puente corre un río', async function () {
      var ctx = await load();
      var g = ctx.g;
      var THREE = ctx.w.THREE;
      var sub = function () { return ctx.w.document.getElementById('subtitulos').textContent; };
      start(ctx);
      g.clientela.plan = []; g.gato.stared = true; g.horror.nextEvent = 9999;
      g.ciudad.busPlan = []; g.ciudad.sweepAt = null;
      var city = g.world.city;
      var y0 = city.water.position.y;
      g.player.pos.set(5.0, 0, 3.3); g.player.yaw = Math.PI; g.player.pitch = -0.05;
      g.player.blink.phase = 'open'; g.player.blink.amount = 0; g.player.blink.timer = 999;
      step(ctx, 2);
      var foto = g.fotos.take({ ghost: false });
      check(foto.agua && city.water.position.y === y0, 'la foto no mostró la avenida inundada (o el agua no volvió)');
      await wait(1400);
      check(sub().indexOf('la avenida está bajo el agua') >= 0, 'faltó el subtítulo de la avenida');
      // En el álbum: borde dorado y, en el visor, lo que reveló.
      var d = ctx.w.document;
      check(d.querySelector('#fotos-lista .foto-mini.revela'), 'la miniatura no lleva la marca de revelación');
      g.ui.showVisor(foto);
      check(d.getElementById('visor-pie').textContent.indexOf('la avenida bajo el agua') >= 0, 'el pie del visor no dice qué reveló: ' + d.getElementById('visor-pie').textContent);
      g.ui.showVisor(null);
      // El puente, en el bosque.
      g.bosque.go(); step(ctx, 40);
      g.bosque.showBridge();
      var f = g.world.forest;
      var lecho = f.bridgeBed.material;
      g.player.pos.set(-12, 0, 119.2); g.player.yaw = 0; g.player.pitch = -0.35;
      step(ctx, 2);
      g.fotos.cooldown = 0;
      foto = g.fotos.take({ ghost: false });
      check(foto.rio && f.bridgeBed.material === lecho, 'la foto no mostró el río (o el lecho no volvió a estar seco)');
      await wait(1100);
      check(sub().indexOf('bajo el puente corre un río') >= 0, 'faltó el subtítulo del río');
      noErrors(ctx);
      return 'avenida inundada en la foto · río bajo el puente';
    }],

    ['Pelusa al amanecer: va a la puerta de vidrio; si te tiene cariño sale contigo, si no se queda mirándote irte', async function () {
      async function amanecer(carino) {
        var ctx = await load();
        var g = ctx.g;
        start(ctx);
        g.clientela.plan = []; g.gato.stared = true;
        if (carino) {
          var b = g.gato.brain;
          var M = ctx.w.MR.Mosca;
          for (var i = 0; i < 5; i += 1) { b.limpiar(); b.contexto(M.CTX.jugador, 1); b.recompensa(1); b._tick(); }
        }
        g.flags.secreto = true;
        g.end('bosque'); // el final verdadero empieza por el amanecer
        for (var k = 0; k < 30 * 30 && !(g.gato.node === 'PU' && g.gato.timer > 100); k += 1) { step(ctx, 1); }
        check(g.epilogue && g.gato.node === 'PU' && g.gato.state === 'sentado', 'Pelusa no fue a la puerta (' + g.gato.node + ', ' + g.gato.state + ')');
        g.finishEpilogue();
        step(ctx, 5);
        var texto = g.ui.el.endText.textContent;
        noErrors(ctx);
        return { sale: g.pelusaSale, texto: texto, final: g.ending };
      }
      var con = await amanecer(true);
      check(con.final === 'verdadero' && con.sale && con.texto.indexOf('Pelusa sale contigo.') >= 0, 'con cariño no salió contigo: ' + con.texto.slice(-60));
      var sin = await amanecer(false);
      check(!sin.sale && sin.texto.indexOf('Pelusa se queda en la puerta.') >= 0, 'sin cariño: ' + sin.texto.slice(-60));
      return 'con cariño sale contigo · sin cariño se queda en la puerta';
    }],

    ['Panel «Pelusa»: la pantalla de título muestra lo que recuerda su cerebro de mosca (cariño y miedos)', async function () {
      var ctx = await load();
      var g = ctx.g;
      var d = ctx.w.document;
      var M = ctx.w.MR.Mosca;
      var lista = function () { return d.getElementById('pelusa-lista').textContent; };
      check(d.getElementById('pelusa-estado').textContent === 'no te conoce' && lista().indexOf('Todavía no te conoce') >= 0, 'sin recuerdos no dice «no te conoce»');
      start(ctx);
      g.clientela.plan = []; g.gato.stared = true;
      var cat = g.gato;
      cat.perch = null; cat.route = []; cat.state = 'sentado'; cat.timer = 99;
      cat.mesh.root.position.set(-1, 0, -2);
      g.player.pos.set(-1.2, 0, -1.2);
      for (var i = 0; i < 3; i += 1) { cat.petCooldown = 0; cat.pet(); step(ctx, 3); }
      // Un susto con una máscara cerca (directo en el cuerpo fungiforme).
      var b = cat.brain;
      b.limpiar(); b.contexto(M.CTX.mascara, 1); b.castigar(1); b._tick(); b._tick();
      cat._remember();
      noErrors(ctx);
      // Otra noche, en la pantalla de título.
      ctx = await load('?memoria');
      d = ctx.w.document;
      check(d.getElementById('pelusa-estado').textContent === 'te tiene cariño', 'el panel no muestra el cariño (' + d.getElementById('pelusa-estado').textContent + ')');
      check(lista().indexOf('Te tiene cariño') >= 0 && lista().indexOf('Le teme a las máscaras') >= 0, 'faltan recuerdos en el panel: ' + lista());
      noErrors(ctx);
      return '«no te conoce» → «te tiene cariño» · le teme a las máscaras';
    }],

    ['El oído del cerebro de mosca: Pelusa voltea hacia donde sonó algo (una secadora, el teléfono) y las caras también', async function () {
      var ctx = await load();
      var g = ctx.g;
      var h = g.horror;
      var M = ctx.w.MR.Mosca;
      var cat = g.gato;
      var c = g.clientela;
      start(ctx);
      c.plan = []; c.childPlan = false; c.coinPlan = false;
      cat.stared = true;
      h.customer.present = false;
      h.nextEvent = 9999;
      g.minutes = 130;
      cat.perch = null; cat.route = []; cat.state = 'sentado'; cat.timer = 99; cat.node = 'F2';
      cat.mesh.root.position.set(-1, 0, -2); cat.mesh.root.rotation.y = 0;
      g.player.pos.set(-6, 0, 3.5);
      function hacia(x, z, me, yaw) { return M.envolver(Math.atan2(x - me.x, z - me.z) - yaw); }
      // Un golpe en una secadora.
      h._apply({ type: 'golpe_secadora', index: 1 }, 'secadoras');
      step(ctx, 6);
      var sc = h.zones.secadoras.center;
      var esperado = hacia(sc.x, sc.z, cat.mesh.root.position, 0);
      var at = cat.brain.atencion();
      check(Math.abs(M.envolver(at.angulo - esperado)) < 0.55 && at.fuerza > 0.15, 'Pelusa no volteó hacia la secadora (' + at.angulo.toFixed(2) + ' vs ' + esperado.toFixed(2) + ')');
      // El teléfono que suena.
      step(ctx, 40);
      g.gameplay.ring(6);
      step(ctx, 8);
      var et = hacia(2.7, 4.9, cat.mesh.root.position, 0);
      at = cat.brain.atencion();
      check(Math.abs(M.envolver(at.angulo - et)) < 0.55, 'Pelusa no volteó hacia el teléfono (' + at.angulo.toFixed(2) + ' vs ' + et.toFixed(2) + ')');
      g.gameplay.phoneRinging = false; g.audio.setRinging(false);
      // Una cara blanca también voltea hacia el ruido.
      g.gameplay.washers.forEach(function (w) { w.running = false; w.credit = false; });
      var v = c.spawn('cara');
      for (var i = 0; i < 30 * 30 && v.state !== 'llego'; i += 1) { h.nextEvent = 9999; step(ctx, 1); }
      cat.mesh.root.position.set(-6, 0, 4); // Pelusa, lejos (que no le robe la atención)
      step(ctx, 30 * 2);
      var vp = v.model.group.position;
      g.oir(vp.x + 2.5, vp.z + 1.0, 1.0);
      step(ctx, 25); // gira la cabeza despacio, como todo lo que hace
      var rel = M.envolver(Math.atan2(-(2.5), -(1.0)) - v.model.group.rotation.y);
      check(Math.abs(v.model.head.rotation.y - Math.max(-1, Math.min(1, rel))) < 0.45, 'la cara blanca no volteó hacia el ruido (' + v.model.head.rotation.y.toFixed(2) + ' vs ' + rel.toFixed(2) + ')');
      noErrors(ctx);
      return 'secadora · teléfono · la cara voltea';
    }],

    ['Él: mientras no lo miras, su cabeza se inclina un poco más (nunca mientras lo ves); y de cerca, no respira', async function () {
      var ctx = await load();
      var g = ctx.g;
      var h = g.horror;
      var sub = function () { return ctx.w.document.getElementById('subtitulos').textContent; };
      start(ctx);
      g.clientela.plan = []; g.gato.stared = true;
      h.nextEvent = 9999; // sin otros sustos durante la prueba
      h.placeCustomer('mostrador'); h.customer.present = true;
      var cp = g.world.customer.group.position;
      var mirarlo = function () {
        g.player.yaw = Math.atan2(-(cp.x - g.player.pos.x), -(cp.z - g.player.pos.z));
        g.player.pitch = Math.atan2(2.0 - 1.62, Math.hypot(cp.x - g.player.pos.x, cp.z - g.player.pos.z));
      };
      g.player.pos.set(0, 0, 0);
      g.player.blink.phase = 'open'; g.player.blink.amount = 0; g.player.blink.timer = 999;
      // De espaldas a él: se inclina.
      mirarlo(); g.player.yaw += Math.PI;
      for (var i = 0; i < 30 * 25; i += 1) { h.nextEvent = 9999; step(ctx, 1); }
      var t1 = h.tilt;
      check(t1 > 0.22 && Math.abs(g.world.standingHead.rotation.z - t1) < 1e-6, 'su cabeza no se inclinó (' + (t1 || 0).toFixed(2) + ')');
      // Lo miras: lo notas, y mientras lo ves no se mueve.
      mirarlo();
      step(ctx, 3);
      check(sub().indexOf('más inclinada que antes') >= 0, 'no se notó la inclinación');
      for (var j = 0; j < 30 * 5; j += 1) { h.nextEvent = 9999; step(ctx, 1); }
      check(h.tilt === t1, 'se movió mientras lo mirabas');
      // De cerca: no respira.
      g.player.pos.set(cp.x - 0.9, 0, cp.z - 0.9);
      mirarlo();
      step(ctx, 3);
      check(sub().indexOf('No respira') >= 0, 'de cerca no notaste que no respira');
      noErrors(ctx);
      return 'inclinada ' + t1.toFixed(2) + ' rad sin mirarlo · quieta al mirarlo · no respira';
    }],

    ['Ventanas con vida: sombras que cruzan, teles que titilan y una cara blanca en una ventana (si la ves, la luz se apaga)', async function () {
      var ctx = await load();
      var g = ctx.g;
      var ci = g.ciudad;
      var Ciudad = ctx.w.MR.Ciudad;
      var sub = function () { return ctx.w.document.getElementById('subtitulos').textContent; };
      start(ctx);
      g.clientela.plan = []; g.gato.stared = true;
      ci.busPlan = []; ci.sweepAt = null; ci.ghostAt = null;
      var fs = g.world.city.facades;
      // Una sombra cruza detrás de una ventana encendida, y termina de cruzar.
      ci.faceAt = 999; ci.silTimer = 0;
      step(ctx, 2);
      var f = fs.filter(function (x) { return x.silueta; })[0];
      check(f && f.silueta.tipo === 'sombra', 'no cruzó ninguna sombra');
      var p0 = f.silueta.p;
      step(ctx, 15);
      check(!f.silueta || f.silueta.p > p0, 'la sombra no se movió');
      step(ctx, 30 * 3);
      check(!f.silueta, 'la sombra no terminó de cruzar');
      // Las teles azules titilan.
      var cambios = 0;
      var antes = fs.map(function (x) { return !!x.teleBrillo; });
      for (var t = 0; t < 30; t += 1) {
        step(ctx, 1);
        fs.forEach(function (x, i) { if (!!x.teleBrillo !== antes[i]) { cambios += 1; antes[i] = !!x.teleBrillo; } });
      }
      check(cambios > 2, 'las teles no titilan');
      // La cara blanca en una ventana: la miras, se nota, y al rato esa luz se apaga.
      ci.silTimer = 99;
      g.minutes = 200; ci.faceAt = 200;
      step(ctx, 2);
      var fc = fs.filter(function (x) { return x.silueta && x.silueta.tipo === 'cara'; })[0];
      check(fc, 'no apareció la cara blanca en una ventana');
      var idx = fc.silueta.i;
      var v = Ciudad.ventana(fc.windows[idx]);
      var wx = fc.x - ((v.x + v.s / 2) / 64 - 0.5) * fc.w;
      var wy = fc.cy + (0.5 - (v.y + v.s / 2) / 80) * fc.h;
      g.player.pos.set(5.0, 0, 2.6);
      g.player.yaw = Math.atan2(-(wx - 5.0), -(12.9 - 2.6));
      g.player.pitch = Math.atan2(wy - 1.62, Math.hypot(wx - 5.0, 12.9 - 2.6));
      g.player.blink.phase = 'open'; g.player.blink.amount = 0; g.player.blink.timer = 999;
      step(ctx, 3);
      check(ci.faceSeen && sub().indexOf('una cara blanca mira hacia la lavandería') >= 0, 'no se notó la cara en la ventana (x ' + wx.toFixed(1) + ', y ' + wy.toFixed(1) + ')');
      step(ctx, 30 * 3);
      check(!fc.silueta && fc.windows[idx].at === 2, 'la luz de esa ventana no se apagó');
      step(ctx, 30 * 2);
      check(!fs.some(function (x) { return x.silueta && x.silueta.tipo === 'cara'; }), 'la cara volvió a aparecer');
      noErrors(ctx);
      return 'sombra · teles (' + cambios + ' cambios) · cara en la ventana → luz apagada';
    }],

    ['Cerebro de mosca: Pelusa atiende lo que importa, aprende de tus caricias (y lo recuerda otra noche); las caras miran a Pelusa, nunca a ti', async function () {
      var ctx = await load();
      var g = ctx.g;
      var M = ctx.w.MR.Mosca;
      var U = ctx.w.MR.Util;
      var cat = g.gato;
      var c = g.clientela;
      start(ctx);
      c.plan = []; c.childPlan = false; c.coinPlan = false;
      cat.stared = true;
      g.horror.customer.present = false;
      g.ciudad.busPlan = []; g.ciudad.sweepAt = null;
      check(cat.brain instanceof M && cat.brain.valencia(M.CTX.jugador) === 0, 'Pelusa no tiene cerebro (o ya te conocía)');
      // 1) El anillo E-PG: la atención va hacia una máscara a su izquierda, y la cabeza la sigue.
      g.minutes = 130;
      cat.perch = null; cat.route = []; cat.state = 'sentado'; cat.timer = 99; cat.node = 'F2';
      cat.mesh.root.position.set(-1, 0, -2); cat.mesh.root.rotation.y = 0;
      g.player.pos.set(-6, 0, 3.5);
      var m = c.spawn('mascara');
      m.state = 'quieta'; // que no camine: solo está ahí
      m.model.group.position.set(2.6, 0, -2); // a +x del gato, que mira a +z: a su izquierda (+90°)
      step(ctx, 20);
      var at = cat.brain.atencion();
      check(Math.abs(at.angulo - Math.PI / 2) < 0.5 && at.fuerza > 0.12, 'no atendió a la máscara (' + at.angulo.toFixed(2) + ', ' + at.fuerza.toFixed(2) + ')');
      check(cat.mesh.head.rotation.y > 0.8, 'la cabeza no siguió a la atención (' + cat.mesh.head.rotation.y.toFixed(2) + ')');
      c._remove(m);
      // 2) El cuerpo fungiforme: tres caricias (dopamina de recompensa) y te toma cariño…
      g.player.pos.set(-1.2, 0, -1.2);
      for (var i = 0; i < 3; i += 1) { cat.petCooldown = 0; cat.pet(); step(ctx, 3); }
      var val = cat.brain.valencia(M.CTX.jugador);
      check(val > 0.25 && cat.brain.valencia(M.CTX.mascara) < 0.1, 'las caricias no le enseñaron (' + val.toFixed(2) + ')');
      // … y tuerce la rutina: a las 02:10 tocaba acicalarse, pero va hacia ti.
      g.player.pos.set(-5, 0, 3.2);
      cat.state = 'sentado'; cat.timer = 99;
      step(ctx, 15);
      cat.timer = 0;
      step(ctx, 1);
      check(cat.brainChose === 'acercarse' && cat.state === 'camina', 'no fue contigo (' + cat.brainChose + ', ' + cat.state + ', ' + cat.brain.accion() + ')');
      noErrors(ctx);
      // 3) Lo recuerda otra noche.
      ctx = await load('?memoria');
      check(ctx.g.gato.brain.valencia(M.CTX.jugador) > 0.2, 'Pelusa te olvidó');
      g = ctx.g; c = g.clientela; cat = g.gato;
      start(ctx);
      c.plan = []; c.childPlan = false; c.coinPlan = false;
      cat.stared = true;
      g.horror.customer.present = false;
      // 4) Las caras blancas miran a Pelusa, nunca a ti.
      g.gameplay.washers.forEach(function (w) { w.running = false; w.credit = false; });
      g.player.pos.set(-6, 0, 3.5);
      var v = c.spawn('cara');
      for (var k = 0; k < 30 * 30 && v.state !== 'llego'; k += 1) { step(ctx, 1); }
      var vp = v.model.group.position;
      cat.perch = null; cat.route = []; cat.state = 'sentado'; cat.timer = 99;
      cat.mesh.root.position.set(vp.x + 1.6, 0, vp.z + 0.4);
      step(ctx, 40);
      var rel = M.envolver(Math.atan2(-(cat.mesh.root.position.x - vp.x), -(cat.mesh.root.position.z - vp.z)) - v.model.group.rotation.y);
      var head = v.model.head.rotation.y;
      check(Math.abs(head - U.clamp(rel, -1, 1)) < 0.4, 'la cara blanca no mira a Pelusa (cabeza ' + head.toFixed(2) + ', Pelusa en ' + rel.toFixed(2) + ')');
      noErrors(ctx);
      // 5) Barato: diez cerebros, mil pasos.
      var t0 = ctx.w.performance.now();
      var ms = [];
      for (var b = 0; b < 10; b += 1) { ms.push(new M(b)); }
      for (var s = 0; s < 1000; s += 1) { ms.forEach(function (x) { x.limpiar(); x.estimulo(s * 0.01, 0.5); x.contexto(0, 0.5); x.pensar(0.1); }); }
      var dur = ctx.w.performance.now() - t0;
      check(dur < 200, 'el cerebro es caro (' + dur.toFixed(0) + ' ms)');
      return 'atiende a la máscara · 3 caricias → va contigo · lo recuerda · la cara mira a Pelusa · 10×1000 pasos en ' + dur.toFixed(0) + ' ms';
    }],

    ['El niño de cara blanca: llega con una cara blanca, acaricia a Pelusa, se esconde si le hablas y pregunta cosas bajito', async function () {
      var ctx = await load();
      var g = ctx.g;
      var c = g.clientela;
      var cat = g.gato;
      var sub = function () { return ctx.w.document.getElementById('subtitulos').textContent; };
      start(ctx);
      c.plan = [];
      g.gato.stared = true;
      g.horror.customer.present = false;
      g.minutes = 120;
      c.childPlan = true; c.coinPlan = false;
      g.gameplay.washers.forEach(function (w) { w.running = false; w.credit = false; });
      g.player.pos.set(-6, 0, 2.5);
      var v = c.spawn('cara');
      check(v.child && v.child.model.group.scale.x < 0.7, 'no vino con un niño');
      check(c.spawn('cara') === null || !c.visitors[1].child, 'vino un segundo niño');
      while (c.visitors.length > 1) { c._remove(c.visitors[1]); }
      for (var i = 0; i < 30 * 30 && v.state !== 'llego'; i += 1) { step(ctx, 1); }
      step(ctx, 30);
      var kp = v.child.model.group.position;
      check(v.state === 'llego' && ctx.w.MR.Util.distXZ(kp, v.model.group.position) < 0.8, 'el niño no se quedó junto a su abrigo');
      // Pelusa en el piso, cerca: el niño va, se agacha y la acaricia.
      cat.perch = null; cat.route = []; cat.state = 'sentado'; cat.timer = 99;
      cat.mesh.root.position.set(v.model.group.position.x + 1.0, 0, v.model.group.position.z + 0.9);
      for (var k = 0; k < 30 * 8 && !v.child.petted; k += 1) { step(ctx, 1); }
      check(v.child.petted && sub().indexOf('acaricia a Pelusa') >= 0, 'no acarició a Pelusa');
      step(ctx, 30 * 8);
      // Le hablas: primero se esconde, después te dice algo sin mirarte.
      g.gameplay.messageCooldown = {};
      c.touchChild(v.id);
      check(sub().indexOf('se esconde detrás del abrigo') >= 0, 'no se escondió');
      g.gameplay.messageCooldown = {};
      c.touchChild(v.id);
      check(sub().indexOf('El niño, sin mirarte') >= 0, 'no dijo nada después');
      // Bajito, con la cara blanca (tú, lejos).
      g.player.pos.set(-6, 0, 2.5);
      v.child.chatTimer = 0.1;
      for (var q = 0; q < 30 * 3 && sub().indexOf('El niño, bajito') < 0; q += 1) { step(ctx, 1); }
      check(sub().indexOf('El niño, bajito') >= 0, 'no le preguntó nada a la cara blanca');
      await wait(3600);
      check(sub().indexOf('al niño:') >= 0, 'la cara blanca no le contestó');
      // Se van juntos: el niño desaparece con todas sus piezas.
      var parts = v.child.model.parts;
      c._leave(v);
      for (var r = 0; r < 30 * 30 && c.visitors.length; r += 1) { step(ctx, 1); }
      check(!c.visitors.length && !v.child.model.group.parent, 'el niño se quedó en la lavandería');
      check(!g.world.interactables.some(function (o) { return parts.indexOf(o) >= 0; }), 'quedaron piezas del niño tocables');
      noErrors(ctx);
      return 'llega · acaricia a Pelusa · se esconde · habla · pregunta bajito · se van juntos';
    }],

    ['Modelos: cada uno con su material (tus manos con tu piel, las de él pálidas, su rostro) y sus piezas', async function () {
      var ctx = await load();
      var g = ctx.g;
      var T = ctx.w.MR.Textures;
      var tex = function (mesh) { return mesh.material.uniforms.map.value; };
      start(ctx);
      // Tus manos: la piel del jugador (en el Sprint 12 se pisó por error con la de él).
      check(tex(g.player.left.children[0]) === T.get('skin') && tex(g.player.right.children[0]) === T.get('skin'), 'tus manos no usan tu piel');
      // Él: manos pálidas y lisas, y el rostro nuevo solo en la cara.
      var standing = g.world.customer.standing;
      var pale = [];
      standing.traverse(function (o) { if (o.isMesh && !Array.isArray(o.material) && tex(o) === T.get('paleSkin')) { pale.push(o); } });
      check(pale.length === 2, 'él no tiene sus dos manos pálidas (' + pale.length + ')');
      var face = g.world.standingHead.material;
      check(Array.isArray(face) && face[5].uniforms.map.value === T.get('rostro'), 'su cara no usa el rostro');
      // Pelusa: orejas, collar y plaquita.
      check(g.gato.mesh.ears.length === 2, 'Pelusa sin orejas');
      // La clientela: brazos y piernas articulados.
      ['cara', 'mascara'].forEach(function (k) {
        var m = g.clientela._model(k);
        check(m.legs.length === 2 && m.armL && m.armR && m.armR.children.length >= 2, k + ': faltan articulaciones o manos');
      });
      noErrors(ctx);
      return 'manos · él · rostro · Pelusa · articulaciones';
    }],

    ['Favores y regalos: la moneda para la secadora, lo que trae Pelusa del bosque y el 86 bajo el agua', async function () {
      var ctx = await load();
      var g = ctx.g;
      var c = g.clientela;
      var d = ctx.w.document;
      var sub = function () { return d.getElementById('subtitulos').textContent; };
      start(ctx);
      c.plan = [];
      g.gato.stared = true;
      g.horror.customer.present = false;
      g.ciudad.busPlan = []; g.ciudad.sweepAt = null; g.ciudad.ghostAt = null;
      delete g.objetos.got.moneda; delete g.objetos.got.hoja_pino;
      g.minutes = 120;
      // Una cara blanca te pide una moneda; se la das: la secadora arranca sola y te deja una de las suyas.
      g.gameplay.washers.forEach(function (w) { w.running = false; w.credit = false; });
      g.gameplay.dryers.forEach(function (x) { x.running = false; });
      g.gameplay.coins = 3;
      c.coinPlan = true;
      var v = c.spawn('cara');
      for (var i = 0; i < 30 * 30 && v.state !== 'llego'; i += 1) { step(ctx, 1); }
      g.player.pos.set(v.model.group.position.x + 1, 0, v.model.group.position.z + 1.5);
      c.talk(v.id);
      check(g.dialog && /moneda/.test(d.getElementById('dialogo-pregunta').textContent), 'no pidió una moneda');
      g.answerChoice(1);
      check(g.gameplay.coins === 2 && sub().indexOf('Le das una moneda') >= 0, 'no se dio la moneda');
      await wait(2700);
      check(g.gameplay.runningDryers() === 1, 'no arrancó una secadora');
      check(g.objetos.got.moneda && sub().indexOf('Toma una de las nuestras') >= 0, 'no dejó su moneda');
      await wait(3800);
      check(g.dialog && d.querySelectorAll('#dialogo-opciones li').length >= 5, 'no siguió la charla después de la moneda');
      g.closeDialog(); v.talking = false;
      // Solo una vez por noche.
      v.talked = false;
      c.talk(v.id);
      check(!/moneda/.test(d.getElementById('dialogo-pregunta').textContent), 'pidió la moneda dos veces');
      g.closeDialog(); v.talking = false;
      noErrors(ctx);
      // Pelusa: al volver del bosque, a veces te trae algo.
      g.gato.giftOnReturn = true;
      g.bosque.go(); step(ctx, 40);
      check(g.bosque.outside, 'no salió al bosque');
      g.bosque.go(); step(ctx, 40);
      check(!g.bosque.outside && g.gato.gifted && g.objetos.got.hoja_pino, 'Pelusa no trajo nada');
      check(sub().indexOf('Pelusa dejó algo a tus pies') >= 0, 'faltó el subtítulo del regalo');
      // El 86 bajo el agua: con la avenida inundada, una franja de luz pasa por debajo.
      g.minutes = 285;
      step(ctx, 2);
      g.player.pos.set(4.6, 0, 1.2); g.player.yaw = Math.PI; g.player.pitch = -0.05;
      g.player.blink.phase = 'open'; g.player.blink.amount = 0; g.player.blink.timer = 999;
      g.ciudad.ghostAt = g.minutes;
      var city = g.world.city;
      for (var k = 0; k < 30 * 12 && !g.ciudad.ghostSeen; k += 1) { step(ctx, 1); }
      check(g.ciudad.ghostSeen && city.ghostBus.visible, 'no pasó el 86 bajo el agua');
      check(Math.abs(city.ghostBus.position.y - city.water.position.y - 0.02) < 0.001, 'la luz no va sobre el agua');
      check(sub().indexOf('como las ventanas de un autobús') >= 0, 'faltó el subtítulo');
      for (var q = 0; q < 30 * 20 && g.ciudad.ghost.active; q += 1) { step(ctx, 1); }
      check(!city.ghostBus.visible, 'la luz no terminó de pasar');
      // Sin agua suficiente, no pasa.
      g.ciudad.ghostSeen = false;
      g.minutes = 200; step(ctx, 2);
      g.ciudad.ghostAt = g.minutes; step(ctx, 2);
      check(!g.ciudad.ghost.active, 'pasó con la calle seca');
      noErrors(ctx);
      return 'moneda → secadora y moneda extranjera · Pelusa trae una aguja · el 86 bajo el agua';
    }],

    ['Radio Nocturna en vivo: boletines que comentan tu noche (el 86, el puente), solo en la 94.1 y solo mientras hay locutor', async function () {
      var B;
      var ctx;
      var g;
      var prevNights = localStorage.getItem('midnight-rinse/noches');
      var sub = function () { return ctx.w.document.getElementById('subtitulos').textContent; };
      function heard(key) { return B[key].some(function (l) { return sub().indexOf(ctx.w.MR.t(l).slice(0, 40)) >= 0; }); }
      function cross(i) { g.minutes = ctx.w.MR.Config.RADIO_BOLETINES[i] - 0.01; step(ctx, 3); }
      async function night(n) {
        localStorage.setItem('midnight-rinse/noches', String(n - 1));
        ctx = await load();
        g = ctx.g;
        B = ctx.w.MR.HISTORIA.boletines;
        start(ctx);
        g.clientela.plan = []; g.gato.stared = true;
        g.ciudad.busPlan = []; g.ciudad.sweepAt = null;
      }
      await night(1);
      // Sin sintonizar: nada.
      cross(0);
      check(!heard('apertura'), 'se oyó un boletín fuera de la 94.1');
      g.gameplay.tuneTo(94.1); step(ctx, 2);
      cross(0);
      check(heard('apertura'), 'no se oyó la apertura');
      // 02:10, con el 86 detenido esta noche: lo comenta. 03:30, con la placa puesta esta noche: lo agradece.
      g.ciudad.busStopped = true;
      cross(1);
      check(heard('bus86') && g.lastBulletin === 'bus86', 'no comentó el 86 (' + g.lastBulletin + ')');
      g.bosque.plaquePlaced = true;
      cross(2);
      check(heard('puente'), 'no agradeció la placa');
      cross(3);
      check(heard('cierre'), 'no cerró la transmisión');
      check(Object.keys(g.archivo.data.boletin).length >= 4, 'los boletines no quedaron en el Archivo');
      noErrors(ctx);
      // Una noche sin nada especial: a las 02:10 y a las 03:30, el embalse, sin repetir la misma línea.
      await night(2);
      g.gameplay.tuneTo(94.1); step(ctx, 2);
      cross(1);
      check(g.lastBulletin === 'embalse', 'a las 02:10 sin nada especial no habló del embalse (' + g.lastBulletin + ')');
      cross(2);
      var embalse = Object.keys(g.usedBulletins).filter(function (k) { return k.indexOf('embalse') === 0; });
      check(embalse.length === 2, 'repitió el mismo boletín del embalse');
      noErrors(ctx);
      // Noche 9: el locutor ya no está.
      await night(9);
      g.gameplay.tuneTo(94.1); step(ctx, 2);
      cross(0);
      check(!heard('apertura') && !g.lastBulletin, 'hubo boletín sin locutor');
      noErrors(ctx);
      if (prevNights === null) { localStorage.removeItem('midnight-rinse/noches'); } else { localStorage.setItem('midnight-rinse/noches', prevNights); }
      return 'apertura · el 86 · el puente · cierre · embalse sin repetir · noche 9 en silencio';
    }],

    ['La avenida tiene horario: del autobús 86 bajan dos caras blancas que hablan entre ellas (y se callan si te acercas); la barredora', async function () {
      var ctx = await load();
      var g = ctx.g;
      var ci = g.ciudad;
      var c = g.clientela;
      var city = g.world.city;
      var sub = function () { return ctx.w.document.getElementById('subtitulos').textContent; };
      start(ctx);
      g.horror.customer.present = false;
      g.gato.stared = true;
      g.gameplay.washers.forEach(function (w) { w.running = false; w.credit = false; });
      c.plan = [{ at: g.minutes + 20, kind: 'cara' }];
      ci.busPlan = [g.minutes];
      ci.sweepAt = null;
      // Desde adentro, mirando la vidriera grande.
      g.player.pos.set(4.6, 0, 1.2); g.player.yaw = Math.PI; g.player.pitch = 0.05;
      g.player.blink.phase = 'open'; g.player.blink.amount = 0; g.player.blink.timer = 999;
      for (var i = 0; i < 30 * 15 && ci.bus.phase !== 'parado'; i += 1) { step(ctx, 1); }
      check(ci.bus.phase === 'parado' && city.bus.visible && Math.abs(city.bus.position.x - 5.2) < 0.05, 'el 86 no se detuvo enfrente');
      check(sub().indexOf('86 · BLACKWOOD') >= 0, 'no notó el autobús');
      check(c.approach && c.approachNext && !c.plan.length, 'no bajaron dos caras del autobús');
      check(c.approach.model.group.position.x < city.bus.position.x - 3.2, 'la cara bajó atravesando el autobús');
      g.gameplay.messageCooldown = {};
      ci.look();
      check(sub().indexOf('autobús 86 espera') >= 0, 'la vidriera no habló del autobús');
      // Cruza caminando: brazos y piernas se balancean (y al llegar, quietos).
      var swing = 0;
      for (var sw = 0; sw < 12 && c.approach; sw += 1) { step(ctx, 1); swing = Math.max(swing, Math.abs(c.approach.model.legs[0].rotation.x)); }
      check(swing > 0.2, 'cruzó sin mover las piernas (' + swing.toFixed(2) + ')');
      // Cruzan, entran y ponen a lavar.
      for (var j = 0; j < 30 * 45 && !(c.visitors.length === 2 && c.visitors.every(function (v) { return v.state === 'llego'; })); j += 1) { step(ctx, 1); }
      check(c.visitors.length === 2 && c.visitors.every(function (v) { return v.state === 'llego'; }), 'no llegaron las dos (' + c.visitors.length + ')');
      check(!ci.bus.active && !city.bus.visible, 'el autobús no se fue');
      check(c.visitors.every(function (v) { return v.model.legs[0].rotation.x === 0 && v.model.armR.rotation.x === 0; }), 'siguen moviendo las piernas parados');
      // Hablan entre ellas (tú, lejos).
      for (var k = 0; k < 30 * 6 && sub().indexOf('a la otra') < 0; k += 1) { step(ctx, 1); }
      check(sub().indexOf('Una cara blanca, a la otra') >= 0, 'no hablaron entre ellas');
      check(Object.keys(g.archivo.data.entre).length >= 1, 'la conversación no quedó en el Archivo');
      await wait(3800);
      check(sub().indexOf('La otra:') >= 0, 'la otra no contestó');
      // Te acercas: se callan.
      var vp = c.visitors[0].model.group.position;
      g.player.pos.set(vp.x + 0.9, 0, vp.z + 1.2);
      step(ctx, 2);
      check(sub().indexOf('se callan cuando te acercas') >= 0, 'no se callaron');
      var hushed = c.chatTimer;
      step(ctx, 30 * 2);
      check(c.chatTimer >= 3.9 && hushed >= 3.9, 'siguieron hablando contigo al lado');
      // La barredora: cruza con su luz naranja girando.
      g.player.pos.set(4.6, 0, 1.2); g.player.yaw = Math.PI;
      ci.sweepAt = g.minutes;
      var seen = {};
      for (var q = 0; q < 30 * 30 && !ci.sweepSeen; q += 1) { step(ctx, 1); seen[city.beaconMat.uniforms.uEmissive.value] = true; }
      check(ci.sweepSeen && city.sweeper.visible, 'no pasó la barredora');
      check(seen[1.8] && seen[0.25], 'la luz de la barredora no gira');
      for (var r = 0; r < 30 * 30 && ci.sweep.active; r += 1) { step(ctx, 1); }
      check(!ci.sweep.active && !city.sweeper.visible, 'la barredora no terminó de pasar');
      noErrors(ctx);
      return '86 · dos caras · conversación · se callan · barredora';
    }],

    ['Pelusa mira el banco: se sienta frente al banco vacío; si después miras el banco, cruje', async function () {
      var ctx = await load();
      var g = ctx.g;
      var cat = g.gato;
      var sub = function () { return ctx.w.document.getElementById('subtitulos').textContent; };
      start(ctx);
      g.clientela.plan = [];
      g.horror.customer.present = false;
      g.minutes = 130;
      cat._placeAtPerch('mostrador'); cat._jump(null, true); step(ctx, 30);
      cat.mesh.root.position.set(-1.0, 0, -2.0); cat.node = 'F2'; cat.state = 'sentado'; cat.timer = 99;
      check(cat.canStare(), 'no puede ir a mirar el banco');
      g.horror._scheduleKind('pelusa_mira');
      for (var i = 0; i < 30 * 20 && cat.state !== 'mira'; i += 1) { step(ctx, 1); }
      check(cat.state === 'mira' && cat.node === 'F1', 'no fue a mirar el banco (' + cat.state + ' en ' + cat.node + ')');
      // La miras a ella (el banco queda fuera de la vista): lo notas, pero el banco todavía no cruje.
      g.player.blink.phase = 'open'; g.player.blink.amount = 0; g.player.blink.timer = 999;
      var cp = cat.mesh.root.position;
      function lookAt(x, y, z) {
        var dx = x - g.player.pos.x;
        var dz = z - g.player.pos.z;
        g.player.yaw = Math.atan2(-dx, -dz);
        g.player.pitch = Math.atan2(y - 1.62, Math.hypot(dx, dz));
      }
      g.player.pos.set(-7.2, 0, -1.2);
      lookAt(cp.x, 0.2, cp.z);
      step(ctx, 3);
      check(sub().indexOf('mira fijo el banco amarillo') >= 0, 'no notó que Pelusa mira el banco');
      step(ctx, 30 * 3);
      check(!cat.creaked && cat.state === 'mira', 'el banco crujió sin mirarlo');
      check(cat.mesh.ears.every(function (e) { return e.rotation.x < -0.5; }), 'no echó las orejas hacia atrás');
      g.gameplay.messageCooldown = {};
      cat.pet();
      check(sub().indexOf('no aparta la vista') >= 0, 'acariciarla no la distrajo (y no debía)');
      // Miras el banco: cruje, y Pelusa por fin aparta la vista.
      lookAt(-3.5, 0.6, 0.62);
      step(ctx, 2);
      check(cat.creaked && sub().indexOf('El banco cruje') >= 0, 'el banco no crujió al mirarlo');
      step(ctx, 30 * 4);
      check(cat.state !== 'mira', 'Pelusa siguió mirando el banco');
      check(!cat.stareAtBench(), 'pasó dos veces en la misma noche');
      noErrors(ctx);
      return 'mira · lo notas · cruje al mirar el banco';
    }],

    ['El puente de Blackwood: aparece en la cuarta vuelta; sin placa, el marco vacío; con la placa, el río y la cara que se inclina', async function () {
      var ctx = await load();
      var g = ctx.g;
      var f = g.world.forest;
      var THREE = ctx.w.THREE;
      var sub = function () { return ctx.w.document.getElementById('subtitulos').textContent; };
      start(ctx);
      g.clientela.plan = [];
      delete g.objetos.got.placa;
      g.bosque.go(); step(ctx, 40);
      check(g.bosque.outside && !f.bridge.visible && f.bridgeColliders.every(function (c) { return c.off; }), 'el puente ya estaba (o sus barandas chocaban)');
      // Cuarta vuelta: al fondo del sendero, el parpadeo te devuelve y aparece el puente.
      g.bosque.wraps = 3;
      g.player.pos.set(0, 0, 148.6);
      for (var i = 0; i < 30 * 3 && g.bosque.wraps < 4; i += 1) { g.player.pos.z = Math.max(g.player.pos.z, 148.6); step(ctx, 1); }
      check(g.bosque.wraps === 4 && f.bridge.visible && !f.plaque.visible, 'no apareció el puente en la cuarta vuelta');
      check(f.bridgeColliders.every(function (c) { return !c.off; }), 'las barandas no chocan');
      g.player.blink.phase = 'open'; g.player.blink.amount = 0; g.player.blink.timer = 999;
      g.player.pos.set(-12, 0, 110.5);
      step(ctx, 2);
      check(sub().indexOf('cruza un río seco') >= 0, 'no notó el puente');
      // La baranda no se atraviesa.
      g.player.pos.set(-12.62, 0, 116);
      g.player._collide([]); // la colisión se resuelve al moverse; aquí, directo
      check(Math.abs(g.player.pos.x + 12.62) > 0.1, 'se atraviesa la baranda');
      // Tocar el marco con el dedo: sin placa, vacío.
      function tap(from) {
        var t = f.bridgeFrame.getWorldPosition(new THREE.Vector3());
        g.player.pos.set(from[0], 0, from[1]);
        var dx = t.x - from[0];
        var dz = t.z - from[1];
        g.player.yaw = Math.atan2(-dx, -dz) + 0.2;
        g.player.pitch = Math.atan2(t.y - 1.62, Math.hypot(dx, dz));
        step(ctx, 1);
        var cam = g.player.camera;
        cam.updateMatrixWorld();
        var v = t.clone().project(cam);
        var hit = g.gameplay.targetAt(cam, new THREE.Vector2(v.x, v.y));
        check(hit && hit.kind === 'puente', 'no se pudo tocar el marco (tocó ' + (hit ? hit.kind : 'nada') + ')');
        g.gameplay._begin(hit, g.input);
      }
      tap([-10.3, 116.4]);
      check(!f.plaque.visible && sub().indexOf('marco vacío') >= 0, 'sin placa debía estar vacío');
      // Con la placa (la caja de la máscara): encaja, suena el río, y del otro lado una cara blanca se inclina.
      g.objetos.got.placa = 1;
      g.gameplay.messageCooldown = {};
      tap([-10.3, 116.4]);
      check(f.plaque.visible && g.logros.has('puente') && sub().indexOf('Encaja justo') >= 0, 'no se puso la placa');
      await wait(2800);
      var face = g.bosque.bowFace;
      check(face && face.group.visible && Math.abs(face.group.position.x + 12) < 0.01 && Math.abs(face.group.position.z - 116) > 2, 'no apareció la cara del otro lado');
      check(sub().indexOf('inclina la cabeza') >= 0, 'faltó el subtítulo de la cara');
      step(ctx, 30 * 13);
      check(!face.group.visible, 'la cara no se fue');
      noErrors(ctx);
      // En otra noche, el puente conserva su nombre.
      ctx = await load();
      g = ctx.g;
      start(ctx);
      g.bosque.go(); step(ctx, 40);
      g.bosque.showBridge();
      check(g.world.forest.plaque.visible, 'el puente olvidó su placa en la noche siguiente');
      noErrors(ctx);
      return 'cuarta vuelta · marco vacío · placa · río · cara · se guarda';
    }],

    ['Bosque infinito: al fondo o al costado, un parpadeo te devuelve; a la segunda vuelta, la secadora solitaria', async function () {
      var ctx = await load();
      var g = ctx.g;
      var b = g.bosque;
      var sub = function () { return ctx.w.document.getElementById('subtitulos').textContent; };
      ctx.w.dispatchEvent(new ctx.w.PointerEvent('pointerdown')); // despierta el audio (para la pista zen)
      start(ctx);
      b.go(); step(ctx, 40);
      check(b.outside, 'no salió al bosque');
      // Al fondo: camina hacia +z hasta pasar el borde.
      g.player.blink.phase = 'open'; g.player.blink.amount = 0; g.player.blink.timer = 999;
      g.player.pos.set(2, 0, 147.9); g.player.yaw = Math.PI; g.player.pitch = 0;
      var maxZ = 0;
      for (var i = 0; i < 90 && !b.wraps; i += 1) {
        g.input.keys.add('KeyW'); step(ctx, 1); maxZ = Math.max(maxZ, g.player.pos.z);
      }
      g.input.keys.delete('KeyW');
      check(b.wraps === 1 && g.player.pos.z < 112, 'no dio la vuelta por el fondo (z ' + g.player.pos.z.toFixed(1) + ', vueltas ' + b.wraps + ')');
      check(sub().indexOf('Demasiado igual') >= 0, 'faltó el aviso de la primera vuelta');
      check(!g.world.forest.loneDryer.visible, 'la secadora apareció antes de tiempo');
      // Al costado.
      g.player.pos.set(20.5, 0, 125); g.player.yaw = -Math.PI / 2;
      for (var k = 0; k < 90 && b.wraps < 2; k += 1) { g.input.keys.add('KeyW'); step(ctx, 1); }
      g.input.keys.delete('KeyW');
      check(b.wraps === 2 && g.player.pos.x < -18, 'no dio la vuelta por el costado (x ' + g.player.pos.x.toFixed(1) + ')');
      check(g.world.forest.loneDryer.visible, 'no apareció la secadora solitaria');
      g.player.pos.set(-12, 0, 127); step(ctx, 2);
      check(sub().indexOf('secadora sola') >= 0, 'no notó la secadora');
      b.touchLoneDryer();
      check(g.logros.has('solitaria') && sub().indexOf('1987') >= 0, 'tocarla no hizo nada');
      // La pista zen: suena afuera y se va al volver.
      await wait(3000);
      check(g.audio.forestBar >= 1 && g.audio.forestTimer, 'no sonó la pista del bosque (' + g.audio.forestBar + ')');
      b.go(); step(ctx, 40);
      check(!g.audio.forestTimer, 'la pista siguió en la lavandería');
      noErrors(ctx);
      return '2 vueltas · secadora · ' + g.audio.forestBar + ' compases zen';
    }],

    ['La avenida por la vidriera: autos y gente a la 01:20; vacía y bajo el agua a las 04:50', async function () {
      var ctx = await load();
      var g = ctx.g;
      var city = g.world.city;
      var ci = g.ciudad;
      var sub = function () { return ctx.w.document.getElementById('subtitulos').textContent; };
      start(ctx);
      g.clientela.plan = [];
      var cars = 0, people = 0;
      for (var i = 0; i < 30 * 60; i += 1) {
        g.minutes = 80; step(ctx, 1);
        if (city.cars.some(function (c) { return c.active; })) { cars += 1; }
        if (city.people.some(function (p) { return p.active; })) { people += 1; }
      }
      check(cars > 0 && people > 0, 'la avenida no tiene vida a la 01:20 (autos ' + cars + ', gente ' + people + ')');
      check(city.water.position.y < -0.5, 'el agua ya estaba arriba');
      var lit = city.facades.reduce(function (s, f) { return s + f.lit; }, 0);
      ci.look();
      check(sub().indexOf('despierta') >= 0, 'la vidriera no dice lo que se ve temprano');
      // 04:50: vacía, apagada y con agua.
      for (var j = 0; j < 30 * 8; j += 1) { g.minutes = 290; step(ctx, 1); }
      city.cars.forEach(function (c) { c.active = false; c.group.visible = false; });
      city.people.forEach(function (p) { p.active = false; p.group.visible = false; });
      for (var k = 0; k < 30 * 40; k += 1) { g.minutes = 290; step(ctx, 1); }
      check(!city.cars.some(function (c) { return c.active; }) && !city.people.some(function (p) { return p.active; }), 'siguió pasando gente o autos');
      check(city.water.position.y > 0.5, 'el agua no subió (' + city.water.position.y.toFixed(2) + ')');
      var litLate = city.facades.reduce(function (s, f) { return s + f.lit; }, 0);
      check(litLate < lit, 'no se apagaron ventanas (' + lit + ' → ' + litLate + ')');
      check(city.signs.tortilleria.uniforms.uEmissive.value === 0, 'la tortillería sigue encendida');
      g.gameplay.messageCooldown = {};
      ci.look();
      check(sub().indexOf('El agua ya cubre') >= 0, 'la vidriera no dice lo del agua');
      // En el bosque no se dibuja.
      g.bosque.go(); step(ctx, 40);
      check(!city.group.visible, 'la avenida se dibuja estando en el bosque');
      noErrors(ctx);
      return 'ventanas ' + lit + ' → ' + litLate + ' · agua a ' + city.water.position.y.toFixed(2) + ' m';
    }],

    ['Pelusa sigue su rutina: come, se acicala, mira por la puerta, hace la ronda, te sigue y duerme la siesta', async function () {
      var ctx = await load();
      var g = ctx.g;
      var cat = g.gato;
      start(ctx);
      g.horror.customer.present = false;
      g.clientela.plan = []; // sin visitas: Pelusa a veces las acompaña (eso tiene su propia prueba)
      g.gato.stared = true; // sin la anomalía del banco (tiene su propia prueba)
      function at(min, frames) {
        g.minutes = min;
        cat.timer = 0;
        for (var i = 0; i < frames; i += 1) { g.minutes = min; step(ctx, 1); }
      }
      var seen = {};
      at(105, 30 * 40);
      check(cat.activity === 'comer' && cat.state === 'come' && cat.node === 'PL', 'no fue a comer (' + cat.activity + ', ' + cat.state + ', ' + cat.node + ')');
      seen.comer = true;
      at(135, 30 * 2);
      check(cat.state === 'acicala', 'no se acicaló (' + cat.state + ')');
      at(165, 30 * 40);
      check(cat.state === 'ventana' && cat.node === 'PU', 'no fue a la puerta (' + cat.state + ', ' + cat.node + ')');
      var ry = cat.mesh.root.rotation.y;
      check(Math.abs(ry) < 0.01, 'no mira hacia la puerta');
      at(195, 30 * 20);
      var nodes = {};
      for (var k = 0; k < 30 * 30; k += 1) { g.minutes = 195; step(ctx, 1); nodes[cat.node] = true; }
      check(Object.keys(nodes).length >= 3, 'la ronda no recorre la sala (' + Object.keys(nodes).join(',') + ')');
      g.player.pos.set(-5.5, 0, 3.4);
      at(225, 30 * 40);
      var d = Math.hypot(cat.mesh.root.position.x - g.player.pos.x, cat.mesh.root.position.z - g.player.pos.z);
      check(d < 2.6, 'no te siguió (' + d.toFixed(1) + ' m)');
      at(255, 30 * 45);
      check(cat.state === 'duerme' && (cat.perch === 'banco' || cat.perch === 'mostrador'), 'no se fue a la siesta (' + cat.state + ', ' + cat.perch + ')');
      noErrors(ctx);
      return 'come → acicala → puerta → ronda (' + Object.keys(nodes).length + ' puntos) → te sigue (' + d.toFixed(1) + ' m) → siesta en ' + cat.perch;
    }],

    ['Blackwood: una cara blanca pone a lavar y se va; una máscara negra deja una orden impresa', async function () {
      var ctx = await load();
      var g = ctx.g;
      var c = g.clientela;
      var sub = function () { return ctx.w.document.getElementById('subtitulos').textContent; };
      start(ctx);
      c.plan = [];
      g.player.pos.set(-6, 0, 2.5); // lejos de su camino
      g.gameplay.washers.forEach(function (w) { w.running = false; w.credit = false; });
      g.gameplay.washers[2].credit = true; // la que tú preparaste no se la quita
      var v = c.spawn('cara');
      check(v && v.washer !== 2, 'eligió la lavadora con tu moneda');
      for (var i = 0; i < 30 * 30 && v.state !== 'llego'; i += 1) { step(ctx, 1); }
      check(v.state === 'llego', 'la cara blanca no llegó a la lavadora');
      check(sub().indexOf('Una cara blanca') >= 0, 'no murmuró al llegar');
      step(ctx, 30 * 3);
      check(g.gameplay.washers[v.washer].running, 'no puso a lavar');
      var drum = g.world.washers[v.washer].drum;
      var r0 = drum.rotation.z;
      step(ctx, 5);
      check(drum.visible && drum.rotation.z !== r0, 'no se ve la ropa girar por el ojo de buey');
      check(g.world.washers.filter(function (x, i) { return x.drum.visible && !g.gameplay.washers[i].running; }).length === 0, 'se ve ropa en una lavadora quieta');
      c.talk(v.id);
      check(sub().indexOf('Una cara blanca') >= 0, 'no respondió al hablarle');
      for (var j = 0; j < 30 * 40 && c.visitors.length; j += 1) { step(ctx, 1); }
      check(!c.visitors.length, 'no se fue');
      var m = c.spawn('mascara');
      for (var k = 0; k < 30 * 30 && m.state !== 'llego'; k += 1) { step(ctx, 1); }
      check(m.state === 'llego', 'la máscara no llegó al mostrador');
      await wait(1100);
      check(/ORDEN N\.º \d\d/.test(sub()), 'no salió la orden impresa');
      var orders = Object.keys(g.archivo.data.ordenes).length;
      check(orders >= 1, 'la orden no quedó en el Archivo');
      g.gameplay.messageCooldown = {};
      c.talk(m.id);
      check(sub().indexOf('No dice nada') >= 0, 'la máscara habló');
      noErrors(ctx);
      return 'lavadora ' + (v.washer + 1) + ' · ' + orders + ' orden en el Archivo';
    }],

    ['Luna llena: el tendedero con uniformes que se mecen sin viento', async function () {
      var ctx = await load();
      start(ctx);
      ctx.g.bosque.go(); step(ctx, 40);
      check(!ctx.g.world.forest.clothesline.visible, 'en noche normal no hay tendedero');
      ctx = await load('?noche=luna');
      var g = ctx.g;
      var line = g.world.forest.clothesline;
      start(ctx);
      g.bosque.go(); step(ctx, 40);
      check(line.visible, 'no apareció con luna llena');
      var lo = 9, hi = -9;
      for (var k = 0; k < 45; k += 1) {
        step(ctx, 1);
        var r = g.world.forest.shirts[0].rotation.x;
        lo = Math.min(lo, r); hi = Math.max(hi, r);
      }
      check(hi - lo > 0.05, 'los uniformes no se mecen (vaivén ' + (hi - lo).toFixed(3) + ')');
      g.player.blink.phase = 'open'; g.player.blink.amount = 0; g.player.blink.timer = 999;
      g.player.pos.set(line.position.x + 3, 0, line.position.z - 2.5);
      g.player.yaw = Math.atan2(-(line.position.x - g.player.pos.x), -(line.position.z - g.player.pos.z));
      g.player.pitch = 0;
      step(ctx, 3);
      check(ctx.w.document.getElementById('subtitulos').textContent.indexOf('tendedero') >= 0, 'no lo notó');
      noErrors(ctx);
      return 'solo con luna; se mece';
    }],

    ['El sombrero: se queda en el banco cuando se va; al verlo, el subtítulo; al parpadear, ya no está', async function () {
      var ctx = await load();
      var g = ctx.g;
      var hat = g.world.loneHat;
      start(ctx);
      g.player.blink.phase = 'open'; g.player.blink.amount = 0; g.player.blink.timer = 999;
      g.horror.placeCustomer('banco'); g.horror.customer.present = true;
      g.bosque.found = [true, true, true, true, true, true];
      g.player.pos.set(-1.5, 0, 3); g.player.yaw = Math.PI; // de espaldas al banco
      step(ctx, 2);
      g._ask(); g._answer(4);
      await wait(1500);
      check(!g.horror.customer.present && hat.visible, 'el sombrero no quedó en el banco');
      step(ctx, 5);
      check(ctx.w.document.getElementById('subtitulos').textContent.indexOf('su sombrero') < 0, 'el aviso salió sin verlo');
      g.player.yaw = Math.atan2(-(hat.position.x - g.player.pos.x), -(hat.position.z - g.player.pos.z));
      g.player.pitch = -0.35;
      step(ctx, 3);
      check(ctx.w.document.getElementById('subtitulos').textContent.indexOf('su sombrero') >= 0, 'no lo notó');
      g.player.blink.timer = 0;
      step(ctx, 6);
      check(!hat.visible, 'siguió ahí después de parpadear');
      noErrors(ctx);
      return 'queda, se nota y se va al parpadear';
    }],

    ['El cesto: se llena de uniformes solo cuando no lo miras; lleno, el subtítulo', async function () {
      var ctx = await load();
      var g = ctx.g;
      var h = g.horror;
      var b = g.world.basket.position;
      start(ctx);
      g.player.blink.phase = 'open'; g.player.blink.amount = 0; g.player.blink.timer = 999;
      g.player.pos.set(b.x + 0.4, 0, b.z + 2.2);
      var toward = Math.atan2(-(b.x - g.player.pos.x), -(b.z - g.player.pos.z));
      g.player.yaw = toward; g.player.pitch = -0.45;
      step(ctx, 2);
      check(h.zoneVisible('cesto') > 0.4, 'el cesto no estaba a la vista');
      h.schedule('cesto', 'cesto', 1);
      step(ctx, 20);
      check(!h.basketLevel, 'creció mientras lo mirabas');
      g.player.yaw = toward + Math.PI;
      for (var k = 0; k < 3; k += 1) { h.schedule('cesto', 'cesto', 1); step(ctx, 20); }
      check(h.basketLevel === 3 && g.world.basketPiles.every(function (p) { return p.visible; }), 'no se llenó (' + h.basketLevel + ')');
      g.player.yaw = toward;
      step(ctx, 3);
      check(ctx.w.document.getElementById('subtitulos').textContent.indexOf('uniformes como el tuyo') >= 0, 'no lo notó lleno');
      noErrors(ctx);
      return 'tres uniformes, solo a espaldas';
    }],

    ['Pasos arriba: quieto y en silencio, sí; caminando o con tres lavadoras, no', async function () {
      var ctx = await load();
      var g = ctx.g;
      var h = g.horror;
      start(ctx);
      g.flags.customerSeen = true;
      // Con tres lavadoras sonando: no.
      g.gameplay.washers.forEach(function (w, i) { w.running = i < 3; w.remaining = 30; });
      step(ctx, 30 * 7);
      check(!h.stepsDone, 'sonaron con tres lavadoras');
      // Caminando en silencio: no.
      g.gameplay.washers.forEach(function (w) { w.running = false; });
      g.gameplay.dryers.forEach(function (d) { d.running = false; });
      g.input.keys.add('KeyW');
      for (var i = 0; i < 30 * 7; i += 1) { g.player.yaw += 0.02; step(ctx, 1); g.input.keys.add('KeyW'); }
      g.input.keys.delete('KeyW');
      check(!h.stepsDone, 'sonaron mientras caminabas');
      // Quieto y en silencio: sí.
      step(ctx, 30 * 7);
      check(h.stepsDone, 'no sonaron quieto y en silencio');
      await wait(3500);
      check(ctx.w.document.getElementById('subtitulos').textContent.indexOf('segundo piso') >= 0, 'faltó el subtítulo');
      noErrors(ctx);
      return 'solo quieto y en silencio';
    }],

    ['El banco amarillo: frío, «no te atreves» con él sentado y tibio cuando se fue', async function () {
      var ctx = await load();
      var g = ctx.g;
      var sub = function () { return ctx.w.document.getElementById('subtitulos').textContent; };
      start(ctx);
      g.touchBench();
      check(sub().indexOf('está frío') >= 0, 'antes de que llegue debería estar frío');
      g.horror.placeCustomer('banco'); g.horror.customer.present = true; g.flags.customerSeen = true;
      g.gameplay.messageCooldown = {};
      g.touchBench();
      check(sub().indexOf('No te atreves') >= 0, 'con él sentado debería no atreverse');
      g.horror.customer.present = false;
      g.gameplay.messageCooldown = {};
      g.touchBench();
      check(sub().indexOf('tibio') >= 0, 'cuando se fue debería estar tibio');
      var kinds = g.world.interactables.filter(function (m) { return m.userData.interact.kind === 'banco'; }).length;
      check(kinds === 2, 'el banco no es tocable (' + kinds + ')');
      noErrors(ctx);
      return 'frío → no te atreves → tibio';
    }],

    ['Noche de niebla: la segunda farola retrocede y, si la pierdes de vista, se apaga', async function () {
      var ctx = await load();
      start(ctx);
      ctx.g.bosque.go(); step(ctx, 40);
      check(!ctx.g.world.forest.lamp2.visible, 'en una noche normal no hay segunda farola');
      ctx = await load('?noche=niebla');
      var g = ctx.g;
      var b = g.bosque;
      var L = g.world.forest.lamp2;
      var d = ctx.w.document;
      start(ctx);
      b.go(); step(ctx, 40);
      check(b.outside && L.visible && g.world.forest.lamp2Mat.uniforms.uEmissive.value > 1, 'no apareció encendida');
      g.player.blink.phase = 'open'; g.player.blink.amount = 0; g.player.blink.timer = 999;
      // Caminar hacia ella: siempre a ~7,5 m.
      g.player.pos.set(L.position.x + 2, 0, L.position.z - 3);
      step(ctx, 2);
      var dist = Math.hypot(L.position.x - g.player.pos.x, L.position.z - g.player.pos.z);
      check(dist > 7.3, 'te dejó acercarte (' + dist.toFixed(1) + ' m)');
      // Mirarla: el primer aviso.
      g.player.yaw = Math.atan2(-(L.position.x + 0.45 - g.player.pos.x), -(L.position.z - g.player.pos.z));
      g.player.pitch = 0.2;
      step(ctx, 30);
      check(d.getElementById('subtitulos').textContent.indexOf('otra farola') >= 0, 'no la notó');
      // Darse vuelta: se apaga. Volver a mirar: el segundo aviso.
      var yaw = g.player.yaw;
      g.player.yaw = yaw + Math.PI;
      step(ctx, 75);
      check(b.lamp2Off && g.world.forest.lamp2Mat.uniforms.uEmissive.value === 0, 'no se apagó al perderla de vista');
      g.player.yaw = yaw;
      step(ctx, 3);
      check(d.getElementById('subtitulos').textContent.indexOf('está apagada') >= 0, 'no notó que se apagó');
      noErrors(ctx);
      return 'a ' + dist.toFixed(1) + ' m; se apaga a espaldas';
    }],

    ['Radio: la dedicatoria de las noches 3 a 6 (y tu nombre entre la estática)', async function () {
      var casos = [[1, 'Pepe', false, false], [2, 'Pepe', true, true], [2, '', true, false], [7, 'Pepe', false, false]];
      for (var i = 0; i < casos.length; i += 1) {
        localStorage.setItem('midnight-rinse/noches', String(casos[i][0]));
        var ctx = await load();
        var g = ctx.g;
        ctx.w.MR.Config.DEDICATORIA_MS = 30;
        start(ctx);
        g.options.name = casos[i][1];
        g.gameplay.tuneTo(94.1);
        g.minutes = ctx.w.MR.Config.RADIO_HOST - 0.01; // tres cuadros (0,027 min de juego) cruzan las 02:40
        step(ctx, 3);
        check(g.archivo.data.radio[casos[i][0]] || casos[i][0] >= 8, 'noche ' + (casos[i][0] + 1) + ': la radio no habló');
        await wait(3700);
        var sub = ctx.w.document.getElementById('subtitulos').textContent;
        var night = casos[i][0] + 1;
        check((sub.indexOf('doblando ropa ajena') >= 0) === casos[i][2], 'noche ' + night + ': dedicatoria ' + (casos[i][2] ? 'faltó' : 'sobró'));
        check((sub.indexOf('dice tu nombre') >= 0) === casos[i][3], 'noche ' + night + ': nombre ' + (casos[i][3] ? 'faltó' : 'sobró'));
        noErrors(ctx);
      }
      localStorage.removeItem('midnight-rinse/noches');
      return 'noches 2, 3 (con y sin nombre) y 8';
    }],

    ['Huellas mojadas al volver del bosque: sin mirar el banco aparecen; al verlas, «son de tu talla»', async function () {
      var ctx = await load();
      var g = ctx.g;
      var h = g.horror;
      var fp = g.world.footprints;
      var d = ctx.w.document;
      start(ctx);
      g.player.blink.phase = 'open'; g.player.blink.amount = 0; g.player.blink.timer = 999;
      check(!h.customer.present, 'él no debería estar todavía');
      g.bosque.go(); step(ctx, 40);
      h.printsFromForest = false;
      var orig = h.onReturnFromForest.bind(h);
      h.onReturnFromForest = function () { orig(true); }; // sin azar
      g.bosque.go(); step(ctx, 40);
      check(!g.bosque.outside && h.printsFromForest, 'no las programó al volver');
      // De espaldas al banco: aparecen.
      var mid = fp.children[4].position;
      g.player.pos.set(mid.x + 1.5, 0, mid.z + 0.8);
      g.player.yaw = Math.atan2(-(mid.x - g.player.pos.x), -(mid.z - g.player.pos.z)) + Math.PI;
      step(ctx, 30);
      check(fp.visible, 'no aparecieron sin mirar el banco');
      check(d.getElementById('subtitulos').textContent.indexOf('de tu talla') < 0, 'el aviso salió sin verlas');
      g.player.yaw -= Math.PI; g.player.pitch = -0.5;
      step(ctx, 5);
      check(d.getElementById('subtitulos').textContent.indexOf('de tu talla') >= 0, 'no las notó al verlas');
      // Una vez por noche.
      h.printsFromForest = true;
      fp.visible = false;
      g.bosque.go(); step(ctx, 40); g.bosque.go(); step(ctx, 40);
      g.player.yaw += Math.PI; step(ctx, 30);
      check(!fp.visible, 'se repitieron la misma noche');
      noErrors(ctx);
      return 'oclusión, aviso y una vez por noche';
    }],

    ['Ropa doblada: aparece en el mostrador solo sin mirar; al verla, el subtítulo; tres parpadeos y ya no está', async function () {
      var ctx = await load();
      var g = ctx.g;
      var h = g.horror;
      var pile = g.world.foldedClothes;
      var d = ctx.w.document;
      start(ctx);
      g.player.blink.phase = 'open'; g.player.blink.amount = 0; g.player.blink.timer = 999;
      var c = pile.position;
      g.player.pos.set(c.x - 2.2, 0, c.z + 1.4);
      g.player.yaw = Math.atan2(-(c.x - g.player.pos.x), -(c.z - g.player.pos.z));
      g.player.pitch = -0.25;
      step(ctx, 2);
      check(h.zoneVisible('mostrador') > 0.5, 'el mostrador no estaba a la vista');
      h.schedule('ropa_doblada', 'mostrador', 1);
      step(ctx, 30);
      check(!pile.visible, 'apareció mientras mirabas');
      g.player.yaw += Math.PI;
      step(ctx, 30);
      check(pile.visible, 'no apareció de espaldas');
      check(d.getElementById('subtitulos').textContent.indexOf('dobló ropa') < 0, 'el subtítulo salió sin verla');
      g.player.yaw -= Math.PI;
      step(ctx, 3);
      check(d.getElementById('subtitulos').textContent.indexOf('dobló ropa') >= 0, 'no la notó al verla');
      g.gameplay._begin({ kind: 'ropaDoblada', index: 0 }, g.input);
      check(d.getElementById('subtitulos').textContent.indexOf('tibia') >= 0, 'tocarla no dijo nada');
      // Tres parpadeos.
      for (var b = 0; b < 3; b += 1) { g.player.blink.timer = 0; step(ctx, 12); g.player.blink.timer = 999; }
      check(!pile.visible, 'seguía ahí después de tres parpadeos');
      noErrors(ctx);
      return 'oclusión, aviso, tacto y parpadeos';
    }],

    ['La moneda de canto: solo mientras no miras el cambiador; al verla, el subtítulo; recogerla la devuelve', async function () {
      var ctx = await load();
      var g = ctx.g;
      var gp = g.gameplay;
      var h = g.horror;
      var d = ctx.w.document;
      start(ctx);
      gp.coins = 3; gp.trayCoins = 0;
      g.player.blink.phase = 'open'; g.player.blink.amount = 0; g.player.blink.timer = 999;
      // Mirando el cambiador de cerca: el susto espera.
      var c = g.world.edgeCoin.position;
      g.player.pos.set(c.x + 1.6, 0, c.z - 1.2);
      g.player.yaw = Math.atan2(-(c.x - g.player.pos.x), -(c.z - g.player.pos.z));
      g.player.pitch = -0.4;
      step(ctx, 2);
      check(h.zoneVisible('cambiador') > 0, 'el cambiador no estaba a la vista');
      h.schedule('moneda_canto', 'cambiador', 1);
      step(ctx, 30);
      check(gp.coins === 3 && !gp.edgeCoin, 'pasó mientras lo mirabas');
      // De espaldas: ahora sí.
      g.player.yaw += Math.PI;
      step(ctx, 30);
      check(gp.coins === 2 && gp.trayCoins === 1 && gp.edgeCoin && g.world.edgeCoin.visible, 'no apareció la moneda de canto');
      check(d.getElementById('subtitulos').textContent.indexOf('parada de canto') < 0, 'el subtítulo salió sin verla');
      // Al voltear y verla.
      g.player.yaw -= Math.PI;
      step(ctx, 5);
      check(d.getElementById('subtitulos').textContent.indexOf('parada de canto') >= 0, 'no notó la moneda al verla');
      gp._pickTray();
      check(gp.coins === 3 && !gp.edgeCoin && !g.world.edgeCoin.visible, 'recogerla no devolvió la moneda');
      check(d.getElementById('subtitulos').textContent.indexOf('tibia') >= 0, 'no dijo que estaba tibia');
      // Una vez por noche.
      h.schedule('moneda_canto', 'cambiador', 1);
      g.player.yaw += Math.PI;
      step(ctx, 30);
      check(gp.coins === 3, 'se repitió la misma noche');
      noErrors(ctx);
      return 'oclusión, aviso y recogida';
    }],

    ['Audio: el primer toque despierta el ambiente y un audio suspendido se reanuda', async function () {
      var ctx = await load();
      var g = ctx.g;
      check(!g.audio.ambience, 'el ambiente sonó antes de cualquier gesto');
      ctx.w.dispatchEvent(new ctx.w.PointerEvent('pointerdown'));
      check(g.audio.ctx && g.audio.ambience, 'el primer toque no despertó el audio');
      start(ctx);
      // El navegador lo suspende (llamada, otra app): el siguiente toque lo reanuda.
      var ac = g.audio.ctx;
      var resumed = 0;
      var realResume = ac.resume;
      Object.defineProperty(ac, 'state', { configurable: true, get: function () { return 'suspended'; } });
      ac.resume = function () { resumed += 1; return Promise.resolve(); };
      ctx.w.dispatchEvent(new ctx.w.Event('touchstart'));
      delete ac.state;
      ac.resume = realResume;
      check(resumed === 1, 'el toque no reanudó el audio suspendido (' + resumed + ')');
      noErrors(ctx);
      return 'contexto ' + ac.state + ' · ' + ac.sampleRate + ' Hz';
    }],

    ['Continuar turno: recuerda las fotos del álbum y los sustos ya vistos', async function () {
      var ctx = await load();
      var g = ctx.g;
      start(ctx);
      step(ctx, 5);
      check(g.fotos.take({ ghost: false }), 'no sacó la foto');
      g.tele.faceSeen = 2; g.espejo.ghosts = 1; g.espejo.noticed = true;
      check(ctx.w.MR.Partida.save(g), 'no guardó el turno');
      ctx = await load();
      ctx.w.document.getElementById('btn-continuar-turno').click();
      step(ctx, 2);
      g = ctx.g;
      check(g.state === 'playing', 'no continuó');
      check(g.fotos.areas.sala && g.fotos.tonight === 1, 'olvidó las fotos del turno (' + JSON.stringify(g.fotos.areas) + ')');
      check(g.tele.faceSeen === 2 && g.espejo.ghosts === 1 && g.espejo.noticed, 'olvidó los sustos ya vistos');
      ctx.w.MR.Partida.clear();
      noErrors(ctx);
      return 'fotos y sustos restaurados';
    }],

    ['Fotos: el álbum de la noche y Pelusa (que siempre sale movida)', async function () {
      var ctx = await load();
      var g = ctx.g;
      var THREE = ctx.w.THREE;
      start(ctx);
      step(ctx, 5);
      // Pelusa frente a la cámara.
      g.player.camera.updateMatrixWorld();
      var cam = g.player.camera;
      var dir = new THREE.Vector3(); cam.getWorldDirection(dir);
      var p = cam.getWorldPosition(new THREE.Vector3()).add(dir.multiplyScalar(2));
      g.gato.mesh.root.visible = true;
      g.gato.mesh.root.position.set(p.x, Math.max(0, p.y - 1.2), p.z);
      check(g.fotos.take({ ghost: false }), 'no sacó la foto en la sala');
      await wait(800);
      check(ctx.w.document.getElementById('subtitulos').textContent.indexOf('Pelusa sale movida') >= 0, 'no notó a Pelusa en la foto');
      g.bosque.go(); step(ctx, 40);
      g.fotos.cooldown = 0;
      check(g.fotos.take({ ghost: false }), 'no sacó la foto en el bosque');
      g.bosque.go(); step(ctx, 40);
      g.pasillo.unlock(true); g.pasillo.go(); step(ctx, 40);
      check(g.pasillo.inside, 'no entró al pasillo');
      g.fotos.cooldown = 0;
      check(!g.logros.has('album'), 'el álbum se dio antes de tiempo');
      g.fotos.take({ ghost: false });
      check(g.logros.has('album'), 'no dio el logro del álbum');
      noErrors(ctx);
      return Object.keys(g.fotos.areas).join(', ');
    }],

    ['Subtítulos con fondo oscuro (opción)', async function () {
      var ctx = await load();
      var d = ctx.w.document;
      var box = d.getElementById('opt-subs-fondo');
      check(!box.checked && !d.body.classList.contains('subs-fondo'), 'empezó con fondo');
      box.checked = true;
      box.dispatchEvent(new ctx.w.Event('input'));
      check(d.body.classList.contains('subs-fondo'), 'no puso el fondo');
      ctx.g.ui.subtitle('(prueba)', 3);
      var bg = ctx.w.getComputedStyle(d.getElementById('subtitulos')).backgroundColor;
      check(/rgba\(0, 0, 0, 0\.7/.test(bg), 'el fondo no se ve (' + bg + ')');
      ctx = await load();
      check(ctx.w.document.body.classList.contains('subs-fondo'), 'no se guardó');
      ctx.w.document.getElementById('opt-subs-fondo').checked = false;
      ctx.w.document.getElementById('opt-subs-fondo').dispatchEvent(new ctx.w.Event('input'));
      noErrors(ctx);
      return bg;
    }],

    ['Novedades: «● nuevo» hasta que abres el panel', async function () {
      localStorage.removeItem('midnight-rinse/novedades');
      var ctx = await load();
      var d = ctx.w.document;
      check(!d.getElementById('novedades-punto').hidden, 'no marcó las novedades como nuevas');
      check(d.querySelectorAll('#novedades-lista li').length === ctx.w.MR.NOVEDADES.length, 'faltan novedades en la lista');
      d.getElementById('panel-novedades').open = true;
      await wait(50); // el evento «toggle» llega después
      check(d.getElementById('novedades-punto').hidden, 'el punto no se fue al abrir');
      ctx = await load();
      check(ctx.w.document.getElementById('novedades-punto').hidden, 'volvió a marcarse como nuevo');
      noErrors(ctx);
      return ctx.w.MR.NOVEDADES.length + ' novedades';
    }],

    ['El teléfono: una llamada por noche; desde la sexta, con tu propia voz', async function () {
      var lines = [];
      var nights = [0, 3, 5, 9];
      for (var i = 0; i < nights.length; i += 1) {
        localStorage.setItem('midnight-rinse/noches', String(nights[i]));
        var ctx = await load();
        start(ctx);
        ctx.g.gameplay.phoneGhost = false;
        ctx.g.onPhoneAnswered();
        var sub = ctx.w.document.getElementById('subtitulos').textContent;
        check(ctx.g.flags.phone && sub.toLowerCase().indexOf('faltan cinco minutos para las seis') >= 0, 'noche ' + (nights[i] + 1) + ': sin la instrucción');
        lines.push(sub.slice(sub.lastIndexOf('[')));
        noErrors(ctx);
      }
      check(lines[0] !== lines[1] && lines[1] !== lines[2], 'las llamadas no cambian de noche en noche');
      check(lines[2].indexOf('con tu propia voz') >= 0 && lines[3].indexOf('con tu propia voz') >= 0, 'la sexta noche no es tu voz');
      check(lines[0].indexOf('propia voz') < 0, 'la primera noche ya era tu voz');
      var arch = ctx.g.archivo.data.telefono;
      check(arch[0] && arch[3] && arch[5] && !arch[1], 'el archivo no guardó las llamadas (' + JSON.stringify(arch) + ')');
      localStorage.removeItem('midnight-rinse/noches');
      return 'noches 1, 4, 6 y 10';
    }],

    ['Brillo: la opción levanta los oscuros (y se guarda)', async function () {
      var ctx = await load();
      var g = ctx.g;
      var d = ctx.w.document;
      start(ctx);
      step(ctx, 5);
      function mean() {
        g.retro.render(g.world.scene, g.player.camera, { blink: 0, dread: 0, time: 1, flash: 0, collapse: 0, high: 0, gamma: g.ui.options.brightness });
        var gl = g.retro.renderer.getContext();
        var w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
        var px = new Uint8Array(w * h * 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
        var s = 0;
        for (var i = 0; i < px.length; i += 16) { s += px[i] + px[i + 1] + px[i + 2]; }
        return s / (px.length / 16) / 3;
      }
      var base = mean();
      var input = d.getElementById('opt-brillo');
      input.value = '1.6';
      input.dispatchEvent(new ctx.w.Event('input'));
      check(g.ui.options.brightness === 1.6, 'la opción no cambió (' + g.ui.options.brightness + ')');
      var bright = mean();
      check(bright > base * 1.15, 'no se ve más claro (' + base.toFixed(1) + ' → ' + bright.toFixed(1) + ')');
      check(JSON.parse(localStorage.getItem('midnight-rinse/opciones')).brightness === 1.6, 'no se guardó');
      noErrors(ctx);
      return 'brillo medio ' + base.toFixed(1) + ' → ' + bright.toFixed(1);
    }],

    ['Noche de tormenta eléctrica: relámpagos seguidos y la luz parpadea con los truenos', async function () {
      var ctx = await load('?noche=tormenta');
      var g = ctx.g;
      start(ctx);
      check(g.mod === 'tormenta' && /tormenta/.test(ctx.w.document.getElementById('subtitulos').textContent), 'no avisó de la tormenta');
      step(ctx, 30 * 60);
      check(g.clima.bolts >= 3, 'pocos relámpagos en un minuto (' + g.clima.bolts + ')');
      // Un trueno cercano, adentro: alguna luz parpadea.
      g.horror.flickers = g.horror.flickers.map(function () { return 0; });
      g.clima.bolt = { t: 0, flashes: [[0, 0.09, 1]], thunderAt: 0.1, thunderVol: 1, thundered: false };
      var flick = 0;
      for (var i = 0; i < 6 && !flick; i += 1) {
        step(ctx, 8);
        flick = g.horror.flickers.filter(function (f) { return f > 0; }).length;
        if (!flick && g.clima.bolt && g.clima.bolt.thundered) { g.clima.bolt = { t: 0, flashes: [[0, 0.09, 1]], thunderAt: 0.1, thunderVol: 1, thundered: false }; }
      }
      check(flick > 0, 'las luces no parpadearon con el trueno');
      noErrors(ctx);
      return g.clima.bolts + ' relámpagos en un minuto';
    }],

    ['Noche sin agua: las lavadoras no arrancan; las secadoras y la música tapan el zumbido', async function () {
      var ctx = await load('?noche=sin_agua');
      var g = ctx.g;
      var gp = g.gameplay;
      var d = ctx.w.document;
      start(ctx);
      check(g.mod === 'sin_agua' && gp.runningWashers() === 0, 'las lavadoras siguen girando (' + gp.runningWashers() + ')');
      gp.coins = 6;
      gp._insertCoin(0);
      gp._dialClicks(gp.washers[0], [1]);
      check(!gp.washers[0].running && gp.washers[0].credit, 'la lavadora arrancó sin agua');
      check(d.getElementById('subtitulos').textContent.indexOf('no entra agua') >= 0, 'no avisó que no hay agua');
      var before = g.calmSources();
      gp._dryerCoin(0); gp._dryerCoin(1);
      gp._dryerCoin(1); // ya gira: no cobra
      check(gp.coins === 3 && g.calmSources() === before + 2, 'secadoras: monedas ' + gp.coins + ', calma ' + g.calmSources());
      gp.startDryer(2); gp.startDryer(3);
      check(g.calmSources() >= 3, 'cuatro secadoras no tapan el zumbido (' + g.calmSources() + ')');
      g.openTasks();
      var nota = d.getElementById('nota-texto').textContent;
      check(nota.indexOf('Secadoras funcionando: 4 de 4') >= 0 && nota.indexOf('✔ Secadoras') >= 0, 'tablilla: ' + nota.slice(0, 160));
      g.closeNote();
      noErrors(ctx);
      return 'calma ' + g.calmSources() + ' con 4 secadoras';
    }],

    ['La tele: su cara en la nieve solo cuando la miras de cerca', async function () {
      var ctx = await load();
      var g = ctx.g;
      var THREE = ctx.w.THREE;
      var tele = g.tele;
      start(ctx);
      step(ctx, 10);
      g.flags.customerSeen = true;
      function look(yaw, pitch) {
        g.player.yaw = yaw; g.player.pitch = pitch;
        step(ctx, 1);
        g.player.camera.updateMatrixWorld();
        tele.frame(1 / 30, 1);
      }
      // Frente a la tele, a 3 m.
      var a = tele.tv.anchor;
      a.updateMatrixWorld();
      var pos = new THREE.Vector3().setFromMatrixPosition(a.matrixWorld);
      var n = new THREE.Vector3(); a.getWorldDirection(n); n.y = 0; n.normalize();
      g.player.pos.set(pos.x + n.x * 3, 0, pos.z + n.z * 3);
      // De espaldas: armada pero no sale.
      var toTv = Math.atan2(-(pos.x - g.player.pos.x), -(pos.z - g.player.pos.z));
      tele.faceArmed = true;
      look(toTv + Math.PI, 0);
      check(!tele.faceSeen, 'salió sin mirar la tele');
      // Mirándola: busca la inclinación en que queda en pantalla.
      for (var p = -0.1; p < 0.9 && !tele.faceSeen; p += 0.1) { look(toTv, p); }
      check(tele.faceSeen === 1, 'no salió al mirar la tele');
      var peak = 0;
      for (var i = 0; i < 40; i += 1) { tele.frame(1 / 30, 1 + i / 30); peak = Math.max(peak, tele.tv.screen.material.uniforms.uFace.value); }
      check(peak > 0.9 && tele.tv.screen.material.uniforms.uFace.value === 0, 'la cara no apareció y se fue (pico ' + peak.toFixed(2) + ')');
      check(!tele.faceArmed, 'debería desarmarse');
      noErrors(ctx);
      return 'pico ' + peak.toFixed(2) + ' · ' + g.player.pos.distanceTo(pos).toFixed(1) + ' m';
    }],

    ['Fotos: P, el botón de la pausa, la galería y él en la foto', async function () {
      localStorage.removeItem('midnight-rinse/fotos');
      var ctx = await load();
      var g = ctx.g;
      var d = ctx.w.document;
      var THREE = ctx.w.THREE;
      start(ctx);
      step(ctx, 30);
      g.input.pressed.add('KeyP');
      step(ctx, 1);
      check(g.fotos.count() === 1 && /^data:image\/jpeg/.test(g.fotos.list[0].src), 'P no sacó la foto');
      check(!d.getElementById('polaroid').hidden && d.getElementById('fotos-cuenta').textContent === '1', 'no asomó la polaroid o no se contó');
      g.input.pressed.add('KeyP');
      step(ctx, 1);
      check(g.fotos.count() === 1, 'el flash debería tardar en cargar');
      // Él en la foto: busca hacia dónde hay espacio y fuerza que salga.
      g.player.pos.set(0, 0, 0.5);
      var dist = 0;
      for (var k = 0; k < 8 && !dist; k += 1) {
        g.player.yaw = k * Math.PI / 4;
        step(ctx, 1);
        g.player.camera.updateMatrixWorld();
        var dir = new THREE.Vector3();
        g.player.camera.getWorldDirection(dir); dir.y = 0; dir.normalize();
        dist = g.fotos._ghostDistance(g.player.camera, dir);
      }
      check(dist > 0, 'no hubo espacio para él en ninguna dirección');
      var visible = g.world.customer.group.visible;
      step(ctx, 60);
      var f = g.fotos.take({ ghost: true });
      check(f && f.el, 'no salió él en la foto');
      check(g.world.customer.group.visible === visible, 'él quedó visible fuera de la foto');
      await wait(1100);
      check(g.logros.has('foto') && d.getElementById('subtitulos').textContent.indexOf('Revisas la foto') >= 0, 'no reaccionó a la foto');
      // Pausa → «Sacar una foto».
      step(ctx, 60);
      g.pause();
      d.getElementById('btn-foto').click();
      step(ctx, 1);
      check(g.state === 'playing' && g.fotos.count() === 3, 'el botón de la pausa no sacó la foto (' + g.fotos.count() + ')');
      // Galería: la más nueva primero; el visor abre y Esc lo cierra.
      check(d.querySelectorAll('#fotos-lista .foto-mini').length === 3, 'miniaturas');
      d.querySelector('#fotos-lista .foto-mini').click();
      check(!d.getElementById('visor').hidden && /^data:image/.test(d.getElementById('visor-descargar').href), 'no abrió el visor');
      ctx.w.dispatchEvent(new ctx.w.KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
      check(d.getElementById('visor').hidden, 'Esc no cerró el visor');
      // Compartir: la foto viaja como JPEG (con un menú de compartir de mentira, para no abrir el del sistema).
      var file = ctx.w.MR.Fotos.toFile(g.fotos.list[2]);
      check(file.type === 'image/jpeg' && file.size > 2000 && /\.jpg$/.test(file.name), 'archivo ' + file.name + ' ' + file.size);
      var shared = null;
      Object.defineProperty(ctx.w.navigator, 'share', { configurable: true, value: function (data) { shared = data; return Promise.resolve(); } });
      Object.defineProperty(ctx.w.navigator, 'canShare', { configurable: true, value: function () { return true; } });
      g.end('fin'); step(ctx, 3);
      d.getElementById('btn-compartir').click();
      check(shared && shared.files && shared.files[0].type === 'image/jpeg' && /Midnight Rinse/.test(shared.text), 'no compartió la foto con el resultado');
      noErrors(ctx);
      return '3 fotos · él a ' + dist.toFixed(1) + ' m · ' + Math.round(g.fotos.list[0].src.length / 1024) + ' KB';
    }],

    ['Récords: turnos, mejor nota por dificultad, finales vistos y «nuevo récord»', async function () {
      localStorage.removeItem('midnight-rinse/historial');
      var ctx = await load();
      var g = ctx.g;
      var d = ctx.w.document;
      check(d.getElementById('historial-cuenta').textContent === '0/5', 'cuenta inicial ' + d.getElementById('historial-cuenta').textContent);
      start(ctx);
      g.end('fin'); step(ctx, 5); // primer turno: la una y diez, sin «nuevo récord» (no había antes)
      check(g.ending === 'bucle', 'final ' + g.ending);
      var resumen1 = d.getElementById('final-resumen').textContent;
      check(resumen1.indexOf('Nuevo récord') < 0, 'el primer turno no debería decir «nuevo récord»');
      ctx = await load();
      g = ctx.g;
      d = ctx.w.document;
      start(ctx);
      g.horror.placeCustomer('banco'); g.horror.customer.present = true;
      g.bosque.found = [true, true, true, true, true, true];
      g._ask(); g._answer(4);
      g.bosque.go(); step(ctx, 40);
      g.bosque.touchWasher(); step(ctx, 30 * 4);
      g.finishEpilogue(); step(ctx, 5);
      check(g.ending === 'verdadero', 'final ' + g.ending);
      check(d.getElementById('final-resumen').textContent.indexOf('¡Nuevo récord en Normal!') >= 0, 'no avisó del récord');
      var h = g.historial.d;
      check(h.turnos === 2 && h.finales.bucle === 1 && h.finales.verdadero === 1 && h.mejor.normal.grade === g.grade, 'historial ' + JSON.stringify(h));
      check(d.getElementById('historial-cuenta').textContent === '2/5', 'cuenta ' + d.getElementById('historial-cuenta').textContent);
      var lista = d.getElementById('historial-lista').textContent;
      check(lista.indexOf('Turnos terminados: 2') >= 0 && lista.indexOf('05:13 · Fin del turno') >= 0 && lista.indexOf('???') >= 0, 'lista: ' + lista.slice(0, 120));
      noErrors(ctx);
      return '2 turnos · mejor ' + h.mejor.normal.grade + ' (' + h.mejor.normal.score + ') · finales 2/5';
    }],

    ['Versión en inglés: menús, diálogo, tablilla, bosque y final sin textos sin traducir', async function () {
      var ctx = await load('?lang=en');
      var w = ctx.w;
      var g = ctx.g;
      var d = w.document;
      var I = w.MR.I18N;
      function sinTraducir() {
        return Object.keys(I.missing).slice(0, 4).map(function (k) { return k.replace(/[^A-Za-zÁÉÍÓÚáéíóúñÑ0-9 ,.:]/g, ' ').slice(0, 70); }).join(' / ');
      }
      check(I.lang === 'en' && d.documentElement.lang === 'en', 'no está en inglés');
      check(d.getElementById('btn-comenzar').textContent === 'Start shift', 'el botón dice ' + d.getElementById('btn-comenzar').textContent);
      check(d.getElementById('opt-idioma').value === 'en', 'el selector de idioma no marca English');
      check(!Object.keys(I.missing).length, 'HTML sin traducir: ' + sinTraducir());
      start(ctx);
      step(ctx, 60);
      g.openTasks(); g.closeNote();
      g.openNote(); g.closeNote();
      g.options.name = 'Pepe';
      for (var i = 0; i < 6; i += 1) { g.onWhisper(); }
      g.onPhoneAnswered();
      g.horror.placeCustomer('banco'); g.horror.customer.present = true;
      g._customerTalks();
      g._ask();
      var q = d.getElementById('dialogo-pregunta').textContent;
      var first = d.querySelector('#dialogo-opciones li').textContent;
      check(q.indexOf('Customer:') === 0 && /^It's /.test(first), 'diálogo: ' + q + ' | ' + first);
      g._answer(1);
      await wait(1300);
      g.logros.unlock('gato');
      g.bosque.go(); step(ctx, 40);
      g.bosque.takePage(0); g.closeNote();
      g.bosque.touchWasher(); step(ctx, 10);
      g.end('fin'); step(ctx, 10);
      var title = d.getElementById('final-titulo').textContent;
      check(title === '01:10 · Midnight shift', 'final: ' + title);
      check(/^I got /.test(g.ui.shareText()), 'compartir: ' + g.ui.shareText().slice(0, 40));
      check(!Object.keys(I.missing).length, 'sin traducir: ' + sinTraducir());
      noErrors(ctx);
      return '«' + title + '» · ' + Object.keys(w.MR.TEXTOS_EN).length + ' textos';
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

    ['Director de IA (1): las caras blancas caminan por fuerzas (nunca atraviesan nada, sin frenar en seco) y te esperan a un metro', async function () {
      var ctx = await load();
      var g = ctx.g;
      var c = g.clientela;
      var D = ctx.w.MR.Director;
      var U = ctx.w.MR.Util;
      start(ctx);
      c.plan = []; c.childPlan = false; c.coinPlan = false;
      g.horror.customer.present = false; g.horror.nextEvent = 9999; g.gato.stared = true;
      g.player.blink.phase = 'open'; g.player.blink.amount = 0; g.player.blink.timer = 999;
      g.player.pos.set(-6, 0, 2.5); g.player.yaw = Math.PI / 2; // mirando la pared del almacén: no las ves llegar
      var obst = c._obstaculos();
      check(obst.length >= 8, 'el director no tiene las cajas de la sala (' + obst.length + ')');
      var peorAcel = 0;
      var lavadoras = {};
      for (var n = 0; n < 6; n += 1) {
        g.gameplay.washers.forEach(function (x) { x.running = false; x.credit = false; });
        var v = c.spawn('cara');
        var v0 = 0;
        for (var i = 0; i < 30 * 30 && v.state !== 'llego'; i += 1) {
          step(ctx, 1);
          var p = v.model.group.position;
          check(!D.choca(p.x, p.z, obst, v.agente.radio - 0.01), 'una cara atravesó algo en (' + p.x.toFixed(2) + ', ' + p.z.toFixed(2) + ')');
          peorAcel = Math.max(peorAcel, Math.abs(v.agente.v - v0) * 30);
          v0 = v.agente.v;
        }
        check(v.state === 'llego', 'no llegó a la lavadora ' + v.washer);
        check(Math.abs(v.model.group.position.x - (-6.75 + v.washer)) < 0.06, 'no quedó frente a su lavadora');
        lavadoras[v.washer] = true;
        c._remove(v);
      }
      check(peorAcel <= 2.0 + 1e-6, 'arrancó o frenó en seco (' + peorAcel.toFixed(2) + ' m/s²)');
      // Le bloqueas la puerta cuando se va (de espaldas a ella): se detiene a un metro, ladea la cabeza y espera en
      // silencio; si te apartas, sigue y sale.
      g.gameplay.washers.forEach(function (x) { x.running = false; x.credit = false; });
      var v2 = c.spawn('cara');
      for (var a = 0; a < 30 * 30 && v2.state !== 'llego'; a += 1) { step(ctx, 1); }
      c._leave(v2);
      g.player.pos.set(0.4, 0, 4.55); g.player.yaw = Math.PI; // en la puerta, mirando hacia afuera
      var minD = 99;
      var espero = false;
      var ladeo = 0;
      for (var k = 0; k < 30 * 14; k += 1) {
        step(ctx, 1);
        minD = Math.min(minD, U.distXZ(v2.model.group.position, g.player.pos));
        if (v2.agente.esperando) { espero = true; }
        ladeo = Math.max(ladeo, v2.model.head.rotation.z);
      }
      check(espero && c.visitors.indexOf(v2) >= 0, 'no esperó');
      check(minD >= 0.9, 'se te vino encima (' + minD.toFixed(2) + ' m)');
      check(ladeo > 0.2, 'no ladeó la cabeza (' + ladeo.toFixed(2) + ')');
      g.player.pos.set(-3, 0, 3.4);
      for (var q = 0; q < 30 * 25 && c.visitors.indexOf(v2) >= 0; q += 1) { step(ctx, 1); }
      check(c.visitors.indexOf(v2) < 0, 'no salió cuando te apartaste');
      noErrors(ctx);
      return Object.keys(lavadoras).length + ' lavadoras · aceleración máx. ' + peorAcel.toFixed(2) + ' m/s² · esperó a ' + minD.toFixed(2) + ' m';
    }],

    ['Director de IA (2): si miras de golpe a una cara blanca se queda inmóvil 3–5 s; de cerca, no respira', async function () {
      var ctx = await load();
      var g = ctx.g;
      var c = g.clientela;
      start(ctx);
      c.plan = []; c.childPlan = false; c.coinPlan = false;
      g.horror.customer.present = false; g.horror.nextEvent = 9999; g.gato.stared = true;
      g.player.blink.phase = 'open'; g.player.blink.amount = 0; g.player.blink.timer = 999;
      g.gameplay.washers.forEach(function (x) { x.running = false; x.credit = false; });
      g.player.pos.set(-6, 0, 2.5); g.player.yaw = Math.PI / 2;
      var v = c.spawn('cara');
      step(ctx, 30 * 2);
      check(v.state === 'entra' && v.agente.v > 0.3, 'no venía caminando');
      // Giras de golpe hacia ella.
      var p = v.model.group.position;
      g.player.yaw = Math.atan2(-(p.x - g.player.pos.x), -(p.z - g.player.pos.z));
      step(ctx, 1);
      var x0 = p.x;
      var z0 = p.z;
      var quieta = 0;
      while (quieta < 30 * 7 && Math.hypot(p.x - x0, p.z - z0) < 1e-9) { step(ctx, 1); quieta += 1; }
      var s = quieta / 30;
      check(s >= 2.9 && s <= 5.2, 'no se quedó inmóvil de 3 a 5 s (' + s.toFixed(1) + ' s)');
      // Si la mirada llega despacio (desde la periferia), no se sobresalta.
      var otra = c.spawn('cara');
      g.player.yaw = Math.PI / 2;
      step(ctx, 30 * 2);
      var tope = otra.contempla.veces;
      var op = otra.model.group.position;
      for (var r = 0; r < 120; r += 1) { // gira despacio (0,6 rad/s) hacia ella
        var meta = Math.atan2(-(op.x - g.player.pos.x), -(op.z - g.player.pos.z));
        var dif = ctx.w.MR.Director.envolver(meta - g.player.yaw);
        g.player.yaw += Math.max(-0.02, Math.min(0.02, dif));
        step(ctx, 1);
      }
      check(otra.contempla.veces === tope, 'se congeló con una mirada lenta');
      for (var i = 0; i < 30 * 30 && !(v.state === 'llego' && otra.state === 'llego'); i += 1) { step(ctx, 1); }
      check(v.state === 'llego', 'no llegó');
      // Lejos respira (el pecho sube y baja); a menos de un metro contiene el aire.
      var zs = [];
      for (var k = 0; k < 60; k += 1) { step(ctx, 1); zs.push(v.model.chest.scale.z); }
      check(Math.max.apply(null, zs) - Math.min.apply(null, zs) > 0.004, 'no respira');
      var vp = v.model.group.position;
      g.player.pos.set(vp.x + 0.5, 0, vp.z + 0.75);
      step(ctx, 15);
      var s0 = v.model.chest.scale.z;
      step(ctx, 30);
      check(v.respira.contenida && Math.abs(v.model.chest.scale.z - s0) < 1e-9, 'siguió respirando contigo encima');
      noErrors(ctx);
      return 'inmóvil ' + s.toFixed(1) + ' s · mirada lenta: nada · contiene el aire';
    }],

    ['Director de IA (3): dos máscaras (una vigila la puerta, pasos desfasados), te siguen con el cuello y luego la máscara, y se van por la puerta trasera', async function () {
      var ctx = await load();
      var g = ctx.g;
      var c = g.clientela;
      var h = g.horror;
      var sub = function () { return ctx.w.document.getElementById('subtitulos').textContent; };
      start(ctx);
      c.childPlan = false; c.coinPlan = false;
      h.customer.present = false; h.nextEvent = 9999; g.gato.stared = true;
      g.player.blink.phase = 'open'; g.player.blink.amount = 0; g.player.blink.timer = 999;
      g.pasillo.unlock(true);
      g.player.pos.set(3.5, 0, 0.3); g.player.yaw = Math.PI; // mirando la puerta de vidrio
      c.plan = [{ at: g.minutes, kind: 'mascara', par: true }];
      step(ctx, 1);
      check(c.visitors.length === 2 && c.visitors.every(function (v) { return v.kind === 'mascara'; }), 'no vinieron dos máscaras');
      var op = c.visitors.filter(function (v) { return v.rol === 'operador'; })[0];
      var vi = c.visitors.filter(function (v) { return v.rol === 'vigia'; })[0];
      check(op && vi && op.pareja === vi, 'no se repartieron los papeles');
      step(ctx, 12);
      check(op.agente.v > 0.05 && vi.agente.v === 0, 'la segunda no esperó 0,8 s para echar a andar');
      // La mirada: el cuello gira primero; la máscara, un segundo después.
      var cuelloAntes = false;
      var ojosEn = -1;
      for (var i = 0; i < 30 * 4; i += 1) {
        step(ctx, 1);
        if (Math.abs(op.model.neck.rotation.y) > 0.15 && Math.abs(op.model.head.rotation.y) < 1e-9 && ojosEn < 0) { cuelloAntes = true; }
        if (ojosEn < 0 && Math.abs(op.model.head.rotation.y) > 0.02) { ojosEn = i + 13; }
      }
      check(cuelloAntes, 'el cuello no se adelantó a la máscara');
      check(ojosEn >= 30, 'la máscara se clavó antes del segundo (' + ojosEn + ' cuadros)');
      for (var k = 0; k < 30 * 30 && !(op.state === 'llego' && vi.state === 'llego'); k += 1) { step(ctx, 1); }
      check(op.state === 'llego' && vi.state === 'llego', 'no llegaron a sus lugares');
      check(ctx.w.MR.Util.distXZ(vi.model.group.position, { x: 1.7, z: 3.3 }) < 0.1, 'la vigía no quedó junto a la puerta');
      check(sub().indexOf('Dos máscaras') >= 0, 'no se notó que eran dos');
      // Se van por la puerta trasera (abierta desde las 03:00): la abren y la dejan entreabierta.
      g.player.pos.set(3.0, 0, -1.5);
      g.player.yaw = Math.atan2(-(6.8 - 3.0), -(-4.7 + 1.5));
      var abierta = 0;
      var sale = -1;
      for (var q = 0; q < 30 * 45 && c.visitors.length; q += 1) {
        step(ctx, 1);
        abierta = Math.min(abierta, h.backDoorTarget);
        if (sale < 0 && op.state === 'sale') { sale = q; }
        if (sale >= 0 && vi.state === 'sale' && vi.salioEn === undefined) { vi.salioEn = q; }
      }
      check(!c.visitors.length, 'no se fueron: ' + c.visitors.map(function (v) {
        var a = v.agente;
        return v.rol + ' ' + v.state + ' en (' + a.x.toFixed(2) + ', ' + a.z.toFixed(2) + ') punto ' + a.i + '/' + (a.ruta ? a.ruta.length : 0) +
          (a.ruta && a.ruta[a.i] ? ' → (' + a.ruta[a.i][0].toFixed(2) + ', ' + a.ruta[a.i][1].toFixed(2) + ')' : '') +
          ' v=' + a.v.toFixed(2) + (a.esperando ? ' esperando' : '') + (a.atascado ? ' atascado' : '') + (v.contempla.congelado > 0 ? ' congelada' : '');
      }).join(' | '));
      check(op.porAtras && vi.porAtras, 'no salieron por la puerta trasera');
      check(vi.salioEn - sale >= 20, 'salieron al unísono');
      check(abierta <= -0.55, 'no abrieron la puerta trasera');
      check(sub().indexOf('puerta trasera') >= 0, 'no se notó la salida');
      // La puerta se cierra (a su posición de siempre) cuando no la miras.
      g.player.yaw += Math.PI;
      step(ctx, 30 * 42);
      check(Math.abs(h.backDoorTarget + 0.3) < 1e-6, 'la puerta no volvió a entreabierta (' + h.backDoorTarget + ')');
      noErrors(ctx);
      return 'cuello → máscara en ' + ojosEn + ' cuadros · desfase ' + (vi.salioEn - sale) + ' cuadros · puerta trasera';
    }],

    ['Director de IA (4): si insistes, la cara blanca señala el tambor y después se inclina hacia ti sin mirarte', async function () {
      var ctx = await load();
      var g = ctx.g;
      var c = g.clientela;
      var D = ctx.w.MR.Director;
      var sub = function () { return ctx.w.document.getElementById('subtitulos').textContent; };
      start(ctx);
      c.plan = []; c.childPlan = false; c.coinPlan = false;
      g.horror.customer.present = false; g.horror.nextEvent = 9999; g.gato.stared = true;
      g.player.blink.phase = 'open'; g.player.blink.amount = 0; g.player.blink.timer = 999;
      g.gameplay.washers.forEach(function (x) { x.running = false; x.credit = false; });
      g.player.pos.set(-6, 0, 2.5); g.player.yaw = Math.PI / 2;
      var v = c.spawn('cara');
      for (var i = 0; i < 30 * 30 && v.state !== 'llego'; i += 1) { step(ctx, 1); }
      var vp = v.model.group.position;
      g.player.pos.set(vp.x + 0.6, 0, vp.z + 1.6);
      g.player.yaw = Math.atan2(-(vp.x - g.player.pos.x), -(vp.z - g.player.pos.z)) + 0.6; // cerca, sin mirarla de frente
      v.talked = true;
      g.gameplay.messageCooldown = {};
      c.talk(v.id);
      check(sub().indexOf('Ya no te responde') >= 0, 'la primera vez no siguió mirando el tambor');
      g.gameplay.messageCooldown = {};
      c.talk(v.id);
      step(ctx, 30);
      check(sub().indexOf('Señala el tambor') >= 0 && v.model.finger.visible, 'no señaló');
      check(v.model.armR.rotation.x > 1.0, 'el brazo no apunta al tambor (' + v.model.armR.rotation.x.toFixed(2) + ')');
      step(ctx, 30 * 4);
      check(!v.model.finger.visible, 'no bajó el dedo');
      g.gameplay.messageCooldown = {};
      c.talk(v.id);
      check(sub().indexOf('Se inclina hacia ti') >= 0, 'no avisó que se inclina');
      step(ctx, 30 * 6);
      var hacia = D.rumbo(g.player.pos.x - vp.x, g.player.pos.z - vp.z);
      check(v.model.group.rotation.x < -0.2, 'no se inclinó (' + v.model.group.rotation.x.toFixed(2) + ')');
      check(Math.abs(D.envolver(v.model.group.rotation.y - hacia)) < 0.5, 'no se volvió hacia ti');
      check(v.model.head.rotation.y > 0.9, 'te miró (la cabeza en ' + v.model.head.rotation.y.toFixed(2) + ')');
      check(c.visitors.indexOf(v) >= 0 && v.state === 'llego', 'se fue mientras se inclinaba');
      // Te alejas: se endereza.
      g.player.pos.set(-6, 0, 2.5);
      step(ctx, 30 * 4);
      check(v.model.group.rotation.x > -0.01, 'no se enderezó');
      noErrors(ctx);
      return 'mira el tambor → señala → se inclina (sin mirarte) → se endereza';
    }],

    ['Director de IA (5): él elige un punto ciego (nunca aparece a la vista), con modos que cambian y una pausa si lo miraste', async function () {
      var ctx = await load();
      var g = ctx.g;
      var h = g.horror;
      start(ctx);
      g.clientela.plan = []; h.nextEvent = 9999; g.gato.stared = true;
      g.player.blink.phase = 'open'; g.player.blink.amount = 0; g.player.blink.timer = 999;
      h.placeCustomer('banco'); h.customer.present = true;
      var poses = [[2, 3, Math.PI], [0, 0, 0], [-5, -2, Math.PI / 2], [5, -2, -Math.PI / 2], [0, 3, Math.PI / 4], [-3, 3, -2.5],
        [6, 0, 1.2], [-6, 3.6, 0.3], [3, -2.5, 2.6], [-1, -1, -1.9], [1.5, 2, 0.9], [-4, -2.6, 3.0]];
      var modos = {};
      var movidas = 0;
      var nulos = 0;
      poses.forEach(function (ps) {
        for (var rep = 0; rep < 3; rep += 1) {
          g.player.pos.set(ps[0], 0, ps[1]); g.player.yaw = ps[2] + rep * 0.4; g.player.pitch = 0;
          step(ctx, 2);
          h.miradoEn = -99;
          var to = h._puntoCiego();
          if (h.modoEl) { modos[h.modoEl] = true; }
          if (!to) { nulos += 1; continue; }
          check(h.zoneVisible(g.world.anchors[to].zone) === 0, 'eligió ' + to + ', que estabas viendo');
          check(to !== h.customer.anchor, 'eligió donde ya estaba');
          if (h.zoneVisible(h.customer.zone) === 0) {
            h._apply({ type: 'cliente_mueve' }, h.customer.zone);
            check(h.zoneVisible(h.customer.zone) === 0, 'apareció a la vista (' + h.customer.anchor + ')');
            movidas += 1;
          }
        }
      });
      check(movidas >= 10, 'casi no se movió (' + movidas + ')');
      check(Object.keys(modos).length >= 2, 'siempre el mismo modo (' + Object.keys(modos).join(', ') + ')');
      // Si lo acabas de mirar, no reacciona al instante.
      g.player.pos.set(2, 0, 3); g.player.yaw = Math.PI; step(ctx, 2);
      var antes = h.customer.anchor;
      h.miradoEn = h.clock;
      h._apply({ type: 'cliente_mueve' }, h.customer.zone);
      check(h.customer.anchor === antes, 'se movió sin su pausa de contemplación');
      noErrors(ctx);
      return movidas + ' movidas, todas a puntos ciegos · modos: ' + Object.keys(modos).join(', ') + ' · ' + nulos + ' veces esperó';
    }],

    ['Director de IA (6): a veces él deja un señuelo donde estaba parado (una moneda mojada, un ticket doblado)', async function () {
      var ctx = await load();
      var g = ctx.g;
      var h = g.horror;
      var sub = function () { return ctx.w.document.getElementById('subtitulos').textContent; };
      start(ctx);
      g.clientela.plan = []; h.nextEvent = 9999; g.gato.stared = true;
      g.player.blink.phase = 'open'; g.player.blink.amount = 0; g.player.blink.timer = 999;
      h.placeCustomer('secadoras'); h.customer.present = true;
      var donde = g.world.customer.group.position.clone();
      var rnd = ctx.w.Math.random;
      ctx.w.Math.random = function () { return 0.1; };
      h._moverEl('banco');
      ctx.w.Math.random = rnd;
      var d = g.world.decoys.moneda.visible ? g.world.decoys.moneda : g.world.decoys.ticket;
      check(d.visible && ctx.w.MR.Util.distXZ(d.position, donde) < 0.15, 'no dejó nada donde estaba parado');
      check(h.customer.anchor === 'banco', 'no se movió');
      // Lo ves de cerca: el subtítulo; dos parpadeos después ya no está.
      g.player.pos.set(donde.x - 1.2, 0, donde.z + 1.2);
      g.player.yaw = Math.atan2(-(donde.x - g.player.pos.x), -(donde.z - g.player.pos.z));
      g.player.pitch = -0.5;
      step(ctx, 3);
      check(/moneda mojada|ticket doblado/.test(sub()), 'no lo notaste');
      g.player.forceBlink(); step(ctx, 12);
      g.player.forceBlink(); step(ctx, 12);
      check(!d.visible, 'el señuelo no desapareció');
      noErrors(ctx);
      return (d === g.world.decoys.moneda ? 'moneda mojada' : 'ticket doblado') + ' → visto → desapareció';
    }],

    ['Director de IA (7): en el bosque él se esconde detrás de los pinos y se corre de lado para que siempre haya un tronco entre los dos', async function () {
      var ctx = await load();
      var g = ctx.g;
      var h = g.horror;
      var D = ctx.w.MR.Director;
      start(ctx);
      g.clientela.plan = []; h.nextEvent = 9999; g.gato.stared = true;
      h.placeCustomer('banco'); h.customer.present = true;
      g.bosque.go(); step(ctx, 40);
      g.player.blink.phase = 'open'; g.player.blink.amount = 0; g.player.blink.timer = 999;
      var arboles = g.world.forest.treePos;
      check(arboles && arboles.length > 100, 'el bosque no expone sus pinos');
      h.placeCustomer('bosque_b');
      var pos = g.world.customer.group.position;
      g.player.pos.set(0.3, 0, 108); g.player.yaw = 0; g.player.pitch = 0; // de espaldas al bosque
      step(ctx, 30 * 3);
      function ojos() { return { x: g.player.pos.x, z: g.player.pos.z, yaw: g.player.yaw }; }
      check(h.arbol >= 0 && D.tapado(ojos(), pos, arboles, 0.2), 'no se escondió detrás de un pino');
      // Caminas de lado por el sendero sin mirarlo: se corre y sigue tapado.
      var tapados = 0;
      for (var i = 0; i < 6; i += 1) {
        g.player.pos.x += 0.5; g.player.pos.z += 1.2;
        step(ctx, 30);
        if (D.tapado(ojos(), pos, arboles, 0.2)) { tapados += 1; }
      }
      check(tapados >= 5, 'quedó a la vista (' + tapados + ' de 6)');
      // Si lo ves, no se mueve.
      var x0 = pos.x;
      var z0 = pos.z;
      g.player.yaw = Math.atan2(-(pos.x - g.player.pos.x), -(pos.z - g.player.pos.z));
      g.player.pos.x += 0.4;
      step(ctx, 30);
      var visto = h.frustum.containsPoint(h.customerHead()) && !D.tapado(ojos(), pos, arboles, 0.2);
      check(!visto || Math.hypot(pos.x - x0, pos.z - z0) < 1e-6, 'se movió a la vista');
      noErrors(ctx);
      return 'tapado ' + tapados + ' de 6 al caminar · quieto a la vista';
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

  // pruebas.html?auto&solo=texto corre solo las pruebas cuyo nombre lo contiene (para iterar rápido).
  var solo = (location.search.match(/[?&]solo=([^&]+)/) || [])[1];
  if (solo) { solo = decodeURIComponent(solo); tests = tests.filter(function (t) { return t[0].indexOf(solo) >= 0; }); }

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
