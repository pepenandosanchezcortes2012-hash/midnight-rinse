/**
 * Clientela de Blackwood (canon §7): la gente del pueblo bajo el embalse que viene de noche a la lavandería.
 * - Caras blancas: entran por la puerta de vidrio, ponen a lavar su ropa empapada en una lavadora libre (que de verdad
 *   arranca: su ruido tapa el zumbido), murmuran algo y se van. Nunca te miran: si los miras de cerca, giran la cara.
 *   Hablarles (tocarlos) da una respuesta. Llegan entre 01:15 y 02:15, y alguna después de las 04:40.
 * - Máscaras negras (la Administración del Embalse): a las 02:50 (y a veces a las 04:05) uno se para frente al mostrador
 *   sin hablar; la impresora térmica entrega una ORDEN numerada, que queda en el Archivo.
 * Nada de esto es un susto: es vida rara. Diálogos en MR.HISTORIA.blackwood (borrador de Gemini, revisado).
 *
 * Cómo se mueven y deciden (director de IA, src/core/director.js): caminan por fuerzas de dirección, con inercia, paso
 * pesado y rodeando lo que estorba (nada de ir en línea recta de un punto a otro); si les bloqueas el paso, se detienen a
 * un metro, ladean la cabeza y esperan. Si los miras de golpe, se quedan inmóviles de 3 a 5 s antes de seguir. Si te
 * acercas demasiado, dejan de respirar. Las caras blancas, mientras esperan su lavado, eligen por utilidad una rutina
 * (mirar el tambor, doblar una prenda que no está, contar monedas) o se corren al borde de tu vista, y solo cambian de
 * pose cuando no las miras de frente. Las máscaras siguen tu cara con el cuello y, un segundo después, con la máscara; a
 * veces vienen dos (una vigila la puerta de vidrio) y, si la puerta trasera ya está abierta, se van por ahí.
 */
