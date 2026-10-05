/**
 * Pruebas del director de IA (src/core/director.js, skill uncanny-ai-director). Puras: no cargan el juego.
 * Ejecutar: node --test juego/tests/director.test.js   (también las corre centinela.py)
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const D = require(path.join(__dirname, '..', 'src', 'core', 'director.js')).Director;

// Las cajas de colisión de la sala, copiadas de world.js (lavadoras, secadoras, cesto, banco, mostrador, café, marco de
// la puerta, cambiador y paredes del almacén). Si cambian allá, la prueba de partida «El director…» usa las reales.
const SALA = [
  { minX: -7.25, maxX: -1.25, minZ: -5, maxZ: -4.08 },
  { minX: 0.95, maxX: 5.05, minZ: -5, maxZ: -4.15 },
  { minX: 0.15, maxX: 0.75, minZ: -4.0, maxZ: -3.5 },
  { minX: -5.05, maxX: -1.95, minZ: 0.35, maxZ: 0.92 },
  { minX: 4.55, maxX: 7.65, minZ: 1.55, maxZ: 2.35 },
  { minX: -3.6, maxX: -2.8, minZ: 4.42, maxZ: 5 },
  { minX: -1.6, maxX: 1.6, minZ: 4.92, maxZ: 5.2 },
  { minX: -4.85, maxX: -4.15, minZ: 4.5, maxZ: 5 },
  { minX: -8, maxX: -6.55, minZ: 1.95, maxZ: 2.05 },
  { minX: -6.66, maxX: -6.54, minZ: 1.95, maxZ: 3.2 },
  { minX: -6.66, maxX: -6.54, minZ: 4.2, maxZ: 5 }
];
const LIM = { minX: -8, maxX: 8, minZ: -5, maxZ: 5 };
const DT = 1 / 30;

/** Camina una ruta; falla si entra en una caja, si se pasa de velocidad o si cambia de velocidad en seco. */
function caminar(ag, ruta, m, segundos) {
  ag.ponerRuta(ruta);
  const acelMax = Math.max(ag.acel, ag.fren) * DT + 1e-9;
  let v0 = ag.v;
  for (let t = 0; t < segundos * 30; t += 1) {
    ag.paso(DT, m);
    const enPuerta = ag.ruta[ag.i] && ag.ruta[ag.i][2];
    if (!enPuerta) {
      assert.ok(!D.choca(ag.x, ag.z, m.obstaculos, ag.radio - 1e-3), 'dentro de una caja en (' + ag.x.toFixed(2) + ', ' + ag.z.toFixed(2) + ')');
    }
    assert.ok(ag.v <= ag.velMax * 1.6 + 1e-9, 'demasiado rápido: ' + ag.v.toFixed(2));
    assert.ok(ag.llego || Math.abs(ag.v - v0) <= acelMax, 'cambio de velocidad en seco: ' + v0.toFixed(3) + ' → ' + ag.v.toFixed(3));
    v0 = ag.v;
    if (ag.llego) { return t * DT; }
  }
  return Infinity;
}

test('percibir: foco, periferia, fuera, ojos cerrados y limpiando el vaho (yaw 0 mira a −z)', () => {
  const j = { x: 0, z: 0, yaw: 0 };
  assert.equal(D.percibir(j, { x: 0, z: -5 }).nivel, 'foco');
  assert.equal(D.percibir(j, { x: -3, z: -5 }).nivel, 'periferia');
  assert.equal(D.percibir(j, { x: 0, z: 5 }).nivel, 'fuera');
  assert.equal(D.percibir(j, { x: -3, z: -5 }).lado, 1, 'a la izquierda es +1');
  assert.ok(Math.abs(D.percibir(j, { x: 0, z: 5 }).angulo - Math.PI) < 1e-9);
  assert.equal(D.percibir({ x: 0, z: 0, yaw: 0, ojosCerrados: true }, { x: 0, z: -5 }).nivel, 'ojos_cerrados');
  const l = D.percibir({ x: 0, z: 0, yaw: 0, limpiando: true }, { x: 0, z: -5 });
  assert.ok(l.nivel === 'limpiando' && l.oculto);
  assert.equal(D.percibir({ x: 0, z: 0, yaw: Math.PI / 2 }, { x: -5, z: 0 }).nivel, 'foco', 'yaw π/2 mira a −x');
});

