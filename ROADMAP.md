# Roadmap — Run Horses (Play Episodes)

**Last updated:** 2026-03-12

## Progress

### Feature: Poki SDK Integration — In Progress
- [x] Chunk 1: Poki SDK loader + React wrapper
- [x] Chunk 2: Gameplay lifecycle events (gameplayStart/Stop)
- [x] Chunk 3: Commercial break integration
- [x] Chunk 4: Audio muting during ads
- [x] Chunk 5: Poki compliance cleanup
- [x] Chunk 6: Static export build for Poki
- [ ] Chunk 7: Poki CLI setup + first upload

---

## Feature: Poki SDK Integration

**Created:** 2026-03-12
**Status:** In Progress
**Estimated total effort:** ~90 min agent time

**Goal:** Integrate the Poki SDK so both games (Run Horses + Mines of Oblivion) can be published on poki.com as separate listings, while keeping the existing tvgames.dev deployment working unchanged.

**In scope:**
- Poki SDK script loading + initialization
- Gameplay lifecycle tracking (gameplayStart/gameplayStop)
- Commercial break ads at natural pause points (game over, mode switch, rematch)
- Audio muting during ad playback
- Static HTML export for Poki hosting
- Poki UX compliance (no external links, localStorage try/catch, keyboard disable during ads, profanity filter on online names)
- Poki CLI configuration for uploading builds

**Out of scope:**
- Rewarded breaks (no reward mechanics exist yet — add later)
- Poki Netlib migration (keep PartyKit — request CSP approval from Poki instead)
- Poki AUDS (save data — no persistent accounts yet)
- New game content or features

**Dependencies:**
- Poki developer account (sign up at developers.poki.com)
- CSP approval from Poki for PartyKit WebSocket connections (multiplayer)

---

### Chunk 1: Poki SDK loader + React wrapper
**Estimated effort:** ~10 min
**Files to create:** `lib/poki/PokiProvider.tsx`, `lib/poki/usePoki.ts`
**Files to modify:** `app/layout.tsx`
**Depends on:** none

**What to do:**
1. Create `lib/poki/usePoki.ts` — a hook that exposes typed wrappers around the global `PokiSDK` object:
   - `init()`, `gameLoadingFinished()`, `gameplayStart()`, `gameplayStop()`, `commercialBreak(onStart)`, `rewardedBreak(opts)`
   - Each method should no-op gracefully if `window.PokiSDK` is undefined (non-Poki environments, ad blockers)
   - Track internal state: `isInitialized`, `isGameplayActive` (to prevent consecutive start/start or stop/stop calls)
2. Create `lib/poki/PokiProvider.tsx` — a React context provider that:
   - Loads the SDK via `next/script` with `strategy="afterInteractive"` and `src="https://game-cdn.poki.com/scripts/v2/poki-sdk.js"`
   - Only loads if `isPoki` flag is true (detect via URL param `?poki=1`, or env var `NEXT_PUBLIC_POKI=1`, or hostname check)
   - Calls `PokiSDK.init()` on script load, then `gameLoadingFinished()` once React tree mounts
   - Provides the `usePoki()` hook values via context
3. Wrap the app in `<PokiProvider>` in `app/layout.tsx`

**Acceptance criteria:**
- [x] On tvgames.dev (no Poki env), SDK script is NOT loaded, all hook methods are no-ops
- [x] With `NEXT_PUBLIC_POKI=1`, SDK script loads, `init()` and `gameLoadingFinished()` fire
- [x] `usePoki()` hook is accessible from any client component
- [x] No SSR errors — all SDK access is client-only

**Key decisions:**
- Use env var `NEXT_PUBLIC_POKI` to toggle SDK (set in Poki build, not in tvgames.dev build). This is cleaner than URL detection and works at build time for tree-shaking.

---

### Chunk 2: Gameplay lifecycle events (gameplayStart/Stop)
**Estimated effort:** ~10 min
**Files to modify:**
- `lib/games/run-horses/components/GameScene.tsx`
- `lib/games/minefield/components/GameScene.tsx`
**Depends on:** Chunk 1

**What to do:**
1. In **Run Horses GameScene.tsx**:
   - Call `gameplayStart()` when `gameMode` transitions from `null` to a mode (player selects PvP/AI/Online) AND gameplay actually begins (for online: after both players join and `start` message received)
   - Call `gameplayStop()` when `winner` becomes non-null (game over)
   - Call `gameplayStop()` when user clicks "CHANGE MODE" (returns to menu)
   - Call `gameplayStart()` on rematch (after state resets and new game begins)

