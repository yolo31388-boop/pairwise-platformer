const { resolveCollision, checkGround } = require('../physics/collision.js');

const GRAVITY = 0.8;         // 重力加速度（像素/子步²）
const JUMP_VELOCITY = -15;   // 起跳速度（像素/子步）
const SUBSTEPS_PER_FRAME = 60; // 每帧（1/60s）细分的固定物理子步数

class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.width = 32; this.height = 48;
    this.vx = 0; this.vy = 0; // 速度单位：像素/子步
    this.onGround = false;
    this.groundPlatform = null;
  }

  jump() {
    if (!this.onGround) return;
    // 从移动平台起跳时继承平台速度，保证相对平台的起跳速度恒定
    const baseVy = (this.groundPlatform && this.groundPlatform.vy) || 0;
    this.vy = baseVy + JUMP_VELOCITY;
  }

  update(dt, platforms) {
    // 固定步长积分：把流逝时间细分为小步，每步移动后立即做分轴碰撞解析，
    // 避免高速位移在一次积分内越过碰撞体（隧道效应）。
    const steps = Math.max(1, Math.round(dt * 60 * SUBSTEPS_PER_FRAME));
    for (let i = 0; i < steps; i++) {
      this.vy += GRAVITY;
      resolveCollision(this, platforms, 1);
    }
    checkGround(this, platforms);
  }

  getState() {
    return {
      x: this.x, y: this.y,
      vx: this.vx, vy: this.vy,
      onGround: this.onGround,
    };
  }
}

module.exports = { Player };
