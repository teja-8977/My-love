import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize, Minimize, X } from 'lucide-react';
import { useTour } from '../context';
import { useGame } from '../store';

const canFullscreen = () => typeof document !== 'undefined' && !!document.documentElement.requestFullscreen;

/** Full-page photo viewer: P / E opens it, ← → or swipe to browse, P / Esc / ✕ to close. */
export function PhotoViewer({ slot }: { slot: number }) {
  const { photos } = useTour();
  const setOverlay = useGame((s) => s.setOverlay);
  const sorted = [...photos].sort((a, b) => a.slot - b.slot);
  const idx = sorted.findIndex((p) => p.slot === slot);
  const photo = sorted[idx];
  const [fs, setFs] = useState(() => !!document.fullscreenElement);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  const go = (d: 1 | -1) => sorted.length && setOverlay({ type: 'photo', slot: sorted[(Math.max(0, idx) + d + sorted.length) % sorted.length].slot });
  const close = () => setOverlay(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // keep the button in sync, and leave browser full screen when the viewer closes
  useEffect(() => {
    const on = () => setFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => {
      document.removeEventListener('fullscreenchange', on);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  // preload the neighbours so browsing is instant
  useEffect(() => {
    for (const d of [1, -1]) {
      const p = sorted[(idx + d + sorted.length) % sorted.length];
      if (p) new Image().src = p.url;
    }
  }, [idx, sorted]);

  const toggleFs = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-40 flex select-none flex-col items-center justify-center bg-black/95"
      onClick={() => {
        if (swiped.current) swiped.current = false;
        else close();
      }}
      onPointerDown={(e) => (swipe.current = { x: e.clientX, y: e.clientY })}
      onPointerUp={(e) => {
        const s = swipe.current;
        swipe.current = null;
        if (!s) return;
        const dx = e.clientX - s.x;
        const dy = e.clientY - s.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) {
          swiped.current = true;
          setTimeout(() => (swiped.current = false), 400);
          go(dx < 0 ? 1 : -1);
        }
      }}
      style={{ touchAction: 'pan-y' }}
    >
      <div className="absolute right-3 top-3 z-10 flex gap-2">
        {canFullscreen() && (
          <button className="rounded-full bg-white/10 p-2.5 text-cream hover:bg-white/20" onClick={toggleFs} aria-label={fs ? 'Exit full screen' : 'Full screen'}>
            {fs ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </button>
        )}
        <button
          className="rounded-full bg-white/10 p-2.5 text-cream hover:bg-white/20"
          onClick={(e) => {
            e.stopPropagation();
            close();
          }}
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {photo ? (
        <figure className="fade-in-up flex h-full w-full flex-col items-center justify-center px-2 py-14 sm:px-16" onClick={(e) => e.stopPropagation()}>
          <img key={photo.url} src={photo.url} alt={photo.caption || `Memory ${photo.slot + 1}`} draggable={false} className="min-h-0 max-w-full flex-1 object-contain shadow-[0_30px_100px_rgba(0,0,0,0.7)]" />
          <figcaption className="mt-3 shrink-0 text-center">
            {photo.caption && <p className="font-serif text-xl italic text-cream sm:text-3xl">{photo.caption}</p>}
            <p className="mt-1 text-xs uppercase tracking-[0.25em] text-blush/70">
              Memory {photo.slot + 1} · {idx + 1} of {sorted.length}
            </p>
          </figcaption>
        </figure>
      ) : (
        <p className="font-serif text-2xl italic text-cream/80">This frame is still waiting for a memory ❤️</p>
      )}

      {sorted.length > 1 && (
        <>
          <button
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-cream hover:bg-white/20"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            aria-label="Previous"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-cream hover:bg-white/20"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            aria-label="Next"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}
      <p className="absolute bottom-3 hidden text-xs text-cream/50 [@media(hover:hover)]:block">
        <span className="kbd">←</span> <span className="kbd">→</span> browse · <span className="kbd">P</span> or <span className="kbd">Esc</span> close
      </p>
      <p className="absolute bottom-3 text-xs text-cream/50 [@media(hover:hover)]:hidden">Swipe to browse · tap outside to close</p>
    </div>
  );
}
