import type { Metadata } from 'next';
import ClientGameScene from '@/components/ClientGameScene';

export async function generateMetadata(
  { searchParams }: { searchParams: Promise<{ r?: string }> }
): Promise<Metadata> {
  const params = await searchParams;

  if (params?.r) {
    return {
      openGraph: {
        title: "You've been challenged — Run Horses! Online",
        description: 'Someone challenged you to a real-time match. Click to play!',
        images: [{ url: '/api/og', width: 1200, height: 630 }],
      },
      twitter: {
        card: 'summary_large_image',
        title: "You've been challenged — Run Horses! Online",
        description: 'Someone challenged you to a real-time match. Click to play!',
        images: ['/api/og'],
      },
    };
  }

  return {};
}

export default function Home() {
  return <ClientGameScene />;
}
