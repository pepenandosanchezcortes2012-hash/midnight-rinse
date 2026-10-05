/**
 * Blind-Spot Engine: el horror nunca ataca de frente.
 * Cada zona de la lavandería tiene su propio MR.Dispatcher (campeón de Gemini). En cada cuadro se calcula la
 * visibilidad de la zona con el frustum de la cámara (0 si queda fuera de la vista) y se llama a
 * dispatcher.tick(visibilidad, ojosCerrados): los eventos programados allí solo ocurren cuando nadie mira o
 * durante un parpadeo. La zona especial "jugador" tiene visibilidad 1 siempre: lo que está "detrás de ti"
 * solo puede pasar mientras parpadeas.
 * También vigila la mirada al rostro del Cliente Inmóvil (regla del registro: NO lo mires a la cara).
 *
 * Su cerebro (director de IA, src/core/director.js): cuando se mueve no salta a cualquier lado. Elige por utilidad un
 * modo según cómo está la tienda (luces que fallan, la radio en estática, tu miedo, si lo miraste fijo): al borde de tu
 * vista, más cerca y a tu espalda, o su rutina (el banco, mirar los tambores) para que bajes la guardia. Y elige un lugar
 * que no estés viendo: nunca aparece a la vista. Si lo miraste, tarda de 3 a 5 s en reaccionar. A veces, donde estaba
 * parado, deja una moneda mojada o un ticket doblado. En el bosque se esconde detrás de los pinos: se corre de lado para
 * que siempre quede un tronco entre él y tus ojos.
 */
