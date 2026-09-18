# GOOBNE OVEN SAUNA · Young Designers

`WE ARE / YOUNG DESIGNERS` 두 줄 타이포그래피와 수증기·열감 효과를 구현한 사이트입니다.

[공개 사이트](https://goobne-young-designers.harry040904.chatgpt.site/)

## 실행

Node.js 22.13 이상과 pnpm을 사용합니다.

```sh
cd apps/young-designers
pnpm install --frozen-lockfile
pnpm dev
```

터미널에 표시되는 로컬 주소를 엽니다. 기본 주소는 `http://localhost:3000/`입니다.

```sh
pnpm build
```

프로덕션 빌드는 `dist/client/`와 `dist/server/`에 생성됩니다. 빌드 이후 `pnpm start`로 Worker 실행을 확인할 수 있습니다.

## 주요 파일

- `app/page.tsx`: 헤더, 내비게이션, 두 줄 제목과 수증기 레이어
- `app/globals.css`: 폰트, 원본 구도, 모바일 배치와 상단 줄 애니메이션
- `app/effects/InkFeedback.tsx`: 수증기와 맞닿은 글자에 적용되는 WebGL 열감 효과
- `public/assets/`: 원본 글자·로고 벡터와 수증기 에셋
- `public/fonts/`: Highman, Utendo 폰트
- `vite.config.ts`, `.openai/hosting.json`: Sites/Cloudflare 빌드 설정

모바일에서도 두 줄 전체와 글자 비율을 유지합니다. 제목 주변 여백을 줄이고, 마지막 위치 조정으로 제목 전체를 24px 아래로 이동한 상태입니다. 움직임 줄이기 설정이나 WebGL 미지원 환경에는 정적인 대체 화면을 제공합니다.

이 앱은 Sites에서 별도로 호스팅합니다. 저장소 루트의 GitHub Pages 설정은 기존 `dist/` 페이지를 계속 배포합니다.

가져온 소스 커밋: `97d858bc59984732b4f6f52b0a1ae5049561df5d`.
