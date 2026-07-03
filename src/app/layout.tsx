import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI 상담 보조 시스템',
  description: 'Healthcare AI Counseling Assistant',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
