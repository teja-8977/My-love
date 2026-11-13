import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';

interface Detector {
  detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]>;
}

/** Camera QR scanner using the browser's BarcodeDetector (Chrome, Edge, Android, Safari 17+). */
export function QrScanner({ onResult, onClose }: { onResult: (text: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    if (!BD) {
      setError("This browser can't scan here. Open your phone's camera app and point it at the QR code — it opens the invitation directly.");
      return;
    }
    const detector = new BD({ formats: ['qr_code'] });
    let stream: MediaStream | null = null;
    let raf = 0;
    let alive = true;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then(async (s) => {
        stream = s;
        if (!video.current || !alive) return;
        video.current.srcObject = s;
        await video.current.play();
        const loop = async () => {
          if (!alive || !video.current) return;
          try {
            const codes = await detector.detect(video.current);
            if (codes[0]?.rawValue) {
              onResult(codes[0].rawValue);
              return;
            }
          } catch {
            /* frame not ready */
          }
          raf = requestAnimationFrame(loop);
        };
        loop();
      })
      .catch(() => setError('Camera access was blocked. You can type the room code instead.'));
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onResult]);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-black">
      <button type="button" onClick={onClose} className="absolute right-2 top-2 z-10 rounded-full bg-black/60 p-1.5 text-cream" aria-label="Close scanner">
        <X className="h-4 w-4" />
      </button>
      {error ? (
        <div className="flex min-h-40 flex-col items-center justify-center gap-2 p-5 text-center text-sm text-cream/80">
          <Camera className="h-6 w-6 text-blush" />
          {error}
        </div>
      ) : (
        <div className="relative">
          <video ref={video} muted playsInline className="aspect-square w-full object-cover" />
          <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-blush/80 shadow-[0_0_0_999px_rgba(0,0,0,0.35)]" />
        </div>
      )}
    </div>
  );
}
