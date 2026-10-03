/**
 * Director del turno: reloj de juego, momentos guionizados, pavor, infracciones, capa meta-diegética y finales.
 *
 * Línea de tiempo (minutos de juego):
 *   01:15 la impresora entrega el registro (ShiftLog.update('start')).
 *   02:20 el Cliente Inmóvil aparece en el banco (evento del despachador: solo si no miras o al parpadear).
 *   02:40 el locutor nocturno, si la radio está en 94.1.
 *   La primera vez que te acercas, el cliente habla → ShiftLog.update('customer_talked') (respaldo 03:10).
 *   03:00–04:00 susurros (MR.whispersActive). 02:00–05:00 anomalías x3 (MR.anomalyMultiplier).
 *   03:50 suena el teléfono público.
 *   04:00+ el cliente pregunta la hora. La respuesta del registro es "faltan cinco minutos para las seis".
 *   04:33 la impresora entrega el colapso (ShiftLog.update('collapse')).
 *   05:12 el turno termina y el juego cierra limpio.
 *   Revisiones del pasillo cada 45 minutos: 3 o más charcos cuentan como infracción.
 */
(function (MR) {
  'use strict';

  var U = MR.Util;

  function makeStorage() {
    try {
      var k = 'midnight-rinse/prueba';
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
      return window.localStorage;
    } catch (e) {
      return new MR.MemoryStorage();
    }
  }

  class Game {
    constructor() {
      this.canvas = document.getElementById('lienzo');
      this.retro = new MR.Retro(this.canvas);
      this.audio = new MR.AudioEngine();
      this.input = new MR.Input(this.canvas);
      this.shift = new MR.ShiftLog(makeStorage());
      this.ui = new MR.UI(this);
      this.options = this.ui.options;
      this.world = new MR.World(this.retro);
      this.player = new MR.Player(this.world, this.audio);
      this.glasses = new MR.Glasses();
      this.retro.setFogTexture(this.glasses.texture);
      this.gameplay = new MR.Gameplay(this);
      this.horror = new MR.Horror(this);
      this.consumables = new MR.Consumables(this);
      this.music = new MR.MusicLink(this);
      this.ui.bindMusic(this.music);
      this.tele = new MR.Tele(this);
      this.bosque = new MR.Bosque(this);
      this.clima = new MR.Clima(this);
      this.gamepad = new MR.GamepadControls(this);
      this.gato = new MR.Gato(this);
      this.logros = new MR.Logros(this);
      this.ui.renderLogros(this.logros);
      this.ui.applyView();
      this.ui.bindTele(this.tele);
      this.touch = new MR.TouchControls(this);
      this.tilt = new MR.Tilt();
      if (MR.isTouchDevice()) { this.onTouchActivity(); }

      this.state = 'title';
      this.minutes = MR.Config.SHIFT_START;
      this.dread = 0.05;
      this.collapsed = false;
      this.whispers = false;
      this.talked = false;
      this.noteOpen = false;
      this.question = null;
      this.flags = {};
      this.mopChecksDone = 0;
      this.stats = { mirada: 0, pasillo: 0, filtro: 0, respuesta: 'no_pregunto', parpadeos: 0, charcos: 0 };
      this.wipe = { active: false, dx: 0, dy: 0 };
      this.lastTime = performance.now();
      var self = this;
      this.input.onUnlock = function () { if (self.state === 'playing') { self.pause(); } };
      this.canvas.addEventListener('click', function () { if (self.state === 'playing' && !self.input.locked) { self.input.lock(); } });
      // Algunos navegadores crean el audio "suspendido": se reactiva con el primer gesto del jugador.
      ['pointerdown', 'keydown', 'touchstart'].forEach(function (type) {
        window.addEventListener(type, function () {
          if (self.state === 'playing' && self.audio.ctx && self.audio.ctx.state === 'suspended') { self.audio.ctx.resume(); }
        });
      });
      // Si la pestaña o la app pasan a segundo plano (llamada, notificación), el turno se pausa.
      document.addEventListener('visibilitychange', function () { if (document.hidden) { self.pause(); } });
      this.gameplay.update(0, 0, this.minutes);
      requestAnimationFrame(this.frame.bind(this));
    }

    // ---------------------------------------------------------------------------------------------
    /** Primer toque en pantalla: interfaz táctil (esquina de consumibles, textos de control táctiles). */
    onTouchActivity() {
      if (this.touchUI) { return; }
      this.touchUI = true;
      document.body.classList.add('tactil');
    }

    start() {
      this.options = this.ui.options;
      this.ui.hideTitle();
      MR.Game.audioSession(this.options.mixMode);
      this.audio.start(this.options.volume, this.options.voices);
      MR.Haptics.enabled = this.options.vibration;
      if (this.touchUI) {
        this._mobileScreen();
        if (this.options.gyro) { this.tilt.start(); }
      } else {
        this.input.lock();
      }
      document.body.classList.add('jugando');
      this.ui.updateConsumables(this.consumables);
      this.music.onGameStart();
      if (this.music.connected()) { this.gameplay.tuneTo(MR.MusicLink.STATION); }
      this.state = 'playing';
      this.lastTime = performance.now();
      this.ui.subtitle('01:10. Turno de noche en la Lavandería La Espuma.', 5);
      this.ui.subtitle('La hoja del registro está sobre el mostrador.', 5);
      this.ui.subtitle(this.touchUI ? '(Tres dedos: pausa y guía de controles.)' : '(H: guía de controles · Esc: pausa.)', 6);
    }

    /** Móvil: pantalla completa y horizontal (si el navegador lo permite; si no, se juega igual). */
    _mobileScreen() {
      var el = document.documentElement;
      if (!el.requestFullscreen || document.fullscreenElement) { return; }
      el.requestFullscreen({ navigationUI: 'hide' }).then(function () {
        if (window.screen.orientation && window.screen.orientation.lock) { return window.screen.orientation.lock('landscape'); }
        return null;
      }).catch(function () { /* iOS Safari y otros: sin pantalla completa, se juega igual */ });
    }

    pause() {
      if (this.state !== 'playing') { return; }
      this.state = 'paused';
      this.music.pause();
      this.audio.pause();
      this.touch.reset();
      this.ui.showPause(true);
    }

    /** Botón de la pausa «Salir al bosque» / «Volver a la lavandería»: reanuda y cruza la puerta. */
    travelFromPause() {
      if (this.state === 'paused') { this.resume(); }
      return this.bosque.go();
    }

    /** H en plena partida: pausa, suelta el ratón y abre la guía de controles. */
    openGuide() {
      this.pause();
      if (document.exitPointerLock && document.pointerLockElement) { document.exitPointerLock(); }
      this.ui.showGuide(true);
    }

    resume() {
      if (this.state !== 'paused') { return; }
      this.ui.showPause(false);
      this.audio.resume();
      this.music.resume();
      if (this.touchUI) { this._mobileScreen(); } else { this.input.lock(); }
      this.state = 'playing';
      this.lastTime = performance.now();
    }

    frame(now) {
      var dt = Math.min(0.05, Math.max(0, (now - this.lastTime) / 1000));
      this.lastTime = now;
      this.gamepad.poll(dt);
      if (this.state === 'playing') { this.update(dt); } else if (this.state === 'title') { this.music.update(dt); }
      this.retro.render(this.world.scene, this.player.camera, {
        blink: this.state === 'ended' ? 1 : Math.max(this.player.blink.amount, this.bosque.fade),
        dread: this.dread,
        time: now / 1000,
        flash: this.horror.flash,
        collapse: this.collapsed ? 1 : 0,
        high: this.consumables.high
      });
      this.tele.frame(dt, now / 1000);
      this.input.endFrame();
      requestAnimationFrame(this.frame.bind(this));
    }

    // ---------------------------------------------------------------------------------------------
    clock() {
      var m = this.minutes;
      return new MR.HoraLocal(Math.floor(m / 60), Math.floor(m % 60), Math.floor((m * 60) % 60), 0);
    }

    anomalyMultiplier() {
      var mult = MR.anomalyMultiplier(this.clock());
      if (this.options.meta) { mult = Math.max(mult, MR.anomalyMultiplier(new Date())); }
      return mult;
    }

    update(dt) {
      var C = MR.Config;
      var input = this.input;
      var prevMinutes = this.minutes;
      this.minutes = Math.min(C.SHIFT_END, this.minutes + dt * C.GAME_SECONDS_PER_REAL_SECOND / 60 * this.consumables.timeScale());
      var dMin = this.minutes - prevMinutes;
      this.whispers = MR.whispersActive(this.clock()) || (this.options.meta && MR.whispersActive(new Date()));

      if (input.hit('Escape') || input.action('pausa')) { this.pause(); return; }
      if (input.hit('KeyH')) { this.openGuide(); return; }
      if (this.noteOpen && input.buttonPressed) { this.closeNote(); input.buttonPressed = false; }
      this._answerKeys(input);
      if (input.action('blink')) { this.player.forceBlink(); }
      if (input.hit('KeyC') || input.action('cigarro')) { this.consumables.tryCigarette(); }
      if (input.hit('KeyF') || input.action('petaca')) { this.consumables.tryFlask(); }
      if (input.hit('KeyJ') || input.action('porro')) { this.consumables.tryJoint(); }

      var touchWipe = this.touch.wipe;
      this.wipe.active = !this.noteOpen && (input.down('KeyE') || touchWipe.active);
      this.wipe.dx = input.mouseDX;
      this.wipe.dy = input.mouseDY;
      this.wipe.points = touchWipe.active ? touchWipe.points : null;
      var hands = this.noteOpen ? { coins: Math.min(4, this.gameplay.coins), mop: this.gameplay.mopHeld }
        : this.gameplay.updateInteraction(dt, input, this.player.camera);
      hands.wiping = this.wipe.active;
      hands.wipeX = this.glasses.brushX;
      hands.wipeY = this.glasses.brushY;
      hands.consumables = this.consumables.handsState();
      this.tilt.update(dt);
      var drunk = this.consumables.sway(this.player.time);
      var sway = { yaw: drunk.yaw + this.tilt.yaw, pitch: drunk.pitch + this.tilt.pitch, roll: drunk.roll };
      var dialing = !!(this.gameplay.active && /Dial$/.test(this.gameplay.active.kind));
      var extra = [];
      var cc = this.horror.customerCollider();
      if (cc) { extra.push(cc); }
      this.bosque.update(dt);
      this.player.update(dt, input, {
        look: !this.noteOpen && !dialing && !this.wipe.active,
        move: !this.noteOpen && !this.bosque.travel,
        slow: this.gameplay.mopHeld,
        sensitivity: this.options.sensitivity,
        invertY: this.options.invertY,
        extraColliders: extra,
        hands: hands,
        sway: sway,
        blinkFactor: this.consumables.blinkFactor()
      });
      this.bosque.light();
      this.clima.update(dt, this.player.time);
      if (this.gameplay.washers.every(function (w) { return w.running; })) { this.logros.unlock('lavadoras'); }
      if (this.player.blinkStarted) { this.stats.parpadeos += 1; }

      this.consumables.update(dt);
      this.gameplay.update(dt, dMin, this.minutes);
      this.horror.update(dt, this.player);
      this.gato.update(dt);
      this._beats(prevMinutes);
      this._question(dt);
      this._dread(dt);
      this.glasses.update(dt, this._humidity(), this.wipe);
      this.horror.flash = Math.max(0, this.horror.flash - dt * 2);
      this.music.update(dt);
      this.audio.update({
        outdoor: this.bosque.outdoor,
        high: this.consumables.high,
        mixMode: this.options.mixMode,
        musicProximity: this.music.proximity,
        washers: this.gameplay.runningWashers(),
        dryers: this.gameplay.runningDryers(),
        radioProximity: this.gameplay.radioProximity,
        dread: this.dread,
        collapse: this.collapsed,
        eyesClosed: this.player.eyesClosed,
        lightLevel: this.horror.lightLevel()
      });
      if (this.minutes >= C.SHIFT_END) { this.end(); }
    }

    _crossed(prev, at) { return prev < at && this.minutes >= at; }

    _beats(prev) {
      var C = MR.Config;
      var self = this;
      if (this._crossed(prev, C.PRINTER_START)) {
        var text = this.shift.update('start');
        this.gameplay.printReceipt();
        this.ui.subtitle('[La impresora térmica imprime el registro del turno.]', 4);
        this.flags.registryText = text;
        this.ui.refreshRegistry();
      }
      if (this._crossed(prev, C.CUSTOMER_APPEARS)) { this.horror.schedule('cliente_aparece', 'banco', 9); }
      if (this._crossed(prev, C.RADIO_HOST)) {
        var prox = this.gameplay.radioProximity;
        if (prox > 0.35) {
          this.logros.unlock('radio');
          var line = 'Son las dos y cuarenta en Radio Nocturna, noventa y cuatro punto uno. Para quienes siguen despiertos: ' +
            'si esta noche alguien les pregunta la hora, respondan con cuidado.';
          this.ui.subtitle('[Radio] ' + line, 9);
          this.audio.speak(line, 'locutor');
        } else if (prox > 0.05) {
          this.ui.subtitle('[Radio: una voz entre la estática. No se entiende.]', 4);
        }
      }
      if (!this.talked && this.horror.customer.present &&
          (this.horror.distanceToCustomer(this.player) < 2.6 || this.minutes >= C.CUSTOMER_TALK_FALLBACK)) {
        this._customerTalks();
      }
      if (this._crossed(prev, C.PHONE_RINGS)) {
        this.gameplay.ring(40);
        this.ui.subtitle('[Suena el teléfono público junto a la entrada.]', 4);
      }
      C.MOP_CHECKS.forEach(function (at) {
        if (self._crossed(prev, at)) {
          var n = self.gameplay.activePuddles();
          if (n >= 3) {
            self.infraction('pasillo');
            self.audio.drip();
            self.dread = Math.min(1, self.dread + 0.1);
          }
        }
      });
      if (this._crossed(prev, C.PRINTER_COLLAPSE)) {
        var collapseText = this.shift.update('collapse');
        this.gameplay.printReceipt();
        this.collapsed = true;
        this.gameplay.setCollapsed();
        this.ui.subtitle('[La impresora vuelve a imprimir.] «' + collapseText + '»', 8);
        this.ui.refreshRegistry();
        if (this.horror.customer.present) { this.horror.schedule('cliente_se_va', this.horror.customer.zone || 'banco', 4); }
      }
    }

    _customerTalks() {
      this.talked = true;
      var line = 'Hace frío aquí dentro, ¿verdad? El agua de esas máquinas ya no se calienta.';
      this.ui.subtitle('Cliente: ' + line, 6);
      this.audio.speak(line, 'cliente');
      this.shift.update('customer_talked');
      this.ui.refreshRegistry();
      var self = this;
      setTimeout(function () {
        if (self.state === 'playing') { self.ui.subtitle('(Sobre el mostrador, la hoja del registro cruje.)', 4); }
      }, 6500);
    }

    // ---------------------------------------------------------------------------------------------
    // La pregunta de la hora
    // ---------------------------------------------------------------------------------------------
    _question(dt) {
      var C = MR.Config;
      if (!this.talked || this.collapsed || this.stats.respuesta !== 'no_pregunto' || !this.horror.customer.present) {
        if (this.question) { this._tickQuestion(dt); }
        return;
      }
      if (this.question) { this._tickQuestion(dt); return; }
      if (this.minutes < C.TIME_QUESTION_FROM) { return; }
      var near = this.horror.distanceToCustomer(this.player) < 3;
      if (!near && this.minutes >= C.TIME_QUESTION_FROM + 8 && !this.flags.cameBehind) {
        this.flags.cameBehind = true;
        this.horror.schedule('cliente_detras', 'jugador', 6);
      }
      if (near || this.minutes >= C.TIME_QUESTION_FORCE) { this._ask(); }
    }

    _ask() {
      var real = U.spokenTime(this.minutes);
      this.question = { timer: 20, repeated: false, real: real };
      var q = 'Disculpe... ¿qué hora es?';
      this.ui.subtitle('Cliente: ' + q, 5);
      this.audio.speak(q, 'cliente');
      this.ui.showChoices('Cliente: «' + q + '»', [
        'Son ' + real + '.',
        'Faltan cinco minutos para las seis.',
        '(No responder.)'
      ]);
    }

    _tickQuestion(dt) {
      var q = this.question;
      q.timer -= dt;
      if (q.timer > 0) { return; }
      if (!q.repeated) {
        q.repeated = true;
        q.timer = 15;
        this.ui.subtitle('Cliente: ¿Qué hora es?', 4);
        this.audio.speak('¿Qué hora es?', 'cliente');
      } else {
        this._answer(3);
      }
    }

    _answerKeys(input) {
      if (!this.question) { return; }
      if (input.hit('Digit1') || input.hit('Numpad1')) { this._answer(1); }
      else if (input.hit('Digit2') || input.hit('Numpad2')) { this._answer(2); }
      else if (input.hit('Digit3') || input.hit('Numpad3')) { this._answer(3); }
    }

    _answer(choice) {
      var q = this.question;
      this.question = null;
      this.ui.hideChoices();
      var self = this;
      if (choice === 2) {
        this.stats.respuesta = 'correcta';
        this.ui.subtitle('Tú: Faltan cinco minutos para las seis.', 3);
        setTimeout(function () {
          var reply = 'Gracias. Entonces todavía hay tiempo.';
          self.ui.subtitle('Cliente: ' + reply, 5);
          self.audio.speak(reply, 'cliente');
        }, 1200);
        this.dread = Math.max(0, this.dread - 0.3);
        if (this.horror.customer.anchor !== 'banco') { this.horror.schedule('cliente_mueve', 'banco', 3, { to: 'banco' }); }
      } else if (choice === 1) {
        this.stats.respuesta = 'incorrecta';
        this.ui.subtitle('Tú: Son ' + q.real + '.', 3);
        setTimeout(function () {
          var reply = 'No. No es esa hora.';
          self.ui.subtitle('Cliente: ' + reply, 4);
          self.audio.speak(reply, 'cliente');
          self.horror.schedule('apagon_total', 'jugador', 8, { seconds: 2.5 });
          self.horror.schedule('cliente_detras', 'jugador', 7);
        }, 1000);
        this.infraction('respuesta');
        this.dread = Math.min(1, this.dread + 0.35);
        this.glasses.burst(0.6, 10);
      } else {
        this.stats.respuesta = 'sin_respuesta';
        this.ui.subtitle('(No respondes. El cliente se queda mirando el reloj.)', 4);
        this.infraction('respuesta');
        this.dread = Math.min(1, this.dread + 0.2);
      }
    }

    // ---------------------------------------------------------------------------------------------
    infraction(kind) {
      if (kind === 'respuesta') { return; }
      this.stats[kind] = (this.stats[kind] || 0) + 1;
    }

    onStare() {
      if (this.talked) {
        this.stats.mirada += 1;
        this.dread = Math.min(1, this.dread + 0.25);
        this.glasses.burst(0.5, 8);
        this.horror.flash = 0.25;
        this.horror.schedule('apagon_total', 'jugador', 8, { seconds: 1.2 });
        this.horror.schedule('cliente_detras', 'jugador', 5);
        this.audio.thud();
        MR.Haptics.pulse(120);
      } else {
        this.dread = Math.min(1, this.dread + 0.06);
      }
    }

    onCustomerAppeared() {
      this.flags.customerSeen = true;
      this.ui.subtitle('(Alguien está sentado en el banco amarillo. No lo oíste entrar.)', 5);
    }

    onWhisper() {
      var name = this.options.name;
      var lines = ['(susurros)', '(susurros detrás de las máquinas)', '(alguien susurra cerca del agua)'];
      if (name) {
        var whispered = '...' + name + '...';
        this.ui.subtitle('(susurros: «' + whispered + '»)', 3);
        this.audio.speak(name, 'susurro');
      } else {
        this.ui.subtitle(U.pick(lines), 3);
      }
    }

    onPhoneAnswered() {
      var line = 'No lo mires a la cara. Si te pregunta la hora... faltan cinco minutos para las seis. Faltan cinco minutos para las seis.';
      this.ui.subtitle('[Teléfono] ' + line, 9);
      this.audio.speak(line, 'telefono');
      this.flags.phone = true;
    }

    onPhoneMissed() { this.ui.subtitle('(El teléfono deja de sonar.)', 3); }

    onPuddleMopped() { this.stats.charcos += 1; MR.Haptics.pulse([25, 40, 12]); }

    /** Respuesta tocando una opción del diálogo (móvil) o con las teclas 1–3. */
    answerChoice(n) { if (this.question) { this._answer(n); } }

    openNote() {
      this.noteOpen = true;
      this.ui.showNote(this.shift.currentText());
    }

    closeNote() {
      this.noteOpen = false;
      this.ui.hideNote();
    }

    _humidity() {
      var g = this.gameplay;
      var h = g.activePuddles() * 0.004 + this.dread * 0.012 + (this.collapsed ? 0.02 : 0) +
        (this.consumables.smoking() > 0 ? 0.015 : 0);
      var p = this.player.pos;
      g.overheatedDryers().forEach(function (d) {
        h += 0.012;
        if (Math.hypot(p.x - d.mesh.x, p.z + 4.2) < 2.6) { h += 0.07; }
      });
      return h;
    }

    _dread(dt) {
      var washerCalm = Math.min(1, this.gameplay.runningWashers() / 3);
      var prox = this.collapsed ? 0 : this.gameplay.radioProximity;
      var target = 0.08 + (1 - washerCalm) * 0.28 + (1 - prox) * 0.08 + this.gameplay.activePuddles() * 0.02 +
        (this.whispers ? 0.12 : 0) + (this.collapsed ? 0.25 : 0) + this.stats.mirada * 0.05 +
        (this.horror.customer.present ? 0.06 : 0);
      this.dread += (U.clamp(target, 0, 1) - this.dread) * Math.min(1, dt * 0.15);
    }

    // ---------------------------------------------------------------------------------------------
    /** Fin del turno. reason = 'bosque' para el tercer final (las seis hojas en la lavadora del claro). */
    end(reason) {
      if (this.state === 'ended') { return; }
      this.state = 'ended';
      if (this.question) { this.question = null; this.stats.respuesta = 'sin_respuesta'; }
      this.ui.hideChoices();
      this.closeNote();
      this.audio.stopAll();
      this.input.unlock();
      var s = this.stats;
      var faults = s.mirada + s.pasillo + s.filtro + (s.respuesta === 'incorrecta' ? 2 : (s.respuesta === 'correcta' ? 0 : 1));
      var good = s.respuesta === 'correcta' && faults <= 3;
      var answer = { correcta: 'correcta', incorrecta: 'incorrecta', sin_respuesta: 'sin respuesta', no_pregunto: 'nunca te la preguntó' }[s.respuesta];
      var summary = [
        'Respuesta a la hora: ' + answer,
        'Miradas a su cara después de la advertencia: ' + s.mirada,
        'Revisiones del pasillo con charcos: ' + s.pasillo + ' de ' + MR.Config.MOP_CHECKS.length,
        'Filtros de pelusa saturados: ' + s.filtro,
        'Charcos fregados: ' + s.charcos,
        'Parpadeos: ' + s.parpadeos,
        'Cigarros: ' + this.consumables.used.cigarros + ' · Tragos de la petaca: ' + this.consumables.used.tragos +
          ' · Porros: ' + this.consumables.used.porros,
        'Salidas al bosque: ' + this.bosque.visits + ' · Hojas del registro: ' + this.bosque.pagesFound() + ' de 6',
        'Caricias a Pelusa: ' + this.gato.pets + ' · Bufidos de alarma: ' + this.gato.hisses
      ];
      document.body.classList.remove('jugando');
      this.tilt.stop();
      this.music.disconnect(true);
      // Logros del final del turno.
      var L = this.logros;
      L.unlock('primer_turno');
      if (reason === 'bosque') { L.unlock('final_bosque'); } else if (good) { L.unlock('final_bueno'); } else { L.unlock('bucle'); }
      if (s.pasillo === 0 && s.filtro === 0) { L.unlock('pulcro'); }
      if (this.flags.customerSeen && s.mirada === 0) { L.unlock('ojos_al_suelo'); }
      if (this.consumables.used.porros >= 3) { L.unlock('paranoia'); }
      if (reason === 'bosque') {
        this.ui.showEnd(MR.HISTORIA.final.titulo, MR.HISTORIA.final.texto, summary);
      } else if (good) {
        this.ui.showEnd('05:12 · Turno terminado',
          'Las lavadoras se detienen una por una. Afuera sigue lloviendo, pero la puerta por fin abre. El banco amarillo está vacío y seco.',
          summary);
      } else {
        this.ui.showEnd('01:10 · Turno de medianoche',
          'Parpadeas. El reloj marca la una y diez. Sobre el mostrador, el registro dice: «' + MR.TEXTS.collapse + '» El turno no terminó.',
          summary);
      }
    }
  }

  /**
   * iPhone (Safari 16.4+): en modo mezcla el audio del juego es "ambient" y NO corta la música que suena en otra
   * app (YouTube Music Premium, Spotify). Sin modo mezcla, comportamiento normal.
   */
  Game.audioSession = function (mix) {
    try { if (navigator.audioSession) { navigator.audioSession.type = mix ? 'ambient' : 'auto'; } } catch (e) { /* no soportado */ }
  };

  MR.Game = Game;
})(window.MR = window.MR || {});
