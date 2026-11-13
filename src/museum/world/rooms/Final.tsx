import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { useTour } from '../../context';
import { EXIT_DOOR, FINAL_WALL, ROOM_BY_ID } from '../../layout';
import { CanvasText } from '../CanvasText';
import { Chandelier, GOLD } from '../Architecture';
import { Candle, GlowHeart, GlowSprite, Pedestal, Petals, Plant, RoseVase } from '../Props';

const R = ROOM_BY_ID.final;

function ExitDoor() {
  const glow = useRef<THREE.MeshBasicMaterial>(null!);
  useFrame(({ clock }) => {
    glow.current.opacity = 0.75 + Math.sin(clock.elapsedTime * 2) * 0.2;
  });
  return (
    <group position={[R.x1 - 0.3, 0, EXIT_DOOR.z]} rotation={[0, -Math.PI / 2, 0]}>
      {/* light spilling through the gap */}
      <mesh position={[0, 1.65, -0.01]}>
        <planeGeometry args={[2.3, 3.4]} />
        <meshBasicMaterial ref={glow} color="#fff3d6" transparent toneMapped={false} />
      </mesh>
      <mesh material={GOLD()} position={[0, 1.8, -0.03]}>
        <boxGeometry args={[2.7, 3.75, 0.06]} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.58, 1.65, 0.04]}>
          <mesh>
            <boxGeometry args={[1.08, 3.3, 0.08]} />
            <meshStandardMaterial color="#f7f0e6" roughness={0.35} />
          </mesh>
          {[0.8, 2.25].map((y) => (
            <mesh key={y} position={[0, y - 1.65, 0.045]}>
              <boxGeometry args={[0.75, y < 1 ? 1.0 : 1.5, 0.02]} />
              <meshStandardMaterial color="#efe3d3" roughness={0.4} />
            </mesh>
          ))}
          <mesh material={GOLD()} position={[-s * 0.42, -0.5, 0.08]}>
            <boxGeometry args={[0.04, 0.4, 0.04]} />
          </mesh>
        </group>
      ))}
      <group position={[0, 3.95, 0.03]}>
        <mesh>
          <boxGeometry args={[1.6, 0.5, 0.05]} />
          <meshStandardMaterial color="#2a1a14" />
        </mesh>
        <CanvasText position={[0, 0, 0.03]} width={1.5} px={600} padding={4} emissive={1.6} glow="rgba(255,120,150,1)" lines={[{ text: 'EXIT ♥', font: '600 120px "Inter"', color: '#ff9db6' }]} />
      </group>
      <GlowSprite position={[0, 1.6, 0.6]} size={3} color="#fff0d0" opacity={0.15} />
    </group>
  );
}

export function FinalRoom() {
  const { museum } = useTour();
  return (
    <group>
      <pointLight position={[FINAL_WALL.x, 4.8, 10]} intensity={16} distance={14} decay={1.7} color="#ffe0c0" />
      <pointLight position={[FINAL_WALL.x, 3.5, 16.5]} intensity={9} distance={9} decay={1.7} color="#ffd0dc" />
      <Chandelier position={[FINAL_WALL.x, R.height - 1.9, 11]} />

      {/* the special message wall */}
      <group position={[FINAL_WALL.x, 3.3, R.z1 - 0.34]} rotation={[0, Math.PI, 0]}>
        <mesh material={GOLD()} position={[0, 0, -0.03]}>
          <boxGeometry args={[8.4, 4.0, 0.06]} />
        </mesh>
        <mesh position={[0, 0, 0.005]}>
          <planeGeometry args={[8.1, 3.7]} />
          <meshStandardMaterial color="#fffaf2" roughness={0.9} />
        </mesh>
        <CanvasText
          position={[0, 0, 0.015]}
          width={7.6}
          px={1600}
          padding={36}
          lines={[
            { text: 'Our Final Memory', font: '130px "Great Vibes"', color: '#b4465e', gap: 22 },
            { text: museum.final_message, font: 'italic 70px "Cormorant Garamond"', color: '#3e2a22', gap: 26 },
            { text: museum.partner_names ? `— ${museum.partner_names}` : '♥', font: '600 56px "Cormorant Garamond"', color: '#8a5a3a' },
          ]}
        />
      </group>

      <Pedestal position={[R.x0 + 1.5, 0, R.z1 - 0.8]} height={1.0}>
        <GlowHeart position={[0, 0.5, 0]} size={0.3} spin />
      </Pedestal>
      <Pedestal position={[R.x1 - 1.5, 0, R.z1 - 0.8]} height={1.0}>
        <GlowHeart position={[0, 0.5, 0]} size={0.3} spin color="#ffb3c6" />
      </Pedestal>

      <ExitDoor />
      <Petals center={[FINAL_WALL.x, 13]} radius={[1.3, 5]} count={160} />
      {[[R.x0 + 0.8, R.z0 + 1], [R.x1 - 0.8, R.z0 + 1], [R.x0 + 2.6, R.z1 - 0.6], [R.x1 - 2.6, R.z1 - 0.6], [R.x0 + 0.7, R.z1 - 2], [R.x1 - 0.7, R.z1 - 2]].map(([x, z], i) => (
        <Candle key={i} position={[x, 0, z]} height={0.2 + (i % 3) * 0.1} />
      ))}
      <RoseVase position={[R.x0 + 0.8, 0, 9]} scale={1.2} />
      <Plant position={[R.x1 - 0.9, 0, R.z0 + 0.9]} />
      <Sparkles count={70} scale={[10, 4, 16]} position={[FINAL_WALL.x, 2.5, 12]} size={2.4} speed={0.25} color="#ffe2c8" opacity={0.8} />
    </group>
  );
}
