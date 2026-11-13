import { Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, OrbitControls, Sparkles } from '@react-three/drei';
import { Camera, Trash2, UserRound } from 'lucide-react';
import { SelfieAvatarFlow, type SelfieStep } from '../avatar/SelfieAvatarFlow';
import { deleteModel } from '../avatar/modelStore';
import { defaultProvider } from '../avatar/providers';
import { WorldHtml } from '../components/WorldHtml';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { ArrowRight, Dices, Minus, Plus, RotateCcw, Save } from 'lucide-react';
import { Avatar } from '../avatar/Avatar';
import {
  CLOTH_COLORS, EYE_COLORS, HAIR_COLORS, LIP_COLORS, OPTIONS, SKIN_TONES,
  defaultAvatar, randomAvatar, type Accessory, type AvatarConfig,
} from '../avatar/config';
import type { AnimName } from '../avatar/poses';
import { useAuth } from '../auth/AuthProvider';
import { requestEntry, saveMyProfile, updateMyMember } from '../lib/api';
import { Button, Input, Logo, errMsg, toast } from '../components/ui';
import { Arch } from '../components/HeroScene';

type Tab = 'body' | 'face' | 'hair' | 'outfit' | 'shoes' | 'extras';
const TABS: { id: Tab; label: string }[] = [
  { id: 'body', label: 'Body' },
  { id: 'face', label: 'Face' },
  { id: 'hair', label: 'Hair' },
  { id: 'outfit', label: 'Outfit' },
  { id: 'shoes', label: 'Shoes' },
  { id: 'extras', label: 'Extras' },
];

function Chips<T extends string>({ value, options, onChange }: { value: T; options: readonly { id: string; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id as T)}
          className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
            value === o.id ? 'border-rose bg-rose/20 text-cream' : 'border-white/12 bg-white/5 text-cream/70 hover:border-blush/40 hover:text-cream'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Swatches({ value, colors, onChange }: { value: string; colors: string[]; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {colors.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          aria-label={c}
          className={`h-8 w-8 rounded-full border-2 transition hover:scale-110 ${value.toLowerCase() === c.toLowerCase() ? 'border-white ring-2 ring-rose' : 'border-white/20'}`}
          style={{ background: c }}
        />
      ))}
      <label className="relative h-8 w-8 cursor-pointer overflow-hidden rounded-full border-2 border-dashed border-white/30" title="Custom colour">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        <span className="flex h-full w-full items-center justify-center text-xs text-cream/70">+</span>
      </label>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <h4 className="text-xs uppercase tracking-[0.18em] text-blush/80">{title}</h4>
      {children}
    </div>
  );
}

