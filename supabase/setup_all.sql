-- LOVE MUSEUM — complete database setup (0001 + 0002 + 0003 + 0004).
-- Paste this whole file into Supabase → SQL Editor → New query → Run. Safe to re-run.

-- ================= 0001_love_museum.sql =================
-- =====================================================================
-- LOVE MUSEUM — database schema, security policies, storage & realtime
-- Run this once in Supabase Dashboard -> SQL Editor (or `supabase db push`).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  avatar       jsonb,
  updated_at   timestamptz not null default now()
);

create table if not exists public.museums (
  id              uuid primary key default gen_random_uuid(),
  host_id         uuid not null references auth.users (id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 80),
  partner_names   text not null default '',
  welcome_message text not null default 'Every picture tells a story. Every moment lives forever.',
  final_message   text not null default 'Thank you for walking through our story with me. This is only the beginning.',
  invite_code     text not null unique default encode(gen_random_bytes(12), 'hex'),
  status          text not null default 'lobby' check (status in ('lobby', 'live', 'ended')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.museum_members (
  museum_id    uuid not null references public.museums (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  display_name text not null default '',
  avatar       jsonb,
  role         text not null default 'guest' check (role in ('host', 'guest')),
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'removed')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (museum_id, user_id)
);

create table if not exists public.museum_media (
  id           uuid primary key default gen_random_uuid(),
  museum_id    uuid not null references public.museums (id) on delete cascade,
  kind         text not null check (kind in ('photo', 'video')),
  slot         int  not null check (slot >= 0 and slot < 20),
  storage_path text not null,
  caption      text not null default '',
  width        int,
  height       int,
  created_at   timestamptz not null default now(),
  unique (museum_id, kind, slot),
  check (kind = 'photo' or slot < 4)
);

create index if not exists museum_members_user_idx on public.museum_members (user_id);
create index if not exists museum_media_museum_idx on public.museum_media (museum_id);

-- ---------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER avoids recursive RLS evaluation)
-- ---------------------------------------------------------------------

create or replace function public.is_museum_host(mid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from museums where id = mid and host_id = auth.uid());
$$;

create or replace function public.is_museum_participant(mid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from museums where id = mid and host_id = auth.uid())
      or exists (select 1 from museum_members
                 where museum_id = mid and user_id = auth.uid() and status = 'accepted');
$$;

create or replace function public.is_museum_member_any(mid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from museums where id = mid and host_id = auth.uid())
      or exists (select 1 from museum_members
                 where museum_id = mid and user_id = auth.uid() and status in ('pending', 'accepted'));
$$;

-- Safe uuid parse used by storage + realtime policies
create or replace function public.try_uuid(t text)
returns uuid language plpgsql immutable as $$
begin
  return t::uuid;
exception when others then
  return null;
end;
$$;

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists museums_touch on public.museums;
create trigger museums_touch before update on public.museums
  for each row execute function public.touch_updated_at();

drop trigger if exists members_touch on public.museum_members;
create trigger members_touch before update on public.museum_members
  for each row execute function public.touch_updated_at();

-- Creator automatically becomes an accepted HOST member
create or replace function public.add_host_member()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  p profiles%rowtype;
begin
  select * into p from profiles where id = new.host_id;
  insert into museum_members (museum_id, user_id, display_name, avatar, role, status)
  values (new.id, new.host_id, coalesce(p.display_name, ''), p.avatar, 'host', 'accepted')
  on conflict (museum_id, user_id) do update set role = 'host', status = 'accepted';
  return new;
end;
$$;

drop trigger if exists museums_add_host on public.museums;
create trigger museums_add_host after insert on public.museums
  for each row execute function public.add_host_member();

-- Hosts can only change status of guests; nobody can change role directly
create or replace function public.guard_member_update()
returns trigger language plpgsql as $$
begin
  if current_setting('love_museum.bypass', true) = 'on' then
    return new;
  end if;
  if new.role <> old.role then
    raise exception 'role cannot be changed directly';
  end if;
  if old.role = 'host' and new.status <> 'accepted' then
    raise exception 'host membership cannot be revoked';
  end if;
  return new;
end;
$$;

drop trigger if exists members_guard on public.museum_members;
create trigger members_guard before update on public.museum_members
  for each row execute function public.guard_member_update();

-- Auto-create a profile for every new auth user
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------

-- Public-safe invite lookup (does NOT expose content, only name + host)
create or replace function public.get_invite(code text)
returns table (museum_id uuid, name text, partner_names text, host_name text, host_avatar jsonb, status text, my_status text)
language sql stable security definer set search_path = public as $$
  select m.id, m.name, m.partner_names,
         coalesce(hm.display_name, hp.display_name, 'Your host'),
         coalesce(hm.avatar, hp.avatar),
         m.status,
         (select mm.status from museum_members mm where mm.museum_id = m.id and mm.user_id = auth.uid())
  from museums m
  left join profiles hp on hp.id = m.host_id
  left join museum_members hm on hm.museum_id = m.id and hm.user_id = m.host_id
  where m.invite_code = code and auth.uid() is not null;
$$;

-- Guest requests entry with a valid invite code
create or replace function public.request_entry(code text, p_display_name text, p_avatar jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  mid uuid;
  existing text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select id into mid from museums where invite_code = code;
  if mid is null then raise exception 'invalid invitation'; end if;

  select status into existing from museum_members where museum_id = mid and user_id = auth.uid();
  if existing = 'removed' then raise exception 'you were removed from this museum'; end if;

  insert into museum_members (museum_id, user_id, display_name, avatar, role, status)
  values (mid, auth.uid(), left(coalesce(p_display_name, ''), 40), p_avatar, 'guest', 'pending')
  on conflict (museum_id, user_id) do update
    set display_name = excluded.display_name,
        avatar = excluded.avatar,
        status = case when museum_members.status in ('accepted') then 'accepted' else 'pending' end;
  return mid;
end;
$$;

-- Update my own display name / avatar inside a museum without touching status
create or replace function public.update_my_member(mid uuid, p_display_name text, p_avatar jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  update museum_members
     set display_name = left(coalesce(p_display_name, display_name), 40),
         avatar = coalesce(p_avatar, avatar)
   where museum_id = mid and user_id = auth.uid();
end;
$$;

-- Transfer ownership to another accepted participant
create or replace function public.transfer_host(mid uuid, new_host uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from museums where id = mid and host_id = auth.uid()) then
    raise exception 'only the host can transfer ownership';
  end if;
  if not exists (select 1 from museum_members where museum_id = mid and user_id = new_host and status = 'accepted') then
    raise exception 'new host must be an accepted participant';
  end if;
  perform set_config('love_museum.bypass', 'on', true);
  update museum_members set role = 'guest' where museum_id = mid and user_id = auth.uid();
  update museum_members set role = 'host', status = 'accepted' where museum_id = mid and user_id = new_host;
  update museums set host_id = new_host where id = mid;
  perform set_config('love_museum.bypass', 'off', true);
end;
$$;

-- Leave a museum (guest) — host must transfer or end instead
create or replace function public.leave_museum(mid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from museum_members where museum_id = mid and user_id = auth.uid() and role = 'guest';
end;
$$;

grant execute on function public.get_invite(text) to authenticated;
grant execute on function public.request_entry(text, text, jsonb) to authenticated;
grant execute on function public.update_my_member(uuid, text, jsonb) to authenticated;
grant execute on function public.transfer_host(uuid, uuid) to authenticated;
grant execute on function public.leave_museum(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.museums enable row level security;
alter table public.museum_members enable row level security;
alter table public.museum_media enable row level security;

-- profiles: you manage your own
drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "profiles self insert" on public.profiles;
create policy "profiles self insert" on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- museums
drop policy if exists "museums read" on public.museums;
create policy "museums read" on public.museums for select to authenticated
  using (host_id = auth.uid() or public.is_museum_member_any(id));
drop policy if exists "museums insert" on public.museums;
create policy "museums insert" on public.museums for insert to authenticated
  with check (host_id = auth.uid());
drop policy if exists "museums update" on public.museums;
create policy "museums update" on public.museums for update to authenticated
  using (host_id = auth.uid()) with check (host_id = auth.uid());
drop policy if exists "museums delete" on public.museums;
create policy "museums delete" on public.museums for delete to authenticated
  using (host_id = auth.uid());

-- members
drop policy if exists "members read" on public.museum_members;
create policy "members read" on public.museum_members for select to authenticated
  using (user_id = auth.uid() or public.is_museum_participant(museum_id));
drop policy if exists "members host update" on public.museum_members;
create policy "members host update" on public.museum_members for update to authenticated
  using (public.is_museum_host(museum_id)) with check (public.is_museum_host(museum_id));
drop policy if exists "members host delete" on public.museum_members;
create policy "members host delete" on public.museum_members for delete to authenticated
  using (public.is_museum_host(museum_id) and role = 'guest');
-- (inserts happen only through request_entry() and the host trigger)

-- media
drop policy if exists "media read" on public.museum_media;
create policy "media read" on public.museum_media for select to authenticated
  using (public.is_museum_participant(museum_id));
drop policy if exists "media host write" on public.museum_media;
create policy "media host write" on public.museum_media for all to authenticated
  using (public.is_museum_host(museum_id)) with check (public.is_museum_host(museum_id));

-- ---------------------------------------------------------------------
-- Storage: private bucket, one folder per museum: <museum_id>/photos|videos/...
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('museum-media', 'museum-media', false, 524288000)
on conflict (id) do update set public = false;

drop policy if exists "museum media read" on storage.objects;
create policy "museum media read" on storage.objects for select to authenticated
  using (bucket_id = 'museum-media'
         and public.is_museum_participant(public.try_uuid((storage.foldername(name))[1])));

drop policy if exists "museum media insert" on storage.objects;
create policy "museum media insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'museum-media'
              and public.is_museum_host(public.try_uuid((storage.foldername(name))[1])));

drop policy if exists "museum media update" on storage.objects;
create policy "museum media update" on storage.objects for update to authenticated
  using (bucket_id = 'museum-media'
         and public.is_museum_host(public.try_uuid((storage.foldername(name))[1])));

drop policy if exists "museum media delete" on storage.objects;
create policy "museum media delete" on storage.objects for delete to authenticated
  using (bucket_id = 'museum-media'
         and public.is_museum_host(public.try_uuid((storage.foldername(name))[1])));

-- ---------------------------------------------------------------------
-- Realtime
--   * postgres_changes for lobby (members + museum status)
--   * PRIVATE broadcast/presence channels "museum:<id>" for the 3D world
-- ---------------------------------------------------------------------

do $$
begin
  begin
    alter publication supabase_realtime add table public.museums;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.museum_members;
  exception when duplicate_object then null;
  end;
end $$;

alter table public.museum_members replica identity full;
alter table public.museums replica identity full;

drop policy if exists "museum channel read" on realtime.messages;
create policy "museum channel read" on realtime.messages for select to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and split_part(realtime.topic(), ':', 1) = 'museum'
    and public.is_museum_participant(public.try_uuid(split_part(realtime.topic(), ':', 2)))
  );

drop policy if exists "museum channel write" on realtime.messages;
create policy "museum channel write" on realtime.messages for insert to authenticated
  with check (
    realtime.messages.extension in ('broadcast', 'presence')
    and split_part(realtime.topic(), ':', 1) = 'museum'
    and public.is_museum_participant(public.try_uuid(split_part(realtime.topic(), ':', 2)))
  );

-- ================= 0002_entry_experience.sql =================
-- =====================================================================
-- LOVE MUSEUM — entry experience update
-- Run AFTER 0001_love_museum.sql (SQL Editor → paste → Run). Safe to re-run.
-- =====================================================================

-- 1. Short, human-friendly room code (shown in the lobby, typed by joiners)
alter table public.museums
  add column if not exists room_code text;

update public.museums
   set room_code = upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6))
 where room_code is null;

alter table public.museums
  alter column room_code set default upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6)),
  alter column room_code set not null;

