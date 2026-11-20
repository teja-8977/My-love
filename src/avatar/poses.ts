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
  /** extra ankle bend on top of keeping the foot level (+ = toes down) */
  lAnk: number;
  rAnk: number;
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
  lAnk: 0, rAnk: 0,
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
      // breathing, a soft side-to-side sway and the occasional curious head tilt
      const b = s(t * 1.8);
      const sway = s(t * 0.9);
      out.hipY = b * 0.008;
      out.hipX = sway * 0.012;
      out.hipRotZ = sway * 0.02;
      out.spineX = 0.02 + b * 0.015;
      out.spineZ = -sway * 0.03;
      out.headX = -0.03 + s(t * 0.7) * 0.04;
      out.headY = s(t * 0.33) * 0.18;
      out.headZ = Math.max(0, s(t * 0.21)) ** 4 * 0.18 + sway * 0.03;
      out.lShZ = 0.12 + b * 0.02;
      out.rShZ = -0.12 - b * 0.02;
      out.lShX = s(t * 0.9 + 1) * 0.04;
      out.rShX = -s(t * 0.9 + 1) * 0.04;
      out.lEl = -0.2;
      out.rEl = -0.2;
      break;
    }
    case 'walk':
    case 'run': {
      // short chibi legs take quicker steps (so the feet don't slide) with a happy bounce
      const run = anim === 'run';
      const f = run ? 14 : 9.5 * Math.max(0.6, Math.min(1.3, opts.speed ?? 1));
      const p = t * f;
      const amp = run ? 0.9 : 0.6;
      out.lHipX = -s(p) * amp;
      out.rHipX = s(p) * amp;
      out.lKnee = Math.max(0, s(p + 1.4)) * (run ? 1.6 : 0.9) + 0.06;
      out.rKnee = Math.max(0, -s(p + 1.4)) * (run ? 1.6 : 0.9) + 0.06;
      out.lShX = s(p) * (run ? 1.0 : 0.6);
      out.rShX = -s(p) * (run ? 1.0 : 0.6);
      out.lEl = run ? -1.3 : -0.3 - Math.max(0, -s(p)) * 0.4;
      out.rEl = run ? -1.3 : -0.3 - Math.max(0, s(p)) * 0.4;
      out.lShZ = 0.16;
      out.rShZ = -0.16;
      const bounce = Math.abs(c(p));
      out.hipY = -bounce * (run ? 0.06 : 0.035) + (run ? 0.0 : 0.018);
      out.hipX = s(p) * 0.012;
      out.hipRotY = s(p) * (run ? 0.14 : 0.1);
      out.hipRotZ = -s(p) * 0.04;
      out.spineY = -s(p) * (run ? 0.2 : 0.12);
      out.spineX = run ? 0.24 : 0.06;
      // the big head bobs a little behind the body
      out.headX = (run ? -0.14 : -0.04) + bounce * 0.05;
      out.headZ = s(p) * 0.06;
      // heel strike → toe push-off
      out.lAnk = s(p + 0.9) * (run ? 0.35 : 0.25);
      out.rAnk = -s(p + 0.9) * (run ? 0.35 : 0.25);
      break;
    }
    case 'jump': {
      out.lHipX = -0.75;
      out.rHipX = -0.3;
      out.lKnee = 1.2;
      out.rKnee = 0.7;
      out.lShZ = 1.4;
      out.rShZ = -1.4;
      out.lShX = -0.3;
      out.rShX = -0.3;
      out.lEl = -0.4;
      out.rEl = -0.4;
      out.spineX = 0.06;
      out.headX = -0.12;
      out.lAnk = 0.45;
      out.rAnk = 0.35;
      break;
    }
    case 'sit': {
      // pelvis drops onto the seat (~0.47m); short legs dangle and swing
      out.hipY = 0.47 - opts.hipHeight;
      out.lHipX = -1.5;
      out.rHipX = -1.5;
      out.lHipZ = 0.06;
      out.rHipZ = -0.06;
      out.lKnee = 1.35 + s(t * 2.2) * 0.18;
      out.rKnee = 1.35 - s(t * 2.2) * 0.18;
      out.spineX = -0.06 + s(t * 1.3) * 0.012;
      out.lShX = -0.45;
      out.rShX = -0.45;
      out.lShZ = 0.14;
      out.rShZ = -0.14;
      out.lEl = -0.8;
      out.rEl = -0.8;
      out.headX = 0.02 + s(t * 0.5) * 0.03;
      out.headY = s(t * 0.27) * 0.15;
      out.headZ = s(t * 0.4) * 0.06;
      break;
    }
    case 'wave': {
      const b = Math.abs(s(t * 4.5));
      out.rShZ = -2.5;
      out.rShX = -0.15;
      out.rShY = s(t * 9) * 0.25;
      out.rEl = -0.5 + s(t * 9) * 0.35;
      out.lShZ = 0.15;
      out.lEl = -0.3;
      out.headZ = 0.14;
      out.headX = -0.06;
      out.spineZ = 0.06;
      out.hipY = -b * 0.02;
      out.lKnee = b * 0.12;
      out.rKnee = b * 0.12;
      out.lHipX = -b * 0.06;
      out.rHipX = -b * 0.06;
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
        // Heart hands in front of the chest + gentle bob
        const p = t * 3;
        out.lShZ = -0.15;
        out.rShZ = 0.15;
        out.lShX = -1.15;
        out.rShX = -1.15;
        out.lShY = 0.35;
        out.rShY = -0.35;
        out.lEl = -1.1;
        out.rEl = -1.1;
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
