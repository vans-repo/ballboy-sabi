-- Fixes suggested by the scheduled NPFL data check (a Claude run that
-- compares the site with published results, fixtures, standings and
-- deductions). The check only suggests: an admin applies or dismisses each
-- one in /admin → Data check, and applying goes through the same admin
-- actions as typing it in by hand.

create table public.data_suggestions (
  id uuid primary key default gen_random_uuid(),
  check_date date not null,
  kind text not null check (kind in ('result', 'postponed', 'kickoff', 'deduction')),
  match_id uuid references public.matches (id) on delete cascade,
  team_id uuid references public.teams (id) on delete cascade,
  -- result: {home_goals, away_goals}; postponed: {date, time}; kickoff:
  -- {date, time}; deduction: {points, reason}. Dates YYYY-MM-DD, times HH:MM (Lagos).
  payload jsonb not null,
  summary text not null check (length(summary) between 1 and 500),
  source_url text check (source_url is null or source_url ~ '^https://'),
  confidence text not null default 'confirmed' check (confidence in ('confirmed', 'unconfirmed')),
  status text not null default 'pending' check (status in ('pending', 'applied', 'dismissed')),
  decided_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((kind = 'deduction') = (team_id is not null and match_id is null)),
  check ((kind <> 'deduction') = (match_id is not null))
);
create index data_suggestions_pending_idx on public.data_suggestions (created_at desc)
  where status = 'pending';

-- Admins read and decide; the API route inserts with the service role.
alter table public.data_suggestions enable row level security;
revoke all on public.data_suggestions from anon, authenticated;
grant all on public.data_suggestions to service_role;
grant select, update on public.data_suggestions to authenticated;
create policy "data_suggestions: admins read" on public.data_suggestions
  for select to authenticated using ((select public.is_admin()));
create policy "data_suggestions: admins decide" on public.data_suggestions
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
