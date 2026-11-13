import { supabase } from '../../lib/supabase';

/** Browser client for our own /api/avaturn backend (which holds the secret Avaturn API key). */

export type AvaturnStatus = 'pending' | 'processing' | 'ready' | 'failed';

async function call<T>(action: string, init: RequestInit = {}, query = ''): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(`/api/avaturn?action=${action}${query}`, {
    ...init,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.body && !(init.body instanceof FormData) ? { 'content-type': 'application/json' } : {}), ...init.headers },
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error || `Avatar service error (${res.status})`);
  return body;
}

let enabled: Promise<boolean> | null = null;
/** True when the server has an Avaturn API key (photo upload + editor sessions available). */
export function avaturnApiEnabled() {
  enabled ??= fetch('/api/avaturn?action=config')
    .then((r) => (r.ok ? r.json() : { enabled: false }))
    .then((j: { enabled?: boolean }) => Boolean(j.enabled))
    .catch(() => false);
  return enabled;
}

export async function submitPhotos(p: { frontal: Blob; side1: Blob; side2: Blob; bodyType: 'male' | 'female' }) {
  const fd = new FormData();
  fd.set('body-type', p.bodyType);
  fd.set('telephoto', 'false');
  fd.set('image-frontal', p.frontal, 'frontal.jpg');
  fd.set('image-side-1', p.side1, 'side1.jpg');
  fd.set('image-side-2', p.side2, 'side2.jpg');
  return (await call<{ avatarId: string }>('photos', { method: 'POST', body: fd })).avatarId;
}

export async function avatarStatus(avatarId: string) {
  return (await call<{ status: AvaturnStatus }>('status', {}, `&avatarId=${encodeURIComponent(avatarId)}`)).status;
}

export async function editorSessionUrl(mode: 'create' | 'edit' | 'auto', avatarId?: string) {
  return (await call<{ url: string }>('session', { method: 'POST', body: JSON.stringify({ mode, avatarId }) })).url;
}

export async function storeExportOnServer(url: string, avatarId: string) {
  return (await call<{ path: string }>('store', { method: 'POST', body: JSON.stringify({ url, avatarId }) })).path;
}

export async function deleteRemoteAvatar(avatarId: string) {
  await call('delete', { method: 'POST', body: JSON.stringify({ avatarId }) });
}
