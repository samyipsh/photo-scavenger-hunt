## Scores

| Category | Score | Reason |
| --- | --- | --- |
| Scope fit | 6 | The core flows match the plan and all of them were used on the day. Bulk save, crop, demo mode and a dead retarget path add thousands of lines a 280-photo morning didn't need. |
| Phone UX and accessibility | 8 | Text is large, tap targets are 44 px, icon buttons are labelled, and live regions and Android Back all work. I didn't test with a screen reader. |
| Reliability and tests | 7 | The server is safe to retry and refuses clashing writes, and the API check covers this. The phone's upload and score queues have no tests, and CI never touches real R2. |
| Security and privacy | 7 | It holds to its own threat model. The sign-in limit can be raced, and nothing enforces the long passphrase it relies on. |
| Performance and cost | 7 | The scoreboard cache and ETags are sound. The gallery and group page still read every photo row and sign every link on each poll. |
| Running it on the day | 7 | The committee has the controls it needs on a phone. Phones that can't upload only show up if someone runs a script on a laptop. |
| Maintainability | 6 | Adding a station only touches `data/`. Singapore's time zone and emergency number live in the engine, and four files are over 850 lines. |
| Docs and honesty | 6 | The docs are open about known gaps, but six of the claims I checked are false or overstated. |
| AI slop | 5 | There's dead code, compatibility code for old data a fresh install can't have, a duplicated config file, and 11,700 lines of screens for five groups. |

## Evidence

**Scope fit**
- Every setting in usage-on-the-day.md:11 maps to a real screen, and all 25 station scores went through `/c/station`.
- usePhotoSave.ts is 456 lines of bulk saving to the phone. app-plan.md:103 doesn't list it, and app-plan.md:179 has the organiser exporting photos from R2 instead.
- `retarget` appears only at useUploadQueue.ts:431 and :439. architecture.md:53 admits no screen calls it.
- app/ is 11,714 lines without components/ui. how-it-was-built.md:118 says an unscoped UX hill-climb loop doubled the code.

**Phone UX and accessibility**
- Grep finds no `text-xs` or `text-sm` in app/ outside components/ui.
- Tile.vue:117 gives the like heart a 44 px box with `aria-pressed` and a label that names the photo.
- useBackClose.ts:33-53 uses the browser's CloseWatcher, and BottomSheet.vue:16 opts every sheet in.
- At NowCard.vue:123, the icon's `aria-label="map"` adds "map" to the link's spoken name.

**Reliability and tests**
- uploads.ts:30-34 answers "saved" for a photo ID it already has. finish.post.ts:47-63 handles two finishes racing, and storage.ts:209 copies a file only if it's unchanged since the check.
- Saving a score (stations/[id].post.ts:26-42) or a verdict (committee/photos/[id].patch.ts:36-41) over someone else's change gets a 409. useScoreQueue.ts:110-113 treats a resent save that already landed as saved.
- All 52 API checks pass (check-all.log:647-702). No test touches useUploadQueue, useScoreQueue or useCommitteeBatch. Only the pure helpers in uploadRules.test.ts are tested.
- check-all.ts:19 runs the API check against `pnpm dev`, which uploads to a stand-in route (dev-upload/[...key].put.ts:4-10). So log line 658, "refused by storage", tests the stand-in, not R2.

**Security and privacy**
- `grep -L requireCommittee` over the committee routes lists only login and logout.
- image.ts:84 re-encodes every photo through a canvas, so location data goes. refusalLog.ts:11 logs route patterns, not group tokens.
- login.post.ts:24-37 reads the failure count, then writes it back plus one. Parallel guesses therefore count once, and the limit is per IP address. Nothing checks the passphrase's length, though app-plan.md:117 says length is the real defence.
- origin.ts:8 lets through any request with no Origin header. That's harmless here: group routes need no cookie, and the session cookie is SameSite=Lax.

