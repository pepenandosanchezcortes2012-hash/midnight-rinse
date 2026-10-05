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
      this.ghostAt = U.rand(272, 292); // el 86 bajo el agua (04:32–04:52), si la calle ya está inundada
      // La gente de la avenida también lleva cerebro de mosca (cada quien con su curiosidad).
      this.c.people.forEach(function (p, i) { p.brain = new MR.Mosca(300 + i, { curiosidad: 0.3 + 0.3 * i, miedo: 0.4 }); });
      this.ghost = { active: false };
      this.silTimer = U.rand(6, 14);
      this.faceAt = U.rand(155, 250); // la cara blanca en una ventana (una vez por noche, si la ves)
      this.drawFacades();
    }

    /** Cuánta vida tiene la avenida a esta hora (1 → 0 entre las 01:50 y las 04:00). */
    vidaAt(min) { return U.clamp(1 - (min - 110) / 130, 0, 1); }

    /** Cuánta agua (0 → 1 entre las 03:30 y las 05:00). */
    aguaAt(min) { return U.clamp((min - 210) / 90, 0, 1); }

    /** Fachadas: ventanas encendidas según la vida (se redibuja solo si cambia cuántas hay). */
    /** Dónde está la ventana i de una fachada, en el lienzo de 64×80. */
    static ventana(w) { return { x: 6 + w.c * 14, y: 6 + Math.round(w.r * 14.8), s: 10 }; }

    /**
     * Fachadas: ventanas encendidas según la vida. Se redibuja solo si cambia algo: cuántas hay, el amanecer, una
     * sombra que cruza, la tele que titila o la cara blanca en una ventana.
     */
    drawFacades() {
      var lit = this.dawn ? 0.05 : 0.12 + 0.75 * this.vida; // de día casi no hay ventanas encendidas
      var dawn = !!this.dawn;
      this.c.facades.forEach(function (f) {
        var on = f.windows.filter(function (w) { return w.at < lit; }).length;
        if (on === f.lit && f.dawn === dawn && !f.sucio) { return; }
        f.dawn = dawn;
        f.lit = on;
        f.sucio = false;
        var x = f.tex.ctx;
        x.fillStyle = dawn ? '#6e544a' : '#2a1f1c'; // de día, el ladrillo se ve
        x.fillRect(0, 0, 64, 80);
        f.windows.forEach(function (w, i) {
          var glow = w.at < lit;
          var tele = (i + f.seed) % 7 === 0;
          var v = Ciudad.ventana(w);
          // De noche: luz amarilla (o la tele azul, que titila). De día: los vidrios reflejan el cielo gris.
          x.fillStyle = glow ? (tele ? (f.teleBrillo ? '#a8c8ff' : '#6f94e0') : '#ffd27a') : (dawn ? '#8fa2b3' : '#121314');
          x.fillRect(v.x, v.y, v.s, v.s);
          if (glow) {
            x.fillStyle = 'rgba(40,25,10,0.35)'; // el marco de la ventana
            x.fillRect(v.x + 4, v.y, 1, v.s);
          }
          var s = f.silueta;
          if (s && s.i === i && glow) {
            if (s.tipo === 'cara') {
              x.fillStyle = '#2a1f1c'; x.fillRect(v.x + 3, v.y + 6, 5, 4);      // los hombros, a contraluz
              x.fillStyle = '#f0eee8'; x.fillRect(v.x + 4, v.y + 2, 3, 4);      // la cara blanca, lisa
            } else {
              var sx = v.x + Math.round(s.p * (v.s - 4));
              x.fillStyle = '#3a2716';
              x.fillRect(sx + 1, v.y + 2, 2, 2);                               // la cabeza
              x.fillRect(sx, v.y + 4, 4, 6);                                   // el cuerpo
            }
          }
        });
        f.tex.texture.needsUpdate = true;
      });
    }

    /**
     * Ventanas con vida: a veces una sombra cruza detrás de una ventana encendida; las teles titilan; y, una vez por
     * noche después de las 02:30, en una ventana hay una cara blanca mirando la lavandería. Si la ves, la luz se apaga.
     */
    _ventanas(dt) {
      var g = this.game;
      var self = this;
      var fs = this.c.facades;
      var lit = 0.12 + 0.75 * this.vida;
      // La tele azul titila (redibuja solo las fachadas que tienen una tele encendida).
      this.teleT = (this.teleT || 0) - dt;
      if (this.teleT <= 0) {
        this.teleT = U.rand(0.15, 0.5);
        fs.forEach(function (f) {
          var hay = f.windows.some(function (w, i) { return (i + f.seed) % 7 === 0 && w.at < lit; });
          if (hay) { f.teleBrillo = !f.teleBrillo; f.sucio = true; }
        });
      }
      // Una sombra que cruza (o la cara blanca, que se queda).
      var activa = fs.filter(function (f) { return f.silueta; })[0];
      if (activa) {
        var s = activa.silueta;
        s.t -= dt;
        if (s.tipo === 'sombra') { s.p = Math.min(1, s.p + dt / 2.5); activa.sucio = true; }
        if (s.tipo === 'cara' && !this.faceSeen) {
          var w = activa.windows[s.i];
          var v = Ciudad.ventana(w);
          var wx = activa.x - ((v.x + v.s / 2) / 64 - 0.5) * activa.w; // el plano está girado: u crece hacia −x
          var wy = activa.cy + (0.5 - (v.y + v.s / 2) / 80) * activa.h;
          if (this._seen(wx, wy, 12.9)) {
            this.faceSeen = true;
            s.t = Math.min(s.t, 2.5); // la miraste: en un momento, la luz se apaga
            g.ui.subtitle('(En una ventana de enfrente, una cara blanca mira hacia la lavandería.)', 5);
            g.dread = Math.min(1, g.dread + 0.04);
          }
        }
        if (s.t <= 0) {
          if (s.tipo === 'cara') { activa.windows[s.i].at = 2; } // esa luz ya no vuelve a encenderse
          activa.silueta = null;
          activa.sucio = true;
        }
        return;
      }
      this.silTimer -= dt;
      var cara = !this.faceDone && g.minutes >= this.faceAt;
      if (this.silTimer > 0 && !cara) { return; }
      this.silTimer = U.rand(8, 18) / Math.max(0.3, this.vida);
      var candidatas = [];
      fs.forEach(function (f) {
        f.windows.forEach(function (w, i) { if (w.at < lit && (i + f.seed) % 7 !== 0) { candidatas.push({ f: f, i: i }); } });
      });
      if (!candidatas.length) { return; }
      var elegida = candidatas[Math.floor(Math.random() * candidatas.length)];
      if (cara) { this.faceDone = true; }
      elegida.f.silueta = { i: elegida.i, tipo: cara ? 'cara' : 'sombra', p: 0, t: cara ? 9 : 2.6 };
      elegida.f.sucio = true;
      self.ventanasActivas = (self.ventanasActivas || 0) + 1;
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
      if (!this.dawn) { this._ventanas(dt); }
      this.drawFacades();
      this._cars(dt);
      this._people(dt);
      if (this.dawn) { c.bus.visible = false; c.sweeper.visible = false; c.ghostBus.visible = false; } else { this._bus(dt); this._sweeper(dt); this._ghostBus(dt); }
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
          p.looked = false;
          p.stop = 0;
        }
      }
      var self = this;
      this.c.people.forEach(function (k) {
        if (!k.active) { return; }
        if (self._curious(k, dt)) { return; } // se detuvo a mirar la lavandería
        k.group.position.x += k.dir * k.speed * dt;
        k.bob = (k.bob || 0) + dt * 6;
        k.group.position.y = 0.12 + Math.abs(Math.sin(k.bob)) * 0.03;
        if (k.dir * k.group.position.x > 21) { k.active = false; k.group.visible = false; }
      });
    }

    /**
     * El cerebro de mosca de quien pasa: si estás junto a la vidriera, a veces (según su curiosidad) se detiene a mirar
     * la lavandería un momento y sigue su camino.
     */
    _curious(k, dt) {
      var g = this.game;
      if (k.stop > 0) {
        k.stop -= dt;
        k.group.rotation.y = Math.PI; // de frente a la vidriera
        if (k.stop <= 0) { k.group.rotation.y = k.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
        return true;
      }
      var b = k.brain;
      if (!b) { return false; }
      var pp = g.player.pos;
      var x = k.group.position.x;
      var junto = pp.z > 2.6 && Math.abs(pp.x - x) < 6;
      b.limpiar();
      if (junto) {
        b.estimulo(Math.atan2(pp.x - x, pp.z - k.group.position.z) - k.group.rotation.y, 0.8);
        b.contexto(MR.Mosca.CTX.vidriera, 0.8);
      }
      b.sentir({ atraccion: junto ? 0.6 : 0, sueno: 0, ruido: 0 });
      b.pensar(dt);
      if (!k.looked && junto && Math.abs(pp.x - x) < 2.5 && b.accion() === 'acercarse') {
        k.looked = true;
        k.stop = 2.5;
        return true;
      }
      return false;
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

    /** El 86 bajo el agua: una franja de luz que cruza por debajo de la superficie, despacio, con un rumor sordo. */
    _ghostBus(dt) {
      var g = this.game;
      var s = this.ghost;
      var m = this.c.ghostBus;
      if (!s.active) {
        if (this.ghostAt !== null && g.minutes >= this.ghostAt) {
          this.ghostAt = null;
          if (this.agua < 0.45) { return; } // sin agua suficiente, no pasa
          s.active = true;
          s.x = 26;
          s.t = 0;
          m.visible = true;
          g.audio.rumorAgua();
        }
        return;
      }
      s.t += dt;
      s.x -= 4.5 * dt;
      m.position.set(s.x, this.c.water.position.y + 0.02, 9.9);
      this.c.ghostMat.uniforms.uEmissive.value = 0.7 + Math.sin(s.t * 6) * 0.18; // el agua la hace ondular
      if (!this.ghostSeen && this._seen(s.x, m.position.y, 9.9)) {
        this.ghostSeen = true;
        g.ui.subtitle('(Bajo el agua de la avenida pasa una franja de luz, despacio, como las ventanas de un autobús.)', 6);
        g.dread = Math.min(1, g.dread + 0.04);
      }
      if (s.x < -26) { s.active = false; m.visible = false; }
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
