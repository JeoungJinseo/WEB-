import type { Metadata, Viewport } from 'next';
import './globals.css';
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#000000' };
export const metadata: Metadata = {
  title: 'GOOBNE OVEN SAUNA — 2026 DDP Young Designer',
  description: 'WE ARE YOUNG DESIGNERS. GOOBNE OVEN SAUNA, 2026 DDP YOUNG DESIGNER.',
  icons: { icon: '/assets/logo.svg' },
};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return <html lang="en"><body>{children}</body></html>;
}
