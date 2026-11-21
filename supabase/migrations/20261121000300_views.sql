-- Shared read models. The app and the email both use these definitions.

-- ---------------------------------------------------------------------------
-- League table
-- One row per team per season (teams come from season_teams).
-- Counts played and awarded matches. Points = 3 per win + 1 per draw minus
-- deductions. form = last five results, oldest first, e.g. 'WWDLW'.
-- position is ranked within (season, group): points, goal difference,
-- goals for, then team name. Seasons without groups have group_name null.
-- ---------------------------------------------------------------------------
create view public.league_table
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
         coalesce(tt.goals_for, 0) - coalesce(tt.goals_against, 0) as goal_difference,
         coalesce(d.deducted, 0) as points_deducted,
         d.deduction_notes,
         3 * coalesce(tt.won, 0) + coalesce(tt.drawn, 0) - coalesce(d.deducted, 0) as points,
         coalesce(tt.form, '') as form
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

-- ---------------------------------------------------------------------------
-- Latest prediction per match (what the pick buttons show).
-- ---------------------------------------------------------------------------
create view public.latest_predictions
with (security_invoker = true)
as
select distinct on (p.match_id) p.*
from public.predictions p
order by p.match_id, p.created_at desc, p.id desc;

-- ---------------------------------------------------------------------------
-- Frozen prediction per match: its latest row created before kickoff_at.
-- Used for scoring and for every accuracy figure.
-- ---------------------------------------------------------------------------
create view public.frozen_predictions
with (security_invoker = true)
as
select distinct on (p.match_id) p.*
from public.predictions p
join public.matches m on m.id = p.match_id
where p.created_at < m.kickoff_at
order by p.match_id, p.created_at desc, p.id desc;

-- ---------------------------------------------------------------------------
-- Public profile fields: display name only (plus role, so the app can find
-- The Ballboy, and sign-up time for tie-breaks). Banned users are hidden.
-- Runs as the view owner so it can expose these columns without exposing
-- the rest of the profiles table.
-- ---------------------------------------------------------------------------
create view public.public_profiles
with (security_invoker = false)
as
select id, display_name, role, created_at
from public.profiles
where not banned;
