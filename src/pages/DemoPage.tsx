import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { defaultAvatar } from '../avatar/config';
import { MuseumNet } from '../museum/net/MuseumNet';
import { CinemaController } from '../museum/audio/CinemaController';
import { MusicEngine } from '../museum/audio/MusicEngine';
import { TourExperience } from '../museum/TourExperience';
import { useGame } from '../museum/store';
import type { Museum } from '../lib/types';

/** Single-player, offline network stub: nothing is sent anywhere. */
class OfflineNet extends MuseumNet {
  async connect() {
    useGame.getState().set({ connection: 'online', players: [{ id: this.me.id, name: this.me.name, avatar: this.me.avatar, role: 'host' }] });
  }
  async retrack() {}
}

const DEMO_MUSEUM: Museum = {
  id: 'demo',
  host_id: 'demo-you',
  name: 'Our Museum',
  partner_names: 'You & Me',
  welcome_message: 'Every picture tells a story. Every moment lives forever. Walk with me through ours.',
  final_message: 'Thank you for walking through our story with me. Every room here is a piece of my heart — and the best rooms are the ones we have not built yet.',
  invite_code: 'demo',
  status: 'live',
  created_at: new Date().toISOString(),
};

export default function DemoPage() {
  const nav = useNavigate();
  const { profile } = useAuth();
  const avatar = profile?.avatar ?? defaultAvatar('female');
  const name = profile?.display_name || 'You';
  const [engines] = useState(() => {
    useGame.getState().reset();
    const net = new OfflineNet('demo', { id: 'demo-you', name, avatar, role: 'host' });
    return { net, cinema: new CinemaController(net, () => true), music: new MusicEngine(net, () => true) };
  });

  useEffect(() => {
    engines.net.connect();
    return () => {
      engines.cinema.dispose();
      engines.music.dispose();
    };
  }, [engines]);

  const session = useMemo(() => ({ museum: DEMO_MUSEUM, ...engines, photos: [], videos: [], meId: 'demo-you', isHost: true }), [engines]);

  return (
    <TourExperience
      session={session}
      avatar={avatar}
      name={name}
      actions={{ leave: () => nav('/'), endTour: () => nav('/'), transfer: () => {}, remove: () => {} }}
      banner={
        <div className="pointer-events-auto absolute left-1/2 top-20 -translate-x-1/2 rounded-full border border-gold/30 bg-black/50 px-4 py-1.5 text-xs text-champagne backdrop-blur">
          <Heart className="mr-1 inline h-3 w-3 fill-rose text-rose" /> Solo preview — create a museum to add your photos, videos and invite your person
        </div>
      }
    />
  );
}
