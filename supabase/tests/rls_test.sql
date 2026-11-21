-- RLS test. Run against a fresh database after supabase_stub.sql and all
-- migrations (see run_db_tests.sh). Exits non-zero if any check fails.
--
-- Every attempted statement runs inside a subtransaction that is always rolled
-- back, so each check starts from the same fixtures.

\set ON_ERROR_STOP on
set client_min_messages = warning;
-- Hide per-check output; the report at the end lists every result.
\o /dev/null

-- ---------------------------------------------------------------------------
-- Test harness
-- ---------------------------------------------------------------------------
create schema rls_test;
create table rls_test.results (
  n serial primary key,
  actor text not null,
  label text not null,
  passed boolean not null,
  detail text
);
grant usage on schema rls_test to anon, authenticated, service_role;
grant insert, select on rls_test.results to anon, authenticated, service_role;
grant usage on sequence rls_test.results_n_seq to anon, authenticated, service_role;

-- Run stmt, report the number of rows affected (or the error), then undo it.
create function rls_test.attempt(stmt text, out rows_affected bigint, out err text)
language plpgsql
as $$
begin
  rows_affected := null;
  err := null;
  begin
    execute stmt;
    get diagnostics rows_affected = row_count;
    raise exception using errcode = 'P0001', message = '__undo__';
  exception when others then
    if sqlerrm <> '__undo__' then
      err := sqlstate || ' ' || sqlerrm;
    end if;
  end;
end;
$$;

create function rls_test.record(label text, passed boolean, detail text)
returns void
language sql
as $$
  insert into rls_test.results (actor, label, passed, detail)
  values (coalesce(current_setting('rls_test.actor', true), current_user), label, passed, detail);
$$;

-- Denied = the statement errors, or it changes no rows (RLS filtered them out).
create function rls_test.expect_denied(label text, stmt text)
returns void
language plpgsql
as $$
declare
  r record;
begin
  r := rls_test.attempt(stmt);
  perform rls_test.record(
    label,
    r.err is not null or r.rows_affected = 0,
    coalesce(r.err, r.rows_affected || ' row(s) affected')
  );
end;
$$;

create function rls_test.expect_allowed(label text, stmt text, expected_rows bigint default 1)
returns void
language plpgsql
as $$
declare
  r record;
begin
  r := rls_test.attempt(stmt);
  perform rls_test.record(
    label,
    r.err is null and r.rows_affected = expected_rows,
    coalesce(r.err, r.rows_affected || ' row(s) affected, expected ' || expected_rows)
  );
end;
$$;

create function rls_test.expect_count(label text, query text, expected bigint)
returns void
language plpgsql
as $$
declare
  c bigint;
begin
  execute format('select count(*) from (%s) q', query) into c;
  perform rls_test.record(label, c = expected, c || ' row(s) visible, expected ' || expected);
exception when others then
  perform rls_test.record(label, false, sqlstate || ' ' || sqlerrm);
end;
$$;

grant execute on all functions in schema rls_test to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Fixtures (as the database owner)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'fan.a@example.test', '{"display_name": "Fan A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'fan.b@example.test', '{"display_name": "Fan B", "email_opt_in": true}'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@example.test', '{"display_name": "Site Admin"}'),
  ('00000000-0000-0000-0000-0000000000bb', 'ballboy@example.test', '{"display_name": "The Ballboy"}'),
  ('00000000-0000-0000-0000-0000000000ba', 'banned@example.test', '{"display_name": "Banned Fan"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'clash@example.test', '{"display_name": "fan a"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'google@example.test', '{}');

update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000ad';
update public.profiles set role = 'system' where id = '00000000-0000-0000-0000-0000000000bb';
update public.profiles set banned = true where id = '00000000-0000-0000-0000-0000000000ba';

insert into public.seasons (id, label, start_date, end_date, is_current) values
  ('10000000-0000-0000-0000-000000000001', '2026/27', '2026-08-01', '2027-06-30', true);
insert into public.teams (id, name, code, slug) values
  ('20000000-0000-0000-0000-000000000001', 'Home United', 'HOM', 'home-united'),
  ('20000000-0000-0000-0000-000000000002', 'Away City', 'AWY', 'away-city');
insert into public.season_teams (season_id, team_id) values
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002');
insert into public.matchdays (id, season_id, number) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1);