2. In **Minefield GameScene.tsx**:
   - Call `gameplayStart()` when the **moving phase** begins (not placement phase — placement is setup, not gameplay per Poki's definition)
   - Call `gameplayStop()` when `phase === 'finished'` (game over)
   - Call `gameplayStop()` when user clicks "CHANGE MODE"
   - Call `gameplayStart()` on rematch when moving phase starts again

3. Use the `isGameplayActive` guard in the hook to prevent double-firing

**Acceptance criteria:**
- [x] `gameplayStart` and `gameplayStop` alternate correctly — never two starts or two stops in a row
- [x] Gameplay lifecycle tracks actual player engagement, not menu/setup time
- [x] Online mode: `gameplayStart` fires only after both players are connected and game begins
- [x] Minefield: placement phase does NOT trigger `gameplayStart`

---

### Chunk 3: Commercial break integration
**Estimated effort:** ~20 min
**Files to modify:**
- `lib/games/run-horses/components/HUD.tsx`
- `lib/games/run-horses/components/GameScene.tsx`
- `lib/games/minefield/components/HUD.tsx`
- `lib/games/minefield/components/GameScene.tsx`
**Depends on:** Chunk 2

**What to do:**
1. Add a shared `adBreak` state to each GameScene: `'none' | 'pending' | 'playing'`
2. **Game Over → Rematch flow** (both games):
   - When winner is set, after confetti plays (~4.4s), set `adBreak = 'pending'`
   - Call `commercialBreak()` — on resolve, set `adBreak = 'none'`
   - REMATCH and CHANGE MODE buttons are disabled/hidden while `adBreak !== 'none'`
   - Show a subtle "Loading..." or spinner overlay during ad (Poki may or may not show an ad — the promise resolves either way)
3. **Mode Change flow** (both games):
   - When player clicks CHANGE MODE from game-over screen, trigger `commercialBreak()` before resetting to mode selection
   - This is a natural break point — player is already transitioning
4. **Online: Waiting for opponent** — do NOT show ads here (player needs to share link and stay focused)
5. **Do NOT add ads on initial load** — Poki SDK handles pre-roll timing automatically after `init()`

**Acceptance criteria:**
- [x] Ad break fires after game over in all modes (PvP, AI, Online)
- [x] Buttons are disabled during ad playback — no double-clicks or state corruption
- [x] If ad is blocked or doesn't fill, game continues immediately (promise resolves)
- [x] No ads during active gameplay or setup phases
- [x] Online rematch: ad fires locally on each client independently (not synced — Poki decides per-user)

**Key decisions:**
- Don't gate rematch behind a mandatory ad wait. Show the ad, but if it resolves instantly (no fill), let the player proceed immediately. Poki's system controls frequency — we just provide the opportunity.

---

### Chunk 4: Audio muting during ads
**Estimated effort:** ~10 min
**Files to modify:** `lib/audio/engine.ts`, `lib/poki/usePoki.ts`
**Depends on:** Chunk 3

**What to do:**
1. In `lib/audio/engine.ts`, expose `suspendAudio()` and `resumeAudio()` methods that suspend/resume the Web Audio `AudioContext`
2. In the `commercialBreak()` wrapper in `usePoki.ts`:
   - Pass `suspendAudio` as the `onStart` callback (called when ad actually starts playing)
   - Call `resumeAudio` when the promise resolves (ad finished or no fill)
3. Same pattern for `rewardedBreak()` wrapper (future-proofing)

**Acceptance criteria:**
- [x] All game audio silences when a Poki ad plays
- [x] Audio resumes after ad completes
- [x] If no ad plays (no fill / ad blocker), audio is never interrupted
- [x] Audio engine works unchanged on tvgames.dev (non-Poki)

---

### Chunk 5: Poki compliance cleanup
**Estimated effort:** ~15 min
**Files to modify:**
- `app/(portal)/page.tsx` (portal links)
- `lib/games/run-horses/components/HUD.tsx`
- `lib/games/minefield/components/HUD.tsx`
- `lib/multiplayer/usePartyGame.ts`
- `lib/games/minefield/useMinesPartyGame.ts`
- Any file using `localStorage` or `sessionStorage`
**Depends on:** Chunk 1

**What to do:**
1. **Wrap all localStorage/sessionStorage** calls in try/catch blocks — Poki games must work in incognito mode where storage may throw. Search codebase for all `localStorage` and `sessionStorage` usage and wrap each.
2. **Remove/hide external links in Poki build:**
   - The portal page links to individual games — on Poki each game is standalone, so the portal page won't be used. But if any "← ALL GAMES" or external navigation links exist in game HUDs, hide them when `NEXT_PUBLIC_POKI=1`
   - Remove any links to tvgames.dev or external URLs in the Poki build
3. **Profanity filter on online names:**
   - Add a basic profanity check on the name input in the online join flow (both `usePartyGame` and `useMinesPartyGame`)
   - Use a small bundled word list (no external API calls) — ~200 common terms is sufficient
   - Block submission if name contains a match; show inline error
4. **Disable keyboard scrolling during ads:**
   - When `adBreak === 'playing'`, add event listeners to prevent spacebar/arrow key default behavior (prevents page scrolling behind the ad iframe)
   - Clean up listeners when ad ends

**Acceptance criteria:**
- [x] No `localStorage`/`sessionStorage` calls throw in incognito/private browsing
- [x] No outbound links to external sites in the Poki build
- [x] Profanity in online name input is rejected with user-friendly message
- [x] Keyboard input doesn't scroll the page during ad playback
- [x] All compliance changes are gated behind `NEXT_PUBLIC_POKI` — tvgames.dev is unaffected

---

### Chunk 6: Static export build for Poki
**Estimated effort:** ~20 min
**Files to modify:** `next.config.ts`, `package.json`
**Files to create:** `next.config.poki.ts` (or conditional config)
**Depends on:** Chunks 1-5

**What to do:**
1. **Create a Poki-specific Next.js config** that sets `output: 'export'` for static HTML generation. Options:
   - Option A (recommended): Use an env var check in `next.config.ts` — if `NEXT_PUBLIC_POKI=1`, set `output: 'export'` and `distDir: 'out-poki'`
   - Option B: Separate `next.config.poki.ts` file
2. **Handle API routes:** The challenge token API (`app/(games)/[game-id]/api/challenge/route.ts`) and OG image routes won't work in static export. Conditionally exclude them or stub them out in Poki build.
3. **Handle middleware:** `middleware.ts` doesn't run in static export — this is fine since Poki won't use subdomains.
4. **Handle dynamic routes:** The `[game-id]` dynamic route needs `generateStaticParams()` to enumerate all games for static export. This may already work if it exists — check and add if needed.
5. **Add build scripts to package.json:**
   - `"build:poki:run-horses"`: Build static export with env vars to only include Run Horses entry point
   - `"build:poki:minefield"`: Same for Minefield
   - Each produces a self-contained `out/` directory ready for Poki upload
6. **Verify the build output:**
   - Total bundle size should be under 8 MB (Three.js + React + game code)
   - All assets are inlined or in the output directory (no external fetches)
   - Test by serving `out/` with a static file server and verifying the game works

**Acceptance criteria:**
- [x] `npm run build:poki:run-horses` produces a static `out-poki/` directory with a working game
- [x] `npm run build:poki:minefield` produces a separate static build
- [ ] No external resource fetches (fonts, CDNs, APIs) — everything bundled
- [ ] Bundle size under 8 MB per game
- [x] Existing `npm run build` for tvgames.dev is unchanged

**Key decisions:**
- Recommend separate builds per game (not one mega-bundle). Poki lists games individually, and smaller bundles load faster. Each build only includes the code for one game.
- If bundle size is over 8 MB, investigate: Three.js tree-shaking, removing unused drei components, compressing geometries.

---

### Chunk 7: Poki CLI setup + first upload
**Estimated effort:** ~5 min
**Files to modify:** `package.json`
**Files to create:** `poki.json` (or add `"poki"` key to package.json)
**Depends on:** Chunk 6

**What to do:**
1. Install `@poki/cli` as a dev dependency
2. Run `npx @poki/cli init` to authenticate and configure (this opens a browser for Poki login)
3. Create two Poki game entries (one per game) on the Poki developer dashboard
4. Configure `poki.json` with the game IDs and build directories
5. Add upload scripts to package.json:
   - `"poki:upload:run-horses"`: `npm run build:poki:run-horses && npx @poki/cli upload --name \"v1.0\"`
   - `"poki:upload:minefield"`: same pattern
6. Do a first test upload and verify in Poki Inspector that SDK events fire correctly
7. Request CSP approval for PartyKit WebSocket domain (for online multiplayer to work on Poki)

**Acceptance criteria:**
- [ ] `@poki/cli` is installed and authenticated
- [ ] First build uploaded successfully to Poki developer dashboard
- [ ] Poki Inspector shows correct event flow: init → gameLoadingFinished → gameplayStart → gameplayStop → commercialBreak
- [ ] CSP approval requested for PartyKit domain

**Key decisions:**
- Submit Run Horses first (simpler game, single phase). Get through the review process. Then submit Minefield.
- Online multiplayer may not work immediately on Poki until CSP is approved. The game should gracefully handle this — online mode can be hidden in Poki build until approved, or show an error if WebSocket connection fails.

---

**Risks & Unknowns:**
- **Bundle size:** Three.js + React Three Fiber can be large. May need tree-shaking work if over 8 MB. Check early in Chunk 6.
- **PartyKit CSP approval:** Poki must approve the external WebSocket connection. If denied, online mode won't work on Poki. Mitigation: hide online mode in Poki build until approved, or investigate Poki Netlib as a P2P alternative.
- **Static export compatibility:** Next.js static export has limitations (no API routes, no middleware, no server components that fetch). The current codebase may have server-only patterns that need adjusting.
- **Poki review timeline:** Soft release takes 2-3 weeks. Plan accordingly — don't wait for Poki approval to keep building.
- **Ad frequency:** Poki controls when ads actually show. Don't optimize for "more ad calls = more revenue." Focus on natural break points.
