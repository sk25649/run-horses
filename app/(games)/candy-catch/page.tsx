import type { Metadata } from 'next';
import CandyCatchClientScene from '@/lib/games/candy-catch/components/ClientGameScene';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Candy Catch — Play Episodes',
    description: 'Catch falling candy, dodge the bombs. How high can you score?',
    openGraph: {
      title: 'Candy Catch 🍬',
      description: 'Catch falling candy, dodge the bombs. How high can you score?',
      type: 'website',
    },
  };
}

export default function CandyCatchPage() {
  return <CandyCatchClientScene />;
}
