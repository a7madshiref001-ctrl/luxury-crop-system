-- One replaceable image per product and an admin-only test-order reset.

alter table public.products
  add column if not exists image_url text not null default '';

do $$ begin
  alter table public.products add constraint products_image_url_length check (char_length(image_url) <= 500);
exception when duplicate_object then null;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public reads product images" on storage.objects;
create policy "public reads product images" on storage.objects for select to public
using (bucket_id = 'product-images');

drop policy if exists "admins upload product images" on storage.objects;
create policy "admins upload product images" on storage.objects for insert to authenticated
with check (bucket_id = 'product-images' and (select private.is_admin()));

drop policy if exists "admins update product images" on storage.objects;
create policy "admins update product images" on storage.objects for update to authenticated
using (bucket_id = 'product-images' and (select private.is_admin()))
with check (bucket_id = 'product-images' and (select private.is_admin()));

drop policy if exists "admins delete product images" on storage.objects;
create policy "admins delete product images" on storage.objects for delete to authenticated
using (bucket_id = 'product-images' and (select private.is_admin()));

create or replace function public.clear_all_orders()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare v_count bigint;
begin
  if not (select private.is_admin()) then raise exception 'not_authorized' using errcode = '42501'; end if;
  select count(*) into v_count from public.orders;
  truncate table public.order_items, public.orders restart identity;
  return v_count;
end;
$$;

revoke all on function public.clear_all_orders() from public, anon;
grant execute on function public.clear_all_orders() to authenticated;
