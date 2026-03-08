import { describe, it, expect } from 'vitest';
import {
  getTerrain,
  rowLabel,
  colLabel,
  createInitialState,
  getValidMoves,
  canLJump,
  applyMove,
  selectCell,
  getBestAIMove,
  OASIS,
  ROWS,
  COLS,
  GARDEN_CELLS,
  type GameState,
  type Board,
} from '../gameLogic';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function stateWith(board: Board, currentTurn: GameState['currentTurn'] = 'white'): GameState {
  return { board, currentTurn, selectedCell: null, validMoves: [], winner: null };
}

function placePiece(board: Board, row: number, col: number, player: 'white' | 'black', id = 'p1'): Board {
  const b = board.map(r => [...r]);
  b[row][col] = { player, id };
  return b;
}

// ─── getTerrain ───────────────────────────────────────────────────────────────

describe('getTerrain', () => {
  it('returns oasis at [5,5]', () => {
    expect(getTerrain(5, 5)).toBe('oasis');
  });

  it('returns garden for every GARDEN_CELLS entry', () => {
    for (const [r, c] of GARDEN_CELLS) {
      expect(getTerrain(r, c)).toBe('garden');
    }
  });

  it('returns desert for corners', () => {
    expect(getTerrain(0, 0)).toBe('desert');
    expect(getTerrain(0, 10)).toBe('desert');
    expect(getTerrain(10, 0)).toBe('desert');
    expect(getTerrain(10, 10)).toBe('desert');
  });

  it('returns desert for cells not oasis or garden', () => {
    expect(getTerrain(0, 5)).toBe('desert');
    expect(getTerrain(5, 0)).toBe('desert');
    expect(getTerrain(3, 3)).toBe('desert');
  });
});

// ─── rowLabel / colLabel ──────────────────────────────────────────────────────

describe('rowLabel', () => {
  it('maps 0 → a, 10 → k', () => {
    expect(rowLabel(0)).toBe('a');
    expect(rowLabel(5)).toBe('f');
    expect(rowLabel(10)).toBe('k');
  });
});

describe('colLabel', () => {
  it('maps 0 → "1", 10 → "11"', () => {
    expect(colLabel(0)).toBe('1');
    expect(colLabel(5)).toBe('6');
    expect(colLabel(10)).toBe('11');
  });
});

// ─── createInitialState ───────────────────────────────────────────────────────

describe('createInitialState', () => {
  const state = createInitialState();

  it('creates an 11×11 board', () => {
    expect(state.board.length).toBe(ROWS);
    state.board.forEach(row => expect(row.length).toBe(COLS));
  });

  it('places exactly 12 white pieces', () => {
    const whites = state.board.flat().filter(p => p?.player === 'white');
    expect(whites).toHaveLength(12);
  });

  it('places exactly 12 black pieces', () => {
    const blacks = state.board.flat().filter(p => p?.player === 'black');
    expect(blacks).toHaveLength(12);
  });

  it('starts with white to move', () => {
    expect(state.currentTurn).toBe('white');
  });

  it('has no winner initially', () => {
    expect(state.winner).toBeNull();
  });

  it('starts with no selection', () => {
    expect(state.selectedCell).toBeNull();
    expect(state.validMoves).toHaveLength(0);
  });

  it('places white pieces in top-left corner', () => {
    expect(state.board[0][0]?.player).toBe('white'); // a1
    expect(state.board[0][1]?.player).toBe('white'); // a2
    expect(state.board[2][0]?.player).toBe('white'); // c1
  });

  it('places white pieces in bottom-right corner', () => {
    expect(state.board[8][10]?.player).toBe('white'); // i11
    expect(state.board[10][10]?.player).toBe('white'); // k11
  });

  it('places black pieces in bottom-left corner', () => {
    expect(state.board[8][0]?.player).toBe('black'); // i1
    expect(state.board[10][2]?.player).toBe('black'); // k3
  });

  it('places black pieces in top-right corner', () => {
    expect(state.board[0][8]?.player).toBe('black'); // a9
    expect(state.board[2][10]?.player).toBe('black'); // c11
  });

  it('oasis cell is empty', () => {
    expect(state.board[OASIS[0]][OASIS[1]]).toBeNull();
  });
});

