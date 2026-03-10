'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  GameState,
  getTerrain,
  OASIS,
  ROWS,
  COLS,
} from '@/lib/games/run-horses/gameLogic';

// ─── Module-level constants (avoid per-render allocations) ───────────────────
const HIDDEN_MAT  = new THREE.Matrix4().makeTranslation(0, -9999, 0);
const COL_VALID   = new THREE.Color('#aa00ff');
const COL_SEL     = new THREE.Color('#00e5ff');
const COL_LAST    = new THREE.Color('#f5c842');

// ─── World-space helpers ──────────────────────────────────────────────────────
const TILE_GAP = 1.05;
const TILE_W   = 0.94;
const TILE_H   = 0.14;

export function gridToWorld(row: number, col: number): THREE.Vector3 {
  return new THREE.Vector3((col - 5) * TILE_GAP, 0, (row - 5) * TILE_GAP);
}

// ─── Terrain catalogue ────────────────────────────────────────────────────────
function buildTerrainMaps() {
  const desert: [number, number][] = [];
  const garden: [number, number][] = [];
  const all:    [number, number][] = [];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      all.push([r, c]);
      const t = getTerrain(r, c);
      if (t === 'desert') desert.push([r, c]);
      else if (t === 'garden') garden.push([r, c]);
    }
  }
  return { desert, garden, all };
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface LastMove {
  fromRow: number; fromCol: number; toRow: number; toCol: number;
}

