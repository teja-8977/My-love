import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { AuthPanel } from '../components/AuthPanel';
import { Card, Logo, PageShell } from '../components/ui';

/** Shown when a protected page is opened without being signed in: just ask for a name. */
export default function AuthPage() {
  const [params] = useSearchParams();
  const next = params.get('next') || '/';
  const nav = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) nav(next, { replace: true });
  }, [user, next, nav]);

  return (
    <PageShell>
      <Logo />
      <div className="mx-auto mt-10 max-w-md">
        <Card className="fade-in-up">
          <h1 className="text-center font-serif text-4xl">Welcome ❤️</h1>
          <p className="mb-6 mt-2 text-center text-sm text-cream/60">Tell us your name to step inside.</p>
          <AuthPanel next={next} />
        </Card>
      </div>
    </PageShell>
  );
}
