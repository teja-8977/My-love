import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useTour } from '../context';
import { useGame } from '../store';

export function PhotoViewer({ slot }: { slot: number }) {
  const { photos } = useTour();
  const setOverlay = useGame((s) => s.setOverlay);
  const sorted = [...photos].sort((a, b) => a.slot - b.slot);
  const idx = sorted.findIndex((p) => p.slot === slot);
  const photo = sorted[idx];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!sorted.length) return;
      if (e.key === 'ArrowRight') setOverlay({ type: 'photo', slot: sorted[(idx + 1) % sorted.length].slot });
      if (e.key === 'ArrowLeft') setOverlay({ type: 'photo', slot: sorted[(idx - 1 + sorted.length) % sorted.length].slot });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [idx, sorted, setOverlay]);

  return (
    <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md" onClick={() => setOverlay(null)}>
      <button className="absolute right-5 top-5 rounded-full bg-white/10 p-2 text-cream hover:bg-white/20" onClick={() => setOverlay(null)} aria-label="Close">
        <X className="h-6 w-6" />
      </button>
      {photo ? (
        <figure className="fade-in-up flex max-h-full max-w-5xl flex-col items-center" onClick={(e) => e.stopPropagation()}>
          <div className="rounded-sm border-[10px] border-[#c9a46a] bg-[#fbf7f0] p-4 shadow-[0_30px_100px_rgba(0,0,0,0.7)] sm:p-6">
            <img src={photo.url} alt={photo.caption || `Memory ${photo.slot + 1}`} className="max-h-[70vh] max-w-full object-contain" />
          </div>
          <figcaption className="mt-5 text-center">
            {photo.caption && <p className="font-serif text-2xl italic text-cream sm:text-3xl">{photo.caption}</p>}
            <p className="mt-1 text-xs uppercase tracking-[0.25em] text-blush/70">
              Memory {photo.slot + 1} · {idx + 1} of {sorted.length}
            </p>
          </figcaption>
        </figure>
      ) : (
        <p className="font-serif text-2xl italic text-cream/80" onClick={(e) => e.stopPropagation()}>
          This frame is still waiting for a memory ❤️
        </p>
      )}
      {sorted.length > 1 && (
        <>
          <button
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-cream hover:bg-white/20"
            onClick={(e) => {
              e.stopPropagation();
              setOverlay({ type: 'photo', slot: sorted[(idx - 1 + sorted.length) % sorted.length].slot });
            }}
            aria-label="Previous"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-cream hover:bg-white/20"
            onClick={(e) => {
              e.stopPropagation();
              setOverlay({ type: 'photo', slot: sorted[(idx + 1) % sorted.length].slot });
            }}
            aria-label="Next"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}
      <p className="absolute bottom-4 text-xs text-cream/50">
        <span className="kbd">Esc</span> to close · <span className="kbd">←</span> <span className="kbd">→</span> to browse
      </p>
    </div>
  );
}
