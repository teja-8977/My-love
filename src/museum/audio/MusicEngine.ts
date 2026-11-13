import { create } from 'zustand';
import type { MuseumNet, MusicState } from '../net/MuseumNet';

export const TRACKS = [
  { name: 'Slow Dance', mood: 'Tender & warm', bpm: 72 },
  { name: 'Celebration', mood: 'Bright & bouncy', bpm: 116 },
  { name: 'Starlight', mood: 'Music-box dreams', bpm: 92 },
] as const;

export const useMusic = create<{ track: number | null; volume: number }>(() => ({ track: null, volume: 0.7 }));

// MIDI helpers
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// chord progressions (MIDI roots + chord tones)
const PROG: number[][][] = [
  // Slow Dance: Cmaj7 – Am7 – Fmaj7 – G6
  [[48, 52, 55, 59], [45, 52, 55, 60], [41, 48, 52, 57], [43, 50, 55, 59]],
  // Celebration: F – G – Em – Am
  [[53, 57, 60, 64], [55, 59, 62, 67], [52, 55, 59, 64], [57, 60, 64, 69]],
  // Starlight: D – Bm – G – A
  [[50, 54, 57, 62], [47, 50, 54, 59], [43, 50, 55, 59], [45, 49, 52, 57]],
];

/**
 * Small generative synth (Web Audio) — no audio files needed.
 * The selected track is shared over the realtime channel so everyone hears the same song.
 */
