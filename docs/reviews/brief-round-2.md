# Independent review: Photo Quest

You are an independent reviewer of the repository in the current folder. Work read-only: don't edit, create or delete files in it, and don't run commands that change anything. Don't ask questions interactively; if something is unclear, say so in your answer.

## What it is
Photo Quest is a phone web app for one church outing's photo challenges. Groups send photos for challenges, a committee judges them and enters station game scores, and everyone follows a live scoreboard and gallery. It ran once, on Sat 14 Nov 2026, for about 30 people in 5 groups, and isn't maintained as a product. It was built in about six days by one developer steering AI agents, who wrote almost all the code. The developer chose the architecture, from earlier projects. Nuxt 4 single-page app on one Cloudflare Worker, D1 (SQLite via Drizzle), R2 for photos with signed links.

Judge it against that scope: one morning, about 30 people, low stakes, built in six days. Don't mark it down for things a one-off event doesn't need. Do mark it down for things it needs that are missing or wrong, and for anything that would hurt someone reusing it for their own event, which the README invites.

## Disclosure
The same model families as the reviewers (Claude Opus 5.5 and GPT-6.1 Sol through Codex) wrote this code and reviewed each pull request, and its screens were tuned against their scores. Be sceptical of anything that looks tuned to please a reviewer rather than to serve the outing.

## Evidence you have
- The repository in the current folder: the public copy at commit 9416f8d. Start with README.md, AGENTS.md and docs/.
- evidence/check-all.log: the full output of the steps `pnpm check:all` runs, on this exact copy (typecheck, 116 unit tests, a production build, a fresh local database, then scripts/api-check.ts against a dev server on port 3003, since port 3000 was taken). It passed.
- evidence/usage-on-the-day.md: what was actually used on the day.
- docs/screens/*.jpg: every screen at 390 by 844, taken from the public demo, with docs/screens.html. The demo itself is https://photo-scavenger-hunt.samyipsh-work.workers.dev, if you can reach it.

## Categories
Score each 1 to 10, or write "not assessed" if you couldn't check it properly.

1. **Scope fit.** What the outing needed, and nothing more. Check docs/app-plan.md against app/pages/ and the usage on the day.
2. **Phone UX and accessibility.** Usable one-handed outdoors, and with a screen reader. Check the screenshots, docs/ux/flows.md, and the components for labels, text size, tap target size, focus and Back handling.
3. **Reliability and tests.** Uploads survive bad signal, retries are safe, two committee members acting at once don't clash, and the tests would catch a break. Check app/composables/useUploadQueue.ts, the start and finish routes under server/api/g/, tests/, scripts/api-check.ts and the check log.
4. **Security and privacy.** Holds to its own stated threat model. Check the security section of docs/app-plan.md, server/utils/auth.ts, storage.ts, viewLinks.ts, limits.ts, devices.ts, what gets logged, and photo location data.
5. **Performance and cost.** Fast on 4G, cheap to run. Check docs/caching.md, server/utils/etag.ts and scoreboard.ts, photo sizes, and database calls per request.
6. **Running it on the day.** The committee can spot and fix trouble during the event. Check the committee pages, Controls, hiding and blocking, and the scripts and docs for watching the live app.
7. **Maintainability.** A small change stays small, for a person or an agent. Pick one realistic change, such as adding a station or a new kind of challenge, and trace every file it touches. Check AGENTS.md, structure and naming.
8. **Docs and honesty.** The docs match the code, and the claims in README.md and docs/how-it-was-built.md hold up. Check at least eight specific claims against the code and list any that are false or overstated.
9. **AI slop.** Slop means dead code, the same logic written twice, layers or abstractions the app doesn't need, comments that repeat the code, defensive code for cases that can't happen, and size out of proportion to the scope. 10 means none found. Check unused exports, near-duplicate code, and the largest files and whether their size is earned.

## Scale, for every category
- 1: broken or harmful.
- 5: works, but with problems a careful reviewer would block on.
- 8: good, with a few real issues.
- 10: hard to improve for this scope.

## Rules
- Every score cites evidence: a file and line, a command and its output, or a line of the check log. A score you can't back with evidence is "not assessed".
- Be specific and blunt. Don't pad with praise. Don't fix anything.
- Ignore node_modules, .nuxt, .output, .wrangler and .data.

## Output
Markdown, at most 1,400 words, in this order:

## Scores
A table: Category | Score | Reason, in one sentence.

## Evidence
For each category, 2 to 4 bullets citing file:line, command output or the log.

## Biggest problems
The five most serious, worst first, each with the smallest fix.

## Low-hanging fruit
Up to eight small changes, each under an hour for an agent, that would raise a score. Name the file and the category.

## What you couldn't check
