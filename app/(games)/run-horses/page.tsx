import type { Metadata } from 'next';
import RunHorsesClientScene from '@/lib/games/run-horses/components/ClientGameScene';

export async function generateMetadata(
  { searchParams }: { searchParams: Promise<{ r?: string }> }
): Promise<Metadata> {
  const params = await searchParams;

  if (params?.r) {
    return {
      openGraph: {
        title: "You've been challenged — Run Horses! Online",
        description: 'Someone challenged you to a real-time match. Click to play!',
        images: [{ url: '/run-horses/api/og', width: 1200, height: 630 }],
      },
      twitter: {
        card: 'summary_large_image',
        title: "You've been challenged — Run Horses! Online",
        description: 'Someone challenged you to a real-time match. Click to play!',
        images: ['/run-horses/api/og'],
      },
    };
  }

  return {
    title: 'Run Horses! 3D',
    description: 'A 3D tactical board game. Race your horses to the Oasis.',
    openGraph: {
      title: 'Run Horses! 3D',
      description: 'A 3D tactical board game. Race your horses to the Oasis.',
      type: 'website',
    },
  };
}

export default function RunHorsesPage() {
  return <RunHorsesClientScene />;
}
