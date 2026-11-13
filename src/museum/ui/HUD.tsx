import { useEffect, useState } from 'react';
import { CircleHelp, DoorOpen, Film, Users, Wifi, WifiOff } from 'lucide-react';
import { useGame } from '../store';
import { ROOM_BY_ID } from '../layout';
import { useTour } from '../context';
import { DANCES } from '../../avatar/poses';
import { ChatBox } from './ChatBox';
import { PhotoViewer } from './PhotoViewer';
import { CinemaPanel } from './CinemaPanel';
import { MusicPanel } from './MusicPanel';
import { ExitDialog, HelpPanel, PeoplePanel, type TourActions } from './Panels';
import { TouchControls } from './TouchControls';

function RoomTitle() {
  const room = useGame((s) => s.room);
  const [shown, setShown] = useState<string | null>(null);
  useEffect(() => {
    if (!room) return;
    setShown(room);
    const t = setTimeout(() => setShown(null), 3500);
    return () => clearTimeout(t);
  }, [room]);
  if (!shown) return null;
  const r = ROOM_BY_ID[shown as keyof typeof ROOM_BY_ID];
  return (
    <div key={shown} className="fade-in-up pointer-events-none absolute left-1/2 top-[18%] -translate-x-1/2 text-center">
      <p className="text-xs uppercase tracking-[0.4em] text-champagne/90 drop-shadow">{r.subtitle}</p>
      <p className="font-serif text-4xl text-cream drop-shadow-[0_2px_20px_rgba(0,0,0,0.8)] sm:text-5xl">{r.name}</p>
    </div>
  );
}

export function HUD({ actions, onTouchAction }: { actions: TourActions; onTouchAction: (a: 'E' | 'F' | 'chat') => void }) {
  const { museum } = useTour();
  const overlay = useGame((s) => s.overlay);
  const prompt = useGame((s) => s.prompt);
  const notices = useGame((s) => s.notices);
  const players = useGame((s) => s.players);
  const connection = useGame((s) => s.connection);
  const dancing = useGame((s) => s.dancing);
  const danceStyle = useGame((s) => s.danceStyle);
  const room = useGame((s) => s.room);
  const setOverlay = useGame((s) => s.setOverlay);
  const mouseLook = useGame((s) => s.mouseLook);

  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      {/* top bar */}
      <div className="absolute left-4 right-4 top-4 flex items-start justify-between gap-3">
        <div className="pointer-events-auto rounded-2xl glass-strong px-4 py-2">
          <p className="font-serif text-lg leading-tight">{museum.name}</p>
          <p className="flex items-center gap-1.5 text-xs text-cream/60">
            {connection === 'online' ? <Wifi className="h-3 w-3 text-emerald-300" /> : <WifiOff className="h-3 w-3 text-amber-300" />}
            {connection === 'online' ? 'Connected' : connection === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
          </p>
        </div>
        <div className="pointer-events-auto flex gap-2">
          {room === 'cinema' && (
            <button onClick={() => setOverlay({ type: 'cinema' })} className="flex items-center gap-1.5 rounded-full glass-strong px-3 py-2 text-sm hover:bg-white/10">
              <Film className="h-4 w-4 text-blush" /> Cinema
            </button>
          )}
          <button onClick={() => setOverlay({ type: 'people' })} className="flex items-center gap-1.5 rounded-full glass-strong px-3 py-2 text-sm hover:bg-white/10">
            <Users className="h-4 w-4 text-blush" /> {players.length}
          </button>
          <button onClick={() => setOverlay({ type: 'help' })} className="rounded-full glass-strong p-2 hover:bg-white/10" aria-label="Controls">
            <CircleHelp className="h-5 w-5" />
          </button>
          <button onClick={() => setOverlay({ type: 'exit' })} className="rounded-full glass-strong p-2 hover:bg-white/10" aria-label="Exit">
            <DoorOpen className="h-5 w-5" />
          </button>
        </div>
      </div>

      <RoomTitle />

      {/* notices */}
      <div className="absolute left-1/2 top-20 flex -translate-x-1/2 flex-col items-center gap-2">
        {notices.map((n) => (
          <div key={n.id} className="fade-in-up rounded-full border border-rose/30 bg-[#3a1220]/90 px-4 py-2 text-sm text-blush shadow-lg">
            {n.text}
          </div>
        ))}
      </div>

      {/* interaction prompt */}
      {prompt && !overlay && (
        <div className="fade-in-up absolute bottom-28 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full glass-strong px-4 py-2 text-sm">
          <span className="kbd">{prompt.key}</span> {prompt.text}
        </div>
      )}

      {!overlay && (
        <div className="absolute bottom-16 right-4 hidden rounded-full glass-strong px-3 py-1.5 text-xs text-cream/80 [@media(hover:hover)]:block">
          {mouseLook ? (
            <>
              Mouse look on · <span className="kbd">Esc</span> to free the cursor
            </>
          ) : (
            <>🖱 Click the scene to look around with your mouse (or drag)</>
          )}
        </div>
      )}
      <p className="absolute bottom-[13.5rem] left-0 right-0 text-center text-[11px] text-cream/50 [@media(hover:hover)]:hidden">Drag anywhere to look around · pinch to zoom</p>

      {dancing && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 rounded-full glass-strong px-3 py-1.5 text-xs text-cream/80">
          {DANCES[danceStyle].emoji} {DANCES[danceStyle].name} · <span className="kbd">1</span>–<span className="kbd">4</span> change · <span className="kbd">F</span> stop
        </div>
      )}

      {!overlay && (
        <div className="absolute bottom-4 right-4 hidden gap-2 text-xs text-cream/50 [@media(hover:hover)]:flex">
          <span className="kbd">WASD</span> move <span className="kbd">Shift</span> run <span className="kbd">E</span> interact <span className="kbd">F</span> dance
        </div>
      )}

      <ChatBox />
      <TouchControls onAction={onTouchAction} />

      {overlay?.type === 'photo' && <PhotoViewer slot={overlay.slot} />}
      {overlay?.type === 'cinema' && <CinemaPanel />}
      {overlay?.type === 'music' && <MusicPanel />}
      {overlay?.type === 'exit' && <ExitDialog actions={actions} />}
      {overlay?.type === 'help' && <HelpPanel />}
      {overlay?.type === 'people' && <PeoplePanel actions={actions} />}
    </div>
  );
}
