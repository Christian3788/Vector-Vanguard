/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Enemy, Point } from './Enemy';
import { Projectile, ProjectileImpact } from './Projectile';

export type TowerType = 'gatling' | 'mortar' | 'frost' | 'tesla' | 'incinerator';
export type TargetingMode = 'FIRST' | 'LAST' | 'STRONGEST' | 'WEAKEST';
export type TowerBranch = 'A' | 'B';

export interface TowerConfig {
  name: string;
  type: TowerType;
  baseCost: number;
  baseRange: number;
  baseDamage: number;
  baseFireInterval: number;
  splashRadius: number;
  slowFactor?: number;
  slowDuration?: number;
  burnDps?: number;
  burnDuration?: number;
  maxChainTargets?: number;
  color: string;
  accentColor: string;
}

export interface BranchOption {
  key: TowerBranch;
  name: string;
  title: string;
  description: string;
  cost: number;
}

export const TOWER_CONFIGS: Record<TowerType, TowerConfig> = {
  gatling: {
    name: 'Gatling Laser',
    type: 'gatling',
    baseCost: 100,
    baseRange: 135,
    baseDamage: 18,
    baseFireInterval: 0.14,
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
    baseFireInterval: 1.8,
    splashRadius: 75,
    color: '#f59e0b',
    accentColor: '#fbbf24',
  },
  frost: {
    name: 'Frost Beam',
    type: 'frost',
    baseCost: 125,
    baseRange: 150,
    baseDamage: 9,
    baseFireInterval: 0.1,
    splashRadius: 0,
    slowFactor: 0.5,
    slowDuration: 1.2,
    color: '#8b5cf6',
    accentColor: '#c084fc',
  },
  tesla: {
    name: 'Tesla Coil',
    type: 'tesla',
    baseCost: 185,
    baseRange: 140,
    baseDamage: 65,
    baseFireInterval: 0.85,
    splashRadius: 0,
    maxChainTargets: 3,
    color: '#38bdf8',
    accentColor: '#0284c7',
  },
  incinerator: {
    name: 'Thermal Incinerator',
    type: 'incinerator',
    baseCost: 145,
    baseRange: 125,
    baseDamage: 12,
    baseFireInterval: 0.1,
    splashRadius: 0,
    burnDps: 22,
    burnDuration: 2.5,
    color: '#ef4444',
    accentColor: '#f97316',
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

  // Dual-Branch Specialization (Unlocked at Level 4)
  public branch: TowerBranch | null = null;
  public branchName: string = '';

  // Stats
  public range: number;
  public damage: number;
  public fireInterval: number;
  public splashRadius: number;
  public slowFactor: number;
  public slowDuration: number;
  public burnDps: number;
  public burnDuration: number;
  public maxChainTargets: number;
  public armorPierce: number = 0;

  // Economy & tracking
  public totalInvested: number;
  public totalDamageDealt: number = 0;
  public killCount: number = 0;

  // Runtime combat state
  public target: Enemy | null = null;
  public angle: number = 0;
  public fireCooldown: number = 0;
  public muzzleFlashTimer: number = 0;
  public isFiringBeam: boolean = false;
  public beamTargetPoint: Point | null = null;

  // Tesla chain target tracking
  public teslaChainTargets: Point[] = [];
  public teslaArcTimer: number = 0;

  // Flame cone animation
  public isSpewingFire: boolean = false;

  // Commander Overdrive / Hypercharge state
  public isHypercharged: boolean = false;

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
    this.burnDps = cfg.burnDps ?? 0;
    this.burnDuration = cfg.burnDuration ?? 0;
    this.maxChainTargets = cfg.maxChainTargets ?? 1;

    this.fireCooldown = Math.random() * 0.1;
  }

  public getUpgradeCost(): number {
    if (this.level >= this.maxLevel) return 0;
    const base = TOWER_CONFIGS[this.type].baseCost;
    return Math.round(base * (0.8 + this.level * 0.5));
  }

  public getSellRefund(): number {
    return Math.round(this.totalInvested * 0.7);
  }

  public isBranchChoiceReady(): boolean {
    return this.level === 3;
  }

  public getBranchOptions(): BranchOption[] {
    const cost = this.getUpgradeCost();
    switch (this.type) {
      case 'gatling':
        return [
          {
            key: 'A',
            name: 'Sniper Railgun',
            title: 'Path A: Sniper Railgun',
            description: '+70% Range, +200% Damage, 80% Armor Piercing line shots.',
            cost,
          },
          {
            key: 'B',
            name: 'Pulse Accelerator',
            title: 'Path B: Pulse Accelerator',
            description: 'Ultra-fast beam pulses (0.05s fire rate), +100% bonus vs shields.',
            cost,
          },
        ];
      case 'mortar':
        return [
          {
            key: 'A',
            name: 'Cluster Bombard',
            title: 'Path A: Cluster Bombard',
            description: 'Detonates into 3 secondary cluster explosives across the area.',
            cost,
          },
          {
            key: 'B',
            name: 'Seismic Napalm',
            title: 'Path B: Seismic Napalm',
            description: 'Explosion creates a persistent 6s molten fire puddle (40 burn DPS).',
            cost,
          },
        ];
      case 'frost':
        return [
          {
            key: 'A',
            name: 'Blizzard Core',
            title: 'Path A: Blizzard Core',
            description: 'Deep freeze cryo-aura chills ALL hostiles within range simultaneously.',
            cost,
          },
          {
            key: 'B',
            name: 'Absolute Zero',
            title: 'Path B: Absolute Zero',
            description: 'Beam inflicts 1.2s solid freeze stun and deals 2x damage to chilled foes.',
            cost,
          },
        ];
      case 'tesla':
        return [
          {
            key: 'A',
            name: 'High-Voltage Cascade',
            title: 'Path A: Voltage Cascade',
            description: 'Chain lightning branches up to 6 targets with +60% arc damage.',
            cost,
          },
          {
            key: 'B',
            name: 'EMP Disruptor',
            title: 'Path B: EMP Disruptor',
            description: 'Instant shield shredding on impact and cancels stealth cloaking.',
            cost,
          },
        ];
      case 'incinerator':
        return [
          {
            key: 'A',
            name: 'Magma Projector',
            title: 'Path A: Magma Projector',
            description: 'Wide 75° flame cone projecting persistent molten fire puddles.',
            cost,
          },
          {
            key: 'B',
            name: 'Hellfire Meltdown',
            title: 'Path B: Hellfire Meltdown',
            description: 'Inflicts Meltdown vulnerability; targets take +50% bonus damage from all sources.',
            cost,
          },
        ];
    }
  }

  public upgradeStandard(): boolean {
    if (this.level >= 3) return false;

    this.totalInvested += this.getUpgradeCost();
    this.level++;

    this.damage = Math.round(this.damage * 1.35);
    this.range = Math.round(this.range * 1.12);
    this.fireInterval = Math.max(0.05, this.fireInterval * 0.9);

    if (this.splashRadius > 0) {
      this.splashRadius = Math.round(this.splashRadius * 1.15);
    }
    if (this.type === 'frost') {
      this.slowFactor = Math.max(0.25, this.slowFactor - 0.05);
      this.slowDuration += 0.25;
    }
    if (this.type === 'tesla') {
      this.maxChainTargets += 1;
    }
    if (this.type === 'incinerator') {
      this.burnDps = Math.round(this.burnDps * 1.4);
    }

    return true;
  }

  public upgradeBranch(choice: TowerBranch): boolean {
    if (this.level !== 3) return false;

    this.totalInvested += this.getUpgradeCost();
    this.level = 4;
    this.branch = choice;

    const opts = this.getBranchOptions();
    const selectedOpt = opts.find((o) => o.key === choice);
    this.branchName = selectedOpt ? selectedOpt.name : '';

    if (this.type === 'gatling') {
      if (choice === 'A') {
        // Sniper Railgun
        this.range = Math.round(this.range * 1.7);
        this.damage = Math.round(this.damage * 3.0);
        this.fireInterval = 0.55;
        this.armorPierce = 0.8;
      } else {
        // Pulse Accelerator
        this.fireInterval = 0.05;
        this.damage = Math.round(this.damage * 1.3);
      }
    } else if (this.type === 'mortar') {
      if (choice === 'A') {
        // Cluster Bombard
        this.damage = Math.round(this.damage * 1.4);
        this.splashRadius = Math.round(this.splashRadius * 1.3);
      } else {
        // Seismic Napalm
        this.damage = Math.round(this.damage * 1.5);
      }
    } else if (this.type === 'frost') {
      if (choice === 'A') {
        // Blizzard Core (Aura)
        this.range = Math.round(this.range * 1.25);
        this.slowFactor = 0.4;
      } else {
        // Absolute Zero
        this.damage = Math.round(this.damage * 1.8);
      }
    } else if (this.type === 'tesla') {
      if (choice === 'A') {
        // Voltage Cascade
        this.maxChainTargets = 6;
        this.damage = Math.round(this.damage * 1.6);
      } else {
        // EMP Disruptor
        this.damage = Math.round(this.damage * 1.4);
      }
    } else if (this.type === 'incinerator') {
      if (choice === 'A') {
        // Magma Projector
        this.range = Math.round(this.range * 1.35);
        this.burnDps = Math.round(this.burnDps * 1.7);
      } else {
        // Hellfire Meltdown
        this.burnDps = Math.round(this.burnDps * 2.0);
      }
    }

    return true;
  }

  public selectTarget(enemies: Enemy[]): Enemy | null {
    const rangeSquared = this.range * this.range;
    const validEnemies: { enemy: Enemy; distSq: number }[] = [];

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.isDead || e.reachedEnd) continue;

      const dx = e.x - this.x;
      const dy = e.y - this.y;
      const distSq = dx * dx + dy * dy;

      if (distSq <= rangeSquared) {
        validEnemies.push({ enemy: e, distSq });
      }
    }

    if (validEnemies.length === 0) return null;

    switch (this.targetingMode) {
      case 'FIRST':
        validEnemies.sort((a, b) => b.enemy.distanceTraveled - a.enemy.distanceTraveled);
        break;
      case 'LAST':
        validEnemies.sort((a, b) => a.enemy.distanceTraveled - b.enemy.distanceTraveled);
        break;
      case 'STRONGEST':
        validEnemies.sort((a, b) => b.enemy.currentHealth - a.enemy.currentHealth);
        break;
      case 'WEAKEST':
        validEnemies.sort((a, b) => a.enemy.currentHealth - b.enemy.currentHealth);
        break;
    }

    return validEnemies[0].enemy;
  }

  public update(
    dt: number,
    enemies: Enemy[],
    onSpawnProjectile: (projectile: Projectile) => void,
    onDirectHit?: (impact: ProjectileImpact) => void,
    onTeslaArc?: (points: Point[], enemiesHit: Enemy[]) => void,
    onSpawnNapalm?: (x: number, y: number) => void,
    onSpawnCluster?: (x: number, y: number, damage: number) => void
  ): void {
    const effectiveInterval = this.isHypercharged ? this.fireInterval * 0.5 : this.fireInterval;

    if (this.fireCooldown > 0) {
      this.fireCooldown -= dt;
    }
    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= dt;
    }
    if (this.teslaArcTimer > 0) {
      this.teslaArcTimer -= dt;
      if (this.teslaArcTimer <= 0) {
        this.teslaChainTargets = [];
      }
    }

    // Blizzard Core: Passive AoE slow to all enemies in range
    if (this.type === 'frost' && this.level === 4 && this.branch === 'A') {
      const rangeSq = this.range * this.range;
      for (const e of enemies) {
        if (e.isDead || e.reachedEnd) continue;
        const dx = e.x - this.x;
        const dy = e.y - this.y;
        if (dx * dx + dy * dy <= rangeSq) {
          e.applySlow(this.slowFactor, 0.4);
        }
      }
    }

    this.target = this.selectTarget(enemies);

    if (this.target) {
      this.angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);

      // Frost Beam
      if (this.type === 'frost') {
        this.isFiringBeam = true;
        this.beamTargetPoint = { x: this.target.x, y: this.target.y };

        if (this.fireCooldown <= 0) {
          this.fireCooldown = effectiveInterval;
          this.muzzleFlashTimer = 0.08;

          // Absolute Zero: solid freeze stun
          const isAbsoluteZero = this.level === 4 && this.branch === 'B';
          if (isAbsoluteZero && Math.random() < 0.35) {
            this.target.applyStun(1.2);
          }

          if (onDirectHit) {
            onDirectHit({
              x: this.target.x,
              y: this.target.y,
              damage: isAbsoluteZero && (this.target.slowEffect || this.target.stunEffect) ? this.damage * 2 : this.damage,
              splashRadius: 0,
              effect: 'slow',
              effectFactor: this.slowFactor,
              effectDuration: this.slowDuration,
            });
          }
        }
      }
      // Tesla Coil (Chain Lightning)
      else if (this.type === 'tesla') {
        this.isFiringBeam = false;
        this.beamTargetPoint = null;

        if (this.fireCooldown <= 0) {
          this.fireCooldown = effectiveInterval;
          this.muzzleFlashTimer = 0.12;

          // EMP Disruptor: reveal cloaked & strip shields
          if (this.level === 4 && this.branch === 'B') {
            this.target.isCloaked = false;
            this.target.currentShield = 0;
          }

          // Find chain targets
          const hitEnemies: Enemy[] = [this.target];
          const chainPoints: Point[] = [{ x: this.x, y: this.y }, { x: this.target.x, y: this.target.y }];
          let currentTarget = this.target;

          while (hitEnemies.length < this.maxChainTargets) {
            let nextClosest: Enemy | null = null;
            let closestDistSq = 110 * 110; // Bounce radius

            for (let i = 0; i < enemies.length; i++) {
              const e = enemies[i];
              if (e.isDead || e.reachedEnd || hitEnemies.includes(e)) continue;

              const dx = e.x - currentTarget.x;
              const dy = e.y - currentTarget.y;
              const dSq = dx * dx + dy * dy;

              if (dSq < closestDistSq) {
                closestDistSq = dSq;
                nextClosest = e;
              }
            }

            if (nextClosest) {
              if (this.level === 4 && this.branch === 'B') {
                nextClosest.isCloaked = false;
                nextClosest.currentShield = 0;
              }
              hitEnemies.push(nextClosest);
              chainPoints.push({ x: nextClosest.x, y: nextClosest.y });
              currentTarget = nextClosest;
            } else {
              break;
            }
          }

          this.teslaChainTargets = chainPoints;
          this.teslaArcTimer = 0.15;

          if (onTeslaArc) {
            onTeslaArc(chainPoints, hitEnemies);
          }
        }
      }
      // Thermal Incinerator (Flame Cone)
      else if (this.type === 'incinerator') {
        this.isSpewingFire = true;

        if (this.fireCooldown <= 0) {
          this.fireCooldown = effectiveInterval;
          this.muzzleFlashTimer = 0.08;

          // Magma projector has wider cone (75 deg), normal is 45 deg
          const coneAngle = this.level === 4 && this.branch === 'A' ? Math.PI * 0.42 : Math.PI / 4;
          const rangeSq = this.range * this.range;

          // Chance to spawn molten ground puddle for Magma Projector
          if (this.level === 4 && this.branch === 'A' && Math.random() < 0.2 && onSpawnNapalm) {
            onSpawnNapalm(this.target.x, this.target.y);
          }

          for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (e.isDead || e.reachedEnd) continue;

            const dx = e.x - this.x;
            const dy = e.y - this.y;
            const distSq = dx * dx + dy * dy;

            if (distSq <= rangeSq) {
              const enemyAngle = Math.atan2(dy, dx);
              let diffAngle = Math.abs(enemyAngle - this.angle);
              while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;
              diffAngle = Math.abs(diffAngle);

              if (diffAngle <= coneAngle / 2) {
                // Hellfire Meltdown applies brittle vulnerability (+50% dmg)
                if (this.level === 4 && this.branch === 'B') {
                  e.applyBrittle(3.0);
                }

                if (onDirectHit) {
                  onDirectHit({
                    x: e.x,
                    y: e.y,
                    damage: this.damage,
                    splashRadius: 0,
                    effect: 'burn',
                    effectFactor: this.burnDps,
                    effectDuration: this.burnDuration,
                  });
                }
              }
            }
          }
        }
      }
      // Projectile Launchers (Gatling Laser & Mortar)
      else {
        this.isFiringBeam = false;
        this.beamTargetPoint = null;
        this.isSpewingFire = false;

        if (this.fireCooldown <= 0) {
          this.fireCooldown = effectiveInterval;
          this.muzzleFlashTimer = 0.06;

          const origin: Point = {
            x: this.x + Math.cos(this.angle) * 18,
            y: this.y + Math.sin(this.angle) * 18,
          };

          if (this.type === 'gatling') {
            const isRailgun = this.level === 4 && this.branch === 'A';
            const isPulse = this.level === 4 && this.branch === 'B';

            const p = new Projectile('laser', origin, this.target, this.damage, {
              speed: isRailgun ? 980 : isPulse ? 850 : 720,
              color: isRailgun ? '#38bdf8' : isPulse ? '#06b6d4' : '#22d3ee',
              radius: isRailgun ? 5.5 : 3.5,
              splashRadius: 0,
              armorPierce: this.armorPierce,
            });
            onSpawnProjectile(p);
          } else if (this.type === 'mortar') {
            const isCluster = this.level === 4 && this.branch === 'A';
            const isNapalm = this.level === 4 && this.branch === 'B';

            const p = new Projectile('mortar', origin, this.target, this.damage, {
              speed: 260,
              color: isNapalm ? '#ef4444' : '#fbbf24',
              radius: 6.5,
              splashRadius: this.splashRadius,
              onDetonate: (detX, detY) => {
                if (isCluster && onSpawnCluster) {
                  onSpawnCluster(detX, detY, Math.round(this.damage * 0.4));
                }
                if (isNapalm && onSpawnNapalm) {
                  onSpawnNapalm(detX, detY);
                }
              },
            });
            onSpawnProjectile(p);
          }
        }
      }
    } else {
      this.isFiringBeam = false;
      this.beamTargetPoint = null;
      this.isSpewingFire = false;
    }
  }

  public draw(ctx: CanvasRenderingContext2D, isSelected: boolean = false, forceShowRange: boolean = false): void {
    const cfg = TOWER_CONFIGS[this.type];

    // Range Boundary Circle
    if (isSelected || forceShowRange) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.range, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? 'rgba(6, 182, 212, 0.09)' : 'rgba(56, 189, 248, 0.04)';
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#06b6d4' : 'rgba(56, 189, 248, 0.35)';
      ctx.lineWidth = isSelected ? 1.5 : 1;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.restore();
    }

    // Blizzard Aura Field (Level 4 Branch A Frost)
    if (this.type === 'frost' && this.level === 4 && this.branch === 'A') {
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.range, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(192, 132, 252, 0.04)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.restore();
    }

    // Draw Continuous Frost Beam
    if (this.isFiringBeam && this.beamTargetPoint) {
      ctx.save();
      ctx.strokeStyle = this.branch === 'B' ? '#67e8f9' : '#c084fc';
      ctx.shadowBlur = 12;
      ctx.shadowColor = this.branch === 'B' ? '#06b6d4' : '#a855f7';
      ctx.lineWidth = 3 + Math.sin(Date.now() * 0.02) * 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.x + Math.cos(this.angle) * 16, this.y + Math.sin(this.angle) * 16);
      ctx.lineTo(this.beamTargetPoint.x, this.beamTargetPoint.y);
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // Draw Tesla Electric Arcs
    if (this.teslaArcTimer > 0 && this.teslaChainTargets.length > 1) {
      ctx.save();
      ctx.strokeStyle = this.branch === 'B' ? '#67e8f9' : '#38bdf8';
      ctx.shadowBlur = 14;
      ctx.shadowColor = this.branch === 'B' ? '#0891b2' : '#0284c7';
      ctx.lineWidth = 2.5;

      ctx.beginPath();
      ctx.moveTo(this.teslaChainTargets[0].x, this.teslaChainTargets[0].y);

      for (let i = 1; i < this.teslaChainTargets.length; i++) {
        const p1 = this.teslaChainTargets[i - 1];
        const p2 = this.teslaChainTargets[i];

        const midX = (p1.x + p2.x) / 2 + (Math.random() - 0.5) * 18;
        const midY = (p1.y + p2.y) / 2 + (Math.random() - 0.5) * 18;

        ctx.lineTo(midX, midY);
        ctx.lineTo(p2.x, p2.y);
      }
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    // Draw Flame Cone
    if (this.isSpewingFire) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);

      const isHellfire = this.level === 4 && this.branch === 'B';
      const coneAngle = this.level === 4 && this.branch === 'A' ? Math.PI * 0.42 : Math.PI / 4;
      const flameDist = this.range * 0.95;

      const grad = ctx.createRadialGradient(0, 0, 10, 0, 0, flameDist);
      if (isHellfire) {
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        grad.addColorStop(0.3, 'rgba(96, 165, 250, 0.8)');
        grad.addColorStop(0.8, 'rgba(37, 99, 235, 0.4)');
        grad.addColorStop(1, 'rgba(30, 64, 175, 0)');
      } else {
        grad.addColorStop(0, 'rgba(254, 240, 138, 0.9)');
        grad.addColorStop(0.3, 'rgba(249, 115, 22, 0.8)');
        grad.addColorStop(0.8, 'rgba(239, 68, 68, 0.4)');
        grad.addColorStop(1, 'rgba(185, 28, 28, 0)');
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.arc(0, 0, flameDist, -coneAngle / 2, coneAngle / 2);
      ctx.closePath();
      ctx.fill();

      // Flame sparks
      for (let p = 0; p < 4; p++) {
        const pr = 20 + Math.random() * (flameDist - 25);
        const pa = (Math.random() - 0.5) * coneAngle;
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(Math.cos(pa) * pr, Math.sin(pa) * pr, 2 + Math.random() * 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    // 1. Tower Base Platform
    ctx.save();
    ctx.translate(this.x, this.y);

    // Hypercharge electric aura
    if (this.isHypercharged) {
      ctx.shadowBlur = 18;
      ctx.shadowColor = '#eab308';
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Level 4 Specialization Ring
    if (this.level === 4) {
      ctx.shadowBlur = 12;
      ctx.shadowColor = this.branch === 'A' ? '#f59e0b' : '#38bdf8';
      ctx.strokeStyle = this.branch === 'A' ? '#facc15' : '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.stroke();
    }

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

    ctx.strokeStyle = isSelected ? '#38bdf8' : 'rgba(148, 163, 184, 0.3)';
    ctx.lineWidth = isSelected ? 2 : 1.2;
    ctx.stroke();

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
        const isRailgun = this.level === 4 && this.branch === 'A';
        const isPulse = this.level === 4 && this.branch === 'B';

        if (isRailgun) {
          // Elongated railgun barrel with magnetic coils
          ctx.fillStyle = '#475569';
          ctx.fillRect(4, -3, 22, 6);
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(10, -4, 3, 8);
          ctx.fillRect(16, -4, 3, 8);
          ctx.fillRect(22, -4, 3, 8);
        } else if (isPulse) {
          // Quad rapid pulse emitter
          ctx.fillStyle = '#64748b';
          ctx.fillRect(4, -6, 15, 2.5);
          ctx.fillRect(4, -2, 15, 2.5);
          ctx.fillRect(4, 2, 15, 2.5);
          ctx.fillRect(4, 6, 15, 2.5);
        } else {
          // Standard twin barrel
          ctx.fillStyle = '#64748b';
          ctx.fillRect(4, -5, 14, 3);
          ctx.fillRect(4, 2, 14, 3);
          ctx.fillStyle = cfg.accentColor;
          ctx.fillRect(16, -5, 3, 3);
          ctx.fillRect(16, 2, 3, 3);
        }

        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = cfg.accentColor;
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        if (this.muzzleFlashTimer > 0) {
          ctx.fillStyle = '#ffffff';
          ctx.shadowBlur = 12;
          ctx.shadowColor = cfg.accentColor;
          ctx.beginPath();
          ctx.arc(22, 0, 6, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case 'mortar': {
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

        ctx.fillStyle = this.level === 4 && this.branch === 'B' ? '#ef4444' : cfg.color;
        ctx.fillRect(14, -6, 4, 12);

        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();

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
        ctx.fillStyle = '#475569';
        ctx.fillRect(2, -3, 10, 6);

        ctx.fillStyle = cfg.color;
        ctx.beginPath();
        ctx.arc(10, 0, 7, -Math.PI / 2.5, Math.PI / 2.5);
        ctx.lineTo(9, 0);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#e9d5ff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#c084fc';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'tesla': {
        ctx.fillStyle = '#334155';
        ctx.fillRect(0, -4, 12, 8);

        ctx.fillStyle = this.level === 4 && this.branch === 'B' ? '#0891b2' : '#0284c7';
        ctx.beginPath();
        ctx.arc(8, 0, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = this.level === 4 && this.branch === 'B' ? '#67e8f9' : '#38bdf8';
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#38bdf8';
        ctx.beginPath();
        ctx.arc(14, 0, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(14, 0, 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'incinerator': {
        ctx.fillStyle = '#475569';
        ctx.fillRect(4, -4, 14, 8);

        ctx.fillStyle = this.level === 4 && this.branch === 'B' ? '#2563eb' : '#b91c1c';
        ctx.fillRect(14, -5, 4, 10);

        ctx.fillStyle = this.level === 4 && this.branch === 'B' ? '#60a5fa' : '#f97316';
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(19, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }

    ctx.restore();

    // 3. Level Stars or Branch Indicator
    ctx.save();
    ctx.translate(this.x, this.y);
    const starOffset = -18;

    if (this.level === 4 && this.branch) {
      ctx.fillStyle = this.branch === 'A' ? '#f59e0b' : '#38bdf8';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`[${this.branch}]`, 0, starOffset);
    } else {
      for (let l = 0; l < this.level; l++) {
        const sx = (l - (this.level - 1) / 2) * 6;
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(sx, starOffset, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}
