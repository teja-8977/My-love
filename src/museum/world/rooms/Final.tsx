import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { useTour } from '../../context';
import { CAKE_SPOT, EXIT_DOOR, FINAL_WALL, LETTER_SPOT, ROOM_BY_ID } from '../../layout';
import { BIRTHDAY_TITLE, STORY_BEGAN } from '../../../story';
import { PhotoFrame } from './Gallery';
import { CanvasText } from '../CanvasText';
import { Chandelier, GOLD } from '../Architecture';
import { Balloons, Candle, GlowHeart, GlowSprite, Pedestal, Petals, Plant, RoseVase } from '../Props';

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

/** The birthday letter: an envelope with a wax-seal heart, floating above a golden pedestal. */
function Envelope() {
  const g = useRef<THREE.Group>(null!);
  const paper = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f6e3d4', roughness: 0.8 }), []);
  const flap = useMemo(() => {
    const sh = new THREE.Shape();
    sh.moveTo(-0.3, 0);
    sh.lineTo(0.3, 0);
    sh.lineTo(0, -0.22);
    sh.closePath();
    return new THREE.ShapeGeometry(sh);
  }, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    g.current.position.y = 1.55 + Math.sin(t * 1.6) * 0.06;
    g.current.rotation.y = Math.sin(t * 0.7) * 0.35;
  });
  return (
    <group position={[LETTER_SPOT.x, 0, LETTER_SPOT.z]}>
      <Pedestal position={[0, 0, 0]} height={1.0}>
        <RoseVase position={[0.22, 0, 0.18]} scale={0.45} />
      </Pedestal>
      <group ref={g} position={[0, 1.55, 0]} rotation={[0, 0, 0]}>
        <group rotation={[-0.25, 0, 0]}>
          <mesh material={paper}>
            <boxGeometry args={[0.6, 0.4, 0.02]} />
          </mesh>
          <mesh geometry={flap} position={[0, 0.2, 0.012]}>
            <meshStandardMaterial color="#e2b9a3" roughness={0.8} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0.0, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.055, 0.055, 0.015, 24]} />
            <meshStandardMaterial color="#a3203c" roughness={0.4} />
          </mesh>
          <CanvasText position={[0, -0.13, 0.013]} width={0.5} px={400} padding={2} lines={[{ text: 'For Pranati ❤', font: 'italic 600 60px "Cormorant Garamond"', color: '#8c2f3c' }]} />
        </group>
        <GlowSprite position={[0, 0, -0.05]} size={1.4} color="#ffd59a" opacity={0.5} />
      </group>
      <pointLight position={[0, 2.1, 0.4]} intensity={4} distance={4} decay={1.8} color="#ffcf8f" />
      <Sparkles count={30} scale={[1.6, 1.4, 1.6]} position={[0, 1.6, 0]} size={3} speed={0.35} color="#ffe2a8" />
    </group>
  );
}

/** Birthday cake with candles on a little round table. */
function Cake() {
  const cream = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fff4ef', roughness: 0.7 }), []);
  const pink = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f2a7b8', roughness: 0.6 }), []);
  return (
    <group position={[CAKE_SPOT.x, 0, CAKE_SPOT.z]}>
      <mesh material={GOLD()} position={[0, 0.38, 0]}>
        <cylinderGeometry args={[0.05, 0.07, 0.76, 12]} />
      </mesh>
      <mesh position={[0, 0.78, 0]}>
        <cylinderGeometry args={[0.55, 0.55, 0.04, 32]} />
        <meshStandardMaterial color="#fbf3ec" roughness={0.8} />
      </mesh>
      <mesh material={cream} position={[0, 0.93, 0]}>
        <cylinderGeometry args={[0.32, 0.32, 0.26, 32]} />
      </mesh>
      <mesh material={pink} position={[0, 1.07, 0]}>
        <cylinderGeometry args={[0.33, 0.33, 0.03, 32]} />
      </mesh>
      <mesh material={cream} position={[0, 1.17, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.18, 32]} />
      </mesh>
      {Array.from({ length: 5 }, (_, i) => {
        const a = (i / 5) * Math.PI * 2;
        return <Candle key={i} position={[Math.cos(a) * 0.12, 1.26, Math.sin(a) * 0.12]} height={0.1} />;
      })}
    </group>
  );
}