insert into public.matches
  (id, season_id, matchday_id, home_team_id, away_team_id, kickoff_at, status, home_goals, away_goals)
values
  -- upcoming, picks open
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000002', now() + interval '1 day', 'scheduled', null, null),
  -- kicked off an hour ago, no result yet
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
   '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002',
   '20000000-0000-0000-0000-000000000001', now() - interval '1 hour', 'scheduled', null, null),
  -- postponed to a future date
  ('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001',
   '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000002', now() + interval '3 days', 'postponed', null, null),
  -- played 2-0
  ('40000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001',
   '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000002', now() - interval '7 days', 'played', 2, 0),
  -- cancelled, kick-off still in the future
  ('40000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001',
   '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002',
   '20000000-0000-0000-0000-000000000001', now() + interval '2 days', 'cancelled', null, null);

insert into public.point_deductions (season_id, team_id, points, reason) values
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 3,
   'Test deduction');

insert into public.model_runs (id, status, trigger, model_version) values
  ('50000000-0000-0000-0000-000000000001', 'done', 'manual', 'test');
insert into public.predictions
  (match_id, model_run_id, p_home, p_draw, p_away, xg_home, xg_away, top_scores, reasons)
values
  ('40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001',
   0.65, 0.26, 0.09, 1.60, 0.70, '[]', '[]');

-- Fan B already picked the upcoming match and the match that has kicked off.
insert into public.picks (id, user_id, match_id, outcome) values
  ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b',
   '40000000-0000-0000-0000-000000000001', 'home'),
  ('60000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b',
   '40000000-0000-0000-0000-000000000002', 'away');

-- ---------------------------------------------------------------------------
-- Owner-level checks on triggers and views
-- ---------------------------------------------------------------------------
select rls_test.record('profile created for every auth user',
  (select count(*) from public.profiles) = 7, null);
select rls_test.record('clashing display name gets a suffix',
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000c1')
    like 'fan a %', null);
select rls_test.record('Google sign-up without a name gets a placeholder',
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000c2')
    like 'Fan %', null);
select rls_test.record('email_opt_in comes from sign-up metadata',
  (select email_opt_in from public.profiles where id = '00000000-0000-0000-0000-00000000000b'), null);
select rls_test.record('league table: winner has 3 points',
  (select points from public.league_table where team_id = '20000000-0000-0000-0000-000000000001') = 3, null);
select rls_test.record('league table: deduction applied (0 - 3 = -3)',
  (select points from public.league_table where team_id = '20000000-0000-0000-0000-000000000002') = -3, null);
select rls_test.record('league table: winner is first with form W',
  (select position = 1 and form = 'W' and goal_difference = 2 from public.league_table
    where team_id = '20000000-0000-0000-0000-000000000001'), null);
update public.matches set status = 'awarded', home_goals = 3, away_goals = 0
  where id = '40000000-0000-0000-0000-000000000004';
select rls_test.record('setting status awarded sets exclude_from_model',
  (select exclude_from_model from public.matches where id = '40000000-0000-0000-0000-000000000004'), null);
update public.matches set status = 'played', home_goals = 2, away_goals = 0, exclude_from_model = false
  where id = '40000000-0000-0000-0000-000000000004';
select rls_test.record('frozen prediction = latest row before kick-off',
  (select count(*) from public.frozen_predictions) = 1, null);

-- ---------------------------------------------------------------------------
-- Anonymous visitor
-- ---------------------------------------------------------------------------
begin;
set local role anon;
set local rls_test.actor = 'anon';
select set_config('request.jwt.claims', '{"role": "anon"}', true);

