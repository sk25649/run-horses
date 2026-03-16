'use client';
import dynamic from 'next/dynamic';

const GameScene = dynamic(() => import('./GameScene'), { ssr: false });

export default function CandyCatchClientScene() {
  return <GameScene />;
}
