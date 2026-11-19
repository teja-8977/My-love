import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Check, ImageUp, RotateCcw, X } from 'lucide-react';
import { Button } from '../components/ui';
import type { Gender } from './config';

export interface SelfieLook {
  gender: Gender;
  skin: string;
  hairColor: string | null;
  eyeColor: string | null;
  photo: string; // small data URL, shown only on this device
}

// ---------- colour helpers ----------
type RGB = [number, number, number];
const toHex = ([r, g, b]: RGB) => '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

/** Median colour of a rectangle (fractions of the image), ignoring very dark / blown-out pixels. */
function sample(ctx: CanvasRenderingContext2D, W: number, H: number, x: number, y: number, w: number, h: number): RGB | null {
  const px = ctx.getImageData(Math.round(x * W), Math.round(y * H), Math.max(1, Math.round(w * W)), Math.max(1, Math.round(h * H))).data;
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  for (let i = 0; i < px.length; i += 4) {
    const l = (px[i] + px[i + 1] + px[i + 2]) / 3;
    if (l < 12 || l > 248) continue;
    rs.push(px[i]);
    gs.push(px[i + 1]);
    bs.push(px[i + 2]);
  }
  if (rs.length < 8) return null;
  const med = (a: number[]) => a.sort((p, q) => p - q)[a.length >> 1];
  return [med(rs), med(gs), med(bs)];
}

/** Turn a camera skin sample into a pleasant cartoon skin tone. */
function cartoonSkin(c: RGB) {
  const [h, s, l] = rgbToHsl(c);
  const hue = Math.min(38, Math.max(14, h > 300 ? 20 : h));
  return toHex(hslToRgb(hue, Math.min(0.62, Math.max(0.3, s)), Math.min(0.88, Math.max(0.22, l * 1.08 + 0.04))));
}
function cartoonHair(c: RGB) {
  const [h, s, l] = rgbToHsl(c);
  return toHex(hslToRgb(h, Math.min(0.75, s * 1.1), Math.min(0.6, Math.max(0.07, l * 0.9))));
}
const dist = (a: RGB, b: RGB) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** The face guide: an oval in the middle of the frame (fractions of width / height). */
const OVAL = { cx: 0.5, cy: 0.5, rx: 0.2, ry: 0.32 };

function analyse(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const W = canvas.width;
  const H = canvas.height;
  const { cx, cy, rx, ry } = OVAL;
  // cheeks + forehead + chin for skin
  const skins = [
    sample(ctx, W, H, cx - rx * 0.62, cy + ry * 0.12, rx * 0.3, ry * 0.16),
    sample(ctx, W, H, cx + rx * 0.32, cy + ry * 0.12, rx * 0.3, ry * 0.16),
    sample(ctx, W, H, cx - rx * 0.2, cy - ry * 0.5, rx * 0.4, ry * 0.12),
  ].filter(Boolean) as RGB[];
  if (!skins.length) return null;
  const skinRaw = skins.map((s) => s).sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]))[skins.length >> 1];
  // hair: just above the oval, and the upper sides of the head
  const hairs = [
    sample(ctx, W, H, cx - rx * 0.4, cy - ry * 1.02, rx * 0.8, ry * 0.1),
    sample(ctx, W, H, cx - rx * 1.05, cy - ry * 0.6, rx * 0.18, ry * 0.3),
    sample(ctx, W, H, cx + rx * 0.87, cy - ry * 0.6, rx * 0.18, ry * 0.3),
  ].filter((c): c is RGB => !!c && dist(c, skinRaw) > 55);
  const hairRaw = hairs.length ? hairs.sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]))[0] : null;
  // eyes: the darkest pixels around each eye are mostly the iris
  let eye: RGB | null = null;
  const px = ctx.getImageData(Math.round((cx - rx * 0.7) * W), Math.round((cy - ry * 0.22) * H), Math.round(rx * 1.4 * W), Math.round(ry * 0.2 * H)).data;
  const dark: RGB[] = [];
  for (let i = 0; i < px.length; i += 4) dark.push([px[i], px[i + 1], px[i + 2]]);
  dark.sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
  const top = dark.slice(Math.floor(dark.length * 0.02), Math.floor(dark.length * 0.08));
  if (top.length) eye = top.reduce((a, c) => [a[0] + c[0] / top.length, a[1] + c[1] / top.length, a[2] + c[2] / top.length], [0, 0, 0] as RGB);
  const eyeHex = eye ? (() => {
    const [h, s, l] = rgbToHsl(eye);
    return toHex(hslToRgb(h, Math.min(0.6, Math.max(0.25, s)), Math.min(0.4, Math.max(0.16, l * 1.6))));
  })() : null;
  return { skin: cartoonSkin(skinRaw), hairColor: hairRaw ? cartoonHair(hairRaw) : null, eyeColor: eyeHex };
}

/**
 * Selfie → avatar colours, entirely on this device (the photo is never uploaded).
 * Reads the skin tone, hair colour and eye colour from the selfie and applies them to the cartoon character.
 */
