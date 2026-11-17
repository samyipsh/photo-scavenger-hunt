# Independent reviews

Two reviewers from different companies scored this repo, each in a fresh, read-only session, against one frozen brief:

- **Claude Opus 5.5** (Anthropic), through Claude Code 2.1.316 at extra-high effort
- **GPT-6.1 Sol** (OpenAI), through the Codex CLI 0.166.0-alpha.6 at extra-high effort

Each ran twice per round, and both runs are shown, not averaged.

**Disclosure.** The same two model families wrote this code and reviewed its pull requests, and its screens were tuned against their scores. Read the scores with that in mind.

## How

- **The brief:** `brief-round-1.md` and `brief-round-2.md`. They're the same apart from the commit and how the check log was made. Nine categories, a 1 to 10 scale with anchors (1 broken, 5 works but a careful reviewer would block it, 8 good with a few real issues, 10 hard to improve for this scope), and evidence for every score: a file and line, a command's output or a log line, or "not assessed".
- **The evidence** each round had: the output of the full check suite on that exact copy, and what was used on the day (`evidence-round-1/`, `evidence-round-2/`; the briefs call this folder `evidence/`).
- **Round 1:** commit 51642cb, 16 Nov 2026. The first two Codex runs got stuck waiting for input (a mistake in how they were started) and wrote nothing; the reruns, with the same brief, are the ones here.
- **Round 2:** commit 9416f8d, the same day, after the six fixes below. Port 3000 was taken, so its check log runs the same steps as `pnpm check:all` by hand on port 3003.
- Both commits were in this repo while it was private. The public history starts from one commit that holds round 2's code, the fixes listed below, and this folder.
- The raw reviews in `round-1/` and `round-2/` are unedited, except that local file paths are replaced with `<local path>`.
- `.claude/skills/repo-review` is this method as a skill, with a blank brief, for running it again here or on another repo.

## Scores

Two runs each, in the order they were run. Higher is better in every row. The briefs call the last category "AI slop", where 10 means none was found.

| Category | Claude, round 1 | Codex, round 1 | Claude, round 2 | Codex, round 2 |
| --- | --- | --- | --- | --- |
| Scope fit | 6, 6 | 8, 9 | 6, 6 | 9, 9 |
| Phone UX and accessibility | 8, 8 | 7, 8 | 8, 8 | 7, 7 |
| Reliability and tests | 7, 7 | 7, 8 | 7, 7 | 7, 7 |
| Security and privacy | 8, 7 | 7, 7 | 6, 8 | 8, 8 |
| Performance and cost | 7, 7 | 8, 8 | 7, 7 | 8, 8 |
| Running it on the day | 8, 7 | 7, 8 | 7, 8 | 8, 8 |
| Maintainability | 6, 6 | 7, 7 | 7, 6 | 7, 8 |
| Docs and honesty | 7, 6 | 8, 7 | 7, 7 | 8, 8 |
| Cleared of AI slop | 5, 5 | 7, 7 | 5, 5 | 8, 8 |

Where they differ by 2 or more in round 2, both sides' reasons:

- **Scope fit (Claude 6, Codex 9).** Claude: crop and rotate, saving many photos to a phone and three kinds of draft "go well past one morning's needs". Codex: "Actual usage covers the core workflows, and anonymous groups suit this outing."
- **Cleared of AI slop (Claude 5, Codex 8).** Claude: "11,500 lines of screens, code for data that only existed mid-build, and comments that narrate the code". Codex: "Some leftovers and duplication remain, but much of the larger components serves real phone behaviour."
- **Security and privacy (Claude's first run 6, the rest 8).** Its two reasons were the session secret (wrong, see below) and a race in the sign-in lockout (right, fixed after round 2).

## What changed between rounds

Fixed after round 1, in this order:

1. Using an untagged photo for a challenge (`/claim`) now checks it's the phone that sent it, not just the group. The committee can still move any photo.
2. The time zone and the emergency number moved from the engine into `data/event.ts`.
3. Dead upload-queue code (retarget and hold) was deleted.
4. Docs that overreached were corrected: what the group page signs, how much setup a deploy needs, the line count, a note to plan on Workers Paid, and a stale pointer in `AGENTS.md`.
5. The sign-in lockout counts misses in one database statement.
6. One helper names photos everywhere (it had six copies, two of which disagreed), with one animal match and one capitalise.

Fixed after round 2, not reviewed again:

- The sign-in lockout counts each try before it compares the passphrase. Round 2 showed that guesses sent at the same moment could all pass the check first. Now, of 20 wrong guesses sent at once, 8 are compared and 12 refused.
- Moving a photo to the challenge it's already in changes nothing, so a sender can't reset a judge's verdict that way.
- In demo mode, the committee's single-photo route now keeps visitors' photos private too, like every list already did.

## Where a reviewer got it wrong

- Claude's first round 2 run says nothing reads `NUXT_APP_SECRET`, and that sessions are sealed with `NUXT_SESSION_PASSWORD`. In nuxt-auth-utils 0.6.0, the version used here, it's the other way round: the module warns that `NUXT_SESSION_PASSWORD` is no longer used and to set `NUXT_APP_SECRET` (`node_modules/nuxt-auth-utils/dist/module.mjs`). Claude's first round 1 run checked the same file and agreed.

## Known and left as is

Raised by the reviewers and not fixed, as more than this one-morning app needs or a bigger change than a quick fix:

- The gallery's 30-second check reads every photo row before its ETag can answer 304. That's fine on Workers Paid, tight on the free plan at around 50 people (`docs/caching.md`).
- The phone's upload and score queues have no tests, and CI exercises the dev stand-in for R2, not R2's own code path.
- Cropping needs a pointer or a finger; the crop handles don't work from a keyboard.
- Photos whose files failed to delete are retried from the Hidden photos page only while it stays open.
- The upload queue stores photos as `File` objects, which Safari's IndexedDB can drop; drafts already store bytes.
- The largest screens (gallery, photo viewer, judge, group page) run to about 900 to 1,000 lines each, and judging is wired up in both the judge page and the photo viewer.
