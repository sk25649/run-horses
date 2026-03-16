import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Candy Catch — Play Episodes',
  description: 'Catch falling candy, dodge the bombs. How high can you score?',
  openGraph: {
    title: 'Candy Catch',
    description: 'Catch falling candy, dodge the bombs. How high can you score?',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#ff6eb4',
};

export default function CandyCatchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
