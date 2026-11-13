import { useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { AvatarModelRef } from './config';
import { dampPose, makePose, targetPose, type AnimName, type Pose } from './poses';
import { modelUrl } from './modelStore';
import type { AnimState } from './Avatar';

/**
 * Personalised GLB avatar (e.g. from Avaturn) animated by the SAME procedural pose system as
 * the built-in characters. The pose is retargeted onto any humanoid skeleton that uses the
 * common bone names (Hips, Spine, Head, LeftArm, LeftForeArm, LeftUpLeg, LeftLeg, … —
 * with or without a "mixamorig" prefix), so idle / walk / run / jump / sit / wave / dances and
 * multiplayer animation sync work without any extra animation files.
 */

const loader = new GLTFLoader();
const cache = new Map<string, Promise<GLTF>>();
function loadGLB(key: string, url: string) {
  let p = cache.get(key);
  if (!p) {
    p = loader.loadAsync(url);
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

const BONE_NAMES = {
  hips: 'hips',
  spine: 'spine',
  head: 'head',
  lArm: 'leftarm',
  lFore: 'leftforearm',
  lHand: 'lefthand',
  rArm: 'rightarm',
  rFore: 'rightforearm',
  rHand: 'righthand',
  lUp: 'leftupleg',
  lLeg: 'leftleg',
  lFoot: 'leftfoot',
  rUp: 'rightupleg',
  rLeg: 'rightleg',
  rFoot: 'rightfoot',
} as const;
type BoneKey = keyof typeof BONE_NAMES;

const norm = (n: string) => n.toLowerCase().replace(/^mixamorig[:_]?/, '').replace(/[^a-z]/g, '');

interface Rig {
  root: THREE.Object3D;
  bones: Partial<Record<BoneKey, THREE.Bone>>;
  rest: Partial<Record<BoneKey, THREE.Quaternion>>; // rest rotation in rig space
  fix: Partial<Record<BoneKey, THREE.Quaternion>>; // rotates a limb's rest direction to "hanging down"
  hipsRestPos: THREE.Vector3; // in rig space
  hipHeight: number;
}

function buildRig(scene: THREE.Object3D, space: THREE.Object3D): Rig | null {
  const bones: Partial<Record<BoneKey, THREE.Bone>> = {};
  scene.traverse((o) => {
    if ((o as THREE.Bone).isBone) {
      const n = norm(o.name);
      (Object.keys(BONE_NAMES) as BoneKey[]).forEach((k) => {
        if (!bones[k] && n === BONE_NAMES[k]) bones[k] = o as THREE.Bone;
      });
    }
    if ((o as THREE.Mesh).isMesh) {
      o.frustumCulled = false;
      const mat = (o as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (mat && 'envMapIntensity' in mat) mat.envMapIntensity = 0.6;
    }
  });
  if (!bones.hips || !bones.lArm || !bones.rArm || !bones.lUp || !bones.rUp) return null;

  space.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(space.matrixWorld).invert();
  const toSpace = (o: THREE.Object3D) => new THREE.Vector3().setFromMatrixPosition(o.matrixWorld).applyMatrix4(inv);
  const spaceQ = new THREE.Quaternion();
  space.getWorldQuaternion(spaceQ);
  const spaceQinv = spaceQ.clone().invert();

  // facing: the character's left arm must be on +X when it faces +Z
  if (toSpace(bones.lArm).x < toSpace(bones.rArm).x) {
    scene.rotation.y += Math.PI;
    space.updateWorldMatrix(true, true);
    inv.copy(space.matrixWorld).invert();
  }

  const rest: Rig['rest'] = {};
  const fix: Rig['fix'] = {};
  const down = new THREE.Vector3(0, -1, 0);
  (Object.keys(bones) as BoneKey[]).forEach((k) => {
    const q = new THREE.Quaternion();
    bones[k]!.getWorldQuaternion(q);
    rest[k] = spaceQinv.clone().multiply(q);
  });
  const limb = (k: BoneKey, child: BoneKey) => {
    const a = bones[k];
    const b = bones[child];
    if (!a || !b) return;
    const dir = toSpace(b).sub(toSpace(a)).normalize();
    fix[k] = new THREE.Quaternion().setFromUnitVectors(dir, down);
  };
  limb('lArm', 'lFore');
  limb('rArm', 'rFore');
  limb('lFore', 'lHand');
  limb('rFore', 'rHand');
  limb('lUp', 'lLeg');
  limb('rUp', 'rLeg');
  limb('lLeg', 'lFoot');
  limb('rLeg', 'rFoot');
  const hipsRestPos = toSpace(bones.hips);
  return { root: scene, bones, rest, fix, hipsRestPos, hipHeight: Math.max(0.6, hipsRestPos.y) };
}

const E = (x: number, y: number, z: number) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'XYZ'));
const tmpQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3();

function applyPose(rig: Rig, p: Pose, space: THREE.Object3D) {
  const spaceQ = new THREE.Quaternion();
  space.getWorldQuaternion(spaceQ);
  const Dh = E(0, p.hipRotY, p.hipRotZ);
  const Ds = Dh.clone().multiply(E(p.spineX, p.spineY, p.spineZ));
  const set = (k: BoneKey, Q: THREE.Quaternion) => {
    const bone = rig.bones[k];
    const r = rig.rest[k];
    if (!bone || !r) return;
    const world = spaceQ.clone().multiply(Q).multiply(rig.fix[k] ?? new THREE.Quaternion()).multiply(r);
    bone.parent!.getWorldQuaternion(tmpQ);
    bone.quaternion.copy(tmpQ.invert().multiply(world));
    bone.updateMatrixWorld(true);
  };
  // hips: rotation + position offset
  set('hips', Dh);
  const hips = rig.bones.hips!;
  tmpV.copy(rig.hipsRestPos).add(new THREE.Vector3(p.hipX, p.hipY, 0));
  space.localToWorld(tmpV);
  hips.parent!.worldToLocal(tmpV);
  hips.position.copy(tmpV);
  hips.updateMatrixWorld(true);

  set('spine', Ds);
  set('head', Ds.clone().multiply(E(p.headX, p.headY, p.headZ)));
  const lSh = Ds.clone().multiply(E(p.lShX, p.lShY, p.lShZ));
  const rSh = Ds.clone().multiply(E(p.rShX, p.rShY, p.rShZ));
  set('lArm', lSh);
  set('rArm', rSh);
  set('lFore', lSh.clone().multiply(E(p.lEl, 0, 0)));
  set('rFore', rSh.clone().multiply(E(p.rEl, 0, 0)));
  const lHip = Dh.clone().multiply(E(p.lHipX, 0, p.lHipZ));
  const rHip = Dh.clone().multiply(E(p.rHipX, 0, p.rHipZ));
  set('lUp', lHip);
  set('rUp', rHip);
  set('lLeg', lHip.clone().multiply(E(p.lKnee, 0, 0)));
  set('rLeg', rHip.clone().multiply(E(p.rKnee, 0, 0)));
}

const TAU = Math.PI * 2;

export default function ModelAvatar({
  model,
  state,
  anim = 'idle',
  dance = 0,
  fallback,
  children,
}: {
  model: AvatarModelRef;
  state?: MutableRefObject<AnimState>;
  anim?: AnimName;
  dance?: number;
  fallback: ReactNode;
  children?: ReactNode;
}) {
  const [gltf, setGltf] = useState<GLTF | null>(null);
  const [failed, setFailed] = useState(false);
  const space = useRef<THREE.Group>(null!);
  const spin = useRef<THREE.Group>(null!);
  const pose = useRef<Pose>(makePose());
  const target = useRef<Pose>(makePose());
  const clock = useRef(Math.random() * 10);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    modelUrl(model)
      .then((url) => loadGLB(`${model.path}?v=${model.v}`, url))
      .then((g) => alive && setGltf(g))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [model.path, model.v]); // eslint-disable-line react-hooks/exhaustive-deps

  const scene = useMemo(() => (gltf ? cloneSkinned(gltf.scene) : null), [gltf]);
  const rig = useRef<Rig | null>(null);

  useEffect(() => {
    if (!scene || !space.current) return;
    rig.current = buildRig(scene, space.current);
    return () => {
      rig.current = null;
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.geometry?.dispose();
      });
    };
  }, [scene]);

  useFrame((_, rawDt) => {
    const r = rig.current;
    if (!r) return;
    const dt = Math.min(rawDt, 0.05);
    clock.current += dt;
    const st = state?.current ?? { anim, dance, speed: 1 };
    targetPose(target.current, st.anim, clock.current, { dance: st.dance, speed: st.speed, hipHeight: r.hipHeight });
    const p = pose.current;
    dampPose(p, target.current, 1 - Math.exp(-dt * (st.anim === 'jump' ? 14 : 10)));
    if (st.anim === 'dance' && st.dance === 2) p.spin += dt * 4.2;
    else p.spin += (Math.round(p.spin / TAU) * TAU - p.spin) * (1 - Math.exp(-dt * 6));
    spin.current.rotation.y = p.spin;
    applyPose(r, p, space.current);
  });

  if (failed) return <>{fallback}</>;
  return (
    <group>
      {!scene && fallback}
      <group ref={spin}>
        <group ref={space}>{scene && <primitive object={scene} />}</group>
      </group>
      {children}
    </group>
  );
}