(function (MR) {
  'use strict';

  var U = MR.Util;
  // Los eventos del director que suenan: los oyen Pelusa y las caras blancas (cerebro de mosca).
  var SONOROS = ['puerta_lavadora', 'golpe_secadora', 'secadora_sola', 'puerta_trasera', 'telefono_breve', 'trapeador_movido',
    'moneda_canto', 'susurro', 'mano_lavadora', 'cesto', 'charco', 'radio_sola', 'cierra_puerta', 'cierra_trasera'];
  var V3 = THREE.Vector3;
  var LIGHTS = 6;

  class Horror {
    constructor(game) {
      this.game = game;
      this.world = game.world;
      this.zones = {};
      var self = this;
      Object.keys(this.world.zones).forEach(function (name) {
        var z = self.world.zones[name];
        self.zones[name] = { name: name, center: z.center, sphere: new THREE.Sphere(z.center, z.radius), dispatcher: new MR.Dispatcher(), vis: 1 };
      });
      this.zones.jugador = { name: 'jugador', dispatcher: new MR.Dispatcher(), vis: 1 };
      this.counter = 0;
      this.delayed = [];
      this.clock = 0;
      this.nextEvent = 25;
      this.flickers = new Array(LIGHTS).fill(0);
      this.flash = 0;
      this.firedLog = [];
      this.frustum = new THREE.Frustum();
      this.projView = new THREE.Matrix4();
      this.tmp = new V3();
      this.tmp2 = new V3();
      this.customer = { present: false, anchor: null, zone: null, seated: true, rot: 0, behind: false };
      this.stareTime = 0;
      this.stareFlagged = false;
      this.backDoorTarget = 0;
      this.nearTimer = 2;
      this.headYaw = 0; // la cabeza gira hacia ti cuando no lo miras
      this.reflection = null;  // { washer, t } mientras se ve el reflejo
      this.reflectCooldown = 20;
      this.lastHover = null;
      this.reflectMat = this.game.retro.material({ texture: 'reflejo', emissive: 0.4 });
      this.recientes = [];             // sus últimas anclas: no vuelve enseguida a la misma
      this.miradoEn = -99;             // cuándo lo tuviste en foco por última vez
      this.pausaEl = U.rand(3, 5);     // cuánto tarda en reaccionar después (pausa de contemplación)
      this.senuelos = { moneda: null, ticket: null };
      this.arbol = -1;                 // el pino detrás del que se esconde en el bosque
    }

    // ---------------------------------------------------------------------------------------------
    schedule(type, zone, priority, params) {
      this.counter += 1;
      var payload = Object.assign({ type: type }, params || {});
      this.zones[zone].dispatcher.schedule(type + '#' + this.counter, payload, priority || 0);
    }

    later(seconds, type, zone, priority, params) {
      this.delayed.push({ at: this.clock + seconds, type: type, zone: zone, priority: priority, params: params });
    }

    pending() {
      var n = 0;
      var zones = this.zones;
      Object.keys(zones).forEach(function (k) { n += zones[k].dispatcher.pending(); });
      return n;
    }

    // ---------------------------------------------------------------------------------------------
    update(dt, player) {
      this.clock += dt;
      var cam = player.camera;
      cam.updateMatrixWorld();
      this.projView.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      this.frustum.setFromProjectionMatrix(this.projView);
      var forward = player.forward(this.tmp2);
      var eye = cam.position;
      var blink = player.eyesClosed;

      for (var i = this.delayed.length - 1; i >= 0; i -= 1) {
        var d = this.delayed[i];
        if (this.clock >= d.at) {
          this.delayed.splice(i, 1);
          this.schedule(d.type, d.zone, d.priority, d.params);
        }
      }

      var names = Object.keys(this.zones);
      for (var k = 0; k < names.length; k += 1) {
        var zone = this.zones[names[k]];
        if (zone.sphere) {
          if (!this.frustum.intersectsSphere(zone.sphere)) {
            zone.vis = 0;
          } else {
            var dir = this.tmp.copy(zone.center).sub(eye);
            var dist = dir.length();
            var dot = dist > 0.001 ? forward.dot(dir.divideScalar(dist)) : 1;
            zone.vis = U.clamp((dot - 0.2) / 0.8, 0.05, 1);
          }
        }
        var fired = zone.dispatcher.tick(zone.vis, blink);
        for (var f = 0; f < fired.length; f += 1) { this._apply(fired[f].payload, zone.name); }
      }

      this._director(dt);
      if (this.shake) {
        this.shake.t -= dt;
        this.shake.body.position.x = this.shake.t > 0 ? this.shake.baseX + (Math.random() - 0.5) * 0.035 : this.shake.baseX;
        if (this.shake.t <= 0) { this.shake = null; }
      }
      this._reflection(dt, player);
      this._watch(dt, player);
      this._edgeCoin(dt, player);
      this._clothes(player);
      this._prints(player);
      this._stepsAbove(dt, player);
      this._basket(player);
      this._hat(player);
      this._writing(player);
      this._senuelosVistos(dt, player);
      this._arboreo(dt, player);
      this._stare(dt, player, eye, forward);
      this._nearPulse(dt, player);
      this._tilt(dt, player);
      this._flickers(dt);
      var door = this.world.backDoor;
      door.rotation.y += (this.backDoorTarget - door.rotation.y) * Math.min(1, dt * 2);
    }

    zoneVisible(name) { return this.zones[name] ? this.zones[name].vis : 1; }

    // ---------------------------------------------------------------------------------------------
    _director(dt) {
      var g = this.game;
      if (g.minutes < MR.Config.SHIFT_START + 5) { return; }
      if (g.diff && g.diff.sinSustos) { return; } // modo Paseo
      this.nextEvent -= dt;
      if (this.nextEvent > 0) { return; }
      var mult = g.anomalyMultiplier();
      var level = g.diff ? g.diff.horror : 1; // dificultad
      var interval = 34 / (mult * level * (1 + g.dread * 0.8) * g.consumables.paranoia()) * (g.collapsed ? 0.6 : 1);
      this.nextEvent = U.rand(0.7, 1.3) * interval;

      var outside = g.bosque && g.bosque.outside;
      var table;
      if (g.pasillo && g.pasillo.inside) {
        // En el pasillo de servicio: la bombilla… y la lavandería sigue cambiando sola.
        table = [['bombilla', 2.5], ['apagon', 0.8], ['charco', 0.6], ['puerta_lavadora', 0.6], ['golpe_secadora', 1]];
        if (this.customer.present) { table.push(['cliente_pasillo', 2.5 + g.stats.mirada * 0.5]); }
        if (g.flags.customerSeen && !g.espejo.armed && g.espejo.ghosts < 2) { table.push(['espejo', 1.5]); }
      } else if (outside) {
        // En el bosque: ramas, la linterna, el búho… y la lavandería sigue cambiando sola a tus espaldas.
        table = [['rama', 3], ['linterna', 1.5], ['buho', 1], ['apagon', 1], ['charco', 0.8], ['puerta_lavadora', 0.6], ['secadora_sola', 0.6]];
        if (this.customer.present) { table.push(['cliente_bosque', 2.5 + g.stats.mirada * 0.5]); }
      } else {
        table = [['apagon', 3], ['charco', 2], ['puerta_lavadora', 2], ['secadora_sola', 2], ['puerta_trasera', 1], ['trapeador_movido', 1],
          ['radio_sola', 1], ['golpe_secadora', 1.5], ['mano_lavadora', 1]];
        if (!g.gameplay.phoneRinging && g.minutes > MR.Config.PHONE_RINGS + 10) { table.push(['telefono_breve', 0.8]); }
        if (!this.coinDone && g.gameplay.coins > 0 && g.gameplay.trayCoins === 0) { table.push(['moneda_canto', 0.8]); }
        if (!this.clothesDone) { table.push(['ropa_doblada', 0.8]); }
        if ((this.basketLevel || 0) < 3 && g.flags.customerSeen) { table.push(['cesto', 1]); }
        if (!this.writingDone && g.minutes > 150) { table.push(['vidriera_escrita', 0.8]); }
        if (!this.watchDone && g.minutes >= 180 && g.clientela) { table.push(['vigia', 0.9]); }
        if (!this.customer.present && g.minutes >= 60 && g.minutes < 250 && g.gato && !g.gato.stared && g.gato.canStare()) {
          table.push(['pelusa_mira', 0.9]);
        }
        if (g.flags.customerSeen && !g.tele.faceArmed && (g.tele.faceSeen || 0) < 2) { table.push(['tele_rostro', 1.2]); }
        if (this.customer.present) {
          table.push(['huellas', 1], ['mano_vidrio', 1]);
          if (g.talked) { table.push(['cliente_mueve', 0.6 + g.stats.mirada * 0.5]); }
        }
      }
      if (g.whispers) { table.push(['susurro', 4]); }
      else if (g.consumables.high > 0.5) { table.push(['susurro', 1.5]); } // paranoia: susurros fuera de hora
      if (g.mod === 'apagones') { table = table.map(function (e) { return e[0] === 'apagon' ? [e[0], e[1] * 3] : e; }); }
      if (g.mod === 'tormenta') { table = table.map(function (e) { return e[0] === 'apagon' ? [e[0], e[1] * 1.8] : e; }); }
      var total = table.reduce(function (s, e) { return s + e[1]; }, 0);
      var r = Math.random() * total;
      var pick = table[0][0];
      for (var i = 0; i < table.length; i += 1) {
        r -= table[i][1];
        if (r <= 0) { pick = table[i][0]; break; }
      }
      this._scheduleKind(pick);
    }

    _scheduleKind(kind) {
      var gp = this.game.gameplay;
      switch (kind) {
        case 'apagon': {
          var light = U.pick([0, 1, 2, 3, 4, 5]);
          this.schedule('apagon', this._zoneForLight(light), 1, { light: light, seconds: U.rand(0.8, 2.6) });
          break;
        }
        case 'charco': this.schedule('charco', 'lavadoras', 1); break;
        case 'puerta_lavadora': this.schedule('puerta_lavadora', 'lavadoras', 2, { index: Math.floor(Math.random() * 6) }); break;
        case 'secadora_sola': this.schedule('secadora_sola', 'secadoras', 1, { index: Math.floor(Math.random() * 4) }); break;
        case 'puerta_trasera': this.schedule('puerta_trasera', 'puerta_trasera', 1); break;
        case 'trapeador_movido': if (!gp.mopHeld) { this.schedule('trapeador_movido', 'almacen', 1); } break;
        case 'huellas': this.schedule('huellas', 'entrada', 1); break;
        case 'mano_vidrio': this.schedule('mano_vidrio', 'entrada', 2); break;
        case 'susurro': {
          var zones = ['lavadoras', 'secadoras', 'almacen', 'entrada', 'puerta_trasera', 'banco'];
          this.schedule('susurro', U.pick(zones), 0);
          break;
        }
        case 'bombilla': this.schedule('bombilla', U.pick(this.world.pasillo.zones), 1); break;
        case 'cliente_pasillo': {
          var pa = this.world.pasillo.anchors.filter(function (n) { return n !== this.customer.anchor; }, this);
          var pto = U.pick(pa);
          this.schedule('cliente_mueve', this.world.anchors[pto].zone, 3, { to: pto });
          break;
        }
        case 'radio_sola': this.schedule('radio_sola', 'mostrador', 1); break;
        case 'moneda_canto': this.schedule('moneda_canto', 'cambiador', 1); break;
        case 'ropa_doblada': this.schedule('ropa_doblada', 'mostrador', 1); break;
        case 'cesto': this.schedule('cesto', 'cesto', 1); break;
        case 'vidriera_escrita': this.schedule('vidriera_escrita', 'vidriera', 1); break;
        case 'vigia': this.schedule('vigia', 'vidriera', 1); break;
        case 'pelusa_mira': this.game.gato.stareAtBench(); break; // va caminando a la vista: no hace falta que no mires
        case 'tele_rostro': this.game.tele.faceArmed = true; break; // sale cuando mires la tele (tele.js)
        case 'espejo': this.game.espejo.armed = true; break; // sale cuando te mires en el espejo (espejo.js)
        case 'golpe_secadora': this.schedule('golpe_secadora', 'secadoras', 1, { index: Math.floor(Math.random() * 4) }); break;
        case 'telefono_breve': this.schedule('telefono_breve', 'mostrador', 1); break;
        case 'mano_lavadora': this.schedule('mano_lavadora', 'lavadoras', 2, { index: Math.floor(Math.random() * 6) }); break;
        case 'rama': this.schedule('rama', U.pick(this.world.forest.zones), 0); break;
        case 'buho': this.schedule('buho', U.pick(this.world.forest.zones), 0); break;
        case 'linterna': this.schedule('linterna', U.pick(this.world.forest.zones), 1); break;
        case 'cliente_bosque': {
          // Te sigue: elige entre las 3 anclas del bosque más cercanas a ti (nunca la misma).
          var p = this.game.player.pos;
          var anchors = this.world.anchors;
          var near = this.world.forest.anchors.filter(function (n) { return n !== this.customer.anchor; }, this)
            .sort(function (a, b) { return Math.hypot(anchors[a].x - p.x, anchors[a].z - p.z) - Math.hypot(anchors[b].x - p.x, anchors[b].z - p.z); })
            .slice(0, 3);
          var dest = U.pick(near);
          this.schedule('cliente_mueve', anchors[dest].zone, 3, { to: dest });
          break;
        }
        case 'cliente_mueve': {
          // A dónde, lo decide al moverse (un punto ciego): aquí se programa en la zona donde está, para que no lo veas irse.
          var desde = this.customer.zone && this.zones[this.customer.zone] ? this.customer.zone : 'banco';
          this.schedule('cliente_mueve', desde, 3, {});
          break;
        }
        default: break;
      }
    }

    _zoneForLight(i) {
      return ['lavadoras', 'lavadoras', 'secadoras', 'banco', 'mostrador', 'almacen'][i];
    }

    // ---------------------------------------------------------------------------------------------
    _apply(e, zoneName) {
      var g = this.game;
      var gp = g.gameplay;
      var w = this.world;
      var audio = g.audio;
      this.firedLog.push({ type: e.type, zone: zoneName, minute: Math.floor(g.minutes) });
      // Lo que suena, lo oyen los que tienen cerebro de mosca (Pelusa, las caras blancas): voltean hacia ahí.
      var zz = this.zones[zoneName];
      if (zz && zz.center && SONOROS.indexOf(e.type) >= 0 && g.oir) { g.oir(zz.center.x, zz.center.z, 0.9); }
      switch (e.type) {
        case 'cliente_aparece':
          if (!this.customer.present && !g.flags.secreto && !(g.diff && g.diff.sinSustos)) {
            this.placeCustomer('banco');
            this.customer.present = true;
            audio.thud();
            g.onCustomerAppeared();
          }
          break;
        case 'cliente_mueve': {
          if (!this.customer.present) { break; }
          var suelto = this.customer.behind || this.zoneVisible(this.customer.zone) === 0 || g.player.eyesClosed;
          if (!suelto) { this.later(2, 'cliente_mueve', zoneName, 3, { to: e.to }); break; }
          if (e.to) { this.placeCustomer(e.to); break; }
          // Sin destino fijo: espera su pausa si lo miraste hace poco, y elige un punto ciego (si no hay, espera).
          var to = this.clock - this.miradoEn < this.pausaEl ? null : this._puntoCiego();
          if (!to) {
            if ((e.intentos || 0) < 20) { this.later(1.5, 'cliente_mueve', zoneName, 3, { intentos: (e.intentos || 0) + 1 }); }
            break;
          }
          this._moverEl(to);
          break;
        }
        case 'cliente_detras':
          if (this.customer.present) {
            this.placeBehindPlayer(g.player);
            audio.thud();
            g.dread = Math.min(1, g.dread + 0.15);
            this.later(1.5, 'cliente_mueve', 'jugador', 2, { to: 'banco' });
          }
          break;
        case 'cliente_se_va':
          this.customer.present = false;
          w.customer.group.visible = false;
          break;
        case 'apagon':
          // Con los fusibles restablecidos (pasillo de servicio), los apagones duran la mitad.
          this.flickers[e.light] = Math.max(this.flickers[e.light], e.seconds * (g.pasillo && g.pasillo.fuses ? 0.5 : 1));
          audio.buzz();
          break;
        case 'apagon_total':
          for (var i = 0; i < LIGHTS; i += 1) { this.flickers[i] = Math.max(this.flickers[i], e.seconds); }
          audio.thud();
          break;
        case 'charco': gp.spawnPuddle(); break;
        case 'puerta_lavadora':
          gp.washers[e.index].doorTarget = 1.25;
          audio.door();
          this.later(50, 'cierra_puerta', 'lavadoras', 0, { index: e.index });
          break;
        case 'cierra_puerta': gp.washers[e.index].doorTarget = 0; break;
        case 'secadora_sola': gp.startDryer(e.index); break;
        case 'puerta_trasera':
          this.backDoorTarget = -0.55;
          audio.door();
          this.later(60, 'cierra_trasera', 'puerta_trasera', 0);
          break;
        case 'cierra_trasera': this.backDoorTarget = g.pasillo && g.pasillo.unlocked ? -0.3 : 0; break;
        case 'huellas':
          w.footprints.visible = true;
          this.printsNoticed = false;
          this.later(90, 'huellas_secan', 'entrada', 0);
          break;
        case 'huellas_secan': w.footprints.visible = false; break;
        case 'mano_vidrio':
          w.handprint.visible = true;
          this.later(80, 'vidrio_limpio', 'entrada', 0);
          break;
        case 'vidrio_limpio': w.handprint.visible = false; break;
        case 'trapeador_movido':
          if (!gp.mopHeld) {
            w.mop.position.set(U.pick([-0.6, 1.0, -6.6]), 0, U.pick([-1.2, -1.0]));
            w.mop.rotation.set(0, Math.random() * Math.PI, Math.PI / 2 - 0.06);
          }
          break;
        case 'rama': {
          var rc = this.zones[zoneName].center;
          var toBranch = this.tmp.copy(rc).sub(g.player.camera.position);
          var rRight = new V3(1, 0, 0).applyEuler(g.player.camera.rotation);
          audio.rama(U.clamp(rRight.dot(toBranch.normalize()), -1, 1));
          g.dread = Math.min(1, g.dread + 0.03);
          break;
        }
        case 'buho': audio.buho(); break;
        case 'bombilla':
          this.flickers[0] = Math.max(this.flickers[0], U.rand(0.5, 1.6));
          audio.buzz();
          break;
        case 'vigia':
          // Mientras no mirabas la vidriera: alguien de cara blanca se paró en la vereda de enfrente.
          if (this.watchDone) { break; }
          this.watchDone = true;
          g.clientela.showWatcher();
          break;
        case 'vidriera_escrita':
          // Mientras no mirabas la vidriera: alguien escribió en el vaho, desde afuera.
          if (this.writingDone) { break; }
          this.writingDone = true;
          w.fogWriting.visible = true;
          this.writingSeenAt = null;
          audio.lint();
          break;
        case 'cesto': {
          // Mientras no lo mirabas, el cesto tiene un uniforme más (tres en total). Roce de tela.
          var lvl = this.basketLevel || 0;
          if (lvl >= 3) { break; }
          w.basketPiles[lvl].visible = true;
          this.basketLevel = lvl + 1;
          audio.lint();
          g.dread = Math.min(1, g.dread + 0.02);
          break;
        }
        case 'ropa_doblada': {
          // Mientras no mirabas el mostrador: una pila de ropa doblada que nadie trajo; roce de tela a tus espaldas.
          if (this.clothesDone) { break; }
          this.clothesDone = true;
          w.foldedClothes.visible = true;
          audio.lint();
          setTimeout(function () { audio.lint(); }, 380);
          g.dread = Math.min(1, g.dread + 0.03);
          break;
        }
        case 'moneda_canto': {
          // Mientras no mirabas: te falta una moneda y en la bandeja hay una parada de canto, girando apenas.
          if (this.coinDone || gp.coins <= 0 || gp.trayCoins > 0) { break; }
          this.coinDone = true;
          gp.coins -= 1;
          gp.trayCoins = 1;
          gp.edgeCoin = true;
          gp._showTray();
          audio.monedaGira();
          g.dread = Math.min(1, g.dread + 0.03);
          break;
        }
        case 'radio_sola': {
          // La radio se sintoniza sola en la 94.1 y, entre la estática, alguien susurra.
          gp.tuneTo(MR.Config.RADIO_STATION);
          audio.whisper(this._panTo(this.zones.mostrador.center, g.player));
          g.ui.subtitle('(La radio cambia sola de estación. Entre la estática: «…no lo mires a la cara…».)', 5);
          g.dread = Math.min(1, g.dread + 0.06);
          break;
        }
        case 'golpe_secadora': {
          // Algo golpea por dentro de una secadora: la máquina tiembla.
          var dr = gp.dryers[e.index];
          this.shake = { body: dr.mesh.body, baseX: dr.mesh.x, t: 0.7 };
          audio.thud();
          MR.Haptics.pulse([50, 40, 50]);
          g.dread = Math.min(1, g.dread + 0.05);
          break;
        }
        case 'telefono_breve': if (!gp.phoneRinging) { gp.ring(5.5, true); } break;
        case 'mano_lavadora': {
          // Una mano por DENTRO del vidrio de una lavadora.
          var hand = w.washerHand;
          w.washers[e.index].doorPivot.add(hand);
          hand.position.set(0.22, 0.02, 0.04);
          hand.visible = true;
          this.later(70, 'mano_lavadora_fin', 'lavadoras', 0);
          break;
        }
        case 'mano_lavadora_fin': w.washerHand.visible = false; break;
        case 'linterna': {
          var fl = w.forest.flashlight;
          this.flickers[fl] = Math.max(this.flickers[fl], U.rand(0.6, 1.8));
          break;
        }
        case 'susurro': {
          var center = this.zones[zoneName].center;
          var toZone = this.tmp.copy(center).sub(g.player.camera.position);
          var right = new V3(1, 0, 0).applyEuler(g.player.camera.rotation);
          audio.whisper(U.clamp(right.dot(toZone.normalize()), -1, 1));
          g.onWhisper();
          break;
        }
        default: break;
      }
    }

    /** Paneo (−1 … 1) de un punto respecto a la cabeza del jugador. */
    _panTo(point, player) {
      var to = this.tmp.copy(point).sub(player.camera.position);
      var right = new V3(1, 0, 0).applyEuler(player.camera.rotation);
      return U.clamp(right.dot(to.normalize()), -1, 1);
    }

    /** Pasos del Cliente Inmóvil cuando se reubica cerca: audio grave y vibración sorda y pesada. */
    _stepsIfNear(wasPresent, behind) {
      if (!wasPresent) { return; }
      var d = this.distanceToCustomer(this.game.player);
      if (d > 6) { return; }
      var steps = behind || d < 2.5 ? 3 : 2;
      this.game.audio.heavySteps(steps, 480);
      MR.Haptics.pulse(steps === 3 ? [70, 110, 70, 110, 95] : [60, 140, 60]);
    }

    /**
     * A dónde se mueve él (director de IA). Primero el modo, por utilidad según la tienda: su rutina (el banco, mirar
     * los tambores: para que bajes la guardia), la periferia (justo afuera del borde de tu vista) o acercarse (a tu
     * espalda; más con las luces fallando, la radio en estática, tu miedo y cada vez que lo miraste fijo). Después, un
     * ancla que no estés viendo. Devuelve su nombre, o null si no hay ninguna oculta.
     */
    _puntoCiego() {
      var g = this.game;
      var D = MR.Director;
      var p = g.player;
      var falla = this.flickers.some(function (f) { return f > 0; }) ? 1 : 0;
      var estatica = 1 - (g.gameplay.radioProximity || 0);
      var modo = D.elegirUna({
        rutina: 0.3 + 0.3 * (1 - g.dread) + (g.calmSources() >= 3 ? 0.1 : 0),
        periferia: 0.35 + 0.2 * g.dread + 0.12 * estatica,
        acercarse: 0.12 + 0.3 * g.dread + 0.25 * falla + 0.2 * (1 - this.lightLevel()) + 0.1 * Math.min(3, g.stats.mirada || 0)
      }, Math.random, 0.15);
      var anchors = this.world.anchors;
      var cands = ['banco', 'lavadoras', 'lavadoras_mira', 'secadoras', 'entrada', 'almacen', 'mostrador'].map(function (n) {
        var a = anchors[n];
        return { nombre: n, x: a.x, z: a.z, visible: this.zoneVisible(a.zone), rutina: n === 'banco' || n === 'lavadoras_mira' };
      }, this);
      var ojos = { x: p.pos.x, z: p.pos.z, yaw: p.yaw, ojosCerrados: p.eyesClosed, limpiando: !!(g.glasses && g.glasses.wiping) };
      var c = D.elegirPuntoCiego(cands, ojos, { modo: modo, actual: this.customer.anchor, recientes: this.recientes, rnd: Math.random });
      this.modoEl = modo;
      return c ? c.nombre : null;
    }

    /** Se mueve a un punto ciego; a veces deja un señuelo donde estaba parado. */
    _moverEl(to) {
      var g = this.game;
      var c = this.customer;
      var pos = this.world.customer.group.position;
      var enSala = !(g.bosque && g.bosque.outside) && !(g.pasillo && g.pasillo.inside);
      if (enSala && !c.seated && !c.behind && this.anchorEnSala(c.anchor) && !(g.diff && g.diff.sinSustos) && Math.random() < 0.25) {
        this.dejarSenuelo(pos.x, pos.z);
      }
      this.placeCustomer(to);
      this.recientes.push(to);
      if (this.recientes.length > 2) { this.recientes.shift(); }
      this.pausaEl = U.rand(3, 5);
    }

    anchorEnSala(name) { return !!name && !/^(bosque_|pasillo_)/.test(name) && name !== 'detras'; }

    /** Deja en el piso una moneda mojada o un ticket doblado (se turnan; uno de cada uno a la vez). */
    dejarSenuelo(x, z, kind) {
      var k = kind || ((this.nSenuelos = (this.nSenuelos || 0) + 1) % 2 ? 'moneda' : 'ticket');
      var d = this.world.decoys[k];
      if (d.visible) { return false; }
      d.position.set(x + U.rand(-0.08, 0.08), 0, z + U.rand(-0.08, 0.08));
      d.visible = true;
      this.senuelos[k] = { visto: false, t: 0, parpadeos: 0 };
      this.game.dread = Math.min(1, this.game.dread + 0.02);
      return true;
    }

    /** Un señuelo visto de cerca: el subtítulo (una vez); dos parpadeos después ya no está (o a los 2 min, sin verlo). */
    _senuelosVistos(dt, player) {
      var self = this;
      ['moneda', 'ticket'].forEach(function (k) {
        var d = self.world.decoys[k];
        var s = self.senuelos[k];
        if (!d.visible || !s) { return; }
        s.t += dt;
        var punto = self.tmpSen || (self.tmpSen = new V3());
        punto.set(d.position.x, 0.05, d.position.z);
        var visto = !player.eyesClosed && self.frustum.containsPoint(punto) && U.distXZ(player.pos, d.position) < 3;
        if (visto && !s.visto) {
          s.visto = true;
          s.parpadeos = player.blinkCount;
          self.game.ui.subtitle(k === 'moneda' ? '(En el piso, justo donde él estaba parado, hay una moneda mojada.)' :
            '(Donde él estaba parado quedó un ticket doblado. Está húmedo.)', 5);
          self.game.dread = Math.min(1, self.game.dread + 0.03);
        } else if ((s.visto && player.eyesClosed && player.blinkCount - s.parpadeos >= 2) || (!s.visto && s.t > 120 && !visto)) {
          d.visible = false;
          self.senuelos[k] = null;
        }
      });
    }

    /**
     * En el bosque (mimetismo arbóreo): mientras no lo ves, se corre de lado, de pino en pino, para que siempre quede un
     * tronco entre él y tus ojos; queda de pie detrás del árbol, de cara a ti. A la vista no se mueve.
     */
    _arboreo(dt, player) {
      var g = this.game;
      var c = this.customer;
      if (!c.present || !(g.bosque && g.bosque.outside) || !/^bosque_/.test(c.anchor || '')) { this.arbol = -1; return; }
      var D = MR.Director;
      var arboles = this.world.forest.treePos;
      var grp = this.world.customer.group;
      var pos = grp.position;
      var j = { x: player.pos.x, z: player.pos.z, yaw: player.yaw };
      var cabeza = this.customerHead(this.tmpArb || (this.tmpArb = new V3()));
      // Lo ves si está en tu vista con los ojos abiertos. Detrás de un tronco y lejos (más de 7 m, en la oscuridad) no se
      // le ve moverse; de cerca, el tronco no tapa todo el abrigo: ahí no se mueve.
      var lejos = Math.hypot(pos.x - j.x, pos.z - j.z) > 7;
      var visto = !player.eyesClosed && !(g.glasses && g.glasses.wiping) && this.frustum.containsPoint(cabeza) &&
        !(lejos && D.tapado(j, pos, arboles, 0.2));
      this.arbolT = (this.arbolT || 0) - dt;
      if (this.arbolT <= 0) {
        this.arbolT = 0.4;
        var t = this.arbol >= 0 ? arboles[this.arbol] : null;
        var dj = t ? Math.hypot(t[0] - j.x, t[1] - j.z) : 0;
        if (!t || dj < 3.5 || dj > 14) {
          var nuevo = D.elegirArbol(j, pos, arboles, { min: 4, max: 13, alcance: 6, separacion: 0.55 });
          if (nuevo >= 0) { this.arbol = nuevo; }
        }
      }
      if (this.arbol < 0 || visto) { return; }
      var h = D.escondite(j, arboles[this.arbol], 0.55);
      var dx = h.x - pos.x;
      var dz = h.z - pos.z;
      var d = Math.hypot(dx, dz);
      if (d > 1e-3) {
        var paso = Math.min(d, 2.4 * dt);
        pos.x += dx / d * paso;
        pos.z += dz / d * paso;
      }
      c.rot = Math.atan2(-(j.x - pos.x), -(j.z - pos.z)); // de cara a ti, asomado detrás del tronco
      grp.rotation.y = c.rot;
    }

    placeCustomer(name) {
      var wasPresent = this.customer.present && this.world.customer.group.visible;
      this._placeAt(name);
      this._stepsIfNear(wasPresent, false);
    }

    _placeAt(name) {
      var a = this.world.anchors[name];
      var c = this.world.customer;
      c.group.position.set(a.x, 0, a.z);
      c.group.rotation.y = a.rot;
      c.seated.visible = a.seated;
      c.standing.visible = !a.seated;
      c.group.visible = true;
      this.customer.anchor = name;
      this.customer.zone = a.zone;
      this.customer.seated = a.seated;
      this.customer.rot = a.rot;
      this.customer.behind = false;
      this._setHead(0);
    }

    placeBehindPlayer(player) {
      var fwd = player.forward(new V3());
      fwd.y = 0;
      if (fwd.lengthSq() < 1e-6) { fwd.set(0, 0, -1); }
      fwd.normalize();
      var p = player.pos;
      // Límites de donde estés: la lavandería o el bosque.
      var gm = this.game;
      var bounds = gm.pasillo && gm.pasillo.inside ? this.world.pasillo.bounds :
        (gm.bosque && gm.bosque.outside ? this.world.forest.bounds : { minX: -7.6, maxX: 7.6, minZ: -4.0, maxZ: 4.6 });
      var x = U.clamp(p.x - fwd.x * 1.4, bounds.minX, bounds.maxX);
      var z = U.clamp(p.z - fwd.z * 1.4, bounds.minZ, bounds.maxZ);
      var c = this.world.customer;
      var rot = Math.atan2(-(p.x - x), -(p.z - z));
      c.group.position.set(x, 0, z);
      c.group.rotation.y = rot;
      c.seated.visible = false;
      c.standing.visible = true;
      c.group.visible = true;
      this.customer.anchor = 'detras';
      this.customer.zone = 'jugador';
      this.customer.seated = false;
      this.customer.rot = rot;
      this.customer.behind = true;
      this._setHead(0);
      this._stepsIfNear(true, true);
    }

    customerCollider() {
      if (!this.customer.present || this.customer.seated) { return null; }
      var pos = this.world.customer.group.position;
      return { x: pos.x, z: pos.z, r: 0.28 };
    }

    customerHead(out) {
      var head = this.customer.seated ? this.world.seatedHead : this.world.standingHead;
      return head.getWorldPosition(out || new V3());
    }

    distanceToCustomer(player) {
      if (!this.customer.present) { return Infinity; }
      return U.distXZ(player.pos, this.world.customer.group.position);
    }

    // ---------------------------------------------------------------------------------------------
    _stare(dt, player, eye, forward) {
      var C = MR.Config;
      if (!this.customer.present || player.eyesClosed) {
        this.stareTime = Math.max(0, this.stareTime - dt * 2);
        return;
      }
      var head = this.customerHead(this.tmp);
      var toHead = head.sub(eye);
      var dist = toHead.length();
      toHead.divideScalar(dist);
      var angle = Math.acos(U.clamp(forward.dot(toHead), -1, 1)) * 180 / Math.PI;
      var rot = this.customer.rot + this.headYaw; // hacia donde mira su cabeza
      var faceDir = new V3(-Math.sin(rot), 0, -Math.cos(rot));
      var faceVisible = faceDir.dot(new V3(-toHead.x, 0, -toHead.z).normalize()) > 0.3;
      var staring = angle < C.STARE_ANGLE_DEG && dist < C.STARE_DISTANCE && faceVisible;
      if (angle < 20 && dist < 14) { this.miradoEn = this.clock; } // lo tienes en foco: después tarda en reaccionar
      if (staring) {
        this.stareTime += dt;
        if (this.stareTime >= C.STARE_SECONDS && !this.stareFlagged) {
          this.stareFlagged = true;
          this.game.onStare();
        }
      } else {
        this.stareTime = Math.max(0, this.stareTime - dt * 2);
        if (this.stareTime === 0) { this.stareFlagged = false; }
      }
    }

    /**
     * Te observa: mientras su zona no está a la vista (o parpadeas), su cabeza gira despacio hacia ti
     * (hasta ±75°). Cuando vuelves a mirarlo, la cabeza se queda donde quedó.
     */
    /**
     * Al volver del bosque: la mitad de las veces (una por noche, nunca en Paseo), huellas mojadas del vidrio al
     * banco amarillo cuando no mires el banco. `force` (pruebas) las programa siempre.
     */
    onReturnFromForest(force) {
      var g = this.game;
      if (this.printsFromForest || (g.diff && g.diff.sinSustos) || this.world.footprints.visible) { return; }
      if (!force && Math.random() < 0.5) { return; }
      this.printsFromForest = true;
      this.schedule('huellas', 'banco', 1);
    }

    /** El «1986» en el vaho: al verlo, el subtítulo; la lluvia lo borra cuando dejas de mirar (40 s después). */
    _writing(player) {
      var wr = this.world.fogWriting;
      if (!wr.visible) { return; }
      var seen = this.zoneVisible('vidriera') > 0.4 && U.distXZ(player.pos, wr.position) < 5;
      if (seen && this.writingSeenAt === null) {
        this.writingSeenAt = this.clock;
        this.game.ui.subtitle('(Alguien escribió en el vaho del vidrio: «1986». Está al revés. Lo escribieron desde afuera.)', 6);
        this.game.dread = Math.min(1, this.game.dread + 0.05);
      } else if (!seen && this.writingSeenAt !== null && this.clock - this.writingSeenAt > 40) {
        wr.visible = false; // la lluvia lo borró
      }
    }

    /** Su sombrero en el banco: al verlo, el subtítulo; en el siguiente parpadeo ya no está. */
    _hat(player) {
      var hat = this.world.loneHat;
      if (!hat.visible) { return; }
      if (!this.hatNoticed) {
        if (!player.eyesClosed && this.zoneVisible('banco') > 0.4 && U.distXZ(player.pos, hat.position) < 4) {
          this.hatNoticed = true;
          this.game.ui.subtitle('(En el banco amarillo quedó su sombrero. Está seco.)', 5);
        }
      } else if (player.eyesClosed) {
        hat.visible = false;
      }
    }

    /** El cesto lleno: al verlo de cerca con sus tres uniformes, el subtítulo (una vez). */
    _basket(player) {
      if ((this.basketLevel || 0) < 3 || this.basketNoticed) { return; }
      if (this.zoneVisible('cesto') > 0.4 && U.distXZ(player.pos, this.world.basket.position) < 3) {
        this.basketNoticed = true;
        this.game.ui.subtitle('(El cesto está lleno de uniformes como el tuyo. Todos secos. Todos tibios.)', 5);
        this.game.dread = Math.min(1, this.game.dread + 0.05);
      }
    }

    /**
     * Pasos arriba: si te quedas quieto 6 s en la sala, con menos de 3 máquinas tapando el zumbido, se oyen pasos en el
     * techo (la lavandería no tiene segundo piso). Una vez por noche, desde que él apareció; nunca en Paseo.
     */
    _stepsAbove(dt, player) {
      var g = this.game;
      if (this.stepsDone || (g.diff && g.diff.sinSustos) || !g.flags.customerSeen) { return; }
      var inSala = !(g.bosque && g.bosque.outside) && !(g.pasillo && g.pasillo.inside);
      var still = player.vel.lengthSq() < 0.01;
      this.stillFor = inSala && still && g.calmSources() < 3 ? (this.stillFor || 0) + dt : 0;
      if (this.stillFor < 6) { return; }
      this.stepsDone = true;
      g.audio.pasosArriba();
      g.dread = Math.min(1, g.dread + 0.06);
      setTimeout(function () {
        if (g.state === 'playing') { g.ui.subtitle('(Arriba se oyen pasos. La lavandería no tiene segundo piso.)', 5); }
      }, 3300);
    }

    /** Las huellas mojadas: al verlas de cerca, «son de tu talla» (una vez cada vez que aparecen). */
    _prints(player) {
      var fp = this.world.footprints;
      if (!fp.visible || this.printsNoticed) { return; }
      var mid = fp.children[4].position;
      if (this.zoneVisible('banco') > 0.3 && U.distXZ(player.pos, mid) < 3.5) {
        this.printsNoticed = true;
        this.game.ui.subtitle('(Hay huellas mojadas en el piso que van del vidrio al banco amarillo. Son de tu talla.)', 5);
        this.game.dread = Math.min(1, this.game.dread + 0.04);
      }
    }

    /** La ropa doblada: al verla de cerca, el subtítulo; tres parpadeos después, ya no está. */
    _clothes(player) {
      var pile = this.world.foldedClothes;
      if (!pile.visible) { return; }
      if (!this.clothesNoticed) {
        if (this.zoneVisible('mostrador') > 0.5 && U.distXZ(player.pos, pile.position) < 3.5) {
          this.clothesNoticed = true;
          this.clothesBlinks = player.blinkCount;
          this.game.ui.subtitle('(Alguien dobló ropa que nadie trajo. Huele a tu suavizante.)', 5);
          this.game.dread = Math.min(1, this.game.dread + 0.04);
        }
      } else if (player.eyesClosed && player.blinkCount - this.clothesBlinks >= 3) {
        pile.visible = false;
      }
    }

    /** La moneda de canto gira despacio; al verla de cerca, el subtítulo (una vez). */
    _edgeCoin(dt, player) {
      var gp = this.game.gameplay;
      if (!gp.edgeCoin) { return; }
      var coin = this.world.edgeCoin;
      coin.rotation.z += dt * 1.4;
      if (!this.coinNoticed && this.zoneVisible('cambiador') > 0.5 && U.distXZ(player.pos, coin.position) < 3.2) {
        this.coinNoticed = true;
        this.game.ui.subtitle('(En la bandeja del cambiador hay una moneda parada de canto. En tu bolsillo falta una.)', 5);
        this.game.dread = Math.min(1, this.game.dread + 0.04);
      }
    }

    _watch(dt, player) {
      if (!this.customer.present) { this._setHead(0); return; }
      var unseen = this.zoneVisible(this.customer.zone) === 0 || player.eyesClosed;
      if (!unseen) { return; }
      var pos = this.world.customer.group.position;
      var want = Math.atan2(-(player.pos.x - pos.x), -(player.pos.z - pos.z)) - this.customer.rot;
      while (want > Math.PI) { want -= Math.PI * 2; }
      while (want < -Math.PI) { want += Math.PI * 2; }
      want = U.clamp(want, -1.3, 1.3);
      this._setHead(this.headYaw + (want - this.headYaw) * Math.min(1, dt * 1.2));
    }

    /**
     * Reflejos: al acercarte a mirar el vidrio de una lavadora, a veces ves una silueta de sombrero detrás de ti.
     * Si él ya llegó, estará a tu espalda en el siguiente parpadeo.
     */
    _reflection(dt, player) {
      var g = this.game;
      var w = this.world;
      this.reflectCooldown -= dt;
      if (this.reflection) {
        this.reflection.t -= dt;
        if (this.reflection.t <= 0) {
          w.washers[this.reflection.washer].porthole.material = w.mat.glass;
          this.reflection = null;
        }
        return;
      }
      var hv = g.gameplay.hover;
      var key = hv && hv.kind === 'washerDoor' ? hv.index : null;
      var started = key !== null && key !== this.lastHover;
      this.lastHover = key;
      if (!started || this.reflectCooldown > 0) { return; }
      var wx = w.washers[key].x;
      if (Math.hypot(player.pos.x - wx, player.pos.z + 4.1) > 1.5) { return; }
      if (Math.random() > ((g.night || 1) >= 2 || g.dread > 0.3 ? 0.3 : 0.12)) { return; }
      this.reflection = { washer: key, t: 0.45 };
      this.reflectCooldown = U.rand(60, 120);
      w.washers[key].porthole.material = this.reflectMat;
      g.audio.whisper(0);
      MR.Haptics.pulse([30, 20, 60]);
      g.dread = Math.min(1, g.dread + 0.08);
      if (g.logros) { g.logros.unlock('reflejo'); }
      if (this.customer.present) { this.schedule('cliente_detras', 'jugador', 6); }
    }

    _setHead(yaw) {
      this.headYaw = yaw;
      this.world.seatedHead.rotation.y = yaw;
      this.world.standingHead.rotation.y = yaw;
    }

    /**
     * Mientras no lo miras, su cabeza se inclina un poco más hacia un lado (nunca mientras lo ves). La primera vez que
     * lo notas, un subtítulo. Y si te acercas a menos de 1,4 m mirándolo, también lo notas: no respira.
     */
    _tilt(dt, player) {
      var c = this.customer;
      if (!c.present) { return; }
      var p = this.customerHead(this.tmpTilt || (this.tmpTilt = new V3()));
      var seen = !player.eyesClosed && this.frustum.containsPoint(p);
      if (!seen) { this.tilt = Math.min(0.36, (this.tilt || 0) + dt * 0.012); }
      this.world.seatedHead.rotation.z = this.tilt || 0;
      this.world.standingHead.rotation.z = this.tilt || 0;
      var g = this.game;
      if (seen && this.tilt > 0.22 && !this.tiltSaid) {
        this.tiltSaid = true;
        g.ui.subtitle('(Tiene la cabeza más inclinada que antes. No lo viste moverse.)', 5);
        g.dread = Math.min(1, g.dread + 0.04);
      }
      if (seen && !this.breathSaid && this.distanceToCustomer(player) < 1.4) {
        this.breathSaid = true;
        g.ui.subtitle('(Estás tan cerca que lo notarías. No respira.)', 5);
        g.dread = Math.min(1, g.dread + 0.05);
      }
    }

    /** De pie a menos de 3 m: una pulsación sorda cada 3–5 s, como un paso que no ves. */
    _nearPulse(dt, player) {
      if (!this.customer.present || this.customer.seated || this.distanceToCustomer(player) > 3) {
        this.nearTimer = U.rand(1.5, 3);
        return;
      }
      this.nearTimer -= dt;
      if (this.nearTimer <= 0) {
        this.nearTimer = U.rand(3, 5);
        this.game.audio.heavyStep(0.45);
        MR.Haptics.pulse(55);
      }
    }

    _flickers(dt) {
      var g = this.game;
      var reduce = g.options.reduceFlashes;
      for (var i = 0; i < LIGHTS; i += 1) {
        var base = g.collapsed ? 0.62 : 1;
        var f = base;
        if (this.flickers[i] > 0) {
          this.flickers[i] = Math.max(0, this.flickers[i] - dt);
          if (reduce) { f = base * 0.45; } else { f = Math.random() < 0.55 ? 0.04 : base * U.rand(0.3, 1); }
        }
        g.retro.setLightFactor(i, f);
        var panel = this.world.panels[i];
        panel.material.uniforms.uEmissive.value = (i < 5 ? 1.2 : 1.0) * f;
      }
    }

    lightLevel() {
      var s = 0;
      for (var i = 0; i < LIGHTS; i += 1) { s += this.game.retro.lightFactor[i]; }
      return s / LIGHTS;
    }
  }

  MR.Horror = Horror;
})(window.MR = window.MR || {});
