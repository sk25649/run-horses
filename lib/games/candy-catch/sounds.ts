// Candy Catch — synthesized sounds via Web Audio engine
import { playTone, playNoise, playChime, setMuted, isMuted } from '@/lib/audio/engine';

export { setMuted, isMuted };

// 🍬 Candy catch — bright, happy chime
export function playCatch() {
  playChime([880, 1100, 1320], 0.07, 0.18);
}

// 🍭 Catch with points — slightly fancier
export function playCatchBig() {
  playChime([660, 880, 1100, 1320], 0.065, 0.2);
}

// 💣 Bomb hit — low thud + noise burst
export function playBomb() {
  playTone(120, 60, 0.3, 0.35);
  playNoise(0.25, 200, 80, 0.28);
}

// Level up — ascending arpeggio
export function playLevelUp() {
  playChime([440, 550, 660, 880, 1100], 0.09, 0.22);
}

// Game start — short fanfare
export function playGameStart() {
  playChime([523, 659, 784, 1047], 0.1, 0.2);
}

// Game over — descending sad tones
export function playGameOver() {
  playTone(440, 220, 0.5, 0.25);
  setTimeout(() => playTone(330, 165, 0.5, 0.2), 300);
  setTimeout(() => playTone(220, 110, 0.7, 0.18), 600);
}

// 🔥 Combo milestone — punchy rising chime
export function playCombo() {
  playChime([880, 1100, 1320, 1760], 0.055, 0.22);
}

// 🍬 Candy rain — exciting fast arpeggio
export function playCandyRain() {
  playChime([523, 659, 784, 1047, 1319, 1568], 0.055, 0.24);
  setTimeout(() => playChime([1047, 1319, 1568, 2093], 0.055, 0.2), 350);
}

// ⚡ Power-up caught — magical shimmer
export function playPowerup() {
  playChime([1047, 1319, 1568, 2093], 0.06, 0.22);
  setTimeout(() => playTone(2093, 1568, 0.3, 0.12), 280);
}
