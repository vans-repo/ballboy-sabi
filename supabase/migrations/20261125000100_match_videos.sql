-- A YouTube link per match (the official livestream, highlights or full
-- replay), set by an admin or suggested by the data check. Only YouTube
-- links are accepted; the app also checks the channel is an official one.
alter table public.matches
  add column video_url text
    check (video_url is null or video_url ~ '^https://(www\.|m\.)?(youtube\.com|youtu\.be)/'),
  add column video_label text
    check (video_label is null or video_label in ('live', 'highlights', 'replay'));

-- The data check can now suggest a video for a match.
alter table public.data_suggestions drop constraint if exists data_suggestions_kind_check;
alter table public.data_suggestions
  add constraint data_suggestions_kind_check
  check (kind in ('result', 'postponed', 'kickoff', 'deduction', 'video'));
