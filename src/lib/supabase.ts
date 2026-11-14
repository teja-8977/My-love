import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const env = import.meta.env;

// This project's PUBLIC Supabase address and publishable key (safe in the browser — access is protected by
// Row Level Security). Used when no environment variables are set, e.g. on Vercel. Never put secret keys here.
const DEFAULT_URL = 'https://zfduhcdxaihgmxyspxnq.supabase.co';
const DEFAULT_KEY = 'sb_publishable_lAQ8Z7C0Ys21PT3uGkmQug_Wspi9z0r';
const url = (env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL) as string | undefined;
const anonKey = (env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || DEFAULT_KEY) as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey && !url.includes('YOUR-PROJECT'));

// Only the public anon key is used in the browser. All access control is enforced
// by Row Level Security policies in supabase/migrations.
export const supabase: SupabaseClient = createClient(
  url || 'http://localhost:54321',
  anonKey || 'public-anon-key-missing',
  {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    realtime: { params: { eventsPerSecond: 30 } },
  },
);
