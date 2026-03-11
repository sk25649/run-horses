'use client';

import dynamic from 'next/dynamic';

const GameScene = dynamic(() => import('@/lib/games/minefield/components/GameScene'), { ssr: false });

export default function MinesClientScene() {
  return <GameScene />;
}
