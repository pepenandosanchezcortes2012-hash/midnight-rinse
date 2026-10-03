/**
 * Pipeline retro estilo PS1.
 * - La escena se dibuja en un objetivo de 320x240 con filtro "nearest" y se escala al lienzo 4:3.
 * - Materiales: vertex snapping con la fórmula de core/vertexSnap (x' = floor(ndc * vres + EPS) / vres * w),
 *   mapeo de texturas afín (sin corrección de perspectiva: se interpola uv*w y w, y se divide en el fragmento),
 *   iluminación por vértice (Gouraud) con hasta 6 luces puntuales y niebla a negro.
 * - Postproceso: vaho de lentes, viñeta y desaturación por pavor, parpadeo y, al final, dithering Bayer 8x8 a
 *   RGB555 con la fórmula de core/bayer (umbral = (M + 0.5) / 64; nivel = floor(c * 31 + umbral)).
 */
(function (MR) {
  'use strict';

  var MAX_LIGHTS = 6;

  var WORLD_VERT = [
    'uniform vec2 uSnapRes;',
    'uniform vec3 uAmbient;',
    'uniform vec3 uLightPos[' + MAX_LIGHTS + '];',
    'uniform vec3 uLightColor[' + MAX_LIGHTS + '];',
    'uniform float uLightRange[' + MAX_LIGHTS + '];',
    'uniform float uFogNear;',
    'uniform float uFogFar;',
    'varying vec3 vUvW;',
    'varying vec3 vLight;',
    'varying float vFog;',
    'void main() {',
    '  vec4 worldPos = modelMatrix * vec4(position, 1.0);',
    '  vec3 n = normalize(mat3(modelMatrix) * normal);',
    '  vec3 light = uAmbient;',
    '  for (int i = 0; i < ' + MAX_LIGHTS + '; i++) {',
    '    vec3 toLight = uLightPos[i] - worldPos.xyz;',
    '    float d = length(toLight);',
    '    float att = clamp(1.0 - d / uLightRange[i], 0.0, 1.0);',
    '    att *= att;',
    '    light += uLightColor[i] * att * (0.35 + 0.65 * max(dot(n, toLight / max(d, 0.0001)), 0.0));',
    '  }',
    '  vLight = light;',
    '  vec4 mv = viewMatrix * worldPos;',
    '  vec4 clip = projectionMatrix * mv;',
    '  if (clip.w > 0.0) {',
    '    vec2 ndc = clip.xy / clip.w;',
    '    clip.xy = floor(ndc * uSnapRes + 1e-9) / uSnapRes * clip.w;',
    '  }',
    '  vUvW = vec3(uv * clip.w, clip.w);',
    '  vFog = clamp((-mv.z - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);',
    '  gl_Position = clip;',
    '}'
  ].join('\n');

  var WORLD_FRAG = [
    'uniform sampler2D map;',
    'uniform vec3 uColor;',
    'uniform float uEmissive;',
    'uniform vec3 uFogColor;',
    'varying vec3 vUvW;',
    'varying vec3 vLight;',
    'varying float vFog;',
    'void main() {',
    '  vec2 uv = vUvW.xy / vUvW.z;',
    '  vec4 tex = texture2D(map, uv);',
    '  if (tex.a < 0.5) discard;',
    '  vec3 c = tex.rgb * uColor * (vLight + uEmissive);',
    '  gl_FragColor = vec4(mix(c, uFogColor, vFog), 1.0);',
    '}'
  ].join('\n');

  // Pantalla de la tele: "perfora" el lienzo (alfa 0) para que se vea el reproductor de YouTube que está DETRÁS
  // del canvas. Como es geometría de la escena, las paredes, las manos y el Cliente Inmóvil la tapan de verdad.
  // El color sale premultiplicado: apagada = vidrio oscuro opaco; estática = granos opacos; niebla de distancia.
  var SCREEN_FRAG = [
    'uniform float uOpen;',
    'uniform float uStatic;',
    'uniform float uTime;',
    'uniform vec3 uFogColor;',
    'varying vec3 vUvW;',
    'varying vec3 vLight;',
    'varying float vFog;',
    'float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }',
    'void main() {',
    '  vec2 uv = vUvW.xy / vUvW.z;',
    '  float n = rand(floor(uv * vec2(64.0, 48.0)) + vec2(floor(uTime * 24.0), 0.0));',
    '  float cover = 1.0 - uOpen;',
    '  float grain = step(1.0 - uStatic, n);',
    '  float a = max(cover, grain);',
    '  vec3 glass = vec3(0.03, 0.04, 0.04) + vLight * 0.04;',
    '  vec3 c = mix(glass * cover, vec3(0.75 * n), grain);',
    '  gl_FragColor = vec4(c * (1.0 - vFog) + uFogColor * vFog, a * (1.0 - vFog) + vFog);',
    '}'
  ].join('\n');

  var POST_VERT = [
    'varying vec2 vUv;',
    'void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }'
  ].join('\n');

  var POST_FRAG = [
    'uniform sampler2D tScene;',
    'uniform sampler2D tBayer;',
    'uniform sampler2D tFog;',
    'uniform vec2 uRes;',
    'uniform float uBlink;',
    'uniform float uDread;',
    'uniform float uTime;',
    'uniform float uFlash;',
    'uniform float uCollapse;',
    'uniform float uHigh;',
    'varying vec2 vUv;',
    'float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }',
    'void main() {',
    '  vec2 px = floor(vUv * uRes);',
    '  vec2 uv = (px + 0.5) / uRes;',
    '  float jitter = (rand(vec2(px.y, floor(uTime * 12.0))) - 0.5) * uDread * uDread * 3.0;',
    '  uv.x += jitter / uRes.x;',
    '  vec4 scene = texture2D(tScene, uv);',
    '  vec3 col = scene.rgb;',
    // A = cuánto tapa el lienzo lo que hay detrás (la tele). Fuera de la pantalla de la tele siempre es 1.
    '  float A = scene.a;',
    '  float m = texture2D(tFog, vUv).r;',
    '  if (m > 0.01) {',
    '    vec2 o = vec2(2.0) / uRes;',
    '    vec3 blur = (texture2D(tScene, uv + vec2(o.x, 0.0)).rgb + texture2D(tScene, uv - vec2(o.x, 0.0)).rgb',
    '               + texture2D(tScene, uv + vec2(0.0, o.y)).rgb + texture2D(tScene, uv - vec2(0.0, o.y)).rgb',
    '               + texture2D(tScene, uv + o).rgb + texture2D(tScene, uv - o).rgb + col * 2.0) / 8.0;',
    '    vec3 fogged = blur * 0.8 + vec3(0.16, 0.17, 0.18);',
    '    float k = smoothstep(0.03, 0.85, m);',
    '    float drop = step(0.985, rand(floor(px / 2.0))) * k;',
    '    col = mix(col, fogged, k * 0.92) + drop * 0.06;',
    '    A = 1.0 - (1.0 - A) * (1.0 - k * 0.92);',
    '  }',
    '  if (uHigh > 0.001) {',
    '    vec2 off = vec2(uHigh * 1.3 / uRes.x, 0.0);',
    '    col.r = mix(col.r, texture2D(tScene, uv + off).r, uHigh * 0.8);',
    '    col.b = mix(col.b, texture2D(tScene, uv - off).b, uHigh * 0.8);',
    '    float lum = dot(col, vec3(0.299, 0.587, 0.114));',
    '    col = mix(vec3(lum), col, 1.0 + uHigh * 0.75);',
    '    col += uHigh * 0.045 * vec3(sin(uTime * 0.5), sin(uTime * 0.5 + 2.1), sin(uTime * 0.5 + 4.2));',
    '  }',
    '  float gray = dot(col, vec3(0.299, 0.587, 0.114));',
    '  col = mix(col, vec3(gray), clamp(uDread * 0.5 + uCollapse * 0.3, 0.0, 1.0));',
    '  float vig = smoothstep(0.9, 0.2, length(vUv - 0.5) * 1.35);',
    '  float vf = mix(1.0, vig, 0.45 + uDread * 0.4);',
    '  col *= vf;',
    '  A = 1.0 - (1.0 - A) * vf;',
    '  col += vec3(uFlash);',
    '  col *= 1.0 - uBlink;',
    '  A = 1.0 - (1.0 - A) * (1.0 - uBlink);',
    '  float x = px.x;',
    '  float y = uRes.y - 1.0 - px.y;',
    '  vec2 bc = (vec2(mod(x, 8.0), mod(y, 8.0)) + 0.5) / 8.0;',
    '  float M = floor(texture2D(tBayer, bc).r * 255.0 / 4.0 + 0.5);',
    '  float thr = (M + 0.5) / 64.0;',
    '  col = clamp(col, 0.0, 1.0);',
    '  vec3 lvl = clamp(floor(col * 31.0 + thr), 0.0, 31.0);',
    '  gl_FragColor = vec4(lvl / 31.0, clamp(A, 0.0, 1.0));',
    '}'
  ].join('\n');

  function bayerTexture() {
    var data = new Uint8Array(8 * 8 * 4);
    for (var r = 0; r < 8; r += 1) {
      for (var c = 0; c < 8; c += 1) {
        var i = (r * 8 + c) * 4;
        var v = MR.BAYER8[r][c] * 4;
        data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
      }
    }
    var t = new THREE.DataTexture(data, 8, 8, THREE.RGBAFormat);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.needsUpdate = true;
    return t;
  }

  class Retro {
    constructor(canvas) {
      var C = MR.Config;
      // alpha: el lienzo puede tener huecos (la pantalla de la tele) por los que se ve la capa de video de detrás.
      this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
      this.renderer.setPixelRatio(1);
      this.renderer.setClearColor(0x000000, 1);
      this.target = new THREE.WebGLRenderTarget(C.RENDER_W, C.RENDER_H, {
        minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat
      });

      var pos = [];
      var col = [];
      var range = [];
      this.lightBase = [];
      this.lightFactor = [];
      for (var i = 0; i < MAX_LIGHTS; i += 1) {
        pos.push(new THREE.Vector3(0, -100, 0));
        col.push(new THREE.Vector3(0, 0, 0));
        range.push(1);
        this.lightBase.push(new THREE.Vector3(0, 0, 0));
        this.lightFactor.push(1);
      }
      this.shared = {
        uSnapRes: { value: new THREE.Vector2(C.SNAP_RES[0], C.SNAP_RES[1]) },
        uAmbient: { value: new THREE.Vector3(0.1, 0.1, 0.12) },
        uLightPos: { value: pos },
        uLightColor: { value: col },
        uLightRange: { value: range },
        uFogNear: { value: 5.0 },
        uFogFar: { value: 17.0 },
        uFogColor: { value: new THREE.Vector3(0.015, 0.015, 0.02) }
      };

      this.post = new THREE.ShaderMaterial({
        uniforms: {
          tScene: { value: this.target.texture },
          tBayer: { value: bayerTexture() },
          tFog: { value: null },
          uRes: { value: new THREE.Vector2(C.RENDER_W, C.RENDER_H) },
          uBlink: { value: 0 },
          uDread: { value: 0 },
          uTime: { value: 0 },
          uFlash: { value: 0 },
          uCollapse: { value: 0 },
          uHigh: { value: 0 }
        },
        vertexShader: POST_VERT,
        fragmentShader: POST_FRAG,
        depthTest: false,
        depthWrite: false
      });
      this.postScene = new THREE.Scene();
      this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      this.postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.post));
      this.resize();
      window.addEventListener('resize', this.resize.bind(this));
    }

    /** Material retro. opts: {map, texture (nombre), color, emissive, side}. */
    material(opts) {
      opts = opts || {};
      var map = opts.map || MR.Textures.get(opts.texture || 'white');
      var uniforms = {
        map: { value: map },
        uColor: { value: new THREE.Color(opts.color === undefined ? 0xffffff : opts.color) },
        uEmissive: { value: opts.emissive || 0 }
      };
      Object.keys(this.shared).forEach(function (k) { uniforms[k] = this.shared[k]; }, this);
      return new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: WORLD_VERT,
        fragmentShader: WORLD_FRAG,
        side: opts.side || THREE.FrontSide
      });
    }

    /** Material de la pantalla de la tele (ver SCREEN_FRAG). uOpen 1 = se ve el video; uStatic 0..1 = estática. */
    screenMaterial() {
      var uniforms = { uOpen: { value: 0 }, uStatic: { value: 0 }, uTime: { value: 0 } };
      Object.keys(this.shared).forEach(function (k) { uniforms[k] = this.shared[k]; }, this);
      return new THREE.ShaderMaterial({ uniforms: uniforms, vertexShader: WORLD_VERT, fragmentShader: SCREEN_FRAG });
    }

    setLight(i, position, color, intensity, range) {
      this.shared.uLightPos.value[i].copy(position);
      this.lightBase[i].set(color.r * intensity, color.g * intensity, color.b * intensity);
      this.shared.uLightRange.value[i] = range;
    }

    /** factor 0..1 por luz (parpadeos, apagones). */
    setLightFactor(i, factor) { this.lightFactor[i] = factor; }

    setFogTexture(texture) { this.post.uniforms.tFog.value = texture; }

    resize() {
      var w = window.innerWidth;
      var h = window.innerHeight;
      if (w / h > 4 / 3) { w = Math.floor(h * 4 / 3); } else { h = Math.floor(w * 3 / 4); }
      this.renderer.setSize(w, h);
    }

    render(scene, camera, fx) {
      for (var i = 0; i < MAX_LIGHTS; i += 1) {
        this.shared.uLightColor.value[i].copy(this.lightBase[i]).multiplyScalar(this.lightFactor[i]);
      }
      var u = this.post.uniforms;
      u.uBlink.value = fx.blink;
      u.uDread.value = fx.dread;
      u.uTime.value = fx.time;
      u.uFlash.value = fx.flash;
      u.uCollapse.value = fx.collapse;
      u.uHigh.value = fx.high || 0;
      this.renderer.setRenderTarget(this.target);
      this.renderer.render(scene, camera);
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.postScene, this.postCamera);
    }
  }

  Retro.MAX_LIGHTS = MAX_LIGHTS;
  MR.Retro = Retro;
})(window.MR = window.MR || {});
