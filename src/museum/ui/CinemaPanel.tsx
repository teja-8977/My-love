import { useEffect, useRef } from 'react';
import { Crown, Film, Maximize, Pause, Play, Volume2, VolumeX, X } from 'lucide-react';
import { useTour } from '../context';
import { useGame } from '../store';
import { useCinema } from '../audio/CinemaController';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function CinemaPanel() {
  const { cinema, videos, isHost } = useTour();
  const ui = useCinema();
  const setOverlay = useGame((s) => s.setOverlay);
  const holder = useRef<HTMLDivElement>(null);

  // show the shared <video> element as the preview inside this panel
  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    el.appendChild(cinema.video);
    return () => {
      if (cinema.video.parentElement === el) el.removeChild(cinema.video);
    };
  }, [cinema]);

  return (
    <div className="pointer-events-auto fixed inset-x-0 bottom-0 z-40 flex justify-center p-3 sm:p-6">
      <div className="glass-strong fade-in-up w-full max-w-3xl rounded-3xl p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-serif text-2xl">
            <Film className="h-5 w-5 text-blush" /> Our Cinema
          </h3>
          <div className="flex items-center gap-2">
            {!isHost && (
              <span className="flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-1 text-xs text-champagne">
                <Crown className="h-3 w-3" /> Host controls playback
              </span>
            )}
            <button onClick={() => setOverlay(null)} className="rounded-full p-1.5 text-cream/60 hover:bg-white/10 hover:text-cream" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
          <div>
            <div ref={holder} className="relative aspect-video overflow-hidden rounded-2xl bg-black" />
            <div className="mt-3 flex items-center gap-3">
              <button
                disabled={!isHost || !videos.length}
                onClick={() => cinema.togglePlay()}
                className="rounded-full bg-rose p-2.5 text-white disabled:opacity-40"
                aria-label={ui.playing ? 'Pause' : 'Play'}
              >
                {ui.playing ? <Pause className="h-5 w-5 fill-white" /> : <Play className="h-5 w-5 fill-white" />}
              </button>
              <input
                type="range"
                min={0}
                max={ui.duration || 1}
                step={0.1}
                value={ui.time}
                disabled={!isHost}
                onChange={(e) => cinema.seek(Number(e.target.value))}
                className="min-w-0 flex-1 disabled:opacity-60"
              />
              <span className="w-24 text-right text-xs tabular-nums text-cream/70">
                {fmt(ui.time)} / {fmt(ui.duration)}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <button onClick={() => cinema.toggleMute()} className="text-cream/80 hover:text-cream" aria-label="Mute">
                {ui.muted || ui.volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
              <input type="range" min={0} max={1} step={0.01} value={ui.muted ? 0 : ui.volume} onChange={(e) => cinema.setVolume(Number(e.target.value))} className="w-32" />
              <div className="flex-1" />
              <button onClick={() => cinema.fullscreen()} className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20">
                <Maximize className="h-4 w-4" /> Fullscreen
              </button>
            </div>
            {ui.needsGesture && (
              <button onClick={() => cinema.unlock()} className="mt-3 w-full rounded-xl bg-rose/20 py-2 text-sm text-blush hover:bg-rose/30">
                Your browser paused playback — click here to watch together
              </button>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.18em] text-blush/80">Choose a film</p>
            {videos.length === 0 && <p className="text-sm text-cream/60">No videos yet. The host can add up to four from the dashboard.</p>}
            {videos.map((v, i) => (
              <button
                key={v.id}
                disabled={!isHost}
                onClick={() => cinema.select(i)}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                  ui.index === i ? 'border-rose bg-rose/15' : 'border-white/10 bg-white/5 hover:border-blush/40'
                } disabled:cursor-default`}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/40 text-xs">{i + 1}</span>
                <span className="truncate">{v.caption || `Video ${v.slot + 1}`}</span>
                {ui.index === i && ui.playing && <span className="ml-auto text-xs text-blush">playing</span>}
              </button>
            ))}
            <p className="pt-2 text-xs text-cream/50">Everyone in the museum watches the same moment together. Sit on a sofa with <span className="kbd">E</span> for the best view.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
