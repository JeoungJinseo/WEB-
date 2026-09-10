import { Geometry, type OGLRenderingContext } from 'ogl';
import type { CylinderConfig, ParticleConfig, Perspective } from './types';

/**
 * Draws the entire image with object-fit: contain behavior. Both axes use the
 * same scale; any fractional spare space stays in the atlas background.
 */
export function drawImageContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const drawWidth = img.naturalWidth * scale;
  const drawHeight = img.naturalHeight * scale;

  ctx.save();
  ctx.translate(x, y + h);
  ctx.scale(1, -1);
  ctx.drawImage(img, (w - drawWidth) / 2, (h - drawHeight) / 2, drawWidth, drawHeight);
  ctx.restore();
}

/**
 * Returns Tailwind classes for positioning text based on perspective position
 */
export function getPositionClasses(position: Perspective['position']): string {
  switch (position) {
    case 'top':
      return 'top-20 left-1/2 -translate-x-1/2 max-md:top-[25vh]';
    case 'top-left':
      return 'top-20 left-20';
    case 'left':
      return 'left-20 top-1/2 -translate-y-1/2';
    case 'center':
      return 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2';
    case 'top-right':
      return 'top-20 right-20 max-md:top-12 max-md:right-12 flex flex-col items-end';
    case 'bottom':
      return 'bottom-20 left-1/2 -translate-x-1/2 text-center max-md:px-6';
    case 'bottom-left':
      return 'bottom-20 left-20 max-md:bottom-[10vh] max-md:left-6 flex flex-col items-start text-left';
    case 'bottom-right':
      return 'bottom-20 right-20 max-md:bottom-12 max-md:right-12 flex flex-col items-end text-right';
    default:
      return 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2';
  }
}

/**
 * Creates cylinder geometry with positions, UVs, and indices
 */
export function createCylinderGeometry(gl: WebGLRenderingContext, config: CylinderConfig) {
  const { radius, height, radialSegments, heightSegments } = config;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let y = 0; y <= heightSegments; y++) {
    const v = y / heightSegments;
    const yPos = (v - 0.5) * height;

    for (let x = 0; x <= radialSegments; x++) {
      const u = x / radialSegments;
      const theta = u * Math.PI * 2;

      const xPos = Math.cos(theta) * radius;
      const zPos = Math.sin(theta) * radius;

      positions.push(xPos, yPos, zPos);
      uvs.push(u, 1 - v);
    }
  }

  for (let y = 0; y < heightSegments; y++) {
    for (let x = 0; x < radialSegments; x++) {
      const a = y * (radialSegments + 1) + x;
      const b = a + radialSegments + 1;
      const c = a + 1;
      const d = b + 1;

      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  return new Geometry(gl as unknown as OGLRenderingContext, {
    position: { size: 3, data: new Float32Array(positions) },
    uv: { size: 2, data: new Float32Array(uvs) },
    index: { data: new Uint16Array(indices) },
  });
}

/**
 * A camera-facing ribbon gives the steam a soft edge at every pixel density.
 * Its centerline is animated in the vertex shader, avoiding per-frame uploads.
 */
export function createParticleGeometry(
  gl: WebGLRenderingContext,
  config: ParticleConfig,
  index: number,
  height: number
) {
  const { numParticles, particleRadius, segments, angleSpan } = config;

  const positions = new Float32Array((segments + 1) * 2 * 3);
  const uvs = new Float32Array((segments + 1) * 2 * 2);
  const indices: number[] = [];
  const startAngle = (index / numParticles) * Math.PI * 2;
  // Preserve the original arc distribution, height bands and random speeds.
  const seed = Math.random();
  const isTopHalf = index < numParticles / 2;
  const yPosition = isTopHalf
    ? height * .7 + seed * height * .3
    : -height + seed * height * .3;

  for (let j = 0; j <= segments; j++) {
    const t = j / segments;
    uvs.set([t, 0, t, 1], j * 4);
    if (j < segments) {
      const vertex = j * 2;
      indices.push(vertex, vertex + 1, vertex + 2, vertex + 1, vertex + 3, vertex + 2);
    }
  }

  return {
    geometry: new Geometry(gl as unknown as OGLRenderingContext, {
      position: { size: 3, data: positions },
      uv: { size: 2, data: uvs },
      index: { data: new Uint16Array(indices) },
    }),
    userData: {
      baseAngle: startAngle,
      angleSpan,
      baseY: yPosition,
      speed: .5 + Math.random(),
      radius: particleRadius,
      phase: index * 2.39996,
      width: .065,
    },
  };
}
