import { create } from 'zustand';
import { roomAt, type RoomId } from './layout';

export type Quality = 'high' | 'low';

function initialQuality(): Quality {
  try {
    const q = new URLSearchParams(window.location.search).get('quality');
    if (q === 'low' || q === 'high') return q;
    const saved = localStorage.getItem('lm-quality');
    if (saved === 'low' || saved === 'high') return saved;
  } catch {
    /* ignore */
  }
  // phones / tablets start in the lighter mode
  const touch = window.matchMedia?.('(hover: none) and (pointer: coarse)').matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  return touch || small ? 'low' : 'high';
}

export const useQuality = create<{ quality: Quality; auto: boolean; set: (q: Quality, auto?: boolean) => void }>((set) => ({
  quality: initialQuality(),
  auto: true,
  set: (quality, auto = false) => {
    try {
      if (!auto) localStorage.setItem('lm-quality', quality);
    } catch {
      /* ignore */
    }
    set({ quality, auto });
  },
}));

/**
 * Which rooms can be seen from where. Only the room you are in and the rooms directly
 * connected to it are rendered (their lights included) — the rest of the building is hidden.
 */
const LINKS: Record<RoomId, RoomId[]> = {
  portico: ['entrance'],
  entrance: ['portico', 'welcome', 'forever', 'final'],
  welcome: ['entrance', 'gallery'],
  gallery: ['welcome', 'cinema', 'celebration'],
  cinema: ['gallery', 'forever'],
  forever: ['cinema', 'entrance'],
  celebration: ['gallery', 'final'],
  final: ['celebration', 'entrance'],
  c1: ['entrance', 'welcome'],
  c2: ['welcome', 'gallery'],
  c3: ['gallery', 'cinema'],
  c4: ['cinema', 'forever'],
  c5: ['forever', 'entrance'],
  c6: ['gallery', 'celebration'],
  c7: ['celebration', 'final'],
  c8: ['final', 'entrance'],
};

export function visibleRooms(x: number, z: number): Set<RoomId> {
  const here = roomAt(x, z)?.id;
  if (!here) return new Set(['portico', 'entrance'] as RoomId[]);
  const out = new Set<RoomId>([here, ...LINKS[here]]);
  // from a corridor you can look into both rooms and through their doors
  if (/^c\d$/.test(here)) for (const r of LINKS[here]) LINKS[r].forEach((n) => out.add(n));
  return out;
}

export const linkedTo = (id: RoomId) => LINKS[id] ?? [];
