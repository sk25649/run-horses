import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DISABLED_POKI, isPokiEnabled, buildPokiMethods } from '../PokiProvider';

// ─── isPokiEnabled ─────────────────────────────────────────────────────────────

describe('isPokiEnabled', () => {
  it('returns false when NEXT_PUBLIC_POKI is not set', () => {
    // env var is not set in test environment
    expect(isPokiEnabled()).toBe(false);
  });
});

// ─── DISABLED_POKI no-ops ──────────────────────────────────────────────────────

describe('DISABLED_POKI', () => {
  it('isEnabled is false', () => {
    expect(DISABLED_POKI.isEnabled).toBe(false);
  });

  it('gameLoadingFinished is a no-op', () => {
    expect(() => DISABLED_POKI.gameLoadingFinished()).not.toThrow();
  });

  it('gameplayStart is a no-op', () => {
    expect(() => DISABLED_POKI.gameplayStart()).not.toThrow();
  });

  it('gameplayStop is a no-op', () => {
    expect(() => DISABLED_POKI.gameplayStop()).not.toThrow();
  });

  it('commercialBreak resolves immediately', async () => {
    await expect(DISABLED_POKI.commercialBreak()).resolves.toBeUndefined();
  });

  it('commercialBreak with onStart resolves without calling onStart', async () => {
    const onStart = vi.fn();
    await DISABLED_POKI.commercialBreak(onStart);
    expect(onStart).not.toHaveBeenCalled();
  });

  it('rewardedBreak resolves to false', async () => {
    await expect(DISABLED_POKI.rewardedBreak()).resolves.toBe(false);
  });
});

// ─── buildPokiMethods gameplay guard ──────────────────────────────────────────

describe('buildPokiMethods gameplay guard', () => {
  const mockSDK = {
    init: vi.fn().mockResolvedValue(undefined),
    gameLoadingFinished: vi.fn(),
    gameplayStart: vi.fn(),
    gameplayStop: vi.fn(),
    commercialBreak: vi.fn().mockResolvedValue(undefined),
    rewardedBreak: vi.fn().mockResolvedValue(true),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error — setting global window.PokiSDK in node/vitest
    globalThis.window = { PokiSDK: mockSDK };
  });

  function makeRef(value = false): { current: boolean } {
    return { current: value };
  }

  it('isEnabled is true', () => {
    const ref = makeRef();
    const methods = buildPokiMethods(ref);
    expect(methods.isEnabled).toBe(true);
  });

  it('gameplayStart calls SDK and marks active', () => {
    const ref = makeRef(false);
    const methods = buildPokiMethods(ref);
    methods.gameplayStart();
    expect(mockSDK.gameplayStart).toHaveBeenCalledTimes(1);
    expect(ref.current).toBe(true);
  });

  it('gameplayStart is no-op if already active (prevents consecutive starts)', () => {
    const ref = makeRef(true);
    const methods = buildPokiMethods(ref);
    methods.gameplayStart();
    expect(mockSDK.gameplayStart).not.toHaveBeenCalled();
    expect(ref.current).toBe(true);
  });

  it('gameplayStop calls SDK and marks inactive', () => {
    const ref = makeRef(true);
    const methods = buildPokiMethods(ref);
    methods.gameplayStop();
    expect(mockSDK.gameplayStop).toHaveBeenCalledTimes(1);
    expect(ref.current).toBe(false);
  });

  it('gameplayStop is no-op if already inactive (prevents consecutive stops)', () => {
    const ref = makeRef(false);
    const methods = buildPokiMethods(ref);
    methods.gameplayStop();
    expect(mockSDK.gameplayStop).not.toHaveBeenCalled();
    expect(ref.current).toBe(false);
  });

  it('start → stop → start alternates correctly', () => {
    const ref = makeRef(false);
    const methods = buildPokiMethods(ref);

    methods.gameplayStart();
    methods.gameplayStop();
    methods.gameplayStart();

    expect(mockSDK.gameplayStart).toHaveBeenCalledTimes(2);
    expect(mockSDK.gameplayStop).toHaveBeenCalledTimes(1);
    expect(ref.current).toBe(true);
  });

  it('commercialBreak delegates to SDK', async () => {
    const ref = makeRef(false);
    const methods = buildPokiMethods(ref);
    const onStart = vi.fn();
    await methods.commercialBreak(onStart);
    expect(mockSDK.commercialBreak).toHaveBeenCalledWith(onStart);
  });

  it('rewardedBreak delegates to SDK and returns result', async () => {
    const ref = makeRef(false);
    const methods = buildPokiMethods(ref);
    const result = await methods.rewardedBreak({ size: 'medium' });
    expect(mockSDK.rewardedBreak).toHaveBeenCalledWith({ size: 'medium' });
    expect(result).toBe(true);
  });

  it('gameplayStart is no-op if window.PokiSDK is not defined', () => {
    globalThis.window = {} as Window & typeof globalThis;
    const ref = makeRef(false);
    const methods = buildPokiMethods(ref);
    expect(() => methods.gameplayStart()).not.toThrow();
    expect(ref.current).toBe(false);
  });
});
