
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
