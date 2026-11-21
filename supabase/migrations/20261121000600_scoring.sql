-- Beat the Ballboy scoring, the leaderboard and the fan split.
--
-- Points for a correct outcome = round(1 / frozen probability of that
-- outcome), at least 1 and at most 10. Exact score: +3 when the outcome is
-- also correct. Wrong or no pick: 0. Abandoned or cancelled: picks are void
-- (points_awarded null). The frozen prediction is the latest one created
-- before the match's kick-off, so a postponed match uses the prediction
-- frozen at its new kick-off.

-- ---------------------------------------------------------------------------
-- Points value of an outcome with probability p.
-- ---------------------------------------------------------------------------
create function public.pick_points(p numeric)
returns smallint
language sql
immutable
set search_path = ''
as $$
  select case
    when p is null then null
    when p <= 0 then 10
    else least(10, greatest(1, round(1 / p)))::smallint
  end;
$$;

-- ---------------------------------------------------------------------------
-- Score every pick for one match. Safe to run any number of times: a
-- corrected result simply rescores.
-- ---------------------------------------------------------------------------
create function public.score_match(p_match_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.matches;
  fp record;
  result public.pick_outcome;
  n integer;
begin
  select * into m from public.matches where id = p_match_id;
  if not found then
    return 0;
  end if;

  -- Frozen prediction: the latest created before kick-off.
  select p.p_home, p.p_draw, p.p_away into fp
  from public.predictions p
  where p.match_id = m.id and p.created_at < m.kickoff_at
  order by p.created_at desc, p.id desc
  limit 1;

  if m.status in ('played', 'awarded') and m.home_goals is not null then
    result := case
      when m.home_goals > m.away_goals then 'home'
      when m.home_goals = m.away_goals then 'draw'
      else 'away'
    end::public.pick_outcome;

    update public.picks k set
      points_if_correct = case
        when fp is null then 1 -- no prediction was published before kick-off
        else public.pick_points(case k.outcome
          when 'home' then fp.p_home when 'draw' then fp.p_draw else fp.p_away end)
      end,
      points_awarded = case
        when k.outcome <> result then 0
        else coalesce(public.pick_points(case k.outcome
               when 'home' then fp.p_home when 'draw' then fp.p_draw else fp.p_away end), 1)
             + case when k.pred_home_goals = m.home_goals and k.pred_away_goals = m.away_goals
                    then 3 else 0 end
      end
    where k.match_id = m.id;
  elsif m.status in ('abandoned', 'cancelled') then
    -- Void: no points either way.
    update public.picks set points_if_correct = null, points_awarded = null
    where match_id = m.id;
  else
    -- Scheduled or postponed (for example a result undone): nothing scored yet.
    update public.picks set points_if_correct = null, points_awarded = null
    where match_id = m.id and (points_awarded is not null or points_if_correct is not null);
  end if;

  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.score_match(uuid) from public, anon, authenticated;
grant execute on function public.score_match(uuid) to service_role;

-- Rescore every match that has picks (after a bulk correction, say).
create function public.rescore_all()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  total integer := 0;
  mid uuid;
begin
  for mid in select distinct match_id from public.picks loop
    total := total + public.score_match(mid);
  end loop;
  return total;
end;
$$;
revoke execute on function public.rescore_all() from public, anon, authenticated;
grant execute on function public.rescore_all() to service_role;

-- Score as soon as a result is saved, corrected or undone, or a kick-off moves.
create function public.matches_after_result()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.score_match(new.id);
  return null;
end;
$$;

create trigger matches_after_result
  after update of status, home_goals, away_goals, kickoff_at on public.matches
  for each row
  when (
    old.status is distinct from new.status
    or old.home_goals is distinct from new.home_goals
    or old.away_goals is distinct from new.away_goals
    or old.kickoff_at is distinct from new.kickoff_at
  )
  execute function public.matches_after_result();

-- ---------------------------------------------------------------------------
-- Leaderboard. p_scope: 'matchday' (p_id = matchday id), 'season'
-- (p_id = season id) or 'all'. Counts scored picks only. Ties: more exact
-- scores, then more correct away picks, then the earlier sign-up.
-- Banned users are left out (public_profiles hides them). The Ballboy is
-- always included, so its row can be pinned even before it scores.
-- ---------------------------------------------------------------------------
create function public.leaderboard(p_scope text, p_id uuid default null)
returns table (
  rank integer,
  user_id uuid,
  display_name text,
  is_ballboy boolean,
  points integer,
  correct integer,
  exact integer,
  correct_away integer,
  joined_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with scored as (
    select k.user_id,
           k.points_awarded,
           k.points_awarded > 0 as is_correct,
           k.points_awarded > 0 and k.points_awarded = k.points_if_correct + 3 as is_exact,
           k.points_awarded > 0 and k.outcome = 'away' as is_away
    from public.picks k
    join public.matches m on m.id = k.match_id
    where k.points_awarded is not null
      and case p_scope
            when 'matchday' then m.matchday_id = p_id
            when 'season' then m.season_id = p_id
            when 'all' then true
            else false
          end
  ),
  totals as (
    select user_id,
           sum(points_awarded)::integer as points,
           count(*) filter (where is_correct)::integer as correct,
           count(*) filter (where is_exact)::integer as exact,
           count(*) filter (where is_away)::integer as correct_away
    from scored
    group by user_id
  )
  select row_number() over (
           order by coalesce(t.points, 0) desc, coalesce(t.exact, 0) desc,
                    coalesce(t.correct_away, 0) desc, p.created_at, p.id
         )::integer,
         p.id, p.display_name, p.role = 'system',
         coalesce(t.points, 0), coalesce(t.correct, 0), coalesce(t.exact, 0),
         coalesce(t.correct_away, 0), p.created_at
  from public.public_profiles p
  left join totals t on t.user_id = p.id
  where t.user_id is not null or p.role = 'system';
$$;
grant execute on function public.leaderboard(text, uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Fan split for one match: how many fans picked each outcome. Only after
-- kick-off (before that, other fans' picks are private). The Ballboy is
-- not counted.
-- ---------------------------------------------------------------------------
create function public.fan_split(p_match_id uuid)
returns table (home integer, draw integer, away integer)
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) filter (where k.outcome = 'home')::integer,
         count(*) filter (where k.outcome = 'draw')::integer,
         count(*) filter (where k.outcome = 'away')::integer
  from public.picks k
  join public.matches m on m.id = k.match_id
  join public.profiles p on p.id = k.user_id
  where k.match_id = p_match_id
    and m.kickoff_at <= now()
    and p.role <> 'system'
    and not p.banned;
$$;
grant execute on function public.fan_split(uuid) to anon, authenticated, service_role;
