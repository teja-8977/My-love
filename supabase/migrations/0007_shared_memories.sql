-- LOVE MUSEUM — shared memories: every museum, including ones created later, shows the same
-- photos and videos. Fill it with:  npm run import-media -- --shared      Safe to re-run.

-- the shared library (written only by the import script with the secret key; no public access)
create table if not exists public.shared_media (
  kind         text not null check (kind in ('photo', 'video')),
  slot         int  not null check (slot >= 0 and slot < 48),
  storage_path text not null,
  caption      text not null default '',
  width        int,
  height       int,
  primary key (kind, slot)
);
alter table public.shared_media enable row level security;

-- anyone signed in to the app may view the files in museum-media/shared/
-- (they cannot upload, change or delete them: the existing write policies only allow a room's own folder)
drop policy if exists "shared media read" on storage.objects;
create policy "shared media read" on storage.objects for select to authenticated
  using (bucket_id = 'museum-media' and (storage.foldername(name))[1] = 'shared');

-- every new museum starts with the shared memories
create or replace function public.copy_shared_media() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.museum_media (museum_id, kind, slot, storage_path, caption, width, height)
  select new.id, s.kind, s.slot, s.storage_path, s.caption, s.width, s.height
  from public.shared_media s
  on conflict (museum_id, kind, slot) do nothing;
  return new;
end $$;

drop trigger if exists museums_copy_shared_media on public.museums;
create trigger museums_copy_shared_media after insert on public.museums
  for each row execute function public.copy_shared_media();
