// Candy Catch — game state, physics, scoring

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface FallingItem {
  id: number;
  x: number;       // 0–100 (percentage of game width)
  y: number;       // 0–100 (percentage of game height)
  speed: number;   // % per tick
  type: 'candy' | 'bomb' | 'star' | 'magnet' | 'wide' | 'heart' | 'mystery';
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

  // Combo system
  combo: number;
  maxCombo: number;
  comboMultiplier: number;
  lastComboBreak: number | null; // key for "COMBO BREAK!" flash

  // Power-ups
  activePowerups: { magnet: number | null; wide: number | null }; // null or expiry timestamp

  // Candy rain
  candyRain: { active: boolean; endsAt: number | null };
}

let nextId = 1;

const CANDY_EMOJIS = ['🍬', '🍭', '🍫', '🧁', '🍡', '🍦', '🍩'];
const BOMB_EMOJI = '💣';

const DIFFICULTY_CONFIG = {
  easy:   { baseSpeed: 0.35, bombChance: 0.12, spawnInterval: 1400, pointsMultiplier: 1 },
  medium: { baseSpeed: 0.55, bombChance: 0.22, spawnInterval: 1100, pointsMultiplier: 2 },
  hard:   { baseSpeed: 0.80, bombChance: 0.35, spawnInterval: 850,  pointsMultiplier: 3 },
};

function getComboMultiplier(combo: number): number {
  if (combo >= 10) return 4;
  if (combo >= 6) return 3;
  if (combo >= 3) return 2;
  return 1;
}

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
    combo: 0,
    maxCombo: 0,
    comboMultiplier: 1,
    lastComboBreak: null,
    activePowerups: { magnet: null, wide: null },
    candyRain: { active: false, endsAt: null },
  };
}

export function getSpawnInterval(state: GameState): number {
  const base = DIFFICULTY_CONFIG[state.difficulty].spawnInterval;
  // Speed up every 10 catches — reduce interval
  const speedup = Math.min(state.catchCount / 10, 8); // max 8x speedup factor
  const interval = Math.max(400, base - speedup * 60);
  // During candy rain: 4x faster spawning
  return state.candyRain.active ? Math.max(150, interval / 4) : interval;
}

export function spawnItem(state: GameState): GameState {
  const cfg = DIFFICULTY_CONFIG[state.difficulty];

  // During candy rain: only candy, no bombs
  if (state.candyRain.active) {
    const speedMultiplier = 1 + (state.level - 1) * 0.08;
    const newItem: FallingItem = {
      id: nextId++,
      x: 5 + Math.random() * 90,
      y: -6,
      speed: (cfg.baseSpeed + Math.random() * 0.15) * speedMultiplier,
      type: 'candy',
      emoji: CANDY_EMOJIS[Math.floor(Math.random() * CANDY_EMOJIS.length)],
      points: (10 + Math.floor(Math.random() * 5)) * cfg.pointsMultiplier,
      active: true,
    };
    return { ...state, items: [...state.items, newItem] };
  }

  const speedMultiplier = 1 + (state.level - 1) * 0.08;
  const rand = Math.random();

  // Power-up spawn probabilities (total ~8%)
  // star: 5%, magnet: 1%, wide: 1%, heart: 0.75%, mystery: 0.25%
  let type: FallingItem['type'];
  let emoji: string;
  let points: number;

  if (rand < 0.05) {
    type = 'star';
    emoji = '⭐';
    points = (10 + Math.floor(Math.random() * 5)) * cfg.pointsMultiplier * 3;
  } else if (rand < 0.06) {
    type = 'magnet';
    emoji = '🧲';
    points = 0;
  } else if (rand < 0.07) {
    type = 'wide';
    emoji = '⚡';
    points = 0;
  } else if (rand < 0.0775) {
    type = 'heart';
    emoji = '❤️';
    points = 0;
  } else if (rand < 0.08) {
    type = 'mystery';
    emoji = '🎁';
    points = 0;
  } else {
    // Regular candy or bomb
    const isBomb = Math.random() < cfg.bombChance + (state.level - 1) * 0.015;
    type = isBomb ? 'bomb' : 'candy';
    emoji = isBomb ? BOMB_EMOJI : CANDY_EMOJIS[Math.floor(Math.random() * CANDY_EMOJIS.length)];
    points = isBomb ? 0 : (10 + Math.floor(Math.random() * 5)) * cfg.pointsMultiplier;
  }

  const newItem: FallingItem = {
    id: nextId++,
    x: 5 + Math.random() * 90,
    y: -6,
    speed: (cfg.baseSpeed + Math.random() * 0.15) * speedMultiplier,
    type,
    emoji,
    points,
    active: true,
  };
  return { ...state, items: [...state.items, newItem] };
}

