/**
 * Clientela de Blackwood (canon §7): la gente del pueblo bajo el embalse que viene de noche a la lavandería.
 * - Caras blancas: entran por la puerta de vidrio, ponen a lavar su ropa empapada en una lavadora libre (que de verdad
 *   arranca: su ruido tapa el zumbido), murmuran algo y se van. Nunca te miran: si los miras de cerca, giran la cara.
 *   Hablarles (tocarlos) da una respuesta. Llegan entre 01:15 y 02:15, y alguna después de las 04:40.
 * - Máscaras negras (la Administración del Embalse): a las 02:50 (y a veces a las 04:05) uno se para frente al mostrador
 *   sin hablar; la impresora térmica entrega una ORDEN numerada, que queda en el Archivo.
 * Nada de esto es un susto: es vida rara. Diálogos en MR.HISTORIA.blackwood (borrador de Gemini, revisado).
 */
(function (MR) {
  'use strict';

  var U = MR.Util;
  var SPEED = 0.95;
  var COATS = [0x8a7f62, 0x5f6366, 0x2f3a4a, 0x4f5a45, 0x6b4f4a];
  var ENTRY = { x: 0.4, z: 4.35 };

  class Clientela {
    constructor(game) {
      this.game = game;
      this.world = game.world;
      this.visitors = [];
      this.nextId = 1;
      this.used = { llegada: {}, tocar: {}, despedida: {}, ordenes: {}, cierre: {} };
      this.ordersToday = 0;
      this.coinPlan = Math.random() < 0.5; // esta noche, una cara blanca te va a pedir una moneda
      this.childPlan = Math.random() < 0.3; // esta noche, una cara blanca viene con un niño
      // Horario de la noche: caras blancas entre 01:15 y 02:15 (3 a 5) y quizá una tardía; máscaras a las 02:50 y quizá 04:05.
      var plan = [];
      var n = 3 + Math.floor(Math.random() * 3);
      for (var i = 0; i < n; i += 1) { plan.push({ at: U.rand(76, 135), kind: 'cara' }); }
      if (Math.random() < 0.5) { plan.push({ at: U.rand(282, 300), kind: 'cara' }); }
      plan.push({ at: 170, kind: 'mascara' });
      this.approach = null;
      if (Math.random() < 0.6) { plan.push({ at: 245, kind: 'mascara' }); }
      this.plan = plan.sort(function (a, b) { return a.at - b.at; });
      this.tmp = new THREE.Vector3();
    }

    // -------------------------------------------------------------------------------------------- modelos
    _model(kind) {
      var w = this.world;
      var R = w.retro;
      var m = w.mat;
      var g = new THREE.Group();
      var head;
      var armR;
      var armL;
      var legs;
      // Una articulación (cadera u hombro): lo que cuelga de ella gira con ella.
      function joint(x, y) {
        var j = new THREE.Group();
        j.position.set(x, y, 0);
        g.add(j);
        return j;
      }
      var kid = kind === 'nino';
      if (kind === 'cara' || kid) {
        var coat = R.material({ texture: 'white', color: kid ? 0xc9a43a : COATS[Math.floor(Math.random() * COATS.length)] }); // el niño: impermeable amarillo
        var wet = R.material({ texture: 'white', color: 0x2b2f33 });
        var pale = R.material({ texture: 'white', color: 0xe9e7e0, emissive: 0.3 }); // cuello y manos, tan blancos como la cara
        var shoe = R.material({ texture: 'white', color: 0x17181a });
        // Pantalón empapado y zapatos (cada pierna gira desde la cadera al caminar).
        legs = [-0.09, 0.09].map(function (lx) {
          var hip = joint(lx, 0.74);
          w.box(0.12, 0.66, 0.14, wet, 0, -0.33, 0, hip);
          w.box(0.13, 0.08, 0.21, shoe, 0, -0.7, -0.03, hip);
          return hip;
        });
        // Abrigo largo que se abre hacia abajo (seis caras, como en PS1), con hombros.
        var coatBody = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.27, 0.92, 6), coat);
        coatBody.position.set(0, 1.1, 0);
        coatBody.rotation.y = Math.PI / 6;
        g.add(coatBody);
        w.box(0.46, 0.09, 0.25, coat, 0, 1.56, 0, g);
        // Brazos desde el hombro, con la mano pálida.
        armL = joint(-0.255, 1.55);
        armR = joint(0.255, 1.55);
        [armL, armR].forEach(function (a) {
          w.box(0.09, 0.62, 0.11, coat, 0, -0.31, 0, a);
          w.box(0.07, 0.09, 0.07, pale, 0, -0.665, 0, a);
        });
        if (!kid) {
          var bag = w.box(0.34, 0.3, 0.22, R.material({ texture: 'white', color: 0x7a7d80 }), 0.36, 0.8, -0.05, g); // la ropa empapada
          bag.rotation.z = 0.1;
        }
        var neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.1, 6), pale);
        neck.position.set(0, 1.64, 0);
        g.add(neck);
        // La cabeza: pelo oscuro y mojado; la cara, lisa y blanca, sin rasgos (hacia -z).
        head = w.box(0.2, 0.25, 0.21, wet, 0, 1.8, 0, g);
        var faceMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.21), R.material({ texture: 'white', color: 0xeeece5, emissive: 0.45 }));
        faceMesh.rotation.y = Math.PI;
        faceMesh.position.set(0, -0.015, -0.1065);
        head.add(faceMesh);
      } else {
        var suit = R.material({ texture: 'white', color: 0x15161a });
        var lapel = R.material({ texture: 'white', color: 0x262830 });
        var shirt = R.material({ texture: 'white', color: 0xd9d7d0, emissive: 0.1 });
        var glove = R.material({ texture: 'white', color: 0x0b0b0d });
        legs = [-0.1, 0.1].map(function (lx) {
          var hip = joint(lx, 1.0);
          w.box(0.15, 1.0, 0.17, suit, 0, -0.5, 0, hip);
          return hip;
        });
        w.box(0.5, 0.85, 0.3, suit, 0, 1.42, 0, g);
        w.box(0.58, 0.1, 0.33, suit, 0, 1.82, 0, g);                 // hombreras
        armL = joint(-0.3, 1.8);
        armR = joint(0.3, 1.8);
        [armL, armR].forEach(function (a) {
          w.box(0.09, 0.85, 0.11, suit, 0, -0.425, 0, a);
          w.box(0.09, 0.11, 0.09, glove, 0, -0.89, 0, a);              // guantes
        });
        w.box(0.18, 0.36, 0.02, shirt, 0, 1.63, -0.153, g);          // camisa blanca: la corbata y la máscara contrastan
        w.box(0.05, 0.42, 0.02, R.material({ texture: 'white', color: 0x3a3c42 }), 0, 1.55, -0.166, g); // corbata
        [-1, 1].forEach(function (s) {
          var l = w.box(0.08, 0.36, 0.02, lapel, 0.1 * s, 1.64, -0.158, g); // solapas
          l.rotation.z = 0.28 * s;
        });
        w.box(0.09, 0.1, 0.09, suit, 0, 1.91, 0, g);                 // cuello
        // La máscara: negra, de caras planas (Gouraud por vértice: se ven las facetas).
        head = new THREE.Mesh(new THREE.OctahedronGeometry(0.17, 0), R.material({ texture: 'white', color: 0x0c0c10, emissive: 0.05 }));
        head.scale.set(0.9, 1.2, 0.9);
        head.position.set(0, 2.08, 0);
        g.add(head);
      }
      if (kid) { g.scale.setScalar(0.62); }
      g.visible = true;
      return { group: g, head: head, armR: armR, armL: armL, legs: legs };
    }

    // -------------------------------------------------------------------------------------------- el niño
    /** Un niño de cara blanca acompaña a esta cara blanca: entra con ella y la sigue un paso detrás. */
    _addChild(v) {
      var model = this._model('nino');
      model.group.position.set(ENTRY.x + 0.45, 0, ENTRY.z + 0.35);
      this.world.add(model.group);
      var parts = [];
      model.group.traverse(function (o) { if (o.isMesh) { o.userData.interact = { kind: 'nino', index: v.id }; parts.push(o); } });
      model.parts = parts;
      Array.prototype.push.apply(this.world.interactables, parts);
      var lines = MR.HISTORIA.blackwood.nino.entre;
      v.child = { model: model, bob: 0, petted: false, petTimer: 0, talks: 0, chatTimer: 7, chatIndex: Math.floor(Math.random() * lines.length),
        brain: new MR.Mosca(200 + v.id, { curiosidad: 0.9, miedo: 0.8 }), senseAcc: 0 };
    }

    /**
     * El niño sigue al adulto un paso detrás y a la derecha. Si Pelusa anda cerca y en el piso, va, se agacha y la
     * acaricia (una vez). Mientras el adulto lava, le pregunta cosas bajito; si te acercas, se callan.
     */
    _stepChild(v, dt) {
      var g = this.game;
      var c = v.child;
      var grp = c.model.group;
      var pos = grp.position;
      var a = v.model.group;
      if (c.petTimer > 0) {
        c.petTimer -= dt;
        c.model.armR.rotation.x = 1.1 + Math.sin(c.petTimer * 6) * 0.2; // la mano, sobre el lomo
        c.model.head.rotation.x = -0.35;
        if (c.petTimer <= 0) { c.model.armR.rotation.x = 0; c.model.head.rotation.x = 0; pos.y = 0; }
        return;
      }
      // Su cerebro de mosca: si algo lo asusta (una máscara, él), se queda pegado al abrigo y no va con Pelusa.
      c.senseAcc += dt;
      if (c.senseAcc >= 0.1) { c.senseAcc = 0; this._senseFace(v, grp, c.brain, true); }
      c.brain.pensar(dt);
      var asustado = c.brain.accion() === 'huir';
      var cat = g.gato.mesh.root;
      var catNear = !asustado && v.state === 'llego' && !c.petted && cat.visible && cat.position.y < 0.3 &&
        U.distXZ(cat.position, a.position) < 3.2 && g.gato.state !== 'eriza' && g.gato.state !== 'huye';
      var tx;
      var tz;
      if (catNear) {
        tx = cat.position.x + 0.32;
        tz = cat.position.z + 0.22;
      } else {
        // Un paso detrás y a la derecha del adulto (girado con él).
        var ry = a.rotation.y;
        tx = a.position.x + Math.cos(ry) * 0.45 + Math.sin(ry) * 0.35;
        tz = a.position.z - Math.sin(ry) * 0.45 + Math.cos(ry) * 0.35;
      }
      var dx = tx - pos.x;
      var dz = tz - pos.z;
      var d = Math.hypot(dx, dz);
      if (d > 0.06) {
        var stepLen = Math.min(d, SPEED * 1.2 * dt);
        pos.x += dx / d * stepLen;
        pos.z += dz / d * stepLen;
        grp.rotation.y = Math.atan2(-dx, -dz);
        c.bob += dt * 9;
        pos.y = Math.abs(Math.sin(c.bob)) * 0.02;
        this._limbs(c.model, c.bob, 0.5);
        return;
      }
      pos.y = 0;
      this._limbs(c.model, 0, 0);
      if (catNear) {
        c.petted = true;
        c.petTimer = 7;
        grp.rotation.y = Math.atan2(-(cat.position.x - pos.x), -(cat.position.z - pos.z));
        pos.y = -0.05; // agachado
        g.ui.subtitle('(El niño de cara blanca se agacha y acaricia a Pelusa. Pelusa ronronea.)', 5);
        g.audio.ronroneo();
        if (g.gato.brain) { g.gato.brain.recompensa(0.6); } // a Pelusa también le gusta
        g.gato.route = [];
        g.gato.state = 'sentado';
        g.gato.timer = Math.max(g.gato.timer, 7);
        return;
      }
      grp.rotation.y = a.rotation.y;
      var at = c.brain.atencion(); // la cabeza, hacia lo que le llama la atención (Pelusa, sobre todo)
      var mira = at.fuerza > 0.12 ? U.clamp(at.angulo, -1.0, 1.0) : 0;
      c.model.head.rotation.y += (mira - c.model.head.rotation.y) * Math.min(1, dt * 3);
      // Mientras el adulto lava: preguntas bajitas (si estás cerca de alguno de los dos, se callan).
      if (v.state !== 'llego' || v.talking) { return; }
      var near = U.distXZ(g.player.pos, pos) < 2.2 || U.distXZ(g.player.pos, a.position) < 2.2;
      if (near) { c.chatTimer = Math.max(c.chatTimer, 4); return; }
      c.chatTimer -= dt;
      if (c.chatTimer > 0) { return; }
      c.chatTimer = 10;
      var lines = MR.HISTORIA.blackwood.nino.entre;
      var ex = lines[c.chatIndex % lines.length];
      c.chatIndex += 1;
      var self = this;
      g.ui.subtitle(MR.tf('(El niño, bajito: «{l}»)', { l: MR.t(ex[0]) }), 4);
      g.audio.speak(ex[0], 'cara');
      setTimeout(function () {
        if (g.state !== 'playing' || !self.visitors.includes(v) || v.talking) { return; }
        g.ui.subtitle(MR.tf('(La cara blanca, al niño: «{l}»)', { l: MR.t(ex[1]) }), 4);
        g.audio.speak(ex[1], 'cara');
      }, 3400);
    }

    /** Hablarle al niño: la primera vez se esconde detrás del abrigo; después te dice algo, sin mirarte. */
    touchChild(id) {
      var g = this.game;
      var v = this.visitors.filter(function (x) { return x.id === id; })[0];
      if (!v || !v.child) { return; }
      var c = v.child;
      c.talks += 1;
      if (c.talks === 1) {
        g.gameplay.say('nino', '(El niño se esconde detrás del abrigo. Solo asoma la cara, lisa y blanca.)', 4);
        return;
      }
      var lines = MR.HISTORIA.blackwood.nino.al_empleado;
      var l = lines[(c.talks - 2) % lines.length];
      g.gameplay.say('nino', MR.tf('(El niño, sin mirarte: «{l}»)', { l: MR.t(l) }), 4);
      g.audio.speak(l, 'cara');
    }

    // -------------------------------------------------------------------------------------------- cerebro de mosca
    /** La cara blanca piensa (10 Hz) y devuelve hacia dónde mirar. Un susto: se le levantan las manos un instante. */
    _mindLook(v, dt) {
      var b = v.brain;
      if (!b) { return 0; }
      v.senseAcc = (v.senseAcc || 0) + dt;
      if (v.senseAcc >= 0.1) { v.senseAcc = 0; this._senseFace(v, v.model.group, b, false); }
      b.pensar(dt);
      if (b.s.amenaza > 0.5) {
        if (!v.startled) { v.startled = true; v.flinch = 0.7; }
      } else {
        v.startled = false;
      }
      if (v.flinch > 0) {
        v.flinch = Math.max(0, v.flinch - dt);
        var f = Math.sin(v.flinch / 0.7 * Math.PI) * 0.6;
        v.model.armL.rotation.x = f;
        v.model.armR.rotation.x = f;
      }
      // Apenas se balancea al esperar (más si está inquieta).
      v.model.group.rotation.z = Math.sin(v.timer * 1.3) * 0.02 * (0.3 + b.impulso('explorar'));
      var at = b.atencion();
      return at.fuerza > 0.12 ? U.clamp(at.angulo, -1.0, 1.0) : 0;
    }

    /** Lo que ve una cara blanca (o el niño): Pelusa, el niño o su adulto, su ropa, el autobús, las amenazas. A ti, nunca. */
    _senseFace(v, grp, b, esNino) {
      var g = this.game;
      var CTX = MR.Mosca.CTX;
      var me = grp.position;
      var yaw = grp.rotation.y;
      b.limpiar();
      function ver(p, fuerza, ctx) {
        var dx = p.x - me.x;
        var dz = p.z - me.z;
        var d = Math.hypot(dx, dz);
        if (d > 9) { return; }
        b.estimulo(Math.atan2(-dx, -dz) - yaw, fuerza / (1 + d * 0.4)); // su cara va en -z
        if (ctx !== undefined && d < 4) { b.contexto(ctx, 1 - d / 4); }
      }
      var cat = g.gato && g.gato.mesh.root;
      if (cat && cat.visible) { ver(cat.position, esNino ? 1.0 : 0.8, CTX.gato); }
      if (esNino) { ver(v.model.group.position, 0.7, CTX.cara); } else if (v.child) { ver(v.child.model.group.position, 0.9, CTX.nino); }
      if (!esNino && v.washer !== null && v.washer !== undefined) { ver({ x: -6.75 + v.washer, z: -4.1 }, 0.35, CTX.lavadora); }
      var bus = g.ciudad && g.ciudad.bus;
      if (bus && bus.active && bus.phase === 'parado') { ver({ x: bus.x, z: 10.3 }, 0.6, CTX.vidriera); }
      var amenaza = 0;
      this.visitors.forEach(function (o) {
        if (o.kind !== 'mascara') { return; }
        ver(o.model.group.position, 0.7, CTX.mascara);
        amenaza = Math.max(amenaza, 1 - U.distXZ(o.model.group.position, me) / 4);
      });
      if (g.horror.customer.present) {
        var cp = this.world.customer.group.position;
        ver(cp, 0.9, CTX.el);
        amenaza = Math.max(amenaza, 1 - U.distXZ(cp, me) / 5);
      }
      if (U.distXZ(g.player.pos, me) < 4) { ver(g.player.pos, -0.9, CTX.jugador); } // tu dirección les repele la atención
      // Lo que oyen: voltean hacia donde sonó algo; si sonó muy cerca, se sobresaltan.
      (g.sonidos || []).forEach(function (s) {
        var k = s.t / 0.8;
        var d = Math.hypot(s.x - me.x, s.z - me.z);
        if (d < 14) { b.estimulo(Math.atan2(-(s.x - me.x), -(s.z - me.z)) - yaw, s.f * 2.0 * k / (1 + d * 0.2)); }
        if (d < 3) { amenaza = Math.max(amenaza, 0.6 * s.f * k); }
      });
      b.sentir({ amenaza: Math.min(1, Math.max(0, amenaza) + (g.horror.flash > 0.3 ? 0.6 : 0)), ruido: Math.min(1, g.dread), sueno: 0.1 });
    }

    /** Brazos y piernas al caminar (amp 0 = quietos). Las máscaras caminan más rígidas. */
    _limbs(model, phase, amp) {
      var s = Math.sin(phase) * amp;
      model.legs[0].rotation.x = s;
      model.legs[1].rotation.x = -s;
      model.armL.rotation.x = -s * 0.8;
      model.armR.rotation.x = s * 0.8;
    }

    // -------------------------------------------------------------------------------------------- afuera
    /** Una cara blanca cruza la avenida hacia la puerta, sin paraguas (la ves por la vidriera). */
    _startApproach(start) {
      var m = this._model('cara');
      var from = start || [U.rand(3.8, 7.2), 11.9];
      m.group.position.set(from[0], 0.12, from[1]);
      this.world.add(m.group);
      this.approach = { model: m, to: [0.4, 5.5] };
    }

    _stepApproach(dt, inSala) {
      var a = this.approach;
      var pos = a.model.group.position;
      var dx = a.to[0] - pos.x;
      var dz = a.to[1] - pos.z;
      var d = Math.hypot(dx, dz);
      var step = 1.1 * dt;
      if (d <= step || !inSala) {
        this.world.scene.remove(a.model.group);
        this.approach = null;
        this.spawn('cara'); // entra (si no hay lavadora libre, hoy no vino)
        if (this.approachNext) { var nx = this.approachNext; this.approachNext = null; this._startApproach(nx); } // la que venía detrás
        return;
      }
      pos.x += dx / d * step;
      pos.z += dz / d * step;
      a.model.group.rotation.y = Math.atan2(-dx, -dz);
      a.bob = (a.bob || 0) + dt * 7;
      pos.y = 0.12 + Math.abs(Math.sin(a.bob)) * 0.03;
      this._limbs(a.model, a.bob, 0.42);
    }

    /**
     * Del autobús 86 bajan caras blancas (ciudad.js): la siguiente que iba a venir, si falta poco, y a veces otra con
     * ella. Bajan por la puerta de adelante y cruzan por delante del autobús.
     */
    fromBus(busX) {
      var g = this.game;
      if (this.approach || this.visitors.length || g.epilogue) { return false; }
      var i = -1;
      for (var k = 0; k < this.plan.length; k += 1) {
        if (this.plan[k].kind === 'cara' && this.plan[k].at - g.minutes < 35) { i = k; break; }
      }
      if (i < 0) { return false; }
      this.plan.splice(i, 1);
      var door = [busX - 4.0, 11.3];
      this._startApproach(door);
      if (!this.busRiders || Math.random() < 0.6) { this.approachNext = [door[0] + 0.3, 11.5]; } // en el primer 86, siempre dos
      this.busRiders = (this.busRiders || 0) + 1;
      return true;
    }

    /**
     * Dos caras blancas lavando a la vez murmuran entre ellas (una frase y la respuesta, cada ~8 s). Si te acercas a
     * menos de 2,2 m, se callan; cuando te alejas, siguen.
     */
    _chatter(dt) {
      var g = this.game;
      var pair = this.visitors.filter(function (v) { return v.kind === 'cara' && v.state === 'llego' && !v.talking; });
      if (pair.length < 2) { this.chatTimer = 3; return; }
      var near = pair.some(function (v) { return U.distXZ(g.player.pos, v.model.group.position) < 2.2; });
      if (near) {
        if (!this.hushSaid) { this.hushSaid = true; g.ui.subtitle('(Las dos caras blancas se callan cuando te acercas.)', 4); }
        this.chatTimer = Math.max(this.chatTimer, 4);
        return;
      }
      this.chatTimer -= dt;
      if (this.chatTimer > 0) { return; }
      this.chatTimer = 8;
      var lines = MR.HISTORIA.blackwood.entre;
      if (this.chatIndex === undefined) { this.chatIndex = Math.floor(Math.random() * lines.length); }
      var n = this.chatIndex % lines.length;
      this.chatIndex += 1;
      var ex = lines[n];
      var self = this;
      g.ui.subtitle(MR.tf('(Una cara blanca, a la otra: «{l}»)', { l: MR.t(ex[0]) }), 4);
      g.audio.speak(ex[0], 'cara');
      if (g.archivo) { g.archivo.overheard(n); }
      setTimeout(function () {
        if (g.state !== 'playing' || pair.some(function (v) { return !self.visitors.includes(v) || v.talking; })) { return; }
        g.ui.subtitle(MR.tf('(La otra: «{l}»)', { l: MR.t(ex[1]) }), 4);
        g.audio.speak(ex[1], 'cara');
      }, 3600);
    }

    /** La despedida: la cara blanca que lavó su ropa levanta la mano desde la vereda de enfrente (8 s). */
    _wave() {
      var g = this.game;
      if (g.bosque.outside || g.pasillo.inside) { return; }
      if (!this.waver) {
        this.waver = this._model('cara');
        this.waver.armR.rotation.z = Math.PI; // el brazo, arriba (gira desde el hombro)
        this.world.add(this.waver.group);
      }
      this.waver.group.position.set(U.rand(3.8, 7.0), 0.12, 12.0);
      this.waver.group.rotation.y = 0;
      this.waver.group.visible = true;
      this.waveTimer = 8;
      this.watcherNoticed = true;
      g.ui.subtitle('(Del otro lado de la avenida, la cara blanca levanta la mano. Se está despidiendo.)', 5);
    }

    /** La vigía: una cara blanca parada en la vereda de enfrente, mirando la lavandería (horror.js la hace aparecer). */
    showWatcher() {
      if (!this.watcher) {
        this.watcher = this._model('cara');
        this.watcher.group.position.set(5.2, 0.12, 12.0);
        this.watcher.group.rotation.y = 0;
        this.world.add(this.watcher.group);
      }
      this.watcher.group.visible = true;
      this.watcherSeen = null;
    }

    _stepWatcher(inSala) {
      var w = this.watcher;
      if (!w || !w.group.visible) { return; }
      var g = this.game;
      var h = g.horror;
      var seen = inSala && h.zoneVisible('vidriera') > 0.3 && !g.player.eyesClosed;
      if (seen && this.watcherSeen === null) {
        this.watcherSeen = h.clock;
        this.watcherNoticed = true;
        g.ui.subtitle('(Del otro lado de la avenida, alguien de cara blanca mira hacia la lavandería. No trae paraguas.)', 6);
        g.dread = Math.min(1, g.dread + 0.04);
      }
      if (this.watcherSeen !== null && !seen) {
        this.watcherAway = (this.watcherAway || 0) + 1;
        if (this.watcherAway > 75 || g.player.eyesClosed) { w.group.visible = false; } // ya no está
      } else {
        this.watcherAway = 0;
      }
    }

    // -------------------------------------------------------------------------------------------- llegada
    /** Un visitante entra por la puerta de vidrio. kind: 'cara' | 'mascara'. Devuelve el visitante (o null). */
    spawn(kind) {
      var g = this.game;
      var target;
      if (kind === 'cara') {
        var taken = this.visitors.map(function (v) { return v.washer; });
        var free = g.gameplay.washers.map(function (wa, i) { return i; }).filter(function (i) {
          var wa = g.gameplay.washers[i];
          return !wa.running && !wa.credit && wa.doorTarget <= 0.5 && taken.indexOf(i) < 0; // nunca la que tú ya preparaste
        });
        if (!free.length) { return null; }
        var wi = free[Math.floor(Math.random() * free.length)];
        var wx = -6.75 + wi;
        target = { path: [[0.4, 1.8], [0.4, -3.2], [wx, -3.35]], rot: 0, washer: wi };
      } else {
        target = { path: [[1.2, 3.8], [3.4, 3.5], [5.9, 3.1]], rot: 0, washer: null };
      }
      var model = this._model(kind);
      model.group.position.set(ENTRY.x, 0, ENTRY.z);
      this.world.add(model.group);
      var id = this.nextId++;
      // Todas sus piezas se pueden tocar (también las que cuelgan de una articulación: brazos y piernas).
      var parts = [];
      model.group.traverse(function (o) { if (o.isMesh) { o.userData.interact = { kind: 'visitante', index: id }; parts.push(o); } });
      model.parts = parts;
      Array.prototype.push.apply(this.world.interactables, parts);
      var v = { id: id, kind: kind, model: model, path: target.path.slice(), rot: target.rot, washer: target.washer, state: 'entra', timer: 0, said: false };
      // Las caras blancas llevan cerebro de mosca (las máscaras no: obedecen órdenes).
      if (kind === 'cara') { v.brain = new MR.Mosca(100 + id, { curiosidad: 0.5, miedo: 0.6 }); }
      this.visitors.push(v);
      if (kind === 'cara' && this.childPlan && !this.childCame && g.minutes >= 90) { this.childCame = true; this._addChild(v); }
      g.audio.door();
      return v;
    }

    _remove(v) {
      var w = this.world;
      w.scene.remove(v.model.group);
      if (v.child) {
        var cp = v.child.model.parts;
        w.scene.remove(v.child.model.group);
        for (var k = w.interactables.length - 1; k >= 0; k -= 1) { if (cp.indexOf(w.interactables[k]) >= 0) { w.interactables.splice(k, 1); } }
      }
      for (var i = w.interactables.length - 1; i >= 0; i -= 1) {
        if (v.model.parts.indexOf(w.interactables[i]) >= 0) { w.interactables.splice(i, 1); }
      }
      this.visitors = this.visitors.filter(function (x) { return x !== v; });
    }

    _line(key) {
      var lines = key === 'cierre' ? MR.HISTORIA.blackwood.charla.cierre : MR.HISTORIA.blackwood[key];
      var used = this.used[key];
      var free = lines.map(function (l, i) { return i; }).filter(function (i) { return !used[i]; });
      if (!free.length) { this.used[key] = used = {}; free = lines.map(function (l, i) { return i; }); }
      var i = free[Math.floor(Math.random() * free.length)];
      used[i] = true;
      return { text: lines[i], index: i };
    }

    _say(v, key) {
      var g = this.game;
      var l = this._line(key);
      g.ui.subtitle(MR.tf('(Una cara blanca, bajito: «{l}»)', { l: MR.t(l.text) }), 6);
      g.audio.speak(l.text, 'cara');
    }

    /** Hablarle a un visitante (tocarlo). */
    talk(id) {
      var g = this.game;
      var v = this.visitors.filter(function (x) { return x.id === id; })[0];
      if (!v) { return; }
      if (v.kind === 'mascara') {
        g.gameplay.say('mascara', '(No dice nada. La máscara refleja la luz del techo en cada una de sus caras.)', 4);
        return;
      }
      if (v.talked) { g.gameplay.say('cara' + id, '(Ya no te responde. Mira el tambor girar.)', 3); return; }
      if (v.state !== 'llego') { this._say(v, 'tocar'); v.talked = true; return; } // de paso: solo un murmullo
      var questions = this._extraQuestions(v).concat(MR.HISTORIA.blackwood.charla.preguntas);
      if (this.coinPlan && !this.coinAsked && g.minutes >= 100) { this._askCoin(v, questions); return; }
      this._converse(v, questions);
    }

    /**
     * «¿Tienes una moneda?»: si se la das, una secadora arranca sola al rato y te deja una de las suyas (la moneda
     * extranjera de la colección: de ningún país que conozcas). Después sigue la charla de siempre.
     */
    _askCoin(v, questions) {
      var g = this.game;
      var self = this;
      var M = MR.HISTORIA.blackwood.charla.moneda;
      this.coinAsked = true;
      v.talking = true;
      g.audio.speak(M.pide, 'cara');
      g.openDialog(MR.tf('Una cara blanca, sin mirarte: «{l}»', { l: MR.t(M.pide) }), ['(Darle una moneda.)', '(No tengo.)'], function (n) {
        if (!self.visitors.includes(v)) { self._endTalk(v); return; }
        var gp = g.gameplay;
        if (n === 1 && gp.coins > 0) {
          gp.coins -= 1;
          g.audio.coin();
          g.ui.subtitle('(Le das una moneda. La toma sin tocarte la mano.)', 3);
          setTimeout(function () {
            if (g.state !== 'playing') { return; }
            var free = -1;
            gp.dryers.forEach(function (d, i) { if (free < 0 && !d.running) { free = i; } });
            if (free >= 0) { gp.startDryer(free); }
            g.ui.subtitle(MR.tf('(Una cara blanca, bajito: «{l}»)', { l: MR.t(M.gracias) }), 5);
            g.audio.speak(M.gracias, 'cara');
            g.objetos.give('moneda', '(Te da algo frío y pesado: {n}. {d})');
            setTimeout(function () { if (v.talking && g.state === 'playing') { self._converse(v, questions); } }, 3500);
          }, 2400);
          return;
        }
        if (n === 1) { g.ui.subtitle('(Buscas en los bolsillos. No te queda ninguna.)', 3); }
        setTimeout(function () {
          if (g.state !== 'playing') { return; }
          g.ui.subtitle(MR.tf('(Una cara blanca, bajito: «{l}»)', { l: MR.t(M.nada) }), 5);
          g.audio.speak(M.nada, 'cara');
          setTimeout(function () { if (v.talking && g.state === 'playing') { self._converse(v, questions); } }, 3500);
        }, n === 1 ? 1500 : 200);
      });
    }

    /**
     * Lo que esta cara blanca sabe de tu noche: Pelusa se sentó a su lado, viste a la vigía (o la despedida), tienes la
     * placa del puente, alguna vez viste la mañana. Como mucho dos, para que la lista quepa en el celular.
     */
    _extraQuestions(v) {
      var g = this.game;
      var ok = {
        pelusa: !!v.catSat,
        vigia: !!this.watcherNoticed,
        placa: !!(g.objetos && g.objetos.got.placa),
        manana: !!(g.historial && g.historial.d.finales && g.historial.d.finales.verdadero)
      };
      return MR.HISTORIA.blackwood.charla.extra.filter(function (q) { return ok[q[0]]; }).slice(0, 2);
    }

    /** Conversación: eliges una pregunta; responde, y puedes seguir preguntando (o dejarla en paz). */
    _converse(v, left) {
      var g = this.game;
      var self = this;
      var options = left.map(function (q) { return q[1]; }).concat(['(Dejarla en paz.)']);
      v.talking = true;
      g.openDialog(MR.t('Una cara blanca, sin mirarte:'), options, function (n) {
        if (n > left.length || !self.visitors.includes(v)) { self._endTalk(v); return; }
        var q = left[n - 1];
        var answers = MR.HISTORIA.blackwood.charla[q[0]];
        var i = Math.floor(Math.random() * answers.length);
        g.ui.subtitle(MR.tf('(Una cara blanca, bajito: «{l}»)', { l: MR.t(answers[i]) }), 7);
        g.audio.speak(answers[i], 'cara');
        if (g.archivo) { g.archivo.chat(q[0] + i); }
        var rest = left.filter(function (x) { return x !== q; });
        if (!rest.length) { setTimeout(function () { self._endTalk(v); }, 3500); return; }
        setTimeout(function () { if (v.talking && g.state === 'playing') { self._converse(v, rest); } }, 3500);
      });
    }

    _endTalk(v) {
      var g = this.game;
      v.talking = false;
      v.talked = true;
      g.closeDialog();
      if (this.visitors.includes(v)) {
        var l = this._line('cierre');
        g.ui.subtitle(MR.tf('(Una cara blanca, bajito: «{l}»)', { l: MR.t(l.text) }), 5);
        g.audio.speak(l.text, 'cara');
      }
    }

    // -------------------------------------------------------------------------------------------- cada cuadro
    update(dt) {
      var g = this.game;
      var inSala = !g.bosque.outside && !g.pasillo.inside;
      // Llegadas programadas (solo si estás en la sala: si no, esperan a que vuelvas).
      // Después de tocar la campana: una máscara viene a dejar la orden de la campana sumergida.
      if (this.pendingOrder !== undefined && this.pendingOrder !== null && inSala && this.visitors.length < 2) {
        var forced = this.spawn('mascara');
        if (forced) { forced.forcedOrder = this.pendingOrder; this.pendingOrder = null; }
      }
      while (this.plan.length && g.minutes >= this.plan[0].at && inSala && this.visitors.length < 2 && !this.approach) {
        var p = this.plan.shift();
        // Las caras blancas primero cruzan la avenida (se ven por la vidriera) y después entran.
        if (p.kind === 'cara') { this._startApproach(); } else { this.spawn(p.kind); }
      }
      if (this.approach) { this._stepApproach(dt, inSala); }
      if (this.waver && this.waver.group.visible) {
        this.waveTimer -= dt;
        if (this.waveTimer <= 0 || !inSala) { this.waver.group.visible = false; }
      }
      this._stepWatcher(inSala);
      if (inSala) { this._chatter(dt); }
      var self = this;
      this.visitors.slice().forEach(function (v) {
        self._step(v, dt);
        if (v.child && self.visitors.includes(v)) { self._stepChild(v, dt); }
      });
    }

    _step(v, dt) {
      var g = this.game;
      var grp = v.model.group;
      var pos = grp.position;
      if (v.state === 'entra' || v.state === 'sale') {
        var tgt = v.path[0];
        if (!tgt) {
          if (v.state === 'sale') {
            g.audio.door();
            this._remove(v);
            if (v.kind === 'cara' && Math.random() < 0.5) { this._wave(); } // a veces se despide desde la otra vereda
            return;
          }
          v.state = 'llego';
          v.timer = 0;
          grp.rotation.y = v.rot;
          this._limbs(v.model, 0, 0); // llega y se queda quieto (no a media zancada)
          this._arrive(v);
          return;
        }
        var dx = tgt[0] - pos.x;
        var dz = tgt[1] - pos.z;
        var d = Math.hypot(dx, dz);
        // Si estás en su camino, espera (nunca te empuja ni te atraviesa).
        var pp = g.player.pos;
        var ahead = Math.hypot(pp.x - (pos.x + dx / Math.max(d, 0.01) * 0.5), pp.z - (pos.z + dz / Math.max(d, 0.01) * 0.5));
        if (ahead < 0.55) { this._limbs(v.model, 0, 0); return; }
        var stepLen = SPEED * dt;
        if (d <= stepLen) { pos.set(tgt[0], 0, tgt[1]); v.path.shift(); }
        else { pos.x += dx / d * stepLen; pos.z += dz / d * stepLen; }
        grp.rotation.y = Math.atan2(-dx, -dz);
        v.bob = (v.bob || 0) + dt * 7;
        pos.y = Math.abs(Math.sin(v.bob)) * 0.03;
        this._limbs(v.model, v.bob, v.kind === 'cara' ? 0.42 : 0.16);
      } else if (v.state === 'llego') {
        v.timer += dt;
        this._limbs(v.model, 0, 0);
        if (v.kind === 'cara') {
          // Nunca te mira: si lo miras de cerca, gira la cara hacia otro lado. Si no, mira hacia donde atiende su
          // cerebro de mosca (Pelusa, el niño, su ropa girando, el autobús), nunca hacia ti.
          var lookAt = this._watched(v);
          var mira = lookAt ? 1.1 : this._mindLook(v, dt);
          v.model.head.rotation.y += (mira - v.model.head.rotation.y) * Math.min(1, dt * 3);
          if (v.timer > 2.5 && !v.loaded) {
            v.loaded = true;
            var wa = g.gameplay.washers[v.washer];
            // En la noche sin agua, la máquina tampoco arranca para ellos.
            if (!wa.running && g.mod !== 'sin_agua') { wa.running = true; wa.credit = false; wa.remaining = MR.Config.WASHER_CYCLE_MIN; g.audio.buzz(); }
          }
          // Mientras conversa contigo no se va; si te alejas, la conversación termina.
          if (v.talking) {
            if (U.distXZ(g.player.pos, v.model.group.position) > 4) { this._endTalk(v); }
          } else if (v.timer > 22) { this._leave(v); } // espera el centrifugado (como dicen ellas)
        } else if (v.timer > 6) {
          this._leave(v);
        }
      }
    }

    _watched(v) {
      var g = this.game;
      var h = this.tmp.copy(v.model.group.position);
      h.y = 1.7;
      if (U.distXZ(g.player.pos, h) > 3) { return false; }
      h.project(g.player.camera);
      return Math.abs(h.x) < 0.35 && Math.abs(h.y) < 0.45 && h.z < 1;
    }

    _arrive(v) {
      var g = this.game;
      if (v.kind === 'cara') {
        this._say(v, 'llegada');
      } else {
        // La impresora entrega una orden de la Administración del Embalse.
        var l = v.forcedOrder !== undefined ? { text: MR.HISTORIA.blackwood.ordenes[v.forcedOrder], index: v.forcedOrder } : this._line('ordenes');
        this.ordersToday += 1;
        g.gameplay.printReceipt();
        if (g.archivo) { g.archivo.order(l.index); }
        setTimeout(function () {
          if (g.state === 'playing') { g.ui.subtitle(MR.tf('[La impresora térmica imprime] {l}', { l: MR.t(l.text) }), 8); }
        }, 900);
        // La segunda máscara de la noche deja, además, una caja sobre el mostrador.
        if (this.ordersToday === 2 && !this.boxGiven) {
          this.boxGiven = true;
          this.world.giftBox.visible = true;
          setTimeout(function () {
            if (g.state === 'playing') { g.ui.subtitle('(Antes de irse, deja una caja de cartón sobre el mostrador.)', 5); }
          }, 4000);
        }
      }
    }

    _leave(v) {
      v.state = 'sale';
      v.model.head.rotation.y = 0;
      v.path = v.kind === 'cara' ? [[0.4, -3.2], [0.4, 1.8], [ENTRY.x, ENTRY.z], [0, 5.3]] : [[3.4, 3.5], [1.2, 3.8], [ENTRY.x, ENTRY.z], [0, 5.3]];
      if (v.kind === 'cara' && Math.random() < 0.6) { this._say(v, 'despedida'); }
    }
  }

  MR.Clientela = Clientela;
})(window.MR = window.MR || {});
