'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  GameState,
  Difficulty,
  createInitialState,
  spawnItem,
  tickItems,
  moveBasket,
  checkCollisions,
  startGame,
  getSpawnInterval,
} from '@/lib/games/candy-catch/gameLogic';
import {
  playCatch,
  playCatchBig,
  playBomb,
  playLevelUp,
  playGameStart,
  playGameOver,
  playCombo,
  playCandyRain,
  playPowerup,
  setMuted,
} from '@/lib/games/candy-catch/sounds';
import { usePoki } from '@/lib/poki/usePoki';
import { useCrazyGames } from '@/lib/crazygames/useCrazyGames';
import { safeStorage } from '@/lib/poki/safeStorage';

const THEME = '#ff6eb4';
const ACCENT = '#ffde59';
const BASKET_Y_PCT = 72; // percent from top — high enough to be above thumb on mobile
const TICK_MS = 1000 / 60; // ~16.67 ms — fixed physics step

const SCORE_MILESTONES: { threshold: number; text: string }[] = [
  { threshold: 100,  text: 'SWEET! 🍬' },
  { threshold: 300,  text: 'SUGAR RUSH! ⚡' },
  { threshold: 500,  text: 'CANDY STORM! 🌪️' },
  { threshold: 1000, text: 'CANDY GOD! 👑' },
];

// Pre-generated star positions (deterministic, avoids per-render randomness)
const STAR_DATA = Array.from({ length: 60 }, (_, i) => ({
  x: (i * 17 + 3) % 100,
  y: (i * 29 + 7) % 100,
  size: (i % 3) + 1,
  opacity: ((i % 5) + 1) * 0.1,
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getComboMultiplierValue(combo: number): number {
  if (combo >= 10) return 4;
  if (combo >= 6) return 3;
  if (combo >= 3) return 2;
  return 1;
}

function getPowerupFlashText(emoji: string): string {
  switch (emoji) {
    case '🧲': return '🧲 MAGNET!';
    case '⚡': return '⚡ WIDE!';
    case '❤️': return '❤️ +LIFE!';
    case '🎁': return '🎁 MYSTERY!';
    case '💥': return '💥 OOPS!';
    default: return emoji;
  }
}

// ─── Confetti ─────────────────────────────────────────────────────────────────
function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = ['#ff6eb4', '#ffde59', '#ff4466', '#44aaff', '#aa44ff', '#ffaa00'];
    const pieces = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.4 - 100,
      w: Math.random() * 10 + 5,
      h: Math.random() * 5 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      vy: Math.random() * 3 + 1.5,
      vx: (Math.random() - 0.5) * 1.5,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.12,
      opacity: 1,
    }));
    const start = Date.now();
    let raf: number;
    const draw = () => {
      const elapsed = Date.now() - start;
      ctx2d.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach(p => {
        p.y += p.vy; p.x += p.vx; p.rot += p.rotSpeed;
        if (p.y > canvas.height) { p.y = -20; p.x = Math.random() * canvas.width; }
        p.opacity = elapsed > 2500 ? Math.max(0, 1 - (elapsed - 2500) / 1500) : 1;
        ctx2d.save();
        ctx2d.translate(p.x, p.y);
        ctx2d.rotate(p.rot);
        ctx2d.globalAlpha = p.opacity;
        ctx2d.fillStyle = p.color;
        ctx2d.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx2d.restore();
      });
      if (elapsed < 4000) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 55 }} />;
}