do $$
begin
  alter table public.museums add constraint museums_room_code_key unique (room_code);
exception when duplicate_table or duplicate_object then null;
end $$;

-- 2. Guest (anonymous) sign-ins have no email: never fail the profile trigger
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 3. Invite lookups accept either the long invite code or the short room code
create or replace function public.find_museum_by_code(code text)
returns uuid language sql stable security definer set search_path = public as $$
  select id from museums
   where invite_code = code or room_code = upper(trim(code))
   limit 1;
$$;

create or replace function public.get_invite(code text)
returns table (museum_id uuid, name text, partner_names text, host_name text, host_avatar jsonb, status text, my_status text)
language sql stable security definer set search_path = public as $$
  select m.id, m.name, m.partner_names,
         coalesce(nullif(hm.display_name, ''), nullif(hp.display_name, ''), 'Your host'),
         coalesce(hm.avatar, hp.avatar),
         m.status,
         (select mm.status from museum_members mm where mm.museum_id = m.id and mm.user_id = auth.uid())
  from museums m
  left join profiles hp on hp.id = m.host_id
  left join museum_members hm on hm.museum_id = m.id and hm.user_id = m.host_id
  where m.id = public.find_museum_by_code(code) and auth.uid() is not null;
$$;

-- Public, minimal lookup for the 3D welcome screen (works before sign-in).
-- Only exposes the names to someone who already holds a valid code.
create or replace function public.get_invite_public(code text)
returns table (name text, partner_names text, host_name text)
language sql stable security definer set search_path = public as $$
  select m.name, m.partner_names, coalesce(nullif(hm.display_name, ''), nullif(hp.display_name, ''), '')
  from museums m
  left join profiles hp on hp.id = m.host_id
  left join museum_members hm on hm.museum_id = m.id and hm.user_id = m.host_id
  where m.id = public.find_museum_by_code(code);
