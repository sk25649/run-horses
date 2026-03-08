// ─── Types ────────────────────────────────────────────────────────────────────
export type Terrain = 'oasis' | 'garden' | 'desert';
export type Player = 'white' | 'black';
export type GameMode = 'pvp' | 'ai' | 'online';
export type Difficulty = 'easy' | 'medium' | 'hard' | 'impossible';

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
  moveCount: number;
}

export interface AIMove {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
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

  // White: a1,a2,a3,b1,b2,c1 (top-left) & i11,j10,j11,k9,k10,k11 (bottom-right)
  const whiteCells: [number, number][] = [
    [0,0],[0,1],[0,2],[1,0],[1,1],[2,0],
    [8,10],[9,9],[9,10],[10,8],[10,9],[10,10],
  ];
  whiteCells.forEach(([r, c], i) => { board[r][c] = { player: 'white', id: `w${i + 1}` }; });

  // Black: i1,j1,j2,k1,k2,k3 (bottom-left) & a9,a10,a11,b10,b11,c11 (top-right)
  const blackCells: [number, number][] = [
    [8,0],[9,0],[9,1],[10,0],[10,1],[10,2],
    [0,8],[0,9],[0,10],[1,9],[1,10],[2,10],
  ];
  blackCells.forEach(([r, c], i) => { board[r][c] = { player: 'black', id: `b${i + 1}` }; });

  return { board, currentTurn: 'white', selectedCell: null, validMoves: [], winner: null, moveCount: 0 };
}

// ─── Movement ────────────────────────────────────────────────────────────────
const inBounds = (r: number, c: number) => r >= 0 && r < ROWS && c >= 0 && c < COLS;

export function getValidMoves(state: GameState, row: number, col: number): [number, number][] {
  const piece = state.board[row][col];
  if (!piece || piece.player !== state.currentTurn) return [];

  const occupied = (r: number, c: number) => state.board[r][c] !== null;
  const moves: [number, number][] = [];
  const terrain = getTerrain(row, col);

  // ── L-Jump: destination must be Desert (source can be any tile) ──────────
  {
    const offsets = [[-2,-1],[-2,1],[2,-1],[2,1],[-1,-2],[-1,2],[1,-2],[1,2]];
    for (const [dr, dc] of offsets) {
      const nr = row + dr, nc = col + dc;
      if (inBounds(nr, nc) && !occupied(nr, nc) && getTerrain(nr, nc) === 'desert') {
        moves.push([nr, nc]);
      }
    }
  }

  // ── Horizontal Slide: end position only ──────────────────────────────────
  let lastC = col;
  for (let c = col - 1; c >= 0; c--) { if (occupied(row, c)) break; lastC = c; }
  if (lastC !== col) moves.push([row, lastC]);

  lastC = col;
  for (let c = col + 1; c < COLS; c++) { if (occupied(row, c)) break; lastC = c; }
  if (lastC !== col) moves.push([row, lastC]);

  // ── Vertical Slide: end position only ────────────────────────────────────
  let lastR = row;
  for (let r = row - 1; r >= 0; r--) { if (occupied(r, col)) break; lastR = r; }
  if (lastR !== row) moves.push([lastR, col]);

  lastR = row;
  for (let r = row + 1; r < ROWS; r++) { if (occupied(r, col)) break; lastR = r; }
  if (lastR !== row) moves.push([lastR, col]);

  return moves;
}

// Any piece can L-jump as long as there's a desert destination — always true for non-oasis tiles
export function canLJump(row: number, col: number): boolean {
  return getTerrain(row, col) !== 'oasis';
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
    moveCount: state.moveCount + 1,
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

// ─── AI: Minimax with alpha-beta pruning ─────────────────────────────────────

interface MoveCandidate {
  fromRow: number; fromCol: number;
  toRow:   number; toCol:   number;
}

function getAllMovesForState(state: GameState): MoveCandidate[] {
  const moves: MoveCandidate[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const piece = state.board[r][c];
      if (!piece || piece.player !== state.currentTurn) continue;
      for (const [tr, tc] of getValidMoves(state, r, c)) {
        moves.push({ fromRow: r, fromCol: c, toRow: tr, toCol: tc });
      }
    }
  }
  return moves;
}

