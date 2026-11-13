import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DANCE_FLOOR, MUSIC_CONSOLE, PARTY_POPPER, ROOM_BY_ID } from '../../layout';
import { useMusic, TRACKS } from '../../audio/MusicEngine';
import { CanvasText } from '../CanvasText';
import { GOLD } from '../Architecture';
import { Balloons, GlowSprite, Plant } from '../Props';

const R = ROOM_BY_ID.celebration;
const FLOOR = DANCE_FLOOR;
const CX = (R.x0 + R.x1) / 2;

const danceFloorShader = {
  uniforms: { uTime: { value: 0 }, uBeat: { value: 0 }, uOn: { value: 0 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform float uTime; uniform float uBeat; uniform float uOn;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main() {
      vec2 g = vUv * 10.0;
      vec2 id = floor(g);
      vec2 f = fract(g);
      float edge = smoothstep(0.0, 0.05, f.x) * smoothstep(0.0, 0.05, f.y) * smoothstep(1.0, 0.95, f.x) * smoothstep(1.0, 0.95, f.y);
      float h = hash(id + floor(uTime * (0.6 + uOn * 1.4)));
      vec3 pink = vec3(1.0, 0.35, 0.55);
      vec3 gold = vec3(1.0, 0.78, 0.42);
      vec3 lilac = vec3(0.7, 0.45, 1.0);
      vec3 col = h < 0.33 ? pink : (h < 0.66 ? gold : lilac);
      float wave = 0.5 + 0.5 * sin(length(id - 4.5) * 0.9 - uTime * 3.0);
      float lit = mix(0.18 + 0.12 * wave, 0.35 + 0.9 * step(0.45, h) * (0.6 + 0.4 * uBeat), uOn);
      vec3 base = vec3(0.05, 0.03, 0.06);
      gl_FragColor = vec4(mix(base, col * lit * 1.6, edge), 1.0);
    }
  `,
};

function DanceFloor() {
  const mat = useMemo(() => new THREE.ShaderMaterial({ ...danceFloorShader, uniforms: THREE.UniformsUtils.clone(danceFloorShader.uniforms), toneMapped: false }), []);
  useFrame(({ clock }) => {
    const track = useMusic.getState().track;
    const on = track !== null ? 1 : 0;
    const bpm = track !== null ? TRACKS[track].bpm : 60;
    const beat = Math.pow(1 - ((clock.elapsedTime * bpm) / 60) % 1, 3);
    mat.uniforms.uTime.value = clock.elapsedTime;
    mat.uniforms.uBeat.value = beat;
    mat.uniforms.uOn.value += (on - mat.uniforms.uOn.value) * 0.05;
  });
  return (
    <group position={[FLOOR.x, 0, FLOOR.z]}>
      <mesh material={mat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <planeGeometry args={[FLOOR.size, FLOOR.size]} />
      </mesh>
      <mesh material={GOLD()} position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[FLOOR.size * 0.705, FLOOR.size * 0.72, 4, 1, Math.PI / 4]} />
      </mesh>
    </group>
  );
}

function DiscoBall() {
  const ball = useRef<THREE.Mesh>(null!);
  const beams = useRef<THREE.Group>(null!);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#dddddd', metalness: 1, roughness: 0.15, flatShading: true }), []);
  useFrame((_, dt) => {
    ball.current.rotation.y += dt * 0.5;
    beams.current.rotation.y -= dt * 0.35;
    const on = useMusic.getState().track !== null;
    beams.current.visible = on;
  });
  const beamMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }),
    [],
  );
  return (
    <group position={[FLOOR.x, R.height - 1.6, FLOOR.z]}>
      <mesh position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 1.6, 4]} />
        <meshStandardMaterial color="#888" />
      </mesh>
      <mesh ref={ball} material={mat}>
        <icosahedronGeometry args={[0.55, 3]} />
      </mesh>
      <group ref={beams}>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          const tilt = 0.55 + (i % 3) * 0.15;
          return (
            <group key={i} rotation={[0, a, 0]}>
              <group rotation={[0, 0, tilt]}>
                <mesh material={beamMat} position={[0, -3.5, 0]}>
                  <coneGeometry args={[0.6, 7, 12, 1, true]} />
                </mesh>
              </group>
            </group>
          );
        })}
      </group>
    </group>
  );
}

function StringLights() {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const pts = useMemo(() => {
    const out: THREE.Vector3[] = [];
    for (let k = 0; k < 5; k++) {
      const z = R.z0 + 2 + k * 4;
      for (let i = 0; i <= 30; i++) {
        const t = i / 30;
        const x = R.x0 + 0.3 + t * (R.x1 - R.x0 - 0.6);
        const sag = Math.sin(t * Math.PI) * 1.1;
        out.push(new THREE.Vector3(x, R.height - 0.4 - sag, z));
      }
    }
    return out;
  }, []);
  const palette = useMemo(() => ['#ffd27a', '#ff8fb0', '#ffffff', '#c9a7ff'].map((c) => new THREE.Color(c).multiplyScalar(2.2)), []);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    pts.forEach((p, i) => {
      o.position.copy(p);
      o.updateMatrix();
      ref.current.setMatrixAt(i, o.matrix);
      ref.current.setColorAt(i, palette[i % palette.length]);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [pts, palette]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, pts.length]}>
      <sphereGeometry args={[0.05, 8, 6]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

function MusicConsole() {
  const track = useMusic((s) => s.track);
  const platter = useRef<THREE.Group>(null!);
  useFrame((_, dt) => {
    if (track !== null) platter.current.children.forEach((c) => (c.rotation.y += dt * 3.5));
  });
  return (
    <group position={[MUSIC_CONSOLE.x, 0, MUSIC_CONSOLE.z]}>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[2.6, 1.0, 0.9]} />
        <meshStandardMaterial color="#1b1020" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.55, 0.455]}>
        <planeGeometry args={[2.4, 0.6]} />
        <meshBasicMaterial color={track !== null ? '#ff6b9a' : '#5a2a45'} toneMapped={false} />
      </mesh>
      <mesh material={GOLD()} position={[0, 1.01, 0]}>
        <boxGeometry args={[2.7, 0.03, 1.0]} />
      </mesh>
      <group ref={platter}>
        {[-0.65, 0.65].map((x) => (
          <mesh key={x} position={[x, 1.05, 0]}>
            <cylinderGeometry args={[0.32, 0.32, 0.03, 32]} />
            <meshStandardMaterial color="#111" roughness={0.3} metalness={0.5} />
          </mesh>
        ))}
      </group>
      <CanvasText position={[0, 2.0, 0]} width={2.6} px={800} emissive={1.3} glow="rgba(255,120,180,0.8)" lines={[{ text: '♫ Music', font: '600 120px "Cormorant Garamond"', color: '#ffb3c9' }]} />
    </group>
  );
}

function PartyPopper() {
  const box = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    box.current.rotation.y = clock.elapsedTime * 0.6;
    box.current.position.y = 1.35 + Math.sin(clock.elapsedTime * 2) * 0.05;
  });
  return (
    <group position={[PARTY_POPPER.x, 0, PARTY_POPPER.z]}>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.35, 0.4, 1.0, 24]} />
        <meshStandardMaterial color="#f4ede2" roughness={0.3} />
      </mesh>
      <group ref={box}>
        <mesh>
          <boxGeometry args={[0.45, 0.45, 0.45]} />
          <meshStandardMaterial color="#e8577a" roughness={0.4} />
        </mesh>
        <mesh material={GOLD()}>
          <boxGeometry args={[0.47, 0.47, 0.1]} />
        </mesh>
        <mesh material={GOLD()}>
          <boxGeometry args={[0.1, 0.47, 0.47]} />
        </mesh>
      </group>
      <GlowSprite position={[0, 1.4, 0.3]} size={1.6} color="#ffb6c8" opacity={0.4} />
    </group>
  );
}

function PartyLights() {
  const a = useRef<THREE.PointLight>(null!);
  const b = useRef<THREE.PointLight>(null!);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const on = useMusic.getState().track !== null;
    a.current.color.setHSL((0.92 + Math.sin(t * 0.5) * 0.08) % 1, 0.8, 0.6);
    b.current.color.setHSL((0.75 + Math.cos(t * 0.4) * 0.08) % 1, 0.7, 0.6);
    const pulse = on ? 30 + Math.abs(Math.sin(t * 4)) * 20 : 26;
    a.current.intensity = pulse;
    b.current.intensity = pulse;
  });
  return (
    <>
      <pointLight ref={a} position={[CX - 3, 5, -5]} distance={18} decay={1.5} />
      <pointLight ref={b} position={[CX + 3, 5, -14]} distance={18} decay={1.5} />
      <pointLight position={[CX, 5.5, FLOOR.z]} intensity={18} distance={14} decay={1.5} color="#ffe2c4" />
    </>
  );
}

export function CelebrationRoom() {
  return (
    <group>
      <PartyLights />
      <DanceFloor />
      <DiscoBall />
      <StringLights />
      <MusicConsole />
      <PartyPopper />
      <CanvasText
        position={[CX, 5.2, R.z0 + 0.32]}
        width={7}
        px={1600}
        emissive={1.5}
        glow="rgba(255,90,150,0.9)"
        lines={[{ text: 'Celebrate Us', font: '200px "Great Vibes"', color: '#ff8fb3' }]}
      />
      <CanvasText
        position={[PARTY_POPPER.x + 0.02, 2.4, PARTY_POPPER.z]}
        width={1.6}
        px={500}
        emissive={1.2}
        lines={[{ text: 'Make it rain ♥', font: 'italic 70px "Cormorant Garamond"', color: '#ffd7e1' }]}
      />
      <Balloons position={[R.x0 + 1, 0, R.z1 - 1]} />
      <Balloons position={[R.x1 - 1, 0, R.z1 - 1]} colors={['#c9a7ff', '#ff6b8f', '#f2d27a']} />
      <Balloons position={[R.x1 - 1, 0, R.z0 + 1.2]} colors={['#ffffff', '#f2d27a', '#ff6b8f']} />
      <Plant position={[R.x0 + 0.9, 0, -9]} />
      <Plant position={[R.x1 - 0.9, 0, -9]} />
    </group>
  );
}
