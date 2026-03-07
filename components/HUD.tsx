'use client';

import { GameState, canLJump, getTerrain, rowLabel, colLabel } from '@/lib/gameLogic';
import { CSSProperties } from 'react';

const panel: CSSProperties = {
  background: 'rgba(4,4,14,0.75)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
  padding: '10px 18px',
  backdropFilter: 'blur(10px)',
};

const label: CSSProperties = {
  color: '#44445a',
  fontSize: 9,
  letterSpacing: '2.5px',
  textTransform: 'uppercase',
  marginBottom: 4,
};

const value: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '1px',
};

interface HUDProps {
  gameState: GameState;
  onReset: () => void;
}

export default function HUD({ gameState, onReset }: HUDProps) {
  const { currentTurn, selectedCell, winner } = gameState;

  const terrainLabel = selectedCell
    ? getTerrain(selectedCell[0], selectedCell[1]).toUpperCase()
    : '—';

  const hasSel = selectedCell !== null;
  const jumpAllowed = hasSel && canLJump(selectedCell![0], selectedCell![1]);

  const abilityText = hasSel
    ? jumpAllowed
      ? 'L-JUMP  +  SLIDE'
      : 'SLIDE ONLY'
    : 'SELECT A PIECE';

  const abilityColor = hasSel ? (jumpAllowed ? '#f5c842' : '#70c0ff') : '#444466';

  const coordLabel = selectedCell
    ? `${rowLabel(selectedCell[0])}${colLabel(selectedCell[1])}`
    : '—';

  return (
    <>
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          padding: '16px 20px',
          background: 'linear-gradient(to bottom, rgba(4,4,14,0.92) 0%, transparent 100%)',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        {/* Title */}
        <div style={{ ...panel, flex: '0 0 auto' }}>
          <div style={{ color: '#ffffff', fontSize: 15, fontWeight: 800, letterSpacing: 3 }}>
            말 달리자
          </div>
          <div style={{ color: '#333355', fontSize: 9, letterSpacing: 4, marginTop: 2 }}>
            RUN, HORSES!
          </div>
        </div>

        {/* Turn */}
        <div style={{ ...panel, minWidth: 130 }}>
          <div style={label}>CURRENT TURN</div>
          <div
            style={{
              ...value,
              color: currentTurn === 'white' ? '#e8e8e8' : '#8888aa',
            }}
          >
            {currentTurn === 'white' ? '○ WHITE' : '● BLACK'}
          </div>
        </div>

        {/* Ability */}
        <div style={{ ...panel, minWidth: 170 }}>
          <div style={label}>ABILITY STATUS</div>
          <div style={{ ...value, color: abilityColor }}>{abilityText}</div>
        </div>

        {/* Selected */}
        <div style={{ ...panel, minWidth: 110 }}>
          <div style={label}>SELECTED</div>
          <div style={{ ...value, color: '#cccccc' }}>
            {coordLabel}{' '}
            <span style={{ fontWeight: 400, color: '#44445a' }}>{terrainLabel}</span>
          </div>
        </div>

        {/* Valid moves count */}
        <div style={{ ...panel, minWidth: 90 }}>
          <div style={label}>MOVES</div>
          <div style={{ ...value, color: '#00ffcc' }}>
            {gameState.validMoves.length || '—'}
          </div>
        </div>
      </div>

      {/* ── Legend (bottom-left) ─────────────────────────────────────────── */}
      <div
        style={{
          position: 'fixed',
          bottom: 20,
          left: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        {[
          { color: '#c9932c', label: 'Desert — L-Jump + Slide' },
          { color: '#1d6b34', label: 'Garden — Slide Only' },
          { color: '#00ffcc', label: 'Oasis  — GOAL (f6)' },
        ].map(({ color, label: lbl }) => (
          <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                background: color,
                boxShadow: color === '#00ffcc' ? `0 0 8px ${color}` : undefined,
              }}
            />
            <span style={{ color: '#55556a', fontSize: 10, letterSpacing: '1px' }}>{lbl}</span>
          </div>
        ))}
      </div>

      {/* ── Controls hint (bottom-right) ─────────────────────────────────── */}
      <div
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          pointerEvents: 'none',
          zIndex: 10,
          textAlign: 'right',
        }}
      >
        <div style={{ color: '#33334a', fontSize: 10, letterSpacing: '1px', lineHeight: 1.8 }}>
          Click piece → select<br />
          Click gold tile → move<br />
          Drag → orbit camera
        </div>
      </div>

      {/* ── Win overlay ─────────────────────────────────────────────────── */}
      {winner && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(4,4,14,0.88)',
            zIndex: 50,
            backdropFilter: 'blur(6px)',
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 900,
              color: winner === 'white' ? '#e8e8e8' : '#aaaacc',
              textShadow: '0 0 60px rgba(0,255,200,0.7)',
              letterSpacing: 4,
              marginBottom: 12,
            }}
          >
            {winner === 'white' ? '○' : '●'} WINS!
          </div>
          <div
            style={{ color: '#00ffcc', fontSize: 18, letterSpacing: 6, marginBottom: 10 }}
          >
            OASIS REACHED
          </div>
          <div
            style={{ color: '#333355', fontSize: 13, letterSpacing: 2, marginBottom: 40 }}
          >
            말 달리자 · {winner.toUpperCase()} TEAM CLAIMS f6
          </div>
          <button
            onClick={onReset}
            style={{
              background: 'transparent',
              border: '1.5px solid #00ffcc',
              color: '#00ffcc',
              padding: '14px 44px',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 4,
              cursor: 'pointer',
              borderRadius: 4,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e =>
              ((e.target as HTMLButtonElement).style.background = 'rgba(0,255,204,0.1)')
            }
            onMouseLeave={e =>
              ((e.target as HTMLButtonElement).style.background = 'transparent')
            }
          >
            PLAY AGAIN
          </button>
        </div>
      )}
    </>
  );
}