// ─── canLJump ─────────────────────────────────────────────────────────────────

describe('canLJump', () => {
  it('returns true for desert cells', () => {
    expect(canLJump(0, 0)).toBe(true);
    expect(canLJump(3, 3)).toBe(true);
  });

  it('returns false for garden cells', () => {
    expect(canLJump(4, 4)).toBe(false);
    expect(canLJump(6, 5)).toBe(false);
  });

  it('returns false for oasis', () => {
    expect(canLJump(5, 5)).toBe(false);
  });
});

// ─── getValidMoves ────────────────────────────────────────────────────────────

describe('getValidMoves', () => {
  it('returns empty array for empty cell', () => {
    const state = stateWith(emptyBoard());
    expect(getValidMoves(state, 0, 0)).toHaveLength(0);
  });

  it("returns empty array for opponent's piece", () => {
    const board = placePiece(emptyBoard(), 0, 0, 'black');
    const state = stateWith(board, 'white');
    expect(getValidMoves(state, 0, 0)).toHaveLength(0);
  });

  describe('L-Jump', () => {
    it('generates up to 8 L-jumps from desert center', () => {
      // Put white piece at [5,0] (desert) — plenty of space around it
      const board = placePiece(emptyBoard(), 5, 0, 'white');
      const state = stateWith(board, 'white');
      const moves = getValidMoves(state, 5, 0);
      // Should include L-jump destinations that are in-bounds desert cells
      const lJumps = moves.filter(([r, c]) => {
        const dr = Math.abs(r - 5), dc = Math.abs(c - 0);
        return (dr === 2 && dc === 1) || (dr === 1 && dc === 2);
      });
      expect(lJumps.length).toBeGreaterThan(0);
    });

    it('does NOT generate L-jumps from a garden cell', () => {
      // [4,4] is garden
      const board = placePiece(emptyBoard(), 4, 4, 'white');
      const state = stateWith(board, 'white');
      const moves = getValidMoves(state, 4, 4);
      const lJumps = moves.filter(([r, c]) => {
        const dr = Math.abs(r - 4), dc = Math.abs(c - 4);
        return (dr === 2 && dc === 1) || (dr === 1 && dc === 2);
      });
      expect(lJumps).toHaveLength(0);
    });

    it('does NOT land L-jump on garden cell', () => {
      // [3,3] is desert; [4,4] is garden — the L-jump (+1,+1) doesn't apply,
      // but [3,3]+(-2,+1)=[1,4] desert is fine. Test a specific case:
      // [2,4] is desert; L-jump to [4,5] would land on garden — should be excluded
      const board = placePiece(emptyBoard(), 2, 4, 'white');
      const state = stateWith(board, 'white');
      const moves = getValidMoves(state, 2, 4);
      // [4,5] is garden — must not be a valid move
      const landOnGarden = moves.some(([r, c]) => getTerrain(r, c) !== 'desert');
      expect(landOnGarden).toBe(false);
    });

    it('does not L-jump onto occupied cell', () => {
      const board = placePiece(emptyBoard(), 0, 0, 'white');
      const b2 = placePiece(board, 2, 1, 'white', 'p2'); // blocks one L-jump
      const state = stateWith(b2, 'white');
      const moves = getValidMoves(state, 0, 0);
      const blocked = moves.some(([r, c]) => r === 2 && c === 1);
      expect(blocked).toBe(false);
    });
  });

  describe('Slide', () => {
    it('slides horizontally to board edge when no blockers', () => {
      const board = placePiece(emptyBoard(), 0, 5, 'white');
      const state = stateWith(board, 'white');
      const moves = getValidMoves(state, 0, 5);
      expect(moves).toContainEqual([0, 0]); // slide left to edge
      expect(moves).toContainEqual([0, 10]); // slide right to edge
    });

    it('slides vertically to board edge when no blockers', () => {
      const board = placePiece(emptyBoard(), 5, 0, 'white');
      const state = stateWith(board, 'white');
      const moves = getValidMoves(state, 5, 0);
      expect(moves).toContainEqual([0, 0]); // slide up to edge
      expect(moves).toContainEqual([10, 0]); // slide down to edge
    });

    it('stops slide before a blocking piece', () => {
      let board = placePiece(emptyBoard(), 0, 0, 'white');
      board = placePiece(board, 0, 3, 'black', 'b1'); // blocker at col 3
      const state = stateWith(board, 'white');
      const moves = getValidMoves(state, 0, 0);
      expect(moves).toContainEqual([0, 2]); // stops at col 2
      // Must not jump over the blocker
      const overBlocker = moves.some(([r, c]) => r === 0 && c > 3);
      expect(overBlocker).toBe(false);
    });

    it('stops slide before own blocking piece', () => {
      let board = placePiece(emptyBoard(), 0, 0, 'white');
      board = placePiece(board, 0, 4, 'white', 'p2');
      const state = stateWith(board, 'white');
      const moves = getValidMoves(state, 0, 0);
      expect(moves).toContainEqual([0, 3]);
      const overOwn = moves.some(([r, c]) => r === 0 && c >= 4);
      expect(overOwn).toBe(false);
    });

    it('does not slide when blocked immediately', () => {
      let board = placePiece(emptyBoard(), 0, 0, 'white');
      board = placePiece(board, 0, 1, 'black', 'b1'); // immediate right block
      board = placePiece(board, 1, 0, 'black', 'b2'); // immediate down block
      const state = stateWith(board, 'white');
      const moves = getValidMoves(state, 0, 0);
      // No right or down slide possible; no left or up (at edge)
      const slides = moves.filter(([r, c]) => {
        const dr = Math.abs(r - 0), dc = Math.abs(c - 0);
        return dr === 0 || dc === 0; // cardinal
      });
      expect(slides).toHaveLength(0);
    });

    it('can slide onto garden or oasis cells', () => {
      // Piece at [5,0] slides right — oasis at [5,5]
      const board = placePiece(emptyBoard(), 5, 0, 'white');
      const state = stateWith(board, 'white');
      const moves = getValidMoves(state, 5, 0);
      // Should slide all the way to [5,10] (no blockers), passing through oasis
      expect(moves).toContainEqual([5, 10]);
    });
  });
});

