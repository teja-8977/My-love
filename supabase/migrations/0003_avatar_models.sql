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
