/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Enemy, EnemyType, Point } from '../entities/Enemy';
import { Projectile, ProjectileImpact } from '../entities/Projectile';
import { TargetingMode, Tower, TOWER_CONFIGS, TowerType } from '../entities/Tower';
import { SoundFX } from './SoundFX';

export interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  lifespan: number; // in seconds
  age: number;
  vy: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  decay: number;
  glow?: boolean;
}

export interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  alpha: number;
}

export class Game {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;

  // Grid dimensions
  public readonly cols: number = 20;
  public readonly rows: number = 13;
  public readonly cellWidth: number = 50;
  public readonly cellHeight: number = 50;

  // Path Waypoint Vectors
  public pathWaypoints: Point[] = [];
  public pathOccupiedCells: Set<string> = new Set();

  // Entities
  public towers: Tower[] = [];
  public enemies: Enemy[] = [];
  public projectiles: Projectile[] = [];
  public particles: Particle[] = [];
  public shockwaves: Shockwave[] = [];
  public floatingTexts: FloatingText[] = [];

  // Audio system
  public sound: SoundFX;

  // Economy & Core State
  public gold: number = 450;
  public baseHealth: number = 20;
  public maxBaseHealth: number = 20;
  public score: number = 0;
  public waveNumber: number = 1;
  public enemiesKilled: number = 0;
  public towersBuiltCount: number = 0;

  // Wave Lifecycle
  public isWaveInProgress: boolean = false;
  public waveCountdown: number = 5.0; // Auto-start countdown between waves
  public waveSpawnQueue: { type: EnemyType; delay: number }[] = [];
  public currentSpawnTimer: number = 0;

  // Simulation Controls
  public speedMultiplier: number = 1.0;
  public isPaused: boolean = false;
  public isGameOver: boolean = false;
  public lastTimestamp: number = 0;

  // Interaction & UI State
  public selectedBuildType: TowerType | null = null;
  public selectedTower: Tower | null = null;
  public mouseGridX: number = -1;
  public mouseGridY: number = -1;
  public mousePixelX: number = 0;
  public mousePixelY: number = 0;
  public isMouseInsideCanvas: boolean = false;

  // DOM Elements Cache
  private elGold!: HTMLElement;
  private elHealth!: HTMLElement;
  private elWave!: HTMLElement;
  private elScore!: HTMLElement;
  private elWaveStatus!: HTMLElement;
  private elWaveCountdown!: HTMLElement;
  private elWaveProgress!: HTMLElement;
  private elInspectorPanel!: HTMLElement;
  private elInspectorCoords!: HTMLElement;
  private elInspectorName!: HTMLElement;
  private elInspectorType!: HTMLElement;
  private elInspectorLevel!: HTMLElement;
  private elInspectorDamage!: HTMLElement;
  private elInspectorRange!: HTMLElement;
  private elInspectorRate!: HTMLElement;
  private elInspectorTotalDmg!: HTMLElement;
  private elUpgradeCost!: HTMLElement;
  private elSellRefund!: HTMLElement;
  private elBtnUpgrade!: HTMLButtonElement;
  private elModalOverlay!: HTMLElement;
  private elModalTitle!: HTMLElement;
  private elModalDesc!: HTMLElement;
  private elModalWaves!: HTMLElement;
  private elModalScore!: HTMLElement;
  private elModalKills!: HTMLElement;
  private elModalTowers!: HTMLElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Could not obtain Canvas 2D Rendering Context');
    this.ctx = context;

    this.sound = new SoundFX();

