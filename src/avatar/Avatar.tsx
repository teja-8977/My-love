import { useEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { AvatarConfig } from './config';
import { dampPose, makePose, targetPose, type AnimName, type Pose } from './poses';

/**
 * Stylised "chibi" character (big head, big glossy eyes, soft rounded body) built from
 * primitives and animated procedurally. No model files, so it loads instantly everywhere.
 */

export const HIP_HEIGHT = 0.6;
/** height of the name tag above the floor (head top ≈ 1.5 m at height 1.0) */
export const LABEL_HEIGHT = 1.68;
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

// ---------- shared geometry ----------
const geoCache = new Map<string, THREE.BufferGeometry>();
function cached<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geoCache.get(key) as T | undefined;
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g;
}
const capsule = (r: number, len: number) => cached(`cap${r.toFixed(4)}:${len}`, () => new THREE.CapsuleGeometry(r, Math.max(0.001, len - 2 * r), 6, 14));
const sphere = (r: number, w = 20, h = 14) => cached(`sph${r.toFixed(4)}:${w}:${h}`, () => new THREE.SphereGeometry(r, w, h));
const arc = (r: number, tube: number, a: number) => cached(`arc${r}:${tube}:${a}`, () => new THREE.TorusGeometry(r, tube, 6, 18, a));

function lathe(points: [number, number][], from = -Infinity, to = Infinity, phiStart = 0, phiLength = TAU, grow = 1) {
  const key = `lathe:${points.map((p) => p.join(',')).join(';')}:${from}:${to}:${phiStart}:${phiLength}:${grow}`;
  return cached(key, () => {
    const pts = points.filter(([, y]) => y >= from - 1e-6 && y <= to + 1e-6).map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r * grow), y));
    if (from > -Infinity) pts.unshift(new THREE.Vector2(0.0001, pts[0].y));
    if (to < Infinity) pts.push(new THREE.Vector2(0.0001, pts[pts.length - 1].y));
    return new THREE.LatheGeometry(pts, 32, phiStart, phiLength);
  });
}

let shadowTex: THREE.Texture | null = null;
function blobShadowTexture() {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(0,0,0,0.5)');
  g.addColorStop(0.6, 'rgba(0,0,0,0.22)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  shadowTex = new THREE.CanvasTexture(c);
  return shadowTex;
}
let shadowMat: THREE.MeshBasicMaterial | null = null;
const getShadowMat = () => (shadowMat ??= new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false }));

// ---------- proportions ----------
function bodyOf(cfg: AvatarConfig) {
  const f = cfg.gender === 'female';
  const b = cfg.build;
  const chest = b === 'slim' ? 0.93 : b === 'athletic' ? 1.08 : b === 'curvy' ? 1.03 : 1;
  const waist = b === 'slim' ? 0.92 : b === 'athletic' ? 0.98 : 1;
  const hips = b === 'slim' ? 0.93 : b === 'athletic' ? 0.98 : b === 'curvy' ? 1.12 : 1;
  const pts: [number, number][] = f
    ? [
        [0.0, -0.085], [0.1 * hips, -0.08], [0.128 * hips, -0.035], [0.132 * hips, 0.03], [0.124 * waist, 0.11], [0.12 * waist, 0.17],
        [0.128 * chest, 0.235], [0.126 * chest, 0.29], [0.108, 0.335], [0.07, 0.365], [0.045, 0.378], [0.0, 0.38],
      ]
    : [
        [0.0, -0.085], [0.105 * hips, -0.08], [0.132 * hips, -0.035], [0.138 * hips, 0.03], [0.14 * waist, 0.11], [0.145 * waist, 0.17],
        [0.153 * chest, 0.235], [0.15 * chest, 0.29], [0.124 * chest, 0.335], [0.076, 0.365], [0.048, 0.378], [0.0, 0.38],
      ];
  const chestR = (f ? 0.128 : 0.153) * chest;
  return {
    pts,
    shoulderX: chestR + 0.03,
    limb: b === 'athletic' ? 1.1 : b === 'curvy' ? 1.06 : b === 'slim' ? 0.93 : 1,
    hipsW: hips,
  };
}

/** cranium (c) and cheek/jaw (j) ellipsoid scales per face shape */
const FACE: Record<AvatarConfig['faceShape'], { c: [number, number, number]; j: [number, number, number]; jy: number }> = {
  round: { c: [1.04, 1.0, 1.0], j: [0.98, 0.84, 0.97], jy: -0.05 },
  oval: { c: [1.0, 1.04, 1.0], j: [0.88, 0.88, 0.94], jy: -0.056 },
  heart: { c: [1.06, 1.03, 1.0], j: [0.8, 0.9, 0.92], jy: -0.06 },
  square: { c: [1.03, 1.0, 0.99], j: [1.02, 0.8, 0.95], jy: -0.06 },
  long: { c: [0.96, 1.1, 0.98], j: [0.86, 0.97, 0.93], jy: -0.07 },
};

const R = 0.2; // head radius (before HEAD_SCALE)
/** chibi proportions: the whole head (with hair and hats) is drawn bigger than the body */
const HEAD_SCALE = 1.2;
const JAW_C = 0.012; // jaw ellipsoid z offset

