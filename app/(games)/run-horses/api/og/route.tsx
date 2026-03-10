import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #030d0a 0%, #041410 40%, #061a18 100%)',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Grid */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            opacity: 0.06,
            backgroundImage:
              'linear-gradient(#00ffcc 1px, transparent 1px), linear-gradient(90deg, #00ffcc 1px, transparent 1px)',
            backgroundSize: '80px 80px',
          }}
        />

        {/* Teal glow */}
        <div
          style={{
            position: 'absolute',
            width: 700,
            height: 350,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(0,255,204,0.18) 0%, transparent 70%)',
            top: 60,
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        />

        {/* Left glow (blue player) */}
        <div
          style={{
            position: 'absolute',
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(34,119,255,0.2) 0%, transparent 70%)',
            bottom: 40,
            left: 100,
          }}
        />

        {/* Right glow (orange player) */}
        <div
          style={{
            position: 'absolute',
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(255,136,0,0.2) 0%, transparent 70%)',
            bottom: 40,
            right: 100,
          }}
        />

        {/* Online badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 20px',
            borderRadius: 100,
            background: 'rgba(0,255,204,0.1)',
            border: '1.5px solid rgba(0,255,204,0.35)',
            marginBottom: 28,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#00ffcc',
              display: 'flex',
            }}
          />
          <span
            style={{
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: '4px',
              color: '#00ffcc',
              textTransform: 'uppercase',
            }}
          >
            ONLINE MULTIPLAYER
          </span>
        </div>

        {/* Horses vs */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 32,
            marginBottom: 24,
          }}
        >
          <span style={{ fontSize: 72 }}>🐎</span>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0,
            }}
          >
            <span
              style={{
                fontSize: 44,
                fontWeight: 900,
                color: '#00ffcc',
                letterSpacing: '2px',
              }}
            >
              VS
            </span>
          </div>
          <span style={{ fontSize: 72, transform: 'scaleX(-1)', display: 'flex' }}>🐎</span>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 80,
            fontWeight: 900,
            letterSpacing: '-2px',
            color: '#ffffff',
            textShadow: '0 0 60px rgba(0,255,204,0.6)',
            lineHeight: 1,
            marginBottom: 8,
          }}
        >
          Run Horses!
        </div>

        {/* Divider */}
        <div
          style={{
            width: 400,
            height: 2,
            background: 'linear-gradient(90deg, transparent, #2277ff, #00ffcc, #ff8800, transparent)',
            margin: '20px 0',
            borderRadius: 1,
            display: 'flex',
          }}
        />

        {/* CTA */}
        <div
          style={{
            fontSize: 22,
            color: '#7fffd4',
            letterSpacing: '2px',
            textAlign: 'center',
          }}
        >
          You&apos;ve been challenged — click to play!
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
