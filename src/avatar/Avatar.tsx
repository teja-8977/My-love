import { lazy, Suspense, useEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { AvatarConfig } from './config';
import { dampPose, makePose, targetPose, type AnimName, type Pose } from './poses';

export const HIP_HEIGHT = 0.92;
const TAU = Math.PI * 2;

export interface AnimState {
  anim: AnimName;
  dance: number;
  speed: number;
}

interface Props {
  config: AvatarConfig;
  /** Live animation state (mutated externally, read every frame). */
  state?: MutableRefObject<AnimState>;
  /** Static animation (used when no state ref is given). */
  anim?: AnimName;
  dance?: number;
  shadow?: boolean;
  children?: ReactNode;
}

// ---------- shared geometry helpers ----------
const geoCache = new Map<string, THREE.BufferGeometry>();
function cached<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geoCache.get(key) as T | undefined;
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g;
}

const capsule = (r: number, len: number) => cached(`cap${r}:${len}`, () => new THREE.CapsuleGeometry(r, Math.max(0.001, len - 2 * r), 6, 16));
const sphere = (r: number, w = 24, h = 16) => cached(`sph${r}:${w}:${h}`, () => new THREE.SphereGeometry(r, w, h));

let shadowTex: THREE.Texture | null = null;
function blobShadowTexture() {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.6, 'rgba(0,0,0,0.25)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  shadowTex = new THREE.CanvasTexture(c);
  return shadowTex;
}

// ---------- body proportions ----------
function torsoProfile(cfg: AvatarConfig) {
  const f = cfg.gender === 'female';
  const b = cfg.build;
  const chest = b === 'slim' ? 0.9 : b === 'athletic' ? 1.1 : b === 'curvy' ? 1.04 : 1;
  const waist = b === 'slim' ? 0.88 : b === 'athletic' ? 0.97 : b === 'curvy' ? 1.02 : 1;
  const hips = b === 'slim' ? 0.9 : b === 'athletic' ? 0.98 : b === 'curvy' ? 1.14 : 1;
  const pts: [number, number][] = f
    ? [
        [0.0, -0.11], [0.12 * hips, -0.1], [0.165 * hips, -0.02], [0.16 * hips, 0.05], [0.125 * waist, 0.15],
        [0.135 * chest, 0.26], [0.152 * chest, 0.33], [0.145 * chest, 0.41], [0.13, 0.46], [0.085, 0.5], [0.05, 0.525], [0.0, 0.53],
      ]
    : [
        [0.0, -0.11], [0.12 * hips, -0.1], [0.152 * hips, -0.02], [0.152 * hips, 0.05], [0.148 * waist, 0.15],
        [0.16 * chest, 0.26], [0.178 * chest, 0.36], [0.172 * chest, 0.43], [0.14 * chest, 0.48], [0.09, 0.515], [0.055, 0.53], [0.0, 0.535],
      ];
  return {
    pts,
    shoulderX: (f ? 0.168 : 0.195) * (b === 'athletic' ? 1.08 : b === 'slim' ? 0.94 : 1),
    limbScale: b === 'athletic' ? 1.12 : b === 'curvy' ? 1.08 : b === 'slim' ? 0.9 : 1,
    hipsW: hips,
  };
}

function lathe(points: [number, number][], scaleR = 1, from = -Infinity, to = Infinity, phiStart = 0, phiLength = TAU) {
  const key = `lathe:${points.map((p) => p.join(',')).join(';')}:${scaleR}:${from}:${to}:${phiStart}:${phiLength}`;
  return cached(key, () => {
    const pts = points
      .filter(([, y]) => y >= from - 1e-6 && y <= to + 1e-6)
      .map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r * scaleR), y));
    // close the cut ends so the mesh looks solid
    if (from > -Infinity) pts.unshift(new THREE.Vector2(0.0001, pts[0].y));
    if (to < Infinity) pts.push(new THREE.Vector2(0.0001, pts[pts.length - 1].y));
    return new THREE.LatheGeometry(pts, 36, phiStart, phiLength);
  });
}

const FACE_SCALE: Record<AvatarConfig['faceShape'], { c: [number, number, number]; j: [number, number, number]; jy: number }> = {
  oval: { c: [1, 1.08, 1.02], j: [0.86, 0.9, 0.95], jy: -0.042 },
  round: { c: [1.06, 1.02, 1.03], j: [0.98, 0.85, 0.98], jy: -0.035 },
  square: { c: [1.04, 1.03, 1], j: [1.0, 0.86, 0.98], jy: -0.04 },
  heart: { c: [1.07, 1.06, 1.02], j: [0.76, 0.92, 0.92], jy: -0.045 },
  long: { c: [0.96, 1.16, 1], j: [0.84, 1.02, 0.94], jy: -0.055 },
};

