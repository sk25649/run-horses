'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GameState } from '@/lib/gameLogic';
import { gridToWorld } from './Board';

// ─── Single piece mesh ────────────────────────────────────────────────────────
interface PieceProps {
  row: number;
  col: number;
  player: 'white' | 'black';
  isSelected: boolean;
}

function PieceMesh({ row, col, player, isSelected }: PieceProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const animXZ = useRef<{ x: number; z: number } | null>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const target = gridToWorld(row, col);
    const bob = isSelected ? 0.18 * Math.abs(Math.sin(clock.elapsedTime * 1.8)) : 0;

    if (!animXZ.current) {
      animXZ.current = { x: target.x, z: target.z };
    }

    animXZ.current.x += (target.x - animXZ.current.x) * 0.09;
    animXZ.current.z += (target.z - animXZ.current.z) * 0.09;

    const px = animXZ.current.x;
    const pz = animXZ.current.z;

    groupRef.current.position.set(px, 0.22 + bob, pz);

    // Rotate so the horse head (+x local) always faces toward the board center (0,0,0).
    // θ = atan2(pz, -px)  →  local +x maps to world (-px, 0, -pz) normalised.
    if (Math.abs(px) > 0.01 || Math.abs(pz) > 0.01) {
      groupRef.current.rotation.y = Math.atan2(pz, -px);
    }
  });

  const isWhite = player === 'white';
  const color    = isWhite ? '#3388ff' : '#ff8811';
  const emissive = isWhite ? '#2266ff' : '#ff7700';
  const emissiveIntensity = isSelected ? 1.1 : 0.22;

  // Shared material props — knight faces the +x axis so the head profile
  // reads clearly from the default camera angle.
  const m = {
    color,
    roughness:  isWhite ? 0.22 : 0.28,
    metalness:  isWhite ? 0.75 : 0.72,
    emissive,
    emissiveIntensity,
  } as const;

  return (
    <group ref={groupRef}>
      {/* ── Base disc ─────────────────────────────────────────────────── */}
      <mesh castShadow position={[0, -0.13, 0]}>
        <cylinderGeometry args={[0.33, 0.36, 0.09, 28]} />
        <meshStandardMaterial {...m} />
      </mesh>

      {/* ── Tapered body column ───────────────────────────────────────── */}
      <mesh castShadow position={[0, 0.10, 0]}>
        <cylinderGeometry args={[0.17, 0.28, 0.44, 18]} />
        <meshStandardMaterial {...m} />
      </mesh>

      {/* ── Shoulder collar (flares slightly outward) ─────────────────── */}
      <mesh castShadow position={[0, 0.34, 0]}>
        <cylinderGeometry args={[0.21, 0.18, 0.08, 18]} />
        <meshStandardMaterial {...m} />
      </mesh>

      {/* ── Neck (thin cylinder angled forward along +x) ──────────────── */}
      <mesh castShadow position={[0.06, 0.51, 0]} rotation={[0, 0, -0.24]}>
        <cylinderGeometry args={[0.11, 0.15, 0.30, 14]} />
        <meshStandardMaterial {...m} />
      </mesh>

      {/* ── Horse head (box tilted forward) ───────────────────────────── */}
      <mesh castShadow position={[0.17, 0.68, 0]} rotation={[0, 0, -0.40]}>
        <boxGeometry args={[0.30, 0.23, 0.27]} />
        <meshStandardMaterial {...m} />
      </mesh>

      {/* ── Muzzle / snout ────────────────────────────────────────────── */}
      <mesh castShadow position={[0.30, 0.56, 0]} rotation={[0, 0, -0.18]}>
        <boxGeometry args={[0.18, 0.13, 0.21]} />
        <meshStandardMaterial {...m} />
      </mesh>

      {/* ── Selection ring ────────────────────────────────────────────── */}
      {isSelected && (
        <mesh position={[0, -0.18, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.38, 0.48, 36]} />
          <meshBasicMaterial
            color={isWhite ? '#66aaff' : '#ffaa44'}
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
export default function Pieces({ gameState }: { gameState: GameState }) {
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
          />
        );
      })}
    </group>
  );
}
