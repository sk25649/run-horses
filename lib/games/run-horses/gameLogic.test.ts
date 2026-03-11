import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  getValidMoves,
  applyMove,
  selectCell,
  getTerrain,
  canLJump,
  getBestAIMove,
  rowLabel,
  colLabel,
  OASIS,
  ROWS,
  COLS,
  GARDEN_CELLS,
  type GameState,
  type Board,
} from './gameLogic';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function stateWith(overrides: Partial<GameState>): GameState {
  return { ...createInitialState(), selectedCell: null, validMoves: [], ...overrides };
}

// ─── Board constants ──────────────────────────────────────────────────────────

describe('getTerrain', () => {
  it('returns oasis for center [5,5]', () => {
    expect(getTerrain(5, 5)).toBe('oasis');
  });

  it('returns garden for all 12 garden cells', () => {
    for (const [r, c] of GARDEN_CELLS) {
      expect(getTerrain(r, c)).toBe('garden');
    }
  });

  it('returns desert for non-special cells', () => {
    expect(getTerrain(0, 0)).toBe('desert');
    expect(getTerrain(10, 10)).toBe('desert');
    expect(getTerrain(3, 0)).toBe('desert');
  });
});

describe('canLJump', () => {
  it('returns false for the oasis tile', () => {
    expect(canLJump(5, 5)).toBe(false);
  });

  it('returns true for any non-oasis tile', () => {
    expect(canLJump(0, 0)).toBe(true);
    expect(canLJump(3, 5)).toBe(true); // garden
    expect(canLJump(10, 10)).toBe(true);
  });
});

describe('rowLabel / colLabel', () => {
  it('maps row 0 → a, row 10 → k', () => {
    expect(rowLabel(0)).toBe('a');
    expect(rowLabel(10)).toBe('k');
  });

  it('maps col 0 → "1", col 10 → "11"', () => {
    expect(colLabel(0)).toBe('1');
    expect(colLabel(10)).toBe('11');
  });
});

// ─── createInitialState ───────────────────────────────────────────────────────

describe('createInitialState', () => {
  it('starts with white turn', () => {
    expect(createInitialState().currentTurn).toBe('white');
  });

  it('places 12 white and 12 black pieces', () => {
    const state = createInitialState();
    let white = 0, black = 0;
    for (const row of state.board) {
      for (const cell of row) {
        if (cell?.player === 'white') white++;
        if (cell?.player === 'black') black++;
      }
    }
    expect(white).toBe(12);
    expect(black).toBe(12);
  });

  it('has no winner and zero moves', () => {
    const state = createInitialState();
    expect(state.winner).toBeNull();
    expect(state.moveCount).toBe(0);
  });

  it('oasis starts empty', () => {
    const state = createInitialState();
    expect(state.board[OASIS[0]][OASIS[1]]).toBeNull();
  });
});

// ─── getValidMoves ────────────────────────────────────────────────────────────

describe('getValidMoves', () => {
  it('returns empty array for wrong player', () => {
    const state = createInitialState(); // white's turn
    const moves = getValidMoves(state, 0, 8); // black piece
    expect(moves).toHaveLength(0);
  });

  it('returns empty array for empty cell', () => {
    const state = createInitialState();
    const moves = getValidMoves(state, 5, 5); // oasis is empty
    expect(moves).toHaveLength(0);
  });

  it('slide stops at board edge when nothing in the way', () => {
    const board = emptyBoard();
    board[5][0] = { player: 'white', id: 'w1' };
    const state = stateWith({ board, currentTurn: 'white' });
    const moves = getValidMoves(state, 5, 0);
    // Can slide right to col 10 (whole row empty), down to row 10, up to row 0
    expect(moves).toContainEqual([5, 10]);
    expect(moves).toContainEqual([10, 0]);
    expect(moves).toContainEqual([0, 0]);
  });

  it('slide is blocked by the first piece in the way', () => {
    const board = emptyBoard();
    board[5][0] = { player: 'white', id: 'w1' };
    board[5][4] = { player: 'black', id: 'b1' }; // blocker at col 4
    const state = stateWith({ board, currentTurn: 'white' });
    const moves = getValidMoves(state, 5, 0);
    // Should stop at col 3, not reach col 10
    expect(moves).toContainEqual([5, 3]);
    expect(moves).not.toContainEqual([5, 4]);
    expect(moves).not.toContainEqual([5, 10]);
  });

  it('L-jump destinations must be desert tiles', () => {
    const board = emptyBoard();
    board[5][0] = { player: 'white', id: 'w1' };
    const state = stateWith({ board, currentTurn: 'white' });
    const moves = getValidMoves(state, 5, 0);
    const lJumps = moves.filter(([r, c]) => {
      const dr = Math.abs(r - 5), dc = Math.abs(c - 0);
      return (dr === 2 && dc === 1) || (dr === 1 && dc === 2);
    });
    for (const [r, c] of lJumps) {
      expect(getTerrain(r, c)).toBe('desert');
    }
  });

  it('cannot L-jump to occupied cell', () => {
    const board = emptyBoard();
    board[5][0] = { player: 'white', id: 'w1' };
    board[3][1] = { player: 'black', id: 'b1' }; // L-jump target
    const state = stateWith({ board, currentTurn: 'white' });
    const moves = getValidMoves(state, 5, 0);
    expect(moves).not.toContainEqual([3, 1]);
  });
});

