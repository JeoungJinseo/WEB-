/** Shared endpoint: the prepared cinematic renderer publishes its live lens. */
export interface TubeTransition {
  target: number;
  progress: number;
  ready: boolean;
  reduced: boolean;
  frame: { fov: number; shift: number; scale: number; cameraZ: number };
}
export const createTubeTransition = (): TubeTransition => ({
  target: 0, progress: 0, ready: false, reduced: false,
  frame: { fov: 45, shift: 0, scale: 1, cameraZ: 8 },
});
export const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
export function transitionEase(start: number, end: number, value: number) {
  const t = clamp01((value - start) / (end - start));
  return t * t * (3 - 2 * t);
}
export function scrollTransition(state: TubeTransition, pixels: number, height: number) {
  if (!state.ready || !Number.isFinite(pixels)) return;
  state.target = clamp01(state.target + Math.max(-320, Math.min(320, pixels)) / Math.max(1200, height * 1.8));
}
export function advanceTransition(state: TubeTransition, seconds: number, reduced: boolean) {
  if (!state.ready) return;
  const dt = Math.max(0, Math.min(.05, seconds));
  const difference = state.target - state.progress;
  // Bound the speed even when one wheel burst supplies the entire journey.
  const step = difference * (1 - Math.exp(-8 * dt));
  const limit = dt * (reduced ? 2 : .65);
  state.progress = clamp01(state.progress + Math.max(-limit, Math.min(limit, step)));
  if (Math.abs(state.target - state.progress) < .0005) state.progress = state.target;
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
