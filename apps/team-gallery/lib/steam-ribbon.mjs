import * as THREE from 'three';
import { steamPathPoint } from './sauna-motion.mjs';

const SEGMENTS = 160;
const SPAN = 1.2;
const vertexShader = /* glsl */ `
attribute vec3 ribbonNormal;
uniform float time;
varying vec2 vUv;
varying float vDepth;
void main() {
  vUv = uv;
  vec3 p = position;
  float breathe = sin(uv.x * 13.0 + time * 0.42) * 0.006
                + sin(uv.x * 21.0 - time * 0.27) * 0.002;
  p += ribbonNormal * breathe;
  vec4 view = modelViewMatrix * vec4(p, 1.0);
  vDepth = -view.z;
  gl_Position = projectionMatrix * view;
}`;
const fragmentShader = /* glsl */ `
uniform float time;
uniform float opacity;
varying vec2 vUv;
varying float vDepth;
void main() {
  float center = 0.5 + sin(vUv.x * 15.0 - time * 0.35) * 0.018;
  float d = vUv.y - center;
  float softness = 0.065 + sin(vUv.x * 10.0 - time * 0.3) * 0.008;
  float core = exp(-pow(d / softness, 2.0));
  float haze = exp(-pow(d / 0.24, 2.0));
  float taper = smoothstep(0.0, 0.045, vUv.x) * (1.0 - smoothstep(0.94, 1.0, vUv.x));
  float nearFade = smoothstep(0.8, 2.2, vDepth);
  float flow = 0.94 + 0.06 * sin(vUv.x * 17.0 - time * 0.4);
  float alpha = (0.72 * core + 0.18 * haze)
              * taper * nearFade * flow * opacity;
  if (alpha < 0.001) discard;
  gl_FragColor = vec4(1.0, 0.96, 0.91, alpha);
}`;

// A connected spatial path, not a collection of expiring particles. Sampling the
// same route at the same depth makes reversal retrace smoothly without a reset.
export class SteamRibbon {
  constructor() {
    const count = (SEGMENTS + 1) * 2;
    this.positions = new Float32Array(count * 3);
    this.normals = new Float32Array(count * 3);
    const uv = new Float32Array(count * 2),
      indices = [];
    for (let i = 0; i <= SEGMENTS; i++) {
      uv.set([i / SEGMENTS, 0, i / SEGMENTS, 1], i * 4);
      if (i < SEGMENTS) {
        const n = i * 2;
        indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
      }
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.positions, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    this.geometry.setAttribute(
      'ribbonNormal',
      new THREE.BufferAttribute(this.normals, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.geometry.setIndex(indices);
    this.material = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, opacity: { value: 0.42 } },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    });
    this.object = new THREE.Mesh(this.geometry, this.material);
    this.object.frustumCulled = false;
    this.object.renderOrder = 0;
    this.progress = null;
    this.aspect = null;
    this.disposed = false;
  }
  update(progress, aspect, time, pointer, reduced) {
    if (this.disposed) return;
    this.object.visible = !reduced;
    if (reduced) return;
    this.material.uniforms.time.value = time / 1000;
    this.object.position.set(pointer.x * 0.08, -pointer.y * 0.035, 0);
    if (this.progress === progress && this.aspect === aspect) return;
    this.progress = progress;
    this.aspect = aspect;
    const halfWidth = aspect < 1 ? 0.07 : 0.1;
    for (let i = 0; i <= SEGMENTS; i++) {
      const q = progress - SPAN * (1 - i / SEGMENTS);
      const p = steamPathPoint(q, aspect);
      const before = steamPathPoint(q - 0.001, aspect);
      const after = steamPathPoint(q + 0.001, aspect);
      const dx = after.x - before.x,
        dy = after.y - before.y;
      const length = Math.hypot(dx, dy);
      const nx = length > 1e-8 ? -dy / length : 1;
      const ny = length > 1e-8 ? dx / length : 0;
      for (let side = 0; side < 2; side++) {
        const offset = side === 0 ? -halfWidth : halfWidth;
        const index = (i * 2 + side) * 3;
        this.positions.set([p.x + nx * offset, p.y + ny * offset, p.z], index);
        this.normals.set([nx, ny, 0], index);
      }
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.ribbonNormal.needsUpdate = true;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.geometry.dispose();
    this.material.dispose();
  }
}