**Performance and cost**
- The scoreboard (scoreboard.ts:61-84) is one cached row, saved after the answer goes out. caching.md:69-71 has the live timings.
- The biggest page script is 46.7 kB gzipped (check-all.log:100).
- gallery/index.get.ts:17-27 reads every photo row and signs two links per photo before it works out the ETag. A 304 saves bytes but not D1 reads. caching.md:88 admits an hour of 50 people watching uses the free plan's whole daily read allowance.
- g/[token]/index.get.ts:11-31 makes eight separate D1 calls per refresh, though README.md:60 tells reusers to batch them.

**Running it on the day**
- Committee home shows photos to check, hidden photos, whether scores are in, and the current round (docs/screens/committee.jpg).
- Controls has Unblock at scores.vue:417 and Close uploads behind a confirm at :501. settings.post.ts:20 refuses a round start more than four hours from the plan.
- architecture.md:104 says nothing alerts the committee when phones can't upload.
- Only 10 photos were never judged, so the judges kept up.

**Maintainability**
- A new station means editing data/event.ts (the station, SLOT_COUNT, ROUND_COUNT, HELP_CONTACTS) and data/challenges.ts, rewriting "six rounds" and "five groups" by hand in data/guide.ts:20-25, then reseeding. tests/data.test.ts:39-53 catches counts that don't match. No engine file changes.
- Singapore's time zone, UTC+8, is written into rotation.ts:9 and :83, photoTime.ts:16, demo.ts:20, storage.ts:117 and useClock.ts:11. Singapore's emergency number, 995, is at help.vue:63.
- The four biggest files are gallery.vue (1,021 lines), PhotoViewer.vue (936), judge.vue (889) and g/[token].vue (867).
- `demoPhotos` is called in 19 server files. A new photo query that forgets it shows visitors each other's photos in demo mode.

**Docs and honesty**
These claims hold: GPS is stripped (image.ts:84), the `/img` route is closed in built apps (storage.ts:122), the batch limit is 50 (photos.ts:10), the group caps are 400 and 200 (limits.ts:2-4), uploads stall out after 30 s (useUploadQueue.ts:84), kept photo keys carry a checksum (storage.ts:50-56), and phones cache photos for two days (storage.ts:98).

These are false or overstated:
1. "The group page only gets thumbnail links" (architecture.md:31, caching.md:104). g/[token]/index.get.ts:60 also signs the full-size link.
2. "No location" on photos (app-plan.md:91). schema.ts:81-82 has `lat` and `lng` columns that nothing writes.
3. "Requests that change anything must come from the app's own address" (app-plan.md:117). Not when the Origin header is missing.
4. "Every commit carries a Claude co-author line" (how-it-was-built.md:3). Commit 51642cb doesn't.
5. "The engine doesn't know about our outing" (README.md:52). It knows Singapore's time zone and emergency number.
6. "Built to fit the free plan anyway" (app-plan.md:47) contradicts caching.md:88. The README's line count is also low: it says about 16,000, and I counted about 17,400.

**AI slop**
- Dead code: `retarget`, `moveIfPicked` and the `retargeted` flag (useUploadQueue.ts:258-277 and 430-437), and the photos `lat`/`lng` columns.
- Compatibility code for old data that a fresh install can't have: storage.ts:46-49 handles keys "kept before this", img/[...key].get.ts:6 makes the checksum optional, and schema.ts:67 covers photos "hidden before this was kept".
- wrangler.example.jsonc repeats wrangler.jsonc, which is already all placeholders.
- The line that joins who must be in the shot with the hint is written twice, at judge.vue:113 and PhotoViewer.vue:135.

## Biggest problems

1. **Singapore is built into the engine.** Someone running it in another country gets wrong round times, wrong photo times and resets at the wrong hour. Worse, they get a "Call 995" link that dials the wrong emergency number. Smallest fix: add `TIME_ZONE` and `EMERGENCY_NUMBER` to data/event.ts, read them in the six files and help.vue, and list both in the reuse skill.
2. **Nothing tells a reuser to pay for Workers Paid.** Neither the README nor the reuse skill mentions it. Yet caching.md:88 and app-plan.md:46 show the free plan runs out of D1 reads, and cold starts exceed its CPU limit, at 50 people. Smallest fix: one sentence in both. A fuller fix is to cache the gallery list in one database row, as caching.md:93 already describes.
3. **The code most likely to lose a photo or a score has no tests.** That's the phone's upload and score queues, useUploadQueue.ts and useScoreQueue.ts, and CI never runs them. Smallest fix: one vitest file with fake fetch and XHR, covering a lost finish answer, a 409 that starts the upload again, and a 423.
4. **The sign-in protection is weaker than the docs say.** Smallest fix: do the increment in SQL (`failures = failures + 1`), and refuse to sign anyone in while the passphrase is under 16 characters.
5. **The size isn't earned.** Start by deleting `retarget`, the photos `lat`/`lng` columns, the old-key handling and wrangler.example.jsonc.