export function SelfieMatch({ gender: initialGender, onApply, onClose }: { gender: Gender; onApply: (l: SelfieLook) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [gender, setGender] = useState<Gender>(initialGender);
  const [result, setResult] = useState<(Omit<SelfieLook, 'gender'>) | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let s: MediaStream | null = null;
    let alive = true;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError('This browser cannot open the camera — upload a photo instead.');
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } }, audio: false })
      .then((m) => {
        if (!alive) return m.getTracks().forEach((t) => t.stop());
        s = m;
        setStream(m);
      })
      .catch((e: Error) => setCamError(e?.name === 'NotAllowedError' ? 'Camera permission was not given — you can upload a photo instead.' : 'No camera found — upload a photo instead.'));
    return () => {
      alive = false;
      s?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const attach = useCallback(
    (el: HTMLVideoElement | null) => {
      video.current = el;
      if (el && stream && el.srcObject !== stream) {
        el.srcObject = stream;
        el.play().catch(() => {});
      }
    },
    [stream],
  );

  /** draw the source into a 4:3 canvas (centre-cropped like the preview) and analyse it */
  const process = (src: CanvasImageSource, w: number, h: number, mirror: boolean) => {
    const c = document.createElement('canvas');
    c.width = 480;
    c.height = 360;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    const target = 4 / 3;
    let sw = w;
    let sh = h;
    if (w / h > target) sw = h * target;
    else sh = w / target;
    if (mirror) {
      ctx.translate(c.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(src, (w - sw) / 2, (h - sh) / 2, sw, sh, 0, 0, c.width, c.height);
    const r = analyse(c);
    if (!r) {
      setFailed(true);
      return;
    }
    setFailed(false);
    setResult({ ...r, photo: c.toDataURL('image/jpeg', 0.7) });
  };

  const take = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    process(v, v.videoWidth, v.videoHeight, true);
  };

  const upload = async (f: File | undefined) => {
    if (!f) return;
    const bmp = await createImageBitmap(f, { imageOrientation: 'from-image' }).catch(() => null);
    if (!bmp) return setFailed(true);
    process(bmp, bmp.width, bmp.height, false);
    bmp.close();
  };

  const Swatch = ({ c, label }: { c: string | null; label: string }) => (
    <div className="flex items-center gap-2 text-sm">
      <span className="h-7 w-7 rounded-full border-2 border-white/40" style={{ background: c ?? 'transparent' }} />
      <span className="text-cream/80">{label}</span>
      {!c && <span className="text-xs text-cream/40">(not found — keeps current)</span>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="glass-strong fade-in-up relative max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-3xl p-5 shadow-2xl">
        <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-1.5 text-cream/60 hover:bg-white/10" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
        <h2 className="pr-8 font-serif text-3xl">Make me from a selfie</h2>
        <p className="mt-1 text-sm text-cream/60">Your skin tone, hair colour and eye colour are matched from the photo. The photo stays on this device.</p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {(['male', 'female'] as const).map((g) => (
            <button key={g} onClick={() => setGender(g)} className={`rounded-2xl border py-2.5 font-medium transition ${gender === g ? 'border-rose bg-rose/20 text-cream' : 'border-white/12 bg-white/5 text-cream/70'}`}>
              {g === 'male' ? '👦 Boy' : '👧 Girl'}
            </button>
          ))}
        </div>

        <div className="relative mt-4 aspect-[4/3] overflow-hidden rounded-2xl bg-black">
          {result ? (
            <img src={result.photo} alt="Your selfie" className="h-full w-full object-cover" />
          ) : camError ? (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-cream/80">{camError}</div>
          ) : (
            <video ref={attach} playsInline muted autoPlay className="h-full w-full -scale-x-100 object-cover" />
          )}
          {!result && !camError && (
            <>
              <div
                className="pointer-events-none absolute rounded-[50%] border-[3px] border-dashed border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
                style={{ left: `${(OVAL.cx - OVAL.rx) * 100}%`, top: `${(OVAL.cy - OVAL.ry) * 100}%`, width: `${OVAL.rx * 200}%`, height: `${OVAL.ry * 200}%` }}
              />
              <p className="absolute inset-x-0 bottom-2 text-center text-xs text-white/90 drop-shadow">Fit your face inside the oval · good light helps</p>
            </>
          )}
        </div>

        {failed && <p className="mt-3 text-sm text-amber-300">Couldn't read the colours — try again with your face inside the oval and more light.</p>}

        {result && (
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Swatch c={result.skin} label="Skin" />
            <Swatch c={result.hairColor} label="Hair" />
            <Swatch c={result.eyeColor} label="Eyes" />
          </div>
        )}

        <input ref={fileInput} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
        <div className="mt-5 flex flex-wrap gap-2">
          {result ? (
            <>
              <Button variant="ghost" onClick={() => setResult(null)}>
                <RotateCcw className="h-4 w-4" /> Retake
              </Button>
              <div className="flex-1" />
              <Button onClick={() => onApply({ ...result, gender })}>
                <Check className="h-4 w-4" /> Use these colours
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => fileInput.current?.click()}>
                <ImageUp className="h-4 w-4" /> Upload photo
              </Button>
              <div className="flex-1" />
              {!camError && (
                <Button onClick={take} disabled={!stream}>
                  <Camera className="h-4 w-4" /> Take selfie
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
