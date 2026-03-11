'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GameState } from '@/lib/games/minefield/gameLogic';
import { gridToWorld } from './Board';

interface TokenProps {
  row: number;
  col: number;
  player: 'white' | 'black';
  isTurn: boolean;
}

function TokenMesh({ row, col, player, isTurn }: TokenProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const animXZ = useRef<{ x: number; z: number } | null>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const target = gridToWorld(row, col);
    const bob = isTurn ? 0.12 * Math.abs(Math.sin(clock.elapsedTime * 2.2)) : 0;

    if (!animXZ.current) {
      animXZ.current = { x: target.x, z: target.z };
    }
    animXZ.current.x += (target.x - animXZ.current.x) * 0.1;
    animXZ.current.z += (target.z - animXZ.current.z) * 0.1;

    groupRef.current.position.set(animXZ.current.x, 0.18 + bob, animXZ.current.z);
  });

  const isWhite = player === 'white';
  const color = isWhite ? '#2277ff' : '#ff8800';
  const emissive = isWhite ? '#1155ee' : '#ee6600';
  const emissiveIntensity = isTurn ? 0.8 : 0.2;

  const m = { color, roughness: 0.3, metalness: 0.6, emissive, emissiveIntensity } as const;

  return (
    <group ref={groupRef}>
      {/* ── Base disc ──────────────────────────────────────────────────── */}
      <mesh castShadow position={[0, -0.12, 0]}>
        <cylinderGeometry args={[0.32, 0.35, 0.08, 24]} />
        <meshStandardMaterial {...m} />
      </mesh>

      {/* ── Body column ────────────────────────────────────────────────── */}
      <mesh castShadow position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.15, 0.25, 0.38, 16]} />
        <meshStandardMaterial {...m} />
      </mesh>

      {/* ── Dome top ───────────────────────────────────────────────────── */}
      <mesh castShadow position={[0, 0.32, 0]}>
        <sphereGeometry args={[0.17, 16, 12]} />
        <meshStandardMaterial {...m} />
      </mesh>

      {/* ── Active turn ring ───────────────────────────────────────────── */}
      {isTurn && (
        <mesh position={[0, -0.16, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.37, 0.46, 32]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.7}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
}

export default function Pieces({ gameState }: { gameState: GameState }) {
  const isMoving = gameState.phase === 'moving' || gameState.phase === 'finished';
  return (
    <group>
      {(['white', 'black'] as const).map(player => {
        const [r, c] = gameState.positions[player];
        const isTurn = isMoving && gameState.currentTurn === player && gameState.winner === null;
        return (
          <TokenMesh
            key={player}
            row={r}
            col={c}
            player={player}
            isTurn={isTurn}
          />
        );
      })}
    </group>
  );
}
