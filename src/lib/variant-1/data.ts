import type { Perspective } from './types';

export const images = [
  './oven-sauna/01-sticker.png',
  './oven-sauna/02-ticket.png',
  './oven-sauna/03-sign.png',
  './oven-sauna/04-eye.png',
  './oven-sauna/05-steam.png',
  './oven-sauna/06-towel.png',
];

// Originals remain intact in a 4:5 atlas. The material cover-fits each tile
// within the reference cylinder, preserving proportions with narrow side crops.
export const imageConfig = { width: 480, height: 600 };
// Repeat the six artworks around the ring without lowering texture resolution.
// Keep the reference's twelve-panel rhythm with six repeating artworks.
export const imageRepeat = 2;

export const perspectives: Perspective[] = [
  {
    eyebrow: 'BRAND STRATEGIES',
    title: 'OVEN SAUNA GRAPHICS',
    description: '오븐의 열기와 사우나의 감각을 여섯 장의 그래픽으로 담았습니다.\n스크롤하며 스티커부터 포스터, 수건까지 이어지는 디자인을 살펴보세요.',
    position: 'bottom',
  },
  {
    eyebrow: 'GRAPHIC LANGUAGE',
    title: 'SHAPED BY HEAT',
    description: '열기에 녹아 흐르는 듯한 레터링에 거친 표면의 질감을 더했습니다.\n유연한 곡선과 단단한 표지판의 대비로 생생한 에너지를 표현합니다.',
    position: 'bottom',
  },
  {
    eyebrow: 'GRAPHIC SYSTEM',
    title: 'ONE IDENTITY',
    description: '스티커, 티켓, 표지판, 포스터와 수건까지.\n서로 다른 재질 위에 같은 로고와 레드를 반복해 하나의 인상으로 연결합니다.',
    position: 'bottom',
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
  // Preserve the reference ring's silhouette; fit image UVs independently.
  height: 2,
  radialSegments: 64,
  heightSegments: 1,
};

export const particleConfig = {
  numParticles: 12,
  particleRadius: 3.3, // cylinderRadius + 0.8
  segments: 20,
  angleSpan: 0.3,
};
