/**
 * Verifica que los ports a JavaScript del núcleo coinciden EXACTAMENTE con el núcleo Python verificado.
 * Los vectores se generan con: py core/generar_vectores.py
 * Ejecutar: node --test juego/tests
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const V = JSON.parse(fs.readFileSync(path.join(__dirname, 'vectores.json'), 'utf8'));
const src = (name) => require(path.join(__dirname, '..', 'src', 'core', name));
const { Dispatcher } = src('dispatcher.js');
const { quantize } = src('bayer.js');
const { snap } = src('vertexSnap.js');
const { SteppedHold } = src('steppedHold.js');
const { DetentDial } = src('detentDial.js');
const { HoraLocal, anomalyMultiplier, whispersActive } = src('clockAnomaly.js');
const { ShiftLog, MemoryStorage, TEXTS } = src('shiftLog.js');

const isValueError = (e) => e && e.name === 'ValueError';

test('bayer: 4000 colores idénticos a Python y errores', () => {
  for (const c of V.bayer.cases) {
    assert.deepEqual(quantize(c.rgb, c.x, c.y), c.out, JSON.stringify(c));
  }
  for (const c of V.bayer.errors) {
    assert.throws(() => quantize(c.rgb, c.x, c.y), isValueError, JSON.stringify(c));
  }
});

test('vertex snap: 4000 vértices idénticos a Python y errores', () => {
  for (const c of V.snap.cases) {
    assert.deepEqual(snap(c.clip, c.vres), c.out, JSON.stringify(c));
  }
  for (const c of V.snap.errors) {
    assert.throws(() => snap(c.clip, c.vres), isValueError, JSON.stringify(c));
  }
});

test('stepped hold: 2400 muestras con la misma pose retenida que Python', () => {
  for (const seq of V.stepped.seqs) {
    const h = new SteppedHold(seq.hz);
    const poses = [];
    for (const s of seq.steps) {
      const pose = { i: s.pose };
      poses.push(pose);
      const got = h.sample(s.t, pose);
      assert.equal(got.i, s.got, `hz ${seq.hz} t ${s.t}`);
      assert.equal(got, poses[s.got], 'debe ser el MISMO objeto, sin copiar');
    }
  }
  assert.throws(() => new SteppedHold(0), isValueError);
  assert.throws(() => new SteppedHold(true), isValueError);
  const h = new SteppedHold(15);
  h.sample(1, {});
  assert.throws(() => h.sample(1 - 1e-12, {}), isValueError);
});

test('detent dial: 2500 arrastres con los mismos clicks y ángulos que Python', () => {
  for (const seq of V.dial.seqs) {
    const d = new DetentDial(...seq.params);
    seq.steps.forEach((s, i) => {
      const clicks = d.drag(s.delta).map((c) => c.angle);
      assert.deepEqual(clicks, s.clicks, `${seq.params} paso ${i} delta ${s.delta}`);
      assert.equal(d.angle, s.angle, `${seq.params} paso ${i}`);
    });
  }
  for (const p of V.dial.init_errors) {
    assert.throws(() => new DetentDial(...p), isValueError, JSON.stringify(p));
  }
});

test('clock anomaly: ventanas y fronteras idénticas a Python', () => {
  for (const c of V.clock.cases) {
    const t = new HoraLocal(c.h, c.m, c.s, c.us);
    assert.equal(anomalyMultiplier(t), c.mult, JSON.stringify(c));
    assert.equal(whispersActive(t), c.whispers, JSON.stringify(c));
  }
  for (const bad of ['03:00', null, 3, {}, new Date(NaN)]) {
    assert.throws(() => anomalyMultiplier(bad), TypeError);
    assert.throws(() => whispersActive(bad), TypeError);
  }
});

test('shift log: mismas transiciones y textos exactos que Python', () => {
  assert.deepEqual(TEXTS, V.shift_log.texts);
  for (const c of V.shift_log.cases) {
    const storage = new MemoryStorage();
    if (c.stored !== null) { storage.setItem('k', c.stored); }
    const log = new ShiftLog(storage, 'k');
    assert.equal(log.update(c.phase), c.returns, JSON.stringify(c));
    assert.equal(storage.getItem('k'), c.after, JSON.stringify(c));
  }
  const log = new ShiftLog(new MemoryStorage(), 'k');
  for (const bad of V.shift_log.invalid) {
    assert.throws(() => log.update(bad), isValueError, JSON.stringify(bad));
  }
});

test('dispatcher: 3000 operaciones con los mismos disparos que Python', () => {
  const d = new Dispatcher();
  V.dispatcher.ops.forEach((op, i) => {
    if (op.op === 'schedule') {
      if (op.error) {
        assert.throws(() => d.schedule(op.id, { n: op.n }, op.priority), isValueError, `op ${i}`);
      } else {
        d.schedule(op.id, { n: op.n }, op.priority);
      }
    } else if (op.op === 'tick') {
      const fired = d.tick(op.visibility, op.blink).map((e) => [e.event_id, e.payload.n]);
      assert.deepEqual(fired, op.fired, `op ${i}`);
    } else {
      assert.equal(d.pending(), op.result, `op ${i}`);
    }
  });
  for (const e of V.dispatcher.tick_errors) {
    assert.throws(() => d.tick(e.visibility, e.blink === undefined ? false : e.blink), isValueError, JSON.stringify(e));
  }
});