select rls_test.expect_count('anon reads matches', 'select * from public.matches', 5);
select rls_test.expect_count('anon reads teams', 'select * from public.teams', 2);
select rls_test.expect_count('anon reads league table', 'select * from public.league_table', 2);
select rls_test.expect_count('anon reads predictions', 'select * from public.latest_predictions', 1);
select rls_test.expect_count('anon reads public profiles (banned hidden)',
  'select * from public.public_profiles', 6);
select rls_test.expect_count('anon cannot see picks before kick-off',
  $q$select * from public.picks where match_id = '40000000-0000-0000-0000-000000000001'$q$, 0);
select rls_test.expect_count('anon sees picks after kick-off',
  $q$select * from public.picks where match_id = '40000000-0000-0000-0000-000000000002'$q$, 1);
select rls_test.expect_denied('anon cannot read profiles table', 'select * from public.profiles');
select rls_test.expect_denied('anon cannot insert a pick',
  $q$insert into public.picks (user_id, match_id, outcome) values
     ('00000000-0000-0000-0000-00000000000a', '40000000-0000-0000-0000-000000000001', 'home')$q$);
select rls_test.expect_denied('anon cannot update matches',
  $q$update public.matches set notes = 'x'$q$);
select rls_test.expect_denied('anon cannot read model runs', 'select * from public.model_runs');
commit;

-- ---------------------------------------------------------------------------
-- Fan A
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
set local rls_test.actor = 'fan_a';
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}', true);

-- Own picks
select rls_test.expect_allowed('fan picks an upcoming match',
  $q$insert into public.picks (user_id, match_id, outcome, pred_home_goals, pred_away_goals) values
     ('00000000-0000-0000-0000-00000000000a', '40000000-0000-0000-0000-000000000001', 'home', 2, 1)$q$);
select rls_test.expect_allowed('fan picks a postponed match with a future kick-off',
  $q$insert into public.picks (user_id, match_id, outcome) values
     ('00000000-0000-0000-0000-00000000000a', '40000000-0000-0000-0000-000000000003', 'draw')$q$);
select rls_test.expect_denied('fan cannot pick after kick-off',
  $q$insert into public.picks (user_id, match_id, outcome) values
     ('00000000-0000-0000-0000-00000000000a', '40000000-0000-0000-0000-000000000002', 'home')$q$);
select rls_test.expect_denied('fan cannot pick a played match',
  $q$insert into public.picks (user_id, match_id, outcome) values
     ('00000000-0000-0000-0000-00000000000a', '40000000-0000-0000-0000-000000000004', 'home')$q$);
select rls_test.expect_denied('fan cannot pick a cancelled match',
  $q$insert into public.picks (user_id, match_id, outcome) values
     ('00000000-0000-0000-0000-00000000000a', '40000000-0000-0000-0000-000000000005', 'home')$q$);
select rls_test.expect_denied('fan cannot set points_if_correct',
  $q$insert into public.picks (user_id, match_id, outcome, points_if_correct) values
     ('00000000-0000-0000-0000-00000000000a', '40000000-0000-0000-0000-000000000001', 'away', 10)$q$);
select rls_test.expect_denied('fan cannot set points_awarded',
  $q$insert into public.picks (user_id, match_id, outcome, points_awarded) values
     ('00000000-0000-0000-0000-00000000000a', '40000000-0000-0000-0000-000000000001', 'away', 13)$q$);

-- Another fan's picks
select rls_test.expect_denied('fan cannot insert a pick for another fan',
  $q$insert into public.picks (user_id, match_id, outcome) values
     ('00000000-0000-0000-0000-00000000000b', '40000000-0000-0000-0000-000000000003', 'away')$q$);
select rls_test.expect_denied('fan cannot edit another fan''s pick (before kick-off)',
  $q$update public.picks set outcome = 'away' where id = '60000000-0000-0000-0000-000000000001'$q$);
