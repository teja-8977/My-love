import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Check, ChevronDown, ChevronUp, Copy, Crown, Heart, Images, Play, Shirt, X } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { useMuseumLive } from '../lib/useMuseumLive';
import { inviteUrl, regenerateInvite, setMemberStatus, updateMuseum, updateMyMember, welcomeLine } from '../lib/api';
import type { Member } from '../lib/types';
import { Button, Card, FullscreenLoader, Logo, PageShell, errMsg, toast } from '../components/ui';
import InviteCard from '../components/InviteCard';
import { defaultAvatar } from '../avatar/config';
import type { EntranceMode, EntrancePerson } from '../entrance/EntranceScene';
import { countdownTick, doorsChime, unlockSfx } from '../entrance/sfx';

const EntranceScene = lazy(() => import('../entrance/EntranceScene'));

type Phase = 'waiting' | 'countdown' | 'enter';

/** Realtime lobby: presence (who is here) + host-driven countdown broadcasts. */
function useLobbyChannel(museumId: string | undefined, enabled: boolean, me: { id: string; name: string; role: string } | null) {
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [count, setCount] = useState<number | null>(null);
  const [go, setGo] = useState(false);
  const channel = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!museumId || !enabled || !me) return;
    let alive = true;
    let ch: RealtimeChannel | null = null;
    (async () => {
      await supabase.realtime.setAuth();
      if (!alive) return;
      ch = supabase.channel(`museum:${museumId}:lobby`, { config: { private: true, presence: { key: me.id }, broadcast: { self: false } } });
      channel.current = ch;
      ch.on('presence', { event: 'sync' }, () => setOnline(new Set(Object.keys(ch!.presenceState()))));
      ch.on('broadcast', { event: 'countdown' }, ({ payload }) => {
        const n = Number((payload as { n: number }).n);
        if (n >= 1 && n <= 5) {
          setCount(n);
          countdownTick(n);
        }
      });
      ch.on('broadcast', { event: 'go' }, () => setGo(true));
      ch.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await ch!.track({ id: me.id, name: me.name, role: me.role, t: Date.now() });
      });
    })();
    return () => {
      alive = false;
      channel.current = null;
      if (ch) supabase.removeChannel(ch);
    };
  }, [museumId, enabled, me?.id, me?.name, me?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = useCallback((event: string, payload: object) => {
    channel.current?.send({ type: 'broadcast', event, payload }).catch(() => {});
  }, []);

  return { online, count, setCount, go, setGo, send };
}