// ─── Main GameScene ───────────────────────────────────────────────────────────
export default function GameScene() {
  const poki = usePoki();
  const cg = useCrazyGames();

  // ── Menu / phase state ──────────────────────────────────────────────────────
  const [gamePhase, setGamePhase] = useState<GameState['phase']>('idle');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [muted, setMutedState] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [bestScore, setBestScore] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  // ── HUD state (throttled updates from RAF loop) ─────────────────────────────
  const [hudScore, setHudScore] = useState(0);
  const [hudLives, setHudLives] = useState(3);
  const [hudLevel, setHudLevel] = useState(1);
  const [hudCombo, setHudCombo] = useState(0);
  const [hudComboMultiplier, setHudComboMultiplier] = useState(1);
  const [hudMagnetExpiry, setHudMagnetExpiry] = useState<number | null>(null);
  const [hudWideExpiry, setHudWideExpiry] = useState<number | null>(null);
  const [hudCandyRainActive, setHudCandyRainActive] = useState(false);

  // ── Game-over snapshot ──────────────────────────────────────────────────────
  const [finalScore, setFinalScore] = useState(0);
  const [finalLevel, setFinalLevel] = useState(1);
  const [finalMaxCombo, setFinalMaxCombo] = useState(0);

  // ── Visual effect overlays (React-managed, above canvas) ───────────────────
  const [pointFlash, setPointFlash] = useState<{ text: string; key: number } | null>(null);
  const [powerupFlash, setPowerupFlash] = useState<{ text: string; key: number } | null>(null);
  const [milestoneFlash, setMilestoneFlash] = useState<{ text: string; key: number } | null>(null);
  const [comboBreakFlash, setComboBreakFlash] = useState<{ key: number } | null>(null);

  // ── Core refs ───────────────────────────────────────────────────────────────
  /** Single source of truth for game state during gameplay — never drives re-renders directly */
  const gameStateRef = useRef<GameState>(createInitialState('easy'));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameAreaRef = useRef<HTMLDivElement>(null);

  // ── RAF loop timing refs ────────────────────────────────────────────────────
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const accumulatorRef = useRef<number>(0);
  const spawnAccRef = useRef<number>(0);
  const totalTicksRef = useRef<number>(0);

  // ── Canvas-side effect refs (no React state needed) ─────────────────────────
  const bombFlashUntilRef = useRef<number>(0);
  const shakeUntilRef = useRef<number>(0);

  // ── Change-detection refs for RAF-side effect dispatch ──────────────────────
  const prevLivesRef = useRef(3);
  const prevLastCatchKeyRef = useRef<number | null>(null);
  const prevLastComboBreakRef = useRef<number | null>(null);
  const prevCandyRainRef = useRef(false);
  const prevComboMultRef = useRef(1);

  // ── Misc ────────────────────────────────────────────────────────────────────
  const milestonesHitRef = useRef<Set<number>>(new Set());
  const rulesShownRef = useRef(false);
  const keysRef = useRef<Record<string, boolean>>({});
  /** Mirror of bestScore for use inside RAF without stale closure */
  const bestScoreRef = useRef(0);

  // ── Init from storage ───────────────────────────────────────────────────────
  useEffect(() => {
    const best = parseInt(safeStorage.getItem('cc_best') || '0', 10);
    setBestScore(best);
    bestScoreRef.current = best;
    const savedMuted = safeStorage.getItem('cc_muted') === '1';
    setMutedState(savedMuted);
    setMuted(savedMuted);
    try {
      const saved = sessionStorage.getItem('cc_session_v2');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.gameState?.phase === 'playing') {
          setDifficulty(data.difficulty || 'easy');
        }
      }
    } catch { /* ignore */ }
  }, []);

  // ── Canvas resize sync ──────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const area = gameAreaRef.current;
    if (!canvas || !area) return;
    const sync = () => {
      canvas.width = area.clientWidth;
      canvas.height = area.clientHeight;
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(area);
    return () => ro.disconnect();
  }, [gamePhase]); // re-bind when game area mounts/unmounts

  // ── Canvas draw function ────────────────────────────────────────────────────
  const drawFrame = useCallback((canvas: HTMLCanvasElement, state: GameState, now: number) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    if (W === 0 || H === 0) return;

    ctx.clearRect(0, 0, W, H);

    // Stars
    ctx.fillStyle = '#fff';
    for (const s of STAR_DATA) {
      ctx.globalAlpha = s.opacity;
      ctx.beginPath();
      ctx.arc(s.x * W / 100, s.y * H / 100, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Falling items
    const itemFontSize = Math.round(Math.min(44, Math.max(28, W * 0.05)));
    ctx.font = `${itemFontSize}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const magnetActive = state.activePowerups.magnet !== null;

    for (const item of state.items) {
      const x = item.x * W / 100;
      const y = item.y * H / 100;

      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';

      if (item.type === 'bomb') {
        ctx.shadowColor = '#ff4444';
        ctx.shadowBlur = 15;
      } else if (item.type === 'star') {
        ctx.shadowColor = ACCENT;
        ctx.shadowBlur = 15;
      } else if (['magnet', 'wide', 'heart', 'mystery'].includes(item.type)) {
        ctx.shadowColor = '#aa44ff';
        ctx.shadowBlur = 15;
      } else if (magnetActive) {
        // Candy items glow when magnet is active
        ctx.shadowColor = ACCENT;
        ctx.shadowBlur = 20;
      }

      ctx.fillText(item.emoji, x, y);
    }

    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    // Basket
    const basketFontSize = Math.round(Math.min(64, Math.max(40, W * 0.08)));
    ctx.font = `${basketFontSize}px serif`;

    let basketXPx = state.basketX * W / 100;
    const basketYPx = BASKET_Y_PCT * H / 100;

    // Shake oscillation
    if (now < shakeUntilRef.current) {
      const progress = (shakeUntilRef.current - now) / 500;
      basketXPx += Math.sin(now * 0.08) * progress * 8;
    }

    ctx.shadowColor = state.activePowerups.wide ? '#44aaff' : THEME;
    ctx.shadowBlur = 12;
    ctx.fillText('🧺', basketXPx, basketYPx);

    // Wide basket indicator bar
    if (state.activePowerups.wide) {
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      const barW = W * 0.20;
      const barY = basketYPx + basketFontSize * 0.55;
      const grad = ctx.createLinearGradient(basketXPx - barW / 2, 0, basketXPx + barW / 2, 0);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(0.5, '#44aaff88');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(basketXPx - barW / 2, barY, barW, 4);
    }

    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    // Ground line
    ctx.strokeStyle = `${THEME}44`;
    ctx.lineWidth = 2;
    const groundY = 92 * H / 100;
    ctx.beginPath();
    ctx.moveTo(0.05 * W, groundY);
    ctx.lineTo(0.95 * W, groundY);
    ctx.stroke();

    // Bomb flash overlay (canvas-side, 300ms)
    if (now < bombFlashUntilRef.current) {
      const t = (bombFlashUntilRef.current - now) / 300;
      ctx.fillStyle = `rgba(255, 0, 0, ${0.30 * t})`;
      ctx.fillRect(0, 0, W, H);
    }
  }, []);

  // ── Stop loop ───────────────────────────────────────────────────────────────
  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // ── Start RAF game loop ─────────────────────────────────────────────────────
  const startLoop = useCallback(() => {
    stopLoop();
    lastTimeRef.current = performance.now();
    accumulatorRef.current = 0;
    spawnAccRef.current = 0;
    totalTicksRef.current = 0;

    const loop = (now: number) => {
      const delta = Math.min(now - lastTimeRef.current, 100);
      lastTimeRef.current = now;
      accumulatorRef.current += delta;
      spawnAccRef.current += delta;

      let tickCount = 0;

      // Fixed-timestep physics loop
      while (accumulatorRef.current >= TICK_MS) {
        accumulatorRef.current -= TICK_MS;

        if (gameStateRef.current.phase !== 'playing') break;
        tickCount++;

        // Keyboard basket movement (2 steps per tick @ 60Hz ≈ old 4 steps @ 30Hz)
        const STEP = 2;
        if (keysRef.current['ArrowLeft'] || keysRef.current['a'] || keysRef.current['A']) {
          gameStateRef.current = moveBasket(gameStateRef.current, gameStateRef.current.basketX - STEP);
        }
        if (keysRef.current['ArrowRight'] || keysRef.current['d'] || keysRef.current['D']) {
          gameStateRef.current = moveBasket(gameStateRef.current, gameStateRef.current.basketX + STEP);
        }

        // Magnet pull
        if (gameStateRef.current.activePowerups.magnet !== null) {
          const bx = gameStateRef.current.basketX;
          const pulledItems = gameStateRef.current.items.map(item => {
            if (item.type === 'candy' || item.type === 'star') {
              return { ...item, x: item.x + (bx - item.x) * 0.04 };
            }
            return item;
          });
          gameStateRef.current = { ...gameStateRef.current, items: pulledItems };
        }

        const prevState = gameStateRef.current;
        gameStateRef.current = tickItems(gameStateRef.current);
        gameStateRef.current = checkCollisions(gameStateRef.current);
        const nextState = gameStateRef.current;

        // ── Side effects: sounds & React overlay triggers ──────────────────

        // Level up
        if (nextState.level > prevState.level && nextState.level > 1) {
          playLevelUp();
        }

        // Candy rain start/end
        if (!prevCandyRainRef.current && nextState.candyRain.active) {
          playCandyRain();
          prevCandyRainRef.current = true;
          setHudCandyRainActive(true);
        } else if (prevCandyRainRef.current && !nextState.candyRain.active) {
          prevCandyRainRef.current = false;
          setHudCandyRainActive(false);
        }

        // Catch event
        if (nextState.lastCatch && nextState.lastCatch.key !== prevLastCatchKeyRef.current) {
          prevLastCatchKeyRef.current = nextState.lastCatch.key;
          const c = nextState.lastCatch;
          const isPowerup = ['🧲', '⚡', '❤️', '🎁', '💥'].includes(c.emoji);
          if (isPowerup) {
            playPowerup();
            const k = c.key;
            setPowerupFlash({ text: getPowerupFlashText(c.emoji), key: k });
            setTimeout(() => setPowerupFlash(null), 1200);
          } else if (c.points >= 20) {
            playCatchBig();
          } else {
            playCatch();
          }
          if (c.points > 0) {
            setPointFlash({ text: `+${c.points}`, key: c.key });
            setTimeout(() => setPointFlash(null), 1000);
          }
        }

        // Combo tier up → sound
        if (nextState.comboMultiplier > prevComboMultRef.current) {
          playCombo();
        }
        prevComboMultRef.current = nextState.comboMultiplier;

        // Bomb hit
        if (nextState.lives < prevLivesRef.current) {
          playBomb();
          bombFlashUntilRef.current = now + 300;
          shakeUntilRef.current = now + 500;
          prevLivesRef.current = nextState.lives;
        }

        // Combo break
        if (nextState.lastComboBreak && nextState.lastComboBreak !== prevLastComboBreakRef.current) {
          prevLastComboBreakRef.current = nextState.lastComboBreak;
          setComboBreakFlash({ key: nextState.lastComboBreak });
          setTimeout(() => setComboBreakFlash(null), 1200);
        }

        // Score milestones
        for (const m of SCORE_MILESTONES) {
          if (nextState.score >= m.threshold && !milestonesHitRef.current.has(m.threshold)) {
            milestonesHitRef.current.add(m.threshold);
            setMilestoneFlash({ text: m.text, key: now });
            setTimeout(() => setMilestoneFlash(null), 1500);
            break;
          }
        }

        // Game over
        if (nextState.phase === 'gameover' && prevState.phase === 'playing') {
          stopLoop();
          playGameOver();
          poki.gameplayStop();
          poki.commercialBreak().catch(() => {});
          cg.gameplayStop();
          cg.midgameAd().catch(() => {});
          const newBest = Math.max(nextState.score, bestScoreRef.current);
          bestScoreRef.current = newBest;
          safeStorage.setItem('cc_best', String(newBest));
          setBestScore(newBest);
          setFinalScore(nextState.score);
          setFinalLevel(nextState.level);
          setFinalMaxCombo(nextState.maxCombo);
          const isNewBestScore = nextState.score >= newBest && nextState.score > 0;
          if (isNewBestScore) { setShowConfetti(true); cg.happytime(); }
          setGamePhase('gameover');
          if (canvasRef.current) drawFrame(canvasRef.current, nextState, now);
          return; // exit loop
        }
      }

      // Spawn items via accumulator (replaces setTimeout chain)
      if (gameStateRef.current.phase === 'playing') {
        const spawnInterval = getSpawnInterval(gameStateRef.current);
        if (spawnAccRef.current >= spawnInterval) {
          spawnAccRef.current -= spawnInterval;
          gameStateRef.current = spawnItem(gameStateRef.current);
        }
      }

      // Draw every frame
      if (canvasRef.current && gameStateRef.current.phase === 'playing') {
        drawFrame(canvasRef.current, gameStateRef.current, now);
      }

      // Throttle HUD state updates to every 4 ticks
      if (tickCount > 0) {
        const prev = totalTicksRef.current;
        totalTicksRef.current += tickCount;
        // Update when we cross a multiple-of-4 boundary
        if (Math.floor(totalTicksRef.current / 4) > Math.floor(prev / 4)) {
          const s = gameStateRef.current;
          setHudScore(s.score);
          setHudLives(s.lives);
          setHudLevel(s.level);
          setHudCombo(s.combo);
          setHudComboMultiplier(s.comboMultiplier);
          setHudMagnetExpiry(s.activePowerups.magnet);
          setHudWideExpiry(s.activePowerups.wide);
        }

        // Session persistence
        if (gameStateRef.current.phase === 'playing') {
          sessionStorage.setItem(
            'cc_session_v2',
            JSON.stringify({ difficulty: gameStateRef.current.difficulty, gameState: gameStateRef.current }),
          );
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
  }, [drawFrame, stopLoop, poki]);

  // ── Keyboard controls ───────────────────────────────────────────────────────
  useEffect(() => {
    if (gamePhase !== 'playing') return;
    const onKeyDown = (e: KeyboardEvent) => { keysRef.current[e.key] = true; };
    const onKeyUp = (e: KeyboardEvent) => { keysRef.current[e.key] = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      keysRef.current = {};
    };
  }, [gamePhase]);

  // ── Touch / pointer controls ────────────────────────────────────────────────
  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (gameStateRef.current.phase !== 'playing') return;
    const rect = gameAreaRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    gameStateRef.current = moveBasket(gameStateRef.current, pct);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (gameStateRef.current.phase !== 'playing') return;
    e.preventDefault();
    const rect = gameAreaRef.current?.getBoundingClientRect();
    if (!rect) return;
    const touch = e.touches[0];
    const pct = ((touch.clientX - rect.left) / rect.width) * 100;
    gameStateRef.current = moveBasket(gameStateRef.current, pct);
  }, []);

  // ── Game actions ────────────────────────────────────────────────────────────
  const resetEffectRefs = useCallback(() => {
    prevLivesRef.current = 3;
    prevLastCatchKeyRef.current = null;
    prevLastComboBreakRef.current = null;
    prevCandyRainRef.current = false;
    prevComboMultRef.current = 1;
    bombFlashUntilRef.current = 0;
    shakeUntilRef.current = 0;
    milestonesHitRef.current = new Set();
    keysRef.current = {};
    totalTicksRef.current = 0;
  }, []);

  const resetHudState = useCallback(() => {
    setHudScore(0);
    setHudLives(3);
    setHudLevel(1);
    setHudCombo(0);
    setHudComboMultiplier(1);
    setHudMagnetExpiry(null);
    setHudWideExpiry(null);
    setHudCandyRainActive(false);
    setPointFlash(null);
    setPowerupFlash(null);
    setMilestoneFlash(null);
    setComboBreakFlash(null);
  }, []);

  const handleStartGame = useCallback((diff: Difficulty) => {
    setDifficulty(diff);
    const newState = startGame(createInitialState(diff));
    gameStateRef.current = newState;
    resetEffectRefs();
    resetHudState();
    setGameStarted(true);
    setGamePhase('playing');
    setShowConfetti(false);
    playGameStart();
    poki.gameplayStart();
    cg.gameplayStart();

    if (!rulesShownRef.current && safeStorage.getItem('cc_hide_rules') !== '1') {
      rulesShownRef.current = true;
      setShowRules(true);
      // Loop starts after rules modal closes
    } else {
      startLoop();
    }
  }, [poki, cg, startLoop, resetEffectRefs, resetHudState]);

  const handleCloseRules = useCallback((hideForever: boolean) => {
    if (hideForever) safeStorage.setItem('cc_hide_rules', '1');
    setShowRules(false);
    startLoop();
  }, [startLoop]);

  const handleRestart = useCallback(() => {
    stopLoop();
    setShowConfetti(false);
    const newState = startGame(createInitialState(difficulty));
    gameStateRef.current = newState;
    resetEffectRefs();
    resetHudState();
    setGamePhase('playing');
    playGameStart();
    poki.gameplayStart();
    cg.gameplayStart();
    startLoop();
  }, [difficulty, poki, cg, startLoop, stopLoop, resetEffectRefs, resetHudState]);

  const handleBackToMenu = useCallback(() => {
    stopLoop();
    sessionStorage.removeItem('cc_session_v2');
    setGameStarted(false);
    setShowConfetti(false);
    setGamePhase('idle');
    gameStateRef.current = createInitialState(difficulty);
    poki.gameplayStop();
    cg.gameplayStop();
  }, [difficulty, poki, cg, stopLoop]);

  const handleMuteToggle = useCallback(() => {
    const next = !muted;
    setMutedState(next);
    setMuted(next);
    safeStorage.setItem('cc_muted', next ? '1' : '0');
  }, [muted]);

  // ── Cleanup ─────────────────────────────────────────────────────────────────
  useEffect(() => () => stopLoop(), [stopLoop]);

  // ── Derived HUD values ──────────────────────────────────────────────────────
  const now = Date.now();
  const magnetSecsLeft = hudMagnetExpiry ? Math.max(0, Math.ceil((hudMagnetExpiry - now) / 1000)) : 0;
  const wideSecsLeft = hudWideExpiry ? Math.max(0, Math.ceil((hudWideExpiry - now) / 1000)) : 0;
  const comboColor = hudComboMultiplier >= 4 ? '#ff2255' : hudComboMultiplier === 3 ? '#ff8800' : ACCENT;

  const isPlaying = gamePhase === 'playing';
  const isGameOver = gamePhase === 'gameover';
  const isIdle = !gameStarted;

  return (
    <div
      style={{
        width: '100vw',
        height: '100dvh', // dvh respects browser UI chrome on mobile (iOS toolbar)
        background: 'linear-gradient(180deg, #1a0a2e 0%, #2d1060 50%, #1a0a2e 100%)',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        overflow: 'hidden',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {/* ── Confetti ── */}
      {showConfetti && <Confetti />}

      {/* ── Candy rain overlay (React HUD, not canvas) ── */}
      {hudCandyRainActive && (
        <div style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          zIndex: 35,
        }}>
          <div style={{
            fontSize: 'clamp(28px, 7vw, 52px)',
            fontWeight: 900,
            color: ACCENT,
            textAlign: 'center',
            textShadow: `0 0 40px ${THEME}, 0 0 80px ${ACCENT}`,
            animation: 'candyRainPulse 0.6s ease-in-out infinite alternate',
            letterSpacing: -1,
          }}>
            🍬 CANDY RAIN! 🍬
          </div>
        </div>
      )}

      {/* ── Milestone flash ── */}
      {milestoneFlash && (
        <div
          key={milestoneFlash.key}
          style={{
            position: 'fixed',
            top: '40%',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 'clamp(26px, 6vw, 44px)',
            fontWeight: 900,
            color: ACCENT,
            pointerEvents: 'none',
            zIndex: 42,
            animation: 'milestoneAppear 1.5s ease-out forwards',
            textShadow: `0 0 30px ${ACCENT}, 0 0 60px ${THEME}`,
            whiteSpace: 'nowrap',
            textAlign: 'center',
          }}
        >
          {milestoneFlash.text}
        </div>
      )}

      {/* ── Canvas game area (stars, items, basket, bomb flash) ── */}
      {(isPlaying || isGameOver) && (
        <div
          ref={gameAreaRef}
          onPointerMove={handlePointerMove}
          onTouchMove={handleTouchMove}
          style={{ position: 'absolute', inset: 0, cursor: 'none', touchAction: 'none' }}
        >
          <canvas
            ref={canvasRef}
            style={{ display: 'block', width: '100%', height: '100%' }}
          />
        </div>
      )}

      {/* ── HUD top bar ── */}
      {(isPlaying || isGameOver) && (
        <div style={{
          position: 'absolute',
          top: 12,
          left: 12,
          right: 12,
          display: 'flex',
          gap: 10,
          alignItems: 'flex-start',
          pointerEvents: 'none',
          zIndex: 20,
          flexWrap: 'wrap',
        }}>
          <HudPanel>
            <HudLabel>SCORE</HudLabel>
            <HudValue color={ACCENT}>{hudScore}</HudValue>
          </HudPanel>
          <HudPanel>
            <HudLabel>LIVES</HudLabel>
            <div style={{ display: 'flex', gap: 3, marginTop: 2 }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <span key={i} style={{ fontSize: 16, opacity: i < hudLives ? 1 : 0.2 }}>❤️</span>
              ))}
            </div>
          </HudPanel>
          <HudPanel>
            <HudLabel>LEVEL</HudLabel>
            <HudValue color={THEME}>{hudLevel}</HudValue>
          </HudPanel>

          {hudCombo >= 3 && (
            <HudPanel style={{
              borderColor: `${comboColor}66`,
              background: 'rgba(4,4,14,0.9)',
              boxShadow: `0 0 16px ${comboColor}44`,
              animation: 'comboGlow 0.8s ease-in-out infinite alternate',
            }}>
              <HudLabel>COMBO</HudLabel>
              <div style={{
                fontSize: 15,
                fontWeight: 900,
                color: comboColor,
                letterSpacing: 1,
                textShadow: `0 0 12px ${comboColor}`,
              }}>
                x{hudComboMultiplier} {hudComboMultiplier >= 4 ? '🔥' : hudComboMultiplier === 3 ? '🔥' : '⚡'}
              </div>
            </HudPanel>
          )}

          {magnetSecsLeft > 0 && (
            <div style={{
              background: 'rgba(68, 170, 255, 0.25)',
              border: '1px solid rgba(68, 170, 255, 0.5)',
              borderRadius: 20,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
              color: '#44aaff',
              backdropFilter: 'blur(10px)',
              letterSpacing: 1,
            }}>
              🧲 {magnetSecsLeft}s
            </div>
          )}
          {wideSecsLeft > 0 && (
            <div style={{
              background: `rgba(255, 220, 89, 0.25)`,
              border: `1px solid rgba(255, 220, 89, 0.5)`,
              borderRadius: 20,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
              color: ACCENT,
              backdropFilter: 'blur(10px)',
              letterSpacing: 1,
            }}>
              ⚡ {wideSecsLeft}s
            </div>
          )}

          <HudPanel style={{ marginLeft: 'auto' }}>
            <HudLabel>BEST</HudLabel>
            <HudValue color="#aaa">{bestScore}</HudValue>
          </HudPanel>
          <button
            onClick={handleMuteToggle}
            style={{
              background: 'rgba(4,4,14,0.75)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10,
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: 18,
              backdropFilter: 'blur(10px)',
              pointerEvents: 'all',
            }}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      )}

      {/* ── Point flash ── */}
      {pointFlash && (
        <div
          key={pointFlash.key}
          style={{
            position: 'fixed',
            top: '30%',
            left: '50%',
            transform: 'translateX(-50%)',
            color: ACCENT,
            fontSize: 36,
            fontWeight: 900,
            pointerEvents: 'none',
            zIndex: 40,
            animation: 'pointRise 1s ease-out forwards',
            textShadow: `0 0 20px ${ACCENT}`,
          }}
        >
          {pointFlash.text}
        </div>
      )}

      {/* ── Power-up catch flash ── */}
      {powerupFlash && (
        <div
          key={powerupFlash.key}
          style={{
            position: 'fixed',
            top: '35%',
            left: '50%',
            transform: 'translateX(-50%)',
            color: '#aa44ff',
            fontSize: 28,
            fontWeight: 900,
            pointerEvents: 'none',
            zIndex: 40,
            animation: 'pointRise 1.2s ease-out forwards',
            textShadow: '0 0 20px #aa44ff',
            whiteSpace: 'nowrap',
          }}
        >
          {powerupFlash.text}
        </div>
      )}

      {/* ── Combo break flash ── */}
      {comboBreakFlash && (
        <div
          key={comboBreakFlash.key}
          style={{
            position: 'fixed',
            top: '38%',
            left: '50%',
            transform: 'translateX(-50%)',
            color: THEME,
            fontSize: 26,
            fontWeight: 900,
            pointerEvents: 'none',
            zIndex: 40,
            animation: 'pointRise 1.2s ease-out forwards',
            textShadow: `0 0 20px ${THEME}`,
            whiteSpace: 'nowrap',
          }}
        >
          COMBO BREAK 💔
        </div>
      )}

      {/* ── Mode select (idle) ── */}
      {isIdle && (
        <ModeSelect
          bestScore={bestScore}
          muted={muted}
          onToggleMute={handleMuteToggle}
          onStart={handleStartGame}
        />
      )}

      {/* ── Rules modal ── */}
      {showRules && <RulesModal onClose={handleCloseRules} />}

      {/* ── Game over screen ── */}
      {isGameOver && (
        <GameOverScreen
          score={finalScore}
          bestScore={bestScore}
          level={finalLevel}
          maxCombo={finalMaxCombo}
          onRestart={handleRestart}
          onMenu={handleBackToMenu}
        />
      )}

      {/* Global CSS animations */}
      <style>{`
        @keyframes pointRise {
          0%   { opacity: 1; transform: translateX(-50%) translateY(0); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-60px); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes candyRainPulse {
          0%   { transform: scale(1); opacity: 0.9; }
          100% { transform: scale(1.08); opacity: 1; }
        }
        @keyframes milestoneAppear {
          0%   { opacity: 0; transform: translateX(-50%) scale(0.6); }
          15%  { opacity: 1; transform: translateX(-50%) scale(1.1); }
          30%  { transform: translateX(-50%) scale(1.0); }
          70%  { opacity: 1; transform: translateX(-50%) scale(1.0); }
          100% { opacity: 0; transform: translateX(-50%) scale(0.9) translateY(-20px); }
        }
        @keyframes comboGlow {
          0%   { box-shadow: 0 0 8px currentColor; }
          100% { box-shadow: 0 0 20px currentColor; }
        }
      `}</style>
    </div>
  );
}

// ─── HUD components ───────────────────────────────────────────────────────────
function HudPanel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'rgba(4,4,14,0.75)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 10,
      padding: '8px 14px',
      backdropFilter: 'blur(10px)',
      ...style,
    }}>
      {children}
    </div>
  );
}

function HudLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: '#44445a', fontSize: 9, letterSpacing: '2.5px', textTransform: 'uppercase', marginBottom: 2 }}>
      {children}
    </div>
  );
}

function HudValue({ children, color = '#fff' }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{ fontSize: 16, fontWeight: 700, color, letterSpacing: 1 }}>
      {children}
    </div>
  );
}

// ─── Mode select screen ───────────────────────────────────────────────────────
function ModeSelect({
  bestScore,
  muted,
  onToggleMute,
  onStart,
}: {
  bestScore: number;
  muted: boolean;
  onToggleMute: () => void;
  onStart: (diff: Difficulty) => void;
}) {
  const difficulties: { key: Difficulty; label: string; desc: string; emoji: string; color: string }[] = [
    { key: 'easy',   label: 'EASY',   desc: 'Slow & sweet 🍭',  emoji: '😊', color: '#44cc88' },
    { key: 'medium', label: 'MEDIUM', desc: 'Getting spicy 🌶️', emoji: '😅', color: ACCENT },
    { key: 'hard',   label: 'HARD',   desc: 'Total chaos 💥',   emoji: '🔥', color: '#ff6644' },
  ];

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      gap: 0,
      zIndex: 30,
      animation: 'fadeIn 0.4s ease-out',
    }}>
      <button
        onClick={() => { sessionStorage.removeItem('cc_session_v2'); window.location.href = '/'; }}
        style={{
          position: 'absolute', top: 16, left: 16,
          background: 'rgba(4,4,14,0.75)',
          border: '1px solid rgba(255,255,255,0.15)',
          color: '#888',
          padding: '10px 18px',
          borderRadius: 8,
          cursor: 'pointer',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 2,
          fontFamily: 'inherit',
          backdropFilter: 'blur(10px)',
        }}
      >
        ← ALL GAMES
      </button>

      <button
        onClick={onToggleMute}
        style={{
          position: 'absolute', top: 16, right: 16,
          background: 'rgba(4,4,14,0.75)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: '#fff',
          padding: '10px 14px',
          borderRadius: 8,
          cursor: 'pointer',
          fontSize: 18,
          backdropFilter: 'blur(10px)',
        }}
      >
        {muted ? '🔇' : '🔊'}
      </button>

      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 'clamp(60px, 15vw, 90px)', lineHeight: 1, marginBottom: 8 }}>🍬</div>
        <h1 style={{
          fontSize: 'clamp(28px, 7vw, 52px)',
          fontWeight: 900,
          color: '#fff',
          margin: 0,
          letterSpacing: -1,
          textShadow: `0 0 40px ${THEME}`,
        }}>
          Candy Catch
        </h1>
        <p style={{ color: THEME, fontSize: 13, letterSpacing: 3, marginTop: 6, textTransform: 'uppercase' }}>
          Sweet reflexes only
        </p>
        {bestScore > 0 && (
          <p style={{ color: ACCENT, fontSize: 13, marginTop: 6 }}>
            🏆 Best: {bestScore}
          </p>
        )}
      </div>

      <div style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: '12px 20px',
        marginBottom: 20,
        maxWidth: 340,
        width: '100%',
        fontSize: 13,
        color: '#ccc',
        lineHeight: 1.6,
        textAlign: 'center',
      }}>
        <span style={{ fontSize: 20 }}>🧺</span> Catch candy, dodge bombs<br />
        <span style={{ fontSize: 20 }}>💣</span> Bombs cost a life<br />
        <span style={{ fontSize: 20 }}>🔥</span> Build combos for score multipliers!<br />
        <span style={{ fontSize: 20 }}>⭐🧲⚡❤️🎁</span> Power-ups drop too!<br />
        <span style={{ fontSize: 20 }}>⬅️➡️</span> Arrow keys or drag to move
      </div>

      <div style={{
        display: 'flex',
        gap: 12,
        flexWrap: 'wrap',
        justifyContent: 'center',
        maxWidth: 500,
        width: '100%',
      }}>
        {difficulties.map(d => (
          <button
            key={d.key}
            onClick={() => onStart(d.key)}
            style={{
              flex: '1 1 120px',
              minWidth: 100,
              background: `linear-gradient(135deg, ${d.color}22, ${d.color}11)`,
              border: `2px solid ${d.color}66`,
              borderRadius: 16,
              padding: '18px 12px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              textAlign: 'center',
              transition: 'transform 0.15s, border-color 0.15s, background 0.15s',
              touchAction: 'manipulation',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.05)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = d.color;
              (e.currentTarget as HTMLButtonElement).style.background = `linear-gradient(135deg, ${d.color}44, ${d.color}22)`;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = `${d.color}66`;
              (e.currentTarget as HTMLButtonElement).style.background = `linear-gradient(135deg, ${d.color}22, ${d.color}11)`;
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 6 }}>{d.emoji}</div>
            <div style={{ color: d.color, fontWeight: 800, fontSize: 13, letterSpacing: 2 }}>{d.label}</div>
            <div style={{ color: '#aaa', fontSize: 11, marginTop: 4 }}>{d.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Rules modal ──────────────────────────────────────────────────────────────
function RulesModal({ onClose }: { onClose: (hideForever: boolean) => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 60, padding: 20,
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #1a0a2e, #2d1060)',
        border: `2px solid ${THEME}44`,
        borderRadius: 20,
        padding: 'clamp(16px, 4vw, 36px)',
        maxWidth: 380, width: '100%',
        textAlign: 'center',
        animation: 'fadeIn 0.3s ease-out',
        maxHeight: 'calc(100dvh - 80px)',
        overflowY: 'auto',
      }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🍬</div>
        <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 900, margin: '0 0 16px', letterSpacing: -0.5 }}>
          How to Play
        </h2>
        <div style={{ color: '#ccc', fontSize: 14, lineHeight: 2, marginBottom: 20 }}>
          🧺 Move the basket to catch candy<br />
          💣 Avoid the bombs — they cost a life<br />
          ❤️ You have 3 lives<br />
          ⚡ Speed increases every 10 catches<br />
          🔥 Combos: 3+ catches = x2, 6+ = x3, 10+ = x4!<br />
          ⭐ Stars are worth 3x points<br />
          🧲 Magnet pulls candy toward you (4s)<br />
          ⚡ Wide net doubles catch range (5s)<br />
          ❤️ Heart restores a life<br />
          🎁 Mystery box: +50 pts or bomb effect!<br />
          🍬 Every 5 levels: CANDY RAIN!<br />
          <br />
          <span style={{ color: '#888', fontSize: 12 }}>
            ← → Arrow keys, A/D, or drag to move
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => onClose(false)}
            style={{
              background: THEME, border: 'none', color: '#fff',
              padding: '14px 32px', borderRadius: 12,
              fontSize: 14, fontWeight: 800, cursor: 'pointer',
              letterSpacing: 2, fontFamily: 'inherit', touchAction: 'manipulation',
            }}
          >
            LET&apos;S GO! 🍭
          </button>
          <button
            onClick={() => onClose(true)}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#666',
              padding: '14px 24px', borderRadius: 12,
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
              letterSpacing: 1.5, fontFamily: 'inherit', touchAction: 'manipulation',
            }}
          >
            DON&apos;T SHOW AGAIN
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Game over screen ─────────────────────────────────────────────────────────
function GameOverScreen({
  score, bestScore, level, maxCombo, onRestart, onMenu,
}: {
  score: number; bestScore: number; level: number; maxCombo: number;
  onRestart: () => void; onMenu: () => void;
}) {
  const isNewBest = score >= bestScore && score > 0;
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 50, padding: 20,
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #1a0a2e, #2d1060)',
        border: `2px solid ${isNewBest ? ACCENT : THEME}66`,
        borderRadius: 24,
        padding: 'clamp(16px, 4vw, 40px)',
        maxWidth: 380, width: '100%',
        textAlign: 'center',
        animation: 'fadeIn 0.4s ease-out',
        maxHeight: 'calc(100dvh - 80px)',
        overflowY: 'auto',
      }}>
        <div style={{ fontSize: 56, marginBottom: 8 }}>{isNewBest ? '🏆' : '😢'}</div>
        <h2 style={{
          fontSize: 28, fontWeight: 900,
          color: isNewBest ? ACCENT : '#fff',
          margin: '0 0 6px',
          textShadow: isNewBest ? `0 0 30px ${ACCENT}` : 'none',
        }}>
          {isNewBest ? 'NEW RECORD!' : 'GAME OVER'}
        </h2>
        <p style={{ color: '#888', fontSize: 12, letterSpacing: 2, marginBottom: 20 }}>
          {isNewBest ? 'You crushed it! 🎉' : 'Better luck next time!'}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 24 }}>
          <ScoreStat label="SCORE"      value={score}    color={THEME} />
          <ScoreStat label="BEST"       value={bestScore} color={ACCENT} />
          <ScoreStat label="LEVEL"      value={level}    color="#aa88ff" />
          {maxCombo > 0 && <ScoreStat label="BEST COMBO" value={maxCombo} color="#ff8800" suffix="x" />}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={onRestart}
            style={{
              background: `linear-gradient(135deg, ${THEME}, #ff44aa)`,
              border: 'none', color: '#fff',
              padding: '16px 0', borderRadius: 14,
              fontSize: 15, fontWeight: 800, cursor: 'pointer',
              letterSpacing: 2, fontFamily: 'inherit', width: '100%',
              touchAction: 'manipulation',
              boxShadow: `0 4px 20px ${THEME}44`,
            }}
          >
            🔄 PLAY AGAIN
          </button>
          <button
            onClick={onMenu}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#aaa',
              padding: '14px 0', borderRadius: 14,
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              letterSpacing: 2, fontFamily: 'inherit', width: '100%',
              touchAction: 'manipulation',
            }}
          >
            CHANGE DIFFICULTY
          </button>
        </div>
      </div>
    </div>
  );
}

function ScoreStat({ label, value, color, suffix = '' }: { label: string; value: number; color: string; suffix?: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      padding: '10px 12px',
    }}>
      <div style={{ color: '#555', fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4, whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ color, fontSize: 20, fontWeight: 900 }}>{value}{suffix}</div>
    </div>
  );
}
