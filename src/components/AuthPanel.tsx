import { useState, type FormEvent } from 'react';
import { Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button, Field, Input, errMsg, toast } from './ui';

/**
 * Entry inside the experience: just your name, no accounts or passwords.
 * Uses Supabase anonymous sign-in, which stays signed in on this device.
 */
export function AuthPanel({ onDone, intro }: { next?: string; onDone?: () => void; intro?: string }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInAnonymously({ options: { data: { display_name: name.trim() } } });
      if (error) {
        if (/anonymous/i.test(error.message)) throw new Error('Entry is turned off. Enable "Anonymous sign-ins" in Supabase → Authentication → Providers (Sign In / Up).');
        throw error;
      }
      onDone?.();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {intro && <p className="text-sm text-cream/70">{intro}</p>}
      <Field label="Your name">
        <Input autoFocus required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="Teja" />
      </Field>
      <Button type="submit" className="w-full" loading={busy}>
        <Sparkles className="h-4 w-4" /> Continue
      </Button>
      <p className="text-center text-[11px] text-cream/40">You stay signed in on this device.</p>
    </form>
  );
}
