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
- `lib/film-atmosphere.ts`: 정지 장면의 무손실 원본 PNG에 약 4.2초 주기의 호흡과 붉은 배경에만 보이는 상승 증기를 합성합니다. 몸통이 잘리는 넓은 화면에서도 호흡이 보이도록 머리·목을 함께 소폭 들어 올리며 얼굴 비율은 유지합니다. 몸통의 가로 확장은 1.6% 이내이고, 영상 파일과 재생 시점은 변경하지 않습니다. 두 캔버스는 동일한 호흡 위상을 사용하며, 탭이 숨겨지거나 모션 감소 설정일 때 동작을 멈춥니다.
- `lib/film-resolution.ts`: 화면의 실제 픽셀 밀도에 맞춰 캔버스를 할당합니다. DPR 2 제한과 원본 가로 3840px 제한을 제거해 Retina·DPR 3 화면에서 중간 캔버스를 확대하는 손실을 줄입니다. GPU 허용 크기와 8K(7680×4320) 픽셀 예산 내에서 화면 비율을 유지합니다. 원본 영상 자체는 4K이며, 8K 원본 디테일을 생성하는 기능은 아닙니다.
- `lib/scroll-film.ts`: 인트로 자동 재생 + 제스처 한 번마다 다음 장면까지 재생하는 엔진. `SCENE_STOPS`는 뒷모습 4.333초, 옆모습 208/24초, 정면 340/24초.
- `public/assets/hero-scrub-4k.mp4`: 첨부 원본에서 3840×2160 / 24fps를 유지하고 GOP 8로 재인코딩한 스크롤용 영상.
- `public/assets/hero-4k.mp4`: 수정하지 않은 첨부 원본.
- `public/assets/hero-compatible.mp4`: 4K 재생이 실패하는 환경에서만 사용하는 1920×1080 호환 영상. 장면 시점과 BT.709 색상을 유지합니다.

호흡 합성에는 Catmull-Rom 보간을 적용해 확대 및 미세한 이동 때 질감을 보존합니다. 수증기는 양쪽 어깨 뒤에서 확실히 보이는 농도와 밝기를 유지하되, 가장자리가 부드러운 길고 불규칙한 흐름으로 만들었습니다. 붉은 조명에 섞이며 인물 앞을 뿌옇게 덮지 않습니다. 기존 스크롤용 4K 영상은 원본 대비 PSNR 58.52dB이며 짧은 키프레임 간격이 역방향 재생에 필요하므로 유지합니다. 추가 영상 재인코딩이나 인물 재생성은 하지 않았습니다.

전환 중 영상 인물에는 원본 영상 픽셀을 기준으로 암부 톤 보정과 제한적인 미세 대비 보정을 적용합니다. 대기 화면의 PNG와 영상에 동일한 암부 곡선을 적용합니다. PNG는 영상 끝 프레임에서 계산한 톤 테이블을 먼저 통과해 붉은 배경과 암부의 색이 이어집니다. 단색에 가까운 암부만 약하게 평활화하고, 강한 실루엣 경계는 선명도 보정에서 제외해 밝은 테두리를 억제합니다. 인물 마스크와 수증기 마스크는 보정 전 픽셀에서 계산하므로 로고가 인물 안으로 비치거나 수증기가 얼굴을 덮지 않습니다. 웹의 하단 명암 그라데이션은 WebGL에서 보정 후 합성하고 마지막에 1단계 미만의 고정 디더링을 적용해 8비트 출력의 계단 현상을 줄입니다. CSS 그라데이션은 WebGL을 사용할 수 없는 경우에 유지합니다. 4K 파일에도 이미 뭉개진 질감과 어두운 영역이 있어, 이 보정이 원본에 없는 세부를 복원하지는 않습니다.

화질을 위해 대기 장면은 첨부 원본 `back.png`(1673×1190), `profile.png`(1674×1190), `front.png`(1906×1356)를 직접 사용합니다. `scene-registration.ts`는 원본과 연결 데이터를 함께 읽고, PNG 디코딩과 GPU 텍스처 업로드를 장면 정지 전에 완료합니다. 둘 중 하나가 실패하면 기존 4K 영상 표시를 유지합니다.

정지 순간의 단순 크로스페이드를 양방향 optical-flow 연결로 바꿨습니다. `scripts/prepare-scene-registration.py`가 로컬 OpenCV로 영상의 104·208·340 프레임과 원본 PNG의 위치 차이 및 색상 테이블을 계산합니다. 연결 중에는 두 이미지의 윤곽을 같은 위치로 옮겨 겹치며, 완료 시 원본 이미지 좌표로 정확히 돌아옵니다. 원본 PNG 파일은 변경하지 않습니다. 연결 데이터는 `public/assets/registration/`에 포함되어 런타임에 OpenCV나 외부 서비스가 필요하지 않습니다.

