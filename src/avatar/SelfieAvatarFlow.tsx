import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, RotateCcw, ShieldCheck, UserRound, Wand2, X } from 'lucide-react';
import { Button } from '../components/ui';
import { defaultProvider, type GeneratedAvatar } from './providers';
import type { ProviderCapabilities } from './providers/types';
import { saveGeneratedModel } from './modelStore';
import { SelfieCapture, type SelfiePhotos } from './SelfieCapture';
import type { AvatarModelRef } from './config';

export type SelfieStep = 'choose' | 'consent' | 'capture' | 'generating' | 'editor' | 'saving' | 'error';

const SAVE_TIMEOUT_MS = 90_000;
const GENERATION_TIMEOUT_MS = 8 * 60_000;
const POLL_MS = 4000;

function withTimeout<T>(p: Promise<T>, ms: number, message: string) {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(message)), ms))]);
}

const GEN_MESSAGES = ['Reading your photos…', 'Shaping your face in 3D…', 'Matching your skin tone and hair…', 'Dressing your avatar…', 'Almost there…'];

/**
 * Selfie → personalised 3D avatar.
 *  choose → consent (explain camera use; nothing is on yet)
 *  → capture (OUR camera screen: front + 2 side photos, retake/upload) → generating (provider processes the photos)
 *  → editor (provider editor on THAT avatar: hair, clothes, shoes, glasses — face stays the same)
 *  → saving (GLB copied to our Supabase storage) → done
 * Without photo-upload API access, the provider editor's own camera capture is used instead.
 */
