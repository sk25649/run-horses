'use client';

import dynamic from 'next/dynamic';

// Disable SSR — Three.js requires browser APIs (canvas, WebGL)
const GameScene = dynamic(() => import('@/components/GameScene'), { ssr: false });

export default function Home() {
  return <GameScene />;
}
