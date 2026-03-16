import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { PokiProvider } from '@/lib/poki/PokiProvider';
import { CrazyGamesProvider } from '@/lib/crazygames/CrazyGamesProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Play Episodes — Play iconic games from your favorite shows',
  description: 'Play iconic board games and challenges from hit TV shows. Real-time multiplayer, AI opponents, and local play.',
  openGraph: {
    title: 'Play Episodes',
    description: 'Play iconic board games and challenges from hit TV shows.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Play Episodes',
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
        <PokiProvider>
          <CrazyGamesProvider>
            {children}
          </CrazyGamesProvider>
        </PokiProvider>
        <Analytics />
      </body>
    </html>
  );
}
