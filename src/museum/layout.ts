/**
 * Museum floor plan (metres). +X = east, -Z = north. Characters face +Z at yaw 0.
 * Inspired by a neoclassical museum plan: front portico → entrance hall → domed rotunda,
 * a long gallery wing behind it, and two side wings around open courtyards.
 *
 *   ┌───────────┬───────────── II Memory Gallery ─────────────┬────────────┐
 *   │           ╞═══╡                 │                   ╞═══╡            │
 *   │ III Cinema│     courtyard   ( I Rotunda )   courtyard   │ V Celebr.  │
 *   │           │                     │                       │            │
 *   ├────╥──────┤                ┌────┴────┐                  ├─────╥──────┤
 *   │ IV Forever╞════════════════╡ Entrance╞══════════════════╡ VI Final   │→ EXIT
 *   └───────────┴────────────────┴────╥────┴──────────────────┴────────────┘
 *   ○   ○   ○   ○   ○   ○   ○   ○  PORTICO  ○   ○   ○   ○   ○   ○   ○   ○
 *                                ▓▓ steps ▓▓
 */

export type FloorKind = 'parquet' | 'checker' | 'carpet' | 'marble-dark' | 'stone';
export type Side = 'n' | 's' | 'e' | 'w';

export interface DoorSpec {
  at: number; // world coordinate along the wall (x for n/s walls, z for e/w walls)
  width: number;
  height: number;
}
/** rail = invisible collider (e.g. the open colonnade of the portico) */
export type SideSpec = { type: 'solid' } | { type: 'none' } | { type: 'rail' } | { type: 'doors'; doors: DoorSpec[] };

export type RoomId =
  | 'portico' | 'entrance' | 'welcome' | 'gallery' | 'cinema' | 'forever' | 'celebration' | 'final'
  | 'c1' | 'c2' | 'c3' | 'c4' | 'c5' | 'c6' | 'c7' | 'c8';

export interface Palette {
  wall: string; // plain wall / stiles
  panel: string; // inset panel fill
  moulding: string; // white mouldings, pilasters, dado
  gold: string;
  ceiling: string;
}

export const SAGE: Palette = { wall: '#e9e7e1', panel: '#a7b3a1', moulding: '#f4f2ed', gold: '#c9a961', ceiling: '#f3f1ec' };
const ROSE: Palette = { wall: '#efe4e2', panel: '#d7b1b4', moulding: '#f8f2f0', gold: '#c9a961', ceiling: '#f7f0ee' };
const IVORY: Palette = { wall: '#ece4d6', panel: '#dccfb8', moulding: '#f7f2e8', gold: '#c9a961', ceiling: '#f6efe4' };
const WINE: Palette = { wall: '#2a0f16', panel: '#4a1622', moulding: '#5e2532', gold: '#b8904a', ceiling: '#1d0b10' };
const PLUM: Palette = { wall: '#22142a', panel: '#3a2245', moulding: '#4c3159', gold: '#b8904a', ceiling: '#170d19' };

export interface RoomDef {
  id: RoomId;
  name: string;
  subtitle: string;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  height: number;
  floor: FloorKind;
  palette: Palette;
  dark?: boolean;
  corridor?: boolean;
  exterior?: boolean;
  /** the room renders its own ceiling (dome) */
  customCeiling?: boolean;
  /** decorative candle sconces on the panelling */
  sconces?: boolean;
  sides: Record<Side, SideSpec>;
}

const DW = 3.6;
const DH = 3.6;
const solid: SideSpec = { type: 'solid' };
const none: SideSpec = { type: 'none' };
const doors = (...list: (number | [number, number])[]): SideSpec => ({
  type: 'doors',
  doors: list.map((d) => (Array.isArray(d) ? { at: d[0], width: d[1], height: DH + 0.8 } : { at: d, width: DW, height: DH })),
});

function room(r: Omit<RoomDef, 'sides'> & { sides: Partial<Record<Side, SideSpec>> }): RoomDef {
  return { ...r, sides: { n: solid, s: solid, e: solid, w: solid, ...r.sides } };
}

/** axis = direction of travel through the corridor */
function corridor(id: RoomId, axis: 'x' | 'z', x0: number, x1: number, z0: number, z1: number): RoomDef {
  const alongZ = axis === 'z';
  return room({
    id, name: 'Corridor', subtitle: '', x0, x1, z0, z1, height: 4.6, floor: 'parquet', palette: SAGE, corridor: true,
    sides: alongZ ? { n: none, s: none } : { e: none, w: none },
  });
}

