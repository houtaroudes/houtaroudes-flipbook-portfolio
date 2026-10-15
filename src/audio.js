// Page sounds, synthesised at runtime. Nothing is downloaded: a page turn is
// a short burst of filtered noise, the cover closing adds a low thud.
//
// Browsers refuse to start audio before a gesture, so the context is created
// lazily on the first pointer or key input.

let ctx = null;
let master = null;
let noise = null;
let muted = false;
let lastPlay = 0;

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = !!value;
  if (master && ctx) {
    master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.02);
  }
}

// Called from a real user gesture. Safe to call on every input.
export function unlock() {
  if (muted) return;
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    ctx = new AudioCtx();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    // Half a second of noise, reused for every page.
    const frames = Math.floor(ctx.sampleRate * 0.5);
    noise = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < frames; i++) {
      // Slightly smoothed noise reads as paper rather than as static.
      last = last * 0.4 + (Math.random() * 2 - 1) * 0.6;
      data[i] = last;
    }
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
}

function noiseBurst({ at, dur, from, to, q, gain }) {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = q;
  band.frequency.setValueAtTime(from, at);
  band.frequency.exponentialRampToValueAtTime(Math.max(120, to), at + dur);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(gain, at + dur * 0.18);
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(band).connect(env).connect(master);
  src.start(at);
  src.stop(at + dur + 0.05);
}

// One sheet turning. `weight` scales with how much paper is moving: a single
// page is light and quick, a whole stack of them is heavier and longer.
export function turn(weight = 1) {
  if (muted || !ctx) return;
  const now = ctx.currentTime;
  if (now - lastPlay < 0.045) return;
  lastPlay = now;
  const w = Math.max(0.35, Math.min(2, weight));
  const at = now + 0.005;
  noiseBurst({ at, dur: 0.16 + 0.06 * w, from: 2200 + 900 * w, to: 520, q: 0.9, gain: 0.09 + 0.05 * w });
  noiseBurst({ at: at + 0.04, dur: 0.1 + 0.04 * w, from: 900, to: 300, q: 1.4, gain: 0.05 + 0.03 * w });
}

// Boards meeting: the cover opening or closing.
export function thud() {
  if (muted || !ctx) return;
  const at = ctx.currentTime + 0.005;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(150, at);
  osc.frequency.exponentialRampToValueAtTime(58, at + 0.16);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(0.16, at + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, at + 0.24);
  osc.connect(env).connect(master);
  osc.start(at);
  osc.stop(at + 0.3);
  noiseBurst({ at, dur: 0.08, from: 600, to: 220, q: 1.1, gain: 0.05 });
}
