// ─── Types ────────────────────────────────────────────────────────────────────
export type Player = 'white' | 'black';
export type GameMode = 'pvp' | 'ai' | 'online';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type GamePhase = 'placement' | 'moving' | 'finished';

export interface CellState {
  stepped: boolean;
  adjacentCount: number; // valid when stepped=true
  steppedBy: Player | null;
  exploded: boolean; // mine was triggered here (mine removed)
}

export interface TreasureState {
  pos: [number, number];
  collected: boolean;
  collectedBy: Player | null;
  value: number; // 10, 15, or 20 based on collection order
}

export type MoveResult =
  | { type: 'safe'; adjacentCount: number; points: number }
  | { type: 'mine'; points: number; returnCell: [number, number] }
  | { type: 'treasure'; value: number; points: number };

// Public game state — safe to broadcast in online mode (no mine positions)
export interface GameState {
  phase: GamePhase;
  whitePlaced: boolean;
  blackPlaced: boolean;
  positions: { white: [number, number]; black: [number, number] };
  scores: { white: number; black: number };
  currentTurn: Player;
  cells: CellState[][];
  treasures: TreasureState[];
  minesRemaining: number; // public info per rules
  winner: Player | 'draw' | null;
  moveCount: number;
  lastMoveResult: MoveResult | null;
}

export interface AIMove { toRow: number; toCol: number }

// ─── Board constants ──────────────────────────────────────────────────────────
export const ROWS = 11;
export const COLS = 11;
export const MINE_COUNT = 15;

export const WHITE_START: [number, number] = [0, 0];
export const BLACK_START: [number, number] = [10, 10];

// Treasure positions — order determines base value assignment
export const TREASURE_POSITIONS: [number, number][] = [
  [5, 5],  // center
  [0, 10], // top-right corner
  [10, 0], // bottom-left corner
];

// Points awarded in order of collection (1st, 2nd, 3rd)
export const TREASURE_VALUES = [10, 15, 20];

const DIRS_8: [number, number][] = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
];

// ─── Placement rules ──────────────────────────────────────────────────────────
export function isForbiddenForMine(row: number, col: number): boolean {
  if (TREASURE_POSITIONS.some(([r, c]) => r === row && c === col)) return true;
  if (Math.abs(row - WHITE_START[0]) + Math.abs(col - WHITE_START[1]) <= 2) return true;
  if (Math.abs(row - BLACK_START[0]) + Math.abs(col - BLACK_START[1]) <= 2) return true;
  return false;
}

export function getValidMineCells(): [number, number][] {
  const valid: [number, number][] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (!isForbiddenForMine(r, c)) valid.push([r, c]);
  return valid;
}

// ─── Initial state ────────────────────────────────────────────────────────────
export function createInitialState(): GameState {
  const cells: CellState[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({
      stepped: false,
      adjacentCount: 0,
      steppedBy: null,
      exploded: false,
    }))
  );

  const treasures: TreasureState[] = TREASURE_POSITIONS.map(pos => ({
    pos,
    collected: false,
    collectedBy: null,
    value: 0,
  }));

  return {
    phase: 'placement',
    whitePlaced: false,
    blackPlaced: false,
    positions: { white: [WHITE_START[0], WHITE_START[1]], black: [BLACK_START[0], BLACK_START[1]] },
    scores: { white: 0, black: 0 },
    currentTurn: 'white',
    cells,
    treasures,
    minesRemaining: MINE_COUNT * 2,
    winner: null,
    moveCount: 0,
    lastMoveResult: null,
  };
}

// ─── Mine helpers ─────────────────────────────────────────────────────────────
// Count total mines in the 8 cells adjacent to (row,col)
// A cell with 2 mines (one per player) counts as 2
export function countAdjacentMines(
  whiteMines: [number, number][],
  blackMines: [number, number][],
  row: number,
  col: number,
  cells?: CellState[][],
): number {
  const wSet = new Set(whiteMines.map(([r, c]) => `${r},${c}`));
  const bSet = new Set(blackMines.map(([r, c]) => `${r},${c}`));
  let count = 0;
  for (const [dr, dc] of DIRS_8) {
    const nr = row + dr, nc = col + dc;
    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
    const key = `${nr},${nc}`;
    if (wSet.has(key) || bSet.has(key)) {
      count++;
    } else if (cells?.[nr][nc].exploded) {
      // Mine was already detonated — still counts toward adjacency
      count++;
    }
  }
  return count;
}

function minesAt(
  whiteMines: [number, number][],
  blackMines: [number, number][],
  row: number,
  col: number,
): { total: number; fromWhite: boolean; fromBlack: boolean } {
  const fromWhite = whiteMines.some(([r, c]) => r === row && c === col);
  const fromBlack = blackMines.some(([r, c]) => r === row && c === col);
  return { total: (fromWhite ? 1 : 0) + (fromBlack ? 1 : 0), fromWhite, fromBlack };
}

