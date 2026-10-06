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
      this.venado = new MR.Venado(this); // vida salvaje del bosque (cerebro de mosca)
      this.lechuza = new MR.Lechuza(this); // la lechuza del árbol seco (cerebro de mosca)
      this.pasillo = new MR.Pasillo(this);
      this.espejo = new MR.Espejo(this);
      this.clientela = new MR.Clientela(this);
      this.ciudad = new MR.Ciudad(this);
      this.clima = new MR.Clima(this);
      this.gamepad = new MR.GamepadControls(this);
      this.gato = new MR.Gato(this);
      this.logros = new MR.Logros(this);
      this.objetos = new MR.Objetos(this);
      this.archivo = new MR.Archivo(this);
      this.historial = new MR.Historial();
      this.fotos = new MR.Fotos(this);
      this.ui.renderFotos(this.fotos);
      this.ui.renderHistorial(this.historial);
      this.ui.renderPelusa(this.gato);
      this.ui.renderLogros(this.logros);
      this.ui.renderObjetos(this.objetos);
      this.ui.renderArchivo(this.archivo);
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
          // Pantalla de título: con el primer toque empieza el ambiente (lluvia, zumbido, drone), más bajito.
          if (self.state === 'title' && !self.audio.ambience) {
            try { self.audio.start(self.ui.options.volume * 0.6, false); } catch (e) { /* sin audio */ }
          }
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

    /** Continuar el turno guardado (botón de la pantalla de título). */
    continueShift() {
      var saved = MR.Partida.load();
      if (!saved) { return; }
      this.ui.options.difficulty = saved.difficulty;
      this.start(saved);
    }

    /** Empieza el turno; con saved, lo continúa desde el guardado. */
    start(saved) {
      this.options = this.ui.options;
      this._dawn(false); // de vuelta a la noche
      this.diff = MR.DIFICULTAD[this.options.difficulty] || MR.DIFICULTAD.normal;
      this.consumables.cigarettes = this.diff.cigarros;
      this.consumables.sips = this.diff.tragos;
      this.consumables.joints = this.diff.porros;
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
      try { this.night = (parseInt(window.localStorage.getItem('midnight-rinse/noches') || '0', 10) || 0) + 1; } catch (e) { this.night = 1; }
      this.saveTimer = 10;
      // Noche especial (o normal). ?noche=<clave> la fuerza (pruebas).
      var forced = (location.search.match(/[?&]noche=([a-z_]+)/) || [])[1];
      var mods = Object.keys(MR.NOCHES_ESPECIALES);
      this.mod = forced === 'ninguna' ? null : (forced && MR.NOCHES_ESPECIALES[forced] ? forced : (Math.random() < 0.45 ? null : U.pick(mods)));
      if (saved) {
        MR.Partida.restore(this, saved);
        return;
      }
      MR.Partida.clear(); // turno nuevo: el guardado anterior ya no vale
      if (this.mod === 'sin_agua') { this.gameplay.washers.forEach(function (w) { w.running = false; w.remaining = 0; }); }
      this.ui.subtitle('01:10. Turno de noche en la Lavandería La Espuma.', 5);
      this.ui.subtitle('La hoja del registro está sobre el mostrador.', 5);
      this.ui.subtitle(this.touchUI ? '(Tres dedos: pausa y guía de controles.)' : '(H: guía de controles · Esc: pausa.)', 6);
      if (this.mod) { this.ui.subtitle(MR.tf('(Nota del gerente en la tablilla: «{nota}»)', { nota: MR.t(MR.NOCHES_ESPECIALES[this.mod].nota) }), 8); }
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
      MR.Partida.save(this);
      this.music.pause();
      this.audio.pause();
      this.touch.reset();
      this.ui.showPause(true);
    }

    /**
     * Pantalla de título: la cámara recorre despacio la lavandería (de la entrada hacia las lavadoras y de
     * regreso) y un fluorescente titila de vez en cuando. Al empezar el turno, player.update toma el control.
     */
    _attract(dt) {
      this.attractT = (this.attractT || 0) + dt;
      var t = this.attractT;
      var cam = this.player.camera;
      var k = (Math.sin(t * 0.045 - 1.2) + 1) / 2;
      cam.position.set(-5.2 + k * 8.6, 1.55 + Math.sin(t * 0.21) * 0.04, 2.7 - Math.sin(t * 0.03) * 0.6);
      cam.lookAt(cam.position.x * 0.55 - 0.6, 1.0, -4.4);
      // Si ya cerraste el ciclo (tercer final), en el título amanece.
      if (this.logros && (this.logros.has('final_bosque') || this.logros.has('verdadero'))) { this._dawn(true); return; }
      // Fluorescente que titila (sin depender de opciones: en el título aún no hay turno).
      this.attractFlicker = (this.attractFlicker || 0) - dt;
      if (this.attractFlicker <= 0) {
        this.attractFlicker = 4 + Math.random() * 7;
        this.attractBlink = 0.12 + Math.random() * 0.25;
      }
      if (this.attractBlink > 0) {
        this.attractBlink -= dt;
        this.retro.setLightFactor(1, Math.random() < 0.5 ? 0.15 : 0.8);
        this.world.panels[1].material.uniforms.uEmissive.value = 0.4;
      } else {
        this.retro.setLightFactor(1, 1);
        this.world.panels[1].material.uniforms.uEmissive.value = 1.2;
      }
    }

    /**
     * Amanecer en la pantalla de título (recompensa del tercer final): luz cálida por la puerta de vidrio,
     * fluorescentes apagados. on = false lo deshace al empezar el turno.
     */
    _dawn(on) {
      if (on === !!this.dawnOn) { return; }
      this.dawnOn = on;
      var sh = this.retro.shared;
      var glass = this.world.mat.glass.uniforms;
      var base = this.bosque.inside;
      if (on) {
        this.dawnGlass = glass.uColor.value.clone();
        sh.uAmbient.value.set(0.34, 0.29, 0.24);
        sh.uFogColor.value.set(0.22, 0.18, 0.14);
        glass.uColor.value.setRGB(1.0, 0.86, 0.62);
        glass.uEmissive.value = 1.3;
        for (var i = 0; i < 6; i += 1) { this.retro.setLightFactor(i, 0.12); this.world.panels[i].material.uniforms.uEmissive.value = 0.15; }
        var n = document.getElementById('noche');
        n.hidden = false;
        n.textContent = MR.t(this.logros.has('verdadero') ? 'Amaneció. Ya no vuelves… a menos que quieras.' : 'Amaneció. Pero esta noche vuelves.');
        n.classList.add('amanecer');
        document.getElementById('titulo').classList.add('amanecer');
      } else {
        sh.uAmbient.value.copy(base.ambient);
        sh.uFogColor.value.copy(base.fogColor);
        if (this.dawnGlass) { glass.uColor.value.copy(this.dawnGlass); }
        glass.uEmissive.value = 0.35;
        for (var j = 0; j < 6; j += 1) { this.retro.setLightFactor(j, 1); }
      }
    }

    /** Botón de la pausa «Salir al bosque» / «Volver a la lavandería»: reanuda y cruza la puerta. */
    travelFromPause() {
      if (this.state === 'paused') { this.resume(); }
      if (this.pasillo.inside) { return this.pasillo.go(); } // desde el pasillo, el botón regresa a la sala
      return this.bosque.go();
    }

    /** Botón de la pausa «Sacar una foto» (en el celular no hay tecla): reanuda y la saca en el siguiente cuadro. */
    photoFromPause() {
      if (this.state === 'paused') { this.resume(); }
      this.pendingPhoto = true;
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
      // Ahorro de batería: a lo más 30 cuadros por segundo (se salta el cuadro y el tiempo se acumula).
      if (this.ui.options.batterySaver && now - this.lastTime < 31) {
        requestAnimationFrame(this.frame.bind(this));
        return;
      }
      var dt = Math.min(0.05, Math.max(0, (now - this.lastTime) / 1000));
      this.lastTime = now;
      this.gamepad.poll(dt);
      if (this.state === 'playing') { this.update(dt); } else if (this.state === 'title') { this.music.update(dt); this._attract(dt); }
      this.espejo.render(); // el reflejo del espejo del pasillo, antes del cuadro
      this.retro.render(this.world.scene, this.player.camera, {
        blink: this.state === 'ended' ? Math.min(1, (now - (this.endedAt || 0)) / 3000) :
          Math.max(this.player.blink.amount, this.bosque.fade, this.pasillo.fade, this.epiFade || 0),
        dread: this.dread,
        time: now / 1000,
        flash: this.horror.flash,
        collapse: this.collapsed ? 1 : 0,
        high: this.consumables.high,
        crt: this.ui.options.crt,
        gamma: this.ui.options.brightness
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
      if (this.epilogue) { this.minutes = 313; prevMinutes = 313; } // el amanecer: el reloj se queda en 05:13
      var dMin = this.minutes - prevMinutes;
      this.whispers = MR.whispersActive(this.clock()) || (this.options.meta && MR.whispersActive(new Date()));

      if (input.hit('Escape') || input.action('pausa')) { this.pause(); return; }
      if (input.hit('KeyH')) { this.openGuide(); return; }
      if (this.noteOpen && input.buttonPressed) { this.closeNote(); input.buttonPressed = false; }
      this._answerKeys(input);
      if (input.action('blink')) { this.player.forceBlink(); }
      this.fotos.update(dt);
      if (input.hit('KeyP') || input.action('foto') || this.pendingPhoto) { this.pendingPhoto = false; this.fotos.take(); }
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
      this._sonidos(dt);
      this.bosque.update(dt);
      this.venado.update(dt);
      this.lechuza.update(dt);
      this.seresAcc = (this.seresAcc || 0) + dt;
      if (this.seresAcc >= 0.5) { this.seresAcc = 0; this.archivo.seres(this); }
      this.espejo.update(dt);
      if (!this.epilogue) { this.clientela.update(dt); }
      this.ciudad.update(dt);
      this.pasillo.update(dt);
      this.player.update(dt, input, {
        look: !this.noteOpen && !dialing && !this.wipe.active,
        move: !this.noteOpen && !this.bosque.travel && !this.pasillo.travel,
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
      if (this.epilogue) {
        this._epilogueUpdate(dt);
      } else {
        this.horror.update(dt, this.player);
      }
      this.gato.update(dt);
      if (!this.epilogue) {
        this.hintTimer = (this.hintTimer || 0) - dt;
        if (this.hintTimer <= 0) { this.hintTimer = 1; this._hints(); }
        // Guardado automático (Continuar turno).
        this.saveTimer -= dt;
        if (this.saveTimer <= 0) { this.saveTimer = 10; MR.Partida.save(this); }
        this._beats(prevMinutes);
        this._question(dt);
        this._dread(dt);
      }
      this.glasses.update(dt, this._humidity(), this.wipe);
      this.horror.flash = Math.max(0, this.horror.flash - dt * 2);
      this.music.update(dt);
      this.audio.update({
        outdoor: this.bosque.outdoor,
        muffled: this.pasillo.muffle,
        clearSky: this.mod === 'luna' || !!this.epilogue,
        high: this.consumables.high,
        mixMode: this.options.mixMode,
        musicProximity: this.music.proximity,
        washers: this.gameplay.runningWashers(),
        dryers: this.gameplay.runningDryers(),
        radioProximity: this.gameplay.radioProximity,
        dread: this.dread,
        collapse: this.collapsed,
        eyesClosed: this.player.eyesClosed,
        lightLevel: this.epilogue ? 0 : this.horror.lightLevel()
      });
      if (this.minutes >= C.SHIFT_END && !this.epilogue) { this.end(); } // al amanecer, el turno termina al cruzar la puerta
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
      if (this._crossed(prev, C.BACKDOOR_OPENS)) { this.pasillo.unlock(); }
      if (this._crossed(prev, C.CUSTOMER_APPEARS) && !this.diff.sinSustos) { this.horror.schedule('cliente_aparece', 'banco', 9); }
      if (this._crossed(prev, C.RADIO_HOST)) {
        var prox = this.gameplay.radioProximity;
        if (prox > 0.35) {
          this.logros.unlock('radio');
          var scripts = MR.HISTORIA.radio;
          var n = this.night || 1;
          if (n > scripts.length) {
            this.ui.subtitle('[Radio: solo estática. En la 94.1 ya nadie habla.]', 6);
          } else {
            var line = scripts[n - 1];
            this.archivo.radio(n - 1);
            this.ui.subtitle(MR.tf('[Radio] {l}', { l: MR.t(line) }), 10);
            this.audio.speak(line, 'locutor');
            if (/cinco y trece/.test(line)) { this.flags.heardTrueTime = true; } // la noche 7 revela la hora verdadera
            if (n >= 3 && n <= 6) { this._dedication(); }
          }
        } else if (prox > 0.05) {
          this.ui.subtitle('[Radio: una voz entre la estática. No se entiende.]', 4);
        }
      }
      if (!this.talked && this.horror.customer.present &&
          (this.horror.distanceToCustomer(this.player) < 2.6 || this.minutes >= C.CUSTOMER_TALK_FALLBACK)) {
        this._customerTalks();
      }
      C.RADIO_BOLETINES.forEach(function (at, i) { if (self._crossed(prev, at)) { self._bulletin(i); } });
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
        this.ui.subtitle(MR.tf('[La impresora vuelve a imprimir.] «{t}»', { t: MR.t(collapseText) }), 8);
        this.ui.refreshRegistry();
        if (this.horror.customer.present) { this.horror.schedule('cliente_se_va', this.horror.customer.zone || 'banco', 4); }
      }
    }

    /**
     * Radio Nocturna en vivo: boletines cortos (solo si la radio está en la 94.1) que comentan tu noche. A las 02:10,
     * el 86 si se detuvo, si no la barredora, si no el embalse; a las 03:30, el puente si le pusiste la placa esta
     * noche, si no el embalse. Después de la octava noche el locutor ya no está: no hay boletines.
     */
    _bulletin(i) {
      if (this.gameplay.radioProximity <= 0.35 || (this.night || 1) > MR.HISTORIA.radio.length) { return; }
      var ci = this.ciudad;
      // Si tus fotos revelaron algo, el locutor se entera (a las 02:10, si no pasó el 86; o a las 03:30).
      var fotos = !!(this.fotos.reveladas && Object.keys(this.fotos.reveladas).length) && !(this.usedBulletins || {}).fotosDicho;
      var key = ['apertura', ci.busStopped ? 'bus86' : (fotos ? 'fotos' : (ci.sweepDone ? 'barredora' : 'embalse')),
        this.bosque.plaquePlaced ? 'puente' : (fotos ? 'fotos' : 'embalse'), 'cierre'][i];
      if (key === 'fotos') { (this.usedBulletins || (this.usedBulletins = {})).fotosDicho = true; }
      var used = this.usedBulletins || (this.usedBulletins = {});
      var list = MR.HISTORIA.boletines[key];
      var free = list.map(function (l, n) { return n; }).filter(function (n) { return !used[key + n]; });
      var n = free.length ? free[Math.floor(Math.random() * free.length)] : 0;
      used[key + n] = true;
      var line = list[n];
      this.lastBulletin = key;
      this.ui.subtitle(MR.tf('[Radio] {l}', { l: MR.t(line) }), 9);
      this.audio.speak(line, 'locutor');
      this.archivo.bulletin(key, n);
    }

    /**
     * Un sonido en el mundo (x, z) con su fuerza (0 a 1): lo oyen los cerebros de mosca durante un momento (gato.js,
     * clientela.js). Los eventos del director que suenan y el teléfono lo emiten.
     */
    oir(x, z, fuerza) {
      (this.sonidos || (this.sonidos = [])).push({ x: x, z: z, f: fuerza, t: 0.8 });
    }

    _sonidos(dt) {
      if (this.gameplay.phoneRinging) {
        this.ringHeard = (this.ringHeard || 0) - dt;
        if (this.ringHeard <= 0) { this.ringHeard = 1.5; this.oir(2.7, 4.9, 0.8); }
      }
      if (!this.sonidos || !this.sonidos.length) { return; }
      this.sonidos.forEach(function (s) { s.t -= dt; });
      this.sonidos = this.sonidos.filter(function (s) { return s.t > 0; });
    }

    /** La dedicatoria de la radio (noches 3 a 6). Si diste tu nombre, se oye entre la estática. */
    _dedication() {
      var self = this;
      var name = this.options.name;
      setTimeout(function () {
        if (self.state !== 'playing') { return; }
        var d = MR.HISTORIA.dedicatoria;
        self.ui.subtitle(MR.tf('[Radio] {l}', { l: MR.t(d) }), 7);
        self.audio.speak(d, 'locutor');
        if (name) {
          setTimeout(function () {
            if (self.state !== 'playing') { return; }
            self.ui.subtitle(MR.tf('(Entre la estática, alguien dice tu nombre: «…{n}…».)', { n: name }), 4);
            self.audio.speak(name, 'susurro', true);
            self.dread = Math.min(1, self.dread + 0.05);
          }, 3500);
        }
      }, MR.Config.DEDICATORIA_MS);
    }

    _customerTalks() {
      this.talked = true;
      var line = 'Hace frío aquí dentro, ¿verdad? El agua de esas máquinas ya no se calienta.';
      this.ui.subtitle(MR.tf('Cliente: {l}', { l: MR.t(line) }), 6);
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
      this.closeDialog(); // la pregunta de la hora corta cualquier conversación
      var real = MR.I18N.spokenTime(this.minutes);
      this.question = { timer: 20, repeated: false, real: real };
      var q = 'Disculpe... ¿qué hora es?';
      this.ui.subtitle(MR.tf('Cliente: {l}', { l: MR.t(q) }), 5);
      this.audio.speak(q, 'cliente');
      var choices = [MR.tf('Son {hora}.', { hora: real }), 'Faltan cinco minutos para las seis.', '(No responder.)'];
      // Respuesta secreta: si leíste las seis hojas del bosque o abriste tu casillero, ya sabes la hora verdadera.
      if (this._knowsTrueTime()) { choices.push('Son las cinco y trece. Ya terminó.'); }
      this.ui.showChoices(MR.tf('Cliente: «{l}»', { l: MR.t(q) }), choices);
    }

    /** ¿Sabes la hora verdadera? (las seis hojas, tu casillero o la radio de la noche 7). */
    _knowsTrueTime() { return this.bosque.pagesFound() >= 6 || !!this.flags.ownLocker || !!this.flags.heardTrueTime; }

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
      if (this.dialog && !this.question) {
        for (var k = 1; k <= this.dialog.options.length; k += 1) {
          if (input.hit('Digit' + k) || input.hit('Numpad' + k)) { this.answerChoice(k); return; }
        }
        return;
      }
      if (!this.question) { return; }
      if (input.hit('Digit1') || input.hit('Numpad1')) { this._answer(1); }
      else if (input.hit('Digit2') || input.hit('Numpad2')) { this._answer(2); }
      else if (input.hit('Digit3') || input.hit('Numpad3')) { this._answer(3); }
      else if ((input.hit('Digit4') || input.hit('Numpad4')) && this._knowsTrueTime()) { this._answer(4); }
    }

    _answer(choice) {
      var q = this.question;
      this.question = null;
      this.ui.hideChoices();
      var self = this;
      if (choice === 4) {
        // La hora verdadera: él se levanta y se va. No vuelve en todo el turno.
        this.stats.respuesta = 'correcta';
        this.flags.secreto = true;
        this.ui.subtitle('Tú: Son las cinco y trece. Ya terminó.', 3);
        setTimeout(function () {
          var reply = '…Entonces ya lo sabes.';
          self.ui.subtitle(MR.tf('Cliente: {l}', { l: MR.t(reply) }), 5);
          self.audio.speak(reply, 'cliente');
          self.ui.subtitle('(Se levanta despacio, camina hacia la puerta de vidrio y ya no está.)', 6);
          self.horror.customer.present = false;
          self.world.customer.group.visible = false;
          self.world.loneHat.visible = true; // su sombrero se queda en el banco
          self.audio.door();
          if (self.logros) { self.logros.unlock('secreto'); }
        }, 1300);
        this.dread = 0;
        return;
      }
      if (choice === 2) {
        this.stats.respuesta = 'correcta';
        this.ui.subtitle('Tú: Faltan cinco minutos para las seis.', 3);
        setTimeout(function () {
          var reply = 'Gracias. Entonces todavía hay tiempo.';
          self.ui.subtitle(MR.tf('Cliente: {l}', { l: MR.t(reply) }), 5);
          self.audio.speak(reply, 'cliente');
        }, 1200);
        this.dread = Math.max(0, this.dread - 0.3);
        if (this.horror.customer.anchor !== 'banco') { this.horror.schedule('cliente_mueve', 'banco', 3, { to: 'banco' }); }
      } else if (choice === 1) {
        this.stats.respuesta = 'incorrecta';
        this.ui.subtitle(MR.tf('Tú: Son {hora}.', { hora: q.real }), 3);
        setTimeout(function () {
          var reply = 'No. No es esa hora.';
          self.ui.subtitle(MR.tf('Cliente: {l}', { l: MR.t(reply) }), 4);
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
      if (kind === 'respuesta' || (this.diff && this.diff.sinSustos)) { return; }
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

    // ---------------------------------------------------------------------------------------------
    /**
     * El amanecer en Blackwood (final verdadero): vuelves a la lavandería a oscuras a las 05:13. Por la vidriera entra
     * la luz de la mañana, la avenida está seca y despierta, la cruz de la farmacia por fin se apagó. La puerta de
     * vidrio, por primera vez, da a la calle: al cruzarla termina el turno.
     */
    _startEpilogue() {
      this.epilogue = true;
      this.epiFade = 1;
      this.epiTime = 0;
      this.closeDialog();
      this.closeNote();
      if (this.bosque.outside) { this.bosque._swap(false); }
      if (this.pasillo.inside) { this.pasillo._swap(false); }
      this.bosque.ending = false;
      var p = this.player;
      p.pos.set(4.6, 0, 0.6);
      p.yaw = Math.PI; // mirando la vidriera grande
      p.pitch = 0.05;
      this.minutes = 313;
      this.dread = 0;
      this.horror.customer.present = false;
      this.world.customer.group.visible = false;
      this.world.loneHat.visible = false;
      var cl = this.clientela;
      cl.plan = [];
      cl.visitors.slice().forEach(function (v) { cl._remove(v); });
      if (cl.watcher) { cl.watcher.group.visible = false; }
      if (cl.approach) { this.world.scene.remove(cl.approach.model.group); cl.approach = null; }
      for (var i = 0; i < 6; i += 1) { this.retro.setLightFactor(i, 0); } // las luces de la lavandería, apagadas
      this.retro.shared.uAmbient.value.copy(this.bosque.baseAmbient()); // la luz gris de la mañana (clima.js la mantiene)
      this.retro.shared.uFogColor.value.set(0.56, 0.62, 0.68);   // lo lejano se aclara (de noche se oscurecía)
      this.retro.renderer.setClearColor(0x9fb3c4, 1);                 // el cielo, arriba de los edificios
      this.ciudad.dawn = true;
      // Pelusa va a la puerta de vidrio (gato.js decide ir en cuanto termina lo que estaba haciendo).
      if (this.gato.state !== 'camina' && this.gato.state !== 'salta') { this.gato.state = 'sentado'; this.gato.timer = 0.5; }
      this.ui.subtitle('(05:13. Las luces de la lavandería están apagadas. Por la vidriera entra la luz de la mañana.)', 7);
      var self = this;
      setTimeout(function () {
        if (self.epilogue && self.state === 'playing') {
          self.ui.subtitle('(El letrero de la puerta dice CERRADO. Por primera vez, la puerta de vidrio da a la calle.)', 7);
        }
      }, 6500);
    }

    _epilogueUpdate(dt) {
      this.epiTime += dt;
      this.epiFade = Math.max(0, this.epiFade - dt / 2.5);
      this.dread = 0;
      for (var i = 0; i < 6; i += 1) { this.retro.setLightFactor(i, 0); }
      // Pájaros: trinos sueltos, de un lado y del otro.
      this.birdTimer = (this.birdTimer || 0) - dt;
      if (this.birdTimer <= 0) { this.birdTimer = U.rand(0.8, 2.6); this.audio.pajaro(U.rand(-0.8, 0.8)); }
    }

    /** Cruzar la puerta de vidrio al amanecer: la calle, y el final. */
    finishEpilogue() {
      if (!this.epilogue || this.epilogueDone) { return; }
      this.epilogueDone = true;
      this.audio.door();
      // Su cerebro de mosca decide: si te tomó cariño, sale contigo a la calle.
      var cat = this.gato;
      if (cat.mesh.root.visible) {
        this.pelusaSale = cat.brain.valencia(MR.Mosca.CTX.jugador) > 0.25;
        this.ui.subtitle(this.pelusaSale ? '(Pelusa sale contigo a la calle.)' : '(Pelusa se queda en la puerta, mirándote irte.)', 5);
      }
      this.end('bosque');
    }

    /** Tocar el banco amarillo: frío antes de que él llegue; si está sentado, no te atreves; si se fue, tibio. */
    touchBench() {
      var h = this.horror;
      if (h.customer.present && h.customer.anchor === 'banco') {
        this.gameplay.say('banco', '(No te atreves a sentarte a su lado.)', 3);
      } else if (!this.flags.customerSeen) {
        this.gameplay.say('banco', '(El banco está frío.)', 3);
      } else {
        this.gameplay.say('banco', '(El banco está tibio, como si alguien acabara de levantarse.)', 4);
        this.dread = Math.min(1, this.dread + 0.02);
      }
    }

    onCustomerAppeared() {
      this.flags.customerSeen = true;
      this.ui.subtitle('(Alguien está sentado en el banco amarillo. No lo oíste entrar.)', 5);
    }

    /** Un susurro: una frase suelta o, si diste tu nombre, a veces tu nombre. */
    onWhisper() {
      var name = this.options.name;
      if (name && Math.random() < 0.5) {
        this.ui.subtitle(MR.tf('(susurros: «…{n}…»)', { n: name }), 3);
        this.audio.speak(name, 'susurro', true);
        return;
      }
      var w = U.pick(MR.HISTORIA.susurros);
      this.ui.subtitle(MR.tf('(susurros: «{w}»)', { w: MR.t(w) }), 3);
      this.audio.speak(MR.t(w).replace(/…/g, ''), 'susurro', true);
    }

    onPhoneAnswered() {
      if (this.gameplay.phoneGhost) {
        this.gameplay.phoneGhost = false;
        this.ui.subtitle('(Del otro lado solo se oye una lavadora girando. Luego, alguien cuelga.)', 5);
        this.audio.thud();
        this.dread = Math.min(1, this.dread + 0.08);
        return;
      }
      var calls = MR.HISTORIA.telefono;
      var n = Math.min(this.night || 1, calls.length);
      var line = calls[n - 1];
      this.archivo.phone(n - 1);
      // Desde la sexta noche, la voz del teléfono es la tuya.
      this.ui.subtitle(MR.tf(n >= calls.length ? '[Teléfono, con tu propia voz] {l}' : '[Teléfono] {l}', { l: MR.t(line) }), 9);
      this.audio.speak(line, 'telefono');
      this.flags.phone = true;
      // Posdata: si esta noche tus fotos revelaron algo, quien llama lo sabe.
      var rv = this.fotos.reveladas || {};
      var ps = ['el', 'caras', 'agua', 'mascaras', 'rio'].filter(function (k) { return rv[k]; })[0];
      if (ps) {
        var self = this;
        var extra = MR.HISTORIA.posdata[ps];
        var propia = n >= calls.length;
        this.posdata = ps;
        setTimeout(function () {
          if (self.state !== 'playing') { return; }
          self.ui.subtitle(MR.tf(propia ? '[Teléfono, con tu propia voz] {l}' : '[Teléfono] {l}', { l: MR.t(extra) }), 7);
          self.audio.speak(extra, 'telefono');
        }, 6500);
      }
    }

    onPhoneMissed() { this.ui.subtitle('(El teléfono deja de sonar.)', 3); }

    onPuddleMopped() { this.stats.charcos += 1; MR.Haptics.pulse([25, 40, 12]); }

    /** Respuesta tocando una opción del diálogo (móvil) o con las teclas 1–3. */
    answerChoice(n) {
      if (this.question) { this._answer(n); return; }
      if (this.dialog) { var d = this.dialog; this.closeDialog(); d.pick(n); }
    }

    /**
     * Diálogo genérico (conversaciones con la clientela): pregunta, opciones y qué pasa al elegir (pick(n), 1 = la
     * primera). Usa la misma lista que la pregunta de la hora, que siempre tiene prioridad.
     */
    openDialog(question, options, pick) {
      if (this.question) { return false; }
      this.dialog = { options: options, pick: pick };
      this.ui.showChoices(question, options);
      return true;
    }

    closeDialog() {
      if (!this.dialog) { return; }
      this.dialog = null;
      if (!this.question) { this.ui.hideChoices(); }
    }

    openNote() {
      this.flags.readNote = true;
      this.noteOpen = true;
      this.ui.showNote(this.shift.currentText());
    }

    /**
     * Pistas para quien empieza (noches 1 y 2, o siempre en Tranquilo): un empujón suave, una sola vez cada una,
     * solo si te ve atorado.
     */
    _hints() {
      if (!((this.night || 1) <= 2 || this.options.difficulty === 'tranquilo')) { return; }
      var C = MR.Config;
      var gp = this.gameplay;
      var f = this.flags;
      var said = f.hints = f.hints || {};
      var self = this;
      function hint(id, when, text) {
        if (said[id] || !when) { return; }
        said[id] = true;
        self.ui.subtitle(MR.tf('(Pista: {t})', { t: MR.t(text) }), 6);
      }
      hint('registro', this.minutes > C.SHIFT_START + 12 && !f.readNote, 'la hoja del registro está sobre el mostrador. Tócala para leer las reglas.');
      if (this.mod === 'sin_agua') {
        hint('secadoras', this.minutes > C.SHIFT_START + 25 && this.calmSources() < 3,
          'hoy no hay agua. Mete monedas en las secadoras para que giren, o pon tu música: el ruido tapa el zumbido.');
      }
      hint('lavadoras', this.mod !== 'sin_agua' && this.minutes > C.SHIFT_START + 25 && gp.washers.filter(function (w) { return w.running; }).length < 3,
        'pon a lavar. Saca monedas del cambiador junto a la entrada, mételas en la ranura y gira la perilla. Su ruido tapa el zumbido.');
      var next = C.MOP_CHECKS.filter(function (m) { return m > self.minutes; })[0];
      hint('charcos', next && next - this.minutes < 15 && gp.activePuddles() >= 2 && !gp.mopHeld,
        'hay charcos en el pasillo y pronto revisan. El trapeador está en el almacén, al fondo a la izquierda.');
      hint('filtro', gp.dryers.some(function (d) { return d.lint > 0.7; }),
        'una secadora tiene el filtro lleno de pelusa. Mantén presionado sobre el filtro para limpiarlo.');
      hint('tablilla', this.minutes > C.SHIFT_START + 45, 'la tablilla del mostrador te dice qué falta.');
    }

    /** Tablilla de tareas del mostrador: el estado del turno (no hay HUD). */
    openTasks() {
      var C = MR.Config;
      var gp = this.gameplay;
      var mins = this.minutes;
      var next = C.MOP_CHECKS.filter(function (m) { return m > mins; })[0];
      var puddles = gp.activePuddles();
      var running = gp.washers.filter(function (w) { return w.running; }).length;
      var worst = gp.dryers.reduce(function (best, d, i) { return d.lint > best.lint ? { lint: d.lint, i: i } : best; }, { lint: -1, i: 0 });
      var ok = function (b) { return b ? '✔ ' : '☐ '; };
      var cat = MR.I18N.cat;
      var lines = [
        MR.tf('Son las {h}.', { h: U.clockText(Math.floor(mins)) }),
        this.mod ? MR.tf('Nota del gerente: {nota}', { nota: MR.t(MR.NOCHES_ESPECIALES[this.mod].nota) }) : 'Noche normal. Que siga así.',
        '',
        cat(ok(puddles < 3), MR.tf(puddles === 1 ? 'Pasillo central: {n} charco' : 'Pasillo central: {n} charcos', { n: puddles }), ' ',
          next ? MR.tf('(revisión a las {h}; con 3 o más es falta).', { h: U.clockText(next) }) : MR.t('(ya no hay más revisiones).')),
        this.mod === 'sin_agua' ?
          cat(ok(this.calmSources() >= 3), MR.tf('Secadoras funcionando: {n} de 4 (hoy no hay agua: con 3 o más, o con tu música, se tapa el zumbido).', { n: gp.runningDryers() })) :
          cat(ok(running >= 3), MR.tf('Lavadoras funcionando: {n} de 6 (con 3 o más, su ruido tapa el zumbido).', { n: running })),
        cat(ok(worst.lint < 0.7), MR.tf('Filtros de pelusa: el más lleno, secadora {n} al {p} %.', { n: worst.i + 1, p: Math.round(Math.min(1, worst.lint) * 100) }))
      ];
      if (this.flags.customerSeen) { lines.push('• No le mires la cara al cliente del banco.'); }
      lines.push(this.flags.phone ? '• Si te pregunta la hora: «Faltan cinco minutos para las seis».' : '• Si alguien te pregunta la hora, responde con cuidado.');
      if (this.pasillo.unlocked) { lines.push(cat(MR.t('• La puerta trasera quedó entreabierta.'), this.pasillo.fuses ? '' : ' ' + MR.t('Los fusibles están allá.'))); }
      var pages = this.bosque.pagesFound();
      if (pages > 0 || this.bosque.visits > 0) { lines.push(MR.tf('• Hojas del registro en el bosque: {n} de 6.', { n: pages })); }
      this.noteOpen = true;
      this.ui.showNote(lines.join('\n'), 'TAREAS DEL TURNO · TABLILLA DEL MOSTRADOR', 'tareas');
      this.audio.click();
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
      return h * (this.diff ? this.diff.vaho : 1) * (this.mod === 'niebla' ? 1.5 : 1);
    }

    /**
     * Cuánto ruido tapa el zumbido, en «lavadoras»: con 3 ya no se oye. En la noche sin agua cuentan las secadoras
     * y tu música (tele o radio 99.9).
     */
    calmSources() {
      var n = this.gameplay.runningWashers();
      if (this.mod === 'sin_agua') {
        n += this.gameplay.runningDryers() + ((this.tele && this.tele.playing) || (this.music && this.music.connected()) ? 1.5 : 0);
      }
      return n;
    }

    _dread(dt) {
      var washerCalm = Math.min(1, this.calmSources() / 3);
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
      // Final verdadero: antes de la pantalla final, el amanecer en Blackwood (se juega hasta cruzar la puerta).
      if (reason === 'bosque' && this.flags.secreto && !this.epilogue) { this._startEpilogue(); return; }
      this.state = 'ended';
      MR.Partida.clear();
      try {
        var nights = (parseInt(window.localStorage.getItem('midnight-rinse/noches') || '0', 10) || 0) + 1;
        window.localStorage.setItem('midnight-rinse/noches', String(nights));
      } catch (e) { /* sin almacenamiento */ }
      if (this.question) { this.question = null; this.stats.respuesta = 'sin_respuesta'; }
      this.dialog = null;
      this.ui.hideChoices();
      this.closeNote();
      // Transición: el mundo se desvanece en ~3 s (el texto final aparece después, por CSS).
      this.endedAt = performance.now();
      if (reason === 'bosque') { this.audio.trueno(0.6, false); this.audio.ding(); }
      this.endSound = true;
      this.audio.stopAll(3.2);
      this.input.unlock();
      var s = this.stats;
      var faults = s.mirada + s.pasillo + s.filtro + (s.respuesta === 'incorrecta' ? 2 : (s.respuesta === 'correcta' ? 0 : 1));
      var diff = this.diff || MR.DIFICULTAD.normal;
      var good = s.respuesta === 'correcta' && faults <= diff.faltas;
      var answer = { correcta: 'Respuesta a la hora: correcta', incorrecta: 'Respuesta a la hora: incorrecta',
        sin_respuesta: 'Respuesta a la hora: sin respuesta', no_pregunto: 'Respuesta a la hora: nunca te la preguntó' }[s.respuesta];
      var used = this.consumables.used;
      var summary = [
        MR.I18N.cat(MR.tf('Dificultad: {d} (faltas permitidas para el final bueno: {f})', { d: MR.t(diff.nombre), f: diff.faltas }),
          this.mod ? ' · ' + MR.tf('Noche especial: {n}', { n: MR.t(MR.NOCHES_ESPECIALES[this.mod].nombre) }) : ''),
        answer,
        MR.tf('Miradas a su cara después de la advertencia: {n}', { n: s.mirada }),
        MR.tf('Revisiones del pasillo con charcos: {n} de {de}', { n: s.pasillo, de: MR.Config.MOP_CHECKS.length }),
        MR.tf('Filtros de pelusa saturados: {n}', { n: s.filtro }),
        MR.tf('Charcos fregados: {n}', { n: s.charcos }),
        MR.tf('Parpadeos: {n}', { n: s.parpadeos }),
        MR.tf('Cigarros: {c} · Tragos de la petaca: {t} · Porros: {p} · Cafés: {k}', { c: used.cigarros, t: used.tragos, p: used.porros, k: used.cafes }),
        MR.tf('Salidas al bosque: {n} · Hojas del registro: {h} de 6', { n: this.bosque.visits, h: this.bosque.pagesFound() }),
        MR.tf('Caricias a Pelusa: {c} · Bufidos de alarma: {b} · Objetos perdidos encontrados: {o}',
          { c: this.gato.pets, b: this.gato.hisses, o: this.objetos.foundTonight }),
        MR.I18N.cat(MR.tf('Pelusa: {e}', { e: MR.t(this.gato.recuerdos().estado) }), ' · ',
          MR.tf('Fotos que revelaron algo: {n} de {t}', { n: this.fotos.reveladasNoche || 0, t: this.fotos.tonight })),
        MR.I18N.cat(MR.tf(this.pasillo.visits === 1 ? 'Pasillo de servicio: {n} visita' : 'Pasillo de servicio: {n} visitas', { n: this.pasillo.visits }),
          ' · ', MR.t(this.pasillo.fuses ? 'Fusibles: restablecidos' : 'Fusibles: sin tocar'))
      ];
      document.body.classList.remove('jugando');
      this.tilt.stop();
      this.music.disconnect(true);
      // Evaluación del gerente: 100 puntos menos las faltas, más lo que encontraste.
      var score = 100 - 15 * (s.mirada + s.pasillo + s.filtro) -
        (s.respuesta === 'incorrecta' ? 25 : (s.respuesta === 'correcta' ? 0 : 12)) +
        5 * this.bosque.pagesFound() + (reason === 'bosque' ? 15 : 0) + (good ? 10 : 0) + Math.min(10, s.charcos * 2) +
        (reason === 'bosque' && this.flags.secreto ? 25 : 0);
      var grade = MR.Game.grade(score);
      summary.unshift(MR.tf('Evaluación del turno: {nota} ({p} puntos)', { nota: grade[0], p: Math.max(0, Math.round(score)) }));
      this.grade = grade[0];
      // Récords: qué final fue (en el mismo orden que la pantalla final de abajo) y si es la mejor nota en esta dificultad.
      var truth = reason === 'bosque' && this.flags.secreto;
      this.ending = truth ? 'verdadero' : (reason === 'bosque' ? 'bosque' : (diff.sinSustos ? 'paseo' : (good ? 'bueno' : 'bucle')));
      if (this.historial.record({ score: score, grade: grade[0], difficulty: this.options.difficulty, ending: this.ending, night: this.night })) {
        summary.splice(1, 0, MR.tf('¡Nuevo récord en {d}!', { d: MR.t(diff.nombre) }));
      }
      this.ui.renderHistorial(this.historial);
      this.ui.renderPelusa(this.gato);
      // Logros del final del turno.
      var L = this.logros;
      L.unlock('primer_turno');
      if (reason === 'bosque') { L.unlock('final_bosque'); } else if (good) { L.unlock('final_bueno'); } else { L.unlock('bucle'); }
      if (good && reason !== 'bosque' && diff === MR.DIFICULTAD.pesadilla) { L.unlock('pesadilla'); }
      if (s.pasillo === 0 && s.filtro === 0) { L.unlock('pulcro'); }
      if (this.flags.customerSeen && s.mirada === 0) { L.unlock('ojos_al_suelo'); }
      if (this.consumables.used.porros >= 3) { L.unlock('paranoia'); }
      this.ui.showGrade(grade[0], grade[1]);
      if (reason !== 'bosque') {
        if (good) { this.audio.ding(); this.audio.door(); } else { this.audio.thud(); this.audio.buzz(); }
      }
      // Final verdadero: en la misma noche le dijiste la hora verdadera (se fue) y cerraste el ciclo en el claro.
      if (truth) { L.unlock('verdadero'); }
      if (diff.sinSustos && reason !== 'bosque') {
        this.ui.showEnd('05:12 · Paseo nocturno', 'Recorriste la lavandería, el bosque y el pasillo sin que nadie te mirara. Afuera sigue lloviendo. Esta vez fue solo un paseo.', summary);
      } else if (truth) {
        var cierre = this.pelusaSale === undefined ? '' : MR.t(this.pelusaSale ? 'Pelusa sale contigo.' : 'Pelusa se queda en la puerta.');
        this.ui.showEnd(MR.HISTORIA.verdadero.titulo, MR.I18N.cat(MR.t(MR.HISTORIA.verdadero.texto), cierre ? ' ' : '', cierre), summary);
      } else if (reason === 'bosque') {
        this.ui.showEnd(MR.HISTORIA.final.titulo, MR.HISTORIA.final.texto, summary);
      } else if (good) {
        this.ui.showEnd('05:12 · Turno terminado',
          MR.I18N.cat(MR.t('Las lavadoras se detienen una por una. Afuera sigue lloviendo, pero la puerta por fin abre. El banco amarillo está vacío y seco.'),
            this.flags.secreto ? ' ' + MR.t('Él no volvió a preguntar la hora. Nadie volverá a preguntártela.') : ''),
          summary);
      } else {
        this.ui.showEnd('01:10 · Turno de medianoche',
          MR.tf('Parpadeas. El reloj marca la una y diez. Sobre el mostrador, el registro dice: «{t}» El turno no terminó.', { t: MR.t(MR.TEXTS.collapse) }),
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

  /** Letra y comentario del gerente según los puntos del turno. */
  Game.grade = function (score) {
    if (score >= 100) { return ['A', 'Empleado del mes. Tu foto ya está junto al cambiador. Nadie recuerda haberla tomado.']; }
    if (score >= 80) { return ['B', 'Buen turno. El pasillo brilla. Casi no se nota lo que pasó.']; }
    if (score >= 60) { return ['C', 'Pasable. Hay pelusa en un filtro y alguien dejó huellas en el vidrio.']; }
    if (score >= 40) { return ['D', 'El gerente quiere hablar contigo. Mañana. A la una y diez.']; }
    return ['F', 'No vuelvas mañana… aunque siempre vuelves.'];
  };

  MR.Game = Game;
})(window.MR = window.MR || {});