// ─── applyMove ────────────────────────────────────────────────────────────────

describe('applyMove', () => {
  it('moves piece from source to destination', () => {
    const board = placePiece(emptyBoard(), 0, 0, 'white');
    const state = stateWith(board, 'white');
    const next = applyMove(state, 0, 0, 0, 5);
    expect(next.board[0][5]?.player).toBe('white');
    expect(next.board[0][0]).toBeNull();
  });

  it('swaps turn after move', () => {
    const board = placePiece(emptyBoard(), 0, 0, 'white');
    const state = stateWith(board, 'white');
    const next = applyMove(state, 0, 0, 0, 5);
    expect(next.currentTurn).toBe('black');
  });

  it('swaps turn back to white after black moves', () => {
    const board = placePiece(emptyBoard(), 0, 0, 'black');
    const state = stateWith(board, 'black');
    const next = applyMove(state, 0, 0, 0, 5);
    expect(next.currentTurn).toBe('white');
  });

  it('detects winner when piece reaches oasis', () => {
    const board = placePiece(emptyBoard(), 5, 0, 'white');
    const state = stateWith(board, 'white');
    const next = applyMove(state, 5, 0, OASIS[0], OASIS[1]);
    expect(next.winner).toBe('white');
  });

  it('detects black winner at oasis', () => {
    const board = placePiece(emptyBoard(), 5, 0, 'black');
    const state = stateWith(board, 'black');
    const next = applyMove(state, 5, 0, OASIS[0], OASIS[1]);
    expect(next.winner).toBe('black');
  });

  it('no winner for non-oasis destination', () => {
    const board = placePiece(emptyBoard(), 0, 0, 'white');
    const state = stateWith(board, 'white');
    const next = applyMove(state, 0, 0, 0, 5);
    expect(next.winner).toBeNull();
  });

  it('clears selectedCell and validMoves after move', () => {
    const board = placePiece(emptyBoard(), 0, 0, 'white');
    const state: GameState = { ...stateWith(board, 'white'), selectedCell: [0, 0], validMoves: [[0, 5]] };
    const next = applyMove(state, 0, 0, 0, 5);
    expect(next.selectedCell).toBeNull();
    expect(next.validMoves).toHaveLength(0);
  });

  it('returns original state if no piece at source', () => {
    const state = stateWith(emptyBoard(), 'white');
    const next = applyMove(state, 0, 0, 0, 5);
    expect(next).toBe(state);
  });
});

