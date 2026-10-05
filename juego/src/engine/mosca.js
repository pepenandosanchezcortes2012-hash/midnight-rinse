/**
 * El cerebro de mosca (Drosophila melanogaster), en miniatura, para los personajes con vida: Pelusa, las caras blancas,
 * el niño y la gente de la avenida. Él y las máscaras no lo llevan: él es una anomalía y las máscaras obedecen órdenes.
 *
 * No es el conectoma completo. FlyWire mapeó ~140 000 neuronas y ~50 millones de sinapsis, y correr eso por personaje en
 * un celular es imposible. Son ~55 neuronas que reproducen, conectados como en la mosca, los circuitos mejor estudiados:
 *  - Ojos compuestos → 8 sectores alrededor del cuerpo: cuánto llama la atención cada dirección (o cuánto la repele).
 *  - Complejo central: un anillo de 8 neuronas E-PG, un atractor de anillo (excitación entre vecinas e inhibición
 *    global). La «burbuja» de actividad marca hacia dónde atiende, y dura un momento aunque el estímulo se vaya.
 *  - Cuerpo fungiforme: 32 células de Kenyon con inhibición APL (solo 4 activas a la vez: código disperso) y 2 neuronas
 *    de salida, MBON-acercarse y MBON-evitar. La dopamina de recompensa (una caricia) deprime las sinapsis del contexto
 *    activo hacia «evitar»; la de castigo (una amenaza), las de «acercarse». Así aprende de quién acercarse.
 *  - Neuronas reloj (LNv): la presión de sueño según la hora.
 *  - Neuronas descendentes (DN): acercarse, huir, descansar, acicalarse y explorar. Se inhiben entre sí y gana una.
 * Son neuronas de tasa con fuga (tau 0,15 s), integradas a 10 Hz con arreglos tipados: casi no cuesta nada.
 */
