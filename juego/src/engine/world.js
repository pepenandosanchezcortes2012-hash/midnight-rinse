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

  /**
   * Une muchas piezas (árboles, rocas) en una sola geometría: un solo dibujo para todo el bosque, que en el
   * celular importa. parts: [{geo, matrix, su, sv}] (su/sv repiten la textura).
   */
  function mergeParts(parts) {
    var pos = [];
    var nor = [];
    var uvs = [];
    var v = new V3();
    var nm = new THREE.Matrix3();
    parts.forEach(function (it) {
      var g = it.geo.index ? it.geo.toNonIndexed() : it.geo;
      var p = g.attributes.position;
      var n = g.attributes.normal;
      var u = g.attributes.uv;
      nm.getNormalMatrix(it.matrix);
      for (var i = 0; i < p.count; i += 1) {
        v.fromBufferAttribute(p, i).applyMatrix4(it.matrix);
        pos.push(v.x, v.y, v.z);
        v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
        nor.push(v.x, v.y, v.z);
        uvs.push(u.getX(i) * (it.su || 1), u.getY(i) * (it.sv || 1));
      }
    });
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.computeBoundingSphere();
    return geo;
  }

  /** Mesh que no participa en los rayos de interacción (decorado grande: suelo, árboles). */
  function inert(mesh) { mesh.raycast = function () {}; return mesh; }

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
      m.face = R.material({ texture: 'rostro' });
      m.paleHand = R.material({ texture: 'paleSkin' }); // las manos de él (m.skin es la piel del jugador)
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
      this._cafe();
      this._entrance();
      this._city();
      this._closet();
      this._puddles();
      this._customer();
      this._lights();
      this._zones();
      this._forest();
      this._pasillo();
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
      // Pared frontal con hueco para las puertas de vidrio (x ∈ [-1.6, 1.6]) y dos vidrieras a la avenida:
      // x ∈ [-7.6, -5.3] y x ∈ [3.5, 7.6], de 0.95 m a 2.45 m de alto (la ciudad, en _city()).
      [[-8, -7.6, 0, 3], [-7.6, -5.3, 0, 0.95], [-7.6, -5.3, 2.45, 3], [-5.3, -1.6, 0, 3],
        [1.6, 3.5, 0, 3], [3.5, 7.6, 0, 0.95], [3.5, 7.6, 2.45, 3], [7.6, 8, 0, 3]].forEach(function (r) {
        var w = r[1] - r[0];
        var h = r[3] - r[2];
        var wall = new THREE.Mesh(scaleUV(new THREE.PlaneGeometry(w, h, Math.max(1, Math.round(w)), Math.max(1, Math.round(h))), w / 2, h / 3), m.wall);
        wall.rotation.y = Math.PI;
        wall.position.set((r[0] + r[1]) / 2, (r[2] + r[3]) / 2, 5);
        this.add(wall);
      }, this);
      // Marcos de las vidrieras (y el parteluz de la grande).
      // Inertes al rayo: un toque sobre el marco o el parteluz llega igual a la vidriera.
      [[-6.45, 2.3], [5.55, 4.1]].forEach(function (v) {
        inert(this.box(v[1] + 0.1, 0.08, 0.16, m.metal, v[0], 0.95, 4.97));
        inert(this.box(v[1] + 0.1, 0.06, 0.1, m.metal, v[0], 2.45, 4.98));
        inert(this.box(0.06, 1.5, 0.1, m.metal, v[0] - v[1] / 2, 1.7, 4.98));
        inert(this.box(0.06, 1.5, 0.1, m.metal, v[0] + v[1] / 2, 1.7, 4.98));
      }, this);
      inert(this.box(0.06, 1.5, 0.1, m.metal, 5.55, 1.7, 4.98));
      var lintel = new THREE.Mesh(scaleUV(new THREE.PlaneGeometry(3.2, 0.6, 3, 1), 1.6, 0.2), m.wall);
      lintel.rotation.y = Math.PI;
      lintel.position.set(0, 2.7, 5);
      this.add(lintel);

      var sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6, 3, 1), m.sign);
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
        var porthole = new THREE.Mesh(new THREE.CircleGeometry(0.16, 12), m.glass);
        porthole.position.set(0.22, 0, 0.025);
        doorPivot.add(porthole);
        this.interactive(porthole, 'washerDoor', i);
        this.interactive(handle, 'washerDoor', i);
        // La ropa que gira detrás del vidrio: solo se ve con la lavadora en marcha (gameplay.js). Se toca como la puerta.
        var drum = new THREE.Mesh(new THREE.CircleGeometry(0.15, 12), this.retro.material({ texture: 'ropaGira', emissive: 0.3 }));
        drum.position.set(0.22, 0, 0.028);
        drum.visible = false;
        doorPivot.add(drum);
        this.interactive(drum, 'washerDoor', i);

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
        this.washers.push({ porthole: porthole, x: x, body: body, doorPivot: doorPivot, drum: drum, dial: dial, slot: slot, lamp: lamp });
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
        // La ropa que da vueltas en la secadora (solo se ve en marcha: gameplay.js).
        var drum = new THREE.Mesh(new THREE.CircleGeometry(0.15, 12), this.retro.material({ texture: 'ropaSeca', emissive: 0.35 }));
        drum.position.set(x, 0.78, -4.195);
        drum.visible = false;
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
        this.interactive(body, 'dryerStart', i); // una moneda y gira (el filtro, delante, tiene prioridad)
        this.interactive(drum, 'dryerStart', i);
        this.dryers.push({ x: x, body: body, drum: drum, filter: filter, lint: lint, steam: steam });
      }
      this.collider(0.95, 5.05, -5, -4.15);

      // El cesto de ropa entre lavadoras y secadoras: se llena de uniformes cuando no lo miras (horror.js, «cesto»).
      var basket = new THREE.Group();
      basket.position.set(0.45, 0, -3.75);
      var plastic = this.retro.material({ texture: 'white', color: 0x4d5a66 });
      this.box(0.56, 0.03, 0.4, plastic, 0, 0.015, 0, basket);
      [[0, 0.2, 0.19, 0.56, 0.03], [0, 0.2, -0.19, 0.56, 0.03], [0.27, 0.2, 0, 0.03, 0.4], [-0.27, 0.2, 0, 0.03, 0.4]].forEach(function (s) {
        this.box(s[3], 0.38, s[4], plastic, s[0], s[1], s[2], basket);
      }, this);
      var uniform = this.retro.material({ texture: 'white', color: 0x6f7f8f });
      this.basketPiles = [];
      for (var bp = 0; bp < 3; bp += 1) {
        var pile = this.box(0.48 - bp * 0.03, 0.12, 0.32 - bp * 0.02, uniform, (bp - 1) * 0.02, 0.08 + bp * 0.14, (1 - bp) * 0.015, basket);
        pile.rotation.y = (bp - 1) * 0.12;
        pile.visible = false;
        this.basketPiles.push(pile);
      }
      basket.children.forEach(function (c) { this.interactive(c, 'cesto'); }, this);
      this.add(basket);
      this.basket = basket;
      this.collider(0.15, 0.75, -4.0, -3.5);

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
      // El banco amarillo se puede tocar: frío, tibio… o él sentado ahí (game.touchBench).
      this.interactive(this.box(3.0, 0.08, 0.5, m.yellow, -3.5, 0.47, 0.62), 'banco');
      this.interactive(this.box(3.0, 0.5, 0.06, m.yellow, -3.5, 0.78, 0.88), 'banco');
      [-4.85, -2.15].forEach(function (x) {
        this.box(0.06, 0.45, 0.4, m.metal, x, 0.22, 0.62);
      }, this);
      this.collider(-5.05, -1.95, 0.35, 0.92);
      // Su sombrero, solo, sobre el asiento: queda ahí cuando se va con la hora verdadera (game.js, horror.js).
      var hat = new THREE.Group();
      hat.position.set(-3.25, 0.51, 0.6);
      hat.rotation.y = 0.4;
      // El mismo sombrero que lleva puesto (_customer): ala un poco caída, copa y cinta.
      var brim = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.3, 0.03, 10), m.dark);
      brim.position.y = 0.015;
      hat.add(brim);
      var crown = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.17, 8), m.dark);
      crown.position.y = 0.105;
      hat.add(crown);
      var band = new THREE.Mesh(new THREE.CylinderGeometry(0.142, 0.142, 0.035, 8), this.retro.material({ texture: 'white', color: 0x2c2522 }));
      band.position.y = 0.045;
      hat.add(band);
      hat.visible = false;
      this.add(hat);
      this.loneHat = hat;
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

      // Tablilla de tareas (estado del turno, sin HUD).
      var board = this.box(0.24, 0.015, 0.32, this.mat.wood, 5.62, 1.055, 1.72);
      board.rotation.y = 0.25;
      var sheet = this.box(0.2, 0.01, 0.26, this.mat.paper, 0, 0.012, 0.01, board);
      this.box(0.08, 0.02, 0.03, this.mat.metal, 0, 0.015, -0.14, board);
      this.interactive(board, 'tareas');
      this.interactive(sheet, 'tareas');
      // «Ropa doblada»: una pila que nadie trajo (horror.js la muestra cuando no miras el mostrador).
      var clothes = new THREE.Group();
      clothes.position.set(6.5, 1.05, 1.8);
      clothes.rotation.y = -0.12;
      [[0x5d6670, 0], [0x8a9bb0, 0.02], [0xc9bfa8, -0.015]].forEach(function (c, i) {
        var fold = this.box(0.3, 0.05, 0.24, this.retro.material({ texture: 'white', color: c[0] }), c[1], 0.025 + i * 0.05, c[1] * 0.6, clothes);
        this.interactive(fold, 'ropaDoblada');
      }, this);
      clothes.visible = false;
      this.add(clothes);
      this.foldedClothes = clothes;
      // La caja que deja la segunda máscara de la noche (clientela.js): adentro, la placa del puente.
      var gift = this.box(0.3, 0.2, 0.24, this.retro.material({ texture: 'white', color: 0x8a6d48 }), 4.78, 1.15, 2.0);
      this.box(0.31, 0.02, 0.05, this.retro.material({ texture: 'white', color: 0xb8a37a }), 0, 0.1, 0, gift);
      this.interactive(gift, 'cajaMostrador');
      gift.visible = false;
      this.giftBox = gift;
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
      // Antenas de conejo.
      this.box(0.1, 0.03, 0.08, m.metal, 0, 0.275, -0.05, tv);
      [-1, 1].forEach(function (s) { this.box(0.012, 0.36, 0.012, m.metal, 0.07 * s, 0.43, -0.05, tv).rotation.z = -0.45 * s; }, this);
      this.interactive(body, 'tele');
      this.interactive(screen, 'tele');
      this.interactive(knob, 'teleCanal');
      this.tv = { group: tv, screen: screen, anchor: anchor, knob: knob, led: led, width: 0.48, height: 0.36 };
    }

    /** Máquina de café junto a la entrada (una moneda: te despierta y parpadeas menos). */
    _cafe() {
      var R = this.retro;
      var body = this.box(0.75, 1.85, 0.55, R.material({ texture: 'metal', color: 0x8a2a24 }), -3.2, 0.925, 4.72);
      var panel = MR.Textures.dynamic(32, 48);
      var x = panel.ctx;
      x.fillStyle = '#1a0d0a'; x.fillRect(0, 0, 32, 48);
      x.fillStyle = '#ffd27a'; x.font = 'bold 9px monospace'; x.textAlign = 'center';
      x.fillText(MR.t('CAFÉ'), 16, 12);
      x.fillStyle = '#c8a070'; x.fillRect(9, 18, 14, 14);
      x.fillStyle = '#5a3a20'; x.fillRect(11, 20, 10, 10);
      x.fillStyle = '#ffd27a'; x.font = '7px monospace'; x.fillText('$1', 16, 42);
      panel.texture.needsUpdate = true;
      var face = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.75), R.material({ map: panel.texture, emissive: 0.9 }));
      face.rotation.y = Math.PI;
      face.position.set(-3.2, 1.3, 4.44);
      this.add(face);
      var slot = this.box(0.06, 0.1, 0.03, this.mat.dark, -2.98, 0.95, 4.43);
      this.box(0.3, 0.22, 0.04, this.mat.dark, -3.2, 0.45, 4.43);
      var cup = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.028, 0.08, 8), R.material({ texture: 'white', color: 0xe8e2d4, emissive: 0.2 })); // un vasito de papel
      cup.position.set(-3.2, 0.38, 4.39);
      this.add(inert(cup));
      this.box(0.7, 0.05, 0.02, R.material({ texture: 'white', color: 0xffcf8a, emissive: 1.0 }), -3.2, 1.78, 4.435); // la franja de luz
      [body, face, slot].forEach(function (mesh) { this.interactive(mesh, 'cafe'); }, this);
      this.collider(-3.6, -2.8, 4.42, 5);
    }

    _entrance() {
      var m = this.mat;
      [-0.8, 0.8].forEach(function (x) {
        var g = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 2.4, 2, 3), m.glass); // subdividida: sin deformación afín
        g.rotation.y = Math.PI;
        g.position.set(x, 1.2, 4.99);
        this.add(g);
        this.interactive(g, 'salirBosque'); // la puerta de vidrio: salir al bosque
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
      // La misma mano, pero por DENTRO del vidrio de una lavadora (evento «mano_lavadora»).
      this.washerHand = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.17), this.handprint.material);
      this.washerHand.visible = false;

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
      var chg = MR.Textures.dynamic(32, 16);
      chg.ctx.fillStyle = '#1b1d20'; chg.ctx.fillRect(0, 0, 32, 16);
      chg.ctx.fillStyle = '#ffd23a'; chg.ctx.font = 'bold 8px monospace'; chg.ctx.textAlign = 'center';
      chg.ctx.fillText(MR.t('CAMBIO'), 16, 11);
      chg.texture.needsUpdate = true;
      var chgPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.2), this.retro.material({ map: chg.texture, emissive: 0.7 }));
      chgPlate.rotation.y = Math.PI;
      chgPlate.position.set(-4.5, 1.36, 4.546);
      this.add(inert(chgPlate));
      this.box(0.24, 0.03, 0.02, m.dark, -4.5, 0.98, 4.545);                // ranura de billetes
      var trim = [];
      var Mt = THREE.Matrix4;
      var bxt = new THREE.BoxGeometry(1, 1, 1);
      [[-4.5, 1.49, 0.62, 0.03], [-4.5, 0.01, 0.62, 0.03]].forEach(function (t) {
        trim.push({ geo: bxt, matrix: new Mt().makeTranslation(t[0], t[1], 4.54).multiply(new Mt().makeScale(t[2], t[3], 0.04)), su: 1, sv: 1 });
      });
      [-4.79, -4.21].forEach(function (tx2) {
        trim.push({ geo: bxt, matrix: new Mt().makeTranslation(tx2, 0.75, 4.54).multiply(new Mt().makeScale(0.03, 1.5, 0.04)), su: 1, sv: 1 });
      });
      this.add(inert(new THREE.Mesh(mergeParts(trim), this.retro.material({ texture: 'metal', color: 0x55595e }))));
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
      // «La moneda de canto»: una moneda parada de canto en la bandeja, girando apenas (horror.js).
      var edge = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.008, 8), this.retro.material({ texture: 'yellow', color: 0xd8cfa8, emissive: 0.45 }));
      edge.rotation.x = Math.PI / 2;
      edge.position.set(-4.48, 0.63, 4.47);
      edge.visible = false;
      this.add(edge);
      this.interactive(edge, 'changerTray');
      this.edgeCoin = edge;

      // Teléfono público: caparazón de metal, aparato con teclado y ranura, el auricular colgado y su cordón.
      var M = THREE.Matrix4;
      var bx = new THREE.BoxGeometry(1, 1, 1);
      function pz(list, x, y, z, w, h, d) { list.push({ geo: bx, matrix: new M().makeTranslation(x, y, z).multiply(new M().makeScale(w, h, d)), su: 1, sv: 1 }); }
      var hood = [];
      pz(hood, 2.7, 1.45, 4.975, 0.52, 0.8, 0.03);
      pz(hood, 2.445, 1.45, 4.84, 0.03, 0.8, 0.3);
      pz(hood, 2.955, 1.45, 4.84, 0.03, 0.8, 0.3);
      pz(hood, 2.7, 1.865, 4.84, 0.55, 0.03, 0.32);
      this.add(inert(new THREE.Mesh(mergeParts(hood), this.retro.material({ texture: 'metal', color: 0x9aa4ad }))));
      var telTex = MR.Textures.dynamic(16, 24);
      var tx = telTex.ctx;
      tx.fillStyle = '#26282b'; tx.fillRect(0, 0, 16, 24);
      tx.fillStyle = '#7d858c'; tx.fillRect(2, 2, 9, 3);       // la pantallita
      tx.fillStyle = '#0c0c0c'; tx.fillRect(13, 2, 1, 5);       // la ranura de monedas
      tx.fillStyle = '#c9cdd1';
      for (var kr = 0; kr < 4; kr += 1) { for (var kc = 0; kc < 3; kc += 1) { tx.fillRect(2 + kc * 4, 8 + kr * 4, 2, 2); } }
      telTex.texture.needsUpdate = true;
      var telBody = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.34, 0.1), [m.dark, m.dark, m.dark, m.dark, m.dark, this.retro.material({ map: telTex.texture, emissive: 0.15 })]);
      telBody.position.set(2.72, 1.4, 4.92);
      this.add(telBody);
      var handset = this.box(0.06, 0.24, 0.06, m.dark, 2.62, 1.42, 4.85);
      this.box(0.085, 0.055, 0.075, m.dark, 0, 0.12, -0.006, handset);  // para el oído
      this.box(0.085, 0.055, 0.075, m.dark, 0, -0.12, -0.006, handset); // para la boca
      this.interactive(handset, 'phone');
      handset.children.forEach(function (c) { this.interactive(c, 'phone'); }, this);
      this.phone = handset;
      var cord = [];
      [[2.63, 1.24], [2.66, 1.19], [2.63, 1.14], [2.66, 1.09], [2.7, 1.06]].forEach(function (c) { pz(cord, c[0], c[1], 4.88, 0.03, 0.035, 0.03); });
      this.add(inert(new THREE.Mesh(mergeParts(cord), m.dark)));
      var telSign = MR.Textures.dynamic(64, 16);
      telSign.ctx.fillStyle = '#16314f'; telSign.ctx.fillRect(0, 0, 64, 16);
      telSign.ctx.fillStyle = '#e8eef4'; telSign.ctx.font = 'bold 9px monospace'; telSign.ctx.textAlign = 'center';
      telSign.ctx.fillText(MR.t('TELÉFONO'), 32, 12);
      telSign.texture.needsUpdate = true;
      var telPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.125), this.retro.material({ map: telSign.texture, emissive: 0.6 }));
      telPlate.rotation.y = Math.PI;
      telPlate.position.set(2.7, 1.95, 4.69);
      this.add(inert(telPlate));
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
      var self = this;
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
        // Sombrero de ala ancha, un poco caída (gira con la cabeza): le ensombrece la cara. Copa con cinta.
        var brim = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.3, 0.03, 10), m.dark);
        brim.position.set(0, 0.15, 0);
        h.add(brim);
        var crown = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.17, 8), m.dark);
        crown.position.set(0, 0.24, 0);
        h.add(crown);
        var band = new THREE.Mesh(new THREE.CylinderGeometry(0.142, 0.142, 0.035, 8), self.retro.material({ texture: 'white', color: 0x2c2522 }));
        band.position.set(0, 0.18, 0);
        h.add(band);
        return h;
      }
      // Sentado (mirando hacia -z, hacia las lavadoras).
      this.box(0.36, 0.14, 0.46, m.coat, 0, 0.53, -0.18, seated);
      this.box(0.32, 0.5, 0.14, m.coat, 0, 0.25, -0.4, seated);
      this.box(0.34, 0.06, 0.24, m.dark, 0, 0.03, -0.5, seated);
      this.box(0.46, 0.64, 0.28, m.coat, 0, 0.88, 0.02, seated);
      this.box(0.52, 0.09, 0.3, m.coat, 0, 1.18, 0.02, seated);   // hombros
      this.box(0.1, 0.5, 0.12, m.coat, -0.29, 0.78, -0.06, seated);
      this.box(0.1, 0.5, 0.12, m.coat, 0.29, 0.78, -0.06, seated);
      this.box(0.08, 0.09, 0.08, m.paleHand, -0.29, 0.5, -0.1, seated);  // manos sobre las rodillas
      this.box(0.08, 0.09, 0.08, m.paleHand, 0.29, 0.5, -0.1, seated);
      this.box(0.3, 0.17, 0.05, m.coat, 0, 1.28, 0.13, seated);    // el cuello del abrigo, levantado
      this.box(0.05, 0.17, 0.2, m.coat, -0.14, 1.28, 0.03, seated);
      this.box(0.05, 0.17, 0.2, m.coat, 0.14, 1.28, 0.03, seated);
      this.seatedHead = head(seated, 1.34);
      // De pie: más alto que una persona (~2 m), abrigo hasta las rodillas, brazos que cuelgan de más.
      this.box(0.15, 1.0, 0.17, m.dark, -0.1, 0.5, 0, standing);
      this.box(0.15, 1.0, 0.17, m.dark, 0.1, 0.5, 0, standing);
      var skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.34, 0.82, 6), m.coat); // falda del abrigo, que se abre
      skirt.position.set(0, 0.8, 0);
      skirt.rotation.y = Math.PI / 6;
      standing.add(skirt);
      this.box(0.5, 0.82, 0.31, m.coat, 0, 1.52, 0, standing);  // torso
      this.box(0.6, 0.1, 0.34, m.coat, 0, 1.9, 0, standing);    // hombros
      this.box(0.1, 0.92, 0.12, m.coat, -0.31, 1.24, 0, standing);
      this.box(0.1, 0.92, 0.12, m.coat, 0.31, 1.24, 0, standing);
      this.box(0.08, 0.12, 0.08, m.paleHand, -0.31, 0.72, 0, standing); // manos pálidas, largas
      this.box(0.08, 0.12, 0.08, m.paleHand, 0.31, 0.72, 0, standing);
      this.box(0.3, 0.2, 0.05, m.coat, 0, 2.0, 0.13, standing);     // el cuello del abrigo, levantado hasta la cara
      this.box(0.05, 0.2, 0.22, m.coat, -0.145, 2.0, 0.02, standing);
      this.box(0.05, 0.2, 0.22, m.coat, 0.145, 2.0, 0.02, standing);
      this.standingHead = head(standing, 2.06);
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

      // Señuelos (horror.js): a veces, donde él estaba parado queda una moneda mojada o un ticket doblado.
      var R = this.retro;
      var wet = R.material({ texture: 'white', color: 0x15181b });
      var coin = new THREE.Group();
      var ring = new THREE.Mesh(new THREE.CircleGeometry(0.11, 8), wet); // el agua que dejó alrededor
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.004;
      coin.add(ring);
      var disc = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.008, 8), R.material({ texture: 'yellow', color: 0x9c9474, emissive: 0.25 }));
      disc.position.y = 0.009;
      coin.add(disc);
      var ticket = new THREE.Group();
      var paper = R.material({ texture: 'white', color: 0xb9b4a4, emissive: 0.2 });
      [-1, 1].forEach(function (s) { // doblado al medio, como una carpa chica
        var half = this.box(0.07, 0.003, 0.05, paper, 0, 0.012, s * 0.023, ticket);
        half.rotation.x = s * 0.45;
      }, this);
      ticket.rotation.y = 0.7;
      [coin, ticket].forEach(function (d) { d.visible = false; this.add(d); }, this);
      this.decoys = { moneda: coin, ticket: ticket };
    }

    // ---------------------------------------------------------------------------------------------
    /**
     * La avenida por la vidriera (canon §7): Blackwood como era antes del agua. Vereda, asfalto mojado, edificios con
     * ventanas encendidas, letreros, farolas, autos, gente con paraguas y lluvia. ciudad.js la anima con la hora: se
     * vacía, se apaga y, desde las 03:30, el agua sube y la tapa. Lo fijo va unido en pocas geometrías (celular).
     */
    _city() {
      var R = this.retro;
      var m = this.mat;
      var self = this;
      var M = THREE.Matrix4;
      var box = new THREE.BoxGeometry(1, 1, 1);
      function part(list, x, y, z, w, h, d, su, sv) { list.push({ geo: box, matrix: new M().makeTranslation(x, y, z).multiply(new M().makeScale(w, h, d)), su: su || 1, sv: sv || 1 }); }
      var group = new THREE.Group();
      // Veredas y cordones (concreto) · asfalto · líneas.
      var walk = [];
      part(walk, 0, 0.06, 5.8, 44, 0.12, 1.6, 22, 1);
      part(walk, 0, 0.06, 11.8, 44, 0.12, 1.6, 22, 1);
      group.add(inert(new THREE.Mesh(mergeParts(walk), R.material({ texture: 'concreto', color: 0x8d9093 }))));
      var road = new THREE.Mesh(scaleUV(new THREE.PlaneGeometry(44, 4.4, 22, 2), 22, 2), R.material({ texture: 'concreto', color: 0x2c2f33, emissive: 0.06 }));
      road.rotation.x = -Math.PI / 2;
      road.position.set(0, 0.01, 8.8);
      group.add(inert(road));
      var marks = [];
      for (var mx = -21; mx <= 21; mx += 3) { part(marks, mx, 0.015, 8.8, 1.4, 0.01, 0.1); }
      group.add(inert(new THREE.Mesh(mergeParts(marks), R.material({ texture: 'white', color: 0xb8b49a, emissive: 0.2 }))));
      // Edificios (ladrillo) con su fachada pintada en un lienzo: ventanas que se apagan una por una (ciudad.js).
      var bricks = [];
      var facades = [];
      var portals = [];
      [[-13, 6.5, 8], [-6.8, 5.5, 6], [-1.2, 5.2, 9], [4.4, 5.6, 7], [10.2, 5.8, 10], [16.2, 6, 7]].forEach(function (b, i) {
        part(bricks, b[0], b[2] / 2, 15.6, b[1], b[2], 5, b[1] / 2, b[2] / 2);
        part(bricks, b[0], b[2] + 0.08, 13.05, b[1] + 0.2, 0.24, 0.35, b[1] / 2, 0.2); // cornisa
        part(portals, b[0] + (i % 2 ? 1.2 : -1.0), 1.05, 12.8, 1.0, 2.1, 0.2);      // la puerta de la calle
        part(portals, b[0], 0.1, 12.8, b[1], 0.2, 0.2);                             // el zócalo
        var tex = MR.Textures.dynamic(64, 80); // 64×80: cabe una sombra (o una cara) detrás de una ventana (ciudad.js)
        // Subdividida (un cuadro por metro), como en la PS1: así la deformación afín no tuerce las ventanas.
        var face = new THREE.Mesh(new THREE.PlaneGeometry(b[1] - 0.2, b[2] - 0.4, Math.ceil(b[1]), Math.ceil(b[2])), R.material({ map: tex.texture, emissive: 1.25 }));
        face.rotation.y = Math.PI;
        face.position.set(b[0], b[2] / 2 - 0.1, 12.9); // 20 cm delante del ladrillo: con 1 cm se peleaban (z-fighting)
        group.add(inert(face));
        var windows = [];
        for (var r = 0; r < 5; r += 1) { for (var c = 0; c < 4; c += 1) { windows.push({ r: r, c: c, at: Math.random() }); } }
        facades.push({ tex: tex, windows: windows, lit: -1, seed: i, x: b[0], cy: b[2] / 2 - 0.1, w: b[1] - 0.2, h: b[2] - 0.4 });
      });
      group.add(inert(new THREE.Mesh(mergeParts(bricks), R.material({ texture: 'ladrillo', color: 0x6a5048 }))));
      group.add(inert(new THREE.Mesh(mergeParts(portals), R.material({ texture: 'white', color: 0x1d1a18, emissive: 0.05 }))));
      // Letreros: la farmacia de don Pedro (la cruz verde nunca se apaga), la tortillería y el hotel.
      function sign(text, color, x, y, w) {
        var t = MR.Textures.dynamic(64, 16);
        var c = t.ctx;
        c.fillStyle = '#0b0d0c'; c.fillRect(0, 0, 64, 16);
        c.fillStyle = color; c.font = 'bold 9px monospace'; c.textAlign = 'center'; c.fillText(text, 32, 12);
        t.texture.needsUpdate = true;
        var mat = R.material({ map: t.texture, emissive: 1.3 });
        var s = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), mat);
        s.rotation.y = Math.PI;
        s.position.set(x, y, 12.72); // delante de la fachada (y sin pelearse con ella)
        group.add(inert(s));
        return mat;
      }
      var signs = {
        farmacia: sign(MR.t('+ FARMACIA'), '#5dff8a', -1.2, 3.1, 3.2), // la tortillería y el hotel no se traducen
        tortilleria: sign('TORTILLERIA', '#ffcf5a', 4.4, 2.9, 3.0),
        hotel: sign('HOTEL', '#ff6a8a', -6.8, 4.2, 2.4)
      };
      // Farolas (postes de metal y focos de sodio) con su charco de luz en el piso.
      var poles = [];
      var heads = [];
      var pools = [];
      [-12, -4, 4, 12].forEach(function (x) {
        part(poles, x, 2.0, 11.4, 0.12, 4.0, 0.12);
        part(poles, x, 3.98, 11.1, 0.06, 0.06, 0.6);
        part(heads, x, 3.92, 10.85, 0.34, 0.1, 0.24);
        pools.push({ geo: new THREE.CircleGeometry(1.6, 10), matrix: new M().makeTranslation(x, 0.02, 10.6).multiply(new M().makeRotationX(-Math.PI / 2)) });
      });
      group.add(inert(new THREE.Mesh(mergeParts(poles), R.material({ texture: 'metal' })))); // material propio: su niebla es otra
      var lampMat = R.material({ texture: 'white', color: 0xffb060, emissive: 1.3 });
      group.add(inert(new THREE.Mesh(mergeParts(heads), lampMat)));
      var poolMat = R.material({ texture: 'water', color: 0xb07a3a, emissive: 0.55 });
      group.add(inert(new THREE.Mesh(mergeParts(pools), poolMat)));
      // El agua que sube (empieza escondida bajo el asfalto).
      var water = new THREE.Mesh(scaleUV(new THREE.PlaneGeometry(44, 9, 22, 4), 16, 3), R.material({ texture: 'water', color: 0x3a5560, emissive: 0.25 }));
      water.rotation.x = -Math.PI / 2;
      water.position.set(0, -0.6, 9.4);
      group.add(inert(water));
      // Autos (cuerpo, cabina y luces) y gente con paraguas: se reciclan (ciudad.js los mueve).
      var cars = [];
      [0x5a6b7a, 0x7a4a3a, 0xb5b0a0].forEach(function (col) {
        var car = new THREE.Group();
        var body = [];
        part(body, 0, 0.42, 0, 2.0, 0.5, 0.86);
        part(body, -0.1, 0.84, 0, 1.0, 0.38, 0.76);
        car.add(inert(new THREE.Mesh(mergeParts(body), R.material({ texture: 'metal', color: col, emissive: 0.12 }))));
        var wheels = [];
        [-0.62, 0.62].forEach(function (wx) {
          [-0.44, 0.44].forEach(function (wz) {
            wheels.push({ geo: new THREE.CylinderGeometry(0.2, 0.2, 0.12, 8), matrix: new M().makeTranslation(wx, 0.2, wz).multiply(new M().makeRotationX(Math.PI / 2)), su: 1, sv: 1 });
          });
        });
        car.add(inert(new THREE.Mesh(mergeParts(wheels), R.material({ texture: 'white', color: 0x141517 }))));
        var glassParts = [];
        part(glassParts, -0.1, 0.86, 0, 1.08, 0.22, 0.84);
        car.add(inert(new THREE.Mesh(mergeParts(glassParts), R.material({ texture: 'white', color: 0x2c3a48, emissive: 0.25 }))));
        var head = [];
        part(head, 1.04, 0.45, 0.28, 0.04, 0.12, 0.16);
        part(head, 1.04, 0.45, -0.28, 0.04, 0.12, 0.16);
        car.add(inert(new THREE.Mesh(mergeParts(head), R.material({ texture: 'white', color: 0xfff4d8, emissive: 1.6 }))));
        var tail = [];
        part(tail, -1.04, 0.48, 0.3, 0.04, 0.1, 0.14);
        part(tail, -1.04, 0.48, -0.3, 0.04, 0.1, 0.14);
        car.add(inert(new THREE.Mesh(mergeParts(tail), R.material({ texture: 'white', color: 0xff3a2a, emissive: 1.4 }))));
        car.visible = false;
        group.add(car);
        cars.push({ group: car, active: false });
      });
      var people = [];
      [0x3a3f47, 0x5a4c3e, 0x4a5a4f].forEach(function (col, i) {
        var p = new THREE.Group();
        var body = [];
        part(body, -0.08, 0.42, 0, 0.12, 0.84, 0.14);
        part(body, 0.08, 0.42, 0, 0.12, 0.84, 0.14);
        part(body, 0, 1.16, 0, 0.4, 0.66, 0.26);
        part(body, 0.22, 1.28, 0.06, 0.09, 0.42, 0.1);   // el brazo que sostiene el paraguas
        part(body, 0, 0.86, 0, 0.44, 0.12, 0.3);         // el abrigo se abre abajo
        p.add(inert(new THREE.Mesh(mergeParts(body), R.material({ texture: 'coat', color: col, emissive: 0.1 }))));
        var umbParts = [{ geo: new THREE.ConeGeometry(0.55, 0.24, 8), matrix: new M().makeTranslation(0, 1.98, 0), su: 1, sv: 1 }];
        part(umbParts, 0.2, 1.62, 0.06, 0.025, 0.62, 0.025); // el mango
        var umb = new THREE.Mesh(mergeParts(umbParts), R.material({ texture: 'white', color: [0x1c1d22, 0x6b2a2a, 0x223a5a][i], emissive: 0.08 }));
        p.add(inert(umb));
        var headParts = [];
        part(headParts, 0, 1.6, 0, 0.18, 0.22, 0.18);
        p.add(inert(new THREE.Mesh(mergeParts(headParts), R.material({ texture: 'skin', emissive: 0.1 })))); // una persona, no una cara blanca
        p.visible = false;
        group.add(p);
        people.push({ group: p, active: false });
      });
      // El autobús nocturno 86 (ciudad.js): se detiene enfrente; adentro, todas las caras son blancas.
      var bus = new THREE.Group();
      var bb = [];
      part(bb, 0, 1.35, 0, 6.4, 2.1, 1.3);
      bus.add(inert(new THREE.Mesh(mergeParts(bb), R.material({ texture: 'metal', color: 0x557a66, emissive: 0.22 }))));
      var wheels = [];
      [-2.1, 2.1].forEach(function (wx) { [-0.62, 0.62].forEach(function (wz) { part(wheels, wx, 0.32, wz, 0.62, 0.62, 0.12); }); });
      bus.add(inert(new THREE.Mesh(mergeParts(wheels), R.material({ texture: 'white', color: 0x141517 }))));
      var glass = [];
      part(glass, -0.2, 1.75, 0.66, 5.2, 0.62, 0.02);
      part(glass, -0.2, 1.75, -0.66, 5.2, 0.62, 0.02);
      part(glass, 3.25, 1.72, 0, 0.02, 0.72, 1.1);
      bus.add(inert(new THREE.Mesh(mergeParts(glass), R.material({ texture: 'white', color: 0xc9a85a, emissive: 0.8 }))));
      var riders = [];
      var shoulders = [];
      [-2.2, -1.25, -0.35, 0.85, 1.85].forEach(function (rx, i) {
        part(riders, rx, 1.82 + (i % 2) * 0.05, 0.72, 0.2, 0.24, 0.01); // delante del vidrio encendido (que es opaco)
        part(shoulders, rx, 1.56, 0.715, 0.44, 0.22, 0.01);
      });
      var busRiders = new THREE.Mesh(mergeParts(riders), R.material({ texture: 'white', color: 0xffffff, emissive: 1.3 }));
      bus.add(inert(busRiders)); // en una foto, los pasajeros tienen el rostro de antes (fotos.js)
      bus.add(inert(new THREE.Mesh(mergeParts(shoulders), R.material({ texture: 'white', color: 0x1c1e22 }))));
      var lamps = [];
      part(lamps, 3.25, 0.62, 0.45, 0.02, 0.14, 0.22);
      part(lamps, 3.25, 0.62, -0.45, 0.02, 0.14, 0.22);
      bus.add(inert(new THREE.Mesh(mergeParts(lamps), R.material({ texture: 'white', color: 0xfff4d8, emissive: 1.6 }))));
      var busTex = MR.Textures.dynamic(128, 16);
      busTex.ctx.fillStyle = '#0b0c0b'; busTex.ctx.fillRect(0, 0, 128, 16);
      busTex.ctx.fillStyle = '#ffb84a'; busTex.ctx.font = 'bold 11px monospace'; busTex.ctx.textAlign = 'center';
      busTex.ctx.fillText('86 · BLACKWOOD', 64, 12); // el nombre del pueblo no se traduce
      busTex.texture.needsUpdate = true;
      var busSignMat = R.material({ map: busTex.texture, emissive: 1.3 });
      var sideSign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.32), busSignMat);
      sideSign.position.set(0.4, 2.22, 0.7);
      bus.add(inert(sideSign));
      var frontSign = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.15), busSignMat);
      frontSign.rotation.y = Math.PI / 2;
      frontSign.position.set(3.27, 2.25, 0);
      bus.add(inert(frontSign));
      bus.visible = false;
      group.add(bus);
      // El 86 bajo el agua (ciudad.js): ya inundada la avenida, una franja de luz pasa por debajo de la superficie.
      var ghostMat = R.material({ texture: 'white', color: 0xc9a85a, emissive: 0.75 }); // el ámbar de los vidrios del 86
      var ghostBus = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 0.8), ghostMat);
      ghostBus.rotation.x = -Math.PI / 2;
      ghostBus.visible = false;
      group.add(inert(ghostBus));
      // La barredora (ciudad.js): pasa despacio a la 01:40, con su luz naranja girando.
      var sweeper = new THREE.Group();
      var sb = [];
      part(sb, -0.4, 0.95, 0, 2.6, 1.3, 1.4);
      part(sb, 1.25, 1.1, 0, 0.9, 1.6, 1.3);
      sweeper.add(inert(new THREE.Mesh(mergeParts(sb), R.material({ texture: 'metal', color: 0xd9d4c4 }))));
      var stripe = [];
      part(stripe, -0.4, 0.55, 0.71, 2.6, 0.12, 0.02);
      part(stripe, -0.4, 0.55, -0.71, 2.6, 0.12, 0.02);
      sweeper.add(inert(new THREE.Mesh(mergeParts(stripe), R.material({ texture: 'white', color: 0xe0782a, emissive: 0.4 }))));
      var brush = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.12, 8), R.material({ texture: 'white', color: 0x3a3226 }));
      brush.position.set(1.4, 0.14, 0.55);
      sweeper.add(inert(brush));
      var beaconMat = R.material({ texture: 'white', color: 0xff8a1a, emissive: 1.6 });
      var beacon = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.22), beaconMat);
      beacon.position.set(1.25, 2.0, 0);
      sweeper.add(inert(beacon));
      sweeper.visible = false;
      group.add(sweeper);
      // Lluvia afuera: líneas de 1 px que caen entre la vidriera y la avenida (una sola geometría).
      var drops = 180;
      var rp = new Float32Array(drops * 6);
      for (var k = 0; k < drops; k += 1) {
        var rx = -10 + Math.random() * 20;
        var ry = Math.random() * 4.5;
        var rz = 5.3 + Math.random() * 5.5;
        rp.set([rx, ry, rz, rx, ry - 0.35, rz], k * 6);
      }
      var rainGeo = new THREE.BufferGeometry();
      rainGeo.setAttribute('position', new THREE.BufferAttribute(rp, 3));
      var rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0x8fa3ad }));
      rain.frustumCulled = false;
      group.add(inert(rain));
      this.add(group);
      // Vidrieras: tocar la ventana = mirar afuera (ciudad.js dice lo que ves).
      // «1986» escrito con el dedo en el vaho, del lado de afuera (horror.js, «vidriera_escrita»): se lee al revés.
      var fogTex = MR.Textures.dynamic(64, 32);
      var fx = fogTex.ctx;
      fx.fillStyle = '#4a545a'; fx.fillRect(0, 0, 64, 32);
      fx.save(); fx.translate(64, 0); fx.scale(-1, 1); // en espejo: lo escribieron desde la calle
      fx.strokeStyle = '#0d1012'; fx.lineWidth = 3; fx.lineCap = 'round'; fx.font = 'bold 22px monospace';
      fx.strokeText('1986', 6, 25);
      fx.restore();
      fogTex.texture.needsUpdate = true;
      var writing = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), R.material({ map: fogTex.texture, emissive: 0.35 }));
      writing.rotation.y = Math.PI;
      writing.position.set(4.7, 1.7, 5.035);
      writing.visible = false;
      this.add(inert(writing));
      this.fogWriting = writing;

      var nothing = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }); // no pinta nada, pero se puede tocar
      [[-6.45, 2.3], [5.55, 4.1]].forEach(function (wdef) {
        var pane = new THREE.Mesh(new THREE.PlaneGeometry(wdef[1], 1.5), nothing);
        pane.rotation.y = Math.PI;
        pane.position.set(wdef[0], 1.7, 5.02);
        group.add(pane);
        self.interactive(pane, 'vidriera');
      });
      // Niebla propia para la avenida (más lejana que la de la sala): que se vea viva por la vidriera.
      group.traverse(function (o) {
        if (o.material && o.material.uniforms && o.material.uniforms.uFogNear) {
          o.material.uniforms = Object.assign({}, o.material.uniforms, { uFogNear: { value: 9 }, uFogFar: { value: 34 } });
        }
      });
      this.city = { group: group, facades: facades, signs: signs, lampMat: lampMat, poolMat: poolMat, water: water, cars: cars, people: people, rain: rain,
        bus: bus, busRiders: busRiders, sweeper: sweeper, beaconMat: beaconMat, brush: brush, ghostBus: ghostBus, ghostMat: ghostMat };
    }

    _lights() {
      var R = this.retro;
      var cold = new THREE.Color(0.86, 0.93, 1.0);
      var spots = [
        [-5.0, 2.92, -3.0, cold, 1.15, 7.5], [-1.0, 2.92, -3.0, cold, 1.05, 7.5], [3.5, 2.92, -3.0, cold, 1.05, 7.5],
        [-4.0, 2.92, 2.0, cold, 1.0, 7.5], [2.6, 2.92, 2.6, cold, 1.1, 8.0], [-7.3, 2.6, 3.6, new THREE.Color(1.0, 0.78, 0.5), 0.75, 3.6]
      ];
      this.lightSpots = spots; // el bosque las reemplaza al salir y las restaura al volver
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
        cambiador: { center: new V3(-4.5, 0.8, 4.6), radius: 0.8 },
        cesto: { center: new V3(0.45, 0.4, -3.75), radius: 0.6 },
        vidriera: { center: new V3(4.7, 1.7, 5.0), radius: 0.7 },
        puerta_trasera: { center: new V3(6.8, 1.1, -4.7), radius: 0.9 }
      };
    }

    // ---------------------------------------------------------------------------------------------
    /**
     * El pasillo de servicio, detrás de la puerta trasera (se abre a las 03:00). Vive lejos (x ≈ 60) para no
     * dibujarse con la sala. Bombilla, tubería que gotea, caldera al fondo, la caja de fusibles y siete casilleros
     * con las iniciales de quienes escribieron las hojas del bosque… y el tuyo.
     */
    _pasillo() {
      var R = this.retro;
      var m = this.mat;
      var X = 60;
      var conc = R.material({ texture: 'concreto' });
      var floor = new THREE.Mesh(scaleUV(new THREE.PlaneGeometry(3, 12.2, 3, 12), 2, 8), conc);
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(X, 0, 0.1);
      this.add(inert(floor));
      var ceil = new THREE.Mesh(scaleUV(new THREE.PlaneGeometry(3, 12.2, 3, 12), 2, 8), conc);
      ceil.rotation.x = Math.PI / 2;
      ceil.position.set(X, 2.6, 0.1);
      this.add(inert(ceil));
      var wallMat = R.material({ texture: 'concreto', color: 0xb8bdb6 });
      [[X - 1.5, Math.PI / 2], [X + 1.5, -Math.PI / 2]].forEach(function (wdef) {
        var wall = new THREE.Mesh(scaleUV(new THREE.PlaneGeometry(12.2, 2.6, 12, 3), 8, 2), wallMat);
        wall.rotation.y = wdef[1];
        wall.position.set(wdef[0], 1.3, 0.1);
        this.add(inert(wall));
      }, this);
      var far = new THREE.Mesh(scaleUV(new THREE.PlaneGeometry(3, 2.6, 3, 3), 2, 2), wallMat);
      far.position.set(X, 1.3, -6);
      this.add(inert(far));
      var near = new THREE.Mesh(scaleUV(new THREE.PlaneGeometry(3, 2.6, 3, 3), 2, 2), wallMat);
      near.rotation.y = Math.PI;
      near.position.set(X, 1.3, 6.2);
      this.add(inert(near));
      // La puerta por la que entraste (de vuelta a la sala).
      var door = this.box(0.9, 2.1, 0.05, m.wood, X, 1.05, 6.15);
      this.interactive(door, 'volverSala');
      this.collider(X - 3, X - 1.45, -7, 7.5);
      this.collider(X + 1.45, X + 3, -7, 7.5);
      this.collider(X - 3, X + 3, -7.5, -5.95);
      this.collider(X - 3, X + 3, 6.1, 7.5);

      // Siete casilleros: R., E., S., D., T., A. (las hojas del bosque)… y el tuyo.
      var lockerMat = R.material({ texture: 'casillero' });
      var initials = ['R.', 'E.', 'S.', 'D.', 'T.', 'A.', MR.t('TÚ')];
      var lockers = [];
      var lastLabel = null;
      initials.forEach(function (txt, i) {
        var z = 4.3 - i * 0.55;
        var box = this.box(0.45, 1.9, 0.5, lockerMat, X - 1.27, 0.95, z);
        this.interactive(box, 'casillero', i);
        var label = MR.Textures.dynamic(32, 12);
        label.ctx.fillStyle = '#e8e1cc';
        label.ctx.fillRect(0, 0, 32, 12);
        label.ctx.fillStyle = '#2b2a26';
        label.ctx.font = 'bold 10px monospace';
        label.ctx.textAlign = 'center';
        label.ctx.fillText(txt, 16, 10);
        label.texture.needsUpdate = true;
        var plate = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.15), R.material({ map: label.texture, emissive: 0.35 }));
        plate.rotation.y = Math.PI / 2;
        plate.position.set(X - 1.04, 1.72, z);
        this.add(plate);
        lockers.push(box);
        if (i === initials.length - 1) { lastLabel = label; }
      }, this);
      this.collider(X - 1.5, X - 1.02, 0.7, 4.6);

      // Tubería que gotea sobre un charco.
      var pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 8), m.metal);
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(X, 2.42, -1.5);
      this.add(inert(pipe));
      var drip = new THREE.Mesh(new THREE.CircleGeometry(0.45, 10), m.water);
      drip.rotation.x = -Math.PI / 2;
      drip.position.set(X + 0.3, 0.012, -1.5);
      this.add(inert(drip));

      // Caldera con su llama, y la caja de fusibles.
      var boilerMat = R.material({ texture: 'metal', color: 0x6a6660 });
      this.box(1.3, 1.9, 0.8, boilerMat, X, 0.95, -5.5);
      var flameMat = R.material({ texture: 'white', color: 0xff7a2a, emissive: 1.4 });
      var flame = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.16), flameMat);
      flame.position.set(X, 0.5, -5.09);
      this.add(flame);
      var flue = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.7, 8), m.metal);
      flue.position.set(X, 2.25, -5.5);
      this.add(inert(flue));
      // La caldera de cerca: remaches, un segundo caño, la rejilla del quemador, el manómetro y el volante de la válvula.
      var Mb = THREE.Matrix4;
      var bxb = new THREE.BoxGeometry(1, 1, 1);
      var boilerParts = [];
      function pb(x, y, z, w, h, d) { boilerParts.push({ geo: bxb, matrix: new Mb().makeTranslation(x, y, z).multiply(new Mb().makeScale(w, h, d)), su: 1, sv: 1 }); }
      pb(X, 1.55, -5.5, 1.33, 0.06, 0.83);            // franjas de remaches
      pb(X, 0.25, -5.5, 1.33, 0.06, 0.83);
      [-0.08, 0, 0.08].forEach(function (dy) { pb(X, 0.5 + dy, -5.075, 0.34, 0.025, 0.02); }); // la rejilla delante de la llama
      boilerParts.push({ geo: new THREE.CylinderGeometry(0.045, 0.045, 0.75, 6), matrix: new Mb().makeTranslation(X + 0.45, 2.25, -5.7), su: 1, sv: 1 });
      this.add(inert(new THREE.Mesh(mergeParts(boilerParts), R.material({ texture: 'metal', color: 0x3e3b36 }))));
      var gauge = new THREE.Mesh(new THREE.CircleGeometry(0.1, 10), R.material({ texture: 'white', color: 0xe8e2d0, emissive: 0.45 }));
      gauge.position.set(X + 0.35, 1.3, -5.088);
      this.add(inert(gauge));
      var needle = this.box(0.012, 0.08, 0.005, R.material({ texture: 'white', color: 0xb02018, emissive: 0.3 }), X + 0.35, 1.32, -5.084);
      needle.rotation.z = -0.7; // casi en rojo
      inert(needle);
      var valve = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 4, 10), R.material({ texture: 'white', color: 0x9a2a22, emissive: 0.15 }));
      valve.position.set(X - 0.35, 1.15, -5.07);
      this.add(inert(valve));
      this.collider(X - 0.65, X + 0.65, -6, -5.08);
      var fuse = this.box(0.12, 0.55, 0.4, R.material({ texture: 'metal', color: 0x8a8d90 }), X + 1.43, 1.5, -3);
      var fuseLed = this.box(0.02, 0.04, 0.04, R.material({ texture: 'white', color: 0xff3020, emissive: 1.3 }), X + 1.36, 1.72, -2.88);
      this.interactive(fuse, 'fusibles');
      this.interactive(fuseLed, 'fusibles');
      // La etiqueta amarilla de advertencia (un rayo en un triángulo).
      var warn = MR.Textures.dynamic(16, 16);
      var wx = warn.ctx;
      wx.fillStyle = '#e8c23a'; wx.beginPath(); wx.moveTo(8, 1); wx.lineTo(15, 14); wx.lineTo(1, 14); wx.closePath(); wx.fill();
      wx.fillStyle = '#1a1a1a'; wx.beginPath(); wx.moveTo(9, 4); wx.lineTo(6, 9); wx.lineTo(8, 9); wx.lineTo(7, 13); wx.lineTo(10, 8); wx.lineTo(8, 8); wx.closePath(); wx.fill();
      warn.texture.needsUpdate = true;
      var sticker = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.14), R.material({ map: warn.texture, emissive: 0.35 }));
      sticker.rotation.y = -Math.PI / 2;
      sticker.position.set(X + 1.364, 1.38, -3.0);
      this.add(inert(sticker));
      // Bombilla colgando.
      this.box(0.01, 0.25, 0.01, m.dark, X, 2.48, 0.8);
      var bulb = this.box(0.08, 0.1, 0.08, R.material({ texture: 'white', color: 0xffe2a8, emissive: 1.3 }), X, 2.3, 0.8);

      // Lavabo con espejo, en la pared derecha frente a los casilleros (el reflejo lo dibuja espejo.js).
      var porcelain = R.material({ texture: 'white', color: 0xd8d6cc });
      var sink = this.box(0.42, 0.14, 0.5, porcelain, X + 1.27, 0.86, 2.2);
      this.box(0.14, 0.78, 0.14, porcelain, X + 1.35, 0.4, 2.2);
      var tap = this.box(0.14, 0.05, 0.04, m.metal, X + 1.4, 1.02, 2.2);
      this.interactive(sink, 'lavabo');
      this.interactive(tap, 'lavabo');
      this.collider(X + 1.0, X + 1.5, 1.9, 2.5);
      var frame = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.8), m.dark);
      frame.rotation.y = -Math.PI / 2;
      frame.position.set(X + 1.475, 1.58, 2.2);
      this.add(inert(frame));
      var mirror = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.72), m.dark);
      mirror.rotation.y = -Math.PI / 2;
      mirror.position.set(X + 1.465, 1.58, 2.2);
      this.add(inert(mirror));
      this.mirror = { mesh: mirror, hide: [mirror, frame], planeX: X + 1.465, center: new V3(X + 1.465, 1.58, 2.2) };

      // Anclas y zonas del Cliente Inmóvil.
      this.anchors.pasillo_fondo = { x: X, z: -4.4, rot: Math.PI, seated: false, zone: 'pasillo_fondo' };
      this.anchors.pasillo_puerta = { x: X + 0.9, z: 5.3, rot: Math.atan2(0.9, 9.3), seated: false, zone: 'pasillo_puerta' };
      this.zones.pasillo_fondo = { center: new V3(X, 1.2, -4.5), radius: 1.8 };
      this.zones.pasillo_puerta = { center: new V3(X + 0.6, 1.2, 5.2), radius: 1.4 };
      this.zones.pasillo_casilleros = { center: new V3(X - 1.1, 1.2, 2.6), radius: 2.2 };

      this.pasillo = {
        door: door,
        lockers: lockers,
        lastLabel: lastLabel,
        fuseLed: fuseLed,
        flame: flameMat,
        bulb: bulb,
        anchors: ['pasillo_fondo', 'pasillo_puerta'],
        zones: ['pasillo_fondo', 'pasillo_puerta', 'pasillo_casilleros'],
        spawnInside: { x: X, z: 5.4, yaw: 0 },
        spawnOutside: { x: 6.8, z: -4.0, yaw: Math.PI },
        area: { minX: X - 1.5, maxX: X + 1.5, minZ: -6, maxZ: 6.2 },
        bounds: { minX: X - 1.2, maxX: X + 1.2, minZ: -4.8, maxZ: 5.6 },
        ambient: new V3(0.05, 0.05, 0.06),
        lights: [
          [X, 2.25, 0.8, new THREE.Color(1.0, 0.85, 0.6), 1.15, 7.5],     // bombilla
          [X, 0.6, -4.6, new THREE.Color(1.0, 0.5, 0.2), 0.8, 4.5],       // caldera
          [X + 1.2, 1.6, -2.9, new THREE.Color(1.0, 0.2, 0.15), 0.25, 1.6], // foco de los fusibles
          [0, -100, 0, new THREE.Color(0, 0, 0), 0, 1],
          [0, -100, 0, new THREE.Color(0, 0, 0), 0, 1],
          [0, -100, 0, new THREE.Color(0, 0, 0), 0, 1]
        ]
      };
    }

    // ---------------------------------------------------------------------------------------------
    /**
     * El bosque, afuera de la lavandería. Vive lejos (z ≈ 100–150) para que nunca se dibuje a la vez que el
     * interior (la cámara ve 30 m). Se llega por la puerta de vidrio; se vuelve por la puerta de la fachada.
     * Fachada iluminada, farola, sendero entre pinos y un claro con una lavadora que no debería estar ahí.
     */
    _forest() {
      var R = this.retro;
      var m = this.mat;
      var seed = 20261002;
      function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
      function between(a, b) { return a + (b - a) * rnd(); }

      var mt = {
        ground: R.material({ texture: 'tierra' }),
        path: R.material({ texture: 'sendero' }),
        bark: R.material({ texture: 'corteza' }),
        pine: R.material({ texture: 'pino' }),
        brick: R.material({ texture: 'ladrillo' }),
        rock: R.material({ texture: 'roca' }),
        lit: R.material({ texture: 'glass', color: 0xdff0ff, emissive: 1.0 }),
        lamp: R.material({ texture: 'white', color: 0xffb060, emissive: 1.2 }),
        green: R.material({ texture: 'white', color: 0x7dff9a, emissive: 1.0 })
      };

      // Suelo y sendero hasta el claro.
      mt.path.uniforms.uEmissive.value = 0.14; // el sendero se adivina en la oscuridad
      var ground = new THREE.Mesh(scaleUV(new THREE.PlaneGeometry(46, 52, 23, 26), 15, 17), mt.ground);
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(0, 0, 125);
      this.add(inert(ground));
      var route = [[0, 100.6], [0.4, 104], [-1.2, 108], [-1.6, 112], [0, 116], [2.4, 120], [3.2, 124], [2.2, 128], [3.4, 132], [5, 136], [6, 140]];
      var pos = [];
      var uvs = [];
      var nor = [];
      var along = 0;
      for (var i = 0; i < route.length - 1; i += 1) {
        var a = route[i];
        var b = route[i + 1];
        var dx = b[0] - a[0];
        var dz = b[1] - a[1];
        var len = Math.hypot(dx, dz);
        var px = -dz / len * 0.8;
        var pz = dx / len * 0.8;
        var v0 = along / 1.6;
        var v1 = (along + len) / 1.6;
        along += len;
        var q = [[a[0] - px, a[1] - pz, 0, v0], [a[0] + px, a[1] + pz, 1, v0], [b[0] + px, b[1] + pz, 1, v1], [b[0] - px, b[1] - pz, 0, v1]];
        [0, 2, 1, 0, 3, 2].forEach(function (k) { pos.push(q[k][0], 0.015, q[k][1]); uvs.push(q[k][2], q[k][3]); nor.push(0, 1, 0); });
      }
      var pathGeo = new THREE.BufferGeometry();
      pathGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      pathGeo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      pathGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      this.add(inert(new THREE.Mesh(pathGeo, mt.path)));
      var clearing = new THREE.Mesh(scaleUV(new THREE.CircleGeometry(4.6, 14), 3, 3), mt.path);
      clearing.rotation.x = -Math.PI / 2;
      clearing.position.set(6, 0.012, 140.5);
      this.add(inert(clearing));

      // Fachada de la lavandería (vista desde afuera), con su letrero y la puerta de vidrio iluminada.
      this.add(inert(new THREE.Mesh(scaleUV(new THREE.BoxGeometry(16, 3.4, 0.3, 16, 4, 1), 8, 1.7), mt.brick))).position.set(0, 1.7, 99.7);
      this.box(16.4, 0.2, 0.7, m.dark, 0, 3.45, 100.05);
      var doors = [];
      [-0.8, 0.8].forEach(function (x) {
        var g = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 2.4, 2, 3), mt.lit);
        g.position.set(x, 1.2, 100.02);
        this.add(g);
        this.interactive(g, 'entrarLavanderia');
        doors.push(g);
      }, this);
      this.box(0.06, 2.4, 0.08, m.metal, 0, 1.2, 100.05);
      [-4.6, 4.6].forEach(function (x) {
        var w = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.5, 4, 2), mt.lit);
        w.position.set(x, 1.55, 100.02);
        this.add(w);
      }, this);
      var sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6, 3, 1), m.sign);
      sign.position.set(0, 2.85, 100.03);
      this.add(sign);
      // Alero sobre las puertas, su marco y las bajantes de lluvia (una sola malla).
      var facadeParts = [];
      function pa(x, y, z, w, h, d, rx) {
        var mm = new THREE.Matrix4().makeTranslation(x, y, z);
        if (rx) { mm.multiply(new THREE.Matrix4().makeRotationX(rx)); }
        facadeParts.push({ geo: new THREE.BoxGeometry(1, 1, 1), matrix: mm.multiply(new THREE.Matrix4().makeScale(w, h, d)), su: 1, sv: 1 });
      }
      pa(0, 2.55, 100.5, 3.8, 0.07, 0.95, -0.12);               // el alero
      pa(-1.62, 1.2, 100.08, 0.08, 2.5, 0.1);                   // el marco de las puertas
      pa(1.62, 1.2, 100.08, 0.08, 2.5, 0.1);
      pa(0, 2.44, 100.08, 3.32, 0.08, 0.1);
      pa(-7.85, 1.7, 100.12, 0.09, 3.4, 0.09);                  // las bajantes
      pa(7.85, 1.7, 100.12, 0.09, 3.4, 0.09);
      this.add(inert(new THREE.Mesh(mergeParts(facadeParts), R.material({ texture: 'metal', color: 0x34383c }))));
      this.collider(-8.3, 8.3, 99.4, 100.3);

      // Farola de sodio: base, poste que se afina, brazo curvo y la carcasa sobre el vidrio encendido (una sola malla).
      var Mf = THREE.Matrix4;
      var bxf = new THREE.BoxGeometry(1, 1, 1);
      var lampParts = [];
      function pf(x, y, z, w, h, d, rz) {
        var mm = new Mf().makeTranslation(x, y, z);
        if (rz) { mm.multiply(new Mf().makeRotationZ(rz)); }
        lampParts.push({ geo: bxf, matrix: mm.multiply(new Mf().makeScale(w, h, d)), su: 1, sv: 1 });
      }
      pf(-4.5, 0.15, 103.2, 0.3, 0.3, 0.3);                     // la base
      lampParts.push({ geo: new THREE.CylinderGeometry(0.05, 0.08, 3.7, 8), matrix: new Mf().makeTranslation(-4.5, 2.15, 103.2), su: 1, sv: 2 });
      pf(-4.42, 4.02, 103.2, 0.22, 0.06, 0.06, 0.6);            // el brazo, curvo
      pf(-4.2, 4.08, 103.2, 0.3, 0.06, 0.06);
      pf(-4.05, 4.0, 103.2, 0.44, 0.08, 0.3);                   // la carcasa
      this.add(inert(new THREE.Mesh(mergeParts(lampParts), m.metal)));
      var lampHead = this.box(0.38, 0.06, 0.24, mt.lamp, -4.05, 3.93, 103.2);
      this.collider(-4.65, -4.35, 103.05, 103.35);
      // El tendedero (solo con luna llena): uniformes colgados entre dos postes junto al sendero, que se mecen sin
      // viento (bosque.js).
      var line = new THREE.Group();
      line.position.set(-2.9, 0, 117.6);
      line.rotation.y = -1.0;
      [-1.4, 1.4].forEach(function (x) { this.box(0.1, 2.2, 0.1, mt.bark || m.wood, x, 1.1, 0, line); }, this);
      this.box(2.8, 0.015, 0.015, m.metal, 0, 2.05, 0, line);
      var uniMat = R.material({ texture: 'white', color: 0x6f7f8f, side: THREE.DoubleSide });
      var shirts = [];
      [-0.8, 0, 0.8].forEach(function (x) {
        var pivot = new THREE.Group();
        pivot.position.set(x, 2.04, 0);
        var shirt = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.66), uniMat);
        shirt.position.y = -0.34;
        pivot.add(shirt);
        line.add(pivot);
        shirts.push(pivot);
      });
      line.visible = false;
      this.add(line);
      // La segunda farola: solo en noches de niebla, más adentro; nunca te acercas y, si la pierdes de vista, se apaga
      // (bosque.js). Sin colisión: nunca llegas a ella.
      var lamp2 = new THREE.Group();
      lamp2.position.set(-7, 0, 126);
      this.box(0.12, 4.0, 0.12, m.metal, 0, 2.0, 0, lamp2);
      this.box(0.5, 0.06, 0.06, m.metal, 0.23, 3.98, 0, lamp2);
      var lamp2Mat = R.material({ texture: 'white', color: 0xffb060, emissive: 1.2 });
      this.box(0.38, 0.12, 0.24, lamp2Mat, 0.45, 3.92, 0, lamp2);
      lamp2.visible = false;
      this.add(lamp2);

      // La lavadora del claro: encendida, sin cable, con su foco verde.
      var wm = new THREE.Group();
      wm.position.set(6.6, 0, 141.2);
      wm.rotation.set(0, Math.atan2(5 - 6.6, 136 - 141.2), 0.07);
      this.add(wm);
      var body = this.box(0.62, 0.88, 0.62, R.material({ texture: 'washer', color: 0x9a927c }), 0, 0.44, 0, wm);
      var port = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 10), R.material({ texture: 'glass', color: 0x6fae84, emissive: 0.5 }));
      port.rotation.x = Math.PI / 2;
      port.position.set(0, 0.42, 0.32);
      wm.add(port);
      var wmLamp = this.box(0.05, 0.05, 0.02, mt.green, 0.2, 0.78, 0.32, wm);
      // Adentro gira un uniforme como el tuyo (bosque.js lo detiene con las seis hojas).
      var claroDrum = new THREE.Mesh(new THREE.CircleGeometry(0.17, 12), R.material({ texture: 'uniformeGira', color: 0xb8e0c4, emissive: 0.45 }));
      claroDrum.position.set(0, 0.42, 0.343);
      wm.add(claroDrum);
      this.interactive(body, 'lavadoraBosque');
      this.interactive(port, 'lavadoraBosque');
      this.interactive(claroDrum, 'lavadoraBosque');
      this.collider(6.15, 7.05, 140.75, 141.65);

      // Seis hojas mojadas del registro, cerca del sendero (la última, sobre la lavadora del claro).
      var pageMat = R.material({ texture: 'paper', color: 0xcfc8b0, emissive: 0.35 });
      var pages = [];
      [[1.4, 105.5], [-2.7, 113.5], [4.2, 125.5], [1.2, 129.4], [6.2, 135.0]].forEach(function (p, i) {
        var pg = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.28), pageMat);
        pg.rotation.set(-Math.PI / 2, 0, i * 1.3 + 0.4);
        pg.position.set(p[0], 0.025, p[1]);
        this.add(pg);
        this.interactive(pg, 'paginaBosque', i);
        pages.push(pg);
      }, this);
      var last = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.28), pageMat);
      last.rotation.set(-Math.PI / 2, 0, 0.3);
      last.position.set(0.05, 0.885, -0.05);
      wm.add(last);
      this.interactive(last, 'paginaBosque', 5);
      pages.push(last);

      // Anclas del Cliente Inmóvil entre los árboles (de pie, mirando al sendero) y zonas de oclusión.
      var zoneDefs = {
        bosque_entrada: { center: new V3(-1, 1.2, 109), radius: 4.5 },
        bosque_sendero: { center: new V3(1, 1.2, 119.5), radius: 5 },
        bosque_fondo: { center: new V3(5, 1.2, 130), radius: 4 },
        bosque_claro: { center: new V3(6, 1.2, 141.5), radius: 5 }
      };
      Object.keys(zoneDefs).forEach(function (k) { this.zones[k] = zoneDefs[k]; }, this);
      function nearestRoute(x, z) {
        var best = route[0];
        var bd = Infinity;
        route.forEach(function (r) { var d = Math.hypot(r[0] - x, r[1] - z); if (d < bd) { bd = d; best = r; } });
        return best;
      }
      var spots = { bosque_a: [-3.6, 109.5], bosque_b: [4.4, 115.5], bosque_c: [-2.6, 123.5], bosque_d: [7.0, 129.5], bosque_e: [9.6, 139], bosque_f: [3.0, 145.5] };
      var forestAnchors = [];
      Object.keys(spots).forEach(function (name) {
        var s = spots[name];
        var t = nearestRoute(s[0], s[1]);
        var zone = Object.keys(zoneDefs).reduce(function (best, k) {
          var c = zoneDefs[k].center;
          var d = Math.hypot(c.x - s[0], c.z - s[1]);
          return d < best.d ? { k: k, d: d } : best;
        }, { k: null, d: Infinity }).k;
        this.anchors[name] = { x: s[0], z: s[1], rot: Math.atan2(-(t[0] - s[0]), -(t[1] - s[1])), seated: false, zone: zone };
        forestAnchors.push(name);
      }, this);

      // Pinos (tronco + 3 conos) y rocas, unidos en pocas geometrías. Lejos del sendero, del claro y de las anclas.
      function distToRoute(x, z) {
        var best = Infinity;
        for (var r = 0; r < route.length - 1; r += 1) {
          var ax = route[r][0];
          var az = route[r][1];
          var bx = route[r + 1][0] - ax;
          var bz = route[r + 1][1] - az;
          var t = Math.max(0, Math.min(1, ((x - ax) * bx + (z - az) * bz) / (bx * bx + bz * bz)));
          best = Math.min(best, Math.hypot(x - ax - bx * t, z - az - bz * t));
        }
        return best;
      }
      var trees = [];
      var trunks = [];
      var crowns = [];
      var M4 = THREE.Matrix4;
      var tries = 0;
      while (trees.length < 165 && tries < 4000) {
        tries += 1;
        var x = between(-21.5, 21.5);
        var z = between(101.2, 149.5);
        if (z < 105 && Math.abs(x) < 9) { continue; }                 // explanada frente a la fachada
        if (distToRoute(x, z) < 1.8) { continue; }
        if (Math.hypot(x - 6, z - 140.5) < 5.2) { continue; }
        if (Math.hypot(x + 4.5, z - 103.2) < 1.5) { continue; }
        if (Math.hypot(x + 14.5, z - 129) < 2.6) { continue; }      // el claro de la secadora solitaria
        if (Math.hypot(x - 8.5, z - 121) < 2.4) { continue; }       // la campana de la escuela
        if (Math.abs(x + 12) < 6.2 && Math.abs(z - 116) < 2.6) { continue; } // el río seco y el puente viejo
        var blocked = false;
        for (var n = 0; n < forestAnchors.length && !blocked; n += 1) {
          var an = this.anchors[forestAnchors[n]];
          if (Math.hypot(x - an.x, z - an.z) < 1.2) { blocked = true; }
        }
        for (var o = 0; o < trees.length && !blocked; o += 1) {
          if (Math.hypot(x - trees[o][0], z - trees[o][1]) < 1.45) { blocked = true; }
        }
        if (blocked) { continue; }
        var h = between(1.1, 1.8);
        var r0 = between(0.13, 0.22);
        var size = between(0.85, 1.25);
        trees.push([x, z]);
        trunks.push({ geo: new THREE.CylinderGeometry(r0 * 0.7, r0, h, 6), matrix: new M4().makeTranslation(x, h / 2, z), su: 1, sv: 2 });
        for (var c = 0; c < 3; c += 1) {
          var cr = (1.7 - c * 0.42) * size;
          var ch = (2.1 - c * 0.25) * size;
          var cy = h + c * 1.15 * size + ch / 2 - 0.25;
          var rotY = new M4().makeRotationY(rnd() * Math.PI);
          crowns.push({ geo: new THREE.ConeGeometry(cr, ch, 7), matrix: new M4().makeTranslation(x, cy, z).multiply(rotY), su: 3, sv: 2 });
        }
        this.collider(x - 0.25, x + 0.25, z - 0.25, z + 0.25);
      }
      var rocks = [];
      for (var k = 0; k < 26; k += 1) {
        var rx = between(-20, 20);
        var rz = between(102, 149);
        if (distToRoute(rx, rz) < 1.2 || (rz < 104.5 && Math.abs(rx) < 9)) { continue; }
        var s = between(0.15, 0.5);
        rocks.push({ geo: new THREE.DodecahedronGeometry(s, 0), matrix: new M4().makeTranslation(rx, s * 0.5, rz), su: 1, sv: 1 });
      }
      this.add(inert(new THREE.Mesh(mergeParts(trunks), mt.bark)));
      this.add(inert(new THREE.Mesh(mergeParts(crowns), mt.pine)));
      if (rocks.length) { this.add(inert(new THREE.Mesh(mergeParts(rocks), mt.rock))); }

      // La secadora solitaria (bosque infinito): aparece después de dar dos vueltas (bosque.js). Encendida, sin cable.
      var lone = new THREE.Group();
      lone.position.set(-14.5, 0, 129);
      lone.rotation.y = 0.6;
      var loneBody = this.box(0.86, 1.0, 0.8, R.material({ texture: 'white', color: 0xd9d6cc }), 0, 0.5, 0, lone);
      var lonePort = new THREE.Mesh(new THREE.CircleGeometry(0.26, 12), R.material({ texture: 'white', color: 0xffb35a, emissive: 1.1 }));
      lonePort.position.set(0, 0.55, 0.41);
      lone.add(lonePort);
      // La ropa seca que da vueltas adentro, bajo la luz naranja.
      var loneDrum = new THREE.Mesh(new THREE.CircleGeometry(0.2, 12), R.material({ texture: 'ropaSeca', color: 0xffc890, emissive: 0.8 }));
      loneDrum.position.set(0, 0.55, 0.414);
      lone.add(loneDrum);
      this.interactive(loneDrum, 'secadoraSola');
      this.box(0.6, 0.06, 0.04, R.material({ texture: 'white', color: 0x9a988f }), 0, 0.92, 0.41, lone);
      [loneBody, lonePort].forEach(function (o) { this.interactive(o, 'secadoraSola'); }, this);
      lone.visible = false;
      this.add(lone);
      // La campana de la escuela de Blackwood (tercera vuelta del bosque infinito): marco de madera y campana de bronce.
      var bell = new THREE.Group();
      bell.position.set(8.5, 0, 121);
      bell.rotation.y = -0.4;
      var frameMat = R.material({ texture: 'corteza', color: 0x6a5240 });
      this.box(0.12, 2.3, 0.12, frameMat, -0.6, 1.15, 0, bell);
      this.box(0.12, 2.3, 0.12, frameMat, 0.6, 1.15, 0, bell);
      this.box(1.4, 0.12, 0.14, frameMat, 0, 2.3, 0, bell);
      var bronze = R.material({ texture: 'metal', color: 0x8a6a3a, emissive: 0.15 });
      var cup = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.26, 0.4, 10, 1, true), bronze);
      cup.position.set(0, 1.98, 0);
      bell.add(cup);
      var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 10), bronze);
      cap.position.set(0, 2.2, 0);
      bell.add(cap);
      [cup, cap].concat(bell.children.slice(0, 3)).forEach(function (o) { this.interactive(o, 'campana'); }, this);
      bell.visible = false;
      this.add(bell);

      // El puente viejo de Blackwood (cuarta vuelta del bosque infinito, bosque.js): un río seco y un puente de madera
      // sin nombre. En la baranda, el marco vacío de la placa (la que deja la máscara en la caja del mostrador).
      var bridge = new THREE.Group();
      bridge.position.set(-12, 0, 116);
      var bed = new THREE.Mesh(new THREE.PlaneGeometry(11, 2.2), R.material({ texture: 'white', color: 0x3b3833 }));
      bed.rotation.x = -Math.PI / 2;
      bed.position.y = 0.015;
      bridge.add(inert(bed));
      var stones = [];
      [[-4.6, 0.5], [-3.1, -0.6], [-1.6, 0.3], [1.8, -0.4], [3.3, 0.6], [4.8, -0.2], [0.9, 0.75], [-0.9, -0.8]].forEach(function (s, i) {
        var size = 0.12 + (i % 3) * 0.06;
        stones.push({ geo: new THREE.DodecahedronGeometry(size, 0), matrix: new M4().makeTranslation(s[0], size * 0.4, s[1]), su: 1, sv: 1 });
      });
      bridge.add(inert(new THREE.Mesh(mergeParts(stones), R.material({ texture: 'white', color: 0x77736a }))));
      var wood = R.material({ texture: 'corteza', color: 0x7a5c44 });
      this.box(1.3, 0.1, 3.6, wood, 0, 0.12, 0, bridge);
      var rails = [];
      [-0.62, 0.62].forEach(function (rx) {
        [-1.6, 1.6].forEach(function (rz) { rails.push({ geo: new THREE.BoxGeometry(0.1, 0.85, 0.1), matrix: new M4().makeTranslation(rx, 0.55, rz), su: 1, sv: 1 }); });
        rails.push({ geo: new THREE.BoxGeometry(0.08, 0.08, 3.3), matrix: new M4().makeTranslation(rx, 0.95, 0), su: 1, sv: 3 });
      });
      var railMesh = new THREE.Mesh(mergeParts(rails), wood);
      bridge.add(railMesh);
      var frame = this.box(0.04, 0.24, 0.44, R.material({ texture: 'white', color: 0x24211d }), 0.68, 0.78, 0, bridge);
      var plaque = this.box(0.03, 0.17, 0.36, R.material({ texture: 'metal', color: 0x9a7840, emissive: 0.25 }), 0.71, 0.78, 0, bridge);
      plaque.visible = false;
      [railMesh, frame, plaque].forEach(function (o) { this.interactive(o, 'puente'); }, this);
      bridge.visible = false;
      this.add(bridge);
      // Las barandas: colisión solo cuando el puente existe (bosque.js las enciende).
      var railColliders = [];
      [-0.62, 0.62].forEach(function (rx) {
        this.collider(-12 + rx - 0.06, -12 + rx + 0.06, 116 - 1.65, 116 + 1.65);
        var c = this.colliders[this.colliders.length - 1];
        c.off = true;
        railColliders.push(c);
      }, this);

      // Bordes: no se puede salir del bosque (ni rodear la fachada). El bosque infinito (bosque.js) te devuelve antes.
      this.collider(-23.5, -22.2, 98, 152);
      this.collider(22.2, 23.5, 98, 152);
      this.collider(-23.5, 23.5, 150.2, 152);
      this.collider(-23.5, -8.2, 98, 100.3);
      this.collider(8.2, 23.5, 98, 100.3);

      this.forest = {
        pages: pages,
        doors: doors,
        litMaterial: mt.lit,
        lampMaterial: mt.lamp,
        washerLamp: wmLamp,
        lampHead: lampHead,
        lamp2: lamp2,
        loneDryer: lone,
        loneDrum: loneDrum,
        claroDrum: claroDrum,
        bell: bell,
        bellCup: cup,
        bridge: bridge,
        bridgeBed: bed,
        bridgeFrame: frame,
        plaque: plaque,
        bridgeColliders: railColliders,
        lonePort: lonePort,
        clothesline: line,
        shirts: shirts,
        lamp2Mat: lamp2Mat,
        anchors: forestAnchors,
        zones: Object.keys(zoneDefs),
        trees: trees.length,
        treePos: trees, // [x, z] de cada pino: para esconderse detrás (mimetismo arbóreo, horror.js)
        spawnOutside: { x: 0, z: 101.6, yaw: Math.PI },
        spawnInside: { x: 0, z: 4.2, yaw: 0 },
        flashlight: 4,
        bounds: { minX: -20, maxX: 20, minZ: 101, maxZ: 148 },          // dónde puede reaparecer el cliente
        area: { minX: -22.2, maxX: 22.2, minZ: 100.3, maxZ: 150.2 },    // por dónde puedes caminar
        // [x, y, z, color, intensidad, alcance] por ranura de luz (0–5) mientras estás afuera.
        lights: [
          [-2.5, 1.8, 101.4, new THREE.Color(0.86, 0.93, 1.0), 0.9, 7.0],   // brillo del interior por el vidrio
          [2.5, 1.8, 101.4, new THREE.Color(0.86, 0.93, 1.0), 0.9, 7.0],
          [-4.05, 3.8, 103.2, new THREE.Color(1.0, 0.62, 0.3), 1.3, 12.0],  // farola de sodio
          [6.6, 1.1, 141.6, new THREE.Color(0.5, 1.0, 0.6), 0.9, 6.0],      // la lavadora del claro
          [0, 1.6, 101.6, new THREE.Color(1.0, 0.95, 0.85), 1.1, 8.5],      // linterna del celular (sigue al jugador)
          [0, -100, 0, new THREE.Color(0, 0, 0), 0, 1]
        ]
      };
    }
  }

  MR.World = World;
  MR.mergeParts = mergeParts; // para unir piezas en una sola malla fuera del mundo (las manos, player.js)
})(window.MR = window.MR || {});
