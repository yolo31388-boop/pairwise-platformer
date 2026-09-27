// AABB 碰撞检测
// 不变量：
// - 按 X、Y 分量分步检测：先处理水平移动，再处理垂直移动；
// - 每一步移动后立即做碰撞解析，不等整帧位移算完再修正；
// - 高速移动使用扫掠检测（swept AABB），比较运动路径而非最终位置；
// - 地面检测基于脚部下方的窄矩形探针，不用整个身体盒；
// - 单向平台（oneWay）只在向下移动时阻挡，向上移动时穿过；
// - 碰撞后按接触面法线将速度分量归零，不保留穿透方向的速度。

function aabbOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x &&
         a.y < b.y + b.height && a.y + a.height > b.y;
}

function overlapX(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x;
}

function overlapY(a, b) {
  return a.y < b.y + b.height && a.y + a.height > b.y;
}

// 水平移动 + 立即解析。swept AABB：只要本步移动路径越过墙面即算碰撞，
// 即使位移大于墙的厚度也不会穿透。
function moveHorizontal(entity, platforms, dx) {
  if (dx === 0) return;
  const prevX = entity.x;
  entity.x += dx;
  for (const p of platforms) {
    if (p.oneWay) continue;             // 单向平台不阻挡水平移动
    if (!overlapY(entity, p)) continue; // 垂直方向不相交则不可能相撞
    if (dx > 0) {
      // 右边缘本步越过平台左边界
      if (prevX + entity.width <= p.x && entity.x + entity.width > p.x) {
        entity.x = p.x - entity.width;
        entity.vx = 0; // 按接触面法线归零
      }
    } else {
      // 左边缘本步越过平台右边界
      if (prevX >= p.x + p.width && entity.x < p.x + p.width) {
        entity.x = p.x + p.width;
        entity.vx = 0;
      }
    }
  }
}

// 垂直移动 + 立即解析。
function moveVertical(entity, platforms, dy) {
  if (dy === 0) return;
  const prevY = entity.y;
  entity.y += dy;
  for (const p of platforms) {
    if (!overlapX(entity, p)) continue;
    if (dy > 0) {
      // 下落：脚底本步越过平台顶（单向平台也只在这一方向阻挡）
      if (prevY + entity.height <= p.y && entity.y + entity.height > p.y) {
        entity.y = p.y - entity.height;
        entity.vy = 0;
        entity.onGround = true;
      } else if (!p.oneWay && aabbOverlap(entity, p)) {
        // 已嵌入实体碰撞体（如被移动平台挤压）：沿法线推出
        entity.y = p.y - entity.height;
        entity.vy = 0;
        entity.onGround = true;
      }
    } else {
      if (p.oneWay) continue; // 向上移动时穿过单向平台
      // 上升：头顶本步越过平台底
      if (prevY >= p.y + p.height && entity.y < p.y + p.height) {
        entity.y = p.y + p.height;
        entity.vy = 0;
      } else if (aabbOverlap(entity, p)) {
        entity.y = p.y + p.height;
        entity.vy = 0;
      }
    }
  }
}

// 分轴解析：先水平后垂直，每根轴移动后立即解析。
// dt 以物理子步为单位，速度单位为 像素/子步。
function resolveCollision(entity, platforms, dt) {
  moveHorizontal(entity, platforms, entity.vx * dt);
  moveVertical(entity, platforms, entity.vy * dt);
}

// 地面检测：脚部下方的窄矩形探针（不用整个身体盒），
// 这样身体悬出平台边缘时会正确触发悬空。
function checkGround(entity, platforms) {
  const probeWidth = Math.max(2, Math.floor(entity.width / 4));
  const probe = {
    x: entity.x + (entity.width - probeWidth) / 2,
    y: entity.y + entity.height,
    width: probeWidth,
    height: 2,
  };
  entity.onGround = false;
  entity.groundPlatform = null;
  for (const p of platforms) {
    if (aabbOverlap(probe, p)) {
      entity.onGround = true;
      entity.groundPlatform = p;
      return;
    }
  }
}

module.exports = { resolveCollision, checkGround, aabbOverlap };
