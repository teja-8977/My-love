import { useState } from 'react';
import { Crown, DoorOpen, Heart, UserX, X } from 'lucide-react';
import { useTour } from '../context';
import { useGame } from '../store';
import { DANCES } from '../../avatar/poses';

export interface TourActions {
  leave: () => Promise<void> | void;
  endTour: () => Promise<void> | void;
  transfer: (userId: string) => Promise<void> | void;
  remove: (userId: string) => Promise<void> | void;
}

function Shell({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="glass-strong fade-in-up relative w-full max-w-md rounded-3xl p-6">
        <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-1.5 text-cream/60 hover:bg-white/10" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
        <h3 className="mb-4 pr-8 font-serif text-2xl">{title}</h3>
        {children}
      </div>
    </div>
  );
}

export function ExitDialog({ actions }: { actions: TourActions }) {
  const { isHost, meId } = useTour();
  const players = useGame((s) => s.players).filter((p) => p.id !== meId);
  const setOverlay = useGame((s) => s.setOverlay);
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<void> | void) => {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };
  return (
    <Shell title="Leave the museum?" onClose={() => setOverlay(null)}>
      {!isHost ? (
        <>
          <p className="text-sm text-cream/70">Thank you for walking through these memories ❤️ You can come back any time while the tour is open.</p>
          <div className="mt-6 flex justify-end gap-2">
            <button onClick={() => setOverlay(null)} className="rounded-full bg-white/10 px-4 py-2 text-sm hover:bg-white/20">
              Stay a little longer
            </button>
            <button disabled={!!busy} onClick={() => run('leave', actions.leave)} className="flex items-center gap-2 rounded-full bg-rose px-4 py-2 text-sm text-white">
              <DoorOpen className="h-4 w-4" /> Exit
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-cream/70">You're the host. Choose what happens for everyone else:</p>
          <div className="mt-4 space-y-2">
            {players.length > 0 && (
              <div className="rounded-2xl border border-white/10 p-3">
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-gold">Hand over the museum</p>
                {players.map((p) => (
                  <button
                    key={p.id}
                    disabled={!!busy}
                    onClick={() => run('t' + p.id, () => actions.transfer(p.id))}
                    className="mb-1 flex w-full items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-left text-sm hover:bg-white/10"
                  >
                    <Crown className="h-4 w-4 text-gold" /> Make {p.name} the host, then leave
                  </button>
                ))}
              </div>
            )}
            <button disabled={!!busy} onClick={() => run('leave', actions.leave)} className="w-full rounded-xl bg-white/5 px-3 py-2.5 text-left text-sm hover:bg-white/10">
              Step out — keep the tour open for others
            </button>
            <button disabled={!!busy} onClick={() => run('end', actions.endTour)} className="w-full rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2.5 text-left text-sm text-red-100 hover:bg-red-500/20">
              End the tour for everyone (they'll be notified)
            </button>
          </div>
          <button onClick={() => setOverlay(null)} className="mt-4 w-full rounded-full bg-white/10 py-2 text-sm hover:bg-white/20">
            Cancel
          </button>
        </>
      )}
    </Shell>
  );
}

export function PeoplePanel({ actions }: { actions: TourActions }) {
  const { isHost, meId } = useTour();
  const players = useGame((s) => s.players);
  const setOverlay = useGame((s) => s.setOverlay);
  return (
    <Shell title={`Inside the museum · ${players.length}`} onClose={() => setOverlay(null)}>
      <ul className="space-y-2">
        {players.map((p) => (
          <li key={p.id} className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full font-serif" style={{ background: p.avatar.topColor }}>
              {p.name[0]}
            </span>
            <span className="flex-1 truncate text-sm">
              {p.name} {p.id === meId && <span className="text-cream/50">(you)</span>}
            </span>
            {p.role === 'host' && <Crown className="h-4 w-4 text-gold" />}
            {isHost && p.id !== meId && (
              <button
                onClick={() => confirm(`Remove ${p.name} from the museum?`) && actions.remove(p.id)}
                className="rounded-full p-1.5 text-red-200/80 hover:bg-red-500/20"
                title="Remove participant"
              >
                <UserX className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </Shell>
  );
}

const KEYS: [string, string][] = [
  ['W A S D', 'Walk'],
  ['Shift', 'Run'],
  ['Space', 'Jump'],
  ['E', 'Interact · Sit · Stand'],
  ['F', 'Dance (1–4 change style)'],
  ['Enter', 'Chat'],
  ['Esc', 'Close'],
  ['Drag / Wheel', 'Look around · Zoom'],
];

export function HelpPanel() {
  const setOverlay = useGame((s) => s.setOverlay);
  return (
    <Shell title="How to explore" onClose={() => setOverlay(null)}>
      <ul className="space-y-2">
        {KEYS.map(([k, v]) => (
          <li key={k} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex gap-1">
              {k.split(' ').map((x) => (
                <span key={x} className="kbd">
                  {x}
                </span>
              ))}
            </span>
            <span className="text-cream/70">{v}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex items-center gap-2 text-xs text-cream/50">
        <Heart className="h-3.5 w-3.5 fill-rose text-rose" /> Dances: {DANCES.map((d) => d.name).join(' · ')}
      </p>
    </Shell>
  );
}
