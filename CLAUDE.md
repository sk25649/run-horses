# Play Episodes — Developer Guide

A multi-game platform where each game is a board game from a TV show. Built with Next.js 16 App Router, React Three Fiber (3D), and PartyKit (online multiplayer).

---

## Platform Architecture

```
app/(portal)/page.tsx          → Landing page / game catalog
app/(games)/[game-id]/         → Game routes
lib/game-core/                 → GameDefinition types + registry
lib/multiplayer/               → Shared PartyKit base server + hooks
lib/sharing/                   → Challenge token handler
lib/audio/                     → Web Audio engine (no files, synthesized)
lib/ui/                        → Shared UI components (Confetti, GhostButton)
lib/games/[game-id]/           → Game-specific logic, sounds, components
party/[game-id].ts             → PartyKit server per game
middleware.ts                  → Subdomain → path rewriting
partykit.json                  → Multi-party config
```

**Subdomain routing:** `runhorses.tvgames.dev` → `/run-horses/`, `minefield.tvgames.dev` → `/minefield/`. Browser URL unchanged. Defined in `middleware.ts` (`SUBDOMAIN_ROUTES` map) and `partykit.json` (`parties` map).

---

## Adding a New Game — Checklist

1. `lib/games/[game-id]/gameLogic.ts` — state types, rules, AI
2. `lib/games/[game-id]/sounds.ts` — synthesized sounds via audio engine
3. `lib/games/[game-id]/components/ClientGameScene.tsx` — dynamic import wrapper
4. `lib/games/[game-id]/components/GameScene.tsx` — main 3D scene + state
5. `lib/games/[game-id]/components/HUD.tsx` — all 2D UI overlays
6. `lib/games/[game-id]/components/Board.tsx` — 3D board (InstancedMesh tiles)
7. `lib/games/[game-id]/components/Pieces.tsx` — 3D pieces/tokens
8. `app/(games)/[game-id]/page.tsx` — server page
9. `app/(games)/[game-id]/layout.tsx` — metadata + viewport
10. `app/(games)/[game-id]/api/challenge/route.ts` — challenge tokens
11. `app/(games)/[game-id]/api/og/route.tsx` — OG image
12. `party/[game-id].ts` — PartyKit server extending BaseGameServer
13. `lib/game-core/registry.ts` — add GameDefinition entry
14. `middleware.ts` — add subdomain to `SUBDOMAIN_ROUTES`
15. `partykit.json` — add to `parties`

---

## Standard Types

```typescript
type GameMode = 'pvp' | 'ai' | 'online';
type Difficulty = 'easy' | 'medium' | 'hard';
type Player = 'white' | 'black';

// White player = BLUE pieces (#2277ff)
// Black player = ORANGE pieces (#ff8800)
```

Every `GameState` must have at minimum:
```typescript
interface GameState {
  winner: Player | 'draw' | null;
  currentTurn: Player;
  moveCount: number;
  lastMoveResult: MoveResult | null;  // used by point flash UI
  hints: boolean;  // online: show/hide board info (set by host pre-game)
}
```

---

## Game Registry

`lib/game-core/registry.ts` — add entry to `games[]`:

```typescript
{
  id: 'my-game',             // URL path slug
  name: 'My Game',
  description: 'Short description.',
  tagline: 'Very short tagline',
  tvShow: 'Show Name',
  emoji: '🎮',
  thumbnail: '/my-game/thumb.png',
  maxPlayers: 2,
  modes: ['pvp', 'ai', 'online'],
  subdomain: 'mygame',       // mygame.tvgames.dev
  themeColor: '#00ffcc',     // UI accent color
  accentColor: '#a78bfa',
}
```

---

## PartyKit Server

Extend `BaseGameServer` — implement 4 methods:

