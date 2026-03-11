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
  getValidMoves,
  applyMove,
  applyMinePlacement,
  getBestAIMineLayout,
  getBestAIMove,
  isForbiddenForMine,
  MINE_COUNT,
  ROWS,
  COLS,
} from '@/lib/games/minefield/gameLogic';
import {
  playPlaceMine, playRemoveMine, playStep, playSafe, playExplosion,
  playTreasure, playTeleport, playGameStart, playWin, playLose, setMuted,
} from '@/lib/games/minefield/sounds';
import { gridToWorld } from './Board';
import Board from './Board';
import Pieces from './Pieces';
import HUD from './HUD';
import { useMinesPartyGame } from '@/lib/games/minefield/useMinesPartyGame';
import { track } from '@vercel/analytics';

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
      if (col >= 0 && col < COLS && row >= 0 && row < ROWS)
        callbackRef.current(row, col);
    };

    let lastTouchTime = 0;
    const tap = { x: 0, y: 0, active: false };
    const onTouchStart = (e: TouchEvent) => { tap.x = e.touches[0].clientX; tap.y = e.touches[0].clientY; tap.active = true; };
    const onTouchEnd = (e: TouchEvent) => {
      if (!tap.active) return;
      tap.active = false; lastTouchTime = Date.now();
      const t = e.changedTouches[0];
      const dx = t.clientX - tap.x, dy = t.clientY - tap.y;
      if (dx * dx + dy * dy > 144) return;
      handleHit(t.clientX, t.clientY);
    };
    let dsStart = { x: 0, y: 0 };
    const onPointerDown = (e: PointerEvent) => { if (e.pointerType === 'touch') return; if (Date.now() - lastTouchTime < 500) return; dsStart = { x: e.clientX, y: e.clientY }; };
    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return; if (Date.now() - lastTouchTime < 500) return;
      const dx = e.clientX - dsStart.x, dy = e.clientY - dsStart.y;
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

// ─── Camera controller ────────────────────────────────────────────────────────
const CAMERA_DEFAULT: [number, number, number] = [0, 16, 12];
const CAMERA_TOP: [number, number, number] = [0, 22, 0.01];

function CameraController({ goTop, orbitRef }: { goTop: boolean; orbitRef: React.MutableRefObject<any> }) {
  const { camera } = useThree();
  const target = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    target.current = new THREE.Vector3(...(goTop ? CAMERA_TOP : CAMERA_DEFAULT));
  }, [goTop]);

  useFrame(() => {
    if (!target.current) return;
    camera.position.lerp(target.current, 0.1);
    if (orbitRef.current) orbitRef.current.update();
    if (camera.position.distanceTo(target.current) < 0.08) target.current = null;
  });
  return null;
}

// ─── Ambient lights for danger atmosphere ─────────────────────────────────────
function TreasureLights() {
  const refs = [useRef<THREE.PointLight>(null!), useRef<THREE.PointLight>(null!), useRef<THREE.PointLight>(null!)];
  const positions: [number, number, number][] = [[0, 2.5, 0], [-5.25, 2, 5.25], [5.25, 2, -5.25]];

  useFrame(({ clock }) => {
    refs.forEach((r, i) => {
      if (r.current) r.current.intensity = 1.5 + 1.5 * Math.sin(clock.elapsedTime * 2.2 + i * 2.1);
    });
  });
  return (
    <>
      {refs.map((r, i) => (
        <pointLight key={i} ref={r} position={positions[i]} color="#f5c842" distance={7} decay={2} />
      ))}
    </>
  );
}

function Stars() {
  const ref = useRef<THREE.Points>(null!);
  const [geo] = useState(() => {
    const positions = new Float32Array(800 * 3);
    for (let i = 0; i < 800; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 120;
      positions[i * 3 + 1] = Math.random() * 40 + 5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 120;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  });
  useFrame(({ clock }) => { if (ref.current) ref.current.rotation.y = clock.elapsedTime * 0.008; });
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial color="#886666" size={0.08} sizeAttenuation transparent opacity={0.6} />
    </points>
  );
}

