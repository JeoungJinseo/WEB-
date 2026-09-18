import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'TEAM KN0T — GOOBNE OVEN SAUNA',
  description:
    '굽네 × 홍익대학교. 다섯 명의 서로 다른 강점과 열정으로 만드는 새로운 브랜드 경험.',
  icons: { icon: '/assets/logo.svg' },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