select rls_test.expect_denied('fan cannot edit another fan''s pick (after kick-off)',
  $q$update public.picks set outcome = 'home' where id = '60000000-0000-0000-0000-000000000002'$q$);
select rls_test.expect_denied('fan cannot delete another fan''s pick',
  $q$delete from public.picks where id = '60000000-0000-0000-0000-000000000001'$q$);
select rls_test.expect_denied('fan cannot truncate picks', 'truncate public.picks');
select rls_test.expect_count('fan cannot see another fan''s pick before kick-off',
  $q$select * from public.picks where id = '60000000-0000-0000-0000-000000000001'$q$, 0);
select rls_test.expect_count('fan sees another fan''s pick after kick-off',
  $q$select * from public.picks where id = '60000000-0000-0000-0000-000000000002'$q$, 1);

-- League data and model output
select rls_test.expect_denied('fan cannot insert a match',
  $q$insert into public.matches (season_id, home_team_id, away_team_id, kickoff_at) values
     ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000002', now())$q$);
select rls_test.expect_denied('fan cannot enter a result',
  $q$update public.matches set status = 'played', home_goals = 5, away_goals = 0
     where id = '40000000-0000-0000-0000-000000000002'$q$);
select rls_test.expect_denied('fan cannot move a kick-off',
  $q$update public.matches set kickoff_at = now() + interval '1 year'$q$);
select rls_test.expect_denied('fan cannot delete a match',
  $q$delete from public.matches$q$);
select rls_test.expect_denied('fan cannot edit seasons', $q$update public.seasons set is_current = false$q$);
select rls_test.expect_denied('fan cannot edit teams', $q$update public.teams set name = 'X'$q$);
select rls_test.expect_denied('fan cannot add aliases',
  $q$insert into public.team_aliases (alias, team_id) values ('x', '20000000-0000-0000-0000-000000000001')$q$);
select rls_test.expect_denied('fan cannot add matchdays',
  $q$insert into public.matchdays (season_id, number) values ('10000000-0000-0000-0000-000000000001', 2)$q$);
select rls_test.expect_denied('fan cannot remove deductions', $q$delete from public.point_deductions$q$);
select rls_test.expect_denied('fan cannot change site settings',
  $q$update public.site_settings set value = 'true' where key = 'ads_enabled'$q$);
select rls_test.expect_denied('fan cannot write predictions',
  $q$insert into public.predictions (match_id, model_run_id, p_home, p_draw, p_away, xg_home,
     xg_away, top_scores, reasons) values ('40000000-0000-0000-0000-000000000001',
     '50000000-0000-0000-0000-000000000001', 0.10, 0.10, 0.80, 0, 3, '[]', '[]')$q$);
select rls_test.expect_denied('fan cannot write team ratings',
  $q$insert into public.team_ratings (team_id, match_id, rated_at, elo, attack, defence) values
     ('20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000004', now(), 2000, 1, 1)$q$);
select rls_test.expect_denied('fan cannot write model runs',
  $q$insert into public.model_runs (trigger) values ('manual')$q$);
select rls_test.expect_denied('fan cannot write the audit log',
  $q$insert into public.audit_log (action, entity) values ('insert', 'matches')$q$);
select rls_test.expect_count('fan cannot read the audit log', 'select * from public.audit_log', 0);
select rls_test.expect_count('fan cannot read email sends', 'select * from public.email_sends', 0);

-- Profiles
select rls_test.expect_count('fan reads only their own profile row', 'select * from public.profiles', 1);
select rls_test.expect_allowed('fan changes own display name and email setting',
  $q$update public.profiles set display_name = 'Fan A Renamed', email_opt_in = true
     where id = '00000000-0000-0000-0000-00000000000a'$q$);
select rls_test.expect_denied('fan cannot make themselves admin',
  $q$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a'$q$);
select rls_test.expect_denied('fan cannot give themselves premium',
  $q$update public.profiles set premium = true where id = '00000000-0000-0000-0000-00000000000a'$q$);
select rls_test.expect_denied('fan cannot edit another profile',
  $q$update public.profiles set display_name = 'Hacked' where id = '00000000-0000-0000-0000-00000000000b'$q$);
select rls_test.expect_denied('fan cannot take a display name in another case',
  $q$update public.profiles set display_name = 'FAN B' where id = '00000000-0000-0000-0000-00000000000a'$q$);
commit;

-- ---------------------------------------------------------------------------
-- Fan B (owner of the existing picks)
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
set local rls_test.actor = 'fan_b';
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}', true);

select rls_test.expect_allowed('fan edits own pick before kick-off',
  $q$update public.picks set outcome = 'draw', pred_home_goals = 1, pred_away_goals = 1
     where id = '60000000-0000-0000-0000-000000000001'$q$);
select rls_test.expect_denied('fan cannot edit own pick after kick-off',
  $q$update public.picks set outcome = 'home' where id = '60000000-0000-0000-0000-000000000002'$q$);
select rls_test.expect_denied('fan cannot give own pick points',
  $q$update public.picks set points_awarded = 13 where id = '60000000-0000-0000-0000-000000000001'$q$);
select rls_test.expect_denied('fan cannot move own pick to another match',
  $q$update public.picks set match_id = '40000000-0000-0000-0000-000000000003'
     where id = '60000000-0000-0000-0000-000000000001'$q$);
select rls_test.expect_denied('exact score must agree with the outcome',
  $q$update public.picks set outcome = 'home', pred_home_goals = 0, pred_away_goals = 2
     where id = '60000000-0000-0000-0000-000000000001'$q$);
select rls_test.expect_count('fan reads own picks', 'select * from public.picks where user_id = auth.uid()', 2);
commit;

-- ---------------------------------------------------------------------------
-- Banned fan and the system account
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
set local rls_test.actor = 'banned';
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000000ba", "role": "authenticated"}', true);
select rls_test.expect_denied('banned fan cannot pick',
  $q$insert into public.picks (user_id, match_id, outcome) values
     ('00000000-0000-0000-0000-0000000000ba', '40000000-0000-0000-0000-000000000001', 'home')$q$);
select rls_test.expect_denied('banned fan cannot unban themselves',
  $q$update public.profiles set banned = false where id = auth.uid()$q$);
commit;

begin;
set local role authenticated;
set local rls_test.actor = 'ballboy';
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000000bb", "role": "authenticated"}', true);
select rls_test.expect_denied('system account cannot pick through the API',
  $q$insert into public.picks (user_id, match_id, outcome) values
     ('00000000-0000-0000-0000-0000000000bb', '40000000-0000-0000-0000-000000000001', 'home')$q$);
commit;

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
set local rls_test.actor = 'admin';
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-0000000000ad", "role": "authenticated"}', true);

select rls_test.expect_allowed('admin adds a team',
  $q$insert into public.teams (name, code, slug) values ('New Club', 'NEW', 'new-club')$q$);
select rls_test.expect_allowed('admin records a deduction',
  $q$insert into public.point_deductions (season_id, team_id, points, reason) values
     ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 3, 'Test')$q$);
