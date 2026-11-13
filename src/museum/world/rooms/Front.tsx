import { useMemo } from 'react';
import * as THREE from 'three';
import { Sparkles } from '@react-three/drei';
import { PORTICO_COLUMNS, ROOM_BY_ID } from '../../layout';
import { CanvasText } from '../CanvasText';
import { Chandelier, GOLD } from '../Architecture';
import { GlowSprite, Plant, RoseVase } from '../Props';
import { skyTexture, stoneTexture } from '../textures';

const POR = ROOM_BY_ID.portico;
const PEDIMENT = (() => {
  const s = new THREE.Shape();
  s.moveTo(-10, 0);
  s.lineTo(10, 0);
  s.lineTo(0, 3.2);
  s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: 1.4, bevelEnabled: false });
})();
const ENT = ROOM_BY_ID.entrance;

/** Classical column: base, fluted-look shaft, capital. */
export function Column({ position, height, radius = 0.38, color = '#efe8dc' }: { position: [number, number, number]; height: number; radius?: number; color?: string }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.45 }), [color]);
  const shaft = height - 0.9;
  return (
    <group position={position}>
      <mesh material={mat} position={[0, 0.12, 0]}>
        <boxGeometry args={[radius * 2.6, 0.24, radius * 2.6]} />
      </mesh>
      <mesh material={mat} position={[0, 0.33, 0]}>
        <cylinderGeometry args={[radius * 1.18, radius * 1.25, 0.18, 24]} />
      </mesh>
      <mesh material={mat} position={[0, 0.42 + shaft / 2, 0]}>
        <cylinderGeometry args={[radius * 0.9, radius, shaft, 20]} />
      </mesh>
      <mesh material={mat} position={[0, height - 0.38, 0]}>
        <cylinderGeometry args={[radius * 1.2, radius * 0.92, 0.22, 24]} />
      </mesh>
      <mesh material={mat} position={[0, height - 0.17, 0]}>
        <boxGeometry args={[radius * 2.7, 0.2, radius * 2.7]} />
      </mesh>
      <mesh material={GOLD()} position={[0, height - 0.5, 0]}>
        <torusGeometry args={[radius * 0.93, 0.02, 6, 24]} />
      </mesh>
    </group>
  );
}

function Exterior() {
  const sky = skyTexture();
  const stone = useMemo(() => {
    const t = stoneTexture().clone();
    t.repeat.set(8, 2);
    t.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 });
  }, []);
  const cx = 0;
  return (
    <group>
      <mesh>
        <sphereGeometry args={[150, 32, 16]} />
        <meshBasicMaterial map={sky} side={THREE.BackSide} toneMapped={false} />
      </mesh>
      {/* moon */}
      <mesh position={[-40, 55, 120]}>
        <circleGeometry args={[5, 32]} />
        <meshBasicMaterial color={new THREE.Color('#fff4dc').multiplyScalar(2)} toneMapped={false} />
      </mesh>
      {/* lawn & plinth */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.6, 20]}>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color="#1d2a1d" roughness={1} />
      </mesh>
      <mesh material={stone} position={[0, -0.86, 2.5]}>
        <boxGeometry args={[64, 1.6, 50]} />
      </mesh>
      {/* grand steps down to the lawn */}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} material={stone} position={[cx, -0.1 - i * 0.2, POR.z1 + 0.25 + i * 0.5]}>
          <boxGeometry args={[18, 0.2, 0.5]} />
        </mesh>
      ))}
      {/* garden path + lanterns */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.59, 46]}>
        <planeGeometry args={[6, 30]} />
        <meshStandardMaterial color="#cfc6b6" roughness={0.9} />
      </mesh>
      {[-4, 4].flatMap((x) => [36, 44, 52].map((z) => (
        <group key={`${x}${z}`} position={[x, -1.6, z]}>
          <mesh position={[0, 1, 0]}>
            <cylinderGeometry args={[0.05, 0.06, 2, 8]} />
            <meshStandardMaterial color="#2a2420" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[0, 2.1, 0]}>
            <sphereGeometry args={[0.18, 12, 10]} />
            <meshBasicMaterial color={new THREE.Color('#ffd9a0').multiplyScalar(2.5)} toneMapped={false} />
          </mesh>
        </group>
      )))}
    </group>
  );
}

