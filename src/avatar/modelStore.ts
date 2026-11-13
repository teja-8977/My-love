import { supabase } from '../lib/supabase';
import type { AvatarModelRef } from './config';
import type { GeneratedAvatar } from './providers';

export const MODEL_BUCKET = 'avatar-models';

/**
 * Copies a generated GLB into our own private Supabase storage and records it.
 * Only the finished 3D model is stored — never the raw selfie photos (those stay inside the provider's editor).
 */
export async function saveGeneratedModel(
  userId: string,
  a: GeneratedAvatar,
  storeOnServer?: (url: string, avatarId: string) => Promise<string>,
): Promise<AvatarModelRef> {
  const safeId = a.avatarId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || 'avatar';
  let path = `${userId}/${a.provider}-${safeId}.glb`;

  // remove a previous model from this provider (replacement)
  const { data: previous } = await supabase.from('avatar_models').select('storage_path').eq('user_id', userId).eq('provider', a.provider).maybeSingle();

  // 1) download in the browser (works for data: URLs and CORS-enabled links)
  let blob: Blob | null = null;
  try {
    const res = await fetch(a.glbUrl);
    if (res.ok) blob = await res.blob();
  } catch {
    blob = null; // e.g. blocked by CORS — fall back to the server copy below
  }
  if (blob) {
    if (blob.size < 1000) throw new Error('The generated avatar file looks empty. Please try again.');
    const up = await supabase.storage.from(MODEL_BUCKET).upload(path, blob, { contentType: 'model/gltf-binary', upsert: true, cacheControl: '3600' });
    if (up.error) throw new Error(up.error.message);
  } else if (storeOnServer && /^https:\/\//.test(a.glbUrl)) {
    // 2) let our backend fetch the temporary export link and store it in the user's folder
    path = await storeOnServer(a.glbUrl, a.avatarId);
  } else {
    throw new Error('Could not download the generated avatar. Please try again.');
  }

  const row = await supabase.from('avatar_models').upsert(
    {
      user_id: userId,
      provider: a.provider,
      provider_avatar_id: a.avatarId,
      storage_path: path,
      body_id: a.bodyId ?? null,
      gender: a.gender ?? null,
      customization: a.extra ?? {},
    },
    { onConflict: 'user_id,provider' },
  );
  if (row.error) throw new Error(row.error.message);

  if (previous?.storage_path && previous.storage_path !== path) {
    await supabase.storage.from(MODEL_BUCKET).remove([previous.storage_path]);
  }
  urlCache.delete(path);
  return { provider: a.provider, avatarId: a.avatarId, path, gender: a.gender, bodyId: a.bodyId, v: Date.now() };
}

/** Deletes the user's stored model(s) for a provider. */
export async function deleteModel(userId: string, ref: AvatarModelRef, deleteRemote?: (avatarId: string) => Promise<void>) {
  // privacy: also remove it from the provider when possible (best effort)
  if (deleteRemote && /^[0-9a-f-]{36}$/i.test(ref.avatarId)) await deleteRemote(ref.avatarId).catch(() => {});
  await supabase.storage.from(MODEL_BUCKET).remove([ref.path]);
  await supabase.from('avatar_models').delete().eq('user_id', userId).eq('provider', ref.provider);
  urlCache.delete(ref.path);
}

const urlCache = new Map<string, { url: string; exp: number }>();

/** Short-lived signed URL for a stored model (cached for ~50 minutes). */
export async function modelUrl(ref: AvatarModelRef): Promise<string> {
  const hit = urlCache.get(ref.path);
  if (hit && hit.exp > Date.now()) return hit.url;
  const { data, error } = await supabase.storage.from(MODEL_BUCKET).createSignedUrl(ref.path, 3600);
  if (error || !data) throw new Error(error?.message ?? 'Could not load avatar model');
  urlCache.set(ref.path, { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}
