"use client";

import {
  GameState,
  GameMode,
  Difficulty,
  Player,
  canLJump,
  getTerrain,
  rowLabel,
  colLabel,
} from "@/lib/gameLogic";
import { track } from "@vercel/analytics";
import { CSSProperties, useState, useEffect, useRef } from "react";

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

    const colors = [
      "#00ffcc",
      "#f5c842",
      "#ff4466",
      "#4488ff",
      "#aa44ff",
      "#ffffff",
      "#ffaa00",
    ];
    const pieces = Array.from({ length: 140 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.4 - canvas.height * 0.2,
      w: Math.random() * 11 + 5,
      h: Math.random() * 5 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      vy: Math.random() * 3.5 + 1.5,
      vx: (Math.random() - 0.5) * 1.8,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.15,
      opacity: 1,
    }));

    const start = Date.now();
    let raf: number;
    const draw = () => {
      const elapsed = Date.now() - start;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach((p) => {
        p.y += p.vy;
        p.x += p.vx;
        p.rot += p.rotSpeed;
        if (p.y > canvas.height) {
          p.y = -20;
          p.x = Math.random() * canvas.width;
        }
        p.opacity =
          elapsed > 3200 ? Math.max(0, 1 - (elapsed - 3200) / 1200) : 1;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (elapsed < 4400) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 55 }}
    />
  );
}

// ─── Shared panel styles ──────────────────────────────────────────────────────
const panel: CSSProperties = {
  background: "rgba(4,4,14,0.75)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 10,
  padding: "10px 18px",
  backdropFilter: "blur(10px)",
};

const lbl: CSSProperties = {
  color: "#44445a",
  fontSize: 9,
  letterSpacing: "2.5px",
  textTransform: "uppercase",
  marginBottom: 4,
};

const val: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: "1px",
};

