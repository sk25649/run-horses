import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Run Horses! 3D',
  description: 'A 3D tactical board game. Race your horses to the Oasis.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#00ffcc',
};

export default function RunHorsesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
