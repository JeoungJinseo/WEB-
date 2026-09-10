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
    eyebrow: 'BRAND STRATEGIES',
    title: 'OUR CORE VALUE',
    description: '오븐의 뜨거움과 사우나의 열기를 하나의 감각으로 연결합니다.\n강렬한 레드와 흐르는 형태가 OVEN SAUNA의 그래픽을 이룹니다.',
    position: 'top',
  },
  {
    eyebrow: 'GRAPHIC LANGUAGE',
    title: 'SHAPED BY HEAT',
    description: '열기에 녹아 흐르는 듯한 레터링에 거친 표면의 질감을 더했습니다.\n유연한 곡선과 단단한 표지판의 대비로 생생한 에너지를 표현합니다.',
    position: 'center',
  },
  {
    eyebrow: 'GRAPHIC SYSTEM',
    title: 'ONE IDENTITY',
    description: '스티커, 티켓, 표지판, 포스터와 수건까지.\n서로 다른 재질 위에 같은 로고와 레드를 반복해 하나의 인상으로 연결합니다.',
    position: 'center',
  },
  {
    eyebrow: 'BRAND EXPERIENCE',
    title: 'FEEL THE HEAT',
    description: '김 서린 유리와 촘촘한 패브릭, 빛바랜 금속의 표면.\n눈으로 보는 이미지에 촉감과 온도를 더해 사우나의 분위기를 전달합니다.',
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
