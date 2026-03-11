import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#04030e',
          fontFamily: 'monospace',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Grid background */}
        <div style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, display: 'flex',
          backgroundImage: 'linear-gradient(rgba(255,68,68,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,68,68,0.06) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }} />

        {/* Radial glow — centered */}
        <div style={{
          position: 'absolute', width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,68,68,0.15) 0%, transparent 70%)',
          top: 65, left: 350, display: 'flex',
        }} />

        {/* Gold glow */}
        <div style={{
          position: 'absolute', width: 300, height: 300, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(245,200,66,0.12) 0%, transparent 70%)',
          top: '30%', left: '20%', display: 'flex',
        }} />

        {/* Content */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', fontSize: 28, color: '#ff4444', letterSpacing: 12, marginBottom: 12 }}>
            💣 VS 💣
          </div>
          <div style={{ display: 'flex', fontSize: 72, fontWeight: 900, color: '#ffffff', letterSpacing: 6, marginBottom: 8 }}>
            MINES OF OBLIVION
          </div>
          <div style={{ display: 'flex', fontSize: 18, color: '#ff4444', letterSpacing: 10, marginBottom: 40 }}>
            MEMORY · STRATEGY · DANGER
          </div>

          <div style={{
            display: 'flex',
            background: 'rgba(255,68,68,0.15)',
            border: '2px solid rgba(255,68,68,0.5)',
            borderRadius: 12, padding: '14px 40px', marginBottom: 32,
          }}>
            <div style={{ display: 'flex', color: '#ff8888', fontSize: 22, fontWeight: 700, letterSpacing: 4 }}>
              ONLINE MULTIPLAYER
            </div>
          </div>

          <div style={{ display: 'flex', color: '#f5c842', fontSize: 26, fontWeight: 700, letterSpacing: 3 }}>
            You've been challenged — click to play!
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
