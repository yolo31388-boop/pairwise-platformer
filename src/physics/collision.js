
// AABB 碰撞检测 - 存在高速穿透bug
export function resolveCollision(entity, platforms, dt) {
  // BUG: 只在帧末做一次位置修正，没有分步检测
  entity.x += entity.vx * dt;
  entity.y += entity.vy * dt;
  for (const p of platforms) {
    if (aabbOverlap(entity, p)) {
      // BUG: 简单位置修正，没有按分量分步
      entity.y = p.y - entity.height;
      entity.vy = 0;
      entity.onGround = true;
    }
  }
}

function aabbOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x &&
         a.y < b.y + b.height && a.y + a.height > b.y;
}

export function checkGround(entity, platforms) {
  // BUG: 用整个身体盒检测地面，不是脚部探针
  entity.onGround = false;
  for (const p of platforms) {
    if (aabbOverlap(entity, p)) entity.onGround = true;
  }
}

module.exports = { resolveCollision, checkGround };
