-- Luxury Crop: secure ordering, protected administration and realtime order updates.
-- Run with Supabase CLI or paste into the Supabase SQL editor once.

create extension if not exists pgcrypto;
create schema if not exists private;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'مدير المتجر' check (char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key check (id ~ '^[a-z0-9_-]{1,80}$'),
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '' check (char_length(description) <= 500),
  section_id text not null check (char_length(section_id) between 1 and 50),
  price numeric(10,2) not null default 0 check (price between 0 and 10000),
  size_prices jsonb,
  is_active boolean not null default true,
  sold_out boolean not null default false,
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  updated_at timestamptz not null default now(),
  constraint valid_size_prices check (
    size_prices is null or
    (jsonb_typeof(size_prices) = 'array' and jsonb_array_length(size_prices) between 1 and 6)
  )
);

create table if not exists public.offers (
  id text primary key check (id ~ '^[a-z0-9_-]{1,80}$'),
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '' check (char_length(description) <= 300),
  image_url text not null default '' check (char_length(image_url) <= 500),
  price numeric(10,2) not null check (price between 0 and 10000),
  original_price numeric(10,2) not null check (original_price between price and 10000),
  parts jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  updated_at timestamptz not null default now(),
  constraint valid_offer_parts check (jsonb_typeof(parts) = 'array' and jsonb_array_length(parts) between 1 and 10)
);

