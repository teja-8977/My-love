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
