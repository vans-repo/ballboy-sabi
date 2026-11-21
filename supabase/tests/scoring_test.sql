-- Scoring, leaderboard and fan split. Run after the migrations on a fresh
-- database (run_db_tests.sh). Raises an exception if any check fails.
\set ON_ERROR_STOP on
set client_min_messages = warning;

begin;

-- Fixtures: two teams, a season, one match, an admin, three fans, The Ballboy.
insert into auth.users (id, email, raw_user_meta_data) values
  ('acacacac-0000-0000-0000-00000000000a', 'admin@scoring.invalid', '{"display_name":"Admin"}'),
  ('acacacac-0000-0000-0000-000000000001', 'ada@scoring.invalid', '{"display_name":"Ada"}'),
  ('acacacac-0000-0000-0000-000000000002', 'bayo@scoring.invalid', '{"display_name":"Bayo"}'),
  ('acacacac-0000-0000-0000-000000000003', 'chi@scoring.invalid', '{"display_name":"Chi"}'),
  ('acacacac-0000-0000-0000-0000000000bb', 'ballboy@scoring.invalid', '{"display_name":"The Ballboy"}');
update public.profiles set role = 'admin' where id = 'acacacac-0000-0000-0000-00000000000a';
update public.profiles set role = 'system' where id = 'acacacac-0000-0000-0000-0000000000bb';

insert into public.seasons (id, label, start_date, end_date, is_current)
values ('5c000000-0000-0000-0000-000000000001', '2039/40', '2039-08-01', '2040-07-31', false);
insert into public.teams (id, name, code, slug) values
  ('5c000000-0000-0000-0000-000000000021', 'Scoring Home', 'SCH', 'scoring-home'),
  ('5c000000-0000-0000-0000-000000000022', 'Scoring Away', 'SCA', 'scoring-away');
insert into public.matchdays (id, season_id, number)
values ('5c000000-0000-0000-0000-000000000003', '5c000000-0000-0000-0000-000000000001', 1);
insert into public.matches (id, season_id, matchday_id, home_team_id, away_team_id, kickoff_at)
values ('5c000000-0000-0000-0000-000000000004', '5c000000-0000-0000-0000-000000000001',
        '5c000000-0000-0000-0000-000000000003', '5c000000-0000-0000-0000-000000000021',
        '5c000000-0000-0000-0000-000000000022', now() - interval '2 hours');

-- Predictions: one before kick-off (frozen: 65/26/09), one after (must be ignored).
insert into public.model_runs (id, trigger, status) values ('5c000000-0000-0000-0000-000000000005', 'manual', 'done');
insert into public.predictions (match_id, model_run_id, p_home, p_draw, p_away, xg_home, xg_away, top_scores, reasons, created_at)
values
  ('5c000000-0000-0000-0000-000000000004', '5c000000-0000-0000-0000-000000000005', 0.65, 0.26, 0.09, 1.8, 0.7, '[]', '[]', now() - interval '1 day'),
  ('5c000000-0000-0000-0000-000000000004', '5c000000-0000-0000-0000-000000000005', 0.20, 0.20, 0.60, 1.0, 1.5, '[]', '[]', now() - interval '1 hour');

-- Picks (written directly; the RLS test covers who may write them).
insert into public.picks (user_id, match_id, outcome, pred_home_goals, pred_away_goals) values
  ('acacacac-0000-0000-0000-000000000001', '5c000000-0000-0000-0000-000000000004', 'home', 2, 0),
  ('acacacac-0000-0000-0000-000000000002', '5c000000-0000-0000-0000-000000000004', 'draw', 1, 1),
  ('acacacac-0000-0000-0000-000000000003', '5c000000-0000-0000-0000-000000000004', 'away', 0, 2),
  ('acacacac-0000-0000-0000-0000000000bb', '5c000000-0000-0000-0000-000000000004', 'home', 1, 0);

create temp table checks (label text, passed boolean, detail text);
grant all on checks to authenticated;

create function pg_temp.points(u text) returns text language sql as $$
  select coalesce(points_if_correct::text, 'null') || '/' || coalesce(points_awarded::text, 'null')
  from public.picks where user_id = u::uuid and match_id = '5c000000-0000-0000-0000-000000000004'
$$;
create function pg_temp.check(label text, got text, want text) returns void language sql as $$
  insert into checks values (label, got is not distinct from want, 'got ' || coalesce(got, 'null') || ', want ' || want)
$$;

