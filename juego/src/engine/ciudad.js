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

  class Ciudad {
    constructor(game) {
      this.game = game;
      this.c = game.world.city;
      this.carTimer = U.rand(1, 3);
      this.personTimer = U.rand(2, 5);
      this.vida = 1;
      this.agua = 0;
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
      if (!inSala) { g.audio.setCity(0); return; }
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

    /** Tocar la vidriera: lo que se ve afuera a esta hora. */
    look() {
      var g = this.game;
      var t;
      if (this.agua > 0.08) { t = '(El agua ya cubre la calle. Las farolas siguen encendidas debajo, y la cruz de la farmacia también.)'; }
      else if (this.vida > 0.6) { t = '(Afuera, la avenida sigue despierta: un taxi, alguien con paraguas, la farmacia de don Pedro encendida.)'; }
      else if (this.vida > 0.2) { t = '(La avenida se va quedando sola. Las ventanas de enfrente se apagan una por una.)'; }
      else { t = '(Ya no pasa nadie. Solo la farmacia sigue encendida, como si esperara a alguien.)'; }
      g.gameplay.say('vidriera', t, 5);
    }
  }

  MR.Ciudad = Ciudad;
})(window.MR = window.MR || {});
