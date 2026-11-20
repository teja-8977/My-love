import { create } from 'zustand';
import type { MuseumNet } from './MuseumNet';
import { useGame } from '../store';

/** A call-setup message, carried over the museum's realtime channel. */
export interface RtcSignal {
  from: string;
  /** recipient id, or '*' for everyone */
  to: string;
  type: 'offer' | 'answer' | 'ice' | 'mic';
  data?: unknown;
  on?: boolean;
}

interface VoiceState {
  micOn: boolean;
  busy: boolean;
  /** who has their mic on (remote players) */
  mics: Record<string, boolean>;
  toggle: () => void;
}

export const useVoice = create<VoiceState>(() => ({ micOn: false, busy: false, mics: {}, toggle: () => {} }));

const ICE: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];

interface Peer {
  pc: RTCPeerConnection;
  audio: HTMLAudioElement;
}

/**
 * Voice chat for everyone in the tour: a direct (peer-to-peer) audio connection to each other player.
 * Everyone can always hear; your own microphone starts OFF and is switched with the mic button / M.
 * The player with the larger id starts each call, so two people never call each other at the same time.
 */
export class VoiceChat {
  private peers = new Map<string, Peer>();
  private pendingIce = new Map<string, RTCIceCandidateInit[]>();
  private track: MediaStreamTrack | null = null;
  private stream: MediaStream | null = null;
  private timer: ReturnType<typeof setInterval>;
  private offs: (() => void)[] = [];
  private disposed = false;

  constructor(private net: MuseumNet) {
    this.offs.push(net.on('rtc', (m) => void this.onSignal(m)));
    this.offs.push(net.on('leave', (p) => this.drop(p.id)));
    this.timer = setInterval(() => this.tick(), 3000);
    setTimeout(() => this.tick(), 800);
    // browsers only play sound after the user has touched the page
    const unlock = () => this.peers.forEach((p) => p.audio.play().catch(() => {}));
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    this.offs.push(() => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    });
    useVoice.setState({ micOn: false, busy: false, mics: {}, toggle: () => void this.setMic(!useVoice.getState().micOn) });
  }

  private get me() {
    return this.net.me.id;
  }

  private send(s: Omit<RtcSignal, 'from'>) {
    this.net.sendRtc({ ...s, from: this.me });
  }

  /** connect to everyone we should call, forget people who left, re-announce our mic */
  private tick() {
    if (this.disposed) return;
    const ids = new Set(useGame.getState().players.map((p) => p.id));
    for (const id of ids) if (id !== this.me && !this.peers.has(id) && this.me > id) void this.call(id);
    for (const id of [...this.peers.keys()]) if (!ids.has(id)) this.drop(id);
    if (useVoice.getState().micOn) this.send({ to: '*', type: 'mic', on: true });
  }

  private createPeer(id: string): Peer {
    this.drop(id);
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const audio = new Audio();
    audio.autoplay = true;
    pc.onicecandidate = (e) => e.candidate && this.send({ to: id, type: 'ice', data: e.candidate.toJSON() });
    pc.ontrack = (e) => {
      audio.srcObject = e.streams[0] ?? new MediaStream([e.track]);
      audio.play().catch(() => {});
    };
    pc.onconnectionstatechange = () => {
      // a failed call is dropped; the next tick calls again
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        if (this.peers.get(id)?.pc === pc) this.drop(id);
      }
    };
    const peer = { pc, audio };
    this.peers.set(id, peer);
    return peer;
  }

  private async call(id: string) {
    const { pc } = this.createPeer(id);
    const tr = pc.addTransceiver('audio', { direction: 'sendrecv' });
    if (this.track) await tr.sender.replaceTrack(this.track);
    await pc.setLocalDescription(await pc.createOffer());
    this.send({ to: id, type: 'offer', data: pc.localDescription?.toJSON() });
  }

  private async flushIce(id: string, pc: RTCPeerConnection) {
    const list = this.pendingIce.get(id) ?? [];
    this.pendingIce.delete(id);
    for (const c of list) await pc.addIceCandidate(c).catch(() => {});
  }

  private async onSignal(m: RtcSignal) {
    if (this.disposed || !m || m.from === this.me || (m.to !== this.me && m.to !== '*')) return;
    try {
      if (m.type === 'mic') {
        useVoice.setState((s) => ({ mics: { ...s.mics, [m.from]: !!m.on } }));
      } else if (m.type === 'offer') {
        const { pc } = this.createPeer(m.from);
        await pc.setRemoteDescription(m.data as RTCSessionDescriptionInit);
        for (const t of pc.getTransceivers()) {
          t.direction = 'sendrecv';
          if (this.track) await t.sender.replaceTrack(this.track);
        }
        await pc.setLocalDescription(await pc.createAnswer());
        this.send({ to: m.from, type: 'answer', data: pc.localDescription?.toJSON() });
        await this.flushIce(m.from, pc);
        if (useVoice.getState().micOn) this.send({ to: m.from, type: 'mic', on: true });
      } else if (m.type === 'answer') {
        const p = this.peers.get(m.from);
        if (p && p.pc.signalingState === 'have-local-offer') {
          await p.pc.setRemoteDescription(m.data as RTCSessionDescriptionInit);
          await this.flushIce(m.from, p.pc);
        }
      } else if (m.type === 'ice') {
        const p = this.peers.get(m.from);
        if (p?.pc.remoteDescription) await p.pc.addIceCandidate(m.data as RTCIceCandidateInit).catch(() => {});
        else this.pendingIce.set(m.from, [...(this.pendingIce.get(m.from) ?? []), m.data as RTCIceCandidateInit]);
      }
    } catch {
      /* a broken negotiation is retried by the next tick */
      this.drop(m.from);
    }
  }

  private drop(id: string) {
    const p = this.peers.get(id);
    if (!p) return;
    this.peers.delete(id);
    p.pc.close();
    p.audio.srcObject = null;
    useVoice.setState((s) => {
      const mics = { ...s.mics };
      delete mics[id];
      return { mics };
    });
  }

  async setMic(on: boolean) {
    if (this.disposed) return;
    if (on && !this.track) {
      if (!navigator.mediaDevices?.getUserMedia) {
        useGame.getState().notify('This browser cannot use the microphone');
        return;
      }
      useVoice.setState({ busy: true });
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
        this.track = this.stream.getAudioTracks()[0] ?? null;
        for (const p of this.peers.values()) for (const t of p.pc.getTransceivers()) await t.sender.replaceTrack(this.track).catch(() => {});
      } catch (e) {
        useVoice.setState({ busy: false });
        const denied = (e as Error)?.name === 'NotAllowedError';
        useGame.getState().notify(denied ? 'Microphone blocked — allow it in the browser (🔒 next to the address)' : 'No microphone found');
        return;
      }
      useVoice.setState({ busy: false });
    }
    if (this.track) this.track.enabled = on;
    useVoice.setState({ micOn: on && !!this.track });
    this.send({ to: '*', type: 'mic', on: on && !!this.track });
  }

  dispose() {
    this.disposed = true;
    clearInterval(this.timer);
    this.offs.forEach((o) => o());
    if (useVoice.getState().micOn) this.send({ to: '*', type: 'mic', on: false });
    for (const id of [...this.peers.keys()]) this.drop(id);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.track = null;
    useVoice.setState({ micOn: false, busy: false, mics: {}, toggle: () => {} });
  }
}