select rls_test.expect_allowed('admin bans a fan',
  $q$update public.profiles set banned = true where id = '00000000-0000-0000-0000-00000000000a'$q$);
select rls_test.expect_count('admin reads all profiles', 'select * from public.profiles', 7);
select rls_test.expect_count('admin reads picks before kick-off',
  $q$select * from public.picks where match_id = '40000000-0000-0000-0000-000000000001'$q$, 1);
select rls_test.expect_denied('admin cannot write predictions (service role only)',
  $q$insert into public.predictions (match_id, model_run_id, p_home, p_draw, p_away, xg_home,
     xg_away, top_scores, reasons) values ('40000000-0000-0000-0000-000000000001',
     '50000000-0000-0000-0000-000000000001', 0.10, 0.10, 0.80, 0, 3, '[]', '[]')$q$);
select rls_test.expect_denied('admin cannot write points (service role only)',
  $q$update public.picks set points_awarded = 5 where id = '60000000-0000-0000-0000-000000000002'$q$);

-- Committed on purpose: the audit check below looks for this change.
update public.matches set status = 'played', home_goals = 1, away_goals = 1
  where id = '40000000-0000-0000-0000-000000000002';
select rls_test.record('admin enters a result',
  (select status = 'played' from public.matches where id = '40000000-0000-0000-0000-000000000002'), null);
