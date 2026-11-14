import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Film, ImagePlus, Play, Square, Trash2, Upload, Users, DoorOpen, Pencil, Images, Link2 } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useMuseumLive } from '../lib/useMuseumLive';
import {
  deleteMedia, deleteMuseum, inviteUrl, listMedia, regenerateInvite, resolveMedia, updateCaption, updateMuseum, uploadMedia,
} from '../lib/api';
import { PHOTO_SLOTS, VIDEO_SLOTS, type ResolvedMedia } from '../lib/types';
import { fileExt, preparePhoto } from '../lib/image';
import { Button, Card, Field, Input, Logo, PageShell, Spinner, Textarea, errMsg, toast } from '../components/ui';
import InviteCard from '../components/InviteCard';
import ParticipantsList from '../components/ParticipantsList';

type Tab = 'overview' | 'photos' | 'videos' | 'people' | 'invite';

/** Supabase free plan: 50 MB per uploaded file */
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export default function ManageMuseum() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { museum, members, reload, setMuseum } = useMuseumLive(id);
  const [tab, setTab] = useState<Tab>('overview');
  const [media, setMedia] = useState<ResolvedMedia[] | null>(null);

  const loadMedia = async () => {
    if (!id) return;
    try {
      setMedia(await resolveMedia(await listMedia(id)));
    } catch (e) {
      toast(errMsg(e), 'error');
      setMedia([]);
    }
  };
  useEffect(() => {
    loadMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (museum === undefined)
    return (
      <PageShell>
        <div className="mt-40 flex justify-center">
          <Spinner />
        </div>
      </PageShell>
    );
  if (!museum || museum.host_id !== user?.id)
    return (
      <PageShell>
        <Logo />
        <Card className="mx-auto mt-20 max-w-md text-center">
          <h1 className="font-serif text-3xl">Only the host can manage this museum</h1>
          <Button className="mt-6" onClick={() => nav('/dashboard')}>
            My museums
          </Button>
        </Card>
      </PageShell>
    );

  const photos = (media ?? []).filter((m) => m.kind === 'photo');
  const videos = (media ?? []).filter((m) => m.kind === 'video');
  const pending = members.filter((m) => m.status === 'pending').length;

  const tabs: { id: Tab; label: string; icon: typeof Images; badge?: string | number }[] = [
    { id: 'overview', label: 'Overview', icon: Pencil },
    { id: 'photos', label: 'Memory Gallery', icon: Images, badge: `${photos.length}/${PHOTO_SLOTS}` },
    { id: 'videos', label: 'Cinema', icon: Film, badge: `${videos.length}/${VIDEO_SLOTS}` },
    { id: 'people', label: 'Participants', icon: Users, badge: pending || undefined },
    { id: 'invite', label: 'Invite', icon: Link2 },
  ];

  const setStatus = async (status: 'lobby' | 'live' | 'ended') => {
    try {
      setMuseum(await updateMuseum(museum.id, { status }));
      if (status === 'live') nav(`/museum/${museum.id}/tour`);
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  return (
    <PageShell wide>
      <header className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => nav('/dashboard')}>
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Button>
        <Logo small />
        <span className="w-24" />
      </header>

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-blush/80">Host dashboard</p>
          <h1 className="font-serif text-5xl">{museum.name}</h1>
          <p className="mt-1 text-sm text-cream/60">
            Status: <b className="text-cream">{museum.status === 'live' ? 'Tour live' : museum.status === 'ended' ? 'Tour ended' : 'Waiting lobby'}</b>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {museum.status === 'live' ? (
            <>
              <Button onClick={() => nav(`/museum/${museum.id}/tour`)}>
                <DoorOpen className="h-4 w-4" /> Enter tour
              </Button>
              <Button variant="danger" onClick={() => confirm('End the tour for everyone?') && setStatus('ended')}>
                <Square className="h-4 w-4" /> End tour
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => nav(`/museum/${museum.id}/lobby`)}>
                <Users className="h-4 w-4" /> Lobby
              </Button>
              <Button variant="gold" onClick={() => setStatus('live')}>
                <Play className="h-4 w-4 fill-current" /> START TOUR
              </Button>
            </>
          )}
        </div>
      </div>

      <nav className="mt-8 flex gap-1 overflow-x-auto rounded-full glass p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm transition ${tab === t.id ? 'bg-rose text-white' : 'text-cream/70 hover:text-cream'}`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
            {t.badge !== undefined && <span className="rounded-full bg-black/25 px-2 text-xs">{t.badge}</span>}
          </button>
        ))}
      </nav>

      <div className="mt-6">
        {tab === 'overview' && <Overview museum={museum} onSaved={setMuseum} onDelete={() => nav('/dashboard')} />}
        {tab === 'photos' && (media === null ? <Spinner /> : <PhotoManager museumId={museum.id} photos={photos} reload={loadMedia} />)}
        {tab === 'videos' && (media === null ? <Spinner /> : <VideoManager museumId={museum.id} videos={videos} reload={loadMedia} />)}
        {tab === 'people' && (
          <Card>
            <ParticipantsList museumId={museum.id} members={members} isHost onChange={reload} />
          </Card>
        )}
        {tab === 'invite' && (
          <Card>
            <InviteCard url={inviteUrl(museum.invite_code)} title={museum.name} onRegenerate={async () => setMuseum(await regenerateInvite(museum.id))} />
          </Card>
        )}
      </div>
    </PageShell>
  );
}

