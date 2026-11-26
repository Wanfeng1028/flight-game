// Synthesised sound for Skylark Run: every sound is built with WebAudio.
// Engine hum follows throttle, wind follows speed, and events chime or thud.

export function newAudio() {
  return {
    ctx: null,
    master: null,
    engineOsc: null,
    engineOsc2: null,
    engineGain: null,
    engineFilter: null,
    windGain: null,
    windFilter: null,
    muted: false,
    alarmAt: 0,
  };
}

export function ensureAudio(a) {
  if (a.ctx) {
    if (a.ctx.state === 'suspended') a.ctx.resume();
    return;
  }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  a.ctx = ctx;
  a.master = ctx.createGain();
  a.master.gain.value = 0.5;
  a.master.connect(ctx.destination);

  // Engine: two detuned saws through a low-pass.
  a.engineFilter = ctx.createBiquadFilter();
  a.engineFilter.type = 'lowpass';
  a.engineFilter.frequency.value = 420;
  a.engineGain = ctx.createGain();
  a.engineGain.gain.value = 0;
  a.engineOsc = ctx.createOscillator();
  a.engineOsc.type = 'sawtooth';
  a.engineOsc.frequency.value = 58;
  a.engineOsc2 = ctx.createOscillator();
  a.engineOsc2.type = 'square';
  a.engineOsc2.frequency.value = 29;
  const g2 = ctx.createGain();
  g2.gain.value = 0.4;
  a.engineOsc.connect(a.engineFilter);
  a.engineOsc2.connect(g2);
  g2.connect(a.engineFilter);
  a.engineFilter.connect(a.engineGain);
  a.engineGain.connect(a.master);
  a.engineOsc.start();
  a.engineOsc2.start();

  // Wind: looped noise through a band-pass.
  const len = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;
  a.windFilter = ctx.createBiquadFilter();
  a.windFilter.type = 'bandpass';
  a.windFilter.frequency.value = 500;
  a.windFilter.Q.value = 0.6;
  a.windGain = ctx.createGain();
  a.windGain.gain.value = 0;
  noise.connect(a.windFilter);
  a.windFilter.connect(a.windGain);
  a.windGain.connect(a.master);
  noise.start();
}

export function updateEngineSound(a, plane, dt) {
  if (!a.ctx) return;
  const t = a.ctx.currentTime;
  const throttle = plane.throttle;
  const speed = plane.speed;
  a.engineOsc.frequency.setTargetAtTime(52 + throttle * 95 + speed * 0.25, t, 0.08);
  a.engineOsc2.frequency.setTargetAtTime(26 + throttle * 48, t, 0.08);
  a.engineFilter.frequency.setTargetAtTime(320 + throttle * 900, t, 0.1);
  a.engineGain.gain.setTargetAtTime(plane.airborne || speed > 2 ? 0.05 + throttle * 0.11 : 0.0, t, 0.1);
  a.windGain.gain.setTargetAtTime(Math.min(0.16, speed * 0.0016), t, 0.15);
  a.windFilter.frequency.setTargetAtTime(380 + speed * 9, t, 0.15);
  void dt;
  if (plane.fuel < 20 && plane.fuel > 0 && t - a.alarmAt > 1.2) {
    a.alarmAt = t;
    beep(a, 880, 0.09, 0.12);
  }
}

function beep(a, freq, dur, vol) {
  if (!a.ctx || a.muted) return;
  const t = a.ctx.currentTime;
  const osc = a.ctx.createOscillator();
  const gain = a.ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain);
  gain.connect(a.master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export function ringChime(a) {
  beep(a, 660, 0.12, 0.22);
  if (!a.ctx) return;
  setTimeout(() => beep(a, 990, 0.18, 0.22), 90);
}

export function thudSound(a) {
  if (!a.ctx || a.muted) return;
  const t = a.ctx.currentTime;
  const osc = a.ctx.createOscillator();
  const gain = a.ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(110, t);
  osc.frequency.exponentialRampToValueAtTime(38, t + 0.25);
  gain.gain.setValueAtTime(0.5, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  osc.connect(gain);
  gain.connect(a.master);
  osc.start(t);
  osc.stop(t + 0.32);
}

export function crashSound(a) {
  if (!a.ctx || a.muted) return;
  const t = a.ctx.currentTime;
  const buffer = a.ctx.createBuffer(1, a.ctx.sampleRate * 0.5, a.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = a.ctx.createBufferSource();
  src.buffer = buffer;
  const gain = a.ctx.createGain();
  gain.gain.value = 0.5;
  src.connect(gain);
  gain.connect(a.master);
  src.start(t);
}

export function toggleMute(a) {
  a.muted = !a.muted;
  if (a.master) a.master.gain.value = a.muted ? 0 : 0.5;
  return a.muted;
}
