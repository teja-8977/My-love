import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Avatar, type AnimState } from '../../avatar/Avatar';
import type { AvatarConfig } from '../../avatar/config';
import { COLLIDERS, INTERACTABLES, SEATS, SPAWN, roomAt, type Interactable, type Seat } from '../layout';
import { raycastBoxes, resolveCircle } from '../collision';
import { input, moveAxes } from './input';
import { inputBlocked, useGame } from '../store';
import { useTour } from '../context';
import { PlayerLabel } from './PlayerLabel';

const WALK = 2.7;
const RUN = 5.6;
const RADIUS = 0.33;
const GRAVITY = -14;
const JUMP_V = 5.2;
const CAM_MIN = 1.6;
const CAM_MAX = 9;
const SEND_HZ = 12;

/** Shared, mutable local-player state (read by the HUD / interaction system). */
export const localPlayer = {
  pos: new THREE.Vector3(SPAWN.x, 0, SPAWN.z),
  yaw: SPAWN.yaw,
  camYaw: 0,
  camPitch: 0.32,
  camDist: 4.6,
  vy: 0,
  grounded: true,
  seat: null as Seat | null,
  nearest: null as Interactable | null,
  /** last time the player turned the camera manually (ms) */
  lastLook: 0,
};

/** Called by the key handler on E. Returns true if something happened. */
export function interact(occupied: Set<string>, onInteract: (i: Interactable) => void) {
  const g = useGame.getState();
  if (localPlayer.seat) {
    standUp();
    return true;
  }
  const n = localPlayer.nearest;
  if (!n) return false;
  if (n.kind === 'seat') {
    if (occupied.has(n.seat.id)) {
      g.notify('Someone is already sitting there ❤️');
      return true;
    }
    sitDown(n.seat);
    return true;
  }
  onInteract(n);
  return true;
}

export function sitDown(seat: Seat) {
  localPlayer.seat = seat;
  localPlayer.pos.set(seat.x, 0, seat.z);
  localPlayer.yaw = seat.yaw;
  localPlayer.vy = 0;
  // camera behind the seat, looking at what the seat faces — unless a wall is right behind it,
  // then frame the sitter from the front-side instead
  const behind = seat.yaw + Math.PI;
  const room = raycastBoxes(seat.x, seat.z, Math.sin(behind), Math.cos(behind), 3, COLLIDERS, 0.25);
  localPlayer.camYaw = room < 2.5 ? seat.yaw + 0.55 : behind;
  localPlayer.camPitch = 0.2;
  useGame.getState().set({ seated: seat.id, dancing: false });
}

export function standUp() {
  const s = localPlayer.seat;
  if (!s) return;
  localPlayer.seat = null;
  const d = (s.approach ?? 1) * 0.8; // chairs at a table: step back from it
  localPlayer.pos.x = s.x + Math.sin(s.yaw) * d;
  localPlayer.pos.z = s.z + Math.cos(s.yaw) * d;
  resolveCircle(localPlayer.pos, RADIUS, COLLIDERS);
  useGame.getState().set({ seated: null });
}

export function respawn() {
  localPlayer.seat = null;
  localPlayer.pos.set(SPAWN.x, 0, SPAWN.z);
  localPlayer.yaw = SPAWN.yaw;
  localPlayer.camYaw = 0;
  useGame.getState().set({ seated: null, dancing: false });
}

function promptFor(i: Interactable): { text: string; key: string } {
  switch (i.kind) {
    case 'photo':
      return { key: 'E', text: 'View photograph' };
    case 'seat':
      return { key: 'E', text: 'Sit down' };
    case 'cinema':
      return { key: 'E', text: 'Open cinema' };
    case 'music':
      return { key: 'E', text: 'Choose music' };
    case 'party':
      return { key: 'E', text: 'Celebrate! 🎉' };
    case 'exit':
      return { key: 'E', text: 'Exit the museum' };
  }
}

