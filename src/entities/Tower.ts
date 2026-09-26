/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Enemy, Point } from './Enemy';
import { Projectile, ProjectileImpact } from './Projectile';

export type TowerType = 'gatling' | 'mortar' | 'frost';
export type TargetingMode = 'FIRST' | 'LAST' | 'STRONGEST' | 'WEAKEST';

export interface TowerConfig {
  name: string;
  type: TowerType;
  baseCost: number;
  baseRange: number;
  baseDamage: number;
  baseFireInterval: number; // in seconds (e.g. 0.12s for Gatling)
  splashRadius: number;
  slowFactor?: number;
  slowDuration?: number;
  color: string;
  accentColor: string;
}

export const TOWER_CONFIGS: Record<TowerType, TowerConfig> = {
  gatling: {
    name: 'Gatling Laser',
    type: 'gatling',
    baseCost: 100,
    baseRange: 135,
    baseDamage: 18,
    baseFireInterval: 0.14, // ~7.1 attacks/sec ultra-fast single target
    splashRadius: 0,
    color: '#06b6d4',
    accentColor: '#22d3ee',
  },
  mortar: {
    name: 'Plasma Mortar',
    type: 'mortar',
    baseCost: 160,
    baseRange: 210,
    baseDamage: 110,
    baseFireInterval: 1.8, // Slow, high damage
    splashRadius: 75,
    color: '#f59e0b',
    accentColor: '#fbbf24',
  },
  frost: {
    name: 'Frost Beam',
    type: 'frost',
    baseCost: 125,
    baseRange: 150,
    baseDamage: 9, // Continuous damage ticks
    baseFireInterval: 0.1, // 10 ticks per second continuous beam
    splashRadius: 0,
    slowFactor: 0.5, // 50% velocity reduction
    slowDuration: 1.2,
    color: '#8b5cf6',
    accentColor: '#c084fc',
  },
};

export class Tower {
  public id: string;
  public type: TowerType;
  public gridX: number;
  public gridY: number;
  public x: number;
  public y: number;
  public level: number = 1;
  public maxLevel: number = 4;
  public targetingMode: TargetingMode = 'FIRST';

  // Stats derived from base + level upgrades
  public range: number;
  public damage: number;
  public fireInterval: number;
  public splashRadius: number;
  public slowFactor: number;
  public slowDuration: number;

  // Economy & tracking
  public totalInvested: number;
  public totalDamageDealt: number = 0;
  public killCount: number = 0;

  // Runtime combat state
  public target: Enemy | null = null;
  public angle: number = 0; // Turret rotation angle in radians
  public fireCooldown: number = 0; // Countdown in seconds
  public muzzleFlashTimer: number = 0;
  public isFiringBeam: boolean = false;
  public beamTargetPoint: Point | null = null;

  constructor(type: TowerType, gridX: number, gridY: number, cellWidth: number, cellHeight: number) {
    this.id = Math.random().toString(36).substring(2, 9);
    this.type = type;
    this.gridX = gridX;
    this.gridY = gridY;
    this.x = gridX * cellWidth + cellWidth / 2;
    this.y = gridY * cellHeight + cellHeight / 2;

    const cfg = TOWER_CONFIGS[type];
    this.totalInvested = cfg.baseCost;

    this.range = cfg.baseRange;
    this.damage = cfg.baseDamage;
    this.fireInterval = cfg.baseFireInterval;
    this.splashRadius = cfg.splashRadius;
    this.slowFactor = cfg.slowFactor ?? 1.0;
    this.slowDuration = cfg.slowDuration ?? 0;

    // Start with a slight random cooldown offset to prevent all towers firing on identical frames
    this.fireCooldown = Math.random() * 0.1;
  }

  public getUpgradeCost(): number {
    if (this.level >= this.maxLevel) return 0;
    const base = TOWER_CONFIGS[this.type].baseCost;
    return Math.round(base * (0.8 + this.level * 0.45));
  }

  public getSellRefund(): number {
    return Math.round(this.totalInvested * 0.7);
  }

