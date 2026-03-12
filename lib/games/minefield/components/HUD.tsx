"use client";

import { CSSProperties, useState, useEffect, useRef } from "react";
import { track } from "@vercel/analytics";
import type { OnlineStatus, OnlinePlayer } from "@/lib/multiplayer/types";
import {
  GameState,
  GameMode,
  Difficulty,
  Player,
  MoveResult,
  MINE_COUNT,
  TREASURE_VALUES,
  isForbiddenForMine,
  ROWS,
  COLS,
  WHITE_START,
  BLACK_START,
} from "@/lib/games/minefield/gameLogic";

// ─── Confetti ─────────────────────────────────────────────────────────────────
function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = ["#ff4444","#f5c842","#ff8800","#4488ff","#aa44ff","#ffffff","#ffaa00"];
    const pieces = Array.from({ length: 140 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.4 - canvas.height * 0.2,
      w: Math.random() * 11 + 5, h: Math.random() * 5 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      vy: Math.random() * 3.5 + 1.5, vx: (Math.random() - 0.5) * 1.8,
      rot: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 0.15,
      opacity: 1,
    }));
    const start = Date.now();
    let raf: number;
    const draw = () => {
      const elapsed = Date.now() - start;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach(p => {
        p.y += p.vy; p.x += p.vx; p.rot += p.rotSpeed;
        if (p.y > canvas.height) { p.y = -20; p.x = Math.random() * canvas.width; }
        p.opacity = elapsed > 3200 ? Math.max(0, 1 - (elapsed - 3200) / 1200) : 1;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.globalAlpha = p.opacity; ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
      });
      if (elapsed < 4400) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 55 }} />;
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const panel: CSSProperties = {
  background: "rgba(4,4,14,0.78)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 10,
  padding: "10px 18px",
  backdropFilter: "blur(10px)",
};
const lbl: CSSProperties = { color: "#44445a", fontSize: 9, letterSpacing: "2.5px", textTransform: "uppercase", marginBottom: 4 };
const val: CSSProperties = { fontSize: 13, fontWeight: 700, letterSpacing: "1px" };

function GhostButton({ children, onClick, color = "#ff4444", small = false }: {
  children: React.ReactNode; onClick: () => void; color?: string; small?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} style={{
      background: "transparent", border: `1.5px solid ${color}`, color,
      padding: small ? "8px 22px" : "14px 44px",
      fontSize: small ? 11 : 13, fontWeight: 700,
      letterSpacing: small ? 2 : 4, cursor: "pointer", borderRadius: 4,
      fontFamily: "inherit", transition: "background 0.15s",
    }}
      onMouseEnter={e => (e.currentTarget.style.background = `${color}18`)}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >{children}</button>
  );
}

