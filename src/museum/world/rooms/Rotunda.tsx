import { useMemo } from 'react';
import * as THREE from 'three';
import { Sparkles } from '@react-three/drei';
import { useTour } from '../../context';
import { JOURNEY, ROOM_BY_ID, ROTUNDA, ROTUNDA_COLUMNS } from '../../layout';
import { CanvasText } from '../CanvasText';
import { GOLD, hdr } from '../Architecture';
import { GlowHeart } from '../Props';
import { cofferTexture } from '../textures';
import { Column } from './Front';

const R = ROOM_BY_ID.welcome;

/** Room I — the domed rotunda: welcome, names, message. */
export function WelcomeRoom() {
  const { museum } = useTour();
  const { x: cx, z: cz, domeRadius: DR, columnRadius: CR, columnHeight: CH } = ROTUNDA;
  const H = R.height;
  const dome = useMemo(() => {
    const t = cofferTexture('#f3ebdd').clone();
    t.repeat.set(16, 6);
    t.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, side: THREE.BackSide });
  }, []);
  const ceiling = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f3ebdd', roughness: 0.9, side: THREE.DoubleSide }), []);
  const stone = useMemo(() => new THREE.MeshStandardMaterial({ color: '#efe8dc', roughness: 0.45 }), []);
  const gold = GOLD();
  const journey = JOURNEY.map((id) => ROOM_BY_ID[id]);

  return (
    <group>
      <pointLight position={[cx, 6.5, cz]} intensity={30} distance={18} decay={1.5} color="#ffe2c0" />
      <pointLight position={[cx, 2.5, cz + 5]} intensity={12} distance={10} decay={1.6} color="#ffc6d2" />

      {/* flat ceiling with an opening for the dome */}
      <mesh material={ceiling} rotation={[Math.PI / 2, 0, 0]} position={[cx, H, cz]}>
        <ringGeometry args={[DR, 14, 64, 1]} />
      </mesh>
      {/* dome + oculus */}
      <mesh material={dome} position={[cx, H, cz]} scale={[1, 0.62, 1]}>
        <sphereGeometry args={[DR, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh position={[cx, H + DR * 0.62 - 0.05, cz]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.2, 40]} />
        <meshBasicMaterial color={hdr('#fff2da', 2.2)} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh material={gold} position={[cx, H + 0.02, cz]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[DR, 0.08, 8, 96]} />
      </mesh>

      {/* ring of columns + circular entablature */}
      {ROTUNDA_COLUMNS.map(([x, z]) => (
        <Column key={`${x},${z}`} position={[x, 0, z]} height={CH} radius={0.34} />
      ))}
      <mesh material={stone} position={[cx, CH + 0.25, cz]}>
        <cylinderGeometry args={[CR + 0.55, CR + 0.55, 0.5, 64, 1, true]} />
      </mesh>
      <mesh material={stone} position={[cx, CH + 0.25, cz]}>
        <cylinderGeometry args={[CR - 0.55, CR - 0.55, 0.5, 64, 1, true]} />
      </mesh>
      <mesh material={stone} position={[cx, CH + 0.5, cz]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[CR - 0.55, CR + 0.55, 64]} />
      </mesh>
      <mesh material={stone} position={[cx, CH, cz]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[CR - 0.55, CR + 0.55, 64]} />
      </mesh>
      <mesh material={gold} position={[cx, CH + 0.06, cz]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[CR + 0.56, 0.025, 6, 96]} />
      </mesh>

      {/* floor rosette */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.006, cz]}>
        <ringGeometry args={[CR - 0.2, CR + 0.15, 96]} />
        <meshStandardMaterial color="#c9a961" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* central heart sculpture on a round plinth */}
      <mesh material={stone} position={[cx, 0.35, cz]}>
        <cylinderGeometry args={[1.5, 1.65, 0.7, 48]} />
      </mesh>
      <mesh material={gold} position={[cx, 0.71, cz]}>
        <cylinderGeometry args={[1.52, 1.52, 0.04, 48]} />
      </mesh>
      <mesh material={stone} position={[cx, 1.2, cz]}>
        <cylinderGeometry args={[0.35, 0.5, 1.0, 24]} />
      </mesh>
      <GlowHeart position={[cx, 2.6, cz]} size={0.75} spin />
      <CanvasText
        position={[cx, 0.4, cz + 1.66]}
        width={2.6}
        px={900}
        padding={4}
        lines={[{ text: museum.partner_names || museum.name, font: '600 90px "Cormorant Garamond"', color: '#6a4a32' }]}
      />
      <CanvasText
        position={[cx, 0.4, cz - 1.66]}
        rotation={[0, Math.PI, 0]}
        width={2.6}
        px={900}
        padding={4}
        lines={[{ text: museum.partner_names || museum.name, font: '600 90px "Cormorant Garamond"', color: '#6a4a32' }]}
      />

      {/* title over the gallery doorway (north) */}
      <CanvasText
        position={[cx, H - 1.25, R.z0 + 0.3]}
        width={8}
        px={1600}
        padding={4}
        emissive={1.05}
        glow="rgba(255,200,170,0.5)"
        lines={[{ text: 'Welcome to Our Story', font: '150px "Great Vibes"', color: '#a85060' }]}
      />

      {/* welcome message (west wall) and the journey (east wall) */}
      <group position={[R.x0 + 0.28, 3.1, cz]} rotation={[0, Math.PI / 2, 0]}>
        <mesh material={gold} position={[0, 0, -0.02]}>
          <boxGeometry args={[4.4, 3.0, 0.04]} />
        </mesh>
        <mesh position={[0, 0, 0.005]}>
          <planeGeometry args={[4.2, 2.8]} />
          <meshStandardMaterial color="#fbf6ee" roughness={0.9} />
        </mesh>
        <CanvasText
          position={[0, 0, 0.012]}
          width={3.9}
          px={1000}
          padding={26}
          lines={[
            { text: museum.name, font: '600 80px "Cormorant Garamond"', color: '#7a2f43', gap: 16 },
            { text: museum.welcome_message, font: 'italic 52px "Cormorant Garamond"', color: '#4a3428', gap: 14 },
            { text: '♥', font: '56px "Inter"', color: '#c43d63' },
          ]}
        />
      </group>
      <group position={[R.x1 - 0.28, 3.1, cz]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh material={gold} position={[0, 0, -0.02]}>
          <boxGeometry args={[4.4, 3.0, 0.04]} />
        </mesh>
        <mesh position={[0, 0, 0.005]}>
          <planeGeometry args={[4.2, 2.8]} />
          <meshStandardMaterial color="#2b2420" roughness={0.6} />
        </mesh>
        <CanvasText
          position={[0, 0, 0.012]}
          width={3.8}
          px={900}
          padding={22}
          emissive={1}
          lines={[
            { text: 'THE JOURNEY', font: '500 36px "Inter"', color: '#d9b26f', gap: 20 },
            ...journey.map((r, i) => ({ text: `${r.subtitle} · ${r.name}`, font: '500 48px "Cormorant Garamond"', color: '#f8efe4', gap: i === journey.length - 1 ? 0 : 6 })),
          ]}
        />
      </group>

      <Sparkles count={70} scale={[14, 6, 14]} position={[cx, 3.5, cz]} size={2.2} speed={0.25} color="#ffe2c8" opacity={0.7} />
    </group>
  );
}
