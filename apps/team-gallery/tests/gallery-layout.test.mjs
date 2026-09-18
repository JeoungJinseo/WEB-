import assert from 'node:assert/strict';
import test from 'node:test';
import { fitGalleryFrame } from '../lib/gallery-layout.mjs';

const close = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 0.001, `${actual} != ${expected}`);

test('portrait, landscape and wide screens contain the complete two-column composition', () => {
  for (const [w, h] of [
    [320, 568],
    [393, 655],
    [390, 844],
    [430, 932],
    [568, 320],
    [844, 390],
    [768, 1024],
    [1024, 768],
    [1440, 1024],
    [2684, 1286],
  ]) {
    const f = fitGalleryFrame(w, h);
    assert.ok(f.left >= 0 && f.top >= 0);
    assert.ok(f.left + f.width * f.scale <= w + 0.001);
    assert.ok(f.top + f.height * f.scale <= h + 0.001);
    if (f.format === 'desktop') {
      assert.ok(f.width >= 1440);
      close(f.height, 1024);
      close(f.width * f.scale, w);
    } else {
      close(f.width, 720);
      if (f.format === 'compact-portrait') {
        assert.ok(f.height >= 1024);
        close(f.height * f.scale, h);
        close(f.top, 0);
      } else {
        close(f.height, 640);
      }
    }
    close(f.left * 2 + f.width * f.scale, w);
    close(f.top * 2 + f.height * f.scale, h);
    assert.ok(f.scale > 0);
  }
});

test('landscape notches and home indicator cannot cover the artboard', () => {
  const f = fitGalleryFrame(844, 390, {
    left: 59,
    right: 59,
    top: 0,
    bottom: 21,
  });
  assert.ok(f.left >= 59);
  assert.ok(f.left + f.width * f.scale <= 844 - 59);
  assert.ok(f.top + f.height * f.scale <= 390 - 21);
});

test('browser chrome height changes preserve all relative photo and text dimensions', () => {
  const open = fitGalleryFrame(393, 655);
  const closed = fitGalleryFrame(393, 759);
  close(open.scale, closed.scale);
  close(open.top, closed.top);
  close((closed.height - open.height) * open.scale, 104);
});

test('portrait canvas fills the safe area without a centered letterbox', () => {
  const f = fitGalleryFrame(393, 852, { top: 59, bottom: 34 });
  close(f.top, 59);
  close(f.top + f.height * f.scale, 852 - 34);
  close(f.width * f.scale, 393);
});

test('browser bar and rotation changes always produce a centered, contained format', () => {
  for (const w of [599, 600, 699, 700, 739, 740]) {
    const a = fitGalleryFrame(w, 900),
      b = fitGalleryFrame(w + 1, 900);
    // A one-pixel viewport change must not jump the composition's size.
    assert.ok(Math.abs(a.scale - b.scale) * a.width <= 1.001);
    close(a.width, b.width);
    close(a.top, b.top);
  }
  const portrait = fitGalleryFrame(393, 655);
  const landscape = fitGalleryFrame(655, 393);
  assert.equal(portrait.format, 'compact-portrait');
  assert.equal(landscape.format, 'compact-landscape');
  close(portrait.width, landscape.width);
  assert.ok(landscape.scale > portrait.scale);
});
