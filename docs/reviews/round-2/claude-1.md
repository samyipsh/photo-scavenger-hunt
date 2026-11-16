## Scores

| Category | Score | Reason |
| --- | --- | --- |
| 1. Scope fit | 6 | The core loop was built and used on the day, but crop and rotate, saving many photos to a phone and three kinds of draft go well past one morning's needs. |
| 2. Phone UX and accessibility | 8 | The code keeps text at 16 px and targets at 44 px, labels its icon buttons and handles Android Back; I didn't try a screen reader. |
| 3. Reliability and tests | 7 | Upload retries are safe on the server and checked end to end, but CI never runs the phone's retry loop or the real R2 code. |
| 4. Security and privacy | 6 | GPS is stripped and the bucket is private, but nothing reads the documented session secret and concurrent guesses get past the sign-in lockout. |
| 5. Performance and cost | 7 | The scoreboard cache and signed links fit the job well, but every gallery check still reads every photo row, and the group page makes three D1 trips one after another. |
| 6. Running it on the day | 7 | Controls covered everything used on the day, but blocking a phone means deleting one of its photos or typing SQL. |
| 7. Maintainability | 7 | Event data is cleanly in `data/` and AGENTS.md is precise, but four screen files run 860 to 1,030 lines and the judging panel is written twice. |
| 8. Docs and honesty | 7 | Most claims hold, line counts and token costs included, but one secret is documented wrongly and the lockout is called atomic when it isn't. |
| 9. AI slop | 5 | Almost no dead exports, but there are 11,500 lines of screens, code for data that only existed mid-build, and comments that narrate the code. |

## Evidence

**1. Scope fit**
- Every page in app-plan.md:100-109 exists, and the usage file shows uploads, judging, hiding, deleting, scores and the freeze all in use.
- Beyond the plan: `usePhotoSave.ts` is 456 lines of share-sheet batching, yet app-plan.md:180 has the organiser export the album. Crop is about 540 lines across `PhotoCrop.vue`, `crop.ts` and its test. There are four draft kinds (useUploadQueue.ts:404-420). The usage file has no data on any of them.
- `app/` is 11,469 lines by `wc`, against "about 10,000" on the day (how-it-was-built.md:35).

**2. Phone UX**
- Grep finds no `text-xs` or `text-sm` in `app/` outside `components/ui`. Button `sm` and `icon` are raised to `h-11` (ui/button/index.ts:19-26), and the heart is `h-11 min-w-11` (gallery/Tile.vue:117).
- 169 `aria-label`, live-region and `sr-only` uses across 43 files. Tile labels add ", doesn't count" (Tile.vue:19, 75).
- `useBackClose.ts` uses CloseWatcher rather than adding history entries.
- The inactive tabs are grey on grey in docs/screens/manage.jpg.

**3. Reliability**
- check-all.log:651-707 shows 55 API checks passing, including "three finishes at once keep one photo" and both conflict checks at 676-677.
- finish.post.ts:47-63 handles each insert race. Keys that carry the checksum make kept files write-once (storage.ts:51-57).
- `run()` at useUploadQueue.ts:243-294 has no test. Only `uploadRules` and `queueStore` are tested.
- CI goes through `devStore` (storage.ts:161, 232-248), so signed PUTs, the CopyObject `if-match` and CORS are only checked by hand on staging.

**4. Security**
- `NUXT_APP_SECRET` appears only in .env.example:7, check.yml:21, architecture.md:232 and the reuse skill. Nothing reads it. nuxt-auth-utils seals sessions with `NUXT_SESSION_PASSWORD`, which `nuxt dev` writes into `.env`. So the live key is most likely the deploying laptop's dev key, put into the build by `nuxt build`.
- login.post.ts:24-28 checks the failure count before the increment at 35-43, so a burst of guesses all pass the check.
- image.ts:84-89 always re-encodes the photo, which strips GPS. Device IDs never appear in public answers (gallery.ts:12-29).
- A sender's move sets `verdict: 'pending'` without checking that the challenge changed (photos/[id]/index.patch.ts:37-41). That can undo a judge's rejection, though flows.md:71 says the sender can't.

**5. Performance**
- scoreboard.ts:17-28 reads everything in one batch, and a cached answer takes one query (70-89).
- gallery/index.get.ts:17-27 rebuilds, signs and hashes the whole list on every 30-second check. The 304 only saves bandwidth; caching.md estimates about 5 million rows read an hour at 50 people.
- g/[token]/index.get.ts:9, 11 and 31 make three D1 trips one after another with no `db.batch`, which goes against the README's own advice.
- The largest client chunk is 46 KB gzipped (check-all.log:103). main.css:2 imports Google Fonts.

