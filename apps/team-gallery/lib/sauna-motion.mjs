const clamp = (x, low = 0, high = 1) => Math.min(high, Math.max(low, x));
const follow = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
export const STEAM_CAPACITY = 32;
export const saunaCameraZ = (progress) => 5 - clamp(progress, 0, 5) * 5;

// A low, continuous route leaves the member copy readable. Z shares the gallery
// camera, while older vapor stays in world space and recedes/approaches naturally.
export function steamPathPoint(p, aspect = 1440 / 1024) {
  const depth = 6.8 + Math.sin(p * Math.PI * 2 + 0.5) * 0.75;
  const halfHeight = Math.tan(Math.PI / 8) * depth;
  return {
    x: Math.sin(p * Math.PI * 0.6 - 0.9) * halfHeight * aspect * 0.76,
    y: (-0.5 + Math.sin(p * 1.8) * 0.11) * halfHeight,
    z: 5 - p * 5 - depth,
  };
}

export const steamEmitterPose = (progress, aspect = 1440 / 1024) =>
  steamPathPoint(clamp(progress, 0, 5), aspect);

export class SaunaMotion {
  constructor(random = Math.random) {
    this.random = random;
    this.particles = Array.from({ length: STEAM_CAPACITY }, () => ({
      life: 0,
    }));
    this.previousProgress = null;
    this.previousTime = null;
    this.direction = 1;
    this.flowDirection = -1;
    this.activity = 0;
    this.spawnCredit = 0;
    this.cursor = 0;
    this.pose = steamEmitterPose(0);
  }
  clear() {
    this.particles.forEach((p) => {
      p.life = 0;
    });
    this.spawnCredit = 0;
    this.activity = 0;
  }
  update(progress, pointer, time, aspect, reduced = false) {
    const dt =
      this.previousTime === null
        ? 1 / 60
        : clamp((time - this.previousTime) / 1000, 0, 0.05);
    const distance =
      this.previousProgress === null ? 0 : progress - this.previousProgress;
    this.previousProgress = progress;
    this.previousTime = time;
    this.pose = steamEmitterPose(progress, aspect);
    this.pose.x += pointer.x * 0.08;
    this.pose.y -= pointer.y * 0.035;
    if (reduced) {
      this.clear();
      return;
    }
    const speed = dt > 0 ? Math.abs(distance) / dt : 0;
    const moving = speed > 0.015;
    if (moving) {
      const direction = Math.sign(distance);
      if (direction !== this.direction) {
        // Gently retire the old wake on reversal; no long bridge or hard reset.
        this.particles.forEach((p) => {
          p.retire = Math.min(p.retire, 0.24);
        });
      }
      this.direction = direction;
      const tangent = Math.cos(progress * Math.PI * 0.6 - 0.9) * direction;
      if (Math.abs(tangent) > 0.08) this.flowDirection = Math.sign(tangent);
    }
    this.activity = follow(
      this.activity,
      moving ? clamp(speed / 1.8, 0.15, 1) : 0,
      12,
      dt,
    );
    for (const p of this.particles) {
      if (p.life <= 0) continue;
      p.life = Math.max(0, p.life - dt);
      if (p.retire <= 0.24) {
        p.retire = Math.max(0, p.retire - dt);
        if (p.retire === 0) p.life = 0;
      }
      p.x += (p.vx + Math.sin(p.seed + (p.total - p.life) * 3) * 0.055) * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
    }
    if (moving) {
      this.spawnCredit += (9 + 5 * this.activity) * dt;
      while (this.spawnCredit >= 1) {
        this.spawnCredit--;
        const p = this.particles[this.cursor++ % STEAM_CAPACITY];
        const r = this.random;
        Object.assign(p, {
          x: this.pose.x + (r() - 0.5) * 0.08,
          y: this.pose.y + (r() - 0.5) * 0.05,
          z: this.pose.z - 0.12,
          vx: -this.flowDirection * (0.07 + r() * 0.13),
          vy: 0.16 + r() * 0.17,
          vz: (r() - 0.5) * 0.16,
          size: (aspect < 1 ? 0.18 : 0.27) + r() * 0.1,
          tilt: this.flowDirection * 0.42 + (r() - 0.5) * 0.3,
          seed: r() * Math.PI * 2,
          total: 1.1 + r() * 0.5,
          retire: 1,
        });
        p.life = p.total;
      }
    } else this.spawnCredit = 0;
  }
  dispose() {
    this.clear();
    this.particles.length = 0;
  }
}
