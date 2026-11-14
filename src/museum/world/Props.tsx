import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Furniture } from '../layout';
import { GOLD } from './Architecture';
import { glowTexture } from './textures';
import { heartShape } from './shapes';

const m = (color: string, roughness = 0.7, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });

export function FurniturePiece({ f }: { f: Furniture }) {
  return (
    <group position={[f.x, 0, f.z]} rotation={[0, f.yaw, 0]}>
      {f.kind === 'date-chairs' ? <DateChairs color={f.color ?? '#a3203c'} /> : <Sofa color={f.color ?? '#8c1d33'} kind={f.kind} />}
    </group>
  );
}

/** Two velvet dining chairs side by side (local +Z = the way they face). */
function DateChairs({ color }: { color: string }) {
  const velvet = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.9 }), [color]);
  const gold = GOLD();
  return (
    <group>
      {[-0.42, 0.42].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh material={velvet} position={[0, 0.46, 0.04]} castShadow>
            <boxGeometry args={[0.5, 0.09, 0.48]} />
          </mesh>
          <mesh material={gold} position={[0, 0.405, 0.04]}>
            <boxGeometry args={[0.52, 0.03, 0.5]} />
          </mesh>
          {[-0.21, 0.21].map((lx) =>
            [-0.16, 0.24].map((lz) => (
              <mesh key={`${lx}${lz}`} material={gold} position={[lx, 0.2, lz]}>
                <cylinderGeometry args={[0.018, 0.014, 0.4, 8]} />
              </mesh>
            )),
          )}
          <mesh material={velvet} position={[0, 0.86, -0.19]} castShadow>
            <boxGeometry args={[0.46, 0.66, 0.07]} />
          </mesh>
          <mesh material={velvet} position={[0, 1.19, -0.19]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 1]}>
            <cylinderGeometry args={[0.23, 0.23, 0.07, 24, 1, false, -Math.PI / 2, Math.PI]} />
          </mesh>
          <mesh material={gold} position={[0, 0.86, -0.15]}>
            <torusGeometry args={[0.16, 0.012, 6, 28]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function Bench() {
  const wood = useMemo(() => m('#6e4429', 0.45), []);
  const cushion = useMemo(() => m('#c99aa5', 0.9), []);
  const gold = GOLD();
  return (
    <group>
      <mesh material={wood} position={[0, 0.4, 0.1]} castShadow>
        <boxGeometry args={[2.1, 0.08, 0.55]} />
      </mesh>
      <mesh material={cushion} position={[0, 0.46, 0.1]}>
        <boxGeometry args={[2.0, 0.06, 0.5]} />
      </mesh>
      {[-0.9, 0.9].map((x) =>
        [-0.12, 0.32].map((z) => (
          <mesh key={`${x}${z}`} material={gold} position={[x, 0.19, z]}>
            <cylinderGeometry args={[0.025, 0.02, 0.38, 8]} />
          </mesh>
        )),
      )}
    </group>
  );
}

function Sofa({ color, kind }: { color: string; kind: string }) {
  const fabric = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.95 }), [color]);
  const dark = useMemo(() => m(new THREE.Color(color).multiplyScalar(0.75).getStyle(), 0.95), [color]);
  const gold = GOLD();
  const loveseat = kind === 'loveseat';
  return (
    <group>
      {/* base + cushions */}
      <mesh material={dark} position={[0, 0.2, 0.0]} castShadow>
        <boxGeometry args={[2.0, 0.3, 0.85]} />
      </mesh>
      {[-0.44, 0.44].map((x) => (
        <mesh key={x} material={fabric} position={[x, 0.41, 0.06]}>
          <boxGeometry args={[0.86, 0.13, 0.66]} />
        </mesh>
      ))}
      {/* backrest */}
      <mesh material={fabric} position={[0, loveseat ? 0.82 : 0.72, -0.34]} castShadow>
        <boxGeometry args={[2.0, loveseat ? 0.85 : 0.65, 0.2]} />
      </mesh>
      {loveseat && (
        <mesh material={fabric} position={[0, 1.22, -0.34]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.2, 0.45]}>
          <cylinderGeometry args={[1.0, 1.0, 1, 32, 1, false, -Math.PI / 2, Math.PI]} />
        </mesh>
      )}
      {/* arms */}
      {[-1, 1].map((s) => (
        <mesh key={s} material={fabric} position={[s * 0.95, 0.5, 0]} castShadow>
          <boxGeometry args={[0.16, 0.42, 0.85]} />
        </mesh>
      ))}
      {[-0.9, 0.9].map((x) =>
        [-0.35, 0.35].map((z) => (
          <mesh key={`${x}${z}`} material={gold} position={[x, 0.03, z]}>
            <cylinderGeometry args={[0.03, 0.025, 0.06, 8]} />
          </mesh>
        )),
      )}
      {loveseat && (
        <mesh position={[0, 0.85, -0.22]} rotation={[0, 0, 0]}>
          <shapeGeometry args={[heartShape(0.13)]} />
          <meshStandardMaterial color="#fff2f4" roughness={0.9} />
        </mesh>
      )}
    </group>
  );
}

