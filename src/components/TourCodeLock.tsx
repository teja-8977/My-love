import { useState, type FormEvent } from 'react';
import { Lock, X } from 'lucide-react';
import { TOUR_CODE } from '../story';
import { Button } from './ui';

/** Asks for the secret code before the host can start the tour. */
export function TourCodeLock({ onUnlock, onClose }: { onUnlock: () => void; onClose: () => void }) {
  const [value, setValue] = useState('');
  const [wrong, setWrong] = useState(false);
  const [shake, setShake] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim() === TOUR_CODE) return onUnlock();
    setWrong(true);
    setShake(true);
    setValue('');
    setTimeout(() => setShake(false), 500);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form onSubmit={submit} className={`glass-strong fade-in-up relative w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl ${shake ? 'lock-shake' : ''}`}>
        <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-full p-1.5 text-cream/60 hover:bg-white/10" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#a3203c] shadow-lg">
          <Lock className="h-6 w-6 text-[#f6d2da]" />
        </div>
        <h2 className="mt-4 font-serif text-3xl">Enter the secret code</h2>
        <p className="mt-1 text-sm text-cream/60">Only people who know it can start the tour.</p>
        <input
          autoFocus
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={12}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setWrong(false);
          }}
          placeholder="• • • •"
          className="mt-5 w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] text-cream outline-none focus:border-rose"
        />
        {wrong && <p className="mt-2 text-sm text-blush">Wrong code — try again ❤️</p>}
        <Button type="submit" className="mt-5 w-full" disabled={!value.trim()}>
          <Lock className="h-4 w-4" /> Unlock & start
        </Button>
      </form>
    </div>
  );
}
