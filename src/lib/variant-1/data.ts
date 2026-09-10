import type { Perspective } from './types';

export const images = [
  './oven-sauna/01-sticker.png',
  './oven-sauna/02-ticket.png',
  './oven-sauna/03-sign.png',
  './oven-sauna/04-eye.png',
  './oven-sauna/05-steam.png',
  './oven-sauna/06-towel.png',
];

// Each original is approximately 4:5. Contain fitting preserves the small
// differences between their exact dimensions without cropping any artwork.
export const imageConfig = { width: 480, height: 600 };
// Repeat the six artworks around the ring without lowering texture resolution.
// Twelve narrower panels keep the portrait artwork proportional to the original
// cinematic ribbon, and let several complete graphics share the inside view.
export const imageRepeat = 2;

export const perspectives: Perspective[] = [
  {
    title: 'Immersive experiences',
    description: 'Where creativity comes to life',
    position: 'top',
  },
  {
    title: 'Infinite Perspective',
    description: 'Explore new dimensions',
    position: 'center',
  },
  {
    title: 'Inside the Universe',
    description: 'Immerse yourself in the extraordinary',
    position: 'center',
  },
  {
    title: 'OVEN SAUNA',
    description: '2026 DDP YOUNG DESIGNER',
    position: 'bottom',
  },
];

export const cylinderConfig = {
  radius: 2.5,
  // Match the physical surface to the repeated atlas; never stretch the artwork.
  height: (2 * Math.PI * 2.5 * imageConfig.height) / (images.length * imageRepeat * imageConfig.width),
  radialSegments: 192,
  heightSegments: 1,
};

export const particleConfig = {
  numParticles: 12,
  particleRadius: 3.3, // cylinderRadius + 0.8
  segments: 20,
  angleSpan: 0.3,
};
