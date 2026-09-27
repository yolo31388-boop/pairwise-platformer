// AABB 碰撞检测
// 不变量：
// 1. 按 X、Y 分量分步检测：先水平移动并解析，再垂直移动并解析
// 2. 每个分量移动后立即做碰撞解析，不等整帧位移算完
// 3. 高速移动使用扫掠 AABB（swept AABB），比较运动轨迹而非最终位置
// 4. 地面检测使用脚部下方的窄矩形探针，不用整个身体盒
// 5. 单向平台（oneWay）只在向下移动时阻挡，向上移动时穿过
// 6. 碰撞后按接触面法线归零对应速度分量，不保留穿透方向的速度

const FRAME_RATE = 60; // 速度单位：每帧（1/60s）像素
const EPS = 1e-9;
const PROBE_INSET = 2; // 脚部探针水平内缩，保证是窄矩形
const PROBE_DEPTH = 2; // 脚部探针向下深度

function aabbOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x &&
         a.y < b.y + b.height && a.y + a.height > b.y;
}

function rangesOverlap(aMin, aMax, bMin, bMax) {
  return aMin < bMax && aMax > bMin;
}

// 单轴扫掠：区间 [aMin, aMax] 沿轴向移动 d（d ≠ 0），
// 返回进入目标区间 [bMin, bMax] 的时刻 t ∈ [0,1]；未碰撞或已经重叠时返回 null
function sweepAxis(aMin, aMax, bMin, bMax, d) {
  if (d > 0 && aMax <= bMin + EPS) {
    const t = (bMin - aMax) / d;
    if (t <= 1) return Math.max(t, 0);
  } else if (d < 0 && aMin >= bMax - EPS) {
    const t = (aMin - bMax) / -d;
    if (t <= 1) return Math.max(t, 0);
  }
  return null;
}

// 已经嵌入实体时的去穿透：沿穿透深度最小的轴推出，
// 并清零指向碰撞体内部的速度分量（法线方向）
function depenetrate(entity, platforms) {
  for (const p of platforms) {
    if (p.oneWay) continue; // 单向平台不做去穿透，允许从下方穿过
    if (!aabbOverlap(entity, p)) continue;
    const overlapX = Math.min(entity.x + entity.width, p.x + p.width) - Math.max(entity.x, p.x);
    const overlapY = Math.min(entity.y + entity.height, p.y + p.height) - Math.max(entity.y, p.y);
    if (overlapX <= 0 || overlapY <= 0) continue;
    if (overlapX < overlapY) {
      const dir = (entity.x + entity.width / 2) < (p.x + p.width / 2) ? -1 : 1;
      entity.x += dir * overlapX;
      if (entity.vx * dir < 0) entity.vx = 0;
    } else {
      const dir = (entity.y + entity.height / 2) < (p.y + p.height / 2) ? -1 : 1;
      entity.y += dir * overlapY;
      if (entity.vy * dir < 0) entity.vy = 0;
    }
  }
}

// 第一步：水平移动，移动后立即解析（单向平台不阻挡水平移动）
function moveHorizontal(entity, platforms, dx) {
  if (dx === 0) return;
  let bestT = 1;
  let hit = null;
  for (const p of platforms) {
    if (p.oneWay) continue;
    if (!rangesOverlap(entity.y, entity.y + entity.height, p.y, p.y + p.height)) continue;
    const t = sweepAxis(entity.x, entity.x + entity.width, p.x, p.x + p.width, dx);
    if (t !== null && t <= bestT) { bestT = t; hit = p; }
  }
  entity.x += dx * bestT;
  if (hit) {
    // 吸附到接触面，避免浮点误差导致嵌入
    entity.x = dx > 0 ? hit.x - entity.width : hit.x + hit.width;
    entity.vx = 0; // 接触面法线沿 X，清零水平速度
  }
}

// 第二步：垂直移动，移动后立即解析（单向平台仅下落时阻挡）
function moveVertical(entity, platforms, dy) {
  if (dy === 0) return;
  const startY = entity.y;
  let bestT = 1;
  let hit = null;
  for (const p of platforms) {
    if (!rangesOverlap(entity.x, entity.x + entity.width, p.x, p.x + p.width)) continue;
    if (p.oneWay) {
      if (dy <= 0) continue; // 向上移动时穿过
      if (startY + entity.height > p.y + 1) continue; // 脚已在顶面以下则穿过
    }
    const t = sweepAxis(startY, startY + entity.height, p.y, p.y + p.height, dy);
    if (t !== null && t <= bestT) { bestT = t; hit = p; }
  }
  entity.y = startY + dy * bestT;
  if (hit) {
    entity.y = dy > 0 ? hit.y - entity.height : hit.y + hit.height;
    entity.vy = 0; // 接触面法线沿 Y，清零垂直速度
  }
}

function resolveCollision(entity, platforms, dt) {
  const scale = dt * FRAME_RATE;
  depenetrate(entity, platforms);
  moveHorizontal(entity, platforms, entity.vx * scale); // 先水平
  moveVertical(entity, platforms, entity.vy * scale);   // 后垂直
}

// 地面检测：脚部下方的窄矩形探针，不用整个身体盒
function checkGround(entity, platforms) {
  const inset = Math.min(PROBE_INSET, entity.width / 4);
  const probe = {
    x: entity.x + inset,
    y: entity.y + entity.height,
    width: entity.width - inset * 2,
    height: PROBE_DEPTH,
  };
  entity.onGround = false;
  entity.groundPlatform = null;
  for (const p of platforms) {
    if (!aabbOverlap(probe, p)) continue;
    if (p.oneWay && entity.y + entity.height > p.y + 1) continue; // 单向平台只认站在顶面
    entity.onGround = true;
    entity.groundPlatform = p;
    break;
  }
}

module.exports = { resolveCollision, checkGround };