/** True if the piece at (r,c) can slide directly to the oasis with no blockers */
function canReachOasis(board: Board, r: number, c: number): boolean {
  if (r === OASIS[0]) {
    const lo = Math.min(c, OASIS[1]) + 1, hi = Math.max(c, OASIS[1]);
    for (let cc = lo; cc < hi; cc++) if (board[r][cc] !== null) return false;
    return c !== OASIS[1];
  }
  if (c === OASIS[1]) {
    const lo = Math.min(r, OASIS[0]) + 1, hi = Math.max(r, OASIS[0]);
    for (let rr = lo; rr < hi; rr++) if (board[rr][c] !== null) return false;
    return r !== OASIS[0];
  }
  return false;
}

/**
 * Static evaluation — positive = good for black, negative = good for white.
 * Focuses on the *best* piece per side (the one closest to winning),
 * with bonuses for oasis-row/col alignment and immediate-win threats.
 */
function evaluate(state: GameState): number {
  if (state.winner === 'black') return  100_000;
  if (state.winner === 'white') return -100_000;

  let blackBest = -Infinity, whiteBest = -Infinity;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const piece = state.board[r][c];
      if (!piece) continue;
      const manhattan = Math.abs(r - OASIS[0]) + Math.abs(c - OASIS[1]);
      let s = 20 - manhattan;
      if (r === OASIS[0]) s += 8;
      if (c === OASIS[1]) s += 8;
      if (canReachOasis(state.board, r, c)) s += 60; // immediate win threat
      if (piece.player === 'black') blackBest = Math.max(blackBest, s);
      else                          whiteBest = Math.max(whiteBest, s);
    }
  }

  return (blackBest - whiteBest) * 10;
}

function minimax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
): number {
  if (state.winner !== null) return evaluate(state);
  if (depth === 0) return evaluate(state);

  const moves = getAllMovesForState(state);
  if (moves.length === 0) return evaluate(state);

  // Move ordering: winning moves and oasis-aligned moves first (improves pruning)
  moves.sort((a, b) => {
    const score = (m: MoveCandidate) => {
      if (m.toRow === OASIS[0] && m.toCol === OASIS[1]) return 1000;
      return (m.toRow === OASIS[0] || m.toCol === OASIS[1]) ? 10 : 0;
    };
    return score(b) - score(a);
  });

  if (state.currentTurn === 'black') {
    let best = -Infinity;
    for (const m of moves) {
      const val = minimax(applyMove(state, m.fromRow, m.fromCol, m.toRow, m.toCol), depth - 1, alpha, beta);
      if (val > best) best = val;
      if (val > alpha) alpha = val;
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const m of moves) {
      const val = minimax(applyMove(state, m.fromRow, m.fromCol, m.toRow, m.toCol), depth - 1, alpha, beta);
      if (val < best) best = val;
      if (val < beta) beta = val;
      if (beta <= alpha) break;
    }
    return best;
  }
}

// ─── Impossible AI ────────────────────────────────────────────────────────────

/** Sums ALL pieces' positional scores + multi-threat bonus. Positive = good for black. */
function evaluateImpossible(state: GameState): number {
  if (state.winner === 'black') return  100_000;
  if (state.winner === 'white') return -100_000;

  let score = 0;
  let blackThreats = 0, whiteThreats = 0;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const piece = state.board[r][c];
      if (!piece) continue;

      const manhattan = Math.abs(r - OASIS[0]) + Math.abs(c - OASIS[1]);
      let s = 30 - manhattan * 2;
      if (r === OASIS[0]) s += 15;
      if (c === OASIS[1]) s += 15;
      if (manhattan <= 2) s += 20;
      if (canReachOasis(state.board, r, c)) {
        s += 150;
        if (piece.player === 'black') blackThreats++;
        else                          whiteThreats++;
      }

      if (piece.player === 'black') score += s;
      else                          score -= s;
    }
  }

  if (blackThreats >= 2) score += 1000;
  if (whiteThreats >= 2) score -= 1000;

  return score;
}

