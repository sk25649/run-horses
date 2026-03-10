// Run Horses! specific sound profiles built on the shared audio engine.

import { setMuted as _setMuted, isMuted as _isMuted, playTone, playNoise, playChime } from '@/lib/audio/engine';

export const setMuted = _setMuted;
export const isMuted = _isMuted;

// Short bright "tick" when a piece is selected
export function playSelect() {
  playTone(1050, 780, 0.09, 0.15);
}

// Soft "whoosh" when a piece starts sliding
export function playMove() {
  playNoise(0.2, 1400, 250, 0.22);
}

// Low "thud" when a piece lands
export function playLand() {
  playTone(220, 75, 0.18, 0.32);
}

// Two-note "ready" chime when online game starts
export function playGameStart() {
  playChime([440, 660], 0.18, 0.2);
}

// Ascending chime on win
export function playWin() {
  playChime([523, 659, 784, 1047], 0.13, 0.22);
}
