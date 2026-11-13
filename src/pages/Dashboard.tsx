import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Crown, DoorOpen, Heart, LogOut, Plus, Settings2, Shirt } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { createMuseum, listJoinedMuseums, listMyMuseums } from '../lib/api';
import type { Member, Museum } from '../lib/types';
import { Button, Card, Field, Input, Logo, Modal, PageShell, Spinner, errMsg, toast } from '../components/ui';
import AvatarPreview from '../components/AvatarPreview';

const STATUS: Record<Museum['status'], { label: string; cls: string }> = {
  lobby: { label: 'Waiting lobby', cls: 'bg-amber-400/15 text-amber-200' },
  live: { label: 'Tour live', cls: 'bg-emerald-400/15 text-emerald-200' },
  ended: { label: 'Tour ended', cls: 'bg-white/10 text-cream/60' },
};

export default function Dashboard() {
  const { user, profile, signOut } = useAuth();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [mine, setMine] = useState<Museum[] | null>(null);
  const [joined, setJoined] = useState<(Member & { museum: Museum })[]>([]);
  const [createOpen, setCreateOpen] = useState(params.get('create') === '1');
  const [name, setName] = useState('Our Museum');
  const [partners, setPartners] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    listMyMuseums(user.id).then(setMine).catch((e) => toast(errMsg(e), 'error'));
    listJoinedMuseums(user.id).then(setJoined).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (profile && !partners) setPartners(profile.display_name ? `${profile.display_name} & ` : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      const m = await createMuseum({ host_id: user.id, name: name.trim() || 'Our Museum', partner_names: partners.trim() });
      toast('Your museum is ready ❤️', 'love');
      nav(`/avatar?museum=${m.id}`);
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell wide>
      <header className="flex items-center justify-between">
        <Logo />
        <Button variant="ghost" size="sm" onClick={() => signOut().then(() => nav('/'))}>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </header>

      <div className="mt-10 grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="h-fit">
          <p className="text-xs uppercase tracking-[0.2em] text-blush/80">Signed in as</p>
          <h2 className="mt-1 font-serif text-3xl">{profile?.display_name || user?.email}</h2>
          {profile?.avatar ? (
            <AvatarPreview config={profile.avatar} full className="mt-4 h-64 rounded-2xl bg-gradient-to-b from-wine/40 to-transparent" />
          ) : (
            <div className="mt-4 flex h-40 items-center justify-center rounded-2xl border border-dashed border-blush/30 text-sm text-cream/60">No avatar yet</div>
          )}
          <Button variant="outline" className="mt-4 w-full" onClick={() => nav('/avatar?next=%2Fdashboard')}>
            <Shirt className="h-4 w-4" /> {profile?.avatar ? 'Edit my avatar' : 'Design my avatar'}
          </Button>
        </Card>

        <div className="space-y-8">
          <section>
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <h1 className="font-serif text-4xl">Your museums</h1>
                <p className="text-sm text-cream/60">You're the host of these. Fill them with memories, then invite your special person.</p>
              </div>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> Create museum
              </Button>
            </div>
            {mine === null ? (
              <Spinner />
            ) : mine.length === 0 ? (
              <Card className="text-center">
                <Heart className="mx-auto h-8 w-8 fill-rose/30 text-rose" />
                <p className="mt-3 font-serif text-2xl">No museums yet</p>
                <p className="mt-1 text-sm text-cream/60">Create your first one — it takes a few seconds.</p>
                <Button className="mt-4" onClick={() => setCreateOpen(true)}>
                  Create Your Museum
                </Button>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {mine.map((m) => (
                  <Card key={m.id} className="flex flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-serif text-2xl">{m.name}</h3>
                        <p className="truncate text-sm text-cream/60">{m.partner_names || '—'}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${STATUS[m.status].cls}`}>{STATUS[m.status].label}</span>
                    </div>
                    <p className="mt-2 flex items-center gap-1 text-xs text-gold">
                      <Crown className="h-3.5 w-3.5" /> Host
                    </p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <Button size="sm" variant="ghost" onClick={() => nav(`/museum/${m.id}/manage`)}>
                        <Settings2 className="h-4 w-4" /> Manage
                      </Button>
                      <Button size="sm" onClick={() => nav(m.status === 'live' ? `/museum/${m.id}/tour` : `/museum/${m.id}/lobby`)}>
                        <DoorOpen className="h-4 w-4" /> {m.status === 'live' ? 'Enter tour' : 'Open lobby'}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {joined.length > 0 && (
            <section>
              <h2 className="mb-3 font-serif text-3xl">Museums you were invited to</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {joined.map((j) => (
                  <Card key={j.museum_id}>
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="truncate font-serif text-2xl">{j.museum.name}</h3>
                      <span className={`rounded-full px-2.5 py-1 text-xs ${STATUS[j.museum.status].cls}`}>{STATUS[j.museum.status].label}</span>
                    </div>
                    <p className="text-sm text-cream/60">{j.status === 'pending' ? 'Waiting for the host to let you in' : 'You are on the guest list ❤️'}</p>
                    <Link to={j.museum.status === 'live' && j.status === 'accepted' ? `/museum/${j.museum_id}/tour` : `/museum/${j.museum_id}/lobby`}>
                      <Button size="sm" className="mt-4">
                        <DoorOpen className="h-4 w-4" /> {j.museum.status === 'live' && j.status === 'accepted' ? 'Enter tour' : 'Go to lobby'}
                      </Button>
                    </Link>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      <Modal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          if (params.get('create')) setParams({});
        }}
        title="Create your museum"
      >
        <form onSubmit={create} className="space-y-4">
          <Field label="Museum name">
            <Input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Your names" hint="Shown in the Welcome room, e.g. “Daniel & Emma”">
            <Input maxLength={80} value={partners} onChange={(e) => setPartners(e.target.value)} placeholder="Daniel & Emma" />
          </Field>
          <Button type="submit" className="w-full" loading={busy}>
            <Heart className="h-4 w-4 fill-white" /> Create museum
          </Button>
        </form>
      </Modal>
    </PageShell>
  );
}
