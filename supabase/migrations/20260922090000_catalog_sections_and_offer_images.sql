-- Editable menu sections and one replaceable image per offer.

create table if not exists public.menu_sections (
  id text primary key check (id ~ '^[a-z0-9_-]{1,50}$'),
  title text not null check (char_length(title) between 1 and 80),
  description text not null default '' check (char_length(description) <= 240),
  icon text not null default 'hot' check (icon in ('hot','cold','v60','sweet','dallah')),
  is_active boolean not null default true,
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  updated_at timestamptz not null default now()
);

insert into public.menu_sections(id,title,description,icon,sort_order) values
('pourover','V60 حار','قهوة مختصة محضّرة بالتقطير - حار','v60',10),
('cold-v60','كولد برو','قهوة مقطّرة على البارد بتركيز عالي','v60',20),
('bakery','المخبوزات والحلا','حلويات وكيك طازج','sweet',30),
('espresso','الإسبريسو','حبوب مختصة فاخرة','hot',40),
('hot','المشروبات الساخنة','إسبريسو ومشروبات حليب ساخنة','hot',50),
('cold','المشروبات الباردة','مشروبات قهوة مثلّجة','cold',60),
('matcha','مشروبات ماتشا','ماتشا يابانية مختصة','cold',70),
('hibiscus','كركديه','كركديه طائفي منعش','cold',80)
on conflict(id) do nothing;

alter table public.menu_sections enable row level security;
revoke all on public.menu_sections from anon, authenticated;
grant select on public.menu_sections to anon, authenticated;
grant select,insert,update,delete on public.menu_sections to authenticated;

drop policy if exists "public reads menu sections" on public.menu_sections;
create policy "public reads menu sections" on public.menu_sections for select to anon, authenticated using (true);
drop policy if exists "admins manage menu sections" on public.menu_sections;
create policy "admins manage menu sections" on public.menu_sections for all to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('offer-images','offer-images',true,8388608,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "public reads offer images" on storage.objects;
create policy "public reads offer images" on storage.objects for select to public using(bucket_id='offer-images');
drop policy if exists "admins upload offer images" on storage.objects;
create policy "admins upload offer images" on storage.objects for insert to authenticated
with check(bucket_id='offer-images' and (select private.is_admin()));
drop policy if exists "admins update offer images" on storage.objects;
create policy "admins update offer images" on storage.objects for update to authenticated
using(bucket_id='offer-images' and (select private.is_admin()))
with check(bucket_id='offer-images' and (select private.is_admin()));
drop policy if exists "admins delete offer images" on storage.objects;
create policy "admins delete offer images" on storage.objects for delete to authenticated
using(bucket_id='offer-images' and (select private.is_admin()));
