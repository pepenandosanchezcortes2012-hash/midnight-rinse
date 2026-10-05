/**
 * Pelusa, el gato de la lavandería. Hace compañía… y avisa.
 * - Duerme en lo alto de una secadora, del banco o del mostrador; baja de un salto, camina por la sala por una
 *   red de puntos (caminos rectos que no cruzan muebles) y se sienta a mirarte.
 * - Si lo tocas: ronronea, baja el pavor y vibra el teléfono (o el control) al ritmo del ronroneo.
 * - ALARMA: si el Cliente Inmóvil está de pie a menos de 3.5 m del gato, se eriza, bufa (del lado en que está)
 *   y huye al punto más lejano. Si oyes un bufido, él está ahí.
 * - No sale al bosque (llueve): mientras estás afuera te espera sentado junto a la puerta y maúlla al verte volver.
 * - RUTINA por hora del turno (sin quitarle la alarma, que manda): 01:10 duerme en la secadora · 01:40 come de su
 *   plato · 02:00 se acicala · 02:30 mira por la puerta de vidrio (y a veces la rasca) · 03:00 hace la ronda ·
 *   03:30 te sigue · 04:00 siesta en el banco o el mostrador · 04:30 se queda cerca de ti.
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
    F6: [-6.2, 3.7], F7: [-4.4, -0.3], F8: [1.6, -3.6], F9: [7.2, 1.0],
    PL: [7.25, 0.75],   // frente a su plato
    PU: [0.6, 3.9]      // frente a la puerta de vidrio
  };
  var BOWL = [7.25, 0.42];
  var MEMORIA = 'midnight-rinse/pelusa'; // lo que su cerebro de mosca aprendió (quién la acaricia, quién la asusta)
  var BENCH = [-3.5, 0.62]; // el banco amarillo (lo que mira en la anomalía de horror.js)
  var PATROL = ['F1', 'F6', 'F4', 'F5', 'F9', 'F3', 'F8', 'F2', 'F7'];

  /** Qué toca a esta hora del turno (minutos desde la medianoche). */
  function routine(min) {
    if (min < 100) { return 'dormir'; }      // 01:10–01:40
    if (min < 120) { return 'comer'; }       // 01:40–02:00
    if (min < 150) { return 'acicalarse'; }  // 02:00–02:30
    if (min < 180) { return 'ventana'; }     // 02:30–03:00
    if (min < 210) { return 'ronda'; }       // 03:00–03:30
    if (min < 240) { return 'seguirte'; }    // 03:30–04:00
    if (min < 270) { return 'siesta'; }      // 04:00–04:30
    return 'cerca';                          // 04:30–05:12
  }
  var EDGES = [['F1', 'F2'], ['F2', 'F3'], ['F3', 'F5'], ['F5', 'F4'], ['F4', 'F2'], ['F1', 'F7'], ['F7', 'F2'],
    ['F1', 'F6'], ['F4', 'F6'], ['F8', 'F3'], ['F8', 'F2'], ['F5', 'F9'], ['F9', 'PL'], ['F4', 'PU']];
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
      this.company = {}; // caras blancas a las que ya acompañó
      this.giftOnReturn = Math.random() < 0.35; // esta noche, al volver del bosque, te trae algo
      // El cerebro de mosca (mosca.js): atiende lo que importa, aprende de caricias y sustos y a veces tuerce la rutina.
      this.brain = new MR.Mosca(1, { curiosidad: 0.6, miedo: 0.75 });
      try { this.brain.importar(JSON.parse(window.localStorage.getItem(MEMORIA) || 'null')); } catch (e) { /* sin memoria */ }
      this.senseAcc = 0;
      this._placeAtPerch('secadora');
    }

    build() {
      var w = this.world;
      var R = w.retro;
      var fur = R.material({ texture: 'black', color: 0x5a5a62 });
      var g = new THREE.Group();
      var body = new THREE.Group();
      g.add(body);
      // Cuerpo: un óvalo de pocas caras (PS1), con el pecho un poco más alto.
      var torso = new THREE.Mesh(new THREE.SphereGeometry(0.1, 7, 5), fur);
      torso.scale.set(0.78, 0.72, 1.85);
      body.add(torso);
      var chest = new THREE.Mesh(new THREE.SphereGeometry(0.072, 6, 4), fur);
      chest.position.set(0, 0.02, 0.12);
      body.add(chest);
      var head = new THREE.Group();
      head.position.set(0, 0.08, 0.2);
      body.add(head);
      var skull = new THREE.Mesh(new THREE.SphereGeometry(0.064, 7, 5), fur);
      skull.scale.set(1.08, 0.92, 0.95);
      head.add(skull);
      w.box(0.058, 0.038, 0.04, fur, 0, -0.024, 0.048, head); // hocico
      // Orejas en punta (se echan hacia atrás cuando algo la inquieta: _pose).
      var ears = [-1, 1].map(function (s) {
        var ear = new THREE.Group();
        ear.position.set(0.036 * s, 0.045, -0.004);
        ear.rotation.z = -0.28 * s;
        head.add(ear);
        var cone = new THREE.Mesh(new THREE.ConeGeometry(0.027, 0.064, 4), fur);
        cone.position.y = 0.028;
        cone.rotation.y = Math.PI / 4;
        ear.add(cone);
        return ear;
      });
      var eyeMat = R.material({ texture: 'white', color: 0x9dff7a, emissive: 1.0 }); // verdes (con más brillo se veían blancos)
      var eyes = new THREE.Group();
      head.add(eyes);
      w.box(0.024, 0.017, 0.01, eyeMat, -0.027, 0.01, 0.058, eyes);
      w.box(0.024, 0.017, 0.01, eyeMat, 0.027, 0.01, 0.058, eyes);
      // El collar rojo con su plaquita dorada («Pelusa»).
      var collar = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.05, 0.02, 8, 1, true), R.material({ texture: 'white', color: 0x9a2a26 }));
      collar.position.set(0, -0.066, -0.022);
      collar.rotation.x = 0.9; // a lo largo del cuello, que sube del pecho hacia la cabeza
      head.add(collar);
      w.box(0.018, 0.022, 0.006, R.material({ texture: 'white', color: 0xd8b24a, emissive: 0.4 }), 0, -0.094, 0.016, head);
      var tail = new THREE.Group();
      tail.position.set(0, 0.04, -0.17);
      body.add(tail);
      var tailMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.021, 0.27, 5), fur); // más fina en la punta
      tailMesh.rotation.x = -Math.PI / 2;
      tailMesh.position.set(0, 0, -0.135);
      tail.add(tailMesh);
      var legs = [];
      [[-0.05, 0.12], [0.05, 0.12], [-0.05, -0.12], [0.05, -0.12]].forEach(function (p) {
        var leg = new THREE.Group();
        leg.position.set(p[0], -0.05, p[1]);
        var bone = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.02, 0.12, 5), fur);
        bone.position.y = -0.06;
        leg.add(bone);
        w.box(0.032, 0.016, 0.042, fur, 0, -0.118, 0.006, leg); // la pata
        body.add(leg);
        legs.push(leg);
      });
      w.scene.add(g);
      // Su plato, junto al mostrador.
      var bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.05, 10), R.material({ texture: 'white', color: 0x8a3a32 }));
      bowl.position.set(BOWL[0], 0.025, BOWL[1]);
      w.add(bowl);
      w.box(0.15, 0.01, 0.15, R.material({ texture: 'white', color: 0x7a5a3a }), BOWL[0], 0.052, BOWL[1]);
      // Tocar cualquier parte del gato = acariciarlo.
      g.traverse(function (o) { if (o.isMesh) { w.interactive(o, 'gato'); } });
      this.mesh = { root: g, body: body, head: head, eyes: eyes, tail: tail, legs: legs, ears: ears };
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
      if (!this.mesh.root.visible) { return; }
      if (this.state === 'mira') { g.ui.subtitle('(Pelusa no aparta la vista del banco. Ni siquiera ronronea.)', 3); return; }
      if (this.petCooldown > 0) { g.ui.subtitle('(Pelusa te ignora con mucha dignidad.)', 2.5); return; }
      this.petCooldown = 15;
      this.pets += 1;
      if (this.state === 'camina') { this.state = 'sentado'; this.route = []; this.timer = U.rand(6, 10); }
      g.audio.ronroneo();
      this.brain.recompensa(1); // dopamina de recompensa: te va tomando cariño
      this._remember();
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

      // Noche «¿Y el gato?»: no está hasta las 03:00; entonces aparece dormido en el mostrador.
      if (g.mod === 'sin_gato') {
        var hidden = g.minutes < 180;
        if (hidden) { root.visible = false; return; }
        if (!root.visible) { root.visible = true; this._placeAtPerch('mostrador'); this.state = 'duerme'; this.timer = 40; }
      }
      // Mientras estás en el bosque o en el pasillo, te espera junto a la puerta por la que saliste.
      var away = g.bosque && g.bosque.outside;
      var back = g.pasillo && g.pasillo.inside;
      if (away || back) {
        if (!this.waitingDoor) {
          this.waitingDoor = true;
          this.jump = null; this.route = [];
          if (back) { root.position.set(6.4, 0, -3.4); root.rotation.y = Math.PI; } else { root.position.set(0.6, 0, 4.1); root.rotation.y = 0; }
          this.waitedFor = back ? 'pasillo' : 'bosque';
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
        // A veces, al volver del bosque, te dejó algo a los pies (una vez por noche, desde la 01:40).
        if (this.waitedFor === 'bosque' && this.giftOnReturn && !this.gifted && g.minutes >= 100 && root.visible) {
          this.gifted = true;
          g.objetos.give('hoja_pino', '(Pelusa dejó algo a tus pies: {n}. {d})');
        }
      }

      // El cerebro: los sentidos, 10 veces por segundo; y piensa.
      this.senseAcc += dt;
      if (this.senseAcc >= 0.1) { this.senseAcc = 0; this._sense(); }
      this.brain.pensar(dt);

      // Alarma: él de pie cerca del gato.
      this.alarmTimer -= dt;
      if (this.alarmTimer <= 0) {
        this.alarmTimer = 0.4;
        this._alarm();
      }

      switch (this.state) {
        case 'duerme':
        case 'sentado':
        case 'come':
        case 'acicala':
        case 'ventana':
          this.timer -= dt;
          this._activity(dt);
          this._keepCompany();
          if (this.timer <= 0) { this._decide(); }
          break;
        case 'eriza':
          this.timer -= dt;
          if (this.timer <= 0) { this._flee(); }
          break;
        case 'mira':
          this.timer -= dt;
          this._stare(dt);
          if (this.timer <= 0) { this.state = 'sentado'; this.timer = U.rand(1, 2); }
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

    /** Sube a un lugar alto (caminando primero hasta el punto desde el que se salta). */
    _toPerch(target) {
      if (this.perch === target) { this.state = 'duerme'; this.timer = U.rand(25, 45); return; }
      if (this.perch) { this._jump(null, true); return; }
      if (this.node === PERCHES[target].from) { this._jump(target, false); return; }
      this.pendingPerch = target;
      this._goTo(PERCHES[target].from);
    }

    /** El punto de la red más cercano a una posición. */
    _nearNode(p) {
      var best = this.node;
      var bd = 1e9;
      Object.keys(NODES).forEach(function (k) {
        var d = Math.hypot(NODES[k][0] - p.x, NODES[k][1] - p.z);
        if (d < bd) { bd = d; best = k; }
      });
      return best;
    }

    /** El punto de la red más cercano a ti. */
    _nearPlayerNode() {
      var p = this.game.player.pos;
      var best = this.node;
      var bd = 1e9;
      Object.keys(NODES).forEach(function (k) {
        var d = Math.hypot(NODES[k][0] - p.x, NODES[k][1] - p.z);
        if (d < bd) { bd = d; best = k; }
      });
      return best;
    }

    /** Lo que hace mientras come, se acicala o mira por la puerta: sonidos chiquitos y el rasguño de la puerta. */
    _activity(dt) {
      var g = this.game;
      if (this.state === 'come' && Math.random() < dt * 2.5) { g.audio.croqueta(this._pan()); }
      if (this.state === 'ventana') {
        this.scratch = (this.scratch || 0) - dt;
        if (this.scratch <= 0) {
          this.scratch = U.rand(5, 9);
          this.scratching = 0.8;
          g.audio.rasguno(this._pan());
          if (!this.scratchSeen && U.distXZ(g.player.pos, this.mesh.root.position) < 4.5) {
            this.scratchSeen = true;
            g.ui.subtitle('(Pelusa rasca la puerta de vidrio, despacio, mirando hacia afuera.)', 4);
          }
        }
        this.scratching = Math.max(0, (this.scratching || 0) - dt);
      }
    }

    /** ¿Puede ir a mirar el banco? Despierta, en el piso, sin él cerca, sin estar acompañando a nadie. */
    canStare() {
      var ok = { sentado: 1, camina: 1, acicala: 1, ventana: 1, come: 1 };
      return this.mesh.root.visible && !this.perch && !this.waitingDoor && !this.companyWith && !!ok[this.state];
    }

    /**
     * Anomalía (horror.js, «pelusa_mira»): antes de que él llegue, Pelusa va a sentarse frente al banco amarillo vacío
     * y lo mira fijo. Si la ves, lo notas; si después miras el banco, cruje como si alguien se sentara.
     */
    stareAtBench() {
      if (this.stared || !this.canStare()) { return false; }
      this.stared = true;
      if (this.node === 'F1' && this.state !== 'camina') { this._startStare(); return true; }
      this.staring = true;
      this._goTo('F1');
      return true;
    }

    _startStare() {
      this.staring = false;
      this.state = 'mira';
      this.timer = 24;
      this.stareSeenAt = null;
      this.creaked = false;
    }

    _stare() {
      var g = this.game;
      var root = this.mesh.root;
      root.rotation.y = Math.atan2(BENCH[0] - root.position.x, BENCH[1] - root.position.z);
      if (g.player.eyesClosed || g.bosque.outside || g.pasillo.inside) { return; }
      var cam = g.player.camera;
      var v = this.tmp.set(root.position.x, 0.2, root.position.z).project(cam);
      var catOnScreen = Math.abs(v.x) < 0.85 && Math.abs(v.y) < 0.85 && v.z < 1;
      if (this.stareSeenAt === null) {
        if (catOnScreen && U.distXZ(g.player.pos, root.position) < 6) {
          this.stareSeenAt = this.timer;
          this.timer = Math.max(this.timer, 12);
          g.ui.subtitle('(Pelusa mira fijo el banco amarillo, con las orejas hacia atrás. No hay nadie sentado.)', 5);
          g.dread = Math.min(1, g.dread + 0.03);
        }
        return;
      }
      if (this.creaked || this.stareSeenAt - this.timer < 2) { return; }
      var b = this.tmp.set(BENCH[0], 0.6, BENCH[1]).project(cam);
      if (Math.abs(b.x) < 0.45 && Math.abs(b.y) < 0.6 && b.z < 1) {
        this.creaked = true;
        g.audio.crujido(this._pan());
        g.ui.subtitle('(El banco cruje, como si alguien acabara de sentarse.)', 5);
        g.dread = Math.min(1, g.dread + 0.05);
        this.timer = Math.min(this.timer, 2.5); // y Pelusa, por fin, aparta la vista
      }
    }

    /** Llegó junto a la cara blanca: se sienta a su lado (y la primera vez, un subtítulo). */
    _keepCompany() {
      var v = this.companyWith;
      if (!v || this.state !== 'sentado') { return; }
      var gp = v.model.group.position;
      var me = this.mesh.root.position;
      if (Math.hypot(gp.x - me.x, gp.z - me.z) > 2.6) { return; }
      this.companyWith = null;
      v.catSat = true; // la cara blanca ahora puede contarte de Pelusa (clientela.js)
      this.mesh.root.rotation.y = Math.atan2(gp.x - me.x, gp.z - me.z);
      this.timer = Math.max(this.timer, 8);
      if (!this.companySaid) {
        this.companySaid = true;
        this.game.ui.subtitle('(Pelusa se sienta junto a la cara blanca. Ella no la mira, pero le acerca la mano.)', 5);
      }
    }

    /** Qué hacer ahora: lo decide la rutina de la hora (antes era al azar). */
    _decide() {
      var act = this.activity = routine(this.game.minutes);
      var sleeps = act === 'dormir' || act === 'siesta';
      if (this.perch && !sleeps) { this._jump(null, true); return; }   // bajar de donde esté
      var h = this.game.horror;
      var root = this.mesh.root;
      // A veces, en vez de su rutina, va a sentarse junto a una cara blanca que lava su ropa.
      var cl = this.game.clientela;
      var face = !sleeps && cl ? cl.visitors.filter(function (v) { return v.kind === 'cara' && v.state === 'llego'; })[0] : null;
      if (face && !this.company[face.id] && Math.random() < 0.35) {
        this.company[face.id] = true;
        this.companyWith = face;
        this._goTo(this._nearNode(face.model.group.position));
        return;
      }
      // El cerebro de mosca puede torcer la rutina: si te tomó cariño, va contigo; si algo la asustó, se sube a lo alto.
      var b = this.brain;
      var quiere = b.accion();
      this.brainChose = null;
      if (!sleeps && quiere === 'acercarse' && b.valencia(MR.Mosca.CTX.jugador) > 0.25 && U.distXZ(this.game.player.pos, root.position) > 1.8) {
        this.brainChose = 'acercarse';
        this._goTo(this._nearPlayerNode());
        return;
      }
      if (quiere === 'huir' && b.impulso('huir') > 0.5 && !this.perch) {
        this.brainChose = 'huir';
        this._toPerch('secadora');
        return;
      }
      switch (act) {
        case 'dormir': this._toPerch('secadora'); return;
        case 'siesta': {
          var benchBusy = h.customer.present && h.customer.seated;
          this._toPerch(this.perch === 'mostrador' || benchBusy ? 'mostrador' : 'banco');
          return;
        }
        case 'comer':
          if (this.node === 'PL') {
            this.state = 'come'; this.timer = U.rand(12, 20);
            root.rotation.y = Math.atan2(BOWL[0] - root.position.x, BOWL[1] - root.position.z);
            return;
          }
          this._goTo('PL'); return;
        case 'acicalarse': this.state = 'acicala'; this.timer = U.rand(10, 18); return;
        case 'ventana':
          if (this.node === 'PU') { this.state = 'ventana'; this.timer = U.rand(15, 25); root.rotation.y = 0; this.scratch = U.rand(1, 3); return; }
          this._goTo('PU'); return;
        case 'ronda': {
          this.patrol = ((this.patrol || 0) + 1) % PATROL.length;
          var next = PATROL[this.patrol] === this.node ? PATROL[(this.patrol + 1) % PATROL.length] : PATROL[this.patrol];
          this._goTo(next);
          return;
        }
        default: {
          // Seguirte / quedarse cerca: va al punto más cercano a ti y se sienta a mirarte.
          var near = U.distXZ(this.game.player.pos, root.position) < 1.8;
          var target = this._nearPlayerNode();
          if (near || target === this.node) { this.state = 'sentado'; this.timer = U.rand(3, 7); return; }
          this._goTo(target);
          return;
        }
      }
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
        if (this.staring && this.node === 'F1' && this.state === 'camina') { this._startStare(); return; }
        this.staring = false;
        this.state = 'sentado';
        this.timer = U.rand(1, 2.5); // al llegar, enseguida sigue con su rutina
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

    /** Lo que ve y siente su cerebro: quién está cerca, en qué dirección, cuánta amenaza, cuánto sueño. */
    _sense() {
      var g = this.game;
      var b = this.brain;
      var CTX = MR.Mosca.CTX;
      var root = this.mesh.root;
      var me = root.position;
      var yaw = root.rotation.y;
      b.limpiar();
      function ver(p, fuerza, ctx, alcance) {
        var dx = p.x - me.x;
        var dz = p.z - me.z;
        var d = Math.hypot(dx, dz);
        if (d > 9) { return; }
        b.estimulo(Math.atan2(dx, dz) - yaw, fuerza / (1 + d * 0.4));
        if (ctx !== undefined && d < (alcance || 4)) { b.contexto(ctx, 1 - d / (alcance || 4)); }
      }
      var pp = g.player.pos;
      ver(pp, g.player.moving ? 0.8 : 0.5, CTX.jugador, 7); // a ti te reconoce desde el otro lado de la sala
      var h = g.horror;
      if (h.customer.present) { ver(this.world.customer.group.position, h.customer.seated ? 0.6 : 1.0, CTX.el); }
      var cl = g.clientela;
      if (cl) {
        cl.visitors.forEach(function (v) {
          var mask = v.kind === 'mascara';
          ver(v.model.group.position, mask ? 0.9 : 0.6, mask ? CTX.mascara : CTX.cara);
          if (v.child) { ver(v.child.model.group.position, 0.8, CTX.nino); }
        });
      }
      // Lo que oye: voltea hacia donde sonó algo (una anomalía, el teléfono). Tú puedes seguir su mirada.
      var ruido = 0;
      (g.sonidos || []).forEach(function (s) {
        var k = s.t / 0.8;
        var d = Math.hypot(s.x - me.x, s.z - me.z);
        // Un sonido sobresalta más que algo quieto y llega más lejos: más peso y menos atenuación que lo que ve.
        if (d < 14) { b.estimulo(Math.atan2(s.x - me.x, s.z - me.z) - yaw, s.f * 2.0 * k / (1 + d * 0.2)); }
        ruido = Math.max(ruido, s.f * k);
      });
      var act = routine(g.minutes);
      var cerca = U.distXZ(pp, me) < 2.5 && !g.player.moving;
      b.sentir({
        amenaza: this._threat() ? 1 : 0,
        atraccion: cerca ? 0.5 : 0,
        ruido: Math.min(1, Math.max(g.dread * 0.8, ruido)),
        sueno: act === 'dormir' || act === 'siesta' ? 0.85 : 0.15 // las neuronas reloj (la rutina de la hora)
      });
    }

    /** Guarda lo que aprendió (entre noches; «Reiniciar todo» lo borra). */
    _remember() {
      try { window.localStorage.setItem(MEMORIA, JSON.stringify(this.brain.exportar())); } catch (e) { /* sin almacenamiento */ }
    }

    /** Lo que la asusta: él de pie a menos de 3.5 m, o una máscara negra a menos de 3 m. */
    _threat() {
      var h = this.game.horror;
      var me = this.mesh.root.position;
      if (h.customer.present && !h.customer.seated) {
        var c = this.world.customer.group.position;
        if (Math.hypot(c.x - me.x, c.z - me.z) <= 3.5) { return c; }
      }
      var cl = this.game.clientela;
      var masks = cl ? cl.visitors.filter(function (v) { return v.kind === 'mascara'; }) : [];
      for (var i = 0; i < masks.length; i += 1) {
        var p = masks[i].model.group.position;
        if (Math.hypot(p.x - me.x, p.z - me.z) <= 3) { return p; }
      }
      return null;
    }

    _alarm() {
      if (this.state === 'eriza' || this.state === 'huye' || this.state === 'salta') { return; }
      var c = this._threat();
      if (!c) { return; }
      var me = this.mesh.root.position;
      this.fleeFrom = c.clone();
      this.state = 'eriza';
      this.timer = 1.1;
      this.hisses += 1;
      this.brain.castigar(1); // dopamina de castigo: recordará a quién tenía cerca
      this._remember();
      this.mesh.root.rotation.y = Math.atan2(c.x - me.x, c.z - me.z); // le da la cara (y te avisa de dónde está)
      this.game.audio.bufido(this._pan());
      if (this.perch) { this.perch = null; }
    }

    _flee() {
      // Al punto más lejano de lo que la asustó (él o una máscara).
      var c = this.fleeFrom || this.world.customer.group.position;
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
      // Las orejas, hacia atrás cuando algo la inquieta (erizada o mirando el banco vacío).
      var flat = s === 'eriza' || s === 'mira';
      m.ears.forEach(function (e) { e.rotation.x = flat ? -0.85 : 0; });
      // Comer, acicalarse y mirar por la puerta son variantes de estar sentado.
      if (s === 'come' || s === 'acicala' || s === 'ventana') { this._poseActivity(s); return; }
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
      } else if (s === 'mira') {
        // Sentada, rígida, la cabeza fija al frente (hacia el banco); solo la punta de la cola se mueve.
        m.body.position.y = 0.17;
        m.body.rotation.x = -0.55;
        m.head.position.set(0, 0.1, 0.19);
        m.head.rotation.set(0.45, 0, 0);
        m.tail.rotation.set(1.1, 0.2 + Math.sin(this.phase * 3) * 0.12, 0);
        m.body.scale.set(1, 1, 1);
        this.phase += 0.3;
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

    _poseActivity(s) {
      var m = this.mesh;
      m.legs.forEach(function (leg) { leg.visible = true; leg.rotation.x = 0; });
      m.eyes.visible = s !== 'acicala';
      m.body.position.y = 0.17;
      m.body.scale.set(1, 1, 1);
      this.phase += 0.4;
      if (s === 'come') {
        m.body.rotation.x = 0.25;
        m.head.position.set(0, -0.02, 0.21);
        m.head.rotation.set(0.7 + Math.sin(this.phase * 2) * 0.12, 0, 0);
        m.tail.rotation.set(-0.3, Math.sin(this.phase * 0.5) * 0.4, 0);
      } else if (s === 'acicala') {
        m.body.rotation.x = -0.55;
        m.head.position.set(0, 0.1, 0.19);
        m.head.rotation.set(0.9, 0.5 + Math.sin(this.phase * 1.5) * 0.15, 0);
        m.legs[0].rotation.x = -1.2 + Math.sin(this.phase * 1.5) * 0.2; // la pata delantera, a la cara
        m.tail.rotation.set(0.9, 0.6, 0);
      } else {
        m.body.rotation.x = -0.55;
        m.head.position.set(0, 0.1, 0.19);
        m.head.rotation.set(0.25, Math.sin(this.phase * 0.2) * 0.25, 0);
        m.tail.rotation.set(0.6, Math.sin(this.phase * 0.7) * 0.7, 0); // la cola barre el piso
        if (this.scratching > 0) { m.legs[0].rotation.x = -1.4 + Math.sin(this.phase * 6) * 0.4; m.legs[1].rotation.x = -1.4 - Math.sin(this.phase * 6) * 0.4; }
      }
    }

    /** Sentada, voltea la cabeza hacia donde atiende su cerebro (él, una máscara, el niño, tú…); si nada, hacia ti. */
    _lookYaw() {
      var at = this.brain.atencion();
      if (at.fuerza > 0.12) { return U.clamp(at.angulo, -1.1, 1.1); }
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