    this.initPathWaypoints();
    this.cacheDOMElements();
    this.updateHUD();
  }

  /**
   * Initializes tactical path waypoints and marks grid track collisions.
   */
  private initPathWaypoints(): void {
    // Tactical serpentine track through grid coordinates (grid unit x, y)
    const gridNodes: Point[] = [
      { x: 0, y: 3 },
      { x: 5, y: 3 },
      { x: 5, y: 9 },
      { x: 10, y: 9 },
      { x: 10, y: 2 },
      { x: 15, y: 2 },
      { x: 15, y: 8 },
      { x: 20, y: 8 }, // Exit portal
    ];

    // Convert to pixel coordinates (centered in cells)
    this.pathWaypoints = gridNodes.map((n) => ({
      x: n.x * this.cellWidth + (n.x === 0 ? 0 : n.x === this.cols ? this.cellWidth : this.cellWidth / 2),
      y: n.y * this.cellHeight + this.cellHeight / 2,
    }));

    // Rasterize track path cells into collision set to block building directly on road
    this.pathOccupiedCells.clear();
    for (let i = 0; i < gridNodes.length - 1; i++) {
      const p1 = gridNodes[i];
      const p2 = gridNodes[i + 1];

      const startX = Math.min(p1.x, p2.x);
      const endX = Math.max(p1.x, p2.x);
      const startY = Math.min(p1.y, p2.y);
      const endY = Math.max(p1.y, p2.y);

      for (let gx = startX; gx <= endX; gx++) {
        for (let gy = startY; gy <= endY; gy++) {
          if (gx >= 0 && gx < this.cols && gy >= 0 && gy < this.rows) {
            this.pathOccupiedCells.add(`${gx},${gy}`);
          }
        }
      }
    }
  }

  /**
   * Cache DOM elements once on startup to eliminate DOM lookups inside hot game loops
   */
  private cacheDOMElements(): void {
    this.elGold = document.getElementById('hud-gold')!;
    this.elHealth = document.getElementById('hud-health')!;
    this.elWave = document.getElementById('hud-wave')!;
    this.elScore = document.getElementById('hud-score')!;
    this.elWaveStatus = document.getElementById('hud-wave-status')!;
    this.elWaveCountdown = document.getElementById('hud-wave-countdown')!;
    this.elWaveProgress = document.getElementById('hud-wave-progress')!;

    this.elInspectorPanel = document.getElementById('inspector-panel')!;
    this.elInspectorCoords = document.getElementById('inspector-coords')!;
    this.elInspectorName = document.getElementById('inspector-name')!;
    this.elInspectorType = document.getElementById('inspector-type')!;
    this.elInspectorLevel = document.getElementById('inspector-level')!;
    this.elInspectorDamage = document.getElementById('inspector-damage')!;
    this.elInspectorRange = document.getElementById('inspector-range')!;
    this.elInspectorRate = document.getElementById('inspector-rate')!;
    this.elInspectorTotalDmg = document.getElementById('inspector-total-dmg')!;
    this.elUpgradeCost = document.getElementById('upgrade-cost')!;
    this.elSellRefund = document.getElementById('sell-refund')!;
    this.elBtnUpgrade = document.getElementById('btn-upgrade-tower') as HTMLButtonElement;

    this.elModalOverlay = document.getElementById('modal-overlay')!;
    this.elModalTitle = document.getElementById('modal-title')!;
    this.elModalDesc = document.getElementById('modal-desc')!;
    this.elModalWaves = document.getElementById('modal-waves')!;
    this.elModalScore = document.getElementById('modal-score')!;
    this.elModalKills = document.getElementById('modal-kills')!;
    this.elModalTowers = document.getElementById('modal-towers')!;
  }

  /**
   * Check whether a grid tile is legal to build on
   */
  public isTileBuildable(gridX: number, gridY: number): boolean {
    if (gridX < 0 || gridX >= this.cols || gridY < 0 || gridY >= this.rows) {
      return false;
    }
    // Blocked if on the enemy path track
    if (this.pathOccupiedCells.has(`${gridX},${gridY}`)) {
      return false;
    }
    // Blocked if a tower already occupies this tile
    const hasTower = this.towers.some((t) => t.gridX === gridX && t.gridY === gridY);
    if (hasTower) {
      return false;
    }
    return true;
  }

  /**
   * Find tower occupying specific grid cell
   */
  public getTowerAt(gridX: number, gridY: number): Tower | null {
    return this.towers.find((t) => t.gridX === gridX && t.gridY === gridY) || null;
  }

  /**
   * Attempt to construct tower at current hover position
   */
  public buildTowerAtHover(): boolean {
    if (!this.selectedBuildType) return false;
    if (!this.isTileBuildable(this.mouseGridX, this.mouseGridY)) return false;

    const cost = TOWER_CONFIGS[this.selectedBuildType].baseCost;
    if (this.gold < cost) {
      this.addFloatingText(this.mousePixelX, this.mousePixelY - 15, 'INSUFFICIENT CREDITS', '#f43f5e');
      return false;
    }

    // Deduct gold and place tower
    this.gold -= cost;
    const newTower = new Tower(
      this.selectedBuildType,
      this.mouseGridX,
      this.mouseGridY,
      this.cellWidth,
      this.cellHeight
    );
    this.towers.push(newTower);
    this.towersBuiltCount++;
    this.selectTower(newTower);

    // Audio & Particle flair
    this.sound.playBuild();
    this.spawnPlacementSparks(newTower.x, newTower.y, TOWER_CONFIGS[this.selectedBuildType].accentColor);
    this.addFloatingText(newTower.x, newTower.y - 20, `-${cost} ⬢`, '#fbbf24');

    this.updateHUD();
    return true;
  }

  public selectTower(tower: Tower | null): void {
    this.selectedTower = tower;
    this.updateInspectorUI();
  }

  public upgradeSelectedTower(): void {
    if (!this.selectedTower) return;
    const cost = this.selectedTower.getUpgradeCost();
    if (this.gold < cost) {
      this.addFloatingText(this.selectedTower.x, this.selectedTower.y - 15, 'NOT ENOUGH CREDITS', '#f43f5e');
      return;
    }

    if (this.selectedTower.upgrade()) {
      this.gold -= cost;
      this.sound.playUpgrade();
      this.spawnPlacementSparks(this.selectedTower.x, this.selectedTower.y, '#10b981');
      this.addFloatingText(this.selectedTower.x, this.selectedTower.y - 24, `UPGRADED! -${cost}⬢`, '#34d399');
      this.updateHUD();
      this.updateInspectorUI();
    }
  }

  public sellSelectedTower(): void {
    if (!this.selectedTower) return;
    const refund = this.selectedTower.getSellRefund();
    this.gold += refund;

    const index = this.towers.indexOf(this.selectedTower);
    if (index !== -1) {
      this.towers.splice(index, 1);
    }

    this.sound.playBuild();
    this.addFloatingText(this.selectedTower.x, this.selectedTower.y - 20, `+${refund} ⬢`, '#fbbf24');
    this.selectTower(null);
    this.updateHUD();
  }

  public setTargetingMode(mode: TargetingMode): void {
    if (!this.selectedTower) return;
    this.selectedTower.targetingMode = mode;
    this.updateInspectorUI();
  }

  /**
   * Multi-Wave procedural generation infrastructure.
   * Enemy Health = Base * (Wave Number ^ 1.2)
   */
  public generateWave(waveNum: number): { type: EnemyType; delay: number }[] {
    const queue: { type: EnemyType; delay: number }[] = [];

    // Boss Dreadnought every 5 waves
    if (waveNum % 5 === 0) {
      queue.push({ type: 'boss', delay: 0.5 });
      for (let i = 0; i < 6 + waveNum; i++) {
        queue.push({ type: 'scout', delay: 0.6 });
      }
      for (let i = 0; i < 3 + Math.floor(waveNum / 2); i++) {
        queue.push({ type: 'swarmer', delay: 1.0 });
      }
      return queue;
    }

    // Dynamic wave composition
    const scoutCount = 6 + Math.floor(waveNum * 1.8);
    const goliathCount = Math.floor(waveNum * 0.9);
    const swarmerCount = 2 + Math.floor(waveNum * 0.7);

    // Interleave threats for tactical pacing
    for (let i = 0; i < scoutCount; i++) {
      queue.push({ type: 'scout', delay: Math.max(0.4, 1.2 - waveNum * 0.05) });
      if (i % 3 === 0 && goliathCount > 0) {
        queue.push({ type: 'goliath', delay: 1.4 });
      }
      if (i % 2 === 0 && swarmerCount > 0) {
        queue.push({ type: 'swarmer', delay: 0.9 });
      }
    }

    return queue;
  }

  /**
   * Triggers or forces next wave deployment
   */
  public startNextWave(isForcedEarly: boolean = false): void {
    if (this.isWaveInProgress) return;

    if (isForcedEarly && this.waveCountdown > 0) {
      // Early wave start bonus rewards tactical play
      const earlyBonus = Math.round(this.waveCountdown * 6);
      if (earlyBonus > 0) {
        this.gold += earlyBonus;
        this.score += earlyBonus * 10;
        this.addFloatingText(120, 40, `EARLY CALL BONUS +${earlyBonus} ⬢`, '#fbbf24');
      }
    }

    this.isWaveInProgress = true;
    this.waveSpawnQueue = this.generateWave(this.waveNumber);
    this.currentSpawnTimer = 0.2;
    this.sound.playWaveStart();
    this.updateHUD();
  }

  /**
   * Spawns an enemy into the battlefield
   */
  public spawnEnemy(type: EnemyType, startWaypointIndex: number = 0, offset: Point = { x: 0, y: 0 }): Enemy {
    // Systematic scaling: Enemy Health = Base * (Wave Number ^ 1.2)
    const waveMultiplier = Math.pow(this.waveNumber, 1.2);
    const enemy = new Enemy(type, this.pathWaypoints, waveMultiplier, startWaypointIndex, offset);
    this.enemies.push(enemy);
    return enemy;
  }

  /**
   * Handles projectile and beam impacts
   */
  public handleImpact(impact: ProjectileImpact): void {
    if (impact.splashRadius > 0) {
      // Plasma Mortar Area of Effect (AoE) blast
      this.sound.playExplosion();
      this.shockwaves.push({
        x: impact.x,
        y: impact.y,
        radius: 4,
        maxRadius: impact.splashRadius,
        color: '#fbbf24',
        alpha: 1.0,
      });

      this.spawnExplosionSparks(impact.x, impact.y, '#f59e0b', 24);

      // Damage all enemies within blast radius
      const radiusSq = impact.splashRadius * impact.splashRadius;
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        if (e.isDead || e.reachedEnd) continue;

        const dx = e.x - impact.x;
        const dy = e.y - impact.y;
        const distSq = dx * dx + dy * dy;

        if (distSq <= radiusSq) {
          const falloff = 1 - Math.sqrt(distSq) / impact.splashRadius;
          const dmg = Math.round(impact.damage * (0.5 + falloff * 0.5));
          this.applyDamageToEnemy(e, dmg, '#f59e0b');
        }
      }
    } else {
      // Single target direct impact
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        if (e.isDead || e.reachedEnd) continue;

        const dx = e.x - impact.x;
        const dy = e.y - impact.y;
        if (dx * dx + dy * dy <= (e.radius + 6) * (e.radius + 6)) {
          if (impact.effect === 'slow' && impact.effectFactor && impact.effectDuration) {
            e.applySlow(impact.effectFactor, impact.effectDuration);
            this.sound.playFrostHum();
            this.applyDamageToEnemy(e, impact.damage, '#c084fc');
          } else {
            this.sound.playLaser();
            this.applyDamageToEnemy(e, impact.damage, '#22d3ee');
          }
          break;
        }
      }
    }
  }

  private applyDamageToEnemy(enemy: Enemy, rawDamage: number, textColor: string = '#f1f5f9'): void {
    const { actualDamage, isFatal } = enemy.takeDamage(rawDamage);

    // Floating damage numbers text fading out
    this.addFloatingText(
      enemy.x + (Math.random() * 16 - 8),
      enemy.y - enemy.radius - 4,
      `-${Math.round(actualDamage)}`,
      textColor
    );

    if (isFatal) {
      this.handleEnemyDefeat(enemy);
    }
  }

  private handleEnemyDefeat(enemy: Enemy): void {
    this.gold += enemy.reward;
    this.score += enemy.scoreValue;
    this.enemiesKilled++;

    // Floating reward count
    this.addFloatingText(enemy.x, enemy.y - 12, `+${enemy.reward} ⬢`, '#fbbf24');

    // Death explosion particles
    this.spawnExplosionSparks(enemy.x, enemy.y, enemy.color, 16);

    // Swarmer rupture mechanic: spawns 3 mini-swarmers on rupture!
    if (enemy.canRupture) {
      this.sound.playExplosion();
      this.addFloatingText(enemy.x, enemy.y - 25, 'RUPTURED!', '#eab308');

      for (let i = 0; i < 3; i++) {
        const angle = (i * Math.PI * 2) / 3;
        const offset = {
          x: Math.cos(angle) * 12,
          y: Math.sin(angle) * 12,
        };
        this.spawnEnemy('mini-swarmer', enemy.currentWaypointIndex, offset);
      }
    }

    this.updateHUD();
  }

  private handleEnemyLeak(enemy: Enemy): void {
    const damage = enemy.type === 'boss' ? 5 : enemy.type === 'goliath' ? 3 : 1;
    this.baseHealth -= damage;
    this.sound.playBaseHit();

    this.addFloatingText(this.canvas.width - 40, this.canvas.height / 2, `-${damage} HP`, '#f43f5e');

    // Camera shake effect on hit
    this.triggerScreenShake();

    if (this.baseHealth <= 0) {
      this.baseHealth = 0;
      this.triggerGameOver();
    }

    this.updateHUD();
  }

  public triggerGameOver(): void {
    this.isGameOver = true;
    this.isPaused = true;

    this.elModalTitle.textContent = 'CORE BREACHED';
    this.elModalTitle.className = 'modal-title defeat';
    this.elModalDesc.textContent =
      'Hostile forces overwhelmed the defense perimeter. Defense grid terminal failure.';
    this.elModalWaves.textContent = this.waveNumber.toString();
    this.elModalScore.textContent = this.score.toString();
    this.elModalKills.textContent = this.enemiesKilled.toString();
    this.elModalTowers.textContent = this.towers.length.toString();
    this.elModalOverlay.classList.add('active');
  }

  public restart(): void {
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.shockwaves = [];
    this.floatingTexts = [];

    this.gold = 450;
    this.baseHealth = 20;
    this.score = 0;
    this.waveNumber = 1;
    this.enemiesKilled = 0;
    this.towersBuiltCount = 0;

    this.isWaveInProgress = false;
    this.waveCountdown = 5.0;
    this.waveSpawnQueue = [];
    this.isGameOver = false;
    this.isPaused = false;
    this.speedMultiplier = 1.0;

    this.selectTower(null);
    this.elModalOverlay.classList.remove('active');
    this.updateHUD();
  }

  /**
   * Screen shake visual impact
   */
  private shakeTimer: number = 0;
  private triggerScreenShake(): void {
    this.shakeTimer = 0.25;
  }

  // -------------------------------------------------------------
  // Particle & Visual FX Subsystems
  // -------------------------------------------------------------
  public addFloatingText(x: number, y: number, text: string, color: string): void {
    this.floatingTexts.push({
      id: Math.random().toString(36).substring(2, 7),
      x,
      y,
      text,
      color,
      alpha: 1.0,
      lifespan: 0.85,
      age: 0,
      vy: -35,
    });
  }

  public spawnExplosionSparks(x: number, y: number, color: string, count: number = 18): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 120;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 1.5 + Math.random() * 2.5,
        color,
        alpha: 1.0,
        decay: 1.8 + Math.random() * 1.5,
        glow: true,
      });
    }
  }

  public spawnPlacementSparks(x: number, y: number, color: string): void {
    for (let i = 0; i < 14; i++) {
      const angle = (i * Math.PI * 2) / 14;
      const speed = 60 + Math.random() * 30;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 2,
        color,
        alpha: 1.0,
        decay: 2.2,
      });
    }
  }

  // -------------------------------------------------------------
  // Primary Game Tick Loop
  // -------------------------------------------------------------
  public update(rawDt: number): void {
    if (this.isPaused || this.isGameOver) return;

    // Apply simulation speed multiplier
    const dt = Math.min(rawDt, 0.1) * this.speedMultiplier;

    if (this.shakeTimer > 0) {
      this.shakeTimer -= rawDt;
    }

    // 1. Process Wave Spawner
    if (this.isWaveInProgress) {
      if (this.waveSpawnQueue.length > 0) {
        this.currentSpawnTimer -= dt;
        if (this.currentSpawnTimer <= 0) {
          const nextSpawn = this.waveSpawnQueue.shift()!;
          this.spawnEnemy(nextSpawn.type);
          this.currentSpawnTimer = nextSpawn.delay;
        }
      } else if (this.enemies.length === 0) {
        // Wave fully cleared!
        this.isWaveInProgress = false;
        this.waveNumber++;
        this.waveCountdown = 5.0; // Rest countdown before next wave

        // Wave clear bonus
        const waveBonus = 40 + this.waveNumber * 10;
        this.gold += waveBonus;
        this.score += waveBonus * 5;
        this.addFloatingText(this.canvas.width / 2, 80, `WAVE CLEARED! +${waveBonus} ⬢`, '#10b981');
        this.updateHUD();
      }
    } else {
      // Countdown to auto-start next wave
      this.waveCountdown -= dt;
      if (this.waveCountdown <= 0) {
        this.startNextWave(false);
      }
    }

    // 2. Update Towers (Aiming logic, fire timers, vector projectiles)
    for (let i = 0; i < this.towers.length; i++) {
      const tower = this.towers[i];
      tower.update(
        dt,
        this.enemies,
        (projectile: Projectile) => {
          this.projectiles.push(projectile);
          if (tower.type === 'mortar') {
            this.sound.playMortarFire();
          } else if (tower.type === 'gatling') {
            this.sound.playLaser();
          }
        },
        (beamImpact: ProjectileImpact) => {
          this.handleImpact(beamImpact);
          tower.totalDamageDealt += beamImpact.damage;
        }
      );
    }

    // 3. Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const impact = p.update(dt);
      if (impact) {
        this.handleImpact(impact);
      }
      if (p.isTerminated) {
        this.projectiles.splice(i, 1);
      }
    }

    // 4. Update Enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.update(dt);

      if (enemy.reachedEnd) {
        this.handleEnemyLeak(enemy);
        this.enemies.splice(i, 1);
      } else if (enemy.isDead) {
        this.enemies.splice(i, 1);
      }
    }

    // 5. Update Shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += 180 * dt;
      sw.alpha -= 2.2 * dt;
      if (sw.alpha <= 0 || sw.radius >= sw.maxRadius) {
        this.shockwaves.splice(i, 1);
      }
    }

    // 6. Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha -= p.decay * dt;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // 7. Update Floating Combat Text
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.age += dt;
      ft.y += ft.vy * dt;
      ft.alpha = Math.max(0, 1 - ft.age / ft.lifespan);
      if (ft.age >= ft.lifespan) {
        this.floatingTexts.splice(i, 1);
      }
    }

    // Update real-time HUD metrics
    this.updateRealtimeHUD();
  }

  // -------------------------------------------------------------
  // Rendering Layer
  // -------------------------------------------------------------
  public render(): void {
    const { ctx, canvas } = this;

    ctx.save();

    // Screen shake transform
    if (this.shakeTimer > 0) {
      const mag = this.shakeTimer * 10;
      const ox = (Math.random() - 0.5) * mag;
      const oy = (Math.random() - 0.5) * mag;
      ctx.translate(ox, oy);
    }

    // Single Canvas layer clear
    ctx.fillStyle = '#070d19';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 1. Draw Sci-Fi Tactical Grid & Road Path
    this.drawGridBackground(ctx);
    this.drawPath(ctx);

    // 2. Draw Towers
    for (let i = 0; i < this.towers.length; i++) {
      const tower = this.towers[i];
      tower.draw(ctx, tower === this.selectedTower);
    }

    // 3. Draw Enemies
    for (let i = 0; i < this.enemies.length; i++) {
      this.enemies[i].draw(ctx);
    }

    // 4. Draw Projectiles
    for (let i = 0; i < this.projectiles.length; i++) {
      this.projectiles[i].draw(ctx);
    }

    // 5. Draw Shockwaves
    for (let i = 0; i < this.shockwaves.length; i++) {
      const sw = this.shockwaves[i];
      ctx.save();
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.strokeStyle = sw.color;
      ctx.globalAlpha = Math.max(0, sw.alpha);
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }

    // 6. Draw Particles
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.alpha);
      if (p.glow) {
        ctx.shadowBlur = 6;
        ctx.shadowColor = p.color;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 7. Draw Floating Combat Text
    for (let i = 0; i < this.floatingTexts.length; i++) {
      const ft = this.floatingTexts[i];
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.fillStyle = ft.color;
      ctx.font = '700 13px ui-monospace, SFMono-Regular, monospace';
      ctx.textAlign = 'center';
      ctx.shadowBlur = 4;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    // 8. Holographic Placement Preview Circle tracking cursor
    this.drawHolographicPlacementPreview(ctx);

    ctx.restore();
  }

  /**
   * Draws tactical background cyber grid
   */
  private drawGridBackground(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.45)';
    ctx.lineWidth = 1;

    for (let x = 0; x <= this.canvas.width; x += this.cellWidth) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.canvas.height);
      ctx.stroke();
    }

    for (let y = 0; y <= this.canvas.height; y += this.cellHeight) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.canvas.width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Draws cybernetic road track, glowing arrows, and entrance/exit portals
   */
  private drawPath(ctx: CanvasRenderingContext2D): void {
    if (this.pathWaypoints.length < 2) return;

    ctx.save();

    // Road outer glow border
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.12)';
    ctx.lineWidth = 36;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(this.pathWaypoints[0].x, this.pathWaypoints[0].y);
    for (let i = 1; i < this.pathWaypoints.length; i++) {
      ctx.lineTo(this.pathWaypoints[i].x, this.pathWaypoints[i].y);
    }
    ctx.stroke();

    // Road surface
    ctx.strokeStyle = '#0d1527';
    ctx.lineWidth = 30;
    ctx.stroke();

    // Road neon center guideline
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 12]);
    // Animate dash offset smoothly along travel direction
    ctx.lineDashOffset = -(Date.now() * 0.02) % 20;
    ctx.stroke();

    ctx.restore();

    // Spawn Portal (Warp In Gate)
    const pStart = this.pathWaypoints[0];
    ctx.save();
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#06b6d4';
    ctx.fillStyle = '#06b6d4';
    ctx.fillRect(0, pStart.y - 20, 10, 40);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 9px monospace';
    ctx.fillText('ENTRY', 14, pStart.y + 3);
    ctx.restore();

    // Core Base Generator (Exit Fortress)
    const pEnd = this.pathWaypoints[this.pathWaypoints.length - 1];
    ctx.save();
    ctx.shadowBlur = 16;
    ctx.shadowColor = '#f43f5e';
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(pEnd.x - 8, pEnd.y - 22, 12, 44);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 9px monospace';
    ctx.fillText('CORE', pEnd.x - 42, pEnd.y + 3);
    ctx.restore();
  }

  /**
   * Interactive Placement UI: Holographic range preview circle tracking cursor
   */
  private drawHolographicPlacementPreview(ctx: CanvasRenderingContext2D): void {
    if (!this.selectedBuildType || !this.isMouseInsideCanvas) return;

    const isValid = this.isTileBuildable(this.mouseGridX, this.mouseGridY);
    const cfg = TOWER_CONFIGS[this.selectedBuildType];
    const hasEnoughGold = this.gold >= cfg.baseCost;
    const canBuild = isValid && hasEnoughGold;

    const centerX = this.mouseGridX * this.cellWidth + this.cellWidth / 2;
    const centerY = this.mouseGridY * this.cellHeight + this.cellHeight / 2;

    ctx.save();

    // Grid Snap Box
    ctx.fillStyle = canBuild ? 'rgba(6, 182, 212, 0.2)' : 'rgba(244, 63, 94, 0.25)';
    ctx.fillRect(
      this.mouseGridX * this.cellWidth,
      this.mouseGridY * this.cellHeight,
      this.cellWidth,
      this.cellHeight
    );
    ctx.strokeStyle = canBuild ? '#06b6d4' : '#f43f5e';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(
      this.mouseGridX * this.cellWidth,
      this.mouseGridY * this.cellHeight,
      this.cellWidth,
      this.cellHeight
    );

    // Range Boundary Radius Circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, cfg.baseRange, 0, Math.PI * 2);
    ctx.fillStyle = canBuild ? 'rgba(6, 182, 212, 0.08)' : 'rgba(244, 63, 94, 0.06)';
    ctx.fill();
    ctx.strokeStyle = canBuild ? '#22d3ee' : '#f43f5e';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.stroke();

    // Ghost turret silhouette
    ctx.fillStyle = canBuild ? 'rgba(34, 211, 238, 0.6)' : 'rgba(244, 63, 94, 0.6)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 14, 0, Math.PI * 2);
    ctx.fill();

    // Status warning text if blocked
    if (!canBuild) {
      ctx.fillStyle = '#f43f5e';
      ctx.font = '700 10px monospace';
      ctx.textAlign = 'center';
      const reason = !isValid ? 'BLOCKED TILE' : 'CREDITS LOW';
      ctx.fillText(reason, centerX, centerY + 28);
    }

    ctx.restore();
  }

  // -------------------------------------------------------------
  // UI & HUD Synchronizers
  // -------------------------------------------------------------
  public updateHUD(): void {
    this.elGold.textContent = this.gold.toString();
    this.elHealth.textContent = `${this.baseHealth}/${this.maxBaseHealth}`;
    this.elWave.textContent = this.waveNumber.toString();
    this.elScore.textContent = this.score.toString();

    // Update tower purchase card affordances
    const types: TowerType[] = ['gatling', 'mortar', 'frost'];
    types.forEach((type) => {
      const card = document.getElementById(`card-tower-${type}`);
      if (card) {
        const cost = TOWER_CONFIGS[type].baseCost;
        if (this.gold < cost) {
          card.classList.add('disabled');
        } else {
          card.classList.remove('disabled');
        }
      }
    });

    this.updateInspectorUI();
  }

  private updateRealtimeHUD(): void {
    if (this.isWaveInProgress) {
      this.elWaveStatus.textContent = `WAVE ${this.waveNumber} COMBAT ACTIVE`;
      const enemiesRemaining = this.enemies.length + this.waveSpawnQueue.length;
      this.elWaveCountdown.textContent = `${enemiesRemaining} TARGETS`;
      this.elWaveProgress.style.width = '100%';
    } else {
      this.elWaveStatus.textContent = `WAVE ${this.waveNumber} PREPARING`;
      const timeStr = Math.max(0, this.waveCountdown).toFixed(1);
      this.elWaveCountdown.textContent = `${timeStr}s`;
      const pct = Math.min(100, Math.max(0, (1 - this.waveCountdown / 5.0) * 100));
      this.elWaveProgress.style.width = `${pct}%`;
    }
  }

  public updateInspectorUI(): void {
    if (!this.selectedTower) {
      this.elInspectorPanel.style.display = 'none';
      return;
    }

    this.elInspectorPanel.style.display = 'block';
    const t = this.selectedTower;
    const cfg = TOWER_CONFIGS[t.type];

    this.elInspectorCoords.textContent = `(${t.gridX}, ${t.gridY})`;
    this.elInspectorName.textContent = cfg.name;
    this.elInspectorType.textContent =
      t.type === 'gatling' ? 'Ultra-Rapid Laser' : t.type === 'mortar' ? 'Heavy Ballistic AoE' : 'Cryogenic Slow Beam';
    this.elInspectorLevel.textContent = `LVL ${t.level}${t.level >= t.maxLevel ? ' (MAX)' : ''}`;
    this.elInspectorDamage.textContent = t.damage.toString();
    this.elInspectorRange.textContent = t.range.toString();
    this.elInspectorRate.textContent = `${(1 / t.fireInterval).toFixed(1)} /s`;
    this.elInspectorTotalDmg.textContent = Math.round(t.totalDamageDealt).toString();

    // Update targeting pills
    const pills = document.querySelectorAll('.target-pill');
    pills.forEach((p) => {
      const mode = p.getAttribute('data-mode');
      if (mode === t.targetingMode) {
        p.classList.add('active');
      } else {
        p.classList.remove('active');
      }
    });

    // Upgrade button
    if (t.level >= t.maxLevel) {
      this.elBtnUpgrade.disabled = true;
      this.elUpgradeCost.textContent = 'MAX LEVEL';
    } else {
      const upCost = t.getUpgradeCost();
      this.elBtnUpgrade.disabled = this.gold < upCost;
      this.elUpgradeCost.textContent = `${upCost} ⬢`;
    }

    // Sell button
    this.elSellRefund.textContent = `+${t.getSellRefund()} ⬢`;
  }
}
