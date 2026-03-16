import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const dynamic = 'force-static';
export const alt = 'Play Episodes — Play iconic games from your favorite shows';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: '#080a10',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Scanline texture */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.012) 3px, rgba(255,255,255,0.012) 4px)',
          }}
        />

        {/* Subtle vertical grid */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            backgroundImage:
              'repeating-linear-gradient(90deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 100px)',
          }}
        />

        {/* Warm amber atmospheric glow — left panel */}
        <div
          style={{
            position: 'absolute',
            top: 15,
            left: -60,
            width: 520,
            height: 520,
            borderRadius: '50%',
            background:
              'radial-gradient(ellipse, rgba(232,160,32,0.14) 0%, transparent 65%)',
            display: 'flex',
          }}
        />

        {/* Cool steel glow — top right */}
        <div
          style={{
            position: 'absolute',
            top: -120,
            right: -40,
            width: 480,
            height: 400,
            borderRadius: '50%',
            background:
              'radial-gradient(ellipse, rgba(40,90,180,0.18) 0%, transparent 65%)',
            display: 'flex',
          }}
        />

        {/* Edge vignette */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            background:
              'radial-gradient(ellipse 110% 100% at 50% 50%, transparent 60%, rgba(0,0,0,0.65) 100%)',
          }}
        />

        {/* ── LEFT PANEL ── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: 420,
            padding: '0 0 0 56px',
            position: 'relative',
            flexShrink: 0,
          }}
        >
          {/* Outer ring */}
          <div
            style={{
              width: 280,
              height: 280,
              borderRadius: '50%',
              border: '1.5px solid rgba(232,160,32,0.28)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {/* Middle ring */}
            <div
              style={{
                position: 'absolute',
                width: 234,
                height: 234,
                borderRadius: '50%',
                border: '1px solid rgba(232,160,32,0.14)',
                display: 'flex',
              }}
            />
            {/* Inner filled circle */}
            <div
              style={{
                position: 'absolute',
                width: 180,
                height: 180,
                borderRadius: '50%',
                background: 'rgba(232,160,32,0.06)',
                border: '1px solid rgba(232,160,32,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: 88, display: 'flex' }}>🐎</span>
            </div>
          </div>

          {/* Sub-icons row */}
          <div
            style={{
              display: 'flex',
              gap: 18,
              marginTop: 28,
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 26, opacity: 0.45, display: 'flex' }}>🎲</span>
            <div
              style={{
                width: 3,
                height: 3,
                borderRadius: '50%',
                background: 'rgba(232,160,32,0.35)',
                display: 'flex',
              }}
            />
            <span style={{ fontSize: 26, opacity: 0.45, display: 'flex' }}>🎯</span>
            <div
              style={{
                width: 3,
                height: 3,
                borderRadius: '50%',
                background: 'rgba(232,160,32,0.35)',
                display: 'flex',
              }}
            />
            <span style={{ fontSize: 26, opacity: 0.45, display: 'flex' }}>🃏</span>
          </div>
        </div>

        {/* ── VERTICAL DIVIDER ── */}
        <div
          style={{
            display: 'flex',
            width: 1,
            marginTop: 72,
            marginBottom: 72,
            background:
              'linear-gradient(180deg, transparent 0%, rgba(232,160,32,0.45) 25%, rgba(232,160,32,0.45) 75%, transparent 100%)',
            flexShrink: 0,
          }}
        />

        {/* ── RIGHT PANEL ── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            flex: 1,
            padding: '64px 60px 64px 64px',
          }}
        >
          {/* Eyebrow */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 30,
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#e8a020',
                display: 'flex',
              }}
            />
            <span
              style={{
                fontSize: 11,
                letterSpacing: 5,
                color: '#e8a020',
                textTransform: 'uppercase' as const,
                fontFamily: 'monospace',
              }}
            >
              ICONIC TV GAMES
            </span>
          </div>

          {/* Display title — stacked */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              marginBottom: 30,
              lineHeight: 0.88,
            }}
          >
            <span
              style={{
                fontSize: 108,
                fontWeight: 900,
                color: '#f0ebe0',
                letterSpacing: -4,
                fontFamily: 'Georgia, "Times New Roman", serif',
                display: 'flex',
              }}
            >
              PLAY
            </span>
            <span
              style={{
                fontSize: 108,
                fontWeight: 900,
                color: '#e8a020',
                letterSpacing: -4,
                fontFamily: 'Georgia, "Times New Roman", serif',
                display: 'flex',
              }}
            >
              EPISODES
            </span>
          </div>

          {/* Rule */}
          <div
            style={{
              width: 64,
              height: 2,
              background: 'rgba(232,160,32,0.5)',
              marginBottom: 22,
              display: 'flex',
            }}
          />

          {/* Tagline */}
          <div
            style={{
              fontSize: 17,
              color: 'rgba(240,235,224,0.42)',
              letterSpacing: 0.3,
              lineHeight: 1.55,
              fontFamily: 'Georgia, "Times New Roman", serif',
              maxWidth: 370,
            }}
          >
            Play iconic board games and challenges from your favorite TV shows
          </div>

          {/* Feature tags */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 0,
              marginTop: 36,
            }}
          >
            {['Online Multiplayer', 'AI Opponents', 'Local Play'].map((tag, i) => (
              <div key={tag} style={{ display: 'flex', alignItems: 'center' }}>
                {i > 0 && (
                  <div
                    style={{
                      width: 3,
                      height: 3,
                      borderRadius: '50%',
                      background: 'rgba(232,160,32,0.3)',
                      marginLeft: 14,
                      marginRight: 14,
                      display: 'flex',
                    }}
                  />
                )}
                <span
                  style={{
                    fontSize: 10,
                    letterSpacing: 2.5,
                    color: 'rgba(240,235,224,0.28)',
                    textTransform: 'uppercase' as const,
                    fontFamily: 'monospace',
                  }}
                >
                  {tag}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom amber border line */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 3,
            display: 'flex',
            background:
              'linear-gradient(90deg, transparent, rgba(232,160,32,0.6) 30%, rgba(232,160,32,0.6) 70%, transparent)',
          }}
        />
      </div>
    ),
    { ...size },
  );
}
