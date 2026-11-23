-- Follow-up to 2026-27-clubs.sql (run this one too if you already ran that):
-- the owner's corrections to nine clubs' colours, and new short names for
-- every team (first three letters; RBE for Ranchers Bees because Enugu
-- Rangers keep RAN; exceptions 3SC, AWA, RAN). Safe to run more than once.

begin;
-- Codes may now contain digits (3SC). Same as migration 20261123000200.
alter table public.teams drop constraint if exists teams_code_check;
alter table public.teams add constraint teams_code_check check (code ~ '^[A-Z0-9]{3}$');
-- Codes are unique: park every team on a temporary code first.
update public.teams t set code = lpad(n::text, 3, '9') from (select id, row_number() over (order by name) n from public.teams) x where x.id = t.id;
update public.teams set code = 'AWA' where slug = 'abia-warriors';
update public.teams set code = 'AKW' where slug = 'akwa-united';
update public.teams set code = 'BAR' where slug = 'barau';
update public.teams set code = 'BAY' where slug = 'bayelsa-united';
update public.teams set code = 'BEN' where slug = 'bendel-insurance';
update public.teams set code = 'DAK' where slug = 'dakkada';
update public.teams set code = 'DOM' where slug = 'doma-united';
update public.teams set code = 'ELK' where slug = 'el-kanemi-warriors';
update public.teams set code = 'RAN' where slug = 'enugu-rangers';
update public.teams set code = 'ENY' where slug = 'enyimba';
update public.teams set code = 'GOM' where slug = 'gombe-united';
update public.teams set code = 'HEA' where slug = 'heartland';
update public.teams set code = 'IKO' where slug = 'ikorodu-city';
update public.teams set code = 'INT' where slug = 'inter-lagos';
update public.teams set code = 'KAN' where slug = 'kano-pillars';
update public.teams set code = 'KAT' where slug = 'katsina-united';
update public.teams set code = 'KUN' where slug = 'kun-khalifat';
update public.teams set code = 'KWA' where slug = 'kwara-united';
update public.teams set code = 'LOB' where slug = 'lobi-stars';
update public.teams set code = 'MFM' where slug = 'mfm';
update public.teams set code = 'NAS' where slug = 'nasarawa-united';
update public.teams set code = 'NIG' where slug = 'niger-tornadoes';
update public.teams set code = 'PLA' where slug = 'plateau-united';
update public.teams set code = 'RBE' where slug = 'ranchers-bees';
update public.teams set code = 'REM' where slug = 'remo-stars';
update public.teams set code = 'RIV' where slug = 'rivers-united';
update public.teams set code = '3SC' where slug = 'shooting-stars';
update public.teams set code = 'SPO' where slug = 'sporting-lagos';
update public.teams set code = 'SUN' where slug = 'sunshine-stars';
update public.teams set code = 'WAR' where slug = 'warri-wolves';
update public.teams set code = 'WIK' where slug = 'wikki-tourists';
update public.teams set primary_colour = '#E4479C', secondary_colour = '#0E1640' where slug = 'inter-lagos';
update public.teams set primary_colour = '#9C1B1B', secondary_colour = '#F2C230' where slug = 'ikorodu-city';
update public.teams set primary_colour = '#E6DFA3', secondary_colour = '#2E6B2A' where slug = 'nasarawa-united';
update public.teams set primary_colour = '#2F6DB8', secondary_colour = '#FFFFFF' where slug = 'niger-tornadoes';
update public.teams set primary_colour = '#2B47C4', secondary_colour = '#FFFFFF' where slug = 'sporting-lagos';
update public.teams set primary_colour = '#F2D21B', secondary_colour = '#0B5A2A' where slug = 'kano-pillars';
update public.teams set primary_colour = '#F2D21B', secondary_colour = '#17602A' where slug = 'katsina-united';
update public.teams set primary_colour = '#F3D21A', secondary_colour = '#1B5E2E' where slug = 'plateau-united';
update public.teams set primary_colour = '#F2C21E', secondary_colour = '#1E5A2B' where slug = 'kwara-united';
update public.teams set primary_colour = '#F4C430', secondary_colour = '#14612F' where slug = 'bendel-insurance';
commit;
