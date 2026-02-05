-- Configurable list of unit codes that represent piece-based units

create table if not exists public.piece_unit_codes (
  code text primary key
);

insert into public.piece_unit_codes (code)
values
  ('unidad'),
  ('pieza'),
  ('unidad/pieza'),
  ('unit'),
  ('units'),
  ('piece'),
  ('pieces'),
  ('u'),
  ('ud'),
  ('uds'),
  ('pz'),
  ('pza'),
  ('pzas'),
  ('pc'),
  ('pcs')
on conflict do nothing;
