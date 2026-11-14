import type { RealtimeChannel } from '@supabase/supabase-js';
import * as THREE from 'three';
import { supabase } from '../../lib/supabase';
import { sanitizeAvatar, type AvatarConfig } from '../../avatar/config';
import type { AnimName } from '../../avatar/poses';
import type { AnimState } from '../../avatar/Avatar';
import { useGame, type PlayerInfo } from '../store';

/** Compact player state sent ~12x per second. */
export interface NetState {
  id: string;
  x: number;
  y: number;
  z: number;
  r: number; // yaw
  a: AnimName;
  d: number; // dance style
  v: number; // horizontal speed
  s: string | null; // seat id
}

export interface VideoState {
  index: number;
  playing: boolean;
  time: number;
  at: number; // sender epoch ms
}

export interface MusicState {
  track: number | null;
  startedAt: number;
}

export type HostEvent =
  | { type: 'left'; name: string }
  | { type: 'ended'; name: string }
  | { type: 'transferred'; name: string; newHostId: string; newHostName: string };

export interface RemotePlayer {
  id: string;
  target: NetState | null;
  pos: THREE.Vector3;
  yaw: number;
  anim: { current: AnimState };
  lastUpdate: number;
}

type Handlers = {
  video: (v: VideoState, from: string) => void;
  videoRequest: (from: string) => void;
  music: (m: MusicState, from: string) => void;
  musicRequest: (from: string) => void;
  party: (p: { x: number; z: number }) => void;
  host: (e: HostEvent) => void;
  kick: (userId: string) => void;
  join: (p: PlayerInfo) => void;
  leave: (p: PlayerInfo) => void;
};

export interface Me {
  id: string;
  name: string;
  avatar: AvatarConfig;
  role: 'host' | 'guest';
}

const MAX_CHAT = 280;

export class MuseumNet {
  readonly museumId: string;
  me: Me;
  channel: RealtimeChannel | null = null;
  remotes = new Map<string, RemotePlayer>();
  private handlers: { [K in keyof Handlers]?: Set<Handlers[K]> } = {};
  private known = new Map<string, PlayerInfo>();
  private closed = false;

  constructor(museumId: string, me: Me) {
    this.museumId = museumId;
    this.me = me;
  }

  on<K extends keyof Handlers>(evt: K, fn: Handlers[K]) {
    const set = (this.handlers[evt] ??= new Set() as never) as Set<Handlers[K]>;
    set.add(fn);
    return () => set.delete(fn);
  }

  private emit<K extends keyof Handlers>(evt: K, ...args: Parameters<Handlers[K]>) {
    const set = this.handlers[evt] as Set<(...a: Parameters<Handlers[K]>) => void> | undefined;
    set?.forEach((fn) => fn(...args));
  }