```typescript
// party/my-game.ts
import { BaseGameServer } from '../lib/multiplayer/baseServer';
import { createInitialState, applyMove, getValidMoves } from '../lib/games/my-game/gameLogic';

export default class MyGameServer extends BaseGameServer {
  private _state = createInitialState();

  createInitialState() { return createInitialState(); }
  getGameState() { return this._state; }
  setGameState(state: unknown) { this._state = state as GameState; }

  handleMove(fromRow: number, fromCol: number, toRow: number, toCol: number, playerColor: string): boolean {
    if (this._state.currentTurn !== playerColor || this._state.winner) return false;
    const valid = getValidMoves(this._state, fromRow, fromCol);
    if (!valid.some(([r, c]) => r === toRow && c === toCol)) return false;
    this._state = applyMove(this._state, fromRow, fromCol, toRow, toCol);
    return true;
  }
}
```

**BaseGameServer handles automatically:**
- `onConnect` → assign color ('white' first), send `{type:'assigned', color}`
- `join` message → both ready → send `{type:'start', players, gameState}`; else `{type:'waiting'}`
- `move` message → calls `handleMove()` → broadcasts `{type:'sync', gameState, lastMove}`
- `rematch` message → both vote → calls `createInitialState()`, swaps colors, broadcasts `start`
- `onClose` → marks slot disconnected, broadcasts `{type:'opponent_left'}`
- Reconnect → player re-joins, gets `start` with current state

**For pre-move phases (e.g., mine placement):** Override `onMessage`, handle custom message types, call `super.onMessage(message, sender)` at the end for standard messages. See `party/minefield.ts`.

Add to `partykit.json`:
```json
{ "parties": { "my-game": "party/my-game.ts" } }
```

---

## Online Hook

**Generic hook** (simple games — moves only):

```typescript
// In GameScene.tsx
const partyGame = usePartyGame<GameState>(
  gameMode === 'online' ? onlineRoomId : null,
  { party: 'my-game', initialState: createInitialState, nameKey: 'mg_name' }
);

// partyGame.status: OnlineStatus
// partyGame.gameState: TState (from server)
// partyGame.myColor: string | null
// partyGame.players: OnlinePlayer[]
// partyGame.opponentWantsRematch: boolean
// partyGame.lastMove: LastMove | null
// partyGame.submitJoin(name): void
// partyGame.sendMove(fr, fc, tr, tc): void
// partyGame.sendRematch(): void
```

**Custom hook** (games with extra phases — e.g., placement): Copy `lib/games/minefield/useMinesPartyGame.ts` and adapt. Key pattern: track `joinedNameRef` so socket reconnects auto-rejoin without flashing name entry screen.

**OnlineStatus values:**
| Status | What to show |
|---|---|
| `connecting` | "Connecting…" spinner |
| `name_required` | Name entry form |
| `waiting` | Share link screen (host sets game options here) |
| `playing` | Normal game UI |
| `opponent_left` | Disconnect overlay |
| `opponent_rejoined` | → back to `playing` |
| `room_full` | Error screen |

---

## GameScene Structure