test('Utilidad: elige lo mejor, se compromete, respeta el mínimo, no cambia mientras lo miran y se repite con semilla', () => {
  let a = 0.5;
  const u = new D.Utilidad({ uno: () => a, dos: () => 0.45, nunca: () => 0 }, { rnd: D.semilla(7), minimo: 2, ruido: 0.05 });
  let cambios = 0;
  let antes = u.actual;
  for (let t = 0; t < 600; t += 1) {
    const c = u.actualizar(DT, {});
    assert.notEqual(c, 'nunca');
    if (c !== antes) { cambios += 1; antes = c; }
  }
  assert.ok(cambios <= 2, 'cambia de idea a cada rato (' + cambios + ')');
  a = 0.1;
  u.actualizar(1, {}, false);
  assert.equal(u.actual, 'uno', 'cambió mientras no podía');
  for (let t = 0; t < 120; t += 1) { u.actualizar(DT, {}); }
  assert.equal(u.actual, 'dos', 'no pasó a la mejor');
  const seq = (s) => { const x = new D.Utilidad({ p: () => 0.5, q: () => 0.5, r: () => 0.5 }, { rnd: D.semilla(s), minimo: 0, compromiso: 0 }); const o = []; for (let i = 0; i < 40; i += 1) { o.push(x.actualizar(0.5, {})); } return o.join(); };
  assert.equal(seq(3), seq(3), 'con la misma semilla no se repite');
  assert.notEqual(seq(3), seq(4), 'con otra semilla es igual (predecible)');
});

test('Contemplación: mirarlo de golpe lo congela 3–5 s; si la mirada llega despacio o parpadeas, no', () => {
  const c = new D.Contemplacion(D.semilla(1));
  for (let i = 0; i < 30; i += 1) { assert.equal(c.actualizar(DT, 'fuera'), false); }
  assert.equal(c.actualizar(DT, 'foco'), true, 'no se congeló al mirarlo de golpe');
  let t = DT;
  while (c.actualizar(DT, 'foco')) { t += DT; }
  assert.ok(t >= 3 - 1e-6 && t <= 5 + DT, 'se congeló ' + t.toFixed(2) + ' s');
  const lento = new D.Contemplacion(D.semilla(2));
  lento.actualizar(DT, 'fuera');
  for (let i = 0; i < 20; i += 1) { assert.equal(lento.actualizar(DT, 'periferia'), false); }
  assert.equal(lento.actualizar(DT, 'foco'), false, 'se congeló con una mirada lenta');
  const parpadeo = new D.Contemplacion(D.semilla(3));
  for (let i = 0; i < 30; i += 1) { parpadeo.actualizar(DT, 'foco'); }
  for (let i = 0; i < 4; i += 1) { parpadeo.actualizar(DT, 'ojos_cerrados'); }
  assert.equal(parpadeo.actualizar(DT, 'foco'), false, 'cada parpadeo lo congela');
  const lejos = new D.Contemplacion(D.semilla(4));
  lejos.actualizar(DT, 'fuera');
  assert.equal(lejos.actualizar(DT, 'foco', false), false, 'se congela aunque esté lejísimos');
});

