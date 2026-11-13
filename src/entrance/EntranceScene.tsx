import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, Sparkles } from '@react-three/drei';
import { WorldHtml } from '../components/WorldHtml';
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import { Avatar, type AnimState } from '../avatar/Avatar';
import type { AvatarConfig } from '../avatar/config';
import { CanvasText } from '../museum/world/CanvasText';
import { Column } from '../museum/world/rooms/Front';
import { GlowSprite, Plant, RoseVase } from '../museum/world/Props';
import { skyTexture, stoneTexture } from '../museum/world/textures';

export type EntranceMode = 'intro' | 'idle' | 'focus' | 'countdown' | 'enter';

export interface EntrancePerson {
  id: string;
  name?: string;
  avatar: AvatarConfig;
  /** small line under the name, e.g. "Host · Ready" */
  tag?: string;
  dim?: boolean;
}

interface Props {
  welcome: string;
  people: EntrancePerson[];
  guide?: { avatar: AvatarConfig; bubble: ReactNode } | null;
  mode: EntranceMode;
  doorsOpen?: boolean;
  onEntered?: () => void;
}

const DOOR_W = 3.0;
const DOOR_H = 3.9;
const PLINTH = 0.6;

// ---------------------------------------------------------------------------
// architecture
// ---------------------------------------------------------------------------
function Facade() {
  const stone = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ebe3d5', roughness: 0.6 }), []);
  const gold = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d4ad62', roughness: 0.28, metalness: 0.95 }), []);
  const steps = useMemo(() => {
    const t = stoneTexture().clone();
    t.repeat.set(6, 1);
    t.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 });
  }, []);
  const pediment = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-9, 0);
    s.lineTo(9, 0);
    s.lineTo(0, 2.6);
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 0.8, bevelEnabled: false });
  }, []);
  const H = 7.6;
  const side = (16 - DOOR_W / 2) / 1;
  return (
    <group>
      {/* plinth + steps */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} material={steps} position={[0, 0.1 + i * 0.2, 1.9 - i * 0.55]}>
          <boxGeometry args={[34 - i * 1.2, 0.2, 1.2 + i * 1.1]} />
        </mesh>
      ))}
      {/* wall left / right / above the door */}
      <mesh material={stone} position={[-(DOOR_W / 2 + side / 2), PLINTH + (H - PLINTH) / 2, -0.4]}>
        <boxGeometry args={[side, H - PLINTH, 0.8]} />
      </mesh>
      <mesh material={stone} position={[DOOR_W / 2 + side / 2, PLINTH + (H - PLINTH) / 2, -0.4]}>
        <boxGeometry args={[side, H - PLINTH, 0.8]} />
      </mesh>
      <mesh material={stone} position={[0, PLINTH + DOOR_H + (H - PLINTH - DOOR_H) / 2, -0.4]}>
        <boxGeometry args={[DOOR_W, H - PLINTH - DOOR_H, 0.8]} />
      </mesh>
      {/* pilasters */}
      {[-14.5, -10.5, -6.5, 6.5, 10.5, 14.5].map((x) => (
        <group key={x}>
          <mesh material={stone} position={[x, PLINTH + (H - PLINTH) / 2, 0.08]}>
            <boxGeometry args={[0.7, H - PLINTH, 0.18]} />
          </mesh>
          <mesh material={gold} position={[x, H - 0.9, 0.2]}>
            <boxGeometry args={[0.5, 0.05, 0.05]} />
          </mesh>
        </group>
      ))}
      {/* tall windows with warm light */}
      {[-12.5, -8.5, 8.5, 12.5].map((x) => (
        <group key={x} position={[x, 3.0, 0.02]}>
          <mesh>
            <planeGeometry args={[1.6, 3.0]} />
            <meshBasicMaterial color={new THREE.Color('#ffcf8f').multiplyScalar(1.3)} toneMapped={false} />
          </mesh>
          <mesh position={[0, 1.5, 0.01]}>
            <circleGeometry args={[0.8, 32, 0, Math.PI]} />
            <meshBasicMaterial color={new THREE.Color('#ffcf8f').multiplyScalar(1.3)} toneMapped={false} />
          </mesh>
          {[-0.45, 0, 0.45].map((dx) => (
            <mesh key={dx} material={stone} position={[dx, 0, 0.02]}>
              <boxGeometry args={[0.05, 3.0, 0.04]} />
            </mesh>
          ))}
          <mesh material={stone} position={[0, -1.6, 0.12]}>
            <boxGeometry args={[2.2, 0.16, 0.3]} />
          </mesh>
        </group>
      ))}
      {/* cornice, frieze with LOVE MUSEUM, pediment */}
      <mesh material={stone} position={[0, H + 0.15, -0.25]}>
        <boxGeometry args={[33, 0.3, 1.3]} />
      </mesh>
      <mesh material={gold} position={[0, H - 0.05, 0.41]}>
        <boxGeometry args={[33, 0.05, 0.03]} />
      </mesh>
      <mesh geometry={pediment} material={stone} position={[0, H + 0.3, -0.7]} />
      <mesh position={[0, H + 1.2, 0.11]}>
        <circleGeometry args={[0.7, 40]} />
        <meshStandardMaterial color="#d4ad62" roughness={0.3} metalness={0.9} />
      </mesh>
      <CanvasText position={[0, H + 1.2, 0.13]} width={1.2} px={300} padding={2} lines={[{ text: '♥', font: '200px "Inter"', color: '#8c2f4a' }]} />
    </group>
  );
}

