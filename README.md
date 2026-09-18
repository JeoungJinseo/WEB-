# WEB- · GOOBNE OVEN SAUNA

2026 DDP YOUNG DESIGNER 프로젝트의 반응형 웹사이트입니다. 한 번의 스크롤로 사우나 장면을 이동하며, 정지 장면에서도 몸의 미세한 호흡과 증기 효과가 이어집니다.

## Core values 카드 페이지

최신 핵심 가치 카드 페이지의 소스와 이미지·폰트는 [`core-values/`](core-values/)에 있습니다. 카드 자동 이동, 드래그와 터치 전환, 모바일 성능 최적화, `CHEERFUL LIFE` 문구, 모바일 소개 설명 15px 및 행간 조정이 포함되어 있습니다.

[현재 공개된 카드 페이지 열기](https://oven-sauna-core-values.harry040904.chatgpt.site)

Bun이 설치된 환경에서 실행합니다.

```sh
cd core-values
bun install
bun run dev
```

`http://localhost:3000/` 또는 `/oven-sauna/`에서 확인할 수 있습니다. `bun run build`는 정적 배포 파일을 `core-values/out/`에 생성합니다. 기존 영상 페이지는 아래의 `dist/` 구조를 계속 사용하며, GitHub Pages 배포 대상도 그대로입니다.

## 실행 및 수정

`dist/`가 실제 배포되는 웹사이트 소스입니다. 별도의 빌드나 패키지 설치 없이 실행할 수 있습니다.

```sh
python3 -m http.server 4318 --directory dist
```

브라우저에서 `http://localhost:4318/`을 엽니다. 이후 수정은 `dist/` 안에서 진행합니다. 인터넷 공개 배포에는 HTTPS를 사용합니다.

- `dist/index.html`: 페이지 구조
- `dist/styles-v5.css`, `dist/responsive-v12.css`: 디자인과 반응형 레이아웃
- `dist/app-v12.js`: 콘텐츠와 UI 연결
- `dist/film-hosted-v13.js`: 영상 선택, 스크롤 전환, 정지 프레임 연결
- `dist/atmosphere-v12.js`: 몸의 호흡, 증기, 주변 움직임
- `dist/media-*.js`, `dist/media-map.json`: 분할 영상의 원본 바이트 재생

## 영상 화질과 호환성

영상 24개를 재인코딩 없이 포함합니다. 공통 영상 데이터는 공유하고 파일을 4MiB 이하로 나누어 보관합니다. 서비스 워커가 이 조각을 네이티브 MP4 응답으로 연결하며, 서비스 워커를 사용할 수 없으면 같은 바이트로 Blob을 구성합니다. 각 영상의 원본 SHA-256은 `media-map.json`에 기록되어 있습니다.

4320×3072 HEVC 영상과 동일 해상도 포스터를 유지합니다. 영상이 실제로 표시되는 크기와 화면 픽셀 밀도, 코덱 지원 여부에 따라 영상을 선택합니다. 모바일은 세로로 잘린 영상 대신 전체 구도의 2160×1536 또는 3240×2304 H.264 영상과 필요시 네이티브 HEVC를 사용합니다. `?quality=max`로 네이티브 해상도를 요청할 수 있으며, HEVC를 지원하지 않으면 H.264로 대체합니다. 영상을 재압축하거나 피사체를 늘려 왜곡하지 않습니다.

모바일도 영상·메뉴·설명을 하나의 화면에 겹쳐 배치합니다. 세로 화면에서는 전체 구도의 원본을 1.4배로 완만하게 확대하므로 좌우 가장자리 일부는 잘립니다. 기존 세로 전용 크롭보다 넓은 구도를 유지하고, 영상의 경계는 같은 장면에서 가져온 부드러운 배경으로 연결합니다. 중앙 영상은 선명하게 유지하며, 주변 배경만 작은 캔버스 두 장으로 장면 전환 시 갱신합니다. 추가 영상 디코더를 사용하지 않습니다.

네이티브 영상·포스터·호흡 효과가 같은 좌표와 가장자리 마스크를 공유합니다. 긴 설명은 해당 영역만 스크롤할 수 있고, 하단 버튼으로 다음 장면으로 이동합니다. 데스크톱의 기존 구성을 유지합니다.

부연 설명은 모든 화면에서 데스크톱과 동일한 문구와 줄바꿈을 사용합니다. 모바일에서는 실제 글꼴로 가장 긴 줄을 측정해 문단 전체의 글자 크기를 균일하게 맞춥니다. 화면 폭과 글꼴 로딩에 맞춰 다시 계산하며, 글자를 가로로 찌그러뜨리거나 문장을 생략하지 않습니다.

정지 프레임은 영상에서 sRGB 2D 캔버스를 거쳐 한 번만 RGBA 텍스처로 변환합니다. 증기는 premultiplied alpha로 합성하며 최대 불투명도를 12%로 제한해, 모바일에서 밝은 색이 화면 전체에 더해지는 경로를 피합니다. 영상 자체에 감마·노출 필터를 적용하지 않습니다.

배포 폴더는 약 493MB입니다. 모바일 네트워크에서는 영상 다운로드에 시간이 걸릴 수 있으며, 모든 실제 휴대폰에서의 성능을 검증한 상태는 아닙니다.

## 검증

Node.js 22 이상에서 다음 명령을 실행합니다. 외부 패키지가 필요하지 않습니다.

```sh
npm test
```

49개 검증 항목이 영상 바이트 복원, HTTP 범위 요청, Blob 정리, 정지 프레임 연결과 색상 변환 경로, 전체 구도 배치, 입력 중복 방지와 모바일 제스처 동작을 확인합니다. `?verify=color`에서는 캔버스의 `data-color-boundary-checks` 및 증기 캔버스의 `data-compositing-check`에 픽셀 비교 결과가 기록됩니다. 데스크톱 브라우저의 모바일 크기 검증은 실제 iOS 기기 검증을 대체하지 않습니다.

## GitHub Pages

`.github/workflows/pages.yml`이 `main` 푸시마다 테스트를 실행하고 `dist/`를 배포합니다. 저장소의 Settings → Pages → Source가 **GitHub Actions**로 설정되어 있어야 합니다. 현재 배포 결과와 공개 주소는 저장소의 **Actions** 및 **Deployments**에서 확인할 수 있습니다.

[GitHub Pages 공식 워크플로 문서](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

기존 저장소의 `test.py`와 커밋 이력은 보존합니다.
