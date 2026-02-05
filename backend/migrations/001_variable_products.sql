-- Adds support for active supplies, variable products and formula-based recipes

alter table public.supplies
  add column if not exists active boolean default true;

alter table public.products
  add column if not exists product_type text default 'fixed';

alter table public.recipe_items
  add column if not exists qty_formula text;

alter table public.sale_items
  add column if not exists var_width numeric;

alter table public.sale_items
  add column if not exists var_height numeric;
