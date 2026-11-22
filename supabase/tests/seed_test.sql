-- Checks run by run_seed_test.sh after the seed has loaded a fresh database.
\set ON_ERROR_STOP on
do $$
declare
  n int;
  fails text[] := '{}';
begin
  -- Five seasons of history plus 2026/27 (TEST sample fixtures: 4 matches).
  select count(*) into n from (
    select s.label, count(m.id) as matches from public.seasons s
    left join public.matches m on m.season_id = s.id group by s.label
    except
    select * from (values ('2021/22', 380::bigint), ('2022/23', 180), ('2023/24', 380),
                          ('2024/25', 380), ('2025/26', 376), ('2026/27', 4)) v
  ) wrong;
  if n <> 0 then fails := fails || format('%s seasons with the wrong match count', n); end if;
  select count(*) into n from public.seasons;
  if n <> 6 then fails := fails || format('%s seasons', n); end if;
  select count(*) into n from public.seasons where is_current;
  if n <> 1 or not (select is_current from public.seasons where label = '2026/27') then
    fails := fails || 'current season is not 2026/27'::text; end if;

  -- Every season has 20 teams, except the 4-match test sample.
  select count(*) into n from (
    select season_id from public.season_teams group by season_id having count(*) <> 20) x;
  if n <> 1 then fails := fails || format('%s seasons without 20 teams', n); end if;
  select count(distinct group_name) into n from public.season_teams st
    join public.seasons s on s.id = st.season_id where s.label = '2022/23';
  if n <> 2 then fails := fails || '2022/23 should have 2 groups'::text; end if;

  -- Estimated dates: the two undated seasons plus 9 matches only in the undated file.
  select count(*) into n from public.matches where kickoff_estimated;
  if n <> 380 + 180 + 9 then fails := fails || format('%s estimated kick-offs', n); end if;
  select count(*) into n from public.matches m join public.seasons s on s.id = m.season_id
    where s.label in ('2021/22', '2022/23') and m.source_order is null;
  if n <> 0 then fails := fails || 'undated matches without source_order'::text; end if;

  -- 2026/27 sample: one played, three scheduled, two matchdays.
  select count(*) into n from public.matches m join public.seasons s on s.id = m.season_id
    where s.label = '2026/27' and m.status = 'played' and m.home_goals = 2 and m.away_goals = 1;
  if n <> 1 then fails := fails || '2026/27 played result missing'::text; end if;
  select count(*) into n from public.matchdays;
  if n <> 2 then fails := fails || format('%s matchdays', n); end if;
  select count(*) into n from public.matches where matchday_id is not null;
  if n <> 4 then fails := fails || format('%s matches with a matchday', n); end if;

  -- Names: 31 teams, Doma United once, aliases present.
  select count(*) into n from public.teams;
  if n <> 31 then fails := fails || format('%s teams', n); end if;
  select count(*) into n from public.team_aliases a join public.teams t on t.id = a.team_id
    where t.name = 'Doma United' and a.alias in ('doma united', 'doma united fc', 'doma fc');
  if n <> 3 then fails := fails || 'Doma United aliases'::text; end if;

  -- The Ballboy and the admin.
  select count(*) into n from public.profiles where role = 'system' and display_name = 'The Ballboy';
  if n <> 1 then fails := fails || 'The Ballboy profile'::text; end if;
  select count(*) into n from public.profiles p join auth.users u on u.id = p.id
    where p.role = 'admin' and u.email = 'owner@example.com';
  if n <> 1 then fails := fails || 'admin not promoted'::text; end if;

  -- The league table view works on the loaded data.
  select count(*) into n from public.league_table lt join public.seasons s on s.id = lt.season_id
    where s.label = '2025/26';
  if n <> 20 then fails := fails || format('league table 2025/26 has %s rows', n); end if;

  if array_length(fails, 1) > 0 then
    raise exception 'Seed checks failed: %', array_to_string(fails, '; ');
  end if;
  raise warning 'All seed checks passed';
end;
$$;
