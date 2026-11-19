import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Heart, Lock, Music, VolumeX, X } from 'lucide-react';
import { useGame } from '../store';
import { BIRTHDAY_LETTER, LETTER_LOCK } from '../../story';
import { startLetterMusic } from '../../entrance/sfx';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const UNLOCK_KEY = 'lm-letter-unlocked';

/** Reads a typed date: 17/03/2023, 17-3-23, 17.03.2023, 17032023, "17 March 2023", "March 17 2023". */
export function parseDate(text: string): { day: number; month: number; year: number } | null {
  const tokens = text.toLowerCase().match(/\d+|[a-z]+/g) ?? [];
  let month: number | null = null;
  const nums: string[] = [];
  for (const t of tokens) {
    if (/^\d+$/.test(t)) nums.push(t);
    else {
      const m = MONTHS.findIndex((p) => t.startsWith(p));
      if (m >= 0) month = m + 1;
    }
  }
  if (nums.length === 1 && nums[0].length === 8 && month === null) {
    const n = nums[0];
    return { day: +n.slice(0, 2), month: +n.slice(2, 4), year: +n.slice(4) };
  }
  if (nums.length === 1 && nums[0].length === 6 && month === null) {
    const n = nums[0];
    return { day: +n.slice(0, 2), month: +n.slice(2, 4), year: 2000 + +n.slice(4) };
  }
  const fixYear = (y: string) => (y.length <= 2 ? 2000 + +y : +y);
  if (month !== null && nums.length >= 2) {
    const yIdx = nums.findIndex((n) => n.length === 4);
    const year = yIdx >= 0 ? nums[yIdx] : nums[1];
    const day = nums.find((_, i) => i !== (yIdx >= 0 ? yIdx : 1)) ?? nums[0];
    return { day: +day, month, year: fixYear(year) };
  }
  if (month === null && nums.length >= 3) return { day: +nums[0], month: +nums[1], year: fixYear(nums[2]) };
  return null;
}

function randomExample() {
  // a random date in the same format — never the real answer
  const a = LETTER_LOCK.answer;
  for (;;) {
    const d = 1 + Math.floor(Math.random() * 28);
    const m = 1 + Math.floor(Math.random() * 12);
    const y = 2015 + Math.floor(Math.random() * 11);
    if (d === a.day && m === a.month) continue;
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
  }
}

function LetterLock({ onUnlock }: { onUnlock: () => void }) {
  const [value, setValue] = useState('');
  const [tries, setTries] = useState(0);
  const [shake, setShake] = useState(false);
  const [wrong, setWrong] = useState(false);
  const example = useMemo(randomExample, []);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const d = parseDate(value);
    const a = LETTER_LOCK.answer;
    // also accept month-first (03/17/2023) when it can only mean that
    const ok = (x: { day: number; month: number; year: number }) => x.day === a.day && x.month === a.month && x.year === a.year;
    if (d && (ok(d) || (d.month > 12 && ok({ day: d.month, month: d.day, year: d.year })))) return onUnlock();
    setTries((t) => t + 1);
    setWrong(true);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };
  return (
    <form
      onSubmit={submit}
      className={`letter-rise relative mx-4 w-full max-w-sm rounded-3xl bg-[#fffaf2] px-6 py-8 text-center text-[#3b2a22] shadow-[0_40px_120px_rgba(0,0,0,0.7)] ${shake ? 'lock-shake' : ''}`}
    >
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#a3203c] shadow-lg">
        <Lock className="h-7 w-7 text-[#f6d2da]" />
      </div>
      <p className="mt-4 font-script text-4xl text-[#b4465e]">{LETTER_LOCK.question}</p>
      <p className="mt-1 font-serif text-lg italic text-[#8a5a48]">{LETTER_LOCK.subtitle}</p>
      <input
        autoFocus
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setWrong(false);
        }}
        placeholder="DD/MM/YYYY"
        className="mt-5 w-full rounded-2xl border-2 border-[#e2b9a3] bg-white px-4 py-3 text-center font-mono text-xl tracking-[0.2em] text-[#3b2a22] outline-none focus:border-[#b4465e]"
      />
      <p className="mt-2 text-sm text-[#8a5a48]">
        Hint: type it like <b className="font-mono">{example}</b> (day / month / year)
      </p>
      {wrong && <p className="mt-2 text-sm font-medium text-[#b4465e]">Not quite… try again ❤️</p>}
      {tries >= 3 && <p className="mt-1 text-sm italic text-[#8a5a48]">{LETTER_LOCK.extraHint}</p>}
      <button type="submit" className="mt-5 w-full rounded-full bg-gradient-to-r from-[#e8577a] to-[#c43d63] py-3 font-semibold text-white shadow-lg active:scale-95">
        Unlock my letter 💌
      </button>
    </form>
  );
}

