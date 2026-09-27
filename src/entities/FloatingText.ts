/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type DamageType =
  | 'laser'       // Gatling Laser / Rapid single-target
  | 'plasma'      // Plasma Mortar / Heavy ballistic splash
  | 'frost'       // Frost Beam / Cryogenic slow ticks
  | 'tesla'       // Tesla Coil / High-voltage chain lightning
  | 'fire'        // Thermal Incinerator / Burning ticks
  | 'shield'      // Energy barrier absorption
  | 'critical'    // High-impact critical damage hit
  | 'emp'         // EMP superweapon stun burst
  | 'orbital'     // Orbital bombardment catastrophic hit
  | 'reward'      // Energy credits bounty yield
  | 'leak'        // Base core integrity damage
  | 'combo'       // Elemental reaction combo (Superconductor, Thermal Shock, Plasma Flare)
  | 'hazard'      // Mine or tripwire damage
  | 'info';       // Tactical system alerts (e.g. Ruptured, Upgraded)

export interface DamageStyleConfig {
  color: string;
  glowColor: string;
  prefix?: string;
  suffix?: string;
  fontSize: number;
  fontWeight: string;
  isBold?: boolean;
}

export const DAMAGE_TYPE_STYLES: Record<DamageType, DamageStyleConfig> = {
  laser: {
    color: '#22d3ee',
    glowColor: 'rgba(34, 211, 238, 0.8)',
    fontSize: 13,
    fontWeight: '700',
    prefix: '-',
  },
  plasma: {
    color: '#fbbf24',
    glowColor: 'rgba(251, 191, 36, 0.85)',
    fontSize: 14,
    fontWeight: '800',
    prefix: '-',
  },
  frost: {
    color: '#c084fc',
    glowColor: 'rgba(192, 132, 252, 0.8)',
    fontSize: 12,
    fontWeight: '700',
    prefix: '-',
    suffix: ' ❄',
  },
  tesla: {
    color: '#38bdf8',
    glowColor: 'rgba(56, 189, 248, 0.85)',
    fontSize: 14,
    fontWeight: '800',
    prefix: '⚡-',
  },
  fire: {
    color: '#f97316',
    glowColor: 'rgba(249, 115, 22, 0.85)',
    fontSize: 13,
    fontWeight: '700',
    prefix: '🔥-',
  },
  shield: {
    color: '#38bdf8',
    glowColor: 'rgba(56, 189, 248, 0.9)',
    fontSize: 13,
    fontWeight: '700',
    prefix: '🛡️-',
  },
  critical: {
    color: '#facc15',
    glowColor: 'rgba(250, 204, 21, 0.95)',
    fontSize: 16,
    fontWeight: '900',
    prefix: 'CRIT -',
  },
  emp: {
    color: '#67e8f9',
    glowColor: 'rgba(103, 232, 249, 0.9)',
    fontSize: 15,
    fontWeight: '800',
    prefix: '⚡ ',
  },
  orbital: {
    color: '#f43f5e',
    glowColor: 'rgba(244, 63, 94, 0.9)',
    fontSize: 18,
    fontWeight: '900',
    prefix: '💥 -',
  },
  reward: {
    color: '#fbbf24',
    glowColor: 'rgba(251, 191, 36, 0.75)',
    fontSize: 13,
    fontWeight: '800',
    prefix: '+',
    suffix: ' ⬢',
  },
  leak: {
    color: '#f43f5e',
    glowColor: 'rgba(244, 63, 94, 0.9)',
    fontSize: 16,
    fontWeight: '800',
    prefix: 'CORE -',
    suffix: ' HP',
  },
  combo: {
    color: '#e879f9',
    glowColor: 'rgba(232, 121, 249, 0.95)',
    fontSize: 15,
    fontWeight: '900',
    prefix: '✦ ',
  },
  hazard: {
    color: '#f97316',
    glowColor: 'rgba(249, 115, 22, 0.9)',
    fontSize: 13,
    fontWeight: '800',
    prefix: '💥-',
  },
  info: {
    color: '#34d399',
    glowColor: 'rgba(52, 211, 153, 0.75)',
    fontSize: 13,
    fontWeight: '700',
  },
};

export class FloatingText {
  public id: string;
  public x: number;
  public y: number;
  public text: string;
  public damageType: DamageType;
  public color: string;
  public glowColor: string;
  public fontSize: number;
  public fontWeight: string;

  public alpha: number = 1.0;
  public scale: number = 0.5;
  public lifespan: number; // total duration in seconds
  public age: number = 0;

  // Velocity vectors for dynamic upward drift and random horizontal spread
  public vx: number;
  public vy: number;

  public isTerminated: boolean = false;