// ─── Return cell after mine hit ───────────────────────────────────────────────
export function getReturnCell(
  positions: { white: [number, number]; black: [number, number] },
  player: Player,
): [number, number] {
  const start = player === 'white' ? WHITE_START : BLACK_START;
  const opp = positions[player === 'white' ? 'black' : 'white'];

  // Try start cell first
  if (opp[0] !== start[0] || opp[1] !== start[1]) {
    return [start[0], start[1]];
  }
  // Start is occupied — try adjacent cells
  for (const [dr, dc] of DIRS_8) {
    const r = start[0] + dr, c = start[1] + dc;
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
    if (r === opp[0] && c === opp[1]) continue;
    return [r, c];
  }
  return [start[0], start[1]];
}

// ─── Valid moves ──────────────────────────────────────────────────────────────
export function getValidMoves(state: GameState, player: Player): [number, number][] {
  if (state.phase !== 'moving') return [];
  if (state.currentTurn !== player) return [];
  if (state.winner !== null) return [];

  const pos = state.positions[player];
  const opp = state.positions[player === 'white' ? 'black' : 'white'];
  const moves: [number, number][] = [];

  for (const [dr, dc] of DIRS_8) {
    const r = pos[0] + dr, c = pos[1] + dc;
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
    if (r === opp[0] && c === opp[1]) continue;
    moves.push([r, c]);
  }
  return moves;
}

// ─── Apply move ───────────────────────────────────────────────────────────────
export function applyMove(
  state: GameState,
  player: Player,
  toRow: number,
  toCol: number,
  whiteMines: [number, number][],
  blackMines: [number, number][],
): {
  state: GameState;
  result: MoveResult;
  newWhiteMines: [number, number][];
  newBlackMines: [number, number][];
} {
  const cells = state.cells.map(row => row.map(cell => ({ ...cell })));
  const treasures = state.treasures.map(t => ({ ...t }));
  const scores = { ...state.scores };
  let newWhiteMines = [...whiteMines];
  let newBlackMines = [...blackMines];
  let result: MoveResult;
  let newPos: [number, number] = [toRow, toCol];

  const { total: mineCount, fromWhite, fromBlack } = minesAt(whiteMines, blackMines, toRow, toCol);

  if (mineCount > 0) {
    // Mine detonated
    scores[player] -= 5;
    if (fromWhite) newWhiteMines = newWhiteMines.filter(([r, c]) => !(r === toRow && c === toCol));
    if (fromBlack) newBlackMines = newBlackMines.filter(([r, c]) => !(r === toRow && c === toCol));

    cells[toRow][toCol].exploded = true;
    cells[toRow][toCol].stepped = true;
    cells[toRow][toCol].steppedBy = player;

    newPos = getReturnCell(state.positions, player);
    result = { type: 'mine', points: -5, returnCell: newPos };
  } else {
    // Check for treasure
    const collectedSoFar = treasures.filter(t => t.collected).length;
    const tIdx = treasures.findIndex(t => !t.collected && t.pos[0] === toRow && t.pos[1] === toCol);

    if (tIdx >= 0) {
      const value = TREASURE_VALUES[collectedSoFar] ?? 20;
      treasures[tIdx] = { ...treasures[tIdx], collected: true, collectedBy: player, value };
      scores[player] += value;
      // Mark stepped so the cell can never score again
      cells[toRow][toCol].stepped = true;
      cells[toRow][toCol].steppedBy = player;
      result = { type: 'treasure', value, points: value };
    } else {
      // Safe cell — score only if not already stepped by anyone
      const adj = countAdjacentMines(newWhiteMines, newBlackMines, toRow, toCol, state.cells);
      const points = cells[toRow][toCol].stepped ? 0 : adj;
      scores[player] += points;
      cells[toRow][toCol].adjacentCount = adj;
      cells[toRow][toCol].stepped = true;
      cells[toRow][toCol].steppedBy = player;
      result = { type: 'safe', adjacentCount: adj, points };
    }
  }

  // Check game-end: all 3 treasures collected
  const allCollected = treasures.every(t => t.collected);
  let winner: Player | 'draw' | null = null;
  let phase = state.phase;
  if (allCollected) {
    phase = 'finished';
    winner = scores.white > scores.black ? 'white' : scores.black > scores.white ? 'black' : 'draw';
  }

  const newState: GameState = {
    ...state,
    phase,
    positions: { ...state.positions, [player]: newPos },
    scores,
    currentTurn: state.currentTurn === 'white' ? 'black' : 'white',
    cells,
    treasures,
    minesRemaining: newWhiteMines.length + newBlackMines.length,
    winner,
    moveCount: state.moveCount + 1,
    lastMoveResult: result,
  };

  return { state: newState, result, newWhiteMines, newBlackMines };
}

