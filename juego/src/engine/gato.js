/**
 * Pelusa, el gato de la lavandería. Hace compañía… y avisa.
 * - Duerme en lo alto de una secadora, del banco o del mostrador; baja de un salto, camina por la sala por una
 *   red de puntos (caminos rectos que no cruzan muebles) y se sienta a mirarte.
 * - Si lo tocas: ronronea, baja el pavor y vibra el teléfono (o el control) al ritmo del ronroneo.
 * - ALARMA: si el Cliente Inmóvil está de pie a menos de 3.5 m del gato, se eriza, bufa (del lado en que está)
 *   y huye al punto más lejano. Si oyes un bufido, él está ahí.
 * - No sale al bosque (llueve): mientras estás afuera te espera sentado junto a la puerta y maúlla al verte volver.
 * Animación a pasos (12 Hz), como las manos.
 */
(function (MR) {
  'use strict';

  var U = MR.Util;
  var V3 = THREE.Vector3;
  var STEP = 1 / 12;

  // Red de puntos en el piso y lugares altos (con el punto desde el que se salta).
  var NODES = {
    F1: [-5.0, -2.0], F2: [-1.0, -2.0], F3: [2.5, -2.5], F4: [2.0, 2.6], F5: [4.8, 0.2],
    F6: [-6.2, 3.7], F7: [-4.4, -0.3], F8: [1.6, -3.6], F9: [7.2, 1.0]
  };
  var EDGES = [['F1', 'F2'], ['F2', 'F3'], ['F3', 'F5'], ['F5', 'F4'], ['F4', 'F2'], ['F1', 'F7'], ['F7', 'F2'],
    ['F1', 'F6'], ['F4', 'F6'], ['F8', 'F3'], ['F8', 'F2'], ['F5', 'F9']];
  var PERCHES = {
    secadora: { from: 'F8', pos: [1.5, 1.3, -4.62], rot: 0 },
    banco: { from: 'F7', pos: [-4.65, 0.51, 0.6], rot: Math.PI },
    mostrador: { from: 'F9', pos: [7.3, 1.045, 2.05], rot: Math.PI }
  };

  function neighbors(n) {
    var out = [];
    EDGES.forEach(function (e) { if (e[0] === n) { out.push(e[1]); } else if (e[1] === n) { out.push(e[0]); } });
    return out;
  }

  function path(from, to) {
    var prev = {};
    prev[from] = null;
    var queue = [from];
    while (queue.length) {
      var n = queue.shift();
      if (n === to) { break; }
      neighbors(n).forEach(function (m) { if (!(m in prev)) { prev[m] = n; queue.push(m); } });
    }
    if (!(to in prev)) { return [from]; }
    var out = [];
    for (var c = to; c !== null; c = prev[c]) { out.unshift(c); }
    return out;
  }

  class Gato {
    constructor(game) {
      this.game = game;
      this.world = game.world;
      this.build();
      this.state = 'duerme';
      this.perch = 'secadora';
      this.node = PERCHES.secadora.from;
      this.timer = U.rand(25, 45);
      this.route = [];
      this.jump = null;
      this.phase = 0;
      this.stepAcc = 0;
      this.petCooldown = 0;
      this.alarmTimer = 0;
      this.pets = 0;
      this.hisses = 0;
      this.waitingDoor = false;
      this.tmp = new V3();
      this._placeAtPerch('secadora');
    }

    build() {
      var w = this.world;
      var R = w.retro;
      var fur = R.material({ texture: 'black', color: 0x5a5a62 });
      var g = new THREE.Group();
      var body = new THREE.Group();
      g.add(body);
      w.box(0.15, 0.14, 0.36, fur, 0, 0, 0, body);
      var head = new THREE.Group();
      head.position.set(0, 0.08, 0.2);
      body.add(head);
      w.box(0.13, 0.11, 0.11, fur, 0, 0, 0, head);
      w.box(0.035, 0.05, 0.02, fur, -0.04, 0.075, 0, head);
      w.box(0.035, 0.05, 0.02, fur, 0.04, 0.075, 0, head);
      var eyeMat = R.material({ texture: 'white', color: 0x9dff7a, emissive: 1.4 });
      var eyes = new THREE.Group();
      head.add(eyes);
      w.box(0.025, 0.018, 0.01, eyeMat, -0.03, 0.01, 0.056, eyes);
      w.box(0.025, 0.018, 0.01, eyeMat, 0.03, 0.01, 0.056, eyes);
      var tail = new THREE.Group();
      tail.position.set(0, 0.04, -0.17);
      body.add(tail);
      w.box(0.03, 0.03, 0.26, fur, 0, 0, -0.13, tail);
      var legs = [];
      [[-0.05, 0.12], [0.05, 0.12], [-0.05, -0.12], [0.05, -0.12]].forEach(function (p) {
        var leg = new THREE.Group();
        leg.position.set(p[0], -0.05, p[1]);
        w.box(0.035, 0.12, 0.035, fur, 0, -0.06, 0, leg);
        body.add(leg);
        legs.push(leg);
      });
      w.scene.add(g);
      // Tocar cualquier parte del gato = acariciarlo.
      g.traverse(function (o) { if (o.isMesh) { w.interactive(o, 'gato'); } });
      this.mesh = { root: g, body: body, head: head, eyes: eyes, tail: tail, legs: legs };
    }

    _placeAtPerch(name) {
      var p = PERCHES[name];
      this.mesh.root.position.set(p.pos[0], p.pos[1], p.pos[2]);
      this.mesh.root.rotation.y = p.rot;
      this.perch = name;
      this.node = p.from;
    }

    _goTo(target) {
      this.route = path(this.node, target).slice(1);
      this.state = this.route.length ? 'camina' : 'sentado';
      this.timer = U.rand(6, 12);
    }

    /** Salto en arco: hacia un lugar alto (toPerch) o, con down, de vuelta al piso. */
    _jump(toPerch, down) {
      var to;
      if (down) {
        var from = PERCHES[this.perch].from;
        to = new V3(NODES[from][0], 0, NODES[from][1]);
        this.node = from;
      } else {
        var p = PERCHES[toPerch].pos;
        to = new V3(p[0], p[1], p[2]);
      }
      this.jump = { from: this.mesh.root.position.clone(), to: to, t: 0, dur: 0.55, perch: down ? null : toPerch };
      this.state = 'salta';
    }

    position() { return this.mesh.root.position; }

    /** Acariciar. */
    pet() {
      var g = this.game;
      if (this.petCooldown > 0) { g.ui.subtitle('(Pelusa te ignora con mucha dignidad.)', 2.5); return; }
      this.petCooldown = 15;
      this.pets += 1;
      if (this.state === 'camina') { this.state = 'sentado'; this.route = []; this.timer = U.rand(6, 10); }
      g.audio.ronroneo();
      MR.Haptics.pulse([12, 28, 12, 28, 12, 28, 12, 28, 12]);
      g.dread = Math.max(0, g.dread - 0.08);
      g.ui.subtitle(this.pets === 1 ? '(El gato ronronea. En su collar dice «Pelusa».)' : '(Pelusa ronronea.)', 3);
      if (g.logros) { g.logros.unlock('gato'); }
    }

    update(dt) {
      var g = this.game;
      var root = this.mesh.root;
      this.petCooldown = Math.max(0, this.petCooldown - dt);
      this.stepAcc += dt;
      var tick = this.stepAcc >= STEP;
      if (tick) { this.stepAcc = 0; }

      // Mientras estás en el bosque o en el pasillo, te espera junto a la puerta por la que saliste.
      var away = g.bosque && g.bosque.outside;
      var back = g.pasillo && g.pasillo.inside;
      if (away || back) {
        if (!this.waitingDoor) {
          this.waitingDoor = true;
          this.jump = null; this.route = [];
          if (back) { root.position.set(6.4, 0, -3.4); root.rotation.y = Math.PI; } else { root.position.set(0.6, 0, 4.1); root.rotation.y = 0; }
          this.node = 'F4';
          this.perch = null;
          this.state = 'sentado';
        }
        this._pose(dt, tick);
        return;
      }
      if (this.waitingDoor) {
        this.waitingDoor = false;
        this.timer = U.rand(3, 6);
        g.audio.miau(this._pan());
      }

      // Alarma: él de pie cerca del gato.
      this.alarmTimer -= dt;
      if (this.alarmTimer <= 0) {
        this.alarmTimer = 0.4;
        this._alarm();
      }

      switch (this.state) {
        case 'duerme':
        case 'sentado':
          this.timer -= dt;
          if (this.timer <= 0) { this._decide(); }
          break;
        case 'eriza':
          this.timer -= dt;
          if (this.timer <= 0) { this._flee(); }
          break;
        case 'camina':
        case 'huye':
          this._walk(dt);
          break;
        case 'salta':
          this._doJump(dt);
          break;
        default: break;
      }
      this._pose(dt, tick);
    }

    _decide() {
      if (this.perch) { this._jump(null, true); return; }   // bajar de donde esté
      var r = Math.random();
      if (r < 0.25) {
        // Subir a un lugar alto (si él no está sentado en el banco).
        var h = this.game.horror;
        var options = Object.keys(PERCHES).filter(function (k) { return !(k === 'banco' && h.customer.present && h.customer.seated); });
        var target = U.pick(options);
        if (this.node === PERCHES[target].from) { this._jump(target, false); } else { this.pendingPerch = target; this._goTo(PERCHES[target].from); }
        return;
      }
      if (r < 0.45) { this.state = 'sentado'; this.timer = U.rand(6, 14); return; }
      var keys = Object.keys(NODES).filter(function (k) { return k !== this.node; }, this);
      this._goTo(U.pick(keys));
    }

    _walk(dt) {
      var root = this.mesh.root;
      if (!this.route.length) {
        if (this.pendingPerch && this.node === PERCHES[this.pendingPerch].from) {
          var p = this.pendingPerch;
          this.pendingPerch = null;
          this._jump(p, false);
          return;
        }
        this.state = 'sentado';
        this.timer = U.rand(5, 12);
        return;
      }
      var n = NODES[this.route[0]];
      var dx = n[0] - root.position.x;
      var dz = n[1] - root.position.z;
      var d = Math.hypot(dx, dz);
      var speed = this.state === 'huye' ? 2.4 : 0.65;
      if (d < 0.05) {
        this.node = this.route.shift();
        return;
      }
      var stepLen = Math.min(d, speed * dt);
      root.position.x += dx / d * stepLen;
      root.position.z += dz / d * stepLen;
      root.position.y = 0;
      root.rotation.y = Math.atan2(dx, dz);
      this.phase += dt * (this.state === 'huye' ? 16 : 7);
    }

    _doJump(dt) {
      var j = this.jump;
      var root = this.mesh.root;
      j.t = Math.min(1, j.t + dt / j.dur);
      root.position.lerpVectors(j.from, j.to, j.t);
      root.position.y += Math.sin(j.t * Math.PI) * 0.45;
      var dx = j.to.x - j.from.x;
      var dz = j.to.z - j.from.z;
      if (Math.abs(dx) + Math.abs(dz) > 0.01) { root.rotation.y = Math.atan2(dx, dz); }
      if (j.t >= 1) {
        this.jump = null;
        if (j.perch) {
          this.perch = j.perch;
          root.rotation.y = PERCHES[j.perch].rot;
          this.state = 'duerme';
          this.timer = U.rand(30, 60);
        } else {
          this.perch = null;
          this.state = 'sentado';
          this.timer = U.rand(2, 5);
        }
      }
    }

    _alarm() {
      var h = this.game.horror;
      if (!h.customer.present || h.customer.seated || this.state === 'eriza' || this.state === 'huye' || this.state === 'salta') { return; }
      var c = this.world.customer.group.position;
      var me = this.mesh.root.position;
      if (Math.hypot(c.x - me.x, c.z - me.z) > 3.5) { return; }
      this.state = 'eriza';
      this.timer = 1.1;
      this.hisses += 1;
      this.mesh.root.rotation.y = Math.atan2(c.x - me.x, c.z - me.z); // le da la cara (y te avisa de dónde está)
      this.game.audio.bufido(this._pan());
      if (this.perch) { this.perch = null; }
    }

    _flee() {
      // Al punto más lejano de él.
      var c = this.world.customer.group.position;
      var best = this.node;
      var bd = -1;
      Object.keys(NODES).forEach(function (k) {
        var d = Math.hypot(NODES[k][0] - c.x, NODES[k][1] - c.z);
        if (d > bd) { bd = d; best = k; }
      });
      // Si estaba en lo alto, baja primero directo al piso.
      var root = this.mesh.root;
      if (root.position.y > 0.05) { root.position.y = 0; root.position.x = NODES[this.node][0]; root.position.z = NODES[this.node][1]; }
      this.route = path(this.node, best).slice(1);
      this.state = this.route.length ? 'huye' : 'sentado';
      this.timer = U.rand(8, 14);
    }

    /** Paneo del gato respecto a la cabeza del jugador (−1 izquierda … 1 derecha). */
    _pan() {
      var cam = this.game.player.camera;
      var to = this.tmp.copy(this.mesh.root.position).sub(cam.position);
      to.y = 0;
      if (to.lengthSq() < 1e-6) { return 0; }
      var right = new V3(1, 0, 0).applyEuler(cam.rotation);
      return U.clamp(right.dot(to.normalize()), -1, 1);
    }

    /** Poses a 12 Hz: dormido, sentado, caminando, erizado. */
    _pose(dt, tick) {
      if (!tick) { return; }
      var m = this.mesh;
      var s = this.state;
      var walking = s === 'camina' || s === 'huye';
      m.legs.forEach(function (leg, i) { leg.visible = s !== 'duerme'; leg.rotation.x = walking ? Math.sin(this.phase + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 0.6 : 0; }, this);
      m.eyes.visible = s !== 'duerme';
      if (s === 'duerme') {
        m.body.position.y = 0.075;
        m.body.rotation.x = 0;
        m.head.position.set(0.05, 0.0, 0.17);
        m.head.rotation.set(0.3, 0.5, 0);
        m.tail.rotation.set(0, 1.9, 0);
        m.body.scale.set(1, 0.85, 1);
      } else if (s === 'sentado') {
        m.body.position.y = 0.17;
        m.body.rotation.x = -0.55;
        m.head.position.set(0, 0.1, 0.19);
        m.head.rotation.set(0.5, this._lookYaw(), 0);
        m.tail.rotation.set(0.9, 0.6, 0);
        m.body.scale.set(1, 1, 1);
      } else if (s === 'eriza') {
        m.body.position.y = 0.2;
        m.body.rotation.x = 0;
        m.head.position.set(0, 0.07, 0.2);
        m.head.rotation.set(0, 0, 0);
        m.tail.rotation.set(-1.2, 0, 0);
        m.body.scale.set(1.1, 1.25, 1);
      } else {
        m.body.position.y = 0.17;
        m.body.rotation.x = 0;
        m.head.position.set(0, 0.08, 0.2);
        m.head.rotation.set(0, 0, 0);
        m.tail.rotation.set(-0.5 + Math.sin(this.phase * 0.5) * 0.2, 0, 0);
        m.body.scale.set(1, 1, 1);
      }
    }

    /** Sentado, voltea la cabeza: hacia él si está presente, si no hacia ti. */
    _lookYaw() {
      var h = this.game.horror;
      var target = h.customer.present ? this.world.customer.group.position : this.game.player.pos;
      var me = this.mesh.root;
      var ang = Math.atan2(target.x - me.position.x, target.z - me.position.z) - me.rotation.y;
      while (ang > Math.PI) { ang -= Math.PI * 2; }
      while (ang < -Math.PI) { ang += Math.PI * 2; }
      return U.clamp(ang, -1.1, 1.1);
    }
  }

  Gato.NODES = NODES;
  Gato.PERCHES = PERCHES;
  MR.Gato = Gato;
})(window.MR = window.MR || {});
