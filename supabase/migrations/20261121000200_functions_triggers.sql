-- Helper functions and triggers.

-- ---------------------------------------------------------------------------
-- updated_at on every table
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'seasons', 'teams', 'team_aliases', 'season_teams', 'matchdays',
    'matches', 'point_deductions', 'model_runs', 'predictions', 'team_ratings',
    'picks', 'email_sends', 'audit_log', 'site_settings'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Role check used by RLS policies. SECURITY DEFINER so it can read profiles
-- without recursing through the profiles policies.
-- ---------------------------------------------------------------------------
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin' and not banned
  );
$$;

-- ---------------------------------------------------------------------------
-- Audit log: every write made by a signed-in user (only admins can write
-- these tables) is recorded. Writes by the service role (seed script, model
-- job) have no auth.uid() and are not logged.
-- ---------------------------------------------------------------------------
create function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is not null then
    insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
    values (
      actor,
      lower(tg_op),
      tg_table_name,
      case when tg_op = 'DELETE' then old.id else new.id end,
      case when tg_op = 'INSERT' then null else to_jsonb(old) end,
      case when tg_op = 'DELETE' then null else to_jsonb(new) end
    );
  end if;
  return null; -- AFTER trigger
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'seasons', 'teams', 'team_aliases', 'season_teams', 'matchdays', 'matches',
    'point_deductions', 'site_settings'
  ] loop
    execute format(
      'create trigger write_audit_log after insert or update or delete on public.%I
         for each row execute function public.write_audit_log()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Matches: record who changed a match, and keep awarded results out of the
-- model.
-- ---------------------------------------------------------------------------
create function public.matches_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    new.updated_by := (select auth.uid());
  end if;
  if new.status = 'awarded' then
    new.exclude_from_model := true;
  end if;
  return new;
end;
$$;

create trigger matches_before_write
  before insert or update on public.matches
  for each row execute function public.matches_before_write();

-- ---------------------------------------------------------------------------
-- Profiles: create one for every new auth user.
-- Sign-up sends display_name and email_opt_in as user metadata. Google
-- sign-in has no display name, so a placeholder is used until the fan sets
-- one. A name clash gets a short suffix rather than failing the sign-up.
-- ---------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');
  name text;
begin
  if wanted is null or char_length(wanted) < 2 then
    name := 'Fan ' || substr(replace(new.id::text, '-', ''), 1, 8);
  else
    name := left(wanted, 30);
    if exists (select 1 from public.profiles where lower(display_name) = lower(name)) then
      name := left(wanted, 25) || ' ' || substr(replace(new.id::text, '-', ''), 1, 4);
    end if;
  end if;

  insert into public.profiles (id, display_name, email_opt_in)
  values (
    new.id,
    name,
    coalesce((new.raw_user_meta_data ->> 'email_opt_in')::boolean, false)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Profiles: fans may change only their display name and email setting.
-- role, premium and banned can be changed only by an admin or the service
-- role.
-- ---------------------------------------------------------------------------
create function public.protect_profile_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not public.is_admin() then
    if new.id is distinct from old.id
       or new.role is distinct from old.role
       or new.premium is distinct from old.premium
       or new.banned is distinct from old.banned
       or new.created_at is distinct from old.created_at then
      raise exception 'Only an admin can change this profile field'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger protect_profile_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- ---------------------------------------------------------------------------
-- Predictions are append-only: each run adds rows, none are changed.
-- ---------------------------------------------------------------------------
create function public.predictions_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'predictions are append-only' using errcode = '42501';
end;
$$;

create trigger predictions_append_only
  before update on public.predictions
  for each row execute function public.predictions_append_only();
