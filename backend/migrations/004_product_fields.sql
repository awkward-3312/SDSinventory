-- Adds category and unit_sale to products

alter table public.products
  add column if not exists category text,
  add column if not exists unit_sale text;
