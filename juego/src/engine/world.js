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
      this._cafe();
      this._entrance();
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
        var porthole = new THREE.Mesh(new THREE.CircleGeometry(0.16, 12), m.glass);
        porthole.position.set(0.22, 0, 0.025);
        doorPivot.add(porthole);
        this.interactive(porthole, 'washerDoor', i);
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
        this.interactive(body, 'dryerStart', i); // una moneda y gira (el filtro, delante, tiene prioridad)
        this.interactive(drum, 'dryerStart', i);
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
      // El banco amarillo se puede tocar: frío, tibio… o él sentado ahí (game.touchBench).
      this.interactive(this.box(3.0, 0.08, 0.5, m.yellow, -3.5, 0.47, 0.62), 'banco');
      this.interactive(this.box(3.0, 0.5, 0.06, m.yellow, -3.5, 0.78, 0.88), 'banco');
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
      [body, face, slot].forEach(function (mesh) { this.interactive(mesh, 'cafe'); }, this);
      this.collider(-3.6, -2.8, 4.42, 5);
    }

    _entrance() {
      var m = this.mat;
      [-0.8, 0.8].forEach(function (x) {
        var g = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 2.4), m.glass);
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
        // Sombrero de ala ancha (gira con la cabeza): le ensombrece la cara.
        var brim = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.02, 10), m.dark);
        brim.position.set(0, 0.15, 0);
        h.add(brim);
        var crown = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.15, 10), m.dark);
        crown.position.set(0, 0.23, 0);
        h.add(crown);
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
      // De pie: más alto que una persona (~2 m), abrigo hasta las rodillas, brazos que cuelgan de más.
      this.box(0.15, 1.0, 0.17, m.dark, -0.1, 0.5, 0, standing);
      this.box(0.15, 1.0, 0.17, m.dark, 0.1, 0.5, 0, standing);
      this.box(0.54, 0.8, 0.34, m.coat, 0, 0.82, 0, standing);  // falda del abrigo
      this.box(0.5, 0.82, 0.31, m.coat, 0, 1.52, 0, standing);  // torso
      this.box(0.1, 0.92, 0.12, m.coat, -0.31, 1.24, 0, standing);
      this.box(0.1, 0.92, 0.12, m.coat, 0.31, 1.24, 0, standing);
      this.box(0.08, 0.1, 0.08, m.face, -0.31, 0.74, 0, standing); // manos pálidas
      this.box(0.08, 0.1, 0.08, m.face, 0.31, 0.74, 0, standing);
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
      this.collider(X - 0.65, X + 0.65, -6, -5.08);
      var fuse = this.box(0.12, 0.55, 0.4, R.material({ texture: 'metal', color: 0x8a8d90 }), X + 1.43, 1.5, -3);
      var fuseLed = this.box(0.02, 0.04, 0.04, R.material({ texture: 'white', color: 0xff3020, emissive: 1.3 }), X + 1.36, 1.72, -2.88);
      this.interactive(fuse, 'fusibles');
      this.interactive(fuseLed, 'fusibles');
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
      this.add(inert(new THREE.Mesh(scaleUV(new THREE.BoxGeometry(16, 3.4, 0.3), 8, 1.7), mt.brick))).position.set(0, 1.7, 99.85);
      this.box(16.4, 0.2, 0.7, m.dark, 0, 3.45, 100.05);
      var doors = [];
      [-0.8, 0.8].forEach(function (x) {
        var g = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 2.4), mt.lit);
        g.position.set(x, 1.2, 100.02);
        this.add(g);
        this.interactive(g, 'entrarLavanderia');
        doors.push(g);
      }, this);
      this.box(0.06, 2.4, 0.08, m.metal, 0, 1.2, 100.05);
      [-4.6, 4.6].forEach(function (x) {
        var w = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.5), mt.lit);
        w.position.set(x, 1.55, 100.02);
        this.add(w);
      }, this);
      var sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), m.sign);
      sign.position.set(0, 2.85, 100.03);
      this.add(sign);
      this.collider(-8.3, 8.3, 99.4, 100.3);

      // Farola de sodio.
      this.box(0.12, 4.0, 0.12, m.metal, -4.5, 2.0, 103.2);
      this.box(0.5, 0.06, 0.06, m.metal, -4.27, 3.98, 103.2);
      var lampHead = this.box(0.38, 0.12, 0.24, mt.lamp, -4.05, 3.92, 103.2);
      this.collider(-4.65, -4.35, 103.05, 103.35);
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
      this.interactive(body, 'lavadoraBosque');
      this.interactive(port, 'lavadoraBosque');
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

      // Bordes: no se puede salir del bosque (ni rodear la fachada).
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
        lamp2Mat: lamp2Mat,
        anchors: forestAnchors,
        zones: Object.keys(zoneDefs),
        trees: trees.length,
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
})(window.MR = window.MR || {});