function GrandArch() {
  const stone = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f3ece0', roughness: 0.45 }), []);
  const gold = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d4ad62', roughness: 0.28, metalness: 0.95 }), []);
  const roses = useRef<THREE.InstancedMesh>(null!);
  const R = DOOR_W / 2 + 0.55;
  const archY = PLINTH + DOOR_H + 0.2;
  const garland = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 70; i++) {
      const a = (i / 70) * Math.PI;
      pts.push(new THREE.Vector3(Math.cos(a) * (R + 0.05), archY + Math.sin(a) * (R + 0.05), 0.95));
    }
    for (let i = 0; i < 26; i++) {
      pts.push(new THREE.Vector3(-R - 0.05, PLINTH + 0.3 + (i / 26) * (DOOR_H - 0.1), 0.95));
      pts.push(new THREE.Vector3(R + 0.05, PLINTH + 0.3 + (i / 26) * (DOOR_H - 0.1), 0.95));
    }
    return pts;
  }, [archY]);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    garland.forEach((p, i) => {
      const j = ((i * 7919) % 100) / 100;
      o.position.set(p.x + (j - 0.5) * 0.18, p.y + (j - 0.5) * 0.14, p.z + j * 0.1);
      const s = 0.75 + j * 0.7;
      o.scale.set(s, s, s);
      o.updateMatrix();
      roses.current.setMatrixAt(i, o.matrix);
      roses.current.setColorAt(i, new THREE.Color().setHSL(0.96 + j * 0.03, 0.75, i % 5 === 0 ? 0.88 : 0.32 + j * 0.2));
    });
    roses.current.instanceMatrix.needsUpdate = true;
    if (roses.current.instanceColor) roses.current.instanceColor.needsUpdate = true;
  }, [garland]);
  return (
    <group>
      {[-1, 1].map((s) => (
        <Column key={s} position={[s * (R + 0.15), PLINTH, 0.55]} height={DOOR_H + 0.2} radius={0.36} color="#f3ece0" />
      ))}
      <mesh material={stone} position={[0, archY, 0.55]}>
        <torusGeometry args={[R + 0.15, 0.32, 16, 64, Math.PI]} />
      </mesh>
      <mesh material={gold} position={[0, archY, 0.88]}>
        <torusGeometry args={[R + 0.15, 0.03, 8, 64, Math.PI]} />
      </mesh>
      <mesh material={gold} position={[0, archY + R + 0.1, 0.9]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.36, 0.36, 0.1]} />
      </mesh>
      <instancedMesh ref={roses} args={[undefined, undefined, garland.length]}>
        <sphereGeometry args={[0.075, 10, 8]} />
        <meshStandardMaterial roughness={0.55} />
      </instancedMesh>
      {/* LOVE MUSEUM on the arch */}
      <group position={[0, PLINTH + DOOR_H + R + 0.75, 0.12]}>
        <mesh material={gold} position={[0, 0, -0.02]}>
          <boxGeometry args={[6.6, 1.0, 0.06]} />
        </mesh>
        <mesh position={[0, 0, 0.015]}>
          <boxGeometry args={[6.42, 0.86, 0.04]} />
          <meshStandardMaterial color="#2a1c16" roughness={0.45} metalness={0.2} />
        </mesh>
        <CanvasText
          position={[0, 0, 0.04]}
          width={6.1}
          px={1800}
          padding={6}
          emissive={1.6}
          glow="rgba(255,200,120,0.9)"
          wrap={false}
          lines={[{ text: 'LOVE MUSEUM', font: '600 150px "Cormorant Garamond"', color: '#f1d08c', spacing: 40 }]}
        />
      </group>
    </group>
  );
}

