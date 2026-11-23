-- Club crests (shown on the site only, never on share images) and two new
-- site settings: show_crests (a site-wide switch to hide every crest at
-- once) and motw_override (the admin's Match of the Week choice).

alter table public.teams
  add column crest_url text check (crest_url is null or crest_url ~ '^https://');

insert into public.site_settings (key, value) values
  ('show_crests', 'true'::jsonb),
  ('motw_override', 'null'::jsonb)
on conflict (key) do nothing;

-- A public bucket for crest images. Uploads go through the server with the
-- service role, so no write policy is needed. Skipped where Supabase Storage
-- isn't installed (the plain Postgres used in tests).
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('crests', 'crests', true, 524288, array['image/png', 'image/webp', 'image/jpeg'])
    on conflict (id) do nothing;
  end if;
end
$$;