export default function LobbyPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user, profile } = useAuth();
  const { museum, members, reload, setMuseum } = useMuseumLive(id);
  const [phase, setPhase] = useState<Phase>('waiting');
  const [panelOpen, setPanelOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const synced = useRef(false);
  const running = useRef(false);

  const me = members.find((m) => m.user_id === user?.id);
  const isHost = !!museum && museum.host_id === user?.id;
  const accepted = members.filter((m) => m.status === 'accepted').sort((a, b) => (a.role === 'host' ? -1 : b.role === 'host' ? 1 : a.created_at.localeCompare(b.created_at)));
  const pending = members.filter((m) => m.status === 'pending');
  const canListen = isHost || me?.status === 'accepted';
  const lobbyMe = useMemo(() => (user ? { id: user.id, name: profile?.display_name || me?.display_name || 'Guest', role: isHost ? 'host' : 'guest' } : null), [user, profile?.display_name, me?.display_name, isHost]);
  const { online, count, setCount, go, send } = useLobbyChannel(id, canListen, lobbyMe);

  // keep my lobby avatar/name in sync with my profile
  useEffect(() => {
    if (!id || !profile?.avatar || !me || synced.current) return;
    synced.current = true;
    if (JSON.stringify(me.avatar) !== JSON.stringify(profile.avatar) || me.display_name !== profile.display_name) {
      updateMyMember(id, profile.display_name, profile.avatar).then(reload).catch(() => {});
    }
  }, [id, profile, me, reload]);

  // new arrivals → refresh the member list immediately
  useEffect(() => {
    reload();
  }, [online.size, reload]);

  // notify host of join requests
  const prevPending = useRef(0);
  useEffect(() => {
    if (isHost && pending.length > prevPending.current) toast(`${pending[pending.length - 1].display_name || 'Someone'} wants to join ❤️`, 'love');
    prevPending.current = pending.length;
  }, [pending, isHost]);

  // guests: enter when the host says go (broadcast) or the database says the tour is live
  const guestLive = museum?.status === 'live' && me?.status === 'accepted' && !isHost;
  useEffect(() => {
    if (phase === 'enter' || running.current) return;
    if (go || guestLive) {
      setCount(null);
      setPhase('enter');
      doorsChime();
    }
  }, [go, guestLive, phase, setCount]);

  useEffect(() => {
    if (count !== null && phase === 'waiting') setPhase('countdown');
  }, [count, phase]);

  const startMuseum = async () => {
    if (!museum || running.current) return;
    unlockSfx();
    running.current = true;
    setPhase('countdown');
    try {
      for (let n = 5; n >= 1; n--) {
        send('countdown', { n });
        setCount(n);
        countdownTick(n);
        await new Promise((r) => setTimeout(r, 1000));
      }
      const m = await updateMuseum(museum.id, { status: 'live' });
      setMuseum(m);
      send('go', {});
      setCount(null);
      setPhase('enter');
      doorsChime();
    } catch (e) {
      toast(errMsg(e), 'error');
      setPhase('waiting');
      setCount(null);
    } finally {
      running.current = false;
    }
  };

  const onEntered = useCallback(() => {
    try {
      sessionStorage.setItem('lm-journey-start', '1');
    } catch {
      /* ignore */
    }
    if (museum) nav(`/museum/${museum.id}/tour`);
  }, [museum, nav]);

  const act = async (m: Member, status: Member['status']) => {
    if (!museum) return;
    try {
      await setMemberStatus(museum.id, m.user_id, status);
      if (status === 'accepted') toast(`${m.display_name || 'Guest'} is in ❤️`, 'love');
      reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  const people: EntrancePerson[] = useMemo(() => {
    const list = isHost ? [...accepted, ...pending] : accepted.length ? accepted : me ? [me] : [];
    return list.slice(0, 10).map((m) => {
      const ready = online.has(m.user_id) || m.user_id === user?.id;
      return {
        id: m.user_id,
        name: m.display_name || 'Guest',
        avatar: m.user_id === user?.id && profile?.avatar ? profile.avatar : m.avatar ?? defaultAvatar(),
        tag: m.status === 'pending' ? 'Wants to join' : `${m.role === 'host' ? 'Host' : 'Joined'} · ${ready ? 'Ready' : 'Away'}`,
        dim: m.status === 'pending' || !ready,
      };
    });
  }, [accepted, pending, me, isHost, online, user?.id, profile?.avatar]);

  if (museum === undefined) return <FullscreenLoader label="Opening the lobby…" />;
  if (museum === null)
    return (
      <PageShell>
        <Logo />
        <Card className="mx-auto mt-20 max-w-md text-center">
          <h1 className="font-serif text-3xl">This museum is private</h1>
          <p className="mt-2 text-cream/60">You need an invitation from the host to see it.</p>
          <Button className="mt-6" onClick={() => nav('/')}>
            Back to the entrance
          </Button>
        </Card>
      </PageShell>
    );

  const host = members.find((m) => m.role === 'host');
  const mode: EntranceMode = phase === 'enter' ? 'enter' : phase === 'countdown' ? 'countdown' : 'idle';
  const roomCode = museum.room_code ?? museum.invite_code.slice(0, 6).toUpperCase();

  return (
    <div className="fixed inset-0 overflow-hidden bg-ink" onPointerDown={unlockSfx}>
      <Suspense fallback={<div className="romantic-bg absolute inset-0" />}>
        <EntranceScene welcome={welcomeLine(museum.partner_names)} people={people} mode={mode} doorsOpen={phase === 'enter'} onEntered={onEntered} />
      </Suspense>

      {/* countdown */}
      {phase === 'countdown' && count !== null && (
        <div className="pointer-events-none absolute inset-0 z-40 flex flex-col items-center justify-center">
          <span key={count} className="countdown-num font-serif text-[9rem] leading-none text-gradient drop-shadow-[0_0_40px_rgba(255,200,120,0.8)] sm:text-[13rem]">
            {count}
          </span>
          <p className="mt-2 font-script text-3xl text-champagne drop-shadow">the doors are opening…</p>
        </div>
      )}
      {phase === 'enter' && (
        <div className="pointer-events-none absolute inset-x-0 top-[18%] z-40 text-center">
          <p className="fade-in-up font-script text-4xl text-champagne drop-shadow-[0_2px_20px_rgba(0,0,0,0.8)] sm:text-6xl">Your journey of memories begins now ❤️</p>
        </div>
      )}

      {phase === 'waiting' && (
        <>
          {/* status line */}
          <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center px-4">
            <p className="fade-in-up rounded-full glass-strong px-5 py-2 text-center font-serif text-lg text-cream sm:text-xl">
              {isHost
                ? 'Your special people are gathering. The journey will begin soon ❤️'
                : me?.status === 'pending'
                  ? 'Your request was sent — the host will let you in ❤️'
                  : me?.status === 'accepted'
                    ? 'Waiting for the host to start the museum ❤️'
                    : 'You no longer have access to this room.'}
            </p>
          </div>

          {/* info panel */}
          <div className="absolute bottom-0 left-0 z-20 w-full p-3 sm:bottom-auto sm:top-20 sm:w-[360px] sm:p-4">
            <div className="glass-strong rounded-3xl">
              <button onClick={() => setPanelOpen(!panelOpen)} className="flex w-full items-center justify-between px-5 pt-4 text-left">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-blush/80">Room</p>
                  <p className="truncate font-serif text-xl uppercase tracking-wide">{museum.name}</p>
                </div>
                {panelOpen ? <ChevronDown className="h-5 w-5 shrink-0 text-cream/60 sm:hidden" /> : <ChevronUp className="h-5 w-5 shrink-0 text-cream/60" />}
              </button>
              {panelOpen && (
                <div className="max-h-[46vh] space-y-4 overflow-y-auto px-5 pb-5 pt-2 sm:max-h-[calc(100vh-14rem)]">
                  {isHost ? (
                    <>
                      <div className="flex items-center justify-between rounded-2xl bg-black/25 px-4 py-2.5">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.2em] text-cream/50">Room ID</p>
                          <p className="font-mono text-2xl tracking-[0.3em] text-champagne">{roomCode}</p>
                        </div>
                        <button
                          onClick={async () => {
                            await navigator.clipboard.writeText(roomCode);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 1500);
                          }}
                          className="rounded-full p-2 hover:bg-white/10"
                          aria-label="Copy room ID"
                        >
                          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </button>
                      </div>
                      <InviteCard compact url={inviteUrl(museum.invite_code)} title={museum.name} onRegenerate={async () => setMuseum(await regenerateInvite(museum.id))} />
                    </>
                  ) : (
                    <p className="flex items-center gap-1.5 text-sm text-cream/70">
                      <Crown className="h-4 w-4 text-gold" /> Host: <b className="text-cream">{host?.display_name || 'Your host'}</b>
                    </p>
                  )}

                  <div>
                    <p className="mb-2 text-[10px] uppercase tracking-[0.25em] text-blush/80">Participants</p>
                    <ol className="space-y-1.5">
                      {accepted.map((m, i) => {
                        const ready = online.has(m.user_id) || m.user_id === user?.id;
                        return (
                          <li key={m.user_id} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm">
                            <span className="w-4 text-cream/50">{i + 1}.</span>
                            <span className="truncate font-medium">{m.display_name || 'Guest'}</span>
                            <span className="text-cream/50">– {m.role === 'host' ? 'Host' : 'Joined'} –</span>
                            <span className={`ml-auto flex items-center gap-1 text-xs ${ready ? 'text-emerald-300' : 'text-cream/40'}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${ready ? 'bg-emerald-300' : 'bg-cream/30'}`} /> {ready ? 'Ready' : 'Away'}
                            </span>
                          </li>
                        );
                      })}
                      {isHost &&
                        pending.map((m) => (
                          <li key={m.user_id} className="pulse-ring flex items-center gap-2 rounded-xl border border-rose/40 bg-rose/10 px-3 py-2 text-sm">
                            <Heart className="h-3.5 w-3.5 shrink-0 fill-rose text-rose" />
                            <span className="truncate">{m.display_name || 'Guest'} wants to join</span>
                            <button onClick={() => act(m, 'accepted')} className="ml-auto rounded-full bg-rose px-2.5 py-1 text-xs text-white">
                              Accept
                            </button>
                            <button onClick={() => act(m, 'rejected')} className="rounded-full p-1 text-cream/60 hover:bg-white/10" aria-label="Reject">
                              <X className="h-4 w-4" />
                            </button>
                          </li>
                        ))}
                    </ol>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <button onClick={() => nav(`/avatar?${isHost ? `museum=${museum.id}` : `next=${encodeURIComponent(`/museum/${museum.id}/lobby`)}`}`)} className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 hover:bg-white/15">
                      <Shirt className="h-3.5 w-3.5" /> Change my avatar
                    </button>
                    {isHost && (
                      <button onClick={() => nav(`/museum/${museum.id}/manage`)} className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 hover:bg-white/15">
                        <Images className="h-3.5 w-3.5" /> Photos & videos
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* host start / return — only the host sees this */}
          {isHost && (
            <div className="absolute left-1/2 top-16 z-30 -translate-x-1/2 sm:bottom-10 sm:top-auto">
              {museum.status === 'live' ? (
                <Button size="lg" onClick={() => nav(`/museum/${museum.id}/tour`)}>
                  <Play className="h-5 w-5 fill-white" /> Return to the museum
                </Button>
              ) : (
                <Button size="lg" variant="gold" onClick={startMuseum} className="px-8 tracking-[0.15em] sm:px-12 sm:text-lg">
                  START MUSEUM ❤️
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