## Low-hanging fruit

1. Put the emergency number in data/event.ts and read it in help.vue. Maintainability.
2. Add a line on Workers Paid to README.md and the reuse skill. Docs and honesty.
3. Drop `largeUrl` at g/[token]/index.get.ts:60, or correct the two doc lines. Performance and cost, Docs and honesty.
4. Make the failure count at login.post.ts:36 an atomic increment. Security and privacy.
5. Delete `retarget` and `moveIfPicked` from useUploadQueue.ts. AI slop.
6. Drop the photos `lat`/`lng` columns with a migration (schema.ts:81-82). AI slop, Docs and honesty.
7. Delete wrangler.example.jsonc. AI slop.
8. Mark the map icon at NowCard.vue:123 `aria-hidden`. Phone UX and accessibility.

## What you couldn't check

- I didn't open the live demo, use a real phone or try a screen reader.
- The check log ran in `review/repo`, not `review/pub`. I took it on trust that the two copies match.
- I ran no build, tests or load test of my own. The sandbox wouldn't let me run node, so I counted lines and searched for unused code with grep.
- I couldn't verify from this copy: the token and hours figures, the 187-commit history, the UX review scores, the R2 billing alert, or whether Workers Logs keeps cookie headers.

The background sweep for unused and duplicated code finished after I sent the review. I spot-checked two of its findings, and they hold. Nothing in it changes a score, but it adds to the AI slop evidence (still 5):

- **Needless `export`s.** 25 exports are used only inside their own file, most of them types, such as `saveScoreboardCache` at scoreboard.ts:90 and `rankPlaces` at scoring.ts:93. Two are dead: `LikeResult` at app/types/api.ts:52 and the `cn` re-export at app/lib/utils.ts:1. Both files export a `ScoreEntry` (shared/utils/scoring.ts:6 and useScoreQueue.ts:14), and the app auto-imports both, so the names clash.
- **More code for old data.** queueStore.ts:27-28 and :170-172 still load drafts saved as Files. But queueStore.ts:53 drops anything older than a day, so no such draft can exist any more. There's also a database version 2 upgrade at queueStore.ts:64-67, and a fallback for groups saved without an `id` at useMyGroup.ts:4-5.
- **Judging is wired up twice.** judge.vue:855-871 and PhotoViewer.vue:889-900 mount the same five shared sheets and dialogs. Each file then has its own state and its own PATCH calls to drive them. This accounts for much of why both files are close to 900 lines.
- **Hiding a photo and "mark deleted, then delete the files" are written separately in three routes.** These are committee/photos/[id].patch.ts, batch.post.ts and photos/[id]/index.patch.ts. Only the batch route tries the file delete a second time.
- **Committee deletes get two different reasons.** A single photo is labelled "Deleted on request" ([id].patch.ts:70), but the batch labels them "Deleted by the committee" (batch.post.ts:64). So the 21 "Deleted on request" in the day's usage may include deletes nobody asked for.
- **Small helpers written more than once.** SHA-256 to hex appears four times (etag.ts:10-11, viewLinks.ts:20 and :55, useUploadQueue.ts:73-74). A fetch timeout is written by hand twice (useUploadQueue.ts:91-110, gallery.vue:415-430). The long-press guard is copied between gallery.vue:446-472 and c/hidden.vue:99-119. About 16 calls add the `x-device-id` header themselves.

If you act on these, add three items to the low-hanging fruit list. Delete the old-draft and version 2 upgrade code in queueStore.ts. Use one reason, from `FILES_DELETED`, for every committee delete. And move SHA-256 to hex into one helper in `shared/utils`.
