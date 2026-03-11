import type { GameDefinition } from './types';

export const games: GameDefinition[] = [
  {
    id: 'run-horses',
    name: 'Run Horses!',
    description: 'A 3D tactical board game. Race your horses to the Oasis on an 11x11 board.',
    tagline: 'Race to the Oasis',
    tvShow: 'The Risk Takers',
    emoji: '🐎',
    thumbnail: '/games/run-horses/thumb.png',
    maxPlayers: 2,
    modes: ['pvp', 'ai', 'online'],
    subdomain: 'runhorses',
    themeColor: '#00ffcc',
    accentColor: '#a78bfa',
  },
  {
    id: 'minefield',
    name: 'Mines of Oblivion',
    description: 'A 3D memory strategy game. Place hidden mines, navigate the board, collect 3 treasures.',
    tagline: 'Remember. Survive. Win.',
    tvShow: 'The Risk Takers',
    emoji: '💣',
    thumbnail: '/games/minefield/thumb.png',
    maxPlayers: 2,
    modes: ['pvp', 'ai', 'online'],
    subdomain: 'minefield',
    themeColor: '#ff4444',
    accentColor: '#f5c842',
  },
];

export function getGameBySubdomain(subdomain: string): GameDefinition | undefined {
  return games.find(g => g.subdomain === subdomain);
}

export function getGameById(id: string): GameDefinition | undefined {
  return games.find(g => g.id === id);
}
