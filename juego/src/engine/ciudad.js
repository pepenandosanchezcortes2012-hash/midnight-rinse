/**
 * La avenida por la vidriera (canon §7): Blackwood como era antes del agua, vista desde La Espuma.
 * - Vida: llena hasta las 01:50 (autos, gente con paraguas, ventanas y letreros encendidos) y se va apagando hasta
 *   las 04:00. La cruz verde de la farmacia de don Pedro nunca se apaga.
 * - Agua: desde las 03:30 sube por la calle y, a las 05:00, cubre la vereda. Las farolas siguen encendidas debajo.
 * - Sonido: un murmullo de tráfico según la vida y el siseo de cada auto al pasar (de un lado al otro).
 * - Tocar la vidriera: lo que se ve afuera a esta hora.
 * Las geometrías las arma world._city(); aquí solo se animan (y nada corre si no estás en la sala).
 */
(function (MR) {
  'use strict';

  var U = MR.Util;
  var LANES = [{ dir: 1, z: 8.0 }, { dir: -1, z: 9.7 }];
  var WALKS = [5.8, 11.8];
  var BUS_STOP = 5.2;  // dónde se detiene el 86 (frente a la vidriera grande)
  var BUS_Z = 10.3;    // pegado a la vereda de enfrente

  class Ciudad {
    constructor(game) {
      this.game = game;
      this.c = game.world.city;
      this.carTimer = U.rand(1, 3);
      this.personTimer = U.rand(2, 5);
      this.vida = 1;
      this.agua = 0;
      // El autobús 86 pasa dos veces (antes de que suba el agua); la barredora, una vez, a la 01:40.
      this.busPlan = [U.rand(95, 118), U.rand(180, 205)];
      this.bus = { active: false };
      this.sweepAt = U.rand(96, 106);
      this.sweep = { active: false };
      this.drawFacades();
    }

    /** Cuánta vida tiene la avenida a esta hora (1 → 0 entre las 01:50 y las 04:00). */
    vidaAt(min) { return U.clamp(1 - (min - 110) / 130, 0, 1); }

    /** Cuánta agua (0 → 1 entre las 03:30 y las 05:00). */
    aguaAt(min) { return U.clamp((min - 210) / 90, 0, 1); }

    /** Fachadas: ventanas encendidas según la vida (se redibuja solo si cambia cuántas hay). */
    drawFacades() {
      var lit = this.dawn ? 0.05 : 0.12 + 0.75 * this.vida; // de día casi no hay ventanas encendidas
      var dawn = !!this.dawn;
      this.c.facades.forEach(function (f) {
        var on = f.windows.filter(function (w) { return w.at < lit; }).length;
        if (on === f.lit && f.dawn === dawn) { return; }
        f.dawn = dawn;
        f.lit = on;
        var x = f.tex.ctx;
        x.fillStyle = dawn ? '#6e544a' : '#2a1f1c'; // de día, el ladrillo se ve
        x.fillRect(0, 0, 32, 40);
        f.windows.forEach(function (w, i) {
          var glow = w.at < lit;
          // De noche: luz amarilla (o la tele azul). De día: los vidrios reflejan el cielo gris.
          x.fillStyle = glow ? ((i + f.seed) % 7 === 0 ? '#8fb4ff' : '#ffd27a') : (dawn ? '#8fa2b3' : '#121314');
          x.fillRect(3 + w.c * 7, 3 + w.r * 7.4, 5, 5);
        });
        f.tex.texture.needsUpdate = true;
      });
    }

    update(dt) {
      var g = this.game;
      var c = this.c;
      var inSala = !g.bosque.outside && !g.pasillo.inside;
      c.group.visible = inSala;
      if (!inSala) { g.audio.setCity(0); g.audio.setSweeper(0); return; }
      this.vida = this.dawn ? 1 : this.vidaAt(g.minutes);
      this.agua = this.dawn ? 0 : this.aguaAt(g.minutes);
      c.water.position.y = -0.6 + this.agua * 1.45;
      // Letreros: la farmacia parpadea pero no se apaga; los demás se apagan con la vida.
      // Al amanecer (final verdadero), la cruz de la farmacia por fin se apaga; no hay lluvia ni paraguas.
      c.signs.farmacia.uniforms.uEmissive.value = this.dawn ? 0 : (Math.random() < 0.04 ? 0.25 : 1.3);
      c.rain.visible = !this.dawn;
      c.signs.tortilleria.uniforms.uEmissive.value = this.vida > 0.4 ? 1.3 : (this.vida > 0.25 && Math.random() < 0.5 ? 0.35 : 0);
      c.signs.hotel.uniforms.uEmissive.value = this.vida > 0.15 ? 1.2 : 0;
      this.drawFacades();
      this._cars(dt);
      this._people(dt);
      if (this.dawn) { c.bus.visible = false; c.sweeper.visible = false; } else { this._bus(dt); this._sweeper(dt); }
      this._rain(dt);
      g.audio.setCity(this.vida * (1 - this.agua));
    }

    _cars(dt) {
      var g = this.game;
      this.carTimer -= dt;
      if (this.carTimer <= 0 && this.vida > 0.08 && this.agua < 0.05) {
        this.carTimer = U.lerp(5, 30, 1 - this.vida) * U.rand(0.7, 1.3);
        var car = this.c.cars.filter(function (k) { return !k.active; })[0];
        if (car) {
          var lane = U.pick(LANES);
          car.active = true;
          car.dir = lane.dir;
          car.speed = U.rand(7, 11);
          car.heard = false;
          car.group.position.set(-25 * lane.dir, 0, lane.z);
          car.group.rotation.y = lane.dir > 0 ? 0 : Math.PI;
          car.group.visible = true;
        }
      }
      this.c.cars.forEach(function (k) {
        if (!k.active) { return; }
        k.group.position.x += k.dir * k.speed * dt;
        // El siseo de las llantas en el asfalto mojado, cuando pasa frente a la vidriera.
        if (!k.heard && k.dir * k.group.position.x > -8) { k.heard = true; g.audio.autoPasa(k.dir); }
        if (k.dir * k.group.position.x > 25) { k.active = false; k.group.visible = false; }
      });
    }

    _people(dt) {
      this.personTimer -= dt;
      if (this.personTimer <= 0 && this.vida > 0.25 && this.agua < 0.02) {
        this.personTimer = U.lerp(6, 25, 1 - this.vida) * U.rand(0.7, 1.4);
        var p = this.c.people.filter(function (k) { return !k.active; })[0];
        if (p) {
          p.active = true;
          p.dir = Math.random() < 0.5 ? 1 : -1;
          p.speed = U.rand(0.9, 1.3);
          p.group.position.set(-21 * p.dir, 0.12, U.pick(WALKS));
          p.group.rotation.y = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          p.group.visible = true;
          p.group.children[1].visible = !this.dawn; // el paraguas, solo si llueve
        }
      }
      this.c.people.forEach(function (k) {
        if (!k.active) { return; }
        k.group.position.x += k.dir * k.speed * dt;
        k.bob = (k.bob || 0) + dt * 6;
        k.group.position.y = 0.12 + Math.abs(Math.sin(k.bob)) * 0.03;
        if (k.dir * k.group.position.x > 21) { k.active = false; k.group.visible = false; }
      });
    }

    _rain(dt) {
      var pos = this.c.rain.geometry.attributes.position;
      var a = pos.array;
      var fall = dt * 9;
      for (var i = 0; i < a.length; i += 6) {
        a[i + 1] -= fall;
        a[i + 4] -= fall;
        if (a[i + 4] < -0.1) { a[i + 1] += 4.8; a[i + 4] += 4.8; }
      }
      pos.needsUpdate = true;
    }

    /** ¿Se ve este punto de la avenida desde donde estás (y con los ojos abiertos)? */
    _seen(x, y, z) {
      var g = this.game;
      if (g.player.eyesClosed) { return false; }
      var v = (this.tmp || (this.tmp = new THREE.Vector3())).set(x, y, z).project(g.player.camera);
      return Math.abs(v.x) < 0.9 && Math.abs(v.y) < 0.9 && v.z < 1;
    }

    /**
     * El autobús 86: llega frenando, se detiene enfrente 10 s con el motor encendido y se va. Adentro, todas las
     * caras son blancas; a veces bajan las que vienen a lavar (clientela.fromBus) y cruzan por delante.
     */
    _bus(dt) {
      var g = this.game;
      var b = this.bus;
      var grp = this.c.bus;
      if (!b.active) {
        if (this.busPlan.length && g.minutes >= this.busPlan[0]) {
          this.busPlan.shift();
          if (this.agua > 0.02) { return; } // con la calle inundada ya no pasa
          b.active = true;
          b.phase = 'llega';
          b.x = 27;
          b.speed = 9;
          grp.position.set(b.x, 0, BUS_Z);
          grp.rotation.y = Math.PI; // va hacia -x: su lado +z (las caras, el letrero) mira la lavandería
          grp.visible = true;
        }
        return;
      }
      if (b.phase === 'llega') {
        b.speed = U.clamp((b.x - BUS_STOP) * 0.8, 0.6, 9);
        b.x -= b.speed * dt;
        if (b.x <= BUS_STOP + 0.01) {
          b.x = BUS_STOP;
          b.phase = 'parado';
          b.timer = 10;
          this.busStopped = true; // el locutor lo comenta a las 02:10 (game._bulletin)
          g.audio.frenoBus();
          if (g.clientela) { g.clientela.fromBus(b.x); }
        }
      } else if (b.phase === 'parado') {
        b.timer -= dt;
        if (b.timer <= 0) { b.phase = 'sale'; b.speed = 0.4; g.audio.autoPasa(-1); }
      } else {
        b.speed = Math.min(9, b.speed + dt * 2.4);
        b.x -= b.speed * dt;
        if (b.x < -28) { b.active = false; grp.visible = false; }
      }
      grp.position.x = b.x;
      if (!this.busSeen && b.phase !== 'sale' && this._seen(b.x, 1.8, BUS_Z)) {
        this.busSeen = true;
        g.ui.subtitle('(Un autobús nocturno se detiene enfrente. El letrero dice «86 · BLACKWOOD». Adentro, todas las caras son blancas.)', 6);
        g.dread = Math.min(1, g.dread + 0.03);
      }
    }

    /** La barredora: cruza despacio con la luz naranja girando y el roce de los cepillos. */
    _sweeper(dt) {
      var g = this.game;
      var s = this.sweep;
      var grp = this.c.sweeper;
      if (!s.active) {
        if (this.sweepAt !== null && g.minutes >= this.sweepAt) {
          this.sweepAt = null;
          if (this.agua > 0.02) { return; }
          s.active = true;
          this.sweepDone = true;
          s.x = -26;
          s.t = 0;
          grp.position.set(s.x, 0, 8.0);
          grp.rotation.y = 0;
          grp.visible = true;
        }
        return;
      }
      s.t += dt;
      s.x += 2.2 * dt;
      grp.position.x = s.x;
      this.c.beaconMat.uniforms.uEmissive.value = Math.sin(s.t * 9) > 0 ? 1.8 : 0.25; // la luz que gira
      this.c.brush.rotation.y += dt * 12;
      g.audio.setSweeper(U.clamp(1 - Math.abs(s.x - 2) / 22, 0, 1));
      if (!this.sweepSeen && this._seen(s.x, 1.2, 8.0)) {
        this.sweepSeen = true;
        g.ui.subtitle('(Pasa una barredora con su luz naranja girando. Limpia una calle que el agua va a cubrir.)', 5);
      }
      if (s.x > 26) { s.active = false; grp.visible = false; g.audio.setSweeper(0); }
    }

    /** Tocar la vidriera: lo que se ve afuera a esta hora. */
    look() {
      var g = this.game;
      var t;
      if (this.bus.active && this.bus.phase === 'parado') {
        t = '(El autobús 86 espera enfrente con el motor encendido. Todas las caras de adentro miran hacia la lavandería.)';
      } else if (this.agua > 0.08) { t = '(El agua ya cubre la calle. Las farolas siguen encendidas debajo, y la cruz de la farmacia también.)'; }
      else if (this.vida > 0.6) { t = '(Afuera, la avenida sigue despierta: un taxi, alguien con paraguas, la farmacia de don Pedro encendida.)'; }
      else if (this.vida > 0.2) { t = '(La avenida se va quedando sola. Las ventanas de enfrente se apagan una por una.)'; }
      else { t = '(Ya no pasa nadie. Solo la farmacia sigue encendida, como si esperara a alguien.)'; }
      g.gameplay.say('vidriera', t, 5);
    }
  }

  MR.Ciudad = Ciudad;
})(window.MR = window.MR || {});
