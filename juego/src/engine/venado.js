/**
 * El venado del bosque de Blackwood: vida salvaje con su propio cerebro de mosca (mosca.js). Inofensivo.
 * - Algunas noches está en el bosque: aparece pastando lejos, entre los pinos (12–16 m).
 * - Su cerebro te ve (y oye los sonidos): si te acercas, levanta la cabeza y te mira; si su miedo gana, huye a saltos
 *   y se pierde entre los árboles (esa noche ya no vuelve).
 * - Sus ojos brillan cuando lo alumbra la linterna del celular.
 */
(function (MR) {
  'use strict';

  var U = MR.Util;

  class Venado {
    constructor(game) {
      this.game = game;
      this.world = game.world;
      this.brain = new MR.Mosca(400, { curiosidad: 0.4, miedo: 0.95 });
      this.plan = Math.random() < 0.6; // esta noche hay venado en el bosque
      this.active = false;
      this.gone = false;
      this.state = 'pasta';
      this.senseAcc = 0;
      this.fase = 0;
      this.timer = 0;
      this.model = null;
      this.tmp = new THREE.Vector3();
    }

    /** El modelo (pocas caras, estilo PS1): mira a +z. Cuello y patas articulados. */
    _build() {
      var w = this.world;
      var R = w.retro;
      var pelo = R.material({ texture: 'white', color: 0x7a5639, emissive: 0.06 }); // apenas se adivina en la oscuridad
      var claro = R.material({ texture: 'white', color: 0xd8ccb4 });
      var M4 = THREE.Matrix4;
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
      var lomo = [];
      pieza(lomo, 0, 1.02, 0, 0.36, 0.42, 0.92);                         // el cuerpo
      malla(lomo, pelo, g);
      var cola = [];
      pieza(cola, 0, 1.12, -0.48, 0.2, 0.12, 0.06);                      // la cola, blanca
      malla(cola, claro, g);
      var cuello = new THREE.Group();
      cuello.position.set(0, 1.18, 0.4);
      g.add(cuello);
      var cuelloP = [];
      pieza(cuelloP, 0, 0.24, 0.04, 0.15, 0.5, 0.17);
      malla(cuelloP, pelo, cuello);
      var cabeza = new THREE.Group();
      cabeza.position.set(0, 0.5, 0.1);
      cuello.add(cabeza);
      var craneo = [];
      pieza(craneo, 0, 0, 0.1, 0.16, 0.17, 0.32);
      var cono = new THREE.ConeGeometry(0.045, 0.14, 4);
      [-1, 1].forEach(function (s) { pieza(craneo, 0.08 * s, 0.11, -0.02, 1, 1, 1, -0.6 * s, cono); }); // las orejas
      malla(craneo, pelo, cabeza);
      var hocico = [];
      pieza(hocico, 0, -0.04, 0.27, 0.1, 0.08, 0.1);                    // el hocico, más claro
      malla(hocico, claro, cabeza);
      var eyeMat = R.material({ texture: 'white', color: 0xdaf2c2, emissive: 0.15 });
      var ojos = [];
      [-1, 1].forEach(function (s) { pieza(ojos, 0.085 * s, 0.03, 0.17, 0.04, 0.035, 0.02); }); // dos puntos en la oscuridad
      malla(ojos, eyeMat, cabeza);
      // Las patas, de a pares: delanteras y traseras se mueven igual al galopar.
      var pares = [0.33, -0.33].map(function (z) {
        var hip = new THREE.Group();
        hip.position.set(0, 0.86, z);
        g.add(hip);
        var patas = [];
        [-0.12, 0.12].forEach(function (x) { pieza(patas, x, -0.43, 0, 0.07, 0.86, 0.07); });
        malla(patas, pelo, hip);
        return hip;
      });
      var legs = [pares[0], pares[0], pares[1], pares[1]];
      g.visible = false;
      w.add(g);
      this.model = { group: g, cuello: cuello, cabeza: cabeza, legs: legs, eyeMat: eyeMat };
    }

    /** Aparece pastando lejos (12–16 m), dentro del bosque y lejos del sendero de la fachada. */
    _spawn() {
      if (!this.model) { this._build(); }
      var p = this.game.player.pos;
      for (var i = 0; i < 40; i += 1) {
        var a = Math.random() * Math.PI * 2;
        var d = U.rand(12, 16);
        var x = p.x + Math.sin(a) * d;
        var z = p.z + Math.cos(a) * d;
        if (Math.abs(x) < 18 && z > 107 && z < 146 && this._libre(x, z)) {
          this.model.group.position.set(x, 0, z);
          this.model.group.rotation.y = Math.random() * Math.PI * 2;
          this.model.group.visible = true;
          this.active = true;
          this.state = 'pasta';
          this.timer = 0;
          return true;
        }
      }
      return false;
    }

    /** ¿Hay un claro aquí? (a más de 1 m de cualquier colisión: troncos, la lavadora, el puente). */
    _libre(x, z) {
      var cs = this.world.colliders;
      for (var i = 0; i < cs.length; i += 1) {
        var c = cs[i];
        if (c.off) { continue; }
        var cx = U.clamp(x, c.minX, c.maxX);
        var cz = U.clamp(z, c.minZ, c.maxZ);
        if (Math.hypot(x - cx, z - cz) < 1.0) { return false; }
      }
      return true;
    }

    /** Lo que siente su cerebro: a ti (te ve y te oye caminar), los sonidos y la linterna en los ojos. */
    _sense(lit) {
      var g = this.game;
      var b = this.brain;
      var grp = this.model.group;
      var me = grp.position;
      var yaw = grp.rotation.y;
      var pp = g.player.pos;
      b.limpiar();
      var d = Math.hypot(pp.x - me.x, pp.z - me.z);
      if (d < 20) {
        b.estimulo(Math.atan2(pp.x - me.x, pp.z - me.z) - yaw, (g.player.moving ? 1.0 : 0.5) / (1 + d * 0.15));
        b.contexto(MR.Mosca.CTX.jugador, Math.max(0, 1 - d / 12));
      }
      var ruido = 0;
      (g.sonidos || []).forEach(function (s) {
        var ds = Math.hypot(s.x - me.x, s.z - me.z);
        if (ds < 20) { b.estimulo(Math.atan2(s.x - me.x, s.z - me.z) - yaw, s.f * 1.5 / (1 + ds * 0.2)); ruido = Math.max(ruido, s.f); }
      });
      // Miedo: tú cerca (más si caminas) y la linterna en la cara.
      var cerca = d < 8 ? (1 - d / 8) * (g.player.moving ? 1.3 : 0.9) : 0;
      // La linterna en los ojos asusta solo de cerca: de lejos, mira (con los ojos brillando); si te acercas, huye.
      b.sentir({ amenaza: Math.min(1, cerca + (lit && d < 8 ? 0.25 : 0)), atraccion: 0, ruido: ruido, sueno: 0.1 });
    }

    update(dt) {
      var g = this.game;
      var outside = g.bosque.outside && !g.bosque.travel;
      if (!outside) {
        if (this.model) { this.model.group.visible = false; }
        this.active = false;
        return;
      }
      if (!this.active) {
        if (this.plan && !this.gone) { this._spawn(); }
        return;
      }
      var m = this.model;
      var grp = m.group;
      var pp = g.player.pos;
      var dx = pp.x - grp.position.x;
      var dz = pp.z - grp.position.z;
      var d = Math.hypot(dx, dz);
      // ¿Lo alumbra la linterna? (lo miras de frente, de cerca).
      var cam = g.player.camera;
      var fwd = g.player.forward(this.tmp);
      var lit = d < 15 && (fwd.x * -dx + fwd.z * -dz) / Math.max(d, 0.01) > Math.cos(0.3) && !g.player.eyesClosed;
      m.eyeMat.uniforms.uEmissive.value = lit ? 1.6 : 0.15;
      this.senseAcc += dt;
      if (this.senseAcc >= 0.1) { this.senseAcc = 0; this._sense(lit); }
      this.brain.pensar(dt);
      var b = this.brain;
      var at = b.atencion();
      var visto = !g.player.eyesClosed && this._enCuadro(cam);
      this.timer += dt;
      if (this.state === 'huye') {
        // A saltos, lejos de ti.
        var sx = -dx / Math.max(d, 0.01);
        var sz = -dz / Math.max(d, 0.01);
        grp.position.x += sx * 4.2 * dt;
        grp.position.z += sz * 4.2 * dt;
        grp.rotation.y = Math.atan2(sx, sz);
        this.fase += dt * 14;
        m.legs.forEach(function (leg, i) { leg.rotation.x = Math.sin(this.fase + (i < 2 ? 0 : Math.PI)) * 0.7; }, this);
        grp.position.y = Math.abs(Math.sin(this.fase * 0.5)) * 0.18;
        m.cuello.rotation.x = -0.2;
        if (d > 22 || Math.abs(grp.position.x) > 21 || grp.position.z < 102 || grp.position.z > 149) {
          grp.visible = false;
          this.active = false;
          this.gone = true; // esa noche ya no vuelve
        }
        return;
      }
      if (b.accion() === 'huir' && b.impulso('huir') > 0.45) {
        this.state = 'huye';
        if (visto && !this.fleeSaid) {
          this.fleeSaid = true;
          g.ui.subtitle('(El venado se va dando saltos entre los pinos.)', 4);
        }
        return;
      }
      if (at.fuerza > 0.2 && d < 12) {
        // Alerta: levanta la cabeza y gira el cuerpo despacio hacia lo que le llama la atención.
        if (this.state !== 'alerta') {
          this.state = 'alerta';
          this.timer = 0;
        }
        // La primera vez que lo ves alerta (aunque ya lo estuviera cuando te diste vuelta).
        if (visto && !this.seenSaid) {
          this.seenSaid = true;
          g.ui.subtitle('(Entre los pinos, un venado levanta la cabeza. Sus ojos brillan con tu linterna.)', 5);
        }
        m.cuello.rotation.x += (-0.25 - m.cuello.rotation.x) * Math.min(1, dt * 4);
        grp.rotation.y += U.clamp(at.angulo, -1, 1) * Math.min(1, dt * 1.5);
      } else {
        // Pasta: el cuello abajo, la cola apenas.
        if (this.state === 'alerta' && this.timer > 4) { this.state = 'pasta'; }
        if (this.state === 'pasta') { m.cuello.rotation.x += (1.15 - m.cuello.rotation.x) * Math.min(1, dt * 1.5); }
      }
      grp.position.y = 0;
      m.legs.forEach(function (leg) { leg.rotation.x = 0; });
    }

    _enCuadro(cam) {
      var v = this.tmp.copy(this.model.group.position).setY(1.2).project(cam);
      return Math.abs(v.x) < 0.9 && Math.abs(v.y) < 0.9 && v.z < 1;
    }
  }

  MR.Venado = Venado;
})(window.MR = window.MR || {});