function Doors({ open }: { open: boolean }) {
  const left = useRef<THREE.Group>(null!);
  const right = useRef<THREE.Group>(null!);
  const glow = useRef<THREE.MeshBasicMaterial>(null!);
  const light = useRef<THREE.PointLight>(null!);
  const amount = useRef(0);
  const wood = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6b3a24', roughness: 0.45 }), []);
  const panel = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5a2f1c', roughness: 0.5 }), []);
  const gold = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d4ad62', roughness: 0.28, metalness: 0.95 }), []);
  useFrame((_, dt) => {
    amount.current += ((open ? 1 : 0) - amount.current) * (1 - Math.exp(-dt * 1.6));
    const a = amount.current * 1.75;
    left.current.rotation.y = a;
    right.current.rotation.y = -a;
    glow.current.color.setScalar(0.9 + amount.current * 2.6);
    light.current.intensity = 6 + amount.current * 60;
  });
  const leaf = (s: 1 | -1) => (
    <group>
      <mesh material={wood} position={[0, DOOR_H / 2, 0]}>
        <boxGeometry args={[DOOR_W / 2 - 0.02, DOOR_H - 0.04, 0.12]} />
      </mesh>
      {[1.2, 3.3].map((y) => (
        <mesh key={y} material={panel} position={[0, y, 0.07]}>
          <boxGeometry args={[DOOR_W / 2 - 0.4, y < 2 ? 1.5 : 2.2, 0.03]} />
        </mesh>
      ))}
      <mesh material={gold} position={[-s * (DOOR_W / 4 - 0.18), 2.3, 0.12]}>
        <torusGeometry args={[0.11, 0.022, 8, 24]} />
      </mesh>
      <mesh material={gold} position={[0, 2.3, 0.09]}>
        <boxGeometry args={[DOOR_W / 2 - 0.3, 0.04, 0.02]} />
      </mesh>
    </group>
  );
  return (
    <group position={[0, PLINTH, -0.1]}>
      {/* the warm museum interior behind the doors */}
      <mesh position={[0, DOOR_H / 2, -0.7]}>
        <planeGeometry args={[DOOR_W, DOOR_H]} />
        <meshBasicMaterial ref={glow} color="#ffe3b3" toneMapped={false} />
      </mesh>
      <pointLight ref={light} position={[0, 2.4, 1.2]} distance={14} decay={1.5} color="#ffd59a" />
      <group ref={left} position={[-DOOR_W / 2, 0, 0]}>
        <group position={[DOOR_W / 4, 0, 0]}>{leaf(-1)}</group>
      </group>
      <group ref={right} position={[DOOR_W / 2, 0, 0]}>
        <group position={[-DOOR_W / 4, 0, 0]}>{leaf(1)}</group>
      </group>
    </group>
  );
}

function Garden() {
  const sky = skyTexture();
  const plaza = useMemo(() => {
    const t = stoneTexture().clone();
    t.repeat.set(14, 8);
    t.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.75, color: '#e9e2d6' });
  }, []);
  return (
    <group>
      <mesh>
        <sphereGeometry args={[160, 32, 16]} />
        <meshBasicMaterial map={sky} side={THREE.BackSide} toneMapped={false} />
      </mesh>
      <mesh position={[30, 48, -110]}>
        <circleGeometry args={[5, 32]} />
        <meshBasicMaterial color={new THREE.Color('#fff4dc').multiplyScalar(2)} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 20]}>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#1c281c" roughness={1} />
      </mesh>
      <mesh material={plaza} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 9]}>
        <planeGeometry args={[34, 18]} />
      </mesh>
      {/* lanterns lining the plaza */}
      {[-7, 7].flatMap((x) =>
        [5, 10, 15].map((z) => (
          <group key={`${x}${z}`} position={[x, 0, z]}>
            <mesh position={[0, 1.3, 0]}>
              <cylinderGeometry args={[0.05, 0.07, 2.6, 8]} />
              <meshStandardMaterial color="#2a2420" metalness={0.6} roughness={0.4} />
            </mesh>
            <mesh position={[0, 2.75, 0]}>
              <sphereGeometry args={[0.2, 14, 10]} />
              <meshBasicMaterial color={new THREE.Color('#ffd9a0').multiplyScalar(3)} toneMapped={false} />
            </mesh>
            <GlowSprite position={[0, 2.75, 0.1]} size={1.6} color="#ffc070" opacity={0.45} />
          </group>
        )),
      )}
      {/* hedges + flowers along the facade */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 9.5, 0.55, 3.4]}>
            <boxGeometry args={[9, 1.1, 1.0]} />
            <meshStandardMaterial color="#2f4a30" roughness={0.95} />
          </mesh>
          {Array.from({ length: 14 }, (_, i) => (
            <mesh key={i} position={[s * (5.4 + i * 0.62), 1.15 + (i % 2) * 0.05, 3.5 + ((i * 37) % 7) / 20]}>
              <sphereGeometry args={[0.13, 10, 8]} />
              <meshStandardMaterial color={i % 3 ? '#c2193d' : '#f2a7b8'} roughness={0.55} />
            </mesh>
          ))}
        </group>
      ))}
      <RoseVase position={[-3.6, PLINTH, 1.1]} scale={1.9} />
      <RoseVase position={[3.6, PLINTH, 1.1]} scale={1.9} color="#f2a7b8" />
      <Plant position={[-5.0, PLINTH, 0.9]} scale={1.1} />
      <Plant position={[5.0, PLINTH, 0.9]} scale={1.1} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// people
