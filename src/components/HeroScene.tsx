import { Canvas, useFrame } from '@react-three/fiber';
import { Sparkles, Float } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Avatar } from '../avatar/Avatar';
import { DEFAULT_FEMALE, DEFAULT_MALE } from '../avatar/config';
import { heartShape } from '../museum/world/shapes';

export function Arch() {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#efe3d3', roughness: 0.6 }), []);
  return (
    <group position={[0, 0, -2.4]}>
      {[-1.9, 1.9].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh material={mat} position={[0, 1.6, 0]}>
            <cylinderGeometry args={[0.2, 0.22, 3.2, 24]} />
          </mesh>
          <mesh material={mat} position={[0, 0.1, 0]}>
            <boxGeometry args={[0.6, 0.2, 0.6]} />
          </mesh>
          <mesh material={mat} position={[0, 3.25, 0]}>
            <boxGeometry args={[0.6, 0.15, 0.6]} />
          </mesh>
        </group>
      ))}
      <mesh material={mat} position={[0, 3.3, 0]} rotation={[0, 0, 0]}>
        <torusGeometry args={[1.9, 0.18, 16, 48, Math.PI]} />
      </mesh>
      {/* door */}
      <mesh position={[0, 1.65, -0.25]}>
        <planeGeometry args={[3.4, 3.3]} />
        <meshStandardMaterial color="#5a2a1c" roughness={0.5} />
      </mesh>
      <mesh position={[0, 3.3, -0.25]}>
        <circleGeometry args={[1.7, 48, 0, Math.PI]} />
        <meshStandardMaterial color="#5a2a1c" roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.7, -0.23]}>
        <planeGeometry args={[0.04, 3.3]} />
        <meshStandardMaterial color="#3a1a10" />
      </mesh>
      {[-0.22, 0.22].map((x) => (
        <mesh key={x} position={[x, 1.6, -0.2]}>
          <torusGeometry args={[0.09, 0.015, 8, 24]} />
          <meshStandardMaterial color="#d9b26f" metalness={0.9} roughness={0.25} />
        </mesh>
      ))}
    </group>
  );
}

function GlowHeart() {
  const ref = useRef<THREE.Mesh>(null!);
  const geo = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(heartShape(0.5), { depth: 0.12, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 4 });
    g.center();
    return g;
  }, []);
  useFrame(({ clock }) => {
    const s = 1 + Math.sin(clock.elapsedTime * 2.2) * 0.04;
    ref.current.scale.set(s, s, s);
  });
  return (
    <Float speed={1.4} rotationIntensity={0.3} floatIntensity={0.6}>
      <mesh ref={ref} geometry={geo} position={[0, 4.2, -2]}>
        <meshStandardMaterial color="#ff5c86" emissive="#ff2d63" emissiveIntensity={1.4} roughness={0.3} />
      </mesh>
    </Float>
  );
}

function Rig() {
  useFrame(({ camera, pointer }) => {
    camera.position.x += (pointer.x * 0.6 - camera.position.x) * 0.03;
    camera.position.y += (2.1 + pointer.y * 0.25 - camera.position.y) * 0.03;
    camera.lookAt(0, 1.7, -1);
  });
  return null;
}

export default function HeroScene() {
  return (
    <Canvas dpr={[1, 1.75]} camera={{ position: [0, 2.1, 5.6], fov: 40 }} gl={{ antialias: true }}>
      <color attach="background" args={['#1a0c13']} />
      <fog attach="fog" args={['#1a0c13', 7, 16]} />
      <ambientLight intensity={0.35} color="#ffd9e2" />
      <spotLight position={[0, 7, 3]} angle={0.5} penumbra={0.8} intensity={60} color="#ffe2c4" />
      <pointLight position={[0, 4, -1.5]} intensity={8} color="#ff6b8f" distance={6} />
      <pointLight position={[-3, 2, 2]} intensity={6} color="#d9b26f" distance={8} />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[9, 64]} />
        <meshStandardMaterial color="#2a1219" roughness={0.35} metalness={0.2} />
      </mesh>
      <Arch />
      <GlowHeart />
      <group position={[-0.55, 0, 0]} rotation={[0, 0.5, 0]}>
        <Avatar config={DEFAULT_MALE} anim="idle" />
      </group>
      <group position={[0.55, 0, 0]} rotation={[0, -0.5, 0]}>
        <Avatar config={DEFAULT_FEMALE} anim="idle" />
      </group>
      <Sparkles count={70} scale={[8, 5, 5]} position={[0, 2.5, -1]} size={2.5} speed={0.3} color="#ffd1dc" />
      <Rig />
    </Canvas>
  );
}
