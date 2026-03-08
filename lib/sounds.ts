// Synthesised game sounds via Web Audio API — no audio files needed.

let _ctx: AudioContext | null = null;
let _muted = false;

export function setMuted(v: boolean) { _muted = v; }
export function isMuted() { return _muted; }

function ctx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!_ctx) _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (_ctx.state === 'suspended') _ctx.resume();
    return _ctx;
  } catch { return null; }
}

// Short bright "tick" when a piece is selected
export function playSelect() {
  if (_muted) return;
  const ac = ctx(); if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain); gain.connect(ac.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1050, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(780, ac.currentTime + 0.09);
  gain.gain.setValueAtTime(0.15, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.11);
  osc.start(); osc.stop(ac.currentTime + 0.12);
}

// Soft "whoosh" when a piece starts sliding
export function playMove() {
  if (_muted) return;
  const ac = ctx(); if (!ac) return;
  const len = Math.floor(ac.sampleRate * 0.2);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource(); src.buffer = buf;
  const filt = ac.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.setValueAtTime(1400, ac.currentTime);
  filt.frequency.exponentialRampToValueAtTime(250, ac.currentTime + 0.2);
  filt.Q.value = 1.2;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.22, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.2);
  src.connect(filt); filt.connect(gain); gain.connect(ac.destination);
  src.start();
}

// Low "thud" when a piece lands
export function playLand() {
  if (_muted) return;
  const ac = ctx(); if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain); gain.connect(ac.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(220, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(75, ac.currentTime + 0.18);
  gain.gain.setValueAtTime(0.32, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.22);
  osc.start(); osc.stop(ac.currentTime + 0.22);
}

// Ascending chime on win
export function playWin() {
  if (_muted) return;
  const ac = ctx(); if (!ac) return;
  [523, 659, 784, 1047].forEach((freq, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t = ac.currentTime + i * 0.13;
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.22, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    osc.start(t); osc.stop(t + 0.6);
  });
}