const ModelAvatar = lazy(() => import('./ModelAvatar'));

/** Shows the personalised GLB (when the user has one) or the built-in procedural character. */
export function Avatar(props: Props) {
  const model = props.config.model;
  if (!model) return <ProceduralAvatar {...props} />;
  const fallback = <ProceduralAvatar {...props} children={undefined} />;
  return (
    <Suspense fallback={fallback}>
      <ModelAvatar model={model} state={props.state} anim={props.anim} dance={props.dance} fallback={fallback}>
        {props.shadow !== false && <BlobShadow />}
        {props.children}
      </ModelAvatar>
    </Suspense>
  );
}

function BlobShadow() {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false }), []);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} material={mat} renderOrder={-1}>
      <circleGeometry args={[0.42, 24]} />
    </mesh>
  );
}

// ---------- procedural character ----------
function ProceduralAvatar({ config, state, anim = 'idle', dance = 0, shadow = true, children }: Props) {
  const cfg = config;
  const f = cfg.gender === 'female';
  const prof = useMemo(() => torsoProfile(cfg), [cfg]);

  const mats = useMemo(() => {
    const m = (color: string, rough = 0.75, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
    const skin = m(cfg.skin, 0.62);
    const hair = new THREE.MeshStandardMaterial({ color: cfg.hairColor, roughness: 0.48, metalness: 0.05, side: THREE.DoubleSide });
    const top = m(cfg.topColor, 0.82);
    top.side = THREE.DoubleSide;
    const accent = m(cfg.accentColor, 0.8);
    const bottom = m(cfg.bottomColor, cfg.bottom === 'jeans' ? 0.9 : 0.78);
    bottom.side = THREE.DoubleSide;
    const shoe = m(cfg.shoeColor, cfg.shoes === 'oxford' || cfg.shoes === 'heels' ? 0.3 : 0.7, 0.05);
    const sole = m(cfg.shoes === 'sneakers' ? '#f5f2ec' : '#2a1d17', 0.8);
    const white = m('#fbfaf7', 0.3);
    const iris = m(cfg.eyeColor, 0.25);
    const dark = m('#120c0a', 0.3);
    const lip = m(cfg.lipColor, 0.5);
    const gold = m('#d8b465', 0.25, 0.9);
    const brow = m(new THREE.Color(cfg.hairColor).multiplyScalar(0.8).getStyle(), 0.8);
    const blush = new THREE.MeshBasicMaterial({ color: '#ff8a9a', transparent: true, opacity: 0.28, depthWrite: false });
    const stubble = new THREE.MeshStandardMaterial({ color: cfg.hairColor, transparent: true, opacity: 0.32, roughness: 1, depthWrite: false });
    const lens = new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.85 });
    const rose = m('#c2193d', 0.55);
    const shadowMat = new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false });
    return { skin, hair, top, accent, bottom, shoe, sole, white, iris, dark, lip, gold, brow, blush, stubble, lens, rose, shadowMat };
  }, [cfg]);

  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  // joints
  const root = useRef<THREE.Group>(null!);
  const spinG = useRef<THREE.Group>(null!);
  const hips = useRef<THREE.Group>(null!);
  const spine = useRef<THREE.Group>(null!);
  const head = useRef<THREE.Group>(null!);
  const lSh = useRef<THREE.Group>(null!);
  const rSh = useRef<THREE.Group>(null!);
  const lEl = useRef<THREE.Group>(null!);
  const rEl = useRef<THREE.Group>(null!);
  const lHip = useRef<THREE.Group>(null!);
  const rHip = useRef<THREE.Group>(null!);
  const lKnee = useRef<THREE.Group>(null!);
  const rKnee = useRef<THREE.Group>(null!);

  const pose = useRef<Pose>(makePose());
  const target = useRef<Pose>(makePose());
  const clock = useRef(Math.random() * 10);
  const blinkT = useRef(2 + Math.random() * 3);
  const eyesRef = useRef<THREE.Group>(null!);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    clock.current += dt;
    const st = state?.current ?? { anim, dance, speed: 1 };
    targetPose(target.current, st.anim, clock.current, { dance: st.dance, speed: st.speed, hipHeight: HIP_HEIGHT });
    const p = pose.current;
    const k = 1 - Math.exp(-dt * (st.anim === 'jump' ? 14 : 10));
    dampPose(p, target.current, k);

    // twirl
    if (st.anim === 'dance' && st.dance === 2) p.spin += dt * 4.2;
    else {
      const goal = Math.round(p.spin / TAU) * TAU;
      p.spin += (goal - p.spin) * (1 - Math.exp(-dt * 6));
    }

    spinG.current.rotation.y = p.spin;
    hips.current.position.set(p.hipX, HIP_HEIGHT + p.hipY, 0);
    hips.current.rotation.set(0, p.hipRotY, p.hipRotZ);
    spine.current.rotation.set(p.spineX, p.spineY, p.spineZ);
    head.current.rotation.set(p.headX, p.headY, p.headZ);
    lSh.current.rotation.set(p.lShX, p.lShY, p.lShZ);
    rSh.current.rotation.set(p.rShX, p.rShY, p.rShZ);
    lEl.current.rotation.x = p.lEl;
    rEl.current.rotation.x = p.rEl;
    lHip.current.rotation.set(p.lHipX, 0, p.lHipZ);
    rHip.current.rotation.set(p.rHipX, 0, p.rHipZ);
    lKnee.current.rotation.x = p.lKnee;
    rKnee.current.rotation.x = p.rKnee;

    // blinking
    blinkT.current -= dt;
    const e = eyesRef.current;
    if (e) {
      if (blinkT.current < 0) {
        e.scale.y = Math.max(0.08, e.scale.y - dt * 30);
        if (blinkT.current < -0.12) blinkT.current = 2.5 + Math.random() * 3.5;
      } else e.scale.y = Math.min(1, e.scale.y + dt * 20);
    }
  });

  // ---------- clothing logic ----------
  const isDress = cfg.top === 'dress';
  const sleeves: 'short' | 'long' | 'three' = cfg.top === 'tshirt' ? 'short' : cfg.top === 'blouse' ? 'three' : 'long';
  const upperArmMat = cfg.top === 'waistcoat' ? mats.accent : mats.top;
  const sleeveMat = cfg.top === 'waistcoat' ? mats.accent : mats.top;
  const torsoUpperMat = cfg.top === 'waistcoat' || cfg.top === 'blazer' ? mats.accent : mats.top;
  const jacket = cfg.top === 'jacket';
  const skirtLike = isDress || cfg.bottom === 'skirt' || cfg.bottom === 'long-skirt';
  const legUpperMat = skirtLike ? mats.skin : mats.bottom;
  const legLowerMat = skirtLike || cfg.bottom === 'shorts' ? mats.skin : mats.bottom;
  const skirtMat = isDress ? mats.top : mats.bottom;
  const skirtLong = cfg.bottom === 'long-skirt' && !isDress;

  const ls = prof.limbScale;
  const thighR = (f ? 0.072 : 0.078) * ls;
  const shinR = (f ? 0.054 : 0.06) * ls;
  const uArmR = (f ? 0.042 : 0.05) * ls;
  const fArmR = (f ? 0.036 : 0.042) * ls;
  const legX = (f ? 0.085 : 0.09) * prof.hipsW;

  const R = f ? 0.114 : 0.118;
  const fs = FACE_SCALE[cfg.faceShape];
  const faceZ = (x: number, y: number) => Math.sqrt(Math.max(0, R * R - x * x - y * y)) * fs.c[2];

  const eyeScaleY = cfg.eyes === 'round' ? 1 : cfg.eyes === 'almond' ? 0.72 : 0.55;
  const eyeX = 0.041;
  const eyeY = -0.004;
  const browW = cfg.brows === 'bold' ? 0.011 : 0.007;

  const legs = (side: 1 | -1, hipRef: typeof lHip, kneeRef: typeof lKnee) => (
    <group ref={hipRef} position={[side * legX, -0.04, 0]}>
      <mesh geometry={capsule(thighR, 0.46)} material={legUpperMat} position={[0, -0.2, 0]} castShadow />
      {cfg.bottom === 'shorts' && !isDress && (
        <mesh geometry={capsule(thighR * 1.02, 0.28)} material={mats.bottom} position={[0, -0.12, 0]} />
      )}
      <group ref={kneeRef} position={[0, -0.41, 0]}>
        <mesh geometry={capsule(shinR, 0.44)} material={legLowerMat} position={[0, -0.2, 0]} castShadow />
        {cfg.bottom === 'jeans' && !skirtLike && (
          <mesh geometry={cached('cuff', () => new THREE.CylinderGeometry(0.066, 0.066, 0.035, 16))} material={mats.bottom} position={[0, -0.36, 0]} />
        )}
        <Shoe style={cfg.shoes} mats={mats} />
      </group>
    </group>
  );

  const arm = (side: 1 | -1, shRef: typeof lSh, elRef: typeof lEl) => (
    <group ref={shRef} position={[side * prof.shoulderX, 0.43, 0]}>
      <mesh geometry={sphere(uArmR * 1.18)} material={sleeves === 'short' ? mats.top : upperArmMat} />
      <mesh geometry={capsule(uArmR, 0.3)} material={sleeves === 'short' ? mats.skin : upperArmMat} position={[0, -0.14, 0]} castShadow />
      {sleeves === 'short' && <mesh geometry={capsule(uArmR * 1.25, 0.16)} material={mats.top} position={[0, -0.05, 0]} />}
      <group ref={elRef} position={[0, -0.28, 0]}>
        <mesh
          geometry={capsule(fArmR, 0.27)}
          material={sleeves === 'long' ? sleeveMat : mats.skin}
          position={[0, -0.12, 0]}
          castShadow
        />
        {sleeves === 'three' && <mesh geometry={capsule(fArmR * 1.18, 0.12)} material={mats.top} position={[0, -0.04, 0]} />}
        {cfg.top === 'blazer' && <mesh geometry={capsule(fArmR * 1.12, 0.25)} material={mats.top} position={[0, -0.1, 0]} />}
        {sleeves === 'long' && cfg.top !== 'sweater' && (
          <mesh geometry={cached('cufft', () => new THREE.CylinderGeometry(0.046, 0.046, 0.03, 16))} material={mats.accent} position={[0, -0.235, 0]} />
        )}
        <mesh geometry={sphere(0.042)} material={mats.skin} position={[0, -0.29, 0.005]} scale={[0.75, 1.2, 0.55]} />
        {side === 1 && cfg.accessories.includes('watch') && (
          <mesh geometry={cached('watch', () => new THREE.TorusGeometry(0.043, 0.008, 8, 20))} material={mats.gold} position={[0, -0.22, 0]} rotation={[Math.PI / 2, 0, 0]} />
        )}
      </group>
    </group>
  );

  return (
    <group ref={root}>
      {shadow && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} material={mats.shadowMat} renderOrder={-1}>
          <circleGeometry args={[0.42, 24]} />
        </mesh>
      )}
      <group scale={cfg.height}>
        <group ref={spinG}>
          <group ref={hips}>
            {/* pelvis / lower torso */}
            <mesh geometry={lathe(prof.pts, 1.0, -Infinity, 0.08)} material={isDress ? mats.top : mats.bottom} scale={[1, 1, 0.74]} castShadow />
            {cfg.bottom !== 'skirt' && cfg.bottom !== 'long-skirt' && !isDress && (
              <mesh geometry={cached('belt', () => new THREE.TorusGeometry(1, 0.06, 6, 36))} material={mats.dark} position={[0, 0.055, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.158 * prof.hipsW, 0.158 * 0.74 * prof.hipsW, 0.12]} />
            )}
            {skirtLike && (
              <mesh
                geometry={cached(`skirt${skirtLong}${prof.hipsW}`, () =>
                  new THREE.LatheGeometry(
                    (skirtLong
                      ? [[0.165, 0.1], [0.195, -0.03], [0.25, -0.3], [0.31, -0.62], [0.345, -0.8]]
                      : [[0.165, 0.1], [0.195, -0.03], [0.245, -0.24], [0.285, -0.42]]
                    ).map(([r, y]) => new THREE.Vector2(r * prof.hipsW, y)),
                    36,
                  ),
                )}
                material={skirtMat}
                scale={[1.0, 1, 0.9]}
                castShadow
              />
            )}

            {legs(1, lHip, lKnee)}
            {legs(-1, rHip, rKnee)}

            <group ref={spine} position={[0, 0.02, 0]}>
              {/* upper torso */}
              <mesh geometry={lathe(prof.pts, 1.0, 0.0, Infinity)} material={torsoUpperMat} scale={[1, 1, 0.72]} castShadow />
              {(cfg.top === 'waistcoat' || cfg.top === 'blazer') && (
                <mesh
                  geometry={lathe(prof.pts, 1.04, cfg.top === 'blazer' ? -0.06 : 0.02, 0.47, 0.42, TAU - 0.84)}
                  material={mats.top}
                  scale={[1, 1, 0.74]}
                  castShadow
                />
              )}
              {cfg.top === 'waistcoat' &&
                [0.08, 0.16, 0.24].map((y) => (
                  <mesh key={y} geometry={sphere(0.009, 8, 6)} material={mats.gold} position={[0.03, y, 0.118]} />
                ))}
              {jacket && (
                <>
                  <mesh geometry={cached('jcollar', () => new THREE.TorusGeometry(0.068, 0.024, 8, 24))} material={mats.top} position={[0, 0.5, 0.0]} rotation={[Math.PI / 2 - 0.2, 0, 0]} />
                  <mesh geometry={cached('zip', () => new THREE.BoxGeometry(0.008, 0.42, 0.006))} material={mats.gold} position={[0, 0.26, 0.122]} rotation={[-0.08, 0, 0]} />
                  <mesh geometry={lathe(prof.pts, 1.035, -0.05, 0.12)} material={mats.top} scale={[1, 1, 0.75]} />
                </>
              )}
              {(cfg.top === 'shirt' || cfg.top === 'waistcoat' || cfg.top === 'blazer') && (
                <mesh geometry={cached('collar', () => new THREE.TorusGeometry(0.06, 0.016, 8, 24))} material={mats.accent} position={[0, 0.5, 0.01]} rotation={[Math.PI / 2 - 0.25, 0, 0]} />
              )}
              {cfg.top === 'sweater' && (
                <mesh geometry={cached('swcollar', () => new THREE.TorusGeometry(0.058, 0.02, 8, 24))} material={mats.top} position={[0, 0.505, 0]} rotation={[Math.PI / 2, 0, 0]} />
              )}
              {cfg.accessories.includes('bowtie') && (
                <group position={[0, 0.49, 0.072]}>
                  <mesh geometry={cached('bow', () => new THREE.ConeGeometry(0.022, 0.04, 4))} material={mats.dark} position={[0.02, 0, 0]} rotation={[0, 0, Math.PI / 2]} />
                  <mesh geometry={cached('bow', () => new THREE.ConeGeometry(0.022, 0.04, 4))} material={mats.dark} position={[-0.02, 0, 0]} rotation={[0, 0, -Math.PI / 2]} />
                  <mesh geometry={sphere(0.009, 8, 6)} material={mats.dark} />
                </group>
              )}

              {arm(1, lSh, lEl)}
              {arm(-1, rSh, rEl)}

              {/* neck + head */}
              <mesh geometry={cached('neck', () => new THREE.CylinderGeometry(0.042, 0.048, 0.12, 16))} material={mats.skin} position={[0, 0.56, 0]} />
              {cfg.accessories.includes('necklace') && (
                <group position={[0, 0.525, 0]}>
                  <mesh geometry={cached('neckl', () => new THREE.TorusGeometry(0.062, 0.0035, 6, 32))} material={mats.gold} rotation={[Math.PI / 2 - 0.35, 0, 0]} />
                  <mesh geometry={sphere(0.011, 10, 8)} material={mats.rose} position={[0, -0.03, 0.062]} />
                </group>
              )}
              <group ref={head} position={[0, 0.6, 0]}>
                <group position={[0, 0.1, 0]}>
                  {/* skull + jaw */}
                  <mesh geometry={sphere(R, 32, 24)} material={mats.skin} scale={fs.c} castShadow />
                  <mesh geometry={sphere(R * 0.88, 28, 20)} material={mats.skin} position={[0, fs.jy, 0.012]} scale={fs.j} />
                  {/* ears */}
                  {[1, -1].map((s) => (
                    <mesh key={s} geometry={sphere(0.026, 12, 10)} material={mats.skin} position={[s * R * fs.c[0] * 0.97, -0.005, -0.005]} scale={[0.45, 1, 0.8]} />
                  ))}
                  {cfg.accessories.includes('earrings') &&
                    [1, -1].map((s) => (
                      <mesh key={s} geometry={sphere(0.008, 8, 6)} material={mats.gold} position={[s * R * fs.c[0] * 0.98, -0.034, 0]} />
                    ))}
                  {/* eyes */}
                  <group ref={eyesRef} position={[0, eyeY, 0]}>
                    {[1, -1].map((s) => (
                      <group key={s} position={[s * eyeX, 0, faceZ(eyeX, eyeY) - 0.006]} rotation={[0, s * 0.3, cfg.eyes === 'almond' ? s * 0.07 : 0]}>
                        <mesh geometry={sphere(0.019, 16, 12)} material={mats.white} scale={[1.1, eyeScaleY, 0.45]} />
                        <mesh geometry={sphere(0.012, 16, 12)} material={mats.iris} position={[0, 0, 0.007]} scale={[1, Math.min(1, eyeScaleY + 0.2), 0.4]} />
                        <mesh geometry={sphere(0.0062, 10, 8)} material={mats.dark} position={[0, 0, 0.0115]} scale={[1, 1, 0.4]} />
                        <mesh geometry={sphere(0.0028, 8, 6)} material={mats.white} position={[0.004, 0.004, 0.0135]} />
                        {f && <mesh geometry={cached('lash', () => new THREE.BoxGeometry(0.04, 0.0026, 0.005))} material={mats.dark} position={[s * 0.003, 0.0205 * eyeScaleY, 0.003]} rotation={[0, 0, s * 0.12]} />}
                        {cfg.eyes === 'gentle' && (
                          <mesh geometry={cached('lid', () => new THREE.SphereGeometry(0.0205, 16, 8, 0, TAU, 0, Math.PI / 2))} material={mats.skin} scale={[1.1, 0.7, 0.5]} position={[0, 0.0015, 0.001]} />
                        )}
                      </group>
                    ))}
                  </group>
                  {/* brows */}
                  {[1, -1].map((s) => (
                    <mesh
                      key={s}
                      geometry={cached(`brow${browW}`, () => new THREE.BoxGeometry(0.038, browW, 0.008))}
                      material={mats.brow}
                      position={[s * 0.043, 0.05, faceZ(0.043, 0.05) + 0.001]}
                      rotation={[-0.3, s * 0.3, cfg.brows === 'arched' ? s * -0.2 : cfg.brows === 'bold' ? s * -0.05 : s * -0.12]}
                    />
                  ))}
                  {/* nose */}
                  <mesh
                    geometry={sphere(0.017, 12, 10)}
                    material={mats.skin}
                    position={[0, cfg.nose === 'straight' ? -0.018 : -0.024, faceZ(0, -0.024) + (cfg.nose === 'straight' ? 0.007 : 0.004)]}
                    scale={cfg.nose === 'wide' ? [1.25, 0.9, 0.9] : cfg.nose === 'straight' ? [0.62, 1.55, 1.05] : [0.8, 1.05, 0.9]}
                  />
                  {/* mouth */}
                  <mesh
                    geometry={cached('mouth', () => new THREE.TorusGeometry(0.019, 0.0048, 8, 16, Math.PI))}
                    material={mats.lip}
                    position={[0, -0.05, faceZ(0, -0.05) * fs.j[2] * 1.02 + 0.006]}
                    rotation={[0.1, 0, Math.PI]}
                    scale={cfg.mouth === 'grin' ? [1.35, 1.15, 1] : cfg.mouth === 'soft' ? [0.8, 0.45, 1] : [1.05, 0.85, 1]}
                  />
                  {cfg.mouth === 'grin' && (
                    <mesh geometry={cached('teeth', () => new THREE.CircleGeometry(0.02, 16, Math.PI, Math.PI))} material={mats.white} position={[0, -0.049, faceZ(0, -0.05) * fs.j[2] * 1.02 + 0.005]} scale={[1.2, 0.55, 1]} />
                  )}
                  {cfg.blush &&
                    [1, -1].map((s) => (
                      <mesh key={s} position={[s * 0.062, -0.026, faceZ(0.062, -0.026) + 0.003]} rotation={[0, s * 0.55, 0]} material={mats.blush}>
                        <circleGeometry args={[0.017, 16]} />
                      </mesh>
                    ))}
                  {/* facial hair */}
                  {cfg.facialHair === 'stubble' && (
                    <mesh geometry={sphere(R * 0.9, 28, 20)} material={mats.stubble} position={[0, fs.jy - 0.004, 0.014]} scale={fs.j} />
                  )}
                  {cfg.facialHair === 'beard' && (
                    <mesh
                      geometry={cached('beard', () => new THREE.SphereGeometry(R * 0.92, 28, 16, Math.PI * 0.05, Math.PI * 0.9, Math.PI * 0.42, Math.PI * 0.45))}
                      material={mats.hair}
                      position={[0, fs.jy - 0.004, 0.016]}
                      scale={[fs.j[0], fs.j[1] * 1.05, fs.j[2]]}
                    />
                  )}
                  {(cfg.facialHair === 'mustache' || cfg.facialHair === 'beard') && (
                    <mesh geometry={capsule(0.007, 0.05)} material={mats.hair} position={[0, -0.036, faceZ(0, -0.036) + 0.004]} rotation={[0, 0, Math.PI / 2]} />
                  )}
                  {/* hair */}
                  <Hair style={cfg.hair} R={R} scale={fs.c} mat={mats.hair} />
                  {/* accessories on head */}
                  {(cfg.accessories.includes('glasses') || cfg.accessories.includes('sunglasses')) && (
                    <group position={[0, eyeY, faceZ(0, 0) + 0.008]}>
                      {[1, -1].map((s) => (
                        <group key={s} position={[s * eyeX, 0, -0.004]}>
                          <mesh geometry={cached('rim', () => new THREE.TorusGeometry(0.024, 0.0032, 8, 24))} material={mats.dark} />
                          {cfg.accessories.includes('sunglasses') && (
                            <mesh material={mats.lens}>
                              <circleGeometry args={[0.024, 20]} />
                            </mesh>
                          )}
                          <mesh geometry={cached('arm', () => new THREE.BoxGeometry(0.004, 0.004, 0.1))} material={mats.dark} position={[s * 0.026, 0.004, -0.05]} />
                        </group>
                      ))}
                      <mesh geometry={cached('bridge', () => new THREE.BoxGeometry(0.035, 0.004, 0.004))} material={mats.dark} position={[0, 0.006, 0]} />
                    </group>
                  )}
                  {cfg.accessories.includes('hat') && (
                    <group position={[0, R * fs.c[1] * 0.72, -0.01]} rotation={[-0.12, 0, 0]}>
                      <mesh geometry={cached('brim', () => new THREE.CylinderGeometry(0.21, 0.21, 0.012, 32))} material={mats.top} />
                      <mesh geometry={cached('crown', () => new THREE.CylinderGeometry(0.105, 0.125, 0.11, 32))} material={mats.top} position={[0, 0.055, 0]} />
                      <mesh geometry={cached('band', () => new THREE.CylinderGeometry(0.127, 0.127, 0.022, 32))} material={mats.accent} position={[0, 0.018, 0]} />
                    </group>
                  )}
                  {cfg.accessories.includes('flower') && (
                    <group position={[R * 0.82, 0.06, 0.03]}>
                      {[0, 1, 2, 3, 4].map((i) => (
                        <mesh key={i} geometry={sphere(0.014, 10, 8)} material={mats.rose} position={[Math.cos((i / 5) * TAU) * 0.014, Math.sin((i / 5) * TAU) * 0.014, 0]} />
                      ))}
                      <mesh geometry={sphere(0.01, 8, 6)} material={mats.gold} position={[0, 0, 0.008]} />
                    </group>
                  )}
                </group>
              </group>
            </group>
          </group>
        </group>
        {children}
      </group>
    </group>
  );
}