/** The birthday letter: locked with the day you met; then the envelope opens, the paper rises and soft music plays. */
export function BirthdayLetter() {
  const setOverlay = useGame((s) => s.setOverlay);
  const [unlocked, setUnlocked] = useState(() => {
    try {
      return localStorage.getItem(UNLOCK_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [stage, setStage] = useState<'closed' | 'opening' | 'open'>('closed');
  const [music, setMusic] = useState(true);

  useEffect(() => {
    if (!unlocked) return;
    const t1 = setTimeout(() => setStage('opening'), 500);
    const t2 = setTimeout(() => setStage('open'), 1900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [unlocked]);

  useEffect(() => {
    if (!music || !unlocked) return;
    return startLetterMusic();
  }, [music, unlocked]);

  const L = BIRTHDAY_LETTER;
  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#1a0910]/85 backdrop-blur-sm">
      {/* floating hearts */}
      <div className="pointer-events-none absolute inset-0">
        {Array.from({ length: 16 }, (_, i) => (
          <Heart
            key={i}
            className="floating-heart fill-current"
            style={{ left: `${(i * 61) % 100}%`, animationDuration: `${10 + (i % 5) * 3}s`, animationDelay: `${-i * 1.7}s`, ['--s' as string]: 0.5 + (i % 4) * 0.25, ['--o' as string]: 0.35 }}
          />
        ))}
      </div>

      <div className="absolute right-4 top-4 z-10 flex gap-2">
        <button onClick={() => setMusic((m) => !m)} className="rounded-full bg-white/10 p-2.5 text-cream hover:bg-white/20" aria-label={music ? 'Mute music' : 'Play music'}>
          {music ? <Music className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
        </button>
        <button onClick={() => setOverlay(null)} className="rounded-full bg-white/10 p-2.5 text-cream hover:bg-white/20" aria-label="Close letter">
          <X className="h-5 w-5" />
        </button>
      </div>

      {!unlocked ? (
        <LetterLock
          onUnlock={() => {
            try {
              localStorage.setItem(UNLOCK_KEY, '1');
            } catch {
              /* private mode: ask again next time */
            }
            setUnlocked(true);
          }}
        />
      ) : stage !== 'open' ? (
        /* the envelope */
        <div className="relative h-56 w-80 sm:h-64 sm:w-96" style={{ perspective: '900px' }}>
          <div className="absolute inset-0 rounded-md bg-gradient-to-b from-[#f6e3d4] to-[#e9c9b5] shadow-[0_30px_80px_rgba(0,0,0,0.6)]" />
          {/* letter peeking out */}
          <div
            className="absolute inset-x-6 top-4 h-44 rounded-sm bg-[#fffaf2] shadow transition-transform duration-[1300ms] ease-out"
            style={{ transform: stage === 'opening' ? 'translateY(-55%)' : 'translateY(0)' }}
          >
            <p className="pt-5 text-center font-script text-3xl text-[#b4465e]">{L.heading}</p>
          </div>
          {/* front pocket */}
          <div className="absolute inset-x-0 bottom-0 h-full rounded-md" style={{ background: 'linear-gradient(155deg, transparent 49.5%, #e7c2ad 50%), linear-gradient(205deg, transparent 49.5%, #ecccb8 50%)' }} />
          {/* flap */}
          <div
            className="absolute inset-x-0 top-0 h-1/2 origin-top transition-transform duration-700 ease-in-out"
            style={{ transform: stage === 'opening' ? 'rotateX(180deg)' : 'rotateX(0deg)', transformStyle: 'preserve-3d' }}
          >
            <div className="h-full w-full" style={{ background: '#e2b9a3', clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }} />
          </div>
          {/* wax seal */}
          <div className={`absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#a3203c] shadow-lg transition-opacity duration-300 ${stage === 'opening' ? 'opacity-0' : ''}`}>
            <Heart className="h-6 w-6 fill-[#f6d2da] text-[#f6d2da]" />
          </div>
        </div>
      ) : (
        /* the open letter */
        <div className="letter-rise relative mx-3 max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-sm bg-[#fffaf2] px-6 py-8 text-[#3b2a22] shadow-[0_40px_120px_rgba(0,0,0,0.7)] sm:px-14 sm:py-12">
          <div className="pointer-events-none absolute inset-3 rounded-sm border border-[#d9b26f]/50" />
          <p className="text-center font-script text-5xl text-[#b4465e] sm:text-6xl">{L.heading}</p>
          <div className="mx-auto my-5 h-px w-40 bg-gradient-to-r from-transparent via-[#d9b26f] to-transparent" />
          <div className="space-y-4 font-serif text-[19px] leading-relaxed sm:text-[21px]">
            {L.paragraphs.map((p, i) => (
              <p key={i} className="letter-line" style={{ animationDelay: `${0.25 + i * 0.12}s` }}>
                {p}
              </p>
            ))}
          </div>
          <div className="letter-line mt-8 text-right font-serif text-[20px] italic sm:text-[22px]" style={{ animationDelay: `${0.25 + L.paragraphs.length * 0.12}s` }}>
            {L.closing.map((c, i) => (
              <p key={i} className={i === L.closing.length - 1 ? 'mt-1 font-script text-4xl not-italic text-[#b4465e]' : ''}>
                {c}
              </p>
            ))}
          </div>
          <p className="letter-line mt-10 text-center font-serif text-lg italic text-[#8a5a48]" style={{ animationDelay: `${0.6 + L.paragraphs.length * 0.12}s` }}>
            {L.footer}
          </p>
          <div className="mt-6 flex justify-center">
            <Heart className="h-6 w-6 animate-pulse fill-[#e8577a] text-[#e8577a]" />
          </div>
        </div>
      )}
    </div>
  );
}
