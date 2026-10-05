/**
 * Jugabilidad táctil (todo con las manos, sin HUD): monedas, perillas con retenes (MR.DetentDial), filtros de
 * pelusa, charcos y trapeador, radio, teléfono, impresora térmica, reloj de pared y la hoja del registro.
 * La interacción es un rayo desde el centro de la vista (alcance 2.2 m); mantener el clic sostiene la acción.
 */
(function (MR) {
  'use strict';

  var U = MR.Util;
  var BUSY = { washerCoin: 1, washerDial: 1, radioDial: 1, dryerFilter: 1, dryerStart: 1, lavabo: 1, changer: 1, changerTray: 1, phone: 1, washerDoor: 1 };
  var HAPTIC = { dialClick: 10, coin: 25, changer: [12, 40, 12], tray: [10, 30, 15], door: 20, mopPulse: 18, filterPulse: 7 };

  class Gameplay {
    constructor(game) {
      var C = MR.Config;
      this.game = game;
      this.world = game.world;
      this.audio = game.audio;
      this.coins = 0;
      this.mopHeld = false;
      this.hover = null;
      this.active = null;
      this.progress = 0;
      this.messageCooldown = {};
      this.raycaster = new THREE.Raycaster();
      this.raycaster.far = C.REACH;
      this.center = new THREE.Vector2(0, 0);

      this.washers = this.world.washers.map(function (w, i) {
        return { running: i === 1 || i === 3, remaining: i === 1 ? 20 : (i === 3 ? 12 : 0), credit: false,
          dial: new MR.DetentDial(15, 0.35, 3), door: 0, doorTarget: 0, mesh: w };
      });
      this.dryers = this.world.dryers.map(function (d, i) {
        return { running: i === 2, lint: i === 2 ? 0.35 : 0.1, overheated: false, stopIn: U.rand(40, 60), mesh: d, cleaning: 0 };
      });
      this.puddleActive = this.world.puddles.map(function (p, i) { return i === 2 || i === 5; });
      this.nextPuddle = 8;
      this.collapsed = false;

      this.radioDial = new MR.DetentDial(1.8, 0.3, 0.5);
      this.radioRaw = (101.3 - 88) / 20 * 720;
      this.radioFreq = 101.3;
      this.radioProximity = 0;
      this.radioShown = '';
      this.phoneRinging = false;
      this.phoneRingUntil = 0;
      this.receiptAnim = -1;
      this.clockMinute = -1;
      this.mopHome = true;
      this.trayCoins = 0;
      this.hapticTimer = 0;
      this._applyPuddles();
      this._drawRadio();
    }

    say(key, text, seconds) {
      var now = performance.now();
      if (this.messageCooldown[key] && now < this.messageCooldown[key]) { return; }
      this.messageCooldown[key] = now + 20000;
      this.game.ui.subtitle(text, seconds || 3.5);
    }

    // ---------------------------------------------------------------------------------------------
    // Interacción
    // ---------------------------------------------------------------------------------------------
    /** Objetivo interactivo en un punto de la pantalla (NDC); lo usa el tap directo en móvil. */
    targetAt(camera, ndc) {
      var picked = this._pick(camera, ndc);
      return picked ? picked.userData.interact : null;
    }

    _pick(camera, ndc) {
      // Matrices al día aunque aún no se haya renderizado este cuadro (objetos movidos por eventos, pruebas).
      this.world.scene.updateMatrixWorld();
      camera.updateMatrixWorld();
      this.raycaster.setFromCamera(ndc || this.center, camera);
      var hits = this.raycaster.intersectObjects(this.world.scene.children, true);
      for (var i = 0; i < hits.length; i += 1) {
        var o = hits[i].object;
        if (!this._visible(o)) { continue; }
        var target = o;
        for (var up = 0; up < 3 && target; up += 1) {
          if (target.userData && target.userData.interact) { return target; }
          target = target.parent;
        }
        return null; // el primer objeto visible tapa a los demás
      }
      return null;
    }

    _visible(o) {
      while (o) { if (!o.visible) { return false; } o = o.parent; }
      return true;
    }

    /** Devuelve el estado para animar las manos. */
    updateInteraction(dt, input, camera) {
      var picked = this._pick(camera);
      this.hover = picked ? picked.userData.interact : null;
      var hands = { hover: !!this.hover, coins: Math.min(4, this.coins), mop: this.mopHeld, acting: false, dialing: false, dialAngle: 0 };

      if (input.buttonPressed && !this.active) {
        // Ratón: lo que está en el centro de la vista. Táctil: lo que tocó el dedo.
        var target = input.aimNdc ? this.targetAt(camera, input.aimNdc) : this.hover;
        if (target) { this._begin(target, input); }
      }
      if (this.active) {
        if (input.buttons) {
          this._hold(dt, input, hands);
        } else {
          if (input.tapNudge) { this._nudge(this.active); }
          this.active = null;
          this.progress = 0;
        }
      }
      return hands;
    }

    /** Tap rápido sobre una perilla: avanza exactamente un retén. */
    _nudge(target) {
      if (target.kind === 'washerDial') {
        var w = this.washers[target.index];
        this._dialClicks(w, w.dial.drag(15 / 0.65));
      } else if (target.kind === 'radioDial') {
        this._tuneRadio(3.6 / 0.7);
      }
    }

    _begin(target, input) {
      var kind = target.kind;
      if (this.mopHeld && BUSY[kind]) {
        this.say('busy', '(Tienes las manos ocupadas con el trapeador.)');
        return;
      }
      if (kind === 'washerCoin') { this._insertCoin(target.index); return; }
      if (kind === 'dryerStart') { this._dryerCoin(target.index); return; }
      if (kind === 'lavabo') { this.game.espejo.sink(); return; }
      if (kind === 'banco') { this.game.touchBench(); return; }
      if (kind === 'visitante') { this.game.clientela.talk(target.index); return; }
      if (kind === 'nino') { this.game.clientela.touchChild(target.index); return; }
      if (kind === 'vidriera') { this.game.ciudad.look(); return; }
      if (kind === 'secadoraSola') { this.game.bosque.touchLoneDryer(); return; }
      if (kind === 'campana') { this.game.bosque.ringBell(); return; }
      if (kind === 'puente') { this.game.bosque.touchBridge(); return; }
      if (kind === 'cajaMostrador') { this.world.giftBox.visible = false; this.game.objetos.give('placa'); return; }
      if (kind === 'cesto') {
        var full = this.game.horror.basketLevel || 0;
        this.say('cesto', full ? '(Están tibios. Ninguno tiene nombre todavía.)' : '(Un cesto de plástico vacío.)', 3.5);
        return;
      }
      if (kind === 'ropaDoblada') { this.say('ropa', '(Está tibia, recién salida de una secadora que nadie usó.)', 4); return; }
      if (kind === 'changer') { this._changer(); return; }
      if (kind === 'changerTray') { this._pickTray(); return; }
      if (kind === 'washerDoor') { this._toggleDoor(target.index); return; }
      if (kind === 'backDoor' && this.game.pasillo.unlocked) { this.game.pasillo.go(); return; }
      if (kind === 'backDoor') {
        this.audio.door();
        MR.Haptics.pulse([30, 50, 30]);
        this.say('backdoor', '(Está cerrada con llave. Del otro lado, algo gotea.)', 3.5);
        return;
      }
      if (kind === 'mopStand') { this._toggleMop(); return; }
      if (kind === 'phone') { this._phone(); return; }
      if (kind === 'note') { this.game.openNote(); return; }
      if (kind === 'tareas') { this.game.openTasks(); return; }
      if (kind === 'tele') { this.game.tele.togglePlay(); return; }
      if (kind === 'salirBosque' && this.game.epilogue) { this.game.finishEpilogue(); return; } // al amanecer: la calle
      if (kind === 'salirBosque' || kind === 'entrarLavanderia') { this.game.bosque.go(); return; }
      if (kind === 'lavadoraBosque') { this.game.bosque.touchWasher(); return; }
      if (kind === 'paginaBosque') { this.game.bosque.takePage(target.index); return; }
      if (kind === 'gato') { this.game.gato.pet(); return; }
      if (kind === 'cafe') { this.game.consumables.tryCoffee(); return; }
      if (kind === 'volverSala') { this.game.pasillo.go(); return; }
      if (kind === 'casillero') { this.game.pasillo.locker(target.index); return; }
      if (kind === 'fusibles') { this.game.pasillo.fuseBox(); return; }
      if (kind === 'teleCanal') { this.game.tele.next(); return; }
      if (kind === 'puddle' && !this.mopHeld) {
        this.say('nomop', '(Necesitas el trapeador. Está en el almacén, al fondo a la izquierda.)');
        return;
      }
      this.active = target;
      this.progress = 0;
    }

    _hold(dt, input, hands) {
      var a = this.active;
      var C = MR.Config;
      if (a.kind === 'washerDial') {
        hands.dialing = true;
        var w = this.washers[a.index];
        this._dialClicks(w, w.dial.drag((input.mouseDX + input.dragDX * 0.8) * 0.6));
        hands.dialAngle = w.dial.angle;
      } else if (a.kind === 'radioDial') {
        hands.dialing = true;
        this._tuneRadio((input.mouseDX + input.dragDX * 0.8) * 0.5);
        hands.dialAngle = this.radioRaw;
      } else if (a.kind === 'dryerFilter') {
        hands.acting = true;
        var d = this.dryers[a.index];
        this.progress += dt;
        this._rhythm(dt, 0.25, HAPTIC.filterPulse);
        d.mesh.lint.visible = true;
        d.mesh.lint.position.z = -4.3 + Math.min(1, this.progress / 0.4) * 0.22;
        if (Math.random() < dt * 6) { this.audio.lint(); }
        if (this.progress >= C.FILTER_CLEAN_SECONDS) {
          d.lint = 0;
          d.overheated = false;
          d.mesh.lint.visible = false;
          this.active = null;
          this.say('filter' + a.index, '(Filtro limpio. La pelusa está tibia y húmeda.)', 3);
        }
      } else if (a.kind === 'puddle') {
        hands.acting = true;
        this.progress += dt;
        // Pulso rítmico suave que imita la fricción del trapeador.
        this._rhythm(dt, 0.32, HAPTIC.mopPulse);
        if (Math.random() < dt * 3) { this.audio.mop(); }
        var p = this.world.puddles[a.index].mesh;
        p.scale.setScalar(Math.max(0.15, 1 - this.progress / C.MOP_SECONDS));
        if (this.progress >= C.MOP_SECONDS) {
          this.puddleActive[a.index] = false;
          p.scale.setScalar(1);
          this._applyPuddles();
          this.active = null;
          this.game.onPuddleMopped();
        }
      }
    }

    _clicks(n) {
      for (var i = 0; i < Math.min(n, 3); i += 1) { this.audio.click(); }
      // Micro-vibración corta por cada retén mecánico.
      if (n > 0) { MR.Haptics.pulse(HAPTIC.dialClick); }
    }

    _dialClicks(w, clicks) {
      this._clicks(clicks.length);
      w.mesh.dial.rotation.y = -w.dial.angle * Math.PI / 180;
      if (clicks.length && w.credit && !w.running && this.game.mod === 'sin_agua') {
        this.say('nowater', '(La perilla gira, pero no entra agua. La lavadora solo zumba.)');
      } else if (clicks.length && w.credit && !w.running) {
        w.credit = false;
        w.running = true;
        w.remaining = MR.Config.WASHER_CYCLE_MIN;
        this.audio.buzz();
      } else if (clicks.length && !w.credit && !w.running) {
        this.say('nocredit', '(La perilla gira, pero la lavadora no arranca sin una moneda.)');
      }
    }

    /** Sintoniza la radio en una frecuencia (al conectar tu música salta sola a la 99.9). */
    tuneTo(freq) {
      this.radioRaw = U.clamp((freq - 88) / 20 * 720, 0, 720);
      this.radioFreq = 88 + this.radioRaw / 720 * 20;
      this.world.radioDialMesh.rotation.y = -this.radioRaw * Math.PI / 180;
      this.audio.click();
      this._drawRadio();
    }

    _tuneRadio(delta) {
      var clicks = this.radioDial.drag(delta);
      this._clicks(Math.min(2, clicks.length));
      this.radioRaw = U.clamp(this.radioRaw + delta * 0.7, 0, 720);
      this.world.radioDialMesh.rotation.y = -this.radioRaw * Math.PI / 180;
    }

    _rhythm(dt, period, pattern) {
      this.hapticTimer -= dt;
      if (this.hapticTimer <= 0) {
        MR.Haptics.pulse(pattern);
        this.hapticTimer = period;
      }
    }

    _insertCoin(i) {
      var w = this.washers[i];
      if (w.running) { this.say('running', '(Esta lavadora ya está en marcha.)'); return; }
      if (w.credit) { this.say('credit', '(Ya hay una moneda dentro. Gira la perilla.)'); return; }
      if (this.coins <= 0) { this.say('nocoins', '(No tienes monedas. El cambiador está junto a la entrada.)'); return; }
      this.coins -= 1;
      w.credit = true;
      this.audio.coin();
      // Vibración seca y metálica al meter la moneda.
      MR.Haptics.pulse(HAPTIC.coin);
    }

    /** Una moneda en la secadora: gira 40–60 minutos (y junta pelusa en el filtro). */
    _dryerCoin(i) {
      var d = this.dryers[i];
      if (d.running) { this.say('dryerrunning', '(Esta secadora ya está girando.)'); return; }
      if (this.coins <= 0) { this.say('nocoins', '(No tienes monedas. El cambiador está junto a la entrada.)'); return; }
      this.coins -= 1;
      this.audio.coin();
      MR.Haptics.pulse(HAPTIC.coin);
      this.startDryer(i);
      this.say('dryer' + i, '(Metes una moneda. La secadora arranca con un golpe sordo.)', 3);
    }

    /** El botón del cambiador deja caer las monedas en la bandeja. */
    _changer() {
      if (this.trayCoins > 0) { this.say('tray', '(Ya hay monedas en la bandeja. Tómalas.)'); return; }
      if (this.coins >= 12) { this.say('fullcoins', '(Ya tienes los bolsillos llenos de monedas.)'); return; }
      this.trayCoins = MR.Config.COINS_PER_PRESS;
      this._showTray();
      this.audio.coin();
      this.audio.coin();
      MR.Haptics.pulse(HAPTIC.changer);
    }

    _pickTray() {
      if (this.trayCoins <= 0) { this.say('emptytray', '(La bandeja está vacía. Presiona el botón amarillo.)', 3); return; }
      this.coins = Math.min(12, this.coins + this.trayCoins);
      this.trayCoins = 0;
      var warm = this.edgeCoin;
      this.edgeCoin = false;
      this._showTray();
      this.audio.coin();
      MR.Haptics.pulse(HAPTIC.tray);
      if (warm) { this.say('tibia', '(La moneda está tibia, como si alguien la hubiera tenido en la mano.)', 4); }
    }

    _showTray() {
      var n = this.trayCoins;
      var edge = !!this.edgeCoin;
      this.world.trayCoins.forEach(function (c, i) { c.visible = !edge && i < n; });
      this.world.edgeCoin.visible = edge;
    }

    _toggleDoor(i) {
      var w = this.washers[i];
      if (w.running) { this.say('locked' + i, '(La puerta está trabada mientras lava.)', 3); MR.Haptics.pulse(12); return; }
      var opening = w.doorTarget <= 0.5;
      w.doorTarget = opening ? 1.25 : 0;
      this.audio.door();
      if (opening && this.game.objetos) { this.game.objetos.onDoorOpen(w); }
      MR.Haptics.pulse(HAPTIC.door);
    }

    _toggleMop() {
      var mop = this.world.mop;
      if (this.mopHeld) {
        this.mopHeld = false;
        mop.position.copy(this.world.mopHome);
        mop.rotation.set(0, 0, 0.12);
        mop.visible = true;
        this.audio.thud();
      } else {
        this.mopHeld = true;
        mop.visible = false;
        this.audio.mop();
      }
    }

    _phone() {
      if (this.phoneRinging) {
        this.phoneRinging = false;
        this.audio.setRinging(false);
        this.game.onPhoneAnswered();
      } else {
        this.say('dialtone', '(Tono de marcar. Nadie del otro lado.)', 3);
      }
    }

    // ---------------------------------------------------------------------------------------------
    // Sistemas en el tiempo del juego
    // ---------------------------------------------------------------------------------------------
    update(dt, gameMinutesDelta, minutes) {
      var C = MR.Config;
      var self = this;
      this.washers.forEach(function (w) {
        if (w.running) {
          w.remaining -= gameMinutesDelta;
          w.mesh.drum.rotation.z += dt * 6;
          if (w.remaining <= 0) { w.running = false; self.audio.buzz(); if (self.game.objetos) { self.game.objetos.onCycleEnd(w); } }
        }
        w.mesh.drum.visible = w.running; // la ropa girando, por el ojo de buey
        w.mesh.lamp.material.uniforms.uEmissive.value = w.running ? 1.6 : (w.credit ? 0.8 : 0.1);
        w.mesh.lamp.material.uniforms.uColor.value.setHex(w.running ? 0x55ff66 : (w.credit ? 0xffcc44 : 0x3a5a3a));
        w.door += (w.doorTarget - w.door) * Math.min(1, dt * 3);
        w.mesh.doorPivot.rotation.y = -w.door;
      });
      this.dryers.forEach(function (d, i) {
        d.mesh.drum.visible = d.running;
        if (d.running) {
          d.lint = Math.min(1, d.lint + gameMinutesDelta / 25);
          d.mesh.drum.rotation.z += dt * 8;
          d.stopIn -= gameMinutesDelta;
          if (d.stopIn <= 0) { d.running = false; }
          if (d.lint >= 1 && !d.overheated) {
            d.overheated = true;
            self.game.infraction('filtro');
            self.say('hot' + i, '(Huele a tela quemada. Una secadora está saturada de pelusa.)', 4);
          }
        }
        d.mesh.steam.forEach(function (puff, k) {
          puff.visible = d.overheated;
          if (d.overheated) {
            var ph = (performance.now() / 1000 * 0.6 + k / 3) % 1;
            puff.position.y = 1.3 + ph * 1.2;
            puff.position.x = d.mesh.x + Math.sin(ph * 6 + k) * 0.1;
            puff.scale.setScalar(0.6 + ph * 1.2);
          }
        });
      });

      this.nextPuddle -= gameMinutesDelta;
      if (this.nextPuddle <= 0) {
        this.spawnPuddle();
        this.nextPuddle = (this.collapsed ? U.rand(2, 4) : U.rand(6, 10) / (1 + this.game.dread)) / (this.game.mod === 'inundacion' ? 2 : 1);
      }

      this.radioFreq = 88 + this.radioRaw / 720 * 20;
      this.radioProximity = Math.max(0, 1 - Math.abs(this.radioFreq - C.RADIO_STATION) / 0.6);
      this._drawRadio();

      if (this.phoneRinging && performance.now() > this.phoneRingUntil) {
        this.phoneRinging = false;
        this.audio.setRinging(false);
        if (this.phoneGhost) { this.phoneGhost = false; } else { this.game.onPhoneMissed(); }
      }
      if (this.receiptAnim >= 0) {
        this.receiptAnim = Math.min(1, this.receiptAnim + dt / 2);
        this.world.receipt.scale.y = Math.max(0.001, this.receiptAnim);
        if (this.receiptAnim >= 1) { this.receiptAnim = -1; }
      }
      var minute = Math.floor(minutes);
      if (minute !== this.clockMinute || this.game.whispers) {
        this.clockMinute = minute;
        this._drawClock(minutes);
      }
    }

    startDryer(i) {
      var d = this.dryers[i];
      if (!d.running) { d.running = true; d.stopIn = U.rand(40, 60); this.audio.buzz(); }
    }

    spawnPuddle() {
      var free = [];
      this.puddleActive.forEach(function (on, i) { if (!on) { free.push(i); } });
      if (!free.length) { return; }
      this.puddleActive[U.pick(free)] = true;
      this._applyPuddles();
      this.audio.drip();
    }

    activePuddles() { return this.puddleActive.filter(Boolean).length; }

    setCollapsed() {
      this.collapsed = true;
      this._applyPuddles();
    }

    _applyPuddles() {
      var self = this;
      this.world.puddles.forEach(function (p, i) {
        p.mesh.visible = self.puddleActive[i];
        p.mesh.material = self.collapsed ? self.world.mat.darkWater : self.world.mat.water;
      });
    }

    /** El teléfono suena unos segundos. ghost = la llamada fantasma (dos timbrazos y nada). */
    ring(seconds, ghost) {
      this.phoneGhost = !!ghost;
      this.phoneRinging = true;
      this.phoneRingUntil = performance.now() + seconds * 1000;
      this.audio.setRinging(true);
    }

    printReceipt() {
      this.receiptAnim = 0;
      this.audio.printer();
    }

    runningWashers() { return this.washers.filter(function (w) { return w.running; }).length; }
    runningDryers() { return this.dryers.filter(function (d) { return d.running; }).length; }
    overheatedDryers() { return this.dryers.filter(function (d) { return d.overheated; }); }

    _drawRadio() {
      var music = this.game.music;
      var mine = music && music.connected() && Math.abs(this.radioFreq - MR.MusicLink.STATION) < 0.35;
      var text = this.radioFreq.toFixed(1) + (mine ? ' TU' : ' FM');
      var lit = this.radioProximity > 0.5 || mine;
      if (text + lit === this.radioShown) { return; }
      this.radioShown = text + lit;
      var r = this.world.radioDisplay;
      var x = r.ctx;
      x.fillStyle = '#071007';
      x.fillRect(0, 0, 64, 16);
      x.fillStyle = mine ? '#ffd27a' : (lit ? '#9cff8a' : '#4f9a45');
      x.font = 'bold 12px monospace';
      x.textAlign = 'center';
      x.fillText(text, 32, 12);
      r.texture.needsUpdate = true;
    }

    _drawClock(minutes) {
      var c = this.world.clockFace;
      var x = c.ctx;
      x.clearRect(0, 0, 64, 64);
      x.fillStyle = '#e9e4d2';
      x.beginPath(); x.arc(32, 32, 30, 0, Math.PI * 2); x.fill();
      x.strokeStyle = '#222'; x.lineWidth = 2; x.stroke();
      for (var i = 0; i < 12; i += 1) {
        var a = i / 12 * Math.PI * 2;
        x.fillStyle = '#222';
        x.fillRect(32 + Math.sin(a) * 25 - 1, 32 - Math.cos(a) * 25 - 1, 2, 2);
      }
      var h = (minutes / 60) % 12;
      var m = minutes % 60;
      var stutter = this.game.whispers ? Math.floor(performance.now() / 700) % 3 - 1 : 0;
      var s = (minutes * 60) % 60 + stutter * 4;
      [[h / 12, 14, 3, '#111'], [m / 60, 22, 2, '#111'], [s / 60, 24, 1, '#a11']].forEach(function (hand) {
        var ang = hand[0] * Math.PI * 2;
        x.strokeStyle = hand[3];
        x.lineWidth = hand[2];
        x.beginPath(); x.moveTo(32, 32); x.lineTo(32 + Math.sin(ang) * hand[1], 32 - Math.cos(ang) * hand[1]); x.stroke();
      });
      c.texture.needsUpdate = true;
    }
  }

  MR.Gameplay = Gameplay;
})(window.MR = window.MR || {});
