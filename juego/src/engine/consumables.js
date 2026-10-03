/**
 * Consumibles del turno (ficción, +18). Cada uno calma, y cada uno cobra algo:
 *  - Cigarro (C, o deslizar hacia arriba desde la esquina): ~8 s en la mano izquierda. Baja el pavor poco a poco,
 *    pero el humo empaña los lentes. Se puede fumar con el trapeador en la otra mano.
 *  - Petaca (F, o deslizar en diagonal): desenroscar y beber (~2.6 s, mano derecha). Baja mucho el pavor, pero
 *    marea la vista y te hace parpadear más seguido. Y el horror ocurre en cada parpadeo.
 *  - Porro (J, o deslizar hacia la izquierda): ~10 s. Colores más intensos, el tiempo del turno se estira, tu
 *    música suena con reverberación y el pavor baja mucho… pero la paranoia trae más eventos y susurros fuera
 *    de hora.
 */
(function (MR) {
  'use strict';

  var U = MR.Util;

  class Consumables {
    constructor(game) {
      this.game = game;
      this.cigarettes = 5;
      this.sips = 4;
      this.joints = 3;
      this.smoke = 0;          // segundos restantes del cigarro
      this.joint = 0;          // segundos restantes del porro
      this.drink = 0;
      this.drinkTotal = 2.6;
      this.tipsy = 0;
      this.high = 0;
      this.used = { cigarros: 0, tragos: 0, porros: 0, cafes: 0 };
      this.awake = 0;     // café: parpadeas menos
      this.brewing = 0;   // segundos hasta que sale el café
      this.coffee = 0;    // segundos con el vaso en la mano
      this.inhaleMarks = [];
      this.exhale = -1;
    }

    busy() { return this.smoke > 0 || this.drink > 0 || this.joint > 0; }

    _light(kind) {
      var g = this.game;
      g.audio.lighter();
      MR.Haptics.pulse([8, 60, 14]);
      if (kind === 'porro') {
        this.joint = 10;
        this.inhaleMarks = [8.4, 5.6, 2.8];
        g.ui.subtitle('(Enciendes un porro. Huele a hierba y a ropa mojada.)', 3.5);
      } else {
        this.smoke = 8;
        this.inhaleMarks = [6.6, 4.0, 1.6];
      }
      g.ui.updateConsumables(this);
    }

    tryCigarette() {
      if (this.busy()) { return; }
      if (this.cigarettes <= 0) { this.game.ui.subtitle('(La cajetilla está vacía.)', 3); return; }
      this.cigarettes -= 1;
      this.used.cigarros += 1;
      this._light('cigarro');
    }

    tryJoint() {
      if (this.busy()) { return; }
      if (this.joints <= 0) { this.game.ui.subtitle('(Ya no te quedan porros.)', 3); return; }
      this.joints -= 1;
      this.used.porros += 1;
      this._light('porro');
    }

    /** Máquina de café: una moneda; en 2.5 s sale el vaso y te despierta (parpadeas menos un rato). */
    tryCoffee() {
      var g = this.game;
      if (this.brewing > 0) { return; }
      if (g.gameplay.coins < 1) { g.ui.subtitle('(Necesitas una moneda. El cambiador está junto a la entrada.)', 3); return; }
      g.gameplay.coins -= 1;
      this.brewing = 2.5;
      g.audio.coin();
      g.audio.buzz();
      MR.Haptics.pulse([25, 60, 10, 30, 10]);
      g.ui.subtitle('(La máquina zumba y escupe un vaso de cartón.)', 2.5);
    }

    tryFlask() {
      var g = this.game;
      if (this.busy()) { return; }
      if (g.gameplay.mopHeld) { g.ui.subtitle('(Necesitas la mano libre: suelta el trapeador.)', 3); return; }
      if (this.sips <= 0) { g.ui.subtitle('(La petaca está vacía.)', 3); return; }
      this.sips -= 1;
      this.used.tragos += 1;
      this.drink = this.drinkTotal;
      g.audio.unscrew();
      MR.Haptics.pulse([6, 40, 6, 40, 6, 40, 10]);
      g.ui.updateConsumables(this);
    }

    /** Segundos restantes de lo que se esté fumando (cigarro o porro). */
    smoking() { return Math.max(this.smoke, this.joint); }

    update(dt) {
      var g = this.game;
      var wasSmoking = this.smoking();
      if (wasSmoking > 0) {
        var isJoint = this.joint > 0;
        if (isJoint) { this.joint = Math.max(0, this.joint - dt); } else { this.smoke = Math.max(0, this.smoke - dt); }
        var left = this.smoking();
        g.dread = Math.max(0, g.dread - (isJoint ? 0.035 : 0.025) * dt);
        for (var i = 0; i < this.inhaleMarks.length; i += 1) {
          var m = this.inhaleMarks[i];
          if (wasSmoking > m && left <= m) {
            g.audio.inhale();
            this.exhale = 1.3;
            if (isJoint) { this.high = Math.min(1, this.high + 0.22); }
          }
        }
        if (left === 0) {
          g.ui.subtitle(isJoint ? '(Todo se vuelve más lento, más suave… y más cerca.)' : '(Apagas el cigarro contra el piso mojado.)', 3.5);
        }
      }
      if (this.exhale > 0) {
        this.exhale -= dt;
        if (this.exhale <= 0) {
          g.audio.exhale();
          g.glasses.burst(0.12, 3);
          g.player.puff(this.joint > 0);
        }
      }
      if (this.drink > 0) {
        var prev = this.drink;
        this.drink = Math.max(0, this.drink - dt);
        if (prev > 1.2 && this.drink <= 1.2) { g.audio.sip(); MR.Haptics.pulse([20, 30, 20]); }
        if (this.drink === 0) {
          g.dread = Math.max(0, g.dread - 0.2);
          this.tipsy = Math.min(1, this.tipsy + 0.4);
          g.ui.subtitle(this.tipsy > 0.7 ? '(Todo se mece un poco. Parpadeas más de la cuenta.)' : '(Un trago tibio. Te calma.)', 3);
        }
      }
      if (this.brewing > 0) {
        this.brewing = Math.max(0, this.brewing - dt);
        if (this.brewing === 0) {
          g.audio.sip();
          this.coffee = 2.2;
          this.awake = Math.min(1, this.awake + 0.6);
          this.used.cafes += 1;
          g.dread = Math.max(0, g.dread - 0.04);
          g.ui.subtitle('(Café de máquina. Sabe a cartón, pero te despierta.)', 3.5);
          if (this.used.cafes >= 3 && g.logros) { g.logros.unlock('cafe'); }
        }
      }
      this.coffee = Math.max(0, this.coffee - dt);
      this.awake = Math.max(0, this.awake - dt / 150);
      this.tipsy = Math.max(0, this.tipsy - dt / 90);
      this.high = Math.max(0, this.high - dt / 150);
    }

    /** Mareo: balanceo de cámara (rad). El porro añade una deriva lenta y suave. */
    sway(t) {
      var k = this.tipsy;
      var h = this.high;
      return {
        yaw: Math.sin(t * 0.7) * 0.035 * k + Math.sin(t * 0.23) * 0.02 * h,
        pitch: Math.sin(t * 1.13) * 0.018 * k + Math.sin(t * 0.31) * 0.012 * h,
        roll: Math.sin(t * 0.91) * 0.05 * k + Math.sin(t * 0.17) * 0.025 * h
      };
    }

    /** Factor del intervalo entre parpadeos automáticos (menor = parpadeas más). */
    blinkFactor() { return (1 - 0.55 * this.tipsy) * (1 + 0.8 * this.awake); }

    /** El porro estira el tiempo del turno (hasta un 18 % más lento). */
    timeScale() { return 1 - 0.18 * this.high; }

    /** Paranoia: el porro acelera al director del horror. */
    paranoia() { return 1 + 0.4 * this.high; }

    handsState() {
      var left = this.smoking();
      var total = this.joint > 0 ? 10 : 8;
      var phase = left > 0 ? total - left : 0;
      var nearInhale = this.inhaleMarks.some(function (m) { return left > m - 1.1 && left <= m + 0.2; });
      return {
        smoking: left > 0,
        joint: this.joint > 0,
        toMouth: left > 0 && (phase < 1.0 || nearInhale),
        ember: left > 0 ? (nearInhale ? 2.2 : 0.9 + U.rand(0, 0.2)) : 0,
        drinking: this.drink > 0,
        coffee: this.coffee > 0,
        coffeeLift: this.coffee > 0 ? Math.min(1, (2.2 - this.coffee) / 0.5) * Math.min(1, this.coffee / 0.4) : 0,
        drinkLift: this.drink > 0 ? Math.min(1, (this.drinkTotal - this.drink) / 0.6) : 0
      };
    }
  }

  MR.Consumables = Consumables;
})(window.MR = window.MR || {});
