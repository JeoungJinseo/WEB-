import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GalleryMotion,
  FRAME_IDS,
  frameOpacity,
  frameProjection,
  backgroundWeights,
} from '../lib/gallery-motion.mjs';
const run = (m, seconds = 4, hz = 60) => {
  for (let i = 0; i < Math.ceil(seconds * hz); i++) m.tick(1 / hz);
};
test('six supplied frames preserve order', () =>
  assert.deepEqual(FRAME_IDS, [
    '1062:1896',
    '1062:1598',
    '1068:2532',
    '1068:2585',
    '1068:2630',
    '1068:2673',
  ]));
test('uses the reference .08 target/current damping at 60Hz', () => {
  const m = new GalleryMotion();
  m.goTo(1);
  assert.ok(Math.abs(m.tick(1 / 60) - 0.08) < 1e-12);
  assert.ok(Math.abs(m.tick(1 / 60) - 0.1536) < 1e-12);
});
test('drag follows distance continuously before release', () => {
  const m = new GalleryMotion();
  m.begin(200, 200, 0);
  m.move(160, 200);
  m.tick(1 / 60);
  const a = m.current;
  assert.ok(a > 0 && a < 1);
  m.move(120, 200);
  m.tick(1 / 60);
  assert.ok(m.current > a);
  assert.ok(m.target < 1);
  m.end();
  run(m);
  assert.equal(m.current, 1);
});
test('drag can reverse immediately without waiting for a transition', () => {
  const m = new GalleryMotion();
  m.goTo(2);
  run(m);
  m.begin(200, 200, 0);
  m.move(100, 200);
  run(m, 0.1);
  const previous = m.target;
  m.move(190, 200);
  assert.ok(m.target < previous);
  m.end();
  run(m);
  assert.equal(m.current, 2);
});
test('vertical touch lands in adjacent frame and reverses', () => {
  const m = new GalleryMotion();
  m.begin(100, 100, 0);
  m.move(100, 50);
  m.end();
  run(m);
  assert.equal(m.current, 1);
  m.begin(100, 100, 0);
  m.move(100, 150);
  m.end();
  run(m);
  assert.equal(m.current, 0);
});
test('wheel input is continuous and remains responsive during travel', () => {
  const m = new GalleryMotion();
  m.wheel(80);
  m.tick(1 / 60);
  const target = m.target;
  m.wheel(80);
  assert.ok(m.target > target);
  m.wheel(-40);
  assert.ok(m.target < target + 0.16);
  run(m);
  assert.equal(m.current, 1);
});
test('small pointer jitter does not change frame', () => {
  const m = new GalleryMotion();
  m.begin(100, 100, 0);
  m.move(103, 102);
  m.end();
  run(m);
  assert.equal(m.current, 0);
});
test('both ends remain bounded', () => {
  const m = new GalleryMotion();
  m.goTo(-9);
  run(m);
  assert.equal(m.current, 0);
  m.goTo(99);
  run(m);
  assert.equal(m.current, 5);
});
test('damping is consistent at 60Hz and 120Hz', () => {
  const a = new GalleryMotion(),
    b = new GalleryMotion();
  a.goTo(1);
  b.goTo(1);
  run(a, 0.5, 60);
  run(b, 0.5, 120);
  assert.ok(Math.abs(a.current - b.current) < 1e-9);
});
test('all background composites remain fully opaque throughout travel', () => {
  for (let p = 0; p <= 5; p += 0.013) {
    let alpha = 0;
    for (const a of backgroundWeights(p)) alpha = a + alpha * (1 - a);
    assert.equal(alpha, 1);
  }
});
test('all settled frames and backgrounds reach exactly full opacity', () => {
  for (let index = 0; index < 6; index++) {
    const m = new GalleryMotion();
    m.goTo(index);
    run(m);
    assert.equal(m.current, index);
    assert.equal(frameOpacity(index, m.current), 1);
    assert.equal(backgroundWeights(m.current)[index], 1);
  }
});
test('landing has no visible last-tick jump', () => {
  const m = new GalleryMotion();
  m.goTo(1);
  let previous = 0,
    maxFinalStep = 0;
  for (let i = 0; i < 240; i++) {
    const p = m.tick(1 / 60);
    if (p > 0.999) maxFinalStep = Math.max(maxFinalStep, p - previous);
    previous = p;
  }
  assert.ok(maxFinalStep < 0.0001);
  assert.equal(m.current, 1);
});

test('reverse grab cancels the unfinished forward target at the visible position', () => {
  const m = new GalleryMotion();
  m.goTo(3);
  run(m, 0.12);
  const visible = m.current;
  m.begin(100, 100, 0);
  assert.equal(m.target, visible);
  m.move(150, 100);
  m.tick(1 / 60);
  assert.ok(m.current < visible);
  m.end();
  run(m);
  assert.ok(m.current <= Math.round(visible));
});
test('returning pointer to origin after overscrolling either boundary is reversible', () => {
  for (const start of [0, 5]) {
    const m = new GalleryMotion();
    m.goTo(start);
    run(m);
    m.begin(100, 100, 0);
    m.move(start === 0 ? 1000 : -1000, 100);
    m.move(100, 100);
    m.end();
    run(m);
    assert.equal(m.current, start);
  }
});
test('reverse navigation visits each previous frame exactly once', () => {
  const m = new GalleryMotion();
  m.goTo(5);
  run(m);
  for (let expected = 4; expected >= 0; expected--) {
    m.begin(100, 100, 0);
    m.move(160, 100);
    m.end();
    run(m);
    assert.equal(m.current, expected);
  }
});
test('cancelled capture settles at the visible frame', () => {
  const m = new GalleryMotion();
  m.goTo(2);
  run(m);
  m.begin(100, 100, 0);
  m.move(-200, 100);
  m.end(true);
  run(m);
  assert.equal(m.current, 2);
});
test('reverse projection is finite and identical at the same depth in either direction', () => {
  for (let frame = 0; frame < 6; frame++)
    for (let i = 0; i <= 1000; i++) {
      const progress = i / 200,
        a = frameProjection(frame, progress),
        b = frameProjection(frame, 5 - (1000 - i) / 200);
      assert.ok(Number.isFinite(a.zoom) && a.zoom <= 10 / 3);
      assert.ok(Math.abs(a.zoom - b.zoom) < 1e-10);
      if (Math.abs(frame - progress) >= 1) assert.equal(a.visibility, 0);
    }
});
test('near-camera zoom and visibility have no discontinuity on reverse entry', () => {
  const points = Array.from({ length: 1001 }, (_, i) =>
    frameProjection(2, 3 - i / 1000),
  );
  for (let i = 1; i < points.length; i++) {
    assert.ok(Math.abs(points[i].zoom - points[i - 1].zoom) < 0.005);
    assert.ok(
      Math.abs(points[i].visibility - points[i - 1].visibility) < 0.011,
    );
  }
  assert.equal(points[0].visibility, 0);
  assert.equal(points.at(-1).zoom, 1);
});
