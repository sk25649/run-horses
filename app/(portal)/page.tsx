import { games } from '@/lib/game-core/registry';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TV Games — Play iconic games from your favorite shows',
  description: 'Play iconic board games and challenges from hit TV shows. Real-time multiplayer, AI opponents, and local play.',
  openGraph: {
    title: 'TV Games',
    description: 'Play iconic board games and challenges from hit TV shows.',
    type: 'website',
  },
};

export default function PortalPage() {
  return (
    <div
      style={{
        width: '100vw',
        minHeight: '100vh',
        background: '#04040e',
        fontFamily: "'SF Mono', 'Fira Code', monospace",
        color: '#cccccc',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Hero */}
      <header
        style={{
          width: '100%',
          maxWidth: 900,
          padding: '80px 24px 48px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: 6,
            textTransform: 'uppercase',
            color: '#555',
            marginBottom: 16,
          }}
        >
          From your favorite TV shows
        </div>
        <h1
          style={{
            fontSize: 'clamp(36px, 6vw, 64px)',
            fontWeight: 900,
            letterSpacing: -2,
            color: '#ffffff',
            margin: '0 0 16px',
            lineHeight: 1.1,
          }}
        >
          TV Games
        </h1>
        <p
          style={{
            fontSize: 16,
            color: '#888',
            maxWidth: 500,
            margin: '0 auto',
            lineHeight: 1.6,
          }}
        >
          Play iconic board games and challenges from hit TV shows.
          Real-time multiplayer, AI opponents, and local play.
        </p>
      </header>

      {/* Game Grid */}
      <main
        style={{
          width: '100%',
          maxWidth: 900,
          padding: '0 24px 80px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 24,
        }}
      >
        {games.map((game) => (
          <a
            key={game.id}
            href={`/${game.id}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              overflow: 'hidden',
              textDecoration: 'none',
              color: 'inherit',
              transition: 'border-color 0.2s, transform 0.2s',
            }}
          >
            {/* Card thumbnail area */}
            <div
              style={{
                height: 180,
                background: `linear-gradient(135deg, ${game.themeColor}15, ${game.accentColor}15)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 72,
                position: 'relative',
              }}
            >
              <span>{game.emoji}</span>
              {/* TV show badge */}
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  padding: '4px 10px',
                  borderRadius: 100,
                  background: 'rgba(0,0,0,0.5)',
                  border: `1px solid ${game.themeColor}40`,
                  fontSize: 10,
                  letterSpacing: 1.5,
                  color: game.themeColor,
                  textTransform: 'uppercase',
                }}
              >
                {game.tvShow}
              </div>
            </div>

            {/* Card body */}
            <div style={{ padding: '16px 20px 20px' }}>
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: '#fff',
                  margin: '0 0 6px',
                }}
              >
                {game.name}
              </h2>
              <p
                style={{
                  fontSize: 12,
                  color: '#777',
                  margin: '0 0 14px',
                  lineHeight: 1.5,
                }}
              >
                {game.description}
              </p>

              {/* Meta row */}
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  fontSize: 10,
                  letterSpacing: 1,
                  color: '#555',
                  textTransform: 'uppercase',
                }}
              >
                <span>{game.maxPlayers} players</span>
                <span>·</span>
                {game.modes.map((m) => (
                  <span key={m} style={{ color: game.themeColor }}>
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </a>
        ))}

        {/* Coming soon placeholder */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.02)',
            border: '1px dashed rgba(255,255,255,0.08)',
            borderRadius: 12,
            minHeight: 280,
            color: '#333',
            fontSize: 13,
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        >
          More games coming soon
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          padding: '24px',
          fontSize: 11,
          color: '#333',
          letterSpacing: 1,
        }}
      >
        TV Games
      </footer>
    </div>
  );
}
