/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Enemy, Point } from './Enemy';

export type ProjectileType = 'laser' | 'mortar' | 'frost_shard';

export interface ProjectileImpact {
  x: number;
  y: number;
  damage: number;
  splashRadius: number;
  effect?: 'slow' | 'burn';
  effectFactor?: number;
  effectDuration?: number;
  armorPierce?: number;
}

export class Projectile {
  public id: string;
  public type: ProjectileType;
  public x: number;
  public y: number;
  public target: Enemy | null;
  public targetCoord: Point; // Fixed impact ground coordinate for mortar / splash
  public startCoord: Point;
  public speed: number;
  public damage: number;
  public splashRadius: number; // 0 for single target, >0 for AoE
  public color: string;
  public radius: number;
  public isTerminated: boolean = false;
  public armorPierce: number = 0;
  public onDetonate?: (x: number, y: number) => void;

  // Ballistic arc physics (for Mortar)
  public isBallistic: boolean = false;
  public totalDistance: number = 0;
  public progress: number = 0; // 0 to 1
  public arcHeight: number = 0;

  // Trajectory history for trail rendering
  public trail: Point[] = [];
  public maxTrailLength: number = 6;

  // Status effect applied on impact
  public statusEffect?: 'slow' | 'burn';
  public statusFactor?: number;
  public statusDuration?: number;

  constructor(
    type: ProjectileType,
    origin: Point,
    target: Enemy,
    damage: number,
    options: {
      speed?: number;
      splashRadius?: number;
      color?: string;
      radius?: number;
      armorPierce?: number;
      onDetonate?: (x: number, y: number) => void;
      statusEffect?: 'slow' | 'burn';
      statusFactor?: number;
      statusDuration?: number;
    } = {}
  ) {
    this.id = Math.random().toString(36).substring(2, 9);
    this.type = type;
    this.x = origin.x;
    this.y = origin.y;
    this.startCoord = { x: origin.x, y: origin.y };
    this.target = target;
    this.targetCoord = { x: target.x, y: target.y };
    this.damage = damage;
    this.splashRadius = options.splashRadius || 0;
    this.statusEffect = options.statusEffect;
    this.statusFactor = options.statusFactor;
    this.statusDuration = options.statusDuration;
    this.armorPierce = options.armorPierce || 0;
    this.onDetonate = options.onDetonate;

    switch (type) {
      case 'laser':
        this.speed = options.speed || 680;
        this.color = options.color || '#22d3ee';
        this.radius = options.radius || 3.5;
        this.isBallistic = false;
        break;

      case 'mortar':
        this.speed = options.speed || 240;
        this.color = options.color || '#fbbf24';
        this.radius = options.radius || 6.5;
        this.isBallistic = true;
        this.splashRadius = options.splashRadius || 65;
        {
          const dx = this.targetCoord.x - origin.x;
          const dy = this.targetCoord.y - origin.y;
          this.totalDistance = Math.sqrt(dx * dx + dy * dy);
          this.arcHeight = Math.min(80, Math.max(30, this.totalDistance * 0.35));
        }
        break;

      case 'frost_shard':
        this.speed = options.speed || 480;
        this.color = options.color || '#a855f7';
        this.radius = options.radius || 4.5;
        this.isBallistic = false;
        break;
    }
  }

  public update(dt: number): ProjectileImpact | null {
    if (this.isTerminated) return null;

    this.trail.unshift({ x: this.x, y: this.y });
    if (this.trail.length > this.maxTrailLength) {
      this.trail.pop();
    }

    if (this.isBallistic) {
      const step = (this.speed * dt) / this.totalDistance;
      this.progress += step;

      if (this.progress >= 1) {
        this.isTerminated = true;
        if (this.onDetonate) {
          this.onDetonate(this.targetCoord.x, this.targetCoord.y);
        }
        return {
          x: this.targetCoord.x,
          y: this.targetCoord.y,
          damage: this.damage,
          splashRadius: this.splashRadius,
          effect: this.statusEffect,
          effectFactor: this.statusFactor,
          effectDuration: this.statusDuration,
          armorPierce: this.armorPierce,
        };
      }

      this.x = this.startCoord.x + (this.targetCoord.x - this.startCoord.x) * this.progress;
      this.y = this.startCoord.y + (this.targetCoord.y - this.startCoord.y) * this.progress;
      return null;
    }

    const targetX = this.target && !this.target.isDead ? this.target.x : this.targetCoord.x;
    const targetY = this.target && !this.target.isDead ? this.target.y : this.targetCoord.y;

    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const step = this.speed * dt;

    if (dist <= step || dist < (this.target ? this.target.radius : 8)) {
      this.isTerminated = true;
      if (this.onDetonate) {
        this.onDetonate(targetX, targetY);
      }
      return {
        x: targetX,
        y: targetY,
        damage: this.damage,
        splashRadius: this.splashRadius,
        effect: this.statusEffect,
        effectFactor: this.statusFactor,
        effectDuration: this.statusDuration,
        armorPierce: this.armorPierce,
      };
    }

    this.x += (dx / dist) * step;
    this.y += (dy / dist) * step;

    return null;
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    if (this.isTerminated) return;

    if (this.trail.length > 1) {
      ctx.save();
      for (let i = 1; i < this.trail.length; i++) {
        const p1 = this.trail[i - 1];
        const p2 = this.trail[i];
        const alpha = (1 - i / this.trail.length) * 0.45;

        ctx.strokeStyle = this.color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = this.radius * (1 - i / this.trail.length);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.save();
    let renderX = this.x;
    let renderY = this.y;

    if (this.isBallistic) {
      const arcOffset = Math.sin(this.progress * Math.PI) * this.arcHeight;
      renderY = this.y - arcOffset;

      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fill();
    }

    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(renderX, renderY, this.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(renderX, renderY, this.radius * 0.45, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
