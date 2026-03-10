// Shared Web Audio synth engine — no audio files needed.

let _ctx: AudioContext | null = null;
let _muted = false;

export function setMuted(v: boolean) { _muted = v; }
export function isMuted() { return _muted; }

export function ctx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!_ctx) _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (_ctx.state === 'suspended') _ctx.resume();
    return _ctx;
  } catch { return null; }
}

export function playTone(freq: number, endFreq: number, duration: number, volume = 0.15) {
  if (_muted) return;
  const ac = ctx(); if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain); gain.connect(ac.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(endFreq, ac.currentTime + duration);
  gain.gain.setValueAtTime(volume, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration + 0.02);
  osc.start(); osc.stop(ac.currentTime + duration + 0.03);
}

export function playNoise(duration: number, startFreq: number, endFreq: number, volume = 0.22) {
  if (_muted) return;
  const ac = ctx(); if (!ac) return;
  const len = Math.floor(ac.sampleRate * duration);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource(); src.buffer = buf;
  const filt = ac.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.setValueAtTime(startFreq, ac.currentTime);
  filt.frequency.exponentialRampToValueAtTime(endFreq, ac.currentTime + duration);
  filt.Q.value = 1.2;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(volume, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
  src.connect(filt); filt.connect(gain); gain.connect(ac.destination);
  src.start();
}

export function playChime(frequencies: number[], interval: number, volume = 0.2) {
  if (_muted) return;
  const ac = ctx(); if (!ac) return;
  frequencies.forEach((freq, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t = ac.currentTime + i * interval;
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35 + interval);
    osc.start(t); osc.stop(t + 0.4 + interval);
  });
}