// ─── Apply mine placement confirmation ───────────────────────────────────────
export function applyMinePlacement(state: GameState, player: Player): GameState {
  const next = { ...state };
  if (player === 'white') next.whitePlaced = true;
  else next.blackPlaced = true;

  if (next.whitePlaced && next.blackPlaced) {
    next.phase = 'moving';
    next.currentTurn = 'white';
    next.minesRemaining = MINE_COUNT * 2;
  }
  return next;
}

// ─── AI: Mine placement ───────────────────────────────────────────────────────
function computeThreatScores(opponentStart: [number, number]): number[][] {
  const scores = Array.from({ length: ROWS }, () => Array(COLS).fill(0) as number[]);
  for (const [tr, tc] of TREASURE_POSITIONS) {
    const [sr, sc] = opponentStart;
    const direct = Math.abs(tr - sr) + Math.abs(tc - sc);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (isForbiddenForMine(r, c)) continue;
        const via = Math.abs(r - sr) + Math.abs(c - sc) + Math.abs(tr - r) + Math.abs(tc - c);
        if (via === direct) scores[r][c] += 3;
        else if (via <= direct + 2) scores[r][c] += 1;
      }
    }
  }
  return scores;
}

export function getBestAIMineLayout(aiPlayer: Player, difficulty: Difficulty): [number, number][] {
  const opponentStart = aiPlayer === 'black' ? WHITE_START : BLACK_START;
  const validCells = getValidMineCells();

  if (difficulty === 'easy') {
    return [...validCells].sort(() => Math.random() - 0.5).slice(0, MINE_COUNT);
  }

  const threat = computeThreatScores(opponentStart);
  const noise = difficulty === 'hard' ? 0 : 2;
  const scored = validCells.map(([r, c]) => ({
    pos: [r, c] as [number, number],
    score: threat[r][c] + Math.random() * noise,
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, MINE_COUNT).map(x => x.pos);
}

// ─── AI: Movement ─────────────────────────────────────────────────────────────
function estimateDanger(state: GameState, row: number, col: number, ownMines: [number, number][]): number {
  if (ownMines.some(([r, c]) => r === row && c === col)) return 1; // certain — own mine
  if (state.cells[row][col].stepped) return 0; // already safe
  let total = 0, count = 0;
  for (const [dr, dc] of DIRS_8) {
    const nr = row + dr, nc = col + dc;
    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
    const cell = state.cells[nr][nc];
    if (cell.stepped && !cell.exploded && cell.adjacentCount > 0) {
      total += cell.adjacentCount / 8;
      count++;
    }
  }
  return count === 0 ? 0.05 : Math.min(total / count, 1);
}

function moveCellValue(state: GameState, row: number, col: number, ownMines: [number, number][]): number {
  if (ownMines.some(([r, c]) => r === row && c === col)) return -200;
  const treasure = state.treasures.find(t => !t.collected && t.pos[0] === row && t.pos[1] === col);
  if (treasure) {
    const orderVal = TREASURE_VALUES[state.treasures.filter(t => t.collected).length] ?? 20;
    return orderVal * 8;
  }
  if (state.cells[row][col].stepped) return -1;
  // Estimate potential adjacency score
  let est = 0;
  for (const [dr, dc] of DIRS_8) {
    const nr = row + dr, nc = col + dc;
    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
    const cell = state.cells[nr][nc];
    if (cell.stepped && !cell.exploded) est += cell.adjacentCount / 8;
  }
  return est;
}

export function getBestAIMove(
  state: GameState,
  aiPlayer: Player,
  aiMines: [number, number][],
  difficulty: Difficulty,
): AIMove | null {
  if (state.phase !== 'moving') return null;
  if (state.currentTurn !== aiPlayer) return null;
  if (state.winner !== null) return null;

  const moves = getValidMoves(state, aiPlayer);
  if (moves.length === 0) return null;

  if (difficulty === 'easy') {
    const safe = moves.filter(([r, c]) => !aiMines.some(([mr, mc]) => mr === r && mc === c));
    const pool = safe.length > 0 ? safe : moves;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    return { toRow: pick[0], toCol: pick[1] };
  }

  const dangerWeight = difficulty === 'hard' ? 18 : 10;
  const scored = moves.map(([r, c]) => ({
    pos: [r, c] as [number, number],
    score: moveCellValue(state, r, c, aiMines) - estimateDanger(state, r, c, aiMines) * dangerWeight + Math.random() * 0.3,
  }));

  // Filter own mines as definite avoids
  const safe = scored.filter(x => !aiMines.some(([r, c]) => r === x.pos[0] && c === x.pos[1]));
  const pool = safe.length > 0 ? safe : scored;
  pool.sort((a, b) => b.score - a.score);

  if (difficulty === 'medium') {
    const pick = pool[Math.floor(Math.random() * Math.min(3, pool.length))];
    return { toRow: pick.pos[0], toCol: pick.pos[1] };
  }
  return { toRow: pool[0].pos[0], toCol: pool[0].pos[1] };
}
