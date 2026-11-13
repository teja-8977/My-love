import { supabase } from './supabase';
import type { InviteInfo, MediaItem, Member, Museum, Profile, ResolvedMedia } from './types';
import type { AvatarConfig } from '../avatar/config';

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

// ---------- profiles ----------
export async function getMyProfile(userId: string): Promise<Profile | null> {
  return check(await supabase.from('profiles').select('id, display_name, avatar').eq('id', userId).maybeSingle()) as Profile | null;
}

export async function saveMyProfile(userId: string, patch: Partial<Pick<Profile, 'display_name' | 'avatar'>>) {
  check(await supabase.from('profiles').upsert({ id: userId, ...patch, updated_at: new Date().toISOString() }));
}

// ---------- museums ----------
export async function listMyMuseums(userId: string): Promise<Museum[]> {
  return check(await supabase.from('museums').select('*').eq('host_id', userId).order('created_at', { ascending: false })) as Museum[];
}

export async function listJoinedMuseums(userId: string): Promise<(Member & { museum: Museum })[]> {
  const rows = check(
    await supabase
      .from('museum_members')
      .select('*, museum:museums(*)')
      .eq('user_id', userId)
      .eq('role', 'guest')
      .in('status', ['pending', 'accepted'])
      .order('created_at', { ascending: false }),
  ) as (Member & { museum: Museum })[];
  return rows.filter((r) => r.museum);
}

export async function createMuseum(input: { host_id: string; name: string; partner_names: string }): Promise<Museum> {
  return check(await supabase.from('museums').insert(input).select('*').single()) as Museum;
}

export async function getMuseum(id: string): Promise<Museum | null> {
  return check(await supabase.from('museums').select('*').eq('id', id).maybeSingle()) as Museum | null;
}

export async function updateMuseum(
  id: string,
  patch: Partial<Pick<Museum, 'name' | 'partner_names' | 'welcome_message' | 'final_message' | 'status'>>,
) {
  return check(await supabase.from('museums').update(patch).eq('id', id).select('*').single()) as Museum;
}

const hex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('');

export async function regenerateInvite(id: string) {
  return check(
    await supabase.from('museums').update({ invite_code: hex(12), room_code: hex(3).toUpperCase() }).eq('id', id).select('*').single(),
  ) as Museum;
}

export async function deleteMuseum(id: string) {
  for (const folder of ['photos', 'videos']) {
    const { data } = await supabase.storage.from(MEDIA_BUCKET).list(`${id}/${folder}`, { limit: 100 });
    if (data?.length) await supabase.storage.from(MEDIA_BUCKET).remove(data.map((f) => `${id}/${folder}/${f.name}`));
  }
  check(await supabase.from('museums').delete().eq('id', id));
}

// ---------- members ----------
export async function listMembers(museumId: string): Promise<Member[]> {
  return check(await supabase.from('museum_members').select('*').eq('museum_id', museumId).order('created_at')) as Member[];
}

export async function getMyMembership(museumId: string, userId: string): Promise<Member | null> {
  return check(
    await supabase.from('museum_members').select('*').eq('museum_id', museumId).eq('user_id', userId).maybeSingle(),
  ) as Member | null;
}

export async function setMemberStatus(museumId: string, userId: string, status: Member['status']) {
  check(await supabase.from('museum_members').update({ status }).eq('museum_id', museumId).eq('user_id', userId));
}

export async function updateMyMember(museumId: string, displayName: string, avatar: AvatarConfig | null) {
  check(await supabase.rpc('update_my_member', { mid: museumId, p_display_name: displayName, p_avatar: avatar }));
}

export async function transferHost(museumId: string, newHost: string) {
  check(await supabase.rpc('transfer_host', { mid: museumId, new_host: newHost }));
}

export async function leaveMuseum(museumId: string) {
  check(await supabase.rpc('leave_museum', { mid: museumId }));
}

// ---------- invites ----------
export async function getInvite(code: string): Promise<InviteInfo | null> {
  const rows = check(await supabase.rpc('get_invite', { code })) as InviteInfo[];
  return rows?.[0] ?? null;
}

export async function requestEntry(code: string, displayName: string, avatar: AvatarConfig | null): Promise<string> {
  return check(await supabase.rpc('request_entry', { code, p_display_name: displayName, p_avatar: avatar })) as string;
}

/** Works before sign-in: only names, and only for a valid code. */
export async function getInvitePublic(code: string): Promise<{ name: string; partner_names: string; host_name: string } | null> {
  const { data, error } = await supabase.rpc('get_invite_public', { code });
  if (error) return null;
  return (data as { name: string; partner_names: string; host_name: string }[])?.[0] ?? null;
}

/** Accepts a full invitation link, an invite code or a short room code. */
export function parseInviteInput(raw: string) {
  const s = raw.trim();
  const m = s.match(/join\/([a-z0-9]+)/i);
  return (m ? m[1] : s).replace(/[^a-z0-9]/gi, '');
}

/** "Pranathi & Teja" -> "Welcome to Pranathi & Teja's Love Museum ❤️" */
export function welcomeLine(partnerNames?: string | null) {
  const n = (partnerNames ?? '').trim();
  return n ? `Welcome to ${n}'s Love Museum ❤️` : 'Welcome to Your Love Museum ❤️';
}

export function inviteUrl(code: string) {
  return `${window.location.origin}/join/${code}`;
}

// ---------- media ----------
export const MEDIA_BUCKET = 'museum-media';

export async function listMedia(museumId: string): Promise<MediaItem[]> {
  return check(await supabase.from('museum_media').select('*').eq('museum_id', museumId).order('slot')) as MediaItem[];
}

export async function resolveMedia(items: MediaItem[], expiresIn = 60 * 60 * 6): Promise<ResolvedMedia[]> {
  if (!items.length) return [];
  const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(items.map((i) => i.storage_path), expiresIn);
  if (error) throw new Error(error.message);
  const map = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return items.map((i) => ({ ...i, url: map.get(i.storage_path) ?? '' })).filter((i) => i.url);
}

export async function uploadMedia(opts: {
  museumId: string;
  kind: 'photo' | 'video';
  slot: number;
  file: Blob;
  ext: string;
  contentType: string;
  width?: number;
  height?: number;
  caption?: string;
  previousPath?: string;
}): Promise<MediaItem> {
  const folder = opts.kind === 'photo' ? 'photos' : 'videos';
  const path = `${opts.museumId}/${folder}/${opts.slot}-${Date.now()}.${opts.ext}`;
  const up = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, opts.file, { contentType: opts.contentType, upsert: false, cacheControl: '3600' });
  if (up.error) throw new Error(up.error.message);
  const row = check(
    await supabase
      .from('museum_media')
      .upsert(
        {
          museum_id: opts.museumId,
          kind: opts.kind,
          slot: opts.slot,
          storage_path: path,
          caption: opts.caption ?? '',
          width: opts.width ?? null,
          height: opts.height ?? null,
        },
        { onConflict: 'museum_id,kind,slot' },
      )
      .select('*')
      .single(),
  ) as MediaItem;
  if (opts.previousPath && opts.previousPath !== path) {
    await supabase.storage.from(MEDIA_BUCKET).remove([opts.previousPath]);
  }
  return row;
}

export async function updateCaption(id: string, caption: string) {
  check(await supabase.from('museum_media').update({ caption }).eq('id', id));
}

export async function deleteMedia(item: MediaItem) {
  await supabase.storage.from(MEDIA_BUCKET).remove([item.storage_path]);
  check(await supabase.from('museum_media').delete().eq('id', item.id));
}