export function Plant({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const leaves = useMemo(() => {
    const out: { p: [number, number, number]; s: number; r: [number, number, number] }[] = [];
    let seed = position[0] * 13.1 + position[2] * 7.7;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < 22; i++) {
      const a = rnd() * Math.PI * 2;
      const h = 0.7 + rnd() * 1.0;
      const rr = 0.1 + rnd() * 0.35;
      out.push({ p: [Math.cos(a) * rr, h, Math.sin(a) * rr], s: 0.22 + rnd() * 0.18, r: [rnd() * 0.8, a, rnd() * 0.8] });
    }
    return out;
  }, [position]);
  const leaf = useMemo(() => m('#3f6b45', 0.75), []);
  const leaf2 = useMemo(() => m('#5a8a52', 0.75), []);
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.22, 0.6, 24]} />
        <meshStandardMaterial color="#f3ece2" roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.61, 0]}>
        <torusGeometry args={[0.29, 0.025, 8, 24]} />
        <meshStandardMaterial color="#d4ad62" roughness={0.3} metalness={0.9} />
      </mesh>
      <mesh position={[0, 0.85, 0]}>
        <cylinderGeometry args={[0.02, 0.03, 0.6, 6]} />
        <meshStandardMaterial color="#4b3426" />
      </mesh>
      {leaves.map((l, i) => (
        <mesh key={i} material={i % 3 ? leaf : leaf2} position={l.p} rotation={l.r} scale={[l.s, l.s * 0.25, l.s * 0.6]}>
          <sphereGeometry args={[1, 10, 8]} />
        </mesh>
      ))}
    </group>
  );
}

export function RoseVase({ position, scale = 1, color = '#c2193d' }: { position: [number, number, number]; scale?: number; color?: string }) {
  const roses = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => {
        const a = (i / 9) * Math.PI * 2 + i;
        const r = i === 0 ? 0 : 0.09 + (i % 2) * 0.04;
        return [Math.cos(a) * r, 0.55 + (i % 3) * 0.05, Math.sin(a) * r] as [number, number, number];
      }),
    [],
  );
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.2, 0]}>
        <latheGeometry args={[[new THREE.Vector2(0.001, 0), new THREE.Vector2(0.12, 0.02), new THREE.Vector2(0.15, 0.15), new THREE.Vector2(0.08, 0.32), new THREE.Vector2(0.1, 0.4)], 24]} />
        <meshStandardMaterial color="#f5f0f6" roughness={0.1} metalness={0.05} transparent opacity={0.6} />
      </mesh>
      {roses.map((p, i) => (
        <group key={i} position={p}>
          <mesh>
            <sphereGeometry args={[0.065, 12, 10]} />
            <meshStandardMaterial color={color} roughness={0.55} />
          </mesh>
          <mesh position={[0, -0.18, 0]}>
            <cylinderGeometry args={[0.006, 0.006, 0.3, 4]} />
            <meshStandardMaterial color="#3d6b3a" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function Pedestal({ position, height = 1.1, children }: { position: [number, number, number]; height?: number; children?: React.ReactNode }) {
  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]} castShadow>
        <boxGeometry args={[0.7, height, 0.7]} />
        <meshStandardMaterial color="#f4ede2" roughness={0.3} />
      </mesh>
      <mesh position={[0, height + 0.03, 0]}>
        <boxGeometry args={[0.82, 0.06, 0.82]} />
        <meshStandardMaterial color="#d4ad62" roughness={0.3} metalness={0.9} />
      </mesh>
      <group position={[0, height + 0.06, 0]}>{children}</group>
    </group>
  );
}

export function Candle({ position, height = 0.25 }: { position: [number, number, number]; height?: number }) {
  const flame = useRef<THREE.Mesh>(null!);
  const glow = useRef<THREE.Mesh>(null!);
  const seed = useMemo(() => Math.random() * 100, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed;
    const f = 1 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.06;
    flame.current.scale.set(1, f, 1);
    (glow.current.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.sin(t * 9) * 0.06;
  });
  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]}>
        <cylinderGeometry args={[0.045, 0.05, height, 16]} />
        <meshStandardMaterial color="#fff5e6" roughness={0.6} emissive="#ffb070" emissiveIntensity={0.15} />
      </mesh>
      <mesh ref={flame} position={[0, height + 0.04, 0]} scale={[1, 1, 1]}>
        <sphereGeometry args={[0.018, 8, 8]} />
        <meshBasicMaterial color={new THREE.Color('#ffd27a').multiplyScalar(3)} toneMapped={false} />
      </mesh>
      <mesh ref={glow} position={[0, height + 0.05, 0]}>
        <planeGeometry args={[0.4, 0.4]} />
        <meshBasicMaterial map={glowTexture()} color="#ffae5c" transparent opacity={0.35} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Instanced rose petals scattered on the floor. */
