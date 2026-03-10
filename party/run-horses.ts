import { BaseGameServer } from '../lib/multiplayer/baseServer';
import { applyMove, createInitialState, getValidMoves } from '../lib/games/run-horses/gameLogic';
import type { GameState, Player } from '../lib/games/run-horses/gameLogic';

export default class RunHorsesServer extends BaseGameServer {
  private _gameState: GameState = createInitialState();

  createInitialState(): GameState {
    return createInitialState();
  }

  getGameState(): GameState {
    return this._gameState;
  }

  setGameState(state: unknown): void {
    this._gameState = state as GameState;
  }

  handleMove(
    fromRow: number,
    fromCol: number,
    toRow: number,
    toCol: number,
    playerColor: string,
  ): boolean {
    if (this._gameState.currentTurn !== playerColor) return false;
    if (this._gameState.winner !== null) return false;

    const legal = getValidMoves(this._gameState, fromRow, fromCol);
    if (!legal.some(([r, c]) => r === toRow && c === toCol)) return false;

    this._gameState = applyMove(this._gameState, fromRow, fromCol, toRow, toCol);
    return true;
  }

  protected getColors(): [string, string] {
    return ['white', 'black'];
  }
}
