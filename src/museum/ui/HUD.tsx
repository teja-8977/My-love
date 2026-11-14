import { useEffect, useState } from 'react';
import { ArrowRight, CircleHelp, DoorOpen, Film, Map as MapIcon, Users, Wifi, WifiOff } from 'lucide-react';
import { useGame } from '../store';
import { teleportTo } from '../player/LocalPlayer';
import { ROOM_BY_ID } from '../layout';
import { useTour } from '../context';
import { DANCES } from '../../avatar/poses';
import { ChatBox } from './ChatBox';
import { PhotoViewer } from './PhotoViewer';
import { CinemaPanel } from './CinemaPanel';
import { MusicPanel } from './MusicPanel';
import { ExitDialog, HelpPanel, PeoplePanel, type TourActions } from './Panels';
import { TouchControls } from './TouchControls';
import { BirthdayLetter } from './BirthdayLetter';

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

/** Directional quick-travel between the museum's areas. */
const DESTINATIONS: { id: keyof typeof ROOM_BY_ID; x: number; z: number; yaw: number }[] = [
  { id: 'portico', x: 0, z: 24.2, yaw: Math.PI },
  { id: 'entrance', x: 0, z: 15, yaw: Math.PI },
  { id: 'welcome', x: 0, z: 4.5, yaw: Math.PI },
  { id: 'gallery', x: 0, z: -15.5, yaw: Math.PI },
  { id: 'cinema', x: -25, z: -4, yaw: Math.PI },
  { id: 'forever', x: -25, z: 6, yaw: 0 },
  { id: 'celebration', x: 25, z: -4, yaw: Math.PI },
  { id: 'final', x: 25, z: 6, yaw: 0 },
];

function GoTo() {
  const [open, setOpen] = useState(false);
  const room = useGame((s) => s.room);
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1.5 rounded-full glass-strong px-3 py-2 text-sm hover:bg-white/10" aria-label="Go to a room">
        <MapIcon className="h-4 w-4 text-blush" /> <span className="hidden sm:inline">Go to</span>
      </button>
      {open && (
        <div className="glass-strong fade-in-up absolute right-0 top-11 z-40 w-60 rounded-2xl p-2">
          {DESTINATIONS.map((d) => {
            const r = ROOM_BY_ID[d.id];
            const here = room === d.id;
            return (
              <button
                key={d.id}
                onClick={() => {
                  teleportTo(d.x, d.z, d.yaw);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-white/10 ${here ? 'text-blush' : 'text-cream'}`}
              >
                <ArrowRight className="h-4 w-4 shrink-0 text-gold" />
                <span className="min-w-0 flex-1 truncate">{r.name}</span>
                {here && <span className="text-[10px] uppercase tracking-wider">here</span>}
              </button>
            );
          })}
        </div>
      )}
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
          <GoTo />
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
        <button
          onClick={() => onTouchAction('E')}
          className="fade-in-up pointer-events-auto absolute bottom-28 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full glass-strong px-4 py-2 text-sm hover:bg-white/10"
        >
          <span className="kbd">{prompt.key}</span> {prompt.text}
        </button>
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
      {/* DANCE / STOP DANCING (desktop; phones have the 💃 button) */}
      {!overlay && (
        <button
          onClick={() => onTouchAction('F')}
          className={`pointer-events-auto absolute bottom-28 right-4 hidden items-center gap-1.5 rounded-full px-4 py-2 text-sm [@media(hover:hover)]:flex ${dancing ? 'bg-rose text-white' : 'glass-strong hover:bg-white/10'}`}
        >
          {dancing ? 'Stop dancing' : '💃 Dance'}
        </button>
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
      {overlay?.type === 'letter' && <BirthdayLetter />}
    </div>
  );
}
