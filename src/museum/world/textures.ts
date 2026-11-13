import * as THREE from 'three';

/** Procedurally painted canvas textures — no external image assets needed. */

const cache = new Map<string, THREE.Texture>();

function make(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, srgb = true) {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function marbleTexture(base = '#efe6da', vein = 'rgba(150,130,115,', tiles = 2, dark = false) {
  return make(`marble${base}${tiles}${dark}`, 1024, 1024, (ctx, w, h) => {
    const r = rng(dark ? 7 : 42);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    // soft clouds
    for (let i = 0; i < 40; i++) {
      const g = ctx.createRadialGradient(r() * w, r() * h, 0, r() * w, r() * h, 80 + r() * 220);
      g.addColorStop(0, dark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.25)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    // veins
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      let x = r() * w;
      let y = r() * h;
      ctx.moveTo(x, y);
      for (let k = 0; k < 8; k++) {
        const nx = x + (r() - 0.3) * 260;
        const ny = y + (r() - 0.5) * 260;
        ctx.quadraticCurveTo(x + (r() - 0.5) * 120, y + (r() - 0.5) * 120, nx, ny);
        x = nx;
        y = ny;
      }
      ctx.strokeStyle = `${vein}${0.08 + r() * 0.18})`;
      ctx.lineWidth = 0.6 + r() * 1.8;
      ctx.stroke();
    }
    // tile seams
    ctx.strokeStyle = dark ? 'rgba(0,0,0,0.5)' : 'rgba(120,100,85,0.35)';
    ctx.lineWidth = 2;
    const step = w / tiles;
    for (let i = 0; i <= tiles; i++) {
      ctx.beginPath();
      ctx.moveTo(i * step, 0);
      ctx.lineTo(i * step, h);
      ctx.moveTo(0, i * step);
      ctx.lineTo(w, i * step);
      ctx.stroke();
    }
  });
}

export function woodTexture() {
  return make('wood-herringbone', 1024, 1024, (ctx, w, h) => {
    const r = rng(11);
    ctx.fillStyle = '#7a4f30';
    ctx.fillRect(0, 0, w, h);
    const pw = 64; // plank width
    const pl = 256; // plank length
    ctx.save();
    for (let row = -4; row < 20; row++) {
      for (let col = -4; col < 20; col++) {
        const x = col * pw * 2;
        const y = row * pw * 2 + col * pw * 2;
        for (let k = 0; k < 2; k++) {
          ctx.save();
          ctx.translate(x + (k ? pw * 2 : 0), (y % (h * 2)) - h / 2);
          ctx.rotate(k ? Math.PI / 4 : -Math.PI / 4);
          const tone = 110 + r() * 40;
          ctx.fillStyle = `rgb(${tone + 35},${tone - 10},${tone - 55})`;
          ctx.fillRect(0, 0, pl, pw);
          for (let g = 0; g < 6; g++) {
            ctx.strokeStyle = `rgba(60,30,10,${0.08 + r() * 0.1})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            const gy = r() * pw;
            ctx.moveTo(0, gy);
            ctx.bezierCurveTo(pl * 0.3, gy + (r() - 0.5) * 8, pl * 0.6, gy + (r() - 0.5) * 8, pl, gy);
            ctx.stroke();
          }
          ctx.strokeStyle = 'rgba(40,20,8,0.55)';
          ctx.lineWidth = 2;
          ctx.strokeRect(0, 0, pl, pw);
          ctx.restore();
        }
      }
    }
    ctx.restore();
    // varnish sheen
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, 'rgba(255,220,180,0.06)');
    g.addColorStop(1, 'rgba(0,0,0,0.06)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

export function carpetTexture() {
  return make('carpet', 512, 512, (ctx, w, h) => {
    const r = rng(5);
    ctx.fillStyle = '#4a0f1c';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) {
      ctx.fillStyle = `rgba(${r() > 0.5 ? '255,180,190' : '0,0,0'},${r() * 0.06})`;
      ctx.fillRect(r() * w, r() * h, 2, 2);
    }
    ctx.strokeStyle = 'rgba(217,178,111,0.22)';
    ctx.lineWidth = 3;
    const s = 128;
    for (let y = 0; y < h; y += s) {
      for (let x = 0; x < w; x += s) {
        ctx.beginPath();
        ctx.moveTo(x + s / 2, y + 10);
        ctx.lineTo(x + s - 10, y + s / 2);
        ctx.lineTo(x + s / 2, y + s - 10);
        ctx.lineTo(x + 10, y + s / 2);
        ctx.closePath();
        ctx.stroke();
      }
    }
  });
}

export function cofferTexture(base: string) {
  return make(`coffer${base}`, 512, 512, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    const m = 40;
    const g = ctx.createLinearGradient(m, m, w - m, h - m);
    g.addColorStop(0, 'rgba(0,0,0,0.10)');
    g.addColorStop(1, 'rgba(255,255,255,0.08)');
    ctx.fillStyle = g;
    ctx.fillRect(m, m, w - 2 * m, h - 2 * m);
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 6;
    ctx.strokeRect(m, m, w - 2 * m, h - 2 * m);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 3;
    ctx.strokeRect(m + 14, m + 14, w - 2 * m - 28, h - 2 * m - 28);
  });
}

/** Soft white radial glow (for fake light pools / picture lights). */
export function glowTexture() {
  return make(
    'glow',
    256,
    256,
    (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
    false,
  );
}

/** Downward light cone on a wall above a picture. */
export function wallWashTexture() {
  return make(
    'wallwash',
    256,
    512,
    (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, 0, 0, w / 2, 0, h);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.4, 'rgba(255,255,255,0.35)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(w * 0.35, 0);
      ctx.lineTo(w * 0.65, 0);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
    },
    false,
  );
}

export function nightSkyTexture() {
  return make('nightsky', 1024, 640, (ctx, w, h) => {
    const r = rng(3);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0b0a24');
    g.addColorStop(0.6, '#2a1747');
    g.addColorStop(1, '#6b2c55');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 420; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`;
      const s = r() * 2.2;
      ctx.fillRect(r() * w, r() * h * 0.8, s, s);
    }
    const mg = ctx.createRadialGradient(w * 0.72, h * 0.28, 10, w * 0.72, h * 0.28, 160);
    mg.addColorStop(0, 'rgba(255,240,220,0.5)');
    mg.addColorStop(1, 'rgba(255,240,220,0)');
    ctx.fillStyle = mg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff3df';
    ctx.beginPath();
    ctx.arc(w * 0.72, h * 0.28, 52, 0, Math.PI * 2);
    ctx.fill();
    // city / hills silhouette
    ctx.fillStyle = '#140b1f';
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 32) ctx.lineTo(x, h - 60 - Math.sin(x * 0.01) * 30 - r() * 20);
    ctx.lineTo(w, h);
    ctx.fill();
  });
}

/** Versailles-style diamond parquet in soft grey oak (one texture = one 1.4 m panel). */
export function parquetTexture() {
  return make('parquet-versailles', 1024, 1024, (ctx, w, h) => {
    const r = rng(23);
    const plank = (x: number, y: number, len: number, wid: number, angle: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      const tone = 150 + r() * 35;
      ctx.fillStyle = `rgb(${tone + 8},${tone + 2},${tone - 10})`;
      ctx.fillRect(-len / 2, -wid / 2, len, wid);
      for (let g = 0; g < 7; g++) {
        ctx.strokeStyle = `rgba(70,60,50,${0.05 + r() * 0.08})`;
        ctx.lineWidth = 1;
        const gy = -wid / 2 + r() * wid;
        ctx.beginPath();
        ctx.moveTo(-len / 2, gy);
        ctx.bezierCurveTo(-len / 6, gy + (r() - 0.5) * 6, len / 6, gy + (r() - 0.5) * 6, len / 2, gy);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(60,52,44,0.55)';
      ctx.lineWidth = 2;
      ctx.strokeRect(-len / 2, -wid / 2, len, wid);
      ctx.restore();
    };
    ctx.fillStyle = '#8f877c';
    ctx.fillRect(0, 0, w, h);
    const b = 70; // border plank width
    // frame
    plank(w / 2, b / 2, w, b, 0);
    plank(w / 2, h - b / 2, w, b, 0);
    plank(b / 2, h / 2, h - 2 * b, b, Math.PI / 2);
    plank(w - b / 2, h / 2, h - 2 * b, b, Math.PI / 2);
    // inner lattice (diagonal weave)
    ctx.save();
    ctx.beginPath();
    ctx.rect(b, b, w - 2 * b, h - 2 * b);
    ctx.clip();
    const step = (w - 2 * b) / 4;
    for (let i = -4; i <= 8; i++) {
      for (let j = 0; j < 8; j++) {
        const cx = b + i * step + j * step * 0.5;
        const cy = b + j * step * 0.5;
        plank(cx, cy, step * 0.72, step * 0.28, Math.PI / 4);
        plank(cx + step * 0.5, cy, step * 0.72, step * 0.28, -Math.PI / 4);
      }
    }
    ctx.restore();
    const v = ctx.createRadialGradient(w / 2, h / 2, w * 0.1, w / 2, h / 2, w * 0.75);
    v.addColorStop(0, 'rgba(255,255,255,0.05)');
    v.addColorStop(1, 'rgba(0,0,0,0.08)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  });
}

/** Polished marble checkerboard with veining. */
export function checkerTexture() {
  return make('checker-marble', 1024, 1024, (ctx, w, h) => {
    const r = rng(77);
    const n = 4;
    const s = w / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        ctx.fillStyle = (i + j) % 2 ? '#2f2a28' : '#f1ebe1';
        ctx.fillRect(i * s, j * s, s, s);
      }
    for (let k = 0; k < 26; k++) {
      ctx.beginPath();
      let x = r() * w;
      let y = r() * h;
      ctx.moveTo(x, y);
      for (let q = 0; q < 6; q++) {
        x += (r() - 0.4) * 200;
        y += (r() - 0.5) * 200;
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(150,140,130,${0.08 + r() * 0.12})`;
      ctx.lineWidth = 0.6 + r() * 1.5;
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(201,169,97,0.7)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= n; i++) {
      ctx.beginPath();
      ctx.moveTo(i * s, 0);
      ctx.lineTo(i * s, h);
      ctx.moveTo(0, i * s);
      ctx.lineTo(w, i * s);
      ctx.stroke();
    }
  });
}

/** Pale limestone slabs for the portico and steps. */
export function stoneTexture() {
  return make('stone', 512, 512, (ctx, w, h) => {
    const r = rng(9);
    ctx.fillStyle = '#d9d2c5';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++) {
      ctx.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '90,80,70'},${r() * 0.06})`;
      ctx.fillRect(r() * w, r() * h, 2, 2);
    }
    ctx.strokeStyle = 'rgba(120,108,95,0.45)';
    ctx.lineWidth = 2;
    for (let y = 0; y <= h; y += h / 2) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    for (let row = 0; row < 2; row++)
      for (let x = row ? w / 4 : 0; x <= w; x += w / 2) {
        ctx.beginPath();
        ctx.moveTo(x, row * (h / 2));
        ctx.lineTo(x, (row + 1) * (h / 2));
        ctx.stroke();
      }
  });
}

/** Night sky gradient with stars (inside of a big sphere). */
export function skyTexture() {
  return make('sky', 1024, 512, (ctx, w, h) => {
    const r = rng(101);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#05061a');
    g.addColorStop(0.45, '#1a1238');
    g.addColorStop(0.5, '#3b1f45');
    g.addColorStop(0.56, '#20142a');
    g.addColorStop(1, '#0b0810');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const y = r() * h * 0.47;
      ctx.fillStyle = `rgba(255,255,255,${0.25 + r() * 0.75})`;
      const s = r() * 1.6 + 0.3;
      ctx.fillRect(r() * w, y, s, s);
    }
  });
}