export class MusicEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer = 0;
  private step = 0;
  private nextTime = 0;
  private proximity = 0.1;
  private startedAt = 0;
  private offs: (() => void)[] = [];
  private net: MuseumNet;
  private isHost: () => boolean;

  constructor(net: MuseumNet, isHost: () => boolean) {
    this.net = net;
    this.isHost = isHost;
    this.offs.push(
      net.on('music', (m) => this.applyRemote(m)),
      net.on('musicRequest', () => {
        if (this.isHost()) net.sendMusic({ track: useMusic.getState().track, startedAt: this.startedAt });
      }),
    );
    net.requestMusic();
  }

  /** Must be called from a user gesture at least once (browser autoplay rules). */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp).connect(this.ctx.destination);
      this.updateGain();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (useMusic.getState().track !== null && !this.timer) this.startLoop();
  }

  private applyRemote(m: MusicState) {
    if (m.track !== null && (typeof m.track !== 'number' || !TRACKS[m.track])) return;
    this.startedAt = m.startedAt;
    useMusic.setState({ track: m.track });
    if (m.track === null) this.stopLoop();
    else if (this.ctx) this.restartLoop();
  }

  play(track: number | null) {
    this.startedAt = Date.now();
    useMusic.setState({ track });
    this.net.sendMusic({ track, startedAt: this.startedAt });
    if (track === null) this.stopLoop();
    else {
      this.unlock();
      this.restartLoop();
    }
  }

  setVolume(v: number) {
    useMusic.setState({ volume: v });
    this.updateGain();
  }

  setProximity(p: number) {
    if (Math.abs(p - this.proximity) < 0.01) return;
    this.proximity = p;
    this.updateGain();
  }

  private updateGain() {
    if (!this.ctx || !this.master) return;
    const target = useMusic.getState().volume * this.proximity * 0.5;
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.4);
  }

  private restartLoop() {
    this.stopLoop();
    this.startLoop();
  }

  private startLoop() {
    if (!this.ctx) return;
    // align roughly to the shared start time so everyone is on the same bar
    const track = useMusic.getState().track ?? 0;
    const sixteenth = 60 / TRACKS[track].bpm / 4;
    const elapsed = Math.max(0, (Date.now() - this.startedAt) / 1000);
    this.step = Math.floor(elapsed / sixteenth);
    this.nextTime = this.ctx.currentTime + 0.05;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  private stopLoop() {
    clearInterval(this.timer);
    this.timer = 0;
  }

  private schedule() {
    const ctx = this.ctx;
    const track = useMusic.getState().track;
    if (!ctx || track === null) return;
    const bpm = TRACKS[track].bpm;
    const sixteenth = 60 / bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.12) {
      this.playStep(track, this.step, this.nextTime, sixteenth);
      this.nextTime += sixteenth;
      this.step++;
    }
  }

  private playStep(track: number, step: number, t: number, sixteenth: number) {
    const bar = Math.floor(step / 16) % 4;
    const s = step % 16;
    const chord = PROG[track][bar];
    if (track === 0) {
      if (s === 0) chord.forEach((n) => this.pad(hz(n), t, sixteenth * 16, 0.06));
      if (s % 4 === 0) this.pluck(hz(chord[(s / 4) % 4] + 12), t, 0.09, 1.2);
      if (s === 0 || s === 8) this.bass(hz(chord[0] - 12), t, sixteenth * 7, 0.18);
      if (s === 10) this.pluck(hz(chord[2] + 24), t, 0.04, 1.5);
    } else if (track === 1) {
      if (s % 4 === 0) this.kick(t);
      if (s % 8 === 4) this.snare(t);
      if (s % 2 === 1) this.hat(t);
      if (s % 4 === 2) chord.slice(1).forEach((n) => this.pluck(hz(n + 12), t, 0.05, 0.25));
      if (s % 4 === 0) this.bass(hz(chord[0] - 12), t, sixteenth * 3, 0.22);
      if ([0, 3, 6, 10, 12].includes(s)) this.pluck(hz(chord[(s >> 2) % 4] + 24), t, 0.05, 0.3);
    } else {
      if (s === 0) chord.forEach((n) => this.pad(hz(n), t, sixteenth * 16, 0.035));
      const arp = [0, 1, 2, 3, 2, 1];
      if (s % 2 === 0) this.bell(hz(chord[arp[(s / 2) % arp.length]] + 24), t, 0.07);
      if (s === 0) this.bass(hz(chord[0] - 12), t, sixteenth * 14, 0.14);
    }
  }

  // ---------- voices ----------
  private env(g: GainNode, t: number, a: number, peak: number, d: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  private pad(f: number, t: number, dur: number, vol: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    [-6, 6].forEach((det) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.6);
    });
    lp.connect(g).connect(this.master!);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.6);
    g.gain.setValueAtTime(vol, t + dur - 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.5);
  }

  private pluck(f: number, t: number, vol: number, dec: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = f;
    o.connect(g).connect(this.master!);
    this.env(g, t, 0.005, vol, dec);
    o.start(t);
    o.stop(t + dec + 0.05);
  }

  private bell(f: number, t: number, vol: number) {
    const ctx = this.ctx!;
    [1, 2.76].forEach((ratio, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f * ratio;
      o.connect(g).connect(this.master!);
      this.env(g, t, 0.003, vol / (i * 3 + 1), 1.4 - i * 0.8);
      o.start(t);
      o.stop(t + 1.5);
    });
  }

  private bass(f: number, t: number, dur: number, vol: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    o.connect(g).connect(this.master!);
    this.env(g, t, 0.01, vol, dur);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private kick(t: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    o.connect(g).connect(this.master!);
    this.env(g, t, 0.002, 0.5, 0.22);
    o.start(t);
    o.stop(t + 0.3);
  }

  private noise(t: number, dur: number, vol: number, hp: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = hp;
    const g = ctx.createGain();
    src.connect(f).connect(g).connect(this.master!);
    this.env(g, t, 0.002, vol, dur);
    src.start(t);
  }

  private snare(t: number) {
    this.noise(t, 0.18, 0.16, 1500);
  }

  private hat(t: number) {
    this.noise(t, 0.05, 0.05, 7000);
  }

  dispose() {
    this.stopLoop();
    this.offs.forEach((o) => o());
    this.ctx?.close();
    this.ctx = null;
  }
}
