/**
 * Blind-Spot Engine: el horror nunca ataca de frente.
 * Cada zona de la lavandería tiene su propio MR.Dispatcher (campeón de Gemini). En cada cuadro se calcula la
 * visibilidad de la zona con el frustum de la cámara (0 si queda fuera de la vista) y se llama a
 * dispatcher.tick(visibilidad, ojosCerrados): los eventos programados allí solo ocurren cuando nadie mira o
 * durante un parpadeo. La zona especial "jugador" tiene visibilidad 1 siempre: lo que está "detrás de ti"
 * solo puede pasar mientras parpadeas.
 * También vigila la mirada al rostro del Cliente Inmóvil (regla del registro: NO lo mires a la cara).
 */
(function (MR) {
  'use strict';

  var U = MR.Util;
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
      this._stare(dt, player, eye, forward);
      this._nearPulse(dt, player);
      this._flickers(dt);
      var door = this.world.backDoor;
      door.rotation.y += (this.backDoorTarget - door.rotation.y) * Math.min(1, dt * 2);
    }

    zoneVisible(name) { return this.zones[name] ? this.zones[name].vis : 1; }

    // ---------------------------------------------------------------------------------------------
    _director(dt) {
      var g = this.game;
      if (g.minutes < MR.Config.SHIFT_START + 5) { return; }
      this.nextEvent -= dt;
      if (this.nextEvent > 0) { return; }
      var mult = g.anomalyMultiplier();
      var interval = 34 / (mult * (1 + g.dread * 0.8) * g.consumables.paranoia()) * (g.collapsed ? 0.6 : 1);
      this.nextEvent = U.rand(0.7, 1.3) * interval;

      var outside = g.bosque && g.bosque.outside;
      var table;
      if (outside) {
        // En el bosque: ramas, la linterna, el búho… y la lavandería sigue cambiando sola a tus espaldas.
        table = [['rama', 3], ['linterna', 1.5], ['buho', 1], ['apagon', 1], ['charco', 0.8], ['puerta_lavadora', 0.6], ['secadora_sola', 0.6]];
        if (this.customer.present) { table.push(['cliente_bosque', 2.5 + g.stats.mirada * 0.5]); }
      } else {
        table = [['apagon', 3], ['charco', 2], ['puerta_lavadora', 2], ['secadora_sola', 2], ['puerta_trasera', 1], ['trapeador_movido', 1]];
        if (this.customer.present) {
          table.push(['huellas', 1], ['mano_vidrio', 1]);
          if (g.talked) { table.push(['cliente_mueve', 0.6 + g.stats.mirada * 0.5]); }
        }
      }
      if (g.whispers) { table.push(['susurro', 4]); }
      else if (g.consumables.high > 0.5) { table.push(['susurro', 1.5]); } // paranoia: susurros fuera de hora
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
          var targets = ['banco', 'banco', 'lavadoras', 'lavadoras_mira', 'secadoras', 'entrada', 'almacen', 'mostrador'];
          var to = U.pick(targets.filter(function (t) { return t !== this.customer.anchor; }, this));
          this.schedule('cliente_mueve', this.world.anchors[to].zone, 3, { to: to });
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
      switch (e.type) {
        case 'cliente_aparece':
          if (!this.customer.present) {
            this.placeCustomer('banco');
            this.customer.present = true;
            audio.thud();
            g.onCustomerAppeared();
          }
          break;
        case 'cliente_mueve':
          if (!this.customer.present) { break; }
          if (this.customer.behind || this.zoneVisible(this.customer.zone) === 0 || g.player.eyesClosed) {
            this.placeCustomer(e.to);
          } else {
            this.later(2, 'cliente_mueve', zoneName, 3, { to: e.to });
          }
          break;
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
          this.flickers[e.light] = Math.max(this.flickers[e.light], e.seconds);
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
        case 'cierra_trasera': this.backDoorTarget = 0; break;
        case 'huellas':
          w.footprints.visible = true;
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

    /** Pasos del Cliente Inmóvil cuando se reubica cerca: audio grave y vibración sorda y pesada. */
    _stepsIfNear(wasPresent, behind) {
      if (!wasPresent) { return; }
      var d = this.distanceToCustomer(this.game.player);
      if (d > 6) { return; }
      var steps = behind || d < 2.5 ? 3 : 2;
      this.game.audio.heavySteps(steps, 480);
      MR.Haptics.pulse(steps === 3 ? [70, 110, 70, 110, 95] : [60, 140, 60]);
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
    }

    placeBehindPlayer(player) {
      var fwd = player.forward(new V3());
      fwd.y = 0;
      if (fwd.lengthSq() < 1e-6) { fwd.set(0, 0, -1); }
      fwd.normalize();
      var p = player.pos;
      // Límites de donde estés: la lavandería o el bosque.
      var bounds = this.game.bosque && this.game.bosque.outside ? this.world.forest.bounds : { minX: -7.6, maxX: 7.6, minZ: -4.0, maxZ: 4.6 };
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
      var rot = this.customer.rot;
      var faceDir = new V3(-Math.sin(rot), 0, -Math.cos(rot));
      var faceVisible = faceDir.dot(new V3(-toHead.x, 0, -toHead.z).normalize()) > 0.3;
      var staring = angle < C.STARE_ANGLE_DEG && dist < C.STARE_DISTANCE && faceVisible;
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
