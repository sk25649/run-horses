import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TV Games — Play iconic games from your favorite shows',
  description: 'Play iconic board games and challenges from hit TV shows. Real-time multiplayer, AI opponents, and local play.',
  openGraph: {
    title: 'TV Games',
    description: 'Play iconic board games and challenges from hit TV shows.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TV Games',
    description: 'Play iconic board games and challenges from hit TV shows.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#04040e',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