(function (MR) {
  'use strict';

  var N_OJO = 8;
  var N_KC = 32;
  var KC_ACTIVAS = 4;
  var N_CTX = 16;
  var DT = 0.1;
  var K = DT / 0.15;
  var ACCIONES = ['acercarse', 'huir', 'descansar', 'acicalarse', 'explorar'];
  /** Contextos que el cuerpo fungiforme puede aprender (quién o qué está cerca). */
  var CTX = { jugador: 0, cara: 1, mascara: 2, el: 3, nino: 4, gato: 5, lavadora: 6, vidriera: 7 };

  function semilla(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }

  /** Ángulo a (-π, π]. */
  function envolver(a) {
    while (a > Math.PI) { a -= Math.PI * 2; }
    while (a <= -Math.PI) { a += Math.PI * 2; }
    return a;
  }

  // El anillo E-PG es igual en todas las moscas: coseno entre sectores (vecinas se excitan), menos inhibición global.
  var ANILLO = new Float32Array(N_OJO * N_OJO);
  var COS = new Float32Array(N_OJO);
  var SEN = new Float32Array(N_OJO);
  for (var i = 0; i < N_OJO; i += 1) {
    COS[i] = Math.cos(i * Math.PI * 2 / N_OJO);
    SEN[i] = Math.sin(i * Math.PI * 2 / N_OJO);
    for (var j = 0; j < N_OJO; j += 1) { ANILLO[i * N_OJO + j] = 0.55 * Math.cos((i - j) * Math.PI * 2 / N_OJO) - 0.25; }
  }

  class Mosca {
    /** id: fija el cableado del cuerpo fungiforme (cada individuo, el suyo). t: { curiosidad, miedo } de 0 a 1. */
    constructor(id, t) {
      var rnd = semilla(1987 + (id || 0) * 7919);
      this.t = { curiosidad: (t && t.curiosidad !== undefined) ? t.curiosidad : 0.5, miedo: (t && t.miedo !== undefined) ? t.miedo : 0.5 };
      this.ojo = new Float32Array(N_OJO);
      this.epg = new Float32Array(N_OJO);
      this.kc = new Float32Array(N_KC);
      this.kcIn = new Uint8Array(N_KC * 3); // cada célula de Kenyon recibe de 3 contextos, al azar
      for (var k = 0; k < N_KC * 3; k += 1) { this.kcIn[k] = Math.floor(rnd() * N_CTX); }
      this.wAcerca = new Float32Array(N_KC).fill(0.5);
      this.wEvita = new Float32Array(N_KC).fill(0.5);
      this.ctx = new Float32Array(N_CTX);
      this.dn = new Float32Array(ACCIONES.length);
      this.s = { amenaza: 0, atraccion: 0, tacto: 0, ruido: 0, sueno: 0 };
      this.premio = 0;
      this.castigo = 0;
      this.acc = 0;
      this.ganadora = 4;
      this.val = 0;
      this.tmpDrive = new Float32Array(N_KC);
    }

    // ------------------------------------------------------------------------------------------- entradas
    /** Empieza un cuadro de sensaciones nuevo (los ojos y los contextos se vuelven a llenar). */
    limpiar() {
      this.ojo.fill(0);
      this.ctx.fill(0);
    }

    /** Algo en la dirección rel (radianes respecto del frente; + a la izquierda), con fuerza (negativa = repele). */
    estimulo(rel, fuerza) {
      var x = envolver(rel) / (Math.PI * 2 / N_OJO);
      var i0 = Math.floor(x);
      var f = x - i0;
      var a = ((i0 % N_OJO) + N_OJO) % N_OJO;
      var b = (a + 1) % N_OJO;
      this.ojo[a] += fuerza * (1 - f);
      this.ojo[b] += fuerza * f;
    }

    /** Qué (o quién) está cerca ahora, de 0 a 1 (el contexto que el cuerpo fungiforme asocia con premio o castigo). */
    contexto(id, fuerza) { if (fuerza > this.ctx[id]) { this.ctx[id] = fuerza; } }

    /** Señales internas y de los demás sentidos: amenaza, atracción, tacto, ruido y sueño (0 a 1). */
    sentir(s) {
      var o = this.s;
      o.amenaza = s.amenaza || 0;
      o.atraccion = s.atraccion || 0;
      o.ruido = s.ruido || 0;
      o.sueno = s.sueno || 0;
      if (s.tacto) { o.tacto = Math.max(o.tacto, s.tacto); }
    }

    /** Dopamina: recompensa (una caricia, algo bueno) o castigo (un susto), sobre el contexto de ahora. */
    recompensa(x) { this.premio = Math.max(this.premio, x === undefined ? 1 : x); this.s.tacto = 1; }
    castigar(x) { this.castigo = Math.max(this.castigo, x === undefined ? 1 : x); }

    // ------------------------------------------------------------------------------------------- dinámica
    /** Avanza el tiempo (se integra en pasos fijos de 0,1 s). */
    pensar(dt) {
      this.acc += dt;
      var n = 0;
      while (this.acc >= DT && n < 5) { this.acc -= DT; this._tick(); n += 1; }
      if (n === 5) { this.acc = 0; }
    }

    _tick() {
      var e = this.epg;
      var o = this.ojo;
      var nuevo = this._nuevoAnillo || (this._nuevoAnillo = new Float32Array(N_OJO));
      for (var i = 0; i < N_OJO; i += 1) {
        var x = o[i] * 1.2;
        for (var j = 0; j < N_OJO; j += 1) { x += ANILLO[i * N_OJO + j] * e[j]; }
        nuevo[i] = e[i] + (clamp01(x) - e[i]) * K;
      }
      e.set(nuevo);
      // Cuerpo fungiforme: código disperso (APL deja solo las 4 células de Kenyon más activas) y salidas MBON.
      this._kenyon(this.ctx, this.kc);
      var ac = 0;
      var ev = 0;
      for (var k = 0; k < N_KC; k += 1) {
        if (!this.kc[k]) { continue; }
        ac += this.wAcerca[k];
        ev += this.wEvita[k];
        if (this.premio > 0) {
          this.wEvita[k] -= 0.25 * this.premio * this.wEvita[k];
          this.wAcerca[k] += 0.06 * this.premio * (1 - this.wAcerca[k]);
        }
        if (this.castigo > 0) {
          this.wAcerca[k] -= 0.3 * this.castigo * this.wAcerca[k];
          this.wEvita[k] += 0.06 * this.castigo * (1 - this.wEvita[k]);
        }
      }
      this.premio = 0;
      this.castigo = 0;
      this.val = (ac - ev) / KC_ACTIVAS;
      // Neuronas descendentes: cada una con su entrada, y todas se inhiben entre sí. Gana la más activa.
      var s = this.s;
      var t = this.t;
      var pos = Math.max(0, this.val);
      var neg = Math.max(0, -this.val);
      var entrada = [
        0.6 * s.atraccion + 1.2 * pos + 0.25 * t.curiosidad - 1.0 * s.amenaza - 0.6 * s.sueno,          // acercarse
        1.3 * s.amenaza * (0.5 + t.miedo) + 0.8 * neg + 0.3 * t.miedo * s.ruido,                       // huir
        1.0 * s.sueno - 0.6 * s.amenaza - 0.3 * s.ruido,                                                // descansar
        0.6 * s.tacto + 0.2 * (1 - s.ruido) * (1 - s.amenaza) - 0.3 * s.sueno,                          // acicalarse
        0.25 + 0.3 * t.curiosidad + 0.2 * s.ruido - 0.5 * s.sueno - 0.4 * s.amenaza                     // explorar
      ];
      var d = this.dn;
      var suma = 0;
      for (var a = 0; a < d.length; a += 1) { suma += d[a]; }
      var mejor = 0;
      for (var b = 0; b < d.length; b += 1) {
        d[b] += (clamp01(entrada[b] - 0.6 * (suma - d[b])) - d[b]) * K;
        if (d[b] > d[mejor]) { mejor = b; }
      }
      this.ganadora = mejor;
      s.tacto *= 0.7;
      // Olvido lento: las sinapsis vuelven poco a poco a 0,5.
      for (var w = 0; w < N_KC; w += 1) {
        this.wAcerca[w] += (0.5 - this.wAcerca[w]) * 0.0004;
        this.wEvita[w] += (0.5 - this.wEvita[w]) * 0.0004;
      }
    }

    /** Las células de Kenyon que se activan con estos contextos (inhibición APL: solo las KC_ACTIVAS más fuertes). */
    _kenyon(ctx, out) {
      var drive = this.tmpDrive;
      for (var k = 0; k < N_KC; k += 1) {
        drive[k] = ctx[this.kcIn[k * 3]] + ctx[this.kcIn[k * 3 + 1]] + ctx[this.kcIn[k * 3 + 2]];
      }
      out.fill(0);
      for (var n = 0; n < KC_ACTIVAS; n += 1) {
        var m = -1;
        for (var q = 0; q < N_KC; q += 1) { if (!out[q] && drive[q] > 0 && (m < 0 || drive[q] > drive[m])) { m = q; } }
        if (m < 0) { break; }
        out[m] = 1;
      }
    }

    // ------------------------------------------------------------------------------------------- salidas
    /** Hacia dónde atiende: el ángulo de la burbuja del anillo (relativo al frente) y qué tan fuerte es. */
    atencion() {
      var x = 0;
      var y = 0;
      var max = 0;
      for (var i = 0; i < N_OJO; i += 1) {
        x += this.epg[i] * COS[i];
        y += this.epg[i] * SEN[i];
        if (this.epg[i] > max) { max = this.epg[i]; }
      }
      return { angulo: Math.atan2(y, x), fuerza: max };
    }

    /** La acción que ganó en las neuronas descendentes. */
    accion() { return ACCIONES[this.ganadora]; }

    /** Qué tan activa está una neurona descendente (0 a 1). */
    impulso(nombre) { return this.dn[ACCIONES.indexOf(nombre)] || 0; }

    /** Lo aprendido sobre un contexto: + acercarse, − evitar (de −1 a 1). */
    valencia(id) {
      var ctx = this._ctxUno || (this._ctxUno = new Float32Array(N_CTX));
      var kc = this._kcUno || (this._kcUno = new Float32Array(N_KC));
      ctx.fill(0);
      ctx[id] = 1;
      this._kenyon(ctx, kc);
      var v = 0;
      for (var k = 0; k < N_KC; k += 1) { if (kc[k]) { v += this.wAcerca[k] - this.wEvita[k]; } }
      return v / KC_ACTIVAS;
    }

    /** La memoria (sinapsis del cuerpo fungiforme) para guardarla entre noches. */
    exportar() {
      return { a: Array.prototype.map.call(this.wAcerca, function (x) { return Math.round(x * 1000) / 1000; }),
        e: Array.prototype.map.call(this.wEvita, function (x) { return Math.round(x * 1000) / 1000; }) };
    }

    importar(m) {
      if (!m || !m.a || !m.e || m.a.length !== N_KC || m.e.length !== N_KC) { return false; }
      this.wAcerca.set(m.a);
      this.wEvita.set(m.e);
      return true;
    }
  }

  Mosca.CTX = CTX;
  Mosca.envolver = envolver;
  MR.Mosca = Mosca;
})(window.MR = window.MR || {});