  constructor(
    x: number,
    y: number,
    text: string,
    damageType: DamageType = 'laser',
    options: {
      customColor?: string;
      lifespan?: number;
      vx?: number;
      vy?: number;
      spread?: boolean;
    } = {}
  ) {
    this.id = Math.random().toString(36).substring(2, 9);
    this.damageType = damageType;

    // Apply slight random scatter to prevent overlapping text clusters
    const scatterX = options.spread !== false ? (Math.random() * 24 - 12) : 0;
    const scatterY = options.spread !== false ? (Math.random() * 8 - 4) : 0;
    this.x = x + scatterX;
    this.y = y + scatterY;

    const style = DAMAGE_TYPE_STYLES[damageType] || DAMAGE_TYPE_STYLES.laser;
    this.color = options.customColor || style.color;
    this.glowColor = style.glowColor;
    this.fontSize = style.fontSize;
    this.fontWeight = style.fontWeight;

    // Format text with prefix/suffix if not already present
    let formatted = text;
    if (style.prefix && !text.startsWith(style.prefix)) {
      formatted = `${style.prefix}${formatted}`;
    }
    if (style.suffix && !text.endsWith(style.suffix)) {
      formatted = `${formatted}${style.suffix}`;
    }
    this.text = formatted;

    this.lifespan = options.lifespan || (damageType === 'critical' || damageType === 'orbital' ? 1.1 : 0.85);

    // Initial velocity: pops upward, gently drifts sideways
    this.vx = options.vx ?? (Math.random() * 20 - 10);
    this.vy = options.vy ?? (damageType === 'critical' || damageType === 'orbital' ? -55 : -42);
  }

  /**
   * Updates text animation: scale pop on spawn, deceleration, and smooth fade-out.
   */
  public update(dt: number): void {
    if (this.isTerminated) return;

    this.age += dt;
    const progress = this.age / this.lifespan;

    if (progress >= 1.0) {
      this.isTerminated = true;
      this.alpha = 0;
      return;
    }

    // Kinematic translation with friction deceleration
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy *= 0.94; // upward drag deceleration
    this.vx *= 0.94;

    // Elastic pop-in animation: rapid scale burst to 1.25 in first 20%, then settles to 1.0
    if (progress < 0.2) {
      const popT = progress / 0.2;
      this.scale = 0.5 + 0.75 * Math.sin(popT * (Math.PI / 2));
    } else {
      this.scale = 1.0;
    }

    // Smooth ease-out fade in final 60% of lifespan
    if (progress > 0.4) {
      const fadeT = (progress - 0.4) / 0.6;
      this.alpha = Math.max(0, 1.0 - Math.pow(fadeT, 1.5));
    } else {
      this.alpha = 1.0;
    }
  }

  /**
   * Renders high-legibility floating text with dark stroke outline and chromatic glow.
   */
  public draw(ctx: CanvasRenderingContext2D): void {
    if (this.isTerminated || this.alpha <= 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.scale, this.scale);
    ctx.globalAlpha = Math.max(0, Math.min(1, this.alpha));

    ctx.font = `${this.fontWeight} ${this.fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 1. Dark high-contrast stroke backing for perfect visibility over bright projectiles
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(7, 13, 25, 0.95)';
    ctx.lineJoin = 'round';
    ctx.strokeText(this.text, 0, 0);

    // 2. Outer chromatic bloom glow
    ctx.shadowBlur = 8;
    ctx.shadowColor = this.glowColor;

    // 3. Foreground colored text fill
    ctx.fillStyle = this.color;
    ctx.fillText(this.text, 0, 0);

    // 4. White core highlight for high-impact critical hits
    if (this.damageType === 'critical' || this.damageType === 'orbital') {
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = this.alpha * 0.45;
      ctx.fillText(this.text, 0, -0.5);
    }

    ctx.restore();
  }
}

/**
 * High-performance FloatingText manager handling batch updates, spawning, and rendering.
 */
export class FloatingTextSystem {
  public entities: FloatingText[] = [];

  /**
   * Spawns a numeric damage text above an entity coordinate with specific damage type styling.
   */
  public spawnDamage(
    x: number,
    y: number,
    amount: number,
    type: DamageType,
    isCritical: boolean = false
  ): FloatingText {
    const finalType = isCritical ? 'critical' : type;
    const rounded = Math.round(amount);
    const textObj = new FloatingText(x, y, `${rounded}`, finalType);
    this.entities.push(textObj);
    return textObj;
  }

  /**
   * Spawns arbitrary notification or status text (e.g. '+25 ⬢', 'RUPTURED!', '⚡ EMP BURST').
   */
  public spawnText(
    x: number,
    y: number,
    text: string,
    type: DamageType = 'info',
    options?: { customColor?: string; lifespan?: number; spread?: boolean }
  ): FloatingText {
    const textObj = new FloatingText(x, y, text, type, options);
    this.entities.push(textObj);
    return textObj;
  }

  /**
   * Updates all active text objects and trims dead entities in-place.
   */
  public update(dt: number): void {
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const ft = this.entities[i];
      ft.update(dt);
      if (ft.isTerminated) {
        this.entities.splice(i, 1);
      }
    }
  }

  /**
   * Renders all active text objects.
   */
  public draw(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < this.entities.length; i++) {
      this.entities[i].draw(ctx);
    }
  }

  /**
   * Resets all entities.
   */
  public clear(): void {
    this.entities = [];
  }
}