export const ROOMS: RoomDef[] = [
  room({ id: 'portico', name: 'The Portico', subtitle: 'Entrance', x0: -31, x1: 31, z0: 21.3, z1: 26.5, height: 9, floor: 'stone', palette: IVORY, exterior: true,
    sides: { n: doors([0, 5]), s: { type: 'rail' } } }),
  room({ id: 'entrance', name: 'Entrance Hall', subtitle: 'Welcome', x0: -9, x1: 9, z0: 9, z1: 21, height: 7.5, floor: 'parquet', palette: SAGE, sconces: true,
    sides: { s: doors([0, 5]), n: doors(0), w: doors(17), e: doors(17) } }),
  corridor('c1', 'z', -1.8, 1.8, 7, 9),
  room({ id: 'welcome', name: 'Welcome to Our Story', subtitle: 'Room I', x0: -9, x1: 9, z0: -11, z1: 7, height: 8, floor: 'checker', palette: IVORY, customCeiling: true, sconces: true,
    sides: { s: doors(0), n: doors(0) } }),
  corridor('c2', 'z', -1.8, 1.8, -13, -11),
  room({ id: 'gallery', name: 'Memory Gallery', subtitle: 'Room II', x0: -17, x1: 17, z0: -21, z1: -13, height: 6.5, floor: 'parquet', palette: SAGE,
    sides: { s: doors(0), w: doors(-17), e: doors(-17) } }),
  corridor('c3', 'x', -19, -17, -18.8, -15.2),
  room({ id: 'cinema', name: 'Our Cinema', subtitle: 'Room III', x0: -31, x1: -19, z0: -21, z1: 1, height: 7.6, floor: 'carpet', palette: WINE, dark: true,
    sides: { e: doors(-17), s: doors(-25) } }),
  corridor('c4', 'z', -26.8, -23.2, 1, 3),
  room({ id: 'forever', name: 'Forever Together', subtitle: 'Room IV', x0: -31, x1: -19, z0: 3, z1: 21, height: 6.2, floor: 'parquet', palette: ROSE, sconces: true,
    sides: { n: doors(-25), e: doors(17) } }),
  corridor('c5', 'x', -19, -9, 15.2, 18.8),
  corridor('c6', 'x', 17, 19, -18.8, -15.2),
  room({ id: 'celebration', name: 'Celebration Hall', subtitle: 'Room V', x0: 19, x1: 31, z0: -21, z1: 1, height: 7, floor: 'marble-dark', palette: PLUM, dark: true,
    sides: { w: doors(-17), s: doors(25) } }),
  corridor('c7', 'z', 23.2, 26.8, 1, 3),
  room({ id: 'final', name: 'Our Final Memory', subtitle: 'Room VI', x0: 19, x1: 31, z0: 3, z1: 21, height: 6.2, floor: 'parquet', palette: SAGE, sconces: true,
    sides: { n: doors(25), w: doors(17) } }),
  corridor('c8', 'x', 9, 19, 15.2, 18.8),
];

export const ROOM_BY_ID = Object.fromEntries(ROOMS.map((r) => [r.id, r])) as Record<RoomId, RoomDef>;
export const JOURNEY: RoomId[] = ['welcome', 'gallery', 'cinema', 'forever', 'celebration', 'final'];

export const SPAWN = { x: 0, z: 24.2, yaw: Math.PI };

export function roomAt(x: number, z: number): RoomDef | null {
  for (const r of ROOMS) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return r;
  return null;
}

// ---------------------------------------------------------------------------
// Walls
// ---------------------------------------------------------------------------
export interface Box {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** low furniture: ignored by the camera */
  low?: boolean;
}

export const WALL_T = 0.3;

export interface WallSeg {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /** direction into the room (unit vector) */
  nx: number;
  nz: number;
  room: RoomDef;
  side: Side;
  /** lintel (above a doorway) — rendered, not collided */
  lintel?: { from: number };
  /** invisible collider only */
  rail?: boolean;
}

function sideSegments(r: RoomDef, side: Side): WallSeg[] {
  const spec = r.sides[side];
  if (spec.type === 'none') return [];
  const horizontal = side === 'n' || side === 's';
  const fixed = side === 'n' ? r.z0 : side === 's' ? r.z1 : side === 'w' ? r.x0 : r.x1;
  const a = horizontal ? r.x0 : r.z0;
  const b = horizontal ? r.x1 : r.z1;
  const nx = side === 'w' ? 1 : side === 'e' ? -1 : 0;
  const nz = side === 'n' ? 1 : side === 's' ? -1 : 0;
  const mk = (p: number, q: number, extra: Partial<WallSeg> = {}): WallSeg =>
    horizontal ? { x0: p, x1: q, z0: fixed, z1: fixed, nx, nz, room: r, side, ...extra } : { x0: fixed, x1: fixed, z0: p, z1: q, nx, nz, room: r, side, ...extra };
  if (spec.type === 'solid') return [mk(a, b)];
  if (spec.type === 'rail') return [mk(a, b, { rail: true })];
  const out: WallSeg[] = [];
  let cursor = a;
  for (const d of [...spec.doors].sort((p, q) => p.at - q.at)) {
    const g0 = d.at - d.width / 2;
    const g1 = d.at + d.width / 2;
    if (g0 > cursor) out.push(mk(cursor, g0));
    out.push(mk(g0, g1, { lintel: { from: d.height } }));
    cursor = g1;
  }
  if (cursor < b) out.push(mk(cursor, b));
  return out;
}