  public upgrade(): boolean {
    if (this.level >= this.maxLevel) return false;

    this.totalInvested += this.getUpgradeCost();
    this.level++;

    // Increment stats per level
    this.damage = Math.round(this.damage * 1.35);
    this.range = Math.round(this.range * 1.12);
    this.fireInterval = Math.max(0.06, this.fireInterval * 0.92);

    if (this.splashRadius > 0) {
      this.splashRadius = Math.round(this.splashRadius * 1.15);
    }
    if (this.type === 'frost') {
      // Deeper freeze
      this.slowFactor = Math.max(0.3, this.slowFactor - 0.05);
      this.slowDuration += 0.2;
    }

    return true;
  }

  /**
   * Aim logic layer: scans enemies matrix using Euclidean distance [A² + B² = C²].
   * Filters by range and sorts according to targetingMode [First, Last, Strongest, Weakest].
   */
  public selectTarget(enemies: Enemy[]): Enemy | null {
    const rangeSquared = this.range * this.range;
    const validEnemies: { enemy: Enemy; distSq: number }[] = [];

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.isDead || e.reachedEnd) continue;

      // Euclidean Distance calculation: (dx² + dy²) = dist²
      const dx = e.x - this.x;
      const dy = e.y - this.y;
      const distSq = dx * dx + dy * dy;

