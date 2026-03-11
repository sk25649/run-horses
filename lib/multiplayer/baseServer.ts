import type * as Party from 'partykit/server';
import type { PlayerSlot, ServerMsg, LastMove } from './types';

/**
 * Abstract base class for turn-based 2-player PartyKit game servers.
 * Handles player slot management, reconnection, rematch voting, and broadcasting.
 * Subclasses implement game-specific logic.
 */
export abstract class BaseGameServer implements Party.Server {
  protected slots: PlayerSlot[] = [];
  protected rematchVotes = new Set<string>();
  protected gameStarted = false;
  protected lastMove: LastMove | null = null;
  // Tracks conn ids that are in a same-_pk reconnect (new conn arrived before old conn closed)
  private reconnectingIds = new Set<string>();

  /** Return the initial game state */
  abstract createInitialState(): unknown;

  /** Return the current game state */
  abstract getGameState(): unknown;

  /** Set the game state */
  abstract setGameState(state: unknown): void;

  /** Validate and apply a move. Return true if the move was valid and applied. */
  abstract handleMove(
    fromRow: number,
    fromCol: number,
    toRow: number,
    toCol: number,
    playerColor: string,
  ): boolean;

  /** The two player colors in order. Default: ['white', 'black'] */
  protected getColors(): [string, string] {
    return ['white', 'black'];
  }

  constructor(readonly room: Party.Room) {}

  protected send(conn: Party.Connection, msg: ServerMsg) {
    conn.send(JSON.stringify(msg));
  }

  protected broadcast(msg: ServerMsg, without?: string[]) {
    this.room.broadcast(JSON.stringify(msg), without);
  }

  onConnect(conn: Party.Connection) {
    const colors = this.getColors();

    if (this.gameStarted) {
      // Same-_pk reconnect: new connection arrived before the old one's close event fired.
      // Suppress the upcoming onClose so it doesn't broadcast opponent_left.
      const sameSlot = this.slots.find((s) => s.id === conn.id && s.connected);
      if (sameSlot) {
        this.reconnectingIds.add(conn.id);
        this.send(conn, { type: 'assigned', color: sameSlot.color });
        return;
      }

      const disconnected = this.slots.find((s) => !s.connected);
      if (disconnected) {
        disconnected.id = conn.id;
        disconnected.connected = true;
        this.send(conn, { type: 'assigned', color: disconnected.color });
      } else {
        this.send(conn, { type: 'room_full' });
      }
      return;
    }

    const connectedCount = this.slots.filter((s) => s.connected).length;
    if (connectedCount >= 2) {
      this.send(conn, { type: 'room_full' });
      return;
    }

    const color = this.slots.length === 0 ? colors[0] : colors[1];
    this.slots.push({ id: conn.id, name: 'Anonymous', color, joined: false, connected: true });
    this.send(conn, { type: 'assigned', color });
  }

  onMessage(message: string, sender: Party.Connection) {
    let msg: { type: string; [k: string]: unknown };
    try {
      msg = JSON.parse(message as string);
    } catch {
      return;
    }

    switch (msg.type) {
      case 'join': {
        const name = (msg.name as string) || 'Anonymous';
        const slot = this.slots.find((s) => s.id === sender.id);
        if (!slot) return;

        if (!slot.connected) {
          slot.name = name;
          slot.connected = true;
          this.send(sender, {
            type: 'start',
            players: this.slots.map((s) => ({ name: s.name, color: s.color })),
            gameState: this.getGameState(),
          });
          this.broadcast({ type: 'opponent_rejoined', name }, [sender.id]);
          break;
        }

        // Game is active and slot is still connected: this is a same-_pk reconnect join.
        // Re-send the current game state so the reconnecting client recovers its UI.
        if (this.gameStarted) {
          slot.name = name;
          this.send(sender, {
            type: 'start',
            players: this.slots.map((s) => ({ name: s.name, color: s.color })),
            gameState: this.getGameState(),
          });
          break;
        }

        slot.name = name;
        slot.joined = true;

        const bothReady = this.slots.length === 2 && this.slots.every((s) => s.joined);
        if (bothReady && !this.gameStarted) {
          this.gameStarted = true;
          this.setGameState(this.createInitialState());
          this.broadcast({
            type: 'start',
            players: this.slots.map((s) => ({ name: s.name, color: s.color })),
            gameState: this.getGameState(),
          });
        } else if (!this.gameStarted) {
          this.send(sender, { type: 'waiting' });
        }
        break;
      }

      case 'move': {
        const slot = this.slots.find((s) => s.id === sender.id);
        if (!slot || this.slots.filter((s) => s.connected).length < 2) return;

        const fromRow = msg.fromRow as number;
        const fromCol = msg.fromCol as number;
        const toRow = msg.toRow as number;
        const toCol = msg.toCol as number;

        if (!this.handleMove(fromRow, fromCol, toRow, toCol, slot.color)) {
          this.send(sender, { type: 'error', reason: 'invalid_move' });
          return;
        }

        this.lastMove = { fromRow, fromCol, toRow, toCol };
        this.broadcast({ type: 'sync', gameState: this.getGameState(), lastMove: this.lastMove });
        break;
      }

      case 'rematch': {
        this.rematchVotes.add(sender.id);
        if (this.rematchVotes.size >= 2) {
          this.setGameState(this.createInitialState());
          this.lastMove = null;
          this.rematchVotes.clear();
          this.gameStarted = true;
          const colors = this.getColors();
          this.slots = this.slots.map((s) => ({
            ...s,
            color: s.color === colors[0] ? colors[1] : colors[0],
          }));
          // Notify each player of their new color before the start broadcast
          for (const conn of this.room.getConnections()) {
            const slot = this.slots.find((s) => s.id === conn.id);
            if (slot) this.send(conn, { type: 'assigned', color: slot.color });
          }
          this.broadcast({
            type: 'start',
            players: this.slots.map((s) => ({ name: s.name, color: s.color })),
            gameState: this.getGameState(),
          });
        } else {
          this.broadcast({ type: 'rematch_vote' }, [sender.id]);
        }
        break;
      }
    }
  }

  onClose(conn: Party.Connection) {
    // If this close is the old connection from a same-_pk reconnect, ignore it.
    if (this.reconnectingIds.has(conn.id)) {
      this.reconnectingIds.delete(conn.id);
      return;
    }

    const slot = this.slots.find((s) => s.id === conn.id);
    if (!slot) return;

    if (this.gameStarted) {
      slot.connected = false;
      this.broadcast({ type: 'opponent_left' }, [conn.id]);
    } else {
      this.slots = this.slots.filter((s) => s.id !== conn.id);
      if (this.slots.length > 0) {
        this.broadcast({ type: 'opponent_left' }, [conn.id]);
      }
    }
  }
}