/** Surface depth of the face at (x, y): the max of the cranium and cheek ellipsoids. */
function surfZ(fs: (typeof FACE)['round'], x: number, y: number) {
  const a = 1 - (x / (R * fs.c[0])) ** 2 - (y / (R * fs.c[1])) ** 2;
  const z1 = a > 0 ? R * fs.c[2] * Math.sqrt(a) : 0;
  const rj = R * 0.86;
  const b = 1 - (x / (rj * fs.j[0])) ** 2 - ((y - fs.jy) / (rj * fs.j[1])) ** 2;
  const z2 = b > 0 ? JAW_C + rj * fs.j[2] * Math.sqrt(b) : 0;
  return Math.max(z1, z2);
}

export function Avatar(props: Props) {
  return <ChibiAvatar {...props} />;
}

type Mats = ReturnType<typeof makeMats>;
function makeMats(cfg: AvatarConfig) {
  const m = (color: string, rough = 0.75, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
  const skinC = new THREE.Color(cfg.skin);
  const skin = new THREE.MeshStandardMaterial({ color: skinC, roughness: 0.58, emissive: skinC.clone().multiplyScalar(0.12) });
  const hairC = new THREE.Color(cfg.hairColor);
  const hair = new THREE.MeshStandardMaterial({ color: hairC, roughness: 0.5, emissive: hairC.clone().multiplyScalar(0.06), side: THREE.DoubleSide });
  const top = m(cfg.topColor, 0.85);
  top.side = THREE.DoubleSide;
  const accent = m(cfg.accentColor, 0.85);
  accent.side = THREE.DoubleSide;
  const bottom = m(cfg.bottomColor, cfg.bottom === 'jeans' ? 0.92 : 0.8);
  bottom.side = THREE.DoubleSide;
  const cuff = m(new THREE.Color(cfg.bottomColor).lerp(new THREE.Color('#ffffff'), 0.25).getStyle(), 0.9);
  const shoe = m(cfg.shoeColor, cfg.shoes === 'oxford' || cfg.shoes === 'heels' || cfg.shoes === 'loafers' ? 0.3 : 0.75, 0.02);
  const sole = m(cfg.shoes === 'canvas' || cfg.shoes === 'sneakers' ? '#f6f3ee' : '#2f221b', 0.8);
  const white = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.15 });
  const iris = new THREE.MeshStandardMaterial({ color: cfg.eyeColor, roughness: 0.12, emissive: new THREE.Color(cfg.eyeColor).multiplyScalar(0.25) });
  const pupil = new THREE.MeshStandardMaterial({ color: '#0d0807', roughness: 0.1 });
  const shine = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const line = m(new THREE.Color(cfg.hairColor).multiplyScalar(0.45).getStyle(), 0.6);
  const lash = m('#1a0f0c', 0.5);
  const lip = m(cfg.lipColor, 0.45);
  const mouthIn = m('#7a2633', 0.6);
  const gold = m('#d8b465', 0.25, 0.9);
  const brow = m(hairC.clone().multiplyScalar(0.75).getStyle(), 0.8);
  const blush = new THREE.MeshBasicMaterial({ color: '#ff7f8f', transparent: true, opacity: 0.3, depthWrite: false });
  const stubble = new THREE.MeshStandardMaterial({ color: cfg.hairColor, transparent: true, opacity: 0.3, roughness: 1, depthWrite: false });
  const lens = new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.85 });
  const rose = m('#d23a5a', 0.55);
  return { skin, hair, top, accent, bottom, cuff, shoe, sole, white, iris, pupil, shine, line, lash, lip, mouthIn, gold, brow, blush, stubble, lens, rose };
}

