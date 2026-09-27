/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Enemy, EnemyType, Point } from '../entities/Enemy';
import { DamageType, FloatingText, FloatingTextSystem } from '../entities/FloatingText';
import { Hazard, HAZARD_CONFIGS, HazardType } from '../entities/Hazards';
import { Projectile, ProjectileImpact } from '../entities/Projectile';
import { TargetingMode, Tower, TOWER_CONFIGS, TowerType, TowerBranch } from '../entities/Tower';
import { SoundFX } from './SoundFX';

export { FloatingText };
export type { DamageType };

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

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: number;
}

export type MapSector = 'alpha' | 'beta' | 'gamma';
export type CommanderAbility = 'emp' | 'orbital' | 'overdrive';
export type GameMode = 'campaign' | 'endless' | 'boss_rush' | 'sandbox';
export type WeatherType = 'clear' | 'storm' | 'nebula' | 'solar' | 'cryo';

export interface TechNode {
  id: string;
  name: string;
  description: string;
  icon: string;
  maxRank: number;
  costPerRank: number;
  statBonusPerRank: string;
}

export const TECH_TREE_NODES: TechNode[] = [
  {
    id: 'tungsten_munitions',
    name: 'Tungsten Munitions',
    description: 'High-density accelerated kinetic penetrators.',
    icon: '⚡',
    maxRank: 3,
    costPerRank: 2,
    statBonusPerRank: '+15% Gatling & Railgun Damage',
  },
  {
    id: 'plasma_condenser',
    name: 'Plasma Condenser',
    description: 'Increases mortar shell superheated core yield.',
    icon: '💥',
    maxRank: 3,
    costPerRank: 2,
    statBonusPerRank: '+18% Mortar Splash & Damage',
  },
  {
    id: 'cryo_amplification',
    name: 'Cryo Supercooler',
    description: 'Deep freeze thermal conductivity amplification.',
    icon: '❄️',
    maxRank: 3,
    costPerRank: 2,
    statBonusPerRank: '+15% Frost Slow & Combo Yield',
  },
  {
    id: 'tesla_superconductors',
    name: 'Flux Superconductors',
    description: 'Zero-resistance electrical discharge emitters.',
    icon: '🌩️',
    maxRank: 3,
    costPerRank: 2,
    statBonusPerRank: '+1 Chain Target & +15% Tesla Damage',
  },
  {
    id: 'pyro_catalyst',
    name: 'Napalm Accelerants',
    description: 'Chemical additives sustaining hotter combustion.',
    icon: '🔥',
    maxRank: 3,
    costPerRank: 2,
    statBonusPerRank: '+20% Incinerator & Trap Burn DPS',
  },
  {
    id: 'titanium_bulkheads',
    name: 'Titanium Bulkheads',
    description: 'Reinforces Core Fortress blast shielding.',
    icon: '🛡️',
    maxRank: 3,
    costPerRank: 1,
    statBonusPerRank: '+5 Base Health Integrity',
  },
  {
    id: 'war_chest',
    name: 'War Chest Reserve',
    description: 'Pre-allocates starting strategic energy credits.',
    icon: '💰',
    maxRank: 3,
    costPerRank: 1,
    statBonusPerRank: '+100 Starting Energy Credits',
  },
  {
    id: 'flux_capacitors',
    name: 'Orbital Uplink Flux',
    description: 'Overclocks Commander Superweapon recharge capacitors.',
    icon: '🚀',
    maxRank: 3,
    costPerRank: 2,
    statBonusPerRank: '-15% Superweapon Cooldowns',
  },
];

const STORAGE_KEY_ACHIEVEMENTS = 'vector_vanguard_achievements_v1';
const STORAGE_KEY_TECH = 'vector_vanguard_tech_v1';

export class Game {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;

  public readonly cols: number = 20;
  public readonly rows: number = 13;
  public readonly cellWidth: number = 50;
  public readonly cellHeight: number = 50;

  // Game Mode & Sector
  public gameMode: GameMode = 'campaign';
  public currentSector: MapSector = 'alpha';
  public pathWaypoints: Point[] = [];
  public pathOccupiedCells: Set<string> = new Set();
  public clearedSectors: Set<MapSector> = new Set();

  // Environmental Weather
  public weather: WeatherType = 'clear';
  public weatherParticles: { x: number; y: number; speed: number; size: number; alpha: number }[] = [];
  public weatherFlashTimer: number = 0;

  // Entities
  public towers: Tower[] = [];
  public enemies: Enemy[] = [];
  public projectiles: Projectile[] = [];
  public hazards: Hazard[] = [];
  public particles: Particle[] = [];
  public shockwaves: Shockwave[] = [];
  public floatingTextSystem: FloatingTextSystem = new FloatingTextSystem();
  public get floatingTexts(): FloatingText[] {
    return this.floatingTextSystem.entities;
  }
  public set floatingTexts(val: FloatingText[]) {
    this.floatingTextSystem.entities = val;
  }

  // Audio system
  public sound: SoundFX;

  // Economy & Core State
  public gold: number = 480;
  public baseHealth: number = 20;
  public maxBaseHealth: number = 20;
  public score: number = 0;
  public waveNumber: number = 1;
  public enemiesKilled: number = 0;
  public towersBuiltCount: number = 0;

  // Telemetry Analytics & Combat Counters
  public totalDamageDealt: number = 0;
  public damageByTower: Record<TowerType, number> = {
    gatling: 0,
    mortar: 0,
    frost: 0,
    tesla: 0,
    incinerator: 0,
  };
  public damageByType: Record<DamageType, number> = {
    laser: 0,
    plasma: 0,
    frost: 0,
    tesla: 0,
    fire: 0,
    shield: 0,
    critical: 0,
    emp: 0,
    orbital: 0,
    reward: 0,
    leak: 0,
    combo: 0,
    hazard: 0,
    info: 0,
  };
  public combosTriggered: number = 0;
  public hazardsTriggered: number = 0;

  // Wave Lifecycle
  public isWaveInProgress: boolean = false;
  public waveCountdown: number = 5.0;
  public waveSpawnQueue: { type: EnemyType; delay: number }[] = [];
  public currentSpawnTimer: number = 0;

  // Simulation Controls
  public speedMultiplier: number = 1.0;
  public isPaused: boolean = false;
  public isGameOver: boolean = false;
  public showAllRanges: boolean = false;

  // Commander Superweapon Abilities
  public activeAbilityTarget: CommanderAbility | null = null;
  public empCooldown: number = 0;
  public empMaxCooldown: number = 22.0;
  public orbitalCooldown: number = 0;
  public orbitalMaxCooldown: number = 32.0;
  public overdriveCooldown: number = 0;
  public overdriveMaxCooldown: number = 26.0;
  public overdriveActiveTimer: number = 0;

  // Interaction State
  public selectedBuildType: TowerType | null = null;
  public selectedBuildTrap: HazardType | null = null;
  public selectedTower: Tower | null = null;
  public mouseGridX: number = -1;
  public mouseGridY: number = -1;
  public mousePixelX: number = 0;
  public mousePixelY: number = 0;
  public isMouseInsideCanvas: boolean = false;

  // Screen shake
  private shakeTimer: number = 0;

  // Persistent Research Tech Tree
  public techPoints: number = 0;
  public techRanks: Record<string, number> = {};

  // Achievements Registry
  public achievements: Achievement[] = [
    {
      id: 'first_blood',
      title: 'First Blood',
      description: 'Neutralize your first hostile threat on the battlefield.',
      icon: '⚔️',
      unlocked: false,
    },
    {
      id: 'kills_100',
      title: 'Centurion',
      description: 'Neutralize 100 enemy hostiles.',
      icon: '🎯',
      unlocked: false,
    },
    {
      id: 'kills_500',
      title: 'Vanguard Ace',
      description: 'Neutralize 500 enemy hostiles in combat.',
      icon: '🎖️',
      unlocked: false,
    },
    {
      id: 'no_core_damage_5',
      title: 'Flawless Defense',
      description: 'Complete Wave 5 without sustaining any Core damage.',
      icon: '🛡️',
      unlocked: false,
    },
    {
      id: 'no_core_damage_10',
      title: 'Impenetrable Fortress',
      description: 'Complete Wave 10 without sustaining any Core damage.',
      icon: '🏰',
      unlocked: false,
    },
    {
      id: 'towers_10',
      title: 'Master Engineer',
      description: 'Construct 10 or more defensive towers on the grid.',
      icon: '⚙️',
      unlocked: false,
    },
    {
      id: 'max_upgrade',
      title: 'Peak Overclock',
      description: 'Fully upgrade any tower to Level 4 Branch Specialization.',
      icon: '⭐',
      unlocked: false,
    },
    {
      id: 'war_chest',
      title: 'War Chest',
      description: 'Accumulate 1,000 Energy Credits in your treasury.',
      icon: '💰',
      unlocked: false,
    },
    {
      id: 'superweapon_used',
      title: 'Doomsday Protocol',
      description: 'Deploy any Commander Superweapon (EMP, Orbital, Overdrive).',
      icon: '⚡',
      unlocked: false,
    },
    {
      id: 'boss_slayer',
      title: 'Apex Predator',
      description: 'Neutralize an Apex Dreadnought boss flagship.',
      icon: '👑',
      unlocked: false,
    },
    {
      id: 'tesla_chain',
      title: 'High Voltage',
      description: 'Strike 3 or more enemies with a single Tesla chain discharge.',
      icon: '🌩️',
      unlocked: false,
    },
    {
      id: 'sector_explorer',
      title: 'Sector Dominance',
      description: 'Deploy defense grids and clear waves in multiple sectors.',
      icon: '🌐',
      unlocked: false,
    },
    {
      id: 'elemental_combo',
      title: 'Chemical Reaction',
      description: 'Trigger an Elemental Combo (Thermal Shock, Superconductor, Plasma Flare).',
      icon: '🧪',
      unlocked: false,
    },
    {
      id: 'trap_master',
      title: 'Minefield Architect',
      description: 'Successfully detonate 5 battlefield deployable traps or mines.',
      icon: '💣',
      unlocked: false,
    },
  ];

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

  // Ability Buttons & Cooldowns
  private elBtnEmp!: HTMLElement;
  private elBtnOrbital!: HTMLElement;
  private elBtnOverdrive!: HTMLElement;

  // Achievement Elements
  private elAchievementToastContainer!: HTMLElement | null;
  private elAchievementsModal!: HTMLElement | null;
  private elAchievementsList!: HTMLElement | null;
  private elAchievementsCount!: HTMLElement | null;
  private elAchievementsCompletionLabel!: HTMLElement | null;
  private elAchievementsProgressFill!: HTMLElement | null;