function Overview({ museum, onSaved, onDelete }: { museum: NonNullable<ReturnType<typeof useMuseumLive>['museum']>; onSaved: (m: typeof museum) => void; onDelete: () => void }) {
  const [form, setForm] = useState({
    name: museum.name,
    partner_names: museum.partner_names,
    welcome_message: museum.welcome_message,
    final_message: museum.final_message,
  });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      onSaved(await updateMuseum(museum.id, form));
      toast('Saved ❤️', 'love');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <Card className="space-y-4">
        <h2 className="font-serif text-2xl">Room content</h2>
        <Field label="Museum name">
          <Input maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Room 1 · Names of the two of you">
          <Input maxLength={80} value={form.partner_names} onChange={(e) => setForm({ ...form, partner_names: e.target.value })} placeholder="Daniel & Emma" />
        </Field>
        <Field label="Room 1 · Welcome message">
          <Textarea maxLength={300} value={form.welcome_message} onChange={(e) => setForm({ ...form, welcome_message: e.target.value })} />
        </Field>
        <Field label="Room 6 · Special final message (shown on the wall)">
          <Textarea maxLength={600} value={form.final_message} onChange={(e) => setForm({ ...form, final_message: e.target.value })} />
        </Field>
        <Button loading={busy} onClick={save}>
          Save changes
        </Button>
      </Card>
      <div className="space-y-6">
        <Card>
          <h3 className="font-serif text-xl">The journey</h3>
          <ol className="mt-3 space-y-2 text-sm text-cream/70">
            <li>1 · Welcome to Our Story</li>
            <li>2 · Memory Gallery — 20 photographs</li>
            <li>3 · Our Cinema — 4 videos</li>
            <li>4 · Forever Together</li>
            <li>5 · Celebration Hall</li>
            <li>6 · Our Final Memory → Exit</li>
          </ol>
        </Card>
        <Card>
          <h3 className="font-serif text-xl text-red-200">Danger zone</h3>
          <p className="mt-1 text-sm text-cream/60">Deleting removes the museum, all photos and videos permanently.</p>
          <Button
            variant="danger"
            className="mt-4"
            onClick={async () => {
              if (!confirm(`Delete "${museum.name}" forever? This cannot be undone.`)) return;
              try {
                await deleteMuseum(museum.id);
                toast('Museum deleted');
                onDelete();
              } catch (e) {
                toast(errMsg(e), 'error');
              }
            }}
          >
            <Trash2 className="h-4 w-4" /> Delete museum
          </Button>
        </Card>
      </div>
    </div>
  );
}

