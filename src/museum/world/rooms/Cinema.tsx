import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useTour } from '../../context';
import { CINEMA_SCREEN, ROOM_BY_ID } from '../../layout';
import { useCinema } from '../../audio/CinemaController';
import { CanvasText } from '../CanvasText';
import { GOLD } from '../Architecture';
import { RoseVase } from '../Props';

const R = ROOM_BY_ID.cinema;
const S = CINEMA_SCREEN;

function Curtain({ side }: { side: 1 | -1 }) {
  const folds = 8;
  const width = 2.0;
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#7a0f24', roughness: 0.75 }), []);
  return (
    <group position={[S.x + side * (S.w / 2 + width / 2 - 0.1), 0, S.z + 0.25]}>
      {Array.from({ length: folds }, (_, i) => (
        <mesh key={i} material={mat} position={[(i / (folds - 1) - 0.5) * width, R.height / 2 - 0.2, 0]}>
          <cylinderGeometry args={[0.15, 0.19, R.height - 0.4, 12]} />
        </mesh>
      ))}
      <mesh material={GOLD()} position={[-side * (width / 2 - 0.2), 1.4, 0.15]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.26, 0.035, 8, 20]} />
      </mesh>
    </group>
  );
}

function StarCeiling() {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const count = 160;
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      o.position.set(R.x0 + 0.5 + Math.random() * (R.x1 - R.x0 - 1), R.height - 0.03, R.z0 + 0.5 + Math.random() * (R.z1 - R.z0 - 1));
      o.rotation.set(Math.PI / 2, 0, 0);
      const s = 0.4 + Math.random() * 1.2;
      o.scale.set(s, s, s);
      o.updateMatrix();
      ref.current.setMatrixAt(i, o.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  }, []);
  useFrame(({ clock }) => {
    (ref.current.material as THREE.MeshBasicMaterial).color.setScalar(1.3 + Math.sin(clock.elapsedTime * 0.8) * 0.3);
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <circleGeometry args={[0.03, 6]} />
      <meshBasicMaterial color="#fff4e0" toneMapped={false} side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

function Screen() {
  const { cinema, videos } = useTour();
  const playing = useCinema((s) => s.playing);
  const time = useCinema((s) => s.time);
  const index = useCinema((s) => s.index);
  const light = useRef<THREE.PointLight>(null!);
  useFrame(({ clock }) => {
    const target = playing ? 9 + Math.sin(clock.elapsedTime * 3) * 1.5 : 2;
    light.current.intensity += (target - light.current.intensity) * 0.05;
  });
  const showPoster = !playing && time < 0.05;
  const title = videos[index]?.caption;
  return (
    <group>
      <mesh position={[S.x, S.y, S.z - 0.06]}>
        <boxGeometry args={[S.w + 0.5, S.h + 0.5, 0.1]} />
        <meshStandardMaterial color="#050304" roughness={0.6} />
      </mesh>
      <mesh position={[S.x, S.y, S.z]}>
        <planeGeometry args={[S.w, S.h]} />
        <meshBasicMaterial map={cinema.texture} toneMapped={false} color={new THREE.Color(0.95, 0.95, 0.95)} />
      </mesh>
      {showPoster && (
        <group position={[S.x, S.y, S.z + 0.02]}>
          <mesh>
            <planeGeometry args={[S.w, S.h]} />
            <meshBasicMaterial color="#12070b" />
          </mesh>
          <CanvasText
            position={[0, 0, 0.01]}
            width={S.w * 0.8}
            px={1400}
            emissive={1}
            glow="rgba(255,120,150,0.6)"
            lines={[
              { text: 'Our Cinema', font: '200px "Great Vibes"', color: '#ff9db3', gap: 10 },
              {
                text: videos.length ? (title ? `Now showing · ${title}` : `${videos.length} film${videos.length > 1 ? 's' : ''} ready`) : 'The host has not added videos yet',
                font: '500 56px "Inter"',
                color: '#f8efe4',
                gap: 18,
              },
              { text: 'Walk up to the screen and press E · sit on a sofa to watch together', font: 'italic 50px "Cormorant Garamond"', color: '#d9b26f' },
            ]}
          />
        </group>
      )}
      <pointLight ref={light} position={[S.x, S.y, S.z + 5]} intensity={2} distance={16} decay={1.5} color="#cfe0ff" />
      <mesh position={[S.x, 0.15, R.z0 + 0.8]}>
        <boxGeometry args={[10.8, 0.3, 1.2]} />
        <meshStandardMaterial color="#1a0a0f" roughness={0.6} />
      </mesh>
      <mesh position={[S.x, 0.3, R.z0 + 1.41]} material={GOLD()}>
        <boxGeometry args={[10.8, 0.03, 0.04]} />
      </mesh>
    </group>
  );
}

export function CinemaRoom() {
  return (
    <group>
      <pointLight position={[S.x, 6.2, -6]} intensity={9} distance={18} decay={1.5} color="#ff9fb0" />
      <Screen />
      <Curtain side={1} />
      <Curtain side={-1} />
      <mesh position={[S.x, R.height - 0.5, S.z + 0.3]}>
        <boxGeometry args={[R.x1 - R.x0 - 0.4, 1.0, 0.4]} />
        <meshStandardMaterial color="#6a0c1f" roughness={0.75} />
      </mesh>
      <StarCeiling />
      <CanvasText
        position={[S.x, 5.6, R.z1 - 0.3]}
        rotation={[0, Math.PI, 0]}
        width={5}
        px={1200}
        emissive={1.3}
        glow="rgba(255,90,130,0.8)"
        lines={[{ text: 'Now Showing: Us', font: '130px "Great Vibes"', color: '#ff86a3' }]}
      />
      <RoseVase position={[S.x - 4.8, 0.3, R.z0 + 0.8]} />
      <RoseVase position={[S.x + 4.8, 0.3, R.z0 + 0.8]} />
    </group>
  );
}