$$;

create or replace function public.request_entry(code text, p_display_name text, p_avatar jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  mid uuid;
  existing text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  mid := public.find_museum_by_code(code);
  if mid is null then raise exception 'invalid invitation'; end if;

  select status into existing from museum_members where museum_id = mid and user_id = auth.uid();
  if existing = 'removed' then raise exception 'you were removed from this museum'; end if;

  insert into museum_members (museum_id, user_id, display_name, avatar, role, status)
  values (mid, auth.uid(), left(coalesce(p_display_name, ''), 40), p_avatar, 'guest', 'pending')
  on conflict (museum_id, user_id) do update
    set display_name = excluded.display_name,
        avatar = excluded.avatar,
        status = case when museum_members.status = 'accepted' then 'accepted' else 'pending' end;
  return mid;
end;
$$;

grant execute on function public.find_museum_by_code(text) to authenticated;
grant execute on function public.get_invite(text) to authenticated;
grant execute on function public.get_invite_public(text) to anon, authenticated;
grant execute on function public.request_entry(text, text, jsonb) to authenticated;

-- ================= 0003_avatar_models.sql =================
-- =====================================================================
-- LOVE MUSEUM — personalised 3D avatars (selfie → GLB via a provider such as Avaturn)
-- Run AFTER 0001 and 0002. Safe to re-run.
-- =====================================================================

create table if not exists public.avatar_models (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  provider           text not null,                -- 'avaturn' (or another provider later)
  provider_avatar_id text not null,                -- the provider's avatar id
  storage_path       text not null,                -- <user_id>/<file>.glb in bucket avatar-models
  body_id            text,
  gender             text,
  customization      jsonb not null default '{}',  -- provider-specific extras
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.avatar_models enable row level security;

drop policy if exists "avatar models own" on public.avatar_models;
create policy "avatar models own" on public.avatar_models for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists avatar_models_touch on public.avatar_models;
create trigger avatar_models_touch before update on public.avatar_models
  for each row execute function public.touch_updated_at();

-- Bucket for generated avatar models. Private: files are read with short-lived signed URLs.
-- Any signed-in participant may read models (other people in your museum must see you);
-- only the owner can write, replace or delete files inside their own <user_id>/ folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatar-models', 'avatar-models', false, 52428800, array['model/gltf-binary', 'application/octet-stream'])
on conflict (id) do update set public = false;

drop policy if exists "avatar models read" on storage.objects;
create policy "avatar models read" on storage.objects for select to authenticated
  using (bucket_id = 'avatar-models');

drop policy if exists "avatar models insert" on storage.objects;
create policy "avatar models insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatar-models' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatar models update" on storage.objects;
create policy "avatar models update" on storage.objects for update to authenticated
  using (bucket_id = 'avatar-models' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatar models delete" on storage.objects;
create policy "avatar models delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatar-models' and (storage.foldername(name))[1] = auth.uid()::text);

-- ================= 0004_avaturn_api.sql =================
-- =====================================================================
-- LOVE MUSEUM — Avaturn API: one Avaturn user per Love Museum user
-- Run AFTER 0001–0003. Safe to re-run.
-- =====================================================================

create table if not exists public.avaturn_users (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  avaturn_user_id text not null unique,
  created_at      timestamptz not null default now()
);

alter table public.avaturn_users enable row level security;

drop policy if exists "avaturn users own" on public.avaturn_users;
create policy "avaturn users own" on public.avaturn_users for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- LOVE MUSEUM — allow 24 gallery photos (videos stay at 4). Safe to re-run.
alter table public.museum_media drop constraint if exists museum_media_slot_check;
alter table public.museum_media add constraint museum_media_slot_check check (slot >= 0 and slot < 24);
