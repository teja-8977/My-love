import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ROOMS, WALLS, WALL_T, roomAt, ROOM_BY_ID, type RoomDef, type WallSeg } from '../layout';
import { carpetTexture, checkerTexture, cofferTexture, glowTexture, marbleTexture, parquetTexture, stoneTexture } from './textures';
import { CanvasText } from './CanvasText';

const matCache = new Map<string, THREE.Material>();
function std(color: string, rough = 0.8, metal = 0) {
  const key = `${color}|${rough}|${metal}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
    matCache.set(key, m);
  }
  return m as THREE.MeshStandardMaterial;
}
export const hdr = (c: string, k: number) => new THREE.Color(c).multiplyScalar(k);
export const GOLD = () => std('#d4ad62', 0.28, 0.95);
export const BRASS = () => std('#b8904a', 0.35, 0.9);

// ---------------------------------------------------------------------------
// Floors & ceilings
// ---------------------------------------------------------------------------
function floorMaterial(room: RoomDef) {
  const w = room.x1 - room.x0;
  const d = room.z1 - room.z0;
  let tex: THREE.Texture;
  let rough = 0.35;
  let metal = 0.02;
  let color = '#ffffff';
  switch (room.floor) {
    case 'carpet':
      tex = carpetTexture().clone();
      tex.repeat.set(w / 3, d / 3);
      rough = 0.95;
      metal = 0;
      break;
    case 'marble-dark':
      tex = marbleTexture('#211722', 'rgba(217,178,111,', 2, true).clone();
      tex.repeat.set(w / 4, d / 4);
      rough = 0.18;
      metal = 0.2;
      color = '#cfc0d8';
      break;
    case 'checker':
      tex = checkerTexture().clone();
      tex.repeat.set(w / 4, d / 4);
      rough = 0.16;
      metal = 0.05;
      break;
    case 'stone':
      tex = stoneTexture().clone();
      tex.repeat.set(w / 2.4, d / 2.4);
      rough = 0.7;
      metal = 0;
      break;
    default:
      tex = parquetTexture().clone();
      tex.repeat.set(w / 1.4, d / 1.4);
      rough = 0.4;
  }
  tex.needsUpdate = true;
  return new THREE.MeshStandardMaterial({ map: tex, roughness: rough, metalness: metal, color });
}

function Floor({ room }: { room: RoomDef }) {
  const mat = useMemo(() => floorMaterial(room), [room]);
  return (
    <mesh material={mat} rotation={[-Math.PI / 2, 0, 0]} position={[(room.x0 + room.x1) / 2, 0, (room.z0 + room.z1) / 2]}>
      <planeGeometry args={[room.x1 - room.x0 + WALL_T, room.z1 - room.z0 + WALL_T]} />
    </mesh>
  );
}

function Ceiling({ room }: { room: RoomDef }) {
  const w = room.x1 - room.x0;
  const d = room.z1 - room.z0;
  const cx = (room.x0 + room.x1) / 2;
  const cz = (room.z0 + room.z1) / 2;
  const mat = useMemo(() => {
    const t = cofferTexture(room.palette.ceiling).clone();
    t.repeat.set(w / 3, d / 3);
    t.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
  }, [room, w, d]);
  if (room.customCeiling) return null;
  return (
    <group>
      <mesh material={mat} rotation={[Math.PI / 2, 0, 0]} position={[cx, room.height, cz]}>
        <planeGeometry args={[w + WALL_T, d + WALL_T]} />
      </mesh>
      {/* ceiling rose medallion */}
      {!room.corridor && !room.dark && (
        <group position={[cx, room.height - 0.02, cz]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh material={std(room.palette.moulding, 0.6)}>
            <ringGeometry args={[0.9, 1.25, 48]} />
          </mesh>
          <mesh material={std(room.palette.gold, 0.35, 0.85)} position={[0, 0, -0.005]}>
            <ringGeometry args={[1.25, 1.3, 48]} />
          </mesh>
        </group>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Boiserie (panelled walls) — everything instanced
// ---------------------------------------------------------------------------
interface Piece {
  pos: THREE.Vector3;
  scale: THREE.Vector3;
  color: THREE.Color;
}

function wallFrame(w: WallSeg) {
  const horizontal = w.side === 'n' || w.side === 's';
  const fixed = horizontal ? w.z0 : w.x0;
  const a = horizontal ? Math.min(w.x0, w.x1) : Math.min(w.z0, w.z1);
  const b = horizontal ? Math.max(w.x0, w.x1) : Math.max(w.z0, w.z1);
  /** wall-local (u along wall, y, depth from the interior face, size) → world piece */
  const put = (out: Piece[], u: number, y: number, depth: number, su: number, sy: number, sd: number, color: THREE.Color) => {
    const d = WALL_T / 2 + depth + sd / 2;
    out.push(
      horizontal
        ? { pos: new THREE.Vector3(u, y, fixed + w.nz * d), scale: new THREE.Vector3(su, sy, sd), color }
        : { pos: new THREE.Vector3(fixed + w.nx * d, y, u), scale: new THREE.Vector3(sd, sy, su), color },
    );
  };
  return { a, b, put, horizontal };
}

/** rectangle outline of 4 thin boxes */
function outline(put: ReturnType<typeof wallFrame>['put'], out: Piece[], cu: number, cy: number, wu: number, hy: number, t: number, depth: number, sd: number, color: THREE.Color) {
  put(out, cu, cy + hy / 2 - t / 2, depth, wu, t, sd, color);
  put(out, cu, cy - hy / 2 + t / 2, depth, wu, t, sd, color);
  put(out, cu - wu / 2 + t / 2, cy, depth, t, hy - 2 * t, sd, color);
  put(out, cu + wu / 2 - t / 2, cy, depth, t, hy - 2 * t, sd, color);
}

export interface Sconce {
  pos: THREE.Vector3;
  nx: number;
  nz: number;
}

function buildBoiserie() {
  const matte: Piece[] = [];
  const gold: Piece[] = [];
  const sconces: Sconce[] = [];
  for (const w of WALLS) {
    if (w.lintel || w.rail || w.room.exterior) continue;
    const r = w.room;
    const H = r.height;
    const pal = r.palette;
    const cWall = new THREE.Color(pal.wall);
    const cPanel = new THREE.Color(pal.panel);
    const cMould = new THREE.Color(pal.moulding);
    const cGold = new THREE.Color(pal.gold);
    const { a, b, put } = wallFrame(w);
    const L = b - a;
    if (L < 0.05) continue;
    void cWall;
    // full-length elements
    put(matte, (a + b) / 2, 0.12, 0, L, 0.24, 0.06, cMould); // skirting
    put(matte, (a + b) / 2, 1.12, 0, L, 0.09, 0.07, cMould); // chair rail
    put(gold, (a + b) / 2, 1.06, 0.03, L, 0.025, 0.05, cGold); // gilt band under the rail
    const friezeY = H - 0.62;
    put(matte, (a + b) / 2, H - 0.14, 0, L, 0.28, 0.2, cMould); // cornice
    put(matte, (a + b) / 2, H - 0.34, 0, L, 0.12, 0.12, cMould);
    put(gold, (a + b) / 2, friezeY + 0.08, 0.02, L, 0.03, 0.05, cGold);
    put(matte, (a + b) / 2, friezeY, 0, L, 0.1, 0.06, cMould);

    // bays
    const bayTarget = r.corridor ? 2.6 : 3.3;
    const n = Math.max(1, Math.round(L / bayTarget));
    const bay = L / n;
    if (bay < 1.1) continue;
    const pil = 0.34; // pilaster width
    const upperTop = Math.min(friezeY - 0.35, r.corridor ? 3.6 : H - 1.2);
    const upperBot = 1.42;
    for (let i = 0; i <= n; i++) {
      const u = a + i * bay;
      // pilasters at bay boundaries (inset at the ends)
      const pu = i === 0 ? u + pil / 2 : i === n ? u - pil / 2 : u;
      put(matte, pu, (0.24 + friezeY) / 2, 0, pil, friezeY - 0.3, 0.06, cMould);
      put(gold, pu, (upperBot + upperTop) / 2, 0.06, 0.03, upperTop - upperBot - 0.4, 0.015, cGold);
      put(gold, pu, upperTop - 0.05, 0.06, 0.16, 0.16, 0.02, cGold); // rosette
      put(gold, pu, upperBot + 0.05, 0.06, 0.12, 0.12, 0.02, cGold);
      if (r.sconces && i > 0 && i < n && i % 2 === 1) {
        const d = WALL_T / 2 + 0.06;
        const y = 2.45;
        sconces.push({
          pos: w.side === 'n' || w.side === 's' ? new THREE.Vector3(pu, y, w.z0 + w.nz * d) : new THREE.Vector3(w.x0 + w.nx * d, y, pu),
          nx: w.nx,
          nz: w.nz,
        });
      }
    }
    for (let i = 0; i < n; i++) {
      const u0 = a + i * bay + (i === 0 ? pil : pil / 2);
      const u1 = a + (i + 1) * bay - (i === n - 1 ? pil : pil / 2);
      const cu = (u0 + u1) / 2;
      const wu = u1 - u0 - 0.36;
      if (wu < 0.5) continue;
      // upper inset panel: coloured fill + white moulding + inner gilt line
      const ph = upperTop - upperBot;
      const cy = (upperTop + upperBot) / 2;
      put(matte, cu, cy, 0, wu, ph, 0.015, cPanel);
      outline(put, matte, cu, cy, wu + 0.12, ph + 0.12, 0.07, 0.0, 0.05, cMould);
      outline(put, gold, cu, cy, wu - 0.12, ph - 0.12, 0.018, 0.015, 0.015, cGold);
      // dado panel below the rail
      outline(put, matte, cu, 0.66, wu, 0.62, 0.05, 0.0, 0.035, cMould);
    }
  }
  return { matte, gold, sconces };
}

function Instanced({ pieces, material }: { pieces: Piece[]; material: THREE.Material }) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    pieces.forEach((p, i) => {
      m.compose(p.pos, q, p.scale);
      ref.current.setMatrixAt(i, m);
      ref.current.setColorAt(i, p.color);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [pieces]);
  return (
    <instancedMesh ref={ref} args={[undefined, material, pieces.length]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
    </instancedMesh>
  );
}

function Sconces({ list }: { list: Sconce[] }) {
  const brass = useRef<THREE.InstancedMesh>(null!);
  const wax = useRef<THREE.InstancedMesh>(null!);
  const flames = useRef<THREE.InstancedMesh>(null!);
  const glows = useRef<THREE.InstancedMesh>(null!);
  const candleOffsets = [-0.16, 0, 0.16];
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    let bi = 0;
    let ci = 0;
    list.forEach((s) => {
      const yaw = Math.atan2(s.nx, s.nz);
      const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      const out = new THREE.Vector3(s.nx, 0, s.nz);
      const add = (mesh: THREE.InstancedMesh, idx: number, p: THREE.Vector3, sc: [number, number, number]) => {
        o.position.copy(p);
        o.rotation.set(0, yaw, 0);
        o.scale.set(...sc);
        o.updateMatrix();
        mesh.setMatrixAt(idx, o.matrix);
      };
      // backplate, stem, arm bar, 3 cups
      add(brass.current, bi++, s.pos.clone().add(new THREE.Vector3(0, -0.05, 0)), [0.12, 0.42, 0.03]);
      add(brass.current, bi++, s.pos.clone().add(out.clone().multiplyScalar(0.12)).add(new THREE.Vector3(0, -0.1, 0)), [0.04, 0.04, 0.24]);
      add(brass.current, bi++, s.pos.clone().add(out.clone().multiplyScalar(0.22)).add(new THREE.Vector3(0, -0.08, 0)), [0.38, 0.03, 0.03]);
      candleOffsets.forEach((k, j) => {
        const base = s.pos.clone().add(out.clone().multiplyScalar(0.22)).add(right.clone().multiplyScalar(k)).add(new THREE.Vector3(0, j === 1 ? 0.04 : 0, 0));
        add(brass.current, bi++, base.clone().add(new THREE.Vector3(0, -0.04, 0)), [0.07, 0.03, 0.07]);
        add(wax.current, ci, base.clone().add(new THREE.Vector3(0, 0.08, 0)), [0.035, 0.18, 0.035]);
        add(flames.current, ci, base.clone().add(new THREE.Vector3(0, 0.205, 0)), [0.018, 0.04, 0.018]);
        add(glows.current, ci, base.clone().add(new THREE.Vector3(0, 0.21, 0)).add(out.clone().multiplyScalar(0.02)), [0.5, 0.5, 1]);
        ci++;
      });
    });
    [brass, wax, flames, glows].forEach((r) => (r.current.instanceMatrix.needsUpdate = true));
  }, [list]);
  useFrame(({ clock }) => {
    const m = glows.current.material as THREE.MeshBasicMaterial;
    m.opacity = 0.42 + Math.sin(clock.elapsedTime * 7) * 0.04;
  });
  const n = list.length;
  return (
    <group>
      <instancedMesh ref={brass} args={[undefined, undefined, n * 6]} frustumCulled={false}>
        <boxGeometry />
        <meshStandardMaterial color="#c9a14f" roughness={0.3} metalness={0.95} />
      </instancedMesh>
      <instancedMesh ref={wax} args={[undefined, undefined, n * 3]} frustumCulled={false}>
        <cylinderGeometry args={[1, 1, 1, 10]} />
        <meshStandardMaterial color="#fff6e6" roughness={0.6} emissive="#ffcf9a" emissiveIntensity={0.25} />
      </instancedMesh>
      <instancedMesh ref={flames} args={[undefined, undefined, n * 3]} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color={hdr('#ffd27a', 4)} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={glows} args={[undefined, undefined, n * 3]} frustumCulled={false}>
        <planeGeometry />
        <meshBasicMaterial map={glowTexture()} color="#ffb766" transparent opacity={0.42} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Plain wall boxes, lintels and doorways
// ---------------------------------------------------------------------------
function segGeom(w: WallSeg) {
  const len = Math.hypot(w.x1 - w.x0, w.z1 - w.z0);
  return { len, cx: (w.x0 + w.x1) / 2, cz: (w.z0 + w.z1) / 2, rotY: w.side === 'e' || w.side === 'w' ? Math.PI / 2 : 0 };
}

function Wall({ w }: { w: WallSeg }) {
  const { len, cx, cz, rotY } = segGeom(w);
  if (len < 0.01 || w.rail) return null;
  const from = w.lintel?.from ?? 0;
  const segH = w.room.height - from;
  return (
    <mesh material={std(w.room.palette.wall, 0.92)} position={[cx, from + segH / 2, cz]} rotation={[0, rotY, 0]}>
      <boxGeometry args={[len + (w.lintel ? 0 : WALL_T), segH, WALL_T]} />
    </mesh>
  );
}

function otherSideRoom(w: WallSeg) {
  const cx = (w.x0 + w.x1) / 2;
  const cz = (w.z0 + w.z1) / 2;
  for (const dist of [1, 3, 6, 11]) {
    const r = roomAt(cx - w.nx * dist, cz - w.nz * dist);
    if (r && !r.corridor && r.id !== w.room.id) return r;
  }
  return null;
}

function Doorway({ w }: { w: WallSeg }) {
  const { len, cx, cz, rotY } = segGeom(w);
  const doorH = w.lintel!.from;
  const pal = w.room.palette;
  const casing = std(pal.moulding, 0.5);
  const gilt = std(pal.gold, 0.3, 0.9);
  const along: [number, number] = w.side === 'n' || w.side === 's' ? [1, 0] : [0, 1];
  const next = otherSideRoom(w);
  const showSign = next && !w.room.corridor && !w.room.exterior && (next.subtitle.startsWith('Room') || next.id === 'entrance');
  const face = WALL_T / 2 + 0.04;
  return (
    <group>
      {/* casing posts + entablature (wraps both faces) */}
      {[-1, 1].map((s) => (
        <mesh key={s} material={casing} position={[cx + along[0] * s * (len / 2 + 0.12), doorH / 2, cz + along[1] * s * (len / 2 + 0.12)]} rotation={[0, rotY, 0]}>
          <boxGeometry args={[0.28, doorH, WALL_T + 0.16]} />
        </mesh>
      ))}
      <mesh material={casing} position={[cx, doorH + 0.16, cz]} rotation={[0, rotY, 0]}>
        <boxGeometry args={[len + 0.8, 0.32, WALL_T + 0.2]} />
      </mesh>
      <mesh material={casing} position={[cx, doorH + 0.4, cz]} rotation={[0, rotY, 0]}>
        <boxGeometry args={[len + 1.0, 0.14, WALL_T + 0.3]} />
      </mesh>
      <mesh material={gilt} position={[cx, doorH + 0.08, cz]} rotation={[0, rotY, 0]}>
        <boxGeometry args={[len + 0.5, 0.03, WALL_T + 0.22]} />
      </mesh>
      {showSign && next && (
        <group position={[cx + w.nx * (face + 0.12), doorH + 0.95, cz + w.nz * (face + 0.12)]} rotation={[0, Math.atan2(w.nx, w.nz), 0]}>
          <mesh material={gilt} position={[0, 0, -0.01]}>
            <boxGeometry args={[3.1, 0.66, 0.03]} />
          </mesh>
          <mesh material={std('#2b2420', 0.5, 0.1)}>
            <boxGeometry args={[3.0, 0.58, 0.04]} />
          </mesh>
          <CanvasText
            position={[0, 0, 0.025]}
            width={2.85}
            px={900}
            padding={8}
            emissive={1.2}
            lines={[
              { text: next.subtitle.toUpperCase(), font: '500 34px "Inter"', color: '#d9b26f', gap: 2 },
              { text: next.name, font: '600 70px "Cormorant Garamond"', color: '#f8efe4' },
            ]}
          />
        </group>
      )}
    </group>
  );
}

export function Architecture() {
  const boiserie = useMemo(buildBoiserie, []);
  const matte = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0 }), []);
  const gold = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.9 }), []);
  return (
    <group>
      {ROOMS.map((r) => (
        <group key={r.id}>
          <Floor room={r} />
          <Ceiling room={r} />
        </group>
      ))}
      {WALLS.map((w, i) => (
        <group key={i}>
          <Wall w={w} />
          {w.lintel && !w.room.exterior && <Doorway w={w} />}
        </group>
      ))}
      <Instanced pieces={boiserie.matte} material={matte} />
      <Instanced pieces={boiserie.gold} material={gold} />
      <Sconces list={boiserie.sconces} />
    </group>
  );
}

/** Crystal chandelier with emissive bulbs (bloom makes them glow). */
export function Chandelier({ position, scale = 1, color = '#ffe2b0', drop = 1.8 }: { position: [number, number, number]; scale?: number; color?: string; drop?: number }) {
  const arms = 8;
  const gold = GOLD();
  return (
    <group position={position} scale={scale}>
      <mesh material={gold} position={[0, drop / 2, 0]}>
        <cylinderGeometry args={[0.015, 0.015, drop, 6]} />
      </mesh>
      <mesh material={gold}>
        <torusGeometry args={[0.65, 0.03, 8, 40]} />
      </mesh>
      <mesh material={gold} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.25, 0]}>
        <torusGeometry args={[0.38, 0.025, 8, 32]} />
      </mesh>
      <mesh material={gold} position={[0, -0.15, 0]}>
        <sphereGeometry args={[0.12, 16, 12]} />
      </mesh>
      {Array.from({ length: arms }, (_, i) => {
        const a = (i / arms) * Math.PI * 2;
        const x = Math.cos(a) * 0.65;
        const z = Math.sin(a) * 0.65;
        return (
          <group key={i}>
            <mesh position={[x, 0.12, z]}>
              <sphereGeometry args={[0.06, 12, 10]} />
              <meshBasicMaterial color={hdr(color, 3)} toneMapped={false} />
            </mesh>
            <mesh position={[x * 0.85, -0.35, z * 0.85]}>
              <octahedronGeometry args={[0.05, 0]} />
              <meshStandardMaterial color="#ffffff" roughness={0.05} metalness={0.1} transparent opacity={0.75} emissive="#ffe7cf" emissiveIntensity={0.4} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

export { ROOM_BY_ID };
