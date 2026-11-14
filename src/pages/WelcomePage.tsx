import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, DoorOpen, Heart, KeyRound, QrCode, Sparkles, X } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { isSupabaseConfigured } from '../lib/supabase';
import { createMuseum, getInvite, getInvitePublic, listMyMuseums, parseInviteInput, saveMyProfile, welcomeLine } from '../lib/api';
import { Button, Field, Input, errMsg, toast } from '../components/ui';
import { AuthPanel } from '../components/AuthPanel';
import { QrScanner } from '../components/QrScanner';
import { WELCOME_COUPLE } from '../entrance/guide';
import { WELCOME_DIALOGUE, type Speaker } from '../story';
import { Volume2, VolumeX } from 'lucide-react';
import type { EntranceMode } from '../entrance/EntranceScene';

const EntranceScene = lazy(() => import('../entrance/EntranceScene'));

type Panel = null | 'auth-create' | 'auth-join' | 'create' | 'join';

function useTypewriter(text: string, speed = 22) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const t = setInterval(() => setN((v) => (v >= text.length ? v : v + 1)), speed);
    return () => clearInterval(t);
  }, [text, speed]);
  return { shown: text.slice(0, n), done: n >= text.length, finish: () => setN(text.length) };
}

/** Optional voice narration with the browser's built-in speech (no files, no services). */
function speak(text: string, who: Speaker) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[❤️]/g, ''));
    const voices = synth.getVoices().filter((v) => /^en/i.test(v.lang));
    const female = voices.find((v) => /female|zira|samantha|susan|heera|veena|google uk english female|aria|jenny/i.test(v.name));
    const male = voices.find((v) => /male|david|mark|ravi|rishi|daniel|guy|google uk english male/i.test(v.name) && !/female/i.test(v.name));
    u.voice = (who === 'pranati' ? female : who === 'teja' ? male : female) ?? voices[0] ?? null;
    u.pitch = who === 'pranati' ? 1.25 : who === 'teja' ? 0.85 : 1.05;
    u.rate = 0.98;
    synth.speak(u);
  } catch {
    /* speech unavailable */
  }
}

