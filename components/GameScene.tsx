'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  GameState,
  GameMode,
  Difficulty,
  Player,
  createInitialState,
  selectCell,
  applyMove,
  getBestAIMove,
} from '@/lib/gameLogic';
import { track } from '@vercel/analytics';
import { playSelect, playMove, playLand, playWin } from '@/lib/sounds';
import { gridToWorld } from './Board';
import Board from './Board';
import Pieces from './Pieces';
import HUD from './HUD';

// ─── Mobile tap handler ───────────────────────────────────────────────────────
// OrbitControls intercepts pointer events on touch, so we bypass R3F entirely:
// listen to raw touchend on the canvas DOM element, raycast against the board
// plane (y=0), and convert the hit point to a grid cell.
const TILE_GAP = 1.05;
const BOARD_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

function MobileTapHandler({ onCellClick }: { onCellClick: (r: number, c: number) => void }) {
  const { camera, gl } = useThree();
  const callbackRef = useRef(onCellClick);
  callbackRef.current = onCellClick;

  useEffect(() => {
    const canvas = gl.domElement;

    const handleHit = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((clientY - rect.top) / rect.height) * 2 + 1;
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(nx, ny), camera);
      const hit = new THREE.Vector3();
      if (!ray.ray.intersectPlane(BOARD_PLANE, hit)) return;
      const col = Math.round(hit.x / TILE_GAP + 5);
      const row = Math.round(hit.z / TILE_GAP + 5);
      if (col >= 0 && col < 11 && row >= 0 && row < 11) {
        callbackRef.current(row, col);
      }
    };

    // ── Mobile: raw touchend (OrbitControls intercepts pointer events on touch) ──
    let lastTouchTime = 0;
    const tap = { x: 0, y: 0, active: false };

    const onTouchStart = (e: TouchEvent) => {
      tap.x = e.touches[0].clientX;
      tap.y = e.touches[0].clientY;
      tap.active = true;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!tap.active) return;
      tap.active = false;
      lastTouchTime = Date.now();
      const t = e.changedTouches[0];
      const dx = t.clientX - tap.x, dy = t.clientY - tap.y;
      if (dx * dx + dy * dy > 144) return; // >12px = drag, ignore
      handleHit(t.clientX, t.clientY);
    };

    // ── Desktop: raw pointer events, bypassing OrbitControls capture ───────────
    let desktopStart = { x: 0, y: 0 };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return; // handled by touchend above
      if (Date.now() - lastTouchTime < 500) return; // ignore ghost events after touch
      desktopStart = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      if (Date.now() - lastTouchTime < 500) return;
      const dx = e.clientX - desktopStart.x, dy = e.clientY - desktopStart.y;
      if (dx * dx + dy * dy > 100) return; // >10px = drag, not click
      handleHit(e.clientX, e.clientY);
    };

    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchend', onTouchEnd, { passive: true });
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);
    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
    };
  }, [camera, gl]);

  return null;
}

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
  const [gameMode, setGameMode]     = useState<GameMode | null>(null);
  const [gameState, setGameState]   = useState<GameState>(createInitialState);
  const [aiThinking, setAiThinking] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [displayWinner, setDisplayWinner] = useState<Player | null>(null);
  const [streak, setStreak]         = useState(0);
  const [bestStreak, setBestStreak] = useState(0);

  // Load streak from localStorage on mount
  useEffect(() => {
    const s = parseInt(localStorage.getItem('rh_streak') || '0');
    const b = parseInt(localStorage.getItem('rh_best') || '0');
    setStreak(s);
    setBestStreak(b);
  }, []);

  const [cameraProps] = useState(() => {
    const mobile = typeof window !== 'undefined' && window.innerWidth < 768;
    return {
      position: (mobile ? [0, 22, 16] : [0, 15, 11]) as [number, number, number],
      fov: mobile ? 54 : 42,
    };
  });

  // ── Delayed win overlay — waits for piece animation to finish ────────────────
  useEffect(() => {
    if (!gameState.winner) { setDisplayWinner(null); return; }
    const id = window.setTimeout(() => {
      setDisplayWinner(gameState.winner);
      playWin();
      track('game_won', { winner: gameState.winner!, mode: gameMode ?? 'pvp', difficulty });

      // Update streak (AI mode only — player = white)
      if (gameMode === 'ai') {
        if (gameState.winner === 'white') {
          const next = streak + 1;
          const best = Math.max(next, bestStreak);
          setStreak(next);
          setBestStreak(best);
          localStorage.setItem('rh_streak', String(next));
          localStorage.setItem('rh_best', String(best));
        } else {
          setStreak(0);
          localStorage.setItem('rh_streak', '0');
        }
      }
    }, 1400);
    return () => window.clearTimeout(id);
  }, [gameState.winner]);

  // ── AI turn trigger ──────────────────────────────────────────────────────────
  // Fires whenever it becomes black's turn in AI mode.
  useEffect(() => {
    if (
      gameMode !== 'ai' ||
      gameState.currentTurn !== 'black' ||
      gameState.winner !== null
    ) return;

    let cancelled = false;
    setAiThinking(true);

    const id = window.setTimeout(() => {
      if (cancelled) return;

      let didMove = false;
      setGameState(prev => {
        // Guard: only act if it's still black's turn and game is ongoing
        if (prev.currentTurn !== 'black' || prev.winner !== null) return prev;
        const move = getBestAIMove(prev, difficulty);
        if (!move) return prev;
        didMove = true;
        return applyMove(prev, move.fromRow, move.fromCol, move.toRow, move.toCol);
      });
      if (didMove) { playMove(); window.setTimeout(playLand, 380); }

      if (!cancelled) setAiThinking(false);
    }, 1000);

    return () => {
      cancelled = true;
      window.clearTimeout(id);
      setAiThinking(false);
    };
  }, [gameMode, gameState.currentTurn, gameState.winner, difficulty]);

  // ── Cell click handler ───────────────────────────────────────────────────────
  const lastClickMs = useRef(0);
  const handleCellClick = (row: number, col: number) => {
    const now = Date.now();
    if (now - lastClickMs.current < 40) return; // debounce double-fires on mobile
    lastClickMs.current = now;
    if (aiThinking || (gameMode === 'ai' && gameState.currentTurn === 'black')) return;

    // Preview result to pick the right sound
    const next = selectCell(gameState, row, col);
    if (next.currentTurn !== gameState.currentTurn || next.winner !== null) {
      playMove();
      window.setTimeout(playLand, 380);
    } else if (next.selectedCell !== null) {
      playSelect();
    }

    setGameState(prev => selectCell(prev, row, col));
  };

  // ── Game controls ─────────────────────────────────────────────────────────────
  const handleReset = () => {
    setAiThinking(false);
    setGameState(createInitialState());
  };

  const handleChangeMode = () => {
    setAiThinking(false);
    setGameState(createInitialState());
    setGameMode(null);
  };

  const handleSelectMode = (mode: GameMode, diff?: Difficulty) => {
    const d = diff ?? difficulty;
    if (diff) setDifficulty(diff);
    setGameState(createInitialState());
    setGameMode(mode);
    track('game_started', { mode, difficulty: mode === 'ai' ? d : 'pvp' });
  };

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
        camera={{ position: cameraProps.position, fov: cameraProps.fov }}
        shadows
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1, preserveDrawingBuffer: true }}
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

        <directionalLight position={[-8, 6, -6]} intensity={0.3} color="#2244aa" />
        <OasisLight />

        <fog attach="fog" args={['#04040e', 18, 40]} />
        <Stars />

        <MobileTapHandler onCellClick={handleCellClick} />

        <Suspense fallback={null}>
          <Board gameState={gameState} />
          <Pieces gameState={gameState} />
        </Suspense>

        <OrbitControls
          target={[0, 0, 0]}
          minPolarAngle={Math.PI / 8}
          maxPolarAngle={Math.PI / 2.6}
          minDistance={9}
          maxDistance={24}
          enablePan={false}
          dampingFactor={0.06}
          enableDamping
          autoRotate={gameMode === null}
          autoRotateSpeed={0.6}
        />
      </Canvas>

      <HUD
        gameState={gameState}
        gameMode={gameMode}
        aiThinking={aiThinking}
        difficulty={difficulty}
        winner={displayWinner}
        streak={streak}
        bestStreak={bestStreak}
        onReset={handleReset}
        onChangeMode={handleChangeMode}
        onSelectMode={handleSelectMode}
      />
    </div>
  );
}
