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
      // Al amanecer (final verdadero): la luz gris de la mañana entra por la vidriera.
      if (this.game.epilogue) { return this.dawnAmbient || (this.dawnAmbient = new THREE.Vector3(0.58, 0.53, 0.5)); }
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
      this._lamp2(dt);
      this._infinite();
      this._loneDryer(dt);
      // El uniforme de la lavadora del claro gira hasta que metes las seis hojas.
      if (!this.ending && this.f.claroDrum) { this.f.claroDrum.rotation.z += dt * 5; }
      this._bridge(dt);
      if (this.bellSwing > 0) { this.bellSwing = Math.max(0, this.bellSwing - dt); this.f.bellCup.rotation.z = Math.sin(this.bellSwing * 9) * this.bellSwing * 0.25; }
      g.audio.setForest(1 - g.dread * 0.6);
      this._clothesline(dt);
      // Ambiente: un búho de vez en cuando (las ramas que crujen las programa el director del horror).
      this.ambientTimer -= dt;
      if (this.ambientTimer <= 0) {
        this.ambientTimer = U.rand(18, 40);
        g.audio.buho();
      }
    }

    /** El tendedero de luna llena: los uniformes se mecen (sin viento); al verlo de cerca, el subtítulo (una vez). */
    _clothesline(dt) {
      var line = this.f.clothesline;
      if (!line.visible) { return; }
      this.lineTime = (this.lineTime || 0) + dt;
      var t = this.lineTime;
      this.f.shirts.forEach(function (p, i) { p.rotation.x = Math.sin(t * 1.3 + i * 1.7) * 0.16; });
      if (this.lineNoticed) { return; }
      var g = this.game;
      var v = (this.tmp3 || (this.tmp3 = new THREE.Vector3())).set(line.position.x, 1.6, line.position.z);
      var close = U.distXZ(g.player.pos, v) < 7;
      v.project(g.player.camera);
      if (close && Math.abs(v.x) < 0.9 && Math.abs(v.y) < 0.9 && v.z < 1 && !g.player.eyesClosed) {
        this.lineNoticed = true;
        g.ui.subtitle('(Entre dos pinos hay un tendedero con uniformes colgados. Se mecen, pero no hay viento.)', 5);
        g.dread = Math.min(1, g.dread + 0.04);
      }
    }

    /**
     * El bosque infinito (canon §7): al llegar al borde lejano o a los costados, parpadeas y el bosque te devuelve al
     * otro lado. El sendero sigue igual. Demasiado igual. Los bordes sólidos de world.js quedan de respaldo.
     */
    _infinite() {
      var g = this.game;
      var pl = g.player;
      var p = pl.pos;
      var over = p.z > 148.4 || Math.abs(p.x) > 20.6;
      if (!over) { this.wrapPending = false; return; }
      if (!pl.eyesClosed) {
        // Un parpadeo sin querer (si iba uno a medias, se fuerza en cuanto los ojos terminan de abrirse).
        this.wrapPending = true;
        if (pl.blink.phase === 'open') { pl.blink.timer = 0; }
        return;
      }
      if (p.z > 148.4) { p.z -= 41; }
      if (p.x > 20.6) { p.x -= 40.4; } else if (p.x < -20.6) { p.x += 40.4; }
      this.wrapPending = false;
      this.wraps = (this.wraps || 0) + 1;
      if (this.wraps === 1) { g.ui.subtitle('(Parpadeas. El sendero sigue igual que hace un momento. Demasiado igual.)', 5); }
      if (this.wraps === 2) { this.f.loneDryer.visible = true; }
      if (this.wraps === 3) { this.f.bell.visible = true; }
      if (this.wraps === 4) { this.showBridge(); }
      g.dread = Math.min(1, g.dread + 0.03);
    }

    /** La secadora solitaria: el tambor brilla y vibra; la primera vez que estás cerca, la notas. */
    _loneDryer(dt) {
      var d = this.f.loneDryer;
      if (!d.visible) { return; }
      this.loneT = (this.loneT || 0) + dt;
      this.f.lonePort.material.uniforms.uEmissive.value = 1.0 + Math.sin(this.loneT * 5) * 0.15;
      this.f.loneDrum.rotation.z += dt * 7;
      d.children[0].position.x = Math.sin(this.loneT * 40) * 0.004; // tiembla al centrifugar
      var g = this.game;
      if (!this.loneNoticed && U.distXZ(g.player.pos, d.position) < 9) {
        this.loneNoticed = true;
        g.audio.buzz();
        g.ui.subtitle('(Entre los pinos hay una secadora sola, encendida. El tambor gira. No tiene cable.)', 5);
      }
    }

    /**
     * La campana de la escuela (secreto): suena como bajo el agua y, lejos, otra contesta. Al volver a la lavandería,
     * una máscara negra viene a dejar la ORDEN N.º 22 (la de la campana sumergida).
     */
    ringBell() {
      var g = this.game;
      g.audio.campana();
      this.bellSwing = 1.2;
      if (this.bellRung) { g.gameplay.say('campana', '(La campana todavía vibra. Del otro lado, nadie contesta otra vez.)', 4); return; }
      this.bellRung = true;
      g.ui.subtitle('(La campana suena como si estuviera bajo el agua. Muy lejos, otra le contesta.)', 6);
      g.dread = Math.min(1, g.dread + 0.05);
      if (g.logros) { g.logros.unlock('campana'); }
      var ordenes = MR.HISTORIA.blackwood.ordenes;
      for (var i = 0; i < ordenes.length; i += 1) { if (/N\.º 22/.test(ordenes[i])) { g.clientela.pendingOrder = i; } }
    }

    /** El puente viejo (cuarta vuelta): aparece; si ya le pusiste la placa en otra noche, sigue ahí. */
    showBridge() {
      var g = this.game;
      this.f.bridge.visible = true;
      this.f.plaque.visible = !!(g.logros && g.logros.has('puente'));
      this.f.bridgeColliders.forEach(function (c) { c.off = false; });
    }

    /** Al acercarte la primera vez, lo notas. La cara blanca del otro lado se va al parpadear (o a los 12 s). */
    _bridge(dt) {
      var b = this.f.bridge;
      if (!b.visible) { return; }
      var g = this.game;
      if (!this.bridgeNoticed && U.distXZ(g.player.pos, b.position) < 8) {
        this.bridgeNoticed = true;
        g.ui.subtitle(this.f.plaque.visible ? '(El puente viejo. La placa sigue en la baranda: «PUENTE MUNICIPAL · BLACKWOOD».)' :
          '(Entre los pinos, un puente de madera cruza un río seco. El agua se fue hace mucho.)', 5);
      }
      var f = this.bowFace;
      if (f && f.group.visible) {
        this.bowTimer -= dt;
        if (!this.outside || this.bowTimer <= 0 || (this.bowTimer < 9 && g.player.eyesClosed)) {
          f.group.visible = false;
          if (this.outside) { g.ui.subtitle('(Parpadeas. Del otro lado del puente ya no hay nadie.)', 4); }
        }
      }
    }

    /**
     * Secreto: tocar la baranda. Sin la placa, el marco vacío; con la placa (la caja de la máscara), la pones: por un
     * momento se oye correr el río y, del otro lado, una cara blanca inclina la cabeza. Se guarda (logro «puente»).
     */
    touchBridge() {
      var g = this.game;
      if (this.f.plaque.visible) {
        g.gameplay.say('puente', '(La placa brilla un poco: «PUENTE MUNICIPAL · BLACKWOOD». Abajo, las piedras siguen secas.)', 4);
        return;
      }
      if (!(g.objetos && g.objetos.got.placa)) {
        g.gameplay.say('puente', '(En la baranda hay un marco vacío, del tamaño de una placa. Alguien le arrancó el nombre al puente.)', 5);
        return;
      }
      this.f.plaque.visible = true;
      this.plaquePlaced = true; // el locutor lo agradece a las 03:30 (game._bulletin)
      g.audio.click();
      g.audio.rio(7);
      g.ui.subtitle('(Pones la placa de bronce en el marco. Encaja justo. Bajo el puente, por un momento, se oye correr el río.)', 6);
      MR.Haptics.pulse([20, 40, 20]);
      g.dread = Math.max(0, g.dread - 0.1);
      if (g.logros) { g.logros.unlock('puente'); }
      var self = this;
      setTimeout(function () { if (g.state === 'playing' && self.outside) { self._bow(); } }, 2500);
    }

    /** Del otro lado del puente (el opuesto a ti), una cara blanca inclina la cabeza. */
    _bow() {
      var g = this.game;
      if (!this.bowFace) {
        this.bowFace = g.clientela._model('cara');
        this.bowFace.head.rotation.x = -0.45; // la cara va en -z: inclinarse es llevar la coronilla hacia adelante
        g.world.add(this.bowFace.group);
      }
      var b = this.f.bridge.position;
      var side = g.player.pos.z < b.z ? 1 : -1;
      this.bowFace.group.position.set(b.x, 0.12, b.z + side * 2.3);
      this.bowFace.group.rotation.y = side > 0 ? 0 : Math.PI; // de frente al puente (y a ti)
      this.bowFace.group.visible = true;
      this.bowTimer = 12;
      g.ui.subtitle('(Del otro lado del puente, una cara blanca inclina la cabeza.)', 5);
    }

    /** Tocar la secadora solitaria. */
    touchLoneDryer() {
      var g = this.game;
      g.gameplay.say('solitaria', '(Está tibia. En la puerta tiene una etiqueta descolorida: «La Espuma · 1987».)', 5);
      if (g.logros) { g.logros.unlock('solitaria'); }
    }

    /** Luz de la segunda farola (ranura 5): encendida o, si ya se apagó, nada. */
    _lamp2Light() {
      var L = this.f.lamp2;
      var on = !this.lamp2Off;
      this.f.lamp2Mat.uniforms.uEmissive.value = on ? 1.2 : 0;
      this.retro.setLight(5, new THREE.Vector3(L.position.x + 0.45, 3.8, L.position.z), new THREE.Color(1.0, 0.62, 0.3), on ? 1.0 : 0, 9.0);
    }

    /**
     * La segunda farola: si caminas hacia ella, retrocede (siempre a ~7,5 m, entre la niebla). La primera vez que la ves,
     * un subtítulo; si la pierdes de vista 2 s, se apaga con un chasquido; al volver a mirarla, otro subtítulo.
     */
    _lamp2(dt) {
      var L = this.f.lamp2;
      if (!L.visible) { return; }
      var g = this.game;
      var p = g.player.pos;
      if (!this.lamp2Off) {
        var dx = L.position.x - p.x;
        var dz = L.position.z - p.z;
        var d = Math.hypot(dx, dz) || 0.001;
        if (d < 7.5) {
          var a = this.f.area;
          var nx = p.x + dx / d * 7.5;
          var nz = p.z + dz / d * 7.5;
          if (nx > a.minX + 1 && nx < a.maxX - 1 && nz > a.minZ + 4 && nz < a.maxZ - 1) {
            L.position.set(nx, 0, nz);
            this._lamp2Light();
          } else {
            this._lamp2OffNow(); // ya no tiene a dónde irse
          }
        }
      }
      var head = this.tmp2 || (this.tmp2 = new THREE.Vector3());
      head.set(L.position.x + 0.45, 3.9, L.position.z).project(g.player.camera);
      var onScreen = Math.abs(head.x) < 0.95 && Math.abs(head.y) < 0.95 && head.z < 1 && !g.player.eyesClosed;
      if (onScreen) {
        this.lamp2Away = 0;
        this.lamp2Seen = (this.lamp2Seen || 0) + dt;
        if (!this.lamp2Noticed && this.lamp2Seen > 0.8 && !this.lamp2Off) {
          this.lamp2Noticed = true;
          g.ui.subtitle('(Entre la niebla hay otra farola, más adentro. No la habías visto.)', 5);
        }
        if (this.lamp2Off && this.lamp2Noticed && !this.lamp2OffSeen) {
          this.lamp2OffSeen = true;
          g.ui.subtitle('(La farola de adentro está apagada. Como si nunca hubiera estado encendida.)', 5);
          g.dread = Math.min(1, g.dread + 0.05);
        }
      } else if (this.lamp2Noticed && !this.lamp2Off) {
        this.lamp2Away = (this.lamp2Away || 0) + dt;
        if (this.lamp2Away > 2) { this._lamp2OffNow(); }
      }
    }

    _lamp2OffNow() {
      if (this.lamp2Off) { return; }
      this.lamp2Off = true;
      this._lamp2Light();
      this.game.audio.buzz(); // el zumbido eléctrico se corta
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
      // Noche de niebla: la segunda farola (ranura de luz 5, libre afuera).
      this.f.lamp2.visible = toOutside && g.mod === 'niebla';
      g.audio.setForest(toOutside ? 1 : 0); // la pista zen del bosque
      this.f.clothesline.visible = toOutside && g.mod === 'luna';
      if (this.f.lamp2.visible) { this._lamp2Light(); }
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
        // A veces, al volver, hay huellas mojadas hacia el banco… aunque él no esté (una vez por noche).
        h.onReturnFromForest();
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
