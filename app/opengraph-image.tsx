import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Run Horses! 3D — A 3D tactical board game. Race your horses to the Oasis.';
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
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0a0a0f 0%, #12101a 40%, #1a1428 100%)',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Grid lines background */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            opacity: 0.07,
            backgroundImage:
              'linear-gradient(#a78bfa 1px, transparent 1px), linear-gradient(90deg, #a78bfa 1px, transparent 1px)',
            backgroundSize: '80px 80px',
          }}
        />

        {/* Glow orb behind title */}
        <div
          style={{
            position: 'absolute',
            width: 600,
            height: 300,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(139,92,246,0.25) 0%, transparent 70%)',
            top: 80,
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        />

        {/* Bottom oasis glow */}
        <div
          style={{
            position: 'absolute',
            width: 500,
            height: 200,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(34,197,94,0.18) 0%, transparent 70%)',
            bottom: 60,
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        />

        {/* Horse emoji row */}
        <div
          style={{
            display: 'flex',
            gap: 16,
            marginBottom: 28,
            fontSize: 52,
          }}
        >
          <span>🐎</span>
          <span>🐎</span>
          <span>🐎</span>
        </div>

        {/* Title */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <div
            style={{
              fontSize: 88,
              fontWeight: 900,
              letterSpacing: '-2px',
              color: '#ffffff',
              textShadow: '0 0 60px rgba(139,92,246,0.8)',
              lineHeight: 1,
            }}
          >
            Run Horses!
          </div>
          <div
            style={{
              fontSize: 36,
              fontWeight: 700,
              letterSpacing: '8px',
              color: '#a78bfa',
              textTransform: 'uppercase',
            }}
          >
            3 D
          </div>
        </div>

        {/* Divider */}
        <div
          style={{
            width: 320,
            height: 2,
            background: 'linear-gradient(90deg, transparent, #a78bfa, #22c55e, transparent)',
            margin: '28px 0',
            borderRadius: 1,
          }}
        />

        {/* Tagline */}
        <div
          style={{
            fontSize: 22,
            color: '#c4b5fd',
            letterSpacing: '1px',
            textAlign: 'center',
            maxWidth: 600,
            lineHeight: 1.5,
          }}
        >
          A 3D tactical board game
        </div>

        {/* Oasis badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginTop: 24,
            padding: '10px 28px',
            borderRadius: 100,
            background: 'rgba(34,197,94,0.12)',
            border: '1.5px solid rgba(34,197,94,0.4)',
          }}
        >
          <span style={{ fontSize: 22 }}>🌴</span>
          <span
            style={{
              fontSize: 18,
              color: '#86efac',
              fontWeight: 600,
              letterSpacing: '1px',
            }}
          >
            Race to the Oasis
          </span>
          <span style={{ fontSize: 22 }}>🌴</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