-- The admin saves the result 0-2 (as the admin user, through RLS).
set local role authenticated;
set local request.jwt.claims = '{"sub":"acacacac-0000-0000-0000-00000000000a","role":"authenticated"}';
update public.matches set status = 'played', home_goals = 0, away_goals = 2
  where id = '5c000000-0000-0000-0000-000000000004';
reset role;

select pg_temp.check('wrong home pick: 0 (home was worth round(1/0.65) = 2)', pg_temp.points('acacacac-0000-0000-0000-000000000001'), '2/0');
select pg_temp.check('wrong draw pick: 0 (worth 4)', pg_temp.points('acacacac-0000-0000-0000-000000000002'), '4/0');
select pg_temp.check('correct away with exact score: min(10, round(1/0.09)) + 3 = 13', pg_temp.points('acacacac-0000-0000-0000-000000000003'), '10/13');
select pg_temp.check('The Ballboy scores under the same rules', pg_temp.points('acacacac-0000-0000-0000-0000000000bb'), '2/0');

-- Correction: 1-1. Everything rescores.
set local role authenticated;
set local request.jwt.claims = '{"sub":"acacacac-0000-0000-0000-00000000000a","role":"authenticated"}';
update public.matches set home_goals = 1, away_goals = 1 where id = '5c000000-0000-0000-0000-000000000004';
reset role;
select pg_temp.check('after correction: draw with exact 1-1 = 4 + 3', pg_temp.points('acacacac-0000-0000-0000-000000000002'), '4/7');
select pg_temp.check('after correction: away pick now 0', pg_temp.points('acacacac-0000-0000-0000-000000000003'), '10/0');

-- Leaderboard (only this test's users; the RLS test leaves its own behind):
-- Bayo 7, then Ada, Chi and The Ballboy on 0 in sign-up order. The Ballboy
-- is listed with no points. (Its name has a suffix here because the RLS
-- test's Ballboy already holds "The Ballboy".)
select pg_temp.check('leaderboard order',
  (select string_agg(points || ':' || correct || ':' || exact || ':' || is_ballboy, ',' order by rank)
   from public.leaderboard('season', '5c000000-0000-0000-0000-000000000001')
   where user_id::text like 'acacacac%'),
  '7:1:1:false,0:0:0:false,0:0:0:false,0:0:0:true');

-- Banned fans disappear from the leaderboard.
update public.profiles set banned = true where id = 'acacacac-0000-0000-0000-000000000002';
select pg_temp.check('banned fan hidden',
  (select count(*)::text from public.leaderboard('all') where user_id::text like 'acacacac%'),
  '3');
update public.profiles set banned = false where id = 'acacacac-0000-0000-0000-000000000002';

-- Fan split after kick-off: 1 home, 1 draw, 1 away (The Ballboy not counted).
select pg_temp.check('fan split',
  (select home || '/' || draw || '/' || away from public.fan_split('5c000000-0000-0000-0000-000000000004')), '1/1/1');

-- Abandoned: picks void.
update public.matches set status = 'abandoned', home_goals = null, away_goals = null
  where id = '5c000000-0000-0000-0000-000000000004';
select pg_temp.check('abandoned: void', pg_temp.points('acacacac-0000-0000-0000-000000000002'), 'null/null');

-- Postponed to a new kick-off and then played: the frozen prediction is the
-- latest before the NEW kick-off (the 20/20/60 one).
update public.matches set status = 'postponed', kickoff_at = now() - interval '30 minutes'
  where id = '5c000000-0000-0000-0000-000000000004';
update public.matches set status = 'played', home_goals = 0, away_goals = 1
  where id = '5c000000-0000-0000-0000-000000000004';
select pg_temp.check('postponed: points from the prediction frozen at the new kick-off (round(1/0.60) = 2)',
  pg_temp.points('acacacac-0000-0000-0000-000000000003'), '2/2');

select pg_temp.check('points formula', (select string_agg(public.pick_points(p)::text, ',') from unnest(array[0.65, 0.26, 0.12, 0.09, 0.5, 0.95, 0.0]::numeric[]) p), '2,4,8,10,2,1,10');

do $$
declare
  bad text;
  n integer;
begin
  select count(*) into n from checks;
  select string_agg(label || ' (' || detail || ')', E'\n  ') into bad from checks where not passed;
  if bad is not null then
    raise exception E'Scoring checks failed:\n  %', bad;
  end if;
  raise warning 'All % scoring checks passed', n;
end;
$$;

rollback;