function DialogueBubble({ step, name, controls, onNext, onSkip }: { step: number; name: string; controls: boolean; onNext: () => void; onSkip: () => void }) {
  const line = WELCOME_DIALOGUE[step];
  const { shown, done, finish } = useTypewriter(line.text);
  const last = step === WELCOME_DIALOGUE.length - 1;
  const GUIDE_STEPS = WELCOME_DIALOGUE;
  return (
    <div key={step} className="fade-in-up relative w-[min(300px,72vw)] rounded-3xl border border-white/60 bg-[#fffaf5]/95 p-4 text-[#3a2420] shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#b4565e]">{name}</p>
      <p className="min-h-[3.6em] font-serif text-[17px] leading-snug" onClick={finish}>
        {shown}
        {!done && <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-[#b4565e] align-middle" />}
      </p>
      {controls && <div className="mt-3 flex items-center justify-between">
        <div className="flex gap-1.5">
          {GUIDE_STEPS.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-5 bg-[#c43d63]' : 'w-1.5 bg-[#c43d63]/25'}`} />
          ))}
        </div>
        <div className="flex items-center gap-2">
          {!last && (
            <button onClick={onSkip} className="text-xs text-[#3a2420]/50 hover:text-[#3a2420]">
              Skip
            </button>
          )}
          <button
            onClick={() => (done ? onNext() : finish())}
            className="flex items-center gap-1 rounded-full bg-gradient-to-r from-[#e8577a] to-[#c43d63] px-4 py-1.5 text-sm font-semibold text-white shadow-lg transition active:scale-95"
          >
            {last ? "LET'S GO" : 'NEXT'} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>}
      <span className="absolute -bottom-2 left-8 h-4 w-4 rotate-45 bg-[#fffaf5]/95" />
    </div>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/30 p-3 backdrop-blur-[2px] sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="glass-strong fade-in-up relative w-full max-w-md rounded-3xl p-6 shadow-2xl">
        <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-1.5 text-cream/60 hover:bg-white/10" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
        <h2 className="mb-4 pr-8 font-serif text-3xl">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export default function WelcomePage() {
  const { code: inviteCode } = useParams();
  const nav = useNavigate();
  const { user, profile } = useAuth();
  const [welcome, setWelcome] = useState(welcomeLine(null));
  const [hostName, setHostName] = useState('');
  const [step, setStep] = useState(0);
  const [guideDone, setGuideDone] = useState(false);
  const [voice, setVoice] = useState(false);

  // read each line aloud when voice is on
  useEffect(() => {
    if (voice && !guideDone) speak(WELCOME_DIALOGUE[step].text, WELCOME_DIALOGUE[step].who);
    if (guideDone) window.speechSynthesis?.cancel();
  }, [voice, step, guideDone]);
  const nextLine = () => (step < WELCOME_DIALOGUE.length - 1 ? setStep(step + 1) : setGuideDone(true));
  const skip = () => setGuideDone(true);
  const who = WELCOME_DIALOGUE[step].who;
  const people = WELCOME_COUPLE.map((c) => ({
    ...c,
    bubble:
      !guideDone && (who === c.id || who === 'both') ? (
        <DialogueBubble step={step} name={who === 'both' ? 'Teja & Pranati' : c.name} controls={who === c.id || (who === 'both' && c.id === 'pranati')} onNext={nextLine} onSkip={skip} />
      ) : undefined,
  }));
  const [panel, setPanel] = useState<Panel>(null);
  const [mode, setMode] = useState<EntranceMode>('intro');

  // personalised welcome line
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    if (inviteCode) {
      getInvitePublic(inviteCode).then((i) => {
        if (i) {
          setWelcome(welcomeLine(i.partner_names));
          setHostName(i.host_name);
        }
      });
    } else if (user) {
      listMyMuseums(user.id)
        .then((m) => m[0]?.partner_names && setWelcome(welcomeLine(m[0].partner_names)))
        .catch(() => {});
    }
  }, [inviteCode, user]);

  useEffect(() => {
    const t = setTimeout(() => setMode('idle'), 3500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (guideDone) setMode('focus');
  }, [guideDone]);

  const startCreate = () => {
    if (!isSupabaseConfigured) return nav('/setup');
    setPanel(user ? 'create' : 'auth-create');
  };
  const startJoin = () => {
    if (!isSupabaseConfigured) return nav('/setup');
    setPanel(user ? 'join' : 'auth-join');
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-ink">
      <Suspense fallback={<div className="romantic-bg absolute inset-0" />}>
        <EntranceScene
          welcome={welcome}
          mode={mode}
          people={people}
          guide={null}
        />
      </Suspense>

      {/* minimal top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-4">
        <span className="flex items-center gap-2 font-serif text-sm tracking-[0.3em] text-cream/80">
          <Heart className="h-4 w-4 fill-rose text-rose" /> LOVE MUSEUM
        </span>
        <div className="pointer-events-auto flex items-center gap-2">
          {!guideDone && (
            <button
              onClick={() => setVoice((v) => !v)}
              className="flex items-center gap-1.5 rounded-full glass-strong px-3 py-1.5 text-xs text-cream/80 hover:text-cream"
              aria-label={voice ? 'Turn voice off' : 'Turn voice on'}
            >
              {voice ? <Volume2 className="h-4 w-4 text-blush" /> : <VolumeX className="h-4 w-4" />} {voice ? 'Voice on' : 'Voice'}
            </button>
          )}
          {user && (
            <Link to="/dashboard" className="rounded-full glass-strong px-3 py-1.5 text-xs text-cream/80 hover:text-cream">
              My museums
            </Link>
          )}
        </div>
      </div>

      {/* CREATE / JOIN */}
      {guideDone && !panel && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 pb-6 md:inset-y-0 md:flex md:items-center md:px-[3vw] md:pb-0">
          <div className="grid w-full grid-cols-1 gap-3 md:flex md:justify-between">
            {[
              { k: 'create', icon: Sparkles, t: 'CREATE A ROOM', d: 'Create your own private Love Museum.', on: startCreate, hi: !inviteCode },
              { k: 'join', icon: DoorOpen, t: 'JOIN A ROOM', d: inviteCode ? `Join ${hostName || 'your special person'}'s museum.` : "Join your special person's museum.", on: startJoin, hi: !!inviteCode },
            ].map(({ k, icon: Icon, t, d, on, hi }, i) => (
              <button
                key={k}
                onClick={on}
                style={{ animationDelay: `${i * 120}ms` }}
                className={`fade-in-up group pointer-events-auto relative overflow-hidden rounded-3xl border p-5 text-left md:w-[min(320px,26vw)] shadow-[0_25px_80px_-25px_rgba(232,87,122,0.7)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 sm:p-6 ${
                  hi ? 'border-gold/60 bg-gradient-to-br from-[#3a1622]/90 to-[#1a0c13]/90' : 'border-white/15 bg-gradient-to-br from-[#2a1420]/80 to-[#140a0f]/80'
                }`}
              >
                <span className="shimmer absolute inset-0 opacity-0 transition group-hover:opacity-100" />
                <Icon className="h-7 w-7 text-gold" />
                <p className="mt-3 font-serif text-2xl tracking-[0.12em] text-cream sm:text-3xl">{t}</p>
                <p className="mt-1 text-sm text-cream/70">{d}</p>
                <ArrowRight className="absolute bottom-5 right-5 h-5 w-5 text-blush transition group-hover:translate-x-1" />
              </button>
            ))}
          </div>
        </div>
      )}

      {(panel === 'auth-create' || panel === 'auth-join') && (
        <Sheet title={panel === 'auth-create' ? 'Create your room' : 'Join a room'} onClose={() => setPanel(null)}>
          <AuthPanel
            next={inviteCode ? `/join/${inviteCode}` : '/'}
            intro="Tell us who you are — it only takes a moment."
            onDone={() => setPanel(panel === 'auth-create' ? 'create' : 'join')}
          />
        </Sheet>
      )}

      {panel === 'create' && user && (
        <Sheet title="Create your room" onClose={() => setPanel(null)}>
          <CreateForm
            defaultName={profile?.display_name ?? ''}
            onCreated={(id) => nav(`/avatar?museum=${id}`)}
            userId={user.id}
          />
        </Sheet>
      )}

      {panel === 'join' && user && (
        <Sheet title="Join a room" onClose={() => setPanel(null)}>
          <JoinForm initial={inviteCode ?? ''} onValid={(code, mid, status) => nav(status === 'pending' || status === 'accepted' ? `/museum/${mid}/lobby` : `/avatar?join=${code}`)} />
        </Sheet>
      )}
    </div>
  );
}

function CreateForm({ userId, defaultName, onCreated }: { userId: string; defaultName: string; onCreated: (id: string) => void }) {
  const [me, setMe] = useState(defaultName);
  const [them, setThem] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const names = them.trim() ? `${them.trim()} & ${me.trim()}` : me.trim();
      await saveMyProfile(userId, { display_name: me.trim() });
      const m = await createMuseum({ host_id: userId, name: them.trim() ? `${names}'s Love Museum` : 'Our Love Museum', partner_names: names });
      toast('Your private room is ready ❤️', 'love');
      onCreated(m.id);
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Your name">
        <Input required maxLength={30} value={me} onChange={(e) => setMe(e.target.value)} placeholder="Teja" />
      </Field>
      <Field label="Your special person's name" hint="Shown at the entrance: “Welcome to … Love Museum ❤️”">
        <Input maxLength={30} value={them} onChange={(e) => setThem(e.target.value)} placeholder="Pranathi" />
      </Field>
      <Button type="submit" className="w-full" loading={busy}>
        <Sparkles className="h-4 w-4" /> Create my room
      </Button>
      <p className="text-center text-xs text-cream/50">You'll get a private room code, QR code and invitation link. You are the host.</p>
    </form>
  );
}

