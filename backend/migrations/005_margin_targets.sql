-- Adds margin_target to products and recipes

alter table public.products
  add column if not exists margin_target numeric default 0.4;

alter table public.recipes
  add column if not exists margin_target numeric;

-- Backfill recipes margin from product margin when missing
update public.recipes r
set margin_target = p.margin_target
from public.products p
where r.product_id = p.id
  and r.margin_target is null;

alter table public.recipes
  alter column margin_target set default 0.4;
