// Shared multiplayer types used by all games

export type OnlineStatus = 'connecting' | 'name_required' | 'waiting' | 'playing' | 'opponent_left' | 'room_full';

export interface OnlinePlayer {
  name: string;
  color: string;
}

export interface LastMove {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
}

export interface PlayerSlot {
  id: string;
  name: string;
  color: string;
  joined: boolean;
  connected: boolean;
}

// Messages sent from server to clients
export type ServerMsg =
  | { type: 'assigned'; color: string }
  | { type: 'waiting' }
  | { type: 'start'; players: { name: string; color: string }[]; gameState: unknown }
  | { type: 'sync'; gameState: unknown; lastMove: LastMove }
  | { type: 'opponent_left' }
  | { type: 'opponent_rejoined'; name: string }
  | { type: 'rematch_vote' }
  | { type: 'room_full' }
  | { type: 'error'; reason: string };
