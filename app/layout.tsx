import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Run Horses! 3D',
  description: 'A 3D tactical board game. Race your horses to the Oasis at f6.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
