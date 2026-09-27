

class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.width = 32; this.height = 48;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
  }
  jump() { if (this.onGround) this.vy = -15; }
  update(dt, platforms) {
    this.vy += 0.8;
    resolveCollision(this, platforms, dt);
    checkGround(this, platforms);
  }
}

module.exports = { Player };
