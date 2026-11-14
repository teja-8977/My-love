/** Tiny synthesized sound effects for the countdown (no audio files). */
let ctx: AudioContext | null = null;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function unlockSfx() {
  try {
    ac();
  } catch {
    /* audio unavailable */
  }
}

function tone(freq: number, start: number, dur: number, vol: number, type: OscillatorType = 'sine') {
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  o.connect(g).connect(c.destination);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.start(start);
  o.stop(start + dur + 0.05);
}

/** deep heartbeat-like tick for 5..1 */
export function countdownTick(n: number) {
  try {
    const c = ac();
    const t = c.currentTime;
    const base = 196 + (5 - n) * 22;
    tone(base, t, 0.9, 0.22, 'sine');
    tone(base * 2, t, 0.5, 0.06, 'triangle');
    tone(base * 3.01, t + 0.02, 0.35, 0.03, 'sine');
  } catch {
    /* ignore */
  }
}

/** shimmering chord + whoosh when the doors open */
export function doorsChime() {
  try {
    const c = ac();
    const t = c.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, t + i * 0.08, 2.4, 0.08, 'sine'));
    const len = Math.floor(c.sampleRate * 1.6);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(2400, t + 1.4);
    const g = c.createGain();
    g.gain.value = 0.12;
    src.connect(f).connect(g).connect(c.destination);
    src.start(t);
  } catch {
    /* ignore */
  }
}

/** Soft music-box lullaby for reading the birthday letter (local only). Returns a stop function. */
export function startLetterMusic(): () => void {
  let stopped = false;
  let timer = 0;
  try {
    const c = ac();
    const master = c.createGain();
    master.gain.value = 0;
    master.connect(c.destination);
    master.gain.setTargetAtTime(0.5, c.currentTime, 1.2);
    // gentle melody in C major (MIDI notes), 3/4 feel
    const melody = [72, 76, 79, 76, 77, 74, 71, 74, 72, 76, 79, 84, 83, 79, 76, 74, 72, 76, 79, 76, 81, 79, 77, 76, 74, 77, 76, 74, 72];
    const bass = [48, 45, 41, 43];
    const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
    const bell = (f: number, t: number, vol: number) => {
      [1, 2.76, 5.4].forEach((ratio, i) => {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = 'sine';
        o.frequency.value = f * ratio;
        o.connect(g).connect(master);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol / (i * 2.5 + 1), t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2 - i * 0.6);
        o.start(t);
        o.stop(t + 2.3);
      });
    };
    const beat = 0.48;
    let step = 0;
    let next = c.currentTime + 0.3;
    timer = window.setInterval(() => {
      if (stopped) return;
      while (next < c.currentTime + 0.25) {
        const n = melody[step % melody.length];
        bell(hz(n), next, 0.07);
        if (step % 3 === 0) bell(hz(bass[Math.floor(step / 6) % bass.length]), next, 0.045);
        next += step % melody.length === melody.length - 1 ? beat * 3 : beat;
        step++;
      }
    }, 60);
    return () => {
      stopped = true;
      clearInterval(timer);
      master.gain.setTargetAtTime(0.0001, c.currentTime, 0.4);
      setTimeout(() => master.disconnect(), 1500);
    };
  } catch {
    return () => {};
  }
}