/** Quiescence search — extends 2 extra plies in hot positions to prevent horizon effect. */
function quiescence(state: GameState, alpha: number, beta: number, depth: number): number {
  if (state.winner !== null) return evaluateImpossible(state);

  const standPat = evaluateImpossible(state);
  if (depth <= 0) return standPat;

  const moves = getAllMovesForState(state);
  const hot = moves.filter(m => m.toRow === OASIS[0] || m.toCol === OASIS[1]);
  if (hot.length === 0) return standPat;

  if (state.currentTurn === 'black') {
    let best = standPat;
    if (best >= beta) return best;
    alpha = Math.max(alpha, best);
    for (const m of hot) {
      const val = quiescence(applyMove(state, m.fromRow, m.fromCol, m.toRow, m.toCol), alpha, beta, depth - 1);
      if (val > best) best = val;
      if (val > alpha) alpha = val;
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = standPat;
    if (best <= alpha) return best;
    beta = Math.min(beta, best);
    for (const m of hot) {
      const val = quiescence(applyMove(state, m.fromRow, m.fromCol, m.toRow, m.toCol), alpha, beta, depth - 1);
      if (val < best) best = val;
      if (val < beta) beta = val;
      if (beta <= alpha) break;
    }
    return best;
  }
}

function minimaxImpossible(state: GameState, depth: number, alpha: number, beta: number): number {
  if (state.winner !== null) return evaluateImpossible(state);
  if (depth === 0) return quiescence(state, alpha, beta, 2);

  const moves = getAllMovesForState(state);
  if (moves.length === 0) return evaluateImpossible(state);

  moves.sort((a, b) => {
    const score = (m: MoveCandidate) => {
      if (m.toRow === OASIS[0] && m.toCol === OASIS[1]) return 10000;
      if (m.toRow === OASIS[0] || m.toCol === OASIS[1]) return 300;
      return 0;
    };
    return score(b) - score(a);
  });

  if (state.currentTurn === 'black') {
    let best = -Infinity;
    for (const m of moves) {
      const val = minimaxImpossible(applyMove(state, m.fromRow, m.fromCol, m.toRow, m.toCol), depth - 1, alpha, beta);
      if (val > best) best = val;
      if (val > alpha) alpha = val;
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const m of moves) {
      const val = minimaxImpossible(applyMove(state, m.fromRow, m.fromCol, m.toRow, m.toCol), depth - 1, alpha, beta);
      if (val < best) best = val;
      if (val < beta) beta = val;
      if (beta <= alpha) break;
    }
    return best;
  }
}

export function getBestAIMove(state: GameState, difficulty: Difficulty = 'medium'): AIMove | null {
  if (state.currentTurn !== 'black' || state.winner) return null;

  const moves = getAllMovesForState(state);
  if (moves.length === 0) return null;

  // Easy: random move
  if (difficulty === 'easy') {
    const pick = moves[Math.floor(Math.random() * moves.length)];
    return { fromRow: pick.fromRow, fromCol: pick.fromCol, toRow: pick.toRow, toCol: pick.toCol };
  }

  // Always take an instant win
  const winMove = moves.find(m => m.toRow === OASIS[0] && m.toCol === OASIS[1]);
  if (winMove) return { fromRow: winMove.fromRow, fromCol: winMove.fromCol, toRow: winMove.toRow, toCol: winMove.toCol };

  if (difficulty === 'impossible') {
    let bestMove: MoveCandidate | null = null;
    let bestVal = -Infinity;
    for (const move of moves) {
      const val = minimaxImpossible(
        applyMove(state, move.fromRow, move.fromCol, move.toRow, move.toCol),
        5, -Infinity, Infinity,
      );
      if (val > bestVal) { bestVal = val; bestMove = move; }
    }
    return bestMove
      ? { fromRow: bestMove.fromRow, fromCol: bestMove.fromCol, toRow: bestMove.toRow, toCol: bestMove.toCol }
      : null;
  }

  const depth = difficulty === 'hard' ? 4 : 2;

  let bestMove: MoveCandidate | null = null;
  let bestVal = -Infinity;

  for (const move of moves) {
    const val = minimax(
      applyMove(state, move.fromRow, move.fromCol, move.toRow, move.toCol),
      depth - 1, -Infinity, Infinity,
    );
    if (val > bestVal) { bestVal = val; bestMove = move; }
  }

  return bestMove
    ? { fromRow: bestMove.fromRow, fromCol: bestMove.fromCol, toRow: bestMove.toRow, toCol: bestMove.toCol }
    : null;
}
