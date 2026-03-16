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
  getValidMoves,
  getBestAIMove,
  rowLabel,
  colLabel,
} from '@/lib/games/run-horses/gameLogic';
import { track } from '@vercel/analytics';
import { playSelect, playMove, playLand, playWin, playGameStart, setMuted } from '@/lib/games/run-horses/sounds';
import { suspendAudio, resumeAudio } from '@/lib/audio/engine';
import { gridToWorld } from '@/lib/games/run-horses/components/Board';
import Board from '@/lib/games/run-horses/components/Board';
import Pieces from '@/lib/games/run-horses/components/Pieces';
import HUD from '@/lib/games/run-horses/components/HUD';
import { usePartyGame } from '@/lib/multiplayer/usePartyGame';
import type { LastMove } from '@/lib/multiplayer/types';
import { usePoki } from '@/lib/poki/usePoki';
import { useCrazyGames } from '@/lib/crazygames/useCrazyGames';
import { safeStorage } from '@/lib/poki/safeStorage';

// ─── Mobile tap handler ───────────────────────────────────────────────────────
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
      if (dx * dx + dy * dy > 144) return;
      handleHit(t.clientX, t.clientY);
    };

    let desktopStart = { x: 0, y: 0 };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      if (Date.now() - lastTouchTime < 500) return;
      desktopStart = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      if (Date.now() - lastTouchTime < 500) return;
      const dx = e.clientX - desktopStart.x, dy = e.clientY - desktopStart.y;
      if (dx * dx + dy * dy > 100) return;
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

// ─── Camera snap controller ───────────────────────────────────────────────────
type CameraPreset = 'default' | 'top' | 'side';

const CAMERA_PRESETS: Record<CameraPreset, { pos: [number, number, number]; target: [number, number, number] }> = {
  default: { pos: [0, 15, 11], target: [0, 0, 0] },
  top:     { pos: [0, 22, 0.01], target: [0, 0, 0] },
  side:    { pos: [14, 8, 0], target: [0, 0, 0] },
};