// ─── selectCell ───────────────────────────────────────────────────────────────

describe('selectCell', () => {
  it('selects own piece and computes valid moves', () => {
    const board = placePiece(emptyBoard(), 0, 0, 'white');
    const state = stateWith(board, 'white');
    const next = selectCell(state, 0, 0);
    expect(next.selectedCell).toEqual([0, 0]);
    expect(next.validMoves.length).toBeGreaterThan(0);
  });

  it('ignores click on empty cell with no selection', () => {
    const state = stateWith(emptyBoard(), 'white');
    const next = selectCell(state, 3, 3);
    expect(next).toBe(state);
  });

  it('ignores click on opponent piece with no selection', () => {
    const board = placePiece(emptyBoard(), 0, 0, 'black');
    const state = stateWith(board, 'white');
    const next = selectCell(state, 0, 0);
    expect(next).toBe(state);
  });

  it('executes move when clicking a valid destination', () => {
    const board = placePiece(emptyBoard(), 0, 0, 'white');
    const state: GameState = { ...stateWith(board, 'white'), selectedCell: [0, 0], validMoves: [[0, 5]] };
    const next = selectCell(state, 0, 5);
    expect(next.board[0][5]?.player).toBe('white');
    expect(next.board[0][0]).toBeNull();
  });

  it('reselects when clicking another own piece', () => {
    let board = placePiece(emptyBoard(), 0, 0, 'white');
    board = placePiece(board, 0, 5, 'white', 'p2');
    const state: GameState = { ...stateWith(board, 'white'), selectedCell: [0, 0], validMoves: [] };
    const next = selectCell(state, 0, 5);
    expect(next.selectedCell).toEqual([0, 5]);
  });

  it('deselects when clicking empty cell', () => {
    const board = placePiece(emptyBoard(), 0, 0, 'white');
    const state: GameState = { ...stateWith(board, 'white'), selectedCell: [0, 0], validMoves: [] };
    const next = selectCell(state, 5, 5);
    expect(next.selectedCell).toBeNull();
    expect(next.validMoves).toHaveLength(0);
  });

  it('does nothing if there is already a winner', () => {
    const board = placePiece(emptyBoard(), 0, 0, 'white');
    const state: GameState = { ...stateWith(board, 'white'), winner: 'white' };
    const next = selectCell(state, 0, 0);
    expect(next).toBe(state);
  });
});

// ─── getBestAIMove ────────────────────────────────────────────────────────────

