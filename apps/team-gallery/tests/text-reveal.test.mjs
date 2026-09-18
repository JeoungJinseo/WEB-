import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FrameRevealGate,
  createFrameTextReveals,
  graphemes,
  revealProfile,
} from '../lib/text-reveal.mjs';
import { GalleryMotion } from '../lib/gallery-motion.mjs';

const track = () => {
  const entered = [],
    reset = [],
    finished = [];
  const gate = new FrameRevealGate(
    6,
    (i) => entered.push(i),
    (i) => reset.push(i),
    (i) => finished.push(i),
  );
  return { gate, entered, reset, finished };
};

test('every complete frame entry replays in forward and reverse order', () => {
  const { gate, entered } = track();
  const motion = new GalleryMotion();
  gate.update(0);
  for (const destination of [1, 2, 3, 4, 5, 4, 3, 2, 1, 0]) {
    motion.goTo(destination);
    for (let tick = 0; tick < 240; tick++) gate.update(motion.tick(1 / 60));
  }
  assert.deepEqual(entered, [0, 1, 2, 3, 4, 5, 4, 3, 2, 1, 0]);
});

test('midpoint jitter and an interrupted reverse drag never restart visible letters', () => {
  const { gate, entered, reset } = track();
  for (const depth of [0, 0.39, 0.49, 0.51, 0.48, 0.52, 0.6, 0.5, 0.39, 0.1])
    gate.update(depth);
  assert.deepEqual(entered, [0, 1]);
  assert.deepEqual(reset, []);
  gate.update(0);
  assert.deepEqual(reset, [1]);
  gate.update(0.4);
  assert.deepEqual(entered, [0, 1, 1]);
});

test('reduced motion immediately finishes all text and stays still on navigation', () => {
  const { gate, entered, finished } = track();
  gate.update(0);
  gate.update(0.4);
  for (const p of [0.4, 3, 5, 0]) gate.update(p, true);
  assert.deepEqual(finished, [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(entered, [0, 1]);
  gate.update(0, false);
  gate.update(1);
  assert.deepEqual(entered, [0, 1, 1]);
});

test('reference title unfolds from the final character at 30ms intervals', () => {
  assert.equal(revealProfile('title', 9, 10).options.delay, 0);
  assert.equal(revealProfile('title', 0, 10).options.delay, 270);
  const { keyframes, options } = revealProfile('title', 0, 10);
  assert.equal(options.duration, 2200);
  assert.equal(
    keyframes[0].transform,
    'translate3d(102%,0,0) rotateY(90deg) scaleX(3)',
  );
  assert.equal(
    keyframes.at(-1).transform,
    'translate3d(0%,0,0) rotateY(0deg) scaleX(1)',
  );
  for (const kind of ['title', 'role', 'body', 'meta']) {
    const { keyframes } = revealProfile(kind, 0, 3);
    assert.ok(
      keyframes.every((frame) => !/NaN|Infinity/.test(frame.transform)),
    );
  }
});

test('grapheme offsets preserve Korean, combined accents, and emoji families', () => {
  const text = '김 é 👨‍👩‍👧‍👦';
  const parts = graphemes(text);
  assert.deepEqual(
    parts.map((p) => p.segment),
    ['김', ' ', 'é', ' ', '👨‍👩‍👧‍👦'],
  );
  for (const p of parts)
    assert.equal(text.slice(p.index, p.index + p.segment.length), p.segment);
});

// Small DOM/WAAPI fixture exercises real cleanup without a visual browser test.
function fixture(t, { pendingFonts = false, missingAnimation = false } = {}) {
  const animations = [];
  const style = () => ({
    removeProperty(key) {
      delete this[key];
    },
  });
  class Element {
    constructor() {
      this.style = style();
      this.children = [];
    }
    setAttribute() {}
    removeAttribute() {}
    append(child) {
      this.children.push(child);
      child.parent = this;
    }
    remove() {
      this.parent.children = this.parent.children.filter((c) => c !== this);
    }
    cloneNode() {
      return new Element();
    }
    animate() {
      if (missingAnimation) throw new Error('No WAAPI');
      const a = {
        cancelled: false,
        onfinish: null,
        cancel() {
          this.cancelled = true;
        },
      };
      animations.push(a);
      return a;
    }
  }
  const source = new Element(),
    target = new Element(),
    copy = new Element();
  const rect = { left: 10, top: 20, width: 120, height: 24 };
  target.dataset = { reveal: 'body' };
  target.querySelector = () => source;
  target.getBoundingClientRect = () => rect;
  copy.querySelectorAll = () => [target];
  let resolveFonts;
  const fonts = pendingFonts
    ? new Promise((resolve) => {
        resolveFonts = resolve;
      })
    : Promise.resolve();
  const previous = globalThis.document;
  const mockDocument = {
    fonts: { ready: fonts },
    createRange: () => ({
      selectNodeContents() {},
      getClientRects: () => [rect],
    }),
    createElement: () => new Element(),
  };
  globalThis.document = mockDocument;
  t.after(() => {
    globalThis.document = previous;
  });
  const controller = createFrameTextReveals(
    [{ querySelector: () => copy }],
    () => 1,
  );
  return { controller, source, target, copy, animations, resolveFonts };
}

test('completion restores accessible native text and removes every mask', async (t) => {
  const f = fixture(t);
  await Promise.resolve();
  assert.equal(f.source.style.opacity, '0');
  assert.equal(f.target.children.length, 1);
  f.animations[0].onfinish();
  assert.equal(f.source.style.opacity, undefined);
  assert.equal(f.target.children.length, 0);
  assert.ok(f.animations.every((a) => a.cancelled));
  f.controller.dispose();
});

test('resize and reverse re-entry cancel old animations before creating new ones', async (t) => {
  const f = fixture(t);
  await Promise.resolve();
  f.controller.resize();
  assert.equal(f.target.children.length, 0);
  assert.equal(f.source.style.opacity, undefined);
  f.controller.update(1, false);
  assert.equal(f.copy.style.visibility, 'hidden');
  f.controller.update(0, false);
  assert.equal(f.animations.length, 2);
  f.controller.dispose();
  assert.ok(f.animations.every((a) => a.cancelled && !a.onfinish));
  assert.equal(f.copy.style.visibility, undefined);
  assert.equal(f.target.children.length, 0);
});

test('unsupported animation leaves native text readable', async (t) => {
  const f = fixture(t, { missingAnimation: true });
  await Promise.resolve();
  assert.equal(f.source.style.opacity, undefined);
  assert.equal(f.target.children.length, 0);
  f.controller.dispose();
});

test('unmount before fonts load cannot launch a late reveal', async (t) => {
  const pending = fixture(t, { pendingFonts: true });
  pending.controller.dispose();
  pending.resolveFonts();
  await Promise.resolve();
  assert.equal(pending.animations.length, 0);
  assert.equal(pending.copy.style.visibility, undefined);
});
