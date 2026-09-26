/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type EnemyType = 'scout' | 'goliath' | 'swarmer' | 'mini-swarmer' | 'boss';

export interface Point {
  x: number;
  y: number;
}

export interface StatusEffect {
  type: 'slow' | 'burn';
  duration: number; // in seconds
  factor?: number;   // e.g. 0.5 for 50% speed
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
  public armor: number; // Flat or percentage armor damage reduction
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

  // Spawn tracking for rupturing enemies (e.g. Swarmer)
  public canRupture: boolean = false;
  public isDead: boolean = false;

  constructor(
    type: EnemyType,
    path: Point[],
    waveMultiplier: number = 1.0,
    startWaypointIndex: number = 0,
    spawnOffset: Point = { x: 0, y: 0 }
  ) {
    this.id = Math.random().toString(36).substring(2, 9);
    this.type = type;
    this.path = path;
    this.currentWaypointIndex = startWaypointIndex;

    const startPos = path[startWaypointIndex] || path[0];
    this.x = startPos.x + spawnOffset.x;
    this.y = startPos.y + spawnOffset.y;

    // Calculate total path length for targeting calculations (FIRST / LAST)
    this.calculatePathLength();

    // Configure archetype stats
    switch (type) {
      case 'scout':
        this.radius = 12;
        this.baseSpeed = 135; // high velocity
        this.maxHealth = Math.round(45 * waveMultiplier);
        this.armor = 0;
        this.reward = 12;
        this.scoreValue = 60;
        this.color = '#38bdf8';
        this.glowColor = 'rgba(56, 189, 248, 0.6)';
        break;

      case 'goliath':
        this.radius = 22;
        this.baseSpeed = 38; // slow velocity
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
        this.baseSpeed = 120;
        this.maxHealth = Math.round(30 * waveMultiplier);
        this.armor = 0;
        this.reward = 5;
        this.scoreValue = 30;
        this.color = '#fde047';
        this.glowColor = 'rgba(253, 224, 71, 0.8)';
        this.canRupture = false;
        break;

      case 'boss':
        this.radius = 28;
        this.baseSpeed = 32;
        this.maxHealth = Math.round(1200 * waveMultiplier);
        this.armor = 0.5; // 50% damage reduction
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

  /**
   * Applies slow status effect. If an existing slow is stronger or longer, preserve appropriately.
   */
  public applySlow(factor: number, duration: number): void {
    if (!this.slowEffect || this.slowEffect.factor > factor || this.slowEffect.duration < duration) {
      this.slowEffect = { factor, duration };
    }
  }

  /**
   * Applies burn status over time.
   */
  public applyBurn(damagePerSec: number, duration: number): void {
    if (!this.burnEffect || this.burnEffect.duration < duration) {
      this.burnEffect = { damagePerSec, duration };
    }
  }

  /**
   * Computes effective damage taking armor into account.
   */
  public takeDamage(rawDamage: number): { actualDamage: number; isFatal: boolean } {
    const mitigated = Math.max(1, rawDamage * (1 - this.armor));
    const actualDamage = Math.min(this.currentHealth, Math.round(mitigated * 10) / 10);
    this.currentHealth -= actualDamage;

    if (this.currentHealth <= 0) {
      this.currentHealth = 0;
      this.isDead = true;
      return { actualDamage, isFatal: true };
    }
    return { actualDamage, isFatal: false };
  }

  /**
   * Update position along vector path nodes per tick
   */
  public update(dt: number, onBurnTick?: (dmg: number) => void): void {
    if (this.isDead || this.reachedEnd) return;

    // Process Burn status effect
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

    // Process Slow status effect
    let currentSpeed = this.baseSpeed;
    if (this.slowEffect) {
      currentSpeed *= this.slowEffect.factor;
      this.slowEffect.duration -= dt;
      if (this.slowEffect.duration <= 0) {
        this.slowEffect = null;
      }
    }

    // Path Node Navigation: advance linearly towards target waypoint
    const targetNode = this.path[this.currentWaypointIndex + 1];
    if (!targetNode) {
      this.reachedEnd = true;
      return;
    }

    const dx = targetNode.x - this.x;
    const dy = targetNode.y - this.y;
    const distToNode = Math.sqrt(dx * dx + dy * dy);

    // Update facing angle smoothly
    this.angle = Math.atan2(dy, dx);

    const step = currentSpeed * dt;

    if (distToNode <= step) {
      // Reached or passed current waypoint node
      this.x = targetNode.x;
      this.y = targetNode.y;
      this.distanceTraveled += distToNode;
      this.currentWaypointIndex++;

      // Check if finished entire path
      if (this.currentWaypointIndex >= this.path.length - 1) {
        this.reachedEnd = true;
      }
    } else {
      // Move delta coordinates along direction vector
      const nx = dx / distToNode;
      const ny = dy / distToNode;
      this.x += nx * step;
      this.y += ny * step;
      this.distanceTraveled += step;
    }
  }

  /**
   * Render enemy unit with health bar, armor insignia, and status effects
   */
  public draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.x, this.y);

    // Render glow aura
    ctx.shadowBlur = this.slowEffect ? 14 : 8;
    ctx.shadowColor = this.slowEffect ? '#06b6d4' : this.glowColor;

    // Rotate towards vector trajectory
    ctx.rotate(this.angle);

    // Draw unit model by type
    switch (this.type) {
      case 'scout': {
        // Sleek supersonic delta-wing
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(this.radius * 1.3, 0);
        ctx.lineTo(-this.radius * 0.9, -this.radius * 0.85);
        ctx.lineTo(-this.radius * 0.4, 0);
        ctx.lineTo(-this.radius * 0.9, this.radius * 0.85);
        ctx.closePath();
        ctx.fill();

        // Inner cockpit light
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(this.radius * 0.2, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'goliath': {
        // Heavy octagonal armored walker
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

        // Armor plating ridges
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Core power gem
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'swarmer':
      case 'mini-swarmer': {
        // Angular diamond hive runner
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
        // Apex Dreadnought multi-hull warship
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

        // Pulsing shield edge
        ctx.strokeStyle = '#e9d5ff';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Boss core
        ctx.fillStyle = '#fdf4ff';
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }

    ctx.restore();

    // Render Health Bar & Status overlays (unrotated so text and bars are horizontal)
    ctx.save();
    ctx.translate(this.x, this.y);

    const barWidth = Math.max(28, this.radius * 2);
    const barHeight = 4;
    const barY = -this.radius - 10;

    // Background bar
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(-barWidth / 2, barY, barWidth, barHeight);

    // Health fill
    const healthPercent = Math.max(0, this.currentHealth / this.maxHealth);
    ctx.fillStyle = healthPercent > 0.5 ? '#10b981' : healthPercent > 0.25 ? '#f59e0b' : '#ef4444';
    ctx.fillRect(-barWidth / 2, barY, barWidth * healthPercent, barHeight);

    // Armor badge indicator if armored
    if (this.armor > 0) {
      ctx.fillStyle = '#38bdf8';
      ctx.font = '700 8px monospace';
      ctx.fillText(`⛨${Math.round(this.armor * 100)}%`, -barWidth / 2 - 2, barY - 3);
    }

    // Frost status indicator
    if (this.slowEffect) {
      ctx.fillStyle = '#06b6d4';
      ctx.font = '10px sans-serif';
      ctx.fillText('❄', barWidth / 2 - 8, barY + barHeight + 10);
    }

    // Burn status indicator
    if (this.burnEffect) {
      ctx.fillStyle = '#f97316';
      ctx.font = '10px sans-serif';
      ctx.fillText('🔥', barWidth / 2 + 3, barY + barHeight + 10);
    }

    ctx.restore();
  }
}
