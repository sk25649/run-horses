import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Run Horses! 3D',
  description: 'A 3D tactical board game. Race your horses to the Oasis.',
  openGraph: {
    title: 'Run Horses! 3D',
    description: 'A 3D tactical board game. Race your horses to the Oasis.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Run Horses! 3D',
    description: 'A 3D tactical board game. Race your horses to the Oasis.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
