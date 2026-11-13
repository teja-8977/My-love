import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { ROOM_BY_ID } from '../../layout';
import { CanvasText } from '../CanvasText';
import { Chandelier, GOLD } from '../Architecture';
import { Candle, GlowHeart, Petals, Plant, RoseVase } from '../Props';
import { heartPoints } from '../shapes';
import { nightSkyTexture } from '../textures';

const R = ROOM_BY_ID.forever;
const CX = (R.x0 + R.x1) / 2;
const ARCH_Z = 12;

/** Heart outline of fairy lights + roses, standing against the west wall. */
function HeartArch() {
  const bulbs = useRef<THREE.InstancedMesh>(null!);
  const roses = useRef<THREE.InstancedMesh>(null!);
  const pts = useMemo(() => heartPoints(64, 2.2), []);
  const rosePts = useMemo(() => heartPoints(110, 2.45), []);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    pts.forEach((p, i) => {
      o.position.set(0, p.y, p.x);
      o.updateMatrix();
      bulbs.current.setMatrixAt(i, o.matrix);
    });
    bulbs.current.instanceMatrix.needsUpdate = true;
    rosePts.forEach((p, i) => {
      const j = ((i * 7919) % 100) / 100;
      o.position.set(-0.05 + j * 0.1, p.y + (j - 0.5) * 0.12, p.x + (j - 0.5) * 0.12);
      const s = 0.8 + j * 0.6;
      o.scale.set(s, s, s);
      o.updateMatrix();
      roses.current.setMatrixAt(i, o.matrix);
      roses.current.setColorAt(i, new THREE.Color().setHSL(0.97, 0.7, 0.3 + j * 0.25));
    });
    roses.current.instanceMatrix.needsUpdate = true;
    if (roses.current.instanceColor) roses.current.instanceColor.needsUpdate = true;
  }, [pts, rosePts]);
  useFrame(({ clock }) => {
    (bulbs.current.material as THREE.MeshBasicMaterial).color.setRGB(2.2 + Math.sin(clock.elapsedTime * 2) * 0.4, 1.7, 1.2);
  });
  return (
    <group position={[R.x0 + 0.7, 2.75, ARCH_Z]}>
      <instancedMesh ref={roses} args={[undefined, undefined, rosePts.length]}>
        <sphereGeometry args={[0.07, 10, 8]} />
        <meshStandardMaterial roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={bulbs} args={[undefined, undefined, pts.length]}>
        <sphereGeometry args={[0.035, 8, 6]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <GlowHeart position={[0.1, 0, 0]} size={0.5} rotation={[0, Math.PI / 2, 0]} color="#ff5a84" intensity={1.8} />
    </group>
  );
}

function MoonPainting() {
  const glow = useRef<THREE.MeshBasicMaterial>(null!);
  useFrame(({ clock }) => glow.current.color.setScalar(1.05 + Math.sin(clock.elapsedTime * 0.6) * 0.05));
  return (
    <group position={[CX, 3.2, R.z1 - 0.32]} rotation={[0, Math.PI, 0]}>
      <mesh material={GOLD()} position={[0, 0, -0.02]}>
        <boxGeometry args={[5.4, 3.3, 0.08]} />
      </mesh>
      <mesh position={[0, 0, 0.03]}>
        <planeGeometry args={[5.0, 2.9]} />
        <meshBasicMaterial ref={glow} map={nightSkyTexture()} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function ForeverRoom() {
  return (
    <group>
      <pointLight position={[R.x0 + 2.5, 3.2, ARCH_Z]} intensity={20} distance={9} decay={1.6} color="#ff7a9c" />
      <pointLight position={[CX, 4.8, 9]} intensity={20} distance={14} decay={1.6} color="#ffd2b0" />
      <HeartArch />
      <MoonPainting />
      <Chandelier position={[CX, R.height - 1.9, 11]} color="#ffd0c0" />
      <CanvasText position={[CX, R.height - 1.15, R.z1 - 0.32]} rotation={[0, Math.PI, 0]} width={5} px={1200} emissive={1.05} glow="rgba(255,150,180,0.5)" lines={[{ text: 'Forever Together', font: '150px "Great Vibes"', color: '#a8405e' }]} />
      <CanvasText
        position={[R.x1 - 0.32, 3.1, 8.5]}
        rotation={[0, -Math.PI / 2, 0]}
        width={2.6}
        px={800}
        lines={[
          { text: '“Grow old along with me,', font: 'italic 64px "Cormorant Garamond"', color: '#6a2f3e' },
          { text: 'the best is yet to be.”', font: 'italic 64px "Cormorant Garamond"', color: '#6a2f3e', gap: 12 },
          { text: '— Robert Browning', font: '36px "Inter"', color: '#8a5a62' },
        ]}
      />
      <Petals center={[R.x0 + 3, ARCH_Z]} radius={[2.2, 2.8]} count={180} />
      {[[-1.3, -2.6], [-1.6, -2.1], [-1.2, 2.5], [-1.5, 2.0], [-0.8, -2.9], [-0.9, 2.9]].map(([dx, dz], i) => (
        <Candle key={i} position={[R.x0 + 2 + dx, 0, ARCH_Z + dz]} height={0.18 + (i % 3) * 0.12} />
      ))}
      <RoseVase position={[R.x0 + 0.9, 0, ARCH_Z - 3.4]} scale={1.3} />
      <RoseVase position={[R.x0 + 0.9, 0, ARCH_Z + 3.4]} scale={1.3} color="#f2a7b8" />
      <Plant position={[R.x1 - 0.8, 0, R.z1 - 0.8]} />
      <Plant position={[R.x0 + 0.8, 0, R.z0 + 0.8]} scale={0.9} />
      <Sparkles count={70} scale={[10, 4, 14]} position={[CX, 2.4, 12]} size={2.6} speed={0.3} color="#ffc0d0" opacity={0.8} />
    </group>
  );
}
