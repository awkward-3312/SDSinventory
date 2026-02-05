-- Fixed costs (monthly) and operational cost per order

create table if not exists public.fixed_cost_periods (
  id bigserial primary key,
  year int not null,
  month int not null,
  estimated_orders numeric not null default 0,
  currency text not null default 'HNL',
  active boolean not null default false,
  created_at timestamp without time zone not null default now()
);

create unique index if not exists fixed_cost_periods_year_month_idx
  on public.fixed_cost_periods (year, month);

create table if not exists public.fixed_cost_items (
  id bigserial primary key,
  period_id bigint not null references public.fixed_cost_periods(id) on delete cascade,
  name text not null,
  amount numeric not null default 0,
  created_at timestamp without time zone not null default now()
);

create index if not exists fixed_cost_items_period_id_idx
  on public.fixed_cost_items (period_id);

-- Recipe variables (numeric), options (catalog), and rules

create table if not exists public.recipe_variables (
  id bigserial primary key,
  recipe_id text not null,
  code text not null,
  label text not null,
  min_value numeric,
  max_value numeric,
  default_value numeric,
  created_at timestamp without time zone not null default now()
);

create unique index if not exists recipe_variables_recipe_code_idx
  on public.recipe_variables (recipe_id, code);

create table if not exists public.recipe_options (
  id bigserial primary key,
  recipe_id text not null,
  code text not null,
  label text not null,
  created_at timestamp without time zone not null default now()
);

create unique index if not exists recipe_options_recipe_code_idx
  on public.recipe_options (recipe_id, code);

create table if not exists public.recipe_option_values (
  id bigserial primary key,
  option_id bigint not null references public.recipe_options(id) on delete cascade,
  value_key text not null,
  label text not null,
  numeric_value numeric not null default 0,
  created_at timestamp without time zone not null default now()
);

create unique index if not exists recipe_option_values_option_key_idx
  on public.recipe_option_values (option_id, value_key);

create table if not exists public.recipe_rules (
  id bigserial primary key,
  recipe_id text not null,
  scope text not null, -- global | supply
  target_supply_id text,
  condition_var text not null,
  operator text not null,
  condition_value text not null,
  effect_type text not null, -- multiplier | add_qty
  effect_value numeric not null default 0,
  created_at timestamp without time zone not null default now()
);

create index if not exists recipe_rules_recipe_id_idx
  on public.recipe_rules (recipe_id);

-- Quotes

create table if not exists public.quote_number_sequence (
  year int primary key,
  last_number int not null default 0
);

create table if not exists public.quotes (
  id bigserial primary key,
  quote_number text not null,
  status text not null default 'draft',
  valid_until date,
  customer_name text,
  notes text,
  currency text not null default 'HNL',
  margin numeric not null default 0.4,
  materials_cost_total numeric not null default 0,
  operational_cost_total numeric not null default 0,
  total_cost numeric not null default 0,
  total_price numeric not null default 0,
  total_profit numeric not null default 0,
  fixed_cost_period_id text,
  converted_sale_id text,
  created_at timestamp without time zone not null default now()
);

create unique index if not exists quotes_number_idx
  on public.quotes (quote_number);

create table if not exists public.quote_items (
  id bigserial primary key,
  quote_id bigint not null references public.quotes(id) on delete cascade,
  product_id text not null,
  recipe_id text not null,
  qty numeric not null,
  materials_cost numeric not null,
  suggested_price numeric not null,
  sale_price numeric not null,
  profit numeric not null,
  var_width numeric,
  var_height numeric,
  var_payload jsonb,
  created_at timestamp without time zone not null default now()
);

create index if not exists quote_items_quote_id_idx
  on public.quote_items (quote_id);

create table if not exists public.quote_status_history (
  id bigserial primary key,
  quote_id bigint not null references public.quotes(id) on delete cascade,
  status text not null,
  notes text,
  changed_at timestamp without time zone not null default now(),
  changed_by text
);

create index if not exists quote_status_history_quote_id_idx
  on public.quote_status_history (quote_id);

-- Sales enhancements (operational cost + variable payload)

alter table public.sales
  add column if not exists materials_cost_total numeric,
  add column if not exists operational_cost_total numeric,
  add column if not exists fixed_cost_period_id text;

alter table public.sale_items
  add column if not exists var_payload jsonb;

update public.sales
set materials_cost_total = total_cost
where materials_cost_total is null;

update public.sales
set operational_cost_total = 0
where operational_cost_total is null;
