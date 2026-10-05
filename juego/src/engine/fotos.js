/**
 * Fotos con la cámara del celular (P, Y/△ en el mando, o «Sacar una foto» en la pausa).
 * - La foto es lo que ves, a 320×240 como el juego, con flash. Aparece un momento como polaroid en la esquina.
 * - Se guardan las últimas 12 en este navegador (midnight-rinse/fotos) y se ven en el panel «Fotos» del título.
 * - A veces, en la foto, él está de pie frente a ti aunque en el cuarto no haya nadie (nunca en Paseo).
 */
(function (MR) {
  'use strict';

  var KEY = 'midnight-rinse/fotos';
  var MAX = 12;
  var W = 320;
  var H = 240;

  class Fotos {
    constructor(game) {
      this.game = game;
      this.list = this._load();
      this.cooldown = 0;
      this.tonight = 0;
      this.ghosts = 0;
      this.canvas = document.createElement('canvas');
      this.canvas.width = W;
      this.canvas.height = H;
      this.ray = new THREE.Raycaster();
      this.areas = {}; // dónde sacaste fotos este turno (logro «Álbum de la noche»)
      this.catSeen = false;
    }

    _load() {
      try { return JSON.parse(window.localStorage.getItem(KEY) || '[]') || []; } catch (e) { return []; }
    }

    _save() {
      // Si no cabe, se van las más viejas.
      while (this.list.length) {
        try { window.localStorage.setItem(KEY, JSON.stringify(this.list)); return; } catch (e) { this.list.shift(); }
      }
      try { window.localStorage.removeItem(KEY); } catch (e) { /* sin almacenamiento */ }
    }

    count() { return this.list.length; }

    /** La última foto que sacaste en este turno (o null). */
    lastTonight() { return this.tonight > 0 && this.list.length ? this.list[this.list.length - 1] : null; }

    update(dt) { this.cooldown = Math.max(0, this.cooldown - dt); }

    /** ¿Puede salir él en esta foto? (ya lo viste o no es tu primera noche; nunca en Paseo; no si ya está a la vista). */
    _ghostAllowed() {
      var g = this.game;
      if (g.diff && g.diff.sinSustos) { return false; }
      if (!g.flags.customerSeen && (g.night || 1) < 2) { return false; }
      return !(g.world.customer.group.visible && g.horror.customer.present);
    }

    /** ¿Ese punto sale en la foto (en pantalla y a menos de `max` metros)? */
    _inFrame(p, cam, max) {
      var v = p.clone();
      if (v.distanceTo(cam.getWorldPosition(new THREE.Vector3())) > max) { return false; }
      v.project(cam);
      return Math.abs(v.x) < 0.9 && Math.abs(v.y) < 0.9 && v.z < 1;
    }

    /**
     * Las caras blancas (y el niño) que salen en la foto: en cuadro, a menos de 9 m y **de frente** a la cámara (de
     * espaldas no se ve la cara). También las de afuera: la que cruza la avenida, la vigía y la que se despide.
     */
    _caras(cam) {
      var g = this.game;
      var out = [];
      var self = this;
      var cl = g.clientela;
      if (!cl) { return out; }
      var camPos = cam.getWorldPosition(new THREE.Vector3());
      var modelos = [];
      cl.visitors.forEach(function (v) { modelos.push(v.model); if (v.child) { modelos.push(v.child.model); } });
      if (cl.approach) { modelos.push(cl.approach.model); }
      [cl.watcher, cl.waver].forEach(function (m) { if (m) { modelos.push(m); } });
      modelos.forEach(function (m) {
        if (!m || !m.face || !self._visibleTree(m.face)) { return; }
        var fp = m.face.getWorldPosition(new THREE.Vector3());
        if (!self._inFrame(fp.clone(), cam, 9)) { return; }
        var normal = new THREE.Vector3(0, 0, 1).applyQuaternion(m.face.getWorldQuaternion(new THREE.Quaternion()));
        var hacia = camPos.clone().sub(fp).normalize();
        if (normal.dot(hacia) > 0.25) { out.push({ mesh: m.face }); }
      });
      return out;
    }

    /** Las máscaras negras que saldrían en la foto (en cuadro y a menos de 9 m): no salen. */
    _mascaras(cam) {
      var g = this.game;
      var self = this;
      if (!g.clientela) { return []; }
      return g.clientela.visitors.filter(function (v) {
        return v.kind === 'mascara' && v.model.group.visible && self._inFrame(v.model.head.getWorldPosition(new THREE.Vector3()), cam, 9);
      }).map(function (v) { return v.model; });
    }

    _visibleTree(o) {
      for (; o; o = o.parent) { if (!o.visible) { return false; } }
      return true;
    }

    /** Dónde ponerlo: frente a la cámara, sin atravesar paredes. Devuelve la distancia o 0 si no hay espacio. */
    _ghostDistance(cam, dir) {
      var g = this.game;
      this.ray.set(cam.getWorldPosition(new THREE.Vector3()), dir);
      this.ray.far = 3.2;
      var cust = g.world.customer.group;
      // Solo mallas visibles del mundo: ni él, ni lo que llevas en las manos (cuelga de la cámara), ni la lluvia.
      var hits = this.ray.intersectObjects(g.world.scene.children, true).filter(function (h) {
        if (!h.object.isMesh) { return false; }
        for (var o = h.object; o; o = o.parent) { if (o === cust || o === cam || o.visible === false) { return false; } }
        return true;
      });
      var d = hits.length ? hits[0].distance - 0.6 : 2.4;
      return d >= 1.3 ? Math.min(2.4, d) : 0;
    }

    /**
     * Saca la foto. opts.ghost: true/false fuerza que salga él o no (pruebas); si no, 35 % cuando se permite.
     * Devuelve la foto guardada, o null si el flash aún está cargando.
     */
    take(opts) {
      opts = opts || {};
      var g = this.game;
      if (this.cooldown > 0 || g.state !== 'playing') { return null; }
      this.cooldown = 1.6;
      var cam = g.player.camera;
      cam.updateMatrixWorld();
      var dir = new THREE.Vector3();
      cam.getWorldDirection(dir);
      dir.y = 0;
      if (dir.lengthSq() < 1e-6) { dir.set(0, 0, -1); }
      dir.normalize();
      var want = opts.ghost !== undefined ? opts.ghost : (this._ghostAllowed() && Math.random() < 0.35);
      var dist = want ? this._ghostDistance(cam, dir) : 0;
      var c = g.world.customer;
      var saved = null;
      if (dist) {
        // Solo para la foto: él, de pie, frente a ti. Después todo vuelve a como estaba.
        saved = { pos: c.group.position.clone(), rot: c.group.rotation.y, vis: c.group.visible, seated: c.seated.visible, standing: c.standing.visible };
        var p = g.player.pos;
        var x = p.x + dir.x * dist;
        var z = p.z + dir.z * dist;
        c.group.position.set(x, p.y, z);
        c.group.rotation.y = Math.atan2(-(p.x - x), -(p.z - z));
        c.seated.visible = false;
        c.standing.visible = true;
        c.group.visible = true;
      }
      // Lo que la cámara ve: en la foto, las caras blancas (y el niño) tienen el rostro que tenían antes.
      var caras = this._caras(cam);
      var antiguo = this.antiguo || (this.antiguo = g.retro.material({ texture: 'rostroAntiguo', emissive: 0.35 }));
      caras.forEach(function (f) { f.guardado = f.mesh.material; f.mesh.material = antiguo; });
      // Los pasajeros del 86, también.
      var riders = g.world.city && g.world.city.busRiders;
      var enBus = !!(riders && this._visibleTree(riders) && this._inFrame(g.world.city.bus.position.clone().setY(1.8), cam, 14));
      var ridersMat = enBus ? riders.material : null;
      if (enBus) { riders.material = antiguo; }
      // Las máscaras negras no salen en las fotos: frente al mostrador no hay nadie.
      var mascaras = this._mascaras(cam);
      mascaras.forEach(function (m) { m.group.visible = false; });
      // La foto: un cuadro con flash, copiado al instante (antes de que el navegador limpie el lienzo).
      g.retro.render(g.world.scene, cam, { blink: 0, dread: g.dread, time: performance.now() / 1000, flash: 0.1, collapse: g.collapsed ? 1 : 0,
        high: g.consumables.high, crt: false, gamma: g.ui.options.brightness });
      var x2 = this.canvas.getContext('2d');
      x2.imageSmoothingEnabled = false;
      x2.fillStyle = '#000';
      x2.fillRect(0, 0, W, H);
      x2.drawImage(g.retro.renderer.domElement, 0, 0, W, H);
      var src = '';
      try { src = this.canvas.toDataURL('image/jpeg', 0.82); } catch (e) { src = ''; }
      caras.forEach(function (f) { f.mesh.material = f.guardado; }); // a la vista, otra vez lisas
      if (ridersMat) { riders.material = ridersMat; }
      mascaras.forEach(function (m) { m.group.visible = true; });
      if (saved) {
        c.group.position.copy(saved.pos);
        c.group.rotation.y = saved.rot;
        c.group.visible = saved.vis;
        c.seated.visible = saved.seated;
        c.standing.visible = saved.standing;
      }
      var foto = { src: src, hora: MR.Util.clockText(Math.floor(g.minutes)), noche: g.night || 1, el: !!dist, t: Date.now(), caras: caras.length + (enBus ? 5 : 0),
        mascaras: mascaras.length };
      this.list.push(foto);
      while (this.list.length > MAX) { this.list.shift(); }
      this._save();
      this.tonight += 1;
      // Flash en pantalla (suave si se pidió reducir destellos) y obturador.
      g.horror.flash = Math.max(g.horror.flash, g.options.reduceFlashes ? 0.12 : 0.45);
      g.audio.obturador();
      MR.Haptics.pulse(20);
      g.ui.showPolaroid(foto);
      g.ui.renderFotos(this);
      // Álbum: una foto en cada lugar (lavandería, bosque y pasillo) en el mismo turno.
      var area = g.bosque.outside ? 'bosque' : (g.pasillo.inside ? 'pasillo' : 'sala');
      this.areas[area] = true;
      if (this.areas.sala && this.areas.bosque && this.areas.pasillo && g.logros) { g.logros.unlock('album'); }
      // Pelusa en la foto (una vez por turno): siempre sale movida.
      if (!dist && !this.catSeen && g.gato && g.gato.mesh.root.visible && this._inFrame(g.gato.position(), cam, 4.5)) {
        this.catSeen = true;
        setTimeout(function () {
          if (g.state === 'playing') { g.ui.subtitle('(Revisas la foto: Pelusa sale movida, como en todas las fotos.)', 4); }
        }, 700);
      }
      if (mascaras.length && !this.masksSeen) {
        this.masksSeen = true;
        setTimeout(function () {
          if (g.state !== 'playing') { return; }
          g.ui.subtitle('(Revisas la foto. Frente al mostrador no hay nadie. Solo la impresora, imprimiendo.)', 6);
          g.dread = Math.min(1, g.dread + 0.05);
        }, 800);
      }
      if (enBus && !this.busSeen) {
        this.busSeen = true;
        setTimeout(function () {
          if (g.state === 'playing') { g.ui.subtitle('(En la foto, los pasajeros del 86 tienen cara. Todos miran hacia otro lado.)', 6); }
        }, 1600);
      }
      if (caras.length && !this.facesSeen) {
        this.facesSeen = true;
        setTimeout(function () {
          if (g.state !== 'playing') { return; }
          g.ui.subtitle('(Revisas la foto. En la foto, la cara blanca tiene ojos, nariz y boca. Mira hacia otro lado.)', 6);
          g.dread = Math.min(1, g.dread + 0.04);
          if (g.logros) { g.logros.unlock('retrato'); }
        }, 800);
      }
      if (dist) {
        this.ghosts += 1;
        setTimeout(function () {
          if (g.state !== 'playing') { return; }
          g.ui.subtitle('(Revisas la foto. Hay alguien de pie frente a ti. Levantas la vista: no hay nadie.)', 6);
          g.audio.thud();
          MR.Haptics.pulse(140);
          g.dread = Math.min(1, g.dread + 0.15);
          if (g.logros) { g.logros.unlock('foto'); }
        }, 900);
      }
      return foto;
    }
  }

  /** Foto → archivo JPEG para compartirlo (sin esperas: Safari pide compartir dentro del mismo toque). */
  Fotos.toFile = function (f) {
    var b64 = String(f.src).split(',')[1] || '';
    var bin = window.atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i += 1) { bytes[i] = bin.charCodeAt(i); }
    return new File([bytes], 'midnight-rinse-noche' + f.noche + '-' + String(f.hora).replace(':', '') + '.jpg', { type: 'image/jpeg' });
  };

  /** ¿Este navegador puede compartir una foto (menú del teléfono)? */
  Fotos.canShare = function (f) {
    if (!f || !navigator.share || !navigator.canShare) { return false; }
    try { return navigator.canShare({ files: [Fotos.toFile(f)] }); } catch (e) { return false; }
  };

  MR.Fotos = Fotos;
})(window.MR = window.MR || {});
