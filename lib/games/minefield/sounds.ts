// Minefield of Forgetting — sound profiles built on the shared audio engine.

import { setMuted as _setMuted, isMuted as _isMuted, playTone, playNoise, playChime } from '@/lib/audio/engine';

export const setMuted = _setMuted;
export const isMuted = _isMuted;

// Soft click when placing a mine on the board
export function playPlaceMine() {
  playTone(180, 90, 0.12, 0.25);
}

// Undo / remove mine from board
export function playRemoveMine() {
  playTone(400, 600, 0.08, 0.12);
}

// Footstep sound when moving to an adjacent cell
export function playStep() {
  playNoise(0.1, 800, 200, 0.18);
}

// Safe landing — soft tone, pitch rises with adjacency count
export function playSafe(adjacentCount: number) {
  const baseFreq = 350 + adjacentCount * 60;
  playTone(baseFreq, baseFreq * 0.7, 0.15, 0.18);
}

// Mine explosion — low rumble + noise burst
export function playExplosion() {
  playNoise(0.35, 200, 40, 0.4);
  playTone(80, 30, 0.4, 0.35);
}

// Treasure collected — bright ascending sparkle
export function playTreasure() {
  playChime([523, 784, 1047, 1318], 0.1, 0.25);
}

// Teleport back to start after mine hit
export function playTeleport() {
  playTone(1200, 200, 0.3, 0.15);
}

// Two-note chime when game starts (movement phase begins)
export function playGameStart() {
  playChime([440, 660], 0.18, 0.2);
}

// Win fanfare — triumphant ascending chord
export function playWin() {
  playChime([523, 659, 784, 1047], 0.13, 0.22);
}

// Lose sound — descending tones
export function playLose() {
  playChime([600, 450, 340], 0.18, 0.2);
}
