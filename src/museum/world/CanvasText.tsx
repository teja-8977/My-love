import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';

export interface TextLine {
  text: string;
  font: string; // CSS font shorthand, e.g. '600 64px "Cormorant Garamond"'
  color?: string;
  gap?: number; // extra px after the line
  /** CSS letter-spacing in px */
  spacing?: number;
}

interface Props {
  lines: TextLine[];
  /** world width of the plane in metres */
  width: number;
  /** canvas px width (resolution) */
  px?: number;
  align?: 'center' | 'left';
  wrap?: boolean;
  padding?: number;
  background?: string;
  emissive?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  glow?: string;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/);
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) {
        out.push(line);
        line = w;
      } else line = test;
    }
    out.push(line);
  }
  return out;
}

/**
 * Renders crisp text with web fonts onto a canvas texture.
 * (Avoids runtime font downloads that 3D text libraries need.)
 */
export function CanvasText({ lines, width, px = 1024, align = 'center', wrap = true, padding = 24, background, emissive = 0, position, rotation, glow }: Props) {
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    let alive = true;
    Promise.all(lines.map((l) => document.fonts?.load(l.font).catch(() => null)))
      .then(() => document.fonts?.ready)
      .finally(() => alive && setFontsReady(true));
    return () => {
      alive = false;
    };
  }, [lines]);

  const { texture, aspect } = useMemo(() => {
    const measure = document.createElement('canvas').getContext('2d')!;
    const maxW = px - padding * 2;
    const layout: { text: string; font: string; color: string; size: number; gap: number; spacing: number }[] = [];
    for (const l of lines) {
      measure.font = l.font;
      const size = Number(/(\d+)px/.exec(l.font)?.[1] ?? 48);
      const parts = wrap ? wrapText(measure, l.text, maxW) : [l.text];
      parts.forEach((p, i) => layout.push({ text: p, font: l.font, color: l.color ?? '#3a2a20', size, gap: i === parts.length - 1 ? l.gap ?? 0 : 0, spacing: l.spacing ?? 0 }));
    }
    const height = Math.ceil(padding * 2 + layout.reduce((s, l) => s + l.size * 1.25 + l.gap, 0));
    const c = document.createElement('canvas');
    c.width = px;
    c.height = Math.max(8, height);
    const ctx = c.getContext('2d')!;
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, c.width, c.height);
    }
    let y = padding;
    ctx.textBaseline = 'top';
    ctx.textAlign = align;
    for (const l of layout) {
      ctx.font = l.font;
      (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${l.spacing}px`;
      ctx.fillStyle = l.color;
      if (glow) {
        ctx.shadowColor = glow;
        ctx.shadowBlur = l.size * 0.35;
      }
      ctx.fillText(l.text, align === 'center' ? px / 2 : padding, y + l.size * 0.1);
      y += l.size * 1.25 + l.gap;
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return { texture: t, aspect: c.height / c.width };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(lines), px, align, wrap, padding, background, glow, fontsReady]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[width, width * aspect]} />
      {emissive > 0 ? (
        <meshBasicMaterial map={texture} transparent toneMapped={false} color={new THREE.Color(emissive, emissive, emissive)} depthWrite={false} />
      ) : (
        <meshStandardMaterial map={texture} transparent roughness={0.8} depthWrite={false} />
      )}
    </mesh>
  );
}
