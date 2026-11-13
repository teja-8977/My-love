/**
 * Procedural animation system.
 * Every animation produces a target Pose; the avatar damps its joints towards the target
 * each frame, which gives smooth blends between any two animations.
 *
 * Conventions (character faces +Z):
 *  - limb rotation.x  > 0  swings the limb backwards, < 0 forwards
 *  - knee  rotation.x > 0  bends the shin backwards
 *  - elbow rotation.x < 0  bends the forearm forwards
 *  - left arm rotation.z > 0 raises it sideways (right arm uses < 0)
 */

export type AnimName = 'idle' | 'walk' | 'run' | 'jump' | 'sit' | 'dance' | 'wave';

export const DANCES = [
  { id: 0, name: 'Sway', emoji: '💃' },
  { id: 1, name: 'Groove', emoji: '🕺' },
  { id: 2, name: 'Twirl', emoji: '🌀' },
  { id: 3, name: 'Heart hands', emoji: '🫶' },
] as const;

export interface Pose {
  hipY: number; // vertical offset of pelvis
  hipX: number; // sideways sway
  hipRotY: number;
  hipRotZ: number;
  spineX: number;
  spineY: number;
  spineZ: number;
  headX: number;
  headY: number;
  headZ: number;
  lShX: number;
  lShZ: number;
  lShY: number;
  lEl: number;
  rShX: number;
  rShZ: number;
  rShY: number;
  rEl: number;
  lHipX: number;
  lHipZ: number;
  lKnee: number;
  rHipX: number;
  rHipZ: number;
  rKnee: number;
  spin: number; // extra body rotation around Y (twirl)
}

export const ZERO_POSE: Pose = {
  hipY: 0, hipX: 0, hipRotY: 0, hipRotZ: 0,
  spineX: 0, spineY: 0, spineZ: 0,
  headX: 0, headY: 0, headZ: 0,
  lShX: 0, lShZ: 0.08, lShY: 0, lEl: -0.12,
  rShX: 0, rShZ: -0.08, rShY: 0, rEl: -0.12,
  lHipX: 0, lHipZ: 0, lKnee: 0,
  rHipX: 0, rHipZ: 0, rKnee: 0,
  spin: 0,
};

export function makePose(): Pose {
  return { ...ZERO_POSE };
}