```typescript
export default function GameScene() {
  // 1. State
  const [gameMode, setGameMode] = useState<GameMode | null>(null);
  const [gameState, setGameState] = useState<GameState>(createInitialState);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [displayWinner, setDisplayWinner] = useState<Player | null>(null);
  const [muted, setMuted] = useState(false);
  const [onlineRoomId, setOnlineRoomId] = useState<string | null>(null);

  // 2. Online hook (always called, roomId=null when not online)
  const partyGame = usePartyGame(...);
  const activeGameState = gameMode === 'online' ? partyGame.gameState : gameState;

  // 3. Mount: detect ?r= URL param OR restore sessionStorage session
  useEffect(() => {
    const roomId = new URLSearchParams(window.location.search).get('r');
    if (roomId) { setOnlineRoomId(roomId); setGameMode('online'); return; }
    const saved = sessionStorage.getItem('mg_session');
    if (saved) { /* restore gameMode, difficulty, gameState */ }
  }, []);

  // 4. Persist local session (skip online mode)
  useEffect(() => {
    if (gameMode === null || gameMode === 'online') return;
    sessionStorage.setItem('mg_session', JSON.stringify({ gameMode, difficulty, gameState }));
  }, [gameMode, difficulty, gameState]);

  // 5. AI turn
  useEffect(() => {
    if (gameMode !== 'ai' || gameState.currentTurn !== 'black' || gameState.winner) return;
    const id = setTimeout(() => {
      const move = getBestAIMove(gameState, difficulty);
      setGameState(applyMove(gameState, ...move));
    }, 800);
    return () => clearTimeout(id);
  }, [gameMode, gameState, difficulty]);

  // 6. handleSelectMode — generates roomId for online
  const handleSelectMode = (mode: GameMode, diff?: Difficulty) => {
    if (mode === 'online') {
      const roomId = Math.random().toString(36).slice(2, 10).toUpperCase();
      setOnlineRoomId(roomId);
      setGameMode('online');
      window.history.replaceState({}, '', `${window.location.pathname}?r=${roomId}`);
      return;
    }
    if (diff) setDifficulty(diff);
    setGameMode(mode);
    setGameState(createInitialState());
  };

  // 7. handleChangeMode — back to mode selection
  const handleChangeMode = () => {
    sessionStorage.removeItem('mg_session');
    setGameMode(null);
    setGameState(createInitialState());
    setOnlineRoomId(null);
    window.history.replaceState({}, '', window.location.pathname);
  };

  // 8. Render
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Canvas camera={{ position: [0, 16, 12], fov: 45 }}>
        <MobileTapHandler onCellClick={handleCellClick} />
        <CameraController orbitRef={orbitRef} />
        <Suspense fallback={null}>
          <Board gameState={activeGameState} />
          <Pieces gameState={activeGameState} />
        </Suspense>
        <OrbitControls ref={orbitRef} />
      </Canvas>
      <HUD
        gameState={activeGameState}
        gameMode={gameMode}
        difficulty={difficulty}
        onSelectMode={handleSelectMode}
        onChangeMode={handleChangeMode}
        onlineStatus={gameMode === 'online' ? partyGame.status : null}
        onlineRoomId={onlineRoomId}
        myColor={gameMode === 'online' ? partyGame.myColor : null}
        onSendRematch={partyGame.sendRematch}
        onSubmitName={partyGame.submitJoin}
      />
    </div>
  );
}
```

---

## HUD Mandatory Sections

Every HUD must implement these screens. Follow the pattern in either game exactly.

### 1. Mode Selection (shown when `gameMode === null`)
```tsx
{gameMode === null && (
  <>
    {/* ← ALL GAMES back button */}
    <button onClick={() => { sessionStorage.removeItem('mg_session'); window.location.href = '/'; }}>
      ← ALL GAMES
    </button>

    {/* Game title + tagline */}

    {/* How to play — collapsible or modal trigger */}

    {/* Mode cards: pvp, ai (with difficulty), online */}
    {/* Online card: shows "ONLINE" label, not "MULTIPLAYER" */}
  </>
)}
```

### 2. How-to-Play Modal
```tsx
// Trigger: show once unless localStorage.getItem('mg_hide_rules') === '1'
// Also triggered by gameMode changing from null → non-null (first play)
// "DON'T SHOW THIS AGAIN" sets 'mg_hide_rules' = '1'
const [showRulesModal, setShowRulesModal] = useState(false);
const rulesShownRef = useRef(false);
useEffect(() => {
  if (gameMode !== null && !rulesShownRef.current && localStorage.getItem('mg_hide_rules') !== '1') {
    rulesShownRef.current = true;
    setShowRulesModal(true);
  }
}, [gameMode]);
```

### 3. Online Overlays (z-index ordering)
```
name_required  z-55
waiting        z-50  ← include: share link + hints toggle (host only, locked post-start)
room_full      z-55
opponent_left  z-50
```

**Waiting screen must include:**
- "WAITING FOR OPPONENT" heading
- Share link with copy/share button
- Room code display
- Any host-configurable options (like `hints` toggle)
- CANCEL button → `onChangeMode()`