export default function AvatarStudio() {
  const { user, profile, refreshProfile } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next');
  const museumId = params.get('museum'); // host who just created a room
  const joinCode = params.get('join'); // guest joining with a code
  const inFlow = !!(museumId || joinCode);
  const [cfg, setCfg] = useState<AvatarConfig>(() => profile?.avatar ?? defaultAvatar('female'));
  const [name, setName] = useState(profile?.display_name ?? '');
  const [tab, setTab] = useState<Tab>('body');
  const [anim, setAnim] = useState<AnimName>('idle');
  const [busy, setBusy] = useState(false);
  const [flow, setFlow] = useState<SelfieStep | null>(null);
  const loaded = useRef(false);
  const controls = useRef<OrbitControlsImpl>(null);

  useEffect(() => {
    if (profile && !loaded.current) {
      loaded.current = true;
      if (profile.avatar) setCfg(profile.avatar);
      else setFlow('choose');
      setName(profile.display_name);
    }
  }, [profile]);

  const set = <K extends keyof AvatarConfig>(k: K, v: AvatarConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));
  const toggleAcc = (a: Accessory) =>
    setCfg((c) => ({ ...c, accessories: c.accessories.includes(a) ? c.accessories.filter((x) => x !== a) : [...c.accessories, a] }));

  const zoom = (dir: 1 | -1) => {
    const c = controls.current;
    if (!c) return;
    const cam = c.object;
    const offset = cam.position.clone().sub(c.target);
    const len = Math.min(6, Math.max(1.2, offset.length() * (dir > 0 ? 0.85 : 1.18)));
    cam.position.copy(c.target).add(offset.setLength(len));
    c.update();
  };

  async function save(go: boolean) {
    if (!user) return;
    if (!name.trim()) {
      toast('Please add your name — it appears above your avatar', 'error');
      return;
    }
    setBusy(true);
    try {
      await saveMyProfile(user.id, { display_name: name.trim(), avatar: cfg });
      await refreshProfile();
      if (!go) {
        toast('Avatar saved ❤️', 'love');
        return;
      }
      if (joinCode) {
        const mid = await requestEntry(joinCode, name.trim(), cfg);
        nav(`/museum/${mid}/lobby`);
      } else if (museumId) {
        await updateMyMember(museumId, name.trim(), cfg);
        nav(`/museum/${museumId}/lobby`);
      } else nav(next || '/dashboard');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="romantic-bg flex h-full flex-col lg:flex-row">
      {/* 3D stage */}
      <div className="relative h-[55vh] shrink-0 lg:h-full lg:flex-1">
        <div className="absolute left-5 top-5 z-10">
          <Logo small />
          <p className="mt-2 font-serif text-2xl italic text-cream/80">Choose who walks in</p>
          {inFlow && <p className="mt-1 text-xs uppercase tracking-[0.2em] text-blush/80">Step 2 · {museumId ? 'You are the host' : 'Joining a room'}</p>}
        </div>
        <Canvas dpr={[1, 2]} camera={{ position: [0, 1.35, 4.2], fov: 35 }}>
          <color attach="background" args={['#1c0d14']} />
          <fog attach="fog" args={['#1c0d14', 6, 14]} />
          <ambientLight intensity={0.45} color="#ffe2ea" />
          <spotLight position={[2, 5, 4]} angle={0.5} penumbra={0.7} intensity={70} color="#fff0dc" />
          <directionalLight position={[-3, 3, -2]} intensity={1.5} color="#ff8fae" />
          <Environment resolution={128} frames={1}>
            <Lightformer form="rect" intensity={2} color="#fff0dc" position={[0, 4, 3]} scale={[6, 6, 1]} />
            <Lightformer form="rect" intensity={1} color="#ffd0dc" position={[-4, 2, 0]} rotation-y={Math.PI / 2} scale={[5, 3, 1]} />
          </Environment>
          <Suspense fallback={null}>
            <Avatar config={cfg} anim={anim} dance={0} shadow={false} />
            <WorldHtml position={[0, 1.98 * cfg.height, 0]}>
              <span className="nametag whitespace-nowrap text-sm">{name.trim() || 'Your name'}</span>
            </WorldHtml>
            <group scale={0.9}>
              <Arch />
            </group>
            <ContactShadows position={[0, 0.005, 0]} opacity={0.55} scale={4} blur={2.4} far={2} />
            <Sparkles count={40} scale={[5, 3, 3]} position={[0, 1.6, -1]} size={2} speed={0.25} color="#ffd1dc" />
          </Suspense>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[8, 64]} />
            <meshStandardMaterial color="#2a1219" roughness={0.4} metalness={0.15} />
          </mesh>
          <OrbitControls ref={controls} target={[0, 1.0, 0]} enablePan={false} minDistance={1.2} maxDistance={6} minPolarAngle={0.3} maxPolarAngle={1.62} />
        </Canvas>
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full glass-strong p-1.5">
          {(['idle', 'walk', 'dance', 'wave', 'sit'] as AnimName[]).map((a) => (
            <button key={a} onClick={() => setAnim(a)} className={`rounded-full px-3 py-1 text-xs capitalize ${anim === a ? 'bg-rose text-white' : 'text-cream/70 hover:text-cream'}`}>
              {a}
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-white/15" />
          <button onClick={() => zoom(1)} className="rounded-full p-1.5 text-cream/80 hover:bg-white/10" aria-label="Zoom in">
            <Plus className="h-4 w-4" />
          </button>
          <button onClick={() => zoom(-1)} className="rounded-full p-1.5 text-cream/80 hover:bg-white/10" aria-label="Zoom out">
            <Minus className="h-4 w-4" />
          </button>
        </div>
        <p className="pointer-events-none absolute bottom-16 left-0 right-0 text-center text-xs text-cream/40">Drag to rotate · scroll to zoom</p>
      </div>

      {/* Panel */}
      <div className="glass-strong flex min-h-0 w-full flex-col lg:h-full lg:w-[440px]">
        <div className="border-b border-white/10 p-5">
          <h4 className="mb-2 text-xs uppercase tracking-[0.18em] text-blush/80">Your name</h4>
          <Input maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="Shown above your avatar" />
          <div className={`mt-4 flex gap-1 overflow-x-auto ${cfg.model ? 'hidden' : ''}`}>
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm ${tab === t.id ? 'bg-white/15 text-cream' : 'text-cream/60 hover:text-cream'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
          {cfg.model ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-gold/40 bg-gradient-to-br from-[#3a1622] to-transparent p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-gold">Your selfie avatar</p>
                <p className="mt-1 text-sm text-cream/75">Made from your photo. Hair, outfit, shoes and glasses are changed in the avatar studio so your face stays exactly the same.</p>
              </div>
              <Button className="w-full" onClick={() => setFlow('editor')}>
                <Camera className="h-4 w-4" /> Change hair, clothes & accessories
              </Button>
              <Button className="w-full" variant="ghost" onClick={() => setCfg((c) => ({ ...c, model: null }))}>
                <UserRound className="h-4 w-4" /> Use a manual avatar instead
              </Button>
              <Button
                className="w-full"
                variant="danger"
                onClick={async () => {
                  if (!user || !cfg.model || !confirm('Delete your selfie avatar? This removes the 3D model from Love Museum.')) return;
                  try {
                    await deleteModel(user.id, cfg.model, defaultProvider.deleteRemote);
                    const nextCfg = { ...cfg, model: null };
                    setCfg(nextCfg);
                    await saveMyProfile(user.id, { avatar: nextCfg });
                    await refreshProfile();
                    toast('Selfie avatar deleted');
                  } catch (e) {
                    toast(errMsg(e), 'error');
                  }
                }}
              >
                <Trash2 className="h-4 w-4" /> Delete my selfie avatar
              </Button>
            </div>
          ) : (
            <button onClick={() => setFlow('consent')} className="flex w-full items-center gap-3 rounded-2xl border border-gold/40 bg-gold/10 px-4 py-3 text-left text-sm hover:bg-gold/15">
              <Camera className="h-5 w-5 shrink-0 text-gold" />
              <span>
                <b className="block text-cream">CREATE AVATAR USING SELFIE</b>
                <span className="text-cream/60">Get a realistic 3D you, made from your photo</span>
              </span>
            </button>
          )}
          {!cfg.model && tab === 'body' && (
            <>
              <Section title="Base">
                <Chips
                  value={cfg.gender}
                  options={OPTIONS.gender}
                  onChange={(g) => setCfg((c) => ({ ...defaultAvatar(g), skin: c.skin, eyeColor: c.eyeColor, hairColor: c.hairColor }))}
                />
              </Section>
              <Section title="Skin tone">
                <Swatches value={cfg.skin} colors={SKIN_TONES} onChange={(v) => set('skin', v)} />
              </Section>
              <Section title="Body type">
                <Chips value={cfg.build} options={OPTIONS.build} onChange={(v) => set('build', v)} />
              </Section>
              <Section title={`Height · ${Math.round(cfg.height * 170)} cm`}>
                <input type="range" min={0.9} max={1.1} step={0.01} value={cfg.height} onChange={(e) => set('height', Number(e.target.value))} className="w-full" />
              </Section>
            </>
          )}
          {!cfg.model && tab === 'face' && (
            <>
              <Section title="Face shape">
                <Chips value={cfg.faceShape} options={OPTIONS.faceShape} onChange={(v) => set('faceShape', v)} />
              </Section>
              <Section title="Eyes">
                <Chips value={cfg.eyes} options={OPTIONS.eyes} onChange={(v) => set('eyes', v)} />
              </Section>
              <Section title="Eye colour">
                <Swatches value={cfg.eyeColor} colors={EYE_COLORS} onChange={(v) => set('eyeColor', v)} />
              </Section>
              <Section title="Brows">
                <Chips value={cfg.brows} options={OPTIONS.brows} onChange={(v) => set('brows', v)} />
              </Section>
              <Section title="Nose">
                <Chips value={cfg.nose} options={OPTIONS.nose} onChange={(v) => set('nose', v)} />
              </Section>
              <Section title="Mouth">
                <Chips value={cfg.mouth} options={OPTIONS.mouth} onChange={(v) => set('mouth', v)} />
              </Section>
              <Section title="Lips">
                <Swatches value={cfg.lipColor} colors={LIP_COLORS} onChange={(v) => set('lipColor', v)} />
              </Section>
              <Section title="Facial hair">
                <Chips value={cfg.facialHair} options={OPTIONS.facialHair} onChange={(v) => set('facialHair', v)} />
              </Section>
              <Section title="Blush">
                <Chips value={cfg.blush ? 'on' : 'off'} options={[{ id: 'on', label: 'Rosy cheeks' }, { id: 'off', label: 'None' }]} onChange={(v) => set('blush', v === 'on')} />
              </Section>
            </>
          )}
          {!cfg.model && tab === 'hair' && (
            <>
              <Section title="Hairstyle">
                <Chips value={cfg.hair} options={OPTIONS.hair} onChange={(v) => set('hair', v)} />
              </Section>
              <Section title="Hair colour">
                <Swatches value={cfg.hairColor} colors={HAIR_COLORS} onChange={(v) => set('hairColor', v)} />
              </Section>
            </>
          )}
          {!cfg.model && tab === 'outfit' && (
            <>
              <Section title="Top">
                <Chips value={cfg.top} options={OPTIONS.top} onChange={(v) => set('top', v)} />
              </Section>
              <Section title="Top colour">
                <Swatches value={cfg.topColor} colors={CLOTH_COLORS} onChange={(v) => set('topColor', v)} />
              </Section>
              <Section title="Shirt / accent colour">
                <Swatches value={cfg.accentColor} colors={CLOTH_COLORS} onChange={(v) => set('accentColor', v)} />
              </Section>
              {cfg.top !== 'dress' && (
                <>
                  <Section title="Bottom">
                    <Chips value={cfg.bottom} options={OPTIONS.bottom} onChange={(v) => set('bottom', v)} />
                  </Section>
                  <Section title="Bottom colour">
                    <Swatches value={cfg.bottomColor} colors={CLOTH_COLORS} onChange={(v) => set('bottomColor', v)} />
                  </Section>
                </>
              )}
            </>
          )}
          {!cfg.model && tab === 'shoes' && (
            <>
              <Section title="Shoes">
                <Chips value={cfg.shoes} options={OPTIONS.shoes} onChange={(v) => set('shoes', v)} />
              </Section>
              <Section title="Shoe colour">
                <Swatches value={cfg.shoeColor} colors={CLOTH_COLORS} onChange={(v) => set('shoeColor', v)} />
              </Section>
            </>
          )}
          {!cfg.model && tab === 'extras' && (
            <Section title="Accessories">
              <div className="flex flex-wrap gap-2">
                {OPTIONS.accessories.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => toggleAcc(a.id)}
                    className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                      cfg.accessories.includes(a.id) ? 'border-gold bg-gold/20 text-cream' : 'border-white/12 bg-white/5 text-cream/70 hover:border-gold/40'
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </Section>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 p-4">
          <Button variant="ghost" size="sm" onClick={() => setCfg(defaultAvatar(cfg.gender))}>
            <RotateCcw className="h-4 w-4" /> RESET
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCfg(randomAvatar())}>
            <Dices className="h-4 w-4" /> RANDOMIZE
          </Button>
          <div className="flex-1" />
          {!inFlow && (
            <Button variant="outline" size="sm" loading={busy} onClick={() => save(false)}>
              <Save className="h-4 w-4" /> Save
            </Button>
          )}
          <Button size="sm" loading={busy} onClick={() => save(true)}>
            SAVE & CONTINUE <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {flow && user && (
        <SelfieAvatarFlow
          userId={user.id}
          start={flow}
          editAvatarId={flow === 'editor' ? cfg.model?.avatarId : undefined}
          onClose={profile?.avatar ? () => setFlow(null) : undefined}
          onManual={() => setFlow(null)}
          onDone={(ref) => {
            setCfg((c) => ({ ...c, model: ref }));
            setFlow(null);
            toast('Your personalised avatar is ready ❤️ Press SAVE & CONTINUE to keep it.', 'love');
          }}
        />
      )}
    </div>
  );
}