// ─── Reusable ghost button ────────────────────────────────────────────────────
function GhostButton({
  children,
  onClick,
  color = "#00ffcc",
  small = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  color?: string;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "transparent",
        border: `1.5px solid ${color}`,
        color,
        padding: small ? "8px 22px" : "14px 44px",
        fontSize: small ? 11 : 13,
        fontWeight: 700,
        letterSpacing: small ? 2 : 4,
        cursor: "pointer",
        borderRadius: 4,
        fontFamily: "inherit",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLButtonElement).style.background = `${color}18`)
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLButtonElement).style.background =
          "transparent")
      }
    >
      {children}
    </button>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface HUDProps {
  gameState: GameState;
  gameMode: GameMode | null;
  aiThinking: boolean;
  difficulty: Difficulty;
  winner: Player | null;
  streak: number;
  bestStreak: number;
  onReset: () => void;
  onChangeMode: () => void;
  onSelectMode: (mode: GameMode, diff?: Difficulty) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function HUD({
  gameState,
  gameMode,
  aiThinking,
  difficulty,
  winner,
  streak,
  bestStreak,
  onReset,
  onChangeMode,
  onSelectMode,
}: HUDProps) {
  const { currentTurn, selectedCell } = gameState;

  const terrainLabel = selectedCell
    ? getTerrain(selectedCell[0], selectedCell[1]).toUpperCase()
    : "—";

  const hasSel = selectedCell !== null;
  const jumpAllowed = hasSel && canLJump(selectedCell![0], selectedCell![1]);

  const abilityText = hasSel
    ? jumpAllowed
      ? "L-JUMP  +  SLIDE"
      : "SLIDE ONLY"
    : aiThinking
      ? "PROCESSING..."
      : "SELECT A PIECE";

  const abilityColor = hasSel
    ? jumpAllowed
      ? "#f5c842"
      : "#70c0ff"
    : aiThinking
      ? "#ff6666"
      : "#444466";

  const coordLabel = selectedCell
    ? `${rowLabel(selectedCell[0])}${colLabel(selectedCell[1])}`
    : "—";

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Player name (persisted) ───────────────────────────────────────────────
  const [playerName, setPlayerName] = useState('');
  useEffect(() => {
    setPlayerName(localStorage.getItem('rh_name') || '');
  }, []);

  // ── Challenge banner (loaded from URL ?c=TOKEN) ───────────────────────────
  const [challengeData, setChallengeData] = useState<{
    name: string; moves: number; difficulty: string; mode: string;
  } | null>(null);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('c');
    if (!token) return;
    setChallengeToken(token);
    fetch(`/api/challenge?t=${token}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setChallengeData(d))
      .catch(() => {});
  }, []);

  // ── Share / challenge link ────────────────────────────────────────────────
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  const handleShare = async (context: 'home' | 'win' = 'home') => {
    if (sharing) return;
    setSharing(true);

    try {
      let shareUrl = window.location.origin + '/';
      const isWin = context === 'win';

      // For win shares, create a server-issued challenge token
      if (isWin) {
        const name = playerName.trim() || 'Anonymous';
        localStorage.setItem('rh_name', name);
        try {
          const res = await fetch('/api/challenge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, moves: gameState.moveCount, difficulty, mode: gameMode }),
          });
          if (res.ok) {
            const { token } = await res.json();
            shareUrl = `${window.location.origin}/?c=${token}`;
          }
        } catch { /* fall through, share without token */ }
      }

      const streakSuffix = gameMode === 'ai' && streak > 1 ? ` ${streak}-game streak 🔥` : '';
      const text = isWin
        ? gameMode === 'ai'
          ? `I beat the AI on ${difficulty.toUpperCase()} in ${gameState.moveCount} moves!${streakSuffix} Think you can beat me? 🏆\n${shareUrl}`
          : `I claimed the Oasis in ${gameState.moveCount} moves! Think you can beat me? 🏆\n${shareUrl}`
        : `Race your horses to the Oasis — play Run Horses! 3D\n${shareUrl}`;

      let shareData: ShareData = { title: 'Run Horses!', text, url: shareUrl };

      // Attach canvas screenshot for win shares
      if (isWin) {
        try {
          const canvas = document.querySelector('canvas');
          if (canvas) {
            const blob = await new Promise<Blob | null>(resolve =>
              (canvas as HTMLCanvasElement).toBlob(resolve, 'image/png')
            );
            if (blob) {
              const file = new File([blob], 'run-horses-win.png', { type: 'image/png' });
              const withFile = { ...shareData, files: [file] };
              if (navigator.canShare?.(withFile)) shareData = withFile;
            }
          }
        } catch { /* fall through */ }
      }

      const method = (typeof navigator.share === 'function' && navigator.canShare?.(shareData)) ? 'native' : 'clipboard';
      track('share_clicked', { method, context });
      if (typeof navigator.share === 'function' && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } finally {
      setSharing(false);
    }
  };

  // Human-readable turn label
  const isAITurn = gameMode === "ai" && currentTurn === "black";
  const turnLabel =
    gameMode === "ai"
      ? currentTurn === "white"
        ? "○ YOU (BLUE)"
        : "● AI (ORANGE)"
      : currentTurn === "white"
        ? "○ BLUE"
        : "● ORANGE";
  const turnColor = currentTurn === "white" ? "#2277ff" : "#ff8800";

  return (
    <>
      {/* ── Keyframe animations injected once ───────────────────────────── */}
      <style>{`
        @keyframes ai-pulse  { 0%,100%{opacity:1} 50%{opacity:0.25} }
        @keyframes mode-fade { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .ai-blink  { animation: ai-pulse 0.9s ease-in-out infinite; }
        .mode-fade { animation: mode-fade 0.35s ease both; }
        .mode-card:hover { background: rgba(255,255,255,0.04) !important; border-color: rgba(255,255,255,0.2) !important; }
      `}</style>

      {/* ── Top HUD bar ─────────────────────────────────────────────────── */}
      {gameMode !== null && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            padding: isMobile ? "10px 12px" : "16px 20px",
            background:
              "linear-gradient(to bottom, rgba(4,4,14,0.92) 0%, transparent 100%)",
            pointerEvents: "none",
            zIndex: 10,
            flexWrap: "nowrap",
            overflow: "hidden",
          }}
        >
          {/* Title */}
          <div
            style={{
              ...panel,
              flex: "0 0 auto",
              padding: isMobile ? "7px 12px" : "10px 18px",
            }}
          >
            <div
              style={{
                color: "#ffffff",
                fontSize: isMobile ? 12 : 15,
                fontWeight: 800,
                letterSpacing: 2,
              }}
            >
              RUN HORSES!
            </div>
            {!isMobile && (
              <div
                style={{
                  color: "#333355",
                  fontSize: 9,
                  letterSpacing: 4,
                  marginTop: 2,
                }}
              >
                {gameMode === "ai" ? "SINGLE PLAYER" : "TWO PLAYERS"}
              </div>
            )}
          </div>

          {/* Turn */}
          <div
            style={{
              ...panel,
              flex: "0 0 auto",
              padding: isMobile ? "7px 12px" : "10px 18px",
            }}
          >
            <div style={{ ...lbl, fontSize: isMobile ? 8 : 9 }}>TURN</div>
            <div
              style={{ ...val, color: turnColor, fontSize: isMobile ? 11 : 13 }}
            >
              {turnLabel}
            </div>
          </div>

          {/* Ability / AI thinking — hidden on mobile */}
          {!isMobile && (
            <div style={{ ...panel, minWidth: 185 }}>
              <div style={lbl}>ABILITY STATUS</div>
              {aiThinking ? (
                <div className="ai-blink" style={{ ...val, color: "#ff6666" }}>
                  ◈ AI THINKING...
                </div>
              ) : (
                <div style={{ ...val, color: abilityColor }}>{abilityText}</div>
              )}
            </div>
          )}

          {/* Selected coord — hidden on mobile */}
          {!isMobile && (
            <div style={{ ...panel, minWidth: 110 }}>
              <div style={lbl}>SELECTED</div>
              <div style={{ ...val, color: "#cccccc" }}>
                {coordLabel}{" "}
                <span style={{ fontWeight: 400, color: "#44445a" }}>
                  {terrainLabel}
                </span>
              </div>
            </div>
          )}

          {/* Move count — hidden on mobile */}
          {!isMobile && (
            <div style={{ ...panel, minWidth: 80 }}>
              <div style={lbl}>MOVES</div>
              <div style={{ ...val, color: "#00ffcc" }}>
                {gameState.moveCount || "—"}
              </div>
            </div>
          )}

          {/* Difficulty */}
          {gameMode === "ai" && (
            <div
              style={{
                ...panel,
                flex: "0 0 auto",
                padding: isMobile ? "7px 12px" : "10px 18px",
              }}
            >
              <div style={{ ...lbl, fontSize: isMobile ? 8 : 9 }}>DIFF</div>
              <div
                style={{
                  ...val,
                  fontSize: isMobile ? 11 : 13,
                  color:
                    difficulty === "easy"
                      ? "#44dd88"
                      : difficulty === "medium"
                        ? "#f5c842"
                        : difficulty === "hard"
                          ? "#ff4466"
                          : "#cc00ff",
                }}
              >
                {difficulty.toUpperCase()}
              </div>
            </div>
          )}

          {/* AI thinking indicator on mobile */}
          {isMobile && aiThinking && (
            <div style={{ ...panel, flex: "0 0 auto", padding: "7px 12px" }}>
              <div
                className="ai-blink"
                style={{ color: "#ff6666", fontSize: 11, fontWeight: 700 }}
              >
                ◈ AI...
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Legend — hidden on mobile ────────────────────────────────────── */}
      {gameMode !== null && !isMobile && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            left: 20,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          {[
            { color: "#c9932c", text: "Desert — L-Jump + Slide" },
            { color: "#1d6b34", text: "Garden — Slide Only" },
            { color: "#00ffcc", text: "Oasis  — GOAL (f6)" },
          ].map(({ color, text }) => (
            <div
              key={text}
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  background: color,
                  boxShadow:
                    color === "#00ffcc" ? `0 0 8px ${color}` : undefined,
                }}
              />
              <span
                style={{ color: "#55556a", fontSize: 10, letterSpacing: "1px" }}
              >
                {text}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Controls hint — hidden on mobile ────────────────────────────── */}
      {gameMode !== null && !isAITurn && !isMobile && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            right: 20,
            pointerEvents: "none",
            zIndex: 10,
            textAlign: "right",
          }}
        >
          <div
            style={{
              color: "#33334a",
              fontSize: 10,
              letterSpacing: "1px",
              lineHeight: 1.8,
            }}
          >
            Tap piece → select
            <br />
            Tap highlighted tile → move
            <br />
            Drag → orbit camera
          </div>
        </div>
      )}

      {/* ── AI thinking overlay (subtle) ─────────────────────────────────── */}
      {aiThinking && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            right: 20,
            pointerEvents: "none",
            zIndex: 10,
            textAlign: "right",
          }}
        >
          <div
            className="ai-blink"
            style={{ color: "#ff6666", fontSize: 11, letterSpacing: "2px" }}
          >
            ◈ OPPONENT CALCULATING
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MODE SELECTION SCREEN  (shown when gameMode is null)
      ═════════════════════════════════════════════════════════════════════ */}
      {gameMode === null && (
        <div
          className="mode-fade"
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(4,4,14,0.78)",
            backdropFilter: "blur(6px)",
            zIndex: 60,
            overflowY: "auto",
            padding: "24px 16px",
          }}
        >
          {/* Logo */}
          <div style={{ marginBottom: 4, textAlign: "center" }}>
            <div
              style={{
                fontSize: isMobile ? 28 : 44,
                fontWeight: 900,
                color: "#ffffff",
                letterSpacing: isMobile ? 3 : 6,
              }}
            >
              RUN HORSES!
            </div>
            <div
              style={{
                fontSize: isMobile ? 10 : 11,
                color: "#00ffcc",
                letterSpacing: isMobile ? 4 : 8,
                marginTop: 4,
              }}
            >
              TACTICAL BOARD GAME
            </div>
          </div>

          {/* ── How to play ──────────────────────────────────────────────── */}
          <div
            style={{
              margin: isMobile ? "18px 0 20px" : "22px 0 24px",
              background: "rgba(4,4,14,0.88)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10,
              padding: isMobile ? "14px 18px" : "16px 28px",
              width: isMobile ? "90vw" : undefined,
              maxWidth: 560,
            }}
          >
            <div
              style={{
                color: "#555577",
                fontSize: 9,
                letterSpacing: 4,
                marginBottom: 12,
                textTransform: "uppercase",
              }}
            >
              How to Play
            </div>
            {[
              {
                label: "SLIDE",
                color: "#70c0ff",
                desc: "Pieces glide horizontally or vertically to the last open cell in that direction.",
              },
              {
                label: "L-JUMP",
                color: "#f5c842",
                desc: "On desert (brown) tiles only — jump in an L-shape to any other desert tile.",
              },
              {
                label: "GOAL",
                color: "#00ffcc",
                desc: "First player to land a piece on the glowing Oasis wins.",
              },
            ].map(({ label, color, desc }) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                  marginBottom: 10,
                }}
              >
                <span
                  style={{
                    color,
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: 2,
                    whiteSpace: "nowrap",
                    paddingTop: 1,
                    minWidth: 56,
                  }}
                >
                  {label}
                </span>
                <span
                  style={{ color: "#8888aa", fontSize: 11, lineHeight: 1.6 }}
                >
                  {desc}
                </span>
              </div>
            ))}
          </div>

          {/* ── Mode cards ───────────────────────────────────────────────── */}
          <div
            style={{
              color: "#555577",
              fontSize: 10,
              letterSpacing: 4,
              marginBottom: 16,
            }}
          >
            CHOOSE YOUR MODE
          </div>

          {/* ── Challenge banner ─────────────────────────────────────────── */}
          {challengeData && (
            <div style={{
              background: "rgba(245,200,66,0.08)",
              border: "1.5px solid rgba(245,200,66,0.4)",
              borderRadius: 10,
              padding: isMobile ? "12px 16px" : "14px 24px",
              marginBottom: 20,
              textAlign: "center",
              maxWidth: 420,
              width: isMobile ? "90vw" : undefined,
            }}>
              <div style={{ color: "#f5c842", fontSize: isMobile ? 11 : 12, fontWeight: 800, letterSpacing: 3, marginBottom: 6 }}>
                🏆 YOU WERE CHALLENGED
              </div>
              <div style={{ color: "#cccccc", fontSize: isMobile ? 13 : 15, fontWeight: 700, marginBottom: 4 }}>
                {challengeData.name} beat {challengeData.mode === 'ai' ? `${challengeData.difficulty.toUpperCase()} AI` : 'a friend'} in{' '}
                <span style={{ color: "#00ffcc" }}>{challengeData.moves} moves</span>
              </div>
              <div style={{ color: "#666688", fontSize: 11 }}>
                Can you do it in fewer?
              </div>
            </div>
          )}

          <div
            style={{
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              gap: isMobile ? 12 : 16,
              alignItems: "flex-start",
              width: isMobile ? "90vw" : undefined,
              maxWidth: isMobile ? 360 : undefined,
            }}
          >
            {/* Single Player card */}
            <div
              style={{
                background: "rgba(4,4,14,0.92)",
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: 12,
                padding: isMobile ? "18px 20px" : "24px 28px",
                textAlign: "left",
                width: isMobile ? "100%" : undefined,
                minWidth: isMobile ? undefined : 210,
              }}
            >
              <div
                style={{
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: 2,
                  marginBottom: 14,
                  textAlign: "center",
                }}
              >
                VS AI
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(["easy", "medium", "hard", "impossible"] as Difficulty[]).map((d) => {
                  const color =
                    d === "easy"
                      ? "#44dd88"
                      : d === "medium"
                        ? "#f5c842"
                        : d === "hard"
                          ? "#ff4466"
                          : "#cc00ff";
                  return (
                    <button
                      key={d}
                      onClick={() => onSelectMode("ai", d)}
                      style={{
                        background: `${color}11`,
                        border: `1.5px solid ${color}55`,
                        color,
                        borderRadius: 7,
                        padding: "10px 14px",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: 2,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        transition: "background 0.15s, border-color 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        (
                          e.currentTarget as HTMLButtonElement
                        ).style.background = `${color}28`;
                        (
                          e.currentTarget as HTMLButtonElement
                        ).style.borderColor = color;
                      }}
                      onMouseLeave={(e) => {
                        (
                          e.currentTarget as HTMLButtonElement
                        ).style.background = `${color}11`;
                        (
                          e.currentTarget as HTMLButtonElement
                        ).style.borderColor = `${color}55`;
                      }}
                    >
                      <span style={{ textAlign: "center", width: "100%" }}>
                        {d.toUpperCase()}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Two Players card */}
            <button
              className="mode-card"
              onClick={() => onSelectMode("pvp")}
              style={{
                background: "rgba(4,4,14,0.92)",
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: 12,
                padding: isMobile ? "18px 20px" : "24px 28px",
                cursor: "pointer",
                textAlign: "left",
                width: isMobile ? "100%" : undefined,
                minWidth: isMobile ? undefined : 170,
                fontFamily: "inherit",
                transition: "border-color 0.15s",
                alignSelf: "stretch",
              }}
            >
              <div
                style={{
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: 2,
                  marginBottom: 12,
                  textAlign: "center",
                }}
              >
                2 PLAYERS
              </div>
              <div
                style={{
                  color: "#666688",
                  fontSize: 11,
                  lineHeight: 1.8,
                  textAlign: "center",
                }}
              >
                Pass &amp; play locally.
                <br />
                White vs Black.
                <br />
                First to Oasis wins.
              </div>
            </button>
          </div>

          {/* Share */}
          <button
            onClick={() => handleShare('home')}
            style={{
              marginTop: 24,
              background: "transparent",
              border: "1.5px solid rgba(255,255,255,0.18)",
              color: copied ? "#00ffcc" : "#666688",
              borderColor: copied ? "#00ffcc" : "rgba(255,255,255,0.18)",
              borderRadius: 8,
              padding: "10px 28px",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 3,
              transition: "color 0.2s, border-color 0.2s",
            }}
          >
            {copied ? "LINK COPIED!" : "SHARE WITH FRIENDS"}
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          WIN OVERLAY
      ═════════════════════════════════════════════════════════════════════ */}
      {winner && <Confetti key={winner} />}

      {winner && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(4,4,14,0.82)",
            zIndex: 50,
            backdropFilter: "blur(6px)",
          }}
        >
          {/* ── Win / lose headline ──────────────────────────────────────── */}
          {(() => {
            const playerWon = winner === "white";
            const isChallenge = !!challengeData;
            const beatChallenge = isChallenge && playerWon && gameState.moveCount < challengeData!.moves;
            const tiedChallenge = isChallenge && playerWon && gameState.moveCount === challengeData!.moves;

            const headline = isChallenge
              ? playerWon
                ? beatChallenge
                  ? `You beat ${challengeData!.name}! 🎉`
                  : tiedChallenge
                    ? `Tied with ${challengeData!.name}!`
                    : `${challengeData!.name}'s score stands`
                : `${challengeData!.name}'s challenge stands`
              : gameMode === "ai"
                ? playerWon ? "YOU claimed the Oasis!" : "AI claimed the Oasis!"
                : `${playerWon ? "BLUE" : "ORANGE"} claimed the Oasis!`;

            const subline = isChallenge
              ? playerWon
                ? beatChallenge
                  ? `${challengeData!.name}: ${challengeData!.moves} moves  →  You: ${gameState.moveCount} moves`
                  : tiedChallenge
                    ? `Both finished in ${gameState.moveCount} moves`
                    : `${challengeData!.name}: ${challengeData!.moves} moves  —  You: ${gameState.moveCount} moves`
                : `${challengeData!.name} set ${challengeData!.moves} moves. Try again!`
              : playerWon ? "CONGRATS! YOU WON!" : "BETTER LUCK NEXT TIME";

            const headlineColor = isChallenge
              ? beatChallenge ? "#00ffcc" : tiedChallenge ? "#f5c842" : "#ff6666"
              : playerWon ? "#2277ff" : "#ff8800";

            return (
              <>
                <div style={{
                  fontSize: isMobile ? 24 : 46,
                  fontWeight: 900,
                  letterSpacing: isMobile ? 1 : 2,
                  marginBottom: 12,
                  color: headlineColor,
                  textShadow: "0 0 60px rgba(0,255,200,0.5)",
                  textAlign: "center",
                  padding: "0 16px",
                }}>
                  {headline}
                </div>
                <div style={{
                  color: "#888899",
                  fontSize: isMobile ? 12 : 15,
                  letterSpacing: 2,
                  marginBottom: 28,
                  textAlign: "center",
                }}>
                  {subline}
                </div>
              </>
            );
          })()}

          {/* ── Stats row ────────────────────────────────────────────────── */}
          {winner === "white" && (
            <div style={{ display: "flex", gap: isMobile ? 16 : 28, marginBottom: 28, flexWrap: "wrap", justifyContent: "center" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ ...lbl, fontSize: 9 }}>MOVES TAKEN</div>
                <div style={{ fontSize: isMobile ? 28 : 40, fontWeight: 900, color: "#00ffcc", letterSpacing: 2 }}>
                  {gameState.moveCount}
                </div>
              </div>
              {gameMode === "ai" && streak > 0 && (
                <div style={{ textAlign: "center" }}>
                  <div style={{ ...lbl, fontSize: 9 }}>WIN STREAK</div>
                  <div style={{ fontSize: isMobile ? 28 : 40, fontWeight: 900, color: "#f5c842", letterSpacing: 2 }}>
                    {streak}🔥
                  </div>
                </div>
              )}
              {gameMode === "ai" && bestStreak > 1 && (
                <div style={{ textAlign: "center" }}>
                  <div style={{ ...lbl, fontSize: 9 }}>BEST</div>
                  <div style={{ fontSize: isMobile ? 20 : 28, fontWeight: 700, color: "#888899", letterSpacing: 2 }}>
                    {bestStreak}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Name input (only show when player won) ───────────────────── */}
          {winner === "white" && (
            <div style={{ marginBottom: 20, textAlign: "center" }}>
              <div style={{ ...lbl, fontSize: 9, marginBottom: 8 }}>YOUR NAME</div>
              <input
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                placeholder="Anonymous"
                maxLength={20}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 6,
                  color: "#ffffff",
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: 2,
                  padding: "8px 16px",
                  textAlign: "center",
                  outline: "none",
                  width: isMobile ? "70vw" : 220,
                }}
              />
            </div>
          )}

          {/* ── Buttons ──────────────────────────────────────────────────── */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            <GhostButton onClick={onReset}>
              {winner === "white" ? "PLAY AGAIN" : "TRY AGAIN"}
            </GhostButton>
            {winner === "white" && (
              <GhostButton onClick={() => handleShare('win')} color="#aa44ff" small>
                {sharing ? "..." : copied ? "COPIED!" : challengeData ? `COUNTER-CHALLENGE ${challengeData.name.toUpperCase()}` : "CHALLENGE FRIENDS"}
              </GhostButton>
            )}
            <GhostButton onClick={onChangeMode} color="#555577" small>
              CHANGE MODE
            </GhostButton>
          </div>
        </div>
      )}
    </>
  );
}