function JoinForm({ initial, onValid }: { initial: string; onValid: (code: string, museumId: string, myStatus: string | null) => void }) {
  const [value, setValue] = useState(initial);
  const [scan, setScan] = useState(false);
  const [busy, setBusy] = useState(false);
  const validate = async (raw: string) => {
    const code = parseInviteInput(raw);
    if (!code) return;
    setBusy(true);
    try {
      const info = await getInvite(code);
      if (!info) throw new Error("We couldn't find that room. Check the code or ask for a new invitation.");
      if (info.my_status === 'removed') throw new Error('The host has removed you from this room.');
      if (info.status === 'ended') toast('This tour has ended — you can still wait in the lobby for the next one.');
      onValid(code, info.museum_id, info.my_status);
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (initial) validate(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        validate(value);
      }}
      className="space-y-4"
    >
      {scan ? (
        <QrScanner
          onResult={(t) => {
            setScan(false);
            setValue(t);
            validate(t);
          }}
          onClose={() => setScan(false)}
        />
      ) : (
        <button type="button" onClick={() => setScan(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-blush/40 py-5 text-sm text-cream/80 hover:bg-white/5">
          <QrCode className="h-5 w-5 text-blush" /> Scan the QR code
        </button>
      )}
      <Field label="Or enter the room code / invitation link">
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="7F3A9C" className="text-center font-mono tracking-[0.3em] uppercase" />
      </Field>
      <Button type="submit" className="w-full" loading={busy} disabled={!value.trim()}>
        <KeyRound className="h-4 w-4" /> Join room
      </Button>
    </form>
  );
}