// ---------------------------------------------------------------------------
function Person({ p, position, rotation, greet }: { p: EntrancePerson; position: [number, number, number]; rotation: number; greet?: boolean }) {
  const anim = useRef<AnimState>({ anim: 'idle', dance: 0, speed: 1 });
  const timer = useRef(1 + Math.random() * 3);
  useFrame((_, dt) => {
    if (!greet) return;
    timer.current -= dt;
    if (timer.current < 0) {
      if (anim.current.anim === 'wave') {
        anim.current.anim = 'idle';
        timer.current = 4 + Math.random() * 4;
      } else {
        anim.current.anim = 'wave';
        timer.current = 1.8;
      }
    }
  });
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <Avatar config={p.avatar} state={anim} />
      {p.name && (
        <WorldHtml position={[0, 2.0 * p.avatar.height, 0]}>
          <div className={`flex flex-col items-center whitespace-nowrap ${p.dim ? 'opacity-50' : ''}`}>
            <span className="nametag text-[12px]">{p.name}</span>
            {p.tag && <span className="mt-0.5 rounded-full bg-black/50 px-2 text-[10px] text-champagne">{p.tag}</span>}
          </div>
        </WorldHtml>
      )}
    </group>
  );
}

function layoutPeople(n: number): { pos: [number, number, number]; rot: number }[] {
  if (n === 2) return [
    { pos: [-0.75, 0, 4.4], rot: 0.35 },
    { pos: [0.75, 0, 4.4], rot: -0.35 },
  ];
  const spacing = n > 6 ? 1.05 : 1.3;
  return Array.from({ length: n }, (_, i) => {
    const x = (i - (n - 1) / 2) * spacing;
    return { pos: [x, 0, 4.6 + Math.abs(x) * 0.12] as [number, number, number], rot: -x * 0.08 };
  });
}

// ---------------------------------------------------------------------------
// camera
// ---------------------------------------------------------------------------
function CameraRig({ mode, onEntered }: { mode: EntranceMode; onEntered?: () => void }) {
  const { camera, size } = useThree();
  const t = useRef(0);
  const entered = useRef(false);
  const pos = useRef(new THREE.Vector3(0, 9, 36));
  const look = useRef(new THREE.Vector3(0, 4, 0));
  const pointer = useRef({ x: 0, y: 0 });
  useLayoutEffect(() => {
    const move = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  }, []);
  useLayoutEffect(() => {
    if (mode === 'enter') {
      t.current = 0;
      entered.current = false;
    }
  }, [mode]);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    t.current += dt;
    const portrait = size.width / size.height < 0.85;
    const back = portrait ? 19 : 14;
    const target = new THREE.Vector3();
    const lookAt = new THREE.Vector3(0, portrait ? 5.0 : 4.6, 0);
    let k = 1.4;
    switch (mode) {
      case 'intro':
      case 'idle':
        target.set(pointer.current.x * 0.8 + Math.sin(t.current * 0.15) * 0.6, 2.8 - pointer.current.y * 0.3, back);
        k = mode === 'intro' ? 0.9 : 1.4;
        break;
      case 'focus':
        target.set(pointer.current.x * 0.5, 2.7, back - 0.8);
        lookAt.set(0, portrait ? 4.6 : 4.2, 0);
        break;
      case 'countdown':
        target.set(Math.sin(t.current * 0.5) * 0.3, 2.4, back - 3.5 - Math.min(t.current, 5) * 0.4);
        lookAt.set(0, 3.6, 0);
        k = 0.8;
        break;
      case 'enter': {
        const p = Math.min(1, t.current / 3.2);
        const e = p * p * (3 - 2 * p);
        target.set(0, 2.4 + e * 0.4, THREE.MathUtils.lerp(back - 5, -6, e));
        lookAt.set(0, 2.8, -10);
        k = 4;
        if (p >= 1 && !entered.current) {
          entered.current = true;
          onEntered?.();
        }
        break;
      }
    }
    const f = 1 - Math.exp(-dt * k);
    pos.current.lerp(target, f);
    look.current.lerp(lookAt, f);
    camera.position.copy(pos.current);
    camera.lookAt(look.current);
  });
  return null;
}