**Share link construction:**
```typescript
const link = `${window.location.origin}${window.location.pathname}?r=${onlineRoomId}`;
// Never hardcode '/' — always use window.location.pathname
```

### 4. Placement Phase (games with setup)
- Show mine/piece grid overlay
- RANDOM button to auto-fill
- CONFIRM button (disabled until count met)
- "WAITING FOR OPPONENT TO PLACE..." after confirming
- Pass-device screen for PvP

### 5. In-Game Top Bar
Panels with `background: rgba(4,4,14,0.75), border: 1px solid rgba(255,255,255,0.08), borderRadius: 10, backdropFilter: blur(10px)`.

Required panels: turn indicator, score/stats, online player info.

### 6. Point Flash (scoring events)
```typescript
const [pointFlash, setPointFlash] = useState<{ text: string; color: string; key: number } | null>(null);
useEffect(() => {
  if (!lastMoveResult || lastMoveResult.points === 0) return;
  setPointFlash({ text: `+${points}`, color: themeColor, key: Date.now() });
  const t = setTimeout(() => setPointFlash(null), 1600);
  return () => clearTimeout(t);
}, [lastMoveResult]);

// CSS: @keyframes point-rise — floats up, fades out at 1.6s
```

### 7. Game Over Screen
- Winner/loser announcement
- Score breakdown
- REMATCH button (online: `sendRematch`; local: reset state)
- CHANGE MODE button

---

## Session Persistence Pattern

**sessionStorage** — per-tab, cleared on tab close. Use for in-game state.
**localStorage** — persistent. Use for preferences, player name, stats.

```typescript
// Key naming: [2-letter prefix]_[key]
// Run Horses: rh_name, rh_muted, rh_streak, rh_best, rh_hide_rules, rh_session
// Minefield:  mo_name, mo_muted, mo_hide_rules, mo_session_v2

// Version the sessionStorage key (e.g., _v2) when changing GameState shape.
// This prevents stale sessions from breaking restored games after deploys.

// ALWAYS clear session on handleChangeMode()
sessionStorage.removeItem('mg_session');

// ALWAYS clear session on ← ALL GAMES navigation
window.location.href = '/';  // with removeItem first
```

---

## 3D Board Conventions

**Coordinate system:** row 0 = top (camera-far), row ROWS-1 = bottom (camera-near). col 0 = left, col COLS-1 = right.

**World space:**
```typescript
const TILE_GAP = 1.05;  // slight gap between tiles
function gridToWorld(row: number, col: number) {
  return { x: (col - COLS/2) * TILE_GAP, y: 0, z: (row - ROWS/2) * TILE_GAP };
}
```

**InstancedMesh pattern** (for tiles — avoids draw calls):
```typescript
const ref = useRef<THREE.InstancedMesh>(null!);
const dummy = useMemo(() => new THREE.Object3D(), []);
useEffect(() => {
  cells.forEach(([r, c], i) => {
    const p = gridToWorld(r, c);
    dummy.position.set(p.x, 0, p.z);
    dummy.updateMatrix();
    ref.current.setMatrixAt(i, dummy.matrix);
  });
  ref.current.instanceMatrix.needsUpdate = true;
}, [cells]);
```

**Camera:** `position={[0, 16, 12]}`, `fov={42}`. Mobile: `position={[0, 22, 16]}`, `fov={54}`.
**OrbitControls:** `maxPolarAngle={Math.PI/2.4}`, `minDistance={9}`, `maxDistance={26}`, `enablePan={false}`.

---

## Audio

No audio files. All sounds synthesized via Web Audio API.

```typescript
// lib/audio/engine.ts
import { playTone, playNoise, playChime, setMuted, isMuted } from '@/lib/audio/engine';

// playTone(startHz, endHz, duration, volume=0.15)  — oscillator glide
// playNoise(duration, startHz, endHz, volume=0.22) — filtered white noise
// playChime(freqs[], interval, volume=0.2)         — arpeggio

// Mute preference stored in localStorage under '[prefix]_muted'
// Always call setMuted() from audio engine on mute toggle
```

