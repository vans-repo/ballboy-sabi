# Scope: "Help me pick" (planned, not built)

**Goal.** Help fans who don't know the NPFL make their own picks, without
handing out answers.

**Why it can't become free picks.** Points ≈ 1 ÷ chance, so every option is
worth about the same on average (65% × 2 ≈ 26% × 4 ≈ 9% × 10 ≈ 1 point).
There is no "right" pick to give away, only a choice of how much risk to
take. The Ballboy's own picks stay hidden until kick-off, and copying the
likeliest outcome only scores about what The Ballboy scores.

## What it adds

1. **"Help me pick" panel** on each match page and in Pick all. For Home,
   Draw and Away: the chance, the points if right, and a plain label:
   **Safer** (50% or more), **Balanced** (25–50%), **Bold** (under 25%).
   Also two or three short facts per team, from the reasons and form the
   model already produces.
2. **Style presets in Pick all:** *Play it safe*, *Balanced*, *Go for
   upsets*. The sheet highlights the option that fits the chosen style on
   each match, and the fan taps to confirm every pick. Nothing is saved
   automatically.
3. **Beginner's guide page:** what the percentages mean, how points work,
   why always picking home can't win, and a short introduction to each team.

## Guardrails

- No betting words: never "tip", "banker", "sure", "recommended" or "the pick".
- No option is ever marked as the answer.
- A preset never submits a pick by itself.

## Build size

About one stage. Existing data only (no model or database changes). One
small client component, within the JavaScript budget. Tests: presets never
save without a tap, the labels follow the thresholds, and none of the banned
words appear.

## Open questions

- Do the Safer / Balanced / Bold thresholds feel right?
- Do guests see presets, or only signed-in fans?
- Show fans how their chosen style has done over time?
