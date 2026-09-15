# WEB- · GOOBNE OVEN SAUNA

2026 DDP YOUNG DESIGNER 프로젝트의 반응형 웹사이트입니다. 한 번의 스크롤로 사우나 장면을 이동하며, 정지 장면에서도 몸의 미세한 호흡과 증기 효과가 이어집니다.

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

4320×3072 HEVC 영상과 동일 해상도 포스터를 유지합니다. 화면의 실제 픽셀 수와 코덱 지원 여부에 따라 영상을 선택합니다. 큰 세로 화면에서 HEVC를 지원하지 않는 브라우저는 전체 화면 3240×2304 H.264 영상을 잘라 사용하므로, 세로 전용 고해상도 원본보다 표시 픽셀 수가 적습니다. 화면 비율이 바뀌어도 피사체를 늘려 왜곡하지 않습니다.

배포 폴더는 약 493MB입니다. 모바일 네트워크에서는 영상 다운로드에 시간이 걸릴 수 있으며, 모든 실제 휴대폰에서의 성능을 검증한 상태는 아닙니다.

## 검증

Node.js 22 이상에서 다음 명령을 실행합니다. 외부 패키지가 필요하지 않습니다.

```sh
npm test
```

46개 검증 항목이 영상 바이트 복원, HTTP 범위 요청, Blob 정리, 정지 프레임 연결, 입력 중복 방지와 모바일 제스처 동작을 확인합니다.

## GitHub Pages

`.github/workflows/pages.yml`이 `main` 푸시마다 테스트를 실행하고 `dist/`를 배포합니다. 저장소의 Settings → Pages → Source가 **GitHub Actions**로 설정되어 있어야 합니다. 현재 배포 결과와 공개 주소는 저장소의 **Actions** 및 **Deployments**에서 확인할 수 있습니다.

[GitHub Pages 공식 워크플로 문서](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

기존 저장소의 `test.py`와 커밋 이력은 보존합니다.