export function PorticoAndEntrance() {
  const facade = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e9e1d2', roughness: 0.6 }), []);
  const ix = (ENT.x0 + ENT.x1) / 2;
  return (
    <group>
      <Exterior />
      <pointLight position={[0, 7, 23.8]} intensity={22} distance={26} decay={1.5} color="#ffe2bf" />

      {/* colonnade */}
      {PORTICO_COLUMNS.map((x) => (
        <Column key={x} position={[x, 0, POR.z1 - 0.7]} height={POR.height - 0.6} radius={0.42} />
      ))}
      {/* entablature + pediment */}
      <mesh material={facade} position={[0, POR.height - 0.3, POR.z1 - 0.7]}>
        <boxGeometry args={[POR.x1 - POR.x0 + 0.6, 0.6, 1.6]} />
      </mesh>
      <mesh material={GOLD()} position={[0, POR.height - 0.62, POR.z1 + 0.11]}>
        <boxGeometry args={[POR.x1 - POR.x0 + 0.6, 0.04, 0.02]} />
      </mesh>
      <CanvasText
        position={[0, POR.height - 0.3, POR.z1 + 0.12]}
        width={12}
        px={2000}
        padding={4}
        lines={[{ text: 'L O V E   M U S E U M', font: '600 120px "Cormorant Garamond"', color: '#7a6040' }]}
      />
      <mesh geometry={PEDIMENT} position={[0, POR.height, POR.z1 - 1.4]}>
        <meshStandardMaterial color="#e6ddcc" roughness={0.6} />
      </mesh>
      {/* facade pilasters and the main door frame (seen from the portico) */}
      {[-26, -19, -12, 12, 19, 26].map((x) => (
        <mesh key={x} material={facade} position={[x, POR.height / 2, POR.z0 + 0.2]}>
          <boxGeometry args={[0.6, POR.height, 0.15]} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} material={GOLD()} position={[s * 2.75, 2.4, POR.z0 + 0.22]}>
          <boxGeometry args={[0.12, 4.8, 0.12]} />
        </mesh>
      ))}
      <CanvasText
        position={[0, 5.6, POR.z0 + 0.2]}
        width={6}
        px={1400}
        emissive={1.1}
        glow="rgba(255,190,150,0.6)"
        lines={[{ text: 'Every moment lives forever', font: 'italic 90px "Cormorant Garamond"', color: '#f3dcc0' }]}
      />
      <RoseVase position={[-4.2, 0, POR.z0 + 0.9]} scale={1.6} />
      <RoseVase position={[4.2, 0, POR.z0 + 0.9]} scale={1.6} color="#f2a7b8" />

      {/* ------------------- Entrance hall ------------------- */}
      <pointLight position={[ix, 6, 15]} intensity={18} distance={16} decay={1.6} color="#ffe6c8" />
      <Chandelier position={[ix, ENT.height - 2.2, 15]} scale={1.2} drop={2.2} />
      <CanvasText
        position={[ix, ENT.height - 1.3, ENT.z0 + 0.25]}
        width={7}
        px={1600}
        padding={4}
        lines={[{ text: 'Welcome', font: '170px "Great Vibes"', color: '#8a5a48' }]}
      />
      {/* floor medallion */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[ix, 0.006, 15]}>
        <ringGeometry args={[2.2, 2.45, 64]} />
        <meshStandardMaterial color="#c9a961" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[ix, 0.005, 15]}>
        <circleGeometry args={[2.2, 64]} />
        <meshStandardMaterial color="#efe6d8" roughness={0.25} />
      </mesh>
      {/* urns with flowers by the doors */}
      {[-5.5, 5.5].map((x) => (
        <group key={x} position={[x, 0, 19.8]}>
          <mesh position={[0, 0.55, 0]}>
            <latheGeometry args={[[new THREE.Vector2(0.001, 0), new THREE.Vector2(0.3, 0), new THREE.Vector2(0.18, 0.2), new THREE.Vector2(0.38, 0.7), new THREE.Vector2(0.42, 1.0), new THREE.Vector2(0.001, 1.0)].map((v) => v.setY(v.y - 0.55)), 24]} />
            <meshStandardMaterial color="#f1ebe2" roughness={0.35} />
          </mesh>
          <RoseVase position={[0, 1.0, 0]} scale={1.4} />
        </group>
      ))}
      <Plant position={[ENT.x0 + 0.8, 0, ENT.z0 + 0.8]} />
      <Plant position={[ENT.x1 - 0.8, 0, ENT.z0 + 0.8]} />
      <GlowSprite position={[ix, 3.4, ENT.z0 + 0.3]} size={5} color="#ffd9a8" opacity={0.18} />
      <Sparkles count={40} scale={[16, 5, 10]} position={[ix, 3, 15]} size={2} speed={0.2} color="#ffe2c8" opacity={0.6} />
    </group>
  );
}
