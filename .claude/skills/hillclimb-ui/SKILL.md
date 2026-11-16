---
name: hillclimb-ui
description: Use when the user asks to hillclimb ui, or polish ui
---
# Hill climb UI
1. Propose and confirm with the user which UI elements or UX flows, screens or facets, and the target score. Follow `hillclimb` for triage and when to stop, and `mobile-ux` for what good looks like.
2. Take "before" screenshots of that scope yourself, open states included, and keep them outside the repo (here: `pnpm db:reset:local && node scripts/demo-data.ts` with the dev server running; `?at=2026-11-14T10:12` fakes the time of day).
3. Council: give Opus and Codex the same read-only brief: the scope, the screenshots (both before and after if present), `docs/ux/flows.md` and the code. Each scores out of 10, overall and per category, and lists findings with fixes. Don't tell them the target.
4. Summarise the council in one table: findings, agreements, disagreements. Accept with discernment, reject with a reason, and ask the user when unsure.
5. Make the accepted changes, take "after" screenshots, and repeat from step 3 until every reviewer meets the target. Track the scores by round. If hillclimb appears to be resulting in worse quality pause hillclimb, notify user, and propose how to adjust hillclimb criteria to get desired effect.
6. Report the score table, what changed, and what was rejected and why.
