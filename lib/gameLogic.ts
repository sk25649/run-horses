// ─── Types ────────────────────────────────────────────────────────────────────
export type Terrain = 'oasis' | 'garden' | 'desert';
export type Player = 'white' | 'black';

export interface Piece {
  player: Player;
  id: string;
}

export type Board = (Piece | null)[][];

export interface GameState {
  board: Board;
  currentTurn: Player;
  selectedCell: [number, number] | null;
  validMoves: [number, number][];
  winner: Player | null;
}

// ─── Board constants ──────────────────────────────────────────────────────────
export const ROWS = 11;
export const COLS = 11;
// Row a=0 .. k=10  |  Col 1=0 .. 11=10

// f6 → row f=5, col 6=5
export const OASIS: [number, number] = [5, 5];

// Garden (diamond) tiles
export const GARDEN_CELLS: [number, number][] = [
  [3, 5], // d6
  [7, 5], // h6
  [4, 4], // e5
  [4, 5], // e6
  [4, 6], // e7
  [5, 3], // f4
  [5, 4], // f5
  [5, 6], // f7
  [5, 7], // f8
  [6, 4], // g5
  [6, 5], // g6
  [6, 6], // g7
];

const _gardenSet = new Set(GARDEN_CELLS.map(([r, c]) => `${r},${c}`));

export function getTerrain(row: number, col: number): Terrain {
  if (row === OASIS[0] && col === OASIS[1]) return 'oasis';
  if (_gardenSet.has(`${row},${col}`)) return 'garden';
  return 'desert';
}

export function rowLabel(row: number): string {
  return String.fromCharCode(97 + row); // a=0 … k=10
}
export function colLabel(col: number): string {
  return String(col + 1); // 0 → "1"
}

// ─── Initial state ────────────────────────────────────────────────────────────
export function createInitialState(): GameState {
  const board: Board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));

  // White starts at row k (10)
  board[10][2] = { player: 'white', id: 'w1' };
  board[10][8] = { player: 'white', id: 'w2' };

  // Black starts at row a (0)
  board[0][2] = { player: 'black', id: 'b1' };
  board[0][8] = { player: 'black', id: 'b2' };

  return { board, currentTurn: 'white', selectedCell: null, validMoves: [], winner: null };
}

// ─── Movement ────────────────────────────────────────────────────────────────
const inBounds = (r: number, c: number) => r >= 0 && r < ROWS && c >= 0 && c < COLS;

export function getValidMoves(state: GameState, row: number, col: number): [number, number][] {
  const piece = state.board[row][col];
  if (!piece || piece.player !== state.currentTurn) return [];

  const occupied = (r: number, c: number) => state.board[r][c] !== null;
  const moves: [number, number][] = [];
  const terrain = getTerrain(row, col);

  // ── L-Jump: only from Desert ───────────────────────────────────────────────
  if (terrain === 'desert') {
    const offsets = [[-2,-1],[-2,1],[2,-1],[2,1],[-1,-2],[-1,2],[1,-2],[1,2]];
    for (const [dr, dc] of offsets) {
      const nr = row + dr, nc = col + dc;
      if (inBounds(nr, nc) && !occupied(nr, nc)) {
        moves.push([nr, nc]);
      }
    }
  }

  // ── Horizontal Slide: all terrain ─────────────────────────────────────────
  for (let c = col - 1; c >= 0; c--) {
    if (occupied(row, c)) break;
    moves.push([row, c]);
  }
  for (let c = col + 1; c < COLS; c++) {
    if (occupied(row, c)) break;
    moves.push([row, c]);
  }

  return moves;
}

export function canLJump(row: number, col: number): boolean {
  return getTerrain(row, col) === 'desert';
}

// ─── State transitions ────────────────────────────────────────────────────────
export function applyMove(
  state: GameState,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
): GameState {
  const piece = state.board[fromRow][fromCol];
  if (!piece) return state;

  const newBoard = state.board.map(r => [...r]);
  newBoard[toRow][toCol] = piece;
  newBoard[fromRow][fromCol] = null;

  const winner =
    toRow === OASIS[0] && toCol === OASIS[1] ? piece.player : null;

  return {
    board: newBoard,
    currentTurn: state.currentTurn === 'white' ? 'black' : 'white',
    selectedCell: null,
    validMoves: [],
    winner,
  };
}

export function selectCell(state: GameState, row: number, col: number): GameState {
  if (state.winner) return state;
  const piece = state.board[row][col];

  // If a piece is selected and we click a valid destination → move
  if (state.selectedCell) {
    const isValid = state.validMoves.some(([r, c]) => r === row && c === col);
    if (isValid) {
      return applyMove(state, state.selectedCell[0], state.selectedCell[1], row, col);
    }
    // Click own piece → reselect
    if (piece && piece.player === state.currentTurn) {
      const validMoves = getValidMoves(state, row, col);
      return { ...state, selectedCell: [row, col], validMoves };
    }
    // Click elsewhere → deselect
    return { ...state, selectedCell: null, validMoves: [] };
  }

  // No selection yet – select own piece
  if (piece && piece.player === state.currentTurn) {
    const validMoves = getValidMoves(state, row, col);
    return { ...state, selectedCell: [row, col], validMoves };
  }

  return state;
}
