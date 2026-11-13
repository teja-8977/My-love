import type { Box } from './layout';

/** Push a circle (x,z,r) out of every overlapping box. Mutates and returns pos. */
export function resolveCircle(pos: { x: number; z: number }, r: number, boxes: Box[]) {
  for (let iter = 0; iter < 3; iter++) {
    let moved = false;
    for (const b of boxes) {
      const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        const push = r - d;
        pos.x += (dx / d) * push;
        pos.z += (dz / d) * push;
      } else {
        // centre inside the box: exit through the nearest face
        const left = pos.x - b.minX;
        const right = b.maxX - pos.x;
        const top = pos.z - b.minZ;
        const bottom = b.maxZ - pos.z;
        const m = Math.min(left, right, top, bottom);
        if (m === left) pos.x = b.minX - r;
        else if (m === right) pos.x = b.maxX + r;
        else if (m === top) pos.z = b.minZ - r;
        else pos.z = b.maxZ + r;
      }
      moved = true;
    }
    if (!moved) break;
  }
  return pos;
}

/**
 * 2D ray vs boxes (XZ plane). Returns the nearest hit distance in [0, maxDist] or maxDist if none.
 * Used to keep the third-person camera from clipping through walls.
 */
export function raycastBoxes(ox: number, oz: number, dx: number, dz: number, maxDist: number, boxes: Box[], pad = 0.2) {
  let best = maxDist;
  const inv = (v: number) => (Math.abs(v) < 1e-9 ? 1e9 : 1 / v);
  const ix = inv(dx);
  const iz = inv(dz);
  for (const b of boxes) {
    if (b.low) continue;
    const minX = b.minX - pad;
    const maxX = b.maxX + pad;
    const minZ = b.minZ - pad;
    const maxZ = b.maxZ + pad;
    // origin inside padded box -> ignore (we're hugging the wall)
    if (ox > minX && ox < maxX && oz > minZ && oz < maxZ) continue;
    let t1 = (minX - ox) * ix;
    let t2 = (maxX - ox) * ix;
    let tmin = Math.min(t1, t2);
    let tmax = Math.max(t1, t2);
    t1 = (minZ - oz) * iz;
    t2 = (maxZ - oz) * iz;
    tmin = Math.max(tmin, Math.min(t1, t2));
    tmax = Math.min(tmax, Math.max(t1, t2));
    if (tmax >= Math.max(tmin, 0) && tmin < best && tmin >= 0) best = tmin;
  }
  return best;
}
