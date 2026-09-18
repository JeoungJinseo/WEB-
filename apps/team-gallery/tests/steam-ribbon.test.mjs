import test from 'node:test';
import assert from 'node:assert/strict';
import { SteamRibbon } from '../lib/steam-ribbon.mjs';
import { steamEmitterPose } from '../lib/sauna-motion.mjs';
const pointer = { x: 0, y: 0 };

test('one connected steam mesh remains visible and unchanged after a minute at rest', () => {
  const ribbon = new SteamRibbon();
  ribbon.update(2, 1.4, 1000, pointer, false);
  const positions = ribbon.positions.slice();
  const opacity = ribbon.material.uniforms.opacity.value;
  const geometry = ribbon.geometry;
  ribbon.update(2, 1.4, 61000, pointer, false);
  assert.deepEqual(ribbon.positions, positions);
  assert.equal(ribbon.geometry, geometry);
  assert.equal(ribbon.object.visible, true);
  assert.equal(ribbon.material.uniforms.opacity.value, opacity);
  assert.equal(ribbon.material.uniforms.time.value, 61);
  assert.ok(opacity > 0);
  assert.equal(ribbon.geometry.index.count, 160 * 6);
  ribbon.dispose();
});

test('forward and reverse travel produce identical geometry without resetting the line', () => {
  const ribbon = new SteamRibbon();
  const snapshots = [];
  for (let i = 0; i <= 50; i++) {
    ribbon.update(i / 10, 1.4, i * 16, pointer, false);
    snapshots.push(ribbon.positions.slice());
    assert.ok(ribbon.positions.every(Number.isFinite));
  }
  for (let i = 50; i >= 0; i--) {
    ribbon.update(i / 10, 1.4, (100 - i) * 16, pointer, false);
    assert.deepEqual(ribbon.positions, snapshots[i]);
  }
  ribbon.dispose();
});

test('ribbon head stays attached to the steam emitter across viewport ratios', () => {
  const ribbon = new SteamRibbon();
  for (const aspect of [0.46, 1.4, 2.4])
    for (let progress = 0; progress <= 5; progress++) {
      ribbon.update(progress, aspect, progress * 1000, pointer, false);
      const end = ribbon.positions.slice(-6),
        p = steamEmitterPose(progress, aspect);
      assert.ok(Math.abs((end[0] + end[3]) / 2 - p.x) < 1e-5);
      assert.ok(Math.abs((end[1] + end[4]) / 2 - p.y) < 1e-5);
      assert.ok(Math.abs(end[2] - p.z) < 1e-5);
    }
  ribbon.dispose();
});

test('reduced motion hides the whole ribbon and teardown releases resources once', () => {
  const ribbon = new SteamRibbon();
  let disposed = 0;
  ribbon.geometry.addEventListener('dispose', () => disposed++);
  ribbon.material.addEventListener('dispose', () => disposed++);
  ribbon.update(1, 1.4, 1000, pointer, true);
  assert.equal(ribbon.object.visible, false);
  ribbon.update(1, 1.4, 1100, pointer, false);
  assert.equal(ribbon.object.visible, true);
  ribbon.dispose();
  ribbon.dispose();
  assert.equal(disposed, 2);
});