function CameraController({
  preset,
  orbitRef,
  onDone,
}: {
  preset: CameraPreset | null;
  orbitRef: React.MutableRefObject<any>;
  onDone: () => void;
}) {
  const { camera } = useThree();
  const targetPos = useRef<THREE.Vector3 | null>(null);
  const animRef = useRef(false);

  useEffect(() => {
    if (!preset) return;
    const p = CAMERA_PRESETS[preset];
    targetPos.current = new THREE.Vector3(...p.pos);
    animRef.current = true;
  }, [preset]);

  useFrame(() => {
    if (!animRef.current || !targetPos.current) return;
    camera.position.lerp(targetPos.current, 0.12);
    if (orbitRef.current) orbitRef.current.update();
    if (camera.position.distanceTo(targetPos.current) < 0.05) {
      camera.position.copy(targetPos.current);
      animRef.current = false;
      targetPos.current = null;
      onDone();
    }
  });

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

// ─── Move history record ──────────────────────────────────────────────────────
export interface MoveRecord {
  player: Player;
  from: string;
  to: string;
  moveNum: number;
}

// ─── Main scene ────────────────────────────────────────────────────────────────
export default function GameScene() {
  const [gameMode, setGameMode]     = useState<GameMode | null>(null);
  const [gameState, setGameState]   = useState<GameState>(createInitialState);
  const [aiThinking, setAiThinking] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [displayWinner, setDisplayWinner] = useState<Player | null>(null);
  const [adBreakActive, setAdBreakActive] = useState(false);
  const [streak, setStreak]         = useState(0);
  const [bestStreak, setBestStreak] = useState(0);

  // ── Mute ─────────────────────────────────────────────────────────────────────
  const [muted, setMutedState] = useState(false);
  const handleToggleMute = () => {
    const next = !muted;
    setMutedState(next);
    setMuted(next);
  };

  // ── Last move (for amber board highlights) ────────────────────────────────────
  const [lastMove, setLastMove] = useState<LastMove | null>(null);

  // ── Move history ─────────────────────────────────────────────────────────────
  const [moveHistory, setMoveHistory] = useState<MoveRecord[]>([]);

  // ── Camera snap ───────────────────────────────────────────────────────────────
  const [cameraPreset, setCameraPreset] = useState<CameraPreset | null>(null);
  const orbitRef = useRef<any>(null);
  const handleSnapCamera = (preset: CameraPreset) => setCameraPreset(preset);

  // ── Online mode state ────────────────────────────────────────────────────────
  const [onlineRoomId, setOnlineRoomId] = useState<string | null>(null);
  const [onlineSelection, setOnlineSelection] = useState<{
    selectedCell: [number, number] | null;
    validMoves: [number, number][];
  }>({ selectedCell: null, validMoves: [] });

  const poki = usePoki();
  const cg = useCrazyGames();

  // Always call hook — pass null when not in online mode (hook becomes a no-op)
  const partyGame = usePartyGame<GameState>(gameMode === 'online' ? onlineRoomId : null, {
    party: 'runhorses',
    initialState: createInitialState,
    nameKey: 'rh_name',
  });

  // ── Active game state for rendering (online vs local) ────────────────────────
  const activeGameState: GameState = gameMode === 'online'
    ? { ...partyGame.gameState, selectedCell: onlineSelection.selectedCell, validMoves: onlineSelection.validMoves }
    : gameState;

  // Active lastMove (online or local)
  const activeLastMove = gameMode === 'online' ? partyGame.lastMove : lastMove;

  // Reset selection whenever the server broadcasts a new board position
  useEffect(() => {
    if (gameMode === 'online') {
      setOnlineSelection({ selectedCell: null, validMoves: [] });
    }
  }, [gameMode, partyGame.gameState.board]);

  // ── Detect ?r=ROOMID in URL on mount / local session restore ─────────────────
  useEffect(() => {
    const roomId = new URLSearchParams(window.location.search).get('r');
    if (roomId) {
      setOnlineRoomId(roomId);
      setGameMode('online');
      return;
    }
    // Restore local session from sessionStorage
    const saved = sessionStorage.getItem('rh_session');
    if (saved) {
      try {
        const { gameMode: gm, difficulty: d, gameState: gs, moveHistory: mh } = JSON.parse(saved);
        setGameMode(gm);
        if (d) setDifficulty(d);
        setGameState(gs);
        setMoveHistory(mh ?? []);
      } catch { /* ignore corrupt data */ }
    }
  }, []);

  // ── Persist local session to sessionStorage ────────────────────────────────
  useEffect(() => {
    if (gameMode === null || gameMode === 'online') return;
    sessionStorage.setItem('rh_session', JSON.stringify({ gameMode, difficulty, gameState, moveHistory }));
  }, [gameMode, difficulty, gameState, moveHistory]);

  // Load streak + mute from localStorage on mount
  useEffect(() => {
    const s = parseInt(safeStorage.getItem('rh_streak') || '0');
    const b = parseInt(safeStorage.getItem('rh_best') || '0');
    setStreak(s);
    setBestStreak(b);
    const m = safeStorage.getItem('rh_muted') === '1';
    setMutedState(m);
    setMuted(m);
  }, []);

  // Persist mute preference
  useEffect(() => {
    safeStorage.setItem('rh_muted', muted ? '1' : '0');
  }, [muted]);

  const [cameraProps] = useState(() => {
    const mobile = typeof window !== 'undefined' && window.innerWidth < 768;
    return {
      position: (mobile ? [0, 22, 16] : [0, 15, 11]) as [number, number, number],
      fov: mobile ? 54 : 42,
    };
  });

  // ── Disable keyboard scrolling during ad breaks ───────────────────────────────
  useEffect(() => {
    if (!adBreakActive) return;
    const block = (e: KeyboardEvent) => {
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', block);
    return () => window.removeEventListener('keydown', block);
  }, [adBreakActive]);

  // ── Commercial break on game over ────────────────────────────────────────────
  useEffect(() => {
    if (!displayWinner) { setAdBreakActive(false); return; }
    setAdBreakActive(true);
    poki.commercialBreak(suspendAudio).then(() => { resumeAudio(); setAdBreakActive(false); });
    cg.midgameAd(suspendAudio).then(() => resumeAudio());
  }, [displayWinner]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Poki / CrazyGames gameplay lifecycle ─────────────────────────────────────
  // Online: start on 'playing' status, restart after rematch (winner cleared)
  useEffect(() => {
    if (gameMode !== 'online') return;
    if (partyGame.status === 'playing' && !partyGame.gameState.winner) {
      poki.gameplayStart();
      cg.gameplayStart();
    }
  }, [gameMode, partyGame.status, partyGame.gameState.winner]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Win detection — local modes ───────────────────────────────────────────────
  useEffect(() => {
    if (gameMode === 'online') return;
    if (!gameState.winner) { setDisplayWinner(null); return; }
    poki.gameplayStop();
    cg.gameplayStop();
    const id = window.setTimeout(() => {
      setDisplayWinner(gameState.winner);
      playWin();
      track('game_won', { winner: gameState.winner!, mode: gameMode ?? 'pvp', difficulty });

      if (gameMode === 'ai') {
        if (gameState.winner === 'white') {
          const next = streak + 1;
          const best = Math.max(next, bestStreak);
          setStreak(next);
          setBestStreak(best);
          safeStorage.setItem('rh_streak', String(next));
          safeStorage.setItem('rh_best', String(best));
        } else {
          setStreak(0);
          safeStorage.setItem('rh_streak', '0');
        }
      }
    }, 1400);
    return () => window.clearTimeout(id);
  }, [gameState.winner, gameMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Online game start sound ───────────────────────────────────────────────────
  useEffect(() => {
    if (gameMode === 'online' && partyGame.status === 'playing') {
      playGameStart();
    }
  }, [gameMode, partyGame.status]);

  // ── Win detection — online mode ───────────────────────────────────────────────
  useEffect(() => {
    if (gameMode !== 'online') return;
    const winner = partyGame.gameState.winner;
    if (!winner) { setDisplayWinner(null); return; }
    poki.gameplayStop();
    cg.gameplayStop();
    const id = window.setTimeout(() => {
      setDisplayWinner(winner);
      playWin();
      track('game_won', { winner, mode: 'online', difficulty: 'online' });
    }, 1400);
    return () => window.clearTimeout(id);
  }, [gameMode, partyGame.gameState.winner]);

  // ── AI turn trigger ──────────────────────────────────────────────────────────
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

      let aiMove: { fromRow: number; fromCol: number; toRow: number; toCol: number } | null = null;
      setGameState(prev => {
        if (prev.currentTurn !== 'black' || prev.winner !== null) return prev;
        const move = getBestAIMove(prev, difficulty);
        if (!move) return prev;
        aiMove = move;
        return applyMove(prev, move.fromRow, move.fromCol, move.toRow, move.toCol);
      });
      if (aiMove) {
        playMove();
        window.setTimeout(playLand, 380);
        setLastMove(aiMove);
        setMoveHistory(prev => [...prev, {
          player: 'black',
          from: `${rowLabel(aiMove!.fromRow)}${colLabel(aiMove!.fromCol)}`,
          to: `${rowLabel(aiMove!.toRow)}${colLabel(aiMove!.toCol)}`,
          moveNum: prev.length + 1,
        }]);
      }

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
    if (now - lastClickMs.current < 40) return;
    lastClickMs.current = now;

    // ── Online mode ────────────────────────────────────────────────────────────
    if (gameMode === 'online') {
      if (partyGame.status !== 'playing') return;
      if (partyGame.myColor !== partyGame.gameState.currentTurn) return;
      if (partyGame.gameState.winner !== null) return;

      const state = {
        ...partyGame.gameState,
        selectedCell: onlineSelection.selectedCell,
        validMoves: onlineSelection.validMoves,
      };

      if (state.selectedCell) {
        const isValid = state.validMoves.some(([r, c]) => r === row && c === col);
        if (isValid) {
          partyGame.sendMove(state.selectedCell[0], state.selectedCell[1], row, col);
          setOnlineSelection({ selectedCell: null, validMoves: [] });
          playMove();
          window.setTimeout(playLand, 380);
          return;
        }
        const piece = state.board[row][col];
        if (piece && piece.player === partyGame.myColor) {
          setOnlineSelection({ selectedCell: [row, col], validMoves: getValidMoves(state, row, col) });
          playSelect();
          return;
        }
        setOnlineSelection({ selectedCell: null, validMoves: [] });
        return;
      }

      const piece = state.board[row][col];
      if (piece && piece.player === partyGame.myColor) {
        setOnlineSelection({ selectedCell: [row, col], validMoves: getValidMoves(state, row, col) });
        playSelect();
      }
      return;
    }

    // ── Local modes (pvp / ai) ─────────────────────────────────────────────────
    if (aiThinking || (gameMode === 'ai' && gameState.currentTurn === 'black')) return;

    const prevSelected = gameState.selectedCell;
    const next = selectCell(gameState, row, col);
    if (next.currentTurn !== gameState.currentTurn || next.winner !== null) {
      playMove();
      window.setTimeout(playLand, 380);
      // Track last move
      if (prevSelected) {
        const mv: LastMove = { fromRow: prevSelected[0], fromCol: prevSelected[1], toRow: row, toCol: col };
        setLastMove(mv);
        setMoveHistory(prev => [...prev, {
          player: gameState.currentTurn,
          from: `${rowLabel(prevSelected[0])}${colLabel(prevSelected[1])}`,
          to: `${rowLabel(row)}${colLabel(col)}`,
          moveNum: prev.length + 1,
        }]);
      }
    } else if (next.selectedCell !== null) {
      playSelect();
    }

    setGameState(prev => selectCell(prev, row, col));
  };

  // ── Game controls ─────────────────────────────────────────────────────────────
  const handleReset = () => {
    if (gameMode === 'online') {
      partyGame.sendRematch();
      return;
    }
    setAiThinking(false);
    setLastMove(null);
    setMoveHistory([]);
    setGameState(createInitialState());
    poki.gameplayStart();
    cg.gameplayStart();
  };

  const handleChangeMode = () => {
    poki.gameplayStop();
    cg.gameplayStop();
    sessionStorage.removeItem('rh_session');
    setAiThinking(false);
    setGameState(createInitialState());
    setOnlineRoomId(null);
    setOnlineSelection({ selectedCell: null, validMoves: [] });
    setDisplayWinner(null);
    setLastMove(null);
    setMoveHistory([]);
    setGameMode(null);
    window.history.replaceState({}, '', window.location.pathname);
  };

  const handleSelectMode = (mode: GameMode, diff?: Difficulty) => {
    if (mode === 'online') {
      const roomId = Math.random().toString(36).slice(2, 10).toUpperCase();
      setOnlineRoomId(roomId);
      setGameMode('online');
      setDisplayWinner(null);
      setLastMove(null);
      setMoveHistory([]);
      window.history.replaceState({}, '', `${window.location.pathname}?r=${roomId}`);
      track('game_started', { mode: 'online', difficulty: 'online' });
      return;
    }
    const d = diff ?? difficulty;
    if (diff) setDifficulty(diff);
    setGameState(createInitialState());
    setGameMode(mode);
    setDisplayWinner(null);
    setLastMove(null);
    setMoveHistory([]);
    poki.gameplayStart();
    cg.gameplayStart();
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

        <CameraController
          preset={cameraPreset}
          orbitRef={orbitRef}
          onDone={() => setCameraPreset(null)}
        />

        <Suspense fallback={null}>
          <Board gameState={activeGameState} lastMove={activeLastMove} />
          <Pieces gameState={activeGameState} />
        </Suspense>

        <OrbitControls
          ref={orbitRef}
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
        gameState={activeGameState}
        gameMode={gameMode}
        aiThinking={aiThinking}
        difficulty={difficulty}
        winner={displayWinner}
        adBreakActive={adBreakActive}
        streak={streak}
        bestStreak={bestStreak}
        onReset={handleReset}
        onChangeMode={handleChangeMode}
        onSelectMode={handleSelectMode}
        // Sound
        muted={muted}
        onToggleMute={handleToggleMute}
        // Camera snap
        onSnapCamera={handleSnapCamera}
        // Move history
        moveHistory={moveHistory}
        // Online props
        onlineStatus={gameMode === 'online' ? partyGame.status : null}
        onlineRoomId={onlineRoomId}
        myColor={gameMode === 'online' ? partyGame.myColor as Player | null : null}
        onlinePlayers={partyGame.players}
        opponentWantsRematch={partyGame.opponentWantsRematch}
        onSendRematch={partyGame.sendRematch}
        onSubmitName={partyGame.submitJoin}
      />
    </div>
  );
}
