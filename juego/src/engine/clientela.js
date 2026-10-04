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
      if (kind === 'cara') {
        var coat = R.material({ texture: 'white', color: COATS[Math.floor(Math.random() * COATS.length)] });
        var wet = R.material({ texture: 'white', color: 0x2b2f33 });
        w.box(0.13, 0.85, 0.15, wet, -0.09, 0.43, 0, g);
        w.box(0.13, 0.85, 0.15, wet, 0.09, 0.43, 0, g);
        w.box(0.44, 0.72, 0.28, coat, 0, 1.2, 0, g);
        w.box(0.09, 0.68, 0.11, coat, -0.27, 1.18, 0, g);
        w.box(0.09, 0.68, 0.11, coat, 0.27, 1.18, 0, g);
        var bag = w.box(0.34, 0.3, 0.22, R.material({ texture: 'white', color: 0x7a7d80 }), 0.36, 0.8, -0.05, g); // la ropa empapada
        bag.rotation.z = 0.1;
        // La cara: lisa y blanca, sin rasgos (solo la cara de -z).
        var white = R.material({ texture: 'white', color: 0xe9e7e0, emissive: 0.25 });
        head = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.25, 0.21), [wet, wet, wet, wet, wet, white]);
        head.position.set(0, 1.7, 0);
        g.add(head);
      } else {
        var suit = R.material({ texture: 'white', color: 0x15161a });
        w.box(0.15, 1.0, 0.17, suit, -0.1, 0.5, 0, g);
        w.box(0.15, 1.0, 0.17, suit, 0.1, 0.5, 0, g);
        w.box(0.5, 0.85, 0.3, suit, 0, 1.42, 0, g);
        w.box(0.09, 0.85, 0.11, suit, -0.3, 1.38, 0, g);
        w.box(0.09, 0.85, 0.11, suit, 0.3, 1.38, 0, g);
        w.box(0.05, 0.4, 0.02, R.material({ texture: 'white', color: 0x3a3c42 }), 0, 1.55, -0.16, g); // corbata
        // La máscara: negra, de caras planas (Gouraud por vértice: se ven las facetas).
        head = new THREE.Mesh(new THREE.OctahedronGeometry(0.17, 0), R.material({ texture: 'white', color: 0x0c0c10, emissive: 0.05 }));
        head.scale.set(0.9, 1.2, 0.9);
        head.position.set(0, 2.08, 0);
        g.add(head);
      }
      g.visible = true;
      return { group: g, head: head };
    }

    // -------------------------------------------------------------------------------------------- afuera
    /** Una cara blanca cruza la avenida hacia la puerta, sin paraguas (la ves por la vidriera). */
    _startApproach() {
      var m = this._model('cara');
      var from = [U.rand(3.8, 7.2), 11.9];
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
        return;
      }
      pos.x += dx / d * step;
      pos.z += dz / d * step;
      a.model.group.rotation.y = Math.atan2(-dx, -dz);
      a.bob = (a.bob || 0) + dt * 7;
      pos.y = 0.12 + Math.abs(Math.sin(a.bob)) * 0.03;
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
      model.group.traverse(function (o) { if (o.isMesh) { o.userData.interact = { kind: 'visitante', index: id }; } });
      model.group.children.forEach(function (o) { this.world.interactables.push(o); }, this);
      var v = { id: id, kind: kind, model: model, path: target.path.slice(), rot: target.rot, washer: target.washer, state: 'entra', timer: 0, said: false };
      this.visitors.push(v);
      g.audio.door();
      return v;
    }

    _remove(v) {
      var w = this.world;
      w.scene.remove(v.model.group);
      for (var i = w.interactables.length - 1; i >= 0; i -= 1) {
        if (v.model.group.children.indexOf(w.interactables[i]) >= 0) { w.interactables.splice(i, 1); }
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
      this._converse(v, MR.HISTORIA.blackwood.charla.preguntas.slice());
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
      this._stepWatcher(inSala);
      var self = this;
      this.visitors.slice().forEach(function (v) { self._step(v, dt); });
    }

    _step(v, dt) {
      var g = this.game;
      var grp = v.model.group;
      var pos = grp.position;
      if (v.state === 'entra' || v.state === 'sale') {
        var tgt = v.path[0];
        if (!tgt) {
          if (v.state === 'sale') { g.audio.door(); this._remove(v); return; }
          v.state = 'llego';
          v.timer = 0;
          grp.rotation.y = v.rot;
          this._arrive(v);
          return;
        }
        var dx = tgt[0] - pos.x;
        var dz = tgt[1] - pos.z;
        var d = Math.hypot(dx, dz);
        // Si estás en su camino, espera (nunca te empuja ni te atraviesa).
        var pp = g.player.pos;
        var ahead = Math.hypot(pp.x - (pos.x + dx / Math.max(d, 0.01) * 0.5), pp.z - (pos.z + dz / Math.max(d, 0.01) * 0.5));
        if (ahead < 0.55) { return; }
        var stepLen = SPEED * dt;
        if (d <= stepLen) { pos.set(tgt[0], 0, tgt[1]); v.path.shift(); }
        else { pos.x += dx / d * stepLen; pos.z += dz / d * stepLen; }
        grp.rotation.y = Math.atan2(-dx, -dz);
        v.bob = (v.bob || 0) + dt * 7;
        pos.y = Math.abs(Math.sin(v.bob)) * 0.03;
      } else if (v.state === 'llego') {
        v.timer += dt;
        if (v.kind === 'cara') {
          // Nunca te mira: si lo miras de cerca, gira la cara hacia otro lado.
          var lookAt = this._watched(v);
          v.model.head.rotation.y += ((lookAt ? 1.1 : 0) - v.model.head.rotation.y) * Math.min(1, dt * 3);
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