export function FinalRoom() {
  const { photos } = useTour();
  // the last photograph in the gallery is the final memory of Teja & Pranati
  const finalPhoto = useMemo(() => [...photos].sort((a, b) => b.slot - a.slot)[0], [photos]);
  return (
    <group>
      <pointLight position={[FINAL_WALL.x, 4.8, 10]} intensity={16} distance={14} decay={1.7} color="#ffe0c0" />
      <pointLight position={[FINAL_WALL.x, 3.5, 16.5]} intensity={9} distance={9} decay={1.7} color="#ffd0dc" />
      <Chandelier position={[FINAL_WALL.x, R.height - 1.9, 11]} />

      {/* birthday banner + the final photograph of Teja & Pranati */}
      <CanvasText
        position={[FINAL_WALL.x, R.height - 1.05, R.z1 - 0.34]}
        rotation={[0, Math.PI, 0]}
        width={8}
        px={1800}
        padding={6}
        emissive={1.25}
        glow="rgba(255,190,120,0.9)"
        lines={[{ text: BIRTHDAY_TITLE + ' ❤', font: '170px "Great Vibes"', color: '#f3c27a' }]}
      />
      <PhotoFrame slot={{ slot: -1, x: FINAL_WALL.x, y: 2.75, z: R.z1 - 0.3, rotY: Math.PI, size: 3.1 }} media={finalPhoto} />
      <CanvasText
        position={[FINAL_WALL.x, 0.75, R.z1 - 0.34]}
        rotation={[0, Math.PI, 0]}
        width={4.6}
        px={1200}
        padding={4}
        lines={[{ text: `Teja & Pranati · since ${STORY_BEGAN}`, font: 'italic 600 64px "Cormorant Garamond"', color: '#8a5a3a' }]}
      />
      {/* golden bunting along the photo wall */}
      {Array.from({ length: 13 }, (_, i) => {
        const t = i / 12;
        const x = R.x0 + 0.8 + t * (R.x1 - R.x0 - 1.6);
        const y = R.height - 1.9 - Math.sin(t * Math.PI) * 0.5;
        return (
          <mesh key={i} position={[x, y, R.z1 - 0.32]} rotation={[0, Math.PI, Math.PI]}>
            <coneGeometry args={[0.16, 0.34, 3]} />
            <meshStandardMaterial color={['#f2d27a', '#f2a7b8', '#ffffff'][i % 3]} roughness={0.6} side={THREE.DoubleSide} />
          </mesh>
        );
      })}
      <Envelope />
      <Cake />
      <Balloons position={[R.x0 + 1.0, 0, R.z1 - 1.1]} />
      <Balloons position={[R.x1 - 1.0, 0, R.z1 - 2.6]} colors={['#f2d27a', '#ff6b8f', '#ffffff']} />
      <Balloons position={[R.x0 + 1.0, 0, R.z0 + 2.2]} colors={['#ffffff', '#f2a7b8', '#f2d27a']} />

      <Pedestal position={[R.x0 + 1.5, 0, R.z1 - 0.8]} height={1.0}>
        <GlowHeart position={[0, 0.5, 0]} size={0.3} spin />
      </Pedestal>
      <Pedestal position={[R.x1 - 1.5, 0, R.z1 - 0.8]} height={1.0}>
        <GlowHeart position={[0, 0.5, 0]} size={0.3} spin color="#ffb3c6" />
      </Pedestal>

      <ExitDoor />
      <Petals center={[FINAL_WALL.x, 13]} radius={[2.2, 5]} count={220} />
      {[[R.x0 + 0.8, R.z0 + 1], [R.x1 - 0.8, R.z0 + 1], [R.x0 + 2.6, R.z1 - 0.6], [R.x1 - 2.6, R.z1 - 0.6], [R.x0 + 0.7, R.z1 - 2], [R.x1 - 0.7, R.z1 - 2]].map(([x, z], i) => (
        <Candle key={i} position={[x, 0, z]} height={0.2 + (i % 3) * 0.1} />
      ))}
      <RoseVase position={[R.x0 + 0.8, 0, 9]} scale={1.2} />
      <Plant position={[R.x1 - 0.9, 0, R.z0 + 0.9]} />
      <Sparkles count={70} scale={[10, 4, 16]} position={[FINAL_WALL.x, 2.5, 12]} size={2.4} speed={0.25} color="#ffe2c8" opacity={0.8} />
    </group>
  );
}
