// Motion measured from romanjeanelie.com: masked characters, 800px perspective,
// 102% X entry / 90deg Y rotation, 3→1 stretch, 30ms reverse stagger, Expo out.
// Implemented with native Web Animations; no reference-site bundle is shipped.
const segmenter = new Intl.Segmenter('ko', { granularity: 'grapheme' });
export const graphemes = (text) => Array.from(segmenter.segment(text));
const expoOut = (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * Math.max(0, t)));
const powerOut = (t) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

export function revealProfile(kind, index, count, group = 0) {
  const title = kind === 'title',
    role = kind === 'role';
  const duration = title ? 2200 : role ? 500 : 800;
  const delay = title
    ? (count - 1 - index) * 30
    : role
      ? 125 + (count - 1 - index) * 30
      : 220 + group * 110 + index * 65;
  const keyframes = Array.from({ length: 89 }, (_, step) => {
    const t = step / 88,
      elapsed = t * duration;
    if (title) {
      const move = expoOut(elapsed / 1000),
        stretch = expoOut(t);
      return {
        offset: t,
        transform: `translate3d(${102 * (1 - move)}%,0,0) rotateY(${90 * (1 - move)}deg) scaleX(${3 - 2 * stretch})`,
      };
    }
    return {
      offset: t,
      transform: role
        ? `rotateY(${90 * (1 - powerOut(t))}deg)`
        : `translate3d(0,${110 * (1 - expoOut(t))}%,0)`,
    };
  });
  return {
    keyframes,
    options: { duration, delay, fill: 'both', easing: 'linear' },
  };
}

// Arm again only after the old frame has faded away. Reversing a partial drag
// continues its existing reveal instead of repeatedly hiding text at the midpoint.
export class FrameRevealGate {
  constructor(count, enter, reset, finish) {
    this.states = Array(count).fill(false);
    this.enter = enter;
    this.reset = reset;
    this.finish = finish;
    this.reduced = false;
  }
  update(progress, reduced = false) {
    if (reduced) {
      if (!this.reduced) this.states.forEach((_, i) => this.finish(i));
      this.states.fill(true);
    } else {
      this.states.forEach((shown, index) => {
        const distance = Math.abs(progress - index);
        if (distance >= 0.98 && shown) {
          this.states[index] = false;
          this.reset(index);
        } else if (distance <= 0.62 && !shown) {
          this.states[index] = true;
          this.enter(index);
        }
      });
    }
    this.reduced = reduced;
  }
}

function measure(target, scale) {
  const source = target.querySelector('[data-reveal-source]');
  const bounds = target.getBoundingClientRect();
  const range = document.createRange();
  const boxes = [];
  const add = (rect) => {
    if (rect.width <= 0 || rect.height <= 0) return;
    boxes.push({
      x: (rect.left - bounds.left) / scale,
      y: (rect.top - bounds.top) / scale,
      width: rect.width / scale,
      height: rect.height / scale,
    });
  };
  const kind = target.dataset.reveal;
  if (kind === 'title' || kind === 'role') {
    const walker = document.createTreeWalker(source, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      for (const { segment, index } of graphemes(node.textContent)) {
        if (/^\s+$/u.test(segment)) continue;
        range.setStart(node, index);
        range.setEnd(node, index + segment.length);
        Array.from(range.getClientRects()).forEach(add);
      }
    }
  } else {
    // The browser's own line boxes keep Korean wrapping and Figma typography.
    range.selectNodeContents(source);
    Array.from(range.getClientRects()).forEach(add);
  }
  return { target, source, kind, boxes, width: bounds.width / scale };
}

function play(plan, group, runs) {
  if (!plan.boxes.length) return;
  const { target, source, boxes, kind, width } = plan;
  const overlay = document.createElement('span');
  overlay.className = 'text-reveal-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  const animations = [];
  let finished = false;
  const cleanup = () => {
    if (finished) return;
    finished = true;
    animations.forEach((animation) => {
      animation.onfinish = null;
      animation.cancel();
    });
    source.style.removeProperty('opacity');
    overlay.remove();
    runs.delete(cleanup);
  };
  runs.add(cleanup);
  try {
    // Clone the complete, normally shaped text into each measured mask. Native
    // kerning, baseline, line breaks and final text dimensions remain untouched.
    const pieces = boxes.map((box) => {
      const mask = document.createElement('span');
      mask.className = 'text-reveal-mask';
      Object.assign(mask.style, {
        left: `${box.x}px`,
        top: `${box.y}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
      });
      const piece = document.createElement('span');
      piece.className = 'text-reveal-piece';
      const clone = source.cloneNode(true);
      clone.removeAttribute('data-reveal-source');
      clone.className = 'text-reveal-clone';
      Object.assign(clone.style, {
        left: `${-box.x}px`,
        top: `${-box.y}px`,
        width: `${width}px`,
      });
      piece.append(clone);
      mask.append(piece);
      overlay.append(mask);
      return piece;
    });
    target.append(overlay);
    source.style.opacity = '0';
    let remaining = pieces.length;
    pieces.forEach((piece, index) => {
      const { keyframes, options } = revealProfile(
        kind,
        index,
        pieces.length,
        group,
      );
      const animation = piece.animate(keyframes, options);
      animations.push(animation);
      animation.onfinish = () => {
        if (!finished && --remaining === 0) cleanup();
      };
    });
  } catch {
    // A missing animation API must never leave the original copy hidden.
    cleanup();
  }
}

export function createFrameTextReveals(frames, getScale) {
  const copies = frames.map((frame) => frame.querySelector('.frame-copy'));
  const targets = copies.map((copy) =>
    Array.from(copy.querySelectorAll('[data-reveal]')),
  );
  const runs = frames.map(() => new Set());
  let disposed = false,
    ready = false,
    progress = 0,
    reduced = false;
  const clear = (index) =>
    Array.from(runs[index]).forEach((finish) => finish());
  const finish = (index) => {
    clear(index);
    copies[index].style.removeProperty('visibility');
  };
  const reset = (index) => {
    clear(index);
    copies[index].style.visibility = 'hidden';
  };
  const enter = (index) => {
    // Batch all reads before writes to avoid layout thrashing on section entry.
    const plans = targets[index].map((target) =>
      measure(target, getScale(index)),
    );
    let paragraph = 0;
    plans.forEach((plan) => {
      play(plan, plan.kind === 'body' ? paragraph++ : 0, runs[index]);
    });
    copies[index].style.removeProperty('visibility');
  };
  const gate = new FrameRevealGate(frames.length, enter, reset, finish);
  copies.forEach((_, index) => reset(index));
  const fontsReady = () => {
    if (disposed) return;
    ready = true;
    gate.update(progress, reduced);
  };
  Promise.resolve(document.fonts?.ready).then(fontsReady, fontsReady);
  return {
    update(nextProgress, nextReduced) {
      progress = nextProgress;
      reduced = nextReduced;
      if (ready && !disposed) gate.update(progress, reduced);
    },
    resize() {
      // Layout can change while revealing. Restore real text, discard old masks.
      if (ready)
        gate.states.forEach((shown, i) => {
          if (shown) finish(i);
        });
    },
    dispose() {
      disposed = true;
      copies.forEach((_, index) => finish(index));
    },
  };
}