function ChibiAvatar({ config: cfg, state, anim = 'idle', dance = 0, shadow = true, children }: Props) {
  const f = cfg.gender === 'female';
  const body = useMemo(() => bodyOf(cfg), [cfg]);
  const mats = useMemo(() => makeMats(cfg), [cfg]);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  // joints
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
  const eyesRef = useRef<THREE.Group>(null!);

  const pose = useRef<Pose>(makePose());
  const target = useRef<Pose>(makePose());
  const clock = useRef(Math.random() * 10);
  const blinkT = useRef(2 + Math.random() * 3);
  const fallback = useRef<AnimState>({ anim, dance, speed: 1 });
  fallback.current.anim = anim;
  fallback.current.dance = dance;

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    clock.current += dt;
    const st = state?.current ?? fallback.current;
    targetPose(target.current, st.anim, clock.current, { dance: st.dance, speed: st.speed, hipHeight: HIP_HEIGHT });
    const p = pose.current;
    dampPose(p, target.current, 1 - Math.exp(-dt * (st.anim === 'jump' ? 14 : 11)));

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
        e.scale.y = Math.max(0.06, e.scale.y - dt * 32);
        if (blinkT.current < -0.11) blinkT.current = 2.2 + Math.random() * 3.5;
      } else e.scale.y = Math.min(1, e.scale.y + dt * 22);
    }
  });

  // ---------- clothing logic ----------
  const t = cfg.top;
  const isDress = t === 'dress';
  const kurta = t === 'kurta';
  const sleeves: 'short' | 'long' | 'three' = t === 'tshirt' || t === 'dress' ? 'short' : t === 'blouse' || t === 'overshirt' ? 'three' : 'long';
  const vest = t === 'waistcoat';
  const torsoMat = vest || t === 'blazer' || t === 'overshirt' ? mats.accent : mats.top;
  const armMat = vest ? mats.accent : mats.top;
  const skirtLike = isDress || cfg.bottom === 'skirt' || cfg.bottom === 'long-skirt';
  const skirtLong = cfg.bottom === 'long-skirt' && !isDress;
  const thighMat = skirtLike ? mats.skin : mats.bottom;
  const shinMat = skirtLike || cfg.bottom === 'shorts' ? mats.skin : mats.bottom;

  const ls = body.limb;
  const thighR = (f ? 0.06 : 0.064) * ls;
  const shinR = (f ? 0.05 : 0.053) * ls;
  const uArmR = (f ? 0.04 : 0.045) * ls;
  const fArmR = (f ? 0.036 : 0.04) * ls;
  const legX = (f ? 0.068 : 0.072) * body.hipsW;
  const fs = FACE[cfg.faceShape];
  const sz = (x: number, y: number) => surfZ(fs, x, y);

  const eyeX = 0.074;
  const eyeY = -0.03;
  const eyeSY = cfg.eyes === 'round' ? 1.14 : cfg.eyes === 'almond' ? 0.92 : 0.84;

  const legs = (side: 1 | -1, hipRef: typeof lHip, kneeRef: typeof lKnee) => (
    <group ref={hipRef} position={[side * legX, -0.03, 0]}>
      <mesh geometry={capsule(thighR, 0.3)} material={thighMat} position={[0, -0.13, 0]} />
      {cfg.bottom === 'shorts' && !skirtLike && <mesh geometry={capsule(thighR * 1.14, 0.19)} material={mats.bottom} position={[0, -0.07, 0]} />}
      <group ref={kneeRef} position={[0, -0.27, 0]}>
        <mesh geometry={capsule(shinR, 0.27)} material={shinMat} position={[0, -0.12, 0]} />
        {cfg.bottom === 'jeans' && !skirtLike && (
          <mesh geometry={cached(`cuff${shinR}`, () => new THREE.CylinderGeometry(shinR * 1.28, shinR * 1.32, 0.05, 16))} material={mats.cuff} position={[0, -0.215, 0]} />
        )}
        <Shoe style={cfg.shoes} mats={mats} />
      </group>
    </group>
  );

  const arm = (side: 1 | -1, shRef: typeof lSh, elRef: typeof lEl) => (
    <group ref={shRef} position={[side * body.shoulderX, 0.3, 0]}>
      <mesh geometry={sphere(uArmR * 1.06, 14, 10)} material={sleeves === 'short' ? mats.top : armMat} />
      <mesh geometry={capsule(uArmR, 0.2)} material={sleeves === 'short' ? mats.skin : armMat} position={[0, -0.085, 0]} />
      {sleeves === 'short' && <mesh geometry={capsule(uArmR * 1.32, 0.12)} material={mats.top} position={[0, -0.035, 0]} />}
      {t === 'overshirt' && <mesh geometry={capsule(uArmR * 1.18, 0.1)} material={mats.top} position={[0, -0.14, 0]} />}
      <group ref={elRef} position={[0, -0.17, 0]}>
        <mesh geometry={capsule(fArmR, 0.17)} material={sleeves === 'long' ? armMat : mats.skin} position={[0, -0.07, 0]} />
        {sleeves === 'three' && <mesh geometry={capsule(fArmR * 1.25, 0.08)} material={mats.top} position={[0, -0.01, 0]} />}
        {sleeves === 'long' && t !== 'sweater' && t !== 'hoodie' && (
          <mesh geometry={cached(`cufft${fArmR}`, () => new THREE.CylinderGeometry(fArmR * 1.2, fArmR * 1.2, 0.025, 14))} material={mats.accent} position={[0, -0.14, 0]} />
        )}
        <mesh geometry={sphere(0.042, 14, 10)} material={mats.skin} position={[0, -0.175, 0.004]} scale={[0.85, 1.0, 0.75]} />
        {side === 1 && cfg.accessories.includes('watch') && (
          <mesh geometry={cached('watch', () => new THREE.TorusGeometry(fArmR * 1.05, 0.007, 6, 16))} material={mats.gold} position={[0, -0.13, 0]} rotation={[Math.PI / 2, 0, 0]} />
        )}
      </group>
    </group>
  );

  const skirtPts = (skirtLong
    ? [[0.15, 0.08], [0.168, -0.03], [0.2, -0.2], [0.245, -0.4], [0.275, -0.53]]
    : [[0.15, 0.08], [0.168, -0.03], [0.205, -0.15], [0.235, -0.25]]) as [number, number][];
  const skirtGeo = lathe(skirtPts.map(([r, y]) => [r * body.hipsW, y]));
  const kurtaGeo = lathe(([[0.15, 0.1], [0.155, -0.04], [0.172, -0.18], [0.19, -0.3]] as [number, number][]).map(([r, y]) => [r * body.hipsW, y]));

  return (
    <group>
      {shadow && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} material={getShadowMat()} renderOrder={-1}>
          <circleGeometry args={[0.38, 20]} />
        </mesh>
      )}
      <group scale={cfg.height}>
        <group ref={spinG}>
          <group ref={hips}>
            {/* pelvis */}
            <mesh geometry={lathe(body.pts, -Infinity, 0.07)} material={isDress || kurta ? mats.top : mats.bottom} scale={[1, 1, 0.8]} />
            {!skirtLike && !kurta && t !== 'hoodie' && t !== 'sweater' && (
              <mesh geometry={cached('belt', () => new THREE.TorusGeometry(1, 0.07, 6, 30))} material={mats.line} position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.137 * body.hipsW, 0.137 * 0.8 * body.hipsW, 0.11]} />
            )}
            {skirtLike && <mesh geometry={skirtGeo} material={isDress ? mats.top : mats.bottom} scale={[1, 1, 0.88]} />}
            {kurta && <mesh geometry={kurtaGeo} material={mats.top} scale={[1, 1, 0.86]} />}

            {legs(1, lHip, lKnee)}
            {legs(-1, rHip, rKnee)}

            <group ref={spine} position={[0, 0.02, 0]}>
              {/* upper body */}
              <mesh geometry={lathe(body.pts, 0.0, Infinity)} material={torsoMat} scale={[1, 1, 0.8]} />
              {(vest || t === 'blazer' || t === 'overshirt') && (
                <mesh geometry={lathe(body.pts, vest ? 0.02 : -0.05, 0.345, 0.38, TAU - 0.76, 1.05)} material={mats.top} scale={[1, 1, 0.8]} />
              )}
              {vest && [0.08, 0.15, 0.22].map((y) => <mesh key={y} geometry={sphere(0.008, 8, 6)} material={mats.gold} position={[0.03, y, body.pts[5][0] * 0.82]} />)}
              {t === 'jacket' && (
                <>
                  <mesh geometry={cached('jcollar', () => new THREE.TorusGeometry(0.058, 0.02, 8, 22))} material={mats.top} position={[0, 0.37, 0]} rotation={[Math.PI / 2 - 0.2, 0, 0]} />
                  <mesh geometry={cached('zip', () => new THREE.BoxGeometry(0.007, 0.34, 0.006))} material={mats.gold} position={[0, 0.17, body.pts[5][0] * 0.81]} />
                </>
              )}
              {t === 'hoodie' && (
                <>
                  <mesh geometry={cached('hood', () => new THREE.TorusGeometry(0.075, 0.035, 8, 22))} material={mats.top} position={[0, 0.37, -0.03]} rotation={[Math.PI / 2 + 0.3, 0, 0]} />
                  <mesh geometry={cached('pocket', () => new THREE.BoxGeometry(0.16, 0.07, 0.02))} material={mats.top} position={[0, 0.08, body.pts[4][0] * 0.8 + 0.004]} />
                  {[1, -1].map((s) => <mesh key={s} geometry={capsule(0.005, 0.09)} material={mats.accent} position={[s * 0.025, 0.3, body.pts[7][0] * 0.82]} />)}
                </>
              )}
              {kurta && <mesh geometry={cached('placket', () => new THREE.BoxGeometry(0.03, 0.15, 0.01))} material={mats.accent} position={[0, 0.27, body.pts[7][0] * 0.81]} />}
              {(t === 'shirt' || vest || t === 'blazer' || t === 'overshirt' || kurta) && (
                <mesh geometry={cached('collar', () => new THREE.TorusGeometry(0.053, 0.014, 8, 22))} material={t === 'overshirt' ? mats.top : mats.accent} position={[0, 0.365, 0.008]} rotation={[Math.PI / 2 - 0.25, 0, 0]} />
              )}
              {(t === 'tshirt' || t === 'sweater' || isDress || t === 'blouse') && (
                <mesh geometry={cached('crew', () => new THREE.TorusGeometry(0.05, 0.011, 8, 22))} material={mats.top} position={[0, 0.372, 0]} rotation={[Math.PI / 2, 0, 0]} />
              )}
              {cfg.accessories.includes('bowtie') && (
                <group position={[0, 0.355, 0.065]}>
                  {[1, -1].map((s) => <mesh key={s} geometry={cached('bow', () => new THREE.ConeGeometry(0.02, 0.036, 4))} material={mats.rose} position={[s * 0.018, 0, 0]} rotation={[0, 0, s * Math.PI / 2]} />)}
                  <mesh geometry={sphere(0.008, 8, 6)} material={mats.rose} />
                </group>
              )}

              {arm(1, lSh, lEl)}
              {arm(-1, rSh, rEl)}

              {/* neck */}
              <mesh geometry={cached('neck', () => new THREE.CylinderGeometry(0.042, 0.046, 0.08, 14))} material={mats.skin} position={[0, 0.39, 0]} />
              {cfg.accessories.includes('necklace') && (
                <group position={[0, 0.37, 0]}>
                  <mesh geometry={cached('neckl', () => new THREE.TorusGeometry(0.052, 0.003, 6, 28))} material={mats.gold} rotation={[Math.PI / 2 - 0.4, 0, 0]} />
                  <mesh geometry={sphere(0.01, 10, 8)} material={mats.rose} position={[0, -0.022, 0.052]} />
                </group>
              )}

              {/* head */}
              <group ref={head} position={[0, 0.41, 0]} scale={HEAD_SCALE}>
                <group position={[0, R * 0.92, 0]}>
                  <mesh geometry={sphere(R, 32, 24)} material={mats.skin} scale={fs.c} />
                  <mesh geometry={sphere(R * 0.86, 28, 20)} material={mats.skin} position={[0, fs.jy, JAW_C]} scale={fs.j} />
                  {/* ears */}
                  {[1, -1].map((s) => (
                    <mesh key={s} geometry={sphere(0.034, 12, 10)} material={mats.skin} position={[s * R * fs.c[0] * 0.97, -0.025, -0.01]} scale={[0.5, 0.9, 0.7]} />
                  ))}
                  {cfg.accessories.includes('earrings') &&
                    [1, -1].map((s) => <mesh key={s} geometry={sphere(0.009, 8, 6)} material={mats.gold} position={[s * R * fs.c[0] * 0.99, -0.06, 0]} />)}

                  {/* big glossy eyes */}
                  <group ref={eyesRef} position={[0, eyeY, 0]}>
                    {[1, -1].map((s) => (
                      <group key={s} position={[s * eyeX, 0, sz(eyeX, eyeY) - 0.008]} rotation={[0, s * 0.34, cfg.eyes === 'almond' ? s * -0.08 : 0]}>
                        <mesh geometry={sphere(0.044, 20, 16)} material={mats.white} scale={[0.95, eyeSY, 0.5]} />
                        <mesh geometry={sphere(0.033, 20, 14)} material={mats.iris} position={[0, -0.002, 0.012]} scale={[1, eyeSY * 1.02, 0.38]} />
                        <mesh geometry={sphere(0.017, 14, 10)} material={mats.pupil} position={[0, -0.002, 0.0205]} scale={[1, eyeSY, 0.3]} />
                        <mesh geometry={sphere(0.0085, 10, 8)} material={mats.shine} position={[s * -0.011, 0.014 * eyeSY, 0.026]} />
                        <mesh geometry={sphere(0.0042, 8, 6)} material={mats.shine} position={[s * 0.01, -0.013 * eyeSY, 0.025]} />
                        {/* upper lid line + lashes */}
                        <mesh geometry={arc(0.043, f ? 0.0065 : 0.0045, Math.PI * 0.82)} material={mats.lash} position={[0, 0, 0.006]} rotation={[0, 0, Math.PI * 0.09]} scale={[1, eyeSY * 0.98, 1]} />
                        {f && (
                          <mesh geometry={cached('flick', () => new THREE.ConeGeometry(0.006, 0.022, 6))} material={mats.lash} position={[s * 0.043, 0.024 * eyeSY, 0.008]} rotation={[0, 0, s * -0.9]} />
                        )}
                        {cfg.eyes === 'gentle' && (
                          <mesh geometry={cached('lid', () => new THREE.SphereGeometry(0.046, 16, 8, 0, TAU, 0, Math.PI * 0.42))} material={mats.skin} scale={[0.97, eyeSY, 0.52]} position={[0, 0.002, 0.001]} />
                        )}
                      </group>
                    ))}
                  </group>
                  {/* brows */}
                  {[1, -1].map((s) => (
                    <group key={s} position={[s * 0.075, 0.047, sz(0.075, 0.047) + 0.002]} rotation={[-0.15, s * 0.34, s * 0.1]}>
                      <mesh
                        geometry={arc(0.036, cfg.brows === 'bold' ? 0.0075 : 0.005, Math.PI * (cfg.brows === 'arched' ? 0.6 : 0.45))}
                        material={mats.brow}
                        position={[0, -0.036, 0]}
                        rotation={[0, 0, Math.PI * (cfg.brows === 'arched' ? 0.2 : 0.275)]}
                      />
                    </group>
                  ))}
                  {/* nose */}
                  <mesh
                    geometry={sphere(0.016, 12, 10)}
                    material={mats.skin}
                    position={[0, -0.072, sz(0, -0.072) - 0.004]}
                    scale={cfg.nose === 'wide' ? [1.45, 0.85, 0.9] : cfg.nose === 'straight' ? [0.85, 1.25, 1.05] : [1.15, 0.85, 0.9]}
                  />
                  {/* mouth */}
                  <group position={[0, -0.112, sz(0, -0.112) + 0.001]} rotation={[0.5, 0, 0]}>
                    {cfg.mouth === 'grin' ? (
                      <>
                        <mesh geometry={cached('mopen', () => new THREE.CircleGeometry(0.026, 18, Math.PI, Math.PI))} material={mats.mouthIn} />
                        <mesh geometry={cached('teeth', () => new THREE.PlaneGeometry(0.036, 0.007))} material={mats.white} position={[0, -0.003, 0.001]} />
                        <mesh geometry={arc(0.026, 0.003, Math.PI)} material={mats.lip} rotation={[0, 0, Math.PI]} />
                      </>
                    ) : (
                      <mesh geometry={arc(0.022, 0.0042, Math.PI * 0.8)} material={mats.lip} rotation={[0, 0, Math.PI * 1.1]} scale={cfg.mouth === 'soft' ? [0.75, 0.45, 1] : [1, 0.7, 1]} />
                    )}
                  </group>
                  {cfg.blush &&
                    [1, -1].map((s) => (
                      <mesh key={s} position={[s * 0.112, -0.068, sz(0.112, -0.068) + 0.002]} rotation={[0, s * 0.62, 0]} material={mats.blush}>
                        <circleGeometry args={[0.028, 16]} />
                      </mesh>
                    ))}
                  {/* facial hair */}
                  {cfg.facialHair === 'stubble' && <mesh geometry={sphere(R * 0.88, 24, 16)} material={mats.stubble} position={[0, fs.jy - 0.005, JAW_C + 0.003]} scale={fs.j} />}
                  {cfg.facialHair === 'beard' && (
                    <mesh
                      geometry={cached('beard', () => new THREE.SphereGeometry(R * 0.88, 24, 14, Math.PI * 0.05, Math.PI * 0.9, Math.PI * 0.55, Math.PI * 0.4))}
                      material={mats.hair}
                      position={[0, fs.jy, JAW_C + 0.006]}
                      scale={fs.j}
                    />
                  )}
                  {(cfg.facialHair === 'mustache' || cfg.facialHair === 'beard') && (
                    <mesh geometry={capsule(0.0075, 0.05)} material={mats.hair} position={[0, -0.093, sz(0, -0.093)]} rotation={[0, 0, Math.PI / 2]} />
                  )}

                  <Hair style={cfg.hair} scale={fs.c} mat={mats.hair} />

                  {(cfg.accessories.includes('glasses') || cfg.accessories.includes('sunglasses')) && (
                    <group position={[0, eyeY, sz(0, eyeY) + 0.03]}>
                      {[1, -1].map((s) => (
                        <group key={s} position={[s * eyeX, 0, -0.006]} rotation={[0, s * 0.2, 0]}>
                          <mesh geometry={cached('rim', () => new THREE.TorusGeometry(0.05, 0.004, 8, 24))} material={mats.pupil} />
                          {cfg.accessories.includes('sunglasses') && (
                            <mesh material={mats.lens}>
                              <circleGeometry args={[0.05, 20]} />
                            </mesh>
                          )}
                          <mesh geometry={cached('garm', () => new THREE.BoxGeometry(0.004, 0.004, 0.16))} material={mats.pupil} position={[s * 0.06, 0.01, -0.08]} />
                        </group>
                      ))}
                      <mesh geometry={cached('bridge', () => new THREE.BoxGeometry(0.03, 0.005, 0.005))} material={mats.pupil} position={[0, 0.012, -0.004]} />
                    </group>
                  )}
                  {cfg.accessories.includes('hat') && (
                    <group position={[0, R * fs.c[1] * 0.78, -0.01]} rotation={[-0.15, 0, 0]}>
                      <mesh geometry={cached('brim', () => new THREE.CylinderGeometry(0.33, 0.33, 0.014, 32))} material={mats.top} />
                      <mesh geometry={cached('crown', () => new THREE.CylinderGeometry(0.17, 0.2, 0.13, 32))} material={mats.top} position={[0, 0.065, 0]} />
                      <mesh geometry={cached('band', () => new THREE.CylinderGeometry(0.202, 0.202, 0.026, 32))} material={mats.accent} position={[0, 0.02, 0]} />
                    </group>
                  )}
                  {cfg.accessories.includes('flower') && (
                    <group position={[R * 0.78, 0.1, 0.09]} rotation={[0, 0.7, 0]}>
                      {[0, 1, 2, 3, 4].map((i) => (
                        <mesh key={i} geometry={sphere(0.018, 10, 8)} material={mats.rose} position={[Math.cos((i / 5) * TAU) * 0.018, Math.sin((i / 5) * TAU) * 0.018, 0]} />
                      ))}
                      <mesh geometry={sphere(0.012, 8, 6)} material={mats.gold} position={[0, 0, 0.01]} />
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

// ---------- shoes (origin at the ankle, sole at y ≈ -0.035) ----------
function Shoe({ style, mats }: { style: AvatarConfig['shoes']; mats: Mats }) {
  if (style === 'chappals') {
    return (
      <group position={[0, -0.27, 0]}>
        <mesh geometry={sphere(0.052, 16, 12)} material={mats.skin} position={[0, -0.005, 0.03]} scale={[0.95, 0.55, 1.6]} />
        <mesh geometry={cached('chsole', () => new THREE.CylinderGeometry(0.06, 0.06, 0.014, 18))} material={mats.shoe} position={[0, -0.031, 0.03]} scale={[1, 1, 1.85]} />
        <mesh geometry={cached('chstrap', () => new THREE.TorusGeometry(0.048, 0.009, 6, 16, Math.PI))} material={mats.shoe} position={[0, -0.02, 0.06]} rotation={[0, 0, 0]} scale={[1, 0.7, 1]} />
      </group>
    );
  }
  const heel = style === 'heels';
  const sporty = style === 'canvas' || style === 'sneakers';
  return (
    <group position={[0, -0.27, 0]}>
      <mesh geometry={sphere(0.062, 18, 12)} material={mats.shoe} position={[0, heel ? 0.004 : 0, 0.03]} scale={heel ? [0.88, 0.55, 1.5] : [1.0, 0.62, 1.62]} rotation={[heel ? 0.15 : 0, 0, 0]} />
      {!heel && (
        <mesh geometry={sphere(0.064, 18, 8)} material={mats.sole} position={[0, -0.026, 0.03]} scale={[1.04, 0.24, 1.66]} />
      )}
      {sporty && <mesh geometry={sphere(0.03, 12, 8)} material={mats.sole} position={[0, -0.006, 0.112]} scale={[1.3, 0.75, 0.7]} />}
      {style === 'canvas' && (
        <>
          <mesh geometry={cached('hitop', () => new THREE.CylinderGeometry(0.06, 0.064, 0.09, 16))} material={mats.shoe} position={[0, 0.03, 0.004]} />
          {[0.02, 0.045, 0.07].map((z) => <mesh key={z} geometry={cached('lace', () => new THREE.BoxGeometry(0.05, 0.005, 0.008))} material={mats.sole} position={[0, 0.03 - z * 0.25, z + 0.02]} rotation={[-0.6, 0, 0]} />)}
        </>
      )}
      {style === 'sneakers' && <mesh geometry={cached('swoosh', () => new THREE.BoxGeometry(0.128, 0.012, 0.06))} material={mats.sole} position={[0, 0.005, 0.03]} />}
      {heel && (
        <>
          <mesh geometry={cached('heel', () => new THREE.CylinderGeometry(0.013, 0.009, 0.05, 10))} material={mats.shoe} position={[0, -0.02, -0.03]} />
          <mesh geometry={cached('mjstrap', () => new THREE.TorusGeometry(0.05, 0.006, 6, 16, Math.PI))} material={mats.shoe} position={[0, 0.01, 0.03]} />
        </>
      )}
      {style === 'boots' && <mesh geometry={cached('boot', () => new THREE.CylinderGeometry(0.064, 0.066, 0.15, 16))} material={mats.shoe} position={[0, 0.06, 0.004]} />}
      {style === 'loafers' && <mesh geometry={cached('loafer', () => new THREE.BoxGeometry(0.05, 0.01, 0.016))} material={mats.gold} position={[0, 0.03, 0.085]} />}
    </group>
  );
}

// ---------- hair ----------
const Rh = R * 1.075;

/** A lock of hair lying on the head: `a` = angle around the head (0 = front), `e` = elevation. */
function Lock({ a, e, len, w = 0.05, th = 0.026, mat, twist = 0, lift = 0 }: { a: number; e: number; len: number; w?: number; th?: number; mat: THREE.Material; twist?: number; lift?: number }) {
  return (
    <group rotation={[0, a, 0]}>
      {/* centred where the lock's middle lies, tangent to the head, sunk a little so its ends hug the surface */}
      <group rotation={[Math.PI / 2 - (e - (len * 0.55) / Rh), 0, 0]}>
        <mesh geometry={sphere(1, 14, 10)} material={mat} position={[0, Rh + th * 0.4 - ((len * len) / (2 * Rh)) * 0.75, 0]} rotation={[lift, 0, twist]} scale={[w, th, len]} />
      </group>
    </group>
  );
}

/** A tuft standing out of the head (spikes / messy top). */
function Tuft({ a, e, len, w = 0.04, mat, lean = 0 }: { a: number; e: number; len: number; w?: number; mat: THREE.Material; lean?: number }) {
  return (
    <group rotation={[0, a, 0]}>
      <group rotation={[Math.PI / 2 - e + lean, 0, 0]}>
        <mesh geometry={cached('tuft', () => new THREE.ConeGeometry(1, 1, 8))} material={mat} position={[0, Rh * 0.92 + len * 0.45, 0]} scale={[w, len, w * 0.8]} />
      </group>
    </group>
  );
}

const CURLS = Array.from({ length: 44 }, (_, i) => {
  const phi = Math.acos(1 - ((i + 0.5) / 44) * 1.25);
  const theta = i * 2.39996;
  return [Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)] as const;
});

/** straight bangs across the forehead */
const BANGS = [-0.72, -0.48, -0.24, 0, 0.24, 0.48, 0.72];

function Hair({ style, scale, mat }: { style: AvatarConfig['hair']; scale: [number, number, number]; mat: THREE.Material }) {
  if (style === 'bald') return null;
  const r = style === 'buzz' ? R * 1.03 : Rh;
  const cap = cached(`hcap${r}`, () => new THREE.SphereGeometry(r, 32, 16, 0, TAU, 0, Math.PI * 0.5));
  // back of the head, wrapping round to the sides (phi: x = -cos, z = sin → back is z<0)
  const shell = (from: number, to: number, wrap: number, rr = Rh * 1.01) =>
    cached(`hshell${from}:${to}:${wrap}:${rr}`, () => new THREE.SphereGeometry(rr, 32, 14, Math.PI - wrap, Math.PI + wrap * 2, Math.PI * from, Math.PI * (to - from)));
  const girlLong = style === 'long' || style === 'straight' || style === 'wavy';
  return (
    <group scale={scale}>
      <mesh geometry={cap} material={mat} rotation={[-0.36, 0, 0]} position={[0, 0.006, -0.006]} />
      {style !== 'buzz' && <mesh geometry={shell(0.4, girlLong ? 0.62 : 0.68, 0.25)} material={mat} />}

      {style === 'messy' && (
        <>
          {[[-0.55, 0.74, 0.075, 0.25], [-0.25, 0.82, 0.085, -0.1], [0.05, 0.78, 0.09, 0.2], [0.33, 0.82, 0.08, -0.25], [0.6, 0.72, 0.07, 0.15]].map(([a, e, l, tw], i) => (
            <Lock key={i} a={a} e={e} len={l} w={0.045} th={0.03} twist={tw} lift={-0.15} mat={mat} />
          ))}
          {[[0.2, 1.3, 0.09, 0.5], [-0.7, 1.15, 0.08, -0.4], [0.9, 1.1, 0.08, 0.5], [2.8, 1.25, 0.08, 0.2], [-2.3, 1.15, 0.08, -0.3], [1.9, 1.1, 0.08, 0.3]].map(([a, e, l, tw], i) => (
            <Lock key={i} a={a} e={e} len={l} w={0.05} th={0.034} twist={tw} lift={-0.35} mat={mat} />
          ))}
        </>
      )}
      {style === 'short' && (
        <>
          <Lock a={0.1} e={0.92} len={0.1} w={0.12} th={0.035} twist={0.35} mat={mat} />
        </>
      )}
      {style === 'side-part' && (
        <>
          <Lock a={0.25} e={1.05} len={0.12} w={0.14} th={0.04} twist={0.7} lift={-0.25} mat={mat} />
          <Lock a={-0.55} e={0.85} len={0.07} w={0.07} th={0.03} twist={-0.3} mat={mat} />
        </>
      )}
      {style === 'spiky' &&
        [[0, 0.75], [0.45, 0.8], [-0.45, 0.8], [0, 1.15], [0.9, 1.0], [-0.9, 1.0], [1.6, 0.9], [-1.6, 0.9], [2.4, 0.9], [-2.4, 0.9], [3.14, 1.0], [0, 1.5]].map(([a, e], i) => (
          <Tuft key={i} a={a} e={e} len={0.065} w={0.038} lean={0.5} mat={mat} />
        ))}
      {style === 'curly' &&
        CURLS.map((p, i) => <mesh key={i} geometry={sphere(R * 0.2, 10, 8)} material={mat} position={[p[0] * Rh * 1.02, p[1] * Rh * 1.02 - 0.012, p[2] * Rh * 1.02 - 0.012]} />)}

      {/* girls' styles: straight bangs (bob, long + bangs, bun, ponytail, pigtails) */}
      {(style === 'bob' || style === 'straight' || style === 'bun' || style === 'ponytail' || style === 'pigtails') &&
        BANGS.map((a, i) => <Lock key={a} a={a} e={1.0} len={0.115} w={0.055} th={0.028} twist={(i - 3) * 0.04} lift={0.22} mat={mat} />)}
      {(style === 'long' || style === 'wavy') && (
        <>
          <Lock a={0.3} e={1.05} len={0.11} w={0.085} th={0.028} twist={0.6} lift={-0.1} mat={mat} />
          <Lock a={-0.45} e={0.95} len={0.09} w={0.08} th={0.03} twist={-0.4} mat={mat} />
        </>
      )}
      {style === 'bob' && (
        <>
          <mesh geometry={shell(0.36, 0.76, 0.95, Rh * 1.05)} material={mat} scale={[1.07, 1, 1.04]} />
          {/* strands at the back so it reads as hair, not a helmet */}
          <group scale={[1.13, 1.0, 1.12]}>
            {[2.2, 2.6, 2.95, 3.33, 3.68, 4.08].map((a, i) => (
              <Lock key={a} a={a} e={0.55} len={0.15} w={0.07} th={0.03} twist={(i - 2.5) * 0.05} lift={0.12} mat={mat} />
            ))}
          </group>
        </>
      )}
      {girlLong && (
        <>
          <mesh geometry={shell(0.36, 0.7, 0.85, Rh * 1.04)} material={mat} scale={[1.05, 1, 1.02]} />
          <mesh geometry={sphere(Rh, 22, 14)} material={mat} position={[0, -0.17, -0.07]} scale={[1.02, 1.55, 0.42]} />
          {[1, -1].map((s) => (
            <mesh key={s} geometry={capsule(0.045, 0.3)} material={mat} position={[s * 0.17, -0.16, -0.01]} rotation={[0.1, 0, s * 0.08]} />
          ))}
          {style === 'wavy' &&
            [-0.12, -0.22, -0.32].map((y, i) => <mesh key={y} geometry={sphere(0.055, 12, 10)} material={mat} position={[(i % 2 ? 1 : -1) * 0.08, y, -0.12]} />)}
        </>
      )}
      {style === 'bun' && <mesh geometry={sphere(0.075, 18, 14)} material={mat} position={[0, Rh * 0.9, -0.08]} />}
      {style === 'ponytail' && (
        <>
          <mesh geometry={sphere(0.05, 14, 10)} material={mat} position={[0, 0.06, -Rh * 0.98]} />
          <mesh geometry={capsule(0.048, 0.3)} material={mat} position={[0, -0.08, -Rh * 1.05]} rotation={[0.2, 0, 0]} />
        </>
      )}
      {style === 'pigtails' &&
        [1, -1].map((s) => (
          <group key={s} position={[s * Rh * 0.92, 0.02, -0.04]}>
            <mesh geometry={sphere(0.045, 12, 10)} material={mat} />
            <mesh geometry={capsule(0.045, 0.24)} material={mat} position={[s * 0.04, -0.12, -0.01]} rotation={[0, 0, s * 0.25]} />
          </group>
        ))}
    </group>
  );
}