export const WALLS: WallSeg[] = ROOMS.flatMap((r) => (['n', 's', 'e', 'w'] as const).flatMap((s) => sideSegments(r, s)));

const wallBoxes: Box[] = WALLS.filter((w) => !w.lintel).map((w) => ({
  minX: Math.min(w.x0, w.x1) - WALL_T / 2,
  maxX: Math.max(w.x0, w.x1) + WALL_T / 2,
  minZ: Math.min(w.z0, w.z1) - WALL_T / 2,
  maxZ: Math.max(w.z0, w.z1) + WALL_T / 2,
}));

// ---------------------------------------------------------------------------
// Seating — only in front of the cinema screen
// ---------------------------------------------------------------------------
export interface Seat {
  id: string;
  x: number;
  z: number;
  yaw: number;
  room: RoomId;
  /** world point the seated camera looks at */
  look?: [number, number, number];
}

export interface Furniture {
  id: string;
  kind: 'cinema-sofa';
  x: number;
  z: number;
  yaw: number;
  room: RoomId;
  seats: Seat[];
  color?: string;
}

const CIN = ROOM_BY_ID.cinema;
const CIN_CX = (CIN.x0 + CIN.x1) / 2;
export const CINEMA_SCREEN = { x: CIN_CX, y: 4.0, z: CIN.z0 + 0.36, w: 10, h: 5.6 };
const SCREEN_LOOK: [number, number, number] = [CINEMA_SCREEN.x, CINEMA_SCREEN.y - 0.3, CINEMA_SCREEN.z];

function sofa(id: string, x: number, z: number): Furniture {
  const yaw = Math.PI; // facing north, towards the screen
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const seats = [-0.42, 0.42].map((sx, i) => ({ id: `${id}:${i}`, x: x + sx * c - 0.1 * s, z: z - sx * s - 0.1 * c, yaw, room: 'cinema' as RoomId, look: SCREEN_LOOK }));
  return { id, kind: 'cinema-sofa', x, z, yaw, room: 'cinema', seats, color: '#8c1d33' };
}

export const FURNITURE: Furniture[] = [-11, -7.4, -3.8].flatMap((z, row) => [sofa(`cine-${row}a`, CIN_CX - 2.3, z), sofa(`cine-${row}b`, CIN_CX + 2.3, z)]);
export const SEATS: Seat[] = FURNITURE.flatMap((f) => f.seats);

const furnitureBox = (f: Furniture): Box => ({ minX: f.x - 1.0, maxX: f.x + 1.0, minZ: f.z - 0.45, maxZ: f.z + 0.45, low: true });

// ---------------------------------------------------------------------------
// Memory gallery photo slots (20)
// ---------------------------------------------------------------------------
export interface PhotoSlot {
  slot: number;
  x: number;
  y: number;
  z: number;
  rotY: number;
  size: number;
}

const G = ROOM_BY_ID.gallery;
/** centres of the panel bays on a wall run [a,b] — same maths as the boiserie renderer */
function bayCentres(a: number, b: number, target = 3.3) {
  const n = Math.max(1, Math.round((b - a) / target));
  const bay = (b - a) / n;
  return Array.from({ length: n }, (_, i) => a + bay * (i + 0.5));
}
const northX = bayCentres(G.x0, G.x1); // 10 bays
const southX = [...bayCentres(G.x0, -1.8), ...bayCentres(1.8, G.x1)]; // 5 + 5 bays
const PHOTO_Y = 3.0;
const rawSlots = [
  ...southX.slice(0, 5).reverse().map((x, i) => ({ x, z: G.z1 - 0.22, rotY: Math.PI, size: i % 2 ? 1.75 : 2.05 })),
  ...northX.map((x, i) => ({ x, z: G.z0 + 0.22, rotY: 0, size: i % 2 ? 2.0 : 2.45 })),
  ...southX.slice(5).reverse().map((x, i) => ({ x, z: G.z1 - 0.22, rotY: Math.PI, size: i % 2 ? 1.75 : 2.05 })),
];
export const PHOTO_SLOTS: PhotoSlot[] = rawSlots.map((p, i) => ({ slot: i, x: p.x, y: PHOTO_Y, z: p.z, rotY: p.rotY, size: p.size }));

