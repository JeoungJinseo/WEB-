import type { Metadata } from 'next';
import './globals.css';
export const viewport = {width:'device-width',initialScale:1,viewportFit:'cover'};

export const metadata: Metadata = {
  title: 'GOOBNE OVEN SAUNA — 2026 DDP Young Designer',
  description: 'SWEAT OUT, GATHER IN. GOOBNE × HONGIK UNIVERSITY. 오븐 사우나의 이야기를 스크롤로 만나보세요.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        {children}
      </body>
    </html>
  );
}
