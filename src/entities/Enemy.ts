/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type EnemyType =
  | 'scout'
  | 'goliath'
  | 'swarmer'
  | 'mini-swarmer'
  | 'infiltrator'
  | 'shielded'
  | 'boss';

export interface Point {
  x: number;
  y: number;
}

export interface StatusEffect {
  type: 'slow' | 'burn' | 'stun';
  duration: number; // in seconds
  factor?: number; // e.g. 0.5 for 50% speed
  damagePerSec?: number;
}

export class Enemy {
  public id: string;
  public type: EnemyType;
  public x: number;
  public y: number;
  public radius: number;
  public baseSpeed: number;
  public maxHealth: number;
  public currentHealth: number;
  public maxShield: number = 0;
  public currentShield: number = 0;
  public shieldRegenTimer: number = 0;
  public armor: number; // Percentage armor damage reduction (0 to 1)
  public reward: number;
  public scoreValue: number;
  public color: string;
  public glowColor: string;

  // Path navigation
  public path: Point[];
  public currentWaypointIndex: number = 0;
  public distanceTraveled: number = 0;
  public totalPathLength: number = 0;
  public reachedEnd: boolean = false;
  public angle: number = 0; // facing direction

  // Status effects
  public slowEffect: { duration: number; factor: number } | null = null;
  public burnEffect: { duration: number; damagePerSec: number } | null = null;
  public stunEffect: { duration: number } | null = null;
  public brittleTimer: number = 0; // Thermal shock: 50% armor reduction

  // Special mechanics & Boss Affixes
  public bossAffix?: 'frenzy' | 'vampiric' | 'emp_shielded';
  public isCloaked: boolean = false;
  public cloakTimer: number = 0;
  public canRupture: boolean = false;
  public isDead: boolean = false;

  constructor(
    type: EnemyType,
    path: Point[],
    waveMultiplier: number = 1.0,
    startWaypointIndex: number = 0,
    spawnOffset: Point = { x: 0, y: 0 },
    bossAffix?: 'frenzy' | 'vampiric' | 'emp_shielded'
  ) {
    this.id = Math.random().toString(36).substring(2, 9);
    this.type = type;
    this.path = path;
    this.currentWaypointIndex = startWaypointIndex;
    this.bossAffix = bossAffix;

    const startPos = path[startWaypointIndex] || path[0];
    this.x = startPos.x + spawnOffset.x;
    this.y = startPos.y + spawnOffset.y;

    this.calculatePathLength();

    switch (type) {
      case 'scout':
        this.radius = 12;
        this.baseSpeed = 135;
        this.maxHealth = Math.round(45 * waveMultiplier);
        this.armor = 0;
        this.reward = 12;
        this.scoreValue = 60;
        this.color = '#38bdf8';
        this.glowColor = 'rgba(56, 189, 248, 0.6)';
        break;

      case 'goliath':
        this.radius = 22;
        this.baseSpeed = 38;
        this.maxHealth = Math.round(380 * waveMultiplier);
        this.armor = 0.35; // 35% damage mitigation
        this.reward = 35;
        this.scoreValue = 220;
        this.color = '#f43f5e';
        this.glowColor = 'rgba(244, 63, 94, 0.7)';
        break;

      case 'swarmer':
        this.radius = 15;
        this.baseSpeed = 85;
        this.maxHealth = Math.round(110 * waveMultiplier);
        this.armor = 0.05;
        this.reward = 18;
        this.scoreValue = 90;
        this.color = '#eab308';
        this.glowColor = 'rgba(234, 179, 8, 0.6)';
        this.canRupture = true;
        break;

      case 'mini-swarmer':
        this.radius = 8;
        this.baseSpeed = 125;
        this.maxHealth = Math.round(30 * waveMultiplier);
        this.armor = 0;
        this.reward = 5;
        this.scoreValue = 30;
        this.color = '#fde047';
        this.glowColor = 'rgba(253, 224, 71, 0.8)';
        this.canRupture = false;
        break;

      case 'infiltrator':
        this.radius = 13;
        this.baseSpeed = 105;
        this.maxHealth = Math.round(95 * waveMultiplier);
        this.armor = 0.1;
        this.reward = 24;
        this.scoreValue = 130;
        this.color = '#10b981';
        this.glowColor = 'rgba(16, 185, 129, 0.7)';
        this.cloakTimer = 2.0;
        break;

      case 'shielded':
        this.radius = 18;
        this.baseSpeed = 58;
        this.maxHealth = Math.round(160 * waveMultiplier);
        this.maxShield = Math.round(180 * waveMultiplier);
        this.currentShield = this.maxShield;
        this.armor = 0.15;
        this.reward = 32;
        this.scoreValue = 180;
        this.color = '#06b6d4';
        this.glowColor = 'rgba(6, 182, 212, 0.8)';
        break;

      case 'boss':
        this.radius = 28;
        this.baseSpeed = 32;
        this.maxHealth = Math.round(1200 * waveMultiplier);
        this.maxShield = Math.round(500 * waveMultiplier);
        this.currentShield = this.maxShield;
        this.armor = 0.45;
        this.reward = 150;
        this.scoreValue = 1000;
        this.color = '#a855f7';
        this.glowColor = 'rgba(168, 85, 247, 0.85)';
        break;
    }

    this.currentHealth = this.maxHealth;
  }