export function LocalPlayer({ avatar, name, occupiedRef }: { avatar: AvatarConfig; name: string; occupiedRef: React.MutableRefObject<Set<string>> }) {
  const { net, cinema, music, meId } = useTour();
  const group = useRef<THREE.Group>(null!);
  const anim = useRef<AnimState>({ anim: 'idle', dance: 0, speed: 1 });
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const lastSend = useRef(0);
  const lastSig = useRef('');
  const promptTick = useRef(0);
  const camPos = useRef(new THREE.Vector3());
  const camTarget = useRef(new THREE.Vector3());
  const initialised = useRef(false);

  // restore position after a refresh
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(`lm-pos:${net.museumId}`);
      if (saved) {
        const p = JSON.parse(saved) as { x: number; z: number; yaw: number };
        if (roomAt(p.x, p.z)) {
          localPlayer.pos.set(p.x, 0, p.z);
          localPlayer.yaw = p.yaw;
          localPlayer.camYaw = p.yaw + Math.PI;
        }
      } else respawn();
    } catch {
      respawn();
    }
    const save = () => {
      try {
        sessionStorage.setItem(`lm-pos:${net.museumId}`, JSON.stringify({ x: localPlayer.pos.x, z: localPlayer.pos.z, yaw: localPlayer.yaw }));
      } catch {
        /* storage unavailable */
      }
    };
    const iv = setInterval(save, 2000);
    window.addEventListener('beforeunload', save);
    return () => {
      clearInterval(iv);
      window.removeEventListener('beforeunload', save);
      localPlayer.seat = null;
    };
  }, [net.museumId]);

  // camera look: pointer-lock mouse look (desktop), drag (mouse/touch), pinch + wheel zoom
  useEffect(() => {
    const el = gl.domElement;
    const pts = new Map<number, { x: number; y: number; sx: number; sy: number; type: string }>();
    let pinch = 0;
    const look = (dx: number, dy: number, k = 1) => {
      localPlayer.camYaw -= dx * 0.0045 * k;
      localPlayer.camPitch = THREE.MathUtils.clamp(localPlayer.camPitch + dy * 0.0035 * k, -0.2, 1.25);
      localPlayer.lastLook = performance.now();
    };
    const zoom = (factor: number) => {
      localPlayer.camDist = THREE.MathUtils.clamp(localPlayer.camDist * factor, CAM_MIN, CAM_MAX);
    };
    const locked = () => document.pointerLockElement === el;
    const down = (e: PointerEvent) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, type: e.pointerType });
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
    };
    const move = (e: PointerEvent) => {
      if (locked()) {
        look(e.movementX, e.movementY, 0.9);
        return;
      }
      const p = pts.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (pts.size >= 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch > 0 && d > 0) zoom(pinch / d);
        pinch = d;
        return;
      }
      look(dx, dy, p.type === 'touch' ? 1.6 : 1.3);
    };
    const up = (e: PointerEvent) => {
      const p = pts.get(e.pointerId);
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = 0;
      // a simple click (no drag) with a mouse enters game-style mouse look
      if (p && p.type === 'mouse' && !locked() && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < 4 && !inputBlocked()) {
        const req = el.requestPointerLock?.() as unknown as Promise<void> | undefined;
        req?.catch?.(() => {});
      }
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      zoom(1 + Math.sign(e.deltaY) * 0.1);
    };
    const lockChange = () => useGame.getState().set({ mouseLook: locked() });
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    document.addEventListener('pointerlockchange', lockChange);
    el.style.touchAction = 'none';
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
      document.removeEventListener('pointerlockchange', lockChange);
      if (locked()) document.exitPointerLock();
    };
  }, [gl]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const lp = localPlayer;
    const game = useGame.getState();
    const blocked = inputBlocked();

    // keyboard camera turn (Q / E-less) via arrow keys is handled as movement; orbit via mouse
    const axes = blocked ? { x: 0, y: 0, run: false } : moveAxes();
    let moving = false;
    let speed = 0;

    if (lp.seat) {
      lp.pos.set(lp.seat.x, 0, lp.seat.z);
      lp.yaw = lp.seat.yaw;
    } else {
      // move relative to camera
      const fx = -Math.sin(lp.camYaw);
      const fz = -Math.cos(lp.camYaw);
      const rx = Math.cos(lp.camYaw);
      const rz = -Math.sin(lp.camYaw);
      const dx = fx * axes.y + rx * axes.x;
      const dz = fz * axes.y + rz * axes.x;
      const mag = Math.min(1, Math.hypot(dx, dz));
      if (mag > 0.05) {
        moving = true;
        if (game.dancing) game.set({ dancing: false });
        speed = (axes.run ? RUN : WALK) * mag;
        const nx = dx / Math.hypot(dx, dz);
        const nz = dz / Math.hypot(dx, dz);
        lp.pos.x += nx * speed * dt;
        lp.pos.z += nz * speed * dt;
        const targetYaw = Math.atan2(nx, nz);
        let d = targetYaw - lp.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        lp.yaw += d * (1 - Math.exp(-dt * 12));
        // camera gently swings back behind the avatar while walking (unless the player is steering it)
        if (performance.now() - lp.lastLook > 1200 && axes.y >= 0) {
          let c = lp.yaw + Math.PI - lp.camYaw;
          c = Math.atan2(Math.sin(c), Math.cos(c));
          lp.camYaw += c * (1 - Math.exp(-dt * 1.6)) * mag;
        }
      }
      // jump + gravity
      if (input.jumpQueued && lp.grounded && !blocked) {
        lp.vy = JUMP_V;
        lp.grounded = false;
        if (game.dancing) game.set({ dancing: false });
      }
      input.jumpQueued = false;
      lp.vy += GRAVITY * dt;
      lp.pos.y += lp.vy * dt;
      if (lp.pos.y <= 0) {
        lp.pos.y = 0;
        lp.vy = 0;
        lp.grounded = true;
      }
      resolveCircle(lp.pos, RADIUS, COLLIDERS);
      // safety net: never leave the building
      if (!roomAt(lp.pos.x, lp.pos.z)) {
        const back = roomAt(lp.pos.x - 0.3, lp.pos.z) ?? roomAt(lp.pos.x + 0.3, lp.pos.z) ?? roomAt(lp.pos.x, lp.pos.z - 0.3) ?? roomAt(lp.pos.x, lp.pos.z + 0.3);
        if (!back) respawn();
      }
    }

    // animation state
    const a = anim.current;
    if (lp.seat) a.anim = 'sit';
    else if (!lp.grounded) a.anim = 'jump';
    else if (game.dancing && !moving) {
      a.anim = 'dance';
      a.dance = game.danceStyle;
    } else if (moving) {
      a.anim = speed > WALK + 0.2 ? 'run' : 'walk';
      a.speed = speed / WALK;
    } else a.anim = 'idle';

    group.current.position.copy(lp.pos);
    group.current.rotation.y = lp.yaw;

    // ------------------ camera ------------------
    const headY = lp.pos.y + (lp.seat ? 1.15 : 1.55);
    let yawC = lp.camYaw;
    let pitch = lp.camPitch;
    let dist = lp.camDist;
    let lookAt: THREE.Vector3;
    if (lp.seat?.look) {
      // cinematic seated framing (cinema / loveseat)
      dist = Math.max(2.2, Math.min(dist, 3.2));
      pitch = Math.min(pitch, 0.35);
      lookAt = new THREE.Vector3(...lp.seat.look);
      yawC = lp.camYaw;
    } else lookAt = new THREE.Vector3(lp.pos.x, headY, lp.pos.z);

    const ox = Math.sin(yawC) * Math.cos(pitch);
    const oz = Math.cos(yawC) * Math.cos(pitch);
    const hit = raycastBoxes(lp.pos.x, lp.pos.z, ox, oz, dist * Math.cos(pitch), COLLIDERS, 0.25);
    const effDist = Math.max(0.6, Math.min(dist, hit / Math.max(0.2, Math.cos(pitch))));
    const room = roomAt(lp.pos.x, lp.pos.z);
    const ceil = (room?.height ?? 6) - 0.3;
    const desired = new THREE.Vector3(lp.pos.x + ox * effDist, Math.min(ceil, headY + Math.sin(pitch) * effDist + 0.2), lp.pos.z + oz * effDist);
    const k = initialised.current ? 1 - Math.exp(-dt * 10) : 1;
    initialised.current = true;
    camPos.current.lerp(desired, k);
    const lookTarget = lp.seat?.look ? lookAt.clone().lerp(new THREE.Vector3(lp.pos.x, headY, lp.pos.z), 0.25) : lookAt;
    camTarget.current.lerp(lookTarget, k);
    camera.position.copy(camPos.current);
    camera.lookAt(camTarget.current);

    // ------------------ room + audio proximity ------------------
    if (room && room.id !== game.room && !room.corridor) game.set({ room: room.id });
    const rid = room?.id;
    cinema.setProximity(rid === 'cinema' ? 1 : rid === 'c3' || rid === 'c4' ? 0.25 : 0);
    music.setProximity(rid === 'celebration' ? 1 : rid === 'c6' || rid === 'c7' ? 0.35 : 0.06);

    // ------------------ interaction prompt (10 Hz) ------------------
    promptTick.current += dt;
    if (promptTick.current > 0.1) {
      promptTick.current = 0;
      let best: Interactable | null = null;
      let bestD = Infinity;
      if (!lp.seat) {
        for (const it of INTERACTABLES) {
          if (it.kind === 'seat' && occupiedRef.current.has(it.seat.id)) continue;
          const d = Math.hypot(it.x - lp.pos.x, it.z - lp.pos.z);
          if (d < it.r && d < bestD) {
            best = it;
            bestD = d;
          }
        }
      }
      lp.nearest = best;
      const p = lp.seat ? { key: 'E', text: 'Stand up' } : best ? promptFor(best) : null;
      const cur = game.prompt;
      if (p?.text !== cur?.text) game.set({ prompt: p });
    }

    // ------------------ network ------------------
    const now = performance.now();
    const sig = `${lp.pos.x.toFixed(2)},${lp.pos.y.toFixed(2)},${lp.pos.z.toFixed(2)},${lp.yaw.toFixed(2)},${a.anim},${a.dance},${lp.seat?.id}`;
    if (now - lastSend.current > 1000 / SEND_HZ && (sig !== lastSig.current || now - lastSend.current > 1000)) {
      lastSend.current = now;
      lastSig.current = sig;
      net.sendState({ x: lp.pos.x, y: lp.pos.y, z: lp.pos.z, r: lp.yaw, a: a.anim, d: a.dance, v: speed, s: lp.seat?.id ?? null });
    }
  });

  return (
    <group ref={group}>
      <Avatar config={avatar} state={anim} />
      <PlayerLabel userId={meId} name={name} self />
    </group>
  );
}

export { SEATS };

export const debugEnabled = () => {
  try {
    return new URLSearchParams(window.location.search).has('debug') || localStorage.getItem('lm-debug') === '1';
  } catch {
    return false;
  }
};

if (typeof window !== 'undefined' && debugEnabled()) {
  (window as unknown as { __lm: typeof localPlayer }).__lm = localPlayer;
}