function usePortrait() {
  const size = useThree((s) => s.size);
  return size.width / size.height < 0.85;
}

function WelcomeText({ text }: { text: string }) {
  const portrait = usePortrait();
  return (
    <Float speed={1.6} rotationIntensity={0.08} floatIntensity={0.7}>
      <CanvasText
        position={[0, portrait ? 10.3 : 9.75, 2.4]}
        width={portrait ? 7.4 : 11}
        px={portrait ? 1250 : 2000}
        padding={10}
        emissive={1.4}
        glow="rgba(255,150,180,0.95)"
        lines={[{ text, font: '150px "Great Vibes"', color: '#ffd1dc' }]}
      />
    </Float>
  );
}

function Guide({ guide }: { guide: NonNullable<Props['guide']> }) {
  const portrait = usePortrait();
  return (
    <group position={portrait ? [-2.0, 0, 5.6] : [-3.9, 0, 4.2]} rotation={[0, portrait ? 0.25 : 0.45, 0]}>
      <Person p={{ id: 'guide', avatar: guide.avatar }} position={[0, 0, 0]} rotation={0} greet />
      <WorldHtml position={[0.2, 2.15, 0]} zIndex={30} interactive anchor="translate(-12%, -100%)" clampToScreen>
        {guide.bubble}
      </WorldHtml>
    </group>
  );
}

// ---------------------------------------------------------------------------
export default function EntranceScene({ welcome, people, guide, mode, doorsOpen = false, onEntered }: Props) {
  const spots = layoutPeople(people.length);
  return (
    <Canvas dpr={[1, 1.7]} gl={{ antialias: false, powerPreference: 'high-performance' }} camera={{ fov: 42, near: 0.1, far: 500, position: [0, 9, 36] }}>
      <color attach="background" args={['#0b0810']} />
      <hemisphereLight args={['#8c90c8', '#2a1a14', 0.55]} />
      <ambientLight intensity={0.18} color="#ffe6dc" />
      <spotLight position={[0, 14, 16]} angle={0.55} penumbra={0.9} intensity={420} distance={45} decay={1.6} color="#ffd9a8" />
      <pointLight position={[-6, 4, 6]} intensity={22} distance={16} decay={1.6} color="#ffb070" />
      <pointLight position={[6, 4, 6]} intensity={22} distance={16} decay={1.6} color="#ffb070" />
      <pointLight position={[0, 2, 7]} intensity={10} distance={10} decay={1.6} color="#ffc6d2" />

      <Garden />
      <Facade />
      <GrandArch />
      <Doors open={doorsOpen} />

      <WelcomeText text={welcome} />

      {people.map((p, i) => (
        <Person key={p.id} p={p} position={spots[i].pos} rotation={spots[i].rot} greet={!p.dim} />
      ))}

      {guide && <Guide guide={guide} />}

      <Sparkles count={mode === 'countdown' ? 260 : 120} scale={[24, 10, 14]} position={[0, 4.5, 4]} size={mode === 'countdown' ? 5 : 3} speed={mode === 'countdown' ? 1.1 : 0.35} color="#ffd88a" opacity={0.9} />
      <CameraRig mode={mode} onEntered={onEntered} />

      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur intensity={0.85} luminanceThreshold={1.0} luminanceSmoothing={0.2} radius={0.75} />
        <Vignette eskil={false} offset={0.25} darkness={0.6} />
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      </EffectComposer>
    </Canvas>
  );
}
