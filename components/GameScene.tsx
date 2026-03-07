'use client';

import { useState, useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { GameState, createInitialState, selectCell } from '@/lib/gameLogic';
import { gridToWorld } from './Board';
import Board from './Board';
import Pieces from './Pieces';
import HUD from './HUD';

// ─── Animated oasis point light ───────────────────────────────────────────────
function OasisLight() {
  const ref = useRef<THREE.PointLight>(null!);
  const oasisPos = gridToWorld(5, 5);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.intensity = 2 + 2 * Math.sin(clock.elapsedTime * 2.5);
    }
  });

  return (
    <pointLight
      ref={ref}
      position={[oasisPos.x, 2.5, oasisPos.z]}
      color="#00ffcc"
      distance={8}
      decay={2}
    />
  );
}

// ─── Starfield backdrop ────────────────────────────────────────────────────────
function Stars() {
  const ref = useRef<THREE.Points>(null!);

  const [geo] = useState(() => {
    const positions = new Float32Array(800 * 3);
    for (let i = 0; i < 800; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 120;
      positions[i * 3 + 1] = Math.random() * 40 + 5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 120;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  });

  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.elapsedTime * 0.01;
  });

  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial color="#8888bb" size={0.08} sizeAttenuation transparent opacity={0.7} />
    </points>
  );
}

// ─── Main scene ────────────────────────────────────────────────────────────────
export default function GameScene() {
  const [gameState, setGameState] = useState<GameState>(createInitialState);

  const handleCellClick = (row: number, col: number) => {
    setGameState(prev => selectCell(prev, row, col));
  };

  const handleReset = () => setGameState(createInitialState());

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#04040e',
        fontFamily: "'SF Mono', 'Fira Code', monospace",
        overflow: 'hidden',
      }}
    >
      <Canvas
        camera={{ position: [0, 15, 11], fov: 42 }}
        shadows
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
      >
        {/* ── Lighting ────────────────────────────────────────────────── */}
        <ambientLight intensity={0.18} color="#0d0d2a" />

        <directionalLight
          position={[6, 14, 8]}
          intensity={1.4}
          color="#ffffff"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-near={0.1}
          shadow-camera-far={60}
          shadow-camera-left={-12}
          shadow-camera-right={12}
          shadow-camera-top={12}
          shadow-camera-bottom={-12}
        />

        {/* Rim light from opposite side */}
        <directionalLight position={[-8, 6, -6]} intensity={0.3} color="#2244aa" />

        <OasisLight />

        {/* ── Scene fog ───────────────────────────────────────────────── */}
        <fog attach="fog" args={['#04040e', 18, 40]} />

        {/* ── Stars ───────────────────────────────────────────────────── */}
        <Stars />

        {/* ── Board + Pieces ──────────────────────────────────────────── */}
        <Suspense fallback={null}>
          <Board gameState={gameState} onCellClick={handleCellClick} />
          <Pieces gameState={gameState} onCellClick={handleCellClick} />
        </Suspense>

        {/* ── Camera controls ─────────────────────────────────────────── */}
        <OrbitControls
          target={[0, 0, 0]}
          minPolarAngle={Math.PI / 8}
          maxPolarAngle={Math.PI / 2.6}
          minDistance={9}
          maxDistance={24}
          enablePan={false}
          dampingFactor={0.06}
          enableDamping
        />
      </Canvas>

      {/* ── 2-D HUD overlay ─────────────────────────────────────────────── */}
      <HUD gameState={gameState} onReset={handleReset} />
    </div>
  );
}
