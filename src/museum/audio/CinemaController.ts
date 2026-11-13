import * as THREE from 'three';
import { create } from 'zustand';
import type { ResolvedMedia } from '../../lib/types';
import type { MuseumNet, VideoState } from '../net/MuseumNet';

export interface CinemaUi {
  index: number;
  playing: boolean;
  time: number;
  duration: number;
  volume: number;
  muted: boolean;
  needsGesture: boolean;
  buffering: boolean;
}

export const useCinema = create<CinemaUi>(() => ({
  index: 0,
  playing: false,
  time: 0,
  duration: 0,
  volume: 0.8,
  muted: false,
  needsGesture: false,
  buffering: false,
}));

const DRIFT = 0.6; // seconds of tolerated drift before re-seeking

/**
 * One shared <video> element drives the 3D cinema screen (via VideoTexture)
 * and the fullscreen player. The HOST is the single source of truth: guests
 * follow the host's broadcast state (play / pause / seek / video selection).
 */
export class CinemaController {
  readonly video: HTMLVideoElement;
  readonly texture: THREE.VideoTexture;
  videos: ResolvedMedia[] = [];
  private net: MuseumNet;
  private isHost: () => boolean;
  private heartbeat = 0;
  private proximity = 0;
  private offs: (() => void)[] = [];
  private pending: VideoState | null = null;

  constructor(net: MuseumNet, isHost: () => boolean) {
    this.net = net;
    this.isHost = isHost;
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous';
    v.playsInline = true;
    v.preload = 'auto';
    v.setAttribute('webkit-playsinline', 'true');
    v.className = 'h-full w-full bg-black object-contain';
    this.video = v;
    this.texture = new THREE.VideoTexture(v);
    this.texture.colorSpace = THREE.SRGBColorSpace;

    const ui = () =>
      useCinema.setState({
        time: v.currentTime || 0,
        duration: Number.isFinite(v.duration) ? v.duration : 0,
        playing: !v.paused && !v.ended,
      });
    v.addEventListener('timeupdate', ui);
    v.addEventListener('durationchange', ui);
    v.addEventListener('play', ui);
    v.addEventListener('pause', ui);
    v.addEventListener('waiting', () => useCinema.setState({ buffering: true }));
    v.addEventListener('playing', () => useCinema.setState({ buffering: false }));
    v.addEventListener('canplay', () => {
      useCinema.setState({ buffering: false });
      if (this.pending) {
        const p = this.pending;
        this.pending = null;
        this.apply(p);
      }
    });
    v.addEventListener('ended', () => {
      if (this.isHost()) this.broadcast();
    });

    this.offs.push(
      net.on('video', (s) => {
        if (!this.isHost()) this.apply(s);
      }),
      net.on('videoRequest', () => {
        if (this.isHost()) this.broadcast();
      }),
    );
    this.heartbeat = window.setInterval(() => {
      if (this.isHost() && !v.paused) this.broadcast();
    }, 2000);
  }

  setVideos(videos: ResolvedMedia[]) {
    this.videos = [...videos].sort((a, b) => a.slot - b.slot);
    if (!this.video.src && this.videos.length) this.load(useCinema.getState().index);
    if (!this.isHost()) this.net.requestVideo();
  }

  private load(index: number) {
    const item = this.videos[index];
    if (!item) return;
    useCinema.setState({ index, time: 0, duration: 0 });
    if (this.video.src !== item.url) {
      this.video.src = item.url;
      this.video.load();
    }
  }

  /** guests: follow host state */
  private apply(s: VideoState) {
    if (typeof s?.index !== 'number' || !this.videos.length) {
      this.pending = s;
      return;
    }
    const idx = Math.max(0, Math.min(this.videos.length - 1, s.index));
    if (idx !== useCinema.getState().index || !this.video.src) {
      this.load(idx);
      this.pending = s;
      return;
    }
    const v = this.video;
    const latency = Math.min(2, Math.max(0, (Date.now() - s.at) / 1000));
    const expected = s.time + (s.playing ? latency : 0);
    if (v.readyState >= 1 && Math.abs(v.currentTime - expected) > DRIFT) {
      try {
        v.currentTime = expected;
      } catch {
        /* not seekable yet */
      }
    }
    if (s.playing && v.paused) this.tryPlay();
    if (!s.playing && !v.paused) v.pause();
  }

  private tryPlay() {
    this.video.play().then(
      () => useCinema.setState({ needsGesture: false }),
      () => useCinema.setState({ needsGesture: true }),
    );
  }

  /** called from a user click when autoplay was blocked */
  unlock() {
    this.tryPlay();
    if (!this.isHost()) this.net.requestVideo();
  }

  private broadcast() {
    const v = this.video;
    this.net.sendVideo({ index: useCinema.getState().index, playing: !v.paused && !v.ended, time: v.currentTime || 0, at: Date.now() });
  }

  // ---------- host controls ----------
  select(index: number) {
    if (!this.isHost()) return;
    this.load(index);
    this.video.addEventListener(
      'canplay',
      () => {
        this.tryPlay();
        this.broadcast();
      },
      { once: true },
    );
    this.broadcast();
  }

  togglePlay() {
    if (!this.isHost()) return;
    if (!this.video.src && this.videos.length) this.load(0);
    if (this.video.paused) {
      this.video.play().then(() => this.broadcast(), () => useCinema.setState({ needsGesture: true }));
    } else {
      this.video.pause();
      this.broadcast();
    }
  }

  seek(t: number) {
    if (!this.isHost()) return;
    this.video.currentTime = Math.max(0, t);
    this.broadcast();
  }

  // ---------- local-only ----------
  setVolume(vol: number) {
    useCinema.setState({ volume: vol, muted: vol === 0 });
    this.updateVolume();
  }

  toggleMute() {
    useCinema.setState({ muted: !useCinema.getState().muted });
    this.updateVolume();
  }

  /** 1 inside the cinema, quieter nearby, silent elsewhere. */
  setProximity(p: number) {
    if (Math.abs(p - this.proximity) < 0.01) return;
    this.proximity = p;
    this.updateVolume();
  }

  private updateVolume() {
    const { volume, muted } = useCinema.getState();
    const fullscreen = document.fullscreenElement === this.video;
    this.video.volume = muted ? 0 : Math.min(1, volume * (fullscreen ? 1 : this.proximity));
  }

  async fullscreen() {
    try {
      await this.video.requestFullscreen();
      this.updateVolume();
      document.addEventListener('fullscreenchange', () => this.updateVolume(), { once: true });
    } catch {
      /* not allowed */
    }
  }

  dispose() {
    clearInterval(this.heartbeat);
    this.offs.forEach((o) => o());
    this.video.pause();
    this.video.removeAttribute('src');
    this.video.load();
    this.texture.dispose();
  }
}
