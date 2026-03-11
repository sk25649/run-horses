import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Mines of Oblivion — Plant. Deceive. Detonate.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Mini board snapshot — 5×5 tense mid-game moment
// 'e'=empty, 'm'=mine(revealed), 't'=treasure, 'w'=white player, 'b'=black, 's'=stepped
const BOARD: string[][] = [
  ['s',  'm',  'e',  'e',  't' ],
  ['e',  's',  'e',  'm',  'e' ],
  ['t',  'e',  'w',  'e',  'e' ],
  ['e',  'm',  'e',  's',  'e' ],
  ['e',  'e',  's',  't',  'b' ],
];

const CELL = 74;
const GAP = 3;

export default function Image() {
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
        {/* Micro grid texture */}
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          backgroundImage: 'repeating-linear-gradient(0deg, rgba(40,80,40,0.09) 0px, rgba(40,80,40,0.09) 1px, transparent 1px, transparent 28px), repeating-linear-gradient(90deg, rgba(40,80,40,0.09) 0px, rgba(40,80,40,0.09) 1px, transparent 1px, transparent 28px)',
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

        {/* Gold glow — upper right */}
        <div style={{
          position: 'absolute', top: -100, right: -40,
          width: 500, height: 420, borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(200,150,10,0.16) 0%, transparent 65%)',
          display: 'flex',
        }} />

        {/* Red danger glow — center */}
        <div style={{
          position: 'absolute', top: '25%', left: '28%',
          width: 320, height: 320, borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(200,20,20,0.12) 0%, transparent 65%)',
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
          width: 460,
          flexShrink: 0,
          position: 'relative',
          paddingLeft: 44,
        }}>
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
            border: '1px solid rgba(40,90,40,0.45)',
            padding: 6,
            background: 'rgba(6,13,6,0.85)',
          }}>
            {BOARD.map((row, r) => (
              <div key={r} style={{ display: 'flex', gap: GAP }}>
                {row.map((cell, c) => {
                  const isMine = cell === 'm';
                  const isTreasure = cell === 't';
                  const isWhite = cell === 'w';
                  const isBlack = cell === 'b';
                  const isStepped = cell === 's';

                  const bgColor = isMine ? '#1a0808' : isTreasure ? '#1a1500' : isStepped ? '#1e3320' : '#0f1f0f';
                  const borderColor = isMine
                    ? 'rgba(255,40,40,0.5)'
                    : isTreasure
                    ? 'rgba(245,200,66,0.55)'
                    : isStepped
                    ? 'rgba(90,184,106,0.28)'
                    : 'rgba(40,80,40,0.4)';

                  return (
                    <div
                      key={c}
                      style={{
                        width: CELL,
                        height: CELL,
                        background: bgColor,
                        border: `1.5px solid ${borderColor}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {/* Mine */}
                      {isMine && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: '50%',
                            background: 'radial-gradient(circle, #cc2020 0%, #880000 100%)',
                            border: '2px solid rgba(255,80,80,0.7)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {/* Crosshair */}
                            <div style={{ display: 'flex', position: 'relative', width: 16, height: 16 }}>
                              <div style={{ position: 'absolute', top: 7, left: 0, width: 16, height: 2, background: 'rgba(255,140,140,0.85)', display: 'flex' }} />
                              <div style={{ position: 'absolute', top: 0, left: 7, width: 2, height: 16, background: 'rgba(255,140,140,0.85)', display: 'flex' }} />
                            </div>
                          </div>
                          <div style={{ fontSize: 8, color: 'rgba(255,80,80,0.65)', letterSpacing: 1.5, marginTop: 4, fontFamily: 'monospace', display: 'flex' }}>
                            MINE
                          </div>
                        </div>
                      )}

                      {/* Treasure */}
                      {isTreasure && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{
                            width: 34, height: 28, borderRadius: 4,
                            background: 'linear-gradient(180deg, #f5c842 0%, #c8960a 100%)',
                            border: '2px solid rgba(255,220,80,0.85)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffe080', display: 'flex' }} />
                          </div>
                        </div>
                      )}

                      {/* White player */}
                      {isWhite && (
                        <div style={{
                          width: 42, height: 42, borderRadius: '50%',
                          background: 'radial-gradient(circle at 35% 35%, #5599ff 0%, #1155dd 60%, #0a3399 100%)',
                          border: '2.5px solid rgba(100,180,255,0.9)',
                          display: 'flex',
                        }} />
                      )}

                      {/* Black player */}
                      {isBlack && (
                        <div style={{
                          width: 42, height: 42, borderRadius: '50%',
                          background: 'radial-gradient(circle at 35% 35%, #ffbb55 0%, #dd7700 60%, #994400 100%)',
                          border: '2.5px solid rgba(255,180,60,0.9)',
                          display: 'flex',
                        }} />
                      )}

                      {/* Stepped */}
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
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 20, marginTop: 14, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#cc2020', display: 'flex' }} />
              <span style={{ fontSize: 9, color: 'rgba(200,80,80,0.6)', letterSpacing: 2, fontFamily: 'monospace', display: 'flex' }}>MINE</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 8, background: '#f5c842', borderRadius: 2, display: 'flex' }} />
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
          background: 'linear-gradient(180deg, transparent 0%, rgba(90,184,106,0.35) 20%, rgba(90,184,106,0.35) 80%, transparent 100%)',
          flexShrink: 0,
        }} />

        {/* ── RIGHT PANEL ── */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          flex: 1,
          padding: '60px 56px 60px 60px',
        }}>
          {/* Eyebrow */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
            <div style={{ width: 20, height: 1, background: 'rgba(90,184,106,0.6)', display: 'flex' }} />
            <span style={{
              fontSize: 10, letterSpacing: 5,
              color: 'rgba(90,184,106,0.7)', fontFamily: 'monospace',
            }}>
              A PLAY EPISODES GAME
            </span>
          </div>

          {/* Title: MINES */}
          <div style={{ display: 'flex', lineHeight: 1, marginBottom: 4 }}>
            <span style={{
              fontSize: 120,
              fontWeight: 900,
              color: '#d4edd4',
              letterSpacing: -5,
              fontFamily: 'Georgia, "Times New Roman", serif',
              display: 'flex',
            }}>
              MINES
            </span>
          </div>

          {/* Title: of OBLIVION */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 30 }}>
            <span style={{
              fontSize: 52,
              fontWeight: 400,
              color: 'rgba(90,184,106,0.55)',
              letterSpacing: 2,
              fontFamily: 'Georgia, "Times New Roman", serif',
              display: 'flex',
            }}>of</span>
            <span style={{
              fontSize: 96,
              fontWeight: 900,
              color: '#f5c842',
              letterSpacing: -4,
              fontFamily: 'Georgia, "Times New Roman", serif',
              display: 'flex',
            }}>
              OBLIVION
            </span>
          </div>

          {/* Tagline */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
            <div style={{ width: 36, height: 2, background: 'rgba(200,40,40,0.75)', display: 'flex' }} />
            <span style={{
              fontSize: 18, letterSpacing: 5,
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
            display: 'flex',
          }}>
            A deadly 2-player strategy game. Secretly place your mines, hunt for treasure, and watch your opponent detonate.
          </div>

          {/* Feature tags */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
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
                  fontSize: 9, letterSpacing: 2.5,
                  color: 'rgba(130,190,130,0.28)',
                  fontFamily: 'monospace',
                }}>
                  {tag}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom tricolor border */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
          display: 'flex',
          background: 'linear-gradient(90deg, transparent, rgba(90,184,106,0.55) 20%, rgba(245,200,66,0.55) 50%, rgba(200,40,40,0.55) 80%, transparent)',
        }} />

        {/* Top border */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          display: 'flex',
          background: 'linear-gradient(90deg, transparent, rgba(40,80,40,0.5) 30%, rgba(40,80,40,0.5) 70%, transparent)',
        }} />
      </div>
    ),
    { ...size },
  );
}
