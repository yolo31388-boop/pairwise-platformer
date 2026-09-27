const { Player } = require('../src/entities/player.js');
const { resolveCollision, checkGround } = require('../src/physics/collision.js');

const DT = 1 / 60;

describe('平台跳跃碰撞检测', () => {
  test('高速下落不应穿透地板', () => {
    const p = new Player(100, 0);
    p.vy = 1000; // 高速下落：单帧位移远大于地板厚度
    const floor = { x: 0, y: 200, width: 200, height: 20 };
    p.update(DT, [floor]);
    expect(p.y + p.height).toBeLessThanOrEqual(floor.y + 1);
    expect(p.y).toBeGreaterThan(0);
  });

  test('水平撞墙后速度应归零', () => {
    const p = new Player(0, 100);
    p.vx = 30; p.vy = 0;
    const wall = { x: 50, y: 0, width: 20, height: 200 };
    p.update(DT, [wall]);
    expect(p.vx).toBe(0);
  });

  test('垂直落地后速度应归零', () => {
    const p = new Player(100, 0);
    p.vy = 60;
    const floor = { x: 0, y: 100, width: 200, height: 20 };
    p.update(DT, [floor]);
    expect(p.vy).toBe(0);
    expect(p.onGround).toBe(true);
  });

  test('边缘落下应触发悬空', () => {
    const p = new Player(190, 80);
    p.vx = 5; p.vy = 0;
    const floor = { x: 0, y: 100, width: 200, height: 20 };
    p.update(DT, [floor]);
    p.update(DT, [floor]);
    expect(p.onGround).toBe(false);
  });

  test('碰撞后位置不应嵌入碰撞体超过1像素', () => {
    const p = new Player(100, 0);
    p.vy = 200;
    const floor = { x: 0, y: 100, width: 200, height: 20 };
    p.update(DT, [floor]);
    expect(p.y + p.height).toBeLessThanOrEqual(floor.y + 1);
  });

  test('连续两帧碰撞状态一致', () => {
    const p = new Player(100, 52);
    const floor = { x: 0, y: 100, width: 200, height: 20 };
    p.update(DT, [floor]);
    const y1 = p.y;
    p.update(DT, [floor]);
    expect(p.y).toBe(y1);
    expect(p.onGround).toBe(true);
  });
});

