#!/usr/bin/env node
/**
 * Love Museum — give EVERY room the same photos and videos.
 *
 * Copies the media of the best-filled room into every room that has fewer photos or videos
 * (copies happen inside Supabase Storage, nothing is re-uploaded). Run it after creating a new room:
 *
 *   npm run fill-rooms                → source = the room with the most photos
 *   npm run fill-rooms -- 85AC0F      → source = that room
 *
 * Needs VITE_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local (local only, never commit).
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const BUCKET = 'museum-media';
const env = { ...process.env };
for (const f of ['.env', '.env.local']) {
  const p = join(ROOT, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[2] !== '') env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const URL_ = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const KEY = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) {
  console.error('✗ Missing VITE_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local');
  process.exit(1);
}
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'content-type': 'application/json' };
async function rest(path, init = {}) {
  const res = await fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { ...H, ...init.headers } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}
async function copy(from, to) {
  const res = await fetch(`${URL_}/storage/v1/object/copy`, { method: 'POST', headers: H, body: JSON.stringify({ bucketId: BUCKET, sourceKey: from, destinationKey: to }) });
  if (!res.ok && res.status !== 409) throw new Error(`copy ${res.status} ${(await res.text()).slice(0, 200)}`);
}

const museums = await rest('museums?select=id,name,room_code&order=created_at.desc');
const media = await rest('museum_media?select=museum_id,kind,slot,storage_path,caption,width,height');
const of = (id) => media.filter((m) => m.museum_id === id);
const count = (id, kind) => of(id).filter((m) => m.kind === kind).length;

const code = process.argv.slice(2).find((a) => !a.startsWith('--'));
const source = code
  ? museums.find((m) => m.room_code === code.toUpperCase())
  : [...museums].sort((a, b) => count(b.id, 'photo') * 10 + count(b.id, 'video') - (count(a.id, 'photo') * 10 + count(a.id, 'video')))[0];
if (!source || !of(source.id).length) {
  console.error('✗ No room with photos to copy from — run npm run import-media first.');
  process.exit(1);
}
const lib = of(source.id).sort((a, b) => (a.kind + a.slot).localeCompare(b.kind + b.slot));
console.log(`\n❤ Copying ${count(source.id, 'photo')} photos + ${count(source.id, 'video')} videos from room ${source.room_code} to every room\n`);

for (const m of museums) {
  if (m.id === source.id) continue;
  if (count(m.id, 'photo') >= count(source.id, 'photo') && count(m.id, 'video') >= count(source.id, 'video')) {
    console.log(`  · room ${m.room_code} already complete`);
    continue;
  }
  const rows = [];
  for (const item of lib) {
    const file = item.storage_path.split('/').pop();
    const dest = `${m.id}/${item.kind === 'photo' ? 'photos' : 'videos'}/${file}`;
    await copy(item.storage_path, dest);
    rows.push({ museum_id: m.id, kind: item.kind, slot: item.slot, storage_path: dest, caption: item.caption, width: item.width, height: item.height });
  }
  await rest('museum_media?on_conflict=museum_id,kind,slot', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows) });
  console.log(`  ✓ room ${m.room_code}  ${m.name}`);
}
console.log('\nDone. Refresh the museum to see your memories ❤\n');
