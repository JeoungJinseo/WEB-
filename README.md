# GOOBNE OVEN SAUNA

2026 DDP Young Designer · GOOBNE × HONGIK UNIVERSITY.

## 실행

```sh
pnpm install
pnpm dev
```

배포 빌드: `pnpm build`.

## 구성

- `app/page.tsx`: Figma의 뒷모습·옆모습·정면 UI, 내비게이션과 문구.
- `app/globals.css`: 원본 Highman / Utendo 글꼴, 반응형 레이아웃과 줄 단위 마스크 모션.
- `lib/scroll-film.ts`: 단일 영상을 스크롤에 연결하는 엔진. `STOPS`로 장면별 스크롤 길이 조절.
- `public/assets/hero-scrub-4k.mp4`: 첨부 원본에서 3840×2160 / 24fps를 유지하고 GOP 8로 재인코딩한 스크롤용 영상.
- `public/assets/hero-4k.mp4`: 수정하지 않은 첨부 원본.

영상은 자동 재생하지 않으며 스크롤 위치에 따라 앞뒤로 탐색합니다. Blob 로딩, 동시에 하나의 seek만 실행, 시간 기준 스무딩, 모바일 첫 터치 디코더 준비, 객체 URL과 이벤트 정리를 적용했습니다. 인물 외형이나 장면을 새로 생성하지 않았습니다.

데스크톱에서는 원본 영상의 검은 좌우 여백을 화면 밖으로 배치합니다. 모바일에서는 원본 16:9 전체 영상을 유지하며 별도 세로 영상을 생성하지 않습니다. 모션 감소 설정에서는 첨부 스틸 이미지로 전환합니다.

UI 마스크: y 110% → 0, 요소 간 시차 0.07초, 1.2초, cubic-bezier(0.625, 0.05, 0, 1). 레퍼런스의 공개 splitText / easing 코드에서 확인한 값을 새 구현에 적용했습니다. 원본 JS 전체를 복사하지 않았습니다.

Figma: `8hKWLXpGTm4KO8ooh1SNSZ` — back `1009:1111`, profile `1009:974`, front `1009:1013`.

모션 레퍼런스: https://www.raviklaassens.com/ — https://slater.app/19011/55686.js , https://slater.app/19011/55685.js .

`SPACE Modeling`과 `Contact US`는 목적지 주소가 제공되지 않아 비활성 상태입니다. HOME / ABOUT / PROJECT / Read more / 다음 장면 / 처음으로 돌아가기 버튼은 연결되어 있습니다.

## 확인

- TypeScript 타입 검사 및 Vinext 배포 빌드.
- 브라우저에서 4K 영상 메타데이터와 전체 seekable 범위 확인.
- 실제 메뉴 클릭과 PageUp으로 4.29s → 8.70s → 14.20s → 13.81s 탐색 확인.
- 세 장면 UI, 움직이는 인물 앞뒤 레이어, 390×844 화면에서 가로 넘침 없음 확인.
- 실제 iOS 기기에서의 성능 검증은 별도로 필요합니다.