---

## ClientGameScene Pattern

Every game needs this wrapper to prevent SSR of Three.js:

```typescript
// lib/games/[game-id]/components/ClientGameScene.tsx
'use client';
import dynamic from 'next/dynamic';
const GameScene = dynamic(() => import('./GameScene'), { ssr: false });
export default function MyGameClientScene() { return <GameScene />; }
```

---

## App Routes

### page.tsx
```typescript
import type { Metadata } from 'next';
import MyGameClientScene from '@/lib/games/my-game/components/ClientGameScene';

export async function generateMetadata({ searchParams }): Promise<Metadata> {
  const p = await searchParams;
  if (p?.r) return { openGraph: { title: "You've been challenged!", ... } };
  return { title: 'My Game — Play Episodes' };
}

export default function MyGamePage() { return <MyGameClientScene />; }
```

### layout.tsx
```typescript
export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, maximumScale: 1,
  userScalable: false, themeColor: '#GAME_THEME_COLOR',
};
```

### api/challenge/route.ts
```typescript
export const { GET, POST } = createChallengeHandler({ gameId: 'my-game' });
```

---

## Invite Links

Always use `window.location.pathname` — never hardcode `'/'`:

```typescript
// Creating room:
window.history.replaceState({}, '', `${window.location.pathname}?r=${roomId}`);

// Share link:
const link = `${window.location.origin}${window.location.pathname}?r=${onlineRoomId}`;

// Back to menu:
window.history.replaceState({}, '', window.location.pathname);
```

---

## Hints / Hard Mode Pattern

For games where you want to hide board information:

1. Add `hints: boolean` to `GameState` (default `false`)
2. In PartyKit server: handle `{type:'set_hints', value: boolean}` — only `white` (host), only when `!gameStarted`
3. In Board: add `hideInfo?: boolean` prop, gate adjacency numbers + overlays on it
4. In GameScene: `hideInfo={gameMode === 'online' ? !activeGameState.hints : (gameMode === 'ai' && difficulty === 'hard')}`
5. In HUD waiting screen: show toggle for `myColor === 'white'` before game starts

---

## Difficulty Levels

AI must support 3 levels. Typical implementation — minimax with depth scaling:

| Level | Depth | Notes |
|---|---|---|
| easy | 2 | Random move 30% of time |
| medium | 4 | Pure minimax |
| hard | 6+ | Alpha-beta pruning, extended eval |

---

## Existing Games Reference

| | Run Horses | Minefield |
|---|---|---|
| Board | 11×11 | 11×11 |
| Piece starts | White: [0,0], Black: [10,10] | White: [10,0], Black: [0,10] |
| Win condition | First to center [5,5] | Highest score after all treasures collected |
| Phase | Single phase | placement → moving → finished |
| Online hook | `usePartyGame` (generic) | `useMinesPartyGame` (custom) |
| localStorage prefix | `rh_` | `mo_` |
| sessionStorage key | `rh_session` | `mo_session_v2` |
| Party name | `runhorses` | `minefield` |
| Theme color | `#00ffcc` | `#ff4444` |

---

## Gotchas

- **Never hardcode `'/'` in `replaceState` or share links** — breaks path-based URLs (non-subdomain).
- **Bump sessionStorage key version** (e.g., `_v2`, `_v3`) whenever `GameState` shape changes. Old sessions will silently fail to restore instead of crashing.
- **PartySocket fires `open` on reconnect** — track `joinedNameRef` in online hooks to auto-rejoin without flashing name entry. See `useMinesPartyGame.ts`.
- **`handleChangeMode` must remove the current session key** — using the old key leaves stale state that keeps restoring.
- **Online `activeGameState` comes from the hook**, not local `gameState`. Always alias: `const activeGameState = gameMode === 'online' ? partyGame.gameState : gameState`.
- **3D canvas must be `ssr: false`** via dynamic import — Three.js requires browser APIs.

