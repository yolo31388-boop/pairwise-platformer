const { resolveCollision, checkGround } = require('../physics/collision.js');

const FRAME_RATE = 60;
const GRAVITY = 0.8; // 每帧（1/60s）

class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.width = 32; this.height = 48;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.groundPlatform = null;
  }
  jump() { if (this.onGround) this.vy = -15; }
  getState() {
    return { x: this.x, y: this.y, vx: this.vx, vy: this.vy, onGround: this.onGround };
  }
  update(dt, platforms) {
    this.vy += GRAVITY * dt * FRAME_RATE;
    resolveCollision(this, platforms, dt);
    checkGround(this, platforms);
  }
}

module.exports = { Player };
