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

export const artworks = [
  { title: 'STICKER', category: 'ON THE STREET', alt: '철제 기둥에 붙은 붉은 OVEN SAUNA 스티커', width: 481, height: 601 },
  { title: 'TICKET', category: 'YOUR WAY IN', alt: '검은 바탕에 교차해 놓인 붉은 OVEN SAUNA 입장 팔찌', width: 478, height: 598 },
  { title: 'SAUNA ONLY', category: 'THE SIGN', alt: 'OVEN SAUNA ONLY 문구가 적힌 빈티지 표지판', width: 480, height: 599 },
  { title: 'IN YOUR EYES', category: 'THE IDENTITY', alt: '눈동자 위에 놓인 OVEN SAUNA 타이포그래피와 마크', width: 479, height: 598 },
  { title: 'FEEL THE HEAT', category: 'THE POSTER', alt: '김이 서린 유리 위의 OVEN SAUNA 포스터', width: 478, height: 598 },
  { title: 'SAUNA TOWEL', category: 'THE TEXTURE', alt: '주황색 수건의 섬유 질감과 SAUNA 그래픽', width: 478, height: 598 },
];

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
    title: 'Cinematic GSAP Scroll Experiences',
    position: 'bottom',
  },
];

export const cylinderConfig = {
  radius: 2.5,
  // The unwrapped cylinder must have the same aspect ratio as the image atlas.
  height: (2 * Math.PI * 2.5 * imageConfig.height) / (images.length * imageConfig.width),
  radialSegments: 192,
  heightSegments: 1,
};

export const particleConfig = {
  numParticles: 12,
  particleRadius: 3.3, // cylinderRadius + 0.8
  segments: 20,
  angleSpan: 0.3,
};