create table if not exists public.addons (
  id text primary key check (id ~ '^[a-z0-9_-]{1,80}$'),
  section_id text not null check (char_length(section_id) between 1 and 50),
  name text not null check (char_length(name) between 1 and 120),
  price numeric(10,2) not null check (price between 0 and 10000),
  is_active boolean not null default true,
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_settings (
  id smallint primary key default 1 check (id = 1),
  tables_count integer not null default 10 check (tables_count between 1 and 500),
  ordering_open boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.store_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  table_no integer not null check (table_no between 1 and 500),
  customer_name text not null default '' check (char_length(customer_name) <= 60),
  customer_phone text not null default '' check (customer_phone = '' or customer_phone ~ '^05[0-9]{8}$'),
  status text not null default 'new' check (status in ('new','preparing','ready','completed','cancelled')),
  subtotal numeric(10,2) not null check (subtotal between 0.01 and 100000),
  total numeric(10,2) not null check (total between 0.01 and 100000),
  idempotency_key text not null unique check (char_length(idempotency_key) between 16 and 80),
  client_id text not null check (char_length(client_id) between 16 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  item_type text not null check (item_type in ('product','offer','addon')),
  item_id text not null check (char_length(item_id) between 1 and 80),
  item_name text not null check (char_length(item_name) between 1 and 180),
  quantity integer not null check (quantity between 1 and 20),
  unit_price numeric(10,2) not null check (unit_price between 0 and 10000),
  line_total numeric(10,2) generated always as (quantity * unit_price) stored,
  note text not null default '' check (char_length(note) <= 120)
);

create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists orders_status_created_idx on public.orders(status, created_at desc);
create index if not exists orders_client_created_idx on public.orders(client_id, created_at desc);
create index if not exists order_items_order_id_idx on public.order_items(order_id);

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.admin_users a where a.user_id = (select auth.uid()));
$$;
revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;

alter table public.admin_users enable row level security;
alter table public.products enable row level security;
alter table public.offers enable row level security;
alter table public.addons enable row level security;
alter table public.store_settings enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

revoke all on public.admin_users, public.products, public.offers, public.addons, public.store_settings, public.orders, public.order_items from anon, authenticated;
grant select on public.products, public.offers, public.addons, public.store_settings to anon, authenticated;
grant select, insert, update, delete on public.products, public.offers, public.addons to authenticated;
grant select, update on public.store_settings to authenticated;
grant select, update on public.orders to authenticated;
grant select on public.order_items to authenticated;
grant select on public.admin_users to authenticated;

create policy "public reads active products" on public.products for select to anon, authenticated
using (is_active);
create policy "admins read all products" on public.products for select to authenticated
using ((select private.is_admin()));
create policy "admins manage products" on public.products for all to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "public reads active offers" on public.offers for select to anon, authenticated
using (is_active);
create policy "admins read all offers" on public.offers for select to authenticated
using ((select private.is_admin()));
create policy "admins manage offers" on public.offers for all to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "public reads active addons" on public.addons for select to anon, authenticated
using (is_active);
create policy "admins read all addons" on public.addons for select to authenticated
using ((select private.is_admin()));
create policy "admins manage addons" on public.addons for all to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "public reads settings" on public.store_settings for select to anon, authenticated using (true);
create policy "admins update settings" on public.store_settings for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "admins read own profile" on public.admin_users for select to authenticated
using (user_id = (select auth.uid()));
create policy "admins read orders" on public.orders for select to authenticated using ((select private.is_admin()));
create policy "admins update orders" on public.orders for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admins read order items" on public.order_items for select to authenticated using ((select private.is_admin()));

create or replace function public.place_order(p_order jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_order_no bigint;
  v_table integer;
  v_tables integer;
  v_line jsonb;
  v_kind text;
  v_id text;
  v_name text;
  v_note text;
  v_qty integer;
  v_size integer;
  v_price numeric(10,2);
  v_total numeric(10,2) := 0;
  v_key text;
  v_client text;
begin
  if jsonb_typeof(p_order) <> 'object' or jsonb_typeof(p_order->'lines') <> 'array' then
    raise exception 'invalid_order' using errcode = '22023';
  end if;
  if jsonb_array_length(p_order->'lines') < 1 or jsonb_array_length(p_order->'lines') > 40 then
    raise exception 'invalid_line_count' using errcode = '22023';
  end if;
  select tables_count into v_tables from public.store_settings where id = 1 and ordering_open;
  if v_tables is null then raise exception 'ordering_closed' using errcode = 'P0001'; end if;
  v_table := nullif(p_order->>'table_no','')::integer;
  if v_table is null or v_table < 1 or v_table > v_tables then
    raise exception 'invalid_table' using errcode = '22023';
  end if;
  v_key := left(coalesce(p_order->>'idempotency_key',''), 80);
  v_client := left(coalesce(p_order->>'client_id',''), 80);
  if char_length(v_key) < 16 or char_length(v_client) < 16 then
    raise exception 'invalid_request_id' using errcode = '22023';
  end if;
  select id, order_number into v_order_id, v_order_no from public.orders where idempotency_key = v_key;
  if v_order_id is not null then
    return jsonb_build_object('id', v_order_id, 'order_number', v_order_no, 'duplicate', true);
  end if;
  if (select count(*) from public.orders where client_id = v_client and created_at > now() - interval '10 minutes') >= 8 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  for v_line in select value from jsonb_array_elements(p_order->'lines') loop
    v_kind := left(coalesce(v_line->>'kind',''), 12);
    v_id := left(coalesce(v_line->>'id',''), 80);
    v_qty := nullif(v_line->>'qty','')::integer;
    v_size := nullif(v_line->>'size_index','')::integer;
    v_note := left(trim(coalesce(v_line->>'note','')), 120);
    if v_qty is null or v_qty < 1 or v_qty > 20 then raise exception 'invalid_quantity' using errcode = '22023'; end if;
    if v_kind = 'product' then
      select p.name,
        case when p.size_prices is not null and v_size is not null
          then (p.size_prices->>v_size)::numeric else p.price end
      into v_name, v_price from public.products p
      where p.id = v_id and p.is_active and not p.sold_out;
    elsif v_kind = 'offer' then
      select o.name, o.price into v_name, v_price from public.offers o where o.id = v_id and o.is_active;
    elsif v_kind = 'addon' then
      select a.name, a.price into v_name, v_price from public.addons a where a.id = v_id and a.is_active;
    else
      raise exception 'invalid_item_type' using errcode = '22023';
    end if;
    if v_name is null or v_price is null then raise exception 'item_unavailable' using errcode = 'P0001'; end if;
    v_total := v_total + (v_price * v_qty);
  end loop;
  if v_total <= 0 or v_total > 100000 then raise exception 'invalid_total' using errcode = '22023'; end if;

  insert into public.orders(table_no, customer_name, customer_phone, subtotal, total, idempotency_key, client_id)
  values (v_table, left(trim(coalesce(p_order->>'customer_name','')),60), left(trim(coalesce(p_order->>'customer_phone','')),20),
    v_total, v_total, v_key, v_client)
  returning id, order_number into v_order_id, v_order_no;

  for v_line in select value from jsonb_array_elements(p_order->'lines') loop
    v_kind := left(v_line->>'kind',12); v_id := left(v_line->>'id',80); v_qty := (v_line->>'qty')::integer;
    v_size := nullif(v_line->>'size_index','')::integer; v_note := left(trim(coalesce(v_line->>'note','')),120);
    if v_kind = 'product' then
      select p.name, case when p.size_prices is not null and v_size is not null then (p.size_prices->>v_size)::numeric else p.price end
      into v_name, v_price from public.products p where p.id = v_id;
    elsif v_kind = 'offer' then
      select o.name, o.price into v_name, v_price from public.offers o where o.id = v_id;
    else
      select a.name, a.price into v_name, v_price from public.addons a where a.id = v_id;
    end if;
    insert into public.order_items(order_id,item_type,item_id,item_name,quantity,unit_price,note)
    values(v_order_id,v_kind,v_id,v_name,v_qty,v_price,v_note);
  end loop;
  return jsonb_build_object('id',v_order_id,'order_number',v_order_no,'total',v_total,'duplicate',false);
end;
$$;

revoke all on function public.place_order(jsonb) from public, authenticated;
grant execute on function public.place_order(jsonb) to anon;

do $$ begin
  alter publication supabase_realtime add table public.orders;
exception when duplicate_object then null;
end $$;
