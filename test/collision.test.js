
const { Player } = require('../src/entities/player.js');
const { resolveCollision, checkGround } = require('../src/physics/collision.js');

describe('平台跳跃碰撞检测', () => {
  test('高速下落不应穿透地板', () => {
    const p = new Player(100, 0);
    p.vy = 100; // 高速下落
    const floor = { x: 0, y: 200, width: 200, height: 20 };
    p.update(1/60, [floor]);
    expect(p.y + p.height).toBeLessThanOrEqual(floor.y + 1);
    expect(p.y).toBeGreaterThan(0);
  });

  test('水平撞墙后速度应归零', () => {
    const p = new Player(0, 100);
    p.vx = 10; p.vy = 0;
    const wall = { x: 50, y: 0, width: 20, height: 200 };
    p.update(1/60, [wall]);
    expect(p.vx).toBe(0);
  });

  test('垂直落地后速度应归零', () => {
    const p = new Player(100, 0);
    p.vy = 10;
    const floor = { x: 0, y: 100, width: 200, height: 20 };
    p.update(1/60, [floor]);
    expect(p.vy).toBe(0);
    expect(p.onGround).toBe(true);
  });

  test('边缘落下应触发悬空', () => {
    const p = new Player(190, 80);
    p.vx = 5; p.vy = 0;
    const floor = { x: 0, y: 100, width: 200, height: 20 };
    p.update(1/60, [floor]);
    p.update(1/60, [floor]);
    expect(p.onGround).toBe(false);
  });

  test('碰撞后位置不应嵌入碰撞体超过1像素', () => {
    const p = new Player(100, 0);
    p.vy = 50;
    const floor = { x: 0, y: 100, width: 200, height: 20 };
    p.update(1/60, [floor]);
    expect(p.y + p.height).toBeLessThanOrEqual(floor.y + 1);
  });

  test('连续两帧碰撞状态一致', () => {
    const p = new Player(100, 50);
    const floor = { x: 0, y: 100, width: 200, height: 20 };
    p.update(1/60, [floor]);
    const y1 = p.y;
    p.update(1/60, [floor]);
    expect(p.y).toBe(y1);
    expect(p.onGround).toBe(true);
  });
});

describe('碰撞不变量（修复后新增）', () => {
  test('水平高速移动不穿透薄墙（扫掠检测）', () => {
    const p = new Player(0, 100);
    p.vx = 500; p.vy = 0;
    const wall = { x: 50, y: 0, width: 5, height: 400 }; // 薄墙：只比较最终位置必然穿透
    p.update(1/60, [wall]);
    expect(p.vx).toBe(0);
    expect(p.x).toBe(wall.x - p.width);
    expect(p.x + p.width).toBeLessThanOrEqual(wall.x + 1);
  });

  test('单向平台：向上移动时穿过', () => {
    const p = new Player(50, 200); // 从平台下方向上跳
    p.vy = -20;
    const platform = { x: 0, y: 100, width: 200, height: 10, oneWay: true };
    p.update(1/60, [platform]);
    // 穿过平台后落回平台顶上，而不是被平台底部挡住
    expect(p.y + p.height).toBeLessThanOrEqual(platform.y);
    expect(p.onGround).toBe(true);
  });

  test('单向平台：向下移动时阻挡', () => {
    const p = new Player(50, 0);
    p.vy = 10;
    const platform = { x: 0, y: 100, width: 200, height: 10, oneWay: true };
    p.update(1/60, [platform]);
    expect(p.vy).toBe(0);
    expect(p.y).toBe(platform.y - p.height);
    expect(p.onGround).toBe(true);
  });

  test('斜向移动按 X/Y 分量分步解析', () => {
    const p = new Player(0, 0);
    p.vx = 10; p.vy = 10;
    const wall = { x: 50, y: 0, width: 20, height: 400 };
    const floor = { x: 0, y: 200, width: 400, height: 20 };
    p.update(1/60, [wall, floor]);
    expect(p.vx).toBe(0); // 水平分量撞墙归零
    expect(p.x).toBe(wall.x - p.width);
    expect(p.vy).toBe(0); // 垂直分量落地归零
    expect(p.y).toBe(floor.y - p.height);
    expect(p.onGround).toBe(true);
  });

  test('移动距离恰好等于碰撞体厚度（水平边界）', () => {
    const e = { x: 18, y: 100, width: 32, height: 48, vx: 20, vy: 0, onGround: false };
    const wall = { x: 50, y: 0, width: 20, height: 400 }; // 位移 20 恰好等于墙厚
    resolveCollision(e, [wall], 1);
    expect(e.vx).toBe(0);
    expect(e.x).toBe(wall.x - e.width);
  });

  test('移动距离恰好等于碰撞体厚度（垂直边界）', () => {
    const e = { x: 0, y: 52, width: 32, height: 48, vx: 0, vy: 20, onGround: false };
    const floor = { x: 0, y: 100, width: 200, height: 20 }; // 底部贴平台顶，下落 20 恰好等于厚度
    resolveCollision(e, [floor], 1);
    expect(e.vy).toBe(0);
    expect(e.y).toBe(floor.y - e.height);
    expect(e.onGround).toBe(true);
  });

  test('扫掠检测与逐帧小步移动结果一致', () => {
    const floor = { x: 0, y: 200, width: 200, height: 20 };
    const fast = { x: 0, y: 0, width: 32, height: 48, vx: 0, vy: 600, onGround: false };
    resolveCollision(fast, [floor], 1); // 一次 600px 大步
    const slow = { x: 0, y: 0, width: 32, height: 48, vx: 0, vy: 60, onGround: false };
    for (let i = 0; i < 10; i++) resolveCollision(slow, [floor], 1); // 10 次 60px 小步
    expect(fast.y).toBe(floor.y - fast.height);
    expect(fast.y).toBe(slow.y);
    expect(fast.vy).toBe(0);
    expect(slow.vy).toBe(0);
  });

  test('从移动平台跳下时保持相对起跳速度', () => {
    const p = new Player(50, 52);
    const platform = { x: 0, y: 100, width: 200, height: 20, vy: 3 }; // 平台向下移动
    p.update(1/60, [platform]);
    expect(p.onGround).toBe(true);
    p.jump();
    expect(p.vy - platform.vy).toBe(-15); // 相对平台的起跳速度恒定
    expect(p.vy).toBe(-12);
  });

  test('地面检测用脚部窄探针：身体悬出边缘即悬空', () => {
    const p = new Player(195, 52); // 身体仍与地板重叠 5px，但脚底探针已悬空
    const floor = { x: 0, y: 100, width: 200, height: 20 };
    p.update(1/60, [floor]);
    expect(p.x).toBeLessThan(floor.x + floor.width); // 身体确实还在地板上方
    expect(p.onGround).toBe(false);
  });

  test('撞墙后连续两帧状态一致', () => {
    const p = new Player(0, 100);
    p.vx = 10; p.vy = 0;
    const wall = { x: 50, y: 0, width: 20, height: 2000 };
    p.update(1/60, [wall]);
    const s1 = p.getState();
    p.update(1/60, [wall]);
    const s2 = p.getState();
    expect(s1.vx).toBe(0);
    expect(s2.vx).toBe(0);
    expect(s1.x).toBe(wall.x - p.width);
    expect(s2.x).toBe(s1.x);
  });
});
