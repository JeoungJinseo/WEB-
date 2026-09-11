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
    title: 'HEAT AS IDENTITY',
    description: '오븐과 사우나가 공통으로 가지고 있는 ‘열’이라는 요소에서 출발했습니다.\n굽네의 오븐 이미지를 사우나의 분위기와 연결해 OVEN SAUNA만의 인상을 만들었습니다.',
    position: 'center',
  },
  {
    eyebrow: 'GRAPHIC LANGUAGE',
    title: 'MELTED FORM',
    description: '열에 녹아 흐르는 모습을 떠올리며 레터링과 그래픽 형태를 만들었습니다.\n둥글고 늘어지는 형태들은 뜨겁고 유쾌하며 힙한 분위기를 표현합니다.',
    position: 'center',
  },
  {
    eyebrow: 'GRAPHIC SYSTEM',
    title: 'VISUAL FLOW',
    description: 'OVEN SAUNA의 그래픽은 하나의 비주얼 톤으로 연결되어 있습니다.\n블랙과 레드의 강렬한 대비를 통해 OVEN SAUNA만의 브랜드 톤을 만들어냅니다.',
    position: 'center',
  },
  {
    eyebrow: 'BRAND EXPERIENCE',
    title: 'SWEAT OUT, GATHER IN',
    description: 'SWEAT OUT, GATHER IN은 OVEN SAUNA 그래픽의 핵심 메시지입니다.\n땀을 빼고 함께 모이는 순간, OVEN SAUNA의 뜨거운 에너지를 느껴보세요.',
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
