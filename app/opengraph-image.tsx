import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'TV Games — Play iconic games from your favorite shows';
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
            opacity: 0.05,
            backgroundImage:
              'linear-gradient(#a78bfa 1px, transparent 1px), linear-gradient(90deg, #a78bfa 1px, transparent 1px)',
            backgroundSize: '80px 80px',
          }}
        />

        {/* Glow */}
        <div
          style={{
            position: 'absolute',
            width: 600,
            height: 300,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(139,92,246,0.2) 0%, transparent 70%)',
            top: 100,
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        />

        {/* Emoji row */}
        <div
          style={{
            display: 'flex',
            gap: 24,
            marginBottom: 32,
            fontSize: 56,
          }}
        >
          <span>🐎</span>
          <span>🎲</span>
          <span>🎯</span>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 88,
            fontWeight: 900,
            letterSpacing: '-2px',
            color: '#ffffff',
            textShadow: '0 0 60px rgba(139,92,246,0.6)',
            lineHeight: 1,
            marginBottom: 16,
          }}
        >
          TV Games
        </div>

        {/* Divider */}
        <div
          style={{
            width: 320,
            height: 2,
            background: 'linear-gradient(90deg, transparent, #a78bfa, #00ffcc, transparent)',
            margin: '16px 0 28px',
            borderRadius: 1,
            display: 'flex',
          }}
        />

        {/* Tagline */}
        <div
          style={{
            fontSize: 24,
            color: '#c4b5fd',
            letterSpacing: '2px',
            textAlign: 'center',
          }}
        >
          Play iconic games from your favorite shows
        </div>
      </div>
    ),
    { ...size },
  );
}