test('Mirada: el cuello gira despacio; los ojos esperan un segundo y luego se clavan', () => {
  const m = new D.Mirada();
  for (let i = 0; i < 15; i += 1) { m.actualizar(DT, 1.2); }
  assert.ok(m.cuello > 0 && m.cuello < 0.6, 'el cuello no gira despacio (' + m.cuello.toFixed(2) + ')');
  assert.equal(m.ojos, 0, 'los ojos se adelantaron');
  for (let i = 0; i < 18; i += 1) { m.actualizar(DT, 1.2); }
  assert.ok(m.ojos > 0, 'los ojos no se movieron después del segundo');
  for (let i = 0; i < 120; i += 1) { m.actualizar(DT, 1.2); }
  assert.ok(m.clavada(1.2), 'no terminó de mirarlo (' + (m.cuello + m.ojos).toFixed(2) + ')');
  for (let i = 0; i < 200; i += 1) { m.actualizar(DT, null); }
  assert.ok(Math.abs(m.cuello) < 0.02 && Math.abs(m.ojos) < 0.02, 'no volvió al frente');
});

test('Respiración: contiene el aire si te acercas y vuelve a respirar al alejarte', () => {
  const r = new D.Respiracion(D.semilla(5));
  for (let i = 0; i < 30; i += 1) { r.actualizar(DT, 5); }
  r.actualizar(DT, 1.0);
  for (let i = 0; i < 9; i += 1) { r.actualizar(DT, 1.0); }
  assert.ok(r.contenida, 'sigue respirando contigo encima (' + r.micro.toFixed(2) + ')');
  const p = r.pecho;
  for (let i = 0; i < 30; i += 1) { r.actualizar(DT, 1.6); }
  assert.ok(Math.abs(r.pecho - p) < 1e-9, 'el pecho se movió con el aire contenido');
  for (let i = 0; i < 30 * 4; i += 1) { r.actualizar(DT, 4); }
  assert.ok(r.micro > 0.9, 'no volvió a respirar');
});

test('Agente: de la puerta a cada lavadora y de vuelta, sin atravesar nada, sin frenar en seco y sin atascarse', () => {
  const m = { obstaculos: SALA, limites: LIM };
  for (let w = 0; w < 6; w += 1) {
    const wx = -6.75 + w;
    const ag = new D.Agente({ x: 0.4, z: 4.35, rumbo: 0, rnd: D.semilla(w), pesadez: 0.35 });
    const ida = caminar(ag, [[0.4, 1.8], [0.4, -3.2], [wx, -3.35]], m, 30);
    assert.ok(ida < 20, 'no llegó a la lavadora ' + w + ' (' + ida + ' s)');
    assert.ok(Math.hypot(ag.x - wx, ag.z + 3.35) < 0.05, 'no quedó en su lugar');
    const vuelta = caminar(ag, [[0.4, -3.2], [0.4, 1.8], [0.4, 4.35], [0, 5.3, true]], m, 30);
    assert.ok(vuelta < 20, 'no salió desde la lavadora ' + w);
  }
  // Las máscaras: al mostrador y, al terminar, a la puerta trasera.
  const mk = new D.Agente({ x: 0.4, z: 4.35, rnd: D.semilla(9), velMax: 0.85, pesadez: 0.6 });
  assert.ok(caminar(mk, [[1.2, 3.8], [3.4, 3.5], [5.9, 3.1]], m, 30) < 20, 'la máscara no llegó al mostrador');
  assert.ok(caminar(mk, [[4.2, 2.9], [4.2, 1.0], [6.8, -3.6], [6.8, -4.6], [6.8, -5.6, true]], m, 40) < 25, 'la máscara no salió por atrás');
});

test('Agente: 300 viajes al azar por la sala sin ruta, todos llegan (cero atascos)', () => {
  const rnd = D.semilla(1986);
  const m = { obstaculos: SALA, limites: LIM };
  const libre = () => {
    for (;;) {
      const x = -7.6 + rnd() * 15.2;
      const z = -4.6 + rnd() * 9.2;
      if (!D.choca(x, z, SALA, 0.4) && !(x < -6.5 && z > 1.9)) { return [x, z]; } // fuera del almacén (tiene su puerta)
    }
  };
  let peor = 0;
  for (let n = 0; n < 300; n += 1) {
    const a = libre();
    const b = libre();
    const ag = new D.Agente({ x: a[0], z: a[1], rumbo: rnd() * 6.28, rnd: D.semilla(n) });
    const t = caminar(ag, [b], m, 60);
    assert.ok(t < Infinity && !ag.atascado, 'se atascó yendo de ' + a.map((v) => v.toFixed(2)) + ' a ' + b.map((v) => v.toFixed(2)) + ' (quedó en ' + ag.x.toFixed(2) + ', ' + ag.z.toFixed(2) + ')');
    peor = Math.max(peor, t);
  }
  assert.ok(peor < 60);
});

