/**
 * Clima: lluvia visible en el bosque y tormenta (relámpagos y truenos), afuera y vista desde adentro.
 *
 * - Lluvia: 1400 hilos de agua en una caja de 22 x 14 x 22 m que sigue a la cámara; la caída, el viento y el
 *   "envolver" alrededor del jugador se calculan en el shader (un solo dibujo, cero trabajo en JavaScript).
 * - Relámpago: 1–3 destellos que suben la luz ambiente (afuera ilumina todo el bosque de golpe; adentro solo se
 *   ven las puertas de vidrio). Respeta «Reducir destellos de luz»: un solo resplandor suave.
 * - Trueno: llega 1–4 s después (la distancia); adentro se oye ahogado.
 * - Susto: a veces el relámpago revela que el Cliente Inmóvil estaba parado entre los árboles, delante de ti.
 */
(function (MR) {
  'use strict';

  var U = MR.Util;
  var DROPS = 1400;
  var BOX = 22;
  var HEIGHT = 14;

  var RAIN_VERT = [
    'attribute vec3 aBase;',
    'uniform float uTime;',
    'uniform vec3 uCam;',
    'uniform vec3 uRight;',
    'varying float vFade;',
    'void main() {',
    '  float fall = mod(aBase.y - uTime * 9.5, ' + HEIGHT.toFixed(1) + ');',
    '  vec3 w = vec3(uCam.x + mod(aBase.x - uCam.x, ' + BOX.toFixed(1) + ') - ' + (BOX / 2).toFixed(1) + ',',
    '                fall - 1.5 + position.y,',
    '                uCam.z + mod(aBase.z - uCam.z, ' + BOX.toFixed(1) + ') - ' + (BOX / 2).toFixed(1) + ');',
    '  w += uRight * position.x;',
    '  w.x += position.y * 0.14;', // viento: los hilos caen un poco inclinados
    '  vec4 mv = viewMatrix * vec4(w, 1.0);',
    '  gl_Position = projectionMatrix * mv;',
    '  vFade = 1.0 - clamp((-mv.z - 1.5) / 11.0, 0.0, 1.0);',
    '}'
  ].join('\n');

  var RAIN_FRAG = [
    'uniform float uBright;',
    'varying float vFade;',
    'void main() {',
    '  gl_FragColor = vec4(vec3(0.5, 0.56, 0.66) * vFade * uBright, 1.0);',
    '}'
  ].join('\n');

  class Clima {
    constructor(game) {
      this.game = game;
      this.world = game.world;
      this.retro = game.retro;
      this.mesh = this._buildRain();
      this.world.scene.add(this.mesh);
      this.nextBolt = U.rand(14, 28);
      this.bolt = null;        // { t, flashes: [[inicio, duración, fuerza]], thunderAt, thunderVol, done }
      this.flash = 0;
      this.bolts = 0;
      this.right = new THREE.Vector3();
      this.glassBase = this.world.mat.glass.uniforms.uEmissive.value;
    }

    _buildRain() {
      var base = new Float32Array(DROPS * 6 * 3);
      var pos = new Float32Array(DROPS * 6 * 3);
      var seed = 7;
      function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
      var corners = [[-1, 0], [1, 0], [1, 1], [-1, 0], [1, 1], [-1, 1]];
      for (var i = 0; i < DROPS; i += 1) {
        var bx = rnd() * BOX;
        var by = rnd() * HEIGHT;
        var bz = rnd() * BOX;
        var len = 0.35 + rnd() * 0.35;
        for (var c = 0; c < 6; c += 1) {
          var k = (i * 6 + c) * 3;
          base[k] = bx; base[k + 1] = by; base[k + 2] = bz;
          pos[k] = corners[c][0] * 0.011;
          pos[k + 1] = corners[c][1] * len;
          pos[k + 2] = 0;
        }
      }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('aBase', new THREE.BufferAttribute(base, 3));
      var mat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uRight: { value: new THREE.Vector3(1, 0, 0) }, uBright: { value: 0.6 } },
        vertexShader: RAIN_VERT,
        fragmentShader: RAIN_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      mesh.visible = false;
      mesh.raycast = function () {};
      return mesh;
    }

    /** Por cuadro (en partida). */
    update(dt, time) {
      var g = this.game;
      var out = g.bosque.outside;
      var cam = g.player.camera;
      var u = this.mesh.material.uniforms;
      this.mesh.visible = out;
      if (out) {
        u.uTime.value = time;
        u.uCam.value.copy(cam.position);
        u.uRight.value.set(1, 0, 0).applyQuaternion(cam.quaternion);
      }

      // Tormenta.
      this.nextBolt -= dt;
      if (!this.bolt && this.nextBolt <= 0) { this._startBolt(); }
      var f = 0;
      if (this.bolt) {
        var b = this.bolt;
        b.t += dt;
        b.flashes.forEach(function (fl) {
          var x = (b.t - fl[0]) / fl[1];
          if (x >= 0 && x <= 1) { f = Math.max(f, fl[2] * (1 - x * x)); }
        });
        if (!b.thundered && b.t >= b.thunderAt) {
          b.thundered = true;
          g.audio.trueno(b.thunderVol * (out ? 1 : 0.55), !out);
          MR.Haptics.pulse(b.thunderVol > 0.7 ? [90, 60, 140] : [60, 80, 60]);
        }
        if (b.thundered && b.t > b.thunderAt + 4) {
          this.bolt = null;
          this.nextBolt = U.rand(24, 55);
        }
      }
      this.flash = f;
      // Afuera: todo el bosque se ilumina. Adentro: solo el vidrio de la entrada (y un poquito la sala).
      var amb = g.bosque.baseAmbient();
      this.retro.shared.uAmbient.value.set(amb.x + f * (out ? 0.6 : 0.06), amb.y + f * (out ? 0.62 : 0.06), amb.z + f * (out ? 0.7 : 0.08));
      this.world.mat.glass.uniforms.uEmissive.value = this.glassBase + f * 1.6;
      u.uBright.value = 0.6 + f * 1.4;
    }

    _startBolt() {
      var g = this.game;
      var gentle = g.options.reduceFlashes;
      var near = Math.random() < 0.35;
      var flashes = gentle ? [[0, 0.6, 0.45]] : [[0, 0.09, 1], [0.16, 0.07, 0.6]];
      if (!gentle && Math.random() < 0.5) { flashes.push([0.34, 0.12, 0.85]); }
      this.bolt = {
        t: 0,
        flashes: flashes,
        thunderAt: near ? U.rand(0.4, 1.0) : U.rand(1.8, 4.2),
        thunderVol: near ? 1 : U.rand(0.45, 0.7),
        thundered: false
      };
      this.bolts += 1;
      if (g.bosque.outside) { this._reveal(); }
    }

    /** El relámpago revela al Cliente Inmóvil entre los árboles, delante de ti (estaba ahí, a oscuras). */
    _reveal() {
      var g = this.game;
      var h = g.horror;
      if (!h.customer.present || Math.random() > 0.4) { return; }
      var p = g.player.pos;
      var fwd = g.player.forward(new THREE.Vector3());
      fwd.y = 0;
      fwd.normalize();
      var anchors = this.world.anchors;
      var best = null;
      this.world.forest.anchors.forEach(function (name) {
        var a = anchors[name];
        var dx = a.x - p.x;
        var dz = a.z - p.z;
        var d = Math.hypot(dx, dz);
        if (d < 4 || d > 12) { return; }
        var cos = (dx * fwd.x + dz * fwd.z) / d;
        if (cos < 0.8) { return; }
        if (!best || d < best.d) { best = { name: name, d: d }; }
      });
      if (!best) { return; }
      h._placeAt(best.name);
      g.logros.unlock('relampago');
      g.dread = Math.min(1, g.dread + 0.12);
      g.stats.relampagos = (g.stats.relampagos || 0) + 1;
    }
  }

  MR.Clima = Clima;
})(window.MR = window.MR || {});
