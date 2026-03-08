import type * as Party from "partykit/server";
import { applyMove, createInitialState, getValidMoves } from "../lib/gameLogic";
import type { GameState, Player } from "../lib/gameLogic";

interface LastMove {
  fromRow: number; fromCol: number; toRow: number; toCol: number;
}

interface PlayerSlot {
  id: string;
  name: string;
  color: Player;
  joined: boolean;
  connected: boolean;
}

type ServerMsg =
  | { type: "assigned"; color: Player }
  | { type: "waiting" }
  | { type: "start"; players: { name: string; color: Player }[]; gameState: GameState }
  | { type: "sync"; gameState: GameState; lastMove: LastMove }
  | { type: "opponent_left" }
  | { type: "opponent_rejoined"; name: string }
  | { type: "rematch_vote" }
  | { type: "room_full" }
  | { type: "error"; reason: string };

export default class GameServer implements Party.Server {
  private gameState: GameState = createInitialState();
  private slots: PlayerSlot[] = [];
  private rematchVotes = new Set<string>();
  private gameStarted = false;
  private lastMove: LastMove | null = null;

  constructor(readonly room: Party.Room) {}

  private send(conn: Party.Connection, msg: ServerMsg) {
    conn.send(JSON.stringify(msg));
  }

  private broadcast(msg: ServerMsg, without?: string[]) {
    this.room.broadcast(JSON.stringify(msg), without);
  }

  onConnect(conn: Party.Connection) {
    if (this.gameStarted) {
      // ── Game in progress: only allow reconnects ──────────────────────────
      const disconnected = this.slots.find((s) => !s.connected);
      if (disconnected) {
        // Pre-assign disconnected player's color; wait for 'join' to confirm
        this.send(conn, { type: "assigned", color: disconnected.color });
      } else {
        this.send(conn, { type: "room_full" });
      }
      return;
    }

    // ── Game not started: accept new players freely ──────────────────────────
    const connectedCount = this.slots.filter((s) => s.connected).length;
    if (connectedCount >= 2) {
      this.send(conn, { type: "room_full" });
      return;
    }

    const color: Player = this.slots.length === 0 ? "white" : "black";
    this.slots.push({ id: conn.id, name: "Anonymous", color, joined: false, connected: true });
    this.send(conn, { type: "assigned", color });
  }

  onMessage(message: string, sender: Party.Connection) {
    let msg: { type: string; [k: string]: unknown };
    try {
      msg = JSON.parse(message as string);
    } catch {
      return;
    }

    switch (msg.type) {
      case "join": {
        const name = (msg.name as string) || "Anonymous";
        const existingSlot = this.slots.find((s) => s.id === sender.id);

        if (!existingSlot) {
          // Only valid during an in-progress game reconnect
          if (!this.gameStarted) return;
          const disconnected = this.slots.find((s) => !s.connected);
          if (!disconnected) return;

          disconnected.id = sender.id;
          disconnected.name = name;
          disconnected.connected = true;

          this.send(sender, { type: "assigned", color: disconnected.color });
          this.send(sender, {
            type: "start",
            players: this.slots.map((s) => ({ name: s.name, color: s.color })),
            gameState: this.gameState,
          });
          this.broadcast({ type: "opponent_rejoined", name }, [sender.id]);
          break;
        }

        existingSlot.name = name;
        existingSlot.joined = true;

        const bothReady = this.slots.length === 2 && this.slots.every((s) => s.joined);
        if (bothReady && !this.gameStarted) {
          this.gameStarted = true;
          this.gameState = createInitialState();
          this.broadcast({
            type: "start",
            players: this.slots.map((s) => ({ name: s.name, color: s.color })),
            gameState: this.gameState,
          });
        } else {
          this.send(sender, { type: "waiting" });
        }
        break;
      }

      case "move": {
        const slot = this.slots.find((s) => s.id === sender.id);
        if (!slot || this.slots.filter((s) => s.connected).length < 2) return;
        if (this.gameState.currentTurn !== slot.color) return;
        if (this.gameState.winner !== null) return;

        const fromRow = msg.fromRow as number;
        const fromCol = msg.fromCol as number;
        const toRow   = msg.toRow   as number;
        const toCol   = msg.toCol   as number;

        const legal = getValidMoves(this.gameState, fromRow, fromCol);
        if (!legal.some(([r, c]) => r === toRow && c === toCol)) {
          this.send(sender, { type: "error", reason: "invalid_move" });
          return;
        }

        this.lastMove = { fromRow, fromCol, toRow, toCol };
        this.gameState = applyMove(this.gameState, fromRow, fromCol, toRow, toCol);
        this.broadcast({ type: "sync", gameState: this.gameState, lastMove: this.lastMove });
        break;
      }

      case "rematch": {
        this.rematchVotes.add(sender.id);
        if (this.rematchVotes.size >= 2) {
          this.gameState = createInitialState();
          this.lastMove = null;
          this.rematchVotes.clear();
          this.gameStarted = true;
          this.slots = this.slots.map((s) => ({
            ...s,
            color: s.color === "white" ? "black" : "white",
          }));
          this.broadcast({
            type: "start",
            players: this.slots.map((s) => ({ name: s.name, color: s.color })),
            gameState: this.gameState,
          });
        } else {
          this.broadcast({ type: "rematch_vote" }, [sender.id]);
        }
        break;
      }
    }
  }

  onClose(conn: Party.Connection) {
    const slot = this.slots.find((s) => s.id === conn.id);
    if (!slot) return;

    if (this.gameStarted) {
      // Keep slot for reconnect
      slot.connected = false;
      this.broadcast({ type: "opponent_left" }, [conn.id]);
    } else {
      // Before game starts — free the slot so others can join
      this.slots = this.slots.filter((s) => s.id !== conn.id);
      if (this.slots.length > 0) {
        this.broadcast({ type: "opponent_left" }, [conn.id]);
      }
    }
  }
}
