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

    switch (type) {
      case 'laser':
        this.speed = options.speed || 680; // High velocity linear vector
        this.color = options.color || '#22d3ee';
        this.radius = options.radius || 3.5;
        this.isBallistic = false;
        break;

      case 'mortar':
        this.speed = options.speed || 240;
        this.color = options.color || '#fbbf24';
        this.radius = options.radius || 6.5;
        this.isBallistic = true;
        this.splashRadius = options.splashRadius || 65; // Wide AoE
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

  /**
   * Update projectile coordinate physics and vector trajectory.
   * Returns impact payload if it reached target or touched ground.
   */
  public update(dt: number): ProjectileImpact | null {
    if (this.isTerminated) return null;

    // Track position history for glowing particle trail
    this.trail.unshift({ x: this.x, y: this.y });
    if (this.trail.length > this.maxTrailLength) {
      this.trail.pop();
    }

    if (this.isBallistic) {
      // Parabolic flight towards ground coordinate
      const step = (this.speed * dt) / this.totalDistance;
      this.progress += step;

      if (this.progress >= 1) {
        this.isTerminated = true;
        return {
          x: this.targetCoord.x,
          y: this.targetCoord.y,
          damage: this.damage,
          splashRadius: this.splashRadius,
          effect: this.statusEffect,
          effectFactor: this.statusFactor,
          effectDuration: this.statusDuration,
        };
      }

      // Linear interpolation for X, Y ground coordinates
      this.x = this.startCoord.x + (this.targetCoord.x - this.startCoord.x) * this.progress;
      this.y = this.startCoord.y + (this.targetCoord.y - this.startCoord.y) * this.progress;
      return null;
    }

    // Direct tracking vector towards target enemy
    // If target died or vanished, track last known target coordinate
    const targetX = this.target && !this.target.isDead ? this.target.x : this.targetCoord.x;
    const targetY = this.target && !this.target.isDead ? this.target.y : this.targetCoord.y;

    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const step = this.speed * dt;

    if (dist <= step || dist < (this.target ? this.target.radius : 8)) {
      this.isTerminated = true;
      return {
        x: targetX,
        y: targetY,
        damage: this.damage,
        splashRadius: this.splashRadius,
        effect: this.statusEffect,
        effectFactor: this.statusFactor,
        effectDuration: this.statusDuration,
      };
    }

    // Advance along linear vector
    const nx = dx / dist;
    const ny = dy / dist;
    this.x += nx * step;
    this.y += ny * step;

    return null;
  }

  /**
   * Render projectile with trail, glow, or parabolic shadow
   */
  public draw(ctx: CanvasRenderingContext2D): void {
    if (this.isTerminated) return;

    if (this.isBallistic) {
      // Calculate current parabolic altitude: h = 4 * maxH * p * (1 - p)
      const altitude = 4 * this.arcHeight * this.progress * (1 - this.progress);
      const drawY = this.y - altitude;

      // Draw ground shadow
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, this.radius * 1.1, this.radius * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Draw ballistic plasma shell
      ctx.save();
      ctx.shadowBlur = 12;
      ctx.shadowColor = this.color;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, drawY, this.radius, 0, Math.PI * 2);
      ctx.fill();

      // Inner intense core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(this.x, drawY, this.radius * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    // Render motion trail
    if (this.trail.length > 1) {
      ctx.save();
      ctx.lineCap = 'round';
      for (let i = 0; i < this.trail.length - 1; i++) {
        const p1 = this.trail[i];
        const p2 = this.trail[i + 1];
        const alpha = (1 - i / this.trail.length) * 0.55;
        ctx.strokeStyle = this.color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = Math.max(1, this.radius * (1 - i / this.trail.length));
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Render projectile head
    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Hot center
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