  async connect() {
    const game = useGame.getState();
    game.set({ connection: 'connecting' });
    await supabase.realtime.setAuth();
    if (this.closed) return; // disposed while connecting (e.g. React dev double-mount)

    const ch = supabase.channel(`museum:${this.museumId}`, {
      config: { private: true, broadcast: { self: false, ack: false }, presence: { key: this.me.id } },
    });
    this.channel = ch;

    ch.on('presence', { event: 'sync' }, () => this.syncPresence());

    ch.on('broadcast', { event: 'st' }, ({ payload }) => this.onState(payload as NetState));
    ch.on('broadcast', { event: 'chat' }, ({ payload }) => {
      const p = payload as { id: string; name: string; text: string; mid: string };
      if (typeof p?.text !== 'string' || typeof p.id !== 'string') return;
      useGame.getState().addMessage({ mid: String(p.mid), id: p.id, name: String(p.name).slice(0, 40), text: p.text.slice(0, MAX_CHAT), ts: Date.now() });
    });
    ch.on('broadcast', { event: 'video' }, ({ payload }) => {
      const p = payload as VideoState & { from: string };
      this.emit('video', p, p.from);
    });
    ch.on('broadcast', { event: 'video-req' }, ({ payload }) => this.emit('videoRequest', (payload as { from: string }).from));
    ch.on('broadcast', { event: 'music' }, ({ payload }) => {
      const p = payload as MusicState & { from: string };
      this.emit('music', p, p.from);
    });
    ch.on('broadcast', { event: 'music-req' }, ({ payload }) => this.emit('musicRequest', (payload as { from: string }).from));
    ch.on('broadcast', { event: 'party' }, ({ payload }) => this.emit('party', payload as { x: number; z: number }));
    ch.on('broadcast', { event: 'host' }, ({ payload }) => this.emit('host', payload as HostEvent));
    ch.on('broadcast', { event: 'kick' }, ({ payload }) => this.emit('kick', (payload as { id: string }).id));

    await new Promise<void>((resolve) => {
      let first = true;
      ch.subscribe(async (status) => {
        if (this.closed) return;
        if (status === 'SUBSCRIBED') {
          await ch.track({ id: this.me.id, name: this.me.name, avatar: this.me.avatar, role: this.me.role, t: Date.now() });
          useGame.getState().set({ connection: 'online' });
          if (first) {
            first = false;
            resolve();
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          useGame.getState().set({ connection: 'reconnecting' });
          if (first && status === 'CHANNEL_ERROR') {
            first = false;
            resolve();
          }
        }
      });
    });
  }

  /** Re-announce (after avatar or role change). */
  async retrack(patch: Partial<Me>) {
    this.me = { ...this.me, ...patch };
    await this.channel?.track({ id: this.me.id, name: this.me.name, avatar: this.me.avatar, role: this.me.role, t: Date.now() });
  }

  private syncPresence() {
    if (!this.channel) return;
    const state = this.channel.presenceState<{ id: string; name: string; avatar: unknown; role: 'host' | 'guest' }>();
    const players: PlayerInfo[] = [];
    for (const [key, metas] of Object.entries(state)) {
      const m = metas[metas.length - 1];
      if (!m) continue;
      players.push({ id: key, name: String(m.name ?? 'Guest').slice(0, 40), avatar: sanitizeAvatar(m.avatar), role: m.role === 'host' ? 'host' : 'guest' });
    }
    const ids = new Set(players.map((p) => p.id));
    // joins
    for (const p of players) {
      if (!this.known.has(p.id) && p.id !== this.me.id) this.emit('join', p);
      this.known.set(p.id, p);
    }
    // leaves
    for (const [id, p] of this.known) {
      if (!ids.has(id)) {
        this.known.delete(id);
        this.remotes.delete(id);
        if (id !== this.me.id) this.emit('leave', p);
      }
    }
    for (const p of players) {
      if (p.id !== this.me.id && !this.remotes.has(p.id)) {
        this.remotes.set(p.id, {
          id: p.id,
          target: null,
          pos: new THREE.Vector3(0, 0, 4),
          yaw: Math.PI,
          anim: { current: { anim: 'idle', dance: 0, speed: 1 } },
          lastUpdate: 0,
        });
      }
    }
    if (!ids.has(this.me.id)) players.push({ id: this.me.id, name: this.me.name, avatar: this.me.avatar, role: this.me.role });
    useGame.getState().set({ players });
  }

  private onState(s: NetState) {
    if (!s || typeof s.id !== 'string' || s.id === this.me.id) return;
    if (![s.x, s.y, s.z, s.r].every(Number.isFinite)) return;
    let r = this.remotes.get(s.id);
    if (!r) {
      r = { id: s.id, target: null, pos: new THREE.Vector3(s.x, s.y, s.z), yaw: s.r, anim: { current: { anim: 'idle', dance: 0, speed: 1 } }, lastUpdate: 0 };
      this.remotes.set(s.id, r);
    }
    if (!r.target) {
      r.pos.set(s.x, s.y, s.z);
      r.yaw = s.r;
    }
    r.target = s;
    r.lastUpdate = performance.now();
  }

  // ------------- senders -------------
  private send(event: string, payload: object) {
    if (!this.channel) return;
    this.channel.send({ type: 'broadcast', event, payload }).catch(() => {});
  }

  sendState(s: Omit<NetState, 'id'>) {
    this.send('st', { ...s, id: this.me.id });
  }

  sendChat(text: string) {
    const clean = text.trim().slice(0, MAX_CHAT);
    if (!clean) return;
    const msg = { id: this.me.id, name: this.me.name, text: clean, mid: `${this.me.id}:${Date.now()}` };
    this.send('chat', msg);
    useGame.getState().addMessage({ ...msg, ts: Date.now() });
  }

  sendVideo(v: VideoState) {
    this.send('video', { ...v, from: this.me.id });
  }
  requestVideo() {
    this.send('video-req', { from: this.me.id });
  }
  sendMusic(m: MusicState) {
    this.send('music', { ...m, from: this.me.id });
  }
  requestMusic() {
    this.send('music-req', { from: this.me.id });
  }
  sendParty(x: number, z: number) {
    this.send('party', { x, z });
  }
  sendHost(e: HostEvent) {
    this.send('host', e);
  }
  sendKick(id: string) {
    this.send('kick', { id });
  }

  async close() {
    this.closed = true;
    if (this.channel) {
      try {
        await this.channel.untrack();
      } catch {
        /* ignore */
      }
      await supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.remotes.clear();
    this.known.clear();
  }
}
