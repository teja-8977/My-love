-- LOVE MUSEUM — allow 24 gallery photos (videos stay at 4). Safe to re-run.
alter table public.museum_media drop constraint if exists museum_media_slot_check;
alter table public.museum_media add constraint museum_media_slot_check check (slot >= 0 and slot < 24);