test('Agente: arranca y se detiene gradual (inercia), con paso pesado', () => {
  const ag = new D.Agente({ x: 0, z: 0, rumbo: 0, pesadez: 0.6 });
  ag.ponerRuta([[0, -6]]);
  ag.paso(0.1, {});
  assert.ok(ag.v <= ag.acel * 0.1 + 1e-9 && ag.v > 0, 'arrancó en seco (' + ag.v + ')');
  const vs = [];
  for (let i = 0; i < 30 * 15 && !ag.llego; i += 1) { ag.paso(DT, {}); vs.push(ag.v); }
  assert.ok(ag.llego, 'no llegó');
  const fin = vs.slice(-12);
  assert.ok(fin.every((v, i) => i === 0 || v <= fin[i - 1] + 1e-9), 'no frenó de a poco al llegar');
  // Paso pesado: con la misma velocidad, avanza a tirones (más lento al pisar).
  const a = new D.Agente({ x: 0, z: 0, rumbo: 0, pesadez: 0.8 });
  a.v = a.velMax;
  a.ponerRuta([[0, -50]]);
  const pasos = [];
  for (let i = 0; i < 60; i += 1) { const z0 = a.z; a.paso(DT, {}); pasos.push(z0 - a.z); }
  assert.ok(Math.max(...pasos) / Math.min(...pasos) > 1.3, 'el paso no pesa');
});

test('Agente: si le bloqueas el paso se detiene a un metro y espera; cuando te apartas, sigue', () => {
  const ag = new D.Agente({ x: 0, z: 3, rumbo: 0 });
  ag.ponerRuta([[0, -3]]);
  const m = { obstaculos: [], jugador: { x: 0, z: 0 }, espacio: 1.0 };
  let esperó = false;
  for (let i = 0; i < 30 * 8; i += 1) { ag.paso(DT, m); if (ag.esperando) { esperó = true; } }
  assert.ok(esperó && !ag.llego, 'no esperó');
  assert.ok(Math.hypot(ag.x, ag.z) >= 0.9, 'se acercó demasiado (' + Math.hypot(ag.x, ag.z).toFixed(2) + ' m)');
  assert.ok(ag.v < 0.01, 'no se detuvo');
  m.jugador = { x: 3, z: 0 };
  for (let i = 0; i < 30 * 10 && !ag.llego; i += 1) { ag.paso(DT, m); }
  assert.ok(ag.llego, 'no siguió cuando te apartaste');
});

test('Agente: si estás parado en medio de la sala te rodea (sin rozarte); si le tapas la puerta, espera', () => {
  // En medio del pasillo central: espera un momento y pasa a tu lado.
  const m = { obstaculos: SALA, limites: LIM, jugador: { x: 0.4, z: 0.2 } };
  const ag = new D.Agente({ x: 0.4, z: 3.8, rumbo: 0, rnd: D.semilla(11) });
  ag.ponerRuta([[0.4, -3.0]]);
  let minD = Infinity;
  let espero = false;
  for (let i = 0; i < 30 * 30 && !ag.llego; i += 1) {
    ag.paso(DT, m);
    if (ag.esperando) { espero = true; }
    minD = Math.min(minD, Math.hypot(ag.x - m.jugador.x, ag.z - m.jugador.z));
  }
  assert.ok(espero, 'no se detuvo antes de rodearte');
  assert.ok(ag.llego, 'no te rodeó: se quedó esperando para siempre');
  assert.ok(minD >= 0.5, 'te rozó (' + minD.toFixed(2) + ' m)');
  // Parado en la puerta (su destino): espera en silencio, a un metro.
  const p = { obstaculos: SALA, limites: LIM, jugador: { x: 0.4, z: 4.55 } };
  const b = new D.Agente({ x: 0.4, z: 0.5, rumbo: Math.PI, rnd: D.semilla(12) });
  b.ponerRuta([[0.4, 4.35], [0, 5.3, true]]);
  let minB = Infinity;
  for (let i = 0; i < 30 * 20; i += 1) { b.paso(DT, p); minB = Math.min(minB, Math.hypot(b.x - p.jugador.x, b.z - p.jugador.z)); }
  assert.ok(!b.llego && b.esperando, 'pasó por la puerta que tapabas');
  assert.ok(minB >= 0.9, 'se te vino encima en la puerta (' + minB.toFixed(2) + ' m)');
});