  private calculatePathLength(): void {
    let len = 0;
    for (let i = 0; i < this.path.length - 1; i++) {
      const p1 = this.path[i];
      const p2 = this.path[i + 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      len += Math.sqrt(dx * dx + dy * dy);
    }
    this.totalPathLength = len;
  }

  public applySlow(factor: number, duration: number): void {
    if (!this.slowEffect || this.slowEffect.factor > factor || this.slowEffect.duration < duration) {
      this.slowEffect = { factor, duration };
    }
  }

  public applyBurn(damagePerSec: number, duration: number): void {
    if (!this.burnEffect || this.burnEffect.duration < duration) {
      this.burnEffect = { damagePerSec, duration };
    }
  }

  public applyStun(duration: number): void {
    if (this.bossAffix === 'emp_shielded') return; // Immune to stuns
    if (!this.stunEffect || this.stunEffect.duration < duration) {
      this.stunEffect = { duration };
    }
  }

  public applyBrittle(duration: number): void {
    this.brittleTimer = Math.max(this.brittleTimer, duration);
  }

  /**
   * Computes effective damage taking shields, brittle fracture, and armor piercing into account.
   */
  public takeDamage(
    rawDamage: number,
    armorPierce: number = 0
  ): { actualDamage: number; isFatal: boolean; hitShield: boolean } {
    let hitShield = false;
    let effectiveDamage = rawDamage;

    // Cloaked targets take 30% reduced damage due to optical dispersion
    if (this.isCloaked) {
      effectiveDamage *= 0.7;
    }

    // 1. Absorb with Shield first if available
    if (this.currentShield > 0) {
      hitShield = true;
      this.shieldRegenTimer = 3.5; // Reset regen delay
      if (this.currentShield >= effectiveDamage) {
        this.currentShield -= effectiveDamage;
        return { actualDamage: Math.round(effectiveDamage), isFatal: false, hitShield: true };
      } else {
        effectiveDamage -= this.currentShield;
        this.currentShield = 0;
      }
    }

    // 2. Mitigate remainder with armor (accounting for Brittle thermal shock & Tech tree armor piercing)
    const baseArmor = this.brittleTimer > 0 ? this.armor * 0.5 : this.armor;
    const effectiveArmor = Math.max(0, Math.min(0.9, baseArmor * (1 - armorPierce)));
    const mitigated = Math.max(1, effectiveDamage * (1 - effectiveArmor));
    const actualDamage = Math.min(this.currentHealth, Math.round(mitigated * 10) / 10);
    this.currentHealth -= actualDamage;

    if (this.currentHealth <= 0) {
      this.currentHealth = 0;
      this.isDead = true;
      return { actualDamage, isFatal: true, hitShield };
    }
    return { actualDamage, isFatal: false, hitShield };
  }

  /**
   * Update enemy position, status effects, and special abilities
   */
  public update(dt: number, onBurnTick?: (dmg: number) => void): void {
    if (this.isDead || this.reachedEnd) return;

    // Stun status effect (EMP): freezes all movements and actions
    if (this.stunEffect) {
      this.stunEffect.duration -= dt;
      if (this.stunEffect.duration <= 0) {
        this.stunEffect = null;
      }
      return;
    }

    // Infiltrator cloaking cycle
    if (this.type === 'infiltrator') {
      this.cloakTimer -= dt;
      if (this.cloakTimer <= 0) {
        this.isCloaked = !this.isCloaked;
        this.cloakTimer = this.isCloaked ? 3.0 : 4.0;
      }
    }

    // Brittle status timer countdown
    if (this.brittleTimer > 0) {
      this.brittleTimer -= dt;
    }

    // Boss Vampiric affix: heals 8 HP per second
    if (this.bossAffix === 'vampiric' && this.currentHealth < this.maxHealth) {
      this.currentHealth = Math.min(this.maxHealth, this.currentHealth + 8 * dt);
    }

    // Shield regeneration
    if (this.maxShield > 0 && this.currentShield < this.maxShield) {
      if (this.shieldRegenTimer > 0) {
        this.shieldRegenTimer -= dt;
      } else {
        this.currentShield = Math.min(this.maxShield, this.currentShield + (this.maxShield * 0.25) * dt);
      }
    }

    // Burn status effect
    if (this.burnEffect) {
      const tickDmg = this.burnEffect.damagePerSec * dt;
      this.currentHealth -= tickDmg;
      if (onBurnTick) onBurnTick(tickDmg);
      this.burnEffect.duration -= dt;
      if (this.burnEffect.duration <= 0) {
        this.burnEffect = null;
      }
      if (this.currentHealth <= 0) {
        this.currentHealth = 0;
        this.isDead = true;
        return;
      }
    }

    // Slow status effect & Affix speed calculations
    let currentSpeed = this.baseSpeed;
    if (this.bossAffix === 'frenzy') {
      currentSpeed *= 1.4; // 40% speed frenzy
    }
    if (this.isCloaked) {
      currentSpeed *= 1.25; // Cloak stealth burst speed
    }
    if (this.slowEffect) {
      currentSpeed *= this.slowEffect.factor;
      this.slowEffect.duration -= dt;
      if (this.slowEffect.duration <= 0) {
        this.slowEffect = null;
      }
    }

    // Linear path navigation
    const targetNode = this.path[this.currentWaypointIndex + 1];
    if (!targetNode) {
      this.reachedEnd = true;
      return;
    }

    const dx = targetNode.x - this.x;
    const dy = targetNode.y - this.y;
    const distToNode = Math.sqrt(dx * dx + dy * dy);

    this.angle = Math.atan2(dy, dx);
    const step = currentSpeed * dt;

    if (distToNode <= step) {
      this.x = targetNode.x;
      this.y = targetNode.y;
      this.distanceTraveled += distToNode;
      this.currentWaypointIndex++;

      if (this.currentWaypointIndex >= this.path.length - 1) {
        this.reachedEnd = true;
      }
    } else {
      const nx = dx / distToNode;
      const ny = dy / distToNode;
      this.x += nx * step;
      this.y += ny * step;
      this.distanceTraveled += step;
    }
  }

  /**
   * Render enemy unit with hull, shield bubbles, health bars, and status effects
   */
  public draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.x, this.y);

