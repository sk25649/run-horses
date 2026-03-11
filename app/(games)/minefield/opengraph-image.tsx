import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Mines of Oblivion — Plant. Deceive. Detonate.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Mini board snapshot — 5×5 excerpt of a tense mid-game moment
// cell types: 'e'=empty, 'm'=mine(revealed), 't'=treasure, 'w'=white player, 'b'=black player, 's'=stepped(safe)
const BOARD: string[][] = [
  ['s',  'm',  'e',  'e',  't' ],
  ['e',  's',  'e',  'm',  'e' ],
  ['t',  'e',  'w',  'e',  'e' ],
  ['e',  'm',  'e',  's',  'e' ],
  ['e',  'e',  's',  't',  'b' ],
];

const CELL = 74;
const GAP = 3;

function Cell({ type }: { type: string }) {
  const isMine = type === 'm';
  const isTreasure = type === 't';
  const isWhite = type === 'w';
  const isBlack = type === 'b';
  const isStepped = type === 's';

  const bgColor = isMine
    ? '#1a0808'
    : isTreasure
    ? '#1a1500'
    : isStepped
    ? '#1e3320'
    : '#0f1f0f';

  const borderColor = isMine
    ? 'rgba(255,40,40,0.45)'
    : isTreasure
    ? 'rgba(245,200,66,0.5)'
    : isStepped
    ? 'rgba(90,184,106,0.25)'
    : 'rgba(40,80,40,0.4)';

  return (
    <div
      style={{
        width: CELL,
        height: CELL,
        background: bgColor,
        border: `1.5px solid ${borderColor}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        flexShrink: 0,
        boxShadow: isMine
          ? 'inset 0 0 18px rgba(255,30,30,0.25), 0 0 12px rgba(255,30,30,0.15)'
          : isTreasure
          ? 'inset 0 0 18px rgba(245,200,66,0.2), 0 0 14px rgba(245,200,66,0.2)'
          : 'none',
      }}
    >
      {/* Subtle corner tick marks */}
      {[[-1,-1],[1,-1],[-1,1],[1,1]].map(([dx,dy], i) => (
        <div key={i} style={{
          position: 'absolute',
          width: 6, height: 6,
          top: dy === -1 ? 3 : undefined,
          bottom: dy === 1 ? 3 : undefined,
          left: dx === -1 ? 3 : undefined,
          right: dx === 1 ? 3 : undefined,
          borderTop: dy === -1 ? `1px solid ${borderColor}` : 'none',
          borderBottom: dy === 1 ? `1px solid ${borderColor}` : 'none',
          borderLeft: dx === -1 ? `1px solid ${borderColor}` : 'none',
          borderRight: dx === 1 ? `1px solid ${borderColor}` : 'none',
          display: 'flex',
        }} />
      ))}

      {isMine && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
          {/* Skull-like mine: circle with spikes represented as a crosshair */}
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'radial-gradient(circle, #cc2020 0%, #880000 100%)',
            border: '2px solid rgba(255,80,80,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 10px rgba(255,30,30,0.6)',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: 2, height: 12, background: 'rgba(255,120,120,0.8)', display: 'flex' }} />
              <div style={{ width: 12, height: 2, background: 'rgba(255,120,120,0.8)', marginTop: -7, display: 'flex' }} />
            </div>
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,80,80,0.7)', letterSpacing: 1.5, marginTop: 4, fontFamily: 'monospace', display: 'flex' }}>
            MINE
          </div>
        </div>
      )}

      {isTreasure && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
          <div style={{
            width: 32, height: 26, borderRadius: 4,
            background: 'linear-gradient(180deg, #f5c842 0%, #c8960a 100%)',
            border: '2px solid rgba(255,220,80,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 14px rgba(245,200,66,0.7)',
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute', top: -4, left: 6, right: 6, height: 6,
              background: 'linear-gradient(180deg, #ffe080 0%, #f5c842 100%)',
              borderRadius: '3px 3px 0 0', border: '1.5px solid rgba(255,220,80,0.8)',
              display: 'flex',
            }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffe080', boxShadow: '0 0 4px rgba(255,220,80,0.8)', display: 'flex' }} />
          </div>
        </div>
      )}

      {isWhite && (
        <div style={{
          width: 42, height: 42, borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, #5599ff 0%, #1155dd 60%, #0a3399 100%)',
          border: '2.5px solid rgba(100,180,255,0.9)',
          boxShadow: '0 0 16px rgba(34,119,255,0.7), inset 0 2px 4px rgba(255,255,255,0.3)',
          display: 'flex',
        }} />
      )}

      {isBlack && (
        <div style={{
          width: 42, height: 42, borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, #ffbb55 0%, #dd7700 60%, #994400 100%)',
          border: '2.5px solid rgba(255,180,60,0.9)',
          boxShadow: '0 0 16px rgba(255,136,0,0.7), inset 0 2px 4px rgba(255,255,255,0.3)',
          display: 'flex',
        }} />
      )}

      {isStepped && (
        <div style={{
          width: 16, height: 16, borderRadius: '50%',
          background: 'rgba(90,184,106,0.25)',
          border: '1px solid rgba(90,184,106,0.4)',
          display: 'flex',
        }} />
      )}
    </div>
  );
}

export default function Image() {
  const boardWidth = BOARD[0].length * (CELL + GAP) - GAP;
  const boardHeight = BOARD.length * (CELL + GAP) - GAP;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: '#060d06',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: 'Georgia, "Times New Roman", serif',
        }}
      >
        {/* Micro grid texture — simulates the game board at macro scale */}
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          backgroundImage: 'repeating-linear-gradient(0deg, rgba(40,80,40,0.08) 0px, rgba(40,80,40,0.08) 1px, transparent 1px, transparent 28px), repeating-linear-gradient(90deg, rgba(40,80,40,0.08) 0px, rgba(40,80,40,0.08) 1px, transparent 1px, transparent 28px)',
        }} />

        {/* Scanlines */}
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 3px)',
        }} />

        {/* Green jungle glow — bottom left */}
        <div style={{
          position: 'absolute', bottom: -80, left: -60,
          width: 600, height: 500, borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(20,120,30,0.22) 0%, transparent 65%)',
          display: 'flex',
        }} />

        {/* Gold treasure glow — upper right */}
        <div style={{
          position: 'absolute', top: -100, right: -40,
          width: 500, height: 420, borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(200,150,10,0.15) 0%, transparent 65%)',
          display: 'flex',
        }} />

        {/* Red danger glow — near center left (where mines are) */}
        <div style={{
          position: 'absolute', top: '30%', left: '32%',
          width: 300, height: 300, borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(200,20,20,0.1) 0%, transparent 65%)',
          display: 'flex',
        }} />

        {/* Vignette */}
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          background: 'radial-gradient(ellipse 110% 100% at 50% 50%, transparent 55%, rgba(0,0,0,0.75) 100%)',
        }} />

        {/* ── LEFT PANEL — Mini game board ── */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: 470,
          flexShrink: 0,
          position: 'relative',
          paddingLeft: 44,
        }}>
          {/* CLASSIFIED stamp — diagonal behind the board */}
          <div style={{
            position: 'absolute',
            top: 88,
            left: 20,
            width: boardWidth + 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: 'rotate(-18deg)',
            zIndex: 0,
          }}>
            <div style={{
              border: '3px solid rgba(180,20,20,0.18)',
              borderRadius: 4,
              padding: '4px 16px',
              display: 'flex',
            }}>
              <span style={{
                fontSize: 26,
                fontWeight: 900,
                color: 'rgba(180,20,20,0.14)',
                letterSpacing: 8,
                fontFamily: 'Georgia, serif',
                display: 'flex',
              }}>CLASSIFIED</span>
            </div>
          </div>

          {/* Board label */}
          <div style={{
            fontSize: 9,
            color: 'rgba(90,184,106,0.5)',
            letterSpacing: 4,
            fontFamily: 'monospace',
            marginBottom: 10,
            display: 'flex',
          }}>
            TACTICAL OVERVIEW · GRID-5
          </div>

          {/* Mini board */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: GAP,
            border: '1px solid rgba(40,90,40,0.4)',
            padding: 6,
            background: 'rgba(6,13,6,0.8)',
            boxShadow: '0 0 40px rgba(0,0,0,0.7), 0 0 1px rgba(90,184,106,0.3)',
            position: 'relative',
            zIndex: 1,
          }}>
            {/* Corner coordinates */}
            {BOARD.map((row, r) => (
              <div key={r} style={{ display: 'flex', gap: GAP }}>
                {row.map((cell, c) => (
                  <Cell key={c} type={cell} />
                ))}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 18, marginTop: 14, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#cc2020', boxShadow: '0 0 6px rgba(255,30,30,0.5)', display: 'flex' }} />
              <span style={{ fontSize: 9, color: 'rgba(200,80,80,0.6)', letterSpacing: 2, fontFamily: 'monospace', display: 'flex' }}>MINE</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 8, background: '#f5c842', borderRadius: 2, boxShadow: '0 0 6px rgba(245,200,66,0.5)', display: 'flex' }} />
              <span style={{ fontSize: 9, color: 'rgba(200,160,40,0.6)', letterSpacing: 2, fontFamily: 'monospace', display: 'flex' }}>TREASURE</span>
            </div>
          </div>
        </div>

        {/* ── VERTICAL DIVIDER ── */}
        <div style={{
          display: 'flex',
          width: 1,
          marginTop: 60,
          marginBottom: 60,
          background: 'linear-gradient(180deg, transparent 0%, rgba(90,184,106,0.3) 20%, rgba(90,184,106,0.3) 80%, transparent 100%)',
          flexShrink: 0,
        }} />

        {/* ── RIGHT PANEL — Title & text ── */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          flex: 1,
          padding: '60px 56px 60px 60px',
        }}>
          {/* Eyebrow */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
            <div style={{
              width: 20, height: 1,
              background: 'rgba(90,184,106,0.6)',
              display: 'flex',
            }} />
            <span style={{
              fontSize: 10,
              letterSpacing: 5,
              color: 'rgba(90,184,106,0.7)',
              fontFamily: 'monospace',
            }}>
              A PLAY EPISODES GAME
            </span>
          </div>

          {/* Title */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            lineHeight: 0.88,
            marginBottom: 32,
          }}>
            <span style={{
              fontSize: 118,
              fontWeight: 900,
              color: '#d4edd4',
              letterSpacing: -5,
              fontFamily: 'Georgia, "Times New Roman", serif',
              display: 'flex',
              textShadow: '0 0 40px rgba(90,184,106,0.25)',
            }}>
              MINES
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 0 }}>
              <span style={{
                fontSize: 54,
                fontWeight: 400,
                color: 'rgba(90,184,106,0.55)',
                letterSpacing: 2,
                fontFamily: 'Georgia, "Times New Roman", serif',
                display: 'flex',
                marginRight: 12,
              }}>of</span>
              <span style={{
                fontSize: 108,
                fontWeight: 900,
                color: '#f5c842',
                letterSpacing: -4,
                fontFamily: 'Georgia, "Times New Roman", serif',
                display: 'flex',
                textShadow: '0 0 50px rgba(245,200,66,0.4)',
              }}>
                OBLIVION
              </span>
            </div>
          </div>

          {/* Tagline bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 28,
          }}>
            <div style={{ width: 40, height: 2, background: 'rgba(200,40,40,0.7)', display: 'flex' }} />
            <span style={{
              fontSize: 18,
              letterSpacing: 5,
              color: 'rgba(220,90,90,0.85)',
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontStyle: 'italic',
            }}>
              Plant. Deceive. Detonate.
            </span>
          </div>

          {/* Description */}
          <div style={{
            fontSize: 15,
            color: 'rgba(180,220,180,0.38)',
            lineHeight: 1.6,
            fontFamily: 'Georgia, "Times New Roman", serif',
            maxWidth: 380,
            marginBottom: 36,
          }}>
            A deadly 2-player strategy game. Secretly place your mines, hunt for treasure, and watch your opponent detonate into oblivion.
          </div>

          {/* Feature tags */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            {['Online Multiplayer', 'AI Opponents', 'Local Play'].map((tag, i) => (
              <div key={tag} style={{ display: 'flex', alignItems: 'center' }}>
                {i > 0 && (
                  <div style={{
                    width: 3, height: 3, borderRadius: '50%',
                    background: 'rgba(90,184,106,0.3)',
                    marginLeft: 14, marginRight: 14,
                    display: 'flex',
                  }} />
                )}
                <span style={{
                  fontSize: 9,
                  letterSpacing: 2.5,
                  color: 'rgba(130,190,130,0.28)',
                  fontFamily: 'monospace',
                }}>
                  {tag}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom green border line */}
        <div style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          height: 3,
          display: 'flex',
          background: 'linear-gradient(90deg, transparent, rgba(90,184,106,0.5) 20%, rgba(245,200,66,0.5) 50%, rgba(200,40,40,0.5) 80%, transparent)',
        }} />

        {/* Top border line */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 1,
          display: 'flex',
          background: 'linear-gradient(90deg, transparent, rgba(40,80,40,0.5) 30%, rgba(40,80,40,0.5) 70%, transparent)',
        }} />
      </div>
    ),
    { ...size },
  );
}
