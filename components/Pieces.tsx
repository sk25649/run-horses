'use client';

import { useRef } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { GameState } from '@/lib/gameLogic';
import { gridToWorld } from './Board';

// ─── Single piece mesh ────────────────────────────────────────────────────────
interface PieceProps {
  row: number;
  col: number;
  player: 'white' | 'black';
  isSelected: boolean;
  onCellClick: (row: number, col: number) => void;
}

function PieceMesh({ row, col, player, isSelected, onCellClick }: PieceProps) {
  const groupRef = useRef<THREE.Group>(null!);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const base = gridToWorld(row, col);
    const bob = isSelected ? 0.18 * Math.sin(clock.elapsedTime * 4) : 0;
    groupRef.current.position.set(base.x, base.y + 0.22 + bob, base.z);
  });

  const isWhite = player === 'white';
  const bodyColor  = isWhite ? '#d8d8d8' : '#1c1c1c';
  const topColor   = isWhite ? '#f0f0f0' : '#2a2a2a';
  const emissive   = isSelected ? (isWhite ? '#4488ff' : '#8844cc') : '#000000';

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onCellClick(row, col);
  };

  return (
    <group ref={groupRef} onClick={handleClick} castShadow>
      {/* ── Cylinder body ─────────────────────────────────────────────── */}
      <mesh castShadow>
        <cylinderGeometry args={[0.28, 0.33, 0.38, 20]} />
        <meshStandardMaterial
          color={bodyColor}
          roughness={0.25}
          metalness={0.75}
          emissive={emissive}
          emissiveIntensity={isSelected ? 1.2 : 0}
        />
      </mesh>

      {/* ── Sphere cap ────────────────────────────────────────────────── */}
      <mesh position={[0, 0.32, 0]} castShadow>
        <sphereGeometry args={[0.2, 20, 20]} />
        <meshStandardMaterial
          color={topColor}
          roughness={0.18}
          metalness={0.85}
          emissive={emissive}
          emissiveIntensity={isSelected ? 0.8 : 0}
        />
      </mesh>

      {/* ── Selection ring ────────────────────────────────────────────── */}
      {isSelected && (
        <mesh position={[0, -0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.36, 0.46, 36]} />
          <meshBasicMaterial
            color={isWhite ? '#00aaff' : '#aa44ff'}
            transparent
            opacity={0.85}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
}

// ─── Pieces layer ─────────────────────────────────────────────────────────────
export default function Pieces({
  gameState,
  onCellClick,
}: {
  gameState: GameState;
  onCellClick: (row: number, col: number) => void;
}) {
  const pieces: { row: number; col: number; player: 'white' | 'black'; id: string }[] = [];

  for (let r = 0; r < 11; r++) {
    for (let c = 0; c < 11; c++) {
      const p = gameState.board[r][c];
      if (p) pieces.push({ row: r, col: c, player: p.player, id: p.id });
    }
  }

  return (
    <group>
      {pieces.map(({ row, col, player, id }) => {
        const isSelected =
          gameState.selectedCell?.[0] === row && gameState.selectedCell?.[1] === col;
        return (
          <PieceMesh
            key={id}
            row={row}
            col={col}
            player={player}
            isSelected={isSelected}
            onCellClick={onCellClick}
          />
        );
      })}
    </group>
  );
}
