import { Music2, Square, X, Volume2 } from 'lucide-react';
import { useTour } from '../context';
import { useGame } from '../store';
import { TRACKS, useMusic } from '../audio/MusicEngine';
import { DANCES } from '../../avatar/poses';

export function MusicPanel() {
  const { music } = useTour();
  const { track, volume } = useMusic();
  const setOverlay = useGame((s) => s.setOverlay);
  const set = useGame((s) => s.set);
  const danceStyle = useGame((s) => s.danceStyle);
  return (
    <div className="pointer-events-auto fixed inset-x-0 bottom-0 z-40 flex justify-center p-4">
      <div className="glass-strong fade-in-up w-full max-w-md rounded-3xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-serif text-2xl">
            <Music2 className="h-5 w-5 text-blush" /> Celebration music
          </h3>
          <button onClick={() => setOverlay(null)} className="rounded-full p-1.5 text-cream/60 hover:bg-white/10" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-2">
          {TRACKS.map((t, i) => (
            <button
              key={t.name}
              onClick={() => {
                music.unlock();
                music.play(i);
              }}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                track === i ? 'border-rose bg-rose/15' : 'border-white/10 bg-white/5 hover:border-blush/40'
              }`}
            >
              <span>
                <span className="block font-medium">{t.name}</span>
                <span className="text-xs text-cream/60">{t.mood}</span>
              </span>
              {track === i && <span className="flex gap-0.5">{[0, 1, 2].map((k) => <span key={k} className="h-3 w-1 animate-pulse rounded bg-rose" style={{ animationDelay: `${k * 150}ms` }} />)}</span>}
            </button>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={() => music.play(null)} disabled={track === null} className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20 disabled:opacity-40">
            <Square className="h-3.5 w-3.5" /> Stop
          </button>
          <Volume2 className="h-4 w-4 text-cream/70" />
          <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => music.setVolume(Number(e.target.value))} className="flex-1" />
        </div>
        <div className="mt-5 border-t border-white/10 pt-4">
          <p className="mb-2 text-xs uppercase tracking-[0.18em] text-blush/80">Your dance — press F</p>
          <div className="grid grid-cols-2 gap-2">
            {DANCES.map((d) => (
              <button
                key={d.id}
                onClick={() => {
                  set({ danceStyle: d.id, dancing: true });
                  setOverlay(null);
                }}
                className={`rounded-xl border px-3 py-2 text-sm ${danceStyle === d.id ? 'border-gold bg-gold/15' : 'border-white/10 bg-white/5 hover:border-gold/40'}`}
              >
                {d.emoji} {d.name}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-3 text-xs text-cream/50">Music is shared — everyone hears the same song.</p>
      </div>
    </div>
  );
}
