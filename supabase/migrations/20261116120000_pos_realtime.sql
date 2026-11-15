-- Phone follow-up page (/live) hears the cashier instantly.
-- Adds the two cashier tables to the realtime publication. Additive: no data or policy changes,
-- and Realtime only delivers rows to sessions that RLS already lets read them (managers / cashier accounts).
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pos_sales') then
    alter publication supabase_realtime add table public.pos_sales;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pos_state') then
    alter publication supabase_realtime add table public.pos_state;
  end if;
end $$;