**6. On the day**
- The committee home shows photos to check, hidden photos, scores and the round (committee.jpg, overview.get.ts).
- The only way to block a phone is Delete as inappropriate ([id].patch.ts:75-83). A blocked phone shows a code (devices.ts:20), but no screen accepts one, and watch-live.ts:58-59 expects device IDs to be "pasted into database commands".
- watch-live.ts flags busy phones, busy addresses and unfinished uploads each minute, and refusal-log.ts records why each request was refused.
- Stuck uploads show only on the sending phone (architecture.md:98).

**7. Maintainability**
- A new station touches data/event.ts (stations, SLOT_COUNT, ROUND_COUNT, HELP_CONTACTS), its photo challenge in challenges.ts, and guide.ts:20 and :25, whose "six rounds of 20 minutes" and "five groups" are typed by hand. Then reseed. tests/data.test.ts:39-53 catches slot mismatches.
- A new challenge kind touches challenges.ts:16-31 and the copy of the type list in schema.ts:37.
- The judging code is duplicated. judge.vue:96 matches PhotoViewer.vue:121, and judge.vue:776-781 nearly matches PhotoViewer.vue:849-854.
- `wrangler.example.jsonc` duplicates `wrangler.jsonc`, and nothing refers to it.

**8. Docs.** I checked 12 claims.
- True: the line counts (11,469, 2,171 and 1,083 by `wc`), the token costs, bytes never passing through the Worker (the dev routes are shut by `import.meta.dev`), GPS stripping, 50-photo batches (log:705), the answers never shipping (data.test.ts:107), the one-query scoreboard and noindex.
- False: .env.example:6 says `NUXT_APP_SECRET` "seals the committee's session cookie". Nothing reads it.
- Overstated: the "atomic sign-in lockout" in commit 9416f8d. Also "No location" for photos (app-plan.md:92), while `photos.lat` and `photos.lng` are still in schema.ts:82-83. And "every commit carries a Claude co-author line", though commit 51642cb has none.
- Can't be checked: the load test, whose scripts were "kept out of the repo" (app-plan.md:49), and the 187 commits, since the public history is squashed to four.

**9. Slop**
- Code for data that only existed mid-build: storage.ts:49-50, the optional `(-[0-9a-f]{16})?` in the img route's regex, queueStore.ts:26, useMyGroup.ts:4 and scoring.ts:17.
- 1,209 comment lines across pages, composables and server. Tile.vue:6-16 is an 11-line header describing the component's behaviour.
- viewLinks.ts is a hand-written link signer beside aws4fetch, plus a 5,000-link cache, for 335 photos.
- Dead exports: I grepped every export in the utils, composables and server utils, and nearly all are used.

## Biggest problems

1. **The session secret is documented wrongly.** Anyone reusing the app sets a secret that does nothing. The real key comes from a dev `.env`, or is empty when deploying from a fresh clone, and sign-in then fails. Fix: use `NUXT_SESSION_PASSWORD` everywhere and fail the build without it.
2. **A sender can undo a judge's rejection** with a move (index.patch.ts:37-41). Fix: refuse a move to the same challenge.
3. **CI doesn't test the phone's retry loop or real R2.** Fix: unit-test `run()` with fake fetch and XHR for offline, 409 and stall. Add the `wrangler dev` run with local S3 keys that architecture.md:226 already describes to check-all.
4. **The lockout can be raced.** Fix: upsert first, return the failure count, then compare.
5. **The screens are too big.** That's 11,500 lines, four files of 860 to 1,030 lines, and judging written twice. Fix: have `/c/judge` use PhotoViewer's review mode instead of its own panel.

## Low-hanging fruit

1. Rename the secret in .env.example, check.yml, architecture.md, the reuse skill and wrangler.example.jsonc. Security, Docs.
2. In login.post.ts, increment first and check the returned count. Security.
3. In photos/[id]/index.patch.ts, refuse a move to the same challenge. Security.
4. Use one `db.batch` in g/[token]/index.get.ts and committee/overview.get.ts. Performance.
5. Drop the Google Fonts import at main.css:2 and use the system font. Performance, privacy.
6. Add a migration that drops `photos.lat` and `photos.lng`. Slop, Docs.
7. Delete wrangler.example.jsonc. Maintainability.
8. Move judge.vue:96 and 772-781 and PhotoViewer.vue:121 and 845-854 into one committee component. Slop.

## What you couldn't check

- This copy has no node_modules. The env var nuxt-auth-utils reads comes from its documentation, not its source, and the dev key ending up in the build is my inference.
- I ran nothing and relied on check-all.log. I didn't open the demo, use a screen reader or try real phones, and I looked at 5 of the 18 screenshots.
- Real R2, staging, what Workers Logs actually holds, the load test (its scripts aren't in the repo) and the original 187-commit history.
- Whether the challenge picker lets a sender pick the photo's current challenge again. The API allows it.