// ─── applyMove ────────────────────────────────────────────────────────────────

describe('applyMove', () => {
  it('moves piece from source to destination', () => {
    const board = emptyBoard();
    board[5][0] = { player: 'white', id: 'w1' };
    const state = stateWith({ board, currentTurn: 'white' });
    const next = applyMove(state, 5, 0, 5, 5);
    expect(next.board[5][5]).toEqual({ player: 'white', id: 'w1' });
    expect(next.board[5][0]).toBeNull();
  });

  it('advances moveCount', () => {
    const board = emptyBoard();
    board[5][0] = { player: 'white', id: 'w1' };
    const state = stateWith({ board, currentTurn: 'white' });
    const next = applyMove(state, 5, 0, 5, 5);
    expect(next.moveCount).toBe(1);
  });

  it('switches turn after move', () => {
    const board = emptyBoard();
    board[5][0] = { player: 'white', id: 'w1' };
    const state = stateWith({ board, currentTurn: 'white' });
    const next = applyMove(state, 5, 0, 5, 3);
    expect(next.currentTurn).toBe('black');
  });

  it('declares winner when piece lands on oasis', () => {
    const board = emptyBoard();
    board[5][0] = { player: 'white', id: 'w1' };
    const state = stateWith({ board, currentTurn: 'white' });
    const next = applyMove(state, 5, 0, OASIS[0], OASIS[1]);
    expect(next.winner).toBe('white');
  });

  it('no winner for non-oasis destination', () => {
    const board = emptyBoard();
    board[5][0] = { player: 'white', id: 'w1' };
    const state = stateWith({ board, currentTurn: 'white' });
    const next = applyMove(state, 5, 0, 5, 3);
    expect(next.winner).toBeNull();
  });

  it('returns same state for missing piece', () => {
    const state = createInitialState();
    const next = applyMove(state, 5, 5, 5, 6); // oasis is empty
    expect(next).toBe(state);
  });

  it('clears selectedCell after move', () => {
    const board = emptyBoard();
    board[5][0] = { player: 'white', id: 'w1' };
    const state = stateWith({ board, currentTurn: 'white', selectedCell: [5, 0], validMoves: [[5, 3]] });
    const next = applyMove(state, 5, 0, 5, 3);
    expect(next.selectedCell).toBeNull();
    expect(next.validMoves).toHaveLength(0);
  });
});

// ─── selectCell ───────────────────────────────────────────────────────────────

describe('selectCell', () => {
  it('selects own piece and populates validMoves', () => {
    const board = emptyBoard();
    board[5][0] = { player: 'white', id: 'w1' };
    const state = stateWith({ board, currentTurn: 'white' });
    const next = selectCell(state, 5, 0);
    expect(next.selectedCell).toEqual([5, 0]);
    expect(next.validMoves.length).toBeGreaterThan(0);
  });

  it('does not select opponent piece', () => {
    const state = createInitialState(); // white turn
    const blackPos = [0, 8] as [number, number]; // black piece in initial state
    const next = selectCell(state, blackPos[0], blackPos[1]);
    expect(next.selectedCell).toBeNull();
  });

  it('moves piece when clicking valid destination', () => {
    const board = emptyBoard();
    board[5][0] = { player: 'white', id: 'w1' };
    const validMoves: [number, number][] = [[5, 5]];
    const state = stateWith({ board, currentTurn: 'white', selectedCell: [5, 0], validMoves });
    const next = selectCell(state, 5, 5);
    expect(next.board[5][5]).toEqual({ player: 'white', id: 'w1' });
    expect(next.winner).toBe('white');
  });

  it('reselects another own piece when one is already selected', () => {
    const board = emptyBoard();
    board[5][0] = { player: 'white', id: 'w1' };
    board[5][2] = { player: 'white', id: 'w2' };
    const state = stateWith({ board, currentTurn: 'white', selectedCell: [5, 0], validMoves: [] });
    const next = selectCell(state, 5, 2);
    expect(next.selectedCell).toEqual([5, 2]);
  });

  it('deselects when clicking invalid destination', () => {
    const board = emptyBoard();
    board[5][0] = { player: 'white', id: 'w1' };
    const state = stateWith({ board, currentTurn: 'white', selectedCell: [5, 0], validMoves: [[5, 3]] });
    const next = selectCell(state, 3, 3); // not a valid move
    expect(next.selectedCell).toBeNull();
  });

  it('does nothing when game is already won', () => {
    const board = emptyBoard();
    board[5][0] = { player: 'white', id: 'w1' };
    const state = stateWith({ board, currentTurn: 'white', winner: 'white' });
    const next = selectCell(state, 5, 0);
    expect(next).toBe(state);
  });
});

