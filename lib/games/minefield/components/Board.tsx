'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { GameState, ROWS, COLS, TREASURE_POSITIONS, TREASURE_VALUES, isForbiddenForMine } from '@/lib/games/minefield/gameLogic';

// ─── Constants ────────────────────────────────────────────────────────────────
const TILE_GAP = 1.05;
const TILE_W = 0.94;
const TILE_H = 0.14;
const HIDDEN = new THREE.Matrix4().makeTranslation(0, -9999, 0);

export function gridToWorld(row: number, col: number): THREE.Vector3 {
  return new THREE.Vector3((col - 5) * TILE_GAP, 0, (row - 5) * TILE_GAP);
}

// Adjacency count → color
function adjColor(count: number): string {
  if (count === 0) return '#ffffff';
  if (count <= 2) return '#4488ff';
  if (count <= 4) return '#f5c842';
  if (count <= 6) return '#ff8800';
  return '#ff4444';
}

// ─── Treasure chest ───────────────────────────────────────────────────────────
function TreasureChest({ position, scale = 0.55, phaseOffset }: {
  position: [number, number, number];
  scale?: number;
  phaseOffset: number;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime;
    groupRef.current.position.y = position[1] + 0.1 * Math.sin(t * 1.4 + phaseOffset);
    groupRef.current.rotation.y = t * 0.4 + phaseOffset;
  });

  const w = scale;
  const d = scale * 0.72;
  const bodyH = scale * 0.44;
  const lidH  = scale * 0.28;
  const trim  = scale * 0.04;

  return (
    <group ref={groupRef} position={position}>
      {/* Body */}
      <mesh position={[0, bodyH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, bodyH, d]} />
        <meshStandardMaterial color="#6B3E1A" roughness={0.8} metalness={0.05} />
      </mesh>

      {/* Lid */}
      <mesh position={[0, bodyH + lidH / 2, 0]} castShadow>
        <boxGeometry args={[w + 0.015, lidH, d + 0.015]} />
        <meshStandardMaterial color="#7D4A20" roughness={0.72} metalness={0.1} />
      </mesh>

      {/* Gold horizontal strap — body */}
      <mesh position={[0, bodyH * 0.5, d / 2 + 0.005]}>
        <boxGeometry args={[w + 0.01, trim, 0.01]} />
        <meshStandardMaterial color="#f5c842" emissive="#f5a020" emissiveIntensity={0.5} metalness={0.9} roughness={0.15} />
      </mesh>

      {/* Gold horizontal strap — lid bottom */}
      <mesh position={[0, bodyH + 0.005, d / 2 + 0.01]}>
        <boxGeometry args={[w + 0.02, trim * 0.8, 0.01]} />
        <meshStandardMaterial color="#f5c842" emissive="#f5a020" emissiveIntensity={0.5} metalness={0.9} roughness={0.15} />
      </mesh>

      {/* Lock clasp */}
      <mesh position={[0, bodyH * 0.72, d / 2 + 0.015]}>
        <boxGeometry args={[scale * 0.12, scale * 0.12, 0.025]} />
        <meshStandardMaterial color="#f5c842" emissive="#ffcc00" emissiveIntensity={0.8} metalness={0.95} roughness={0.08} />
      </mesh>

      {/* Corner posts — front-left, front-right */}
      {([-1, 1] as const).map((side) => (
        <mesh key={side} position={[side * (w / 2 - 0.01), bodyH / 2, d / 2 + 0.005]}>
          <boxGeometry args={[trim, bodyH + lidH + 0.01, 0.015]} />
          <meshStandardMaterial color="#d4a017" emissive="#c08010" emissiveIntensity={0.3} metalness={0.85} roughness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface BoardProps {
  gameState: GameState;
  validMoves: [number, number][];
  ownMines: [number, number][];        // player's own mines to display
  opponentMines?: [number, number][];  // shown only at game end
  placingMines?: [number, number][];   // mines being placed this session
  showForbidden?: boolean;             // placement phase: dim forbidden zones
  lastTo?: [number, number] | null;
  hideInfo?: boolean;                  // hard mode: hide adjacency numbers + mine overlays
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Board({
  gameState,
  validMoves,
  ownMines,
  opponentMines = [],
  placingMines = [],
  showForbidden = false,
  lastTo,
  hideInfo = false,
}: BoardProps) {
  const baseRef      = useRef<THREE.InstancedMesh>(null!);
  const treasureRef  = useRef<THREE.InstancedMesh>(null!);
  const steppedRef   = useRef<THREE.InstancedMesh>(null!);
  const explodedRef  = useRef<THREE.InstancedMesh>(null!);
  const validRef     = useRef<THREE.InstancedMesh>(null!);
  const lastToRef    = useRef<THREE.InstancedMesh>(null!);
  const forbidRef    = useRef<THREE.InstancedMesh>(null!);
  const clickRef     = useRef<THREE.InstancedMesh>(null!);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const allCells = useMemo(() => {
    const cells: [number, number][] = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        cells.push([r, c]);
    return cells;
  }, []);

  // ── One-time: place base tiles + click overlay ───────────────────────────────
  useEffect(() => {
    allCells.forEach(([r, c], i) => {
      const p = gridToWorld(r, c);
      dummy.position.set(p.x, 0, p.z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      baseRef.current.setMatrixAt(i, dummy.matrix);
      clickRef.current.setMatrixAt(i, dummy.matrix);
    });
    baseRef.current.instanceMatrix.needsUpdate = true;
    clickRef.current.instanceMatrix.needsUpdate = true;

    // Treasure tiles
    TREASURE_POSITIONS.forEach(([r, c], i) => {
      const p = gridToWorld(r, c);
      dummy.position.set(p.x, 0.02, p.z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      treasureRef.current.setMatrixAt(i, dummy.matrix);
    });
    treasureRef.current.count = TREASURE_POSITIONS.length;
    treasureRef.current.instanceMatrix.needsUpdate = true;

    // Hide overlays
    for (let i = 0; i < ROWS * COLS; i++) {
      validRef.current.setMatrixAt(i, HIDDEN);
      forbidRef.current.setMatrixAt(i, HIDDEN);
      steppedRef.current.setMatrixAt(i, HIDDEN);
      explodedRef.current.setMatrixAt(i, HIDDEN);
    }
    validRef.current.count = 0;
    forbidRef.current.count = 0;
    steppedRef.current.count = 0;
    explodedRef.current.count = 0;
    validRef.current.instanceMatrix.needsUpdate = true;
    forbidRef.current.instanceMatrix.needsUpdate = true;
    steppedRef.current.instanceMatrix.needsUpdate = true;
    explodedRef.current.instanceMatrix.needsUpdate = true;

    lastToRef.current.setMatrixAt(0, HIDDEN);
    lastToRef.current.count = 0;
    lastToRef.current.instanceMatrix.needsUpdate = true;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reactive: stepped / exploded overlays ────────────────────────────────────
  useEffect(() => {
    if (!steppedRef.current || !explodedRef.current) return;
    let si = 0, ei = 0;
    allCells.forEach(([r, c]) => {
      const cell = gameState.cells[r][c];
      const p = gridToWorld(r, c);
      if (!hideInfo && cell.exploded) {
        dummy.position.set(p.x, 0.01, p.z);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        explodedRef.current.setMatrixAt(ei++, dummy.matrix);
      } else if (cell.stepped) {
        dummy.position.set(p.x, 0.01, p.z);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        steppedRef.current.setMatrixAt(si++, dummy.matrix);
      }
    });
    steppedRef.current.count = si;
    explodedRef.current.count = ei;
    steppedRef.current.instanceMatrix.needsUpdate = true;
    explodedRef.current.instanceMatrix.needsUpdate = true;
  }, [gameState.cells, hideInfo]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reactive: valid moves highlight ─────────────────────────────────────────
  useEffect(() => {
    if (!validRef.current) return;
    validMoves.forEach(([r, c], i) => {
      const p = gridToWorld(r, c);
      dummy.position.set(p.x, 0.09, p.z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      validRef.current.setMatrixAt(i, dummy.matrix);
      validRef.current.setColorAt(i, new THREE.Color('#aa00ff'));
    });
    validRef.current.count = validMoves.length;
    validRef.current.instanceMatrix.needsUpdate = true;
    if (validRef.current.instanceColor) validRef.current.instanceColor.needsUpdate = true;
  }, [validMoves]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reactive: forbidden zone overlay (placement phase) ──────────────────────
  useEffect(() => {
    if (!forbidRef.current) return;
    if (!showForbidden) {
      forbidRef.current.count = 0;
      forbidRef.current.instanceMatrix.needsUpdate = true;
      return;
    }
    let idx = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (isForbiddenForMine(r, c)) {
          const p = gridToWorld(r, c);
          dummy.position.set(p.x, 0.09, p.z);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          forbidRef.current.setMatrixAt(idx++, dummy.matrix);
        }
      }
    }
    forbidRef.current.count = idx;
    forbidRef.current.instanceMatrix.needsUpdate = true;
  }, [showForbidden]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reactive: last-to highlight ──────────────────────────────────────────────
  useEffect(() => {
    if (!lastToRef.current) return;
    if (lastTo) {
      const p = gridToWorld(lastTo[0], lastTo[1]);
      dummy.position.set(p.x, 0.08, p.z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      lastToRef.current.setMatrixAt(0, dummy.matrix);
      lastToRef.current.setColorAt(0, new THREE.Color('#f5c842'));
      lastToRef.current.count = 1;
    } else {
      lastToRef.current.count = 0;
    }
    lastToRef.current.instanceMatrix.needsUpdate = true;
    if (lastToRef.current.instanceColor) lastToRef.current.instanceColor.needsUpdate = true;
  }, [lastTo]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Treasure pulse ───────────────────────────────────────────────────────────
  useFrame(({ clock }) => {
    const mat = treasureRef.current?.material as THREE.MeshStandardMaterial | undefined;
    if (mat) mat.emissiveIntensity = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 2.2);
  });

  const tileGeo = <boxGeometry args={[TILE_W, TILE_H, TILE_W]} />;
  const hlGeo   = <boxGeometry args={[TILE_W - 0.04, 0.05, TILE_W - 0.04]} />;

  return (
    <group>
      {/* ── All 121 base tiles — fixed green material (no vertexColors) ──── */}
      <instancedMesh ref={baseRef} args={[undefined, undefined, ROWS * COLS]} receiveShadow>
        {tileGeo}
        <meshStandardMaterial color="#5ab86a" roughness={0.65} metalness={0.08} />
      </instancedMesh>

      {/* ── Stepped cell overlay (slightly darker green) ─────────────────── */}
      <instancedMesh ref={steppedRef} args={[undefined, undefined, ROWS * COLS]}>
        {tileGeo}
        <meshStandardMaterial color="#2e7a3e" roughness={0.7} metalness={0.05} />
      </instancedMesh>

      {/* ── Exploded cell overlay (red) ──────────────────────────────────── */}
      <instancedMesh ref={explodedRef} args={[undefined, undefined, ROWS * COLS]}>
        {tileGeo}
        <meshStandardMaterial color="#8b1a1a" emissive="#ff0000" emissiveIntensity={0.15} roughness={0.6} metalness={0.1} />
      </instancedMesh>

      {/* ── 3 treasure tiles (golden glow) ─────────────────────────────── */}
      <instancedMesh ref={treasureRef} args={[undefined, undefined, 3]} receiveShadow>
        <boxGeometry args={[TILE_W, TILE_H + 0.04, TILE_W]} />
        <meshStandardMaterial
          color="#f5c842"
          emissive="#f5c842"
          emissiveIntensity={0.7}
          roughness={0.2}
          metalness={0.6}
        />
      </instancedMesh>

      {/* ── 3D Treasure chests ───────────────────────────────────────────── */}
      {gameState.treasures.map((t, i) => {
        if (t.collected) return null;
        const p = gridToWorld(t.pos[0], t.pos[1]);
        const pts = TREASURE_VALUES[i] ?? 10;
        const scale = 0.34 + (pts / 20) * 0.32;
        return (
          <TreasureChest
            key={`chest-${i}`}
            position={[p.x, 0.26, p.z]}
            scale={scale}
            phaseOffset={i * 2.1}
          />
        );
      })}

      {/* ── Valid move highlights ───────────────────────────────────────── */}
      <instancedMesh ref={validRef} args={[undefined, undefined, ROWS * COLS]}>
        {hlGeo}
        <meshStandardMaterial
          vertexColors transparent opacity={0.55}
          emissive="#aa00ff" emissiveIntensity={0.35}
          roughness={0.3} depthWrite={false}
        />
      </instancedMesh>

      {/* ── Forbidden zone overlay (placement phase) ────────────────────── */}
      <instancedMesh ref={forbidRef} args={[undefined, undefined, ROWS * COLS]}>
        {hlGeo}
        <meshStandardMaterial
          color="#223322" transparent opacity={0.6}
          roughness={0.5} depthWrite={false}
        />
      </instancedMesh>

      {/* ── Last-to highlight ───────────────────────────────────────────── */}
      <instancedMesh ref={lastToRef} args={[undefined, undefined, 1]}>
        {hlGeo}
        <meshStandardMaterial
          vertexColors transparent opacity={0.4}
          emissive="#f5c842" emissiveIntensity={0.5}
          roughness={0.3} depthWrite={false}
        />
      </instancedMesh>

      {/* ── Invisible click overlay ─────────────────────────────────────── */}
      <instancedMesh ref={clickRef} args={[undefined, undefined, ROWS * COLS]}>
        <boxGeometry args={[1.0, 0.8, 1.0]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </instancedMesh>

      {/* ── Own mine indicators (red spheres above tile) ─────────────────── */}
      {[...ownMines, ...opponentMines].map(([r, c], i) => {
        const p = gridToWorld(r, c);
        const isOwn = i < ownMines.length;
        return (
          <mesh key={`mine-${r}-${c}-${i}`} position={[p.x, 0.28, p.z]} castShadow>
            <sphereGeometry args={[0.14, 10, 10]} />
            <meshStandardMaterial
              color={isOwn ? '#ff2222' : '#ff8800'}
              emissive={isOwn ? '#ff0000' : '#ff4400'}
              emissiveIntensity={0.6}
              roughness={0.3}
              metalness={0.5}
            />
          </mesh>
        );
      })}

      {/* ── Placement session mines (being placed, before confirm) ───────── */}
      {placingMines.map(([r, c]) => {
        const p = gridToWorld(r, c);
        return (
          <mesh key={`placing-${r}-${c}`} position={[p.x, 0.28, p.z]}>
            <sphereGeometry args={[0.14, 10, 10]} />
            <meshStandardMaterial
              color="#ff4444"
              emissive="#ff0000"
              emissiveIntensity={0.8}
              roughness={0.3}
              metalness={0.4}
              transparent
              opacity={0.85}
            />
          </mesh>
        );
      })}

      {/* ── Adjacency numbers on stepped cells (hidden in hard mode) ────── */}
      {!hideInfo && gameState.cells.flatMap((row, r) =>
        row.map((cell, c) => {
          if (!cell.stepped || cell.exploded) return null;
          const count = cell.adjacentCount;
          const p = gridToWorld(r, c);
          return (
            <Text
              key={`num-${r}-${c}`}
              position={[p.x, 0.22, p.z]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.28}
              color={adjColor(count)}
              anchorX="center"
              anchorY="middle"
              fontWeight={700}
            >
              {count.toString()}
            </Text>
          );
        })
      )}

      {/* ── Board base plate ────────────────────────────────────────────── */}
      <mesh receiveShadow position={[0, -0.13, 0]}>
        <boxGeometry args={[ROWS * TILE_GAP + 0.4, 0.1, COLS * TILE_GAP + 0.4]} />
        <meshStandardMaterial color="#1a3a1a" roughness={0.9} metalness={0.4} />
      </mesh>
    </group>
  );
}
