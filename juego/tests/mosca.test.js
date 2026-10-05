/**
 * Pruebas del cerebro de mosca (src/engine/mosca.js): el anillo de atención, el cuerpo fungiforme y las neuronas
 * descendentes. Puras: no cargan el juego.
 * Ejecutar: node --test juego/tests/mosca.test.js   (también las corre centinela.py)
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

global.window = {};
require(path.join(__dirname, '..', 'src', 'engine', 'mosca.js'));
const M = global.window.MR.Mosca;
const CTX = M.CTX;

/** Corre `seg` segundos, llamando a `f` antes de cada paso (10 Hz). */
function correr(m, seg, f) {
  for (let t = 0; t < seg - 1e-9; t += 0.1) {
    m.limpiar();
    if (f) { f(m); }
    m.pensar(0.1);
  }
}

test('el anillo E-PG apunta hacia el estímulo, en cualquier dirección', () => {
  for (let k = -3; k <= 4; k += 1) {
    const ang = k * Math.PI / 4;
    const m = new M(1);
    correr(m, 1, (x) => x.estimulo(ang, 1));
    const at = m.atencion();
    const err = Math.abs(M.envolver(at.angulo - ang));
    assert.ok(err < 0.2, `estímulo a ${ang.toFixed(2)}: atiende a ${at.angulo.toFixed(2)}`);
    assert.ok(at.fuerza > 0.8, `burbuja débil: ${at.fuerza.toFixed(2)}`);
  }
});

test('la atención dura un momento sin el estímulo (memoria corta) y después se apaga', () => {
  const m = new M(1);
  correr(m, 1, (x) => x.estimulo(Math.PI / 2, 1));
  correr(m, 0.3);
  const corto = m.atencion();
  assert.ok(corto.fuerza > 0.05 && corto.fuerza < 0.6, `a los 0,3 s: ${corto.fuerza.toFixed(2)}`);
  assert.ok(Math.abs(corto.angulo - Math.PI / 2) < 0.2, 'la memoria corta perdió la dirección');
  correr(m, 3);
  assert.ok(m.atencion().fuerza < 0.02, 'no se apagó');
});

test('dos estímulos compiten: gana el fuerte', () => {
  const m = new M(1);
  correr(m, 1, (x) => { x.estimulo(Math.PI / 2, 1); x.estimulo(-Math.PI / 2, 0.2); });
  assert.ok(Math.abs(m.atencion().angulo - Math.PI / 2) < 0.3);
});

test('un estímulo negativo repele la atención (las caras blancas, de ti)', () => {
  const m = new M(1);
  correr(m, 1, (x) => { x.estimulo(0, 0.6); x.estimulo(0, -0.9); });
  assert.ok(m.atencion().fuerza < 0.1, `debía quedar casi en nada: ${m.atencion().fuerza.toFixed(2)}`);
});

test('el cuerpo fungiforme aprende por contexto: caricias, cariño; sustos, miedo; sin mezclarlos', () => {
  const m = new M(1);
  assert.equal(m.valencia(CTX.jugador), 0);
  for (let i = 0; i < 3; i += 1) { m.limpiar(); m.contexto(CTX.jugador, 1); m.recompensa(1); m.pensar(0.1); }
  const cariño = m.valencia(CTX.jugador);
  assert.ok(cariño > 0.25, `cariño ${cariño.toFixed(2)}`);
  assert.ok(Math.abs(m.valencia(CTX.mascara)) < 0.1, 'las caricias le enseñaron algo sobre las máscaras');
  for (let i = 0; i < 2; i += 1) { m.limpiar(); m.contexto(CTX.mascara, 1); m.castigar(1); m.pensar(0.1); }
  assert.ok(m.valencia(CTX.mascara) < -0.2, `miedo ${m.valencia(CTX.mascara).toFixed(2)}`);
  assert.ok(Math.abs(m.valencia(CTX.jugador) - cariño) < 0.05, 'el susto de la máscara cambió lo que sentía por ti');
});

test('lo que no se refuerza se olvida despacio', () => {
  const m = new M(1);
  for (let i = 0; i < 3; i += 1) { m.limpiar(); m.contexto(CTX.jugador, 1); m.recompensa(1); m.pensar(0.1); }
  const antes = m.valencia(CTX.jugador);
  correr(m, 60);
  const minuto = m.valencia(CTX.jugador);
  correr(m, 600);
  const despues = m.valencia(CTX.jugador);
  assert.ok(minuto < antes && minuto > antes * 0.6, `en un minuto olvidó demasiado (${antes.toFixed(2)} → ${minuto.toFixed(2)})`);
  assert.ok(despues < minuto && despues > 0, `no olvida despacio (${minuto.toFixed(2)} → ${despues.toFixed(2)})`);
});

test('las neuronas descendentes eligen: amenaza → huir; sueño → descansar; nada → explorar; cariño a la vista → acercarse', () => {
  let m = new M(1, { curiosidad: 0.6, miedo: 0.75 });
  correr(m, 1, (x) => x.sentir({ amenaza: 1 }));
  assert.equal(m.accion(), 'huir');
  m = new M(1, { curiosidad: 0.6, miedo: 0.75 });
  correr(m, 2, (x) => x.sentir({ sueno: 1 }));
  assert.equal(m.accion(), 'descansar');
  m = new M(1, { curiosidad: 0.6, miedo: 0.75 });
  correr(m, 2, (x) => x.sentir({}));
  assert.equal(m.accion(), 'explorar');
  for (let i = 0; i < 3; i += 1) { m.limpiar(); m.contexto(CTX.jugador, 1); m.recompensa(1); m.pensar(0.1); }
  correr(m, 1.5, (x) => { x.contexto(CTX.jugador, 0.4); x.sentir({ sueno: 0.15 }); });
  assert.equal(m.accion(), 'acercarse');
});

test('la memoria se guarda y se carga (Pelusa te recuerda otra noche); lo malformado se rechaza', () => {
  const a = new M(1);
  for (let i = 0; i < 4; i += 1) { a.limpiar(); a.contexto(CTX.jugador, 1); a.recompensa(1); a.pensar(0.1); }
  const guardada = JSON.parse(JSON.stringify(a.exportar()));
  const b = new M(1);
  assert.equal(b.importar(guardada), true);
  assert.ok(Math.abs(b.valencia(CTX.jugador) - a.valencia(CTX.jugador)) < 0.01);
  assert.equal(new M(1).importar({ a: [1, 2], e: [3] }), false);
  assert.equal(new M(1).importar(null), false);
});

test('determinista: el mismo individuo responde igual a lo mismo', () => {
  const a = new M(7);
  const b = new M(7);
  const f = (x) => { x.estimulo(0.7, 0.8); x.contexto(CTX.gato, 0.5); x.sentir({ amenaza: 0.3, ruido: 0.2 }); };
  correr(a, 2, f);
  correr(b, 2, f);
  assert.equal(a.atencion().angulo, b.atencion().angulo);
  assert.equal(a.accion(), b.accion());
});

test('barato: diez cerebros, mil pasos, en poco tiempo', () => {
  const ms = [];
  for (let i = 0; i < 10; i += 1) { ms.push(new M(i)); }
  const t0 = process.hrtime.bigint();
  for (let s = 0; s < 1000; s += 1) {
    for (const x of ms) { x.limpiar(); x.estimulo(s * 0.01, 0.5); x.contexto(0, 0.5); x.pensar(0.1); }
  }
  const ms_ = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(ms_ < 200, `tardó ${ms_.toFixed(0)} ms`);
});
