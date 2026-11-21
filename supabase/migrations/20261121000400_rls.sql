-- Row Level Security and table privileges.
--
-- Supabase grants ALL on public tables to anon and authenticated by default.
-- Start from nothing and grant back only what each role needs, then let RLS
-- decide which rows. The service role bypasses RLS and keeps full access.

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'seasons', 'teams', 'team_aliases', 'season_teams', 'matchdays',
    'matches', 'point_deductions', 'model_runs', 'predictions', 'team_ratings',
    'picks', 'email_sends', 'audit_log', 'site_settings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end;
$$;

revoke all on public.league_table, public.latest_predictions, public.frozen_predictions,
  public.public_profiles from anon, authenticated;
grant select on public.league_table, public.latest_predictions, public.frozen_predictions,
  public.public_profiles to anon, authenticated;
grant select on public.league_table, public.latest_predictions, public.frozen_predictions,
  public.public_profiles to service_role;

-- anon needs is_admin() because policies it is subject to call it; it simply
-- returns false for anon.
revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- League data: anyone reads; only admins write.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'seasons', 'teams', 'team_aliases', 'season_teams', 'matchdays', 'matches',
    'point_deductions', 'site_settings'
  ] loop
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant insert, update, delete on public.%I to authenticated', t);
    execute format(
      'create policy "%1$s: anyone can read" on public.%1$I
         for select to anon, authenticated using (true)', t);
    execute format(
      'create policy "%1$s: admins insert" on public.%1$I
         for insert to authenticated with check ((select public.is_admin()))', t);
    execute format(
      'create policy "%1$s: admins update" on public.%1$I
         for update to authenticated
         using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    execute format(
      'create policy "%1$s: admins delete" on public.%1$I
         for delete to authenticated using ((select public.is_admin()))', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Model output: anyone reads predictions and ratings. Only the service role
-- writes (no write grants or policies for anon/authenticated).
-- model_runs (which can hold error text) are visible to admins only.
-- ---------------------------------------------------------------------------
grant select on public.predictions, public.team_ratings to anon, authenticated;
create policy "predictions: anyone can read" on public.predictions
  for select to anon, authenticated using (true);
create policy "team_ratings: anyone can read" on public.team_ratings
  for select to anon, authenticated using (true);

grant select on public.model_runs to authenticated;
create policy "model_runs: admins read" on public.model_runs
  for select to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Profiles: the full row is visible to its owner and to admins. Everyone
-- else uses public_profiles. A fan may update their own row; the
-- protect_profile_columns trigger limits which fields. Rows are created by
-- the on_auth_user_created trigger, never directly.
-- ---------------------------------------------------------------------------
grant select, update on public.profiles to authenticated;
create policy "profiles: owner or admin reads" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy "profiles: owner or admin updates" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Picks.
-- Read: your own at any time; anyone's once the match has kicked off.
-- Write: your own only, only while now() < kickoff_at and the match is
-- scheduled or postponed (postponed picks carry over to the new kick-off).
-- Banned users and the system account cannot pick through the API.
-- Fans can never write points: those columns are not granted.
-- ---------------------------------------------------------------------------
create function public.pick_window_open(p_match_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.matches m
    where m.id = p_match_id
      and m.status in ('scheduled', 'postponed')
      and now() < m.kickoff_at
  );
$$;

create function public.can_pick()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role <> 'system' and not banned
  );
$$;
revoke execute on function public.can_pick() from public, anon;
grant execute on function public.can_pick() to authenticated, service_role;

grant select on public.picks to anon, authenticated;
grant insert (user_id, match_id, outcome, pred_home_goals, pred_away_goals)
  on public.picks to authenticated;
grant update (outcome, pred_home_goals, pred_away_goals) on public.picks to authenticated;

create policy "picks: own, or anyone's after kick-off" on public.picks
  for select to anon, authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.matches m
      where m.id = picks.match_id and m.kickoff_at <= now()
    )
    or (select public.is_admin())
  );

create policy "picks: insert own before kick-off" on public.picks
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.can_pick())
    and public.pick_window_open(match_id)
  );

create policy "picks: update own before kick-off" on public.picks
  for update to authenticated
  using (
    user_id = (select auth.uid())
    and public.pick_window_open(match_id)
  )
  with check (
    user_id = (select auth.uid())
    and (select public.can_pick())
    and public.pick_window_open(match_id)
  );

-- ---------------------------------------------------------------------------
-- Email sends and the audit log: admins read; only the service role and
-- triggers write.
-- ---------------------------------------------------------------------------
grant select on public.email_sends, public.audit_log to authenticated;
create policy "email_sends: admins read" on public.email_sends
  for select to authenticated using ((select public.is_admin()));
create policy "audit_log: admins read" on public.audit_log
  for select to authenticated using ((select public.is_admin()));
