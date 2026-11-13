import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { getMuseum, listMembers } from './api';
import type { Member, Museum } from './types';
import { sanitizeAvatar } from '../avatar/config';

/**
 * Live view of a museum row + its members.
 * Uses Postgres change feeds (respecting RLS) with a light polling fallback,
 * so the lobby keeps working across reconnects.
 */
export function useMuseumLive(museumId: string | undefined) {
  const [museum, setMuseum] = useState<Museum | null | undefined>(undefined);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  const reload = useCallback(async () => {
    if (!museumId) return;
    try {
      const [m, mem] = await Promise.all([getMuseum(museumId), listMembers(museumId)]);
      if (!alive.current) return;
      setMuseum(m);
      setMembers(mem.map((x) => ({ ...x, avatar: x.avatar ? sanitizeAvatar(x.avatar) : null })));
      setError(null);
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : String(e));
    }
  }, [museumId]);

  useEffect(() => {
    alive.current = true;
    if (!museumId) return;
    reload();
    const ch = supabase
      .channel(`lobby-db:${museumId}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'museum_members', filter: `museum_id=eq.${museumId}` }, () => reload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'museums', filter: `id=eq.${museumId}` }, () => reload())
      .subscribe();
    const poll = setInterval(reload, 6000);
    const onFocus = () => reload();
    window.addEventListener('focus', onFocus);
    return () => {
      alive.current = false;
      clearInterval(poll);
      window.removeEventListener('focus', onFocus);
      supabase.removeChannel(ch);
    };
  }, [museumId, reload]);

  return { museum, members, setMuseum, reload, error };
}
