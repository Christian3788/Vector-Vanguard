/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Enemy, Point } from './Enemy';

export type HazardType = 'tripwire' | 'cryo_mine' | 'concussion_mine' | 'napalm_puddle';

export interface HazardConfig {
  name: string;
  cost: number;
  description: string;
  keyHint?: string;
}

export const HAZARD_CONFIGS: Record<'tripwire' | 'cryo_mine' | 'concussion_mine', HazardConfig> = {
  tripwire: {
    name: 'Laser Tripwire',
    cost: 40,
    description: 'Slices across road tile. Deals 140 damage per trigger (3 charges).',
    keyHint: '[6]',
  },
  cryo_mine: {
    name: 'Cryo Landmine',
    cost: 35,
    description: 'Concealed road mine. Detonates on contact, freezing area in 75px radius.',
    keyHint: '[7]',
  },
  concussion_mine: {
    name: 'Concussion Mine',
    cost: 50,
    description: 'Heavy explosive pressure mine. Detonates for 240 blast damage in 70px radius.',
    keyHint: '[8]',
  },
};

export class Hazard {
  public id: string;
  public type: HazardType;
  public gridX: number;
  public gridY: number;
  public x: number;
  public y: number;
  public radius: number = 22;
  public charges: number = 3;
  public duration: number = 9999; // seconds
  public age: number = 0;
  public isDepleted: boolean = false;

  constructor(type: HazardType, gridX: number, gridY: number, cellWidth: number, cellHeight: number, duration?: number) {
    this.id = Math.random().toString(36).substring(2, 9);
    this.type = type;
    this.gridX = gridX;
    this.gridY = gridY;
    this.x = gridX * cellWidth + cellWidth / 2;
    this.y = gridY * cellHeight + cellHeight / 2;

    if (type === 'tripwire') {
      this.charges = 3;
      this.radius = 24;
    } else if (type === 'cryo_mine') {
      this.charges = 1;
      this.radius = 20;
    } else if (type === 'concussion_mine') {
      this.charges = 1;
      this.radius = 20;
    } else if (type === 'napalm_puddle') {
      this.charges = 999;
      this.duration = duration || 6.5;
      this.radius = 36;
    }
  }

  public update(
    dt: number,
    enemies: Enemy[],
    onTrigger: (hazard: Hazard, enemy: Enemy, extraData?: { splashRadius?: number; damage?: number; effect?: 'slow' | 'freeze' }) => void
  ): void {
    if (this.isDepleted) return;

    if (this.type === 'napalm_puddle') {
      this.age += dt;
      if (this.age >= this.duration) {
        this.isDepleted = true;
        return;
      }

      // Continuous burn tick for anyone inside puddle
      for (const e of enemies) {
        if (e.isDead || e.reachedEnd) continue;
        const dx = e.x - this.x;
        const dy = e.y - this.y;
        if (dx * dx + dy * dy <= this.radius * this.radius) {
          e.applyBurn(38, 1.5);
        }
      }
      return;
    }

    // Check collision with traversing enemies
    for (const e of enemies) {
      if (e.isDead || e.reachedEnd) continue;
      const dx = e.x - this.x;
      const dy = e.y - this.y;
      const distSq = dx * dx + dy * dy;
      const hitDist = this.radius + e.radius;

      if (distSq <= hitDist * hitDist) {
        if (this.type === 'tripwire') {
          this.charges--;
          onTrigger(this, e, { damage: 140 });
          if (this.charges <= 0) {
            this.isDepleted = true;
          }
          break;
        } else if (this.type === 'cryo_mine') {
          this.isDepleted = true;
          onTrigger(this, e, { splashRadius: 75, effect: 'freeze' });
          break;
        } else if (this.type === 'concussion_mine') {
          this.isDepleted = true;
          onTrigger(this, e, { splashRadius: 70, damage: 240 });
          break;
        }
      }
    }
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    if (this.isDepleted) return;

    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.type === 'tripwire') {
      // Dual post emitters with pulsing laser wire
      ctx.fillStyle = '#334155';
      ctx.fillRect(-18, -14, 6, 28);
      ctx.fillRect(12, -14, 6, 28);

      // Neon emitter tip
      ctx.fillStyle = '#06b6d4';
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#06b6d4';
      ctx.fillRect(-18, -16, 6, 4);
      ctx.fillRect(12, -16, 6, 4);

      // Laser beam across
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2 + Math.sin(Date.now() * 0.015) * 1;
      ctx.beginPath();
      ctx.moveTo(-15, 0);
      ctx.lineTo(15, 0);
      ctx.stroke();

      // Charge indicators
      for (let c = 0; c < this.charges; c++) {
        ctx.fillStyle = '#34d399';
        ctx.beginPath();
        ctx.arc(-6 + c * 6, -8, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (this.type === 'cryo_mine') {
      // Pressure plate with cryo crystal core
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#8b5cf6';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Pulsing freeze glyph
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#c084fc';
      ctx.fillStyle = '#a855f7';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('❄', 0, 0);
    } else if (this.type === 'concussion_mine') {
      // Heavy high-explosive orange plate with warning chevron
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Flashing center LED
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ef4444';
      ctx.fillStyle = (Date.now() % 600 < 300) ? '#f87171' : '#dc2626';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'napalm_puddle') {
      // Molten burning ground pool
      const alpha = Math.max(0, 1 - this.age / this.duration);
      ctx.globalAlpha = alpha * 0.6;
      ctx.fillStyle = '#f97316';
      ctx.shadowBlur = 14;
      ctx.shadowColor = '#ef4444';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
