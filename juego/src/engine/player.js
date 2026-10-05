/**
 * Jugador en primera persona: cámara, movimiento con colisiones, cabeceo y pasos, parpadeo y manos.
 * Las manos usan MR.SteppedHold(15): la pose solo cambia a 15 Hz aunque el juego vaya a 60 FPS (estética PS1).
 * El parpadeo es automático cada 3.5–7 s y manual con B; con los ojos cerrados el despachador del horror
 * recibe blink = true (ver horror.js).
 */
(function (MR) {
  'use strict';

  var V3 = THREE.Vector3;
  var U = MR.Util;
  var ROOM = { minX: -8, maxX: 8, minZ: -5, maxZ: 5 }; // la sala de la lavandería

  function noRaycast(object) {
    object.traverse(function (o) { o.raycast = function () {}; });
  }

  class Player {
    constructor(world, audio) {
      var C = MR.Config;
      this.world = world;
      this.audio = audio;
      this.camera = new THREE.PerspectiveCamera(C.FOV, 4 / 3, 0.05, 30);
      this.camera.rotation.order = 'YXZ';
      this.pos = new V3(6.4, 0, 3.0);
      this.yaw = 0;
      this.pitch = -0.12;
      this.bobPhase = 0;
      this.lastStepSign = 1;
      this.moving = false;
      this.time = 0;
      world.scene.add(this.camera);

      this.blink = { amount: 0, timer: U.rand(3.5, 7), phase: 'open', hold: 0 };
      this.eyesClosed = false;
      this.blinkStarted = false;
      this.blinkCount = 0;
      this.forcedBlink = false;
      this.vel = new V3();
      this.puffs = [];

      this.stepped = new MR.SteppedHold(15);
      this._buildHands();
      this.camera.position.set(this.pos.x, C.PLAYER_HEIGHT, this.pos.z);
      this.camera.rotation.set(this.pitch, this.yaw, 0);
      this._updateHands({});
    }

    _buildHands() {
      var w = this.world;
      var skin = w.mat.skin;
      this.hands = new THREE.Group();
      this.camera.add(this.hands);
      function hand(side) {
        var g = new THREE.Group();
        w.box(0.075, 0.025, 0.09, skin, 0, 0, 0, g);
        for (var f = 0; f < 4; f += 1) {
          w.box(0.014, 0.016, 0.06, skin, (f - 1.5) * 0.018, 0.002, -0.07, g);
        }
        w.box(0.016, 0.016, 0.045, skin, side * 0.045, 0, -0.025, g).rotation.y = side * 0.6;
        w.box(0.06, 0.05, 0.08, w.mat.coat, 0, -0.005, 0.08, g);
        return g;
      }
      this.left = hand(1);
      this.right = hand(-1);
      this.hands.add(this.left);
      this.hands.add(this.right);
      this.coins = [];
      for (var i = 0; i < 4; i += 1) {
        var c = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.004, 8), w.retro.material({ texture: 'yellow', color: 0xc9c0a0, emissive: 0.3 }));
        c.position.set(0, 0.016 + i * 0.005, -0.01);
        c.visible = false;
        this.left.add(c);
        this.coins.push(c);
      }
      this.heldMop = new THREE.Group();
      w.box(0.025, 1.1, 0.025, w.mat.wood, 0, -0.35, 0, this.heldMop);
      w.box(0.3, 0.07, 0.1, w.mat.lint, 0, -0.9, 0, this.heldMop);
      this.heldMop.rotation.x = 0.9;
      this.heldMop.position.set(0, -0.02, -0.05);
      this.heldMop.visible = false;
      this.right.add(this.heldMop);

      // Cigarro (mano izquierda) con brasa, petaca (mano derecha) y bocanadas de humo.
      this.cigarette = new THREE.Group();
      w.box(0.011, 0.011, 0.08, w.retro.material({ texture: 'white', color: 0xeeeeea, emissive: 0.3 }), 0, 0, 0, this.cigarette);
      w.box(0.012, 0.012, 0.022, w.retro.material({ texture: 'yellow', color: 0xc8823a }), 0, 0, 0.05, this.cigarette);
      this.ember = w.box(0.013, 0.013, 0.01, w.retro.material({ texture: 'white', color: 0xff6a20, emissive: 1.2 }), 0, 0, -0.045, this.cigarette);
      this.cigarette.position.set(0.012, 0.015, -0.085);
      this.cigarette.rotation.y = 0.5;
      this.cigarette.visible = false;
      this.left.add(this.cigarette);
      // Porro: más grueso, cónico (papel arrugado) y con la punta retorcida.
      this.jointMesh = new THREE.Group();
      var paper = w.retro.material({ texture: 'paper', color: 0xf2eedc, emissive: 0.3 });
      w.box(0.012, 0.012, 0.04, paper, 0, 0, 0.03, this.jointMesh);
      w.box(0.017, 0.017, 0.045, paper, 0, 0, -0.012, this.jointMesh);
      this.jointEmber = w.box(0.02, 0.02, 0.01, w.retro.material({ texture: 'white', color: 0xff5a18, emissive: 1.2 }), 0, 0, -0.039, this.jointMesh);
      this.jointMesh.position.set(0.012, 0.015, -0.085);
      this.jointMesh.rotation.y = 0.5;
      this.jointMesh.visible = false;
      this.left.add(this.jointMesh);
      this.flask = new THREE.Group();
      w.box(0.065, 0.1, 0.025, w.mat.metal, 0, 0.03, 0, this.flask);
      w.box(0.02, 0.018, 0.02, w.retro.material({ texture: 'metal', color: 0xb8b8b8 }), 0, 0.09, 0, this.flask);
      this.flask.position.set(0, 0.02, -0.06);
      this.flask.visible = false;
      this.right.add(this.flask);
      // Vaso de cartón del café de máquina.
      this.cup = new THREE.Group();
      var cupGeo = new THREE.CylinderGeometry(0.036, 0.028, 0.09, 8);
      this.cup.add(new THREE.Mesh(cupGeo, w.retro.material({ texture: 'white', color: 0xe8dcc0 })));
      var coffeeTop = new THREE.Mesh(new THREE.CircleGeometry(0.033, 8), w.retro.material({ texture: 'white', color: 0x3b2414, emissive: 0.1 }));
      coffeeTop.rotation.x = -Math.PI / 2;
      coffeeTop.position.y = 0.04;
      this.cup.add(coffeeTop);
      this.cup.position.set(0, 0.06, -0.1);
      this.cup.visible = false;
      this.right.add(this.cup);
      for (var p = 0; p < 4; p += 1) {
        var puff = w.box(0.06, 0.06, 0.06, w.retro.material({ texture: 'white', color: 0x8c8c8c, emissive: 0.45 }), 0, 0, 0, this.camera);
        puff.visible = false;
        this.puffs.push({ mesh: puff, t: 99 });
      }
      noRaycast(this.hands);
      this.puffs.forEach(function (pf) { noRaycast(pf.mesh); });
    }

    /** Parpadeo instantáneo (doble tap). */
    forceBlink() { this.forcedBlink = true; }

    /** Bocanada de humo frente a la cara (la del porro es más densa y verdosa). */
    puff(joint) {
      this.puffs.forEach(function (p, i) {
        p.t = -i * 0.12;
        p.mesh.material.uniforms.uColor.value.setHex(joint ? 0x9aa58f : 0x8c8c8c);
        p.big = !!joint;
      });
    }

    forward(out) {
      return (out || new V3()).set(0, 0, -1).applyEuler(this.camera.rotation);
    }

    eyePosition(out) { return (out || new V3()).copy(this.camera.position); }

    update(dt, input, ctx) {
      var C = MR.Config;
      this.time += dt;
      if (ctx.look) {
        var sens = 0.0022 * ctx.sensitivity;
        var touchSens = 0.0048 * ctx.sensitivity;
        this.yaw -= input.mouseDX * sens + input.touchLookDX * touchSens;
        var inv = ctx.invertY ? -1 : 1; // opción «Invertir el eje vertical»
        this.pitch = U.clamp(this.pitch - (input.mouseDY * sens + input.touchLookDY * touchSens) * inv, -1.35, 1.35);
      }

      // Teclado (digital) + joystick invisible (analógico); la velocidad se suaviza para caminar con fluidez.
      var mx = 0;
      var mz = 0;
      if (ctx.move) {
        if (input.down('KeyW') || input.down('ArrowUp')) { mz -= 1; }
        if (input.down('KeyS') || input.down('ArrowDown')) { mz += 1; }
        if (input.down('KeyA') || input.down('ArrowLeft')) { mx -= 1; }
        if (input.down('KeyD') || input.down('ArrowRight')) { mx += 1; }
        mx += input.moveX;
        mz += input.moveY;
      }
      var len = Math.hypot(mx, mz);
      if (len > 1) { mx /= len; mz /= len; len = 1; }
      var sin = Math.sin(this.yaw);
      var cos = Math.cos(this.yaw);
      var speed = C.WALK_SPEED * (ctx.slow ? 0.55 : 1);
      var tx = (mx * cos + mz * sin) * speed;
      var tz = (-mx * sin + mz * cos) * speed;
      var k = Math.min(1, dt * 10);
      this.vel.x += (tx - this.vel.x) * k;
      this.vel.z += (tz - this.vel.z) * k;
      var moved = Math.hypot(this.vel.x, this.vel.z);
      this.moving = moved > 0.15;
      if (moved > 0.001) {
        this.pos.x += this.vel.x * dt;
        this.pos.z += this.vel.z * dt;
        this._collide(ctx.extraColliders || []);
      }
      if (this.moving) {
        this.bobPhase += dt * moved * 4.2;
        var sign = Math.sin(this.bobPhase) >= 0 ? 1 : -1;
        if (sign !== this.lastStepSign) {
          this.lastStepSign = sign;
          this.audio.step(sign * 0.2, this.surface);
        }
      }

      var bob = this.moving ? Math.sin(this.bobPhase) * 0.028 * Math.min(1, moved / speed) : 0;
      var sway = ctx.sway || { yaw: 0, pitch: 0, roll: 0 };
      this.camera.position.set(this.pos.x, C.PLAYER_HEIGHT + bob, this.pos.z);
      this.camera.rotation.set(U.clamp(this.pitch + sway.pitch, -1.45, 1.45), this.yaw + sway.yaw, sway.roll);

      this._updateBlink(dt, input, ctx.blinkFactor || 1);
      this._updateHands(ctx);
      this._updatePuffs(dt);
    }

    _updatePuffs(dt) {
      this.puffs.forEach(function (p, i) {
        if (p.t > 1.6) { p.mesh.visible = false; return; }
        p.t += dt;
        if (p.t < 0) { p.mesh.visible = false; return; }
        p.mesh.visible = true;
        p.mesh.position.set(-0.02 + Math.sin(p.t * 3 + i) * 0.03, -0.05 + p.t * 0.12, -0.28 - p.t * 0.25);
        p.mesh.scale.setScalar((0.5 + p.t * 1.6) * (p.big ? 1.5 : 1));
      });
    }

    _collide(extra) {
      var r = MR.Config.PLAYER_RADIUS;
      var p = this.pos;
      var boxes = this.world.colliders;
      for (var pass = 0; pass < 2; pass += 1) {
        for (var i = 0; i < boxes.length; i += 1) {
          var b = boxes[i];
          if (b.off) { continue; } // p. ej. las barandas del puente, antes de que aparezca
          var cx = U.clamp(p.x, b.minX, b.maxX);
          var cz = U.clamp(p.z, b.minZ, b.maxZ);
          var dx = p.x - cx;
          var dz = p.z - cz;
          var d2 = dx * dx + dz * dz;
          if (d2 >= r * r) { continue; }
          if (d2 > 1e-10) {
            var d = Math.sqrt(d2);
            p.x = cx + dx / d * r;
            p.z = cz + dz / d * r;
          } else {
            var pen = [p.x - b.minX, b.maxX - p.x, p.z - b.minZ, b.maxZ - p.z];
            var k = pen.indexOf(Math.min.apply(null, pen));
            if (k === 0) { p.x = b.minX - r; } else if (k === 1) { p.x = b.maxX + r; } else if (k === 2) { p.z = b.minZ - r; } else { p.z = b.maxZ + r; }
          }
        }
        for (var j = 0; j < extra.length; j += 1) {
          var c = extra[j];
          var ex = p.x - c.x;
          var ez = p.z - c.z;
          var dist = Math.hypot(ex, ez);
          var min = r + c.r;
          if (dist < min && dist > 1e-6) { p.x = c.x + ex / dist * min; p.z = c.z + ez / dist * min; }
        }
      }
      // Límite del área donde estás: la sala, o el bosque (bosque.js cambia this.area al cruzar la puerta).
      var a = this.area || ROOM;
      p.x = U.clamp(p.x, a.minX + r, a.maxX - r);
      p.z = U.clamp(p.z, a.minZ + r, a.maxZ - r);
    }

    _updateBlink(dt, input, factor) {
      var b = this.blink;
      var manual = input.down('KeyB');
      this.blinkStarted = false;
      if (this.forcedBlink) {
        this.forcedBlink = false;
        if (b.phase !== 'closed') {
          b.amount = 1;
          b.phase = 'closed';
          b.hold = 0.14;
          this.blinkStarted = true;
          this.blinkCount += 1;
        }
      }
      if (b.phase === 'open') {
        b.timer -= dt;
        if (b.timer <= 0 || manual) { b.phase = 'closing'; }
      }
      if (b.phase === 'closing') {
        b.amount += dt / 0.06;
        if (b.amount >= 1) {
          b.amount = 1;
          b.phase = 'closed';
          b.hold = 0.08;
          this.blinkStarted = true;
          this.blinkCount += 1;
        }
      } else if (b.phase === 'closed') {
        b.hold -= dt;
        if (b.hold <= 0 && !manual) { b.phase = 'opening'; }
      } else if (b.phase === 'opening') {
        b.amount -= dt / 0.07;
        if (b.amount <= 0) {
          b.amount = 0;
          b.phase = 'open';
          b.timer = U.rand(3.5, 7) * factor;
        }
      }
      this.eyesClosed = b.amount >= 0.98;
    }

    /** ctx.hands: {hover, acting, wiping, wipeX, wipeY, dialing, dialAngle, coins, mop}. */
    _updateHands(ctx) {
      var h = ctx.hands || {};
      var t = this.time;
      var breathe = Math.sin(t * 1.3) * 0.006;
      var walk = this.moving ? Math.sin(this.bobPhase) * 0.016 : 0;
      var pose = {
        l: [-0.2, -0.25 + breathe - walk, -0.42, 0.15, 0.25],
        r: [0.2, -0.25 + breathe + walk, -0.42, 0.15, -0.25]
      };
      if (h.mop) {
        pose.r = [0.16, -0.3 + walk, -0.38, 0.0, -0.3];
        if (h.acting) {
          pose.r[0] += Math.sin(t * 9) * 0.04;
          pose.r[2] += Math.cos(t * 9) * 0.03;
        }
      } else if (h.dialing) {
        pose.r = [0.1, -0.15, -0.5, -0.3, -0.25 - h.dialAngle * 0.004];
      } else if (h.acting) {
        pose.r = [0.09 + Math.sin(t * 11) * 0.015, -0.14, -0.55, -0.45, -0.1];
      } else if (h.hover) {
        pose.r = [0.13, -0.17, -0.5, -0.45, -0.15];
      }
      var c = h.consumables || {};
      if (c.smoking) {
        pose.l = c.toMouth ? [-0.07, -0.115, -0.27, -0.15, 0.8] : [-0.21, -0.24 + breathe, -0.4, 0.2, 0.35];
      }
      if (c.drinking) {
        var lift = c.drinkLift;
        pose.r = [U.lerp(0.2, 0.06, lift), U.lerp(-0.25, -0.1, lift), U.lerp(-0.42, -0.26, lift), U.lerp(0.15, -0.9, lift), -0.1];
      }
      if (c.coffee) {
        var cl = c.coffeeLift;
        pose.r = [U.lerp(0.2, 0.07, cl), U.lerp(-0.25, -0.15, cl), U.lerp(-0.42, -0.31, cl), U.lerp(0.1, -0.5, cl), -0.1];
      }
      if (h.wiping) {
        pose.l = [-0.02 + h.wipeX * 0.12, -0.02 + h.wipeY * 0.09, -0.24, -1.2, 0.2];
      }
      var held = this.stepped.sample(t, pose);
      this.left.position.set(held.l[0], held.l[1], held.l[2]);
      this.left.rotation.set(held.l[3], 0, held.l[4]);
      this.right.position.set(held.r[0], held.r[1], held.r[2]);
      this.right.rotation.set(held.r[3], 0, held.r[4]);
      for (var i = 0; i < this.coins.length; i += 1) { this.coins[i].visible = !h.wiping && !c.smoking && i < (h.coins || 0); }
      this.heldMop.visible = !!h.mop;
      this.cigarette.visible = !!c.smoking && !c.joint;
      this.jointMesh.visible = !!c.joint;
      this.ember.material.uniforms.uEmissive.value = c.ember || 0;
      this.jointEmber.material.uniforms.uEmissive.value = c.ember || 0;
      this.flask.visible = !!c.drinking;
      this.cup.visible = !!c.coffee;
    }
  }

  MR.Player = Player;
})(window.MR = window.MR || {});