interface BoardProps {
  gameState: GameState;
  lastMove?: LastMove | null;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Board({ gameState, lastMove }: BoardProps) {
  const desertRef  = useRef<THREE.InstancedMesh>(null!);
  const gardenRef  = useRef<THREE.InstancedMesh>(null!);
  const oasisRef   = useRef<THREE.InstancedMesh>(null!);
  const hlRef      = useRef<THREE.InstancedMesh>(null!);  // valid-move highlights
  const selRef     = useRef<THREE.InstancedMesh>(null!);  // selected-cell
  const lastMvRef  = useRef<THREE.InstancedMesh>(null!);  // last-move highlights
  const clickRef   = useRef<THREE.InstancedMesh>(null!);  // invisible hit area

  const { desert, garden, all } = useMemo(buildTerrainMaps, []);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // ── One-time: place static tiles + hide all highlights ──────────────────────
  useEffect(() => {
    const place = (mesh: THREE.InstancedMesh, cells: [number, number][]) => {
      cells.forEach(([r, c], i) => {
        const p = gridToWorld(r, c);
        dummy.position.set(p.x, 0, p.z);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    };

    place(desertRef.current, desert);
    place(gardenRef.current, garden);

    // Oasis
    const op = gridToWorld(OASIS[0], OASIS[1]);
    dummy.position.set(op.x, 0.02, op.z);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    oasisRef.current.setMatrixAt(0, dummy.matrix);
    oasisRef.current.instanceMatrix.needsUpdate = true;

    // Click overlay
    place(clickRef.current, all);

    // Initialise highlights to hidden so no ghost tile appears on frame 1
    for (let i = 0; i < ROWS * COLS; i++) hlRef.current.setMatrixAt(i, HIDDEN_MAT);
    hlRef.current.count = 0;
    hlRef.current.instanceMatrix.needsUpdate = true;

    selRef.current.setMatrixAt(0, HIDDEN_MAT);
    selRef.current.instanceMatrix.needsUpdate = true;

    lastMvRef.current.setMatrixAt(0, HIDDEN_MAT);
    lastMvRef.current.setMatrixAt(1, HIDDEN_MAT);
    lastMvRef.current.count = 0;
    lastMvRef.current.instanceMatrix.needsUpdate = true;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reactive: update highlight overlays on state change ─────────────────────
  useEffect(() => {
    if (!hlRef.current || !selRef.current) return;

    // Valid move markers
    gameState.validMoves.forEach(([r, c], i) => {
      const p = gridToWorld(r, c);
      dummy.position.set(p.x, 0.09, p.z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      hlRef.current.setMatrixAt(i, dummy.matrix);
      hlRef.current.setColorAt(i, COL_VALID);
    });
    hlRef.current.count = gameState.validMoves.length;
    hlRef.current.instanceMatrix.needsUpdate = true;
    if (hlRef.current.instanceColor) hlRef.current.instanceColor.needsUpdate = true;

    // Selected cell marker
    if (gameState.selectedCell) {
      const [r, c] = gameState.selectedCell;
      const p = gridToWorld(r, c);
      dummy.position.set(p.x, 0.1, p.z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      selRef.current.setMatrixAt(0, dummy.matrix);
      selRef.current.setColorAt(0, COL_SEL);
    } else {
      selRef.current.setMatrixAt(0, HIDDEN_MAT);
    }
    selRef.current.instanceMatrix.needsUpdate = true;
    if (selRef.current.instanceColor) selRef.current.instanceColor.needsUpdate = true;
  }, [gameState.validMoves, gameState.selectedCell]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reactive: update last-move highlights ───────────────────────────────────
  useEffect(() => {
    if (!lastMvRef.current) return;
    if (lastMove) {
      [[lastMove.fromRow, lastMove.fromCol], [lastMove.toRow, lastMove.toCol]].forEach(([r, c], i) => {
        const p = gridToWorld(r, c);
        dummy.position.set(p.x, 0.08, p.z);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        lastMvRef.current.setMatrixAt(i, dummy.matrix);
        lastMvRef.current.setColorAt(i, COL_LAST);
      });
      lastMvRef.current.count = 2;
    } else {
      lastMvRef.current.count = 0;
    }
    lastMvRef.current.instanceMatrix.needsUpdate = true;
    if (lastMvRef.current.instanceColor) lastMvRef.current.instanceColor.needsUpdate = true;
  }, [lastMove]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Oasis pulse ─────────────────────────────────────────────────────────────
  useFrame(({ clock }) => {
    const mat = oasisRef.current?.material as THREE.MeshStandardMaterial | undefined;
    if (mat) mat.emissiveIntensity = 0.55 + 0.65 * Math.sin(clock.elapsedTime * 2.4);
  });


  // Shared box geometry element (R3F creates separate THREE objects per usage)
  const tileGeo  = <boxGeometry args={[TILE_W, TILE_H, TILE_W]} />;
  const hlGeo    = <boxGeometry args={[TILE_W - 0.04, 0.05, TILE_W - 0.04]} />;

  return (
    <group>
      {/* ── Desert tiles (108 instances) ────────────────────────────────── */}
      <instancedMesh ref={desertRef} args={[undefined, undefined, desert.length]} receiveShadow>
        {tileGeo}
        <meshStandardMaterial color="#c9932c" roughness={0.88} metalness={0.05} />
      </instancedMesh>

      {/* ── Garden tiles (12 instances) ─────────────────────────────────── */}
      <instancedMesh ref={gardenRef} args={[undefined, undefined, garden.length]} receiveShadow>
        {tileGeo}
        <meshStandardMaterial color="#1d6b34" roughness={0.65} metalness={0.12} />
      </instancedMesh>

      {/* ── Oasis tile (1 instance, glowing cyan) ───────────────────────── */}
      <instancedMesh ref={oasisRef} args={[undefined, undefined, 1]} receiveShadow>
        <boxGeometry args={[TILE_W, TILE_H + 0.04, TILE_W]} />
        <meshStandardMaterial
          color="#00ffcc"
          emissive="#00ffcc"
          emissiveIntensity={0.7}
          roughness={0.15}
          metalness={0.5}
        />
      </instancedMesh>

      {/* ── Last-move highlights (2 instances: from + to) ───────────────── */}
      <instancedMesh ref={lastMvRef} args={[undefined, undefined, 2]}>
        {hlGeo}
        <meshStandardMaterial
          vertexColors
          transparent
          opacity={0.35}
          emissive="#f5c842"
          emissiveIntensity={0.5}
          roughness={0.3}
          depthWrite={false}
        />
      </instancedMesh>

      {/* ── Valid-move highlights (up to 121, count driven) ─────────────── */}
      <instancedMesh ref={hlRef} args={[undefined, undefined, ROWS * COLS]}>
        {hlGeo}
        <meshStandardMaterial
          vertexColors
          transparent
          opacity={0.55}
          emissive="#aa00ff"
          emissiveIntensity={0.35}
          roughness={0.3}
          depthWrite={false}
        />
      </instancedMesh>

      {/* ── Selected-cell highlight (1 instance) ────────────────────────── */}
      <instancedMesh ref={selRef} args={[undefined, undefined, 1]}>
        {hlGeo}
        <meshStandardMaterial
          vertexColors
          transparent
          opacity={0.72}
          emissive="#0066ff"
          emissiveIntensity={0.6}
          roughness={0.2}
          depthWrite={false}
        />
      </instancedMesh>

      {/* ── Invisible hit-test overlay for the whole board ──────────────── */}
      <instancedMesh
        ref={clickRef}
        args={[undefined, undefined, ROWS * COLS]}
      >
        <boxGeometry args={[1.0, 0.8, 1.0]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </instancedMesh>

      {/* ── Board base plate ─────────────────────────────────────────────── */}
      <mesh receiveShadow position={[0, -0.13, 0]}>
        <boxGeometry args={[ROWS * TILE_GAP + 0.4, 0.1, COLS * TILE_GAP + 0.4]} />
        <meshStandardMaterial color="#08081a" roughness={0.9} metalness={0.4} />
      </mesh>
    </group>
  );
}