commit;

select rls_test.record('admin result write logged in audit_log with actor and before/after',
  exists (
    select 1 from public.audit_log
    where entity = 'matches' and entity_id = '40000000-0000-0000-0000-000000000002'
      and action = 'update' and actor_id = '00000000-0000-0000-0000-0000000000ad'
      and before ->> 'status' = 'scheduled' and after ->> 'status' = 'played'
  ), null);
select rls_test.record('matches.updated_by set to the admin',
  (select updated_by from public.matches where id = '40000000-0000-0000-0000-000000000002')
    = '00000000-0000-0000-0000-0000000000ad', null);

-- ---------------------------------------------------------------------------
-- Service role (the Python job and server-side code)
-- ---------------------------------------------------------------------------
begin;
set local role service_role;
set local rls_test.actor = 'service_role';
select set_config('request.jwt.claims', '{"role": "service_role"}', true);
select rls_test.expect_allowed('service role writes predictions',
  $q$insert into public.predictions (match_id, model_run_id, p_home, p_draw, p_away, xg_home,
     xg_away, top_scores, reasons) values ('40000000-0000-0000-0000-000000000003',
     '50000000-0000-0000-0000-000000000001', 0.40, 0.30, 0.30, 1.2, 1.0, '[]', '[]')$q$);
select rls_test.expect_denied('predictions are append-only',
  $q$update public.predictions set p_home = 0.50, p_draw = 0.25, p_away = 0.25$q$);
select rls_test.expect_denied('probabilities must sum to 1',
  $q$insert into public.predictions (match_id, model_run_id, p_home, p_draw, p_away, xg_home,
     xg_away, top_scores, reasons) values ('40000000-0000-0000-0000-000000000003',
     '50000000-0000-0000-0000-000000000001', 0.40, 0.40, 0.30, 1.2, 1.0, '[]', '[]')$q$);
select rls_test.expect_allowed('service role writes points',
  $q$update public.picks set points_if_correct = 2, points_awarded = 0
     where id = '60000000-0000-0000-0000-000000000002'$q$);
select rls_test.expect_allowed('service role writes the Ballboy''s pick',
  $q$insert into public.picks (user_id, match_id, outcome, pred_home_goals, pred_away_goals) values
     ('00000000-0000-0000-0000-0000000000bb', '40000000-0000-0000-0000-000000000001', 'home', 1, 0)$q$);
select rls_test.expect_allowed('service role writes team ratings',
  $q$insert into public.team_ratings (team_id, match_id, rated_at, elo, attack, defence) values
     ('20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000004', now(),
      1510, 0.05, -0.02)$q$);
commit;

-- ---------------------------------------------------------------------------
-- Report
-- ---------------------------------------------------------------------------
\o
\pset footer off
select n as "#", actor, case when passed then 'PASS' else 'FAIL' end as result, label,
       case when passed then '' else coalesce(detail, '') end as detail
from rls_test.results order by n;

do $$
declare
  failed int := (select count(*) from rls_test.results where not passed);
  total int := (select count(*) from rls_test.results);
begin
  if failed > 0 then
    raise exception '% of % RLS checks failed', failed, total;
  end if;
  raise warning 'All % RLS checks passed', total;
end;
$$;