연결은 영상이 끝나기 약 0.12초 전 시작해 총 0.48초 동안 이어집니다. 영상 구간과 겹치는 시간을 포함해 전체 장면 전환은 약 2.5초입니다. 이 동안 입력은 잠기며, 호흡 위상을 정지 상태 진입 시 다시 초기화하지 않습니다. 애니메이션은 화면의 requestAnimationFrame 주기를 사용하고, 영상 프레임은 지원 브라우저에서 requestVideoFrameCallback에 맞춰 갱신합니다. 정지 시 불필요한 강제 seek를 제거했으며, 한 프레임 이내의 실제 표시 프레임을 유지합니다. 크게 초과한 경우에만 목표 시점으로 복구합니다.

스크롤용 MP4는 BT.709 색상 메타데이터를 유지합니다. PNG와 영상의 연결 테이블도 같은 디코딩 기준으로 계산하며, 두 소스를 연결한 뒤 `lib/film-color.ts`의 공통 팔레트로 사용자가 지정한 **#ED0505**에 맞춥니다. 붉은 채널의 세밀한 암부 질감은 단조 곡선으로 유지하고 밝은 배경만 부드럽게 기준색에 도달합니다. 인트로와 WebGL을 사용할 수 없는 영상도 같은 sRGB 팔레트의 SVG 필터를 사용합니다. 인물 합성·하단 명암·수증기·디더링은 색상 통일 이후 적용하므로 명암과 수증기가 있는 위치는 기준색보다 어둡거나 밝습니다. 원본 PNG·MP4 파일, 움직임 연결 데이터, 재생 타이밍은 변경하지 않습니다.

로고 등장과 박스가 펼쳐지는 인트로(0–4.333초)는 무음으로 자동 재생합니다. 이후 휠 한 번, 위로 스와이프 한 번, 다음 장면 버튼 또는 PageDown을 누르면 다음 장면까지 영상과 원본 연결을 포함해 약 2.5초 동안 전환합니다. 장면 길이에 맞춰 재생 속도를 조정하며, 역방향 전환과 메뉴로 장면을 건너뛰는 경우도 약 2.5초입니다. 인트로는 원래 속도를 유지합니다. 재생 중 입력은 다음 장면으로 중첩되지 않으며, 휠 관성 입력에도 잠깐의 보호 시간을 둡니다. 반대 방향 입력은 이전 장면까지 영상을 되감습니다. UI는 영상 시점에 맞춰 등장합니다. `settling` 단계가 끝난 뒤 다음 장면 입력을 받습니다.

처음으로 돌아가기와 상단 로고는 인트로를 다시 재생합니다. 브라우저가 자동 재생을 막으면 PLAY FILM 버튼으로 시작할 수 있습니다. 4K 영상의 원본 주소로 먼저 재생하고, 실패하면 전체 다운로드 방식과 호환 영상을 순서대로 시도합니다. 로딩 시간 제한과 요청 취소·객체 URL 정리를 적용했습니다. 모든 연결이 실패해도 원본 이미지를 한 장만 표시하며, 상단의 작은 ‘영상 다시 연결’ 버튼으로 페이지 전체를 새로고침하지 않고 재시도할 수 있습니다. 인물 외형과 기본 4K 영상은 변경하지 않았습니다.

1440×1024를 기준으로 하되 UI는 브라우저 전체 너비와 높이에 맞춰 배치합니다. 상단 메뉴와 하단 문구는 좌우 약 5%에 고정하고, 로고는 화면 너비와 크레딧 위의 남는 높이를 함께 기준으로 조절합니다. 영상은 UI와 별도로 원본 비율을 유지하며 확대하고 머리가 잘리지 않도록 위치를 조절합니다. 화면 비율에 따라 영상의 주변 배경과 하단 몸체 일부는 화면 밖으로 나갈 수 있으며, UI와 크레딧은 이 크롭의 영향을 받지 않습니다. 세로 화면에서는 메뉴를 두 줄로 배치합니다. 모션 감소 설정에서는 첨부 스틸 이미지로 전환합니다.

UI 마스크: y 110% → 0, 요소 간 시차 0.07초, 1.2초, cubic-bezier(0.625, 0.05, 0, 1). 레퍼런스의 공개 splitText / easing 코드에서 확인한 값을 새 구현에 적용했습니다. 원본 JS 전체를 복사하지 않았습니다.