test('Punto ciego: nunca a la vista con los ojos abiertos; periferia, acercarse y parpadeo', () => {
  const j = { x: 0, z: 0, yaw: 0 };
  const c = [
    { nombre: 'frente', x: 0, z: -5, visible: 1 },
    { nombre: 'borde', x: -4.2, z: -3, visible: 0 },  // justo afuera del borde izquierdo
    { nombre: 'espalda', x: 0.3, z: 2.4, visible: 0 }, // cerca y detrás
    { nombre: 'lejos', x: 3, z: 9, visible: 0 }
  ];
  for (let s = 0; s < 50; s += 1) {
    const r = D.elegirPuntoCiego(c, j, { modo: 'periferia', rnd: D.semilla(s) });
    assert.ok(r && r.visible === 0, 'eligió uno a la vista');
  }
  assert.equal(D.elegirPuntoCiego(c, j, { modo: 'periferia', ruido: 0 }).nombre, 'borde');
  assert.equal(D.elegirPuntoCiego(c, j, { modo: 'acercarse', ruido: 0 }).nombre, 'espalda');
  assert.equal(D.elegirPuntoCiego(c, j, { modo: 'periferia', ruido: 0, actual: 'borde', recientes: [] }).nombre === 'borde', false, 'eligió donde ya está');
  const vistos = [{ nombre: 'a', x: 0, z: -5, visible: 1 }, { nombre: 'b', x: 3.5, z: -3, visible: 1 }, { nombre: 'c', x: 0.5, z: -1, visible: 1 }];
  assert.equal(D.elegirPuntoCiego(vistos, j, { ruido: 0 }), null, 'con todo a la vista no debe moverse');
  const r = D.elegirPuntoCiego(vistos, { x: 0, z: 0, yaw: 0, ojosCerrados: true }, { ruido: 0 });
  assert.equal(r && r.nombre, 'b', 'con los ojos cerrados: fuera del foco y a más de 2 m');
});

test('Mimetismo arbóreo: un tronco siempre entre él y tú mientras caminas por el sendero', () => {
  const rnd = D.semilla(42);
  const arboles = [];
  while (arboles.length < 140) {
    const x = -20 + rnd() * 40;
    const z = 102 + rnd() * 46;
    if (Math.abs(x) < 1.8) { continue; } // el sendero
    if (arboles.every((t) => Math.hypot(t[0] - x, t[1] - z) > 1.45)) { arboles.push([x, z]); }
  }
  const j = { x: 0, z: 102, yaw: Math.PI }; // camina hacia +z por el sendero
  const e = { x: 5, z: 110 };
  let arbol = -1;
  let tapadoN = 0;
  let total = 0;
  for (let t = 0; t < 30 * 20; t += 1) {
    j.z += 1.2 * DT;
    if (t % 8 === 0) {
      const h = arbol >= 0 ? D.escondite(j, arboles[arbol], 0.5) : null;
      const dj = arbol >= 0 ? Math.hypot(arboles[arbol][0] - j.x, arboles[arbol][1] - j.z) : 0;
      if (arbol < 0 || dj < 4 || dj > 13 || Math.hypot(h.x - e.x, h.z - e.z) > 3) { arbol = D.elegirArbol(j, e, arboles, { rnd }); }
    }
    if (arbol >= 0) {
      const h = D.escondite(j, arboles[arbol], 0.5);
      const d = Math.hypot(h.x - e.x, h.z - e.z);
      const paso = Math.min(d, 2.2 * DT);
      if (d > 1e-6) { e.x += (h.x - e.x) / d * paso; e.z += (h.z - e.z) / d * paso; }
    }
    if (t > 30 * 3) { total += 1; if (D.tapado(j, e, arboles, 0.2)) { tapadoN += 1; } }
  }
  assert.ok(tapadoN / total > 0.8, 'quedó a la vista demasiado tiempo (' + (100 * tapadoN / total).toFixed(0) + '% tapado)');
  const h = D.escondite({ x: 0, z: 0 }, [0, -5], 0.5);
  assert.ok(Math.abs(h.x) < 1e-9 && Math.abs(h.z + 5.5) < 1e-9, 'el escondite no queda detrás del tronco');
});

