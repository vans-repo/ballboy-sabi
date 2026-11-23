-- Short names follow the owner's rule: the first three letters of the name;
-- where two clubs share them, the first letter of the first word and the
-- first two of the second. Exceptions: Shooting Stars 3SC, Abia Warriors
-- AWA, Enugu Rangers RAN. "3SC" has a digit, so codes may now use digits.
alter table public.teams drop constraint if exists teams_code_check;
alter table public.teams add constraint teams_code_check check (code ~ '^[A-Z0-9]{3}$');
