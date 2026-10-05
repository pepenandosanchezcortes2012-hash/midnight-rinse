/**
 * El espejo del lavabo, en el pasillo de servicio (pared derecha, frente a los casilleros).
 * - Refleja de verdad: una cámara virtual, reflejada sobre el plano del espejo, dibuja el pasillo en una textura de
 *   192×144 que el espejo lee con proyección. Solo cuando estás en el pasillo y el espejo está a la vista.
 * - Tú no te reflejas (no hay cuerpo: las manos se esconden en esa pasada). La primera vez, un subtítulo lo nota.
 * - El susto («espejo», del director): al mirarte en el espejo, él está de pie detrás de ti… solo en el reflejo.
 * - El lavabo: echarte agua en la cara baja el miedo (en la noche sin agua, el grifo solo tose aire).
 */
(function (MR) {
  'use strict';

  var V3 = THREE.Vector3;
  var GHOST_TIME = 1.8;

  var MIRROR_VERT = [
    'uniform mat4 textureMatrix;',
    'varying vec4 vUv4;',
    'void main() {',
    '  vUv4 = textureMatrix * modelMatrix * vec4(position, 1.0);',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}'
  ].join('\n');

  var MIRROR_FRAG = [
    'uniform sampler2D tMirror;',
    'uniform float uOn;',
    'varying vec4 vUv4;',
    'void main() {',
    '  vec3 c = texture2DProj(tMirror, vUv4).rgb * vec3(0.86, 0.92, 0.88);', // vidrio viejo, un poco verdoso
    '  gl_FragColor = vec4(mix(vec3(0.02, 0.025, 0.03), c, uOn), 1.0);',
    '}'
  ].join('\n');

  class Espejo {
    constructor(game) {
      this.game = game;
      var m = game.world.mirror;
      this.mesh = m.mesh;
      this.hide = m.hide; // lo que no debe salir en el reflejo (el propio espejo y su marco)
      this.planeX = m.planeX;
      this.center = m.center;
      this.rt = new THREE.WebGLRenderTarget(192, 144, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
      this.textureMatrix = new THREE.Matrix4();
      this.mesh.material = new THREE.ShaderMaterial({
        uniforms: { tMirror: { value: this.rt.texture }, textureMatrix: { value: this.textureMatrix }, uOn: { value: 0 } },
        vertexShader: MIRROR_VERT,
        fragmentShader: MIRROR_FRAG
      });
      this.vcam = new THREE.PerspectiveCamera();
      this.frustum = new THREE.Frustum();
      this.pv = new THREE.Matrix4();
      this.sphere = new THREE.Sphere(this.center.clone(), 0.6);
      this.tmp = new V3();
      this.armed = false;
      this.ghost = 0;
      this.ghosts = 0;
      this.looking = 0;
      this.noticed = false;
      this.sinkCooldown = 0;
      this.renders = 0;
    }

    /** ¿Estás en el pasillo, cerca y con el espejo en pantalla? (si no, no hace falta dibujarlo). */
    _visible() {
      var g = this.game;
      if (!g.pasillo || !g.pasillo.inside) { return false; }
      var cam = g.player.camera;
      cam.updateMatrixWorld();
      this.pv.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      this.frustum.setFromProjectionMatrix(this.pv);
      return this.frustum.intersectsSphere(this.sphere) && cam.getWorldPosition(this.tmp).distanceTo(this.center) < 7;
    }

    /** ¿Te estás mirando en el espejo? (cerca, de frente y con los ojos abiertos). */
    _facing() {
      var g = this.game;
      var p = g.player.pos;
      var dx = this.center.x - p.x;
      var dz = this.center.z - p.z;
      var dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 2.4 || g.player.eyesClosed) { return false; }
      var f = g.player.forward(this.tmp);
      return (f.x * dx + f.z * dz) / Math.max(dist, 0.001) > 0.8;
    }

    update(dt) {
      var g = this.game;
      this.sinkCooldown = Math.max(0, this.sinkCooldown - dt);
      var on = this._visible();
      this.mesh.material.uniforms.uOn.value = on ? 1 : 0;
      this.on = on;
      var facing = on && this._facing();
      this.looking = facing ? this.looking + dt : 0;
      if (this.ghost > 0) {
        // Si dejas de mirar el espejo (o parpadeas), ya no está.
        this.ghost = facing ? Math.max(0, this.ghost - dt) : 0;
      }
      if (this.looking > 0.6 && this.armed && !(g.diff && g.diff.sinSustos)) {
        this.armed = false;
        this.ghost = GHOST_TIME;
        this.ghosts += 1;
        // Si esa noche vino alguna cara blanca, a veces es una de ellas la que está detrás (y no él).
        this.ghostKind = g.clientela && g.clientela.nextId > 1 && Math.random() < 0.4 ? 'cara' : 'el';
        g.audio.whisper(0);
        g.dread = Math.min(1, g.dread + 0.12);
        MR.Haptics.pulse([60, 40, 120]);
        if (g.logros) { g.logros.unlock('espejo'); }
        var kind = this.ghostKind;
        setTimeout(function () {
          if (g.state !== 'playing') { return; }
          g.ui.subtitle(kind === 'cara' ? '(En el espejo, detrás de ti, una cara blanca mira el espejo contigo. Te das vuelta: no hay nadie.)' :
            '(En el espejo, alguien está de pie detrás de ti. Te das vuelta: no hay nadie.)', 6);
        }, 1300);
      } else if (this.looking > 0.6 && !this.noticed) {
        this.noticed = true;
        g.ui.subtitle('(En el espejo se ve el pasillo detrás de ti. A ti no.)', 5);
        g.dread = Math.min(1, g.dread + 0.04);
      }
    }

    /** La pasada del reflejo (antes de dibujar el cuadro). Sin tus manos; con él detrás si toca. */
    render() {
      if (!this.on) { return; }
      var g = this.game;
      var cam = g.player.camera;
      var vcam = this.vcam;
      var px = this.planeX;
      // Cámara virtual: posición, punto de mira y «arriba» reflejados sobre el plano x = px.
      var pos = cam.getWorldPosition(new V3());
      var dir = cam.getWorldDirection(new V3());
      var up = new V3(0, 1, 0).applyQuaternion(cam.getWorldQuaternion(new THREE.Quaternion()));
      var target = pos.clone().add(dir);
      vcam.position.set(2 * px - pos.x, pos.y, pos.z);
      vcam.up.set(-up.x, up.y, up.z);
      vcam.lookAt(2 * px - target.x, target.y, target.z);
      vcam.projectionMatrix.copy(cam.projectionMatrix);
      vcam.projectionMatrixInverse.copy(cam.projectionMatrixInverse);
      vcam.updateMatrixWorld();
      this.textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
      this.textureMatrix.multiply(vcam.projectionMatrix).multiply(vcam.matrixWorldInverse);

      var hidden = this.hide.concat(cam.children).filter(function (o) { return o.visible; });
      hidden.forEach(function (o) { o.visible = false; });
      var c = g.world.customer;
      var saved = null;
      if (this.ghost > 0 && this.ghostKind === 'cara') {
        // Una cara blanca en el reflejo: un modelo propio que solo existe en esta pasada.
        if (!this.face) { this.face = g.clientela._model('cara'); this.face.group.visible = false; g.world.add(this.face.group); }
        var pf = g.player.pos;
        var ff = g.player.forward(new V3());
        this.face.group.position.set(pf.x - ff.x * 0.9, 0, pf.z - ff.z * 0.9);
        this.face.group.rotation.y = Math.atan2(-ff.x, -ff.z); // mira el espejo, igual que tú (la cara va en -z)
        this.face.group.visible = true;
      } else if (this.ghost > 0) {
        saved = { pos: c.group.position.clone(), rot: c.group.rotation.y, vis: c.group.visible, seated: c.seated.visible, standing: c.standing.visible };
        var p = g.player.pos;
        var f = g.player.forward(new V3());
        var x = p.x - f.x * 0.9;
        var z = p.z - f.z * 0.9;
        c.group.position.set(x, 0, z);
        c.group.rotation.y = Math.atan2(-(p.x - x), -(p.z - z));
        c.seated.visible = false;
        c.standing.visible = true;
        c.group.visible = true;
      }
      var r = g.retro.renderer;
      g.retro.applyLights();
      r.setRenderTarget(this.rt);
      r.render(g.world.scene, vcam);
      r.setRenderTarget(null);
      this.renders += 1;
      if (this.face) { this.face.group.visible = false; }
      if (saved) {
        c.group.position.copy(saved.pos);
        c.group.rotation.y = saved.rot;
        c.group.visible = saved.vis;
        c.seated.visible = saved.seated;
        c.standing.visible = saved.standing;
      }
      hidden.forEach(function (o) { o.visible = true; });
    }

    /** El lavabo: agua helada en la cara (baja el miedo); en la noche sin agua, nada. */
    sink() {
      var g = this.game;
      if (g.mod === 'sin_agua') { g.ui.subtitle('(El grifo tose aire. Hoy no hay agua.)', 3); g.audio.click(); return; }
      if (this.sinkCooldown > 0) { g.ui.subtitle('(Ya tienes la cara empapada.)', 2.5); return; }
      this.sinkCooldown = 40;
      g.ui.subtitle('(Te echas agua en la cara. Está helada. Por un momento te sientes despierto.)', 4);
      g.audio.drip();
      g.dread = Math.max(0, g.dread - 0.15);
      MR.Haptics.pulse([20, 30, 20]);
    }
  }

  MR.Espejo = Espejo;
})(window.MR = window.MR || {});
