import { create } from 'zustand';
import type { AvatarConfig } from '../avatar/config';
import type { RoomId } from './layout';

export type Overlay =
  | null
  | { type: 'photo'; slot: number }
  | { type: 'cinema' }
  | { type: 'music' }
  | { type: 'exit' }
  | { type: 'help' }
  | { type: 'people' };

export interface PlayerInfo {
  id: string;
  name: string;
  avatar: AvatarConfig;
  role: 'host' | 'guest';
}

export interface ChatMsg {
  mid: string;
  id: string; // sender user id
  name: string;
  text: string;
  ts: number; // local receive time
}

export interface Notice {
  id: number;
  text: string;
}

interface GameState {
  overlay: Overlay;
  chatOpen: boolean;
  prompt: { text: string; key: string } | null;
  room: RoomId | null;
  seated: string | null;
  dancing: boolean;
  danceStyle: number;
  players: PlayerInfo[]; // everyone currently present (incl. me)
  messages: ChatMsg[];
  notices: Notice[];
  connection: 'connecting' | 'online' | 'reconnecting';
  confetti: { id: number; x: number; z: number }[];
  mouseLook: boolean;
  set: (p: Partial<GameState>) => void;
  setOverlay: (o: Overlay) => void;
  addMessage: (m: ChatMsg) => void;
  notify: (text: string) => void;
  addConfetti: (x: number, z: number) => void;
  reset: () => void;
}

let nid = 0;

const initial = {
  overlay: null as Overlay,
  chatOpen: false,
  prompt: null,
  room: null,
  seated: null,
  dancing: false,
  danceStyle: 0,
  players: [] as PlayerInfo[],
  messages: [] as ChatMsg[],
  notices: [] as Notice[],
  connection: 'connecting' as const,
  confetti: [] as { id: number; x: number; z: number }[],
  mouseLook: false,
};

export const useGame = create<GameState>((set, get) => ({
  ...initial,
  set: (p) => set(p),
  setOverlay: (overlay) => {
    if (document.pointerLockElement) document.exitPointerLock();
    set({ overlay });
  },
  addMessage: (m) => set({ messages: [...get().messages.slice(-60), m] }),
  notify: (text) => {
    const id = ++nid;
    set({ notices: [...get().notices, { id, text }] });
    setTimeout(() => set({ notices: get().notices.filter((n) => n.id !== id) }), 6000);
  },
  addConfetti: (x, z) => {
    const id = ++nid;
    set({ confetti: [...get().confetti, { id, x, z }] });
    setTimeout(() => set({ confetti: get().confetti.filter((c) => c.id !== id) }), 6000);
  },
  reset: () => set({ ...initial }),
}));

export const CHAT_TTL = 10_000;

/** True while the player is typing or a dialog is open (movement keys must be ignored). */
export function inputBlocked() {
  const s = useGame.getState();
  return s.chatOpen || (s.overlay !== null && s.overlay.type !== 'cinema' && s.overlay.type !== 'music');
}