(function (MR) {
  'use strict';

  var U = MR.Util;
  var D = MR.Director;
  var SPEED = 0.95;
  var COATS = [0x8a7f62, 0x5f6366, 0x2f3a4a, 0x4f5a45, 0x6b4f4a];
  var ENTRY = { x: 0.4, z: 4.35 };
  var SALA = { minX: -8, maxX: 8, minZ: -5, maxZ: 5 };
  var VIGIA = [1.7, 3.3];                  // donde espera la máscara que vigila la puerta de vidrio
  var PUERTA_TRASERA = [6.8, -4.6];
  var FUERA = { nivel: 'fuera', oculto: true, distancia: 99, angulo: Math.PI, lado: 1 }; // estás en el bosque o el pasillo
  function azar() { return Math.random(); } // (las pruebas reemplazan Math.random)

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
      plan.push({ at: 170, kind: 'mascara', par: Math.random() < 0.35 }); // a veces vienen dos
      this.approach = null;
      if (Math.random() < 0.6) { plan.push({ at: 245, kind: 'mascara', par: Math.random() < 0.5 }); }
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
      var chest;
      var neck = null;
      var finger = null;
      g.rotation.order = 'YXZ'; // inclinarse hacia adelante es hacia donde mira, no hacia −z del mundo
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
        chest = coatBody;
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
          // El índice, largo y anguloso (dos falanges en ángulo): solo se ve cuando señala.
          finger = new THREE.Group();
          finger.position.set(0, -0.71, -0.01);
          var f1 = w.box(0.022, 0.1, 0.022, pale, 0, -0.05, 0, finger);
          f1.rotation.x = 0.25;
          var f2 = w.box(0.018, 0.08, 0.018, pale, 0, -0.13, -0.045, finger);
          f2.rotation.x = 0.75;
          finger.visible = false;
          armR.add(finger);
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
        var faceMesh = null;
        var suit = R.material({ texture: 'white', color: 0x15161a });
        var lapel = R.material({ texture: 'white', color: 0x262830 });
        var shirt = R.material({ texture: 'white', color: 0xd9d7d0, emissive: 0.1 });
        var glove = R.material({ texture: 'white', color: 0x0b0b0d });
        legs = [-0.1, 0.1].map(function (lx) {
          var hip = joint(lx, 1.0);
          w.box(0.15, 1.0, 0.17, suit, 0, -0.5, 0, hip);
          return hip;
        });
        chest = w.box(0.5, 0.85, 0.3, suit, 0, 1.42, 0, g);
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
        // El cuello gira solo (sigue tu cara despacio); la máscara gira sobre él, un segundo después.
        neck = new THREE.Group();
        neck.position.set(0, 1.86, 0);
        g.add(neck);
        w.box(0.09, 0.1, 0.09, suit, 0, 0.05, 0, neck);              // cuello
        // La máscara: negra, de caras planas (Gouraud por vértice: se ven las facetas).
        head = new THREE.Mesh(new THREE.OctahedronGeometry(0.17, 0), R.material({ texture: 'white', color: 0x0c0c10, emissive: 0.05 }));
        head.scale.set(0.9, 1.2, 0.9);
        head.position.set(0, 0.22, 0);
        neck.add(head);
      }
      if (kid) { g.scale.setScalar(0.62); }
      g.visible = true;
      return { group: g, head: head, armR: armR, armL: armL, legs: legs, face: faceMesh, chest: chest, neck: neck, finger: finger };
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
        brain: new MR.Mosca(200 + v.id, { curiosidad: 0.9, miedo: 0.8 }), senseAcc: 0,
        agente: new D.Agente({ x: ENTRY.x + 0.45, z: ENTRY.z + 0.35, velMax: SPEED * 1.2, aceleracion: 1.8, frenado: 2.4, radio: 0.16,
          zancada: 0.8, rnd: azar }),
        respira: new D.Respiracion(azar, { ritmo: 2.1 }) };
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
      // Camina por fuerzas (rodea lo que estorba, con inercia), sin chocar con su adulto ni con nadie más.
      var ag = c.agente;
      var fin = ag.ruta && ag.ruta[ag.ruta.length - 1];
      if (!fin || Math.hypot(fin[0] - tx, fin[1] - tz) > 0.05) { ag.ponerRuta([[tx, tz]]); }
      if (!ag.llego) {
        ag.paso(dt, this._mundo(v.child, v));
        pos.x = ag.x;
        pos.z = ag.z;
        if (!ag.llego) {
          grp.rotation.y = ag.rumbo;
          var marcha = Math.min(1, ag.v / ag.velMax);
          pos.y = Math.abs(Math.sin(ag.fase)) * 0.02 * marcha;
          this._limbs(c.model, ag.fase, 0.5 * marcha);
          return;
        }
      }
      var resp = c.respira.actualizar(dt, U.distXZ(g.player.pos, pos));
      c.model.chest.scale.set(1 + resp.pecho * 0.02, 1, 1 + resp.pecho * 0.03);
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
      grp.rotation.y += D.envolver(a.rotation.y - grp.rotation.y) * Math.min(1, dt * 3); // se da vuelta de a poco, como su adulto
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
      // Apenas se balancea al esperar (más si está inquieta; nada si estás tan cerca que contiene el aire).
      v.model.group.rotation.z = Math.sin(v.timer * 1.3) * 0.02 * (0.3 + b.impulso('explorar')) * (v.respira ? v.respira.micro : 1);
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
    /**
     * Un visitante entra por la puerta de vidrio. kind: 'cara' | 'mascara'. Devuelve el visitante (o null).
     * o (máscaras): { rol: 'vigia' (se queda vigilando la puerta), demora (s antes de echar a andar), mudo (sin puerta) }.
     */
    spawn(kind, o) {
      o = o || {};
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
      } else if (o.rol === 'vigia') {
        // Se para junto a la puerta de vidrio, de cara a la sala.
        target = { path: [[1.4, 3.85], VIGIA], rot: D.rumbo(-VIGIA[0], -VIGIA[1]), washer: null };
      } else {
        target = { path: [[1.2, 3.8], [3.4, 3.5], [5.9, 3.1]], rot: 0, washer: null };
      }
      var model = this._model(kind);
      var sx = ENTRY.x + (o.rol === 'vigia' ? 0.45 : 0);
      model.group.position.set(sx, 0, ENTRY.z);
      this.world.add(model.group);
      var id = this.nextId++;
      // Todas sus piezas se pueden tocar (también las que cuelgan de una articulación: brazos y piernas).
      var parts = [];
      model.group.traverse(function (m) { if (m.isMesh) { m.userData.interact = { kind: 'visitante', index: id }; parts.push(m); } });
      model.parts = parts;
      Array.prototype.push.apply(this.world.interactables, parts);
      var v = { id: id, kind: kind, model: model, rot: target.rot, washer: target.washer, state: 'entra', timer: 0, said: false,
        rol: o.rol || (kind === 'cara' ? 'cliente' : 'operador'), demora: o.demora || 0 };
      // Director de IA: navegación por fuerzas, pausa de contemplación y respiración (las máscaras, también la mirada).
      var cara = kind === 'cara';
      v.agente = new D.Agente({ x: sx, z: ENTRY.z, rumbo: 0, rnd: azar, velMax: cara ? SPEED * U.rand(0.92, 1.06) : 0.85,
        aceleracion: cara ? 1.2 : 0.9, frenado: 1.8, pesadez: cara ? 0.3 : 0.6, zancada: cara ? 1.25 : 1.5 });
      v.agente.ponerRuta(this._organica(target.path));
      v.contempla = new D.Contemplacion(azar);
      v.respira = new D.Respiracion(azar, cara ? null : { ritmo: 1.0 });
      if (!cara) { v.mirada = new D.Mirada(); }
      // Las caras blancas llevan cerebro de mosca (las máscaras no: obedecen órdenes) y eligen su rutina por utilidad.
      if (cara) {
        v.brain = new MR.Mosca(100 + id, { curiosidad: 0.5, miedo: 0.6 });
        v.mente = this._menteCara(v);
      }
      this.visitors.push(v);
      if (cara && this.childPlan && !this.childCame && g.minutes >= 90) { this.childCame = true; this._addChild(v); }
      if (!o.mudo) { g.audio.door(); }
      return v;
    }

    /** Dos máscaras: una va al mostrador y la otra, 0,8 s después (sus pasos nunca coinciden), vigila la puerta. */
    _spawnPar() {
      var a = this.spawn('mascara');
      var b = this.spawn('mascara', { rol: 'vigia', demora: 0.8, mudo: true });
      a.pareja = b;
      b.pareja = a;
      return a;
    }

    // -------------------------------------------------------------------------------------------- director de IA
    /** Las cajas de colisión de la sala (lo que hay que rodear), calculadas una vez. */
    _obstaculos() {
      if (!this.obst) {
        this.obst = this.world.colliders.filter(function (b) { return b.maxX > -8.5 && b.minX < 8.5 && b.maxZ > -5.5 && b.minZ < 5.5; });
      }
      return this.obst;
    }

    /** La ruta con un poco de variación: cada uno camina su propia línea (los puntos intermedios se corren un poco). */
    _organica(path) {
      var obst = this._obstaculos();
      return path.map(function (p, i) {
        if (i === path.length - 1 || p[2]) { return p.slice(); }
        for (var k = 0; k < 4; k += 1) {
          var q = [p[0] + U.rand(-0.22, 0.22), p[1] + U.rand(-0.22, 0.22)];
          if (!D.choca(q[0], q[1], obst, 0.35)) { return q; }
        }
        return p.slice();
      });
    }

    /** Lo que el director necesita saber de ti (posición, hacia dónde miras, si parpadeas o limpias el vaho). */
    _ojos() {
      var g = this.game;
      var o = this.ojosJugador || (this.ojosJugador = {});
      o.x = g.player.pos.x;
      o.z = g.player.pos.z;
      o.yaw = g.player.yaw;
      o.ojosCerrados = g.player.eyesClosed;
      o.limpiando = !!(g.glasses && g.glasses.wiping);
      return o;
    }

    /** Cuánto lo miras (si no estás en la sala, nada). */
    _percibir(v, inSala) {
      return inSala ? D.percibir(this._ojos(), v.model.group.position) : FUERA;
    }

    /** El mundo para un caminante: la sala, tú (espacio personal) y los demás (sin contar a su niño o a su adulto). */
    _mundo(quien, junto) {
      var g = this.game;
      var inSala = !g.bosque.outside && !g.pasillo.inside;
      var otros = [];
      this.visitors.forEach(function (o) {
        if (o.agente !== quien.agente && o !== junto) { otros.push({ x: o.agente.x, z: o.agente.z, r: o.agente.radio }); }
        if (o.child && o.child !== quien && o !== quien) { otros.push({ x: o.child.agente.x, z: o.child.agente.z, r: 0.16 }); }
      });
      var el = g.horror.customerCollider();
      if (el) { otros.push(el); }
      return { obstaculos: this._obstaculos(), limites: SALA, otros: otros, espacio: quien.kind ? 1.0 : 0.8, // el niño, más cerca
        jugador: inSala ? g.player.pos : null };
    }

    /** Respira (el pecho sube y baja); si estás demasiado cerca, contiene el aire. */
    _respirar(v, dt, per) {
      var r = v.respira.actualizar(dt, per.distancia);
      var k = v.kind === 'mascara' ? 0.012 : 0.02;
      v.model.chest.scale.set(1 + r.pecho * k, 1, 1 + r.pecho * k * 1.5);
      return r;
    }

    /** Las máscaras te siguen con la mirada: el cuello despacio y, un segundo después, la máscara. */
    _mirarJugador(v, dt, inSala) {
      var g = this.game;
      var pos = v.model.group.position;
      var cerca = inSala && U.distXZ(g.player.pos, pos) < 6.5;
      var obj = cerca ? D.envolver(D.rumbo(g.player.pos.x - pos.x, g.player.pos.z - pos.z) - v.model.group.rotation.y) : null;
      v.mirada.actualizar(dt, obj);
      v.model.neck.rotation.y = v.mirada.cuello;
      v.model.head.rotation.y = v.mirada.ojos;
    }

    /**
     * La mente de una cara blanca mientras espera su lavado (utilidad): mirar el tambor girar, doblar una prenda que no
     * está, contar monedas, o correrse al borde de tu vista. Más inquieta con la tienda rara (luces que fallan, estática,
     * miedo). Las rutinas empiezan cuando ya cargó su ropa.
     */
    _menteCara(v) {
      var self = this;
      var g = this.game;
      return new D.Utilidad({
        tambor: function () { return 0.5 + (v.loaded ? 0.15 : 0.4); },
        doblar: function () { return v.timer > 7 ? 0.42 : 0; },
        monedas: function () { return v.timer > 7 ? 0.36 + (g.gameplay.coins > 0 ? 0.04 : 0) : 0; },
        periferia: function (c) {
          if (v.timer < 7 || v.talking || v.child || !c.inSala || c.per.distancia > 9 || c.per.distancia < 2.2) { return 0; }
          var luz = g.horror.lightLevel();
          return 0.22 + 0.3 * g.dread + 0.25 * (1 - luz) + 0.15 * (1 - g.gameplay.radioProximity) + (self.visitors.length > 1 ? 0 : 0.05);
        }
      }, { rnd: azar, minimo: 4, ruido: 0.12, inicial: 'tambor' });
    }

    /** Un lugar frente a las lavadoras, cerca de la suya, justo en el borde de tu vista. */
    _bordeDeVista(v) {
      var o = this._ojos();
      var wx = -6.75 + v.washer;
      var mejor = null;
      var md = Infinity;
      for (var x = Math.max(-6.6, wx - 1.6); x <= Math.min(-0.95, wx + 1.6); x += 0.2) {
        var p = D.percibir({ x: o.x, z: o.z, yaw: o.yaw }, { x: x, z: -3.35 });
        var d = Math.abs(p.angulo - (D.FOV_MEDIO - 0.06)) + Math.abs(x - wx) * 0.05;
        if (d < md) { md = d; mejor = [x, -3.35]; }
      }
      return mejor;
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
      if (v.talked) { this._insistir(v); return; }
      if (v.state !== 'llego') { this._say(v, 'tocar'); v.talked = true; return; } // de paso: solo un murmullo
      var questions = this._extraQuestions(v).concat(MR.HISTORIA.blackwood.charla.preguntas);
      if (this.coinPlan && !this.coinAsked && g.minutes >= 100) { this._askCoin(v, questions); return; }
      this._converse(v, questions);
    }

    /**
     * Insistir cuando ya no te responde (comunicación sin palabras): la primera vez mira el tambor; la segunda lo señala
     * con un dedo largo y anguloso; desde la tercera se inclina hacia ti, muy despacio, invadiendo tu vista sin mirarte.
     */
    _insistir(v) {
      var g = this.game;
      v.insiste = (v.insiste || 0) + 1;
      if (v.insiste === 1 || v.state !== 'llego') { g.gameplay.say('cara' + v.id, '(Ya no te responde. Mira el tambor girar.)', 3); return; }
      if (v.insiste === 2) {
        v.senala = 4.5;
        g.gameplay.say('cara' + v.id, '(Señala el tambor con un dedo largo y anguloso. No dice nada.)', 4);
        return;
      }
      v.inclina = 10;
      v.timer = Math.min(v.timer, 14); // no se va mientras tanto
      g.gameplay.say('cara' + v.id, '(Se inclina hacia ti, muy despacio, sin mirarte.)', 4);
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
        if (p.kind === 'cara') { this._startApproach(); }
        else if (p.par && !this.visitors.length) { this._spawnPar(); }
        else { this.spawn(p.kind); }
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
      if (v.state !== 'entra' && v.state !== 'sale' && v.state !== 'llego') { return; } // p. ej. 'quieta' (pruebas)
      var inSala = !g.bosque.outside && !g.pasillo.inside;
      var per = this._percibir(v, inSala);
      this._respirar(v, dt, per);
      // Pausa de contemplación: si lo miras de golpe, se queda inmóvil (a media zancada, si caminaba) de 3 a 5 s.
      var congelado = v.contempla.actualizar(dt, per.nivel, per.distancia < 9);
      if (v.mirada && !congelado) { this._mirarJugador(v, dt, inSala); }
      if (v.state === 'llego') {
        v.timer += dt;
        this._llego(v, dt, per, congelado, inSala);
        return;
      }
      if (v.demora > 0) { v.demora -= dt; return; } // la segunda máscara, 0,8 s después
      if (congelado) { v.agente.v = 0; return; }
      this._caminar(v, dt, inSala);
    }

    /** Camina su ruta por fuerzas de dirección. Al llegar se queda (o, si salía, se va). */
    _caminar(v, dt, inSala) {
      var g = this.game;
      var grp = v.model.group;
      var pos = grp.position;
      var ag = v.agente;
      ag.paso(dt, this._mundo(v));
      if (ag.atascado && this._percibir(v, inSala).oculto) { // no debería pasar; si pasa, nadie lo ve resolverse
        var f = ag.ruta[ag.ruta.length - 1];
        ag.x = f[0];
        ag.z = f[1];
        ag.v = 0;
        ag.llego = true;
      }
      pos.x = ag.x;
      pos.z = ag.z;
      grp.rotation.y = ag.rumbo;
      // Los pasos van con lo que avanza: pisadas pesadas, y nunca patina.
      var marcha = Math.min(1, ag.v / ag.velMax);
      pos.y = Math.abs(Math.sin(ag.fase)) * 0.03 * marcha;
      this._limbs(v.model, ag.fase, (v.kind === 'cara' ? 0.42 : 0.16) * marcha);
      // Si le bloqueas el paso: se detiene a un metro, ladea la cabeza 15° y espera en silencio.
      var ladeo = ag.esperando ? 0.26 : 0;
      v.model.head.rotation.z += (ladeo - v.model.head.rotation.z) * Math.min(1, dt * 2);
      if (v.porAtras && !v.abrio && Math.hypot(ag.x - PUERTA_TRASERA[0], ag.z - PUERTA_TRASERA[1]) < 1.7) { this._abrirTrasera(v, inSala); }
      if (!ag.llego) { return; }
      if (v.state === 'sale') { this._salio(v); return; }
      v.state = 'llego';
      v.timer = 0;
      pos.y = 0;
      this._limbs(v.model, 0, 0); // llega y se queda quieto (no a media zancada)
      this._arrive(v);
    }

    /** Gira el cuerpo hacia un rumbo, con tope de velocidad (rad/s). */
    _girar(v, rumbo, vel, dt) {
      var grp = v.model.group;
      var d = D.envolver(rumbo - grp.rotation.y);
      grp.rotation.y = D.envolver(grp.rotation.y + U.clamp(d, -vel * dt, vel * dt));
      v.agente.rumbo = grp.rotation.y;
    }

    _llego(v, dt, per, congelado, inSala) {
      var m = v.model;
      if (!congelado) { m.head.rotation.z += (0 - m.head.rotation.z) * Math.min(1, dt * 2); } // endereza la cabeza
      if (v.kind === 'cara') { this._caraLlego(v, dt, per, congelado, inSala); return; }
      if (!congelado) { this._girar(v, v.rot, 3, dt); }
      if (v.rol === 'vigia') {
        // Vigila la puerta hasta que la otra se va; sale 0,8 s después (sus pasos nunca coinciden).
        var p = v.pareja;
        if (!p || !this.visitors.includes(p) || p.state === 'sale') {
          v.esperaSalida = (v.esperaSalida || 0) + dt;
          if (v.esperaSalida > 0.8 && !congelado) { this._leave(v); }
        }
        return;
      }
      if (v.timer > 6 && !congelado) { this._leave(v); }
    }

    /**
     * Una cara blanca espera su lavado: carga la ropa, elige su rutina (utilidad) y, si la miras de frente, no cambia de
     * pose; si insistes en hablarle, señala el tambor y después se inclina hacia ti, sin mirarte.
     */
    _caraLlego(v, dt, per, congelado, inSala) {
      var g = this.game;
      var m = v.model;
      if (v.timer > 2.5 && !v.loaded) {
        v.loaded = true;
        var wa = g.gameplay.washers[v.washer];
        // En la noche sin agua, la máquina tampoco arranca para ellos.
        if (!wa.running && g.mod !== 'sin_agua') { wa.running = true; wa.credit = false; wa.remaining = MR.Config.WASHER_CYCLE_MIN; g.audio.buzz(); }
      }
      // Mientras conversa contigo no se va; si te alejas, la conversación termina.
      if (v.talking && U.distXZ(g.player.pos, m.group.position) > 4) { this._endTalk(v); }
      if (congelado) { return; } // inmóvil: ni la cabeza, ni las manos, ni un balanceo
      var insiste = this._insistencia(v, dt);
      var c = insiste ? 'tambor' : v.mente.actualizar(dt, { inSala: inSala, per: per }, per.nivel !== 'foco');
      var camina = !insiste && this._moverEnEspera(v, dt, c, per);
      if (!camina && !insiste) { this._girar(v, v.rot, 4, dt); }
      // Nunca te mira: si la miras de cerca (o se inclina hacia ti), gira la cara. Si no, mira hacia donde atiende su
      // cerebro de mosca (Pelusa, el niño, su ropa girando, el autobús), nunca hacia ti.
      var mira = this._watched(v) || v.lean < -0.05 ? 1.1 : this._mindLook(v, dt);
      m.head.rotation.y += (mira - m.head.rotation.y) * Math.min(1, dt * 3);
      if (!camina) { this._rutina(v, insiste ? null : c, dt); }
      if (!v.talking && v.timer > 22 && !insiste) { this._leave(v); } // espera el centrifugado (como dicen ellas)
    }

    /**
     * Correrse al borde de tu vista (periferia) o volver a su lavadora. Solo da pasos mientras no la miras de frente
     * (si la miras, se queda a medio paso). Devuelve true si está caminando.
     */
    _moverEnEspera(v, dt, c, per) {
      var ag = v.agente;
      var grp = v.model.group;
      var meta = [-6.75 + v.washer, -3.35];
      if (c === 'periferia') {
        v.bordeT = (v.bordeT || 0) - dt;
        if (v.bordeT <= 0 || !v.borde) { v.bordeT = 1.5; v.borde = this._bordeDeVista(v); }
        if (v.borde) { meta = v.borde; }
      }
      var fin = ag.ruta && ag.ruta[ag.ruta.length - 1];
      if (Math.hypot(ag.x - meta[0], ag.z - meta[1]) > 0.08 && (!fin || Math.hypot(fin[0] - meta[0], fin[1] - meta[1]) > 0.05)) {
        ag.ponerRuta([meta]);
      }
      if (ag.llego) { return false; }
      if (per.nivel === 'foco') { ag.v = 0; return true; } // aproximación por oclusión: mirándola, no se mueve
      ag.paso(dt, this._mundo(v));
      grp.position.x = ag.x;
      grp.position.z = ag.z;
      grp.rotation.y = ag.rumbo;
      var marcha = Math.min(1, ag.v / ag.velMax);
      grp.position.y = Math.abs(Math.sin(ag.fase)) * 0.03 * marcha;
      this._limbs(v.model, ag.fase, 0.42 * marcha);
      if (ag.llego) { grp.position.y = 0; this._limbs(v.model, 0, 0); }
      return !ag.llego;
    }

    /**
     * Las manos y la cabeza según la rutina: mirar el tambor (cabeza baja), doblar una prenda que no está (las dos
     * manos adelante, plegando) o contar monedas (la vista en la mano). Todo se mueve de a poco y con su respiración.
     */
    _rutina(v, c, dt) {
      var m = v.model;
      var t = v.timer;
      var micro = v.respira.micro;
      var aL = 0;
      var aR = 0;
      var zL = 0;
      var zR = 0;
      var cab = 0;
      if (v.senala > 0) { aR = 1.35; } // señala el tambor
      else if (c === 'tambor') { cab = -0.12; }
      else if (c === 'doblar') {
        aL = 0.95 + Math.sin(t * 1.6) * 0.25 * micro;
        aR = 0.95 + Math.sin(t * 1.6 + Math.PI) * 0.25 * micro;
        zL = -0.28;
        zR = 0.28;
        cab = -0.3;
      } else if (c === 'monedas') {
        aL = 0.62;
        aR = 0.72 + (Math.sin(t * 5.3) > 0.55 ? 0.06 * micro : 0); // pasa una moneda de una mano a la otra
        zL = -0.2;
        zR = 0.16;
        cab = -0.45;
      }
      if (v.flinch > 0) { return; } // el sobresalto manda sobre las manos (_mindLook)
      var k = Math.min(1, dt * 3);
      m.armL.rotation.x += (aL - m.armL.rotation.x) * k;
      m.armR.rotation.x += (aR - m.armR.rotation.x) * k;
      m.armL.rotation.z += (zL - m.armL.rotation.z) * k;
      m.armR.rotation.z += (zR - m.armR.rotation.z) * k;
      m.head.rotation.x += (cab - m.head.rotation.x) * k;
      if (Math.abs(aL) + Math.abs(aR) + Math.abs(zL) + Math.abs(zR) === 0 && Math.abs(m.armL.rotation.x) + Math.abs(m.armR.rotation.x) < 0.003) {
        this._limbs(m, 0, 0); // del todo quieta (exacto), como al llegar
        m.armL.rotation.z = 0;
        m.armR.rotation.z = 0;
      }
    }

    /**
     * Si insistes en hablarle: señala el tambor (unos segundos) y, si sigues, se inclina hacia ti muy despacio, sin
     * mirarte, mientras estés cerca. Devuelve true mientras dura.
     */
    _insistencia(v, dt) {
      var g = this.game;
      var m = v.model;
      var grp = m.group;
      if (m.finger) { m.finger.visible = v.senala > 0; }
      if (v.senala > 0) { v.senala -= dt; }
      var cerca = U.distXZ(g.player.pos, grp.position) < 3.2;
      v.lean = v.lean || 0;
      if (v.inclina > 0 && cerca) {
        v.inclina -= dt;
        v.lean = Math.max(-0.32, v.lean - dt * 0.05); // muy despacio
        this._girar(v, D.rumbo(g.player.pos.x - grp.position.x, g.player.pos.z - grp.position.z), 0.6, dt);
      } else {
        v.inclina = 0;
        v.lean = Math.min(0, v.lean + dt * 0.12);
      }
      grp.rotation.x = v.lean;
      return v.senala > 0 || v.lean < -0.005;
    }

    /** La máscara (o las dos) abren la puerta trasera y la dejan entreabierta: se cierra sola cuando no la mires. */
    _abrirTrasera(v, inSala) {
      var g = this.game;
      v.abrio = true;
      if (v.pareja && v.pareja.abrio) { return; }
      g.horror.backDoorTarget = -0.6;
      g.audio.door();
      if (inSala && g.horror.zoneVisible('puerta_trasera') > 0.3) {
        g.ui.subtitle(v.pareja ? '(Las máscaras salen por la puerta trasera y la dejan entreabierta.)' :
          '(La máscara sale por la puerta trasera y la deja entreabierta.)', 5);
      }
    }

    _salio(v) {
      var g = this.game;
      if (v.porAtras) {
        if (!v.pareja || !this.visitors.includes(v.pareja)) { g.horror.later(40, 'cierra_trasera', 'puerta_trasera', 0); }
      } else {
        g.audio.door();
      }
      this._remove(v);
      if (v.kind === 'cara' && Math.random() < 0.5) { this._wave(); } // a veces se despide desde la otra vereda
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
      } else if (v.rol === 'vigia') {
        // La segunda no va al mostrador: se queda junto a la puerta de vidrio, de cara a la sala, siguiéndote con la máscara.
        if (!g.bosque.outside && !g.pasillo.inside) { g.ui.subtitle('(Dos máscaras. Una se queda junto a la puerta de vidrio, de cara a la sala.)', 5); }
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

    /**
     * Se va. Las caras blancas, por la puerta de vidrio. Las máscaras, si la puerta trasera ya está abierta (desde las
     * 03:00), por ahí, con paso firme y rodeando el mostrador, y la dejan entreabierta (para que quieras seguirlas).
     */
    _leave(v) {
      var g = this.game;
      v.state = 'sale';
      if (v.kind === 'cara') { v.model.head.rotation.y = 0; }
      var ruta;
      if (v.kind === 'cara') {
        ruta = [[0.4, -3.2], [0.4, 1.8], [ENTRY.x, ENTRY.z], [0, 5.3, true]];
      } else if (g.pasillo && g.pasillo.unlocked) {
        v.porAtras = true;
        ruta = [[4.2, 2.9], [4.2, 1.0], [6.8, -3.6], PUERTA_TRASERA, [6.8, -5.6, true]];
      } else {
        ruta = [[3.4, 3.5], [1.2, 3.8], [ENTRY.x, ENTRY.z], [0, 5.3, true]];
      }
      v.agente.ponerRuta(this._organica(ruta));
      v.model.group.rotation.x = 0;
      v.lean = 0;
      if (v.model.finger) { v.model.finger.visible = false; }
      if (v.kind === 'cara' && Math.random() < 0.6) { this._say(v, 'despedida'); }
    }
  }

  MR.Clientela = Clientela;
})(window.MR = window.MR || {});
