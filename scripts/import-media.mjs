#!/usr/bin/env node
/**
 * Love Museum — import your memories into a museum.
 *
 *   media/photos/   up to 24 photos (jpg / png / webp), shown in file-name order
 *   media/videos/   up to 4 videos (mp4 / mov / m4v / webm / mkv / avi)
 *   media/photos/captions.json   optional  { "01.jpg": "Our first date ❤️" }
 *   media/videos/titles.json     optional  { "proposal.mp4": "The proposal" }
 *
 * Usage:
 *   npm run import-media                 → imports into your most recently created museum
 *   npm run import-media -- 9C228D       → imports into the museum with that room code
 *   npm run import-media -- 9C228D --photos-only | --videos-only
 *
 * Videos larger than the storage limit (50 MB on the Supabase free plan) or not in MP4 are
 * automatically re-encoded to H.264 MP4 with ffmpeg so they play everywhere.
 *
 * Needs in .env.local (LOCAL ONLY — never commit, never prefix with VITE_):
 *   VITE_SUPABASE_URL=...           SUPABASE_SECRET_KEY=sb_secret_...
 */
import { readFileSync, readdirSync, statSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const BUCKET = 'museum-media';
const MAX_PHOTOS = 24;
const MAX_VIDEOS = 4;
const MAX_BYTES = 50 * 1024 * 1024;
const TARGET_BYTES = 46 * 1024 * 1024;

// ---------- env ----------
function loadEnv() {
  const env = { ...process.env };
  for (const f of ['.env', '.env.local']) {
    const p = join(ROOT, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && m[2] !== '') env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return env;
}
const env = loadEnv();
const URL_ = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
const KEY = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) {
  console.error('✗ Missing VITE_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local');
  process.exit(1);
}
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function rest(path, init = {}) {
  const res = await fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { ...H, 'content-type': 'application/json', ...init.headers } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function upload(path, buf, contentType) {
  const res = await fetch(`${URL_}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { ...H, 'content-type': contentType, 'x-upsert': 'true', 'cache-control': '3600' },
    body: buf,
  });
  if (!res.ok) throw new Error(`upload ${res.status} ${(await res.text()).slice(0, 300)}`);
}

async function removeObjects(paths) {
  if (!paths.length) return;
  await fetch(`${URL_}/storage/v1/object/${BUCKET}`, { method: 'DELETE', headers: { ...H, 'content-type': 'application/json' }, body: JSON.stringify({ prefixes: paths }) });
}

// ---------- image size (JPEG / PNG / WebP headers) ----------
function imageSize(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buf.toString('ascii', 12, 16);
    if (chunk === 'VP8X') return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
    if (chunk === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') {
      const b = buf.readUInt32LE(21);
      return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 };
    }
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length) {
      if (buf[i] !== 0xff) return null;
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      i += 2 + len;
    }
  }
  return null;
}

// ---------- ffmpeg ----------
function ffmpegPath() {
  try {
    return createRequire(import.meta.url)('ffmpeg-static');
  } catch {
    return 'ffmpeg';
  }
}
function videoDuration(ff, file) {
  const r = spawnSync(ff, ['-i', file], { encoding: 'utf8' });
  const m = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec(r.stderr || '');
  return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : 0;
}
function compress(file) {
  const ff = ffmpegPath();
  const dur = videoDuration(ff, file);
  const dir = mkdtempSync(join(tmpdir(), 'lm-video-'));
  const out = join(dir, basename(file, extname(file)) + '.mp4');
  // pick a video bitrate that lands under the size limit (audio 128 kbps)
  const totalKbps = dur > 0 ? Math.floor((TARGET_BYTES * 8) / 1000 / dur) : 2500;
  const vKbps = Math.max(300, Math.min(4500, totalKbps - 128));
  const height = vKbps < 900 ? 480 : vKbps < 2000 ? 720 : 1080;
  console.log(`    ↳ compressing (${Math.round(dur)} s → ~${vKbps} kbps, ≤${height}p)…`);
  const args = ['-y', '-i', file, '-vf', `scale=-2:'min(${height},ih)'`, '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', `${vKbps}k`, '-maxrate', `${Math.round(vKbps * 1.3)}k`, '-bufsize', `${vKbps * 2}k`, '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out];
  const r = spawnSync(ff, args, { stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${(r.stderr || '').split('\n').slice(-4).join(' ')}`);
  return { out, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

// ---------- helpers ----------
const listFiles = (dir, exts) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => exts.includes(extname(f).toLowerCase()))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    : [];
const readJson = (p) => {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return {};
  }
};
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4' };

async function upsertMedia(row) {
  await rest('museum_media?on_conflict=museum_id,kind,slot', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row),
  });
}

