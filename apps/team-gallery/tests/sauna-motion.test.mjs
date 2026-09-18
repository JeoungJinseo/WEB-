import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SaunaMotion,
  STEAM_CAPACITY,
  steamEmitterPose,
  saunaCameraZ,
} from '../lib/sauna-motion.mjs';
const pointer = { x: 0, y: 0 };
const advance = (m, from, to, start = 0, duration = 1, hz = 60) => {
  for (let i = 0; i <= duration * hz; i++) {
    m.update(
      from + ((to - from) * i) / (duration * hz),
      pointer,
      start + (i * 1000) / hz,
      1.4,
    );
  }
};

test('steam emitter shares gallery depth and stays within the lower viewport at mobile and desktop ratios', () => {
  for (const aspect of [0.46, 1, 1.40625, 2.4, 3.2]) {
    for (let p = 0; p <= 5; p += 0.003) {
      const pose = steamEmitterPose(p, aspect);
      const depth = saunaCameraZ(p) - pose.z;
      const halfHeight = Math.tan(Math.PI / 8) * depth;
      assert.ok(depth > 6 && depth < 8);
      assert.ok(Math.abs(pose.x / (halfHeight * aspect)) <= 0.76);
      assert.ok(pose.y / halfHeight > -0.62 && pose.y / halfHeight < -0.38);
      assert.ok(Object.values(pose).every(Number.isFinite));
    }
  }
  assert.equal(saunaCameraZ(0), 5);
  assert.equal(saunaCameraZ(5), -20);
});

test('steam route is continuous in either direction at every frame boundary', () => {
  for (let i = 1; i < 5; i++) {
    const a = steamEmitterPose(i - 0.00001),
      b = steamEmitterPose(i + 0.00001);
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 0.002);
  }
});

test('reverse input changes steam flow and fades its old wake without stretching it', () => {
  const m = new SaunaMotion(() => 0.5);
  advance(m, 0, 0.7);
  const p = m.particles.find((p) => p.life > 0.6);
  const oldLife = p.life,
    oldSize = p.size;
  m.update(0.65, pointer, 1016.67, 1.4);
  assert.equal(m.direction, -1);
  assert.equal(m.flowDirection, -1);
  assert.ok(p.retire < 0.24 && p.retire > 0);
  assert.ok(Math.abs(p.life - oldLife) < 0.02);
  assert.equal(p.size, oldSize);
});

test('steam rises and expands with age, then fully dissipates when dragging stops', () => {
  const m = new SaunaMotion(() => 0.5);
  advance(m, 0, 1);
  const puff = m.particles.find((p) => p.life > 0.5),
    y = puff.y;
  m.update(1, pointer, 1016.67, 1.4);
  assert.ok(puff.y > y);
  advance(m, 1, 1, 1033, 2);
  assert.ok(m.particles.every((p) => p.life === 0));
  assert.ok(m.activity < 0.001);
});

test('rapid forward/reverse traversal keeps a fixed pool and finite world coordinates', () => {
  const m = new SaunaMotion(() => 0.7);
  for (let i = 0; i < 4000; i++) {
    const p = 2.5 + Math.sin(i / 50) * 2.5;
    m.update(p, { x: Math.sin(i), y: Math.cos(i) }, (i * 1000) / 120, 0.6);
    assert.equal(m.particles.length, STEAM_CAPACITY);
    assert.ok(m.particles.filter((p) => p.life > 0).length <= STEAM_CAPACITY);
    for (const p of m.particles)
      if (p.life > 0) assert.ok(Object.values(p).every(Number.isFinite));
  }
  m.dispose();
  assert.equal(m.particles.length, 0);
});

test('steam emission and easing remain consistent at 60Hz and 120Hz', () => {
  const a = new SaunaMotion(() => 0.5),
    b = new SaunaMotion(() => 0.5);
  advance(a, 0, 2, 0, 2, 60);
  advance(b, 0, 2, 0, 2, 120);
  assert.ok(Math.abs(a.activity - b.activity) < 0.005);
  assert.ok(Math.abs(a.pose.x - b.pose.x) < 1e-8);
});

test('reduced motion clears vapor immediately and does not replay stale travel on resume', () => {
  const m = new SaunaMotion(() => 0.5);
  advance(m, 0, 2);
  m.update(4, pointer, 1100, 1.4, true);
  assert.ok(m.particles.every((p) => p.life === 0));
  assert.equal(m.activity, 0);
  m.update(4, pointer, 1116.67, 1.4, false);
  assert.equal(m.activity, 0);
  m.dispose();
});