  // Level 4 Branch Elements
  private elBranchContainer!: HTMLElement | null;
  private elBtnBranchA!: HTMLButtonElement | null;
  private elBtnBranchB!: HTMLButtonElement | null;
  private elBranchAName!: HTMLElement | null;
  private elBranchADesc!: HTMLElement | null;
  private elBranchACost!: HTMLElement | null;
  private elBranchBName!: HTMLElement | null;
  private elBranchBDesc!: HTMLElement | null;
  private elBranchBCost!: HTMLElement | null;

  // Weather & Radar Elements
  private elWeatherBadge!: HTMLElement | null;
  private elThreatRadar!: HTMLElement | null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Could not obtain Canvas 2D Context');
    this.ctx = context;

    this.sound = new SoundFX();
    this.cacheDOMElements();
    this.loadAchievements();
    this.loadTechTree();
    this.initWeatherParticles();
    this.initPathForSector('alpha');
    this.applyTechPassives();
    this.updateHUD();
  }

  // -------------------------------------------------------------
  // Persistent Tech Tree & Research
  // -------------------------------------------------------------
  private loadTechTree(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TECH);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.techPoints = parsed.techPoints || 0;
        this.techRanks = parsed.techRanks || {};
      } else {
        this.techPoints = 3; // Free starting starter points for exploration
      }
    } catch {
      this.techPoints = 3;
    }
  }

  public saveTechTree(): void {
    try {
      localStorage.setItem(
        STORAGE_KEY_TECH,
        JSON.stringify({
          techPoints: this.techPoints,
          techRanks: this.techRanks,
        })
      );
    } catch {}
  }

  public getTechRank(id: string): number {
    return this.techRanks[id] || 0;
  }

  public unlockTech(id: string): boolean {
    const node = TECH_TREE_NODES.find((n) => n.id === id);
    if (!node) return false;
    const currentRank = this.getTechRank(id);
    if (currentRank >= node.maxRank) return false;
    if (this.techPoints < node.costPerRank) {
      this.addFloatingText(this.canvas.width / 2, 80, 'NOT ENOUGH TECH POINTS', '#f43f5e');
      return false;
    }

    this.techPoints -= node.costPerRank;
    this.techRanks[id] = currentRank + 1;
    this.saveTechTree();
    this.applyTechPassives();
    this.sound.playTechUnlock();
    this.addFloatingText(this.canvas.width / 2, 80, `RESEARCH UNLOCKED: ${node.name}`, '#facc15');
    this.renderTechTreeModal();
    return true;
  }

  public resetTechTree(): void {
    let refund = 0;
    for (const node of TECH_TREE_NODES) {
      const rank = this.getTechRank(node.id);
      refund += rank * node.costPerRank;
    }
    this.techPoints += refund;
    this.techRanks = {};
    this.saveTechTree();
    this.applyTechPassives();
    this.sound.playTechUnlock();
    this.renderTechTreeModal();
  }

  public applyTechPassives(): void {
    // Health bonus
    const hpBonus = this.getTechRank('titanium_bulkheads') * 5;
    this.maxBaseHealth = 20 + hpBonus;
    if (this.baseHealth > this.maxBaseHealth) this.baseHealth = this.maxBaseHealth;

    // Superweapon cooldown reduction
    const fluxBonus = this.getTechRank('flux_capacitors') * 0.15;
    this.empMaxCooldown = Math.max(10, 22.0 * (1 - fluxBonus));
    this.orbitalMaxCooldown = Math.max(15, 32.0 * (1 - fluxBonus));
    this.overdriveMaxCooldown = Math.max(12, 26.0 * (1 - fluxBonus));

    // Update existing towers with tech ranks
    this.towers.forEach((t) => this.applyTechToTower(t));
  }

  private applyTechToTower(t: Tower): void {
    if (t.type === 'gatling') {
      const dmgBonus = 1 + this.getTechRank('tungsten_munitions') * 0.15;
      t.damage = Math.round(TOWER_CONFIGS.gatling.baseDamage * (1 + (t.level - 1) * 0.35) * dmgBonus);
    } else if (t.type === 'mortar') {
      const boost = 1 + this.getTechRank('plasma_condenser') * 0.18;
      t.damage = Math.round(TOWER_CONFIGS.mortar.baseDamage * (1 + (t.level - 1) * 0.35) * boost);
    } else if (t.type === 'frost') {
      const slowBoost = 1 + this.getTechRank('cryo_amplification') * 0.15;
      t.slowFactor = Math.max(0.2, (TOWER_CONFIGS.frost.slowFactor ?? 0.5) / slowBoost);
    } else if (t.type === 'tesla') {
      const tRank = this.getTechRank('tesla_superconductors');
      t.maxChainTargets = (TOWER_CONFIGS.tesla.maxChainTargets ?? 3) + tRank;
    } else if (t.type === 'incinerator') {
      const pRank = this.getTechRank('pyro_catalyst');
      t.burnDps = Math.round((TOWER_CONFIGS.incinerator.burnDps ?? 22) * (1 + pRank * 0.2));
    }
  }

  // -------------------------------------------------------------
  // Environmental Weather System
  // -------------------------------------------------------------
  private initWeatherParticles(): void {
    this.weatherParticles = [];
    for (let i = 0; i < 45; i++) {
      this.weatherParticles.push({
        x: Math.random() * 1000,
        y: Math.random() * 650,
        speed: 20 + Math.random() * 60,
        size: 1 + Math.random() * 3,
        alpha: 0.2 + Math.random() * 0.6,
      });
    }
  }

  public setWeather(weather: WeatherType): void {
    this.weather = weather;
    this.initWeatherParticles();
    this.updateWeatherUI();
    if (weather === 'storm') {
      this.sound.playThunderclap();
    }
  }

  public advanceWeather(): void {
    const weathers: WeatherType[] = ['clear', 'storm', 'nebula', 'solar', 'cryo'];
    const nextIdx = (weathers.indexOf(this.weather) + 1) % weathers.length;
    this.setWeather(weathers[nextIdx]);
  }

  private updateWeatherUI(): void {
    if (!this.elWeatherBadge) {
      this.elWeatherBadge = document.getElementById('hud-weather-badge');
    }
    if (!this.elWeatherBadge) return;

    switch (this.weather) {
      case 'clear':
        this.elWeatherBadge.innerHTML = `<span class="icon">☀️</span><span>ATMOSPHERE: CLEAR</span>`;
        this.elWeatherBadge.className = 'weather-pill weather-clear';
        break;
      case 'storm':
        this.elWeatherBadge.innerHTML = `<span class="icon">⚡</span><span>EM STORM (+30% Tesla Dmg)</span>`;
        this.elWeatherBadge.className = 'weather-pill weather-storm';
        break;
      case 'nebula':
        this.elWeatherBadge.innerHTML = `<span class="icon">🌫️</span><span>NEBULA FOG (15% Enemy Evasion)</span>`;
        this.elWeatherBadge.className = 'weather-pill weather-nebula';
        break;
      case 'solar':
        this.elWeatherBadge.innerHTML = `<span class="icon">🔥</span><span>SOLAR FLARE (+35% Fire/Plasma)</span>`;
        this.elWeatherBadge.className = 'weather-pill weather-solar';
        break;
      case 'cryo':
        this.elWeatherBadge.innerHTML = `<span class="icon">❄️</span><span>CRYO FRONT (+25% Freeze Duration)</span>`;
        this.elWeatherBadge.className = 'weather-pill weather-cryo';
        break;
    }
  }

  // -------------------------------------------------------------
  // Persistent Achievements Store
  // -------------------------------------------------------------
  private loadAchievements(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_ACHIEVEMENTS);
      if (stored) {
        const parsed: Record<string, { unlocked: boolean; unlockedAt?: number }> = JSON.parse(stored);
        this.achievements.forEach((ach) => {
          if (parsed[ach.id]?.unlocked) {
            ach.unlocked = true;
            ach.unlockedAt = parsed[ach.id].unlockedAt;
          }
        });
      }
    } catch {}
  }

  private saveAchievements(): void {
    try {
      const data: Record<string, { unlocked: boolean; unlockedAt?: number }> = {};
      this.achievements.forEach((ach) => {
        data[ach.id] = { unlocked: ach.unlocked, unlockedAt: ach.unlockedAt };
      });
      localStorage.setItem(STORAGE_KEY_ACHIEVEMENTS, JSON.stringify(data));
    } catch {}
  }

  public unlockAchievement(id: string): void {
    const ach = this.achievements.find((a) => a.id === id);
    if (!ach || ach.unlocked) return;

    ach.unlocked = true;
    ach.unlockedAt = Date.now();
    this.saveAchievements();

    // Reward Core Tech Point
    this.techPoints += 1;
    this.saveTechTree();

    this.showAchievementToast(ach);
    this.sound.playAchievement();
    this.updateAchievementsUI();
  }

  public showAchievementToast(ach: Achievement): void {
    if (!this.elAchievementToastContainer) {
      this.elAchievementToastContainer = document.getElementById('achievement-toast-container');
    }
    if (!this.elAchievementToastContainer) return;

    const toast = document.createElement('div');
    toast.className = 'achievement-toast animate-in';
    toast.innerHTML = `
      <div class="achievement-toast-icon">${ach.icon}</div>
      <div class="achievement-toast-content">
        <span class="achievement-toast-badge">COMMENDATION UNLOCKED (+1 ⭐)</span>
        <div class="achievement-toast-title">${ach.title}</div>
        <div class="achievement-toast-desc">${ach.description}</div>
      </div>
    `;

    this.elAchievementToastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.remove('animate-in');
      toast.classList.add('animate-out');
      setTimeout(() => {
        toast.remove();
      }, 500);
    }, 4500);
  }

  public updateAchievementsUI(): void {
    const unlockedCount = this.achievements.filter((a) => a.unlocked).length;
    const totalCount = this.achievements.length;
    const percentage = Math.round((unlockedCount / totalCount) * 100);

    if (this.elAchievementsCount) {
      this.elAchievementsCount.textContent = `${unlockedCount}/${totalCount}`;
    }

    if (this.elAchievementsCompletionLabel) {
      this.elAchievementsCompletionLabel.textContent = `${unlockedCount} of ${totalCount} Unlocked (${percentage}%)`;
    }

    if (this.elAchievementsProgressFill) {
      this.elAchievementsProgressFill.style.width = `${percentage}%`;
    }

    if (this.elAchievementsList && this.elAchievementsModal?.classList.contains('active')) {
      this.renderAchievementsList();
    }
  }

  public renderAchievementsList(): void {
    if (!this.elAchievementsList) return;

    this.elAchievementsList.innerHTML = this.achievements
      .map((ach) => {
        const dateStr = ach.unlockedAt
          ? new Date(ach.unlockedAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })
          : '';

        return `
        <div class="achievement-row ${ach.unlocked ? 'unlocked' : 'locked'}">
          <div class="achievement-row-icon">${ach.icon}</div>
          <div class="achievement-row-info">
            <div class="achievement-row-title">${ach.title}</div>
            <div class="achievement-row-desc">${ach.description}</div>
          </div>
          <div class="achievement-row-status ${ach.unlocked ? 'badge-unlocked' : 'badge-locked'}">
            ${ach.unlocked ? `UNLOCKED ${dateStr}` : 'LOCKED'}
          </div>
        </div>
      `;
      })
      .join('');
  }

  public openAchievementsModal(): void {
    if (!this.elAchievementsModal) {
      this.elAchievementsModal = document.getElementById('achievements-modal');
    }
    if (this.elAchievementsModal) {
      this.renderAchievementsList();
      this.elAchievementsModal.classList.add('active');
    }
  }

  public closeAchievementsModal(): void {
    if (this.elAchievementsModal) {
      this.elAchievementsModal.classList.remove('active');
    }
  }

  public toggleAchievementsModal(): void {
    if (this.elAchievementsModal?.classList.contains('active')) {
      this.closeAchievementsModal();
    } else {
      this.openAchievementsModal();
    }
  }

  // -------------------------------------------------------------
  // Tech Tree Modal
  // -------------------------------------------------------------
  public openTechTreeModal(): void {
    const modal = document.getElementById('tech-modal');
    if (modal) {
      this.renderTechTreeModal();
      modal.classList.add('active');
    }
  }

  public closeTechTreeModal(): void {
    const modal = document.getElementById('tech-modal');
    if (modal) modal.classList.remove('active');
  }

  public toggleTechTreeModal(): void {
    const modal = document.getElementById('tech-modal');
    if (modal?.classList.contains('active')) this.closeTechTreeModal();
    else this.openTechTreeModal();
  }

  public renderTechTreeModal(): void {
    const pointsEl = document.getElementById('tech-points-count');
    if (pointsEl) pointsEl.textContent = this.techPoints.toString();

    const listEl = document.getElementById('tech-nodes-list');
    if (!listEl) return;

    listEl.innerHTML = TECH_TREE_NODES.map((node) => {
      const rank = this.getTechRank(node.id);
      const isMax = rank >= node.maxRank;
      const canAfford = this.techPoints >= node.costPerRank;

      return `
        <div class="tech-card ${isMax ? 'maxed' : ''}">
          <div class="tech-card-header">
            <span class="tech-icon">${node.icon}</span>
            <div>
              <div class="tech-name">${node.name}</div>
              <div class="tech-stat">${node.statBonusPerRank}</div>
            </div>
            <span class="tech-rank-badge">RANK ${rank}/${node.maxRank}</span>
          </div>
          <div class="tech-desc">${node.description}</div>
          <div class="tech-card-actions">
            <button class="btn-tech-upgrade ${isMax ? 'disabled' : !canAfford ? 'unaffordable' : ''}"
                    data-tech="${node.id}"
                    ${isMax ? 'disabled' : ''}>
              ${isMax ? 'MAXED' : `UPGRADE (${node.costPerRank} ⭐)`}
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Bind upgrade buttons
    const btns = listEl.querySelectorAll('.btn-tech-upgrade');
    btns.forEach((b) => {
      b.addEventListener('click', () => {
        const id = b.getAttribute('data-tech');
        if (id) this.unlockTech(id);
      });
    });
  }

  // -------------------------------------------------------------
  // After-Action Tactical Debrief Modal
  // -------------------------------------------------------------
  public openDebriefModal(): void {
    const modal = document.getElementById('debrief-modal');
    if (!modal) return;

    this.renderDebriefModal();
    modal.classList.add('active');
  }

  public closeDebriefModal(): void {
    const modal = document.getElementById('debrief-modal');
    if (modal) modal.classList.remove('active');
  }

  public toggleDebriefModal(): void {
    const modal = document.getElementById('debrief-modal');
    if (modal?.classList.contains('active')) this.closeDebriefModal();
    else this.openDebriefModal();
  }

  public renderDebriefModal(): void {
    const totalDmg = Math.max(1, this.totalDamageDealt);

    // MVP Tower
    let mvp: Tower | null = null;
    let maxDmg = 0;
    for (const t of this.towers) {
      if (t.totalDamageDealt > maxDmg) {
        maxDmg = t.totalDamageDealt;
        mvp = t;
      }
    }

    const mvpEl = document.getElementById('debrief-mvp-card');
    if (mvpEl) {
      if (mvp) {
        const name = mvp.branchName ? `${mvp.branchName} [${mvp.branch}]` : TOWER_CONFIGS[mvp.type].name;
        mvpEl.innerHTML = `
          <div class="mvp-badge">🎖️ MVP TACTICAL UNIT</div>
          <div class="mvp-title">${name} (LVL ${mvp.level})</div>
          <div class="mvp-stats">
            <span>TOTAL DAMAGE: <b>${Math.round(mvp.totalDamageDealt)}</b></span> •
            <span>GRID: <b>(${mvp.gridX}, ${mvp.gridY})</b></span> •
            <span>KILLS: <b>${mvp.killCount}</b></span>
          </div>
        `;
      } else {
        mvpEl.innerHTML = `<div style="color:#94a3b8; font-size:0.85rem;">No active towers deployed in this operation.</div>`;
      }
    }

    // Performance Rank
    const leaks = 20 - this.baseHealth;
    let rank = 'S';
    let rankClass = 'rank-s';
    if (this.baseHealth <= 0) {
      rank = 'F';
      rankClass = 'rank-f';
    } else if (leaks === 0) {
      rank = 'S+';
      rankClass = 'rank-s';
    } else if (leaks <= 3) {
      rank = 'A';
      rankClass = 'rank-a';
    } else if (leaks <= 8) {
      rank = 'B';
      rankClass = 'rank-b';
    } else {
      rank = 'C';
      rankClass = 'rank-c';
    }

    const rankEl = document.getElementById('debrief-rank');
    if (rankEl) {
      rankEl.textContent = rank;
      rankEl.className = `debrief-rank-badge ${rankClass}`;
    }

    const totalDmgEl = document.getElementById('debrief-total-damage');
    if (totalDmgEl) totalDmgEl.textContent = Math.round(totalDmg).toLocaleString();

    const combosEl = document.getElementById('debrief-combos-count');
    if (combosEl) combosEl.textContent = this.combosTriggered.toString();

    const hazardsEl = document.getElementById('debrief-hazards-count');
    if (hazardsEl) hazardsEl.textContent = this.hazardsTriggered.toString();

    // Tower contribution meters
    const towerTypes: TowerType[] = ['gatling', 'mortar', 'frost', 'tesla', 'incinerator'];
    towerTypes.forEach((tType) => {
      const dmg = this.damageByTower[tType] || 0;
      const pct = Math.round((dmg / totalDmg) * 100);
      const fillEl = document.getElementById(`debrief-bar-${tType}`);
      const valEl = document.getElementById(`debrief-val-${tType}`);
      if (fillEl) fillEl.style.width = `${pct}%`;
      if (valEl) valEl.textContent = `${pct}% (${Math.round(dmg).toLocaleString()})`;
    });
  }

  // -------------------------------------------------------------
  // Interactive Enemy Codex Modal
  // -------------------------------------------------------------
  public openCodexModal(initialEnemy: EnemyType = 'scout'): void {
    const modal = document.getElementById('codex-modal');
    if (modal) {
      this.renderCodexEnemy(initialEnemy);
      modal.classList.add('active');
    }
  }

  public closeCodexModal(): void {
    const modal = document.getElementById('codex-modal');
    if (modal) modal.classList.remove('active');
  }

  public toggleCodexModal(): void {
    const modal = document.getElementById('codex-modal');
    if (modal?.classList.contains('active')) this.closeCodexModal();
    else this.openCodexModal();
  }

  public renderCodexEnemy(type: EnemyType): void {
    const dummy = new Enemy(type, [{ x: 50, y: 50 }, { x: 100, y: 50 }], 1.0);
    const canvas = document.getElementById('codex-preview-canvas') as HTMLCanvasElement;
    if (canvas) {
      const cctx = canvas.getContext('2d');
      if (cctx) {
        cctx.clearRect(0, 0, canvas.width, canvas.height);
        cctx.save();
        cctx.translate(canvas.width / 2, canvas.height / 2);
        dummy.x = 0;
        dummy.y = 0;
        dummy.angle = Math.PI / 4;
        dummy.draw(cctx);
        cctx.restore();
      }
    }

    const intelMap: Record<EnemyType, { name: string; desc: string; counters: string; traits: string }> = {
      scout: {
        name: 'Scout Runner',
        desc: 'Light reconnaissance strike craft with ultra-high evasion velocity.',
        counters: 'Gatling Laser, Laser Tripwires, Frost Beam.',
        traits: 'High Speed (135 px/s), Light Hull, Swarm Formations.',
      },
      goliath: {
        name: 'Goliath Hex-Tank',
        desc: 'Heavily armored juggernaut carrying composite reactive hull plating.',
        counters: 'Sniper Railguns, Thermal Incinerators, Concussion Mines.',
        traits: '35% Base Armor Mitigation, Colossal Health, Slow Velocity.',
      },
      swarmer: {
        name: 'Swarmer Rupture Carrier',
        desc: 'Biological biomechanical seedpod unit containing volatile sub-units.',
        counters: 'Plasma Mortar (AoE), Tesla Coil, Cryo Landmines.',
        traits: 'Ruptures on destruction into 3 high-speed mini-swarmers.',
      },
      'mini-swarmer': {
        name: 'Mini-Swarmer',
        desc: 'Agile cluster unit released from ruptured Swarmer chassis.',
        counters: 'Tesla Arcs, Frost Beam, Ground Napalm Puddles.',
        traits: 'Rapid rushers, low health.',
      },
      infiltrator: {
        name: 'Stealth Infiltrator',
        desc: 'Covert strike runner equipped with optical active camouflage cloaking.',
        counters: 'EMP Disruptor (Tesla Branch B), EMP Blast, Thermal Shock.',
        traits: 'Cloaks periodically. Takes 30% reduced damage while veiled.',
      },
      shielded: {
        name: 'Shielded Cruiser',
        desc: 'Frontline vanguard cruiser projecting a recharging kinetic forward shield.',
        counters: 'Pulse Beam (Gatling Branch B), EMP Disruptor, Orbital Strike.',
        traits: 'Recharging energy barrier absorbing incoming kinetic rounds.',
      },
      boss: {
        name: 'Apex Dreadnought Flagship',
        desc: 'Command fortress dreadnought appearing at wave milestones with heavy escorts.',
        counters: 'Concentrated Railguns, Commander Superweapons, Hellfire Meltdown.',
        traits: 'Massive Hull & Energy Shielding, High Core Breach damage (5 HP).',
      },
    };

    const intel = intelMap[type];
    const nameEl = document.getElementById('codex-enemy-name');
    if (nameEl) nameEl.textContent = intel.name;

    const hpEl = document.getElementById('codex-stat-hp');
    if (hpEl) hpEl.textContent = dummy.maxHealth.toString();

    const spdEl = document.getElementById('codex-stat-speed');
    if (spdEl) spdEl.textContent = `${dummy.baseSpeed} px/s`;

    const armEl = document.getElementById('codex-stat-armor');
    if (armEl) armEl.textContent = `${Math.round(dummy.armor * 100)}%`;

    const shdEl = document.getElementById('codex-stat-shield');
    if (shdEl) shdEl.textContent = dummy.maxShield.toString();

    const descEl = document.getElementById('codex-enemy-desc');
    if (descEl) descEl.textContent = intel.desc;

    const traitsEl = document.getElementById('codex-enemy-traits');
    if (traitsEl) traitsEl.textContent = intel.traits;

    const countersEl = document.getElementById('codex-enemy-counters');
    if (countersEl) countersEl.textContent = intel.counters;

    // Highlight active list item
    const items = document.querySelectorAll('.codex-nav-item');
    items.forEach((it) => {
      if (it.getAttribute('data-enemy') === type) it.classList.add('active');
      else it.classList.remove('active');
    });
  }

  // -------------------------------------------------------------
  // Map Sector Setup
  // -------------------------------------------------------------
  public initPathForSector(sector: MapSector): void {
    this.currentSector = sector;
    let gridNodes: Point[] = [];

    switch (sector) {
      case 'alpha':
        gridNodes = [
          { x: 0, y: 3 },
          { x: 5, y: 3 },
          { x: 5, y: 9 },
          { x: 10, y: 9 },
          { x: 10, y: 2 },
          { x: 15, y: 2 },
          { x: 15, y: 8 },
          { x: 20, y: 8 },
        ];
        break;

      case 'beta':
        gridNodes = [
          { x: 0, y: 1 },
          { x: 17, y: 1 },
          { x: 17, y: 5 },
          { x: 3, y: 5 },
          { x: 3, y: 10 },
          { x: 20, y: 10 },
        ];
        break;

      case 'gamma':
        gridNodes = [
          { x: 0, y: 11 },
          { x: 18, y: 11 },
          { x: 18, y: 2 },
          { x: 2, y: 2 },
          { x: 2, y: 8 },
          { x: 14, y: 8 },
          { x: 14, y: 5 },
          { x: 9, y: 5 },
          { x: 9, y: 6 },
        ];
        break;
    }

    this.pathWaypoints = gridNodes.map((n) => ({
      x: n.x * this.cellWidth + (n.x === 0 ? 0 : n.x >= this.cols ? this.cellWidth : this.cellWidth / 2),
      y: n.y * this.cellHeight + (n.y === 0 ? 0 : n.y >= this.rows ? this.cellHeight : this.cellHeight / 2),
    }));

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

  public setSector(sector: MapSector): void {
    if (this.currentSector === sector) return;
    this.initPathForSector(sector);
    this.restart();
  }

  public setGameMode(mode: GameMode): void {
    this.gameMode = mode;
    this.restart();
  }

  // -------------------------------------------------------------
  // DOM Cache
  // -------------------------------------------------------------
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

    // Dual-Branch Upgrade Elements
    this.elBranchContainer = document.getElementById('branch-choice-container');
    this.elBtnBranchA = document.getElementById('btn-branch-a') as HTMLButtonElement;
    this.elBtnBranchB = document.getElementById('btn-branch-b') as HTMLButtonElement;
    this.elBranchAName = document.getElementById('branch-a-name');
    this.elBranchADesc = document.getElementById('branch-a-desc');
    this.elBranchACost = document.getElementById('branch-a-cost');
    this.elBranchBName = document.getElementById('branch-b-name');
    this.elBranchBDesc = document.getElementById('branch-b-desc');
    this.elBranchBCost = document.getElementById('branch-b-cost');

    this.elModalOverlay = document.getElementById('modal-overlay')!;
    this.elModalTitle = document.getElementById('modal-title')!;
    this.elModalDesc = document.getElementById('modal-desc')!;
    this.elModalWaves = document.getElementById('modal-waves')!;
    this.elModalScore = document.getElementById('modal-score')!;
    this.elModalKills = document.getElementById('modal-kills')!;
    this.elModalTowers = document.getElementById('modal-towers')!;

    this.elBtnEmp = document.getElementById('btn-ability-emp')!;
    this.elBtnOrbital = document.getElementById('btn-ability-orbital')!;
    this.elBtnOverdrive = document.getElementById('btn-ability-overdrive')!;

    this.elAchievementToastContainer = document.getElementById('achievement-toast-container');
    this.elAchievementsModal = document.getElementById('achievements-modal');
    this.elAchievementsList = document.getElementById('achievements-list');
    this.elAchievementsCount = document.getElementById('hud-achievements-count');
    this.elAchievementsCompletionLabel = document.getElementById('achievements-completion-label');
    this.elAchievementsProgressFill = document.getElementById('achievements-progress-fill');

    this.elWeatherBadge = document.getElementById('hud-weather-badge');
    this.elThreatRadar = document.getElementById('hud-threat-radar');
  }

  // -------------------------------------------------------------
  // Grid, Building & Traps
  // -------------------------------------------------------------
  public isTileBuildable(gridX: number, gridY: number): boolean {
    if (gridX < 0 || gridX >= this.cols || gridY < 0 || gridY >= this.rows) return false;
    if (this.pathOccupiedCells.has(`${gridX},${gridY}`)) return false;
    return !this.towers.some((t) => t.gridX === gridX && t.gridY === gridY);
  }

  public isRoadTile(gridX: number, gridY: number): boolean {
    return this.pathOccupiedCells.has(`${gridX},${gridY}`);
  }

  public getTowerAt(gridX: number, gridY: number): Tower | null {
    return this.towers.find((t) => t.gridX === gridX && t.gridY === gridY) || null;
  }

  public buildTowerAtHover(): boolean {
    if (!this.selectedBuildType) return false;
    if (!this.isTileBuildable(this.mouseGridX, this.mouseGridY)) return false;

    const cost = TOWER_CONFIGS[this.selectedBuildType].baseCost;
    if (this.gold < cost) {
      this.addFloatingText(this.mousePixelX, this.mousePixelY - 15, 'INSUFFICIENT CREDITS', '#f43f5e');
      return false;
    }

    this.gold -= cost;
    const newTower = new Tower(
      this.selectedBuildType,
      this.mouseGridX,
      this.mouseGridY,
      this.cellWidth,
      this.cellHeight
    );

    this.applyTechToTower(newTower);
    this.towers.push(newTower);
    this.towersBuiltCount++;
    this.selectTower(newTower);

    this.sound.playBuild();
    this.spawnPlacementSparks(newTower.x, newTower.y, TOWER_CONFIGS[this.selectedBuildType].accentColor);
    this.addFloatingText(newTower.x, newTower.y - 20, `-${cost} ⬢`, '#fbbf24');

    if (this.towers.length >= 10) {
      this.unlockAchievement('towers_10');
    }

    this.updateHUD();
    return true;
  }

  public buildTrapAtHover(): boolean {
    if (!this.selectedBuildTrap) return false;
    if (!this.isRoadTile(this.mouseGridX, this.mouseGridY)) {
      this.addFloatingText(this.mousePixelX, this.mousePixelY - 15, 'MUST PLACE ON ROAD TILE', '#f43f5e');
      return false;
    }

    const cfg = HAZARD_CONFIGS[this.selectedBuildTrap as 'tripwire' | 'cryo_mine' | 'concussion_mine'];
    if (!cfg) return false;

    if (this.gold < cfg.cost) {
      this.addFloatingText(this.mousePixelX, this.mousePixelY - 15, 'INSUFFICIENT CREDITS', '#f43f5e');
      return false;
    }

    // Check if cell already has an active trap
    const existing = this.hazards.find((h) => h.gridX === this.mouseGridX && h.gridY === this.mouseGridY && !h.isDepleted);
    if (existing) {
      this.addFloatingText(this.mousePixelX, this.mousePixelY - 15, 'TRAP ALREADY DEPLOYED HERE', '#f43f5e');
      return false;
    }

    this.gold -= cfg.cost;
    const hazard = new Hazard(
      this.selectedBuildTrap,
      this.mouseGridX,
      this.mouseGridY,
      this.cellWidth,
      this.cellHeight
    );
    this.hazards.push(hazard);

    this.sound.playTrapDeploy();
    this.spawnPlacementSparks(hazard.x, hazard.y, '#38bdf8');
    this.addFloatingText(hazard.x, hazard.y - 20, `-${cfg.cost} ⬢`, '#fbbf24');
    this.updateHUD();
    return true;
  }

  public selectTower(tower: Tower | null): void {
    this.selectedTower = tower;
    this.updateInspectorUI();
  }

  public upgradeSelectedTowerStandard(): void {
    if (!this.selectedTower) return;
    if (this.selectedTower.level >= 3) return;

    const cost = this.selectedTower.getUpgradeCost();
    if (this.gold < cost) {
      this.addFloatingText(this.selectedTower.x, this.selectedTower.y - 15, 'NOT ENOUGH CREDITS', '#f43f5e');
      return;
    }

    if (this.selectedTower.upgradeStandard()) {
      this.gold -= cost;
      this.applyTechToTower(this.selectedTower);
      this.sound.playUpgrade();
      this.spawnPlacementSparks(this.selectedTower.x, this.selectedTower.y, '#10b981');
      this.addFloatingText(this.selectedTower.x, this.selectedTower.y - 24, `UPGRADED! -${cost}⬢`, '#34d399');
      this.updateHUD();
      this.updateInspectorUI();
    }
  }

  public upgradeSelectedTowerBranch(choice: TowerBranch): void {
    if (!this.selectedTower) return;
    if (this.selectedTower.level !== 3) return;

    const cost = this.selectedTower.getUpgradeCost();
    if (this.gold < cost) {
      this.addFloatingText(this.selectedTower.x, this.selectedTower.y - 15, 'NOT ENOUGH CREDITS', '#f43f5e');
      return;
    }

    if (this.selectedTower.upgradeBranch(choice)) {
      this.gold -= cost;
      this.applyTechToTower(this.selectedTower);
      this.sound.playBranchUpgrade();
      this.spawnExplosionSparks(this.selectedTower.x, this.selectedTower.y, choice === 'A' ? '#f59e0b' : '#38bdf8', 30);
      this.addFloatingText(
        this.selectedTower.x,
        this.selectedTower.y - 28,
        `SPECIALIZED: ${this.selectedTower.branchName.toUpperCase()}!`,
        choice === 'A' ? '#facc15' : '#38bdf8'
      );

      this.unlockAchievement('max_upgrade');
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

  // -------------------------------------------------------------
  // Commander Superweapon Abilities
  // -------------------------------------------------------------
  public triggerAbilityEmp(): void {
    if (this.empCooldown > 0) return;
    this.activeAbilityTarget = 'emp';
  }

  public triggerAbilityOrbital(): void {
    if (this.orbitalCooldown > 0) return;
    this.activeAbilityTarget = 'orbital';
  }

  public triggerAbilityOverdrive(): void {
    if (this.overdriveCooldown > 0) return;
    this.overdriveCooldown = this.overdriveMaxCooldown;
    this.overdriveActiveTimer = 6.0;

    this.towers.forEach((t) => (t.isHypercharged = true));

    this.sound.playHypercharge();
    this.addFloatingText(this.canvas.width / 2, 70, 'COMMANDER OVERDRIVE ACTIVATED! +100% FIRE RATE', '#facc15');
    this.spawnExplosionSparks(this.canvas.width / 2, 60, '#facc15', 30);

    this.unlockAchievement('superweapon_used');
  }

  public executeGroundTargetedAbility(x: number, y: number): void {
    if (!this.activeAbilityTarget) return;

    if (this.activeAbilityTarget === 'emp') {
      this.empCooldown = this.empMaxCooldown;
      this.sound.playEMP();
      this.triggerScreenShake(0.2);

      const empRadius = 140;
      this.shockwaves.push({
        x,
        y,
        radius: 10,
        maxRadius: empRadius,
        color: '#38bdf8',
        alpha: 1.0,
      });

      for (const e of this.enemies) {
        if (e.isDead || e.reachedEnd) continue;
        const dx = e.x - x;
        const dy = e.y - y;
        if (dx * dx + dy * dy <= empRadius * empRadius) {
          e.applyStun(3.5);
          e.currentShield = 0;
          e.isCloaked = false;
          this.applyDamageToEnemy(e, 40, 'emp');
        }
      }

      this.addFloatingText(x, y - 25, '⚡ EMP BURST! STUNNED', '#38bdf8');
      this.spawnExplosionSparks(x, y, '#38bdf8', 25);
      this.unlockAchievement('superweapon_used');
    } else if (this.activeAbilityTarget === 'orbital') {
      this.orbitalCooldown = this.orbitalMaxCooldown;
      this.sound.playOrbitalStrike();
      this.triggerScreenShake(0.45);

      const blastRadius = 110;
      setTimeout(() => {
        this.shockwaves.push({
          x,
          y,
          radius: 15,
          maxRadius: blastRadius,
          color: '#f43f5e',
          alpha: 1.0,
        });

        for (const e of this.enemies) {
          if (e.isDead || e.reachedEnd) continue;
          const dx = e.x - x;
          const dy = e.y - y;
          const distSq = dx * dx + dy * dy;
          if (distSq <= blastRadius * blastRadius) {
            const dist = Math.sqrt(distSq);
            const falloff = 1 - dist / blastRadius;
            const dmg = Math.round(450 * (0.6 + falloff * 0.4));
            this.applyDamageToEnemy(e, dmg, 'orbital', true);
          }
        }

        this.addFloatingText(x, y - 30, '💥 ORBITAL STRIKE -450', '#f43f5e');
        this.spawnExplosionSparks(x, y, '#fb7185', 40);
        this.unlockAchievement('superweapon_used');
      }, 280);
    }

    this.activeAbilityTarget = null;
  }

  // -------------------------------------------------------------
  // Waves & Threat Radar Preview
  // -------------------------------------------------------------
  public getNextWavePreview(waveNum: number): {
    counts: Record<EnemyType, number>;
    hasArmor: boolean;
    hasShields: boolean;
    hasCloak: boolean;
    hasBoss: boolean;
    totalCount: number;
  } {
    const queue = this.generateWave(waveNum);
    const counts: Record<EnemyType, number> = {
      scout: 0,
      goliath: 0,
      swarmer: 0,
      'mini-swarmer': 0,
      infiltrator: 0,
      shielded: 0,
      boss: 0,
    };

    queue.forEach((item) => {
      counts[item.type] = (counts[item.type] || 0) + 1;
    });

    return {
      counts,
      hasArmor: counts.goliath > 0 || counts.boss > 0,
      hasShields: counts.shielded > 0 || counts.boss > 0,
      hasCloak: counts.infiltrator > 0,
      hasBoss: counts.boss > 0,
      totalCount: queue.length,
    };
  }

  public generateWave(waveNum: number): { type: EnemyType; delay: number }[] {
    const queue: { type: EnemyType; delay: number }[] = [];

    // Boss Rush Game Mode
    if (this.gameMode === 'boss_rush') {
      queue.push({ type: 'boss', delay: 0.6 });
      for (let i = 0; i < 2 + waveNum; i++) queue.push({ type: 'goliath', delay: 1.0 });
      for (let i = 0; i < 2 + waveNum; i++) queue.push({ type: 'shielded', delay: 0.9 });
      for (let i = 0; i < 2 + waveNum; i++) queue.push({ type: 'infiltrator', delay: 0.8 });
      return queue;
    }

    // Milestone Boss Wave (Every 5 waves in standard / endless)
    if (waveNum % 5 === 0) {
      queue.push({ type: 'boss', delay: 0.5 });
      for (let i = 0; i < 6 + waveNum; i++) queue.push({ type: 'scout', delay: 0.5 });
      for (let i = 0; i < 3 + Math.floor(waveNum / 2); i++) queue.push({ type: 'shielded', delay: 0.9 });
      for (let i = 0; i < 3 + Math.floor(waveNum / 2); i++) queue.push({ type: 'swarmer', delay: 1.0 });
      return queue;
    }

    const scoutCount = 5 + Math.floor(waveNum * 1.5);
    const goliathCount = Math.floor(waveNum * 0.8);
    const swarmerCount = 2 + Math.floor(waveNum * 0.6);
    const infiltratorCount = waveNum >= 3 ? Math.floor(waveNum * 0.7) : 0;
    const shieldedCount = waveNum >= 4 ? Math.floor(waveNum * 0.6) : 0;

    for (let i = 0; i < scoutCount; i++) {
      queue.push({ type: 'scout', delay: Math.max(0.35, 1.1 - waveNum * 0.04) });
      if (i % 2 === 0 && infiltratorCount > 0) queue.push({ type: 'infiltrator', delay: 0.7 });
      if (i % 3 === 0 && shieldedCount > 0) queue.push({ type: 'shielded', delay: 1.1 });
      if (i % 3 === 0 && goliathCount > 0) queue.push({ type: 'goliath', delay: 1.3 });
      if (i % 2 === 0 && swarmerCount > 0) queue.push({ type: 'swarmer', delay: 0.8 });
    }

    return queue;
  }

  public startNextWave(isForcedEarly: boolean = false): void {
    if (this.isWaveInProgress) return;

    if (isForcedEarly && this.waveCountdown > 0) {
      const earlyBonus = Math.round(this.waveCountdown * 6);
      if (earlyBonus > 0) {
        this.gold += earlyBonus;
        this.score += earlyBonus * 10;
        this.addFloatingText(120, 40, `EARLY CALL BONUS +${earlyBonus} ⬢`, '#fbbf24');
      }
    }

    // Every 4 waves rotate environmental weather
    if (this.waveNumber % 4 === 0) {
      this.advanceWeather();
    }

    this.isWaveInProgress = true;
    this.waveSpawnQueue = this.generateWave(this.waveNumber);
    this.currentSpawnTimer = 0.2;
    this.sound.playWaveStart();
    this.updateHUD();
  }

  public spawnEnemy(type: EnemyType, startWaypointIndex: number = 0, offset: Point = { x: 0, y: 0 }): Enemy {
    const waveMultiplier = Math.pow(this.waveNumber, 1.2);
    const enemy = new Enemy(type, this.pathWaypoints, waveMultiplier, startWaypointIndex, offset);
    this.enemies.push(enemy);
    return enemy;
  }

  public spawnEnemyManually(type: EnemyType): void {
    this.spawnEnemy(type, 0);
    this.sound.playBuild();
    this.addFloatingText(this.pathWaypoints[0].x, this.pathWaypoints[0].y, `SPAWNED: ${type.toUpperCase()}`, '#38bdf8');
  }

  // -------------------------------------------------------------
  // Combat Impact & Elemental Combo Reactions
  // -------------------------------------------------------------
  public handleImpact(impact: ProjectileImpact): void {
    if (impact.splashRadius > 0) {
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

      const radiusSq = impact.splashRadius * impact.splashRadius;
      for (const e of this.enemies) {
        if (e.isDead || e.reachedEnd) continue;
        const dx = e.x - impact.x;
        const dy = e.y - impact.y;
        const distSq = dx * dx + dy * dy;

        if (distSq <= radiusSq) {
          const falloff = 1 - Math.sqrt(distSq) / impact.splashRadius;
          const dmg = Math.round(impact.damage * (0.5 + falloff * 0.5));
          this.applyDamageToEnemy(e, dmg, 'plasma', Math.random() < 0.15, impact.armorPierce);
        }
      }
    } else {
      for (const e of this.enemies) {
        if (e.isDead || e.reachedEnd) continue;
        const dx = e.x - impact.x;
        const dy = e.y - impact.y;
        if (dx * dx + dy * dy <= (e.radius + 6) * (e.radius + 6)) {
          if (impact.effect === 'slow' && impact.effectFactor && impact.effectDuration) {
            e.applySlow(impact.effectFactor, impact.effectDuration);
            this.sound.playFrostHum();
            this.applyDamageToEnemy(e, impact.damage, 'frost', false, impact.armorPierce);
          } else if (impact.effect === 'burn' && impact.effectFactor && impact.effectDuration) {
            e.applyBurn(impact.effectFactor, impact.effectDuration);
            this.sound.playFlame();
            this.applyDamageToEnemy(e, impact.damage, 'fire', false, impact.armorPierce);
          } else {
            this.sound.playLaser();
            this.applyDamageToEnemy(e, impact.damage, 'laser', Math.random() < 0.12, impact.armorPierce);
          }
          break;
        }
      }
    }
  }

  public handleTeslaArc(points: Point[], hitEnemies: Enemy[]): void {
    this.sound.playTeslaLightning();
    for (let i = 0; i < hitEnemies.length; i++) {
      const e = hitEnemies[i];
      const damageMultiplier = Math.pow(0.85, i);
      const dmg = Math.round(65 * damageMultiplier);
      this.applyDamageToEnemy(e, dmg, 'tesla', Math.random() < 0.1);
      this.spawnExplosionSparks(e.x, e.y, '#38bdf8', 6);
    }

    if (hitEnemies.length >= 3) {
      this.unlockAchievement('tesla_chain');
    }
  }

  public spawnNapalmPuddle(x: number, y: number): void {
    const gridX = Math.floor(x / this.cellWidth);
    const gridY = Math.floor(y / this.cellHeight);
    const p = new Hazard('napalm_puddle', gridX, gridY, this.cellWidth, this.cellHeight, 6.5);
    p.x = x;
    p.y = y;
    this.hazards.push(p);
  }

  public spawnClusterBomblets(x: number, y: number, damage: number): void {
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3 + Math.random() * 0.5;
      const dist = 35 + Math.random() * 25;
      const targetPoint: Point = {
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
      };

      setTimeout(() => {
        this.shockwaves.push({
          x: targetPoint.x,
          y: targetPoint.y,
          radius: 2,
          maxRadius: 40,
          color: '#f59e0b',
          alpha: 1.0,
        });
        this.spawnExplosionSparks(targetPoint.x, targetPoint.y, '#fbbf24', 12);

        for (const e of this.enemies) {
          if (e.isDead || e.reachedEnd) continue;
          const dx = e.x - targetPoint.x;
          const dy = e.y - targetPoint.y;
          if (dx * dx + dy * dy <= 40 * 40) {
            this.applyDamageToEnemy(e, damage, 'plasma');
          }
        }
      }, 150 + i * 120);
    }
  }

  public applyDamageToEnemy(
    enemy: Enemy,
    rawDamage: number,
    damageType: DamageType = 'laser',
    isCritical: boolean = false,
    armorPierce: number = 0
  ): void {
    // Environmental Weather Modifiers
    let weatherMult = 1.0;
    if (this.weather === 'solar' && (damageType === 'fire' || damageType === 'plasma')) {
      weatherMult = 1.35;
    } else if (this.weather === 'storm' && damageType === 'tesla') {
      weatherMult = 1.3;
    } else if (this.weather === 'nebula' && Math.random() < 0.15) {
      this.floatingTextSystem.spawnText(enemy.x, enemy.y - enemy.radius - 8, 'EVADED', 'info');
      return;
    }

    let calculatedDamage = Math.round(rawDamage * weatherMult);

    // -------------------------------------------------------------
    // Elemental Combo Reactions
    // -------------------------------------------------------------
    // 1. Thermal Shock: Chilled enemy hit by Fire / Incinerator
    if (enemy.slowEffect && (damageType === 'fire' || damageType === 'hazard')) {
      const comboDmg = Math.round(110 + calculatedDamage * 0.8);
      enemy.applyBrittle(3.5); // Armor reduction
      enemy.slowEffect = null; // Thermal reaction shatters ice

      this.floatingTextSystem.spawnText(enemy.x, enemy.y - enemy.radius - 18, '✦ THERMAL SHOCK!', 'combo');
      this.floatingTextSystem.spawnDamage(enemy.x, enemy.y - enemy.radius - 4, comboDmg, 'combo');
      this.spawnExplosionSparks(enemy.x, enemy.y, '#e879f9', 20);
      this.sound.playComboShock();
      this.combosTriggered++;
      this.unlockAchievement('elemental_combo');

      calculatedDamage += comboDmg;
    }
    // 2. Superconductor: Chilled enemy hit by Tesla Arc
    else if (enemy.slowEffect && damageType === 'tesla') {
      const comboDmg = 75;
      this.floatingTextSystem.spawnText(enemy.x, enemy.y - enemy.radius - 18, '✦ SUPERCONDUCTOR!', 'combo');
      this.floatingTextSystem.spawnDamage(enemy.x, enemy.y - enemy.radius - 4, comboDmg, 'combo');
      this.sound.playComboShock();
      this.combosTriggered++;
      this.unlockAchievement('elemental_combo');

      // Shock adjacent foes
      for (const other of this.enemies) {
        if (other === enemy || other.isDead || other.reachedEnd) continue;
        const dx = other.x - enemy.x;
        const dy = other.y - enemy.y;
        if (dx * dx + dy * dy <= 85 * 85) {
          other.applyStun(0.4);
          this.applyDamageToEnemy(other, comboDmg, 'tesla');
        }
      }
    }
    // 3. Plasma Flare: Burning enemy hit by Plasma Shell
    else if (enemy.burnEffect && damageType === 'plasma') {
      const comboDmg = 90;
      this.floatingTextSystem.spawnText(enemy.x, enemy.y - enemy.radius - 18, '✦ PLASMA FLARE!', 'combo');
      this.floatingTextSystem.spawnDamage(enemy.x, enemy.y - enemy.radius - 4, comboDmg, 'combo');
      this.sound.playExplosion();
      this.combosTriggered++;
      this.unlockAchievement('elemental_combo');
      calculatedDamage += comboDmg;
    }

    const { actualDamage, isFatal, hitShield } = enemy.takeDamage(calculatedDamage, armorPierce);

    this.totalDamageDealt += actualDamage;
    this.damageByType[damageType] = (this.damageByType[damageType] || 0) + actualDamage;

    if (hitShield) {
      this.floatingTextSystem.spawnDamage(enemy.x, enemy.y - enemy.radius - 4, actualDamage, 'shield');
    } else {
      this.floatingTextSystem.spawnDamage(enemy.x, enemy.y - enemy.radius - 4, actualDamage, damageType, isCritical);
    }

    if (isFatal) {
      this.handleEnemyDefeat(enemy);
    }
  }

  private handleEnemyDefeat(enemy: Enemy): void {
    this.gold += enemy.reward;
    this.score += enemy.scoreValue;
    this.enemiesKilled++;

    this.floatingTextSystem.spawnText(enemy.x, enemy.y - 12, `${enemy.reward}`, 'reward');
    this.spawnExplosionSparks(enemy.x, enemy.y, enemy.color, 16);

    this.unlockAchievement('first_blood');
    if (this.enemiesKilled >= 100) {
      this.unlockAchievement('kills_100');
    }
    if (this.enemiesKilled >= 500) {
      this.unlockAchievement('kills_500');
    }
    if (enemy.type === 'boss') {
      this.unlockAchievement('boss_slayer');
    }

    if (enemy.canRupture) {
      this.sound.playExplosion();
      this.floatingTextSystem.spawnText(enemy.x, enemy.y - 25, 'RUPTURED!', 'plasma');

      for (let i = 0; i < 3; i++) {
        const angle = (i * Math.PI * 2) / 3;
        const offset = { x: Math.cos(angle) * 12, y: Math.sin(angle) * 12 };
        this.spawnEnemy('mini-swarmer', enemy.currentWaypointIndex, offset);
      }
    }

    this.updateHUD();
  }

  private handleEnemyLeak(enemy: Enemy): void {
    if (this.gameMode === 'sandbox') return; // Core immune in sandbox mode

    const damage = enemy.type === 'boss' ? 5 : enemy.type === 'goliath' ? 3 : 1;
    this.baseHealth -= damage;
    this.sound.playBaseHit();

    this.floatingTextSystem.spawnText(this.canvas.width - 40, this.canvas.height / 2, `${damage}`, 'leak');
    this.triggerScreenShake(0.3);

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
      'Hostile forces overwhelmed the defense perimeter. Defense grid offline.';
    this.elModalWaves.textContent = this.waveNumber.toString();
    this.elModalScore.textContent = this.score.toString();
    this.elModalKills.textContent = this.enemiesKilled.toString();
    this.elModalTowers.textContent = this.towers.length.toString();
    this.elModalOverlay.classList.add('active');

    // Automatically trigger debrief data
    this.renderDebriefModal();
  }

  public restart(): void {
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    this.hazards = [];
    this.particles = [];
    this.shockwaves = [];
    this.floatingTexts = [];

    // Economy & Base stats
    const warChestBonus = this.getTechRank('war_chest') * 100;
    this.gold = this.gameMode === 'sandbox' ? 99999 : 480 + warChestBonus;
    this.baseHealth = this.gameMode === 'sandbox' ? 999 : this.maxBaseHealth;
    this.score = 0;
    this.waveNumber = 1;
    this.enemiesKilled = 0;
    this.towersBuiltCount = 0;
    this.totalDamageDealt = 0;
    this.combosTriggered = 0;
    this.hazardsTriggered = 0;
    this.damageByTower = { gatling: 0, mortar: 0, frost: 0, tesla: 0, incinerator: 0 };
    this.damageByType = {
      laser: 0,
      plasma: 0,
      frost: 0,
      tesla: 0,
      fire: 0,
      shield: 0,
      critical: 0,
      emp: 0,
      orbital: 0,
      reward: 0,
      leak: 0,
      combo: 0,
      hazard: 0,
      info: 0,
    };

    this.empCooldown = 0;
    this.orbitalCooldown = 0;
    this.overdriveCooldown = 0;
    this.overdriveActiveTimer = 0;
    this.activeAbilityTarget = null;

    this.isWaveInProgress = false;
    this.waveCountdown = 5.0;
    this.waveSpawnQueue = [];
    this.isGameOver = false;
    this.isPaused = false;
    this.speedMultiplier = 1.0;

    this.selectTower(null);
    this.elModalOverlay.classList.remove('active');
    this.setWeather('clear');
    this.updateHUD();
  }

  private triggerScreenShake(duration: number = 0.25): void {
    this.shakeTimer = duration;
  }

  public addFloatingText(x: number, y: number, text: string, color: string): void {
    this.floatingTextSystem.spawnText(x, y, text, 'info', { customColor: color });
  }

  public spawnDamageText(
    x: number,
    y: number,
    amount: number,
    type: DamageType = 'laser',
    isCritical: boolean = false
  ): void {
    this.floatingTextSystem.spawnDamage(x, y, amount, type, isCritical);
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

    const dt = Math.min(rawDt, 0.1) * this.speedMultiplier;

    if (this.shakeTimer > 0) {
      this.shakeTimer -= rawDt;
    }

    // Process Ability Cooldowns
    if (this.empCooldown > 0) this.empCooldown -= dt;
    if (this.orbitalCooldown > 0) this.orbitalCooldown -= dt;
    if (this.overdriveCooldown > 0) this.overdriveCooldown -= dt;

    if (this.overdriveActiveTimer > 0) {
      this.overdriveActiveTimer -= dt;
      if (this.overdriveActiveTimer <= 0) {
        this.towers.forEach((t) => (t.isHypercharged = false));
      }
    }

    // Update Weather Particle Emitters
    for (const wp of this.weatherParticles) {
      wp.y += wp.speed * dt;
      if (this.weather === 'storm' || this.weather === 'nebula') {
        wp.x += (Math.random() - 0.5) * 40 * dt;
      }
      if (wp.y > 650) {
        wp.y = 0;
        wp.x = Math.random() * 1000;
      }
    }

    // Wave Spawner
    if (this.isWaveInProgress) {
      if (this.waveSpawnQueue.length > 0) {
        this.currentSpawnTimer -= dt;
        if (this.currentSpawnTimer <= 0) {
          const nextSpawn = this.waveSpawnQueue.shift()!;
          this.spawnEnemy(nextSpawn.type);
          this.currentSpawnTimer = nextSpawn.delay;
        }
      } else if (this.enemies.length === 0) {
        this.isWaveInProgress = false;

        // Commendations
        if (this.baseHealth === this.maxBaseHealth && this.waveNumber >= 5) {
          this.unlockAchievement('no_core_damage_5');
        }
        if (this.baseHealth === this.maxBaseHealth && this.waveNumber >= 10) {
          this.unlockAchievement('no_core_damage_10');
        }

        this.clearedSectors.add(this.currentSector);
        if (this.clearedSectors.size >= 2) {
          this.unlockAchievement('sector_explorer');
        }

        // Tech Points bounty
        const techGain = this.waveNumber % 5 === 0 ? 3 : 1;
        this.techPoints += techGain;
        this.saveTechTree();

        this.waveNumber++;
        this.waveCountdown = 5.0;

        const waveBonus = 40 + this.waveNumber * 10;
        this.gold += waveBonus;
        this.score += waveBonus * 5;
        this.addFloatingText(this.canvas.width / 2, 80, `WAVE CLEARED! +${waveBonus} ⬢  (+${techGain} ⭐)`, '#10b981');
        this.updateHUD();
      }
    } else {
      this.waveCountdown -= dt;
      if (this.waveCountdown <= 0) {
        this.startNextWave(false);
      }
    }

    // Update Towers
    for (let i = 0; i < this.towers.length; i++) {
      const tower = this.towers[i];
      tower.update(
        dt,
        this.enemies,
        (projectile: Projectile) => {
          this.projectiles.push(projectile);
          if (tower.type === 'mortar') this.sound.playMortarFire();
          else if (tower.type === 'gatling') this.sound.playLaser();
        },
        (directImpact: ProjectileImpact) => {
          this.handleImpact(directImpact);
          tower.totalDamageDealt += directImpact.damage;
          this.damageByTower[tower.type] += directImpact.damage;
        },
        (points: Point[], hitEnemies: Enemy[]) => {
          this.handleTeslaArc(points, hitEnemies);
          const teslaDmg = hitEnemies.length * 65;
          tower.totalDamageDealt += teslaDmg;
          this.damageByTower['tesla'] += teslaDmg;
        },
        (napalmX: number, napalmY: number) => {
          this.spawnNapalmPuddle(napalmX, napalmY);
        },
        (clusterX: number, clusterY: number, clusterDmg: number) => {
          this.spawnClusterBomblets(clusterX, clusterY, clusterDmg);
        }
      );
    }

    // Update Projectiles
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

    // Update Traps & Hazards
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const hazard = this.hazards[i];
      hazard.update(dt, this.enemies, (h, enemy, extra) => {
        this.hazardsTriggered++;
        this.unlockAchievement('trap_master');

        if (h.type === 'tripwire') {
          this.sound.playLaser();
          this.spawnExplosionSparks(h.x, h.y, '#06b6d4', 12);
          this.applyDamageToEnemy(enemy, extra?.damage || 140, 'hazard');
        } else if (h.type === 'cryo_mine') {
          this.sound.playFrostHum();
          this.shockwaves.push({
            x: h.x,
            y: h.y,
            radius: 5,
            maxRadius: extra?.splashRadius || 75,
            color: '#8b5cf6',
            alpha: 1.0,
          });
          for (const e of this.enemies) {
            if (e.isDead || e.reachedEnd) continue;
            const dx = e.x - h.x;
            const dy = e.y - h.y;
            if (dx * dx + dy * dy <= 75 * 75) {
              e.applySlow(0.3, 3.0);
              this.applyDamageToEnemy(e, 40, 'frost');
            }
          }
        } else if (h.type === 'concussion_mine') {
          this.sound.playMineExplosion();
          this.triggerScreenShake(0.2);
          this.shockwaves.push({
            x: h.x,
            y: h.y,
            radius: 8,
            maxRadius: extra?.splashRadius || 70,
            color: '#f97316',
            alpha: 1.0,
          });
          this.spawnExplosionSparks(h.x, h.y, '#f97316', 22);
          for (const e of this.enemies) {
            if (e.isDead || e.reachedEnd) continue;
            const dx = e.x - h.x;
            const dy = e.y - h.y;
            if (dx * dx + dy * dy <= 70 * 70) {
              this.applyDamageToEnemy(e, extra?.damage || 240, 'hazard');
            }
          }
        }
      });

      if (hazard.isDepleted) {
        this.hazards.splice(i, 1);
      }
    }

    // Update Enemies
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

    // Update Shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += 180 * dt;
      sw.alpha -= 2.2 * dt;
      if (sw.alpha <= 0 || sw.radius >= sw.maxRadius) {
        this.shockwaves.splice(i, 1);
      }
    }

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha -= p.decay * dt;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Update Floating Text System
    this.floatingTextSystem.update(dt);

    this.updateRealtimeHUD();
  }

  // -------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------
  public render(): void {
    const { ctx, canvas } = this;

    ctx.save();

    if (this.shakeTimer > 0) {
      const mag = this.shakeTimer * 10;
      const ox = (Math.random() - 0.5) * mag;
      const oy = (Math.random() - 0.5) * mag;
      ctx.translate(ox, oy);
    }

    ctx.fillStyle = '#070d19';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    this.drawGridBackground(ctx);
    this.drawPath(ctx);

    // Hazards & Traps (on road)
    for (let i = 0; i < this.hazards.length; i++) {
      this.hazards[i].draw(ctx);
    }

    // Towers
    for (let i = 0; i < this.towers.length; i++) {
      const tower = this.towers[i];
      tower.draw(ctx, tower === this.selectedTower, this.showAllRanges);
    }

    // Enemies
    for (let i = 0; i < this.enemies.length; i++) {
      this.enemies[i].draw(ctx);
    }

    // Projectiles
    for (let i = 0; i < this.projectiles.length; i++) {
      this.projectiles[i].draw(ctx);
    }

    // Shockwaves
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

    // Particles
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

    // Weather Particles Overlay
    this.drawWeatherEffects(ctx);

    // Floating Combat Text
    this.floatingTextSystem.draw(ctx);

    // Active Commander Ability Target Reticle
    this.drawCommanderAbilityReticle(ctx);

    // Placement Holograms (Tower or Trap)
    this.drawHolographicPlacementPreview(ctx);

    // Threat Radar Preview on Canvas during preparation
    if (!this.isWaveInProgress) {
      this.drawCanvasThreatRadar(ctx);
    }

    ctx.restore();
  }

  private drawWeatherEffects(ctx: CanvasRenderingContext2D): void {
    if (this.weather === 'clear') return;

    ctx.save();
    if (this.weather === 'solar') {
      ctx.fillStyle = 'rgba(249, 115, 22, 0.04)';
      ctx.fillRect(0, 0, 1000, 650);

      // Embers
      for (const p of this.weatherParticles) {
        ctx.fillStyle = '#f97316';
        ctx.globalAlpha = p.alpha * 0.7;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (this.weather === 'cryo') {
      ctx.fillStyle = 'rgba(192, 132, 252, 0.03)';
      ctx.fillRect(0, 0, 1000, 650);

      // Snow crystals
      for (const p of this.weatherParticles) {
        ctx.fillStyle = '#c084fc';
        ctx.globalAlpha = p.alpha * 0.8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (this.weather === 'nebula') {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
      ctx.fillRect(0, 0, 1000, 650);

      // Fog mist
      for (const p of this.weatherParticles) {
        ctx.fillStyle = '#64748b';
        ctx.globalAlpha = p.alpha * 0.25;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 8, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (this.weather === 'storm') {
      ctx.fillStyle = 'rgba(6, 182, 212, 0.03)';
      ctx.fillRect(0, 0, 1000, 650);

      for (const p of this.weatherParticles) {
        ctx.fillStyle = '#38bdf8';
        ctx.globalAlpha = p.alpha * 0.5;
        ctx.fillRect(p.x, p.y, 1.5, p.size * 3);
      }
    }
    ctx.restore();
  }

  private drawCanvasThreatRadar(ctx: CanvasRenderingContext2D): void {
    const preview = this.getNextWavePreview(this.waveNumber);
    const boxX = 20;
    const boxY = 60;
    const boxW = 280;
    const boxH = 46;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 9px monospace';
    ctx.fillText(`THREAT RADAR: WAVE ${this.waveNumber} INCOMING`, boxX + 10, boxY + 16);

    let desc = '';
    if (preview.hasBoss) desc += '👑 APEX BOSS  ';
    if (preview.counts.scout > 0) desc += `${preview.counts.scout}x Scout  `;
    if (preview.counts.infiltrator > 0) desc += `${preview.counts.infiltrator}x Cloak  `;
    if (preview.counts.shielded > 0) desc += `${preview.counts.shielded}x Shield  `;
    if (preview.counts.goliath > 0) desc += `${preview.counts.goliath}x Goliath  `;

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '10px monospace';
    ctx.fillText(desc.trim() || `${preview.totalCount} Hostiles`, boxX + 10, boxY + 34);

    ctx.restore();
  }

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

  private drawPath(ctx: CanvasRenderingContext2D): void {
    if (this.pathWaypoints.length < 2) return;

    ctx.save();
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

    ctx.strokeStyle = '#0d1527';
    ctx.lineWidth = 30;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 12]);
    ctx.lineDashOffset = -(Date.now() * 0.02) % 20;
    ctx.stroke();
    ctx.restore();

    // Entry Gate
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

    // Core Fortress
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

  private drawHolographicPlacementPreview(ctx: CanvasRenderingContext2D): void {
    if (!this.isMouseInsideCanvas || this.activeAbilityTarget) return;

    // Trap placement hologram
    if (this.selectedBuildTrap) {
      const cfg = HAZARD_CONFIGS[this.selectedBuildTrap as 'tripwire' | 'cryo_mine' | 'concussion_mine'];
      if (!cfg) return;

      const isRoad = this.isRoadTile(this.mouseGridX, this.mouseGridY);
      const hasGold = this.gold >= cfg.cost;
      const canPlace = isRoad && hasGold;

      const centerX = this.mouseGridX * this.cellWidth + this.cellWidth / 2;
      const centerY = this.mouseGridY * this.cellHeight + this.cellHeight / 2;

      ctx.save();
      ctx.fillStyle = canPlace ? 'rgba(56, 189, 248, 0.25)' : 'rgba(244, 63, 94, 0.25)';
      ctx.fillRect(this.mouseGridX * this.cellWidth, this.mouseGridY * this.cellHeight, this.cellWidth, this.cellHeight);
      ctx.strokeStyle = canPlace ? '#38bdf8' : '#f43f5e';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(this.mouseGridX * this.cellWidth, this.mouseGridY * this.cellHeight, this.cellWidth, this.cellHeight);

      ctx.fillStyle = canPlace ? '#38bdf8' : '#f43f5e';
      ctx.font = '700 10px monospace';
      ctx.textAlign = 'center';
      const label = !isRoad ? 'ROAD ONLY' : !hasGold ? 'CREDITS LOW' : cfg.name.toUpperCase();
      ctx.fillText(label, centerX, centerY + 26);
      ctx.restore();
      return;
    }

    // Tower placement hologram
    if (!this.selectedBuildType) return;

    const isValid = this.isTileBuildable(this.mouseGridX, this.mouseGridY);
    const cfg = TOWER_CONFIGS[this.selectedBuildType];
    const hasEnoughGold = this.gold >= cfg.baseCost;
    const canBuild = isValid && hasEnoughGold;

    const centerX = this.mouseGridX * this.cellWidth + this.cellWidth / 2;
    const centerY = this.mouseGridY * this.cellHeight + this.cellHeight / 2;

    ctx.save();
    ctx.fillStyle = canBuild ? 'rgba(6, 182, 212, 0.2)' : 'rgba(244, 63, 94, 0.25)';
    ctx.fillRect(this.mouseGridX * this.cellWidth, this.mouseGridY * this.cellHeight, this.cellWidth, this.cellHeight);
    ctx.strokeStyle = canBuild ? '#06b6d4' : '#f43f5e';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(this.mouseGridX * this.cellWidth, this.mouseGridY * this.cellHeight, this.cellWidth, this.cellHeight);

    ctx.beginPath();
    ctx.arc(centerX, centerY, cfg.baseRange, 0, Math.PI * 2);
    ctx.fillStyle = canBuild ? 'rgba(6, 182, 212, 0.08)' : 'rgba(244, 63, 94, 0.06)';
    ctx.fill();
    ctx.strokeStyle = canBuild ? '#22d3ee' : '#f43f5e';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.stroke();

    ctx.fillStyle = canBuild ? 'rgba(34, 211, 238, 0.6)' : 'rgba(244, 63, 94, 0.6)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 14, 0, Math.PI * 2);
    ctx.fill();

    if (!canBuild) {
      ctx.fillStyle = '#f43f5e';
      ctx.font = '700 10px monospace';
      ctx.textAlign = 'center';
      const reason = !isValid ? 'BLOCKED TILE' : 'CREDITS LOW';
      ctx.fillText(reason, centerX, centerY + 28);
    }
    ctx.restore();
  }

  private drawCommanderAbilityReticle(ctx: CanvasRenderingContext2D): void {
    if (!this.activeAbilityTarget || !this.isMouseInsideCanvas) return;

    const x = this.mousePixelX;
    const y = this.mousePixelY;
    const radius = this.activeAbilityTarget === 'emp' ? 140 : 110;
    const color = this.activeAbilityTarget === 'emp' ? '#38bdf8' : '#f43f5e';

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = this.activeAbilityTarget === 'emp' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(244, 63, 94, 0.12)';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.stroke();

    // Crosshairs
    ctx.setLineDash([]);
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - 20, y);
    ctx.lineTo(x + 20, y);
    ctx.moveTo(x, y - 20);
    ctx.lineTo(x, y + 20);
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.font = '700 11px monospace';
    ctx.textAlign = 'center';
    const label = this.activeAbilityTarget === 'emp' ? '⚡ EMP TARGET AREA' : '🎯 ORBITAL STRIKE TARGET';
    ctx.fillText(label, x, y - radius - 8);

    ctx.restore();
  }

  // -------------------------------------------------------------
  // HUD Synchronizer
  // -------------------------------------------------------------
  public updateHUD(): void {
    this.elGold.textContent = this.gold.toString();
    this.elHealth.textContent = `${this.baseHealth}/${this.maxBaseHealth}`;
    this.elWave.textContent = this.waveNumber.toString();
    this.elScore.textContent = this.score.toString();

    if (this.gold >= 1000) {
      this.unlockAchievement('war_chest');
    }

    const types: TowerType[] = ['gatling', 'mortar', 'frost', 'tesla', 'incinerator'];
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

    const trapTypes: HazardType[] = ['tripwire', 'cryo_mine', 'concussion_mine'];
    trapTypes.forEach((type) => {
      const card = document.getElementById(`card-trap-${type}`);
      if (card) {
        const cost = HAZARD_CONFIGS[type as 'tripwire' | 'cryo_mine' | 'concussion_mine']?.cost || 40;
        if (this.gold < cost) {
          card.classList.add('disabled');
        } else {
          card.classList.remove('disabled');
        }
      }
    });

    this.updateInspectorUI();
    this.updateAchievementsUI();
    this.updateWeatherUI();
  }

  private updateRealtimeHUD(): void {
    if (this.isWaveInProgress) {
      this.elWaveStatus.textContent = `WAVE ${this.waveNumber} COMBAT ACTIVE`;
      const enemiesRemaining = this.enemies.length + this.waveSpawnQueue.length;
      this.elWaveCountdown.textContent = `${enemiesRemaining} HOSTILES`;
      this.elWaveProgress.style.width = '100%';
    } else {
      this.elWaveStatus.textContent = `WAVE ${this.waveNumber} PREPARING`;
      const timeStr = Math.max(0, this.waveCountdown).toFixed(1);
      this.elWaveCountdown.textContent = `${timeStr}s`;
      const pct = Math.min(100, Math.max(0, (1 - this.waveCountdown / 5.0) * 100));
      this.elWaveProgress.style.width = `${pct}%`;
    }

    if (this.elBtnEmp) {
      if (this.empCooldown > 0) {
        this.elBtnEmp.classList.add('cooldown');
        this.elBtnEmp.setAttribute('data-cd', `${Math.ceil(this.empCooldown)}s`);
      } else {
        this.elBtnEmp.classList.remove('cooldown');
        this.elBtnEmp.removeAttribute('data-cd');
      }
    }

    if (this.elBtnOrbital) {
      if (this.orbitalCooldown > 0) {
        this.elBtnOrbital.classList.add('cooldown');
        this.elBtnOrbital.setAttribute('data-cd', `${Math.ceil(this.orbitalCooldown)}s`);
      } else {
        this.elBtnOrbital.classList.remove('cooldown');
        this.elBtnOrbital.removeAttribute('data-cd');
      }
    }

    if (this.elBtnOverdrive) {
      if (this.overdriveCooldown > 0) {
        this.elBtnOverdrive.classList.add('cooldown');
        this.elBtnOverdrive.setAttribute('data-cd', `${Math.ceil(this.overdriveCooldown)}s`);
      } else {
        this.elBtnOverdrive.classList.remove('cooldown');
        this.elBtnOverdrive.removeAttribute('data-cd');
      }
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
    this.elInspectorName.textContent = t.branchName ? `${t.branchName}` : cfg.name;
    this.elInspectorType.textContent =
      t.branchName
        ? `Branch [${t.branch}]: Specialized ${cfg.name}`
        : t.type === 'gatling'
        ? 'Ultra-Rapid Laser'
        : t.type === 'mortar'
        ? 'Heavy Ballistic AoE'
        : t.type === 'frost'
        ? 'Cryogenic Slow Beam'
        : t.type === 'tesla'
        ? `Chain Lightning (${t.maxChainTargets} targets)`
        : 'Thermal Incinerator (Flame Cone)';

    this.elInspectorLevel.textContent = `LVL ${t.level}${t.level >= t.maxLevel ? ` [${t.branch}]` : ''}`;
    this.elInspectorDamage.textContent = t.damage.toString();
    this.elInspectorRange.textContent = t.range.toString();
    this.elInspectorRate.textContent = `${(1 / t.fireInterval).toFixed(1)} /s`;
    this.elInspectorTotalDmg.textContent = Math.round(t.totalDamageDealt).toString();

    const pills = document.querySelectorAll('.target-pill');
    pills.forEach((p) => {
      const mode = p.getAttribute('data-mode');
      if (mode === t.targetingMode) {
        p.classList.add('active');
      } else {
        p.classList.remove('active');
      }
    });

    // Dual-Branch Upgrade vs Standard Upgrade vs Maxed
    const standardUpgradeBtn = document.getElementById('btn-upgrade-tower');
    const branchContainer = document.getElementById('branch-choice-container');

    if (t.level === 3) {
      // Show branching options
      if (standardUpgradeBtn) standardUpgradeBtn.style.display = 'none';
      if (branchContainer) {
        branchContainer.style.display = 'block';
        const opts = t.getBranchOptions();
        const optA = opts[0];
        const optB = opts[1];

        if (this.elBranchAName) this.elBranchAName.textContent = optA.title;
        if (this.elBranchADesc) this.elBranchADesc.textContent = optA.description;
        if (this.elBranchACost) this.elBranchACost.textContent = `${optA.cost} ⬢`;
        if (this.elBtnBranchA) this.elBtnBranchA.disabled = this.gold < optA.cost;

        if (this.elBranchBName) this.elBranchBName.textContent = optB.title;
        if (this.elBranchBDesc) this.elBranchBDesc.textContent = optB.description;
        if (this.elBranchBCost) this.elBranchBCost.textContent = `${optB.cost} ⬢`;
        if (this.elBtnBranchB) this.elBtnBranchB.disabled = this.gold < optB.cost;
      }
    } else {
      if (branchContainer) branchContainer.style.display = 'none';
      if (standardUpgradeBtn) standardUpgradeBtn.style.display = 'flex';

      if (t.level >= t.maxLevel) {
        this.elBtnUpgrade.disabled = true;
        this.elUpgradeCost.textContent = 'MAX LEVEL';
      } else {
        const upCost = t.getUpgradeCost();
        this.elBtnUpgrade.disabled = this.gold < upCost;
        this.elUpgradeCost.textContent = `${upCost} ⬢`;
      }
    }

    this.elSellRefund.textContent = `+${t.getSellRefund()} ⬢`;
  }
}
