import { Card, Logo, PageShell } from '../components/ui';

export default function SetupMissing() {
  return (
    <PageShell>
      <Logo />
      <Card className="mx-auto mt-16 max-w-2xl">
        <h1 className="font-serif text-3xl">Almost there — connect Supabase</h1>
        <p className="mt-3 text-cream/70">
          Love Museum keeps every museum private using Supabase Auth, Postgres, Storage and Realtime. Add your project keys to start creating museums.
        </p>
        <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm text-cream/80">
          <li>Create a free project at supabase.com.</li>
          <li>
            Open <b>SQL Editor</b>, paste <code className="text-blush">supabase/migrations/0001_love_museum.sql</code> and run it.
          </li>
          <li>
            Copy <code className="text-blush">.env.example</code> to <code className="text-blush">.env.local</code> and fill in <code>VITE_SUPABASE_URL</code> and{' '}
            <code>VITE_SUPABASE_ANON_KEY</code> (Project Settings → API).
          </li>
          <li>
            In <b>Realtime → Settings</b>, turn off <i>“Allow public access”</i> so museum channels stay private.
          </li>
          <li>Restart <code>npm run dev</code>.</li>
        </ol>
        <p className="mt-4 text-xs text-cream/50">Full details are in README.md.</p>
      </Card>
    </PageShell>
  );
}
