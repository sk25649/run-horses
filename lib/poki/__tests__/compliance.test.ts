import { describe, it, expect, beforeEach } from 'vitest';
import { containsProfanity } from '../profanity';
import { safeStorage } from '../safeStorage';

// ─── Profanity filter ──────────────────────────────────────────────────────────

describe('containsProfanity', () => {
  it('returns false for clean names', () => {
    expect(containsProfanity('Alice')).toBe(false);
    expect(containsProfanity('Player123')).toBe(false);
    expect(containsProfanity('HorseRider')).toBe(false);
    expect(containsProfanity('Anonymous')).toBe(false);
  });

  it('detects blocked words (case-insensitive)', () => {
    expect(containsProfanity('fuck')).toBe(true);
    expect(containsProfanity('FUCK')).toBe(true);
    expect(containsProfanity('Fuck')).toBe(true);
  });

  it('detects blocked words within a multi-word name', () => {
    expect(containsProfanity('bad ass player')).toBe(true);
    expect(containsProfanity('shit head')).toBe(true);
  });

  it('does NOT flag words that contain blocked strings as substrings (Scunthorpe rule)', () => {
    // "ass" is blocked but "class" and "bass" should not be
    expect(containsProfanity('class')).toBe(false);
    expect(containsProfanity('bass')).toBe(false);
    expect(containsProfanity('assassin')).toBe(false);
  });

  it('handles special characters as word separators', () => {
    expect(containsProfanity('fuck!')).toBe(true);
    expect(containsProfanity('f.u.c.k')).toBe(false); // letters only between separators
  });

  it('returns false for empty string', () => {
    expect(containsProfanity('')).toBe(false);
  });
});

// ─── safeStorage ──────────────────────────────────────────────────────────────

describe('safeStorage', () => {
  // In node/vitest, localStorage is not available.
  // Verify the wrapper never throws (returns null/undefined gracefully).

  it('getItem returns null when storage is unavailable', () => {
    expect(() => safeStorage.getItem('any_key')).not.toThrow();
    expect(safeStorage.getItem('any_key')).toBeNull();
  });

  it('setItem does not throw when storage is unavailable', () => {
    expect(() => safeStorage.setItem('key', 'value')).not.toThrow();
  });

  it('removeItem does not throw when storage is unavailable', () => {
    expect(() => safeStorage.removeItem('key')).not.toThrow();
  });
});