describe('getBestAIMove', () => {
  it('returns null when it is not black\'s turn', () => {
    const board = placePiece(emptyBoard(), 0, 0, 'black');
    const state = stateWith(board, 'white');
    expect(getBestAIMove(state)).toBeNull();
  });

  it('returns null when there is already a winner', () => {
    const board = placePiece(emptyBoard(), 0, 0, 'black');
    const state: GameState = { ...stateWith(board, 'black'), winner: 'white' };
    expect(getBestAIMove(state)).toBeNull();
  });

  it('returns null when black has no moves', () => {
    // Completely empty board — no black pieces
    const state = stateWith(emptyBoard(), 'black');
    expect(getBestAIMove(state)).toBeNull();
  });

  it('easy: returns a valid move from available moves', () => {
    const board = placePiece(emptyBoard(), 0, 3, 'black');
    const state = stateWith(board, 'black');
    const move = getBestAIMove(state, 'easy');
    expect(move).not.toBeNull();
    const validDests = getValidMoves(state, 0, 3).map(([r, c]) => `${r},${c}`);
    expect(validDests).toContain(`${move!.toRow},${move!.toCol}`);
    expect(move!.fromRow).toBe(0);
    expect(move!.fromCol).toBe(3);
  });

  it('medium: takes an instant win move', () => {
    // Blocker at [5,6] makes the slide from [5,0] stop at [5,5] = oasis
    let board = placePiece(emptyBoard(), 5, 0, 'black');
    board = placePiece(board, 5, 6, 'white', 'w1');
    const state = stateWith(board, 'black');
    const move = getBestAIMove(state, 'medium');
    expect(move).not.toBeNull();
    expect(move!.toRow).toBe(OASIS[0]);
    expect(move!.toCol).toBe(OASIS[1]);
  });

  it('hard: takes an instant win move', () => {
    let board = placePiece(emptyBoard(), 5, 0, 'black');
    board = placePiece(board, 5, 6, 'white', 'w1');
    const state = stateWith(board, 'black');
    const move = getBestAIMove(state, 'hard');
    expect(move).not.toBeNull();
    expect(move!.toRow).toBe(OASIS[0]);
    expect(move!.toCol).toBe(OASIS[1]);
  });

  it('medium: returned move is from a black piece', () => {
    const board = placePiece(emptyBoard(), 0, 3, 'black');
    const state = stateWith(board, 'black');
    const move = getBestAIMove(state, 'medium');
    expect(move).not.toBeNull();
    expect(state.board[move!.fromRow][move!.fromCol]?.player).toBe('black');
  });

  it('hard: returned move is from a black piece', () => {
    const board = placePiece(emptyBoard(), 0, 3, 'black');
    const state = stateWith(board, 'black');
    const move = getBestAIMove(state, 'hard');
    expect(move).not.toBeNull();
    expect(state.board[move!.fromRow][move!.fromCol]?.player).toBe('black');
  });
});

// ─── Integration: full turn sequence ─────────────────────────────────────────

describe('Full turn sequence', () => {
  it('white selects, moves, black selects, moves', () => {
    let board = placePiece(emptyBoard(), 0, 0, 'white');
    board = placePiece(board, 10, 10, 'black', 'b1');
    let state = stateWith(board, 'white');

    // White selects piece
    state = selectCell(state, 0, 0);
    expect(state.selectedCell).toEqual([0, 0]);

    // White moves right
    state = selectCell(state, 0, 10);
    expect(state.board[0][10]?.player).toBe('white');
    expect(state.currentTurn).toBe('black');

    // Black selects piece
    state = selectCell(state, 10, 10);
    expect(state.selectedCell).toEqual([10, 10]);

    // Black moves left
    state = selectCell(state, 10, 0);
    expect(state.board[10][0]?.player).toBe('black');
    expect(state.currentTurn).toBe('white');
  });

  it('game ends when white reaches oasis', () => {
    // Blocker at [5,6] makes slide from [5,0] stop at oasis [5,5]
    let board = placePiece(emptyBoard(), 5, 0, 'white');
    board = placePiece(board, 5, 6, 'black', 'b1');
    let state = stateWith(board, 'white');
    state = selectCell(state, 5, 0);
    state = selectCell(state, 5, 5); // oasis
    expect(state.winner).toBe('white');
    // Further clicks have no effect
    const frozen = selectCell(state, 5, 5);
    expect(frozen).toBe(state);
  });

  it('game ends when black reaches oasis', () => {
    // Blocker at [5,4] makes slide from [5,10] stop at oasis [5,5]
    let board = placePiece(emptyBoard(), 5, 10, 'black');
    board = placePiece(board, 5, 4, 'white', 'w1');
    let state = stateWith(board, 'black');
    state = selectCell(state, 5, 10);
    state = selectCell(state, 5, 5); // oasis
    expect(state.winner).toBe('black');
  });
});
