-- Whether a match's kick-off time is the real one, or a placeholder because
-- no time has been announced (or the source file had dates only). The app
-- shows the date alone for past matches and "Time TBC" for upcoming ones.
alter table public.matches
  add column kickoff_time_confirmed boolean not null default true;

-- Every match loaded so far came from files with dates but no times.
update public.matches set kickoff_time_confirmed = false;
