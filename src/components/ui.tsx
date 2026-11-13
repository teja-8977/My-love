import { useMemo, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';
import { create } from 'zustand';
import { Heart, Loader2, X } from 'lucide-react';

// ---------- Button ----------
type Variant = 'primary' | 'ghost' | 'outline' | 'danger' | 'gold';
const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-rose to-[#c43d63] text-white shadow-[0_10px_30px_-10px_rgba(232,87,122,0.7)] hover:brightness-110',
  gold: 'bg-gradient-to-r from-champagne to-gold text-ink shadow-[0_10px_30px_-10px_rgba(217,178,111,0.6)] hover:brightness-105',
  ghost: 'bg-white/5 hover:bg-white/10 text-cream',
  outline: 'border border-blush/40 text-cream hover:bg-blush/10',
  danger: 'bg-red-500/15 text-red-200 border border-red-400/30 hover:bg-red-500/25',
};

export function Button({
  variant = 'primary',
  loading,
  className = '',
  children,
  size = 'md',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'lg' ? 'px-7 py-3.5 text-base' : size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-5 py-2.5 text-sm';
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-wide transition-all duration-200 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none cursor-pointer ${sz} ${VARIANTS[variant]} ${className}`}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

// ---------- Inputs ----------
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-blush/80">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-cream/50">{hint}</span>}
    </label>
  );
}

const inputCls =
  'w-full rounded-xl border border-white/12 bg-white/[0.06] px-4 py-2.5 text-cream placeholder:text-cream/35 outline-none transition focus:border-rose/60 focus:bg-white/[0.09] focus:ring-2 focus:ring-rose/20';

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ''}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputCls} min-h-[90px] resize-y ${props.className ?? ''}`} />;
}

// ---------- Layout ----------
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`glass rounded-3xl p-6 ${className}`}>{children}</div>;
}

export function Logo({ small }: { small?: boolean }) {
  return (
    <Link to="/" className="group inline-flex items-center gap-2">
      <Heart className={`${small ? 'h-4 w-4' : 'h-5 w-5'} fill-rose text-rose transition group-hover:scale-110`} />
      <span className={`font-serif ${small ? 'text-lg' : 'text-xl'} tracking-[0.25em] text-cream`}>LOVE MUSEUM</span>
    </Link>
  );
}

export function FloatingHearts({ count = 18 }: { count?: number }) {
  const hearts = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 100,
        dur: 12 + Math.random() * 16,
        delay: -Math.random() * 25,
        s: 0.4 + Math.random() * 1.1,
        o: 0.15 + Math.random() * 0.35,
        key: i,
      })),
    [count],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {hearts.map((h) => (
        <Heart
          key={h.key}
          className="floating-heart fill-current"
          style={{
            left: `${h.left}%`,
            animationDuration: `${h.dur}s`,
            animationDelay: `${h.delay}s`,
            ['--s' as string]: h.s,
            ['--o' as string]: h.o,
          }}
        />
      ))}
    </div>
  );
}

export function PageShell({ children, hearts = true, wide }: { children: ReactNode; hearts?: boolean; wide?: boolean }) {
  return (
    <div className="romantic-bg relative min-h-full overflow-x-hidden">
      {hearts && <FloatingHearts count={12} />}
      <div className={`relative mx-auto px-4 pb-16 pt-6 sm:px-6 ${wide ? 'max-w-7xl' : 'max-w-5xl'}`}>{children}</div>
    </div>
  );
}

export function FullscreenLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="romantic-bg fixed inset-0 z-50 flex flex-col items-center justify-center gap-4">
      <Heart className="h-10 w-10 animate-pulse fill-rose text-rose" />
      <p className="font-serif text-xl italic text-cream/80">{label}</p>
    </div>
  );
}

export function Spinner() {
  return <Loader2 className="h-5 w-5 animate-spin text-blush" />;
}

// ---------- Modal ----------
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose?: () => void; title?: string; children: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`glass-strong fade-in-up relative w-full ${wide ? 'max-w-3xl' : 'max-w-md'} rounded-3xl p-6 shadow-2xl`}>
        {onClose && (
          <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-1.5 text-cream/60 hover:bg-white/10 hover:text-cream" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        )}
        {title && <h3 className="mb-4 pr-8 font-serif text-2xl text-cream">{title}</h3>}
        {children}
      </div>
    </div>
  );
}

// ---------- Toasts ----------
interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'error' | 'love';
}
interface ToastStore {
  toasts: Toast[];
  push: (text: string, tone?: Toast['tone']) => void;
  remove: (id: number) => void;
}
let tid = 0;
export const useToasts = create<ToastStore>((set, get) => ({
  toasts: [],
  push: (text, tone = 'info') => {
    const id = ++tid;
    set({ toasts: [...get().toasts, { id, text, tone }] });
    setTimeout(() => get().remove(id), 4500);
  },
  remove: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));
export const toast = (text: string, tone?: Toast['tone']) => useToasts.getState().push(text, tone);

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed left-1/2 top-4 z-[100] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`fade-in-up pointer-events-auto rounded-2xl px-4 py-3 text-sm shadow-xl ${
            t.tone === 'error' ? 'border border-red-400/30 bg-red-950/90 text-red-100' : t.tone === 'love' ? 'border border-rose/30 bg-[#3a1220]/95 text-blush' : 'glass-strong text-cream'
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function errMsg(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}
