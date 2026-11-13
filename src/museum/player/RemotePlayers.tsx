import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Avatar, type AnimState } from '../../avatar/Avatar';
import { useTour } from '../context';
import { useGame, type PlayerInfo } from '../store';
import { PlayerLabel } from './PlayerLabel';

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
    // smooth interpolation towards the latest network state
    const k = 1 - Math.exp(-dt * 12);
    const dist = Math.hypot(t.x - r.pos.x, t.z - r.pos.z);
    if (dist > 6) r.pos.set(t.x, t.y, t.z);
    else {
      r.pos.x += (t.x - r.pos.x) * k;
      r.pos.y += (t.y - r.pos.y) * k;
      r.pos.z += (t.z - r.pos.z) * k;
    }
    let d = t.r - r.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    r.yaw += d * k;
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