/** Writes the target pose for `anim` at time `t` into `out`. */
export function targetPose(out: Pose, anim: AnimName, t: number, opts: { dance?: number; speed?: number; hipHeight: number }) {
  Object.assign(out, ZERO_POSE);
  const s = Math.sin;
  const c = Math.cos;

  switch (anim) {
    case 'idle': {
      const b = s(t * 1.6);
      out.hipY = b * 0.006;
      out.spineX = 0.02 + b * 0.012;
      out.headX = -0.02 + s(t * 0.7) * 0.03;
      out.headY = s(t * 0.33) * 0.12;
      out.lShZ = 0.1 + b * 0.015;
      out.rShZ = -0.1 - b * 0.015;
      out.lEl = -0.15;
      out.rEl = -0.15;
      break;
    }
    case 'walk':
    case 'run': {
      const run = anim === 'run';
      const f = run ? 10.5 : 6.6 * Math.max(0.6, Math.min(1.3, opts.speed ?? 1));
      const p = t * f;
      const amp = run ? 0.85 : 0.5;
      out.lHipX = -s(p) * amp;
      out.rHipX = s(p) * amp;
      out.lKnee = Math.max(0, s(p + 1.4)) * (run ? 1.5 : 0.75) + 0.05;
      out.rKnee = Math.max(0, -s(p + 1.4)) * (run ? 1.5 : 0.75) + 0.05;
      out.lShX = s(p) * (run ? 0.9 : 0.45);
      out.rShX = -s(p) * (run ? 0.9 : 0.45);
      out.lEl = run ? -1.25 : -0.25 - Math.max(0, -s(p)) * 0.3;
      out.rEl = run ? -1.25 : -0.25 - Math.max(0, s(p)) * 0.3;
      out.lShZ = 0.12;
      out.rShZ = -0.12;
      out.hipY = -Math.abs(c(p)) * (run ? 0.05 : 0.025) + (run ? 0.0 : 0.012);
      out.hipRotY = s(p) * (run ? 0.12 : 0.08);
      out.spineY = -s(p) * (run ? 0.18 : 0.1);
      out.spineX = run ? 0.22 : 0.05;
      out.headX = run ? -0.12 : -0.03;
      break;
    }
    case 'jump': {
      out.lHipX = -0.65;
      out.rHipX = -0.25;
      out.lKnee = 1.1;
      out.rKnee = 0.6;
      out.lShZ = 0.9;
      out.rShZ = -0.9;
      out.lShX = -0.3;
      out.rShX = -0.3;
      out.lEl = -0.5;
      out.rEl = -0.5;
      out.spineX = 0.08;
      break;
    }
    case 'sit': {
      // pelvis drops onto the seat (~0.47m)
      out.hipY = 0.47 - opts.hipHeight;
      out.lHipX = -1.5;
      out.rHipX = -1.5;
      out.lHipZ = 0.06;
      out.rHipZ = -0.06;
      out.lKnee = 1.5;
      out.rKnee = 1.5;
      out.spineX = -0.06 + s(t * 1.3) * 0.01;
      out.lShX = -0.35;
      out.rShX = -0.35;
      out.lShZ = 0.12;
      out.rShZ = -0.12;
      out.lEl = -0.9;
      out.rEl = -0.9;
      out.headX = 0.02 + s(t * 0.5) * 0.03;
      out.headY = s(t * 0.27) * 0.15;
      break;
    }
    case 'wave': {
      out.rShZ = -2.4;
      out.rShX = -0.2;
      out.rEl = -0.4 + s(t * 9) * 0.35;
      out.headZ = 0.08;
      out.spineZ = 0.04;
      break;
    }
    case 'dance': {
      const d = opts.dance ?? 0;
      if (d === 0) {
        // Sway — romantic side sway with flowing arms
        const p = t * 3.2;
        out.hipX = s(p) * 0.07;
        out.hipRotZ = s(p) * 0.08;
        out.spineZ = -s(p) * 0.12;
        out.headZ = s(p) * 0.08;
        out.lShZ = 1.4 + s(p) * 0.6;
        out.rShZ = -1.4 + s(p) * 0.6;
        out.lEl = -0.6 - c(p) * 0.3;
        out.rEl = -0.6 + c(p) * 0.3;
        out.lKnee = Math.max(0, s(p)) * 0.3;
        out.rKnee = Math.max(0, -s(p)) * 0.3;
        out.lHipX = -Math.max(0, s(p)) * 0.15;
        out.rHipX = -Math.max(0, -s(p)) * 0.15;
        out.hipY = -Math.abs(s(p)) * 0.03;
      } else if (d === 1) {
        // Groove — bouncy pumps
        const p = t * 8;
        const bounce = Math.abs(s(p * 0.5));
        out.hipY = -bounce * 0.07;
        out.lKnee = bounce * 0.5;
        out.rKnee = bounce * 0.5;
        out.lHipX = -bounce * 0.25;
        out.rHipX = -bounce * 0.25;
        out.spineX = 0.15;
        out.spineY = s(p * 0.25) * 0.35;
        out.hipRotY = -s(p * 0.25) * 0.2;
        out.lShX = -0.6 + s(p * 0.5) * 0.7;
        out.rShX = -0.6 - s(p * 0.5) * 0.7;
        out.lShZ = 0.35;
        out.rShZ = -0.35;
        out.lEl = -1.6;
        out.rEl = -1.6;
        out.headX = s(p) * 0.12;
      } else if (d === 2) {
        // Twirl — spins with open arms
        const p = t * 2.4;
        out.spin = t * 3.2;
        out.lShZ = 1.5;
        out.rShZ = -2.6;
        out.lEl = -0.2;
        out.rEl = -0.5;
        out.hipY = s(p * 2) * 0.03 + 0.02;
        out.lHipX = -0.15;
        out.lKnee = 0.25;
        out.rHipX = 0.05;
        out.headX = -0.15;
        out.spineX = -0.06;
      } else {
        // Heart hands above the head + gentle bob
        const p = t * 3;
        out.lShZ = 2.5;
        out.rShZ = -2.5;
        out.lShX = -0.4;
        out.rShX = -0.4;
        out.lShY = -0.3;
        out.rShY = 0.3;
        out.lEl = -1.25;
        out.rEl = -1.25;
        out.hipY = -Math.abs(s(p)) * 0.035;
        out.lKnee = Math.abs(s(p)) * 0.25;
        out.rKnee = Math.abs(s(p)) * 0.25;
        out.lHipX = -Math.abs(s(p)) * 0.12;
        out.rHipX = -Math.abs(s(p)) * 0.12;
        out.hipX = s(p * 0.5) * 0.04;
        out.headZ = s(p * 0.5) * 0.12;
      }
      break;
    }
  }
  return out;
}

export function dampPose(cur: Pose, target: Pose, k: number) {
  for (const key in cur) {
    const kk = key as keyof Pose;
    if (kk === 'spin') continue;
    cur[kk] += (target[kk] - cur[kk]) * k;
  }
}
