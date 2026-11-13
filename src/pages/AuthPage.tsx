import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { Button, Card, Field, Input, Logo, PageShell, errMsg, toast } from '../components/ui';

export default function AuthPage() {
  const [params] = useSearchParams();
  const next = params.get('next') || '/dashboard';
  const nav = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup' | 'magic'>(params.get('mode') === 'signup' ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (user) nav(next, { replace: true });
  }, [user, next, nav]);

  const redirectTo = `${window.location.origin}/auth?next=${encodeURIComponent(next)}`;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name.trim() }, emailRedirectTo: redirectTo },
        });
        if (error) throw error;
        if (!data.session) {
          setSent(true);
          toast('Check your inbox to confirm your email ❤️', 'love');
        }
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

  return (
    <PageShell>
      <Logo />
      <div className="mx-auto mt-10 max-w-md">
        <Card className="fade-in-up">
          <h1 className="text-center font-serif text-4xl">{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h1>
          <p className="mt-2 text-center text-sm text-cream/60">
            {next.startsWith('/join') ? 'Sign in to accept your invitation ❤️' : 'Your memories are waiting.'}
          </p>

          {sent ? (
            <div className="mt-8 rounded-2xl border border-rose/20 bg-rose/10 p-5 text-center">
              <Mail className="mx-auto h-8 w-8 text-blush" />
              <p className="mt-3 text-cream/90">
                We sent a link to <b>{email}</b>. Open it on this device to continue.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-7 space-y-4">
              {mode === 'signup' && (
                <Field label="Your name">
                  <Input required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="Daniel" />
                </Field>
              )}
              <Field label="Email">
                <Input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </Field>
              {mode !== 'magic' && (
                <Field label="Password" hint={mode === 'signup' ? 'At least 6 characters' : undefined}>
                  <Input
                    required
                    type="password"
                    minLength={6}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </Field>
              )}
              <Button type="submit" className="w-full" loading={busy}>
                {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Email me a magic link'}
              </Button>
            </form>
          )}

          <div className="mt-6 flex flex-col items-center gap-2 text-sm text-cream/60">
            {mode !== 'signin' && (
              <button className="hover:text-blush" onClick={() => { setMode('signin'); setSent(false); }}>
                Already have an account? <span className="text-blush">Sign in</span>
              </button>
            )}
            {mode !== 'signup' && (
              <button className="hover:text-blush" onClick={() => { setMode('signup'); setSent(false); }}>
                New here? <span className="text-blush">Create an account</span>
              </button>
            )}
            {mode !== 'magic' && (
              <button className="hover:text-blush" onClick={() => { setMode('magic'); setSent(false); }}>
                Sign in with a magic link instead
              </button>
            )}
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