      if (distSq <= rangeSquared) {
        validEnemies.push({ enemy: e, distSq });
      }
    }

    if (validEnemies.length === 0) {
      return null;
    }

    switch (this.targetingMode) {
      case 'FIRST':
        // Enemy farthest along path
        validEnemies.sort((a, b) => b.enemy.distanceTraveled - a.enemy.distanceTraveled);
        break;

      case 'LAST':
        // Enemy closest to spawn point
        validEnemies.sort((a, b) => a.enemy.distanceTraveled - b.enemy.distanceTraveled);
        break;

      case 'STRONGEST':
        // Enemy with maximum current hit points
        validEnemies.sort((a, b) => b.enemy.currentHealth - a.enemy.currentHealth);
        break;

      case 'WEAKEST':
        // Enemy with lowest current hit points
        validEnemies.sort((a, b) => a.enemy.currentHealth - b.enemy.currentHealth);
        break;
    }

    return validEnemies[0].enemy;
  }

  /**
   * Primary update cycle per tick
   */
  public update(
    dt: number,
    enemies: Enemy[],
    onSpawnProjectile: (projectile: Projectile) => void,
    onBeamHit?: (impact: ProjectileImpact) => void
  ): void {
    if (this.fireCooldown > 0) {
      this.fireCooldown -= dt;
    }
    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= dt;
    }

    // Select target based on distance and behavior
    this.target = this.selectTarget(enemies);

    if (this.target) {
      // Vector Targeting Framework: exact angle towards target
      // Math.atan2(target.y - tower.y, target.x - tower.x)
      this.angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);

      // Firing mechanics
      if (this.type === 'frost') {
        // Continuous cryogenic ray
        this.isFiringBeam = true;
        this.beamTargetPoint = { x: this.target.x, y: this.target.y };

        if (this.fireCooldown <= 0) {
          this.fireCooldown = this.fireInterval;
          this.muzzleFlashTimer = 0.08;

          if (onBeamHit) {
            onBeamHit({
              x: this.target.x,
              y: this.target.y,
              damage: this.damage,
              splashRadius: 0,
              effect: 'slow',
              effectFactor: this.slowFactor,
              effectDuration: this.slowDuration,
            });
          }
        }
      } else {
        this.isFiringBeam = false;
        this.beamTargetPoint = null;

        if (this.fireCooldown <= 0) {
          this.fireCooldown = this.fireInterval;
          this.muzzleFlashTimer = 0.06;

          // Spawn appropriate projectile
          const origin: Point = {
            x: this.x + Math.cos(this.angle) * 18,
            y: this.y + Math.sin(this.angle) * 18,
          };

          if (this.type === 'gatling') {
            const p = new Projectile('laser', origin, this.target, this.damage, {
              speed: 720,
              color: '#22d3ee',
              radius: 3.5,
              splashRadius: 0,
            });
            onSpawnProjectile(p);
          } else if (this.type === 'mortar') {
            const p = new Projectile('mortar', origin, this.target, this.damage, {
              speed: 260,
              color: '#fbbf24',
              radius: 6.5,
              splashRadius: this.splashRadius,
            });
            onSpawnProjectile(p);
          }
        }
      }
    } else {
      this.isFiringBeam = false;
      this.beamTargetPoint = null;
    }
  }

  /**
   * Render tower base, turret barrel, level insignia, and beam FX
   */
  public draw(ctx: CanvasRenderingContext2D, isSelected: boolean = false): void {
    const cfg = TOWER_CONFIGS[this.type];

    // Range Boundary Circle when selected
    if (isSelected) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.range, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(6, 182, 212, 0.08)';
      ctx.fill();
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.stroke();
      ctx.restore();
    }

    // Draw Continuous Frost Beam if firing
    if (this.isFiringBeam && this.beamTargetPoint) {
      ctx.save();
      ctx.strokeStyle = '#c084fc';
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#a855f7';
      ctx.lineWidth = 3 + Math.sin(Date.now() * 0.02) * 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.x + Math.cos(this.angle) * 16, this.y + Math.sin(this.angle) * 16);
      ctx.lineTo(this.beamTargetPoint.x, this.beamTargetPoint.y);
      ctx.stroke();

      // Inner white beam streak
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // 1. Tower Base Platform
    ctx.save();
    ctx.translate(this.x, this.y);

    // Platform shadow
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';

    // Hexagonal base plate
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      const px = Math.cos(a) * 20;
      const py = Math.sin(a) * 20;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // Base outline
    ctx.strokeStyle = isSelected ? '#38bdf8' : 'rgba(148, 163, 184, 0.3)';
    ctx.lineWidth = isSelected ? 2 : 1.2;
    ctx.stroke();

    // Inner ring
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.strokeStyle = cfg.color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();

    // 2. Rotating Turret Head
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    switch (this.type) {
      case 'gatling': {
        // Dual laser barrels
        ctx.fillStyle = '#64748b';
        ctx.fillRect(4, -5, 14, 3);
        ctx.fillRect(4, 2, 14, 3);

        // Barrel tips
        ctx.fillStyle = cfg.accentColor;
        ctx.fillRect(16, -5, 3, 3);
        ctx.fillRect(16, 2, 3, 3);

        // Turret dome
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = cfg.accentColor;
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        // Muzzle flash on shoot
        if (this.muzzleFlashTimer > 0) {
          ctx.fillStyle = '#ffffff';
          ctx.shadowBlur = 10;
          ctx.shadowColor = cfg.accentColor;
          ctx.beginPath();
          ctx.arc(20, -3.5, 4, 0, Math.PI * 2);
          ctx.arc(20, 3.5, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case 'mortar': {
        // Heavy wide-bore artillery cannon
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(17, -5);
        ctx.lineTo(17, 5);
        ctx.lineTo(0, 6);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Heavy muzzle band
        ctx.fillStyle = cfg.color;
        ctx.fillRect(14, -6, 4, 12);

        // Turret center
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();

        // Blast muzzle flash
        if (this.muzzleFlashTimer > 0) {
          ctx.fillStyle = '#fef08a';
          ctx.shadowBlur = 15;
          ctx.shadowColor = '#f59e0b';
          ctx.beginPath();
          ctx.arc(22, 0, 8, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case 'frost': {
        // Cryo dish emitter
        ctx.fillStyle = '#475569';
        ctx.fillRect(2, -3, 10, 6);

        // Curved focusing dish
        ctx.fillStyle = cfg.color;
        ctx.beginPath();
        ctx.arc(10, 0, 7, -Math.PI / 2.5, Math.PI / 2.5);
        ctx.lineTo(9, 0);
        ctx.closePath();
        ctx.fill();

        // Crystal core
        ctx.fillStyle = '#e9d5ff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#c084fc';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }

    ctx.restore();

    // 3. Level Stars / Badges
    ctx.save();
    ctx.translate(this.x, this.y);
    const starOffset = -18;
    for (let l = 0; l < this.level; l++) {
      const sx = (l - (this.level - 1) / 2) * 6;
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(sx, starOffset, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