function PhotoManager({ museumId, photos, reload }: { museumId: string; photos: ResolvedMedia[]; reload: () => Promise<void> }) {
  const [busySlots, setBusySlots] = useState<Set<number>>(new Set());
  const bulkInput = useRef<HTMLInputElement>(null);
  const bySlot = new Map(photos.map((p) => [p.slot, p]));

  const uploadTo = async (slot: number, file: File) => {
    setBusySlots((s) => new Set(s).add(slot));
    try {
      const prep = await preparePhoto(file);
      await uploadMedia({
        museumId,
        kind: 'photo',
        slot,
        file: prep.blob,
        ext: prep.ext,
        contentType: prep.type,
        width: prep.width,
        height: prep.height,
        caption: bySlot.get(slot)?.caption ?? '',
        previousPath: bySlot.get(slot)?.storage_path,
      });
    } catch (e) {
      toast(`Photo ${slot + 1}: ${errMsg(e)}`, 'error');
    } finally {
      setBusySlots((s) => {
        const n = new Set(s);
        n.delete(slot);
        return n;
      });
    }
  };

  const bulk = async (files: FileList | null) => {
    if (!files?.length) return;
    const empty = Array.from({ length: PHOTO_SLOTS }, (_, i) => i).filter((i) => !bySlot.has(i));
    const list = Array.from(files).slice(0, empty.length);
    if (files.length > empty.length) toast(`Only ${empty.length} empty frame(s) left — extra photos skipped.`);
    await Promise.all(list.map((f, i) => uploadTo(empty[i], f)));
    await reload();
    toast('Photos added to your gallery ❤️', 'love');
  };

  return (
    <Card>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl">Memory Gallery</h2>
          <p className="text-sm text-cream/60">{PHOTO_SLOTS} frames. Photos keep their original proportions and are never cropped in the museum.</p>
        </div>
        <Button onClick={() => bulkInput.current?.click()}>
          <Upload className="h-4 w-4" /> Add photos
        </Button>
        <input ref={bulkInput} type="file" accept="image/*" multiple hidden onChange={(e) => bulk(e.target.files).finally(() => (e.target.value = ''))} />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: PHOTO_SLOTS }, (_, slot) => (
          <PhotoSlot
            key={slot}
            slot={slot}
            item={bySlot.get(slot)}
            busy={busySlots.has(slot)}
            onFile={async (f) => {
              await uploadTo(slot, f);
              await reload();
            }}
            onDelete={async (item) => {
              if (!confirm('Remove this photo?')) return;
              await deleteMedia(item).catch((e) => toast(errMsg(e), 'error'));
              await reload();
            }}
          />
        ))}
      </div>
    </Card>
  );
}

function PhotoSlot({ slot, item, busy, onFile, onDelete }: { slot: number; item?: ResolvedMedia; busy: boolean; onFile: (f: File) => void; onDelete: (i: ResolvedMedia) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState(item?.caption ?? '');
  useEffect(() => setCaption(item?.caption ?? ''), [item?.caption, item?.id]);
  return (
    <div className="group">
      <div
        onClick={() => !busy && input.current?.click()}
        className="relative flex aspect-[4/5] cursor-pointer items-center justify-center overflow-hidden rounded-xl border-4 border-[#c9a46a]/70 bg-black/30 shadow-[inset_0_0_0_3px_#f8efe4] transition hover:border-gold"
      >
        {item ? (
          <img src={item.url} alt="" className="h-full w-full object-contain" loading="lazy" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-cream/40">
            <ImagePlus className="h-6 w-6" />
            <span className="text-xs">Frame {slot + 1}</span>
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Spinner />
          </div>
        )}
        {item && !busy && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item);
            }}
            className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1.5 opacity-0 transition group-hover:opacity-100"
            aria-label="Remove photo"
          >
            <Trash2 className="h-3.5 w-3.5 text-red-200" />
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      {item && (
        <input
          value={caption}
          maxLength={120}
          onChange={(e) => setCaption(e.target.value)}
          onBlur={() => caption !== item.caption && updateCaption(item.id, caption).then(() => toast('Caption saved')).catch((e) => toast(errMsg(e), 'error'))}
          placeholder="Add a caption…"
          className="mt-2 w-full rounded-lg border border-transparent bg-transparent px-1 py-1 text-center font-serif text-sm italic text-cream/80 outline-none placeholder:text-cream/30 focus:border-white/15"
        />
      )}
    </div>
  );
}

