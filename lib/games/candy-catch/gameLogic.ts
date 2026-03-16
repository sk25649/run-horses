// Candy Catch — game state, physics, scoring

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface FallingItem {
  id: number;
  x: number;       // 0–100 (percentage of game width)
  y: number;       // 0–100 (percentage of game height)
  speed: number;   // % per tick
  type: 'candy' | 'bomb';
  emoji: string;
  points: number;
  active: boolean;
}

export interface GameState {
  phase: 'idle' | 'playing' | 'gameover';
  score: number;
  lives: number;
  catchCount: number;   // total catches (used to track speed increases)
  level: number;        // current speed level
  items: FallingItem[];
  lastCatch: { emoji: string; points: number; key: number } | null;
  basketX: number;      // 0–100 (center of basket)
  difficulty: Difficulty;
}

let nextId = 1;

const CANDY_EMOJIS = ['🍬', '🍭', '🍫', '🧁', '🍡', '🍦', '🍩'];
const BOMB_EMOJI = '💣';

const DIFFICULTY_CONFIG = {
  easy:   { baseSpeed: 0.35, bombChance: 0.12, spawnInterval: 1400, pointsMultiplier: 1 },
  medium: { baseSpeed: 0.55, bombChance: 0.22, spawnInterval: 1100, pointsMultiplier: 2 },
  hard:   { baseSpeed: 0.80, bombChance: 0.35, spawnInterval: 850,  pointsMultiplier: 3 },
};

export function createInitialState(difficulty: Difficulty = 'easy'): GameState {
  return {
    phase: 'idle',
    score: 0,
    lives: 3,
    catchCount: 0,
    level: 1,
    items: [],
    lastCatch: null,
    basketX: 50,
    difficulty,
  };
}

export function getSpawnInterval(state: GameState): number {
  const base = DIFFICULTY_CONFIG[state.difficulty].spawnInterval;
  // Speed up every 10 catches — reduce interval
  const speedup = Math.min(state.catchCount / 10, 8); // max 8x speedup factor
  return Math.max(400, base - speedup * 60);
}

export function spawnItem(state: GameState): GameState {
  const cfg = DIFFICULTY_CONFIG[state.difficulty];
  const isBomb = Math.random() < cfg.bombChance + (state.level - 1) * 0.015;
  const speedMultiplier = 1 + (state.level - 1) * 0.08;
  const newItem: FallingItem = {
    id: nextId++,
    x: 5 + Math.random() * 90,
    y: -6,
    speed: (cfg.baseSpeed + Math.random() * 0.15) * speedMultiplier,
    type: isBomb ? 'bomb' : 'candy',
    emoji: isBomb ? BOMB_EMOJI : CANDY_EMOJIS[Math.floor(Math.random() * CANDY_EMOJIS.length)],
    points: isBomb ? 0 : (10 + Math.floor(Math.random() * 5)) * cfg.pointsMultiplier,
    active: true,
  };
  return { ...state, items: [...state.items, newItem] };
}

export function tickItems(state: GameState): GameState {
  const updated = state.items.map(item => ({
    ...item,
    y: item.y + item.speed,
  })).filter(item => item.y < 110); // remove items that fell off screen
  return { ...state, items: updated };
}

export function moveBasket(state: GameState, newX: number): GameState {
  const clamped = Math.max(5, Math.min(95, newX));
  return { ...state, basketX: clamped };
}

// Returns updated state after checking collisions
// basketWidth: 12% of screen width on each side
export function checkCollisions(state: GameState, basketWidth = 10): GameState {
  const BASKET_Y = 87; // % from top
  let { score, lives, catchCount, level, lastCatch } = state;
  let hitBomb = false;
  let catchInfo: { emoji: string; points: number } | undefined;

  const items = state.items.map(item => {
    if (!item.active) return item;
    // Check if item is at basket height
    if (item.y >= BASKET_Y - 3 && item.y <= BASKET_Y + 6) {
      // Check horizontal overlap
      const dx = Math.abs(item.x - state.basketX);
      if (dx < basketWidth) {
        if (item.type === 'bomb') {
          hitBomb = true;
          return { ...item, active: false };
        } else {
          score += item.points;
          catchCount += 1;
          catchInfo = { emoji: item.emoji, points: item.points };
          return { ...item, active: false };
        }
      }
    }
    return item;
  }).filter(item => item.active);

  // Level up every 10 catches
  level = Math.floor(catchCount / 10) + 1;

  if (hitBomb) {
    lives -= 1;
  }

  if (catchInfo != null) {
    lastCatch = { emoji: catchInfo.emoji, points: catchInfo.points, key: Date.now() };
  }

  const phase = lives <= 0 ? 'gameover' : state.phase;

  return { ...state, score, lives, catchCount, level, items, lastCatch, phase };
}

export function startGame(state: GameState): GameState {
  nextId = 1;
  return {
    ...state,
    phase: 'playing',
    score: 0,
    lives: 3,
    catchCount: 0,
    level: 1,
    items: [],
    lastCatch: null,
    basketX: 50,
  };
}

export function endGame(state: GameState): GameState {
  return { ...state, phase: 'gameover', items: [] };
}