    // Alpha shimmer when cloaked
    if (this.isCloaked) {
      ctx.globalAlpha = 0.35 + Math.sin(Date.now() * 0.008) * 0.15;
    }

    // Stunned spark aura
    if (this.stunEffect) {
      ctx.shadowBlur = 18;
      ctx.shadowColor = '#38bdf8';
    } else {
      ctx.shadowBlur = this.slowEffect ? 14 : 8;
      ctx.shadowColor = this.slowEffect ? '#06b6d4' : this.glowColor;
    }

    ctx.rotate(this.angle);

    switch (this.type) {
      case 'scout': {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(this.radius * 1.3, 0);
        ctx.lineTo(-this.radius * 0.9, -this.radius * 0.85);
        ctx.lineTo(-this.radius * 0.4, 0);
        ctx.lineTo(-this.radius * 0.9, this.radius * 0.85);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(this.radius * 0.2, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'infiltrator': {
        // Sleek stealth phantom
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(this.radius * 1.4, 0);
        ctx.lineTo(-this.radius * 0.8, -this.radius * 0.6);
        ctx.lineTo(-this.radius * 0.2, 0);
        ctx.lineTo(-this.radius * 0.8, this.radius * 0.6);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#6ee7b7';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        break;
      }

      case 'shielded': {
        // Heavy Cruiser
        ctx.fillStyle = this.color;
        const r = this.radius;
        ctx.beginPath();
        ctx.moveTo(r * 1.2, 0);
        ctx.lineTo(-r * 0.8, -r * 0.9);
        ctx.lineTo(-r * 0.5, 0);
        ctx.lineTo(-r * 0.8, r * 0.9);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        break;
      }

      case 'goliath': {
        ctx.fillStyle = this.color;
        const r = this.radius;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'swarmer':
      case 'mini-swarmer': {
        ctx.fillStyle = this.color;
        const r = this.radius;
        ctx.beginPath();
        ctx.moveTo(r * 1.2, 0);
        ctx.lineTo(0, -r * 0.8);
        ctx.lineTo(-r * 0.9, 0);
        ctx.lineTo(0, r * 0.8);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        break;
      }

      case 'boss': {
        const r = this.radius;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(r * 1.5, 0);
        ctx.lineTo(0, -r * 1.1);
        ctx.lineTo(-r * 1.2, -r * 0.6);
        ctx.lineTo(-r * 0.8, 0);
        ctx.lineTo(-r * 1.2, r * 0.6);
        ctx.lineTo(0, r * 1.1);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#e9d5ff';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.fillStyle = '#fdf4ff';
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }

    ctx.restore();

    // Render Shield Bubble if active
    if (this.currentShield > 0) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 6, 0, Math.PI * 2);
      ctx.strokeStyle = '#38bdf8';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Render Health / Shield Bars & Badges
    ctx.save();
    ctx.translate(this.x, this.y);

    const barWidth = Math.max(28, this.radius * 2);
    const barHeight = 4;
    const barY = -this.radius - 12;

    // Background bar
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(-barWidth / 2, barY, barWidth, barHeight);

    // Health fill
    const healthPercent = Math.max(0, this.currentHealth / this.maxHealth);
    ctx.fillStyle = healthPercent > 0.5 ? '#10b981' : healthPercent > 0.25 ? '#f59e0b' : '#ef4444';
    ctx.fillRect(-barWidth / 2, barY, barWidth * healthPercent, barHeight);

    // Shield fill above health
    if (this.maxShield > 0 && this.currentShield > 0) {
      const shieldPercent = Math.max(0, this.currentShield / this.maxShield);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(-barWidth / 2, barY - 3, barWidth * shieldPercent, 2.5);
    }

    // Armor badge indicator
    if (this.armor > 0) {
      ctx.fillStyle = '#38bdf8';
      ctx.font = '700 8px monospace';
      ctx.fillText(`⛨${Math.round(this.armor * 100)}%`, -barWidth / 2 - 2, barY - 4);
    }

    // Status effect badges
    if (this.stunEffect) {
      ctx.fillStyle = '#38bdf8';
      ctx.font = '700 9px monospace';
      ctx.fillText('⚡STUN', -barWidth / 2, barY + barHeight + 9);
    } else {
      if (this.slowEffect) {
        ctx.fillStyle = '#06b6d4';
        ctx.font = '10px sans-serif';
        ctx.fillText('❄', barWidth / 2 - 8, barY + barHeight + 9);
      }
      if (this.burnEffect) {
        ctx.fillStyle = '#f97316';
        ctx.font = '10px sans-serif';
        ctx.fillText('🔥', barWidth / 2 + 3, barY + barHeight + 9);
      }
      if (this.isCloaked) {
        ctx.fillStyle = '#10b981';
        ctx.font = '700 8px monospace';
        ctx.fillText('CLOAK', -barWidth / 2, barY + barHeight + 8);
      }
    }

    ctx.restore();
  }
}