Figma: `8hKWLXpGTm4KO8ooh1SNSZ` — back `1009:1111`, profile `1009:974`, front `1009:1013`.

모션 레퍼런스: https://www.raviklaassens.com/ — https://slater.app/19011/55686.js , https://slater.app/19011/55685.js .

`SPACE Modeling`과 `Contact US`는 목적지 주소가 제공되지 않아 비활성 상태입니다. HOME / ABOUT / PROJECT / Read more / 다음 장면 / 처음으로 돌아가기 버튼은 연결되어 있습니다.

## 확인

- `tests/scene-registration.test.mjs`: 연결 데이터와 원본 해시·정지 프레임의 일치, 세 장면의 최종 배경 #ED0505, 인트로/합성 팔레트 일치, 암부 대비 보존, 파일 오류·취소 처리.

- TypeScript 타입 검사 및 Vinext 배포 빌드.
- `node --experimental-strip-types tests/film-resolution.test.mjs`: Retina·DPR 3, GPU 제한, 8K 픽셀 예산과 종횡비 검사. `tests/idle-atmosphere.test.mjs`에서도 실제 캔버스 할당, 원본 PNG 선택과 캐시, 전환 중 혼합 비율, 이미지 로드 지연·실패, 재진입 및 GPU 리소스 정리를 확인합니다.
- 브라우저에서 4K 영상 메타데이터와 전체 seekable 범위 확인.
- 재생 엔진 회귀 검사: 무입력 인트로, 휠 1회 재생, 중복 입력 차단, 장면 정지, 역방향, 재시작, 터치, 키보드, 자동 재생 차단, 모션 감소, 미디어 오류 및 정리. `node --experimental-strip-types tests/scene-playback.test.mjs`로 실행합니다. 브라우저 미디어 시계를 모사하는 검사입니다.
- 세 장면 UI, 움직이는 인물 앞뒤 레이어, 390×844 화면에서 가로 넘침 없음 확인.
- 실제 iOS 기기에서의 성능 검증은 별도로 필요합니다.

## GitHub Pages

`pnpm build:pages`는 동일한 React 화면을 정적 사이트 `dist-pages/`로 빌드합니다. 기본 경로는 `/oven-sauna/`이며 저장소 이름을 바꾸면 `GITHUB_PAGES_BASE=/새이름/ pnpm build:pages`로 설정합니다. `dist-pages/`를 `gh-pages` 브랜치 루트에 배포합니다. 서버나 ChatGPT 로그인이 필요하지 않습니다.

## Mobile composition — 2026-09-16

Phones (width <= 600 px, or width <= 1000 px with height <= 600 px) use native CSS sizing. The mobile header and navigation stay on two compact rows, with each navigation label on one line. The collaboration mark and hero wordmark retain their proportions. Credits use three people in the first row and two in the second; they stay above the single-line scene control. Portrait scenes fit the viewport down to 320×480. Very short or landscape windows use a bounded scroll area to keep all content reachable. Safe-area insets protect the header and bottom scene control. Desktop rules and geometry are unchanged.

Compact screens retain the existing 1080p compatible clip (about 9 MB), with the same scene timing; desktop still starts with the 4K asset. Rotation/browser-bar resizes retain the displayed frame, and pinch gestures do not trigger a scene change. Original images, media proportions, color and animation code are unchanged in this composition pass.

Validation: 19 viewport layout cases and scene playback tests pass. Local browser checks covered all three scenes at 393×654, 390×844, 375×568, 320×480, 430×780, 768×1024, 844×390 and 1440×1024. Portrait navigation, hero, credits and scene-control bounds do not overlap or overflow; desktop bounds match the previous version. Actual mobile-emulated video playback, one upward swipe to the profile scene, browser-bar resize and navigation to the front scene completed without browser errors. Real-device Safari/Android testing has not been performed.

Mobile narrative text uses its own line breaks while preserving the desktop copy and entrance order. Inactive mobile sections remain laid out with opacity/visibility and `inert`, so their masked transforms animate on entry and revisit. The profile title, button and disciplines occupy separate areas; the introduction uses centered, individually masked lines above the compact credits. The mobile idle scene control is a small arrow with a 44 px touch target; playback recovery labels remain visible.

Validated with native video in a touch-enabled local Chromium viewport: all five profile lines and seven introduction lines emit transform transitions and finish at y=0 on swipe, menu navigation and reverse revisit. All 24 scene/viewport layouts fit, desktop/tablet geometry matches the previous release, TypeScript and playback regression checks pass. Film placement, media, grading and the 2.5-second scene timing are unchanged in this text-motion correction.
