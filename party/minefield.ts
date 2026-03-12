import type * as Party from 'partykit/server';
import { BaseGameServer } from '../lib/multiplayer/baseServer';
import {
  createInitialState,
  applyMove,
  applyMinePlacement,
  getValidMoves,
  isForbiddenForMine,
  MINE_COUNT,
} from '../lib/games/minefield/gameLogic';
import type { GameState, Player } from '../lib/games/minefield/gameLogic';

export default class MinefieldServer extends BaseGameServer {
  private _state: GameState = createInitialState();
  private _whiteMines: [number, number][] = [];
  private _blackMines: [number, number][] = [];

  // ── BaseGameServer abstract methods ───────────────────────────────────────
  createInitialState(): GameState { return createInitialState(); }
  getGameState(): GameState { return this._state; }

  setGameState(state: unknown): void {
    const prevHints = this._state.hints;
    this._state = state as GameState;
    // On game start / rematch (reset to initial placement phase), clear stored mines
    if (this._state.phase === 'placement' && !this._state.whitePlaced && !this._state.blackPlaced) {
      this._state = { ...this._state, hints: prevHints }; // preserve host's hints preference
      this._whiteMines = [];
      this._blackMines = [];
    }
  }

  handleMove(
    _fromRow: number,
    _fromCol: number,
    toRow: number,
    toCol: number,
    playerColor: string,
  ): boolean {
    const player = playerColor as Player;
    if (this._state.phase !== 'moving') return false;
    if (this._state.currentTurn !== player) return false;
    if (this._state.winner !== null) return false;

    const valid = getValidMoves(this._state, player);
    if (!valid.some(([r, c]) => r === toRow && c === toCol)) return false;

    const { state, newWhiteMines, newBlackMines } = applyMove(
      this._state, player, toRow, toCol, this._whiteMines, this._blackMines,
    );
    this._state = state;
    this._whiteMines = newWhiteMines;
    this._blackMines = newBlackMines;
    return true;
  }

  protected getColors(): [string, string] { return ['white', 'black']; }

  // ── Override onMessage to handle mine placement ───────────────────────────
  onMessage(message: string, sender: Party.Connection) {
    let msg: { type: string; [k: string]: unknown };
    try { msg = JSON.parse(message as string); } catch { return; }

    if (msg.type === 'set_hints') {
      // Only the host (white/slot 0) can set this, and only before the game starts
      if (this.gameStarted) return;
      const slot = this.slots.find(s => s.id === sender.id);
      if (!slot || slot.color !== 'white') return;
      this._state = { ...this._state, hints: Boolean(msg.value) };
      this.broadcast({
        type: 'sync',
        gameState: this._state,
        lastMove: null,
      } as unknown as Parameters<typeof this.broadcast>[0]);
      return;
    }

    if (msg.type === 'place_mines') {
      if (!this.gameStarted) return;
      const slot = this.slots.find(s => s.id === sender.id);
      if (!slot) return;

      const positions = msg.positions as [number, number][];

      // Validate
      if (!Array.isArray(positions) || positions.length !== MINE_COUNT) return;
      if (positions.some(([r, c]) => isForbiddenForMine(r, c))) return;
      const posSet = new Set(positions.map(([r, c]) => `${r},${c}`));
      if (posSet.size !== MINE_COUNT) return;

      // Store and mark placed
      if (slot.color === 'white') {
        this._whiteMines = positions;
        this._state = applyMinePlacement(this._state, 'white');
      } else {
        this._blackMines = positions;
        this._state = applyMinePlacement(this._state, 'black');
      }

      // Broadcast updated public state (no mine positions)
      this.broadcast({
        type: 'sync',
        gameState: this._state,
        lastMove: null,
      } as unknown as Parameters<typeof this.broadcast>[0]);
      return;
    }

    // Delegate standard messages (join, move, rematch) to base class
    super.onMessage(message, sender);
  }
}
