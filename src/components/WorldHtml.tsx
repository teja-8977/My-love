import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface Props {
  position?: [number, number, number];
  children: ReactNode;
  /** allow clicks (e.g. buttons in a speech bubble) */
  interactive?: boolean;
  zIndex?: number;
  /** hide beyond this camera distance */
  maxDistance?: number;
  /** CSS transform applied after positioning; default anchors bottom-centre on the point */
  anchor?: string;
  /** keep the element fully on screen (used for the guide speech bubble) */
  clampToScreen?: boolean;
}

const tmp = new THREE.Vector3();

function visibleInHierarchy(o: THREE.Object3D | null) {
  for (let n = o; n; n = n.parent) if (!n.visible) return false;
  return true;
}

/**
 * DOM content pinned to a 3D point (name tags, chat bubbles, speech bubbles).
 * Renders into its own React root layered over the canvas and is re-projected every frame.
 */
export function WorldHtml({ position = [0, 0, 0], children, interactive = false, zIndex = 10, maxDistance = 45, anchor = 'translate(-50%, -100%)', clampToScreen }: Props) {
  const group = useRef<THREE.Group>(null!);
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const el = useMemo(() => document.createElement('div'), []);
  const root = useRef<Root | null>(null);

  useEffect(() => {
    const parent = gl.domElement.parentElement ?? document.body;
    el.style.cssText = `position:absolute;top:0;left:0;z-index:${zIndex};pointer-events:${interactive ? 'auto' : 'none'};will-change:transform;display:none;`;
    parent.appendChild(el);
    const r = createRoot(el);
    root.current = r;
    return () => {
      root.current = null;
      // unmount after the current render pass (avoids React's synchronous-unmount warning)
      setTimeout(() => {
        r.unmount();
        el.remove();
      }, 0);
    };
  }, [gl, el, zIndex, interactive]);

  useEffect(() => {
    root.current?.render(<>{children}</>);
  });

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    g.getWorldPosition(tmp);
    const dist = tmp.distanceTo(camera.position);
    tmp.project(camera);
    const hidden = tmp.z > 1 || tmp.z < -1 || dist > maxDistance || !visibleInHierarchy(g);
    if (hidden) {
      if (el.style.display !== 'none') el.style.display = 'none';
      return;
    }
    const x = (tmp.x * 0.5 + 0.5) * size.width;
    const y = (-tmp.y * 0.5 + 0.5) * size.height;
    el.style.display = 'block';
    if (clampToScreen) {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const left = Math.max(8, Math.min(size.width - w - 8, x - w * 0.12));
      const top = Math.max(8, Math.min(size.height - h - 8, y - h));
      el.style.transform = `translate3d(${left.toFixed(1)}px, ${top.toFixed(1)}px, 0)`;
      return;
    }
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) ${anchor}`;
  });

  return <group ref={group} position={position} />;
}