---

## 3D Lighting & Materials

**The dark board problem**: New games always ship dark because the scene background is `#1a1a2e` (near-black) and default `meshStandardMaterial` has `roughness=1, metalness=0` which absorbs almost all indirect light. Fix by dialling down roughness and adding the right scene lights.

### Copy-paste scene lights (inside `<Canvas>`)

```tsx
<Canvas
  gl={{
    antialias: true,
    toneMapping: THREE.ACESFilmicToneMapping,
    toneMappingExposure: 1.1,
    preserveDrawingBuffer: true,
  }}
>
  {/* Raise ambientLight intensity for a brighter base; tint to match game palette */}
  <ambientLight intensity={0.55} color="#80ffaa" />   {/* Minefield — green tint */}
  {/* Main sun-style directional light from upper-right; castShadow for depth */}
  <directionalLight
    position={[6, 14, 8]} intensity={1.6} color="#ffffff"
    castShadow shadow-mapSize={[2048, 2048]}
    shadow-camera-near={0.1} shadow-camera-far={60}
    shadow-camera-left={-12} shadow-camera-right={12}
    shadow-camera-top={12} shadow-camera-bottom={-12}
  />
  {/* Soft fill light from opposite side; tint matches atmosphere */}
  <directionalLight position={[-8, 6, -6]} intensity={0.3} color="#224433" />
```

**Key knobs:**
- `ambientLight intensity` — the most impactful lever. `0.18` is very dark (Run Horses night scene). `0.55` is well-lit (Minefield jungle). Go above `0.5` if tiles look muddy.
- `ambientLight color` — tint it to match the game palette (green jungle, blue night, gold desert). Pure `#ffffff` looks sterile.
- `directionalLight intensity` — main light at `1.4–1.6`. Too high bleaches highlights; too low leaves dark shadows.
- `toneMappingExposure` — bump to `1.2–1.4` to brighten the whole scene without changing individual materials.

### Tile material configs (meshStandardMaterial)

Keep `roughness` below `0.75` — above that tiles go flat and dark. Keep `metalness` low (`0.05–0.15`) for non-metallic surfaces.

```tsx
{/* Generic ground tile — readable in ambient light */}
<meshStandardMaterial color="#5ab86a" roughness={0.65} metalness={0.08} />

{/* Stepped / visited overlay — slightly darker */}
<meshStandardMaterial color="#2e7a3e" roughness={0.70} metalness={0.05} />

{/* Board base plate — dark, matte */}
<meshStandardMaterial color="#1a3a1a" roughness={0.90} metalness={0.40} />
```

### Emissive trick for special tiles

Any tile that must pop regardless of lighting (goal, treasure, oasis) — add `emissive` + `emissiveIntensity`:

```tsx
{/* Treasure / goal tile — glows even in dark corners */}
<meshStandardMaterial
  color="#f5c842"
  emissive="#f5c842"
  emissiveIntensity={0.7}
  roughness={0.20}
  metalness={0.60}
/>
```

`emissiveIntensity={0.5–1.0}` makes the tile self-illuminate. Pair with a `pointLight` at the same position for a real glow halo:

```tsx
<pointLight position={[col, 0.8, row]} color="#f5c842" distance={7} intensity={1.2} decay={2} />
```

### Quick diagnostic checklist

1. Scene looks flat/dark → raise `ambientLight intensity` first (`0.18` → `0.55`).
2. Tiles still muddy → lower `roughness` (`0.9` → `0.65`).
3. Goal/treasure tile invisible → add `emissive` matching the `color`.
4. Whole scene too dim → increase `toneMappingExposure` (`1.1` → `1.4`).
5. Shadows too harsh → lower main `directionalLight intensity` or soften with a fill light.
- **Mine/piece positions are in `GameState`** (broadcast to all clients) but actual mine positions are server-only (`_whiteMines`, `_blackMines`). Never put secret data in `GameState`.