describe('碰撞不变量（分步解析 + 扫掠检测）', () => {
  test('水平高速移动不应穿墙且撞墙后速度归零', () => {
    const p = new Player(0, 100);
    p.vx = 200; // 单帧位移 200px，远大于墙厚 20px，只看最终位置会漏检
    const wall = { x: 50, y: 0, width: 20, height: 200 };
    p.update(DT, [wall]);
    expect(p.vx).toBe(0);
    expect(p.x).toBe(18); // 停在墙面左侧：50 - 32
    expect(p.x + p.width).toBeLessThanOrEqual(wall.x + 1); // 嵌入不超过 1px
  });

  test('高速下落不穿透地板且落地后速度归零', () => {
    const p = new Player(100, 0);
    p.vy = 2000; // 单帧位移约为地板厚度的 100 倍
    const floor = { x: 0, y: 200, width: 200, height: 20 };
    p.update(DT, [floor]);
    expect(p.vy).toBe(0);
    expect(p.onGround).toBe(true);
    expect(p.y).toBe(152); // 停在地板顶面：200 - 48
    expect(p.y + p.height).toBeLessThanOrEqual(floor.y + 1);
  });

  test('单向平台向上移动时穿过', () => {
    const p = new Player(100, 150);
    p.vy = -50; // 向上跳
    const platform = { x: 0, y: 100, width: 200, height: 20, oneWay: true };
    p.update(DT, [platform]);
    const y1 = p.y;
    expect(p.vy).toBeLessThan(0); // 向上速度不被清零
    expect(p.onGround).toBe(false);
    p.update(DT, [platform]);
    expect(p.y).toBeLessThan(y1); // 继续上升，不被平台挡住
    expect(p.vy).toBeLessThan(0);
  });

  test('单向平台向下移动时阻挡', () => {
    const p = new Player(100, 50);
    p.vy = 10; // 下落
    const platform = { x: 0, y: 100, width: 200, height: 20, oneWay: true };
    p.update(DT, [platform]);
    expect(p.y).toBe(52); // 停在平台顶面：100 - 48
    expect(p.vy).toBe(0);
    expect(p.onGround).toBe(true);
  });

  test('从下方跳穿单向平台后能落回顶面', () => {
    const p = new Player(100, 150);
    p.vy = -30;
    const platform = { x: 0, y: 100, width: 200, height: 20, oneWay: true };
    for (let i = 0; i < 150; i++) p.update(DT, [platform]);
    expect(p.onGround).toBe(true);
    expect(p.y).toBe(52); // 最终站在平台顶面
  });

  test('走出平台边缘应正确触发悬空而不是卡在边缘', () => {
    const p = new Player(170, 52); // 站在地板右边缘附近
    p.vx = 5;
    const floor = { x: 0, y: 100, width: 200, height: 20 };
    for (let i = 0; i < 10; i++) p.update(DT, [floor]);
    expect(p.x).toBeGreaterThan(200); // 持续走出边缘，没有被卡住
    expect(p.onGround).toBe(false); // 脚部探针离开平台后悬空
    expect(p.y).toBeGreaterThan(52); // 开始下落
  });

  test('斜向移动按 X、Y 分量分步解析', () => {
    const p = new Player(0, 0);
    p.vx = 30; p.vy = 10; // 斜向右下撞墙
    const wall = { x: 50, y: 0, width: 20, height: 200 };
    p.update(DT, [wall]);
    expect(p.x).toBe(18); // X 分量被墙挡住：50 - 32
    expect(p.vx).toBe(0); // 水平速度按法线归零
    expect(p.vy).toBeCloseTo(10.8, 6); // 垂直速度不受水平碰撞影响
    expect(p.y).toBeCloseTo(10.8, 6); // Y 分量完成完整位移
  });

  test('移动距离恰好等于碰撞体厚度的边界情况', () => {
    const floor = { x: 0, y: 100, width: 200, height: 20 };
    // 位移恰好等于地板厚度 20：最终位置与地板底边相切，只看最终位置会漏检
    const e1 = { x: 100, y: 52, width: 32, height: 48, vx: 0, vy: 20, onGround: false };
    resolveCollision(e1, [floor], DT);
    expect(e1.y).toBe(52); // 扫掠检测在 t=0 拦截，不嵌入
    expect(e1.vy).toBe(0);
    // 位移恰好等于到地板的距离：恰好落在顶面上
    const e2 = { x: 100, y: 0, width: 32, height: 48, vx: 0, vy: 52, onGround: false };
    resolveCollision(e2, [floor], DT);
    expect(e2.y).toBe(52);
    expect(e2.vy).toBe(0);
  });

  test('高速落地后连续两帧碰撞状态一致', () => {
    const p = new Player(100, 0);
    p.vy = 60;
    const floor = { x: 0, y: 100, width: 200, height: 20 };
    p.update(DT, [floor]);
    const s1 = p.getState();
    p.update(DT, [floor]);
    const s2 = p.getState();
    expect(s1.y).toBe(52);
    expect(s2.y).toBe(s1.y); // 静止后位置不抖动
    expect(s2.vy).toBe(0);
    expect(s2.onGround).toBe(true);
  });

  test('扫掠检测与逐帧小步移动结果一致', () => {
    const floor = { x: 0, y: 100, width: 200, height: 20 };
    // 单帧大步：vy=600 一步落下
    const fast = { x: 100, y: 0, width: 32, height: 48, vx: 0, vy: 600, onGround: false };
    resolveCollision(fast, [floor], DT);
    // 多帧小步：vy=10 分 60 步落下
    const slow = { x: 100, y: 0, width: 32, height: 48, vx: 0, vy: 10, onGround: false };
    for (let i = 0; i < 60; i++) {
      slow.vy = 10;
      resolveCollision(slow, [floor], DT);
    }
    expect(fast.y).toBe(52);
    expect(slow.y).toBe(52);
    expect(fast.y).toBe(slow.y);
  });

  test('从移动平台上跳下的相对速度正确', () => {
    const platform = { x: 0, y: 100, width: 200, height: 20, vy: 3 }; // 平台匀速下降
    const p = new Player(100, 52);
    p.update(DT, [platform]);
    expect(p.onGround).toBe(true);
    // 平台下降一帧，玩家被承载跟随
    platform.y += platform.vy;
    p.y += platform.vy;
    p.update(DT, [platform]);
    expect(p.onGround).toBe(true);
    p.jump();
    expect(p.vy - platform.vy).toBe(-18); // 起跳瞬间相对平台的速度：-15 - 3
    p.update(DT, [platform]);
    platform.y += platform.vy;
    expect(p.vy).toBeLessThan(0); // 世界系中向上运动
    expect(p.vy - platform.vy).toBeLessThan(0); // 相对平台向上分离
    expect(p.onGround).toBe(false); // 起跳后离开平台
    expect(p.y + p.height).toBeLessThan(platform.y); // 与平台拉开距离
  });
});
