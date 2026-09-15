// Motion and cylindrical layout adapted from matdn/helmet (Codrops, MIT).
export const tubeConfig = { radius: 4, rows: 5, columns: 12, repeats: 3, rowSpacing: 2.7, tileHeight: 1, baseSpeed: .25 };
// The middle row becomes the final cylinder; retain its angular speed.
export const tubeRowSpeed = (row: number) => .65 + (row % tubeConfig.rows) / 4 * .9;
export const tubeRingSpeedFactor = tubeRowSpeed(Math.floor(tubeConfig.rows * tubeConfig.repeats / 2));
export const tubeArtworks = [
  { src: '/oven-sauna/20260915/01-beyond-heat.png', title: 'BEYOND THE HEAT' },
  { src: '/oven-sauna/20260915/02-shine-later.png', title: 'SWEAT NOW, SHINE LATER' },
  { src: '/oven-sauna/20260915/03-steam.png', title: 'STEAM' },
  { src: '/oven-sauna/20260915/04-wind-down.png', title: 'HEAT UP, WIND DOWN' },
  { src: '/oven-sauna/20260915/05-towel.png', title: 'TOWEL' },
  { src: '/oven-sauna/20260915/06-sauna.png', title: 'SAUNA' },
  { src: '/oven-sauna/20260915/07-sign.png', title: 'SIGN' },
  { src: '/oven-sauna/20260915/08-gather.png', title: 'GATHER IN' },
  { src: '/oven-sauna/20260915/09-curved.png', title: 'CURVED' },
];
export interface TubeMotion {
  target: number; current: number; velocity: number; angle: number;
  direction: number; paused: boolean; reduced: boolean;
}
export const createTubeMotion = (): TubeMotion => ({ target: 0, current: 0, velocity: 0, angle: 0, direction: 1, paused: false, reduced: false });
export function scrollTube(motion: TubeMotion, delta: number) {
  if (!Number.isFinite(delta)) return;
  const bounded = Math.max(-320, Math.min(320, delta));
  motion.target += bounded * .002;
  if (!motion.reduced) motion.velocity = Math.max(-2, Math.min(2, motion.velocity + bounded * .004));
  else motion.angle += bounded * .001;
  if (bounded) motion.direction = Math.sign(bounded);
}
export function advanceTube(motion: TubeMotion, delta: number) {
  const dt = Math.min(Math.max(delta, 0), .05);
  const lerp = 1 - Math.pow(.88, dt * 60);
  motion.current += (motion.target - motion.current) * (motion.reduced ? 1 : lerp);
  const loop = tubeConfig.rows * tubeConfig.rowSpacing;
  const wrap = Math.floor((motion.current + loop / 2) / loop) * loop;
  motion.current -= wrap;
  motion.target -= wrap;
  motion.velocity *= Math.pow(.92, dt * 60);
  if (!motion.reduced) {
    const base = motion.paused ? 0 : motion.direction * tubeConfig.baseSpeed;
    motion.angle += (base + motion.velocity) * dt;
  }
}