// ---------------------------------------------------------------------------
// Room features (world coordinates)
// ---------------------------------------------------------------------------
const CEL = ROOM_BY_ID.celebration;
const CEL_CX = (CEL.x0 + CEL.x1) / 2;
export const DANCE_FLOOR = { x: CEL_CX, z: -9, size: 8 };
export const MUSIC_CONSOLE = { x: CEL_CX, z: CEL.z0 + 0.8 };
export const PARTY_POPPER = { x: CEL.x0 + 1.3, z: CEL.z0 + 1.4 };

const FIN = ROOM_BY_ID.final;
export const EXIT_DOOR = { x: FIN.x1, z: 9 };
export const FINAL_WALL = { x: (FIN.x0 + FIN.x1) / 2, z: FIN.z1 };

const ROT = ROOM_BY_ID.welcome;
export const ROTUNDA = { x: 0, z: (ROT.z0 + ROT.z1) / 2, columnRadius: 7.2, domeRadius: 8.6, columnHeight: 6.4 };
export const ROTUNDA_COLUMNS: [number, number][] = Array.from({ length: 16 }, (_, i) => {
  const a = ((i + 0.5) / 16) * Math.PI * 2;
  return [ROTUNDA.x + Math.cos(a) * ROTUNDA.columnRadius, ROTUNDA.z + Math.sin(a) * ROTUNDA.columnRadius];
});

const POR = ROOM_BY_ID.portico;
export const PORTICO_COLUMNS: number[] = Array.from({ length: 16 }, (_, i) => POR.x0 + 2 + (i * (POR.x1 - POR.x0 - 4)) / 15);

// ---------------------------------------------------------------------------
// Interactables
// ---------------------------------------------------------------------------
export type Interactable =
  | { kind: 'photo'; id: string; x: number; z: number; r: number; slot: number }
  | { kind: 'seat'; id: string; x: number; z: number; r: number; seat: Seat }
  | { kind: 'cinema'; id: string; x: number; z: number; r: number }
  | { kind: 'music'; id: string; x: number; z: number; r: number }
  | { kind: 'party'; id: string; x: number; z: number; r: number }
  | { kind: 'exit'; id: string; x: number; z: number; r: number };

export const PARTY_WORLD = { x: PARTY_POPPER.x + 1.4, z: PARTY_POPPER.z + 1.4 };

export const INTERACTABLES: Interactable[] = [
  ...PHOTO_SLOTS.map((p) => ({ kind: 'photo' as const, id: `photo:${p.slot}`, x: p.x + Math.sin(p.rotY) * 1.7, z: p.z + Math.cos(p.rotY) * 1.7, r: 1.7, slot: p.slot })),
  ...SEATS.map((s) => ({ kind: 'seat' as const, id: `seat:${s.id}`, x: s.x + Math.sin(s.yaw) * 0.6, z: s.z + Math.cos(s.yaw) * 0.6, r: 0.85, seat: s })),
  { kind: 'cinema', id: 'cinema', x: CINEMA_SCREEN.x, z: CINEMA_SCREEN.z + 4.5, r: 3.4 },
  { kind: 'music', id: 'music', x: MUSIC_CONSOLE.x, z: MUSIC_CONSOLE.z + 1.4, r: 1.8 },
  { kind: 'party', id: 'party', x: PARTY_WORLD.x, z: PARTY_WORLD.z, r: 1.6 },
  { kind: 'exit', id: 'exit', x: EXIT_DOOR.x - 1.2, z: EXIT_DOOR.z, r: 1.8 },
];

// ---------------------------------------------------------------------------
// Colliders
// ---------------------------------------------------------------------------
const box = (x: number, z: number, hx: number, hz: number, low = true): Box => ({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz, low });

const propBoxes: Box[] = [
  ...ROTUNDA_COLUMNS.map(([x, z]) => box(x, z, 0.42, 0.42, false)),
  box(ROTUNDA.x, ROTUNDA.z, 1.7, 1.7), // heart fountain
  ...PORTICO_COLUMNS.map((x) => box(x, POR.z1 - 0.7, 0.5, 0.5, false)),
  box(-5.5, 19.8, 0.45, 0.45), // entrance urns
  box(5.5, 19.8, 0.45, 0.45),
  box(CINEMA_SCREEN.x, CIN.z0 + 0.8, 5.4, 0.6), // stage
  box(MUSIC_CONSOLE.x, MUSIC_CONSOLE.z, 1.3, 0.5),
  box(PARTY_POPPER.x, PARTY_POPPER.z, 0.4, 0.4),
  box(ROOM_BY_ID.forever.x0 + 0.7, 12, 0.7, 2.4), // heart arch
  box(FIN.x0 + 1.5, FIN.z1 - 0.8, 0.4, 0.4), // heart pedestals
  box(FIN.x1 - 1.5, FIN.z1 - 0.8, 0.4, 0.4),
];

export const COLLIDERS: Box[] = [...wallBoxes, ...FURNITURE.map(furnitureBox), ...propBoxes];
