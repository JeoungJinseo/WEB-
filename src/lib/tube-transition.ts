import { createTubeMotion, type TubeMotion } from './image-tube';

/** Shared endpoint: the prepared cinematic renderer publishes its live lens. */
export interface TubeTransition {
  motion: TubeMotion;
  target: number;
  progress: number;
  velocity: number;
  ready: boolean;
  reduced: boolean;
  frame: { fov: number; shift: number; scale: number; cameraZ: number };
}
export const createTubeTransition = (): TubeTransition => ({
  motion: createTubeMotion(),
  target: 0, progress: 0, velocity: 0, ready: false, reduced: false,
  frame: { fov: 45, shift: 0, scale: 1, cameraZ: 8 },
});
export const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
export function transitionEase(start: number, end: number, value: number) {
  const t = clamp01((value - start) / (end - start));
  return t * t * t * (t * (t * 6 - 15) + 10);
}
export function scrollTransition(state: TubeTransition, pixels: number, height: number) {
  if (!state.ready || !Number.isFinite(pixels)) return;
  state.target = clamp01(state.target + Math.max(-320, Math.min(320, pixels)) / Math.max(1600, height * 2.2));
}
export function advanceTransition(state: TubeTransition, seconds: number, reduced: boolean) {
  if (!state.ready) return;
  const dt = Math.max(0, Math.min(.05, seconds));
  if (dt === 0) return;
  // Critically damped motion carries velocity across wheel pulses and reversals.
  // Limit the spring's displacement rather than abruptly clipping each frame's step.
  const smoothTime = reduced ? .16 : .55;
  const maxSpeed = reduced ? 2 : .38;
  const omega = 2 / smoothTime;
  const displacement = Math.max(-maxSpeed * smoothTime, Math.min(maxSpeed * smoothTime, state.progress - state.target));
  const destination = state.progress - displacement;
  const decay = Math.exp(-omega * dt);
  const impulse = (state.velocity + omega * displacement) * dt;
  state.velocity = (state.velocity - omega * impulse) * decay;
  const next = destination + (displacement + impulse) * decay;
  // Stop at the requested point without ringing or travelling beyond either end.
  if ((state.target - state.progress) * (next - state.target) > 0) {
    state.progress = state.target;
    state.velocity = 0;
  } else {
    state.progress = clamp01(next);
    if ((state.progress === 0 && state.velocity < 0) || (state.progress === 1 && state.velocity > 0)) state.velocity = 0;
  }
  if (Math.abs(state.target - state.progress) < .00005 && Math.abs(state.velocity) < .0001) {
    state.progress = state.target;
    state.velocity = 0;
  }
}

/** Tile boundaries plus original cylinder vertices, so the final silhouette is identical. */
export function panelCoordinates(panel: number) {
  const coordinates = [0];
  for (let vertex = 1; vertex < 64; vertex++) {
    const u = vertex / 64 * 12 - panel;
    if (u > 0 && u < 1) coordinates.push(u);
  }
  coordinates.push(1);
  return coordinates;
}
