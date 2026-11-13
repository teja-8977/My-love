/**
 * Server-side Avaturn API integration (the API key never reaches the browser).
 *
 * Based on the official OpenAPI spec: https://api.avaturn.me/openapi.json
 *   base URL  https://api.avaturn.me     auth  Authorization: Bearer <project API token>
 *   POST /api/v1/users/new                         -> { id }
 *   POST /api/v1/avatars/new      { user_id }      -> { avatar_id, upload_url }
 *   POST <upload_url>  multipart: image-frontal, image-side-1, image-side-2, body-type (male|female), telephoto
 *   GET  /api/v1/users/{user_id}/avatars?include_not_ready=true -> [{ id, status: pending|processing|ready|failed }]
 *   POST /api/v1/sessions/new     { user_id, config: { type: create | create_or_edit_existing | edit_existing, avatar_id? } } -> { url, id }
 *   DELETE /api/v1/users/{user_id}/avatars/{avatar_id}
 *
 * Every request is authenticated with the caller's Supabase session; the Avaturn user id is
 * stored per Love Museum user in the `avaturn_users` table (RLS: owner only).
 *
 * Environment (server only):
 *   AVATURN_API_KEY      project API token from https://developer.avaturn.me  (SECRET)
 *   SUPABASE_URL / SUPABASE_ANON_KEY  (falls back to the VITE_ / NEXT_PUBLIC_ names)
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const AVATURN_BASE = 'https://api.avaturn.me';
const MODEL_BUCKET = 'avatar-models';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

type Env = Record<string, string | undefined>;

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

function config(env: Env) {
  const apiKey = env.AVATURN_API_KEY;
  const sbUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const sbKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!apiKey) throw new HttpError(503, 'Selfie avatars are not configured on the server (AVATURN_API_KEY is missing).');
  if (!sbUrl || !sbKey) throw new HttpError(503, 'Supabase is not configured on the server.');
  return { apiKey, sbUrl, sbKey };
}

async function avaturn<T>(apiKey: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${AVATURN_BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey}`, ...(init.body && !(init.body instanceof FormData) ? { 'content-type': 'application/json' } : {}), ...init.headers },
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 300);
    try {
      const j = JSON.parse(text);
      detail = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail ?? j).slice(0, 300);
    } catch {
      /* not json */
    }
    throw new HttpError(res.status === 401 || res.status === 403 ? 502 : res.status, `Avaturn: ${detail || res.statusText}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

/** Validates the caller's Supabase session and returns a client acting as that user. */
async function authUser(request: Request, sbUrl: string, sbKey: string) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Sign in first.');
  const sb = createClient(sbUrl, sbKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Your session has expired. Please sign in again.');
  return { sb, userId: data.user.id };
}

/** One Avaturn user per Love Museum user (created on first use). */
async function avaturnUserFor(sb: SupabaseClient, userId: string, apiKey: string): Promise<string> {
  const { data } = await sb.from('avaturn_users').select('avaturn_user_id').eq('user_id', userId).maybeSingle();
  if (data?.avaturn_user_id) return data.avaturn_user_id as string;
  const created = await avaturn<{ id: string }>(apiKey, '/api/v1/users/new', { method: 'POST' });
  const { error } = await sb.from('avaturn_users').insert({ user_id: userId, avaturn_user_id: created.id });
  if (error) throw new HttpError(500, `Could not save Avaturn user: ${error.message}`);
  return created.id;
}

async function ownsAvatar(apiKey: string, avUser: string, avatarId: string) {
  if (!UUID.test(avatarId)) throw new HttpError(400, 'Invalid avatar id');
  const list = await avaturn<{ id: string; status: string }[]>(apiKey, `/api/v1/users/${encodeURIComponent(avUser)}/avatars?include_not_ready=true`);
  const item = list.find((a) => a.id === avatarId);
  if (!item) throw new HttpError(404, 'Avatar not found');
  return item;
}

// ---------------------------------------------------------------------------
// actions
// ---------------------------------------------------------------------------

/** Photos (front + 2 sides) → new Avaturn avatar. Photos are forwarded, never stored. */
async function photos(request: Request, env: Env) {
  const { apiKey, sbUrl, sbKey } = config(env);
  const { sb, userId } = await authUser(request, sbUrl, sbKey);
  const form = await request.formData();
  const bodyType = String(form.get('body-type') ?? '');
  if (bodyType !== 'male' && bodyType !== 'female') throw new HttpError(400, 'body-type must be male or female');
  const out = new FormData();
  out.set('body-type', bodyType);
  out.set('telephoto', form.get('telephoto') === 'true' ? 'true' : 'false');
  for (const field of ['image-frontal', 'image-side-1', 'image-side-2']) {
    const f = form.get(field);
    if (!(f instanceof Blob) || f.size === 0) throw new HttpError(400, `Missing photo: ${field}`);
    if (f.size > MAX_PHOTO_BYTES) throw new HttpError(413, `${field} is too large`);
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) throw new HttpError(415, `${field} must be a JPG, PNG or WebP image`);
    out.set(field, f, `${field}.${f.type.split('/')[1] === 'jpeg' ? 'jpg' : f.type.split('/')[1]}`);
  }
  const avUser = await avaturnUserFor(sb, userId, apiKey);
  const created = await avaturn<{ avatar_id: string; upload_url: string }>(apiKey, '/api/v1/avatars/new', {
    method: 'POST',
    body: JSON.stringify({ user_id: avUser }),
  });
  const up = await fetch(created.upload_url, { method: 'POST', body: out });
  if (!up.ok) {
    const t = (await up.text()).slice(0, 200);
    throw new HttpError(502, `Avaturn rejected the photos (${up.status}). ${t}`);
  }
  return json(200, { avatarId: created.avatar_id });
}

/** Processing status of one of the caller's avatars. */
async function status(request: Request, env: Env) {
  const { apiKey, sbUrl, sbKey } = config(env);
  const { sb, userId } = await authUser(request, sbUrl, sbKey);
  const avatarId = new URL(request.url).searchParams.get('avatarId') ?? '';
  const avUser = await avaturnUserFor(sb, userId, apiKey);
  const item = await ownsAvatar(apiKey, avUser, avatarId);
  return json(200, { status: item.status });
}

/** Editor session URL for the Avaturn SDK: create a new avatar, or edit one (hair, clothes…) keeping the face. */
async function session(request: Request, env: Env) {
  const { apiKey, sbUrl, sbKey } = config(env);
  const { sb, userId } = await authUser(request, sbUrl, sbKey);
  const body = (await request.json().catch(() => ({}))) as { mode?: string; avatarId?: string };
  const avUser = await avaturnUserFor(sb, userId, apiKey);
  let cfg: Record<string, string> = { type: 'create_or_edit_existing' };
  if (body.mode === 'create') cfg = { type: 'create' };
  if (body.mode === 'edit') {
    await ownsAvatar(apiKey, avUser, body.avatarId ?? '');
    cfg = { type: 'edit_existing', avatar_id: body.avatarId! };
  }
  const s = await avaturn<{ url: string; id: string }>(apiKey, '/api/v1/sessions/new', {
    method: 'POST',
    body: JSON.stringify({ user_id: avUser, config: cfg }),
  });
  return json(200, { url: s.url });
}

/** Server-side copy of an exported GLB into the caller's Supabase folder (used when the browser can't fetch it). */
async function store(request: Request, env: Env) {
  const { apiKey, sbUrl, sbKey } = config(env);
  const { sb, userId } = await authUser(request, sbUrl, sbKey);
  const body = (await request.json().catch(() => ({}))) as { url?: string; avatarId?: string };
  if (!body.url || !/^https:\/\//.test(body.url)) throw new HttpError(400, 'An https export URL is required');
  const host = new URL(body.url).hostname;
  if (!/(^|\.)avaturn\.(me|dev)$|amazonaws\.com$|storage\.googleapis\.com$|cloudfront\.net$/.test(host)) throw new HttpError(400, 'Unexpected export host');
  const avUser = await avaturnUserFor(sb, userId, apiKey);
  await ownsAvatar(apiKey, avUser, body.avatarId ?? '');
  const res = await fetch(body.url);
  if (!res.ok) throw new HttpError(502, `Could not download the export (${res.status})`);
  const blob = await res.blob();
  const path = `${userId}/avaturn-${body.avatarId}.glb`;
  const up = await sb.storage.from(MODEL_BUCKET).upload(path, blob, { contentType: 'model/gltf-binary', upsert: true });
  if (up.error) throw new HttpError(500, up.error.message);
  return json(200, { path });
}

/** Deletes the avatar on Avaturn's side too (privacy). */
async function remove(request: Request, env: Env) {
  const { apiKey, sbUrl, sbKey } = config(env);
  const { sb, userId } = await authUser(request, sbUrl, sbKey);
  const body = (await request.json().catch(() => ({}))) as { avatarId?: string };
  const avUser = await avaturnUserFor(sb, userId, apiKey);
  await ownsAvatar(apiKey, avUser, body.avatarId ?? '');
  await avaturn(apiKey, `/api/v1/users/${encodeURIComponent(avUser)}/avatars/${body.avatarId}`, { method: 'DELETE' });
  return json(200, { ok: true });
}

const ACTIONS: Record<string, { method: string; fn: (r: Request, e: Env) => Promise<Response> }> = {
  photos: { method: 'POST', fn: photos },
  status: { method: 'GET', fn: status },
  session: { method: 'POST', fn: session },
  store: { method: 'POST', fn: store },
  delete: { method: 'POST', fn: remove },
};

/** Web-standard handler: /api/avaturn?action=<name> */
export async function handleAvaturn(request: Request, env: Env): Promise<Response> {
  try {
    const action = new URL(request.url).searchParams.get('action') ?? '';
    if (action === 'config') return json(200, { enabled: Boolean(env.AVATURN_API_KEY) });
    const a = ACTIONS[action];
    if (!a) throw new HttpError(404, 'Unknown action');
    if (request.method !== a.method) throw new HttpError(405, 'Method not allowed');
    return await a.fn(request, env);
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    const message = e instanceof Error ? e.message : 'Unexpected error';
    if (status >= 500) console.error('[avaturn]', message);
    return json(status, { error: message });
  }
}
