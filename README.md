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
- `lib/film-atmosphere.ts`: 정지 장면의 원본 영상 픽셀에 약 5.6초 주기의 가슴·어깨 호흡과 붉은 배경에만 보이는 상승 증기를 합성합니다. 얼굴 위쪽은 고정하고 몸통 변형은 0.45% 이내입니다. 영상 파일과 재생 시점은 변경하지 않습니다. 두 캔버스는 동일한 호흡 위상을 사용하며, 탭이 숨겨지거나 모션 감소 설정일 때 동작을 멈춥니다.
- `lib/scroll-film.ts`: 인트로 자동 재생 + 제스처 한 번마다 다음 장면까지 재생하는 엔진. `SCENE_STOPS`는 뒷모습 4.333초, 옆모습 8.7초, 정면 14.2초.
- `public/assets/hero-scrub-4k.mp4`: 첨부 원본에서 3840×2160 / 24fps를 유지하고 GOP 8로 재인코딩한 스크롤용 영상.
- `public/assets/hero-4k.mp4`: 수정하지 않은 첨부 원본.

로고 등장과 박스가 펼쳐지는 인트로(0–4.333초)는 무음으로 자동 재생합니다. 이후 휠 한 번, 위로 스와이프 한 번, 다음 장면 버튼 또는 PageDown을 누르면 다음 장면까지 영상을 정상 속도로 재생하고 멈춥니다. 재생 중 입력은 다음 장면으로 중첩되지 않으며, 휠 관성 입력에도 잠깐의 보호 시간을 둡니다. 반대 방향 입력은 이전 장면까지 영상을 되감습니다. UI는 영상 시점에 맞춰 등장합니다.

처음으로 돌아가기와 상단 로고는 인트로를 다시 재생합니다. 브라우저가 자동 재생을 막으면 PLAY FILM 버튼으로 시작할 수 있습니다. Blob 로딩과 객체 URL·이벤트 정리를 적용했으며, 인물 외형이나 영상 에셋을 새로 생성하지 않았습니다.

데스크톱에서는 원본 영상의 검은 좌우 여백을 화면 밖으로 배치합니다. 모바일에서는 원본 16:9 전체 영상을 유지하며 별도 세로 영상을 생성하지 않습니다. 모션 감소 설정에서는 첨부 스틸 이미지로 전환합니다.

UI 마스크: y 110% → 0, 요소 간 시차 0.07초, 1.2초, cubic-bezier(0.625, 0.05, 0, 1). 레퍼런스의 공개 splitText / easing 코드에서 확인한 값을 새 구현에 적용했습니다. 원본 JS 전체를 복사하지 않았습니다.

Figma: `8hKWLXpGTm4KO8ooh1SNSZ` — back `1009:1111`, profile `1009:974`, front `1009:1013`.

모션 레퍼런스: https://www.raviklaassens.com/ — https://slater.app/19011/55686.js , https://slater.app/19011/55685.js .

`SPACE Modeling`과 `Contact US`는 목적지 주소가 제공되지 않아 비활성 상태입니다. HOME / ABOUT / PROJECT / Read more / 다음 장면 / 처음으로 돌아가기 버튼은 연결되어 있습니다.

## 확인

- TypeScript 타입 검사 및 Vinext 배포 빌드.
- 브라우저에서 4K 영상 메타데이터와 전체 seekable 범위 확인.
- 재생 엔진 회귀 검사: 무입력 인트로, 휠 1회 재생, 중복 입력 차단, 장면 정지, 역방향, 재시작, 터치, 키보드, 자동 재생 차단, 모션 감소, 미디어 오류 및 정리. `node --experimental-strip-types tests/scene-playback.test.mjs`로 실행합니다. 브라우저 미디어 시계를 모사하는 검사입니다.
- 세 장면 UI, 움직이는 인물 앞뒤 레이어, 390×844 화면에서 가로 넘침 없음 확인.
- 실제 iOS 기기에서의 성능 검증은 별도로 필요합니다.
