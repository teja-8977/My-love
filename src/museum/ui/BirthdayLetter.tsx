import { useEffect, useState } from 'react';
import { Heart, Music, VolumeX, X } from 'lucide-react';
import { useGame } from '../store';
import { BIRTHDAY_LETTER } from '../../story';
import { startLetterMusic } from '../../entrance/sfx';

/** The birthday letter: the envelope opens, the paper rises, soft music plays (only for the reader). */
export function BirthdayLetter() {
  const setOverlay = useGame((s) => s.setOverlay);
  const [stage, setStage] = useState<'closed' | 'opening' | 'open'>('closed');
  const [music, setMusic] = useState(true);

  useEffect(() => {
    const t1 = setTimeout(() => setStage('opening'), 500);
    const t2 = setTimeout(() => setStage('open'), 1900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  useEffect(() => {
    if (!music) return;
    return startLetterMusic();
  }, [music]);

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

      {stage !== 'open' ? (
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