// ─── Main scene ───────────────────────────────────────────────────────────────
export default function GameScene() {
  const [gameMode, setGameMode] = useState<GameMode | null>(null);
  const [gameState, setGameState] = useState<GameState>(createInitialState);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [displayWinner, setDisplayWinner] = useState<Player | 'draw' | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [muted, setMutedState] = useState(false);

  // Mine state for local modes
  const [localMines, setLocalMines] = useState<{ white: [number, number][]; black: [number, number][] }>({ white: [], black: [] });
  // Mines being placed in the current placement session
  const [placingMines, setPlacingMines] = useState<[number, number][]>([]);
  // Which player is placing (pvp only; null in ai/online)
  const [placementTurn, setPlacementTurn] = useState<Player | null>(null);
  // Pass-device screen (pvp only)
  const [showPassScreen, setShowPassScreen] = useState(false);
  // Pass-device: who gets the device next
  const [passTo, setPassTo] = useState<Player | null>(null);

  // Last destination for board highlight
  const [lastTo, setLastTo] = useState<[number, number] | null>(null);

  // Online
  const [onlineRoomId, setOnlineRoomId] = useState<string | null>(null);

  // Camera: go top-down during placement
  const cameraGoTop = gameState.phase === 'placement' && gameMode !== null;
  const orbitRef = useRef<any>(null);

  const [cameraProps] = useState(() => {
    const mobile = typeof window !== 'undefined' && window.innerWidth < 768;
    return {
      position: (mobile ? [0, 22, 16] : [0, 16, 12]) as [number, number, number],
      fov: mobile ? 54 : 42,
    };
  });

  // Online hook
  const partyGame = useMinesPartyGame(
    gameMode === 'online' ? onlineRoomId : null,
    createInitialState,
    'mo_name',
  );

  // Active game state
  const activeGameState: GameState = gameMode === 'online' ? partyGame.gameState : gameState;
  const activeLastTo = gameMode === 'online' ? partyGame.lastTo : lastTo;

  // Valid moves (computed from active state for rendering)
  const validMoves: [number, number][] = (() => {
    if (activeGameState.phase !== 'moving' || activeGameState.winner !== null) return [];
    if (gameMode === 'online') {
      if (partyGame.status !== 'playing' || partyGame.myColor !== activeGameState.currentTurn) return [];
      return getValidMoves(activeGameState, partyGame.myColor as Player);
    }
    if (gameMode === 'ai' && activeGameState.currentTurn === 'black') return [];
    return getValidMoves(activeGameState, activeGameState.currentTurn);
  })();

  // Own mines to show on board
  const ownMinesToShow = (() => {
    if (gameMode === 'online') return []; // client only knows their own mines locally
    if (gameState.phase === 'placement') return placingMines;
    return gameMode === 'pvp' || gameMode === 'ai'
      ? [...localMines.white, ...localMines.black]
      : [];
  })();

  // ── Mute ──────────────────────────────────────────────────────────────────
  const handleToggleMute = () => {
    const next = !muted; setMutedState(next); setMuted(next);
  };

  useEffect(() => {
    const m = localStorage.getItem('mo_muted') === '1';
    setMutedState(m); setMuted(m);
  }, []);
  useEffect(() => { localStorage.setItem('mo_muted', muted ? '1' : '0'); }, [muted]);

  // ── URL room ID on mount ───────────────────────────────────────────────────
  useEffect(() => {
    const roomId = new URLSearchParams(window.location.search).get('r');
    if (roomId) { setOnlineRoomId(roomId); setGameMode('online'); }
  }, []);

  // ── Online game start sound ───────────────────────────────────────────────
  useEffect(() => {
    if (gameMode === 'online' && partyGame.status === 'playing' && partyGame.gameState.phase === 'placement') {
      playGameStart();
    }
  }, [gameMode, partyGame.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Win detection ─────────────────────────────────────────────────────────
  const winnerRaw = gameMode === 'online' ? partyGame.gameState.winner : gameState.winner;
  useEffect(() => {
    if (!winnerRaw) { setDisplayWinner(null); return; }
    const id = window.setTimeout(() => {
      setDisplayWinner(winnerRaw);
      const localWon = gameMode === 'online' ? winnerRaw === partyGame.myColor : winnerRaw === 'white';
      if (winnerRaw !== 'draw' && localWon) playWin();
      else if (winnerRaw !== 'draw') playLose();
      track('game_won', { winner: winnerRaw, mode: gameMode ?? 'pvp', difficulty });
    }, 1000);
    return () => window.clearTimeout(id);
  }, [winnerRaw, gameMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── AI movement trigger ───────────────────────────────────────────────────
  useEffect(() => {
    if (gameMode !== 'ai' || gameState.currentTurn !== 'black' || gameState.winner !== null || gameState.phase !== 'moving') return;
    let cancelled = false;
    setAiThinking(true);
    const id = window.setTimeout(() => {
      if (cancelled) return;
      const move = getBestAIMove(gameState, 'black', localMines.black, difficulty);
      if (move) {
        const { state, result, newWhiteMines, newBlackMines } = applyMove(
          gameState, 'black', move.toRow, move.toCol, localMines.white, localMines.black,
        );
        setGameState(state);
        setLocalMines({ white: newWhiteMines, black: newBlackMines });
        setLastTo([move.toRow, move.toCol]);
        // Sounds
        if (result.type === 'mine') { playExplosion(); window.setTimeout(playTeleport, 300); }
        else if (result.type === 'treasure') playTreasure();
        else playSafe(result.adjacentCount);
      }
      if (!cancelled) setAiThinking(false);
    }, 900);
    return () => { cancelled = true; window.clearTimeout(id); setAiThinking(false); };
  }, [gameMode, gameState.currentTurn, gameState.phase, gameState.winner, difficulty]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cell click handler ────────────────────────────────────────────────────
  const lastClickMs = useRef(0);
  const handleCellClick = (row: number, col: number) => {
    const now = Date.now();
    if (now - lastClickMs.current < 60) return;
    lastClickMs.current = now;

    // Placement phase
    if (activeGameState.phase === 'placement' && !showPassScreen) {
      if (isForbiddenForMine(row, col)) return;
      if (gameMode === 'online') {
        // Player's own placement (server-side auth)
        const already = placingMines.some(([r, c]) => r === row && c === col);
        if (already) { setPlacingMines(prev => prev.filter(([r, c]) => !(r === row && c === col))); playRemoveMine(); }
        else if (placingMines.length < MINE_COUNT) { setPlacingMines(prev => [...prev, [row, col]]); playPlaceMine(); }
        return;
      }
      // PvP / AI — only player's turn
      const already = placingMines.some(([r, c]) => r === row && c === col);
      if (already) { setPlacingMines(prev => prev.filter(([r, c]) => !(r === row && c === col))); playRemoveMine(); }
      else if (placingMines.length < MINE_COUNT) { setPlacingMines(prev => [...prev, [row, col]]); playPlaceMine(); }
      return;
    }

    // Movement phase
    if (activeGameState.phase !== 'moving' || activeGameState.winner !== null) return;

    if (gameMode === 'online') {
      if (partyGame.status !== 'playing') return;
      if (partyGame.myColor !== activeGameState.currentTurn) return;
      const valid = validMoves.some(([r, c]) => r === row && c === col);
      if (!valid) return;
      const myPos = activeGameState.positions[partyGame.myColor as Player];
      partyGame.sendMove(myPos[0], myPos[1], row, col);
      playStep();
      return;
    }

    // Local modes
    if (aiThinking || (gameMode === 'ai' && gameState.currentTurn === 'black')) return;
    const valid = validMoves.some(([r, c]) => r === row && c === col);
    if (!valid) return;

    const player = gameState.currentTurn;
    const { state, result, newWhiteMines, newBlackMines } = applyMove(
      gameState, player, row, col, localMines.white, localMines.black,
    );
    setGameState(state);
    setLocalMines({ white: newWhiteMines, black: newBlackMines });
    setLastTo([row, col]);

    if (result.type === 'mine') { playExplosion(); window.setTimeout(playTeleport, 300); }
    else if (result.type === 'treasure') playTreasure();
    else { playStep(); if (result.adjacentCount > 0) window.setTimeout(() => playSafe(result.adjacentCount), 120); }
  };

  // ── Toggle mine in 2D grid ────────────────────────────────────────────────
  const handleToggleMine = (row: number, col: number) => {
    // Special -1,-1 signal = clear all
    if (row === -1 && col === -1) { setPlacingMines([]); return; }
    handleCellClick(row, col);
  };

  // ── Random mine placement ─────────────────────────────────────────────────
  const handleRandomPlacement = () => {
    const valid: [number, number][] = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (!isForbiddenForMine(r, c)) valid.push([r, c]);
    // Fisher-Yates shuffle then take MINE_COUNT
    for (let i = valid.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [valid[i], valid[j]] = [valid[j], valid[i]];
    }
    setPlacingMines(valid.slice(0, MINE_COUNT));
    playPlaceMine();
  };

  // ── Confirm placement ─────────────────────────────────────────────────────
  const handleConfirmPlacement = () => {
    if (placingMines.length !== MINE_COUNT) return;

    if (gameMode === 'online') {
      partyGame.sendPlaceMines(placingMines);
      setPlacingMines([]); // clear grid — server will broadcast updated state
      return;
    }

    const player = placementTurn!;

    if (player === 'white') {
      const newMines = { ...localMines, white: placingMines };
      setLocalMines(newMines);
      setPlacingMines([]);

      if (gameMode === 'ai') {
        // AI instantly places mines
        const aiMines = getBestAIMineLayout('black', difficulty);
        setLocalMines({ white: placingMines, black: aiMines });
        setGameState(prev => {
          const s1 = applyMinePlacement(prev, 'white');
          return applyMinePlacement(s1, 'black');
        });
        setPlacementTurn(null);
        playGameStart();
      } else {
        // PvP: pass to black
        setGameState(prev => applyMinePlacement(prev, 'white'));
        setShowPassScreen(true);
        setPassTo('black');
        setPlacementTurn('black');
      }
    } else {
      // Black confirms (PvP only)
      setLocalMines(prev => ({ ...prev, black: placingMines }));
      setPlacingMines([]);
      setGameState(prev => applyMinePlacement(prev, 'black'));
      setPlacementTurn(null);
      playGameStart();
    }
  };

  // ── Pass screen ready ─────────────────────────────────────────────────────
  const handlePassReady = () => {
    setShowPassScreen(false);
    setPlacingMines([]);
  };

  // ── Reset / rematch ───────────────────────────────────────────────────────
  const handleReset = () => {
    if (gameMode === 'online') { partyGame.sendRematch(); return; }
    setGameState(createInitialState());
    setLocalMines({ white: [], black: [] });
    setPlacingMines([]);
    setPlacementTurn(gameMode === 'pvp' ? 'white' : 'white');
    setShowPassScreen(false);
    setLastTo(null);
    setDisplayWinner(null);
    setAiThinking(false);
  };

  // ── Change mode ───────────────────────────────────────────────────────────
  const handleChangeMode = () => {
    setGameMode(null);
    setGameState(createInitialState());
    setLocalMines({ white: [], black: [] });
    setPlacingMines([]);
    setPlacementTurn(null);
    setShowPassScreen(false);
    setLastTo(null);
    setDisplayWinner(null);
    setAiThinking(false);
    setOnlineRoomId(null);
    window.history.replaceState({}, '', window.location.pathname);
  };

  // ── Select mode ───────────────────────────────────────────────────────────
  const handleSelectMode = (mode: GameMode, diff?: Difficulty) => {
    if (mode === 'online') {
      const roomId = Math.random().toString(36).slice(2, 10).toUpperCase();
      setOnlineRoomId(roomId);
      setGameMode('online');
      setGameState(createInitialState());
      setLocalMines({ white: [], black: [] });
      setPlacingMines([]);
      setDisplayWinner(null);
      setLastTo(null);
      window.history.replaceState({}, '', `${window.location.pathname}?r=${roomId}`);
      return;
    }
    const d = diff ?? difficulty;
    if (diff) setDifficulty(diff);
    setGameMode(mode);
    setGameState(createInitialState());
    setLocalMines({ white: [], black: [] });
    setPlacingMines([]);
    setPlacementTurn('white');
    setShowPassScreen(false);
    setDisplayWinner(null);
    setLastTo(null);
    setAiThinking(false);
    track('game_started', { mode, difficulty: mode === 'ai' ? d : mode });
  };

  // Mines to render
  const placingMinesToRender = activeGameState.phase === 'placement' ? placingMines : [];
  // Only reveal all mines at game end (never during play)
  const ownMinesRender = activeGameState.phase === 'finished' && gameMode !== 'online'
    ? [...localMines.white, ...localMines.black]
    : [];

  // Show opponent mines at game end (local modes only)
  const oppMinesRender = displayWinner !== null && gameMode !== 'online' ? [] : []; // both sets shown via ownMinesRender

  return (
    <div style={{
      width: '100vw', height: '100vh', background: '#1a1a2e',
      fontFamily: "'SF Mono', 'Fira Code', monospace", overflow: 'hidden',
    }}>
      <Canvas
        camera={{ position: cameraProps.position, fov: cameraProps.fov }}
        shadows
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0, preserveDrawingBuffer: true }}
      >
        <ambientLight intensity={0.55} color="#80ffaa" />
        <directionalLight position={[6, 14, 8]} intensity={1.6} color="#ffffff" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-near={0.1} shadow-camera-far={60} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} />
        <directionalLight position={[-8, 6, -6]} intensity={0.3} color="#224433" />
        <TreasureLights />
        <color attach="background" args={['#1a1a2e']} />
        

        <MobileTapHandler onCellClick={handleCellClick} />
        <CameraController goTop={cameraGoTop} orbitRef={orbitRef} />

        <Suspense fallback={null}>
          <Board
            gameState={activeGameState}
            validMoves={validMoves}
            ownMines={ownMinesRender}
            opponentMines={oppMinesRender}
            placingMines={placingMinesToRender}
            showForbidden={activeGameState.phase === 'placement'}
            lastTo={activeLastTo}
          />
          <Pieces gameState={activeGameState} />
        </Suspense>

        <OrbitControls
          ref={orbitRef}
          target={[0, 0, 0]}
          minPolarAngle={Math.PI / 10}
          maxPolarAngle={Math.PI / 2.4}
          minDistance={9}
          maxDistance={26}
          enablePan={false}
          dampingFactor={0.06}
          enableDamping
          autoRotate={gameMode === null}
          autoRotateSpeed={0.5}
        />
      </Canvas>

      <HUD
        gameState={activeGameState}
        gameMode={gameMode}
        difficulty={difficulty}
        winner={displayWinner}
        aiThinking={aiThinking}
        phase={activeGameState.phase}
        placingMines={placingMines}
        placementTurn={placementTurn ?? (gameMode === 'online' ? (partyGame.myColor as Player | null) : null)}
        showPassScreen={showPassScreen}
        onToggleMine={handleToggleMine}
        onConfirmPlacement={handleConfirmPlacement}
        onRandomPlacement={handleRandomPlacement}
        onPassReady={handlePassReady}
        onReset={handleReset}
        onChangeMode={handleChangeMode}
        onSelectMode={handleSelectMode}
        muted={muted}
        onToggleMute={handleToggleMute}
        onlineStatus={gameMode === 'online' ? partyGame.status : null}
        onlineRoomId={onlineRoomId}
        myColor={gameMode === 'online' ? partyGame.myColor as Player | null : null}
        onlinePlayers={partyGame.players}
        opponentWantsRematch={partyGame.opponentWantsRematch}
        onSendRematch={partyGame.sendRematch}
        onSubmitName={partyGame.submitJoin}
        lastMoveResult={activeGameState.lastMoveResult}
      />
    </div>
  );
}
