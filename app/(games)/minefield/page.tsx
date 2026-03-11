import type { Metadata } from 'next';
import MinesClientScene from '@/lib/games/minefield/components/ClientGameScene';

export async function generateMetadata(
  { searchParams }: { searchParams: Promise<{ r?: string }> }
): Promise<Metadata> {
  const params = await searchParams;

  if (params?.r) {
    return {
      openGraph: {
        title: "You've been challenged — Mines of Oblivion",
        description: 'Someone challenged you to a real-time match. Place your mines and play!',
        images: [{ url: '/minefield/api/og', width: 1200, height: 630 }],
      },
      twitter: {
        card: 'summary_large_image',
        title: "You've been challenged — Mines of Oblivion",
        description: 'Someone challenged you to a real-time match. Place your mines and play!',
        images: ['/minefield/api/og'],
      },
    };
  }

  return {
    title: 'Mines of Oblivion',
    description: 'A memory strategy game. Place hidden mines, navigate the board, collect treasures.',
    openGraph: {
      title: 'Mines of Oblivion',
      description: 'A memory strategy game. Place hidden mines, navigate the board, collect treasures.',
      type: 'website',
    },
  };
}

export default function MinefieldPage() {
  return <MinesClientScene />;
}
