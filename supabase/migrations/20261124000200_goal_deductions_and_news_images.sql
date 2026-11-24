-- 1. Goal deductions. The league often takes goals as well as points
--    (e.g. "docked 3 points and 3 goals"). Deducted goals come off goal
--    difference; a deduction can now be points, goals or both.
alter table public.point_deductions
  add column goals integer not null default 0;
alter table public.point_deductions drop constraint if exists point_deductions_points_check;
alter table public.point_deductions
  add constraint point_deductions_amount_check check (points >= 0 and goals >= 0 and points + goals > 0);

-- The table view, as before, with deducted goals taken off goal difference
-- and a new goals_deducted column at the end.
create or replace view public.league_table
with (security_invoker = true)
as
with results as (
  select m.season_id, m.home_team_id as team_id, m.home_goals as gf, m.away_goals as ga,
         m.kickoff_at, m.source_order, m.id as match_id
  from public.matches m
  where m.status in ('played', 'awarded')
  union all
  select m.season_id, m.away_team_id, m.away_goals, m.home_goals,
         m.kickoff_at, m.source_order, m.id
  from public.matches m
  where m.status in ('played', 'awarded')
),
ordered as (
  select r.*,
         case when r.gf > r.ga then 'W' when r.gf = r.ga then 'D' else 'L' end as result,
         row_number() over (
           partition by r.season_id, r.team_id
           order by r.kickoff_at desc, r.source_order desc nulls last, r.match_id desc
         ) as recency
  from results r
),
totals as (
  select season_id, team_id,
         count(*)::int as played,
         count(*) filter (where result = 'W')::int as won,
         count(*) filter (where result = 'D')::int as drawn,
         count(*) filter (where result = 'L')::int as lost,
         sum(gf)::int as goals_for,
         sum(ga)::int as goals_against,
         string_agg(result, '' order by recency desc) filter (where recency <= 5) as form
  from ordered
  group by season_id, team_id
),
deductions as (
  select season_id, team_id,
         sum(points)::int as deducted,
         sum(goals)::int as goals_deducted,
         string_agg(reason, '; ' order by created_at) as deduction_notes
  from public.point_deductions
  group by season_id, team_id
),
base as (
  select st.season_id,
         st.team_id,
         st.group_name,
         t.name as team_name,
         coalesce(tt.played, 0) as played,
         coalesce(tt.won, 0) as won,
         coalesce(tt.drawn, 0) as drawn,
         coalesce(tt.lost, 0) as lost,
         coalesce(tt.goals_for, 0) as goals_for,
         coalesce(tt.goals_against, 0) as goals_against,
         coalesce(tt.goals_for, 0) - coalesce(tt.goals_against, 0)
           - coalesce(d.goals_deducted, 0) as goal_difference,
         coalesce(d.deducted, 0) as points_deducted,
         d.deduction_notes,
         3 * coalesce(tt.won, 0) + coalesce(tt.drawn, 0) - coalesce(d.deducted, 0) as points,
         coalesce(tt.form, '') as form,
         coalesce(d.goals_deducted, 0) as goals_deducted
  from public.season_teams st
  join public.teams t on t.id = st.team_id
  left join totals tt on tt.season_id = st.season_id and tt.team_id = st.team_id
  left join deductions d on d.season_id = st.season_id and d.team_id = st.team_id
)
select row_number() over (
         partition by season_id, group_name
         order by points desc, goal_difference desc, goals_for desc, team_name
       )::int as position,
       base.*
from base;

-- 2. News images: generic pictures per news category (no club crests,
--    kits, faces or sponsor logos), shown with NPFL headlines and shares.
create table public.news_images (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category ~ '^[a-z-]+$'),
  url text not null check (url ~ '^https://'),
  storage_path text,
  source text not null check (length(btrim(source)) between 1 and 300),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index news_images_category_idx on public.news_images (category);

alter table public.news_images enable row level security;
revoke all on public.news_images from anon, authenticated;
grant all on public.news_images to service_role;
grant select on public.news_images to anon, authenticated;
grant insert, delete on public.news_images to authenticated;
create policy "news_images: anyone can read" on public.news_images
  for select to anon, authenticated using (true);
create policy "news_images: admins add" on public.news_images
  for insert to authenticated with check ((select public.is_admin()));
create policy "news_images: admins delete" on public.news_images
  for delete to authenticated using ((select public.is_admin()));

do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('news-images', 'news-images', true, 1572864, array['image/png', 'image/webp', 'image/jpeg'])
    on conflict (id) do nothing;
  end if;
end
$$;