function Shoe({ style, mats }: { style: AvatarConfig['shoes']; mats: Record<string, THREE.Material> }) {
  const heel = style === 'heels';
  return (
    <group position={[0, -0.415, 0]}>
      <mesh
        geometry={sphere(0.06, 20, 14)}
        material={mats.shoe}
        position={[0, heel ? 0.0 : -0.005, heel ? 0.045 : 0.04]}
        scale={heel ? [0.9, 0.55, 1.75] : [1.12, 0.8, 2.05]}
        rotation={[heel ? 0.25 : 0, 0, 0]}
        castShadow
      />
      {!heel && (
        <mesh geometry={cached('sole', () => new THREE.BoxGeometry(0.12, 0.022, 0.25))} material={mats.sole} position={[0, -0.045, 0.035]} />
      )}
      {heel && <mesh geometry={cached('heel', () => new THREE.CylinderGeometry(0.012, 0.008, 0.07, 10))} material={mats.shoe} position={[0, -0.03, -0.035]} />}
      {style === 'boots' && <mesh geometry={cached('boot', () => new THREE.CylinderGeometry(0.068, 0.064, 0.16, 18))} material={mats.shoe} position={[0, 0.06, 0]} />}
      {style === 'loafers' && <mesh geometry={cached('loafer', () => new THREE.BoxGeometry(0.06, 0.012, 0.02))} material={mats.gold} position={[0, 0.03, 0.1]} />}
    </group>
  );
}