function VideoManager({ museumId, videos, reload }: { museumId: string; videos: ResolvedMedia[]; reload: () => Promise<void> }) {
  const bySlot = new Map(videos.map((v) => [v.slot, v]));
  const [busy, setBusy] = useState<number | null>(null);
  const upload = async (slot: number, file: File) => {
    if (!file.type.startsWith('video/')) return toast('Please choose a video file (MP4 recommended)', 'error');
    if (file.size > MAX_VIDEO_BYTES)
      return toast(`This video is ${(file.size / 1048576).toFixed(0)} MB — the storage plan allows 50 MB per file. Put it in media/videos and run "npm run import-media" to compress and upload it automatically.`, 'error');
    setBusy(slot);
    try {
      await uploadMedia({
        museumId,
        kind: 'video',
        slot,
        file,
        ext: fileExt(file),
        contentType: file.type || 'video/mp4',
        caption: bySlot.get(slot)?.caption || file.name.replace(/\.[^.]+$/, '').slice(0, 60),
        previousPath: bySlot.get(slot)?.storage_path,
      });
      await reload();
      toast('Video added to Our Cinema 🎬', 'love');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(null);
    }
  };
  return (
    <Card>
      <h2 className="font-serif text-2xl">Our Cinema</h2>
      <p className="text-sm text-cream/60">Four videos for the theatre. MP4 (H.264) plays everywhere, up to 50 MB each. Bigger videos: put them in <code className="text-blush">media/videos</code> and run <code className="text-blush">npm run import-media</code> — they are compressed automatically.</p>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        {Array.from({ length: VIDEO_SLOTS }, (_, slot) => {
          const v = bySlot.get(slot);
          return (
            <VideoSlot
              key={slot}
              slot={slot}
              item={v}
              busy={busy === slot}
              onFile={(f) => upload(slot, f)}
              onDelete={async () => {
                if (!v || !confirm('Remove this video?')) return;
                await deleteMedia(v).catch((e) => toast(errMsg(e), 'error'));
                await reload();
              }}
            />
          );
        })}
      </div>
    </Card>
  );
}

function VideoSlot({ slot, item, busy, onFile, onDelete }: { slot: number; item?: ResolvedMedia; busy: boolean; onFile: (f: File) => void; onDelete: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(item?.caption ?? '');
  useEffect(() => setTitle(item?.caption ?? ''), [item?.caption, item?.id]);
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
        {item ? (
          <video src={item.url} className="h-full w-full object-contain" controls preload="metadata" />
        ) : (
          <button onClick={() => input.current?.click()} className="flex h-full w-full flex-col items-center justify-center gap-2 text-cream/40 hover:text-cream/70">
            <Film className="h-8 w-8" />
            <span className="text-sm">Video {slot + 1}</span>
          </button>
        )}
        {busy && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-sm">
            <Spinner /> Uploading…
          </div>
        )}
      </div>
      <input ref={input} type="file" accept="video/*" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      <div className="mt-3 flex items-center gap-2">
        <input
          value={title}
          disabled={!item}
          maxLength={80}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => item && title !== item.caption && updateCaption(item.id, title).then(() => toast('Title saved'))}
          placeholder="Video title"
          className="min-w-0 flex-1 rounded-lg bg-white/5 px-3 py-1.5 text-sm outline-none placeholder:text-cream/30 disabled:opacity-40"
        />
        <Button size="sm" variant="ghost" onClick={() => input.current?.click()} disabled={busy}>
          <Upload className="h-4 w-4" />
        </Button>
        {item && (
          <Button size="sm" variant="danger" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
