-- 2026/27 clubs: colours (from this season's kits and crests), cities and
-- crests. Proposed from images the owner supplied; check them in /admin →
-- Teams & Seasons and adjust any that look wrong.
-- Run in Supabase → SQL Editor AFTER the crests migration
-- (20261123000100_crests_and_settings.sql) and after the site is deployed,
-- because the crest images are served from the site (web/public/crests).
-- Crests are about 65 px: fine at badge size; replace with sharper ones
-- (256 px or more, transparent PNG) through /admin when you have them.

begin;
update public.teams set primary_colour = '#C8102E', secondary_colour = '#FFFFFF', city = 'Umuahia',
  crest_url = 'https://ballboy-sabi.vercel.app/crests/abia-warriors.png'
  where slug = 'abia-warriors';
update public.teams set primary_colour = '#1B3A8C', secondary_colour = '#FFFFFF', city = 'Kano',
  crest_url = 'https://ballboy-sabi.vercel.app/crests/barau.png'
  where slug = 'barau';
update public.teams set primary_colour = '#E4B321', secondary_colour = '#14361F', city = 'Benin City',
  crest_url = 'https://ballboy-sabi.vercel.app/crests/bendel-insurance.png'
  where slug = 'bendel-insurance';
update public.teams set primary_colour = '#2B4C9B', secondary_colour = '#FFFFFF', city = 'Gombe',
  crest_url = 'https://ballboy-sabi.vercel.app/crests/doma-united.png'
  where slug = 'doma-united';
update public.teams set primary_colour = '#C8102E', secondary_colour = '#FFFFFF', city = 'Enugu',
  crest_url = 'https://ballboy-sabi.vercel.app/crests/enugu-rangers.png'
  where slug = 'enugu-rangers';
update public.teams set primary_colour = '#1F45C2', secondary_colour = '#FFFFFF', city = 'Aba',
  crest_url = 'https://ballboy-sabi.vercel.app/crests/enyimba.png'
  where slug = 'enyimba';
update public.teams set primary_colour = '#A3262A', secondary_colour = '#FFFFFF', city = 'Lagos',
  crest_url = 'https://ballboy-sabi.vercel.app/crests/ikorodu-city.png'
  where slug = 'ikorodu-city';
update public.teams set primary_colour = '#2C1745', secondary_colour = '#F06AAE', city = 'Lagos',
  crest_url = 'https://ballboy-sabi.vercel.app/crests/inter-lagos.png'
  where slug = 'inter-lagos';
update public.teams set primary_colour = '#0F7A3A', secondary_colour = '#FFFFFF', city = 'Kano',
  crest_url = 'https://ballboy-sabi.vercel.app/crests/kano-pillars.png'
  where slug = 'kano-pillars';
update public.teams set primary_colour = '#1F6F2B', secondary_colour = '#FFFFFF', city = 'Katsina',
  crest_url = 'https://ballboy-sabi.vercel.app/crests/katsina-united.png'
  where slug = 'katsina-united';
update public.teams set primary_colour = '#A4121C', secondary_colour = '#FFFFFF', city = 'Owerri',
  crest_url = 'https://ballboy-sabi.vercel.app/crests/kun-khalifat.png'
  where slug = 'kun-khalifat';
update public.teams set primary_colour = '#E8A21F', secondary_colour = '#102F17', city = 'Ilorin',
  crest_url = 'https://ballboy-sabi.vercel.app/crests/kwara-united.png'
  where slug = 'kwara-united';
update public.teams set primary_colour = '#2E7D4F', secondary_colour = '#FFFFFF', city = 'Lafia',
  crest_url = 'https://ballboy-sabi.vercel.app/crests/nasarawa-united.png'
  where slug = 'nasarawa-united';
update public.teams set primary_colour = '#C0101A', secondary_colour = '#FFFFFF', city = 'Minna',
  crest_url = 'https://ballboy-sabi.vercel.app/crests/niger-tornadoes.png'
  where slug = 'niger-tornadoes';
update public.teams set primary_colour = '#F3D21A', secondary_colour = '#1B5E2E', city = 'Jos',
  crest_url = 'https://ballboy-sabi.vercel.app/crests/plateau-united.png'
  where slug = 'plateau-united';
update public.teams set primary_colour = '#151515', secondary_colour = '#E0B22B', city = 'Kaduna',
  crest_url = 'https://ballboy-sabi.vercel.app/crests/ranchers-bees.png'
  where slug = 'ranchers-bees';
update public.teams set primary_colour = '#12309A', secondary_colour = '#FFFFFF', city = 'Port Harcourt',
  crest_url = 'https://ballboy-sabi.vercel.app/crests/rivers-united.png'
  where slug = 'rivers-united';
update public.teams set primary_colour = '#0A4BD0', secondary_colour = '#FFFFFF', city = 'Ibadan',
  crest_url = 'https://ballboy-sabi.vercel.app/crests/shooting-stars.png'
  where slug = 'shooting-stars';
update public.teams set primary_colour = '#0E2263', secondary_colour = '#8CC2F0', city = 'Lagos',
  crest_url = 'https://ballboy-sabi.vercel.app/crests/sporting-lagos.png'
  where slug = 'sporting-lagos';
update public.teams set primary_colour = '#F2D22A', secondary_colour = '#1C3F94', city = 'Warri',
  crest_url = 'https://ballboy-sabi.vercel.app/crests/warri-wolves.png'
  where slug = 'warri-wolves';
commit;
