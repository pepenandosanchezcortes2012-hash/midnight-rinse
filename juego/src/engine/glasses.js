/**
 * Vaho de los lentes: mapa de humedad de dos pasadas.
 *  1) acumulación (humedad ambiente, vapor de secadoras, sobresaltos) - evaporación 0.035/s - borrado con la
 *     mano (un punto se limpia por completo en 1.8 s de contacto);
 *  2) desenfoque 3x3 hacia la textura que lee el postproceso (ver retro.js).
 */
(function (MR) {
  'use strict';

  var U = MR.Util;

  class Glasses {
    constructor() {
      var g = MR.Config.FOG_GRID;
      this.w = g[0];
      this.h = g[1];
      this.m = new Float32Array(this.w * this.h);
      this.blur = new Float32Array(this.w * this.h);
      this.data = new Uint8Array(this.w * this.h * 4);
      this.texture = new THREE.DataTexture(this.data, this.w, this.h, THREE.RGBAFormat);
      this.texture.magFilter = THREE.LinearFilter;
      this.texture.minFilter = THREE.LinearFilter;
      this.brushX = 0;
      this.brushY = 0;
      this.wiping = false;
    }

    /** Suma humedad en manchas aleatorias (vapor, sobresaltos). */
    burst(amount, blobs) {
      for (var b = 0; b < (blobs || 6); b += 1) {
        var cx = Math.random() * this.w;
        var cy = Math.random() * this.h;
        var r = U.rand(4, 9);
        this._splat(cx, cy, r, amount);
      }
    }

    _splat(cx, cy, r, amount) {
      for (var y = Math.max(0, Math.floor(cy - r)); y < Math.min(this.h, Math.ceil(cy + r)); y += 1) {
        for (var x = Math.max(0, Math.floor(cx - r)); x < Math.min(this.w, Math.ceil(cx + r)); x += 1) {
          var d = Math.hypot(x - cx, y - cy) / r;
          if (d < 1) {
            var i = y * this.w + x;
            this.m[i] = U.clamp(this.m[i] + amount * (1 - d), 0, 1);
          }
        }
      }
    }

    /** humidity: unidades por segundo repartidas en todo el lente; wipe: {active, dx, dy} en píxeles de ratón. */
    update(dt, humidity, wipe) {
      var C = MR.Config;
      var n = this.w * this.h;
      var add = humidity * dt;
      var evap = C.FOG_EVAPORATION * dt;
      for (var i = 0; i < n; i += 1) {
        var v = this.m[i] + add * (0.6 + 0.8 * ((i * 2654435761) % 997) / 997) - evap;
        this.m[i] = v < 0 ? 0 : (v > 1 ? 1 : v);
      }
      this.wiping = !!(wipe && wipe.active);
      if (this.wiping) {
        var rate = dt / C.FOG_WIPE_SECONDS;
        if (wipe.points && wipe.points.length) {
          // Táctil: se limpia exactamente donde frotan los dedos, como si limpiaras la pantalla del teléfono.
          for (var p = 0; p < wipe.points.length; p += 1) {
            this._wipeAt(wipe.points[p].u * this.w, wipe.points[p].v * this.h, 7, rate);
          }
          this.brushX = wipe.points[0].u * 2 - 1;
          this.brushY = wipe.points[0].v * 2 - 1;
        } else {
          this.brushX = U.clamp(this.brushX + wipe.dx * 0.06, -1, 1);
          this.brushY = U.clamp(this.brushY - wipe.dy * 0.06, -1, 1);
          this._wipeAt((this.brushX * 0.5 + 0.5) * this.w, (this.brushY * 0.5 + 0.5) * this.h, 9, rate);
        }
      } else {
        this.brushX *= 0.9;
        this.brushY *= 0.9;
      }
      // Segunda pasada: desenfoque 3x3.
      for (var yy = 0; yy < this.h; yy += 1) {
        for (var xx = 0; xx < this.w; xx += 1) {
          var sum = 0;
          var cnt = 0;
          for (var oy = -1; oy <= 1; oy += 1) {
            var py = yy + oy;
            if (py < 0 || py >= this.h) { continue; }
            for (var ox = -1; ox <= 1; ox += 1) {
              var px = xx + ox;
              if (px < 0 || px >= this.w) { continue; }
              sum += this.m[py * this.w + px];
              cnt += 1;
            }
          }
          var val = sum / cnt;
          this.blur[yy * this.w + xx] = val;
          var o = (yy * this.w + xx) * 4;
          this.data[o] = this.data[o + 1] = this.data[o + 2] = Math.round(val * 255);
          this.data[o + 3] = 255;
        }
      }
      this.texture.needsUpdate = true;
    }

    /** Borrado circular: un punto se limpia por completo tras FOG_WIPE_SECONDS de contacto. */
    _wipeAt(cx, cy, r, rate) {
      for (var y = Math.max(0, Math.floor(cy - r)); y < Math.min(this.h, Math.ceil(cy + r)); y += 1) {
        for (var x = Math.max(0, Math.floor(cx - r)); x < Math.min(this.w, Math.ceil(cx + r)); x += 1) {
          var d = Math.hypot(x - cx, y - cy) / r;
          if (d < 1) {
            var k = y * this.w + x;
            this.m[k] = Math.max(0, this.m[k] - rate * (d < 0.6 ? 1 : (1 - d) / 0.4));
          }
        }
      }
    }

    /** Promedio de empañamiento (0..1). */
    level() {
      var s = 0;
      for (var i = 0; i < this.blur.length; i += 1) { s += this.blur[i]; }
      return s / this.blur.length;
    }
  }

  MR.Glasses = Glasses;
})(window.MR = window.MR || {});
