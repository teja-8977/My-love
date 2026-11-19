-- LOVE MUSEUM — 44 gallery photos (24 on the walls + 20 on the display boards). Safe to re-run.
alter table public.museum_media drop constraint if exists museum_media_slot_check;
alter table public.museum_media add constraint museum_media_slot_check check (slot >= 0 and slot < 48);
