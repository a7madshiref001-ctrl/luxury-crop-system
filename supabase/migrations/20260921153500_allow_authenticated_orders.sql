-- The public menu and owner dashboard share the same origin and Supabase
-- session. An owner who previews the menu is authenticated, so the secure
-- order RPC must be callable by both public visitors and signed-in users.
-- All pricing, availability, table, quantity, and rate-limit validation stays
-- inside the SECURITY DEFINER function.
grant execute on function public.place_order(jsonb) to anon, authenticated;
