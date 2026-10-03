/**
 * Continuar turno: la partida se guarda sola (cada 10 s y al pausar o salir de la app) en
 * midnight-rinse/partida, y la pantalla de título ofrece «Continuar turno (02:47)». Al terminar el turno o al
 * empezar uno nuevo, el guardado se borra. No se guarda con una pregunta abierta (la escena no se repite).
 */
(function (MR) {
  'use strict';

  var KEY = 'midnight-rinse/partida';
  var VERSION = 1;

  function copy(o) { return JSON.parse(JSON.stringify(o || {})); }

  MR.Partida = {
    /** Foto del turno (solo datos, sin objetos de three.js). */
    snapshot: function (g) {
      var gp = g.gameplay;
      var h = g.horror;
      var c = g.consumables;
      return {
        v: VERSION,
        savedAt: Date.now(),
        difficulty: g.options.difficulty || 'normal',
        minutes: g.minutes,
        dread: g.dread,
        collapsed: g.collapsed,
        talked: g.talked,
        mopChecksDone: g.mopChecksDone,
        flags: copy(g.flags),
        stats: copy(g.stats),
        player: { x: g.player.pos.x, z: g.player.pos.z, yaw: g.player.yaw, pitch: g.player.pitch },
        bosque: { outside: g.bosque.outside, visits: g.bosque.visits, found: (g.bosque.found || []).slice() },
        consumables: { cigarettes: c.cigarettes, sips: c.sips, joints: c.joints, used: copy(c.used), tipsy: c.tipsy, high: c.high, awake: c.awake },
        gameplay: {
          coins: gp.coins, trayCoins: gp.trayCoins, mopHeld: gp.mopHeld, nextPuddle: gp.nextPuddle,
          puddleActive: gp.puddleActive.slice(), radioRaw: gp.radioRaw,
          washers: gp.washers.map(function (w) { return { running: w.running, remaining: w.remaining, credit: w.credit, doorTarget: w.doorTarget }; }),
          dryers: gp.dryers.map(function (d) { return { running: d.running, lint: d.lint, overheated: d.overheated, stopIn: d.stopIn }; })
        },
        horror: { present: h.customer.present, anchor: h.customer.anchor, nextEvent: h.nextEvent },
        gato: { pets: g.gato.pets, hisses: g.gato.hisses },
        pasillo: { unlocked: g.pasillo.unlocked, inside: g.pasillo.inside, visits: g.pasillo.visits, fuses: g.pasillo.fuses }
      };
    },

    save: function (g) {
      if (g.state !== 'playing' && g.state !== 'paused') { return false; }
      if (g.question || (g.bosque && g.bosque.travel)) { return false; }
      try { window.localStorage.setItem(KEY, JSON.stringify(this.snapshot(g))); return true; } catch (e) { return false; }
    },

    load: function () {
      try {
        var d = JSON.parse(window.localStorage.getItem(KEY) || 'null');
        return d && d.v === VERSION ? d : null;
      } catch (e) { return null; }
    },

    clear: function () { try { window.localStorage.removeItem(KEY); } catch (e) { /* sin almacenamiento */ } },

    /** Aplica una foto a un turno recién empezado (game.start() ya corrió). */
    restore: function (g, d) {
      var gp = g.gameplay;
      g.minutes = d.minutes;
      g.dread = d.dread;
      g.talked = d.talked;
      g.mopChecksDone = d.mopChecksDone;
      g.flags = copy(d.flags);
      g.stats = Object.assign(g.stats, copy(d.stats));
      if (d.collapsed && !g.collapsed) { g.collapsed = true; gp.collapsed = true; }
      // Consumibles.
      var c = g.consumables;
      c.cigarettes = d.consumables.cigarettes; c.sips = d.consumables.sips; c.joints = d.consumables.joints;
      c.used = Object.assign({ cafes: 0 }, copy(d.consumables.used)); c.tipsy = d.consumables.tipsy; c.high = d.consumables.high;
      c.awake = d.consumables.awake || 0;
      g.ui.updateConsumables(c);
      // Lavandería.
      gp.coins = d.gameplay.coins;
      gp.trayCoins = d.gameplay.trayCoins;
      gp._showTray();
      gp.nextPuddle = d.gameplay.nextPuddle;
      gp.puddleActive = d.gameplay.puddleActive.slice();
      gp._applyPuddles();
      d.gameplay.washers.forEach(function (w, i) { Object.assign(gp.washers[i], w); });
      d.gameplay.dryers.forEach(function (w, i) { Object.assign(gp.dryers[i], w); });
      gp.radioRaw = d.gameplay.radioRaw;
      gp.radioFreq = 88 + gp.radioRaw / 720 * 20;
      g.world.radioDialMesh.rotation.y = -gp.radioRaw * Math.PI / 180;
      gp._drawRadio();
      if (d.gameplay.mopHeld && !gp.mopHeld) { gp._toggleMop(); }
      if (g.flags.registryText) { g.ui.refreshRegistry(); }
      // Él.
      var h = g.horror;
      h.nextEvent = d.horror.nextEvent;
      if (d.horror.present) {
        var anchor = g.world.anchors[d.horror.anchor] ? d.horror.anchor : 'banco';
        h._placeAt(anchor);
        h.customer.present = true;
      }
      // Bosque y hojas.
      var b = g.bosque;
      if (d.bosque.found && d.bosque.found.length) {
        b.found = d.bosque.found.slice();
        b.found.forEach(function (f, i) { if (f) { g.world.forest.pages[i].visible = false; } });
      }
      if (d.bosque.outside) { b._swap(true); b.firstTime = false; }
      b.visits = d.bosque.visits;
      if (d.pasillo) {
        if (d.pasillo.unlocked) { g.pasillo.unlock(true); }
        if (d.pasillo.fuses) { g.pasillo.fuses = true; g.world.pasillo.fuseLed.material.uniforms.uColor.value.setHex(0x40ff60); }
        if (d.pasillo.inside) { g.pasillo._swap(true); g.pasillo.firstTime = false; }
        g.pasillo.visits = d.pasillo.visits;
      }
      g.gato.pets = d.gato.pets;
      g.gato.hisses = d.gato.hisses;
      // Jugador (después del cruce, que lo pone en la puerta).
      g.player.pos.set(d.player.x, 0, d.player.z);
      g.player.yaw = d.player.yaw;
      g.player.pitch = d.player.pitch;
      g.ui.lines = [];
      g.ui.subtitle('(Continúas el turno. Son las ' + MR.Util.clockText(Math.floor(d.minutes)) + '.)', 4);
    }
  };
})(window.MR = window.MR || {});