test('Agente: dos caras blancas y el niño a la vez, cada uno a lo suyo, sin chocar entre ellos', () => {
  const m = { obstaculos: SALA, limites: LIM, jugador: { x: -6, z: 2.5 } };
  const ags = [
    new D.Agente({ x: 0.4, z: 4.35, rnd: D.semilla(1) }),
    new D.Agente({ x: 0.7, z: 4.5, rnd: D.semilla(2) }),
    new D.Agente({ x: 0.85, z: 4.7, radio: 0.16, velMax: 1.14, rnd: D.semilla(3) })
  ];
  ags[0].ponerRuta([[0.4, 1.8], [0.4, -3.2], [-4.75, -3.35]]);
  ags[1].ponerRuta([[0.4, 1.8], [0.4, -3.2], [-2.75, -3.35]]);
  let minSep = Infinity;
  for (let f = 0; f < 30 * 30 && !(ags[0].llego && ags[1].llego && ags[2].llego); f += 1) {
    const a = ags[0];
    ags[2].ponerRuta([[a.x + Math.cos(a.rumbo) * 0.45 + Math.sin(a.rumbo) * 0.35, a.z - Math.sin(a.rumbo) * 0.45 + Math.cos(a.rumbo) * 0.35]]);
    for (const ag of ags) {
      if (f > 0 && ag !== ags[2] && ag.llego) { continue; }
      m.otros = ags.filter((o) => o !== ag && o !== (ag === ags[2] ? ags[0] : null)).map((o) => ({ x: o.x, z: o.z, r: o.radio }));
      ag.paso(DT, m);
    }
    minSep = Math.min(minSep, Math.hypot(ags[0].x - ags[1].x, ags[0].z - ags[1].z));
  }
  assert.ok(ags[0].llego && ags[1].llego, 'las dos no llegaron a sus lavadoras');
  assert.ok(Math.hypot(ags[2].x - ags[0].x, ags[2].z - ags[0].z) < 0.8, 'el niño no quedó junto a su abrigo');
  assert.ok(minSep > 0.3, 'las dos se atravesaron (' + minSep.toFixed(2) + ' m)');
});

test('Barato: 20 caminantes, 30 s de juego a 30 cuadros, en la sala', () => {
  const m = { obstaculos: SALA, limites: LIM, jugador: { x: -6, z: 3 } };
  const ags = [];
  for (let i = 0; i < 20; i += 1) {
    const ag = new D.Agente({ x: 0.4, z: 4.35, rnd: D.semilla(i) });
    ag.ponerRuta([[0.4, 1.8], [0.4, -3.2], [-6.75 + (i % 6), -3.35]]);
    ags.push(ag);
  }
  const t0 = process.hrtime.bigint();
  for (let f = 0; f < 900; f += 1) {
    for (const ag of ags) { m.otros = ags.filter((o) => o !== ag).map((o) => ({ x: o.x, z: o.z, r: o.radio })); ag.paso(DT, m); }
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(ms < 400, 'caro: ' + ms.toFixed(0) + ' ms');
});