const CURLS = Array.from({ length: 34 }, (_, i) => {
  const phi = Math.acos(1 - (i + 0.5) / 34 * 1.15);
  const theta = i * 2.39996;
  return [Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)] as const;
});

function Hair({ style, R, scale, mat }: { style: AvatarConfig['hair']; R: number; scale: [number, number, number]; mat: THREE.Material }) {
  if (style === 'bald') return null;
  const Rh = R * (style === 'buzz' ? 1.03 : 1.09);
  const cap = cached(`hcap${Rh}`, () => new THREE.SphereGeometry(Rh, 36, 18, 0, TAU, 0, Math.PI * 0.52));
  const backShell = (len: number) =>
    cached(`hback${Rh}:${len}`, () => new THREE.SphereGeometry(Rh * 1.03, 36, 18, Math.PI / 2 + 0.95, TAU - 1.9, Math.PI * 0.3, len));
  return (
    <group scale={scale}>
      <mesh geometry={cap} material={mat} rotation={[-0.32, 0, 0]} position={[0, 0.004, -0.004]} castShadow />
      {(style === 'short' || style === 'curly') && (
        <mesh geometry={sphere(Rh * 0.55, 20, 12)} material={mat} position={[0.01, 0.075, 0.07]} scale={[1.5, 0.45, 0.9]} rotation={[0.3, 0, 0.1]} />
      )}
      {style === 'side-part' && (
        <>
          <mesh geometry={sphere(Rh * 0.6, 20, 12)} material={mat} position={[0.03, 0.085, 0.06]} scale={[1.45, 0.5, 1]} rotation={[0.35, 0, -0.25]} />
          <mesh geometry={sphere(Rh * 0.5, 16, 10)} material={mat} position={[-0.07, 0.06, 0.04]} scale={[0.6, 0.7, 1.1]} />
        </>
      )}
      {style === 'curly' &&
        CURLS.map((p, i) => (
          <mesh key={i} geometry={sphere(R * 0.24, 10, 8)} material={mat} position={[p[0] * Rh * 1.02, p[1] * Rh * 1.02 - 0.005, p[2] * Rh * 1.02 - 0.012]} />
        ))}
      {(style === 'long' || style === 'wavy' || style === 'straight') && (
        <>
          <mesh geometry={backShell(Math.PI * 0.45)} material={mat} />
          <mesh geometry={sphere(Rh, 24, 16)} material={mat} position={[0, -0.13, -0.05]} scale={[1.02, 1.6, 0.45]} castShadow />
          {[1, -1].map((s) => (
            <mesh key={s} geometry={capsule(0.03, 0.24)} material={mat} position={[s * 0.1, -0.1, 0.0]} rotation={[0.12, 0, s * 0.08]} />
          ))}
          <mesh geometry={sphere(Rh * 0.55, 20, 12)} material={mat} position={[-0.03, 0.08, 0.07]} scale={[1.6, 0.42, 0.9]} rotation={[0.35, 0, 0.25]} />
          {style === 'wavy' &&
            [-0.08, -0.16, -0.24].map((y, i) => (
              <mesh key={y} geometry={sphere(0.05, 12, 10)} material={mat} position={[(i % 2 ? 1 : -1) * 0.07, y, -0.08]} />
            ))}
        </>
      )}
      {style === 'bob' && (
        <>
          <mesh geometry={backShell(Math.PI * 0.32)} material={mat} scale={[1.06, 1, 1.04]} />
          <mesh geometry={sphere(Rh * 0.55, 20, 12)} material={mat} position={[0, 0.08, 0.075]} scale={[1.7, 0.4, 0.8]} rotation={[0.4, 0, 0]} />
        </>
      )}
      {style === 'bun' && (
        <>
          <mesh geometry={sphere(0.06, 20, 14)} material={mat} position={[0, 0.1, -0.08]} />
          <mesh geometry={sphere(Rh * 0.5, 16, 10)} material={mat} position={[0.02, 0.08, 0.07]} scale={[1.6, 0.4, 0.8]} rotation={[0.35, 0, -0.2]} />
        </>
      )}
      {style === 'ponytail' && (
        <>
          <mesh geometry={sphere(0.045, 16, 12)} material={mat} position={[0, 0.03, -0.12]} />
          <mesh geometry={capsule(0.04, 0.28)} material={mat} position={[0, -0.09, -0.15]} rotation={[0.25, 0, 0]} castShadow />
          <mesh geometry={sphere(Rh * 0.5, 16, 10)} material={mat} position={[0.02, 0.08, 0.07]} scale={[1.6, 0.4, 0.8]} rotation={[0.35, 0, -0.2]} />
        </>
      )}
    </group>
  );
}
