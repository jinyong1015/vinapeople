import { AppShell } from '@/components/layout/AppShell';
import { Providers } from '@/components/providers/Providers';
import { ThemeScript } from '@/components/providers/ThemeScript';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VINA 인원현황 관리',
  description: 'VINA 인원현황 대시보드 및 상세 조회',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeScript />
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
