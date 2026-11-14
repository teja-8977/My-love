import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useMuseumLive } from '../lib/useMuseumLive';
import { listMedia, resolveMedia, setMemberStatus, transferHost, updateMuseum } from '../lib/api';
import type { ResolvedMedia } from '../lib/types';
import { defaultAvatar } from '../avatar/config';
import { Button, Card, FullscreenLoader, Logo, PageShell, errMsg, toast } from '../components/ui';
import { MuseumNet } from '../museum/net/MuseumNet';
import { CinemaController } from '../museum/audio/CinemaController';
import { MusicEngine } from '../museum/audio/MusicEngine';
import { TourExperience } from '../museum/TourExperience';
import type { TourSession } from '../museum/context';
import { useGame } from '../museum/store';
import type { TourActions } from '../museum/ui/Panels';

interface Engines {
  net: MuseumNet;
  cinema: CinemaController;
  music: MusicEngine;
}

export default function TourPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user, profile } = useAuth();
  const { museum, members } = useMuseumLive(id);
  const [media, setMedia] = useState<ResolvedMedia[] | null>(null);
  const [engines, setEngines] = useState<Engines | null>(null);
  const [ended, setEnded] = useState<string | null>(null);
  const isHostRef = useRef(false);

  const me = members.find((m) => m.user_id === user?.id);
  const isHost = !!museum && museum.host_id === user?.id;
  isHostRef.current = isHost;
  const allowed = !!museum && museum.status === 'live' && (isHost || me?.status === 'accepted');
  const avatar = profile?.avatar ?? me?.avatar ?? defaultAvatar();
  const name = profile?.display_name || me?.display_name || 'Guest';

  // media (signed URLs, refreshed every 5 hours)
  useEffect(() => {
    if (!id || !allowed) return;
    const load = () =>
      listMedia(id)
        .then(resolveMedia)
        .then(setMedia)
        .catch((e) => {
          toast(errMsg(e), 'error');
          setMedia([]);
        });
    load();
    const t = setInterval(load, 5 * 60 * 60 * 1000);
    return () => clearInterval(t);
  }, [id, allowed]);

  // realtime engines — exactly one set per museum visit. Created and disposed in the SAME effect, so
  // React's development double-mount (and any re-run) can never leave a second live connection behind.
  const userId = user?.id;
  useEffect(() => {
    if (!id || !allowed || !userId) return;
    useGame.getState().reset();
    const net = new MuseumNet(id, { id: userId, name, avatar, role: isHostRef.current ? 'host' : 'guest' });
    const cinema = new CinemaController(net, () => isHostRef.current);
    const music = new MusicEngine(net, () => isHostRef.current);
    net.connect().catch((e) => toast(errMsg(e), 'error'));
    setEngines({ net, cinema, music });
    return () => {
      cinema.dispose();
      music.dispose();
      net.close();
      setEngines(null);
    };
    // name/avatar changes are pushed with retrack() below instead of reconnecting
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, allowed, userId]);

  useEffect(() => {
    if (engines && media) engines.cinema.setVideos(media.filter((m) => m.kind === 'video'));
  }, [engines, media]);

  // keep presence in sync with role / avatar changes
  useEffect(() => {
    engines?.net.retrack({ role: isHost ? 'host' : 'guest', name, avatar }).catch(() => {});
  }, [engines, isHost, name, avatar]);

  // host & moderation events
  useEffect(() => {
    if (!engines || !user) return;
    const offs = [
      engines.net.on('host', (e) => {
        if (e.type === 'ended') setEnded(`${e.name} ended the tour. Thank you for coming ❤️`);
        else if (e.type === 'left') useGame.getState().notify(`${e.name} (host) stepped out — you can keep exploring`);
        else if (e.type === 'transferred') {
          useGame.getState().notify(e.newHostId === user.id ? `${e.name} made you the host 👑` : `${e.newHostName} is now the host`);
        }
      }),
      engines.net.on('kick', (uid) => {
        if (uid === user.id) setEnded('The host has removed you from this museum.');
      }),
    ];
    return () => offs.forEach((o) => o());
  }, [engines, user]);

  // database is the source of truth for tour status / membership
  useEffect(() => {
    if (!museum || ended) return;
    if (museum.status === 'ended') setEnded('This tour has ended. Thank you for walking through these memories ❤️');
    else if (me && (me.status === 'removed' || me.status === 'rejected') && !isHost) setEnded('You no longer have access to this museum.');
  }, [museum, me, isHost, ended]);

  const session: TourSession | null = useMemo(() => {
    if (!engines || !museum || !media || !user) return null;
    return {
      museum,
      ...engines,
      photos: media.filter((m) => m.kind === 'photo'),
      videos: media.filter((m) => m.kind === 'video').sort((a, b) => a.slot - b.slot),
      meId: user.id,
      isHost,
    };
  }, [engines, museum, media, user, isHost]);

  const actions: TourActions = {
    leave: async () => {
      if (!engines || !museum) return;
      if (isHost) engines.net.sendHost({ type: 'left', name });
      try {
        sessionStorage.removeItem(`lm-pos:${museum.id}`);
      } catch {
        /* ignore */
      }
      nav('/dashboard');
    },
    endTour: async () => {
      if (!engines || !museum) return;
      try {
        await updateMuseum(museum.id, { status: 'ended' });
        engines.net.sendHost({ type: 'ended', name });
        nav(`/museum/${museum.id}/manage`);
      } catch (e) {
        toast(errMsg(e), 'error');
      }
    },
    transfer: async (uid) => {
      if (!engines || !museum) return;
      try {
        await transferHost(museum.id, uid);
        const p = useGame.getState().players.find((x) => x.id === uid);
        engines.net.sendHost({ type: 'transferred', name, newHostId: uid, newHostName: p?.name ?? 'Your partner' });
        toast('Ownership transferred ❤️', 'love');
        nav('/dashboard');
      } catch (e) {
        toast(errMsg(e), 'error');
      }
    },
    remove: async (uid) => {
      if (!engines || !museum) return;
      try {
        await setMemberStatus(museum.id, uid, 'removed');
        engines.net.sendKick(uid);
      } catch (e) {
        toast(errMsg(e), 'error');
      }
    },
  };

  if (museum === undefined) return <FullscreenLoader label="Opening the doors…" />;
  if (museum === null)
    return (
      <PageShell>
        <Logo />
        <Card className="mx-auto mt-20 max-w-md text-center">
          <h1 className="font-serif text-3xl">This museum is private</h1>
          <Button className="mt-6" onClick={() => nav('/dashboard')}>
            My museums
          </Button>
        </Card>
      </PageShell>
    );
  if (ended)
    return (
      <PageShell>
        <Logo />
        <Card className="mx-auto mt-24 max-w-md text-center">
          <p className="font-script text-4xl text-blush">Until next time</p>
          <p className="mt-3 text-cream/80">{ended}</p>
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="ghost" onClick={() => nav('/dashboard')}>
              Back to my museums
            </Button>
          </div>
        </Card>
      </PageShell>
    );
  if (!allowed && members.length) return <Navigate to={`/museum/${museum.id}/lobby`} replace />;
  if (!session) return <FullscreenLoader label="Lighting the candles…" />;

  return <TourExperience session={session} avatar={avatar} name={name} actions={actions} />;
}
