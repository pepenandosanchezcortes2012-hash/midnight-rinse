/**
 * Director de IA inquietante (skill uncanny-ai-director): el cerebro de conducta de los NPCs de Midnight Rinse.
 * Es puro (sin THREE ni DOM): corre igual en el juego y en node (tests/director.test.js). Sus piezas:
 *  - percibir: cuánto te mira el jugador (foco, periferia, fuera de vista, ojos cerrados, limpiando el vaho).
 *  - Utilidad: cada NPC puntúa sus conductas y elige una. Se compromete un rato (no cambia de idea a cada cuadro) y
 *    lleva ruido con semilla: no es predecible, pero una partida con semilla se puede repetir.
 *  - Contemplacion: si lo miras de golpe, se queda inmóvil de 3 a 5 s antes de decidir qué hacer.
 *  - Mirada: el cuello gira despacio hacia ti; los ojos se clavan un segundo después.
 *  - Respiracion: si te acercas demasiado, contiene el aire y deja de moverse hasta que te alejas.
 *  - Agente: navegación por fuerzas (buscar, llegar frenando, rodear obstáculos, espacio personal) con inercia, paso
 *    pesado y desatasco. Nunca queda dentro de una caja de colisión.
 *  - elegirPuntoCiego: a dónde reaparecer sin que lo veas aparecer (al borde de tu vista, más cerca o en su rutina).
 *  - Mimetismo arbóreo (elegirArbol, escondite, tapado): siempre un tronco entre él y tus ojos.
 * Ángulos como en el juego: un rumbo de 0 mira hacia −z, y el frente de un rumbo r es (−sen r, −cos r).
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  else { root.MR = root.MR || {}; Object.assign(root.MR, api); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PI = Math.PI;
  var FOCO = 0.35;       // ~20°: te está mirando
  var FOV_MEDIO = 0.75;  // borde horizontal de la vista (fov vertical 70°, pantalla 4:3)

  /** Números al azar con semilla (mulberry32). */
  function semilla(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }

  /** Ángulo a (−π, π]. */
  function envolver(a) {
    while (a > PI) { a -= PI * 2; }
    while (a <= -PI) { a += PI * 2; }
    return a;
  }

  /** El rumbo que mira en la dirección (dx, dz). */
  function rumbo(dx, dz) { return Math.atan2(-dx, -dz); }

  // ------------------------------------------------------------------------------------------- percepción
  /**
   * Qué tanto ve el jugador un punto. j: { x, z, yaw, ojosCerrados, limpiando }. Devuelve { angulo (0 a π, entre la
   * vista y el punto), distancia, lado (+1 a la izquierda, −1 a la derecha), nivel, oculto }. Niveles: 'ojos_cerrados',
   * 'limpiando' (la mano tapa la vista), 'foco', 'periferia' y 'fuera'.
   */
  function percibir(j, p, fovMedio) {
    var fov = fovMedio || FOV_MEDIO;
    var dx = p.x - j.x;
    var dz = p.z - j.z;
    var d = Math.hypot(dx, dz);
    var rel = d > 1e-6 ? envolver(rumbo(dx, dz) - j.yaw) : 0;
    var ang = Math.abs(rel);
    var nivel;
    if (j.ojosCerrados) { nivel = 'ojos_cerrados'; }
    else if (j.limpiando) { nivel = 'limpiando'; }
    else if (ang < FOCO) { nivel = 'foco'; }
    else if (ang < fov) { nivel = 'periferia'; }
    else { nivel = 'fuera'; }
    return { angulo: ang, distancia: d, lado: rel >= 0 ? 1 : -1, nivel: nivel,
      oculto: nivel === 'ojos_cerrados' || nivel === 'limpiando' || nivel === 'fuera' };
  }

  // ------------------------------------------------------------------------------------------- utilidad
  /**
   * La conducta de más puntaje entre { nombre: 0 a 1 }, con ruido (±ruido). Un puntaje de 0 o menos queda fuera.
   * Devuelve null si ninguna se puede.
   */
  function elegirUna(puntajes, rnd, ruido) {
    var mejor = null;
    var max = -Infinity;
    Object.keys(puntajes).forEach(function (n) {
      var u = puntajes[n];
      if (!(u > 0)) { return; }
      var s = u + (rnd() - 0.5) * 2 * (ruido || 0);
      if (s > max) { max = s; mejor = n; }
    });
    return mejor;
  }

  /**
   * Toma de decisiones por utilidad. conductas: { nombre: function (ctx) → 0 a 1 }. o: { compromiso (bono para la
   * conducta actual), ruido, minimo (s antes de poder cambiar), periodo (s entre evaluaciones), rnd, inicial }.
   */
  class Utilidad {
    constructor(conductas, o) {
      o = o || {};
      this.conductas = conductas;
      this.nombres = Object.keys(conductas);
      this.compromiso = o.compromiso !== undefined ? o.compromiso : 0.15;
      this.ruido = o.ruido !== undefined ? o.ruido : 0.1;
      this.minimo = o.minimo !== undefined ? o.minimo : 2;
      this.periodo = o.periodo !== undefined ? o.periodo : 0.5;
      this.rnd = o.rnd || Math.random;
      this.actual = o.inicial || this.nombres[0];
      this.tiempo = 0;
      this.espera = 0;
      this.puntajes = {};
    }

    /** Avanza dt y, cada `periodo`, vuelve a evaluar (salvo con puede === false). Devuelve la conducta actual. */
    actualizar(dt, ctx, puede) {
      this.tiempo += dt;
      this.espera -= dt;
      if (this.espera > 0 || puede === false) { return this.actual; }
      this.espera = this.periodo;
      var self = this;
      var bonos = {};
      this.nombres.forEach(function (n) {
        var u = clamp(+self.conductas[n](ctx) || 0, 0, 1);
        self.puntajes[n] = u;
        bonos[n] = u > 0 && n === self.actual ? u + self.compromiso : u;
      });
      var mejor = elegirUna(bonos, this.rnd, this.ruido);
      if (mejor && mejor !== this.actual && (this.tiempo >= this.minimo || !(this.puntajes[this.actual] > 0))) {
        this.actual = mejor;
        this.tiempo = 0;
      }
      return this.actual;
    }

    forzar(n) { this.actual = n; this.tiempo = 0; this.espera = this.periodo; }
  }

  // ------------------------------------------------------------------------------------------- contemplación
  /**
   * Pausa de contemplación: si el jugador lo pone en foco de golpe (venía de no verlo hace menos de `subito` s: giró la
   * cámara o abrió los ojos ya girado), se queda inmóvil de `min` a `max` s, evaluando. Si la mirada llega despacio
   * (desde la periferia) no se sobresalta. Después descansa `enfriamiento` s.
   */
  class Contemplacion {
    constructor(rnd, o) {
      o = o || {};
      this.rnd = rnd || Math.random;
      this.min = o.min !== undefined ? o.min : 3;
      this.max = o.max !== undefined ? o.max : 5;
      this.enfriamiento = o.enfriamiento !== undefined ? o.enfriamiento : 6;
      this.subito = o.subito !== undefined ? o.subito : 0.35;
      this.congelado = 0;
      this.frio = 0;
      this.desdeFuera = Infinity;
      this.veces = 0;
    }

    /** nivel: el de percibir. alcance: false si está demasiado lejos para importar. Devuelve true mientras se congela. */
    actualizar(dt, nivel, alcance) {
      if (this.congelado > 0) {
        this.congelado = Math.max(0, this.congelado - dt);
        if (this.congelado === 0) { this.frio = this.enfriamiento; }
        return this.congelado > 0;
      }
      this.frio = Math.max(0, this.frio - dt);
      if (nivel === 'ojos_cerrados' || nivel === 'limpiando') { return false; } // a ciegas: no cuenta ni se olvida
      if (nivel === 'fuera') { this.desdeFuera = 0; return false; }
      this.desdeFuera += dt;
      if (nivel === 'foco' && this.desdeFuera <= this.subito && this.frio === 0 && alcance !== false) {
        this.congelado = this.min + this.rnd() * (this.max - this.min);
        this.desdeFuera = Infinity;
        this.veces += 1;
        return true;
      }
      return false;
    }
  }

  // ------------------------------------------------------------------------------------------- mirada
  /**
   * Seguimiento de cabeza desfasado. El cuello gira despacio (suave y con tope de velocidad) hacia el objetivo; los ojos
   * esperan `retraso` s desde que hay objetivo y entonces se clavan rápido, sumando lo que le falta al cuello.
   * actualizar(dt, objetivo): ángulo relativo al cuerpo, o null para volver al frente. Lee this.cuello y this.ojos.
   */
  class Mirada {
    constructor(o) {
      o = o || {};
      this.velCuello = o.velCuello || 0.9;
      this.suavidad = o.suavidad || 2.2;
      this.retraso = o.retraso !== undefined ? o.retraso : 1.0;
      this.velOjos = o.velOjos || 5;
      this.limCuello = o.limCuello || 1.2;
      this.limOjos = o.limOjos || 0.55;
      this.cuello = 0;
      this.ojos = 0;
      this.siguiendo = 0;
      this.ultimo = null;
    }

    actualizar(dt, objetivo) {
      var hay = objetivo !== null && objetivo !== undefined;
      var meta = hay ? clamp(objetivo, -this.limCuello - this.limOjos, this.limCuello + this.limOjos) : 0;
      var paso = (clamp(meta, -this.limCuello, this.limCuello) - this.cuello) * Math.min(1, dt * this.suavidad);
      var tope = this.velCuello * dt;
      this.cuello += clamp(paso, -tope, tope);
      if (!hay) { this.siguiendo = 0; }
      else {
        if (this.ultimo !== null && Math.abs(envolver(objetivo - this.ultimo)) > 0.6) { this.siguiendo = 0; } // saltó: otra vez
        this.siguiendo += dt;
      }
      this.ultimo = hay ? objetivo : null;
      var metaOjos = hay && this.siguiendo >= this.retraso ? clamp(meta - this.cuello, -this.limOjos, this.limOjos) : 0;
      var topeOjos = this.velOjos * dt;
      this.ojos += clamp(metaOjos - this.ojos, -topeOjos, topeOjos);
      return this;
    }

    /** ¿Ya te tiene clavados los ojos? */
    clavada(objetivo) {
      return this.siguiendo >= this.retraso && Math.abs(objetivo - this.cuello - this.ojos) < 0.12;
    }
  }

  // ------------------------------------------------------------------------------------------- respiración
  /**
   * Respiración y micro-movimientos. Si el jugador está a menos de `cerca` m, contiene el aire enseguida (amplitud a 0);
   * vuelve a respirar despacio cuando se aleja más allá de `lejos`. Lee this.pecho (desplazamiento) y this.micro (0 a 1,
   * para escalar balanceos y temblores).
   */
  class Respiracion {
    constructor(rnd, o) {
      o = o || {};
      this.fase = (rnd || Math.random)() * PI * 2;
      this.ritmo = o.ritmo || 1.5; // rad/s: unas 14 respiraciones por minuto
      this.cerca = o.cerca || 1.3;
      this.lejos = o.lejos || 2.0;
      this.micro = 1;
      this.pecho = 0;
    }

    actualizar(dt, distancia) {
      if (distancia < this.cerca) { this.micro = Math.max(0, this.micro - dt * 4); }
      else if (distancia > this.lejos) { this.micro = Math.min(1, this.micro + dt * 0.35); }
      this.fase += dt * this.ritmo * this.micro;
      this.pecho = Math.sin(this.fase) * this.micro;
      return this;
    }

    get contenida() { return this.micro < 0.05; }
  }

  // ------------------------------------------------------------------------------------------- navegación
  /** ¿El segmento a→b no toca ninguna caja (agrandada en r)? Prueba de losas. */
  function segmentoLibre(ax, az, bx, bz, cajas, r) {
    var dx = bx - ax;
    var dz = bz - az;
    for (var i = 0; i < cajas.length; i += 1) {
      var c = cajas[i];
      if (c.off) { continue; }
      var t0 = 0;
      var t1 = 1;
      var minX = c.minX - r;
      var maxX = c.maxX + r;
      var minZ = c.minZ - r;
      var maxZ = c.maxZ + r;
      if (Math.abs(dx) < 1e-9) { if (ax < minX || ax > maxX) { continue; } }
      else {
        var a1 = (minX - ax) / dx;
        var a2 = (maxX - ax) / dx;
        t0 = Math.max(t0, Math.min(a1, a2));
        t1 = Math.min(t1, Math.max(a1, a2));
        if (t0 > t1) { continue; }
      }
      if (Math.abs(dz) < 1e-9) { if (az < minZ || az > maxZ) { continue; } }
      else {
        var b1 = (minZ - az) / dz;
        var b2 = (maxZ - az) / dz;
        t0 = Math.max(t0, Math.min(b1, b2));
        t1 = Math.min(t1, Math.max(b1, b2));
        if (t0 > t1) { continue; }
      }
      return false;
    }
    return true;
  }

  /** ¿El punto queda a menos de r de alguna caja? */
  function choca(x, z, cajas, r) {
    for (var i = 0; i < cajas.length; i += 1) {
      var c = cajas[i];
      if (c.off) { continue; }
      var dx = x - clamp(x, c.minX, c.maxX);
      var dz = z - clamp(z, c.minZ, c.maxZ);
      if (dx * dx + dz * dz < r * r - 1e-9) { return true; }
    }
    return false;
  }

  // Cuadrículas de ocupación ya calculadas (por lista de cajas, límites y radio): se arman una sola vez.
  var CUADRICULAS = typeof WeakMap === 'function' ? new WeakMap() : null;
  var CELDA = 0.2;

  function cuadricula(cajas, lim, r) {
    var porCajas = CUADRICULAS && CUADRICULAS.get(cajas);
    var clave = [lim.minX, lim.maxX, lim.minZ, lim.maxZ, r].join();
    if (porCajas && porCajas[clave]) { return porCajas[clave]; }
    var nx = Math.max(1, Math.round((lim.maxX - lim.minX) / CELDA));
    var nz = Math.max(1, Math.round((lim.maxZ - lim.minZ) / CELDA));
    var libre = new Uint8Array(nx * nz);
    for (var iz = 0; iz < nz; iz += 1) {
      for (var ix = 0; ix < nx; ix += 1) {
        var x = lim.minX + (ix + 0.5) * CELDA;
        var z = lim.minZ + (iz + 0.5) * CELDA;
        var dentro = x > lim.minX + r && x < lim.maxX - r && z > lim.minZ + r && z < lim.maxZ - r;
        libre[iz * nx + ix] = dentro && !choca(x, z, cajas, r + 0.04) ? 1 : 0;
      }
    }
    var q = { nx: nx, nz: nz, lim: lim, libre: libre };
    if (CUADRICULAS) {
      if (!porCajas) { porCajas = {}; CUADRICULAS.set(cajas, porCajas); }
      porCajas[clave] = q;
    }
    return q;
  }

  /** La celda libre más cercana a (x, z) (busca en anillos), o −1. */
  function celdaLibre(q, x, z) {
    var cx = clamp(Math.floor((x - q.lim.minX) / CELDA), 0, q.nx - 1);
    var cz = clamp(Math.floor((z - q.lim.minZ) / CELDA), 0, q.nz - 1);
    for (var r = 0; r < 12; r += 1) {
      var mejor = -1;
      var md = Infinity;
      for (var dz = -r; dz <= r; dz += 1) {
        for (var dx = -r; dx <= r; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) { continue; }
          var ix = cx + dx;
          var iz = cz + dz;
          if (ix < 0 || iz < 0 || ix >= q.nx || iz >= q.nz || !q.libre[iz * q.nx + ix]) { continue; }
          var d = dx * dx + dz * dz;
          if (d < md) { md = d; mejor = iz * q.nx + ix; }
        }
      }
      if (mejor >= 0) { return mejor; }
    }
    return -1;
  }

  /**
   * Ruta sin choques de a a b (A* en una cuadrícula de 20 cm, 8 vecinos, sin cortar esquinas), estirada para que cada
   * tramo se vea libre. Devuelve [[x, z], …] que termina en b, o null si no hay paso.
   */
  function planificar(ax, az, bx, bz, cajas, lim, r) {
    var q = cuadricula(cajas, lim, r);
    var a = celdaLibre(q, ax, az);
    var b = celdaLibre(q, bx, bz);
    if (a < 0 || b < 0) { return null; }
    var n = q.nx * q.nz;
    var g = new Float32Array(n).fill(Infinity);
    var de = new Int32Array(n).fill(-1);
    var cerrado = new Uint8Array(n);
    var f = new Float32Array(n).fill(Infinity);
    // Montículo binario de celdas abiertas, ordenado por f.
    var monticulo = [];
    function meter(i) {
      monticulo.push(i);
      var k = monticulo.length - 1;
      while (k > 0) {
        var p = (k - 1) >> 1;
        if (f[monticulo[p]] <= f[i]) { break; }
        monticulo[k] = monticulo[p];
        k = p;
      }
      monticulo[k] = i;
    }
    function sacar() {
      var top = monticulo[0];
      var ult = monticulo.pop();
      if (monticulo.length) {
        var k = 0;
        for (;;) {
          var l = 2 * k + 1;
          if (l >= monticulo.length) { break; }
          var c = l + 1 < monticulo.length && f[monticulo[l + 1]] < f[monticulo[l]] ? l + 1 : l;
          if (f[monticulo[c]] >= f[ult]) { break; }
          monticulo[k] = monticulo[c];
          k = c;
        }
        monticulo[k] = ult;
      }
      return top;
    }
    var bxc = b % q.nx;
    var bzc = Math.floor(b / q.nx);
    function h(i) { var dx = Math.abs(i % q.nx - bxc); var dz = Math.abs(Math.floor(i / q.nx) - bzc); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); }
    g[a] = 0;
    f[a] = h(a);
    meter(a);
    var VEC = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    while (monticulo.length) {
      var cur = sacar();
      if (cur === b) { break; }
      if (cerrado[cur]) { continue; }
      cerrado[cur] = 1;
      var cx = cur % q.nx;
      var cz = Math.floor(cur / q.nx);
      for (var v = 0; v < 8; v += 1) {
        var nx = cx + VEC[v][0];
        var nz = cz + VEC[v][1];
        if (nx < 0 || nz < 0 || nx >= q.nx || nz >= q.nz) { continue; }
        var ni = nz * q.nx + nx;
        if (!q.libre[ni] || cerrado[ni]) { continue; }
        if (VEC[v][2] > 1 && (!q.libre[cz * q.nx + nx] || !q.libre[nz * q.nx + cx])) { continue; }
        var ng = g[cur] + VEC[v][2];
        if (ng < g[ni]) {
          g[ni] = ng;
          f[ni] = ng + h(ni);
          de[ni] = cur;
          meter(ni);
        }
      }
    }
    if (a !== b && de[b] < 0) { return null; }
    var celdas = [];
    for (var c = b; c >= 0; c = c === a ? -1 : de[c]) { celdas.push(c); }
    celdas.reverse();
    var puntos = celdas.map(function (i) {
      return [q.lim.minX + (i % q.nx + 0.5) * CELDA, q.lim.minZ + (Math.floor(i / q.nx) + 0.5) * CELDA];
    });
    if (!choca(bx, bz, cajas, r)) { puntos[puntos.length - 1] = [bx, bz]; }
    // Estirar: desde cada punto, el más lejano que se ve libre.
    var ruta = [];
    var desde = [ax, az];
    var i0 = 0;
    while (i0 < puntos.length) {
      var lejos = i0;
      for (var t = puntos.length - 1; t > i0; t -= 1) {
        if (segmentoLibre(desde[0], desde[1], puntos[t][0], puntos[t][1], cajas, r)) { lejos = t; break; }
      }
      ruta.push(puntos[lejos]);
      desde = puntos[lejos];
      i0 = lejos + 1;
    }
    return ruta;
  }

  /**
   * Un caminante que navega por fuerzas de dirección. o: { x, z, rumbo, velMax (m/s), aceleracion y frenado (m/s²:
   * inercia), giro (rad/s), radio, pesadez (0 a 1: paso pesado), zancada (m por ciclo de paso), rnd }.
   * La ruta son puntos de paso [x, z] (con un tercer elemento true, ese tramo cruza una puerta: sin colisión).
   */
  class Agente {
    constructor(o) {
      o = o || {};
      this.x = o.x || 0;
      this.z = o.z || 0;
      this.rumbo = o.rumbo || 0;
      this.v = 0;
      this.velMax = o.velMax || 0.95;
      this.acel = o.aceleracion || 1.3;
      this.fren = o.frenado || 2.0;
      this.giro = o.giro || 3.0;
      this.radio = o.radio || 0.24;
      this.pesadez = o.pesadez || 0;
      this.zancada = o.zancada || 1.3;
      this.rnd = o.rnd || Math.random;
      this.fase = 0;
      this.ruta = null;
      this.i = 0;
      this.llego = false;
      this.esperando = false;
      this.atascado = false;
      this.sinAvance = 0;
      this.mejor = Infinity;
      this.rodeo = 0;
      this.rodeoLado = 1;
      this.rodeaHasta = -1;
      this.espera = 0;
      this.rodeoJugador = false;
    }

    get vx() { return -Math.sin(this.rumbo) * this.v; }
    get vz() { return -Math.cos(this.rumbo) * this.v; }

    ponerRuta(ruta) {
      this.ruta = ruta ? ruta.slice() : null; // copia: el plan se mete en ella
      this.i = 0;
      this.llego = !ruta || !ruta.length;
      this.atascado = false;
      this.planeado = -1;
      this.rodeaHasta = -1;
      this.espera = 0;
      this.rodeoJugador = false;
      this._reiniciarAvance();
    }

    /**
     * Lleva un rato esperándote: si no estás parado sobre el punto al que va (una puerta, su lugar), planifica un rodeo
     * que te trata como una caja de 0,9 m y lo sigue pasando a tu lado (con un espacio personal más chico). Si no hay
     * rodeo posible, sigue esperando.
     */
    _rodearJugador(cajas, m) {
      this.rodeoJugador = true;
      if (!m.limites) { return; }
      var obj = this.ruta[this.i];
      var j = m.jugador;
      if (Math.hypot(obj[0] - j.x, obj[1] - j.z) < (m.espacio || 1.0) + this.radio + 0.1) { return; } // le tapas el destino
      var caja = { minX: j.x - 0.45, maxX: j.x + 0.45, minZ: j.z - 0.45, maxZ: j.z + 0.45 };
      var plan = planificar(this.x, this.z, obj[0], obj[1], cajas.concat([caja]), m.limites, this.radio + 0.03);
      if (!plan || plan.length < 2) { return; }
      plan.pop();
      Array.prototype.splice.apply(this.ruta, [this.i, 0].concat(plan));
      this.rodeaHasta = this.i + plan.length + 1;
      this.planeado = this.i;
      this._reiniciarAvance();
    }

    /** Si no ve libre el punto al que va, mete en la ruta un camino planificado que rodea lo que estorba. */
    _planear(cajas, lim) {
      if (!lim || this.planeado === this.i) { return; }
      this.planeado = this.i;
      var obj = this.ruta[this.i];
      if (segmentoLibre(this.x, this.z, obj[0], obj[1], cajas, this.radio + 0.02)) { return; }
      var plan = planificar(this.x, this.z, obj[0], obj[1], cajas, lim, this.radio + 0.03);
      if (!plan || plan.length < 2) { return; }
      plan.pop(); // el último es el mismo punto de la ruta
      Array.prototype.splice.apply(this.ruta, [this.i, 0].concat(plan));
      this.planeado = this.i;
      this._reiniciarAvance();
    }

    _reiniciarAvance() { this.sinAvance = 0; this.mejor = Infinity; this.rodeo = 0; }

    /**
     * Un paso. m: { obstaculos: [cajas {minX, maxX, minZ, maxZ}], limites: {minX, maxX, minZ, maxZ}, jugador: {x, z},
     * espacio (m de espacio personal, 1 por defecto), otros: [{x, z, r}] }. Devuelve this.
     */
    paso(dt, m) {
      m = m || {};
      var cajas = m.obstaculos || [];
      var ruta = this.ruta;
      this.esperando = false;
      if (this.llego) { this.v = Math.max(0, this.v - this.fren * dt); return this; } // ya llegó: termina de frenar, quieto
      var dvx = 0;
      var dvz = 0;
      var puerta = false;
      if (ruta && ruta.length && !this.llego) {
        // 1. Atajo: si el punto siguiente se ve libre, deja el actual (la ruta se vuelve curva, sin esquinas).
        while (this.i < ruta.length - 1) {
          var p = ruta[this.i];
          var n = ruta[this.i + 1];
          var cerca = Math.hypot(p[0] - this.x, p[1] - this.z) < 0.45;
          var rodeando = this.i < this.rodeaHasta; // rodeándote: punto por punto (el atajo no sabe que estás ahí)
          if (cerca || (!rodeando && !n[2] && segmentoLibre(this.x, this.z, n[0], n[1], cajas, this.radio + 0.06))) {
            this.i += 1;
            this._reiniciarAvance();
          } else { break; }
        }
        if (!ruta[this.i][2]) { this._planear(cajas, m.limites); }
        var obj = ruta[this.i];
        puerta = !!obj[2];
        var final = this.i === ruta.length - 1;
        var tx = obj[0] - this.x;
        var tz = obj[1] - this.z;
        var d = Math.hypot(tx, tz);
        if (final && (puerta ? d < 0.25 : d < 0.04 && this.v < 0.2)) { // del otro lado de una puerta ya no se ve: basta acercarse
          // Se planta en el punto; lo poco que le queda de velocidad se le va frenando, sin moverse (ni en seco).
          this.x = obj[0];
          this.z = obj[1];
          this.v = Math.max(0, this.v - this.fren * dt);
          this.llego = true;
          return this;
        }
        // 2. Buscar y llegar: al final frena con su propia inercia (v² = 2·a·d), y lento en los últimos centímetros.
        var vel = this.velMax;
        if (final) { vel = Math.min(vel, Math.sqrt(2 * this.fren * 0.8 * d), d * 3); }
        if (d > 1e-6) { dvx = tx / d * vel; dvz = tz / d * vel; }
        // 3. Desatasco: si no se acerca al punto en 1 s, rodea un rato hacia el lado libre; a los 3 s lo salta.
        if (d < this.mejor - 0.03) { this.mejor = d; this.sinAvance = 0; }
        else if (!this.esperando) { this.sinAvance += dt; }
        if (this.sinAvance > 1 && this.rodeo <= 0 && !puerta) {
          this.planeado = -1; // lo empujaron o se desvió: planifica otra vez desde donde está
          this.rodeo = 0.9;
          var ix = -tz / Math.max(d, 1e-6);
          var iz = tx / Math.max(d, 1e-6);
          var izq = segmentoLibre(this.x, this.z, this.x + ix * 0.7, this.z + iz * 0.7, cajas, this.radio);
          var der = segmentoLibre(this.x, this.z, this.x - ix * 0.7, this.z - iz * 0.7, cajas, this.radio);
          this.rodeoLado = izq && !der ? 1 : (der && !izq ? -1 : (this.rnd() < 0.5 ? 1 : -1));
        }
        if (this.rodeo > 0) {
          this.rodeo -= dt;
          var s = this.rodeoLado * this.velMax * 0.8 / Math.max(d, 1e-6);
          dvx = dvx * 0.4 - tz * s;
          dvz = dvz * 0.4 + tx * s;
        }
        if (this.sinAvance > 3) {
          if (!final) { this.i += 1; this._reiniciarAvance(); }
          else if (this.sinAvance > 6) { this.atascado = true; }
        }
        // 4. Rodear obstáculos: cerca de una caja, quita lo que va contra ella (se desliza por el borde) y la aparta.
        if (!puerta) {
          var margen = 0.45;
          for (var k = 0; k < cajas.length; k += 1) {
            var c = cajas[k];
            if (c.off) { continue; }
            var ex = this.x - clamp(this.x, c.minX, c.maxX);
            var ez = this.z - clamp(this.z, c.minZ, c.maxZ);
            var dd = Math.hypot(ex, ez);
            if (dd >= this.radio + margen || dd < 1e-6) { continue; }
            var nx = ex / dd;
            var nz = ez / dd;
            var f = clamp(1 - (dd - this.radio) / margen, 0, 1);
            var contra = dvx * nx + dvz * nz;
            if (contra < 0) {
              var mag = Math.hypot(dvx, dvz);
              dvx -= nx * contra * f;
              dvz -= nz * contra * f;
              var nm = Math.hypot(dvx, dvz);
              if (nm > 1e-6) { dvx *= Math.min(mag / nm, 1.6); dvz *= Math.min(mag / nm, 1.6); } // no pierde el paso al deslizarse
            }
            dvx += nx * f * f * this.velMax * 0.35;
            dvz += nz * f * f * this.velMax * 0.35;
          }
        }
        // 5. Los demás: se apartan sin empujarse (salvo cruzando una puerta: ahí pasan de a uno, sin trabarse).
        (puerta ? [] : m.otros || []).forEach(function (o) {
          var ox = this.x - o.x;
          var oz = this.z - o.z;
          var od = Math.hypot(ox, oz);
          var lim = this.radio + (o.r || 0.25) + 0.25;
          if (od < lim && od > 1e-6) {
            var g = (1 - od / lim) * this.velMax;
            dvx += ox / od * g;
            dvz += oz / od * g;
          }
        }, this);
        // 6. Espacio personal: si estás delante, frena como si llegara a ti y se detiene a `espacio` m (o si estás
        //    pegado, de cualquier lado). Ahí espera en silencio. Si la espera se alarga y no estás parado sobre su destino
        //    (una puerta, su lavadora), te rodea: planifica un camino que pasa a tu lado sin rozarte.
        if (m.jugador) {
          var esp = this.i < this.rodeaHasta ? Math.min(m.espacio || 1.0, 0.55) : (m.espacio || 1.0);
          var px = m.jugador.x - this.x;
          var pz = m.jugador.z - this.z;
          var pd = Math.hypot(px, pz);
          var dm = Math.hypot(dvx, dvz);
          var delante = dm > 1e-6 && pd > 1e-6 ? (px * dvx + pz * dvz) / (pd * dm) : 1;
          if ((pd < esp + 0.02 && delante > 0.25) || pd < 0.45) {
            dvx = 0;
            dvz = 0;
            this.esperando = true;
            this.sinAvance = 0;
            this.espera += dt;
            if (this.espera > 1.2 && !this.rodeoJugador) { this._rodearJugador(cajas, m); }
          } else if (delante > 0.25 && pd < esp + 1.5 && dm > 1e-6) {
            var tope = Math.min(dm, Math.sqrt(2 * this.fren * 0.8 * (pd - esp)), (pd - esp) * 3);
            dvx *= tope / dm;
            dvz *= tope / dm;
          }
        }
      }
      if (!this.esperando) { this.espera = 0; this.rodeoJugador = false; }
      // 7. Inercia: gira con tope y acelera o frena gradual; si tiene que girar mucho, frena antes (no camina de costado).
      var quiere = Math.hypot(dvx, dvz);
      var falta = 0;
      if (quiere > 1e-4) {
        var dr = envolver(rumbo(dvx, dvz) - this.rumbo);
        var giro = this.giro * dt;
        this.rumbo = envolver(this.rumbo + clamp(dr, -giro, giro));
        falta = dr - clamp(dr, -giro, giro);
      }
      var meta = quiere * Math.max(0, Math.cos(clamp(falta, -PI / 2, PI / 2)));
      var a = meta > this.v ? this.acel : this.fren;
      this.v += clamp(meta - this.v, -a * dt, a * dt);
      // 8. Paso pesado: en cada pisada (dos por zancada) la velocidad cae un poco.
      this.fase += this.v * dt * PI * 2 / this.zancada;
      var pisada = 1 - this.pesadez * 0.35 * (0.5 + 0.5 * Math.cos(2 * this.fase));
      this.x += this.vx * dt * pisada;
      this.z += this.vz * dt * pisada;
      if (!puerta) { this._resolver(cajas, m.limites); }
      return this;
    }

    /** Nunca dentro de una caja ni fuera de los límites (como el jugador). */
    _resolver(cajas, lim) {
      var r = this.radio;
      for (var pase = 0; pase < 2; pase += 1) {
        for (var i = 0; i < cajas.length; i += 1) {
          var b = cajas[i];
          if (b.off) { continue; }
          var cx = clamp(this.x, b.minX, b.maxX);
          var cz = clamp(this.z, b.minZ, b.maxZ);
          var dx = this.x - cx;
          var dz = this.z - cz;
          var d2 = dx * dx + dz * dz;
          if (d2 >= r * r) { continue; }
          if (d2 > 1e-10) {
            var d = Math.sqrt(d2);
            this.x = cx + dx / d * r;
            this.z = cz + dz / d * r;
          } else {
            var pen = [this.x - b.minX, b.maxX - this.x, this.z - b.minZ, b.maxZ - this.z];
            var k = pen.indexOf(Math.min.apply(null, pen));
            if (k === 0) { this.x = b.minX - r; } else if (k === 1) { this.x = b.maxX + r; } else if (k === 2) { this.z = b.minZ - r; } else { this.z = b.maxZ + r; }
          }
        }
      }
      if (lim) {
        this.x = clamp(this.x, lim.minX + r, lim.maxX - r);
        this.z = clamp(this.z, lim.minZ + r, lim.maxZ - r);
      }
    }
  }

  // ------------------------------------------------------------------------------------------- punto ciego
  /**
   * A dónde moverse sin que lo vean aparecer. cands: [{ nombre, x, z, visible (0 a 1, lo que se ve de esa zona),
   * rutina (lugar de su rutina) }]. j: el jugador (x, z, yaw, ojosCerrados, limpiando). o: { modo ('periferia': justo
   * afuera del borde de tu vista; 'acercarse': lo más cerca posible sin estar encima, y a tu espalda; 'rutina'; 'lejos'),
   * actual, recientes: [nombres], rnd, ruido }. Nunca elige uno a la vista con los ojos abiertos. Con los ojos cerrados
   * prefiere igual los ocultos y, si no hay, uno fuera del foco a más de 2 m. Devuelve el candidato o null (esperar).
   */
  function elegirPuntoCiego(cands, j, o) {
    o = o || {};
    var rnd = o.rnd || Math.random;
    var ciego = j.ojosCerrados || j.limpiando;
    var ojos = { x: j.x, z: j.z, yaw: j.yaw };
    var mejor = null;
    var max = -Infinity;
    cands.forEach(function (c) {
      if (c.nombre === o.actual) { return; }
      var p = percibir(ojos, c);
      var oculto = !(c.visible > 0);
      if (!oculto && (!ciego || p.nivel === 'foco' || p.distancia < 2)) { return; }
      var s;
      if (o.modo === 'acercarse') { s = clamp(1 - (p.distancia - 2) / 8, 0, 1) * 0.7 + clamp((p.angulo - FOV_MEDIO) / (PI - FOV_MEDIO), 0, 1) * 0.3; }
      else if (o.modo === 'rutina') { s = c.rutina ? 0.8 : 0.15; }
      else if (o.modo === 'lejos') { s = clamp(p.distancia / 12, 0, 1); }
      else { s = 1 - clamp(Math.abs(p.angulo - (FOV_MEDIO + 0.25)) / 1.2, 0, 1); } // periferia
      if (!oculto) { s -= 0.5; }
      if (o.recientes && o.recientes.indexOf(c.nombre) >= 0) { s -= 0.3; }
      if (p.distancia < 1.6) { s -= 1; }
      s += (rnd() - 0.5) * 2 * (o.ruido !== undefined ? o.ruido : 0.12);
      if (s > max) { max = s; mejor = c; }
    });
    return mejor;
  }

  // ------------------------------------------------------------------------------------------- mimetismo arbóreo
  function ax(a) { return a.x !== undefined ? a.x : a[0]; }
  function az(a) { return a.z !== undefined ? a.z : a[1]; }

  /** El lugar detrás del tronco, sobre la línea de vista del jugador, a `separacion` m del centro del árbol. */
  function escondite(j, arbol, separacion) {
    var dx = ax(arbol) - j.x;
    var dz = az(arbol) - j.z;
    var d = Math.hypot(dx, dz) || 1;
    var s = separacion || 0.5;
    return { x: ax(arbol) + dx / d * s, z: az(arbol) + dz / d * s };
  }

  /** ¿Algún tronco (radio r) corta la línea que va del jugador al punto? */
  function tapado(j, p, arboles, r) {
    var dx = p.x - j.x;
    var dz = p.z - j.z;
    var l2 = dx * dx + dz * dz;
    if (l2 < 1e-9) { return false; }
    var rr = r || 0.22;
    for (var i = 0; i < arboles.length; i += 1) {
      var tx = ax(arboles[i]) - j.x;
      var tz = az(arboles[i]) - j.z;
      var t = (tx * dx + tz * dz) / l2;
      if (t <= 0.02 || t >= 0.98) { continue; }
      var ex = tx - dx * t;
      var ez = tz - dz * t;
      if (ex * ex + ez * ez < rr * rr) { return true; }
    }
    return false;
  }

  /**
   * El árbol donde esconderse: a entre `min` y `max` m del jugador, cerca de donde ya está la entidad (no salta lejos:
   * `alcance`) y de preferencia al costado de tu vista (para acechar desde la periferia). Devuelve el índice o −1.
   */
  function elegirArbol(j, e, arboles, o) {
    o = o || {};
    var min = o.min || 4;
    var max = o.max || 13;
    var alcance = o.alcance || 7;
    var rnd = o.rnd || Math.random;
    var mejor = -1;
    var best = -Infinity;
    for (var i = 0; i < arboles.length; i += 1) {
      var dj = Math.hypot(ax(arboles[i]) - j.x, az(arboles[i]) - j.z);
      if (dj < min || dj > max) { continue; }
      var h = escondite(j, arboles[i], o.separacion);
      var de = Math.hypot(h.x - e.x, h.z - e.z);
      if (de > alcance) { continue; }
      var ang = Math.abs(envolver(rumbo(ax(arboles[i]) - j.x, az(arboles[i]) - j.z) - j.yaw));
      var s = 1 - de / alcance + 0.4 * (1 - clamp(Math.abs(ang - FOV_MEDIO) / 1.2, 0, 1)) + (rnd() - 0.5) * 0.15;
      if (s > best) { best = s; mejor = i; }
    }
    return mejor;
  }

  return {
    Director: {
      FOCO: FOCO,
      FOV_MEDIO: FOV_MEDIO,
      semilla: semilla,
      envolver: envolver,
      rumbo: rumbo,
      percibir: percibir,
      elegirUna: elegirUna,
      Utilidad: Utilidad,
      Contemplacion: Contemplacion,
      Mirada: Mirada,
      Respiracion: Respiracion,
      segmentoLibre: segmentoLibre,
      choca: choca,
      planificar: planificar,
      Agente: Agente,
      elegirPuntoCiego: elegirPuntoCiego,
      escondite: escondite,
      tapado: tapado,
      elegirArbol: elegirArbol
    }
  };
});
