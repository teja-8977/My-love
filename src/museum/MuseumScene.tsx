import { Suspense, useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Lightformer, AdaptiveDpr } from '@react-three/drei';
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
import { LocalPlayer } from './player/LocalPlayer';
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

export function MuseumScene({ session, avatar, name, occupiedRef }: { session: TourSession; avatar: AvatarConfig; name: string; occupiedRef: React.MutableRefObject<Set<string>> }) {
  return (
    <Canvas
      dpr={[1, 1.6]}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
      camera={{ fov: 55, near: 0.1, far: 400, position: [0, 2, 9] }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NoToneMapping;
      }}
    >
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
          <PorticoAndEntrance />
          <WelcomeRoom />
          <GalleryRoom />
          <CinemaRoom />
          <ForeverRoom />
          <CelebrationRoom />
          <FinalRoom />
          {FURNITURE.map((f) => (
            <FurniturePiece key={f.id} f={f} />
          ))}
          <LocalPlayer avatar={avatar} name={name} occupiedRef={occupiedRef} />
          <RemotePlayers />
          <Confetti />
        </Suspense>

        <EffectComposer multisampling={4}>
          <Bloom mipmapBlur intensity={0.7} luminanceThreshold={1.0} luminanceSmoothing={0.2} radius={0.7} />
          <Vignette eskil={false} offset={0.25} darkness={0.55} />
          <ToneMapping mode={ToneMappingMode.NEUTRAL} />
        </EffectComposer>
        <AdaptiveDpr pixelated={false} />
      </TourContext.Provider>
    </Canvas>
  );
}
