import type * as Party from "partykit/server";
import {
  GameState,
  Player,
  createInitialState,
  applyMove,
  getValidMoves,
} from "../lib/gameLogic";

type ServerMessage =
  | { type: "state"; gameState: GameState; white: boolean; black: boolean; roomId: string }
  | { type: "assigned"; color: Player; roomId: string }
  | { type: "error"; message: string }
  | { type: "opponent-connected" }
  | { type: "opponent-disconnected" };

type ClientMessage =
  | { type: "move"; fromRow: number; fromCol: number; toRow: number; toCol: number }
  | { type: "reset" };

export default class GameRoom implements Party.Server {
  gameState: GameState;
  players: Map<string, Player> = new Map();

  constructor(readonly room: Party.Room) {
    this.gameState = createInitialState();
  }

  private broadcast(msg: ServerMessage, exclude?: string) {
    const data = JSON.stringify(msg);
    for (const conn of this.room.getConnections()) {
      if (conn.id !== exclude) conn.send(data);
    }
  }

  private sendTo(id: string, msg: ServerMessage) {
    const conn = this.room.getConnection(id);
    conn?.send(JSON.stringify(msg));
  }

  private stateMsg(): ServerMessage {
    const colors = [...this.players.values()];
    return {
      type: "state",
      gameState: { ...this.gameState, selectedCell: null, validMoves: [] },
      white: colors.includes("white"),
      black: colors.includes("black"),
      roomId: this.room.id,
    };
  }

  onConnect(conn: Party.Connection) {
    // Assign color
    const taken = new Set(this.players.values());
    let color: Player | null = null;
    if (!taken.has("white")) color = "white";
    else if (!taken.has("black")) color = "black";

    if (!color) {
      this.sendTo(conn.id, { type: "error", message: "Room is full" });
      conn.close();
      return;
    }

    this.players.set(conn.id, color);
    this.sendTo(conn.id, { type: "assigned", color, roomId: this.room.id });
    this.sendTo(conn.id, this.stateMsg());

    // Notify the other player
    this.broadcast({ type: "opponent-connected" }, conn.id);
  }

  onMessage(raw: string, sender: Party.Connection) {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === "move") {
      const color = this.players.get(sender.id);
      if (!color || color !== this.gameState.currentTurn) {
        this.sendTo(sender.id, { type: "error", message: "Not your turn" });
        return;
      }

      // Validate the move
      const { fromRow, fromCol, toRow, toCol } = msg;
      const piece = this.gameState.board[fromRow]?.[fromCol];
      if (!piece || piece.player !== color) {
        this.sendTo(sender.id, { type: "error", message: "Invalid piece" });
        return;
      }

      const valid = getValidMoves(this.gameState, fromRow, fromCol);
      if (!valid.some(([r, c]) => r === toRow && c === toCol)) {
        this.sendTo(sender.id, { type: "error", message: "Invalid move" });
        return;
      }

      this.gameState = applyMove(this.gameState, fromRow, fromCol, toRow, toCol);

      // Broadcast new state to all
      const stateMsg = this.stateMsg();
      for (const conn of this.room.getConnections()) {
        conn.send(JSON.stringify(stateMsg));
      }
    }

    if (msg.type === "reset") {
      if (!this.gameState.winner) return; // only allow reset after game ends
      this.gameState = createInitialState();
      const stateMsg = this.stateMsg();
      for (const conn of this.room.getConnections()) {
        conn.send(JSON.stringify(stateMsg));
      }
    }
  }

  onClose(conn: Party.Connection) {
    this.players.delete(conn.id);
    this.broadcast({ type: "opponent-disconnected" });
  }
}

GameRoom satisfies Party.Worker;