export function Petals({ center, radius, count = 120, y = 0.012 }: { center: [number, number]; radius: number | [number, number]; count?: number; y?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const geo = useMemo(() => {
    const g = new THREE.CircleGeometry(0.05, 8);
    g.scale(1, 0.7, 1);
    return g;
  }, []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b3142f', roughness: 0.6, side: THREE.DoubleSide }), []);
  useLayoutEffect(() => {
    {
      if (!ref.current) return;
      const o = new THREE.Object3D();
      const [rx, rz] = Array.isArray(radius) ? radius : [radius, radius];
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random());
        o.position.set(center[0] + Math.cos(a) * r * rx, y + Math.random() * 0.004, center[1] + Math.sin(a) * r * rz);
        o.rotation.set(-Math.PI / 2 + (Math.random() - 0.5) * 0.4, 0, Math.random() * Math.PI * 2);
        const s = 0.7 + Math.random() * 0.7;
        o.scale.set(s, s, s);
        o.updateMatrix();
        ref.current.setMatrixAt(i, o.matrix);
        const c = new THREE.Color().setHSL(0.97 + Math.random() * 0.03, 0.75, 0.32 + Math.random() * 0.15);
        ref.current.setColorAt(i, c);
      }
      ref.current.instanceMatrix.needsUpdate = true;
      if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1], count, y]);
  return <instancedMesh ref={ref} args={[geo, mat, count]} />;
}

/** Glowing extruded heart. */
export function GlowHeart({ position, size = 0.5, color = '#ff4f7a', intensity = 1.6, spin = false, rotation }: { position: [number, number, number]; size?: number; color?: string; intensity?: number; spin?: boolean; rotation?: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null!);
  const geo = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(heartShape(size), { depth: size * 0.25, bevelEnabled: true, bevelSize: size * 0.08, bevelThickness: size * 0.08, bevelSegments: 4, curveSegments: 24 });
    g.center();
    return g;
  }, [size]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const s = 1 + Math.sin(t * 2.2) * 0.04;
    ref.current.scale.set(s, s, s);
    if (spin) ref.current.rotation.y = t * 0.6;
  });
  return (
    <mesh ref={ref} geometry={geo} position={position} rotation={rotation}>
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity} roughness={0.3} toneMapped={false} />
    </mesh>
  );
}

export function Balloons({ position, colors = ['#ff6b8f', '#f2d27a', '#ffffff'] }: { position: [number, number, number]; colors?: string[] }) {
  const g = useRef<THREE.Group>(null!);
  const seed = useMemo(() => Math.random() * 10, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed;
    g.current.children.forEach((c, i) => {
      c.position.y = 2.2 + i * 0.25 + Math.sin(t * 1.2 + i) * 0.08;
      c.rotation.z = Math.sin(t * 0.8 + i) * 0.08;
    });
  });
  return (
    <group position={position}>
      <group ref={g}>
        {colors.map((c, i) => (
          <group key={i} position={[(i - 1) * 0.32, 2.2, (i % 2) * 0.2]}>
            <mesh scale={[1, 1.18, 1]}>
              <sphereGeometry args={[0.26, 20, 16]} />
              <meshStandardMaterial color={c} roughness={0.25} metalness={0.15} />
            </mesh>
            <mesh position={[0, -1.15, 0]}>
              <cylinderGeometry args={[0.003, 0.003, 1.8, 3]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          </group>
        ))}
      </group>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 0.12, 12]} />
        <meshStandardMaterial color="#d4ad62" metalness={0.9} roughness={0.3} />
      </mesh>
    </group>
  );
}

export function FloorLamp({ position, color = '#ffd9a8' }: { position: [number, number, number]; color?: string }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 1.6, 8]} />
        <meshStandardMaterial color="#b8904a" metalness={0.9} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.18, 0.2, 0.04, 20]} />
        <meshStandardMaterial color="#b8904a" metalness={0.9} roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.7, 0]}>
        <cylinderGeometry args={[0.16, 0.26, 0.32, 24, 1, true]} />
        <meshStandardMaterial color="#fff1dd" emissive={color} emissiveIntensity={0.9} side={THREE.DoubleSide} roughness={0.9} />
      </mesh>
    </group>
  );
}

/** Soft additive glow sprite used for fake light pools. */
export function GlowSprite({ position, size = 1, color = '#ffd9a8', opacity = 0.6, rotation }: { position: [number, number, number]; size?: number; color?: string; opacity?: number; rotation?: [number, number, number] }) {
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial map={glowTexture()} color={color} transparent opacity={opacity} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh>
  );
}
