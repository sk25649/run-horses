'use client';

import { GameState, GameMode, Difficulty, canLJump, getTerrain, rowLabel, colLabel } from '@/lib/gameLogic';
import { CSSProperties } from 'react';

// ─── Shared panel styles ──────────────────────────────────────────────────────
const panel: CSSProperties = {
  background: 'rgba(4,4,14,0.75)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
  padding: '10px 18px',
  backdropFilter: 'blur(10px)',
};

const lbl: CSSProperties = {
  color: '#44445a',
  fontSize: 9,
  letterSpacing: '2.5px',
  textTransform: 'uppercase',
  marginBottom: 4,
};

const val: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '1px',
};

// ─── Reusable ghost button ────────────────────────────────────────────────────
function GhostButton({
  children,
  onClick,
  color = '#00ffcc',
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
        background: 'transparent',
        border: `1.5px solid ${color}`,
        color,
        padding: small ? '8px 22px' : '14px 44px',
        fontSize: small ? 11 : 13,
        fontWeight: 700,
        letterSpacing: small ? 2 : 4,
        cursor: 'pointer',
        borderRadius: 4,
        fontFamily: 'inherit',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = `${color}18`)}
      onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
    >
      {children}
    </button>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface HUDProps {
  gameState:    GameState;
  gameMode:     GameMode | null;
  aiThinking:   boolean;
  difficulty:   Difficulty;
  onReset:      () => void;
  onChangeMode: () => void;
  onSelectMode: (mode: GameMode, diff?: Difficulty) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function HUD({
  gameState,
  gameMode,
  aiThinking,
  difficulty,
  onReset,
  onChangeMode,
  onSelectMode,
}: HUDProps) {
  const { currentTurn, selectedCell, winner } = gameState;

  const terrainLabel = selectedCell
    ? getTerrain(selectedCell[0], selectedCell[1]).toUpperCase()
    : '—';

  const hasSel      = selectedCell !== null;
  const jumpAllowed = hasSel && canLJump(selectedCell![0], selectedCell![1]);

  const abilityText = hasSel
    ? jumpAllowed ? 'L-JUMP  +  SLIDE' : 'SLIDE ONLY'
    : aiThinking ? 'PROCESSING...' : 'SELECT A PIECE';

  const abilityColor = hasSel
    ? jumpAllowed ? '#f5c842' : '#70c0ff'
    : aiThinking ? '#ff6666' : '#444466';

  const coordLabel = selectedCell
    ? `${rowLabel(selectedCell[0])}${colLabel(selectedCell[1])}`
    : '—';

  // Human-readable turn label
  const isAITurn = gameMode === 'ai' && currentTurn === 'black';
  const turnLabel = gameMode === 'ai'
    ? currentTurn === 'white' ? '○ YOU (WHITE)' : '● AI (BLACK)'
    : currentTurn === 'white' ? '○ WHITE' : '● BLACK';
  const turnColor = currentTurn === 'white' ? '#e8e8e8' : '#8888aa';

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
            position: 'fixed', top: 0, left: 0, right: 0,
            display: 'flex', alignItems: 'flex-start', gap: 12,
            padding: '16px 20px',
            background: 'linear-gradient(to bottom, rgba(4,4,14,0.92) 0%, transparent 100%)',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          {/* Title */}
          <div style={{ ...panel, flex: '0 0 auto' }}>
            <div style={{ color: '#ffffff', fontSize: 15, fontWeight: 800, letterSpacing: 3 }}>
              RUN HORSES!
            </div>
            <div style={{ color: '#333355', fontSize: 9, letterSpacing: 4, marginTop: 2 }}>
              {gameMode === 'ai' ? 'SINGLE PLAYER' : 'TWO PLAYERS'}
            </div>
          </div>

          {/* Turn */}
          <div style={{ ...panel, minWidth: 150 }}>
            <div style={lbl}>CURRENT TURN</div>
            <div style={{ ...val, color: turnColor }}>{turnLabel}</div>
          </div>

          {/* Ability / AI thinking */}
          <div style={{ ...panel, minWidth: 185 }}>
            <div style={lbl}>ABILITY STATUS</div>
            {aiThinking ? (
              <div className="ai-blink" style={{ ...val, color: '#ff6666' }}>
                ◈ AI THINKING...
              </div>
            ) : (
              <div style={{ ...val, color: abilityColor }}>{abilityText}</div>
            )}
          </div>

          {/* Selected coord */}
          <div style={{ ...panel, minWidth: 110 }}>
            <div style={lbl}>SELECTED</div>
            <div style={{ ...val, color: '#cccccc' }}>
              {coordLabel}{' '}
              <span style={{ fontWeight: 400, color: '#44445a' }}>{terrainLabel}</span>
            </div>
          </div>

          {/* Move count */}
          <div style={{ ...panel, minWidth: 80 }}>
            <div style={lbl}>MOVES</div>
            <div style={{ ...val, color: '#00ffcc' }}>
              {gameState.validMoves.length || '—'}
            </div>
          </div>

          {/* Difficulty (AI mode only) */}
          {gameMode === 'ai' && (
            <div style={{ ...panel, minWidth: 100 }}>
              <div style={lbl}>DIFFICULTY</div>
              <div style={{
                ...val,
                color: difficulty === 'easy' ? '#44dd88' : difficulty === 'medium' ? '#f5c842' : '#ff4466',
              }}>
                {difficulty.toUpperCase()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Legend ──────────────────────────────────────────────────────── */}
      {gameMode !== null && (
        <div
          style={{
            position: 'fixed', bottom: 20, left: 20,
            display: 'flex', flexDirection: 'column', gap: 6,
            pointerEvents: 'none', zIndex: 10,
          }}
        >
          {[
            { color: '#c9932c', text: 'Desert — L-Jump + Slide' },
            { color: '#1d6b34', text: 'Garden — Slide Only' },
            { color: '#00ffcc', text: 'Oasis  — GOAL (f6)' },
          ].map(({ color, text }) => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 12, height: 12, borderRadius: 3, background: color,
                  boxShadow: color === '#00ffcc' ? `0 0 8px ${color}` : undefined,
                }}
              />
              <span style={{ color: '#55556a', fontSize: 10, letterSpacing: '1px' }}>{text}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Controls hint ───────────────────────────────────────────────── */}
      {gameMode !== null && !isAITurn && (
        <div
          style={{
            position: 'fixed', bottom: 20, right: 20,
            pointerEvents: 'none', zIndex: 10, textAlign: 'right',
          }}
        >
          <div style={{ color: '#33334a', fontSize: 10, letterSpacing: '1px', lineHeight: 1.8 }}>
            Click piece → select<br />
            Click gold tile → move<br />
            Drag → orbit camera
          </div>
        </div>
      )}

      {/* ── AI thinking overlay (subtle) ─────────────────────────────────── */}
      {aiThinking && (
        <div
          style={{
            position: 'fixed', bottom: 20, right: 20,
            pointerEvents: 'none', zIndex: 10, textAlign: 'right',
          }}
        >
          <div className="ai-blink" style={{ color: '#ff6666', fontSize: 11, letterSpacing: '2px' }}>
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
            position: 'fixed', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: 'rgba(4,4,14,0.92)',
            backdropFilter: 'blur(8px)',
            zIndex: 60,
          }}
        >
          {/* Logo */}
          <div style={{ marginBottom: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 42, fontWeight: 900, color: '#ffffff', letterSpacing: 6 }}>
              RUN HORSES!
            </div>
            <div style={{ fontSize: 12, color: '#00ffcc', letterSpacing: 8, marginTop: 4 }}>
              BRAIN TEASING 3D GAME
            </div>
          </div>

          <div style={{ color: '#333355', fontSize: 11, letterSpacing: 4, margin: '28px 0 32px' }}>
            CHOOSE YOUR MODE
          </div>

          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
            {/* Single Player card with difficulty */}
            <div
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12,
                padding: '28px 36px',
                textAlign: 'left',
                minWidth: 200,
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 10 }}>🤖</div>
              <div style={{ color: '#ffffff', fontSize: 14, fontWeight: 700, letterSpacing: 2, marginBottom: 6 }}>
                SINGLE PLAYER
              </div>
              <div style={{ color: '#44445a', fontSize: 10, letterSpacing: 1, lineHeight: 1.7, marginBottom: 18 }}>
                You play White.<br />
                AI plays Black.<br />
                Race to claim f6.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => {
                  const color = d === 'easy' ? '#44dd88' : d === 'medium' ? '#f5c842' : '#ff4466';
                  const desc  = d === 'easy' ? 'Random moves' : d === 'medium' ? 'Tactical (2-ply)' : 'Strategic (4-ply)';
                  return (
                    <button
                      key={d}
                      onClick={() => onSelectMode('ai', d)}
                      style={{
                        background: 'transparent',
                        border: `1.5px solid ${color}44`,
                        color,
                        borderRadius: 6,
                        padding: '8px 14px',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: 2,
                        textAlign: 'left',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'background 0.15s, border-color 0.15s',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = `${color}18`;
                        (e.currentTarget as HTMLButtonElement).style.borderColor = color;
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                        (e.currentTarget as HTMLButtonElement).style.borderColor = `${color}44`;
                      }}
                    >
                      <span>{d.toUpperCase()}</span>
                      <span style={{ fontSize: 9, fontWeight: 400, opacity: 0.6, letterSpacing: 1 }}>{desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Two Players card */}
            <button
              className="mode-card"
              onClick={() => onSelectMode('pvp')}
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12,
                padding: '28px 36px',
                cursor: 'pointer',
                textAlign: 'left',
                minWidth: 200,
                fontFamily: 'inherit',
                transition: 'background 0.15s, border-color 0.15s',
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 10 }}>⚔️</div>
              <div style={{ color: '#ffffff', fontSize: 14, fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>
                TWO PLAYERS
              </div>
              <div style={{ color: '#44445a', fontSize: 10, letterSpacing: 1, lineHeight: 1.7 }}>
                Pass &amp; play locally.<br />
                White vs Black.<br />
                First to f6 wins.
              </div>
            </button>
          </div>

          <div style={{ marginTop: 44, color: '#1a1a2e', fontSize: 10, letterSpacing: 3 }}>
            11×11 GRID · L-JUMP · HORIZONTAL SLIDE
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          WIN OVERLAY
      ═════════════════════════════════════════════════════════════════════ */}
      {winner && (
        <div
          style={{
            position: 'fixed', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: 'rgba(4,4,14,0.88)',
            zIndex: 50,
            backdropFilter: 'blur(6px)',
          }}
        >
          {/* Win headline changes based on mode */}
          <div
            style={{
              fontSize: 72, fontWeight: 900, letterSpacing: 4, marginBottom: 12,
              color: winner === 'white' ? '#e8e8e8' : '#aaaacc',
              textShadow: '0 0 60px rgba(0,255,200,0.7)',
            }}
          >
            {gameMode === 'ai'
              ? winner === 'white' ? '○ YOU WIN!' : '● AI WINS!'
              : winner === 'white' ? '○ WHITE WINS!' : '● BLACK WINS!'}
          </div>

          <div style={{ color: '#00ffcc', fontSize: 18, letterSpacing: 6, marginBottom: 10 }}>
            OASIS REACHED
          </div>
          <div style={{ color: '#333355', fontSize: 13, letterSpacing: 2, marginBottom: 44 }}>
            {gameMode === 'ai' && winner === 'black'
              ? 'THE AI CLAIMS f6'
              : `${winner!.toUpperCase()} TEAM CLAIMS f6`}
          </div>

          <div style={{ display: 'flex', gap: 16 }}>
            <GhostButton onClick={onReset}>PLAY AGAIN</GhostButton>
            <GhostButton onClick={onChangeMode} color="#555577" small>
              CHANGE MODE
            </GhostButton>
          </div>
        </div>
      )}
    </>
  );
}
