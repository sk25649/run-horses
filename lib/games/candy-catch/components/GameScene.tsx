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
import { safeStorage } from '@/lib/poki/safeStorage';

const THEME = '#ff6eb4';
const ACCENT = '#ffde59';
const BASKET_Y = 87; // percent from top

const SCORE_MILESTONES: { threshold: number; text: string }[] = [
  { threshold: 100,  text: 'SWEET! 🍬' },
  { threshold: 300,  text: 'SUGAR RUSH! ⚡' },
  { threshold: 500,  text: 'CANDY STORM! 🌪️' },
  { threshold: 1000, text: 'CANDY GOD! 👑' },
];

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

  const [gameState, setGameState] = useState<GameState>(() => createInitialState('easy'));
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [muted, setMutedState] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [bestScore, setBestScore] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [pointFlash, setPointFlash] = useState<{ text: string; key: number } | null>(null);
  const [shakeBasket, setShakeBasket] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  // Visual effects state
  const [bombFlash, setBombFlash] = useState(false); // red bg flash on bomb
  const [powerupFlash, setPowerupFlash] = useState<{ text: string; key: number } | null>(null);
  const [milestoneFlash, setMilestoneFlash] = useState<{ text: string; key: number } | null>(null);
  const [comboBreakFlash, setComboBreakFlash] = useState<{ key: number } | null>(null);
  const [prevComboMultiplier, setPrevComboMultiplier] = useState(1);

  // Milestone tracking (per game)
  const milestonesHitRef = useRef<Set<number>>(new Set());

  // Refs for game loop
  const gameStateRef = useRef<GameState>(gameState);
  const spawnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const levelRef = useRef(1);
  const rulesShownRef = useRef(false);
  const gameAreaRef = useRef<HTMLDivElement>(null);

  // Initialize from localStorage
  useEffect(() => {
    const best = parseInt(safeStorage.getItem('cc_best') || '0', 10);
    setBestScore(best);
    const savedMuted = safeStorage.getItem('cc_muted') === '1';
    setMutedState(savedMuted);
    setMuted(savedMuted);

    // Restore session
    try {
      const saved = sessionStorage.getItem('cc_session_v2');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.gameState?.phase === 'playing') {
          // Don't restore mid-game — just set difficulty
          setDifficulty(data.difficulty || 'easy');
        }
      }
    } catch { /* ignore */ }
  }, []);

  // Sync gameStateRef
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Persist session
  useEffect(() => {
    if (gameState.phase !== 'idle') {
      sessionStorage.setItem('cc_session_v2', JSON.stringify({ difficulty, gameState }));
    }
  }, [gameState, difficulty]);

  // Point flash
  useEffect(() => {
    if (!gameState.lastCatch) return;
    if (gameState.lastCatch.points > 0) {
      setPointFlash({ text: `+${gameState.lastCatch.points}`, key: gameState.lastCatch.key });
      const t = setTimeout(() => setPointFlash(null), 1000);
      return () => clearTimeout(t);
    }
  }, [gameState.lastCatch]);

  // Score milestone flash
  useEffect(() => {
    if (gameState.phase !== 'playing') return;
    for (const m of SCORE_MILESTONES) {
      if (gameState.score >= m.threshold && !milestonesHitRef.current.has(m.threshold)) {
        milestonesHitRef.current.add(m.threshold);
        setMilestoneFlash({ text: m.text, key: Date.now() });
        const t = setTimeout(() => setMilestoneFlash(null), 1500);
        return () => clearTimeout(t);
      }
    }
  }, [gameState.score, gameState.phase]);

  // Combo break flash
  useEffect(() => {
    if (!gameState.lastComboBreak) return;
    setComboBreakFlash({ key: gameState.lastComboBreak });
    const t = setTimeout(() => setComboBreakFlash(null), 1200);
    return () => clearTimeout(t);
  }, [gameState.lastComboBreak]);

  // Combo multiplier level-up pulse
  useEffect(() => {
    if (gameState.comboMultiplier > prevComboMultiplier) {
      setPrevComboMultiplier(gameState.comboMultiplier);
    } else if (gameState.comboMultiplier < prevComboMultiplier) {
      setPrevComboMultiplier(gameState.comboMultiplier);
    }
  }, [gameState.comboMultiplier, prevComboMultiplier]);

  const stopGameLoop = useCallback(() => {
    if (spawnTimerRef.current) clearTimeout(spawnTimerRef.current);
    if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    spawnTimerRef.current = null;
    tickTimerRef.current = null;
  }, []);

  // Use a ref for recursive spawn scheduling (avoids stale closure issues)
  const scheduleSpawnRef = useRef<() => void>(() => {});

  const scheduleSpawn = useCallback(() => {
    const doSpawn = () => {
      const interval = getSpawnInterval(gameStateRef.current);
      spawnTimerRef.current = setTimeout(() => {
        if (gameStateRef.current.phase !== 'playing') return;
        setGameState(prev => {
          if (prev.phase !== 'playing') return prev;
          return spawnItem(prev);
        });
        doSpawn();
      }, interval);
    };
    scheduleSpawnRef.current = doSpawn;
    doSpawn();
  }, []);

  const startGameLoop = useCallback(() => {
    stopGameLoop();
    // Tick physics at 30fps
    tickTimerRef.current = setInterval(() => {
      setGameState(prev => {
        if (prev.phase !== 'playing') return prev;

        // Apply magnet effect before tick
        let stateWithMagnet = prev;
        if (prev.activePowerups.magnet !== null) {
          const pulledItems = prev.items.map(item => {
            if (item.type === 'candy' || item.type === 'star') {
              const pull = (prev.basketX - item.x) * 0.04;
              return { ...item, x: item.x + pull };
            }
            return item;
          });
          stateWithMagnet = { ...prev, items: pulledItems };
        }

        let next = tickItems(stateWithMagnet);
        const prevLevel = prev.level;
        const prevCombo = prev.combo;
        const prevCandyRain = prev.candyRain.active;
        next = checkCollisions(next);

        // Level up sound
        if (next.level > prevLevel && next.level > 1) {
          playLevelUp();
        }

        // Candy rain started
        if (!prevCandyRain && next.candyRain.active) {
          playCandyRain();
        }

        // Catch sound
        if (next.lastCatch && next.lastCatch !== prev.lastCatch) {
          const isPowerup = ['🧲', '⚡', '❤️', '🎁', '💥'].includes(next.lastCatch.emoji);
          if (isPowerup) {
            playPowerup();
            setPowerupFlash({ text: getPowerupFlashText(next.lastCatch.emoji), key: next.lastCatch.key });
            setTimeout(() => setPowerupFlash(null), 1200);
          } else if (next.lastCatch.points >= 20) {
            playCatchBig();
          } else {
            playCatch();
          }
        }

        // Combo milestone sound (when crossing a combo tier)
        const prevMultiplier = getComboMultiplierValue(prevCombo);
        const nextMultiplier = getComboMultiplierValue(next.combo);
        if (nextMultiplier > prevMultiplier) {
          playCombo();
        }

        // Bomb hit
        if (next.lives < prev.lives) {
          playBomb();
          setShakeBasket(true);
          setBombFlash(true);
          setTimeout(() => setShakeBasket(false), 500);
          setTimeout(() => setBombFlash(false), 300);
        }

        // Game over
        if (next.phase === 'gameover' && prev.phase === 'playing') {
          stopGameLoop();
          playGameOver();
          poki.gameplayStop();
          poki.commercialBreak().catch(() => {});
          // Save best score
          const newBest = Math.max(next.score, parseInt(safeStorage.getItem('cc_best') || '0', 10));
          safeStorage.setItem('cc_best', String(newBest));
          setBestScore(newBest);
          if (next.score >= newBest && next.score > 0) setShowConfetti(true);
        }

        return next;
      });
    }, 33);
    scheduleSpawn();
  }, [stopGameLoop, scheduleSpawn, poki]);

  const handleStartGame = useCallback((diff: Difficulty) => {
    setDifficulty(diff);
    const newState = startGame(createInitialState(diff));
    setGameState(newState);
    setGameStarted(true);
    setShowConfetti(false);
    levelRef.current = 1;
    milestonesHitRef.current = new Set();
    setPrevComboMultiplier(1);
    playGameStart();
    poki.gameplayStart();

    // Show rules once
    if (!rulesShownRef.current && safeStorage.getItem('cc_hide_rules') !== '1') {
      rulesShownRef.current = true;
      setShowRules(true);
      // Pause game while rules shown — restart loop after close
    } else {
      startGameLoop();
    }
  }, [poki, startGameLoop]);

  const handleCloseRules = useCallback((hideForever: boolean) => {
    if (hideForever) safeStorage.setItem('cc_hide_rules', '1');
    setShowRules(false);
    startGameLoop();
  }, [startGameLoop]);

  const handleRestart = useCallback(() => {
    stopGameLoop();
    setShowConfetti(false);
    milestonesHitRef.current = new Set();
    setPrevComboMultiplier(1);
    const newState = startGame(createInitialState(difficulty));
    setGameState(newState);
    playGameStart();
    poki.gameplayStart();
    startGameLoop();
  }, [difficulty, poki, startGameLoop, stopGameLoop]);

  const handleBackToMenu = useCallback(() => {
    stopGameLoop();
    sessionStorage.removeItem('cc_session_v2');
    setGameStarted(false);
    setShowConfetti(false);
    setGameState(createInitialState(difficulty));
    poki.gameplayStop();
  }, [difficulty, poki, stopGameLoop]);

  const handleMuteToggle = useCallback(() => {
    const next = !muted;
    setMutedState(next);
    setMuted(next);
    safeStorage.setItem('cc_muted', next ? '1' : '0');
  }, [muted]);

  // Cleanup on unmount
  useEffect(() => () => stopGameLoop(), [stopGameLoop]);

  // ─── Keyboard controls ────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState.phase !== 'playing') return;
    const STEP = 4;
    const keys: Record<string, boolean> = {};

    const onKeyDown = (e: KeyboardEvent) => {
      keys[e.key] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.key] = false;
    };

    const moveInterval = setInterval(() => {
      if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
        setGameState(prev => prev.phase === 'playing' ? moveBasket(prev, prev.basketX - STEP) : prev);
      }
      if (keys['ArrowRight'] || keys['d'] || keys['D']) {
        setGameState(prev => prev.phase === 'playing' ? moveBasket(prev, prev.basketX + STEP) : prev);
      }
    }, 33);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      clearInterval(moveInterval);
    };
  }, [gameState.phase]);

  // ─── Touch / mouse controls ───────────────────────────────────────────────
  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (gameState.phase !== 'playing') return;
    const rect = gameAreaRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    setGameState(prev => prev.phase === 'playing' ? moveBasket(prev, pct) : prev);
  }, [gameState.phase]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (gameState.phase !== 'playing') return;
    e.preventDefault();
    const rect = gameAreaRef.current?.getBoundingClientRect();
    if (!rect) return;
    const touch = e.touches[0];
    const pct = ((touch.clientX - rect.left) / rect.width) * 100;
    setGameState(prev => prev.phase === 'playing' ? moveBasket(prev, pct) : prev);
  }, [gameState.phase]);

  const isPlaying = gameState.phase === 'playing';
  const isGameOver = gameState.phase === 'gameover';
  const isIdle = !gameStarted;

  // Power-up time remaining (seconds)
  const now = Date.now();
  const magnetSecsLeft = gameState.activePowerups.magnet ? Math.max(0, Math.ceil((gameState.activePowerups.magnet - now) / 1000)) : 0;
  const wideSecsLeft = gameState.activePowerups.wide ? Math.max(0, Math.ceil((gameState.activePowerups.wide - now) / 1000)) : 0;

  const comboColor = gameState.comboMultiplier >= 4 ? '#ff2255' : gameState.comboMultiplier === 3 ? '#ff8800' : '#ffde59';

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: 'linear-gradient(180deg, #1a0a2e 0%, #2d1060 50%, #1a0a2e 100%)',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        overflow: 'hidden',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {/* ── Confetti ── */}
      {showConfetti && <Confetti />}

      {/* ── Bomb flash overlay ── */}
      {bombFlash && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(255, 0, 0, 0.30)',
          pointerEvents: 'none',
          zIndex: 45,
          animation: 'bombFlash 0.3s ease-out forwards',
        }} />
      )}

      {/* ── Candy rain overlay ── */}
      {gameState.candyRain.active && (
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
            color: '#ffde59',
            textAlign: 'center',
            textShadow: '0 0 40px #ff6eb4, 0 0 80px #ffde59',
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

      {/* ── Game area (falling items + basket) ── */}
      {(isPlaying || isGameOver) && (
        <div
          ref={gameAreaRef}
          onPointerMove={handlePointerMove}
          onTouchMove={handleTouchMove}
          style={{ position: 'absolute', inset: 0, cursor: 'none', touchAction: 'none' }}
        >
          {/* Stars background */}
          <StarField />

          {/* Falling items */}
          {gameState.items.map(item => (
            <div
              key={item.id}
              style={{
                position: 'absolute',
                left: `${item.x}%`,
                top: `${item.y}%`,
                transform: 'translate(-50%, -50%)',
                fontSize: 'clamp(28px, 5vw, 44px)',
                filter: item.type === 'bomb'
                  ? 'drop-shadow(0 0 8px #ff4444)'
                  : item.type === 'star'
                    ? 'drop-shadow(0 0 10px #ffde59) drop-shadow(0 0 20px #ffaa00)'
                    : ['magnet', 'wide', 'heart', 'mystery'].includes(item.type)
                      ? 'drop-shadow(0 0 10px #aa44ff) drop-shadow(0 0 20px #ff6eb4)'
                      : 'drop-shadow(0 0 6px rgba(255,220,100,0.7))',
                transition: 'none',
                pointerEvents: 'none',
              }}
            >
              {item.emoji}
            </div>
          ))}

          {/* Basket */}
          <div
            style={{
              position: 'absolute',
              left: `${gameState.basketX}%`,
              top: `${BASKET_Y}%`,
              transform: `translate(-50%, -50%) ${shakeBasket ? 'translateX(6px)' : ''}`,
              transition: shakeBasket ? 'none' : 'transform 0.05s',
              fontSize: 'clamp(40px, 8vw, 64px)',
              filter: `drop-shadow(0 0 12px ${gameState.activePowerups.wide ? '#44aaff' : THEME})`,
              pointerEvents: 'none',
              animation: shakeBasket ? 'shake 0.5s ease-in-out' : 'none',
            }}
          >
            🧺
          </div>

          {/* Wide basket indicator — visual width bar */}
          {gameState.activePowerups.wide && (
            <div style={{
              position: 'absolute',
              left: `${gameState.basketX}%`,
              top: `${BASKET_Y}%`,
              transform: 'translate(-50%, -50%)',
              width: '20%',
              height: 4,
              background: 'linear-gradient(90deg, transparent, #44aaff88, transparent)',
              borderRadius: 2,
              pointerEvents: 'none',
              marginTop: 36,
            }} />
          )}

          {/* Ground line */}
          <div style={{
            position: 'absolute',
            bottom: '8%',
            left: '5%',
            right: '5%',
            height: 2,
            background: `linear-gradient(90deg, transparent, ${THEME}44, transparent)`,
            borderRadius: 2,
          }} />
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
          {/* Score */}
          <HudPanel>
            <HudLabel>SCORE</HudLabel>
            <HudValue color={ACCENT}>{gameState.score}</HudValue>
          </HudPanel>
          {/* Lives */}
          <HudPanel>
            <HudLabel>LIVES</HudLabel>
            <div style={{ display: 'flex', gap: 3, marginTop: 2 }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <span key={i} style={{ fontSize: 16, opacity: i < gameState.lives ? 1 : 0.2 }}>❤️</span>
              ))}
            </div>
          </HudPanel>
          {/* Level */}
          <HudPanel>
            <HudLabel>LEVEL</HudLabel>
            <HudValue color={THEME}>{gameState.level}</HudValue>
          </HudPanel>

          {/* Combo panel — only when combo >= 3 */}
          {gameState.combo >= 3 && (
            <HudPanel style={{
              borderColor: `${comboColor}66`,
              background: `rgba(4,4,14,0.9)`,
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
                x{gameState.comboMultiplier} {gameState.comboMultiplier >= 4 ? '🔥' : gameState.comboMultiplier === 3 ? '🔥' : '⚡'}
              </div>
            </HudPanel>
          )}

          {/* Active power-up pills */}
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
              background: 'rgba(255, 220, 89, 0.25)',
              border: '1px solid rgba(255, 220, 89, 0.5)',
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

          {/* Best */}
          <HudPanel style={{ marginLeft: 'auto' }}>
            <HudLabel>BEST</HudLabel>
            <HudValue color="#aaa">{bestScore}</HudValue>
          </HudPanel>
          {/* Mute */}
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
            color: '#ff6eb4',
            fontSize: 26,
            fontWeight: 900,
            pointerEvents: 'none',
            zIndex: 40,
            animation: 'pointRise 1.2s ease-out forwards',
            textShadow: '0 0 20px #ff6eb4',
            whiteSpace: 'nowrap',
          }}
        >
          COMBO BREAK 💔
        </div>
      )}

      {/* ── Mode / difficulty select (idle) ── */}
      {isIdle && (
        <ModeSelect
          bestScore={bestScore}
          muted={muted}
          onToggleMute={handleMuteToggle}
          onStart={handleStartGame}
        />
      )}

      {/* ── How-to-play modal ── */}
      {showRules && (
        <RulesModal onClose={handleCloseRules} />
      )}

      {/* ── Game over screen ── */}
      {isGameOver && (
        <GameOverScreen
          score={gameState.score}
          bestScore={bestScore}
          level={gameState.level}
          maxCombo={gameState.maxCombo}
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
        @keyframes shake {
          0%, 100% { transform: translate(-50%, -50%) translateX(0); }
          20% { transform: translate(-50%, -50%) translateX(-8px); }
          40% { transform: translate(-50%, -50%) translateX(8px); }
          60% { transform: translate(-50%, -50%) translateX(-6px); }
          80% { transform: translate(-50%, -50%) translateX(6px); }
        }
        @keyframes floatDown {
          from { transform: translate(-50%, -50%) translateY(-10px); opacity: 0; }
          to   { transform: translate(-50%, -50%) translateY(0); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes bombFlash {
          0%   { opacity: 1; }
          100% { opacity: 0; }
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

// ─── Helper ────────────────────────────────────────────────────────────────────
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

// Pre-generate stars outside component to avoid impure calls during render
const STAR_DATA = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  x: (i * 17 + 3) % 100,
  y: (i * 29 + 7) % 100,
  size: (i % 3) + 1,
  opacity: ((i % 5) + 1) * 0.1,
}));

// ─── Star field decoration ────────────────────────────────────────────────────
function StarField() {
  return (
    <>
      {STAR_DATA.map(s => (
        <div
          key={s.id}
          style={{
            position: 'absolute',
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            borderRadius: '50%',
            background: '#fff',
            opacity: s.opacity,
            pointerEvents: 'none',
          }}
        />
      ))}
    </>
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
    { key: 'easy',   label: 'EASY',   desc: 'Slow & sweet 🍭',    emoji: '😊', color: '#44cc88' },
    { key: 'medium', label: 'MEDIUM', desc: 'Getting spicy 🌶️',   emoji: '😅', color: ACCENT },
    { key: 'hard',   label: 'HARD',   desc: 'Total chaos 💥',     emoji: '🔥', color: '#ff6644' },
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
      {/* Back to all games */}
      <button
        onClick={() => { sessionStorage.removeItem('cc_session_v2'); window.location.href = '/'; }}
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
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

      {/* Mute button */}
      <button
        onClick={onToggleMute}
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
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

      {/* Title */}
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

      {/* How to play */}
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

      {/* Difficulty cards */}
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
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 60,
      padding: 20,
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #1a0a2e, #2d1060)',
        border: `2px solid ${THEME}44`,
        borderRadius: 20,
        padding: 'clamp(20px, 4vw, 40px)',
        maxWidth: 380,
        width: '100%',
        textAlign: 'center',
        animation: 'fadeIn 0.3s ease-out',
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
          🔥 Combos: 3+ catches in a row = x2, 6+ = x3, 10+ = x4!<br />
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
              background: THEME,
              border: 'none',
              color: '#fff',
              padding: '14px 32px',
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 800,
              cursor: 'pointer',
              letterSpacing: 2,
              fontFamily: 'inherit',
              touchAction: 'manipulation',
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
              padding: '14px 24px',
              borderRadius: 12,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: 1.5,
              fontFamily: 'inherit',
              touchAction: 'manipulation',
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
  score,
  bestScore,
  level,
  maxCombo,
  onRestart,
  onMenu,
}: {
  score: number;
  bestScore: number;
  level: number;
  maxCombo: number;
  onRestart: () => void;
  onMenu: () => void;
}) {
  const isNewBest = score >= bestScore && score > 0;
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
      padding: 20,
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #1a0a2e, #2d1060)',
        border: `2px solid ${isNewBest ? ACCENT : THEME}66`,
        borderRadius: 24,
        padding: 'clamp(24px, 5vw, 48px)',
        maxWidth: 380,
        width: '100%',
        textAlign: 'center',
        animation: 'fadeIn 0.4s ease-out',
      }}>
        <div style={{ fontSize: 56, marginBottom: 8 }}>
          {isNewBest ? '🏆' : '😢'}
        </div>
        <h2 style={{
          fontSize: 28,
          fontWeight: 900,
          color: isNewBest ? ACCENT : '#fff',
          margin: '0 0 6px',
          textShadow: isNewBest ? `0 0 30px ${ACCENT}` : 'none',
        }}>
          {isNewBest ? 'NEW RECORD!' : 'GAME OVER'}
        </h2>
        <p style={{ color: '#888', fontSize: 12, letterSpacing: 2, marginBottom: 20 }}>
          {isNewBest ? 'You crushed it! 🎉' : 'Better luck next time!'}
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
          <ScoreStat label="SCORE" value={score} color={THEME} />
          <ScoreStat label="BEST" value={bestScore} color={ACCENT} />
          <ScoreStat label="LEVEL" value={level} color="#aa88ff" />
          {maxCombo > 0 && (
            <ScoreStat label="BEST COMBO" value={maxCombo} color="#ff8800" suffix="x" />
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={onRestart}
            style={{
              background: `linear-gradient(135deg, ${THEME}, #ff44aa)`,
              border: 'none',
              color: '#fff',
              padding: '16px 0',
              borderRadius: 14,
              fontSize: 15,
              fontWeight: 800,
              cursor: 'pointer',
              letterSpacing: 2,
              fontFamily: 'inherit',
              width: '100%',
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
              padding: '14px 0',
              borderRadius: 14,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: 2,
              fontFamily: 'inherit',
              width: '100%',
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
      padding: '12px 14px',
      flex: 1,
      minWidth: 70,
    }}>
      <div style={{ color: '#555', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ color, fontSize: 20, fontWeight: 900 }}>{value}{suffix}</div>
    </div>
  );
}
