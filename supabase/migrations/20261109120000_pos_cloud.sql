-- Luxury Crop POS on the website's server.
-- Additive only: nothing existing is dropped or changed, so the public menu and owner panel keep working.
--   pos_members  accounts allowed to run the cashier without being full menu admins.
--   pos_state    one restorable copy of the cashier per business day, kept 90 days.
--   pos_sales    a permanent per-order copy. Clients have no delete permission.

create schema if not exists private;
grant usage on schema private to authenticated;

create table if not exists public.pos_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  label text not null default 'جهاز الكاشير' check (char_length(label) between 1 and 80),
  created_at timestamptz not null default now()
);

create or replace function private.is_pos_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.pos_members m where m.user_id = (select auth.uid()))
      or exists (select 1 from public.admin_users a where a.user_id = (select auth.uid()));
$$;
revoke all on function private.is_pos_member() from public;
grant execute on function private.is_pos_member() to authenticated;

create table if not exists public.pos_state (
  store_key text not null check (store_key ~ '^[a-z0-9:_-]{1,60}$'),
  day text not null check (day ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  device text not null check (char_length(device) between 1 and 40),
  rev bigint not null default 0 check (rev >= 0),
  state jsonb not null,
  app_version text not null default '' check (char_length(app_version) <= 20),
  updated_at timestamptz not null default now(),
  primary key (store_key, day)
);

create table if not exists public.pos_sales (
  store_key text not null check (store_key ~ '^[a-z0-9:_-]{1,60}$'),
  id text not null check (char_length(id) between 1 and 60),
  day text not null check (day ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  inv text check (char_length(inv) <= 30),
  status text not null check (char_length(status) between 1 and 20),
  total numeric(12,2) not null default 0,
  refunded numeric(12,2) not null default 0,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (store_key, id)
);
create index if not exists pos_sales_day_idx on public.pos_sales(store_key, day desc);

alter table public.pos_members enable row level security;
alter table public.pos_state enable row level security;
alter table public.pos_sales enable row level security;

revoke all on public.pos_members, public.pos_state, public.pos_sales from anon, authenticated;
grant select on public.pos_members to authenticated;
grant select on public.pos_state to authenticated;
grant select, insert, update on public.pos_sales to authenticated;

drop policy if exists "pos members read own row" on public.pos_members;
create policy "pos members read own row" on public.pos_members for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "pos members read state" on public.pos_state;
create policy "pos members read state" on public.pos_state for select to authenticated
using ((select private.is_pos_member()));

drop policy if exists "pos members read sales" on public.pos_sales;
create policy "pos members read sales" on public.pos_sales for select to authenticated
using ((select private.is_pos_member()));

drop policy if exists "pos members add sales" on public.pos_sales;
create policy "pos members add sales" on public.pos_sales for insert to authenticated
with check ((select private.is_pos_member()));

drop policy if exists "pos members update sales" on public.pos_sales;
create policy "pos members update sales" on public.pos_sales for update to authenticated
using ((select private.is_pos_member())) with check ((select private.is_pos_member()));

-- The cashier needs to read website orders and the whole catalog, but cannot edit the menu.
drop policy if exists "pos members read orders" on public.orders;
create policy "pos members read orders" on public.orders for select to authenticated
using ((select private.is_pos_member()));

drop policy if exists "pos members read order items" on public.order_items;
create policy "pos members read order items" on public.order_items for select to authenticated
using ((select private.is_pos_member()));

drop policy if exists "pos members read all products" on public.products;
create policy "pos members read all products" on public.products for select to authenticated
using ((select private.is_pos_member()));

create or replace function public.pos_access()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('member', (select private.is_pos_member()), 'admin', (select private.is_admin()));
$$;
revoke all on function public.pos_access() from public, anon;
grant execute on function public.pos_access() to authenticated;

-- The only way a cashier account can change a website order, and it can change nothing but the status.
create or replace function public.pos_set_order_status(p_id uuid, p_status text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_pos_member()) then raise exception 'not_authorized' using errcode = '42501'; end if;
  if p_status not in ('new','preparing','ready','completed','cancelled') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  update public.orders set status = p_status, updated_at = now() where id = p_id;
  return found;
end;
$$;
revoke all on function public.pos_set_order_status(uuid, text) from public, anon;
grant execute on function public.pos_set_order_status(uuid, text) to authenticated;

-- One device owns the backup. Another device, or a wiped device with an older revision,
-- is refused until a manager explicitly restores or takes over, so a good copy is never overwritten by accident.
create or replace function public.pos_save_state(
  p_key text, p_day text, p_device text, p_rev bigint, p_state jsonb,
  p_version text default '', p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device text;
  v_rev bigint;
  v_day text;
  v_at timestamptz;
begin
  if not (select private.is_pos_member()) then raise exception 'not_authorized' using errcode = '42501'; end if;
  if jsonb_typeof(p_state) <> 'object' or pg_column_size(p_state) > 6000000 then
    raise exception 'invalid_state' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('pos_state:' || p_key));
  select s.device, s.rev, s.day, s.updated_at into v_device, v_rev, v_day, v_at
  from public.pos_state s where s.store_key = p_key order by s.day desc limit 1;
  if v_device is not null and not coalesce(p_force, false) then
    if v_device <> p_device then
      return jsonb_build_object('ok', false, 'reason', 'device', 'at', v_at, 'day', v_day, 'rev', v_rev);
    end if;
    if p_day < v_day or (p_day = v_day and p_rev < v_rev) then
      return jsonb_build_object('ok', false, 'reason', 'stale', 'at', v_at, 'day', v_day, 'rev', v_rev);
    end if;
  end if;
  insert into public.pos_state(store_key, day, device, rev, state, app_version, updated_at)
  values (p_key, p_day, p_device, p_rev, p_state, left(coalesce(p_version, ''), 20), now())
  on conflict (store_key, day) do update
    set device = excluded.device, rev = excluded.rev, state = excluded.state,
        app_version = excluded.app_version, updated_at = now();
  delete from public.pos_state
  where store_key = p_key and day < to_char((now() at time zone 'Asia/Riyadh')::date - 90, 'YYYY-MM-DD');
  return jsonb_build_object('ok', true, 'at', now());
end;
$$;
revoke all on function public.pos_save_state(text, text, text, bigint, jsonb, text, boolean) from public, anon;
grant execute on function public.pos_save_state(text, text, text, bigint, jsonb, text, boolean) to authenticated;