export function SelfieAvatarFlow({
  userId,
  start,
  editAvatarId,
  onDone,
  onManual,
  onClose,
}: {
  userId: string;
  start: SelfieStep;
  /** open the editor directly on an existing avatar (change clothes etc.) */
  editAvatarId?: string;
  onDone: (ref: AvatarModelRef) => void;
  onManual: () => void;
  onClose?: () => void;
}) {
  const provider = defaultProvider;
  const [step, setStep] = useState<SelfieStep>(start);
  const [caps, setCaps] = useState<ProviderCapabilities | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const [avatarId, setAvatarId] = useState<string | undefined>(editAvatarId);
  const [genMsg, setGenMsg] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const pendingExport = useRef<GeneratedAvatar | null>(null);
  const lastPhotos = useRef<SelfiePhotos | null>(null);

  useEffect(() => {
    provider.capabilities().then(setCaps);
  }, [provider]);

  const fail = (m: string) => {
    setError(m);
    setStep('error');
  };

  const save = async (a: GeneratedAvatar) => {
    pendingExport.current = a;
    setStep('saving');
    try {
      const ref = await withTimeout(saveGeneratedModel(userId, a, provider.storeOnServer), SAVE_TIMEOUT_MS, 'Saving your avatar took too long. Please try again.');
      onDone(ref);
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e));
    }
  };

  const submitPhotos = async (p: SelfiePhotos) => {
    if (!provider.createFromPhotos) return;
    lastPhotos.current = p;
    setSubmitting(true);
    try {
      const id = await provider.createFromPhotos(p);
      setAvatarId(id);
      setStep('generating');
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  // poll the provider until the 3D face is generated
  useEffect(() => {
    if (step !== 'generating' || !avatarId || !provider.photoStatus) return;
    let alive = true;
    const started = Date.now();
    const msg = setInterval(() => setGenMsg((m) => (m + 1) % GEN_MESSAGES.length), 6000);
    const tick = async () => {
      if (!alive) return;
      try {
        const s = await provider.photoStatus!(avatarId);
        if (!alive) return;
        if (s === 'ready') return setStep('editor');
        if (s === 'failed')
          return fail("We couldn't build a 3D face from these photos. Try again in good light, facing the camera, with nothing covering your face.");
      } catch (e) {
        if (!alive) return;
        return fail(e instanceof Error ? e.message : String(e));
      }
      if (Date.now() - started > GENERATION_TIMEOUT_MS) return fail('Generating your avatar is taking longer than usual. Please try again.');
      setTimeout(tick, POLL_MS);
    };
    setTimeout(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(msg);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, avatarId]);

  // the provider editor (customisation; or the provider's own capture when no photo API)
  useEffect(() => {
    if (step !== 'editor' || !container.current) return;
    setEditorReady(false);
    const session = provider.open(
      container.current,
      { onLoad: () => setEditorReady(true), onExport: (a) => save(a), onError: (m) => fail(m) },
      { avatarId },
    );
    session.ready.then(() => setEditorReady(true)).catch(() => {});
    const t = setTimeout(() => setEditorReady(true), 15000); // never an endless spinner
    return () => {
      clearTimeout(t);
      session.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const startCamera = () => setStep(caps?.photoUpload ? 'capture' : 'editor');
  const card = 'glass-strong fade-in-up relative w-full max-w-lg rounded-3xl p-6 shadow-2xl';
  const configured = caps ? caps.photoUpload || caps.editor : true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/55 p-3 backdrop-blur-sm">
      {step === 'choose' && (
        <div className={card}>
          {onClose && (
            <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-1.5 text-cream/60 hover:bg-white/10" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          )}
          <p className="text-xs uppercase tracking-[0.25em] text-blush/80">Your character</p>
          <h2 className="mt-1 font-serif text-3xl">How would you like to appear?</h2>
          <div className="mt-5 grid gap-3">
            <button onClick={() => setStep('consent')} className="rounded-2xl border border-gold/50 bg-gradient-to-br from-[#3a1622] to-[#1a0c13] p-5 text-left transition hover:-translate-y-0.5">
              <Camera className="h-6 w-6 text-gold" />
              <p className="mt-2 font-serif text-2xl tracking-wide">CREATE AVATAR USING SELFIE</p>
              <p className="text-sm text-cream/70">A realistic 3D you — your face, hair and skin tone — generated with {provider.name}.</p>
            </button>
            <button onClick={onManual} className="rounded-2xl border border-white/15 bg-white/5 p-5 text-left transition hover:-translate-y-0.5">
              <Wand2 className="h-6 w-6 text-blush" />
              <p className="mt-2 font-serif text-2xl tracking-wide">CUSTOMIZE AVATAR MANUALLY</p>
              <p className="text-sm text-cream/70">Build a stylised character with face, hair, outfit and accessories.</p>
            </button>
          </div>
        </div>
      )}

      {step === 'consent' && (
        <div className={card}>
          <button onClick={() => setStep('choose')} className="absolute right-4 top-4 rounded-full p-1.5 text-cream/60 hover:bg-white/10" aria-label="Back">
            <X className="h-5 w-5" />
          </button>
          <ShieldCheck className="h-8 w-8 text-gold" />
          <h2 className="mt-2 font-serif text-3xl">Before we use your camera</h2>
          <ul className="mt-3 space-y-2 text-sm text-cream/80">
            <li>• The camera is used only to take 3 photos of your face (front, left, right) for your 3D avatar — only after you press the button below.</li>
            <li>• The photos are sent to {provider.name} to build your 3D face. Love Museum does not keep them — only the finished 3D model is saved.</li>
            <li>• You can replace or delete your avatar at any time (it is deleted from {provider.name} too).</li>
            <li>• Prefer not to use the camera? You can upload photos instead.</li>
          </ul>
          {configured ? (
            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={startCamera} disabled={!caps}>
                <Camera className="h-4 w-4" /> Allow camera & take selfie
              </Button>
              <Button variant="ghost" onClick={onManual}>
                <UserRound className="h-4 w-4" /> Customize manually instead
              </Button>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">
              Selfie avatars aren't switched on yet. {provider.configHint}
              <div className="mt-3">
                <Button size="sm" variant="ghost" onClick={onManual}>
                  <UserRound className="h-4 w-4" /> Customize manually instead
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 'capture' && (
        <div className="glass-strong fade-in-up relative w-full max-w-3xl rounded-3xl p-5 shadow-2xl">
          <h2 className="mb-3 font-serif text-2xl">Take your selfies</h2>
          <SelfieCapture busy={submitting} onSubmit={submitPhotos} onCancel={() => setStep('consent')} />
        </div>
      )}

      {step === 'generating' && (
        <div className={`${card} text-center`}>
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-blush" />
          <p className="mt-4 font-serif text-2xl">Creating your 3D avatar</p>
          <p key={genMsg} className="fade-in-up mt-1 text-sm text-cream/70">
            {GEN_MESSAGES[genMsg]}
          </p>
          <p className="mt-3 text-xs text-cream/40">This usually takes about a minute.</p>
          <Button variant="ghost" size="sm" className="mt-4" onClick={onManual}>
            Customize manually instead
          </Button>
        </div>
      )}

      {step === 'editor' && (
        <div className="fade-in-up relative flex h-full max-h-[900px] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/15 bg-black shadow-2xl">
          <div className="flex items-center justify-between bg-[#140a0f] px-4 py-2.5">
            <p className="text-sm text-cream/80">
              {avatarId ? 'Change hair, clothes, shoes and glasses — your face stays the same. Press ' : 'Take or upload your selfie, customise, then press '}
              <b>Next</b> to save.
            </p>
            <button onClick={() => setStep(onClose ? 'choose' : 'consent')} className="rounded-full p-1.5 text-cream/70 hover:bg-white/10" aria-label="Close editor">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="relative flex-1">
            <div ref={container} className="absolute inset-0 [&_iframe]:h-full [&_iframe]:w-full [&_iframe]:border-0" />
            {!editorReady && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 text-cream/80">
                <Loader2 className="h-8 w-8 animate-spin text-blush" />
                Opening the {provider.name} studio…
              </div>
            )}
          </div>
        </div>
      )}

      {step === 'saving' && (
        <div className={`${card} text-center`}>
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-blush" />
          <p className="mt-4 font-serif text-2xl">Bringing your avatar into the museum…</p>
          <p className="mt-1 text-sm text-cream/60">Saving your 3D model securely.</p>
        </div>
      )}

      {step === 'error' && (
        <div className={card}>
          <p className="font-serif text-2xl">Something went wrong</p>
          <p className="mt-2 text-sm text-cream/70">{error}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              onClick={() => {
                if (pendingExport.current) save(pendingExport.current);
                else if (avatarId) setStep('editor');
                else if (lastPhotos.current) submitPhotos(lastPhotos.current);
                else startCamera();
              }}
            >
              <RotateCcw className="h-4 w-4" /> Retry
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                pendingExport.current = null;
                setAvatarId(undefined);
                startCamera();
              }}
            >
              <Camera className="h-4 w-4" /> Take new selfies
            </Button>
            <Button variant="ghost" onClick={onManual}>
              <UserRound className="h-4 w-4" /> Customize manually
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
