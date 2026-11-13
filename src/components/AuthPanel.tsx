import { useState, type FormEvent } from 'react';
import { Mail, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button, Field, Input, errMsg, toast } from './ui';

/**
 * Sign-in that lives inside the experience (no separate website page).
 * "Continue as guest" uses Supabase anonymous sign-in; email accounts are optional.
 */
export function AuthPanel({ next, onDone, intro }: { next: string; onDone?: () => void; intro?: string }) {
  const [mode, setMode] = useState<'guest' | 'signin' | 'signup' | 'magic'>('guest');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const redirectTo = `${window.location.origin}/auth?next=${encodeURIComponent(next)}`;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'guest') {
        const { error } = await supabase.auth.signInAnonymously({ options: { data: { display_name: name.trim() } } });
        if (error) {
          if (/anonymous/i.test(error.message)) throw new Error('Guest entry is turned off. Enable "Anonymous sign-ins" in Supabase → Authentication → Providers, or use email below.');
          throw error;
        }
        onDone?.();
      } else if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onDone?.();
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: name.trim() }, emailRedirectTo: redirectTo } });
        if (error) throw error;
        if (data.session) onDone?.();
        else setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
        if (error) throw error;
        setSent(true);
      }
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  if (sent)
    return (
      <div className="text-center">
        <Mail className="mx-auto h-8 w-8 text-blush" />
        <p className="mt-3 text-cream/90">
          We sent a link to <b>{email}</b>. Open it on this device to continue ❤️
        </p>
      </div>
    );

  return (
    <form onSubmit={submit} className="space-y-4">
      {intro && <p className="text-sm text-cream/70">{intro}</p>}
      {(mode === 'guest' || mode === 'signup') && (
        <Field label="Your name">
          <Input autoFocus required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="Teja" />
        </Field>
      )}
      {mode !== 'guest' && (
        <Field label="Email">
          <Input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </Field>
      )}
      {(mode === 'signin' || mode === 'signup') && (
        <Field label="Password">
          <Input required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
        </Field>
      )}
      <Button type="submit" className="w-full" loading={busy}>
        {mode === 'guest' ? (
          <>
            <Sparkles className="h-4 w-4" /> Continue
          </>
        ) : mode === 'signin' ? (
          'Sign in'
        ) : mode === 'signup' ? (
          'Create account'
        ) : (
          'Email me a link'
        )}
      </Button>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-cream/60">
        {mode !== 'guest' && (
          <button type="button" onClick={() => setMode('guest')} className="hover:text-blush">
            Quick entry (no email)
          </button>
        )}
        {mode !== 'signin' && (
          <button type="button" onClick={() => setMode('signin')} className="hover:text-blush">
            I have an account
          </button>
        )}
        {mode !== 'signup' && (
          <button type="button" onClick={() => setMode('signup')} className="hover:text-blush">
            Create an account
          </button>
        )}
        {mode === 'signin' && (
          <button type="button" onClick={() => setMode('magic')} className="hover:text-blush">
            Magic link
          </button>
        )}
      </div>
      {mode === 'guest' && <p className="text-center text-[11px] text-cream/40">Guest entry stays signed in on this device. Create an account to keep your museum on any device.</p>}
    </form>
  );
}
