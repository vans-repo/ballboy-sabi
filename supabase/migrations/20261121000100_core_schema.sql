-- Core schema: enums and every table in the spec.
-- All primary keys are UUIDs, all times are timestamptz (stored UTC, shown in
-- Africa/Lagos by the app), and every table has created_at / updated_at.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.match_status as enum (
  'scheduled', 'played', 'postponed', 'abandoned', 'awarded', 'cancelled'
);
create type public.season_team_status as enum ('stayed', 'promoted', 'relegated');
create type public.model_run_status as enum ('queued', 'running', 'done', 'failed');
create type public.model_run_trigger as enum ('result_saved', 'scheduled', 'manual');
create type public.pick_outcome as enum ('home', 'draw', 'away');
create type public.user_role as enum ('fan', 'admin', 'system');
create type public.email_send_status as enum ('queued', 'sent', 'failed');

-- ---------------------------------------------------------------------------
-- Fans (profiles first: other tables reference it)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
    check (char_length(btrim(display_name)) between 2 and 30 and display_name = btrim(display_name)),
  role public.user_role not null default 'fan',
  email_opt_in boolean not null default false,
  premium boolean not null default false, -- reserved for later; unused at launch
  banned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Display names are unique regardless of letter case.
create unique index profiles_display_name_key on public.profiles (lower(display_name));

-- ---------------------------------------------------------------------------
-- League data
-- ---------------------------------------------------------------------------
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  label text not null unique check (label ~ '^[0-9]{4}/[0-9]{2}$'),
  start_date date not null,
  end_date date not null,
  is_current boolean not null default false,
  format_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date > start_date)
);
-- At most one current season.
create unique index seasons_one_current on public.seasons (is_current) where is_current;

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text not null unique check (code ~ '^[A-Z]{3}$'),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- Neutral placeholders until real club colours are confirmed.
  primary_colour text not null default '#64748B' check (primary_colour ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_colour text not null default '#FFFFFF' check (secondary_colour ~ '^#[0-9A-Fa-f]{6}$'),
  city text,
  lat double precision check (lat between -90 and 90),
  lon double precision check (lon between -180 and 180),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.team_aliases (
  id uuid primary key default gen_random_uuid(),
  alias text not null unique check (alias = lower(btrim(alias)) and alias <> ''),
  team_id uuid not null references public.teams (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index team_aliases_team_id_idx on public.team_aliases (team_id);

create table public.season_teams (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete restrict,
  status public.season_team_status not null default 'stayed',
  group_name text, -- only used for the 2022/23 two-group season
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, team_id)
);
create index season_teams_team_id_idx on public.season_teams (team_id);

create table public.matchdays (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  number integer not null check (number > 0),
  picks_open_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, number)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  -- Nullable: some historical source files have no matchday numbers.
  matchday_id uuid references public.matchdays (id) on delete set null,
  home_team_id uuid not null references public.teams (id) on delete restrict,
  away_team_id uuid not null references public.teams (id) on delete restrict,
  kickoff_at timestamptz not null,
  kickoff_estimated boolean not null default false,
  -- Position of the match in its source file. Orders matches that share an
  -- estimated kickoff (2021/22 and 2022/23 have no real dates).
  source_order integer,
  status public.match_status not null default 'scheduled',
  home_goals smallint check (home_goals between 0 and 99),
  away_goals smallint check (away_goals between 0 and 99),
  exclude_from_model boolean not null default false,
  notes text,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (home_team_id <> away_team_id),
  -- A score exists exactly when the match has a result (played or awarded).
  check (
    (status in ('played', 'awarded')) = (home_goals is not null and away_goals is not null)
  ),
  check ((home_goals is null) = (away_goals is null))
);
create index matches_season_kickoff_idx on public.matches (season_id, kickoff_at);
create index matches_matchday_idx on public.matches (matchday_id);
create index matches_home_team_idx on public.matches (home_team_id, kickoff_at);
create index matches_away_team_idx on public.matches (away_team_id, kickoff_at);
create index matches_status_kickoff_idx on public.matches (status, kickoff_at);

create table public.point_deductions (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete restrict,
  points integer not null check (points > 0),
  reason text not null check (btrim(reason) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index point_deductions_season_team_idx on public.point_deductions (season_id, team_id);

-- ---------------------------------------------------------------------------
-- Model
-- ---------------------------------------------------------------------------
create table public.model_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz,
  finished_at timestamptz,
  status public.model_run_status not null default 'queued',
  trigger public.model_run_trigger not null,
  model_version text,
  metrics jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index model_runs_created_idx on public.model_runs (created_at desc);

create table public.predictions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  model_run_id uuid not null references public.model_runs (id) on delete cascade,
  -- Published probabilities: whole percentages stored as fractions (0.65).
  p_home numeric(3, 2) not null check (p_home between 0 and 1),
  p_draw numeric(3, 2) not null check (p_draw between 0 and 1),
  p_away numeric(3, 2) not null check (p_away between 0 and 1),
  xg_home numeric(4, 2) not null check (xg_home >= 0),
  xg_away numeric(4, 2) not null check (xg_away >= 0),
  -- [{"home": 1, "away": 0, "p": 0.14}, ...] top 3 scorelines
  top_scores jsonb not null check (jsonb_typeof(top_scores) = 'array'),
  -- ["Rangers rated 4th, Kwara 15th", ...] 2-3 plain-English lines
  reasons jsonb not null check (jsonb_typeof(reasons) = 'array'),
  upset_alert boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (p_home + p_draw + p_away = 1.00)
);
create index predictions_match_created_idx on public.predictions (match_id, created_at desc);
create index predictions_run_idx on public.predictions (model_run_id);

create table public.team_ratings (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  match_id uuid not null references public.matches (id) on delete cascade,
  rated_at timestamptz not null,
  elo numeric(7, 2) not null,
  attack numeric(6, 4) not null,
  defence numeric(6, 4) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, match_id)
);
create index team_ratings_team_rated_idx on public.team_ratings (team_id, rated_at);

-- ---------------------------------------------------------------------------
-- Fans: picks, email, audit, settings
-- ---------------------------------------------------------------------------
create table public.picks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  match_id uuid not null references public.matches (id) on delete cascade,
  outcome public.pick_outcome not null,
  pred_home_goals smallint check (pred_home_goals between 0 and 20),
  pred_away_goals smallint check (pred_away_goals between 0 and 20),
  points_if_correct smallint check (points_if_correct between 1 and 10),
  points_awarded smallint check (points_awarded between 0 and 13),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, match_id),
  check ((pred_home_goals is null) = (pred_away_goals is null)),
  -- An exact score, when given, must agree with the picked outcome.
  check (
    pred_home_goals is null
    or (outcome = 'home' and pred_home_goals > pred_away_goals)
    or (outcome = 'draw' and pred_home_goals = pred_away_goals)
    or (outcome = 'away' and pred_home_goals < pred_away_goals)
  )
);
create index picks_match_idx on public.picks (match_id);

create table public.email_sends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  matchday_id uuid not null references public.matchdays (id) on delete cascade,
  status public.email_send_status not null default 'queued',
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Never send twice to one user for one matchday.
  unique (user_id, matchday_id)
);
create index email_sends_matchday_status_idx on public.email_sends (matchday_id, status);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in ('insert', 'update', 'delete')),
  entity text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);

create table public.site_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Launch defaults: everything that earns money is switched off.
insert into public.site_settings (key, value) values
  ('ads_enabled', 'false'::jsonb),
  ('sponsor_slots', '[]'::jsonb),
  ('site_name', 'null'::jsonb); -- null = use the SITE_NAME config value
