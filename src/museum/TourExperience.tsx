import { useEffect, useRef, useState } from 'react';
import type { AvatarConfig } from '../avatar/config';
import { DANCES } from '../avatar/poses';
import { MuseumScene } from './MuseumScene';
import { HUD } from './ui/HUD';
import type { TourActions } from './ui/Panels';
import type { TourSession } from './context';
import { TourContext } from './context';
import { useGame } from './store';
import { clearInput, input, isMoveKey } from './player/input';
import { debugEnabled, interact, localPlayer } from './player/LocalPlayer';
import { useCinema } from './audio/CinemaController';
import { useMusic } from './audio/MusicEngine';
import type { Interactable } from './layout';
import { PARTY_WORLD } from './layout';

/**
 * Everything inside a running tour: 3D world, HUD, keyboard and realtime event wiring.
 * Shared by the real multiplayer tour and the offline solo demo.
 */
function JourneyTitle() {
  const [show] = useState(() => {
    try {
      const v = sessionStorage.getItem('lm-journey-start');
      sessionStorage.removeItem('lm-journey-start');
      return v === '1';
    } catch {
      return false;
    }
  });
  if (!show) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[30%] z-30 text-center">
      <p className="journey-title font-script text-4xl text-champagne drop-shadow-[0_2px_24px_rgba(0,0,0,0.9)] sm:text-6xl">Your journey of memories begins now ❤️</p>
    </div>
  );
}

export function TourExperience({ session, avatar, name, actions, banner }: { session: TourSession; avatar: AvatarConfig; name: string; actions: TourActions; banner?: React.ReactNode }) {
  const occupied = useRef(new Set<string>());
  const { net, music, cinema } = session;

  // automated-test hooks (only in a browser that opted in with ?debug / localStorage lm-debug=1)
  useEffect(() => {
    if (!debugEnabled()) return;
    const w = window as unknown as Record<string, unknown>;
    const events: string[] = [];
    const offs = [net.on('join', (p) => events.push(`join:${p.name}`)), net.on('leave', (p) => events.push(`leave:${p.name}`))];
    w.__lmTour = { video: cinema.video, cinema: () => useCinema.getState(), music: () => useMusic.getState(), game: () => useGame.getState(), remotes: () => net.remotes.size, events };
    return () => {
      offs.forEach((o) => o());
      delete w.__lmTour;
    };
  }, [cinema, net]);

  // seats taken by other people
  useEffect(() => {
    const t = setInterval(() => {
      const s = new Set<string>();
      net.remotes.forEach((r) => r.target?.s && s.add(r.target.s));
      occupied.current = s;
    }, 200);
    return () => clearInterval(t);
  }, [net]);

  // realtime events → UI
  useEffect(() => {
    const g = useGame.getState;
    const offs = [
      net.on('party', ({ x, z }) => g().addConfetti(x, z)),
      net.on('join', (p) => g().notify(`${p.name} entered the museum ❤️`)),
      net.on('leave', (p) => g().notify(p.role === 'host' ? `${p.name} (host) disconnected — the tour stays open` : `${p.name} left the museum`)),
    ];
    return () => offs.forEach((o) => o());
  }, [net]);

  // keyboard
  useEffect(() => {
    const onInteract = (i: Interactable) => {
      const g = useGame.getState();
      if (i.kind === 'photo') g.setOverlay({ type: 'photo', slot: i.slot });
      else if (i.kind === 'cinema') {
        cinema.unlock();
        g.setOverlay({ type: 'cinema' });
      } else if (i.kind === 'music') g.setOverlay({ type: 'music' });
      else if (i.kind === 'exit') g.setOverlay({ type: 'exit' });
      else if (i.kind === 'party') {
        const x = PARTY_WORLD.x;
        const z = PARTY_WORLD.z;
        net.sendParty(x, z);
        g.addConfetti(x, z);
      }
    };

    const toggleDance = () => {
      const g = useGame.getState();
      if (g.seated || !localPlayer.grounded) return;
      g.set({ dancing: !g.dancing });
    };

    const down = (e: KeyboardEvent) => {
      music.unlock();
      const g = useGame.getState();
      const target = e.target as HTMLElement | null;
      if (g.chatOpen || target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;

      if (e.code === 'Escape') {
        if (g.overlay) g.setOverlay(null);
        return;
      }
      const passive = g.overlay?.type === 'cinema' || g.overlay?.type === 'music';
      if (g.overlay && !passive) return;

      if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault();
        clearInput();
        g.set({ chatOpen: true });
        return;
      }
      if (e.code === 'KeyE' && !e.repeat) {
        if (passive) g.setOverlay(null);
        else interact(occupied.current, onInteract);
        return;
      }
      if (e.code === 'KeyF' && !e.repeat) return toggleDance();
      if (/^Digit[1-4]$/.test(e.code)) {
        const n = Number(e.code.slice(5)) - 1;
        if (n < DANCES.length) g.set({ danceStyle: n, dancing: !g.seated });
        return;
      }
      if (e.code === 'KeyH') return g.setOverlay({ type: 'help' });
      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) input.jumpQueued = true;
      }
      if (isMoveKey(e.code)) {
        if (e.code.startsWith('Arrow')) e.preventDefault();
        input.keys.add(e.code);
      }
    };
    const up = (e: KeyboardEvent) => input.keys.delete(e.code);
    const blur = () => clearInput();
    const click = () => music.unlock();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    window.addEventListener('pointerdown', click);
    (window as unknown as { __lmTouch?: (a: string) => void }).__lmTouch = (a: string) => {
      const g = useGame.getState();
      if (a === 'E') interact(occupied.current, onInteract);
      else if (a === 'F') toggleDance();
      else if (a === 'chat') g.set({ chatOpen: true });
    };
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      window.removeEventListener('pointerdown', click);
      clearInput();
    };
  }, [net, music, cinema]);

  return (
    <TourContext.Provider value={session}>
      <div className="fixed inset-0 overflow-hidden bg-ink">
        <MuseumScene session={session} avatar={avatar} name={name} occupiedRef={occupied} />
        <HUD actions={actions} onTouchAction={(a) => (window as unknown as { __lmTouch?: (a: string) => void }).__lmTouch?.(a)} />
        <JourneyTitle />
        {banner}
      </div>
    </TourContext.Provider>
  );
}
