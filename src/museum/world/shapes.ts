import * as THREE from 'three';

/** Classic heart outline, centered roughly at origin, width ≈ 2*size. Point faces -Y. */
export function heartShape(size = 1) {
  const s = size;
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.95 * s);
  shape.bezierCurveTo(-0.15 * s, -0.75 * s, -1.0 * s, -0.25 * s, -1.0 * s, 0.25 * s);
  shape.bezierCurveTo(-1.0 * s, 0.75 * s, -0.4 * s, 0.95 * s, 0, 0.55 * s);
  shape.bezierCurveTo(0.4 * s, 0.95 * s, 1.0 * s, 0.75 * s, 1.0 * s, 0.25 * s);
  shape.bezierCurveTo(1.0 * s, -0.25 * s, 0.15 * s, -0.75 * s, 0, -0.95 * s);
  return shape;
}

/** Points along a heart curve (for fairy lights / arches). */
export function heartPoints(n: number, size = 1): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push(new THREE.Vector2((x / 17) * size, (y / 17) * size));
  }
  return pts;
}
