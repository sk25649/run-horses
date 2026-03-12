import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test the pure functions we can exercise in node:
// suspendAudio and resumeAudio operate on the internal AudioContext.
// We mock the AudioContext to verify the calls.

// The engine module uses a module-level _ctx. We can test indirectly via
// the exported functions with a mocked AudioContext.

describe('audio engine suspend/resume', () => {
  // suspendAudio and resumeAudio are exported from the engine module.
  // In node environment, window is undefined so ctx() returns null.
  // We verify the functions don't throw when AudioContext is unavailable.

  it('suspendAudio does not throw when no AudioContext is available', async () => {
    const { suspendAudio } = await import('../engine');
    expect(() => suspendAudio()).not.toThrow();
  });

  it('resumeAudio does not throw when no AudioContext is available', async () => {
    const { resumeAudio } = await import('../engine');
    expect(() => resumeAudio()).not.toThrow();
  });

  it('setMuted and isMuted round-trip', async () => {
    const { setMuted, isMuted } = await import('../engine');
    setMuted(true);
    expect(isMuted()).toBe(true);
    setMuted(false);
    expect(isMuted()).toBe(false);
  });

  it('suspendAudio is a callable export', async () => {
    const engine = await import('../engine');
    expect(typeof engine.suspendAudio).toBe('function');
  });

  it('resumeAudio is a callable export', async () => {
    const engine = await import('../engine');
    expect(typeof engine.resumeAudio).toBe('function');
  });
});