// ─── win condition ────────────────────────────────────────────────────────────

describe('win condition', () => {
  it('white wins by reaching the oasis', () => {
    const board = emptyBoard();
    board[5][1] = { player: 'white', id: 'w1' };
    const state = stateWith({ board, currentTurn: 'white', selectedCell: [5, 1], validMoves: [[5, 5]] });
    const next = selectCell(state, 5, 5);
    expect(next.winner).toBe('white');
  });

  it('black wins by reaching the oasis', () => {
    const board = emptyBoard();
    board[5][9] = { player: 'black', id: 'b1' };
    const state = stateWith({ board, currentTurn: 'black', selectedCell: [5, 9], validMoves: [[5, 5]] });
    const next = selectCell(state, 5, 5);
    expect(next.winner).toBe('black');
  });
});

// ─── getBestAIMove ────────────────────────────────────────────────────────────

describe('getBestAIMove', () => {
  it('returns null when it is not black\'s turn', () => {
    const state = createInitialState(); // white's turn
    expect(getBestAIMove(state, 'medium')).toBeNull();
  });

  it('returns null when game is already won', () => {
    const state = stateWith({ currentTurn: 'black', winner: 'white' });
    expect(getBestAIMove(state, 'medium')).toBeNull();
  });

  it('always takes an instant win (oasis reachable)', () => {
    const board = emptyBoard();
    // Black at [5,9], blocker at [5,4] → slide left stops at [5,5] = oasis
    board[5][9] = { player: 'black', id: 'b1' };
    board[5][4] = { player: 'white', id: 'w1' }; // blocker just left of oasis
    const state = stateWith({ board, currentTurn: 'black' });
    const move = getBestAIMove(state, 'medium');
    expect(move).not.toBeNull();
    expect(move!.toRow).toBe(OASIS[0]);
    expect(move!.toCol).toBe(OASIS[1]);
  });

  it('returns a valid move for medium difficulty', () => {
    const state = stateWith({ currentTurn: 'black', board: createInitialState().board });
    const move = getBestAIMove(state, 'medium');
    expect(move).not.toBeNull();
    const { fromRow, fromCol, toRow, toCol } = move!;
    expect(state.board[fromRow][fromCol]?.player).toBe('black');
    // Destination should be reachable
    const validMoves = getValidMoves(state, fromRow, fromCol);
    expect(validMoves).toContainEqual([toRow, toCol]);
  });

  it('returns a move for easy difficulty', () => {
    const state = stateWith({ currentTurn: 'black', board: createInitialState().board });
    const move = getBestAIMove(state, 'easy');
    expect(move).not.toBeNull();
  });

  it('returns a move for hard difficulty', () => {
    const state = stateWith({ currentTurn: 'black', board: createInitialState().board });
    const move = getBestAIMove(state, 'hard');
    expect(move).not.toBeNull();
  });
});

// ─── slide mechanics ─────────────────────────────────────────────────────────

describe('slide mechanics', () => {
  it('piece slides to last open cell, not through blockers', () => {
    const board = emptyBoard();
    board[0][3] = { player: 'white', id: 'w1' };
    board[0][7] = { player: 'black', id: 'b1' }; // blocker
    const state = stateWith({ board, currentTurn: 'white' });
    const moves = getValidMoves(state, 0, 3);
    // Can slide right up to col 6 (stops before col 7)
    expect(moves).toContainEqual([0, 6]);
    expect(moves).not.toContainEqual([0, 7]);
    // Can slide left to col 0
    expect(moves).toContainEqual([0, 0]);
  });

  it('no slide if immediately blocked on all sides', () => {
    const board = emptyBoard();
    board[1][1] = { player: 'white', id: 'w1' };
    board[1][0] = { player: 'black', id: 'b1' }; // left
    board[1][2] = { player: 'black', id: 'b2' }; // right
    board[0][1] = { player: 'black', id: 'b3' }; // up
    board[2][1] = { player: 'black', id: 'b4' }; // down
    const state = stateWith({ board, currentTurn: 'white' });
    const moves = getValidMoves(state, 1, 1);
    // Only L-jumps remain (no slides possible)
    for (const [r, c] of moves) {
      const dr = Math.abs(r - 1), dc = Math.abs(c - 1);
      const isLJump = (dr === 2 && dc === 1) || (dr === 1 && dc === 2);
      expect(isLJump).toBe(true);
    }
  });
});
