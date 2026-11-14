import { Suspense, useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, PerformanceMonitor } from '@react-three/drei';
import { Bloom, EffectComposer, Vignette, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import { Architecture } from './world/Architecture';
import { FurniturePiece } from './world/Props';
import { FURNITURE } from './layout';
import { WelcomeRoom } from './world/rooms/Rotunda';
import { PorticoAndEntrance } from './world/rooms/Front';
import { GalleryRoom } from './world/rooms/Gallery';
import { CinemaRoom } from './world/rooms/Cinema';
import { ForeverRoom } from './world/rooms/Forever';
import { CelebrationRoom } from './world/rooms/Celebration';
import { FinalRoom } from './world/rooms/Final';
import { LocalPlayer, localPlayer, debugEnabled } from './player/LocalPlayer';
import { linkedTo, useQuality, visibleRooms } from './quality';
import type { RoomId } from './layout';
import { roomAt } from './layout';
import { RemotePlayers } from './player/RemotePlayers';
import { TourContext, type TourSession } from './context';
import { useGame } from './store';
import type { AvatarConfig } from '../avatar/config';

const CONFETTI_COLORS = ['#ff6b8f', '#f2d27a', '#ffffff', '#c9a7ff', '#7ee0c3'].map((c) => new THREE.Color(c));

function ConfettiBurst({ x, z }: { x: number; z: number }) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const count = 260;
  const parts = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        p: new THREE.Vector3(x + (Math.random() - 0.5) * 0.4, 1.6, z + (Math.random() - 0.5) * 0.4),
        v: new THREE.Vector3((Math.random() - 0.5) * 6, 5 + Math.random() * 6, (Math.random() - 0.5) * 6),
        r: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        w: (Math.random() - 0.5) * 12,
      })),
    [x, z],
  );
  const o = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    parts.forEach((_, i) => ref.current.setColorAt(i, CONFETTI_COLORS[i % CONFETTI_COLORS.length]));
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [parts]);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    parts.forEach((pt, i) => {
      if (pt.p.y > 0.02) {
        pt.v.y -= 6 * dt;
        pt.v.multiplyScalar(1 - 1.6 * dt);
        pt.p.addScaledVector(pt.v, dt);
        pt.r.x += pt.w * dt;
        pt.r.z += pt.w * 0.7 * dt;
      } else pt.p.y = 0.015;
      o.position.copy(pt.p);
      o.rotation.copy(pt.r);
      o.updateMatrix();
      ref.current.setMatrixAt(i, o.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <planeGeometry args={[0.06, 0.1]} />
      <meshStandardMaterial side={THREE.DoubleSide} roughness={0.5} emissive="#331122" />
    </instancedMesh>
  );
}

function Confetti() {
  const bursts = useGame((s) => s.confetti);
  return (
    <>
      {bursts.map((b) => (
        <ConfettiBurst key={b.id} x={b.x} z={b.z} />
      ))}
    </>
  );
}

const NO_CULL = debugEnabled() && new URLSearchParams(window.location.search).get('cull') === '0';

/** Renders its children only while the player can see one of the given rooms. */
function Zone({ rooms, children }: { rooms: RoomId[]; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null!);
  const last = useRef<string>('');
  const tick = useRef(0);
  useFrame(() => {
    const here = roomAt(localPlayer.pos.x, localPlayer.pos.z)?.id ?? 'none';
    // re-apply on room change, and every 0.5 s for content that finished loading later
    const now = performance.now();
    if (here === last.current && now - tick.current < 500) return;
    tick.current = now;
    last.current = here;
    const vis = visibleRooms(localPlayer.pos.x, localPlayer.pos.z);
    ref.current.visible = NO_CULL || rooms.some((r) => vis.has(r));
    // only the room you're standing in (or the rooms at both ends of your corridor) keeps its lights on;
    // rooms seen through a doorway are lit by the shared ambient light only
    const lit = NO_CULL || rooms.includes(here as RoomId) || (/^c\d$/.test(here) && rooms.some((r) => linkedTo(here as RoomId).includes(r)));
    ref.current.traverse((o) => {
      if ((o as THREE.Light).isLight) o.visible = lit;
    });
  });
  return <group ref={ref}>{children}</group>;
}

/** Debug-only stats for testing (draw calls, lights, fps). */
function PerfProbe() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const frames = useRef<number[]>([]);
  useFrame(() => {
    const now = performance.now();
    frames.current.push(now);
    while (frames.current.length && now - frames.current[0] > 2000) frames.current.shift();
    let lights = 0;
    const list: string[] = [];
    scene.traverseVisible((o) => {
      if ((o as THREE.PointLight).isPointLight || (o as THREE.SpotLight).isSpotLight) {
        lights++;
        const w = new THREE.Vector3();
        o.getWorldPosition(w);
        list.push(w.toArray().map((n) => Math.round(n)).join(','));
      }
    });
    (window as unknown as Record<string, unknown>).__lmPerf = {
      calls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      lights,
      list,
      fps: frames.current.length / 2,
      dpr: gl.getPixelRatio(),
      quality: useQuality.getState().quality,
    };
  });
  return null;
}