export function tickItems(state: GameState): GameState {
  const now = Date.now();
  let { combo, maxCombo, comboMultiplier, lastComboBreak } = state;

  // Check for candy rain expiry
  let candyRain = state.candyRain;
  if (candyRain.active && candyRain.endsAt !== null && now >= candyRain.endsAt) {
    candyRain = { active: false, endsAt: null };
  }

  // Check for power-up expiry
  let activePowerups = state.activePowerups;
  const newMagnet = activePowerups.magnet !== null && now < activePowerups.magnet ? activePowerups.magnet : null;
  const newWide = activePowerups.wide !== null && now < activePowerups.wide ? activePowerups.wide : null;
  if (newMagnet !== activePowerups.magnet || newWide !== activePowerups.wide) {
    activePowerups = { magnet: newMagnet, wide: newWide };
  }

  const updated = state.items.map(item => ({
    ...item,
    y: item.y + item.speed,
  }));

  // Detect candy items that fell off screen — break combo
  const fellOff = updated.filter(item => item.y >= 110 && (item.type === 'candy' || item.type === 'star'));
  if (fellOff.length > 0 && combo >= 3) {
    lastComboBreak = now;
    combo = 0;
    comboMultiplier = 1;
  } else if (fellOff.length > 0) {
    combo = 0;
    comboMultiplier = 1;
  }

  const filtered = updated.filter(item => item.y < 110);

  return {
    ...state,
    items: filtered,
    combo,
    maxCombo,
    comboMultiplier,
    lastComboBreak,
    activePowerups,
    candyRain,
  };
}

export function moveBasket(state: GameState, newX: number): GameState {
  const clamped = Math.max(5, Math.min(95, newX));
  return { ...state, basketX: clamped };
}

// Returns updated state after checking collisions
// basketWidth: 12% of screen width on each side
export function checkCollisions(state: GameState, basketWidth = 10): GameState {
  const BASKET_Y = 72; // % from top — must match BASKET_Y_PCT in GameScene.tsx
  let { score, lives, catchCount, level, lastCatch, combo, maxCombo, comboMultiplier, lastComboBreak, activePowerups, candyRain } = state;
  let hitBomb = false;
  let catchInfo: { emoji: string; points: number } | undefined;
  const now = Date.now();

  // Apply wide basket power-up
  const effectiveBasketWidth = activePowerups.wide !== null ? basketWidth * 2 : basketWidth;

  const items = state.items.map(item => {
    if (!item.active) return item;
    // Check if item is at basket height
    if (item.y >= BASKET_Y - 3 && item.y <= BASKET_Y + 6) {
      // Check horizontal overlap
      const dx = Math.abs(item.x - state.basketX);
      if (dx < effectiveBasketWidth) {
        if (item.type === 'bomb') {
          hitBomb = true;
          // Break combo on bomb
          if (combo >= 3) {
            lastComboBreak = now;
          }
          combo = 0;
          comboMultiplier = 1;
          return { ...item, active: false };
        } else if (item.type === 'magnet') {
          activePowerups = { ...activePowerups, magnet: now + 4000 };
          catchInfo = { emoji: item.emoji, points: 0 };
          return { ...item, active: false };
        } else if (item.type === 'wide') {
          activePowerups = { ...activePowerups, wide: now + 5000 };
          catchInfo = { emoji: item.emoji, points: 0 };
          return { ...item, active: false };
        } else if (item.type === 'heart') {
          lives = Math.min(3, lives + 1);
          catchInfo = { emoji: item.emoji, points: 0 };
          return { ...item, active: false };
        } else if (item.type === 'mystery') {
          if (Math.random() < 0.5) {
            score += 50;
            catchInfo = { emoji: '🎁', points: 50 };
          } else {
            // Instant bomb effect
            hitBomb = true;
            catchInfo = { emoji: '💥', points: 0 };
          }
          return { ...item, active: false };
        } else {
          // candy or star
          const basePoints = item.points;
          const earned = basePoints * comboMultiplier;
          score += earned;
          catchCount += 1;
          combo += 1;
          maxCombo = Math.max(maxCombo, combo);
          comboMultiplier = getComboMultiplier(combo);
          catchInfo = { emoji: item.emoji, points: earned };
          return { ...item, active: false };
        }
      }
    }
    return item;
  }).filter(item => item.active);

  // Level up every 10 catches
  level = Math.floor(catchCount / 10) + 1;

  // Check for candy rain trigger (every 5 levels)
  if (level % 5 === 0 && level > 1 && !candyRain.active) {
    const prevLevel = state.level;
    if (level > prevLevel) {
      candyRain = { active: true, endsAt: now + 6000 };
    }
  }

  if (hitBomb) {
    lives -= 1;
  }

  if (catchInfo != null) {
    lastCatch = { emoji: catchInfo.emoji, points: catchInfo.points, key: now };
  }

  const phase = lives <= 0 ? 'gameover' : state.phase;

  return {
    ...state,
    score,
    lives,
    catchCount,
    level,
    items,
    lastCatch,
    phase,
    combo,
    maxCombo,
    comboMultiplier,
    lastComboBreak,
    activePowerups,
    candyRain,
  };
}

// Trigger candy rain manually (called when leveling up to a multiple of 5)
export function triggerCandyRain(state: GameState): GameState {
  const now = Date.now();
  return { ...state, candyRain: { active: true, endsAt: now + 6000 } };
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
    combo: 0,
    maxCombo: 0,
    comboMultiplier: 1,
    lastComboBreak: null,
    activePowerups: { magnet: null, wide: null },
    candyRain: { active: false, endsAt: null },
  };
}

export function endGame(state: GameState): GameState {
  return { ...state, phase: 'gameover', items: [] };
}
