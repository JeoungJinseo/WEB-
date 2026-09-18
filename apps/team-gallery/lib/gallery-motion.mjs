// Adapted from Codrops DepthGallery: separate target/current, damp velocity,
// move through camera depth, and derive every visual from that same progress.
export const FRAME_IDS = [
  '1062:1896',
  '1062:1598',
  '1068:2532',
  '1068:2585',
  '1068:2630',
  '1068:2673',
];
export const LAST_FRAME = FRAME_IDS.length - 1;
export const clamp = (value, min = 0, max = LAST_FRAME) =>
  Math.min(max, Math.max(min, value));
export const damp = (value, target, amount, dt) =>
  value + (target - value) * (1 - Math.pow(1 - amount, dt * 60));
export const smoothstep = (a, b, value) => {
  const t = clamp((value - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Codrops Scroll.js: target/current lerp .08; world factor .01 / plane gap 5.
// Pointer dragging and a gentle idle landing extend the original wheel control.
export class GalleryMotion {
  constructor() {
    this.target = 0;
    this.current = 0;
    this.velocity = 0;
    this.drag = null;
    this.moving = false;
    this.wheelQuiet = 1;
    this.wheelPending = false;
    this.wheelStart = 0;
    this.direction = 0;
  }
  goTo(index) {
    this.drag = null;
    this.target = clamp(Math.round(index));
    this.wheelPending = false;
    this.moving = true;
  }
  wheel(delta) {
    if (this.wheelQuiet > 0.2) this.wheelStart = Math.round(this.target);
    this.direction = Math.sign(delta) || this.direction;
    this.target = clamp(this.target + delta / 500);
    this.wheelQuiet = 0;
    this.wheelPending = true;
    this.moving = true;
  }
  begin(x, y, time) {
    this.wheelPending = false;
    // Grab the rendered position, cancelling the previous landing target.
    this.target = this.current;
    this.drag = {
      x,
      y,
      time,
      origin: this.current,
      axis: null,
      distance: 0,
      start: Math.round(this.current),
    };
  }
  move(x, y) {
    const d = this.drag;
    if (!d) return;
    const dx = d.x - x,
      dy = d.y - y;
    if (!d.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 5)
      d.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    if (!d.axis) return;
    d.distance = d.axis === 'x' ? dx : dy;
    // Absolute displacement preserves reversibility even after hitting a bound.
    this.target = clamp(d.origin + (d.distance * 1.8) / 500);
    this.direction = Math.sign(d.distance) || this.direction;
    this.moving = true;
  }
  end(cancelled = false) {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    let landing = Math.round(cancelled ? this.current : this.target);
    if (!cancelled && Math.abs(d.distance) >= 24 && landing === d.start)
      landing += Math.sign(d.distance);
    this.goTo(landing);
  }
  snap() {
    this.goTo(Math.round(this.target));
  }
  tick(seconds) {
    const dt = clamp(seconds, 0.001, 0.05),
      previous = this.current;
    this.wheelQuiet += dt;
    if (this.wheelPending && this.wheelQuiet > 0.2) {
      let landing = Math.round(this.target);
      if (
        Math.abs(this.target - this.wheelStart) > 0.03 &&
        landing === this.wheelStart
      )
        landing += Math.sign(this.target - this.wheelStart);
      this.goTo(landing);
    }
    this.current = damp(this.current, this.target, 0.08, dt);
    const rawVelocity = clamp(
      ((this.current - previous) * 500) / (dt * 60),
      -1.5,
      1.5,
    );
    this.velocity = damp(this.velocity, rawVelocity, 0.12, dt);
    if (
      !this.drag &&
      !this.wheelPending &&
      Math.abs(this.target - this.current) < 0.00005
    )
      this.current = this.target;
    if (Math.abs(this.velocity) < 0.0001) this.velocity = 0;
    this.moving =
      this.current !== this.target || Math.abs(this.velocity) > 0.0001;
    return this.current;
  }
}
export function frameOpacity(index, progress) {
  // Original visibility: current = 1-blend, next = blend; renderer damps at .14.
  return clamp(1 - Math.abs(progress - index), 0, 1);
}
// Composite the next opaque background over the fully opaque current one.
// Unlike fading both layers, this keeps total background coverage at 100%.
export function backgroundWeights(progress) {
  const p = clamp(progress),
    current = Math.floor(p),
    blend = p - current;
  return FRAME_IDS.map((_, index) =>
    index === current ? 1 : index === current + 1 ? blend : 0,
  );
}

// The original perspective has a singularity when a plane crosses the camera.
// A C1-continuous near distance keeps reverse-entry planes at a finite scale.
export function frameProjection(index, progress) {
  const relativeDistance = 1 + index - progress;
  const distance =
    relativeDistance >= 0.6
      ? relativeDistance
      : 0.3 + 0.3 * Math.exp((relativeDistance - 0.6) / 0.3);
  return {
    zoom: 1 / distance,
    visibility: smoothstep(0, 0.15, frameOpacity(index, progress)),
  };
}
