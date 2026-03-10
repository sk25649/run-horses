'use client';

import dynamic from 'next/dynamic';

const GameScene = dynamic(() => import('@/lib/games/run-horses/components/GameScene'), { ssr: false });

export default function RunHorsesClientScene() {
  return <GameScene />;
}
