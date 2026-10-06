/**
 * La lechuza del bosque de Blackwood: posada en la rama de un árbol seco, con su propio cerebro de mosca (mosca.js).
 * - El árbol seco está siempre; la lechuza, algunas noches. Tiene la cara blanca, como las lechuzas de verdad.
 * - Te sigue con la cabeza a saltos (se queda quieta y de golpe gira), y la gira más de lo que debería: casi hasta
 *   la espalda.
 * - Ulula desde su rama: el sonido viene de ahí, y el venado lo oye.
 * - Ve a *él* entre los pinos aunque tú no: si deja de mirarte y mira fijo hacia los árboles, él está ahí.
 * - Sus ojos brillan con la linterna. Si te acercas mucho, abre las alas sin un ruido y esa noche ya no vuelve.
 */
(function (MR) {
  'use strict';

  var U = MR.Util;
  // Dónde puede estar el árbol seco (lejos del sendero): el primero sin pinos alrededor.
  // (Lejos de donde él se para: los bosque_* de world.js.)
  var SITIOS = [[4.6, 113], [-5.2, 125], [10.5, 126], [-3.6, 134], [9.5, 117], [-7.5, 108.5]];
  var RAMA = 2.62;   // altura de la rama donde se posa
  var GIRO = 2.75;   // cuánto gira la cabeza (rad): más que una lechuza de verdad

  class Lechuza {
    constructor(game) {
      this.game = game;
      this.world = game.world;
      this.brain = new MR.Mosca(500, { curiosidad: 0.9, miedo: 0.5 });
      this.plan = Math.random() < 0.7; // esta noche hay lechuza
      this.gone = false;
      this.state = 'posada';
      this.senseAcc = 0;
      this.snap = 0;
      this.headTarget = 0;
      this.hoot = U.rand(5, 12);
      this.fly = 0;
      this.tmp = new THREE.Vector3();
      this._build();
    }

    /** El árbol seco (un solo mesh) y la lechuza en su rama; mira al sendero. Pocas caras, estilo PS1. */
    _build() {
      var w = this.world;
      var R = w.retro;
      var s = this._sitio();
      this.sitio = s;
      var M4 = THREE.Matrix4;
      var parts = [
        { geo: new THREE.CylinderGeometry(0.1, 0.2, 3.6, 6), matrix: new M4().makeTranslation(0, 1.8, 0), su: 1, sv: 3 },
        // La rama de la lechuza, hacia el sendero (+z local), y dos ramas muertas más arriba.
        { geo: new THREE.CylinderGeometry(0.04, 0.06, 1.1, 5), matrix: new M4().makeTranslation(0, RAMA - 0.05, 0.42).multiply(new M4().makeRotationX(Math.PI / 2 - 0.12)), su: 1, sv: 1 },
        { geo: new THREE.CylinderGeometry(0.03, 0.05, 1.0, 5), matrix: new M4().makeTranslation(-0.36, 3.05, -0.1).multiply(new M4().makeRotationZ(0.95)), su: 1, sv: 1 },
        { geo: new THREE.CylinderGeometry(0.025, 0.04, 0.8, 5), matrix: new M4().makeTranslation(0.3, 3.35, 0.05).multiply(new M4().makeRotationZ(-0.8)), su: 1, sv: 1 }
      ];
      var arbol = new THREE.Mesh(MR.mergeParts(parts), R.material({ texture: 'corteza', color: 0x8d8478 }));
      arbol.position.set(s[0], 0, s[1]);
      arbol.rotation.y = s[2];
      w.add(arbol);
      if (arbol.raycast) { arbol.raycast = function () {}; }
      w.collider(s[0] - 0.22, s[0] + 0.22, s[1] - 0.22, s[1] + 0.22);
      this.arbol = arbol;

      var pluma = R.material({ texture: 'white', color: 0xb98d55 });   // el lomo, color miel
      var pecho = R.material({ texture: 'white', color: 0xe8dcc4 });
      var cara = R.material({ texture: 'white', color: 0xf4f1ea, emissive: 0.12 }); // la cara blanca: se adivina de noche
      // Las piezas que se mueven juntas y comparten material van en una sola malla (pocas llamadas de dibujo).
      var cubo = new THREE.BoxGeometry(1, 1, 1);
      function pieza(lista, x, y, z, ancho, alto, hondo, rz, geo) {
        lista.push({ geo: geo || cubo, matrix: new M4().makeTranslation(x, y, z).multiply(new M4().makeRotationZ(rz || 0)).multiply(new M4().makeScale(ancho, alto, hondo)) });
      }
      function malla(lista, mat, padre) {
        var me = new THREE.Mesh(MR.mergeParts(lista), mat);
        me.raycast = function () {};
        padre.add(me);
        return me;
      }
      var g = new THREE.Group();
      // En la rama, a 0,8 m del tronco.
      g.position.set(s[0] + Math.sin(s[2]) * 0.8, RAMA + 0.045, s[1] + Math.cos(s[2]) * 0.8); // sobre la rama
      g.rotation.y = s[2];
      var cuerpo = [];
      pieza(cuerpo, 0, 0.17, -0.01, 0.2, 0.3, 0.17);                          // el cuerpo
      [-1, 1].forEach(function (k) { pieza(cuerpo, 0.05 * k, 0.015, 0.02, 0.03, 0.03, 0.03); }); // las garras
      malla(cuerpo, pluma, g);
      var pechoP = [];
      pieza(pechoP, 0, 0.15, 0.075, 0.16, 0.22, 0.04);                         // el pecho
      malla(pechoP, pecho, g);
      var alas = [-1, 1].map(function (k) {
        var hombro = new THREE.Group();
        hombro.position.set(0.1 * k, 0.28, 0);
        g.add(hombro);
        var ala = [];
        pieza(ala, 0.02 * k, -0.12, -0.01, 0.05, 0.26, 0.15);
        malla(ala, pluma, hombro);
        return hombro;
      });
      var cabeza = new THREE.Group();
      cabeza.position.set(0, 0.36, 0);
      g.add(cabeza);
      var craneo = [];
      pieza(craneo, 0, 0.05, -0.01, 0.19, 0.16, 0.15);
      malla(craneo, pluma, cabeza);
      // La cara: un disco blanco en forma de corazón (dos mitades) con el pico; y los ojos negros.
      var disco = [];
      [-1, 1].forEach(function (k) { pieza(disco, 0.045 * k, 0.04, 0.07, 0.095, 0.15, 0.02, -0.18 * k); });
      pieza(disco, 0, 0.012, 0.085, 0.018, 0.035, 0.025);
      malla(disco, cara, cabeza);
      var ojos = [];
      [-1, 1].forEach(function (k) { pieza(ojos, 0.042 * k, 0.05, 0.082, 0.03, 0.03, 0.01); });
      var ojo = R.material({ texture: 'white', color: 0x110c08, emissive: 0 });
      malla(ojos, ojo, cabeza);
      g.visible = false;
      w.add(g);
      this.model = { group: g, cabeza: cabeza, alas: alas, ojo: ojo, base: g.position.clone() };
    }

    /** El primer sitio sin pinos a menos de 1,1 m; mira hacia el punto del sendero más cercano. */
    _sitio() {
      var cs = this.world.colliders;
      var libre = function (x, z) {
        for (var i = 0; i < cs.length; i += 1) {
          var c = cs[i];
          if (c.off) { continue; }
          if (Math.hypot(x - U.clamp(x, c.minX, c.maxX), z - U.clamp(z, c.minZ, c.maxZ)) < 1.1) { return false; }
        }
        return true;
      };
      var s = SITIOS.filter(function (p) { return libre(p[0], p[1]); })[0] || SITIOS[0];
      // El sendero pasa por x ≈ 0–6: la rama apunta hacia él.
      var haciaX = U.clamp(s[0] * 0.15, -1, 1) * -1;
      return [s[0], s[1], Math.atan2(haciaX, 0.35)];
    }

    /** Lo que siente su cerebro: a ti, a él entre los pinos (aunque tú no lo veas) y los sonidos. */
    _sense(lit, d) {
      var g = this.game;
      var b = this.brain;
      var me = this.model.group.position;
      var yaw = this.model.group.rotation.y;
      var CTX = MR.Mosca.CTX;
      b.limpiar();
      var pp = g.player.pos;
      if (d < 22) {
        b.estimulo(Math.atan2(pp.x - me.x, pp.z - me.z) - yaw, (g.player.moving ? 0.9 : 0.6) / (1 + d * 0.08));
        b.contexto(CTX.jugador, Math.max(0, 1 - d / 14));
      }
      var c = g.horror && g.horror.customer;
      if (c && c.present && /^bosque_/.test(c.anchor || '')) {
        var ep = this.world.customer.group.position;
        var de = Math.hypot(ep.x - me.x, ep.z - me.z);
        if (de < 24) { b.estimulo(Math.atan2(ep.x - me.x, ep.z - me.z) - yaw, 1.6 / (1 + de * 0.05)); b.contexto(CTX.el, 1); }
      }
      var ruido = 0;
      (g.sonidos || []).forEach(function (s) {
        var ds = Math.hypot(s.x - me.x, s.z - me.z);
        if (ds < 20) { b.estimulo(Math.atan2(s.x - me.x, s.z - me.z) - yaw, s.f * 1.2 / (1 + ds * 0.2)); ruido = Math.max(ruido, s.f); }
      });
      var cerca = d < 4.5 ? (1 - d / 4.5) * (g.player.moving ? 1.4 : 0.9) : 0;
      b.sentir({ amenaza: Math.min(1, cerca + (lit && d < 5 ? 0.2 : 0)), atraccion: 0, ruido: ruido, sueno: 0.05 });
    }

    update(dt) {
      var g = this.game;
      var m = this.model;
      var outside = g.bosque.outside && !g.bosque.travel;
      m.group.visible = outside && this.plan && !this.gone;
      if (!m.group.visible) { return; }
      var grp = m.group;
      var pp = g.player.pos;
      var dx = pp.x - grp.position.x;
      var dz = pp.z - grp.position.z;
      var d = Math.hypot(dx, dz);
      if (this.state === 'vuela') { this._volar(dt, dx, dz, d); return; }
      // ¿La alumbra la linterna? (la miras de frente).
      var fwd = g.player.forward(this.tmp);
      var lit = d < 16 && (fwd.x * -dx + fwd.z * -dz) / Math.max(d, 0.01) > Math.cos(0.3) && !g.player.eyesClosed;
      // Con la linterna, los ojos negros devuelven un brillo ámbar.
      m.ojo.uniforms.uColor.value.setHex(lit ? 0xffc070 : 0x110c08);
      m.ojo.uniforms.uEmissive.value = lit ? 1.5 : 0;
      this.lit = lit;
      this.senseAcc += dt;
      if (this.senseAcc >= 0.1) { this.senseAcc = 0; this._sense(lit, d); }
      var b = this.brain;
      b.pensar(dt);
      if (b.accion() === 'huir' && b.impulso('huir') > 0.5) {
        this.state = 'vuela';
        this.fly = 0;
        if (this._enCuadro()) { g.ui.subtitle('(La lechuza abre las alas sin un ruido y se pierde entre los pinos.)', 4); }
        return;
      }
      // La cabeza: a saltos. Se queda quieta y, de golpe, gira hacia lo que le llama la atención (hasta casi la espalda).
      var at = b.atencion();
      this.snap -= dt;
      if (this.snap <= 0) {
        this.snap = U.rand(0.5, 1.4);
        var quiere = at.fuerza > 0.12 ? U.clamp(MR.Mosca.envolver(at.angulo), -GIRO, GIRO) : this.headTarget * 0.5;
        this.headTarget = quiere;
        this.tilt = b.impulso('explorar') > 0.3 && Math.random() < 0.4 ? U.rand(-0.3, 0.3) : 0; // curiosa, ladea la cabeza
      }
      var h = m.cabeza.rotation;
      h.y += (this.headTarget - h.y) * Math.min(1, dt * 14);
      h.z += ((this.tilt || 0) - h.z) * Math.min(1, dt * 8);
      if (this._enCuadro() && d < 15 && (lit || d < 9)) {
        if (!this.seenSaid) {
          this.seenSaid = true;
          g.ui.subtitle('(En una rama seca, una lechuza de cara blanca. Te sigue con la cabeza.)', 5);
        } else if (!this.giroSaid && Math.abs(h.y) > 2.3 && Math.abs(this.headTarget) > 2.3) {
          this.giroSaid = true;
          g.ui.subtitle('(La lechuza gira la cabeza hasta la espalda para no dejar de mirarte.)', 5);
        }
      }
      // Ulula desde su rama de vez en cuando (más cerca, más fuerte); el venado la oye.
      this.hoot -= dt;
      if (this.hoot <= 0) {
        this.hoot = U.rand(14, 30);
        g.audio.buho(this._pan(), U.clamp(1.6 - d / 14, 0.35, 1.6));
        g.oir(grp.position.x, grp.position.z, 0.5);
        this.hoots = (this.hoots || 0) + 1;
      }
    }

    /** Vuela lejos de ti, en silencio: sube y se pierde; esa noche ya no vuelve. */
    _volar(dt, dx, dz, d) {
      var m = this.model;
      var grp = m.group;
      this.fly += dt;
      var sx = -dx / Math.max(d, 0.01);
      var sz = -dz / Math.max(d, 0.01);
      grp.rotation.y = Math.atan2(sx, sz);
      grp.position.x += sx * 5.5 * dt;
      grp.position.z += sz * 5.5 * dt;
      grp.position.y += 1.3 * dt;
      m.cabeza.rotation.set(0, 0, 0);
      var a = Math.sin(this.fly * 13) * 1.1;
      m.alas[0].rotation.z = -1.2 + a;
      m.alas[1].rotation.z = 1.2 - a;
      if (this.fly > 4 || d > 26) { this.gone = true; grp.visible = false; }
    }

    _enCuadro() {
      if (this.game.player.eyesClosed) { return false; }
      var v = this.tmp.copy(this.model.group.position).setY(RAMA + 0.3).project(this.game.player.camera);
      return Math.abs(v.x) < 0.9 && Math.abs(v.y) < 0.9 && v.z < 1;
    }

    _pan() {
      var cam = this.game.player.camera;
      var to = this.tmp.copy(this.model.group.position).sub(cam.position);
      to.y = 0;
      if (to.lengthSq() < 1e-6) { return 0; }
      var right = new THREE.Vector3(1, 0, 0).applyEuler(cam.rotation);
      return U.clamp(right.dot(to.normalize()), -1, 1);
    }
  }

  MR.Lechuza = Lechuza;
})(window.MR = window.MR || {});
