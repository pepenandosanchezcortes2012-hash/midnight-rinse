/**
 * Texturas procedurales de baja resolución (sin archivos externos), con filtro "nearest" estilo PS1.
 * Cada textura se dibuja en un canvas pequeño; las repeticiones se resuelven escalando las UV de la geometría.
 */
(function (MR) {
  'use strict';

  function canvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function toTexture(c) {
    var t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  function noise(ctx, w, h, amount, seed) {
    var img = ctx.getImageData(0, 0, w, h);
    var s = seed || 1;
    for (var i = 0; i < img.data.length; i += 4) {
      s = (s * 16807) % 2147483647;
      var n = ((s / 2147483647) - 0.5) * amount;
      img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
      img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
      img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
    }
    ctx.putImageData(img, 0, 0);
  }

  var cache = {};

  var makers = {
    floor: function () {
      var c = canvas(32, 32);
      var x = c.getContext('2d');
      for (var i = 0; i < 2; i += 1) {
        for (var j = 0; j < 2; j += 1) {
          x.fillStyle = (i + j) % 2 ? '#b9b4a2' : '#8f8a78';
          x.fillRect(i * 16, j * 16, 16, 16);
        }
      }
      x.strokeStyle = '#5c584c';
      x.strokeRect(0.5, 0.5, 31, 31);
      noise(x, 32, 32, 26, 7);
      return c;
    },
    wall: function () {
      var c = canvas(32, 32);
      var x = c.getContext('2d');
      x.fillStyle = '#6f8f86';
      x.fillRect(0, 0, 32, 32);
      x.fillStyle = '#5d7a72';
      x.fillRect(0, 22, 32, 10);
      x.fillStyle = '#d7d2bf';
      x.fillRect(0, 21, 32, 1);
      noise(x, 32, 32, 18, 11);
      return c;
    },
    ceiling: function () {
      var c = canvas(32, 32);
      var x = c.getContext('2d');
      x.fillStyle = '#c9c6ba';
      x.fillRect(0, 0, 32, 32);
      x.strokeStyle = '#8e8b80';
      x.strokeRect(0.5, 0.5, 31, 31);
      noise(x, 32, 32, 30, 13);
      return c;
    },
    washer: function () {
      var c = canvas(32, 32);
      var x = c.getContext('2d');
      x.fillStyle = '#dcdcd4';
      x.fillRect(0, 0, 32, 32);
      x.fillStyle = '#5b636b';
      x.fillRect(0, 0, 32, 6);
      x.fillStyle = '#2b3036';
      x.beginPath();
      x.arc(16, 19, 10, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = '#3f5a68';
      x.beginPath();
      x.arc(16, 19, 7, 0, Math.PI * 2);
      x.fill();
      noise(x, 32, 32, 14, 17);
      return c;
    },
    dryer: function () {
      var c = canvas(32, 32);
      var x = c.getContext('2d');
      x.fillStyle = '#cfc7b1';
      x.fillRect(0, 0, 32, 32);
      x.fillStyle = '#7b6f55';
      x.fillRect(4, 3, 24, 4);
      x.fillStyle = '#26221b';
      x.fillRect(6, 10, 20, 18);
      x.fillStyle = '#4d4434';
      x.fillRect(8, 12, 16, 14);
      noise(x, 32, 32, 14, 19);
      return c;
    },
    metal: function () {
      var c = canvas(16, 16);
      var x = c.getContext('2d');
      x.fillStyle = '#8a8f94';
      x.fillRect(0, 0, 16, 16);
      noise(x, 16, 16, 30, 23);
      return c;
    },
    wood: function () {
      var c = canvas(32, 16);
      var x = c.getContext('2d');
      x.fillStyle = '#6b4a2b';
      x.fillRect(0, 0, 32, 16);
      x.fillStyle = '#5a3d23';
      for (var i = 0; i < 16; i += 3) { x.fillRect(0, i, 32, 1); }
      noise(x, 32, 16, 20, 29);
      return c;
    },
    yellow: function () {
      var c = canvas(16, 16);
      var x = c.getContext('2d');
      x.fillStyle = '#d9b51e';
      x.fillRect(0, 0, 16, 16);
      x.fillStyle = '#b8960f';
      x.fillRect(0, 7, 16, 2);
      noise(x, 16, 16, 22, 31);
      return c;
    },
    coat: function () {
      var c = canvas(16, 16);
      var x = c.getContext('2d');
      x.fillStyle = '#121316';
      x.fillRect(0, 0, 16, 16);
      x.fillStyle = '#1d2026';
      for (var i = 0; i < 16; i += 4) { x.fillRect(i, 0, 1, 16); }
      noise(x, 16, 16, 18, 37);
      return c;
    },
    skin: function () {
      var c = canvas(8, 8);
      var x = c.getContext('2d');
      x.fillStyle = '#c99b7f';
      x.fillRect(0, 0, 8, 8);
      noise(x, 8, 8, 16, 41);
      return c;
    },
    paleSkin: function () {
      var c = canvas(16, 16);
      var x = c.getContext('2d');
      x.fillStyle = '#b7b3a6';
      x.fillRect(0, 0, 16, 16);
      x.fillStyle = '#1a1a1a';
      x.fillRect(4, 6, 2, 2);
      x.fillRect(10, 6, 2, 2);
      x.fillRect(6, 11, 4, 1);
      noise(x, 16, 16, 12, 43);
      return c;
    },
    water: function () {
      var c = canvas(16, 16);
      var x = c.getContext('2d');
      x.fillStyle = '#2f4d5c';
      x.fillRect(0, 0, 16, 16);
      x.fillStyle = '#7fa7b5';
      x.fillRect(3, 4, 4, 1);
      x.fillRect(9, 10, 3, 1);
      noise(x, 16, 16, 18, 47);
      return c;
    },
    darkWater: function () {
      var c = canvas(16, 16);
      var x = c.getContext('2d');
      x.fillStyle = '#07090a';
      x.fillRect(0, 0, 16, 16);
      x.fillStyle = '#1b2226';
      x.fillRect(5, 6, 5, 1);
      noise(x, 16, 16, 8, 53);
      return c;
    },
    glass: function () {
      var c = canvas(16, 32);
      var x = c.getContext('2d');
      var g = x.createLinearGradient(0, 0, 0, 32);
      g.addColorStop(0, '#0b1420');
      g.addColorStop(1, '#16222c');
      x.fillStyle = g;
      x.fillRect(0, 0, 16, 32);
      x.fillStyle = '#304556';
      for (var i = 0; i < 9; i += 1) { x.fillRect((i * 7) % 16, (i * 11) % 32, 1, 3); }
      return c;
    },
    sign: function () {
      var c = canvas(128, 32);
      var x = c.getContext('2d');
      x.fillStyle = '#1b1e22';
      x.fillRect(0, 0, 128, 32);
      x.fillStyle = '#e2c84b';
      x.font = 'bold 14px monospace';
      x.textAlign = 'center';
      x.fillText('LAVANDERIA', 64, 14);
      x.font = '10px monospace';
      x.fillStyle = '#b9b4a2';
      x.fillText('LA ESPUMA · 24 H', 64, 27);
      return c;
    },
    paper: function () {
      var c = canvas(16, 16);
      var x = c.getContext('2d');
      x.fillStyle = '#e8e1cc';
      x.fillRect(0, 0, 16, 16);
      x.fillStyle = '#6d6858';
      for (var i = 3; i < 14; i += 2) { x.fillRect(2, i, 11 - (i % 3), 1); }
      return c;
    },
    lint: function () {
      var c = canvas(16, 16);
      var x = c.getContext('2d');
      x.fillStyle = '#9b958a';
      x.fillRect(0, 0, 16, 16);
      noise(x, 16, 16, 60, 59);
      return c;
    },
    black: function () {
      var c = canvas(4, 4);
      var x = c.getContext('2d');
      x.fillStyle = '#0a0a0c';
      x.fillRect(0, 0, 4, 4);
      return c;
    },
    white: function () {
      var c = canvas(4, 4);
      var x = c.getContext('2d');
      x.fillStyle = '#ffffff';
      x.fillRect(0, 0, 4, 4);
      return c;
    },
    // --- Bosque ---------------------------------------------------------------------------------
    tierra: function () {
      var c = canvas(32, 32);
      var x = c.getContext('2d');
      x.fillStyle = '#3a3324';
      x.fillRect(0, 0, 32, 32);
      var s = 5;
      for (var i = 0; i < 70; i += 1) {
        s = (s * 16807) % 2147483647;
        var px = s % 32;
        s = (s * 16807) % 2147483647;
        var py = s % 32;
        x.fillStyle = i % 3 ? '#2f4a26' : '#4d4330'; // matas de pasto y hojas muertas
        x.fillRect(px, py, 1 + (i % 2), 2);
      }
      noise(x, 32, 32, 30, 61);
      return c;
    },
    sendero: function () {
      var c = canvas(32, 32);
      var x = c.getContext('2d');
      x.fillStyle = '#5b4d39';
      x.fillRect(0, 0, 32, 32);
      x.fillStyle = '#7a6a52';
      [[4, 6], [20, 3], [12, 18], [27, 22], [6, 27]].forEach(function (p) { x.fillRect(p[0], p[1], 3, 2); });
      x.fillStyle = '#3b3226';
      [[15, 9], [2, 15], [24, 13], [18, 28]].forEach(function (p) { x.fillRect(p[0], p[1], 4, 1); });
      noise(x, 32, 32, 26, 67);
      return c;
    },
    corteza: function () {
      var c = canvas(16, 32);
      var x = c.getContext('2d');
      x.fillStyle = '#3b2c20';
      x.fillRect(0, 0, 16, 32);
      x.fillStyle = '#261c14';
      for (var i = 0; i < 16; i += 3) { x.fillRect(i, 0, 1, 32); }
      noise(x, 16, 32, 34, 71);
      return c;
    },
    pino: function () {
      var c = canvas(32, 32);
      var x = c.getContext('2d');
      x.fillStyle = '#1d3322';
      x.fillRect(0, 0, 32, 32);
      x.fillStyle = '#142619';
      for (var r = 0; r < 32; r += 4) { x.fillRect(0, r, 32, 1); }
      x.fillStyle = '#2b4a2f';
      for (var k = 0; k < 32; k += 6) { x.fillRect(k, 0, 1, 32); }
      noise(x, 32, 32, 30, 73);
      return c;
    },
    ladrillo: function () {
      var c = canvas(32, 32);
      var x = c.getContext('2d');
      x.fillStyle = '#4a4440';
      x.fillRect(0, 0, 32, 32);
      x.fillStyle = '#7a4636';
      for (var row = 0; row < 4; row += 1) {
        for (var col = 0; col < 3; col += 1) {
          var off = row % 2 ? 5 : 0;
          x.fillRect((col * 11 + off) % 33, row * 8 + 1, 10, 6);
        }
      }
      noise(x, 32, 32, 24, 79);
      return c;
    },
    concreto: function () {
      var c = canvas(32, 32);
      var x = c.getContext('2d');
      x.fillStyle = '#5a5b58';
      x.fillRect(0, 0, 32, 32);
      x.fillStyle = '#4a4b48';
      x.fillRect(0, 15, 32, 1);
      x.fillRect(15, 0, 1, 32);
      x.fillStyle = '#3f4a52'; // mancha de humedad
      x.fillRect(4, 20, 9, 7);
      noise(x, 32, 32, 30, 89);
      return c;
    },
    casillero: function () {
      var c = canvas(16, 32);
      var x = c.getContext('2d');
      x.fillStyle = '#56645d';
      x.fillRect(0, 0, 16, 32);
      x.fillStyle = '#3a4540';
      for (var i = 0; i < 4; i += 1) { x.fillRect(4, 3 + i * 2, 8, 1); } // rejillas
      x.fillRect(0, 0, 1, 32);
      x.fillStyle = '#9a9a90';
      x.fillRect(12, 16, 2, 3); // manija
      noise(x, 16, 32, 22, 97);
      return c;
    },
    roca: function () {
      var c = canvas(16, 16);
      var x = c.getContext('2d');
      x.fillStyle = '#5c5d5a';
      x.fillRect(0, 0, 16, 16);
      x.fillStyle = '#3f4a3a';
      x.fillRect(0, 10, 16, 6); // musgo
      noise(x, 16, 16, 40, 83);
      return c;
    }
  };

  MR.Textures = {
    get: function (name) {
      if (!cache[name]) {
        if (!makers[name]) { throw new Error('textura desconocida: ' + name); }
        cache[name] = toTexture(makers[name]());
      }
      return cache[name];
    },
    /** Textura dinámica (reloj de pared, tickets impresos): devuelve {canvas, ctx, texture}. */
    dynamic: function (w, h) {
      var c = canvas(w, h);
      return { canvas: c, ctx: c.getContext('2d'), texture: toTexture(c) };
    }
  };
})(window.MR = window.MR || {});
