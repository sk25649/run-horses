import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Mines of Oblivion',
  description: 'A memory strategy game. Place hidden mines, navigate the board, collect treasures.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#ff4444',
};

export default function MinefieldLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
