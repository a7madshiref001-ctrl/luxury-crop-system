-- Smart QR service points for lounge tables and hotel rooms/pickup points.

create table if not exists public.service_points (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  kind text not null check (kind in ('hall','hotel')),
  label text not null check (char_length(label) between 1 and 80),
  reference_no text not null default '' check (char_length(reference_no) <= 40),
  is_active boolean not null default true,
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.service_points enable row level security;
revoke all on public.service_points from anon, authenticated;
grant select, insert, update, delete on public.service_points to authenticated;

drop policy if exists "admins manage service points" on public.service_points;
create policy "admins manage service points" on public.service_points for all to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));

alter table public.store_settings add column if not exists smart_locations_required boolean not null default false;

alter table public.orders add column if not exists service_point_id uuid references public.service_points(id) on delete set null;
alter table public.orders add column if not exists service_type text check (service_type in ('hall','hotel'));
alter table public.orders add column if not exists service_label text check (char_length(service_label) <= 80);
alter table public.orders alter column table_no drop not null;
alter table public.orders drop constraint if exists orders_table_no_check;
alter table public.orders add constraint orders_table_no_check check (table_no is null or table_no between 1 and 500);
create index if not exists orders_service_point_idx on public.orders(service_point_id, created_at desc);

-- Create a ready-to-print secure QR destination for every configured lounge table.
insert into public.service_points(kind,label,reference_no,sort_order)
select 'hall','طاولة '||n,n::text,n*10
from generate_series(1,(select tables_count from public.store_settings where id=1)) n
where not exists (
  select 1 from public.service_points p where p.kind='hall' and p.reference_no=n::text
);

create or replace function public.resolve_service_point(p_token text)
returns jsonb
language plpgsql
security definer
stable
set search_path=''
as $$
declare p public.service_points%rowtype;
begin
  begin
    select * into p from public.service_points
    where token=p_token::uuid and is_active;
  exception when invalid_text_representation then
    return null;
  end;
  if p.id is null then return null; end if;
  return jsonb_build_object('kind',p.kind,'label',p.label,'reference_no',p.reference_no);
end;
$$;
revoke all on function public.resolve_service_point(text) from public, authenticated;
grant execute on function public.resolve_service_point(text) to anon;

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
  v_point public.service_points%rowtype;
  v_smart_required boolean;
  v_token text;
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
  select tables_count, smart_locations_required into v_tables, v_smart_required
  from public.store_settings where id=1 and ordering_open;
  if v_tables is null then raise exception 'ordering_closed' using errcode = 'P0001'; end if;

  v_token := left(trim(coalesce(p_order->>'location_token','')),80);
  if v_token <> '' then
    begin
      select * into v_point from public.service_points where token=v_token::uuid and is_active;
    exception when invalid_text_representation then
      raise exception 'invalid_location' using errcode='22023';
    end;
    if v_point.id is null then raise exception 'invalid_location' using errcode='22023'; end if;
    if v_point.kind='hall' and v_point.reference_no ~ '^[0-9]+$' then
      v_table := v_point.reference_no::integer;
    else
      v_table := null;
    end if;
  else
    if v_smart_required then raise exception 'location_required' using errcode='P0001'; end if;
    v_table := nullif(p_order->>'table_no','')::integer;
    if v_table is null or v_table < 1 or v_table > v_tables then
      raise exception 'invalid_table' using errcode = '22023';
    end if;
  end if;

  v_key := left(coalesce(p_order->>'idempotency_key',''),80);
  v_client := left(coalesce(p_order->>'client_id',''),80);
  if char_length(v_key)<16 or char_length(v_client)<16 then raise exception 'invalid_request_id' using errcode='22023'; end if;
  select id,order_number into v_order_id,v_order_no from public.orders where idempotency_key=v_key;
  if v_order_id is not null then return jsonb_build_object('id',v_order_id,'order_number',v_order_no,'duplicate',true); end if;
  if (select count(*) from public.orders where client_id=v_client and created_at>now()-interval '10 minutes')>=8 then
    raise exception 'rate_limited' using errcode='P0001';
  end if;

  for v_line in select value from jsonb_array_elements(p_order->'lines') loop
    v_kind:=left(coalesce(v_line->>'kind',''),12); v_id:=left(coalesce(v_line->>'id',''),80);
    v_qty:=nullif(v_line->>'qty','')::integer; v_size:=nullif(v_line->>'size_index','')::integer;
    v_note:=left(trim(coalesce(v_line->>'note','')),120);
    if v_qty is null or v_qty<1 or v_qty>20 then raise exception 'invalid_quantity' using errcode='22023'; end if;
    v_name:=null; v_price:=null;
    if v_kind='product' then
      select p.name,case when p.size_prices is not null and v_size is not null then (p.size_prices->>v_size)::numeric else p.price end
      into v_name,v_price from public.products p where p.id=v_id and p.is_active and not p.sold_out;
    elsif v_kind='offer' then
      select o.name,o.price into v_name,v_price from public.offers o where o.id=v_id and o.is_active;
    elsif v_kind='addon' then
      select a.name,a.price into v_name,v_price from public.addons a where a.id=v_id and a.is_active;
    else raise exception 'invalid_item_type' using errcode='22023'; end if;
    if v_name is null or v_price is null then raise exception 'item_unavailable' using errcode='P0001'; end if;
    v_total:=v_total+(v_price*v_qty);
  end loop;
  if v_total<=0 or v_total>100000 then raise exception 'invalid_total' using errcode='22023'; end if;

  insert into public.orders(table_no,service_point_id,service_type,service_label,customer_name,customer_phone,subtotal,total,idempotency_key,client_id)
  values(v_table,v_point.id,v_point.kind,v_point.label,left(trim(coalesce(p_order->>'customer_name','')),60),
    left(trim(coalesce(p_order->>'customer_phone','')),20),v_total,v_total,v_key,v_client)
  returning id,order_number into v_order_id,v_order_no;

  for v_line in select value from jsonb_array_elements(p_order->'lines') loop
    v_kind:=left(v_line->>'kind',12);v_id:=left(v_line->>'id',80);v_qty:=(v_line->>'qty')::integer;
    v_size:=nullif(v_line->>'size_index','')::integer;v_note:=left(trim(coalesce(v_line->>'note','')),120);
    if v_kind='product' then
      select p.name,case when p.size_prices is not null and v_size is not null then (p.size_prices->>v_size)::numeric else p.price end
      into v_name,v_price from public.products p where p.id=v_id;
    elsif v_kind='offer' then select o.name,o.price into v_name,v_price from public.offers o where o.id=v_id;
    else select a.name,a.price into v_name,v_price from public.addons a where a.id=v_id; end if;
    insert into public.order_items(order_id,item_type,item_id,item_name,quantity,unit_price,note)
    values(v_order_id,v_kind,v_id,v_name,v_qty,v_price,v_note);
  end loop;
  return jsonb_build_object('id',v_order_id,'order_number',v_order_no,'total',v_total,'duplicate',false,
    'service_type',v_point.kind,'service_label',v_point.label);
end;
$$;
revoke all on function public.place_order(jsonb) from public, authenticated;
grant execute on function public.place_order(jsonb) to anon;
