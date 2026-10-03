/**
 * La Lavandería La Espuma: geometría, colisiones, luces, zonas de oclusión, anclas del Cliente Inmóvil y
 * objetos interactuables. Unidades en metros. Sala: x ∈ [-8, 8], z ∈ [-5, 5], altura 3 m.
 * Disposición: lavadoras en la pared del fondo (izquierda), secadoras (derecha), banco amarillo frente a
 * las lavadoras con el pasillo central entre ambos, mostrador junto a la entrada, almacén en la esquina.
 */
(function (MR) {
  'use strict';

  var V3 = THREE.Vector3;

  function scaleUV(geo, sx, sy) {
    var uv = geo.attributes.uv;
    for (var i = 0; i < uv.count; i += 1) { uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy); }
    uv.needsUpdate = true;
    return geo;
  }

  class World {
    constructor(retro) {
      this.retro = retro;
      this.scene = new THREE.Scene();
      this.colliders = [];
      this.interactables = [];
      this.washers = [];
      this.dryers = [];
      this.puddles = [];
      this.panels = [];
      this.mat = {};
      var R = retro;
      var m = this.mat;
      m.floor = R.material({ texture: 'floor' });
      m.wall = R.material({ texture: 'wall' });
      m.ceiling = R.material({ texture: 'ceiling' });
      m.metal = R.material({ texture: 'metal' });
      m.white = R.material({ texture: 'white', color: 0xd8d6cc });
      m.dark = R.material({ texture: 'black' });
      m.wood = R.material({ texture: 'wood' });
      m.yellow = R.material({ texture: 'yellow' });
      m.coat = R.material({ texture: 'coat' });
      m.skin = R.material({ texture: 'skin' });
      m.face = R.material({ texture: 'paleSkin' });
      m.hair = R.material({ texture: 'black' });
      m.water = R.material({ texture: 'water', emissive: 0.15 });
      m.darkWater = R.material({ texture: 'darkWater', emissive: 0.05 });
      m.paper = R.material({ texture: 'paper', emissive: 0.15 });
      m.lint = R.material({ texture: 'lint' });
      m.glass = R.material({ texture: 'glass', emissive: 0.35 });
      m.sign = R.material({ texture: 'sign', emissive: 0.9 });
      m.washerFront = R.material({ texture: 'washer' });
      m.dryerFront = R.material({ texture: 'dryer' });

      this._room();
      this._washers();
      this._dryers();
      this._bench();
      this._counter();
      this._tv();
      this._entrance();
      this._closet();
      this._puddles();
      this._customer();
      this._lights();
      this._zones();
    }

    // ---------------------------------------------------------------------------------------------
    add(mesh) { this.scene.add(mesh); return mesh; }

    box(w, h, d, mat, x, y, z, parent) {
      var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z);
      (parent || this.scene).add(mesh);
      return mesh;
    }

    collider(minX, maxX, minZ, maxZ) { this.colliders.push({ minX: minX, maxX: maxX, minZ: minZ, maxZ: maxZ }); }

    interactive(mesh, kind, index) {
      mesh.userData.interact = { kind: kind, index: index === undefined ? 0 : index };
      this.interactables.push(mesh);
      return mesh;
    }

    // ---------------------------------------------------------------------------------------------
    _room() {
      var m = this.mat;
      var floor = new THREE.Mesh(scaleUV(new THREE.PlaneGeometry(16, 10, 16, 10), 8, 5), m.floor);
      floor.rotation.x = -Math.PI / 2;
      this.add(floor);
      var ceil = new THREE.Mesh(scaleUV(new THREE.PlaneGeometry(16, 10, 16, 10), 8, 5), m.ceiling);
      ceil.rotation.x = Math.PI / 2;
      ceil.position.y = 3;
      this.add(ceil);

      var back = new THREE.Mesh(scaleUV(new THREE.PlaneGeometry(16, 3, 16, 3), 8, 1), m.wall);
      back.position.set(0, 1.5, -5);
      this.add(back);
      var left = new THREE.Mesh(scaleUV(new THREE.PlaneGeometry(10, 3, 10, 3), 5, 1), m.wall);
      left.rotation.y = Math.PI / 2;
      left.position.set(-8, 1.5, 0);
      this.add(left);
      var right = new THREE.Mesh(scaleUV(new THREE.PlaneGeometry(10, 3, 10, 3), 5, 1), m.wall);
      right.rotation.y = -Math.PI / 2;
      right.position.set(8, 1.5, 0);
      this.add(right);
      // Pared frontal con hueco para las puertas de vidrio (x ∈ [-1.6, 1.6]).
      [[-4.8, 6.4], [4.8, 6.4]].forEach(function (p) {
        var wall = new THREE.Mesh(scaleUV(new THREE.PlaneGeometry(p[1], 3, 6, 3), p[1] / 2, 1), m.wall);
        wall.rotation.y = Math.PI;
        wall.position.set(p[0], 1.5, 5);
        this.add(wall);
      }, this);
      var lintel = new THREE.Mesh(scaleUV(new THREE.PlaneGeometry(3.2, 0.6, 3, 1), 1.6, 0.2), m.wall);
      lintel.rotation.y = Math.PI;
      lintel.position.set(0, 2.7, 5);
      this.add(lintel);

      var sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), m.sign);
      sign.position.set(-4.2, 2.45, -4.97);
      this.add(sign);
      // Rodapié oscuro.
      this.box(16, 0.08, 0.04, m.dark, 0, 0.04, -4.98);
    }

    _washers() {
      var m = this.mat;
      for (var i = 0; i < 6; i += 1) {
        var x = -6.75 + i;
        var body = new THREE.Mesh(new THREE.BoxGeometry(0.86, 1.05, 0.85),
          [m.white, m.white, m.white, m.white, m.washerFront, m.white]);
        body.position.set(x, 0.525, -4.55);
        this.add(body);

        var doorPivot = new THREE.Group();
        doorPivot.position.set(x - 0.22, 0.5, -4.115);
        this.add(doorPivot);
        var door = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 12), m.metal);
        door.rotation.x = Math.PI / 2;
        door.position.set(0.22, 0, 0);
        doorPivot.add(door);
        var handle = this.box(0.04, 0.1, 0.04, m.dark, 0.4, 0, 0.03, doorPivot);
        this.interactive(door, 'washerDoor', i);
        this.interactive(handle, 'washerDoor', i);
        var drum = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.04, 0.02), m.dark);
        drum.position.set(x, 0.5, -4.13);
        this.add(drum);

        var dial = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.05, 10), m.metal);
        dial.rotation.x = Math.PI / 2;
        dial.position.set(x + 0.24, 0.93, -4.1);
        this.add(dial);
        // Marca radial en la cara de la perilla: el eje del cilindro (y local) apunta a la sala; z local es radial.
        this.box(0.014, 0.012, 0.045, m.dark, 0, 0.027, 0.03, dial);
        this.interactive(dial, 'washerDial', i);

        var slot = this.box(0.1, 0.05, 0.03, m.dark, x - 0.24, 0.93, -4.11);
        this.interactive(slot, 'washerCoin', i);

        var lamp = this.box(0.04, 0.04, 0.02, this.retro.material({ texture: 'white', color: 0x3a5a3a, emissive: 0.2 }), x, 0.93, -4.11);
        this.washers.push({ x: x, body: body, doorPivot: doorPivot, drum: drum, dial: dial, slot: slot, lamp: lamp });
      }
      this.collider(-7.25, -1.25, -5, -4.08);
    }

    _dryers() {
      var m = this.mat;
      this.box(4.0, 0.3, 0.85, m.metal, 3.0, 0.15, -4.58);
      for (var i = 0; i < 4; i += 1) {
        var x = 1.5 + i;
        var body = new THREE.Mesh(new THREE.BoxGeometry(0.86, 1.0, 0.8),
          [m.white, m.white, m.white, m.white, m.dryerFront, m.white]);
        body.position.set(x, 0.8, -4.6);
        this.add(body);
        var drum = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.02), m.dark);
        drum.position.set(x, 0.78, -4.19);
        this.add(drum);
        var filter = this.box(0.5, 0.06, 0.05, m.metal, x, 1.2, -4.19);
        this.interactive(filter, 'dryerFilter', i);
        var lint = this.box(0.44, 0.05, 0.2, m.lint, x, 1.2, -4.3);
        lint.visible = false;
        var steam = [];
        for (var s = 0; s < 3; s += 1) {
          var puff = this.box(0.12, 0.12, 0.12, this.retro.material({ texture: 'white', color: 0xdcdcdc, emissive: 0.9 }), x, 1.35, -4.15);
          puff.visible = false;
          steam.push(puff);
        }
        this.dryers.push({ x: x, body: body, drum: drum, filter: filter, lint: lint, steam: steam });
      }
      this.collider(0.95, 5.05, -5, -4.15);

      // Puerta trasera (pasillo de servicio).
      var pivot = new THREE.Group();
      pivot.position.set(6.35, 0, -4.97);
      this.add(pivot);
      this.box(0.9, 2.1, 0.05, m.wood, 0.45, 1.05, 0, pivot);
      var knob = this.box(0.08, 0.05, 0.08, m.metal, 0.78, 1.0, 0.05, pivot);
      this.interactive(knob, 'backDoor');
      this.backDoor = pivot;
    }

    _bench() {
      var m = this.mat;
      this.box(3.0, 0.08, 0.5, m.yellow, -3.5, 0.47, 0.62);
      this.box(3.0, 0.5, 0.06, m.yellow, -3.5, 0.78, 0.88);
      [-4.85, -2.15].forEach(function (x) {
        this.box(0.06, 0.45, 0.4, m.metal, x, 0.22, 0.62);
      }, this);
      this.collider(-5.05, -1.95, 0.35, 0.92);
    }

    _counter() {
      var m = this.mat;
      this.box(3.0, 1.0, 0.7, m.wood, 6.1, 0.5, 1.95);
      this.box(3.1, 0.05, 0.8, m.metal, 6.1, 1.02, 1.95);
      this.collider(4.55, 7.65, 1.55, 2.35);

      // Radio con perilla de sintonía y pantalla de frecuencia.
      this.box(0.38, 0.2, 0.18, m.dark, 5.2, 1.15, 1.95);
      this.radioDisplay = MR.Textures.dynamic(64, 16);
      var disp = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.06), this.retro.material({ map: this.radioDisplay.texture, emissive: 1.0 }));
      disp.rotation.y = Math.PI;
      disp.position.set(5.14, 1.17, 1.855);
      this.add(disp);
      var dial = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 10), m.metal);
      dial.rotation.x = Math.PI / 2;
      dial.position.set(5.33, 1.15, 1.85);
      this.add(dial);
      this.box(0.01, 0.01, 0.035, m.white, 0, 0.022, 0.02, dial);
      this.interactive(dial, 'radioDial');
      this.radioDialMesh = dial;

      // Impresora térmica y su ticket.
      this.box(0.28, 0.14, 0.25, m.white, 6.1, 1.12, 1.95);
      var paperPivot = new THREE.Group();
      paperPivot.position.set(6.1, 1.19, 1.86);
      this.add(paperPivot);
      var strip = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.2), this.mat.paper);
      strip.position.set(0, 0.1, 0);
      strip.rotation.y = Math.PI;
      paperPivot.add(strip);
      paperPivot.scale.y = 0.001;
      this.receipt = paperPivot;

      // La hoja del registro sobre el mostrador.
      var note = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.28), m.paper);
      note.rotation.x = -Math.PI / 2;
      note.position.set(6.95, 1.05, 1.85);
      this.add(note);
      this.interactive(note, 'note');
      this.note = note;

      // Reloj de pared (pared derecha, mirando hacia la sala).
      this.clockFace = MR.Textures.dynamic(64, 64);
      var clock = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), this.retro.material({ map: this.clockFace.texture, emissive: 0.5 }));
      clock.rotation.y = -Math.PI / 2;
      clock.position.set(7.97, 2.25, 1.95);
      this.add(clock);
    }

    /**
     * Tele CRT en un soporte de pared, entre lavadoras y secadoras, inclinada hacia la sala. Su pantalla es un
     * "hueco" en el lienzo por el que se ve tu música de YouTube (ver tele.js). Tocar la tele = reproducir/pausar;
     * tocar la perilla = siguiente canción.
     */
    _tv() {
      var m = this.mat;
      // Soporte: placa en la pared y brazo.
      this.box(0.3, 0.3, 0.04, m.metal, -0.1, 2.2, -4.97);
      this.box(0.06, 0.06, 0.32, m.metal, -0.1, 2.12, -4.8);
      var tv = new THREE.Group();
      tv.position.set(-0.1, 2.25, -4.5);
      tv.rotation.x = 0.17; // la pantalla mira un poco hacia abajo, a la sala
      this.add(tv);
      var plastic = this.retro.material({ texture: 'black', color: 0x4a4740 });
      var body = this.box(0.66, 0.52, 0.46, plastic, 0, 0, -0.03, tv);
      this.box(0.5, 0.38, 0.2, plastic, 0, 0, -0.32, tv);           // tubo
      // Marco alrededor de la pantalla (4:3, 0.48 x 0.36).
      var bezel = this.retro.material({ texture: 'black', color: 0x2c2a26 });
      this.box(0.6, 0.04, 0.02, bezel, 0, 0.2, 0.205, tv);
      this.box(0.6, 0.06, 0.02, bezel, 0, -0.21, 0.205, tv);
      this.box(0.04, 0.4, 0.02, bezel, -0.28, 0, 0.205, tv);
      this.box(0.08, 0.4, 0.02, bezel, 0.27, 0, 0.205, tv);
      var screen = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.36), this.retro.screenMaterial());
      screen.position.set(-0.01, 0, 0.202);
      tv.add(screen);
      // Ancla del reproductor: un poco más grande que el hueco, para que los bordes siempre muestren video.
      var anchor = new THREE.Object3D();
      anchor.position.copy(screen.position);
      tv.add(anchor);
      // Perilla de canal y foco de encendido.
      var knob = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 8), m.metal);
      knob.rotation.x = Math.PI / 2;
      knob.position.set(0.27, 0.08, 0.22);
      tv.add(knob);
      var led = this.box(0.025, 0.015, 0.01, this.retro.material({ texture: 'white', color: 0xff3020, emissive: 0.2 }), 0.27, -0.12, 0.22, tv);
      this.interactive(body, 'tele');
      this.interactive(screen, 'tele');
      this.interactive(knob, 'teleCanal');
      this.tv = { group: tv, screen: screen, anchor: anchor, knob: knob, led: led, width: 0.48, height: 0.36 };
    }

    _entrance() {
      var m = this.mat;
      [-0.8, 0.8].forEach(function (x) {
        var g = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 2.4), m.glass);
        g.rotation.y = Math.PI;
        g.position.set(x, 1.2, 4.99);
        this.add(g);
      }, this);
      this.box(0.06, 2.4, 0.08, m.metal, 0, 1.2, 4.97);
      this.collider(-1.6, 1.6, 4.92, 5.2);

      // Huella de mano en el vidrio (evento).
      var hand = MR.Textures.dynamic(32, 32);
      var x = hand.ctx;
      x.clearRect(0, 0, 32, 32);
      x.fillStyle = 'rgba(220,226,230,1)';
      x.fillRect(11, 14, 11, 12);
      [[11, 5, 2, 9], [14, 3, 2, 11], [17, 4, 2, 10], [20, 7, 2, 8], [7, 15, 4, 2]].forEach(function (r) { x.fillRect(r[0], r[1], r[2], r[3]); });
      hand.texture.needsUpdate = true;
      this.handprint = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), this.retro.material({ map: hand.texture, emissive: 0.6 }));
      this.handprint.rotation.y = Math.PI;
      this.handprint.position.set(0.55, 1.45, 4.97);
      this.handprint.visible = false;
      this.add(this.handprint);

      // Huellas mojadas desde la entrada hasta el banco (evento).
      this.footprints = new THREE.Group();
      for (var i = 0; i < 9; i += 1) {
        var f = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.26), m.water);
        f.rotation.x = -Math.PI / 2;
        var t = i / 8;
        f.position.set(MR.Util.lerp(0.2, -3.0, t) + (i % 2 ? 0.12 : -0.12), 0.011, MR.Util.lerp(4.4, 1.3, t));
        f.rotation.z = Math.atan2(-3.2, 3.1);
        this.footprints.add(f);
      }
      this.footprints.visible = false;
      this.add(this.footprints);

      // Cambiador de monedas.
      this.box(0.6, 1.5, 0.4, m.metal, -4.5, 0.75, 4.75);
      var button = this.box(0.12, 0.12, 0.05, this.retro.material({ texture: 'yellow', emissive: 0.4 }), -4.5, 1.15, 4.53);
      this.interactive(button, 'changer');
      this.collider(-4.85, -4.15, 4.5, 5);
      // Bandeja: el cambiador deja caer las monedas aquí; se recogen tocándolas.
      var tray = this.box(0.34, 0.04, 0.16, m.dark, -4.5, 0.58, 4.47);
      this.interactive(tray, 'changerTray');
      this.trayCoins = [];
      for (var c = 0; c < 4; c += 1) {
        var coin = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.008, 8), this.retro.material({ texture: 'yellow', color: 0xd8cfa8, emissive: 0.35 }));
        coin.position.set(-4.6 + c * 0.065, 0.605 + (c % 2) * 0.004, 4.45 + (c % 2) * 0.03);
        coin.visible = false;
        this.add(coin);
        this.interactive(coin, 'changerTray');
        this.trayCoins.push(coin);
      }

      // Teléfono público.
      this.box(0.24, 0.34, 0.1, m.dark, 2.7, 1.4, 4.94);
      var handset = this.box(0.06, 0.24, 0.06, m.metal, 2.62, 1.42, 4.87);
      this.interactive(handset, 'phone');
      this.phone = handset;
    }

    _closet() {
      var m = this.mat;
      // Tabique del almacén: x ∈ [-8, -6.6], z ∈ [2.0, 5]; puerta en z ∈ [3.2, 4.2].
      this.box(1.4, 3, 0.08, m.wall, -7.3, 1.5, 2.0);
      this.box(0.08, 3, 1.2, m.wall, -6.6, 1.5, 2.6);
      this.box(0.08, 3, 0.8, m.wall, -6.6, 1.5, 4.6);
      this.box(0.08, 0.8, 1.0, m.wall, -6.6, 2.6, 3.7);
      this.collider(-8, -6.55, 1.95, 2.05);
      this.collider(-6.66, -6.54, 1.95, 3.2);
      this.collider(-6.66, -6.54, 4.2, 5);
      // Cubeta y soporte del trapeador.
      var bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.3, 8), this.retro.material({ texture: 'yellow', color: 0x9aa0a6 }));
      bucket.position.set(-7.55, 0.15, 3.0);
      this.add(bucket);
      this.mop = new THREE.Group();
      this.box(0.03, 1.3, 0.03, m.wood, 0, 0.75, 0, this.mop);
      this.box(0.32, 0.08, 0.12, m.lint, 0, 0.06, 0, this.mop);
      this.mop.position.set(-7.6, 0, 4.4);
      this.mop.rotation.z = 0.12;
      this.add(this.mop);
      this.mopHome = this.mop.position.clone();
      var stand = this.box(0.4, 1.5, 0.3, this.retro.material({ texture: 'black', color: 0x444444 }), -7.75, 0.75, 4.4);
      stand.visible = true;
      this.interactive(stand, 'mopStand');
      this.mop.children.forEach(function (c) { this.interactive(c, 'mopStand'); }, this);
    }

    _puddles() {
      var spots = [[-6.3, -3.2], [-5.2, -2.3], [-4.1, -3.0], [-3.0, -2.0], [-1.9, -3.1], [-0.8, -2.4], [0.2, -3.3], [-5.8, -1.9], [-2.4, -2.9]];
      spots.forEach(function (s, i) {
        var mesh = new THREE.Mesh(new THREE.CircleGeometry(0.4, 10), this.mat.water);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(s[0], 0.012 + i * 0.0004, s[1]);
        mesh.visible = false;
        this.add(mesh);
        this.interactive(mesh, 'puddle', i);
        var stain = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), this.retro.material({ texture: 'water', color: 0x6f6b5e }));
        stain.rotation.x = Math.PI / 2;
        stain.position.set(s[0], 2.995, s[1]);
        this.add(stain);
        this.puddles.push({ mesh: mesh, x: s[0], z: s[1] });
      }, this);
    }

    _customer() {
      var m = this.mat;
      var group = new THREE.Group();
      var seated = new THREE.Group();
      var standing = new THREE.Group();
      group.add(seated);
      group.add(standing);
      function head(parent, y) {
        // Solo la cara (-z) lleva el rostro; el resto es cabello oscuro y empapado.
        var h = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.27, 0.23), [m.hair, m.hair, m.hair, m.hair, m.hair, m.face]);
        h.position.set(0, y, 0);
        parent.add(h);
        return h;
      }
      // Sentado (mirando hacia -z, hacia las lavadoras).
      this.box(0.36, 0.14, 0.46, m.coat, 0, 0.53, -0.18, seated);
      this.box(0.32, 0.5, 0.14, m.coat, 0, 0.25, -0.4, seated);
      this.box(0.34, 0.06, 0.24, m.dark, 0, 0.03, -0.5, seated);
      this.box(0.46, 0.64, 0.28, m.coat, 0, 0.88, 0.02, seated);
      this.box(0.1, 0.5, 0.12, m.coat, -0.29, 0.78, -0.06, seated);
      this.box(0.1, 0.5, 0.12, m.coat, 0.29, 0.78, -0.06, seated);
      this.seatedHead = head(seated, 1.34);
      // De pie.
      this.box(0.17, 0.9, 0.19, m.coat, -0.11, 0.45, 0, standing);
      this.box(0.17, 0.9, 0.19, m.coat, 0.11, 0.45, 0, standing);
      this.box(0.48, 1.0, 0.3, m.coat, 0, 1.08, 0, standing);
      this.box(0.1, 0.66, 0.12, m.coat, -0.3, 1.15, 0, standing);
      this.box(0.1, 0.66, 0.12, m.coat, 0.3, 1.15, 0, standing);
      this.standingHead = head(standing, 1.72);
      group.visible = false;
      this.add(group);
      this.customer = { group: group, seated: seated, standing: standing };

      // Anclas: posición, orientación (0 = mira a -z) y postura.
      this.anchors = {
        banco: { x: -3.5, z: 0.62, rot: 0, seated: true, zone: 'banco' },
        lavadoras: { x: -4.2, z: -3.4, rot: 0, seated: false, zone: 'lavadoras' },
        lavadoras_mira: { x: -1.6, z: -3.3, rot: Math.PI, seated: false, zone: 'lavadoras' },
        secadoras: { x: 2.4, z: -3.5, rot: Math.PI, seated: false, zone: 'secadoras' },
        mostrador: { x: 6.0, z: 3.2, rot: 0, seated: false, zone: 'mostrador' },
        entrada: { x: 0.4, z: 4.3, rot: Math.PI, seated: false, zone: 'entrada' },
        almacen: { x: -7.3, z: 3.5, rot: -Math.PI / 2, seated: false, zone: 'almacen' }
      };
    }

    _lights() {
      var R = this.retro;
      var cold = new THREE.Color(0.86, 0.93, 1.0);
      var spots = [
        [-5.0, 2.92, -3.0, cold, 1.15, 7.5], [-1.0, 2.92, -3.0, cold, 1.05, 7.5], [3.5, 2.92, -3.0, cold, 1.05, 7.5],
        [-4.0, 2.92, 2.0, cold, 1.0, 7.5], [2.6, 2.92, 2.6, cold, 1.1, 8.0], [-7.3, 2.6, 3.6, new THREE.Color(1.0, 0.78, 0.5), 0.75, 3.6]
      ];
      spots.forEach(function (s, i) {
        R.setLight(i, new V3(s[0], s[1], s[2]), s[3], s[4], s[5]);
        if (i < 5) {
          var panel = this.box(1.3, 0.04, 0.32, R.material({ texture: 'white', color: 0xeef4ff, emissive: 1.2 }), s[0], 2.97, s[2]);
          this.panels.push(panel);
        } else {
          this.panels.push(this.box(0.1, 0.12, 0.1, R.material({ texture: 'white', color: 0xffd9a0, emissive: 1.0 }), s[0], s[1], s[2]));
        }
      }, this);
    }

    _zones() {
      this.zones = {
        banco: { center: new V3(-3.5, 0.8, 0.6), radius: 1.8 },
        lavadoras: { center: new V3(-3.8, 0.8, -3.6), radius: 2.6 },
        secadoras: { center: new V3(3.0, 0.9, -3.8), radius: 2.0 },
        mostrador: { center: new V3(6.0, 1.0, 2.6), radius: 1.6 },
        entrada: { center: new V3(0.0, 1.2, 4.5), radius: 1.8 },
        almacen: { center: new V3(-7.3, 1.2, 3.5), radius: 1.2 },
        puerta_trasera: { center: new V3(6.8, 1.1, -4.7), radius: 0.9 }
      };
    }
  }

  MR.World = World;
})(window.MR = window.MR || {});
