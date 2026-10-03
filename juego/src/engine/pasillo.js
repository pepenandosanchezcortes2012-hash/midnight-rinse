/**
 * El pasillo de servicio, detrás de la puerta trasera. A las 03:00 se oye un clic y la puerta queda entreabierta.
 * Adentro: una bombilla que titila, una tubería que gotea, la caldera y la caja de fusibles (restablecerla hace
 * que los apagones del resto del turno duren la mitad), y siete casilleros: R., E., S., D., T., A.… y el tuyo.
 * Cruce con fundido, igual que el bosque; el turno sigue corriendo mientras estás aquí.
 */
(function (MR) {
  'use strict';

  var U = MR.Util;
  var FADE_IN = 0.35;
  var FADE_OUT = 0.55;
  var LOCKERS = [
    '(Casillero de R. Un gafete con la foto raspada. Huele a cloro.)',
    '(Casillero de E. Una cajetilla vacía y un encendedor que ya no prende.)',
    '(Casillero de S. Alguien escribió por dentro, con plumón: «parpadea menos».)',
    '(Casillero de D. Una linterna sin pilas y una manga de uniforme, sola.)',
    '(Casillero de T. Hojas de registro en blanco, todas con la misma hora: 05:12.)',
    '(Casillero de A. Vacío. En el fondo hay lodo seco, como de bosque.)',
    '(El casillero tiene tu nombre. Adentro hay un gancho vacío. Todavía está tibio.)'
  ];

  class Pasillo {
    constructor(game) {
      this.game = game;
      this.world = game.world;
      this.retro = game.retro;
      this.p = game.world.pasillo;
      this.inside = false;
      this.unlocked = false;
      this.fuses = false;
      this.fade = 0;
      this.travel = null;
      this.muffle = 0;
      this.visits = 0;
      this.dripTimer = 1;
      this.firstTime = true;
    }

    /** A las 03:00: clic metálico y la puerta trasera queda entreabierta. */
    unlock(silent) {
      if (this.unlocked) { return; }
      this.unlocked = true;
      this.game.horror.backDoorTarget = -0.3;
      if (!silent) {
        this.game.audio.click();
        this.game.ui.subtitle('(Al fondo, junto a las secadoras, se oye un clic metálico. La puerta trasera quedó entreabierta.)', 6);
      }
    }

    /** Escribe tu nombre (el de las opciones) en el último casillero. */
    nameLocker(name) {
      var l = this.p.lastLabel;
      var txt = (name || '').trim().toUpperCase().slice(0, 8) || 'TÚ';
      l.ctx.fillStyle = '#e8e1cc';
      l.ctx.fillRect(0, 0, 32, 12);
      l.ctx.fillStyle = '#2b2a26';
      l.ctx.font = 'bold ' + (txt.length > 4 ? 7 : 10) + 'px monospace';
      l.ctx.textAlign = 'center';
      l.ctx.fillText(txt, 16, 10);
      l.texture.needsUpdate = true;
    }

    canTravel() {
      var g = this.game;
      return g.state === 'playing' && !this.travel && !g.noteOpen && !g.question && !g.bosque.outside && !g.bosque.travel;
    }

    go() {
      if (!this.canTravel()) { return false; }
      if (!this.inside && !this.unlocked) { return false; }
      this.travel = { toInside: !this.inside, phase: 'cierra' };
      this.game.audio.door();
      MR.Haptics.pulse(20);
      return true;
    }

    update(dt) {
      var g = this.game;
      if (this.travel) {
        if (this.travel.phase === 'cierra') {
          this.fade = Math.min(1, this.fade + dt / FADE_IN);
          if (this.fade >= 1) { this._swap(this.travel.toInside); this.travel.phase = 'abre'; }
        } else {
          this.fade = Math.max(0, this.fade - dt / FADE_OUT);
          if (this.fade <= 0) { this.travel = null; }
        }
      }
      this.muffle += ((this.inside ? 1 : 0) - this.muffle) * Math.min(1, dt * 2.5);
      if (!this.inside) { return; }
      // La bombilla y la llama siguen a sus luces (que el horror puede hacer titilar).
      var lf = this.retro.lightFactor;
      this.p.bulb.material.uniforms.uEmissive.value = 1.3 * lf[0];
      this.p.flame.uniforms.uEmissive.value = 1.1 + Math.random() * 0.4;
      // Gotas.
      this.dripTimer -= dt;
      if (this.dripTimer <= 0) {
        this.dripTimer = U.rand(1.1, 2.6);
        g.audio.gota(g.horror._panTo(this.world.zones.pasillo_fondo.center, g.player) * 0.5);
      }
    }

    _swap(toInside) {
      var g = this.game;
      var R = this.retro;
      var sh = R.shared;
      var spots = toInside ? this.p.lights : this.world.lightSpots;
      spots.forEach(function (s, i) { R.setLight(i, new THREE.Vector3(s[0], s[1], s[2]), s[3], s[4], s[5]); });
      var base = g.bosque.inside; // ambiente y niebla de la sala
      if (toInside) {
        sh.uAmbient.value.copy(this.p.ambient);
        sh.uFogNear.value = 3;
        sh.uFogFar.value = 13;
      } else {
        sh.uAmbient.value.copy(base.ambient);
        sh.uFogNear.value = base.fogNear;
        sh.uFogFar.value = base.fogFar;
      }
      var spawn = toInside ? this.p.spawnInside : this.p.spawnOutside;
      var pl = g.player;
      pl.area = toInside ? this.p.area : null;
      pl.surface = null;
      pl.pos.set(spawn.x, 0, spawn.z);
      pl.vel.set(0, 0, 0);
      pl.yaw = spawn.yaw;
      pl.pitch = 0;
      this.inside = toInside;
      g.audio.door();
      var h = g.horror;
      if (toInside) {
        this.visits += 1;
        this.nameLocker(g.options.name);
        if (this.firstTime) {
          this.firstTime = false;
          g.ui.subtitle('(El pasillo de servicio huele a óxido y a jabón viejo. Algo gotea.)', 5);
        }
        if (h.customer.present) { h.nextEvent = Math.min(h.nextEvent, U.rand(6, 10)); }
      } else {
        g.ui.subtitle('(Vuelves a la sala. Las secadoras siguen girando.)', 3);
        if (h.customer.present && /^pasillo_/.test(h.customer.anchor || '')) {
          h.later(U.rand(3, 6), 'cliente_mueve', 'secadoras', 3, { to: 'secadoras' });
        }
      }
    }

    /** Abrir un casillero. */
    locker(i) {
      var g = this.game;
      g.audio.click();
      MR.Haptics.pulse(15);
      g.ui.subtitle(LOCKERS[i], 5);
      if (i === LOCKERS.length - 1) {
        g.dread = Math.min(1, g.dread + 0.1);
        g.audio.thud();
        if (g.logros) { g.logros.unlock('casillero'); }
      }
    }

    /** Restablecer los fusibles: los apagones del resto del turno duran la mitad. */
    fuseBox() {
      var g = this.game;
      if (this.fuses) { g.ui.subtitle('(Los fusibles ya están restablecidos.)', 3); return; }
      this.fuses = true;
      this.p.fuseLed.material.uniforms.uColor.value.setHex(0x40ff60);
      g.audio.thud();
      g.audio.click();
      MR.Haptics.pulse([40, 60, 40]);
      g.ui.subtitle('(Bajas y subes los fusibles. Afuera, las luces de la lavandería dejan de zumbar un momento.)', 5);
      if (g.logros) { g.logros.unlock('fusibles'); }
    }
  }

  MR.Pasillo = Pasillo;
})(window.MR = window.MR || {});