// ─── Mini placement grid (shown in HUD during placement phase) ────────────────
function PlacementGrid({
  mines,
  onToggle,
  isMobile,
  myColor,
}: {
  mines: [number, number][];
  onToggle: (r: number, c: number) => void;
  isMobile: boolean;
  myColor?: Player | null;
}) {
  const size = isMobile ? 22 : 28;
  const gap = 2;
  const mineSet = new Set(mines.map(([r, c]) => `${r},${c}`));
  const whiteKey = `${WHITE_START[0]},${WHITE_START[1]}`;
  const blackKey = `${BLACK_START[0]},${BLACK_START[1]}`;

  return (
    <div style={{
      display: "inline-grid",
      gridTemplateColumns: `repeat(${COLS}, ${size}px)`,
      gap: `${gap}px`,
      padding: 8,
      background: "rgba(0,0,0,0.5)",
      borderRadius: 8,
      border: "1px solid rgba(255,255,255,0.08)",
    }}>
      {Array.from({ length: ROWS }, (_, r) =>
        Array.from({ length: COLS }, (_, c) => {
          const key = `${r},${c}`;
          const forbidden = isForbiddenForMine(r, c);
          const hasMine = mineSet.has(key);
          const isWhiteStart = key === whiteKey;
          const isBlackStart = key === blackKey;
          const isMyStart = myColor === 'white' ? isWhiteStart : myColor === 'black' ? isBlackStart : false;
          const isOppStart = myColor === 'white' ? isBlackStart : myColor === 'black' ? isWhiteStart : false;
          return (
            <div
              key={key}
              onClick={() => !forbidden && onToggle(r, c)}
              style={{
                width: size, height: size, borderRadius: 3,
                background: hasMine
                  ? "#cc2222"
                  : isMyStart
                    ? myColor === 'white' ? "rgba(34,119,255,0.5)" : "rgba(255,136,0,0.5)"
                    : isOppStart
                      ? "rgba(80,80,120,0.5)"
                      : forbidden
                        ? "rgba(20,20,40,0.8)"
                        : "rgba(60,60,90,0.6)",
                border: hasMine
                  ? "1px solid #ff4444"
                  : isMyStart
                    ? `2px solid ${myColor === 'white' ? '#2277ff' : '#ff8800'}`
                    : isOppStart
                      ? "1px solid rgba(255,255,255,0.2)"
                      : forbidden
                        ? "1px solid rgba(255,255,255,0.03)"
                        : "1px solid rgba(255,255,255,0.08)",
                cursor: forbidden ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: isMyStart || isOppStart ? 9 : 8,
                color: hasMine ? "#ff8888" : isMyStart || isOppStart ? "#ffffff" : "transparent",
                fontWeight: 700,
                transition: "background 0.1s",
                userSelect: "none",
              }}
            >
              {hasMine ? "●" : isMyStart ? "★" : isOppStart && myColor ? "○" : ""}
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface HUDProps {
  gameState: GameState;
  gameMode: GameMode | null;
  difficulty: Difficulty;
  winner: Player | 'draw' | null;
  adBreakActive?: boolean;
  aiThinking: boolean;
  // Placement
  phase: 'placement' | 'moving' | 'finished';
  placingMines: [number, number][];
  placementTurn: Player | null; // which player is placing (local only)
  showPassScreen: boolean;
  onToggleMine: (r: number, c: number) => void;
  onConfirmPlacement: () => void;
  onRandomPlacement: () => void;
  onPassReady: () => void;
  // Game controls
  onReset: () => void;
  onChangeMode: () => void;
  onSelectMode: (mode: GameMode, diff?: Difficulty) => void;
  // Sound
  muted: boolean;
  onToggleMute: () => void;
  // Online
  onlineStatus: OnlineStatus | null;
  onlineRoomId: string | null;
  myColor: Player | null;
  onlinePlayers: OnlinePlayer[];
  opponentWantsRematch: boolean;
  onSendRematch: () => void;
  onSubmitName: (name: string) => void;
  onSendSetHints: (value: boolean) => void;
  // Last result
  lastMoveResult: MoveResult | null;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function HUD({
  gameState, gameMode, difficulty, winner, adBreakActive = false, aiThinking,
  phase, placingMines, placementTurn, showPassScreen,
  onToggleMine, onConfirmPlacement, onRandomPlacement, onPassReady,
  onReset, onChangeMode, onSelectMode,
  muted, onToggleMute,
  onlineStatus, onlineRoomId, myColor, onlinePlayers, opponentWantsRematch,
  onSendRematch, onSubmitName, onSendSetHints,
  lastMoveResult,
}: HUDProps) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const [playerName, setPlayerName] = useState('');
  useEffect(() => { setPlayerName(localStorage.getItem('mo_name') || ''); }, []);

  const [showRulesModal, setShowRulesModal] = useState(false);
  const rulesShownRef = useRef(false);
  useEffect(() => {
    if (gameMode !== null && !rulesShownRef.current && localStorage.getItem('mo_hide_rules') !== '1') {
      rulesShownRef.current = true;
      setShowRulesModal(true);
    }
  }, [gameMode]);
  const dismissRules = (never: boolean) => {
    if (never) localStorage.setItem('mo_hide_rules', '1');
    setShowRulesModal(false);
  };

  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  // Point flash — shown when points are scored/lost
  const [pointFlash, setPointFlash] = useState<{ text: string; color: string; key: number } | null>(null);
  useEffect(() => {
    if (!lastMoveResult || lastMoveResult.points === 0) return;
    const justMoved: Player = gameState.currentTurn === 'white' ? 'black' : 'white';
    const color = lastMoveResult.type === 'mine' ? '#ff4444'
      : lastMoveResult.type === 'treasure' ? '#f5c842'
      : justMoved === 'white' ? '#2277ff' : '#ff8800';
    const text = lastMoveResult.type === 'mine' ? '💥 −5'
      : lastMoveResult.type === 'treasure' ? `✨ +${lastMoveResult.points}`
      : `+${lastMoveResult.points}`;
    setPointFlash({ text, color, key: Date.now() });
    const t = setTimeout(() => setPointFlash(null), 1600);
    return () => clearTimeout(t);
  }, [lastMoveResult]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const url = window.location.origin + '/';
      const text = `Play Mines of Oblivion — a memory strategy game!\n${url}`;
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: 'Mines of Oblivion', text, url }).catch(() => {});
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } finally { setSharing(false); }
  };

  const { scores, currentTurn, minesRemaining } = gameState;
  const turnLabel = gameMode === "online"
    ? currentTurn === myColor ? "○ YOUR TURN" : `● ${(onlinePlayers.find(p => p.color !== myColor)?.name ?? "OPPONENT").toUpperCase()}`
    : gameMode === "ai"
      ? currentTurn === "white" ? "○ YOU (BLUE)" : "● AI (ORANGE)"
      : currentTurn === "white" ? "○ BLUE" : "● ORANGE";
  const turnColor = currentTurn === "white" ? "#2277ff" : "#ff8800";

  return (
    <>
      <style>{`
        @keyframes ai-pulse { 0%,100%{opacity:1} 50%{opacity:0.25} }
        @keyframes point-rise {
          0%   { opacity: 0; transform: translateX(-50%) translateY(0px) scale(0.7); }
          12%  { opacity: 1; transform: translateX(-50%) translateY(-8px) scale(1.1); }
          40%  { opacity: 1; transform: translateX(-50%) translateY(-28px) scale(1); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-70px) scale(0.9); }
        }
        @keyframes mode-fade { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .ai-blink { animation: ai-pulse 0.9s ease-in-out infinite; }
        .mode-fade { animation: mode-fade 0.35s ease both; }
        .mode-card:hover { background: rgba(255,255,255,0.04) !important; border-color: rgba(255,255,255,0.2) !important; }
      `}</style>

      {/* ══ HOW TO PLAY MODAL ════════════════════════════════════════════════ */}
      {showRulesModal && (
        <div className="mode-fade" style={{
          position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(2,2,10,0.88)", backdropFilter: "blur(8px)", zIndex: 90,
          padding: "24px 16px", overflowY: "auto",
        }} onClick={() => dismissRules(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            width: "100%", maxWidth: 480,
            background: "rgba(12,12,28,0.98)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 16, padding: "28px 24px",
            display: "flex", flexDirection: "column", gap: 12,
            fontFamily: "'SF Mono','Fira Code',monospace",
          }}>
            <div style={{ textAlign: "center", fontSize: 20, fontWeight: 900, letterSpacing: 3, color: "#ffffff", marginBottom: 4 }}>
              HOW TO PLAY
            </div>

            {/* Step 1 */}
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "12px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "#888aaa", marginBottom: 6 }}>STEP 1 — PLACE YOUR MINES 💣</div>
              <div style={{ fontSize: 12, color: "#ccccee", lineHeight: 1.6 }}>
                Each player secretly places <span style={{ color: "#ff4444", fontWeight: 700 }}>15 mines</span> on the board before the game starts. Tap any tile to place a mine — or hit <span style={{ color: "#44dd88", fontWeight: 700 }}>RANDOM</span> to place them all at once. Your opponent can't see where you placed them!
              </div>
            </div>

            {/* Step 2 */}
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "12px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "#888aaa", marginBottom: 6 }}>STEP 2 — MOVE YOUR PIECE 🟦🟧</div>
              <div style={{ fontSize: 12, color: "#ccccee", lineHeight: 1.6 }}>
                <span style={{ color: "#2277ff", fontWeight: 700 }}>BLUE</span> goes first. On your turn, move your piece to any adjacent tile (including diagonals). You can only move to empty tiles — you can't step on your opponent.
              </div>
            </div>

            {/* Step 3 */}
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "12px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "#888aaa", marginBottom: 6 }}>STEP 3 — SCORE POINTS ✨</div>
              <div style={{ fontSize: 12, color: "#ccccee", lineHeight: 1.6 }}>
                When you step onto a tile, you score points equal to the number of <span style={{ color: "#ff4444", fontWeight: 700 }}>enemy mines</span> surrounding it (all 8 directions). Land on a <span style={{ color: "#f5c842", fontWeight: 700 }}>★ TREASURE</span> tile for a big bonus!
              </div>
            </div>

            {/* Step 4 */}
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "12px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "#888aaa", marginBottom: 6 }}>STEP 4 — AVOID MINES 💥</div>
              <div style={{ fontSize: 12, color: "#ccccee", lineHeight: 1.6 }}>
                If you step on one of <span style={{ color: "#ff4444", fontWeight: 700 }}>your own mines</span>, it explodes! You lose <span style={{ color: "#ff4444", fontWeight: 700 }}>5 points</span> and the mine is gone. Use the number clues to remember where enemy mines are.
              </div>
            </div>

            {/* Step 5 */}
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "12px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "#888aaa", marginBottom: 6 }}>STEP 5 — WIN THE GAME 🏆</div>
              <div style={{ fontSize: 12, color: "#ccccee", lineHeight: 1.6 }}>
                The game ends when all mines have been detonated. The player with the <span style={{ color: "#f5c842", fontWeight: 700 }}>most points</span> wins!
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: 8 }}>
              <button
                onClick={() => dismissRules(false)}
                style={{
                  width: "100%", padding: "13px 0", borderRadius: 10, border: "none",
                  background: "#2277ff", color: "#ffffff", fontSize: 14, fontWeight: 800,
                  letterSpacing: 3, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                GOT IT
              </button>
              <button
                onClick={() => dismissRules(true)}
                style={{
                  background: "none", border: "none", color: "#555577", fontSize: 11,
                  letterSpacing: 2, cursor: "pointer", fontFamily: "inherit", padding: "4px 0",
                }}
              >
                DON'T SHOW THIS AGAIN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ PASS-DEVICE SCREEN (PvP only) ════════════════════════════════════ */}
      {showPassScreen && (
        <div className="mode-fade" style={{
          position: "fixed", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "rgba(2,2,10,0.97)", backdropFilter: "blur(12px)", zIndex: 80,
        }}>
          <div style={{ fontSize: isMobile ? 14 : 18, color: "#555577", letterSpacing: 6, marginBottom: 12 }}>
            MINES PLACED ✓
          </div>
          <div style={{ fontSize: isMobile ? 28 : 44, fontWeight: 900, color: "#ffffff", letterSpacing: 4, marginBottom: 8, textAlign: "center" }}>
            PASS TO {placementTurn === 'black' ? 'ORANGE' : 'BLUE'}
          </div>
          <div style={{ fontSize: 12, color: "#555577", letterSpacing: 3, marginBottom: 40, textAlign: "center", padding: "0 24px" }}>
            Hand the device to the other player.
            <br />Don't let them see your mines!
          </div>
          <GhostButton onClick={onPassReady} color="#ff4444">I'M READY</GhostButton>
        </div>
      )}

      {/* ══ TOP BAR (during game) ════════════════════════════════════════════ */}
      {gameMode !== null && phase !== 'placement' && !showPassScreen && winner === null && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0,
          display: "flex", alignItems: "flex-start", gap: 8,
          padding: isMobile ? "10px 12px" : "16px 20px",
          background: "linear-gradient(to bottom, rgba(4,4,14,0.92) 0%, transparent 100%)",
          pointerEvents: "none", zIndex: 10, flexWrap: "nowrap", overflow: "hidden",
        }}>
          {/* Title */}
          <div style={{ ...panel, flex: "0 0 auto", padding: isMobile ? "7px 12px" : "10px 18px", pointerEvents: "auto" }}>
            <div style={{ color: "#ffffff", fontSize: isMobile ? 11 : 14, fontWeight: 800, letterSpacing: 2 }}>MINES OF OBLIVION</div>
            {!isMobile && <div style={{ color: "#333355", fontSize: 9, letterSpacing: 4, marginTop: 2 }}>{gameMode === "ai" ? "SINGLE PLAYER" : "TWO PLAYERS"}</div>}
          </div>

          {/* Turn */}
          <div style={{ ...panel, flex: "0 0 auto", padding: isMobile ? "7px 12px" : "10px 18px" }}>
            <div style={{ ...lbl, fontSize: isMobile ? 8 : 9 }}>TURN</div>
            <div style={{ ...val, color: turnColor, fontSize: isMobile ? 11 : 13 }}>{turnLabel}</div>
          </div>

          {/* Score */}
          <div style={{ ...panel, flex: "0 0 auto", padding: isMobile ? "7px 12px" : "10px 18px" }}>
            <div style={{ ...lbl, fontSize: isMobile ? 8 : 9 }}>SCORE</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ ...val, color: "#2277ff", fontSize: isMobile ? 11 : 13 }}>{scores.white}</span>
              <span style={{ color: "#333355", fontSize: isMobile ? 10 : 11 }}>:</span>
              <span style={{ ...val, color: "#ff8800", fontSize: isMobile ? 11 : 13 }}>{scores.black}</span>
            </div>
          </div>

          {/* Mines remaining */}
          {!isMobile && (
            <div style={{ ...panel, minWidth: 90 }}>
              <div style={lbl}>MINES LEFT</div>
              <div style={{ ...val, color: "#ff4444" }}>{minesRemaining}</div>
            </div>
          )}

          {/* Online status */}
          {gameMode === "online" && (
            <div style={{ ...panel, flex: "0 0 auto", padding: isMobile ? "7px 12px" : "10px 18px" }}>
              <div style={{ ...lbl, fontSize: isMobile ? 8 : 9 }}>ONLINE</div>
              <div style={{ ...val, fontSize: isMobile ? 11 : 13, color: onlineStatus === "playing" ? "#ff4444" : onlineStatus === "waiting" ? "#f5c842" : "#ff4466" }}>
                {onlineStatus === "playing" ? (myColor === "white" ? "BLUE" : "ORANGE") : onlineStatus === "waiting" ? "WAITING" : "—"}
              </div>
            </div>
          )}

          {/* Opponent name */}
          {gameMode === "online" && onlineStatus === "playing" && (() => {
            const opp = onlinePlayers.find(p => p.color !== myColor);
            return opp ? (
              <div style={{ ...panel, flex: "0 0 auto", padding: isMobile ? "7px 12px" : "10px 18px" }}>
                <div style={{ ...lbl, fontSize: isMobile ? 8 : 9 }}>OPPONENT</div>
                <div style={{ ...val, fontSize: isMobile ? 11 : 13, color: opp.color === "white" ? "#2277ff" : "#ff8800" }}>{opp.name.toUpperCase()}</div>
              </div>
            ) : null;
          })()}

          {aiThinking && (
            <div style={{ ...panel, flex: "0 0 auto", padding: isMobile ? "7px 12px" : "10px 18px" }}>
              <div className="ai-blink" style={{ color: "#ff6666", fontSize: isMobile ? 10 : 12, fontWeight: 700 }}>◈ AI...</div>
            </div>
          )}

          <div style={{ flex: 1 }} />

          {/* Mute */}
          <button onClick={onToggleMute} style={{
            flex: "0 0 auto", pointerEvents: "auto", background: "transparent",
            border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6,
            color: muted ? "#ff4466" : "#44445a",
            padding: isMobile ? "7px 10px" : "10px 14px", cursor: "pointer",
            fontFamily: "inherit", fontSize: isMobile ? 14 : 16, lineHeight: 1,
          }}>
            {muted ? "🔇" : "🔊"}
          </button>

          {/* Exit */}
          <button onClick={onChangeMode} style={{
            flex: "0 0 auto", pointerEvents: "auto", background: "transparent",
            border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6,
            color: "#44445a", padding: isMobile ? "7px 10px" : "10px 14px",
            cursor: "pointer", fontFamily: "inherit", fontSize: isMobile ? 14 : 16, lineHeight: 1,
          }}>✕</button>
        </div>
      )}

      {/* ══ POINT FLASH — floats up and fades when points scored/lost ══════ */}
      {pointFlash && phase === 'moving' && winner === null && (
        <div key={pointFlash.key} style={{
          position: "fixed", bottom: "42%", left: "50%",
          fontSize: isMobile ? 38 : 52, fontWeight: 900,
          color: pointFlash.color,
          textShadow: `0 0 28px ${pointFlash.color}99`,
          pointerEvents: "none", zIndex: 30, whiteSpace: "nowrap",
          animation: "point-rise 1.5s ease-out forwards",
          letterSpacing: 1, fontFamily: "inherit",
        }}>
          {pointFlash.text}
        </div>
      )}

      {/* ══ TREASURES indicator (bottom-left) ════════════════════════════════ */}
      {gameMode !== null && phase === 'moving' && !isMobile && winner === null && (
        <div style={{ position: "fixed", bottom: 20, left: 20, zIndex: 10, pointerEvents: "none", display: "flex", gap: 8 }}>
          {gameState.treasures.map((t, i) => (
            <div key={i} style={{
              width: 32, height: 32, borderRadius: 6,
              background: t.collected ? (t.collectedBy === 'white' ? "rgba(34,119,255,0.4)" : "rgba(255,136,0,0.4)") : "rgba(245,200,66,0.15)",
              border: `1.5px solid ${t.collected ? (t.collectedBy === 'white' ? "#2277ff" : "#ff8800") : "#f5c842"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700,
              color: t.collected ? (t.collectedBy === 'white' ? "#2277ff" : "#ff8800") : "#f5c842",
            }}>
              {t.collected ? "✓" : t.value > 0 ? `+${t.value}` : "?"}
            </div>
          ))}
          <div style={{ ...panel, padding: "7px 12px", fontSize: 10, color: "#555577", letterSpacing: 1, display: "flex", alignItems: "center" }}>
            TREASURES
          </div>
        </div>
      )}

      {/* ══ PLACEMENT PHASE OVERLAY ══════════════════════════════════════════ */}
      {gameMode !== null && phase === 'placement' && !showPassScreen && (gameMode !== 'online' || onlineStatus === 'playing') && (
        <div className="mode-fade" style={{
          position: "fixed", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "rgba(4,4,14,0.88)", backdropFilter: "blur(6px)", zIndex: 40,
          overflowY: "auto", padding: "16px 12px",
        }}>
          {/* Top bar in placement */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0,
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: isMobile ? "10px 12px" : "14px 20px",
          }}>
            <div style={{ fontSize: isMobile ? 11 : 13, fontWeight: 800, color: "#ffffff", letterSpacing: 2 }}>MINES OF OBLIVION</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onToggleMute} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: muted ? "#ff4466" : "#44445a", padding: "6px 10px", cursor: "pointer", fontFamily: "inherit", fontSize: 14 }}>{muted ? "🔇" : "🔊"}</button>
              <button onClick={onChangeMode} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: "#44445a", padding: "6px 10px", cursor: "pointer", fontFamily: "inherit", fontSize: 14 }}>✕</button>
            </div>
          </div>

          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <div style={{ fontSize: isMobile ? 10 : 12, color: "#ff4444", letterSpacing: 6, marginBottom: 4 }}>MINE PLACEMENT</div>
            {placementTurn && (
              <div style={{ fontSize: isMobile ? 16 : 22, fontWeight: 900, letterSpacing: 3, color: placementTurn === 'white' ? "#2277ff" : "#ff8800" }}>
                {gameMode === 'ai' ? 'YOUR TURN' : `${placementTurn === 'white' ? 'BLUE' : 'ORANGE'} PLAYER`}
              </div>
            )}
            {gameMode === 'online' && (
              <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 900, letterSpacing: 3, color: myColor === 'white' ? "#2277ff" : "#ff8800" }}>
                PLACE YOUR MINES
              </div>
            )}
          </div>

          <div style={{ fontSize: 11, color: "#666688", letterSpacing: 2, marginBottom: 12, textAlign: "center" }}>
            Click cells to place mines · Greyed cells are forbidden
          </div>

          {/* Mine counter */}
          {(() => {
            const confirmed = gameMode === 'online' && (myColor === 'white' ? gameState.whitePlaced : gameState.blackPlaced);
            const displayCount = confirmed ? MINE_COUNT : placingMines.length;
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <div style={{ fontSize: isMobile ? 26 : 34, fontWeight: 900, color: displayCount === MINE_COUNT ? "#44dd88" : "#ff4444" }}>
                  {displayCount}
                </div>
                <div style={{ color: "#555577", fontSize: 11 }}>/ {MINE_COUNT} mines placed</div>
                {!confirmed && (
                  <button
                    onClick={onRandomPlacement}
                    style={{ background: "transparent", border: "1px solid #44dd88", borderRadius: 5, color: "#44dd88", padding: "4px 10px", cursor: "pointer", fontFamily: "inherit", fontSize: 10, letterSpacing: 1 }}
                  >RANDOM</button>
                )}
                {!confirmed && placingMines.length > 0 && (
                  <button
                    onClick={() => onToggleMine(-1, -1)}
                    style={{ background: "transparent", border: "1px solid #444466", borderRadius: 5, color: "#444466", padding: "4px 10px", cursor: "pointer", fontFamily: "inherit", fontSize: 10, letterSpacing: 1 }}
                  >CLEAR</button>
                )}
              </div>
            );
          })()}

          {/* Placement grid (2D mini-map) */}
          <div style={{ marginBottom: 16, overflow: "auto" }}>
            <PlacementGrid mines={placingMines} onToggle={onToggleMine} isMobile={isMobile} myColor={gameMode === 'online' ? myColor : placementTurn} />
          </div>

          <div style={{ fontSize: 10, color: "#444466", letterSpacing: 2, marginBottom: 16, textAlign: "center" }}>
            You can also tap on the 3D board behind this panel
          </div>

          {/* Online: waiting for opponent to place */}
          {gameMode === 'online' && (
            (myColor === 'white' && gameState.whitePlaced && !gameState.blackPlaced) ||
            (myColor === 'black' && gameState.blackPlaced && !gameState.whitePlaced)
          ) && (
            <div style={{ color: "#f5c842", fontSize: 11, letterSpacing: 3, marginBottom: 16 }}>WAITING FOR OPPONENT TO PLACE MINES...</div>
          )}
          {gameMode === 'online' && gameState.blackPlaced && !gameState.whitePlaced && myColor === 'black' && (
            <div style={{ color: "#f5c842", fontSize: 11, letterSpacing: 3, marginBottom: 16 }}>WAITING FOR OPPONENT TO PLACE MINES...</div>
          )}

          {/* Confirm button */}
          {((gameMode !== 'online') || (gameMode === 'online' && !(myColor === 'white' ? gameState.whitePlaced : gameState.blackPlaced))) && (
            <GhostButton onClick={onConfirmPlacement} color={placingMines.length === MINE_COUNT ? "#44dd88" : "#555577"}>
              {placingMines.length === MINE_COUNT ? "CONFIRM PLACEMENT" : `PLACE ${MINE_COUNT - placingMines.length} MORE MINES`}
            </GhostButton>
          )}
          {placingMines.length === MINE_COUNT && (
            <div style={{ fontSize: 10, color: "#444466", letterSpacing: 2, marginTop: 12, textAlign: "center" }}>
              {gameMode === 'pvp' ? "Your mines will be hidden from your opponent" : ""}
            </div>
          )}
        </div>
      )}

      {/* ══ MODE SELECTION SCREEN ════════════════════════════════════════════ */}
      {gameMode === null && (
        <div className="mode-fade" style={{
          position: "fixed", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "rgba(4,4,14,0.78)", backdropFilter: "blur(6px)",
          zIndex: 60, overflowY: "auto", padding: "24px 16px",
        }}>
          <button onClick={() => { sessionStorage.removeItem('mo_session'); sessionStorage.removeItem('mo_session_v2'); window.location.href = '/'; }} style={{
            display: "inline-block", marginBottom: 20,
            color: "#aaaacc", fontSize: 10, letterSpacing: 3, textDecoration: "none",
            border: "1px solid rgba(255,255,255,0.3)", borderRadius: 5, padding: "6px 14px",
            background: "rgba(255,255,255,0.05)", cursor: "pointer", fontFamily: "inherit",
          }}>← ALL GAMES</button>

          <div style={{ marginBottom: 4, textAlign: "center" }}>
            <div style={{ fontSize: isMobile ? 24 : 38, fontWeight: 900, color: "#ffffff", letterSpacing: isMobile ? 2 : 4 }}>
              MINES OF OBLIVION
            </div>
            <div style={{ fontSize: isMobile ? 10 : 11, color: "#ff4444", letterSpacing: isMobile ? 4 : 7, marginTop: 4 }}>
              MEMORY · STRATEGY · DANGER
            </div>
          </div>

          {/* How to play trigger */}
          <button
            onClick={() => setShowRulesModal(true)}
            style={{
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.3)",
              borderRadius: 6, color: "#aaaacc", fontSize: 10, letterSpacing: 2,
              cursor: "pointer", padding: "6px 18px", fontFamily: "inherit",
              margin: "12px 0 18px",
            }}
          >? &nbsp;HOW TO PLAY</button>

          <div style={{ color: "#555577", fontSize: 10, letterSpacing: 4, marginBottom: 16 }}>CHOOSE YOUR MODE</div>

          <div style={{
            display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 12 : 16,
            alignItems: "flex-start", width: isMobile ? "90vw" : undefined, maxWidth: isMobile ? 360 : undefined,
          }}>
            {/* VS AI card */}
            <div style={{
              background: "rgba(4,4,14,0.92)", border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 12, padding: isMobile ? "18px 20px" : "24px 28px",
              textAlign: "left", width: isMobile ? "100%" : undefined, minWidth: isMobile ? undefined : 200,
            }}>
              <div style={{ color: "#ffffff", fontSize: 13, fontWeight: 800, letterSpacing: 2, marginBottom: 14, textAlign: "center" }}>VS AI</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(["easy", "medium", "hard"] as Difficulty[]).map(d => {
                  const color = d === "easy" ? "#44dd88" : d === "medium" ? "#f5c842" : "#ff4466";
                  return (
                    <button key={d} onClick={() => { track('game_started', { mode: 'ai', difficulty: d }); onSelectMode("ai", d); }} style={{
                      background: `${color}11`, border: `1.5px solid ${color}55`, color,
                      borderRadius: 7, padding: "10px 14px", cursor: "pointer", fontFamily: "inherit",
                      fontSize: 12, fontWeight: 700, letterSpacing: 2,
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      transition: "background 0.15s, border-color 0.15s",
                    }}
                      onMouseEnter={e => { e.currentTarget.style.background = `${color}28`; e.currentTarget.style.borderColor = color; }}
                      onMouseLeave={e => { e.currentTarget.style.background = `${color}11`; e.currentTarget.style.borderColor = `${color}55`; }}
                    >
                      <span style={{ textAlign: "center", width: "100%" }}>{d.toUpperCase()}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2 Players card */}
            <button className="mode-card" onClick={() => { track('game_started', { mode: 'pvp', difficulty: 'pvp' }); onSelectMode("pvp"); }} style={{
              background: "rgba(4,4,14,0.92)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 12,
              padding: isMobile ? "18px 20px" : "24px 28px", cursor: "pointer", textAlign: "left",
              width: isMobile ? "100%" : undefined, minWidth: isMobile ? undefined : 165,
              fontFamily: "inherit", transition: "border-color 0.15s", alignSelf: "stretch",
            }}>
              <div style={{ color: "#ffffff", fontSize: 13, fontWeight: 800, letterSpacing: 2, marginBottom: 12, textAlign: "center" }}>2 PLAYERS</div>
              <div style={{ color: "#666688", fontSize: 11, lineHeight: 1.8, textAlign: "center" }}>
                Pass &amp; play locally.<br />Each places mines in secret.<br />Blue vs Orange.
              </div>
            </button>

            {/* Online card */}
            <button className="mode-card" onClick={() => { track('game_started', { mode: 'online', difficulty: 'online' }); onSelectMode("online"); }} style={{
              background: "rgba(4,4,14,0.92)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 12,
              padding: isMobile ? "18px 20px" : "24px 28px", cursor: "pointer", textAlign: "left",
              width: isMobile ? "100%" : undefined, minWidth: isMobile ? undefined : 165,
              fontFamily: "inherit", transition: "border-color 0.15s", alignSelf: "stretch",
            }}>
              <div style={{ color: "#ffffff", fontSize: 13, fontWeight: 800, letterSpacing: 2, marginBottom: 12, textAlign: "center" }}>ONLINE</div>
              <div style={{ color: "#666688", fontSize: 11, lineHeight: 1.8, textAlign: "center" }}>
                Play a friend online.<br />Simultaneous mine placement.<br />Real-time multiplayer.
              </div>
            </button>
          </div>

          <button onClick={handleShare} style={{
            marginTop: 24, background: "transparent", border: "1.5px solid rgba(255,255,255,0.18)",
            color: copied ? "#ff4444" : "#666688", borderColor: copied ? "#ff4444" : "rgba(255,255,255,0.18)",
            borderRadius: 8, padding: "10px 28px", cursor: "pointer", fontFamily: "inherit",
            fontSize: 11, fontWeight: 700, letterSpacing: 3, transition: "color 0.2s, border-color 0.2s",
          }}>
            {copied ? "LINK COPIED!" : "SHARE WITH FRIENDS"}
          </button>
        </div>
      )}

      {/* ══ WIN OVERLAY ══════════════════════════════════════════════════════ */}
      {winner && <Confetti key={String(winner)} />}
      {winner && (
        <div style={{
          position: "fixed", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "rgba(4,4,14,0.85)", backdropFilter: "blur(6px)", zIndex: 50,
        }}>
          {(() => {
            const isDraw = winner === 'draw';
            const localWon = gameMode === 'online' ? winner === myColor : winner === 'white';
            const winnerName = gameMode === 'online'
              ? (onlinePlayers.find(p => p.color === winner)?.name ?? (localWon ? "YOU" : "OPPONENT"))
              : null;

            const headline = isDraw
              ? "IT'S A DRAW!"
              : gameMode === 'online'
                ? localWon ? `${winnerName} WINS!` : `${winnerName} WINS!`
                : gameMode === 'ai'
                  ? localWon ? "YOU WIN!" : "AI WINS!"
                  : `${winner === 'white' ? 'BLUE' : 'ORANGE'} WINS!`;

            const headlineColor = isDraw ? "#f5c842"
              : winner === 'white' ? "#2277ff" : "#ff8800";

            return (
              <>
                <div style={{ fontSize: isMobile ? 26 : 48, fontWeight: 900, letterSpacing: isMobile ? 1 : 2, marginBottom: 12, color: headlineColor, textAlign: "center", padding: "0 16px" }}>
                  {headline}
                </div>
                <div style={{ color: "#888899", fontSize: isMobile ? 11 : 13, letterSpacing: 2, marginBottom: 24, textAlign: "center" }}>
                  {isDraw ? "EQUAL SCORES — WHAT A GAME!" : localWon ? "CONGRATULATIONS!" : "BETTER LUCK NEXT TIME"}
                </div>

                {/* Score breakdown */}
                <div style={{ display: "flex", gap: isMobile ? 20 : 36, marginBottom: 28, flexWrap: "wrap", justifyContent: "center" }}>
                  {(['white', 'black'] as Player[]).map(p => (
                    <div key={p} style={{ textAlign: "center" }}>
                      <div style={{ ...lbl, fontSize: 9 }}>{p === 'white' ? 'BLUE' : 'ORANGE'}</div>
                      <div style={{ fontSize: isMobile ? 32 : 46, fontWeight: 900, color: p === 'white' ? "#2277ff" : "#ff8800", letterSpacing: 2 }}>
                        {gameState.scores[p]}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Treasure breakdown */}
                <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
                  {gameState.treasures.map((t, i) => (
                    <div key={i} style={{
                      ...panel, padding: "8px 14px", textAlign: "center",
                      borderColor: t.collectedBy === 'white' ? "rgba(34,119,255,0.4)" : t.collectedBy === 'black' ? "rgba(255,136,0,0.4)" : "rgba(255,255,255,0.08)",
                    }}>
                      <div style={{ fontSize: 9, color: "#555577", letterSpacing: 2 }}>#{i + 1}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#f5c842" }}>+{TREASURE_VALUES[i]}</div>
                      <div style={{ fontSize: 9, color: t.collectedBy === 'white' ? "#2277ff" : t.collectedBy === 'black' ? "#ff8800" : "#444466" }}>
                        {t.collectedBy === 'white' ? "BLUE" : t.collectedBy === 'black' ? "ORANGE" : "—"}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}

          {adBreakActive ? (
            <div style={{ color: "#555577", fontSize: 11, letterSpacing: 3, textAlign: "center", padding: "14px 0" }}>
              LOADING...
            </div>
          ) : (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
              {gameMode === "online" ? (
                <GhostButton onClick={onSendRematch} color="#f5c842">
                  {opponentWantsRematch ? "ACCEPT REMATCH" : "REMATCH"}
                </GhostButton>
              ) : (
                <GhostButton onClick={onReset}>PLAY AGAIN</GhostButton>
              )}
              <GhostButton onClick={onChangeMode} color="#555577" small>CHANGE MODE</GhostButton>
            </div>
          )}
        </div>
      )}

      {/* ══ ONLINE OVERLAYS ══════════════════════════════════════════════════ */}

      {/* Connecting */}
      {gameMode === "online" && onlineStatus === "connecting" && !winner && (
        <div className="mode-fade" style={{
          position: "fixed", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "rgba(4,4,14,0.92)", backdropFilter: "blur(6px)", zIndex: 70,
        }}>
          <div className="ai-blink" style={{ fontSize: isMobile ? 20 : 28, fontWeight: 900, color: "#ffffff", letterSpacing: 3, marginBottom: 8 }}>CONNECTING...</div>
          <div style={{ color: "#555577", fontSize: 11, letterSpacing: 3 }}>REACHING GAME SERVER</div>
          <div style={{ marginTop: 32 }}><GhostButton onClick={onChangeMode} color="#555577" small>CANCEL</GhostButton></div>
        </div>
      )}

      {/* Name entry */}
      {gameMode === "online" && onlineStatus === "name_required" && !winner && (
        <div className="mode-fade" style={{
          position: "fixed", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "rgba(4,4,14,0.9)", backdropFilter: "blur(6px)", zIndex: 55,
        }}>
          <div style={{ fontSize: isMobile ? 22 : 32, fontWeight: 900, color: "#ffffff", letterSpacing: 3, marginBottom: 8, textAlign: "center" }}>ENTER YOUR NAME</div>
          <div style={{ color: "#555577", fontSize: 11, letterSpacing: 3, marginBottom: 28, textAlign: "center" }}>SO YOUR OPPONENT KNOWS WHO THEY FACE</div>
          <form onSubmit={e => { e.preventDefault(); const n = playerName.trim() || "Anonymous"; localStorage.setItem("mo_name", n); onSubmitName(n); }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <input autoFocus value={playerName} onChange={e => setPlayerName(e.target.value)}
              placeholder="Anonymous" maxLength={20}
              style={{ background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,68,68,0.4)", borderRadius: 8, color: "#ffffff", fontFamily: "inherit", fontSize: isMobile ? 16 : 20, fontWeight: 700, letterSpacing: 3, padding: "12px 24px", textAlign: "center", outline: "none", width: isMobile ? "75vw" : 280 }}
            />
            <GhostButton onClick={() => { const n = playerName.trim() || "Anonymous"; localStorage.setItem("mo_name", n); onSubmitName(n); }} color="#ff4444">JOIN</GhostButton>
            <button type="button" onClick={onChangeMode} style={{ background: "transparent", border: "none", color: "#444466", cursor: "pointer", fontFamily: "inherit", fontSize: 10, letterSpacing: 2, marginTop: 4 }}>CANCEL</button>
          </form>
        </div>
      )}

      {/* Waiting for opponent */}
      {gameMode === "online" && onlineStatus === "waiting" && !winner && (
        <div className="mode-fade" style={{
          position: "fixed", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "rgba(4,4,14,0.82)", backdropFilter: "blur(6px)", zIndex: 50,
        }}>
          <div style={{ fontSize: isMobile ? 20 : 30, fontWeight: 900, color: "#ffffff", letterSpacing: 3, marginBottom: 8 }}>WAITING FOR OPPONENT</div>
          <div style={{ color: "#555577", fontSize: 11, letterSpacing: 3, marginBottom: 32 }}>SHARE THIS LINK TO INVITE</div>
          {onlineRoomId && (() => {
            const link = `${typeof window !== "undefined" ? window.location.origin : ""}${typeof window !== "undefined" ? window.location.pathname : ""}?r=${onlineRoomId}`;
            return (
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "12px 20px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12, maxWidth: isMobile ? "85vw" : 420, width: "100%" }}>
                <span style={{ color: "#ff4444", fontSize: isMobile ? 11 : 13, fontWeight: 700, letterSpacing: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{link}</span>
                <button onClick={async () => {
                  const sd = { title: "Mines of Oblivion — Challenge", text: "Play Mines of Oblivion with me!", url: link };
                  if (typeof navigator.share === "function" && navigator.canShare?.(sd)) { await navigator.share(sd).catch(() => {}); }
                  else { navigator.clipboard.writeText(link).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); }
                }} style={{ background: copied ? "#ff444422" : "transparent", border: `1px solid ${copied ? "#ff4444" : "rgba(255,255,255,0.2)"}`, color: copied ? "#ff4444" : "#888899", borderRadius: 5, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700, letterSpacing: 2, whiteSpace: "nowrap" }}>
                  {copied ? "COPIED!" : "SHARE"}
                </button>
              </div>
            );
          })()}
          <div style={{ color: "#444466", fontSize: 10, letterSpacing: 2, marginBottom: 24 }}>ROOM CODE: <span style={{ color: "#666688" }}>{onlineRoomId}</span></div>

          {/* Hints toggle — host only */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "12px 20px", width: isMobile ? "85vw" : 380, maxWidth: 420 }}>
            <div>
              <div style={{ color: "#aaaacc", fontSize: 11, fontWeight: 700, letterSpacing: 2, marginBottom: 2 }}>SHOW HINTS</div>
              <div style={{ color: "#444466", fontSize: 10, letterSpacing: 1 }}>Adjacency numbers &amp; mine overlays</div>
            </div>
            <button
              onClick={() => onSendSetHints(!gameState.hints)}
              style={{
                marginLeft: "auto", flexShrink: 0,
                width: 48, height: 26, borderRadius: 13, border: "none", cursor: "pointer",
                background: gameState.hints ? "#22aa44" : "#333344",
                position: "relative", transition: "background 0.2s",
              }}
            >
              <span style={{
                position: "absolute", top: 3, left: gameState.hints ? 24 : 3,
                width: 20, height: 20, borderRadius: "50%", background: "#ffffff",
                transition: "left 0.2s", display: "block",
              }} />
            </button>
          </div>

          <GhostButton onClick={onChangeMode} color="#555577" small>CANCEL</GhostButton>
        </div>
      )}

      {/* Room full */}
      {gameMode === "online" && onlineStatus === "room_full" && !winner && (
        <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(4,4,14,0.88)", backdropFilter: "blur(6px)", zIndex: 55 }}>
          <div style={{ fontSize: isMobile ? 22 : 36, fontWeight: 900, color: "#ff4466", letterSpacing: 2, marginBottom: 12, textAlign: "center" }}>ROOM IS FULL</div>
          <div style={{ color: "#666688", fontSize: 13, letterSpacing: 2, marginBottom: 32, textAlign: "center" }}>This game already has two players.</div>
          <GhostButton onClick={onChangeMode} color="#555577" small>BACK TO MENU</GhostButton>
        </div>
      )}

      {/* Opponent disconnected */}
      {gameMode === "online" && onlineStatus === "opponent_left" && !winner && (
        <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(4,4,14,0.82)", backdropFilter: "blur(6px)", zIndex: 50 }}>
          <div style={{ fontSize: isMobile ? 22 : 36, fontWeight: 900, color: "#ff4466", letterSpacing: 2, marginBottom: 12, textAlign: "center" }}>OPPONENT DISCONNECTED</div>
          <div style={{ color: "#666688", fontSize: 13, letterSpacing: 2, marginBottom: 32 }}>They left the game.</div>
          <GhostButton onClick={onChangeMode} color="#555577" small>BACK TO MENU</GhostButton>
        </div>
      )}
    </>
  );
}