// ---------- main ----------
const args = process.argv.slice(2);
const code = args.find((a) => !a.startsWith('--'));
const photosOnly = args.includes('--photos-only');
const videosOnly = args.includes('--videos-only');

const museums = code
  ? await rest(`museums?select=id,name,room_code,invite_code&or=(room_code.eq.${encodeURIComponent(code.toUpperCase())},invite_code.eq.${encodeURIComponent(code)})`)
  : await rest('museums?select=id,name,room_code,invite_code&order=created_at.desc&limit=1');
const museum = museums?.[0];
if (!museum) {
  console.error(code ? `✗ No museum with room code "${code}".` : '✗ No museums yet — create your room in the app first.');
  process.exit(1);
}
console.log(`\n❤ Importing into "${museum.name}" (room ${museum.room_code})\n`);
const existing = await rest(`museum_media?select=kind,slot,storage_path&museum_id=eq.${museum.id}`);
const oldPath = (kind, slot) => existing.find((m) => m.kind === kind && m.slot === slot)?.storage_path;
const stamp = Date.now();

if (!videosOnly) {
  const dir = join(ROOT, 'media', 'photos');
  const files = listFiles(dir, ['.jpg', '.jpeg', '.png', '.webp']);
  const captions = readJson(join(dir, 'captions.json'));
  if (files.length > MAX_PHOTOS) console.log(`  (only the first ${MAX_PHOTOS} of ${files.length} photos fit in the gallery)`);
  const stale = [];
  for (const [slot, f] of files.slice(0, MAX_PHOTOS).entries()) {
    const buf = readFileSync(join(dir, f));
    const ext = extname(f).toLowerCase();
    const size = imageSize(buf);
    const path = `${museum.id}/photos/${slot}-${stamp}${ext === '.jpeg' ? '.jpg' : ext}`;
    await upload(path, buf, MIME[ext]);
    await upsertMedia({ museum_id: museum.id, kind: 'photo', slot, storage_path: path, caption: String(captions[f] ?? '').slice(0, 120), width: size?.w ?? null, height: size?.h ?? null });
    const prev = oldPath('photo', slot);
    if (prev && prev !== path) stale.push(prev);
    console.log(`  ✓ photo ${String(slot + 1).padStart(2)}  ${f}${size ? `  ${size.w}×${size.h}` : ''}`);
  }
  await removeObjects(stale);
  if (!files.length) console.log('  (no photos in media/photos)');
}

if (!photosOnly) {
  const dir = join(ROOT, 'media', 'videos');
  const files = listFiles(dir, ['.mp4', '.mov', '.m4v', '.webm', '.mkv', '.avi']);
  const titles = readJson(join(dir, 'titles.json'));
  if (files.length > MAX_VIDEOS) console.log(`  (only the first ${MAX_VIDEOS} of ${files.length} videos fit in the cinema)`);
  const stale = [];
  for (const [slot, f] of files.slice(0, MAX_VIDEOS).entries()) {
    const src = join(dir, f);
    const mb = statSync(src).size / 1048576;
    console.log(`  ▶ video ${slot + 1}  ${f}  (${mb.toFixed(1)} MB)`);
    let file = src;
    let cleanup = () => {};
    if (statSync(src).size > MAX_BYTES || extname(f).toLowerCase() !== '.mp4') ({ out: file, cleanup } = compress(src));
    try {
      const buf = readFileSync(file);
      if (buf.length > MAX_BYTES) throw new Error(`still ${(buf.length / 1048576).toFixed(1)} MB after compression — trim the video and try again`);
      const path = `${museum.id}/videos/${slot}-${stamp}.mp4`;
      await upload(path, buf, 'video/mp4');
      await upsertMedia({ museum_id: museum.id, kind: 'video', slot, storage_path: path, caption: String(titles[f] ?? basename(f, extname(f))).slice(0, 80), width: null, height: null });
      const prev = oldPath('video', slot);
      if (prev && prev !== path) stale.push(prev);
      console.log(`    ✓ uploaded (${(buf.length / 1048576).toFixed(1)} MB)`);
    } finally {
      cleanup();
    }
  }
  await removeObjects(stale);
  if (!files.length) console.log('  (no videos in media/videos)');
}

console.log('\nDone. Open the museum (or refresh it) to see your memories ❤\n');
