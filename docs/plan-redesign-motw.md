# Plan: redesign, Match of the Week, crests and logo

Agreed with the owner on 23 Nov 2026. Mock-ups are on the design canvas
(https://claude.ai/artifact/7jU5UnDB3QMgV6qeHoCYxm). Build after the owner
approves the mock-ups.

## 1. Redesign

- Phone: matchday banner with Adire-style pattern, Match of the Week card,
  scoreboard-style fixture cards, mini table with zone bars, Substack card,
  bottom tabs with icons.
- Match page: poster header (overlapping team codes on team colours),
  big home/draw/away split, comparison bars, likely scores, the three
  reasons, pick panel, share buttons (X, WhatsApp, save poster).
- Desktop: left sidebar menu, content in cards; one column at phone width.

## 2. Match of the Week

- Auto-pick: the Upset Alert match in the current matchday with the highest
  away-win chance. If no match has an Upset Alert, the closest match
  (smallest gap between home and away chances).
- Admin override: pick any match in the matchday, or clear the override.
- Images (next/og):
  - Portrait poster 1080×1350 for "Save image" (Instagram, WhatsApp, X).
  - Landscape card 1200×630 used as the link preview on X.
- "Post on X": an X intent link with text and the match link filled in.
  One click, no paid X API. Auto-posting is out of scope.
- Share images use team colours and three-letter codes only, never crests,
  so nothing trademarked travels on X under @NaijaBallboy.

## 3. Club crests (on the site only)

- Admin uploads a crest per team (Supabase Storage, public bucket).
- On upload, the site suggests the crest's main colours as the team's
  primary and secondary colours; the admin confirms or edits.
  White, black and near-grey are skipped as suggestions.
- Crests replace the coloured initials badge wherever a crest exists.
- Admin switch "Show crests" (site-wide) hides every crest at once, for a
  quick takedown if a club or the league asks.
- Footer line: "Not affiliated with the NPFL or any club."

## 4. Images

- No photos for now: graphics only.
- Later, if wanted: embedded X posts, or photos with written permission.

## 5. Logo (That Naija Ballboy, "TNB.")

- Files: `web/public/brand/tnb-logo-transparent.png` (yellow on transparent)
  and `web/public/brand/tnb-logo-navy.jpg` (on navy).
- Header (phone and desktop sidebar), footer, share images, and the
  favicon / app icon (from the navy version).
- Logo colours: yellow #FED700, navy #001F55. The site's palette is
  gold #F5C842 on navy #000E2E. Owner to decide whether the site
  should switch to the logo's colours.
- A vector (SVG) version would be sharper on large images; ask the owner.
