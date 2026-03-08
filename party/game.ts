import type * as Party from "partykit/server";
import { applyMove, createInitialState, getValidMoves } from "../lib/gameLogic";
import type { GameState, Player } from "../lib/gameLogic";

interface PlayerSlot {
  id: string;
  name: string;
  color: Player;
  joined: boolean;
}

type ServerMsg =
  | { type: "assigned"; color: Player }
  | { type: "waiting" }
  | { type: "start"; players: { name: string; color: Player }[]; gameState: GameState }
  | { type: "sync"; gameState: GameState }
  | { type: "opponent_left" }
  | { type: "rematch_vote" }
  | { type: "room_full" }
  | { type: "error"; reason: string };

export default class GameServer implements Party.Server {
  private gameState: GameState = createInitialState();
  private slots: PlayerSlot[] = [];
  private rematchVotes = new Set<string>();
  private gameStarted = false;

  constructor(readonly room: Party.Room) {}

  private send(conn: Party.Connection, msg: ServerMsg) {
    conn.send(JSON.stringify(msg));
  }

  private broadcast(msg: ServerMsg, without?: string[]) {
    this.room.broadcast(JSON.stringify(msg), without);
  }

  onConnect(conn: Party.Connection) {
    if (this.slots.length >= 2) {
      this.send(conn, { type: "room_full" });
      return;
    }
    const color: Player = this.slots.length === 0 ? "white" : "black";
    this.slots.push({ id: conn.id, name: "Anonymous", color, joined: false });
    this.send(conn, { type: "assigned", color });
    this.send(conn, { type: "waiting" });
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
        const slot = this.slots.find((s) => s.id === sender.id);
        if (!slot) return;
        slot.name = (msg.name as string) || "Anonymous";
        slot.joined = true;

        const bothReady =
          this.slots.length === 2 && this.slots.every((s) => s.joined);
        if (bothReady) {
          if (!this.gameStarted) {
            this.gameStarted = true;
            this.gameState = createInitialState();
          }
          this.broadcast({
            type: "start",
            players: this.slots.map((s) => ({ name: s.name, color: s.color })),
            gameState: this.gameState,
          });
        }
        break;
      }

      case "move": {
        const slot = this.slots.find((s) => s.id === sender.id);
        if (!slot || this.slots.length < 2) return;
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

        this.gameState = applyMove(this.gameState, fromRow, fromCol, toRow, toCol);
        this.broadcast({ type: "sync", gameState: this.gameState });
        break;
      }

      case "rematch": {
        this.rematchVotes.add(sender.id);
        if (this.rematchVotes.size >= 2) {
          this.gameState = createInitialState();
          this.rematchVotes.clear();
          // Swap colors for fairness
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
    this.slots = this.slots.filter((s) => s.id !== conn.id);
    this.gameStarted = false;
    this.broadcast({ type: "opponent_left" }, [conn.id]);
  }
}
