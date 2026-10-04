/**
 * Salir al bosque: la puerta de vidrio (o el botón de la pausa) te saca de la lavandería a un bosque bajo la
 * lluvia; la puerta de la fachada (o el mismo botón) te regresa. El turno sigue corriendo mientras estás afuera:
 * nadie friega los charcos ni vigila las lavadoras.
 *
 * Al cruzar: fundido a negro, teletransporte y cambio de "atmósfera" (las 6 luces del shader, la luz ambiente y
 * la niebla). Afuera las luces son: el brillo de la lavandería por el vidrio, la farola de sodio, el foco de la
 * lavadora del claro y la linterna del celular, que te sigue. La lluvia moja tus lentes (gotas que hay que limpiar).
 */
(function (MR) {
  'use strict';

  var U = MR.Util;
  var FADE_IN = 0.35;
  var FADE_OUT = 0.55;

  class Bosque {
    constructor(game) {
      this.game = game;
      this.world = game.world;
      this.retro = game.retro;
      this.f = game.world.forest;
      this.outside = false;
      this.fade = 0;
      this.travel = null;     // { dir: 'afuera' | 'adentro', phase: 'cierra' | 'abre' }
      this.outdoor = 0;       // 0..1 suavizado (audio)
      this.visits = 0;
      this.dropTimer = 0;
      this.ambientTimer = 12;
      this.firstTime = true;
      var sh = this.retro.shared;
      this.inside = {
        ambient: sh.uAmbient.value.clone(),
        fogNear: sh.uFogNear.value,
        fogFar: sh.uFogFar.value,
        fogColor: sh.uFogColor.value.clone()
      };
      this.outAmbient = new THREE.Vector3(0.035, 0.04, 0.06);
      this.tmp = new THREE.Vector3();
    }

    /** Luz ambiente de base donde estés (el clima le suma los relámpagos). */
    baseAmbient() {
      var p = this.game.pasillo;
      if (p && p.inside) { return p.p.ambient; }
      return this.outside ? this.outAmbient : this.inside.ambient;
    }

    /** ¿Se puede cruzar ahora? (no con la hoja abierta, una pregunta en curso o un cruce a medias). */
    canTravel() {
      var g = this.game;
      var p = g.pasillo;
      return g.state === 'playing' && !this.travel && !g.noteOpen && !g.question && !(p && (p.inside || p.travel));
    }

    /** Cruza la puerta: afuera si estás adentro, adentro si estás afuera. */
    go() {
      if (!this.canTravel()) { return false; }
      this.travel = { dir: this.outside ? 'adentro' : 'afuera', phase: 'cierra' };
      this.game.audio.door();
      MR.Haptics.pulse(20);
      return true;
    }

    update(dt) {
      var g = this.game;
      if (this.endTimer > 0) {
        this.endTimer -= dt;
        if (this.endTimer <= 0 && this.onEndTimer) { this.onEndTimer(); return; }
      }
      if (this.travel) {
        if (this.travel.phase === 'cierra') {
          this.fade = Math.min(1, this.fade + dt / FADE_IN);
          if (this.fade >= 1) {
            this._swap(this.travel.dir === 'afuera');
            this.travel.phase = 'abre';
          }
        } else {
          this.fade = Math.max(0, this.fade - dt / FADE_OUT);
          if (this.fade <= 0) { this.travel = null; }
        }
      }
      this.outdoor += ((this.outside ? 1 : 0) - this.outdoor) * Math.min(1, dt * 2.5);
      if (!this.outside) { return; }

      // La fachada brilla con las luces de adentro (y parpadea con ellas).
      var lf = this.retro.lightFactor;
      this.f.litMaterial.uniforms.uEmissive.value = 1.0 * (lf[0] + lf[1]) / 2;
      this.f.lampMaterial.uniforms.uEmissive.value = 1.2 * lf[2];
      this.f.washerLamp.material.uniforms.uEmissive.value = 1.0 * lf[3];

      // Lluvia en los lentes: gotas pequeñas que se acumulan (límpialas con E o dos dedos hacia abajo).
      this.dropTimer -= dt;
      if (this.dropTimer <= 0) {
        this.dropTimer = U.rand(0.12, 0.4);
        g.glasses.drop();
      }
      // Ambiente: un búho de vez en cuando (las ramas que crujen las programa el director del horror).
      this.ambientTimer -= dt;
      if (this.ambientTimer <= 0) {
        this.ambientTimer = U.rand(18, 40);
        g.audio.buho();
      }
    }

    /** Linterna del celular: un poco delante de la cara. Se llama DESPUÉS de mover al jugador (sin retraso). */
    light() {
      if (!this.outside) { return; }
      var cam = this.game.player.camera;
      var fwd = this.game.player.forward(this.tmp);
      this.retro.shared.uLightPos.value[this.f.flashlight].set(cam.position.x + fwd.x * 0.5, cam.position.y - 0.25, cam.position.z + fwd.z * 0.5);
    }

    _swap(toOutside) {
      var g = this.game;
      var R = this.retro;
      var sh = R.shared;
      var spots = toOutside ? this.f.lights : this.world.lightSpots;
      spots.forEach(function (s, i) { R.setLight(i, new THREE.Vector3(s[0], s[1], s[2]), s[3], s[4], s[5]); });
      if (toOutside) {
        sh.uAmbient.value.copy(this.outAmbient);
        var mod = g.mod;
        sh.uFogNear.value = mod === 'niebla' ? 1.5 : 2.5;
        sh.uFogFar.value = mod === 'niebla' ? 9.0 : (mod === 'luna' ? 20.0 : 15.0);
        if (mod === 'luna') {
          // Luna llena: noche clara, cielo y niebla azul oscuro (los pinos se recortan contra el cielo).
          sh.uAmbient.value.set(0.08, 0.09, 0.13);
          this.outAmbient.set(0.08, 0.09, 0.13);
          sh.uFogColor.value.set(0.035, 0.045, 0.085);
          R.renderer.setClearColor(new THREE.Color(0.035, 0.045, 0.085), 1);
        }
        sh.uFogColor.value.set(0.01, 0.012, 0.018);
      } else {
        sh.uAmbient.value.copy(this.inside.ambient);
        sh.uFogNear.value = this.inside.fogNear;
        sh.uFogFar.value = this.inside.fogFar;
        sh.uFogColor.value.copy(this.inside.fogColor);
        R.renderer.setClearColor(0x000000, 1);
      }
      var spawn = toOutside ? this.f.spawnOutside : this.f.spawnInside;
      var p = g.player;
      p.area = toOutside ? this.f.area : null; // null = la sala
      p.surface = toOutside ? 'tierra' : null;  // pasos sobre tierra mojada
      p.pos.set(spawn.x, 0, spawn.z);
      p.vel.set(0, 0, 0);
      p.yaw = spawn.yaw;
      p.pitch = 0;
      this.outside = toOutside;
      g.audio.door();

      var h = g.horror;
      if (toOutside) {
        this.visits += 1;
        g.logros.unlock('bosque');
        if (this.firstTime) {
          this.firstTime = false;
          g.ui.subtitle('(Afuera llueve. El bosque empieza donde se acaba la luz de la farola.)', 5);
          g.ui.subtitle('(Enciendes la linterna del celular.)', 4);
        } else {
          g.ui.subtitle('(Sales otra vez. La lavandería se queda sola a tus espaldas.)', 4);
        }
        // Si él ya está en la lavandería, no tarda en seguirte.
        if (h.customer.present) { h.nextEvent = Math.min(h.nextEvent, U.rand(5, 9)); }
      } else {
        g.ui.subtitle('(Vuelves a entrar. Huele a detergente y a tierra mojada.)', 4);
        // Si se quedó entre los árboles, vuelve detrás de ti cuando no mires.
        if (h.customer.present && /^bosque_/.test(h.customer.anchor || '')) {
          h.later(U.rand(3, 6), 'cliente_mueve', 'entrada', 3, { to: 'entrada' });
        }
      }
    }

    /** Hojas del registro encontradas en este turno. */
    pagesFound() { return this.found ? this.found.filter(Boolean).length : 0; }

    /** Recoger la hoja i: se lee de cerca y desaparece del bosque. */
    takePage(i) {
      var g = this.game;
      this.found = this.found || [false, false, false, false, false, false];
      if (this.found[i]) { return; }
      this.found[i] = true;
      this.f.pages[i].visible = false;
      var p = MR.HISTORIA.paginas[i];
      if (g.archivo) { g.archivo.page(i); }
      g.audio.click();
      MR.Haptics.pulse(15);
      g.noteOpen = true;
      g.ui.showNote(p.texto, MR.tf('HOJA MOJADA DEL REGISTRO · {f}', { f: MR.t(p.firma).toUpperCase() }));
      var n = this.pagesFound();
      g.logros.unlock('hoja');
      g.ui.subtitle(n < 6 ? MR.tf('(Hojas del registro: {n} de 6.)', { n: n }) : '(Tienes las seis hojas. La lavadora del claro te espera.)', 4);
    }

    /** Tocar la lavadora del claro (con las seis hojas: el tercer final). */
    touchWasher() {
      var g = this.game;
      var n = this.pagesFound();
      if (n === 6 && !this.ending) {
        this.ending = true;
        g.ui.subtitle('(Abres la tapa. El uniforme deja de girar. Metes las seis hojas, una por una.)', 4);
        g.audio.door();
        MR.Haptics.pulse([60, 80, 60, 80, 120]);
        g.dread = Math.min(1, g.dread + 0.2);
        var self = this;
        this.endTimer = 3.2;
        this.onEndTimer = function () { self.game.end('bosque'); };
        return;
      }
      if (n > 0) {
        g.ui.subtitle(MR.tf('(La tapa no abre. Llevas {n} de 6 hojas del registro.)', { n: n }), 4);
        g.audio.click();
        return;
      }
      var lines = [
        '(Está tibia. Adentro gira ropa empapada… es un uniforme como el tuyo.)',
        '(No está conectada a nada. Aun así, sigue lavando.)',
        '(En el vidrio de la puerta, tu reflejo tarda en parpadear.)'
      ];
      g.ui.subtitle(lines[Math.floor(Math.random() * lines.length)], 4.5);
      g.audio.thud();
      MR.Haptics.pulse([40, 60, 40]);
      g.dread = Math.min(1, g.dread + 0.06);
    }
  }

  MR.Bosque = Bosque;
})(window.MR = window.MR || {});