export function MuseumScene({ session, avatar, name, occupiedRef }: { session: TourSession; avatar: AvatarConfig; name: string; occupiedRef: React.MutableRefObject<Set<string>> }) {
  const quality = useQuality((s) => s.quality);
  const low = quality === 'low';
  const setQuality = useQuality((s) => s.set);
  return (
    <Canvas
      key={quality /* tone mapping / AA are fixed at creation */}
      dpr={low ? [0.8, 1.15] : [1, 1.6]}
      gl={{ antialias: low, powerPreference: 'high-performance', stencil: false }}
      camera={{ fov: 55, near: 0.1, far: 400, position: [0, 2, 9] }}
      onCreated={({ gl }) => {
        // high quality tone-maps in the post-processing pass; low quality does it directly (no extra passes)
        gl.toneMapping = low ? THREE.NeutralToneMapping : THREE.NoToneMapping;
      }}
    >
      <PerformanceMonitor flipflops={2} onDecline={() => useQuality.getState().auto && setQuality('low', true)} />
      {debugEnabled() && <PerfProbe />}
      <TourContext.Provider value={session}>
        <color attach="background" args={['#120a0d']} />
        <hemisphereLight args={['#fff1e0', '#3a2228', 0.6]} />
        <ambientLight intensity={0.22} color="#ffe6dc" />
        <Environment resolution={128} frames={1}>
          <Lightformer form="rect" intensity={2.2} color="#fff0dc" position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[10, 10, 1]} />
          <Lightformer form="rect" intensity={1.2} color="#ffd0dc" position={[-6, 2, 0]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} />
          <Lightformer form="rect" intensity={1.0} color="#ffe0b0" position={[6, 2, 0]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} />
        </Environment>

        <Suspense fallback={null}>
          <Architecture />
          <Zone rooms={['portico', 'entrance']}>
            <PorticoAndEntrance />
          </Zone>
          <Zone rooms={['welcome']}>
            <WelcomeRoom />
          </Zone>
          <Zone rooms={['gallery']}>
            <GalleryRoom />
          </Zone>
          <Zone rooms={['cinema']}>
            <CinemaRoom />
          </Zone>
          <Zone rooms={['forever']}>
            <ForeverRoom />
          </Zone>
          <Zone rooms={['celebration']}>
            <CelebrationRoom />
          </Zone>
          <Zone rooms={['final']}>
            <FinalRoom />
          </Zone>
          {FURNITURE.map((f) => (
            <FurniturePiece key={f.id} f={f} />
          ))}
          <LocalPlayer avatar={avatar} name={name} occupiedRef={occupiedRef} />
          <RemotePlayers />
          <Confetti />
        </Suspense>

        {!low && (
          <EffectComposer multisampling={4}>
            <Bloom mipmapBlur intensity={0.7} luminanceThreshold={1.0} luminanceSmoothing={0.2} radius={0.7} />
            <Vignette eskil={false} offset={0.25} darkness={0.55} />
            <ToneMapping mode={ToneMappingMode.NEUTRAL} />
          </EffectComposer>
        )}
      </TourContext.Provider>
    </Canvas>
  );
}
