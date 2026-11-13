import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Check, ImageUp, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '../components/ui';

export interface SelfiePhotos {
  frontal: Blob;
  side1: Blob;
  side2: Blob;
  bodyType: 'male' | 'female';
}

const SHOTS = [
  { key: 'frontal', title: 'Front', hint: 'Look straight at the camera. Position your face inside the frame.' },
  { key: 'side1', title: 'Left side', hint: 'Turn your head slowly to your left (about 45°).' },
  { key: 'side2', title: 'Right side', hint: 'Now turn your head to your right (about 45°).' },
] as const;
type ShotKey = (typeof SHOTS)[number]['key'];

const MAX_DIM = 1280;

/** Draw any image source into a JPEG blob (≤1280 px, keeps aspect, optional mirror). */
async function toJpeg(src: CanvasImageSource, w: number, h: number, mirror = false): Promise<Blob> {
  const s = Math.min(1, MAX_DIM / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * s);
  c.height = Math.round(h * s);
  const ctx = c.getContext('2d')!;
  if (mirror) {
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not encode photo'))), 'image/jpeg', 0.88));
}

/**
 * Our own selfie screen (camera starts only after the user asked for it in the previous step).
 * Captures front + left + right photos for the provider; each can be retaken or uploaded instead.
 */
export function SelfieCapture({ onSubmit, onCancel, busy }: { onSubmit: (p: SelfiePhotos) => void; onCancel: () => void; busy?: boolean }) {
  const video = useRef<HTMLVideoElement | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [shots, setShots] = useState<Partial<Record<ShotKey, { blob: Blob; url: string }>>>({});
  const [index, setIndex] = useState(0);
  const [bodyType, setBodyType] = useState<'male' | 'female'>('female');
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let s: MediaStream | null = null;
    let alive = true;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false })
      .then((m) => {
        if (!alive) return m.getTracks().forEach((t) => t.stop());
        s = m;
        setStream(m);
      })
      .catch((e: Error) => setCamError(e?.name === 'NotAllowedError' ? 'Camera permission was not granted.' : 'No camera is available.'));
    if (!navigator.mediaDevices) setCamError('This browser cannot open the camera.');
    return () => {
      alive = false;
      s?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // (re)attach the live stream whenever the preview element mounts
  const attachVideo = useCallback(
    (el: HTMLVideoElement | null) => {
      video.current = el;
      if (el && stream && el.srcObject !== stream) {
        el.srcObject = stream;
        el.play().catch(() => {});
      }
    },
    [stream],
  );

  // revoke preview URLs on unmount
  useEffect(() => () => Object.values(shots).forEach((s) => s && URL.revokeObjectURL(s.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const store = useCallback((key: ShotKey, blob: Blob) => {
    setShots((prev) => {
      if (prev[key]) URL.revokeObjectURL(prev[key]!.url);
      return { ...prev, [key]: { blob, url: URL.createObjectURL(blob) } };
    });
    const nextIdx = SHOTS.findIndex((s, i) => i > SHOTS.findIndex((x) => x.key === key) && !shotsRef.current[s.key]);
    if (nextIdx >= 0) setIndex(nextIdx);
  }, []);
  const shotsRef = useRef(shots);
  shotsRef.current = shots;

  const take = async () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    setFlash(true);
    setTimeout(() => setFlash(false), 180);
    // un-mirror: the preview is mirrored for comfort, the photo must be the real orientation
    const blob = await toJpeg(v, v.videoWidth, v.videoHeight, false);
    store(SHOTS[index].key, blob);
  };

  const upload = async (f: File | undefined) => {
    if (!f) return;
    const bmp = await createImageBitmap(f, { imageOrientation: 'from-image' }).catch(() => null);
    if (!bmp) return;
    const blob = await toJpeg(bmp, bmp.width, bmp.height);
    bmp.close();
    store(SHOTS[index].key, blob);
  };

  const shot = SHOTS[index];
  const done = SHOTS.every((s) => shots[s.key]);

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_220px]">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-black">
        {camError ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-cream/80">
            <Camera className="h-8 w-8 text-blush" />
            {camError} You can upload photos instead.
          </div>
        ) : shots[shot.key] ? (
          <img src={shots[shot.key]!.url} alt={`${shot.title} photo`} className="h-full w-full object-cover" />
        ) : (
          <video ref={attachVideo} muted playsInline className="h-full w-full -scale-x-100 object-cover" />
        )}
        {/* face-positioning guide */}
        {!shots[shot.key] && !camError && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[72%] w-[42%] rounded-[50%] border-[3px] border-dashed border-white/85 shadow-[0_0_0_9999px_rgba(0,0,0,0.38)]" />
          </div>
        )}
        {flash && <div className="absolute inset-0 bg-white/80" />}
        <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent p-3 text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-blush">
            Photo {index + 1} of 3 · {shot.title}
          </p>
          <p className="text-sm text-cream">{shot.hint}</p>
        </div>
        <div className="absolute inset-x-0 bottom-0 flex justify-center gap-2 bg-gradient-to-t from-black/70 to-transparent p-3">
          {shots[shot.key] ? (
            <Button size="sm" variant="ghost" onClick={() => setShots((p) => ({ ...p, [shot.key]: undefined }))}>
              <RotateCcw className="h-4 w-4" /> Retake
            </Button>
          ) : (
            !camError && (
              <Button onClick={take} disabled={!stream}>
                <Camera className="h-4 w-4" /> TAKE SELFIE
              </Button>
            )
          )}
          <Button size="sm" variant="ghost" onClick={() => fileInput.current?.click()}>
            <ImageUp className="h-4 w-4" /> Upload photo
          </Button>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => upload(e.target.files?.[0]).finally(() => (e.target.value = ''))} />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2 md:grid-cols-1">
          {SHOTS.map((s, i) => (
            <button
              key={s.key}
              onClick={() => setIndex(i)}
              className={`relative flex items-center gap-2 overflow-hidden rounded-xl border p-1.5 text-left text-xs ${i === index ? 'border-rose bg-rose/10' : 'border-white/10 bg-white/5'}`}
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black/40">
                {shots[s.key] ? <img src={shots[s.key]!.url} alt="" className="h-full w-full object-cover" /> : <Camera className="h-4 w-4 text-cream/40" />}
              </span>
              <span className="hidden md:block">{s.title}</span>
              {shots[s.key] && <Check className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-emerald-300" />}
            </button>
          ))}
        </div>
        <div>
          <p className="mb-1.5 text-[10px] uppercase tracking-[0.2em] text-blush/80">Body</p>
          <div className="flex gap-2">
            {(['female', 'male'] as const).map((b) => (
              <button key={b} onClick={() => setBodyType(b)} className={`flex-1 rounded-full border px-3 py-1.5 text-sm ${bodyType === b ? 'border-rose bg-rose/20' : 'border-white/12 bg-white/5'}`}>
                {b === 'female' ? 'Feminine' : 'Masculine'}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-cream/50">Tip: good light on your face, no glasses or hair covering it, neutral expression.</p>
        <div className="mt-auto flex flex-col gap-2">
          <Button
            disabled={!done || busy}
            loading={busy}
            onClick={() => onSubmit({ frontal: shots.frontal!.blob, side1: shots.side1!.blob, side2: shots.side2!.blob, bodyType })}
          >
            <Sparkles className="h-4 w-4" /> Create my 3D avatar
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Back
          </Button>
        </div>
      </div>
    </div>
  );
}
