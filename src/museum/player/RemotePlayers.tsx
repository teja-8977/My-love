import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Avatar, type AnimState } from '../../avatar/Avatar';
import { useTour } from '../context';
import { useGame, type PlayerInfo } from '../store';
import { PlayerLabel } from './PlayerLabel';

const INTERP_DELAY = 140; // ms
const MAX_EXTRAP = 250; // ms

function RemoteAvatar({ info }: { info: PlayerInfo }) {
  const { net } = useTour();
  const group = useRef<THREE.Group>(null!);
  const fallbackAnim = useRef<AnimState>({ anim: 'idle', dance: 0, speed: 1 });
  const avatarKey = JSON.stringify(info.avatar);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const avatar = useMemo(() => info.avatar, [avatarKey]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const r = net.remotes.get(info.id);
    const g = group.current;
    if (!r || !r.target) {
      g.visible = false;
      return;
    }
    g.visible = true;
    const t = r.target;
    // Buffered interpolation: show other players ~140 ms in the past and blend between the two
    // network states around that moment. Updates arrive at ~12 Hz with jitter, so this gives
    // steady motion instead of move-stop-move. Short gaps are bridged by extrapolating.
    const buf = r.buf;
    const renderT = performance.now() - INTERP_DELAY;
    while (buf.length > 2 && buf[1].t <= renderT) buf.shift();
    let x = t.x;
    let y = t.y;
    let z = t.z;
    let yaw = t.r;
    if (buf.length >= 2 && buf[0].t <= renderT) {
      const p0 = buf[0];
      const p1 = buf[1];
      const span = Math.max(1, p1.t - p0.t);
      // past the newest sample: keep going in the same direction for a little while
      const u = Math.min((renderT - p0.t) / span, 1 + MAX_EXTRAP / span);
      x = p0.x + (p1.x - p0.x) * u;
      y = p0.y + (p1.y - p0.y) * Math.min(u, 1);
      z = p0.z + (p1.z - p0.z) * u;
      let dy = p1.r - p0.r;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      yaw = p0.r + dy * Math.min(u, 1);
    }
    const jump = Math.hypot(x - r.pos.x, z - r.pos.z) > 6;
    // a light final smoothing removes the tiny corrections when a late packet arrives
    const k = jump ? 1 : 1 - Math.exp(-dt * 25);
    r.pos.x += (x - r.pos.x) * k;
    r.pos.y += (y - r.pos.y) * k;
    r.pos.z += (z - r.pos.z) * k;
    let d = yaw - r.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    r.yaw += d * (jump ? 1 : 1 - Math.exp(-dt * 18));
    g.position.copy(r.pos);
    g.rotation.y = r.yaw;

    const a = fallbackAnim.current;
    // if the stream goes quiet, stop walking in place
    const stale = performance.now() - r.lastUpdate > 1500;
    a.anim = stale && (t.a === 'walk' || t.a === 'run') ? 'idle' : t.a;
    a.dance = t.d;
    a.speed = Math.max(0.6, t.v / 2.7);
  });

  return (
    <group ref={group} visible={false}>
      <Avatar config={avatar} state={fallbackAnim} />
      <PlayerLabel userId={info.id} name={info.name} host={info.role === 'host'} />
    </group>
  );
}

export function RemotePlayers() {
  const players = useGame((s) => s.players);
  const { meId } = useTour();
  return (
    <>
      {players
        .filter((p) => p.id !== meId)
        .map((p) => (
          <RemoteAvatar key={p.id} info={p} />
        ))}
    </>
  );
}
